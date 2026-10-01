"""FastAPI entrypoint for the Aikti patient medical assistant."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from aikti.config import get_settings
from aikti.llm import describe_models
from aikti.tracing import configure_tracing
from routers import chat, documents, reference

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("aikti")

DESCRIPTION = """
Patient-facing medical decision-support assistant for the Alkhidmat health network.

Every turn runs a safety pipeline: a red-flag agent screens for emergencies first, then
a structured assessment agent delegates medication safety and pharmacy questions to
specialist agents. Nothing is answered from model memory: reference ranges, guidelines
and pharmacy stock all come from the database through pgvector retrieval.

Models are routed through OpenRouter's OpenAI-compatible endpoint. Embeddings for
pgvector retrieval come from a separate provider, since OpenRouter serves none.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_tracing()

    if not settings.chat_api_key:
        var = "GROQ_API_KEY" if settings.use_groq else "OPENROUTER_API_KEY"
        log.warning("%s not set - /api/ask and /api/documents will fail until it is", var)
    if not settings.embedding_api_key:
        log.warning("EMBEDDING_API_KEY not set - reference ranges, formulary and guidelines will be unavailable until it is")
    if not (settings.supabase_url and settings.supabase_service_key):
        log.warning("Supabase not configured - persistence and vector search are disabled")

    log.info("models: %s", describe_models())

    try:
        from db.mongo import ensure_indexes

        ensure_indexes()
    except Exception as exc:  # noqa: BLE001
        log.warning("mongo not reachable, chat history disabled: %s", exc)
    yield


app = FastAPI(
    title="Aikti Medical Assistant API",
    version="0.3.0",
    description=DESCRIPTION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().api_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(reference.router)


@app.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "service": "aikti-api",
        "version": "0.3.0",
        "models": describe_models(),
        "pipeline": ["red_flag", "assessment", "medication_safety", "pharmacy", "document_reader"],
        "tracing": {"openai_export": s.trace_to_openai, "console": s.trace_console},
        "configured": {
            "openrouter": bool(s.chat_api_key),
            "embeddings": bool(s.embedding_api_key),
            "supabase": bool(s.supabase_url and s.supabase_service_key),
            "mongo": bool(s.mongo_uri),
        },
    }
