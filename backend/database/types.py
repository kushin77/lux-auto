"""
Cross-dialect column types.

Production runs on Cloud SQL Postgres; local dev and CI use SQLite. ``StringArray``
maps to a native Postgres ``ARRAY(String)`` on Postgres and to a JSON-encoded
``TEXT`` column everywhere else, so the same ORM models run unchanged on both.
"""

from __future__ import annotations

import json

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.types import TypeDecorator


class StringArray(TypeDecorator):
    """A list-of-strings column: Postgres ARRAY in prod, JSON text on SQLite."""

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_ARRAY(String))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if dialect.name == "postgresql" or value is None:
            return value
        return json.dumps(list(value))

    def process_result_value(self, value, dialect):
        if dialect.name == "postgresql" or value is None:
            return value
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return []
