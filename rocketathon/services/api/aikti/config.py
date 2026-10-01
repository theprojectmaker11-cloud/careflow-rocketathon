"""Application settings, loaded from env / .env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ---- Chat provider. Groq or OpenRouter, both OpenAI-compatible.
    # One switch moves every chat, vision and safety call to the other endpoint,
    # so the same agents, handoffs, tools and tracing run unchanged.
    #   groq       -> https://api.groq.com/openai/v1   (free tier, fast, no credits)
    #   openrouter -> https://openrouter.ai/api/v1     (many models, needs credits)
    chat_provider: str = "groq"

    # ---- Groq, via its OpenAI-compatible endpoint. https://console.groq.com/keys
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Groq serves no vision model on the free tier, so document reading falls back
    # to the assistant model and reports that no image could be transcribed.
    groq_assistant_model: str = "llama-3.3-70b-versatile"
    groq_safety_model: str = "llama-3.3-70b-versatile"
    groq_vision_model: str = "llama-3.3-70b-versatile"

    # ---- OpenRouter, reached via its OpenAI-compatible endpoint
    # One key, many providers. https://openrouter.ai/keys
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # Optional attribution sent to OpenRouter on every request. Set both to identify
    # the app on openrouter.ai; leave blank and they are omitted entirely.
    openrouter_app_url: str = ""
    openrouter_app_title: str = "Aikti"
    openrouter_assistant_model: str = "qwen/qwen3.8-flash"
    # Red-flag and medication-safety agents get the stronger reasoning model.
    openrouter_safety_model: str = "anthropic/claude-sonnet-5.5"
    openrouter_vision_model: str = "qwen/qwen3.8-flash"
    model_timeout: float = 120.0
    # Providers pre-authorise the model's full output budget against the balance
    # before the call runs, so an unset or oversized budget is rejected with 402
    # before the request reaches the model. Capping it keeps calls affordable.
    model_max_tokens: int = 3500

    # ---- Embeddings, on a separate provider.
    # OpenRouter proxies chat/completions only and serves no embedding models, so
    # pgvector retrieval needs its own endpoint. SiliconFlow's Qwen3-Embedding
    # truncates to 1536 dims, which is exactly the vector(1536) column width, so
    # no migration is needed.
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.siliconflow.cn/v1"
    embedding_model: str = "Qwen/Qwen3-Embedding-8B"
    embedding_dimensions: int = 1536
    # SiliconFlow accepts at most 32 inputs per request.
    embedding_batch_size: int = 32
    embedding_timeout: float = 60.0

    # ---- Supabase (Postgres + pgvector + Auth)
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_publishable_key: str = ""
    # Legacy JWT keys, deprecated and removed from new projects as of Nov 2025.
    # Still read so an older .env keeps working; do not add these to new files.
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""

    # ---- MongoDB (chat history, raw transcripts, camp registers)
    mongo_uri: str = ""
    mongo_db: str = "aikti"

    # ---- RAG
    rag_match_count: int = 5
    rag_min_similarity: float = 0.25

    # ---- Safety: surfaced verbatim whenever the red-flag agent escalates.
    # Replace with your own verified numbers before deploying to real patients.
    emergency_ambulance: str = "Rescue 1122"
    emergency_contact_note: str = (
        "If no ambulance is reachable, go to the nearest hospital emergency department "
        "or any Alkhidmat health centre immediately."
    )

    # ---- Tracing. Off by default: agent traces carry patient content, and the
    # SDK's default exporter ships them to OpenAI. Set to true only for demos.
    trace_to_openai: bool = False
    trace_console: bool = True

    # ---- Service
    api_cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"

    @property
    def supabase_service_key(self) -> str:
        return (
            self.supabase_secret_key
            or self.supabase_service_role_key
            or self.supabase_publishable_key
            or self.supabase_anon_key
        )

    # ---- Resolved chat provider. Every model call reads these, so switching
    # providers is a one-line .env change rather than a code change.
    @property
    def use_groq(self) -> bool:
        return self.chat_provider.strip().lower() == "groq"

    @property
    def json_mode_with_tools_supported(self) -> bool:
        """Groq combines no JSON response format with tools; OpenRouter does."""
        return not self.use_groq

    @property
    def chat_api_key(self) -> str:
        return self.groq_api_key if self.use_groq else self.openrouter_api_key

    @property
    def chat_base_url(self) -> str:
        return self.groq_base_url if self.use_groq else self.openrouter_base_url

    @property
    def assistant_model_name(self) -> str:
        return self.groq_assistant_model if self.use_groq else self.openrouter_assistant_model

    @property
    def safety_model_name(self) -> str:
        return self.groq_safety_model if self.use_groq else self.openrouter_safety_model

    @property
    def vision_model_name(self) -> str:
        return self.groq_vision_model if self.use_groq else self.openrouter_vision_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
