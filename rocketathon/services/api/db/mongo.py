"""MongoDB client for unstructured data: raw transcripts, chat turns, camp registers."""

from functools import lru_cache

from pymongo import ASCENDING, MongoClient

from aikti.config import get_settings

_client: MongoClient | None = None


@lru_cache
def get_mongo() -> MongoClient:
    global _client
    settings = get_settings()
    if not settings.mongo_uri:
        raise RuntimeError("MongoDB not configured. Set MONGO_URI in services/api/.env")
    if _client is None:
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
    return _client


def get_db():
    return get_mongo()[get_settings().mongo_db]


def ensure_indexes() -> None:
    db = get_db()
    db.transcripts.create_index([("encounter_id", ASCENDING)])
    db.transcripts.create_index([("created_at", ASCENDING)])
    db.chat_turns.create_index([("encounter_id", ASCENDING), ("seq", ASCENDING)])
    db.chat_turns.create_index([("created_at", ASCENDING)])
    # Atlas Vector Search index is defined in the Atlas UI, not here:
    # {"fields": [{"type": "vector", "path": "embedding", "numDimensions": 1536,
    #              "similarity": "cosine"}]}


def save_transcript(encounter_id: str, transcript: str, meta: dict | None = None) -> None:
    get_db().transcripts.insert_one(
        {"encounter_id": encounter_id, "text": transcript, "meta": meta or {}}
    )


def append_chat_turn(session_id: str, seq: int, role: str, content: str) -> None:
    get_db().chat_turns.insert_one(
        {
            "session_id": session_id,
            "seq": seq,
            "role": role,
            "content": content[:8000],
            "created_at": __import__("datetime").datetime.utcnow(),
        }
    )


def next_seq(session_id: str) -> int:
    last = get_db().chat_turns.find_one({"session_id": session_id}, sort=[("seq", -1)])
    return (last.get("seq", -1) + 1) if last else 0
