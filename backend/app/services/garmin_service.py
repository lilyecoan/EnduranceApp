"""Garmin Connect service — singleton with token caching to avoid repeated logins."""
import asyncio
import os
from datetime import date
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
            log.warning("garmin_unavailable_using_mock")
            return self._mock_data()

        data: dict = {}

        # HRV
        try:
            hrv = await asyncio.to_thread(client.get_hrv_data, date_str)
            if hrv:
                summary = hrv.get("hrvSummary", {})
                data["hrv_rmssd"] = summary.get("lastNight5MinHigh")
                data["hrv_baseline"] = summary.get("baseline", {}).get("lowUpper")
                data["hrv_status"] = summary.get("status")
                data["hrv_5day_avg"] = summary.get("baseline", {}).get("balancedLow")
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

        # Body battery
        try:
            bb = await asyncio.to_thread(client.get_body_battery, date_str)
            if bb:
                values = [item.get("charged", 0) for item in bb if isinstance(item, dict) and item.get("charged")]
                data["body_battery_morning"] = values[0] if values else None
                data["body_battery_high"] = max(values) if values else None
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
                data["ctl"] = load.get("longTermLoad")
                data["atl"] = load.get("shortTermLoad")
                data["tsb"] = load.get("loadRatio")
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
            "acute_load": None,
            "vo2_max": 47.2,
            "ftp": None,
            "resting_hr": 52,
            "weight_kg": 63.5,
        }


# Module-level singleton — login happens once per process, not per request
_instance: Optional[GarminService] = None


def get_garmin_service(email: str, password: str) -> GarminService:
    global _instance
    if _instance is None:
        _instance = GarminService(email, password)
    return _instance
