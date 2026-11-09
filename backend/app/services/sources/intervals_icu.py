"""Intervals.icu client: OAuth / personal API key, wellness and activities.

Contracts follow the Intervals.icu forum guides and OpenAPI spec
(intervals.icu/api/v1/docs), read 2026-11-09:
- authorize: GET https://intervals.icu/oauth/authorize (client_id, redirect_uri, scope, state)
- token: POST https://intervals.icu/api/oauth/token, form-encoded; code valid for 2 minutes;
  response has access_token, scope, athlete{id,name}; no refresh token.
- API key: HTTP basic auth, username "API_KEY". Intended for an athlete's own data only.
- wellness: GET /api/v1/athlete/{id}/wellness?oldest=&newest= ; activities: same with /activities.
- revoke: DELETE /api/v1/disconnect-app. All units metric.
Field names marked "verify" were taken from a summary of the spec, not
verbatim, and should be checked against a live payload.
"""
from datetime import date, datetime, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.models.activity import SportType
from app.services.sources import USER_AGENT

AUTHORIZE_URL = "https://intervals.icu/oauth/authorize"
TOKEN_URL = "https://intervals.icu/api/oauth/token"
API_BASE = "https://intervals.icu/api/v1"
SCOPES = "ACTIVITY:READ,WELLNESS:READ"
SOURCE = "intervals_icu"

_SPORT_MAP = {
    "Ride": SportType.cycling,
    "VirtualRide": SportType.cycling,
    "GravelRide": SportType.cycling,
    "MountainBikeRide": SportType.cycling,
    "Run": SportType.running,
    "VirtualRun": SportType.running,
    "TrailRun": SportType.running,
    "Swim": SportType.swimming,
    "OpenWaterSwim": SportType.swimming,
    "WeightTraining": SportType.strength,
    "Transition": SportType.transition,
}


def authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    query = {"client_id": client_id, "redirect_uri": redirect_uri, "scope": SCOPES, "state": state}
    return f"{AUTHORIZE_URL}?{urlencode(query)}"


async def exchange_code(client_id: str, client_secret: str, code: str) -> dict:
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        res = await client.post(
            TOKEN_URL, data={"client_id": client_id, "client_secret": client_secret, "code": code}
        )
        res.raise_for_status()
        return res.json()


class IntervalsClient:
    """Authenticated client for one athlete (OAuth bearer token or personal API key)."""

    def __init__(self, *, access_token: Optional[str] = None, api_key: Optional[str] = None,
                 athlete_id: str = "0"):
        if not (access_token or api_key):
            raise ValueError("access_token or api_key required")
        self.athlete_id = athlete_id or "0"
        self._auth = ("API_KEY", api_key) if api_key else None
        self._headers = {"User-Agent": USER_AGENT}
        if access_token:
            self._headers["Authorization"] = f"Bearer {access_token}"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=API_BASE, timeout=30, headers=self._headers, auth=self._auth)

    async def get_athlete(self) -> dict:
        async with self._client() as client:
            res = await client.get(f"/athlete/{self.athlete_id}")
            res.raise_for_status()
            return res.json()

    async def get_wellness(self, oldest: date, newest: date) -> list[dict]:
        async with self._client() as client:
            res = await client.get(
                f"/athlete/{self.athlete_id}/wellness",
                params={"oldest": oldest.isoformat(), "newest": newest.isoformat()},
            )
            res.raise_for_status()
            return res.json()

    async def get_activities(self, oldest: date, newest: date) -> list[dict]:
        async with self._client() as client:
            res = await client.get(
                f"/athlete/{self.athlete_id}/activities",
                params={"oldest": oldest.isoformat(), "newest": newest.isoformat()},
            )
            res.raise_for_status()
            return res.json()

    async def disconnect(self) -> None:
        """Revoke an OAuth grant (not applicable to personal API keys)."""
        async with self._client() as client:
            res = await client.delete("/disconnect-app")
            res.raise_for_status()


def _as_int(value) -> Optional[int]:
    return int(round(value)) if isinstance(value, (int, float)) else None


def _as_float(value) -> Optional[float]:
    return float(value) if isinstance(value, (int, float)) else None


def _parse_start(record: dict) -> Optional[datetime]:
    """Prefer the UTC `start_date`; `start_date_local` has no offset, so it is
    only a fallback and is labeled UTC (may be off by the athlete's offset)."""
    if record.get("start_date"):
        return datetime.fromisoformat(record["start_date"].replace("Z", "+00:00"))
    if record.get("start_date_local"):
        return datetime.fromisoformat(record["start_date_local"]).replace(tzinfo=timezone.utc)
    return None


def map_wellness(record: dict) -> Optional[dict]:
    """Map one Intervals.icu wellness day to RecoveryMetric fields.

    `hrv` is stored as rMSSD: the spec carries SDNN separately as `hrvSDNN`
    (verify against a live payload). sleepScore is a source-defined 0-100
    score; it is passed through, not recomputed.
    """
    day = record.get("id")
    if not day:
        return None
    return {
        "date": date.fromisoformat(day[:10]),
        "hrv_rmssd": _as_float(record.get("hrv")),
        "hrv_sdnn": _as_float(record.get("hrvSDNN")),
        "resting_hr": _as_int(record.get("restingHR")),
        "sleep_duration_seconds": _as_int(record.get("sleepSecs")),
        "sleep_score": _as_int(record.get("sleepScore")),
        "training_readiness_score": _as_int(record.get("readiness")),
        "weight_kg": _as_float(record.get("weight")),
        "steps": _as_int(record.get("steps")),
        "ctl": _as_float(record.get("ctl")),
        "atl": _as_float(record.get("atl")),
    }


def map_activity(record: dict) -> Optional[dict]:
    """Map one Intervals.icu activity to Activity fields (verify field names live)."""
    activity_id = record.get("id")
    start = _parse_start(record)
    if not activity_id or start is None:
        return None
    return {
        "external_id": str(activity_id),
        "sport_type": _SPORT_MAP.get(record.get("type") or "", SportType.other),
        "name": record.get("name"),
        "start_time": start,
        "duration_seconds": _as_int(record.get("moving_time")),
        "distance_meters": _as_float(record.get("distance")),
        "avg_hr": _as_int(record.get("average_heartrate")),
        "avg_power": _as_float(record.get("icu_average_watts")),
        "tss": _as_float(record.get("icu_training_load")),
    }
