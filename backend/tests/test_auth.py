import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.core import security
from app.core.config import settings


@pytest.fixture
def keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


class _FakeSigningKey:
    def __init__(self, key):
        self.key = key


@pytest.fixture(autouse=True)
def configure_issuer(monkeypatch):
    monkeypatch.setattr(settings, "clerk_issuer", "https://test.clerk.accounts.dev")


def _fake_jwks_client(public_key):
    return lambda: type(
        "FakeJWKSClient",
        (),
        {"get_signing_key_from_jwt": staticmethod(lambda token: _FakeSigningKey(public_key))},
    )()


def _make_token(private_key, **overrides):
    now = int(time.time())
    payload = {
        "sub": "user_123",
        "email": "athlete@example.com",
        "iss": settings.clerk_issuer,
        "iat": now,
        "exp": now + 300,
    }
    payload.update(overrides)
    return jwt.encode(payload, private_key, algorithm="RS256")


def test_valid_token_verifies(keypair, monkeypatch):
    private_key, public_key = keypair
    token = _make_token(private_key)
    monkeypatch.setattr(security, "_jwks_client", _fake_jwks_client(public_key))

    claims = security.verify_clerk_token(token)
    assert claims["sub"] == "user_123"


def test_expired_token_rejected(keypair, monkeypatch):
    private_key, public_key = keypair
    token = _make_token(private_key, exp=int(time.time()) - 10)
    monkeypatch.setattr(security, "_jwks_client", _fake_jwks_client(public_key))

    with pytest.raises(HTTPException) as exc:
        security.verify_clerk_token(token)
    assert exc.value.status_code == 401


def test_wrong_issuer_rejected(keypair, monkeypatch):
    private_key, public_key = keypair
    token = _make_token(private_key, iss="https://not-us.clerk.accounts.dev")
    monkeypatch.setattr(security, "_jwks_client", _fake_jwks_client(public_key))

    with pytest.raises(HTTPException) as exc:
        security.verify_clerk_token(token)
    assert exc.value.status_code == 401


def test_token_signed_by_wrong_key_rejected(keypair, monkeypatch):
    private_key, _ = keypair
    other_public_key = rsa.generate_private_key(public_exponent=65537, key_size=2048).public_key()
    token = _make_token(private_key)
    monkeypatch.setattr(security, "_jwks_client", _fake_jwks_client(other_public_key))

    with pytest.raises(HTTPException) as exc:
        security.verify_clerk_token(token)
    assert exc.value.status_code == 401


async def test_missing_bearer_prefix_rejected():
    with pytest.raises(HTTPException) as exc:
        await security.get_current_user(authorization="not-a-bearer-token", db=None)
    assert exc.value.status_code == 401
