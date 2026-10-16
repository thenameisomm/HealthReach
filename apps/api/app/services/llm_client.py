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

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings


class LlmActivity(BaseModel):
    title: str
    channel: str
    why: str
    evidence_refs: list[str] = Field(default_factory=list)
    cost_inr: int = Field(ge=0)


class LlmVenue(BaseModel):
    name: str
    reason: str
    evidence_refs: list[str] = Field(default_factory=list)


class LlmBudget(BaseModel):
    label: str
    amount_inr: int = Field(ge=0)


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

SCHEMA_HINT = """{"summary": str, "activities": [{"title": str, "channel": str, "why": str, "evidence_refs": [str], "cost_inr": int}], "venues": [{"name": str, "reason": str, "evidence_refs": [str]}], "budget": [{"label": str, "amount_inr": int}], "materials": [{"kind": "poster|message|script", "title": str, "body": str}], "metrics": [{"name": str, "target_range": str, "basis": str}], "assumptions": [str]}"""


async def try_llm_plan(payload: dict) -> LlmPlan | None:
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
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(
                s.LLM_BASE_URL.rstrip("/") + "/chat/completions",
                headers={
                    "Authorization": f"Bearer {s.LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"]
        # Retry parse once with stripped fences.
        text = text.strip().removeprefix("```json").removesuffix("```").strip()
        return LlmPlan.model_validate_json(text)
    except (ValidationError, KeyError, ValueError, httpx.HTTPError):
        # Try one repair pass: ask model to fix? Keep simple: second attempt.
        try:
            fixed = await _repair_attempt(body)
            return fixed
        except Exception:
            return None


async def _repair_attempt(body: dict) -> LlmPlan | None:
    s = get_settings()
    body["messages"].append(
        {
            "role": "user",
            "content": "Your last reply was not valid JSON for the schema. Reply with JSON only.",
        }
    )
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            s.LLM_BASE_URL.rstrip("/") + "/chat/completions",
            headers={
                "Authorization": f"Bearer {s.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
    text = text.strip().removeprefix("```json").removesuffix("```").strip()
    return LlmPlan.model_validate_json(text)
