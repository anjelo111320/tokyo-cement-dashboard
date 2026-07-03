import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from backend.core.config import settings

_ACCESS_TYPE = "access"
_REFRESH_TYPE = "refresh"


def _create_token(sub: str, token_type: str, expires_delta: timedelta) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": sub, "type": token_type, "exp": expire, "jti": str(uuid.uuid4())}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id, _ACCESS_TYPE,
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        user_id, _REFRESH_TYPE,
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_access_token(token: str) -> str:
    """Returns user_id (sub) or raises JWTError."""
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != _ACCESS_TYPE:
        raise JWTError("Wrong token type")
    return payload["sub"]


def decode_refresh_token(token: str) -> str:
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if payload.get("type") != _REFRESH_TYPE:
        raise JWTError("Wrong token type")
    return payload["sub"]
