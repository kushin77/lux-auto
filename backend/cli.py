#!/usr/bin/env python3
"""
Lux-Auto admin CLI — CLI-native operations against the backend database.

Mirrors the API's services so you can administer the system from a terminal or
CI without a running server. Reads ``DATABASE_URL`` from the environment.

Examples:
    python -m backend.cli healthcheck
    python -m backend.cli init-db
    python -m backend.cli create-user --email alex@luxauto.com --role admin
    python -m backend.cli set-role   --email jo@luxauto.com  --role analyst
    python -m backend.cli list-users
    python -m backend.cli list-deals --status scored --limit 20
    python -m backend.cli seed
"""

from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker


def _session_factory():
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("✗ DATABASE_URL is not set. Export it or use --env-file via docker compose.")
    engine = create_engine(url, pool_pre_ping=True)
    from backend.database import set_session_local

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    set_session_local(SessionLocal)
    return engine, SessionLocal


def cmd_healthcheck(_args) -> int:
    engine, _ = _session_factory()
    with engine.connect() as conn:
        from sqlalchemy import text

        conn.execute(text("SELECT 1"))
    tables = inspect(engine).get_table_names()
    print(f"✓ Database reachable. {len(tables)} table(s): {', '.join(tables) or '(none)'}")
    return 0


def cmd_init_db(_args) -> int:
    engine, _ = _session_factory()
    from backend.database.models import Base

    Base.metadata.create_all(bind=engine)
    print("✓ Schema created / verified.")
    return 0


def cmd_create_user(args) -> int:
    _, SessionLocal = _session_factory()
    from backend.auth.user_service import UserService

    db = SessionLocal()
    try:
        user = UserService().get_or_create_user(email=args.email, session=db)
        if args.role:
            UserService().set_role(args.email, args.role, db)
            db.refresh(user)
        print(f"✓ {user.email} → role={user.role} (id={user.id})")
    finally:
        db.close()
    return 0


def cmd_set_role(args) -> int:
    _, SessionLocal = _session_factory()
    from backend.auth.user_service import UserService

    db = SessionLocal()
    try:
        user = UserService().set_role(args.email, args.role, db)
        if user is None:
            sys.exit(f"✗ No user with email {args.email}")
        print(f"✓ {user.email} → role={user.role}")
    finally:
        db.close()
    return 0


def cmd_list_users(_args) -> int:
    _, SessionLocal = _session_factory()
    from backend.database.models import User

    db = SessionLocal()
    try:
        for u in db.query(User).order_by(User.created_at).all():
            print(f"  {u.id:>4}  {u.email:<40} {str(u.role):<12} last_login={u.last_login}")
    finally:
        db.close()
    return 0


def cmd_list_deals(args) -> int:
    _, SessionLocal = _session_factory()
    from backend.database.models import Deal

    db = SessionLocal()
    try:
        q = db.query(Deal)
        if args.status:
            q = q.filter(Deal.status == args.status)
        for d in q.order_by(Deal.created_at.desc()).limit(args.limit).all():
            print(f"  {d.id:<14} {d.year} {d.make} {d.model:<16} score={d.score} status={d.status}")
    finally:
        db.close()
    return 0


def cmd_seed(_args) -> int:
    _, SessionLocal = _session_factory()
    from backend.database.models import Deal

    db = SessionLocal()
    try:
        sample = Deal(
            id="seed-ferrari-488",
            vin="ZFF79ALA4J0231234",
            year=2019,
            make="Ferrari",
            model="488 GTB",
            mileage=8200,
            mmr_value=235000,
            estimated_margin=28000,
            score=82,
            status="scored",
        )
        db.merge(sample)
        db.commit()
        print("✓ Seeded sample deal: seed-ferrari-488")
    finally:
        db.close()
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="backend.cli", description="Lux-Auto admin CLI")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("healthcheck", help="Verify DB connectivity").set_defaults(func=cmd_healthcheck)
    sub.add_parser("init-db", help="Create tables from the ORM models").set_defaults(func=cmd_init_db)

    cu = sub.add_parser("create-user", help="Create (or fetch) a user")
    cu.add_argument("--email", required=True)
    cu.add_argument("--role", default=None)
    cu.set_defaults(func=cmd_create_user)

    sr = sub.add_parser("set-role", help="Change a user's role")
    sr.add_argument("--email", required=True)
    sr.add_argument("--role", required=True)
    sr.set_defaults(func=cmd_set_role)

    sub.add_parser("list-users", help="List all users").set_defaults(func=cmd_list_users)

    ld = sub.add_parser("list-deals", help="List deals")
    ld.add_argument("--status", default=None)
    ld.add_argument("--limit", type=int, default=25)
    ld.set_defaults(func=cmd_list_deals)

    sub.add_parser("seed", help="Insert a sample deal").set_defaults(func=cmd_seed)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
