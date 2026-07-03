"""
bootstrap_admin.py — Env-var-driven admin bootstrap for shell-less hosts.

Render's free tier has no Shell, so we can't run create_admin.py interactively.
Instead this script runs automatically on every container start (from start.sh)
and reads its inputs from environment variables:

    BOOTSTRAP_ADMIN_EMAIL     — admin email to ensure exists
    BOOTSTRAP_ADMIN_PASSWORD  — password to set for that admin

Behaviour (idempotent + recoverable):
  - No env vars set        → skip quietly (normal for local/dev).
  - No DATABASE_URL        → skip with a warning.
  - User does not exist    → create it as an active admin.
  - User already exists     → reset its password and ensure role=admin, active.

Because the env vars are authoritative, a mistyped password is always
recoverable: fix the env var and redeploy. Once you're logged in and happy,
you can delete both env vars — the existing user remains untouched.
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.core.config import settings
from backend.db.database import init_engine, get_db
from backend.repositories.db import user_repo
from backend.auth.password import hash_password


async def _run(email: str, password: str) -> None:
    if not settings.database_url:
        print("[bootstrap_admin] DATABASE_URL not set — skipping admin bootstrap.")
        return

    init_engine(settings.database_url)

    async for db in get_db():
        existing = await user_repo.get_by_email(db, email)
        if existing:
            await user_repo.update(
                db, existing,
                hashed_pw=hash_password(password),
                role="admin",
                is_active=True,
            )
            print(f"[bootstrap_admin] Reset password + ensured admin role for {email}.")
        else:
            user = await user_repo.create(db, email, hash_password(password), role="admin")
            print(f"[bootstrap_admin] Created admin {user.email} (id={user.id}).")
        return


def main() -> None:
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL")
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")
    if not email or not password:
        print("[bootstrap_admin] BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set — skipping.")
        return
    asyncio.run(_run(email, password))


if __name__ == "__main__":
    main()
