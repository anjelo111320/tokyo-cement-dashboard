#!/bin/sh
# Container entrypoint for Render / Docker.
# Runs DB migrations only if DATABASE_URL is configured, and NEVER lets a
# migration failure take down the whole service — the CSV dashboard must stay
# up even when the auth database is unreachable or not yet provisioned.

if [ -n "$DATABASE_URL" ]; then
  echo "[start] DATABASE_URL is set — running alembic upgrade head..."
  # Subshell so the cd doesn't affect the uvicorn launch below.
  # `|| echo` swallows the failure so the API still boots (CSV endpoints work).
  (cd backend && alembic upgrade head) \
    || echo "[start] WARNING: alembic migration failed — starting anyway (auth/admin may not work until the DB is fixed)"

  # Ensure the admin user exists (shell-less hosts like Render free tier).
  # Reads BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD from the env.
  python -m backend.scripts.bootstrap_admin \
    || echo "[start] WARNING: admin bootstrap failed — check BOOTSTRAP_ADMIN_* env vars"
else
  echo "[start] WARNING: DATABASE_URL not set — skipping migrations. Auth/admin features are disabled until it is configured."
fi

# exec so uvicorn becomes PID 1 and receives SIGTERM/SIGINT correctly.
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
