"""Supabase client (Postgres + pgvector) for the API service."""

from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from aikti.config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "Supabase not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in services/api/.env"
        )
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key,
        options=SyncClientOptions(persist_session=False, auto_refresh_token=False),
    )


def maybe_one(query) -> dict | None:
    """Run a `maybe_single()` query and return the row, or None if there is no match.

    postgrest returns None from `execute()` itself when maybe_single() matches
    nothing, so the usual `.maybe_single().execute().data` raises
    AttributeError on a miss. Every single-row lookup goes through here.
    """
    response = query.maybe_single().execute()
    return response.data if response is not None else None


def match_where(query, filters: dict) -> dict | None:
    """`match()` that tolerates None values.

    PostgREST serialises a null filter value as the literal string "none", which
    Postgres then refuses to cast to the column's type (22P02 on int columns).
    Nulls are compared with `is`, everything else with `eq`, so the key match
    stays exact.
    """
    for column, value in filters.items():
        query = query.is_(column, None) if value is None else query.eq(column, value)
    return maybe_one(query)
