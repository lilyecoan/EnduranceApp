#!/usr/bin/env bash
# Deploy IronMind to Google Cloud Run (backend + frontend), Postgres on Neon.
#
# Usage: scripts/deploy_gcp.sh <file-containing-neon-DATABASE_URL>
#
# Secret values are read from backend/.env at run time and stored in Secret
# Manager; nothing secret is written to this repo. The Garmin demo login
# (GARMIN_EMAIL/PASSWORD) is intentionally not deployed.
set -euo pipefail

PROJECT=project-6b54a019-cdf3-4a73-9ad
REGION=us-central1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_URL_FILE="${1:?usage: deploy_gcp.sh <file-with-neon-DATABASE_URL>}"

val() { grep -m1 "^$1=" "$ROOT/backend/.env" | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

put_secret() {
  local name=$1 value=$2
  [ -n "$value" ] || { echo "Missing value for $name" >&2; exit 1; }
  if gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT" >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic --project "$PROJECT" >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" --project "$PROJECT" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor >/dev/null
  echo "  secret $name stored"
}

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
CLERK_ISSUER=$(val CLERK_ISSUER)
CLERK_PUBLISHABLE_KEY=$(val CLERK_PUBLISHABLE_KEY)

echo "1/4 Storing secrets in Secret Manager"
put_secret ironmind-database-url "$(cat "$DB_URL_FILE")"
put_secret ironmind-clerk-secret-key "$(val CLERK_SECRET_KEY)"
put_secret ironmind-gemini-api-key "$(val GEMINI_API_KEY)"
put_secret ironmind-openweather-api-key "$(val OPENWEATHER_API_KEY)"
BACKEND_SECRETS="DATABASE_URL=ironmind-database-url:latest,CLERK_SECRET_KEY=ironmind-clerk-secret-key:latest,GEMINI_API_KEY=ironmind-gemini-api-key:latest,OPENWEATHER_API_KEY=ironmind-openweather-api-key:latest"

# Production token-encryption key: generated once, never the local dev key.
# Rotating it would make every stored provider token undecryptable.
if ! gcloud secrets describe ironmind-token-encryption-key --project "$PROJECT" >/dev/null 2>&1; then
  put_secret ironmind-token-encryption-key \
    "$("$ROOT/backend/.venv/bin/python" -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode(), end="")')"
fi
BACKEND_SECRETS="$BACKEND_SECRETS,TOKEN_ENCRYPTION_KEY=ironmind-token-encryption-key:latest"

# Optional: data-source app credentials, included once they're in backend/.env.
for var in INTERVALS_CLIENT_ID INTERVALS_CLIENT_SECRET STRAVA_CLIENT_ID STRAVA_CLIENT_SECRET; do
  value=$(val "$var" || true)
  if [ -n "$value" ]; then
    name="ironmind-$(echo "$var" | tr '[:upper:]_' '[:lower:]-')"
    put_secret "$name" "$value"
    BACKEND_SECRETS="$BACKEND_SECRETS,$var=$name:latest"
  fi
done

echo "2/4 Deploying backend (Cloud Build, ~5 min)"
gcloud run deploy ironmind-backend --source "$ROOT/backend" --project "$PROJECT" --region "$REGION" \
  --port 8000 --allow-unauthenticated --quiet \
  --set-secrets "$BACKEND_SECRETS" \
  --set-env-vars "ENVIRONMENT=production,CLERK_ISSUER=$CLERK_ISSUER,CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY"
BACKEND_URL=$(gcloud run services describe ironmind-backend --project "$PROJECT" --region "$REGION" --format='value(status.url)')

echo "3/4 Deploying frontend (Cloud Build, ~5 min)"
cat > "$ROOT/frontend/.env.production" <<EOF
NEXT_PUBLIC_BACKEND_URL=$BACKEND_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
EOF
gcloud run deploy ironmind-frontend --source "$ROOT/frontend" --project "$PROJECT" --region "$REGION" \
  --port 3000 --allow-unauthenticated --quiet \
  --set-secrets CLERK_SECRET_KEY=ironmind-clerk-secret-key:latest \
  --set-env-vars HOSTNAME=0.0.0.0
FRONTEND_URL=$(gcloud run services describe ironmind-frontend --project "$PROJECT" --region "$REGION" --format='value(status.url)')
FRONTEND_URLS=$(gcloud run services describe ironmind-frontend --project "$PROJECT" --region "$REGION" --format='value(metadata.annotations."run.googleapis.com/urls")' | tr -d '[]" ')

echo "4/4 Pointing backend CORS and OAuth redirects at the deployed URLs"
gcloud run services update ironmind-backend --project "$PROJECT" --region "$REGION" --quiet \
  --update-env-vars "^@^CORS_ORIGINS=${FRONTEND_URLS:-$FRONTEND_URL}@FRONTEND_URL=$FRONTEND_URL@BACKEND_PUBLIC_URL=$BACKEND_URL" >/dev/null

echo
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL  (health: $BACKEND_URL/health)"
echo "OAuth redirect URIs to register with providers:"
echo "  Intervals.icu: $BACKEND_URL/api/v1/connections/intervals_icu/callback"
echo "  Strava (callback domain): ${BACKEND_URL#https://}"
