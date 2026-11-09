"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Activity, CheckCircle, Key, Link, RefreshCw, Trash2, Upload, AlertTriangle } from "lucide-react";
import {
  connectIntervalsApiKey,
  deleteUploadedData,
  disconnect,
  listConnections,
  startOAuth,
  syncNow,
  uploadFile,
  type ProviderId,
  type SourceStatus,
} from "@/lib/connectionsApi";

const PROVIDER_INFO = {
  intervals_icu: {
    name: "Intervals.icu",
    blurb: "Connect your Garmin to Intervals.icu once, then link it here. Brings in workouts plus HRV, sleep, resting HR, weight and fitness/fatigue.",
    badge: "Recommended",
  },
  strava: {
    name: "Strava",
    blurb: "Workouts only (no sleep or HRV). Strava's terms don't allow its data to be used with AI, so Strava workouts are shown to you but never sent to your AI coach.",
    badge: null,
  },
  file_upload: {
    name: "Upload files",
    blurb: "Drop in .fit workout files, a .zip of them (including Garmin's “Export Your Data” archive), or an Apple Health export (export.zip).",
    badge: null,
  },
} as const;

function formatWhen(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString() : "never";
}

function Counts({ s }: { s: SourceStatus }) {
  return (
    <span className="text-[10px] text-[#525252]">
      {s.activities} workouts · {s.wellness_days} wellness days
    </span>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#4ade80] bg-[#16a34a]/10 border border-[#16a34a]/20 px-3 py-1 rounded-full uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" /> Connected
    </span>
  ) : (
    <span className="text-[10px] font-bold text-[#404040] bg-[#1a1a1a] border border-[#222] px-3 py-1 rounded-full uppercase tracking-wider">
      Not connected
    </span>
  );
}

const buttonCls =
  "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#262626] bg-[#151515] text-[#d4d4d4] hover:bg-[#1c1c1c] disabled:opacity-40 disabled:cursor-not-allowed";
const primaryCls =
  "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#CE0E2D] text-white hover:bg-[#b00c27] disabled:opacity-40 disabled:cursor-not-allowed";
const inputCls =
  "w-full text-xs bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-white placeholder:text-[#404040] focus:outline-none focus:border-[#404040]";

type DataSourcesProps = {
  /** Render only these sources (e.g. inside onboarding). Defaults to all. */
  only?: ProviderId[];
  /** Hide the section heading when embedded in another page. */
  embedded?: boolean;
  /** Page the provider sends the athlete back to after connecting. */
  returnTo?: "/settings" | "/onboarding";
};

