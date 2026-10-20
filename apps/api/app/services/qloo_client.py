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

import asyncio
import json
import logging
import time

import httpx

from app.config import get_settings
from app.models import Provenance, QlooChainStep, QlooSignal
from app.services.qloo_progress import QlooProgressTracker

logger = logging.getLogger("healthreach.qloo")

# Short response cache: repeated evidence refreshes for the same campaign
# should not re-bill identical Qloo lookups. Cache hits are counted separately
# from provider requests in the progress panel.
_QLOO_CACHE: dict[str, tuple[float, dict]] = {}
QLOO_CACHE_TTL_S = 300.0


def _headers() -> dict[str, str]:
    s = get_settings()
    return {"x-api-key": s.QLOO_API_KEY, "Accept": "application/json"}


def _base() -> str:
    return get_settings().QLOO_BASE_URL.rstrip("/")


def _failure_reason(exc: Exception) -> tuple[str, bool]:
    """Server-side log + plain-language reason. Retry advice must be honest."""
    status = getattr(getattr(exc, "response", None), "status_code", None)
    logger.warning("Qloo lookup failed (status=%s): %s", status, exc)
    if status in (401, 403):
        return "The Qloo key was rejected. A valid key is needed before this lookup can run — retrying will not help.", True
    return "This lookup had trouble just now.", False


async def _get(path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=12.0) as client:
        r = await client.get(_base() + path, headers=_headers(), params=params)
        r.raise_for_status()
        return r.json()


def _is_retryable(exc: Exception) -> bool:
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if status in (401, 403, 400, 404):
        return False
    if status is not None:
        return status == 429 or status >= 500
    return isinstance(
        exc,
        (
            httpx.TimeoutException,
            httpx.ConnectError,
            httpx.ReadError,
            httpx.RemoteProtocolError,
        ),
    )


def _cache_key(path: str, params: dict) -> str:
    return path + "|" + json.dumps(params, sort_keys=True, default=str)


async def _get_tracked(
    path: str,
    params: dict,
    tracker: QlooProgressTracker | None,
    step: int,
    *,
    use_cache: bool = True,
) -> dict:
    """Provider request with one honest retry, cache accounting, and progress.

    Retries only happen when they can help (timeouts / 429 / 5xx). Rejected
    keys and bad parameters are surfaced immediately.
    """
    key = _cache_key(path, params)
    if use_cache:
        cached = _QLOO_CACHE.get(key)
        if cached and time.time() - cached[0] < QLOO_CACHE_TTL_S:
            if tracker:
                tracker.record_request(step, cached=True)
            return cached[1]

    attempts = 0
    while True:
        attempts += 1
        if tracker:
            tracker.record_request(step, retry=attempts > 1)
        try:
            data = await _get(path, params)
            if use_cache:
                _QLOO_CACHE[key] = (time.time(), data)
            return data
        except Exception as exc:
            if attempts >= 2 or not _is_retryable(exc):
                raise
            await asyncio.sleep(0.2)


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


def _names_of(entities: list) -> list[str]:
    return [str(e.get("name", "Untitled")) for e in entities if e.get("name")][:3]


