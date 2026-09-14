"""Garmin data source — Phase 1 demo/fixture provider.

This is deliberately NOT a per-user integration yet: real per-athlete Garmin
access requires Garmin Connect Developer Program OAuth approval, which has
not been applied for. Until then this is a single, clearly-labeled demo
data source (`source: "live"` when a real login+fetch succeeds against the
configured demo account, `source: "demo"` when it falls back to fixtures),
not a multi-tenant integration.
"""
import asyncio
import os
from datetime import date, timedelta
from typing import Optional
import structlog

log = structlog.get_logger()

TOKEN_STORE = os.path.join(os.path.dirname(__file__), ".garmin_tokens")


class GarminService:
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self._client = None

    async def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            from garminconnect import Garmin
            client = Garmin(self.email, self.password)
            # Use tokenstore to save/load session — avoids re-login on every startup
            await asyncio.to_thread(client.login, TOKEN_STORE)
            self._client = client
            log.info("garmin_login_success", tokenstore=TOKEN_STORE)
        except Exception as e:
            log.warning("garmin_login_failed", error=str(e))
            return None
        return self._client

    async def get_daily_snapshot(self, target_date: Optional[date] = None) -> dict:
        target_date = target_date or date.today()
        date_str = target_date.isoformat()
        client = await self._get_client()

        if client is None:
            log.warning("garmin_unavailable_using_demo_fixture")
            data = self._mock_data()
            data["source"] = "demo"
            return data

        data: dict = {}

        # HRV
        try:
            hrv = await asyncio.to_thread(client.get_hrv_data, date_str)
            if hrv:
                summary = hrv.get("hrvSummary", {})
                data["hrv_rmssd"] = summary.get("lastNight5MinHigh")
                data["hrv_baseline"] = summary.get("baseline", {}).get("lowUpper")
                data["hrv_status"] = summary.get("status")

            # hrv_5day_avg: there is no single-call "5-day average" field in
            # the HRV summary (the previous mapping from baseline.balancedLow
            # was a different, unrelated baseline bound). Compute a real
            # trailing average over the last 5 days' lastNight5MinHigh.
            trailing = []
            if hrv:
                val = hrv.get("hrvSummary", {}).get("lastNight5MinHigh")
                if val is not None:
                    trailing.append(val)
            for offset in range(1, 5):
                day = target_date - timedelta(days=offset)
                try:
                    day_hrv = await asyncio.to_thread(client.get_hrv_data, day.isoformat())
                except Exception:
                    continue
                if day_hrv:
                    val = day_hrv.get("hrvSummary", {}).get("lastNight5MinHigh")
                    if val is not None:
                        trailing.append(val)
            data["hrv_5day_avg"] = round(sum(trailing) / len(trailing), 1) if trailing else None
        except Exception as e:
            log.warning("garmin_hrv_failed", error=str(e))

        # Sleep
        try:
            sleep = await asyncio.to_thread(client.get_sleep_data, date_str)
            if sleep:
                daily = sleep.get("dailySleepDTO", {})
                data["sleep_score"] = daily.get("sleepScores", {}).get("overall", {}).get("value")
                data["sleep_duration_seconds"] = daily.get("sleepTimeSeconds")
        except Exception as e:
            log.warning("garmin_sleep_failed", error=str(e))

        # Body battery — daily level series, NOT the events endpoint's
        # charge/drain deltas (the previous mapping summed/maxed `.charged`
        # values from an events-shaped read, which are gain deltas, not
        # absolute 0-100 levels). `bodyBatteryValuesArray` entries are
        # [timestamp_ms, status, level, version] per the wider garminconnect
        # ecosystem convention; verify this against a live payload before
        # relying on it for anything beyond this demo fixture.
        try:
            bb = await asyncio.to_thread(client.get_body_battery, date_str)
            levels = []
            for day_report in bb or []:
                if not isinstance(day_report, dict):
                    continue
                for entry in day_report.get("bodyBatteryValuesArray", []) or []:
                    if isinstance(entry, list) and len(entry) >= 3 and isinstance(entry[2], (int, float)):
                        levels.append(entry[2])
            if levels:
                data["body_battery_morning"] = levels[0]
                data["body_battery_high"] = max(levels)
        except Exception as e:
            log.warning("garmin_body_battery_failed", error=str(e))

        # Stress
        try:
            stress = await asyncio.to_thread(client.get_stress_data, date_str)
            if stress:
                raw = stress.get("stressValuesArray", [])
                vals = []
                for entry in raw:
                    if isinstance(entry, list) and len(entry) >= 2 and entry[1] >= 0:
                        vals.append(entry[1])
                    elif isinstance(entry, dict):
                        v = entry.get("stressLevel", -1)
                        if v >= 0:
                            vals.append(v)
                data["stress_avg"] = int(sum(vals) / len(vals)) if vals else None
        except Exception as e:
            log.warning("garmin_stress_failed", error=str(e))

        # Training readiness
        try:
            tr = await asyncio.to_thread(client.get_training_readiness, date_str)
            if tr:
                item = tr[0] if isinstance(tr, list) and tr else tr
                if isinstance(item, dict):
                    data["training_readiness_score"] = (
                        item.get("score") or item.get("trainingReadinessScore")
                    )
                    rt = item.get("recoveryTime")
                    if rt is not None:
                        data["recovery_time_hours"] = round(rt / 60) if rt > 100 else rt
        except Exception as e:
            log.warning("garmin_readiness_failed", error=str(e))

        # Training status — CTL/ATL/TSB/FTP/VO2max
        try:
            ts = await asyncio.to_thread(client.get_training_status, date_str)
            if ts:
                load = ts.get("trainingLoadBalance", {}) or {}
                ctl = load.get("longTermLoad")
                atl = load.get("shortTermLoad")
                data["ctl"] = ctl
                data["atl"] = atl
                # TSB (Training Stress Balance) is ctl - atl, NOT Garmin's
                # acute:chronic loadRatio (a ~0.8-1.5 ratio, on a completely
                # different scale from real TSB's roughly +/-40 range).
                # Keep the raw ratio separately, unused by training_load
                # thresholds, so the signal isn't lost.
                data["tsb"] = (ctl - atl) if ctl is not None and atl is not None else None
                data["acute_chronic_ratio"] = load.get("loadRatio")
                data["acute_load"] = ts.get("acuteLoad")
                data["ftp"] = ts.get("cyclingFtp")
                vo2_raw = ts.get("mostRecentVO2Max")
                if isinstance(vo2_raw, dict):
                    generic = vo2_raw.get("generic") or {}
                    data["vo2_max"] = generic.get("vo2MaxPreciseValue") or generic.get("vo2MaxValue")
                elif isinstance(vo2_raw, (int, float)):
                    data["vo2_max"] = vo2_raw
        except Exception as e:
            log.warning("garmin_training_status_failed", error=str(e))

        # User summary — resting HR, weight
        try:
            summary = await asyncio.to_thread(client.get_user_summary, date_str)
            if summary:
                data["resting_hr"] = summary.get("restingHeartRate")
                weight = summary.get("bodyWeight")
                if weight:
                    data["weight_kg"] = round(weight / 1000, 1) if weight > 500 else weight
        except Exception as e:
            log.warning("garmin_summary_failed", error=str(e))

        data["source"] = "live"
        return data

    def _mock_data(self) -> dict:
        return {
            "hrv_rmssd": 58,
            "hrv_baseline": 46,
            "hrv_5day_avg": 54,
            "hrv_status": "BALANCED",
            "sleep_score": 78,
            "sleep_duration_seconds": 26400,
            "body_battery_morning": 74,
            "body_battery_high": 82,
            "stress_avg": 28,
            "training_readiness_score": 72,
            "recovery_time_hours": 14,
            "ctl": None,
            "atl": None,
            "tsb": None,
            "acute_chronic_ratio": None,
            "acute_load": None,
            "vo2_max": 47.2,
            "ftp": None,
            "resting_hr": 52,
            "weight_kg": 63.5,
        }


def get_garmin_service(email: str, password: str) -> GarminService:
    """Construct the Phase 1 demo/fixture Garmin data source.

    Deliberately not a module-level singleton: the previous version only
    ever constructed one instance and silently ignored the email/password
    arguments on every later call. Session reuse across calls still happens
    via the on-disk TOKEN_STORE that garminconnect's own `login()` manages,
    so this stays cheap.
    """
    return GarminService(email, password)
