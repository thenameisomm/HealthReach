"""MongoDB via Motor with transparent in-memory fallback.

Falls back so `pnpm dev` and demos work with no database running.
Indexes are declared for the real-Mongo path.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

logger = logging.getLogger("healthreach.db")

try:
    from motor.motor_asyncio import AsyncIOMotorClient

    _HAS_MOTOR = True
except Exception:  # pragma: no cover
    _HAS_MOTOR = False

_mem: dict[str, dict[str, dict[str, Any]]] = {
    "campaigns": {},
    "evidence": {},
    "plans": {},
    "results": {},
}

_client = None
_db = None


async def init_db(uri: str) -> None:
    global _client, _db
    if not _HAS_MOTOR:
        logger.warning("motor not installed — using the in-memory store (data is lost on restart)")
        return
    try:
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=1500)
        db = client.get_default_database()
        # Ping first: reachability alone decides fallback, before any index work.
        await db.command("ping")
    except Exception as e:
        logger.warning(
            "MongoDB unreachable (%s) — using the in-memory store; data is lost on restart.",
            type(e).__name__,
        )
        _client = None
        _db = None
        return
    _client = client
    _db = db
    # Index declarations are best-effort and must never disable persistence.
    try:
        await _db["campaigns"].create_index("created_at")
        await _db["evidence"].create_index("campaign_id")
        await _db["plans"].create_index([("campaign_id", 1), ("version", 1)])
        await _db["results"].create_index("campaign_id")
    except Exception as e:
        logger.warning("Index setup incomplete: %s", type(e).__name__)
    try:
        # 24h TTL cache for external API responses (only if terms allow).
        await _db["ext_cache"].create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning("ext_cache TTL index not created: %s", type(e).__name__)


def is_persistent() -> bool:
    """True when writes are backed by MongoDB (rather than the in-memory fallback)."""
    return _db is not None


def _using_mongo() -> bool:
    return _db is not None


async def save(collection: str, doc: dict[str, Any], key: str = "id") -> dict[str, Any]:
    if _using_mongo():
        assert _db is not None
        await _db[collection].update_one(
            {key: doc[key]}, {"$set": doc}, upsert=True
        )
        return doc
    _mem.setdefault(collection, {})[str(doc[key])] = doc
    return doc


async def get(collection: str, key: str, value: str) -> dict[str, Any] | None:
    if _using_mongo():
        assert _db is not None
        return await _db[collection].find_one({key: value}, {"_id": 0})
    return _mem.get(collection, {}).get(str(value))


async def list_docs(collection: str, limit: int = 50) -> list[dict[str, Any]]:
    if _using_mongo():
        assert _db is not None
        cursor = _db[collection].find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
        return [d async for d in cursor]
    docs = list(_mem.get(collection, {}).values())
    docs.sort(key=lambda d: str(d.get("created_at", "")), reverse=True)
    return docs[:limit]


async def list_plans(campaign_id: str) -> list[dict[str, Any]]:
    if _using_mongo():
        assert _db is not None
        cursor = (
            _db["plans"].find({"campaign_id": campaign_id}, {"_id": 0}).sort("version", 1)
        )
        return [d async for d in cursor]
    return sorted(
        [d for d in _mem.get("plans", {}).values() if d.get("campaign_id") == campaign_id],
        key=lambda d: d.get("version", 0),
    )


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"
