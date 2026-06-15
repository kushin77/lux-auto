"""
Database session registry.

``main.py`` builds the engine + ``SessionLocal`` and calls ``set_session_local``
once at startup. Routers depend on ``get_db`` (a FastAPI dependency) so they
never import ``main`` — avoiding a circular import and keeping them testable
with an injected session factory.
"""

from __future__ import annotations

from typing import Iterator

_SessionLocal = None


def set_session_local(session_local) -> None:
    """Register the app-wide ``sessionmaker``. Called once from ``main.py``."""
    global _SessionLocal
    _SessionLocal = session_local


def get_session_local():
    if _SessionLocal is None:
        raise RuntimeError(
            "SessionLocal is not initialized. Call set_session_local() at startup."
        )
    return _SessionLocal


def get_db() -> Iterator:
    """FastAPI dependency yielding a scoped session that always closes."""
    db = get_session_local()()
    try:
        yield db
    finally:
        db.close()
