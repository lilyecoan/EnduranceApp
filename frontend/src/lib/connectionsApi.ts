const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type ProviderId = "intervals_icu" | "strava" | "file_upload";

export type SourceStatus = {
  provider: ProviderId;
  connected: boolean;
  used_for_coaching: boolean;
  activities: number;
  wellness_days: number;
  oauth_available?: boolean;
  api_key_available?: boolean;
  auth_type?: "oauth" | "api_key" | null;
  last_sync_at?: string | null;
  last_sync_error?: string | null;
};

export type ConnectionsResponse = { sources: SourceStatus[]; configured: boolean };

export type SyncResult = { activities: number; wellness_days: number; error?: string | null };

export type UploadResult = {
  files_processed: number;
  activities: number;
  wellness_days: number;
  skipped: string[];
};

async function request<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${BACKEND}/api/v1/connections${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const listConnections = (token: string | null) => request<ConnectionsResponse>(token, "");

export async function startOAuth(
  token: string | null,
  provider: "intervals_icu" | "strava",
  returnTo: "/settings" | "/onboarding" = "/settings",
) {
  const { url } = await request<{ url: string }>(
    token,
    `/${provider}/authorize?return_to=${encodeURIComponent(returnTo)}`,
    { method: "POST" },
  );
  window.location.assign(url);
}

export const connectIntervalsApiKey = (token: string | null, athleteId: string, apiKey: string) =>
  request<SyncResult>(token, "/intervals_icu/api-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ athlete_id: athleteId.trim(), api_key: apiKey.trim() }),
  });

export const syncNow = (token: string | null, provider: "intervals_icu" | "strava") =>
  request<SyncResult>(token, `/${provider}/sync`, { method: "POST" });

export const disconnect = (token: string | null, provider: "intervals_icu" | "strava") =>
  request<void>(token, `/${provider}`, { method: "DELETE" });

export function uploadFile(token: string | null, file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>(token, "/file_upload", { method: "POST", body: form });
}

export const deleteUploadedData = (token: string | null) =>
  request<void>(token, "/file_upload/data", { method: "DELETE" });