async def fetch_cultural_signals(
    location_text: str,
    lat: float | None,
    lon: float | None,
    topic: str,
    tracker: QlooProgressTracker | None = None,
) -> tuple[list[QlooSignal], list[QlooChainStep], str, str]:
    """Run a chained Qloo lookup and return (signals, steps, status, note).

    The chain is an agent-style sequence: each call's output seeds the next
    call's input, so one evidence snapshot is the product of several linked
    reads (not one flat query). Status stays in ok|thin|unavailable.

    `tracker` (optional) records backend-observed request/retry/cache counts
    for the live progress panel. It never changes the evidence result.
    """
    tracker = tracker or QlooProgressTracker("adhoc")
    tracker.begin()
    s = get_settings()
    if not s.qloo_configured:
        reason = "Qloo is not set up on this server (missing key)."
        tracker.fail_step(1, reason)
        tracker.skip_step(2, "The first check could not run.")
        tracker.skip_step(3, "The double-check needs results from step 1.")
        tracker.finish("failed")
        raise RuntimeError("QLOO_API_KEY is not configured")

    signals: list[QlooSignal] = []
    steps: list[QlooChainStep] = []
    notes: list[str] = []
    key_rejected = False

    # --- Step 1: place affinities near the campaign location --------------
    places: list[dict] = []
    step1_title = "Looked at culture spots near here"
    tracker.begin_step(1, step1_title)
    try:
        params: dict = {
            "filter.type": "urn:entity:place",
            "filter.location.query": location_text,
            "filter.location.radius": 5000,
            "feature.explainability": "true",
        }
        if lat is not None and lon is not None:
            params["filter.location"] = f"{lat},{lon}"
        data = await _get_tracked("/v2/insights", params, tracker, 1)
        places = (data.get("results", {}).get("entities", []) or [])[:8]
        for ent in places:
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
        tracker.complete_step(1)
        steps.append(
            QlooChainStep(
                step=1,
                title="Looked at culture spots near here",
                asked=f"Which places near {location_text} match the local crowd's taste?",
                found=(
                    f"{len(places)} places — for example: {', '.join(_names_of(places))}."
                    if places
                    else "No place lookups came back."
                ),
                next=(
                    f"Now asking: what else do fans of {_names_of(places)[0]} also like?"
                    if places
                    else ""
                ),
                top_names=_names_of(places),
            )
        )
    except Exception as exc:
        # Plain-language note: internal exception names never reach users.
        reason, key_rejected = _failure_reason(exc)
        tracker.fail_step(1, reason)
        notes.append("The place-lookup step could not run: " + reason)
        steps.append(
            QlooChainStep(
                step=1,
                title="Looked at culture spots near here",
                asked=f"Which places near {location_text} match the local crowd's taste?",
                status="skip",
                skip_reason=reason,
            )
        )

    async def tag_chain(entity_id: str, step: int) -> list[dict]:
        data = await _get_tracked(
            "/v2/insights",
            {
                "filter.type": "urn:tag",
                "signal.interests.entities": entity_id,
                "signal.location.query": location_text,
            },
            tracker,
            step,
        )
        return (data.get("results", {}).get("tags", []) or [])[:6]

    # --- Step 2: taste adjacency chained from the top place ---------------
    tags_two: list[dict] = []
    if places:
        top = places[0]
        tracker.begin_step(
            2, f"Checked what fans of {top.get('name')} also like"
        )
        try:
            tags_two = await tag_chain(str(top.get("entity_id") or ""), 2)
            for t in tags_two:
                signals.append(
                    QlooSignal(
                        kind="tag-affinity",
                        label=str(t.get("name", "")),
                        detail=(
                            f"Fans of {top.get('name')} also tend to enjoy this. "
                            "Tone/framing cue only — not health targeting."
                        ),
                        affinity=_clamp(t.get("affinity")),
                        provenance=Provenance.QLOO,
                    )
                )
            tracker.complete_step(2)
            steps.append(
                QlooChainStep(
                    step=2,
                    title=f"Checked what fans of {top.get('name')} also like",
                    asked=f"Shared taste tags of people who like {top.get('name')}.",
                    found=(
                        f"{len(tags_two)} tags — for example: {', '.join(_names_of(tags_two))}."
                        if tags_two
                        else "No shared tags came back."
                    ),
                    next=(
                        f"Now double-checking the same question with {_names_of(places)[1] or 'another place'}."
                        if len(_names_of(places)) > 1
                        else ""
                    ),
                    top_names=_names_of(tags_two),
                )
            )
        except Exception as exc:
            reason, rejected = _failure_reason(exc)
            key_rejected = key_rejected or rejected
            tracker.fail_step(2, reason)
            notes.append("A taste-tag lookup could not run: " + reason)
            steps.append(
                QlooChainStep(
                    step=2,
                    title=f"Checked what fans of {top.get('name')} also like",
                    asked=f"Shared taste tags of people who like {top.get('name')}.",
                    status="skip",
                    skip_reason=reason,
                )
            )
    else:
        tracker.skip_step(2, "The first check didn't find places, so this had nothing to start from.")
        steps.append(
            QlooChainStep(
                step=2,
                title="Check what fans of the top place also like",
                asked="Not run — no place was found in step 1.",
                status="skip",
                skip_reason="The first check didn't find places, so this had nothing to start from.",
            )
        )

    # --- Step 3: cross-check with a second place from step 1 --------------
    if len(places) > 1:
        second = places[1]
        tracker.begin_step(3, f"Double-checked with {second.get('name')}")
        try:
            tags_three = await tag_chain(str(second.get("entity_id") or ""), 3)
            names_two = {str(t.get("name", "")) for t in tags_two}
            names_three = {str(t.get("name", "")) for t in tags_three}
            overlap = sorted(names_two & names_three)
            if overlap:
                found = (
                    f"{len(overlap)} of the same tags appeared — for example: "
                    + ", ".join(overlap[:3])
                    + ". The pattern holds for two different places."
                )
            else:
                found = (
                    f"{len(tags_three)} tags came back, but different from step 2 — "
                    "treat the taste picture as mixed."
                )
            for t in tags_three:
                signals.append(
                    QlooSignal(
                        kind="tag-affinity",
                        label=str(t.get("name", "")),
                        detail=(
                            f"Fans of {second.get('name')} also tend to enjoy this. "
                            "Tone/framing cue only — not health targeting."
                        ),
                        affinity=_clamp(t.get("affinity")),
                        provenance=Provenance.QLOO,
                    )
                )
            tracker.complete_step(3)
            steps.append(
                QlooChainStep(
                    step=3,
                    title=f"Double-checked with {second.get('name')}",
                    asked=f"Same taste question, asked about {second.get('name')}.",
                    found=found,
                    top_names=_names_of(tags_three),
                )
            )
        except Exception as exc:
            reason, rejected = _failure_reason(exc)
            key_rejected = key_rejected or rejected
            tracker.fail_step(3, reason)
            notes.append("The double-check lookup could not run: " + reason)
            steps.append(
                QlooChainStep(
                    step=3,
                    title=f"Double-checked with {second.get('name')}",
                    asked=f"Same taste question, asked about {second.get('name')}.",
                    status="skip",
                    skip_reason=reason,
                )
            )
    else:
        tracker.skip_step(3, "A double-check needs a second place from step 1.")
        steps.append(
            QlooChainStep(
                step=3,
                title="Double-check with a second place",
                asked="Not run — steps 1–2 gave one place or none.",
                status="skip",
                skip_reason="A double-check needs a second place from step 1.",
            )
        )

    provenance_note = " Taste affinity, not a health or trust signal."
    if not signals:
        tracker.finish("failed" if all(s.status != "completed" for s in tracker.steps) else "completed")
        if key_rejected:
            return [], steps, "thin", (
                "Qloo did not run because the configured key was rejected — no lookups "
                "were possible. The plan will say so and lean on place data + organizer input."
            )
        return [], steps, "thin", (
            "Qloo returned little for this audience/area. "
            + " ".join(notes)
            + " The plan will say so and lean on place data + organizer input."
        ).strip()
    tracker.finish("completed")
    return signals, steps, "ok", provenance_note.strip()


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
