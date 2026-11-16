"""Pushed data from apps on the athlete's phone (Health Auto Export).

These requests come from the athlete's iPhone, not the web app, so they
authenticate with a per-athlete ingest token instead of a Clerk session. The
token is shown once when created; only its SHA-256 hash is stored.
"""
import hashlib
import json
import secrets
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import get_db
from app.models.connection import DataConnection
from app.services import sync
from app.services.sources import health_auto_export

log = structlog.get_logger()
router = APIRouter(prefix="/ingest", tags=["ingest"])

TOKEN_PREFIX = "imhae_"
# Cloud Run caps requests at 32 MB; Health Auto Export can split large
# exports with its "Batch Requests" option.
MAX_BODY_BYTES = 30 * 1024**2


def new_token() -> tuple[str, str]:
    """(token to show the athlete once, hash to store)."""
    token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def ingest_url() -> str:
    return f"{settings.backend_public_url.rstrip('/')}/api/v1/ingest/health-auto-export"


async def _read_body(request: Request) -> bytes:
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_BODY_BYTES:
            raise HTTPException(status_code=413,
                                detail="Too much data in one request. Turn on Batch Requests in Health Auto Export.")
    return bytes(body)


@router.post("/health-auto-export")
async def ingest_health_auto_export(
    request: Request,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.startswith(TOKEN_PREFIX):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    result = await db.execute(
        select(DataConnection).where(
            DataConnection.provider == health_auto_export.SOURCE,
            DataConnection.external_athlete_id == hash_token(token.strip()),
        )
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    try:
        body = json.loads(await _read_body(request))
        activities, recovery = health_auto_export.parse_payload(body)
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        conn.last_sync_error = "Received data in an unexpected format. Set Export Format to JSON."
        await db.commit()
        raise HTTPException(status_code=400, detail=str(exc)[:200]) from exc

    n_activities = await sync.upsert_activities(db, conn.user_id, health_auto_export.SOURCE, activities)
    n_days = await sync.upsert_recovery_fields(db, conn.user_id, health_auto_export.SOURCE, recovery)
    conn.last_sync_at = datetime.now(timezone.utc)
    conn.last_sync_error = None
    await db.commit()
    log.info("health_auto_export_ingested", activities=n_activities, days=n_days,
             automation=request.headers.get("automation-name", "")[:80])
    return {"activities": n_activities, "wellness_days": n_days}
