"""Athlete-chosen data sources: Intervals.icu, Strava, and file uploads."""
import uuid
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlencode

import httpx
import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt, encrypt, sign_oauth_state, verify_oauth_state
from app.core.security import get_current_user
from app.db.base import get_db
from app.models.activity import Activity
from app.models.connection import DataConnection
from app.models.recovery import RecoveryMetric
from app.models.user import User
from app.services import sync
from app.services.sources import AI_EXCLUDED_SOURCES, file_import, intervals_icu, strava

log = structlog.get_logger()
router = APIRouter(prefix="/connections", tags=["connections"])

Provider = Literal["intervals_icu", "strava"]
MAX_UPLOAD_BYTES = 200 * 1024**2


def _oauth_config(provider: str) -> tuple[str, str]:
    if provider == intervals_icu.SOURCE:
        return settings.intervals_client_id, settings.intervals_client_secret
    return settings.strava_client_id, settings.strava_client_secret


def _redirect_uri(provider: str) -> str:
    return f"{settings.backend_public_url.rstrip('/')}/api/v1/connections/{provider}/callback"


def _back_to_app(**params: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/settings?{urlencode(params)}")


async def _get_connection(db: AsyncSession, user_id, provider: str):
    result = await db.execute(
        select(DataConnection).where(DataConnection.user_id == user_id, DataConnection.provider == provider)
    )
    return result.scalar_one_or_none()


async def _save_connection(db: AsyncSession, user_id, provider: str, **fields) -> DataConnection:
    conn = await _get_connection(db, user_id, provider)
    if conn is None:
        conn = DataConnection(user_id=user_id, provider=provider, **fields)
        db.add(conn)
    else:
        for key, value in fields.items():
            setattr(conn, key, value)
        conn.last_sync_error = None
    await db.flush()
    return conn


async def _source_counts(db: AsyncSession, user_id, source: str) -> dict:
    activities = await db.scalar(
        select(func.count()).select_from(Activity).where(Activity.user_id == user_id, Activity.source == source)
    )
    wellness = await db.scalar(
        select(func.count())
        .select_from(RecoveryMetric)
        .where(RecoveryMetric.user_id == user_id, RecoveryMetric.source == source)
    )
    return {"activities": activities or 0, "wellness_days": wellness or 0}


@router.get("")
async def list_connections(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Status of every source the athlete can choose from."""
    sources = []
    for provider in (intervals_icu.SOURCE, strava.SOURCE):
        conn = await _get_connection(db, current_user.id, provider)
        client_id, _ = _oauth_config(provider)
        sources.append(
            {
                "provider": provider,
                "oauth_available": bool(client_id),
                "api_key_available": provider == intervals_icu.SOURCE,
                "connected": conn is not None,
                "auth_type": conn.auth_type if conn else None,
                "last_sync_at": conn.last_sync_at.isoformat() if conn and conn.last_sync_at else None,
                "last_sync_error": conn.last_sync_error if conn else None,
                "used_for_coaching": provider not in AI_EXCLUDED_SOURCES,
                **await _source_counts(db, current_user.id, provider),
            }
        )
    sources.append(
        {
            "provider": file_import.SOURCE,
            "connected": True,
            "used_for_coaching": True,
            **await _source_counts(db, current_user.id, file_import.SOURCE),
        }
    )
    return {"sources": sources, "configured": bool(settings.token_encryption_key)}


@router.post("/{provider}/authorize")
async def start_oauth(provider: Provider, current_user: User = Depends(get_current_user)):
    """Return the provider consent URL; the browser navigates there."""
    client_id, _ = _oauth_config(provider)
    if not client_id:
        raise HTTPException(status_code=503, detail=f"{provider} sign-in is not configured on this server yet.")
    state = sign_oauth_state(str(current_user.id), provider)
    module = intervals_icu if provider == intervals_icu.SOURCE else strava
    return {"url": module.authorize_url(client_id, _redirect_uri(provider), state)}


@router.get("/{provider}/callback", include_in_schema=False)
async def oauth_callback(
    provider: Provider,
    state: str = "",
    code: str = "",
    error: str = "",
    scope: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Provider redirect target. The athlete is identified by the signed state,
    since this browser redirect carries no bearer token."""
    if error or not code:
        return _back_to_app(source=provider, error=error or "cancelled")
    user_id = uuid.UUID(verify_oauth_state(state, provider))
    client_id, client_secret = _oauth_config(provider)
    try:
        if provider == intervals_icu.SOURCE:
            token = await intervals_icu.exchange_code(client_id, client_secret, code)
            fields = {
                "auth_type": "oauth",
                "encrypted_access_token": encrypt(token["access_token"]),
                "external_athlete_id": str((token.get("athlete") or {}).get("id") or ""),
                "scopes": token.get("scope"),
            }
        else:
            # Strava reports the granted scopes on the redirect, and athletes
            # can untick activity access on its consent screen.
            if "activity:read" not in scope:
                return _back_to_app(source=provider, error="activity_permission_not_granted")
            token = await strava.exchange_code(client_id, client_secret, code)
            fields = {
                "auth_type": "oauth",
                "encrypted_access_token": encrypt(token["access_token"]),
                "encrypted_refresh_token": encrypt(token["refresh_token"]),
                "token_expires_at": datetime.fromtimestamp(token["expires_at"], tz=timezone.utc),
                "external_athlete_id": str((token.get("athlete") or {}).get("id") or ""),
                "scopes": scope,
            }
    except httpx.HTTPError as exc:
        log.warning("oauth_exchange_failed", provider=provider, error=str(exc))
        return _back_to_app(source=provider, error="token_exchange_failed")

    conn = await _save_connection(db, user_id, provider, **fields)
    await sync.sync_connection(db, conn)
    return _back_to_app(source=provider, connected="1")


class IntervalsApiKeyRequest(BaseModel):
    athlete_id: str = Field(min_length=1, max_length=32, pattern=r"^i?\d+$")
    api_key: str = Field(min_length=8, max_length=200)


@router.post("/intervals_icu/api-key")
async def connect_intervals_api_key(
    body: IntervalsApiKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect with the athlete's own Intervals.icu personal API key.

    Intervals.icu intends personal keys for an athlete's own data; apps for
    many users should use OAuth. Offered for self-use and development until
    the OAuth app is approved.
    """
    client = intervals_icu.IntervalsClient(api_key=body.api_key, athlete_id=body.athlete_id)
    try:
        await client.get_athlete()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=400, detail="Intervals.icu rejected that athlete ID / API key.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach Intervals.icu.") from exc

    conn = await _save_connection(
        db,
        current_user.id,
        intervals_icu.SOURCE,
        auth_type="api_key",
        encrypted_access_token=encrypt(body.api_key),
        encrypted_refresh_token=None,
        token_expires_at=None,
        external_athlete_id=body.athlete_id,
        scopes=None,
    )
    return await sync.sync_connection(db, conn)


@router.post("/{provider}/sync")
async def sync_now(provider: Provider, current_user: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    conn = await _get_connection(db, current_user.id, provider)
    if conn is None:
        raise HTTPException(status_code=404, detail=f"{provider} is not connected.")
    return await sync.sync_connection(db, conn)


@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect(provider: Provider, current_user: User = Depends(get_current_user),
                     db: AsyncSession = Depends(get_db)):
    """Revoke access at the provider (best effort) and delete its imported data."""
    conn = await _get_connection(db, current_user.id, provider)
    if conn is not None:
        try:
            if provider == strava.SOURCE:
                await strava.deauthorize(decrypt(conn.encrypted_access_token))
            elif conn.auth_type == "oauth":
                await sync.intervals_client(conn).disconnect()
        except (httpx.HTTPError, HTTPException) as exc:
            log.warning("provider_revoke_failed", provider=provider, error=str(exc))
        await db.delete(conn)
    await sync.delete_source_data(db, current_user.id, provider)
    await db.commit()


@router.post("/file_upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a .fit file, a .zip of .fit files (incl. Garmin's data export),
    or an Apple Health export."""
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 200 MB.")
    try:
        parsed = file_import.parse_upload(file.filename or "", data)
    except file_import.UnsupportedFile as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    activities = await sync.upsert_activities(db, current_user.id, file_import.SOURCE, parsed.activities)
    wellness = await sync.upsert_recovery(db, current_user.id, file_import.SOURCE, parsed.recovery)
    await db.commit()
    return {
        "files_processed": parsed.files_processed,
        "activities": activities,
        "wellness_days": wellness,
        "skipped": parsed.skipped,
    }


@router.delete("/file_upload/data", status_code=status.HTTP_204_NO_CONTENT)
async def delete_uploaded_data(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await sync.delete_source_data(db, current_user.id, file_import.SOURCE)
    await db.commit()
