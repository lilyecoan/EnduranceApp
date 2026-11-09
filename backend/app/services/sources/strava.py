"""Strava client: OAuth with refreshing tokens, activities only.

Strava provides workouts but no sleep/HRV wellness data. Its API agreement
prohibits using Strava data for AI/ML, so these activities are tagged
source="strava" and kept out of coaching input (see AI_EXCLUDED_SOURCES).
"""
from datetime import date, datetime, time, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.models.activity import SportType
from app.services.sources import USER_AGENT

AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"
DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize"
API_BASE = "https://www.strava.com/api/v3"
SCOPES = "activity:read_all"
SOURCE = "strava"
_PAGE_SIZE = 100

_SPORT_MAP = {
    "Ride": SportType.cycling,
    "VirtualRide": SportType.cycling,
    "GravelRide": SportType.cycling,
    "MountainBikeRide": SportType.cycling,
    "EBikeRide": SportType.cycling,
    "Run": SportType.running,
    "VirtualRun": SportType.running,
    "TrailRun": SportType.running,
    "Swim": SportType.swimming,
    "WeightTraining": SportType.strength,
}


def authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    query = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "approval_prompt": "auto",
        "scope": SCOPES,
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urlencode(query)}"


async def _token_request(data: dict) -> dict:
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        res = await client.post(TOKEN_URL, data=data)
        res.raise_for_status()
        return res.json()


async def exchange_code(client_id: str, client_secret: str, code: str) -> dict:
    return await _token_request(
        {"client_id": client_id, "client_secret": client_secret, "code": code, "grant_type": "authorization_code"}
    )


async def refresh(client_id: str, client_secret: str, refresh_token: str) -> dict:
    return await _token_request(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    )


async def deauthorize(access_token: str) -> None:
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": USER_AGENT}) as client:
        res = await client.post(DEAUTHORIZE_URL, data={"access_token": access_token})
        res.raise_for_status()


async def get_activities(access_token: str, oldest: date, newest: date) -> list[dict]:
    after = int(datetime.combine(oldest, time.min, tzinfo=timezone.utc).timestamp())
    before = int(datetime.combine(newest, time.max, tzinfo=timezone.utc).timestamp())
    headers = {"User-Agent": USER_AGENT, "Authorization": f"Bearer {access_token}"}
    results: list[dict] = []
    async with httpx.AsyncClient(base_url=API_BASE, timeout=30, headers=headers) as client:
        page = 1
        while True:
            res = await client.get(
                "/athlete/activities",
                params={"after": after, "before": before, "page": page, "per_page": _PAGE_SIZE},
            )
            res.raise_for_status()
            batch = res.json()
            results.extend(batch)
            if len(batch) < _PAGE_SIZE:
                return results
            page += 1


def _as_int(value) -> Optional[int]:
    return int(round(value)) if isinstance(value, (int, float)) else None


def _as_float(value) -> Optional[float]:
    return float(value) if isinstance(value, (int, float)) else None


def map_activity(record: dict) -> Optional[dict]:
    activity_id = record.get("id")
    start = record.get("start_date")
    if not activity_id or not start:
        return None
    sport = record.get("sport_type") or record.get("type") or ""
    return {
        "external_id": str(activity_id),
        "sport_type": _SPORT_MAP.get(sport, SportType.other),
        "name": record.get("name"),
        "start_time": datetime.fromisoformat(start.replace("Z", "+00:00")),
        "duration_seconds": _as_int(record.get("moving_time")),
        "distance_meters": _as_float(record.get("distance")),
        "avg_hr": _as_int(record.get("average_heartrate")),
        "max_hr": _as_int(record.get("max_heartrate")),
        "avg_power": _as_float(record.get("average_watts")),
        "elevation_gain": _as_float(record.get("total_elevation_gain")),
    }
