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
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await user_repo.get_by_email(db, body.email)
    if not user or not user.is_active or not verify_password(body.password, user.hashed_pw):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
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
