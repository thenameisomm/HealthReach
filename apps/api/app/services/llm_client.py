"""LLM adapter with strict schema validation + deterministic fallback.

- Provider: any OpenAI-compatible chat-completions endpoint (env-configured).
- The model receives the REAL evidence payload and must cite evidence ids
  for each recommendation, and say when evidence is insufficient.
- Output is validated with Pydantic; malformed output -> retry once ->
  graceful deterministic fallback (still cites evidence, marked AI).
- No personal data is sent: only aggregate brief + evidence labels.
"""

from __future__ import annotations

import json
import logging

import httpx
from pydantic import AliasChoices, BaseModel, Field, ValidationError

from app.config import get_settings

logger = logging.getLogger("healthreach.llm")


class LlmActivity(BaseModel):
    title: str
    channel: str
    why: str
    evidence_refs: list[str] = Field(default_factory=list)
    # Currency-neutral: the brief's currency is stated in the payload.
    cost: int = Field(ge=0, validation_alias=AliasChoices("cost", "cost_inr"))


class LlmVenue(BaseModel):
    name: str
    reason: str
    evidence_refs: list[str] = Field(default_factory=list)


class LlmBudget(BaseModel):
    label: str
    amount: int = Field(ge=0, validation_alias=AliasChoices("amount", "amount_inr"))


class LlmMaterial(BaseModel):
    kind: str = Field(pattern="^(poster|message|script)$")
    title: str
    body: str


class LlmMetric(BaseModel):
    name: str
    target_range: str
    basis: str


class LlmPlan(BaseModel):
    summary: str
    activities: list[LlmActivity] = Field(min_length=2, max_length=8)
    venues: list[LlmVenue] = Field(min_length=1, max_length=8)
    budget: list[LlmBudget] = Field(min_length=2, max_length=8)
    materials: list[LlmMaterial] = Field(min_length=2, max_length=5)
    metrics: list[LlmMetric] = Field(min_length=2, max_length=6)
    assumptions: list[str] = Field(default_factory=list)


SYSTEM = """You plan community health outreach. Rules:
- Qloo signals are taste/cultural affinity only. Never describe them as diagnoses, epidemiology, health need, footfall, or trust.
- Venues are candidates to evaluate, never "trusted". Always flag on-ground verification.
- Do not claim improved health outcomes. Projections are assumption ranges.
- Draft materials must be factual, no medical advice or diagnosis claims, and say they need professional review.
- Every activity, venue, budget line, material, and metric must cite evidence ids from the payload (evidence_refs). If evidence is thin, say so in 'assumptions'.
- Budget amounts must sum exactly to the stated budget.
- Reply with JSON only, matching the requested schema."""

SCHEMA_HINT = """{"summary": str, "activities": [{"title": str, "channel": str, "why": str, "evidence_refs": [str], "cost": int}], "venues": [{"name": str, "reason": str, "evidence_refs": [str]}], "budget": [{"label": str, "amount": int}], "materials": [{"kind": "poster|message|script", "title": str, "body": str}], "metrics": [{"name": str, "target_range": str, "basis": str}], "assumptions": [str]}"""


async def _post_chat(body: dict, timeout: float) -> str:
    """POST to the configured OpenAI-compatible endpoint; returns message text."""
    s = get_settings()
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(
            s.LLM_BASE_URL.rstrip("/") + "/chat/completions",
            headers={
                "Authorization": f"Bearer {s.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


def _parse_plan(text: str) -> LlmPlan:
    cleaned = text.strip().removeprefix("```json").removesuffix("```").strip()
    return LlmPlan.model_validate_json(cleaned)


async def try_llm_plan(payload: dict) -> LlmPlan | None:
    """Draft a plan with the configured model; None means "use the fallback".

    Malformed output gets one repair attempt that shows the model its own
    invalid reply. Network/HTTP failures skip straight to fallback (retrying
    an unreachable endpoint just burns time).
    """
    s = get_settings()
    if not s.llm_configured:
        return None
    body = {
        "model": s.LLM_MODEL,
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": "Evidence payload:\n"
                + json.dumps(payload)[:12000]
                + "\n\nReturn JSON with exactly this shape:\n"
                + SCHEMA_HINT,
            },
        ],
    }
    try:
        text = await _post_chat(body, 45.0)
    except httpx.HTTPStatusError as e:
        logger.info("LLM plan skipped: HTTP %s — %s", e.response.status_code, e.response.text[:160])
        return None
    except Exception as e:
        logger.info("LLM plan skipped: %s", str(e)[:160])
        return None

    try:
        return _parse_plan(text)
    except (ValidationError, ValueError, KeyError):
        pass

    repair = {
        **body,
        "messages": [
            *body["messages"],
            {"role": "assistant", "content": text[:4000]},
            {
                "role": "user",
                "content": "That reply was not valid JSON for the schema. Reply with JSON only, matching the schema.",
            },
        ],
    }
    try:
        return _parse_plan(await _post_chat(repair, 30.0))
    except Exception as e:
        logger.info("LLM repair also failed: %s", str(e)[:160])
        return None
