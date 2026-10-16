"""Qloo Insights API adapter.

Verified capabilities (docs.qloo.com, Oct 2026):
- GET {base}/v2/insights with `x-api-key`, `filter.type` required.
- filter.type enum includes urn:entity:place | artist | brand | movie |
  person | book | podcast | tv_show | videogame | urn:heatmap |
  urn:demographics | urn:tag (+ locality partially supported).
- Signals: signal.interests.entities/tags, signal.demographics.*,
  filter.location (lat,lon / WKT / locality UUID),
  filter.location.query (fuzzy locality name) + filter.location.radius (m).
- Output: affinity (-1..1) / popularity (0..1), tags, explainability flag.
- Lookup helpers: /v2/search, /v2/audiences, /v2/tags (used for tag validation).

What Qloo does NOT provide (and we never claim):
venues-with-footfall, healthcare facilities, trust scores, epidemiology,
diagnoses, or health-need data. Place results are taste/cultural venues
(restaurants, leisure) — described only as "culturally relevant".
"""

from __future__ import annotations

import httpx

from app.config import get_settings
from app.models import Provenance, QlooSignal


def _headers() -> dict[str, str]:
    s = get_settings()
    return {"x-api-key": s.QLOO_API_KEY, "Accept": "application/json"}


def _base() -> str:
    return get_settings().QLOO_BASE_URL.rstrip("/")


async def _get(path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=12.0) as client:
        r = await client.get(_base() + path, headers=_headers(), params=params)
        r.raise_for_status()
        return r.json()


def map_age_to_qloo_demographics(age_min: int, age_max: int) -> str:
    """Map organizer age range to nearest Qloo audience hint (display only)."""
    mid = (age_min + age_max) / 2
    if mid < 25:
        return "24_and_younger"
    if mid < 30:
        return "25_to_29"
    if mid < 35:
        return "30_to_34"
    if mid < 45:
        return "35_to_44"
    if mid < 55:
        return "45_to_54"
    return "55_and_older"


async def fetch_cultural_signals(
    location_text: str, lat: float | None, lon: float | None, topic: str
) -> tuple[list[QlooSignal], str, str]:
    """Returns (signals, status, note). Status in ok|thin|unavailable."""
    s = get_settings()
    if not s.qloo_configured:
        raise RuntimeError("QLOO_API_KEY is not configured")

    signals: list[QlooSignal] = []
    notes: list[str] = []

    # 1) Place affinities near the campaign location (cultural venues only).
    try:
        params: dict = {
            "filter.type": "urn:entity:place",
            "filter.location.query": location_text,
            "filter.location.radius": 5000,
            "feature.explainability": "true",
        }
        if lat is not None and lon is not None:
            params["filter.location"] = f"{lat},{lon}"
        data = await _get("/v2/insights", params)
        for ent in (data.get("results", {}).get("entities", []) or [])[:8]:
            tags = ent.get("tags", []) or []
            tag_names = ", ".join(t.get("name", "") for t in tags[:4] if t.get("name"))
            signals.append(
                QlooSignal(
                    kind="place-affinity",
                    label=str(ent.get("name", "Untitled place")),
                    detail=(
                        f"Cultural venue near {location_text}"
                        + (f" tagged: {tag_names}." if tag_names else ".")
                        + " Taste affinity, not a health or trust signal."
                    ),
                    affinity=_clamp(ent.get("affinity")),
                    popularity=_clamp01(ent.get("popularity")),
                    entity_id=str(ent.get("entity_id") or "") or None,
                    provenance=Provenance.QLOO,
                )
            )
    except Exception as e:
        notes.append(f"place lookup issue: {type(e).__name__}")

    # 2) Tag-level taste affinities relevant to community outreach wording.
    tag_queries = _topic_to_tag_queries(topic)
    for tq in tag_queries:
        try:
            data = await _get(
                "/v2/insights",
                {"filter.type": "urn:tag", "signal.location.query": location_text},
            )
            for t in (data.get("results", {}).get("tags", []) or [])[:3]:
                signals.append(
                    QlooSignal(
                        kind="tag-affinity",
                        label=str(t.get("name", tq)),
                        detail=f"Audience taste tag related to '{tq}'. Use for tone/framing, not medical targeting.",
                        affinity=_clamp(t.get("affinity")),
                        provenance=Provenance.QLOO,
                    )
                )
            break
        except Exception:
            continue

    if not signals:
        return [], "thin", (
            "Qloo returned little for this audience/area. "
            + " ".join(notes)
            + " The plan will say so and lean on place data + organizer input."
        ).strip()
    return signals, "ok", ""


def _topic_to_tag_queries(topic: str) -> list[str]:
    t = topic.lower()
    if "diabet" in t:
        return ["wellness", "community", "family"]
    if "vaccin" in t or "immun" in t:
        return ["family", "community", "parenting"]
    if "screen" in t or "camp" in t:
        return ["community", "wellness"]
    return ["community"]


def _clamp(v: object) -> float | None:
    try:
        f = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return max(-1.0, min(1.0, f))


def _clamp01(v: object) -> float | None:
    try:
        f = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, f))
