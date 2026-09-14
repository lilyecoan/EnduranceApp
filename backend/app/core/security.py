from functools import lru_cache

import jwt
import structlog
from fastapi import Header, HTTPException, status
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.core.config import settings
from app.db.base import get_db
from app.models.user import User

log = structlog.get_logger()


@lru_cache
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(f"{settings.clerk_issuer}/.well-known/jwks.json")


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk-issued session JWT and return its decoded claims."""
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError as exc:
        log.warning("clerk_token_verification_failed", error=str(exc), error_type=type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired session token: {exc}",
        ) from exc
    return payload


async def get_current_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated User for a request, auto-provisioning on first sign-in."""
    if not authorization.startswith("Bearer "):
        log.warning("clerk_token_missing", authorization_header_present=bool(authorization))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    token = authorization.removeprefix("Bearer ").strip()
    claims = verify_clerk_token(token)

    clerk_user_id = claims["sub"]
    email = claims.get("email") or f"{clerk_user_id}@users.noreply.clerk"

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    user = User(clerk_user_id=clerk_user_id, email=email)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
