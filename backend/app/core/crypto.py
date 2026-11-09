"""Encryption for stored provider credentials and signing of OAuth state."""
import time

import jwt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status

from app.core.config import settings

_STATE_TTL_SECONDS = 600
# App pages an OAuth round-trip may return to (never an arbitrary URL).
RETURN_PATHS = ("/settings", "/onboarding")


def _fernet() -> Fernet:
    if not settings.token_encryption_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Data-source connections are not configured (TOKEN_ENCRYPTION_KEY is unset).",
        )
    return Fernet(settings.token_encryption_key.encode())


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored credential could not be decrypted; reconnect this data source.",
        ) from exc


def sign_oauth_state(user_id: str, provider: str, return_to: str = "/settings") -> str:
    """Short-lived signed state binding an OAuth round-trip to one user."""
    _fernet()  # fail early with a clear error if unconfigured
    if return_to not in RETURN_PATHS:
        return_to = "/settings"
    now = int(time.time())
    payload = {"sub": user_id, "provider": provider, "ret": return_to, "iat": now,
               "exp": now + _STATE_TTL_SECONDS}
    return jwt.encode(payload, settings.token_encryption_key, algorithm="HS256")


def verify_oauth_state(state: str, provider: str) -> dict:
    """Return the claims of a valid state for this provider, else raise 400."""
    try:
        payload = jwt.decode(
            state, settings.token_encryption_key, algorithms=["HS256"], options={"require": ["exp", "sub"]}
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired connection request.") from exc
    if payload.get("provider") != provider:
        raise HTTPException(status_code=400, detail="Connection request does not match this provider.")
    if payload.get("ret") not in RETURN_PATHS:
        payload["ret"] = "/settings"
    return payload
