"""pgvector retrieval over the formulary, clinical knowledge base and lab ranges.

Embeddings come from a separate provider (see `embedding_*` in config) because
OpenRouter serves no embedding models. Qwen3-Embedding truncates to 1536 dims,
matching the `vector(1536)` columns, so no migration is required.

Changing the embedding model invalidates every stored vector, so re-run
`python seed.py` after switching. Vectors from two different models are not
comparable and pgvector will silently return nonsense rankings.
"""

from __future__ import annotations

import logging

from aikti.config import get_settings
from aikti.llm import get_embedding_client
from aikti.models import FormularyHit
from db.supabase import get_supabase

log = logging.getLogger(__name__)


def embed(text: str) -> list[float]:
    return embed_batch([text])[0]


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts, chunked to the provider's per-request input limit."""
    s = get_settings()
    if not texts:
        return []
    size = max(1, s.embedding_batch_size)
    if len(texts) <= size:
        return _embed_chunk(texts)
    out: list[list[float]] = []
    for i in range(0, len(texts), size):
        out.extend(_embed_chunk(texts[i : i + size]))
    return out


def _embed_chunk(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    kwargs = {"model": s.embedding_model, "input": texts}
    # Qwen3-Embedding supports Matryoshka truncation to a fixed width; other
    # models reject `dimensions`, so only send it when the model can honour it.
    if s.embedding_model.startswith("Qwen/Qwen3-Embedding"):
        kwargs["dimensions"] = s.embedding_dimensions
    resp = get_embedding_client().embeddings.create(**kwargs)
    return [item.embedding for item in resp.data]


def search_formulary(query: str, match_count: int | None = None) -> list[FormularyHit]:
    """Semantic search over the Alkhidmat pharmacy formulary."""
    s = get_settings()
    try:
        data = (
            get_supabase()
            .rpc("match_formulary", {"query_embedding": embed(query), "match_count": match_count or s.rag_match_count})
            .execute()
            .data
        )
    except Exception as exc:  # noqa: BLE001 - retrieval must never break a consultation
        log.warning("formulary rpc failed: %s", exc)
        return []
    return [
        FormularyHit(**{k: (float(v) if k == "unit_price_pkr" else v) for k, v in row.items()})
        for row in data
    ]


def search_kb(query: str, category: str | None = None, match_count: int | None = None) -> list[dict]:
    """Semantic search over guidelines, protocols, emergencies and patient education."""
    s = get_settings()
    try:
        data = (
            get_supabase()
            .rpc(
                "match_clinical_kb",
                {
                    "query_embedding": embed(query),
                    "match_category": category,
                    "match_count": match_count or s.rag_match_count,
                },
            )
            .execute()
            .data
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("clinical_kb rpc failed: %s", exc)
        return []
    return data


def search_reference_ranges(test_name: str, match_count: int = 3) -> list[dict]:
    """Vector search for a test's reference range, used when an exact match fails."""
    s = get_settings()
    try:
        data = (
            get_supabase()
            .rpc(
                "match_reference_ranges",
                {"query_embedding": embed(f"reference range normal values {test_name}"), "match_test": test_name, "match_count": match_count},
            )
            .execute()
            .data
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("reference_ranges rpc failed: %s", exc)
        return []
    return data