export default function DataSources({ only, embedded = false, returnTo = "/settings" }: DataSourcesProps = {}) {
  const { getToken } = useAuth();
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [athleteId, setAthleteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await listConnections(await getToken());
      setSources(res.sources);
      setConfigured(res.configured);
    } catch (e) {
      setMessage({ kind: "error", text: `Couldn't load data sources: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await refresh();
      if (cancelled) return;
      // Result of an OAuth round-trip: /settings?source=...&connected=1 | &error=...
      const params = new URLSearchParams(window.location.search);
      const source = params.get("source") as keyof typeof PROVIDER_INFO | null;
      if (source && PROVIDER_INFO[source]) {
        const name = PROVIDER_INFO[source].name;
        if (params.get("connected")) setMessage({ kind: "ok", text: `${name} connected and synced.` });
        else if (params.get("error"))
          setMessage({ kind: "error", text: `${name} wasn't connected (${params.get("error")?.replaceAll("_", " ")}).` });
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function run(key: string, action: () => Promise<string | void>) {
    setBusy(key);
    setMessage(null);
    try {
      const text = await action();
      if (text) setMessage({ kind: "ok", text });
      await refresh();
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  const byId = (id: ProviderId) =>
    only && !only.includes(id) ? undefined : sources.find((s) => s.provider === id);
  const intervals = byId("intervals_icu");
  const stravaSrc = byId("strava");
  const uploads = byId("file_upload");

  function oauthCard(s: SourceStatus | undefined, id: "intervals_icu" | "strava") {
    const info = PROVIDER_INFO[id];
    if (!s) return null;
    return (
      <div key={id} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5 mb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
              {id === "intervals_icu" ? <Activity className="w-4 h-4 text-[#60a5fa]" /> : <Link className="w-4 h-4 text-[#60a5fa]" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                {info.name}
                {info.badge && (
                  <span className="text-[9px] font-bold text-[#CE0E2D] bg-[#CE0E2D]/10 px-2 py-0.5 rounded uppercase tracking-wider">
                    {info.badge}
                  </span>
                )}
              </h3>
              {s.connected ? <Counts s={s} /> : null}
            </div>
          </div>
          <StatusPill connected={s.connected} />
        </div>
        <p className="text-[11px] text-[#737373] mb-3">{info.blurb}</p>

        {s.connected && (
          <p className="text-[10px] text-[#525252] mb-3">
            Last synced {formatWhen(s.last_sync_at)}
            {s.auth_type === "api_key" ? " · via personal API key" : ""}
            {!s.used_for_coaching ? " · not used by AI coach" : ""}
          </p>
        )}
        {s.last_sync_error && (
          <p className="flex items-center gap-1.5 text-[11px] text-[#f87171] mb-3">
            <AlertTriangle className="w-3.5 h-3.5" /> {s.last_sync_error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {s.connected ? (
            <>
              <button className={buttonCls} disabled={!!busy}
                onClick={() => run(`${id}-sync`, async () => {
                  const r = await syncNow(await getToken(), id);
                  return r.error ? undefined : `Synced ${r.activities} workouts and ${r.wellness_days} wellness days.`;
                })}>
                <RefreshCw className={`w-3.5 h-3.5 ${busy === `${id}-sync` ? "animate-spin" : ""}`} /> Sync now
              </button>
              {confirming === id ? (
                <button className={primaryCls} disabled={!!busy}
                  onClick={() => run(`${id}-disconnect`, async () => {
                    await disconnect(await getToken(), id);
                    return `${info.name} disconnected and its imported data deleted.`;
                  })}>
                  <Trash2 className="w-3.5 h-3.5" /> Confirm: disconnect &amp; delete data
                </button>
              ) : (
                <button className={buttonCls} disabled={!!busy} onClick={() => setConfirming(id)}>
                  <Trash2 className="w-3.5 h-3.5" /> Disconnect
                </button>
              )}
            </>
          ) : (
            <>
              <button className={primaryCls} disabled={!!busy || !s.oauth_available || !configured}
                title={s.oauth_available ? undefined : "Sign-in for this source isn't set up on the server yet"}
                onClick={() => run(`${id}-oauth`, async () => startOAuth(await getToken(), id, returnTo))}>
                <Link className="w-3.5 h-3.5" /> Connect {info.name}
              </button>
              {s.api_key_available && (
                <button className={buttonCls} disabled={!!busy || !configured} onClick={() => setShowKeyForm((v) => !v)}>
                  <Key className="w-3.5 h-3.5" /> Use personal API key
                </button>
              )}
            </>
          )}
        </div>
        {!s.connected && !s.oauth_available && (
          <p className="text-[10px] text-[#404040] mt-2">
            One-click sign-in for {info.name} isn&apos;t set up on this server yet.
          </p>
        )}

        {id === "intervals_icu" && showKeyForm && !s.connected && (
          <form className="mt-3 space-y-2 border-t border-[#1e1e1e] pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              run("intervals-key", async () => {
                const r = await connectIntervalsApiKey(await getToken(), athleteId, apiKey);
                setApiKey("");
                setShowKeyForm(false);
                return r.error ? undefined : `Intervals.icu connected: ${r.activities} workouts and ${r.wellness_days} wellness days imported.`;
              });
            }}>
            <p className="text-[10px] text-[#525252]">
              For your own account only. In Intervals.icu open Settings → Developer Settings to find your athlete ID
              (e.g. i123456) and API key. The key is stored encrypted.
            </p>
            <input className={inputCls} placeholder="Athlete ID (e.g. i123456)" value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)} required autoComplete="off" />
            <input className={inputCls} placeholder="API key" type="password" value={apiKey}
              onChange={(e) => setApiKey(e.target.value)} required autoComplete="off" />
            <button className={primaryCls} type="submit" disabled={!!busy}>Connect</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      {!embedded && (
        <>
          <p className="text-[9px] font-bold text-[#525252] uppercase tracking-[0.15em] mb-1">Data sources</p>
          <p className="text-xs text-[#525252] mb-3">
            Pick where your training data comes from. You can use more than one; until you connect something, the
            dashboard shows clearly labeled demo data.
          </p>
        </>
      )}

      {message && (
        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3 border ${
          message.kind === "ok"
            ? "text-[#4ade80] bg-[#16a34a]/10 border-[#16a34a]/20"
            : "text-[#f87171] bg-[#dc2626]/10 border-[#dc2626]/20"}`}>
          {message.kind === "ok" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {message.text}
        </div>
      )}
      {!configured && (
        <p className="text-[11px] text-[#f87171] mb-3">
          Connecting accounts isn&apos;t enabled on this server yet (missing encryption key). File uploads still work.
        </p>
      )}
      {loading && <p className="text-xs text-[#525252]">Loading…</p>}

      {oauthCard(intervals, "intervals_icu")}
      {oauthCard(stravaSrc, "strava")}

      {uploads && (
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#2563eb]/10 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-[#60a5fa]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">{PROVIDER_INFO.file_upload.name}</h3>
                <Counts s={uploads} />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#737373] mb-3">{PROVIDER_INFO.file_upload.blurb}</p>
          <input ref={fileInput} type="file" accept=".fit,.zip,.xml" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              run("upload", async () => {
                const r = await uploadFile(await getToken(), file);
                const skipped = r.skipped.length ? ` (${r.skipped.length} unreadable file(s) skipped)` : "";
                return `Imported ${r.activities} workouts and ${r.wellness_days} wellness days from ${file.name}${skipped}.`;
              });
            }} />
          <div className="flex flex-wrap gap-2">
            <button className={primaryCls} disabled={!!busy} onClick={() => fileInput.current?.click()}>
              <Upload className={`w-3.5 h-3.5 ${busy === "upload" ? "animate-pulse" : ""}`} />
              {busy === "upload" ? "Importing…" : "Choose file"}
            </button>
            {(uploads.activities > 0 || uploads.wellness_days > 0) &&
              (confirming === "file_upload" ? (
                <button className={primaryCls} disabled={!!busy}
                  onClick={() => run("upload-delete", async () => {
                    await deleteUploadedData(await getToken());
                    return "Uploaded data deleted.";
                  })}>
                  <Trash2 className="w-3.5 h-3.5" /> Confirm: delete uploaded data
                </button>
              ) : (
                <button className={buttonCls} disabled={!!busy} onClick={() => setConfirming("file_upload")}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete uploaded data
                </button>
              ))}
          </div>
          <p className="text-[10px] text-[#404040] mt-2">
            Apple Health → profile picture → Export All Health Data. Garmin Connect → Account → Data Management →
            Export Your Data. Re-uploading the same file won&apos;t create duplicates.
          </p>
        </div>
      )}
    </div>
  );
}
