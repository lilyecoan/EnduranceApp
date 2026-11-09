"""Persist data-source records and run per-connection syncs.

Upserts are idempotent: activities de-duplicate on (user, source,
external_id) and wellness days on (user, source, date), so re-syncing or
re-uploading the same file never creates duplicates.
"""
from datetime import date, datetime, timedelta, timezone

import httpx
import structlog
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt, encrypt
from app.models.activity import Activity
from app.models.connection import DataConnection
from app.models.recovery import RecoveryMetric
from app.services.sources import intervals_icu, strava

log = structlog.get_logger()

DEFAULT_BACKFILL_DAYS = 90
_CHUNK = 500


def _normalize(rows: list[dict], user_id, source: str) -> list[dict]:
    """Tag rows with owner/source and give every row the same keys (a
    multi-row INSERT needs uniform columns; e.g. FIT and Apple Health
    workouts carry different fields)."""
    rows = [r for r in rows if r]
    keys = {k for r in rows for k in r}
    return [{**dict.fromkeys(keys), **r, "user_id": user_id, "source": source} for r in rows]


async def upsert_activities(db: AsyncSession, user_id, source: str, rows: list[dict]) -> int:
    rows = _normalize(rows, user_id, source)
    for i in range(0, len(rows), _CHUNK):
        chunk = rows[i : i + _CHUNK]
        stmt = insert(Activity).values(chunk)
        updatable = {k for row in chunk for k in row} - {"user_id", "source", "external_id"}
        stmt = stmt.on_conflict_do_update(
            constraint="uq_activity_user_source_external_id",
            set_={k: stmt.excluded[k] for k in updatable},
        )
        await db.execute(stmt)
    return len(rows)


async def upsert_recovery(db: AsyncSession, user_id, source: str, rows: list[dict]) -> int:
    rows = _normalize(rows, user_id, source)
    for i in range(0, len(rows), _CHUNK):
        chunk = rows[i : i + _CHUNK]
        stmt = insert(RecoveryMetric).values(chunk)
        updatable = {k for row in chunk for k in row} - {"user_id", "source", "date"}
        stmt = stmt.on_conflict_do_update(
            constraint="uq_recovery_user_source_date",
            set_={k: stmt.excluded[k] for k in updatable},
        )
        await db.execute(stmt)
    return len(rows)


async def delete_source_data(db: AsyncSession, user_id, source: str) -> None:
    await db.execute(delete(Activity).where(Activity.user_id == user_id, Activity.source == source))
    await db.execute(
        delete(RecoveryMetric).where(RecoveryMetric.user_id == user_id, RecoveryMetric.source == source)
    )


async def _strava_access_token(db: AsyncSession, conn: DataConnection) -> str:
    """Return a valid Strava token, refreshing it (and persisting) when near expiry."""
    expires = conn.token_expires_at
    if expires and expires > datetime.now(timezone.utc) + timedelta(minutes=5):
        return decrypt(conn.encrypted_access_token)
    token = await strava.refresh(
        settings.strava_client_id, settings.strava_client_secret, decrypt(conn.encrypted_refresh_token)
    )
    conn.encrypted_access_token = encrypt(token["access_token"])
    conn.encrypted_refresh_token = encrypt(token["refresh_token"])
    conn.token_expires_at = datetime.fromtimestamp(token["expires_at"], tz=timezone.utc)
    await db.flush()
    return token["access_token"]


def intervals_client(conn: DataConnection) -> intervals_icu.IntervalsClient:
    secret = decrypt(conn.encrypted_access_token)
    if conn.auth_type == "api_key":
        return intervals_icu.IntervalsClient(api_key=secret, athlete_id=conn.external_athlete_id or "0")
    return intervals_icu.IntervalsClient(access_token=secret)


async def sync_connection(db: AsyncSession, conn: DataConnection, days: int = DEFAULT_BACKFILL_DAYS) -> dict:
    """Pull the last `days` of data for one connection and upsert it."""
    newest = date.today()
    oldest = newest - timedelta(days=days)
    counts = {"activities": 0, "wellness_days": 0}
    try:
        if conn.provider == intervals_icu.SOURCE:
            client = intervals_client(conn)
            wellness = await client.get_wellness(oldest, newest)
            activities = await client.get_activities(oldest, newest)
            counts["wellness_days"] = await upsert_recovery(
                db, conn.user_id, intervals_icu.SOURCE, [intervals_icu.map_wellness(w) for w in wellness]
            )
            counts["activities"] = await upsert_activities(
                db, conn.user_id, intervals_icu.SOURCE, [intervals_icu.map_activity(a) for a in activities]
            )
        elif conn.provider == strava.SOURCE:
            token = await _strava_access_token(db, conn)
            activities = await strava.get_activities(token, oldest, newest)
            counts["activities"] = await upsert_activities(
                db, conn.user_id, strava.SOURCE, [strava.map_activity(a) for a in activities]
            )
        conn.last_sync_error = None
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        conn.last_sync_error = (
            "Access was revoked or expired — reconnect this source."
            if status_code in (401, 403)
            else f"{conn.provider} returned HTTP {status_code}."
        )
        log.warning("source_sync_failed", provider=conn.provider, status=status_code)
    except httpx.HTTPError as exc:
        conn.last_sync_error = f"Could not reach {conn.provider}."
        log.warning("source_sync_failed", provider=conn.provider, error=str(exc))
    conn.last_sync_at = datetime.now(timezone.utc)
    await db.commit()
    return {**counts, "error": conn.last_sync_error}
