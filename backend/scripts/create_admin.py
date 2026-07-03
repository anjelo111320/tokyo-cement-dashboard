"""
Create the initial admin user.
Run after alembic upgrade head:
  python -m backend.scripts.create_admin --email admin@company.com --password <secret>
"""
import argparse
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.config import settings
from backend.db.database import init_engine, get_db
from backend.repositories.db import user_repo
from backend.auth.password import hash_password


async def main(email: str, password: str):
    db_url = settings.database_url
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    init_engine(db_url)

    async for db in get_db():
        existing = await user_repo.get_by_email(db, email)
        if existing:
            print(f"User {email} already exists (role={existing.role}). No changes made.")
            return
        user = await user_repo.create(db, email, hash_password(password), role="admin")
        print(f"Admin created: {user.email} (id={user.id})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    asyncio.run(main(args.email, args.password))
