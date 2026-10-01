"""Model wiring.

Chat, vision and the safety agents go through OpenRouter's OpenAI-compatible
endpoint, so we reuse the `openai` client and the Agents SDK's
`OpenAIChatCompletionsModel`. One key, any provider, no second agent runtime:
the same agents, handoffs, tools and tracing.

    https://openrouter.ai/docs/api-reference/overview

Embeddings need a second client, because OpenRouter serves no embedding models.
That client is pointed at a configurable OpenAI-compatible embeddings host and is
used only by `db/vector.py`.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache

from agents import Model, OpenAIChatCompletionsModel
from openai import AsyncOpenAI, OpenAI

from aikti.config import get_settings

log = logging.getLogger(__name__)


def _require_key() -> str:
    s = get_settings()
    key = s.chat_api_key
    if not key:
        var = "GROQ_API_KEY" if s.use_groq else "OPENROUTER_API_KEY"
        raise RuntimeError(f"{var} is not set. Add it to services/api/.env (see .env.example).")
    return key


def _headers() -> dict[str, str]:
    """Attribution headers, only sent when configured."""
    s = get_settings()
    headers: dict[str, str] = {}
    if s.openrouter_app_url:
        headers["HTTP-Referer"] = s.openrouter_app_url
    if s.openrouter_app_title:
        headers["X-Title"] = s.openrouter_app_title
    return headers


@lru_cache
def get_async_client() -> AsyncOpenAI:
    """Async client pointed at OpenRouter's OpenAI-compatible chat endpoint."""
    s = get_settings()
    return AsyncOpenAI(
        api_key=_require_key(),
        base_url=s.chat_base_url,
        timeout=s.model_timeout,
        default_headers=_headers(),
    )


@lru_cache
def get_embedding_client() -> OpenAI:
    """Sync client for embeddings only, on a separate provider from chat."""
    s = get_settings()
    if not s.embedding_api_key:
        raise RuntimeError(
            "EMBEDDING_API_KEY is not set. Add it to services/api/.env (see .env.example)."
        )
    return OpenAI(api_key=s.embedding_api_key, base_url=s.embedding_base_url, timeout=s.embedding_timeout)


class _NoJsonSchemaToolModel(OpenAIChatCompletionsModel):
    """Chat model for providers that refuse `response_format` alongside tools.

    Groq rejects any request carrying a JSON response format when the agent also
    exposes function tools ("json mode cannot be combined with tool/function
    calling"), and every agent here is tool-using. Dropping the wire-level schema
    leaves the agent's `output_type` intact, so the SDK still parses and validates
    the reply against the Pydantic model; only the provider-side constraint is
    lifted. `med_agents.assistant._run_structured` retries once if the unconstrained
    reply will not parse.
    """

    async def get_response(
        self,
        system_instructions,
        input,
        model_settings,
        tools,
        output_schema,
        handoffs,
        tracing,
        previous_response_id=None,
        conversation_id=None,
        prompt=None,
    ):
        # Without a wire-level schema the model has no idea what shape to answer in,
        # so state the contract in the system prompt instead. Same Pydantic model,
        # same validation, just carried in the instructions rather than the request.
        if output_schema is not None:
            try:
                json_schema = output_schema.json_schema()
                # Some models reach for a tool call to deliver a structured answer
                # once JSON mode is off. Spell out that the answer belongs in the
                # message text, and that a tool call will be discarded.
                system_instructions = (
                    f"{system_instructions}\n\n"
                    "IMPORTANT OUTPUT RULES:\n"
                    "- Your final answer must be a single JSON object in your message text, "
                    "matching this schema exactly. No prose before or after it, no markdown "
                    "code fence. Every required field present, using only the exact enum and "
                    "literal values the schema lists.\n"
                    "- Do NOT invent a tool to deliver the answer and do NOT call a tool named "
                    "'json' or similar. Only the tools listed in this request may be called, "
                    "and only to look things up. The JSON answer goes in your reply text.\n\n"
                    f"SCHEMA: {json.dumps(json_schema, separators=(',', ':'))}"
                )
            except Exception:  # noqa: BLE001 - never block a call on a schema dump
                pass

        return await super().get_response(
            system_instructions,
            input,
            model_settings,
            tools,
            None,
            handoffs,
            tracing,
            previous_response_id=previous_response_id,
            conversation_id=conversation_id,
            prompt=prompt,
        )


@lru_cache
def chat_model(name: str) -> OpenAIChatCompletionsModel:
    """Cached `OpenAIChatCompletionsModel` per model name.

    Each distinct model is wrapped once, because constructing the adapter is cheap
    but the Agents SDK compares model identity when handing off.
    """
    client = get_async_client()
    if get_settings().json_mode_with_tools_supported:
        return OpenAIChatCompletionsModel(model=name, openai_client=client)
    return _NoJsonSchemaToolModel(model=name, openai_client=client)


# ------------------------------------------------------------------ role helpers
def assistant_model() -> Model:
    return chat_model(get_settings().assistant_model_name)


def safety_model() -> Model:
    """Red-flag and medication-safety agents get the stronger reasoning model."""
    return chat_model(get_settings().safety_model_name)


def vision_model() -> Model:
    return chat_model(get_settings().vision_model_name)


def embedding_model() -> str:
    return get_settings().embedding_model


def describe_models() -> dict:
    s = get_settings()
    return {
        "provider": s.chat_provider,
        "endpoint": s.chat_base_url,
        "assistant": s.assistant_model_name,
        "safety": s.safety_model_name,
        "vision": s.vision_model_name,
        "max_output_tokens": s.model_max_tokens,
        "embedding_provider": s.embedding_base_url,
        "embedding": s.embedding_model,
        "embedding_dimensions": s.embedding_dimensions,
    }
