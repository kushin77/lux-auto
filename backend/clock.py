"""Time helper. Naive UTC everywhere so DB datetimes compare cleanly across
Postgres and SQLite (and to avoid the deprecated ``datetime.utcnow()``)."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (no tzinfo)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
