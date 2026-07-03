import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import create_access_token, create_refresh_token, decode_refresh_token
from backend.auth.password import verify_password
from backend.auth.dependencies import get_current_user
from backend.core.config import settings
from backend.db.database import get_db
from backend.db.models.user import User
from backend.repositories.db import user_repo

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Login rate limiting ────────────────────────────────────────────────────────
# Small in-memory brute-force guard: after _MAX_FAILURES failed attempts for the
# same (client IP, email) pair within _WINDOW_SECONDS, further attempts get 429.
# In-memory is sufficient for a single-instance deployment (Render free tier);
# swap for Redis if the API is ever scaled to multiple instances.
import time as _time
from collections import defaultdict as _defaultdict

_MAX_FAILURES = 5
_WINDOW_SECONDS = 15 * 60
_failed_logins: dict[str, list[float]] = _defaultdict(list)


def _rate_limit_key(request: Request, email: str) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return f"{client_ip}:{email.strip().lower()}"


def _is_rate_limited(key: str) -> bool:
    cutoff = _time.monotonic() - _WINDOW_SECONDS
    _failed_logins[key] = [t for t in _failed_logins[key] if t > cutoff]
    return len(_failed_logins[key]) >= _MAX_FAILURES


def _record_failure(key: str) -> None:
    _failed_logins[key].append(_time.monotonic())

# Cookie policy is env-driven so the SAME code works in two very different setups:
#   • Local dev (same-site localhost)  → SameSite=lax, Secure=false  (defaults)
#   • Prod cross-site (Vercel ↔ Render) → SameSite=none, Secure=true  (set via env)
# Browsers require Secure=true whenever SameSite=none, so set them together.
_COOKIE_OPTS = dict(
    httponly=True,
    samesite=settings.cookie_samesite,
    secure=settings.cookie_secure,
)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    role: str


def _set_auth_cookies(response: Response, user_id: str) -> None:
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie("access_token", access_token,
                        max_age=settings.access_token_expire_minutes * 60, **_COOKIE_OPTS)
    response.set_cookie("refresh_token", refresh_token,
                        max_age=settings.refresh_token_expire_days * 86400, **_COOKIE_OPTS)


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    key = _rate_limit_key(request, body.email)
    if _is_rate_limited(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again in 15 minutes.",
        )
    user = await user_repo.get_by_email(db, body.email)
    if not user or not user.is_active or not verify_password(body.password, user.hashed_pw):
        _record_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    _failed_logins.pop(key, None)  # successful login resets the counter
    _set_auth_cookies(response, str(user.id))
    return {"success": True, "data": UserOut(id=str(user.id), email=user.email, role=user.role)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"success": True}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    try:
        user_id = uuid.UUID(decode_refresh_token(token))
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = await user_repo.get_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    _set_auth_cookies(response, str(user.id))
    return {"success": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"success": True, "data": UserOut(id=str(user.id), email=user.email, role=user.role)}
