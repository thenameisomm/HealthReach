from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import db
from app.config import get_settings
from app.models import (
    Analytics,
    BudgetLine,
    Campaign,
    CampaignBrief,
    DraftMaterial,
    EvidenceSnapshot,
    GeocodeResult,
    Plan,
    PlanActivity,
    Provenance,
    ResultsInput,
    SuccessMetric,
    VenueCandidate,
)
from app.rate_limit import rate_limit
from app.services import demo_data
from app.services.geo_client import geocode, nearby_venues
from app.services.llm_client import LlmPlan, try_llm_plan
from app.services.planner import build_plan
from app.services.qloo_client import fetch_cultural_signals

router = APIRouter(dependencies=[Depends(rate_limit)])


class CreateCampaignBody(BaseModel):
    brief: CampaignBrief
    mode: str = "real"


@router.get("/config")
async def config():
    s = get_settings()
    return {
        "qlooConfigured": s.qloo_configured,
        "llmConfigured": s.llm_configured,
        "dbConfigured": bool(s.MONGODB_URI),
    }


@router.post("/campaigns")
async def create_campaign(body: CreateCampaignBody):
    mode = "demo" if body.mode == "demo" else "real"
    cid = db.new_id("cmp")
    geo: GeocodeResult | None = None
    if mode == "demo":
        geo = demo_data.KOTHRUD_GEOCODE
        brief = demo_data.KOTHRUD_BRIEF
    else:
        brief = body.brief
        try:
            geo = await geocode(brief.location_text)
        except Exception:
            geo = None
    camp = Campaign(id=cid, brief=brief, geocode=geo, mode=mode)
    await db.save("campaigns", camp.model_dump(), key="id")
    return camp


@router.get("/campaigns")
async def list_campaigns():
    camps = await db.list_docs("campaigns")
    out = []
    for c in camps:
        cid = c.get("id", "")
        has_evidence = (await db.get("evidence", "campaign_id", cid)) is not None
        plan_count = len(await db.list_plans(cid))
        has_results = (await db.get("results", "campaign_id", cid)) is not None
        out.append({**c, "stage": stage_for(has_evidence, plan_count, has_results)})
    return out


def stage_for(has_evidence: bool, plan_count: int, has_results: bool) -> str:
    """Workflow stage for list display. Additive; does not alter stored data."""
    if has_results and plan_count > 0:
        return "results"
    if plan_count > 0:
        return "plan"
    if has_evidence:
        return "info"
    return "brief"


def _metric_range(metrics: list, name: str, fallback: str) -> str:
    """Planned range for a metric by name, so planned/actual columns match."""
    for m in metrics:
        if isinstance(m, dict) and m.get("name") == name and m.get("target_range"):
            return str(m["target_range"])
    return fallback


@router.get("/campaigns/{cid}")
async def get_campaign(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    plans = await db.list_plans(cid)
    evidence = await db.get("evidence", "campaign_id", cid)
    results = await db.get("results", "campaign_id", cid)
    return {"campaign": doc, "plans": plans, "evidence": evidence, "results": results}


@router.post("/campaigns/{cid}/evidence")
async def build_evidence(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    if camp.mode == "demo":
        ev = demo_data.demo_evidence(cid)
        await db.save("evidence", ev.model_dump(), key="campaign_id")
        return ev

    lat = camp.geocode.lat if camp.geocode else None
    lon = camp.geocode.lon if camp.geocode else None
    signals, qloo_status, qloo_note = [], "unavailable", ""
    try:
        signals, qloo_status, qloo_note = await fetch_cultural_signals(
            camp.brief.location_text, lat, lon, camp.brief.topic
        )
    except RuntimeError as e:
        qloo_status, qloo_note = "unavailable", str(e)
    except Exception as e:
        qloo_status, qloo_note = "unavailable", f"Qloo request failed ({type(e).__name__})."

    venues, geo_note = [], ""
    geo_status = "unavailable"
    if lat is not None and lon is not None:
        venues, geo_note = await nearby_venues(lat, lon)
        geo_status = "ok" if venues else "thin"
    else:
        geo_note = "No coordinates — confirm the location to load nearby venues."

    ev = EvidenceSnapshot(
        campaign_id=cid,
        qloo_signals=signals,
        geo_venues=venues,
        qloo_status=qloo_status,  # type: ignore[arg-type]
        qloo_note=qloo_note,
        geo_status=geo_status,  # type: ignore[arg-type]
        geo_note=geo_note,
    )
    await db.save("evidence", ev.model_dump(), key="campaign_id")
    return ev


class PlanBody(BaseModel):
    section: str | None = None


@router.post("/campaigns/{cid}/plan")
async def build_plan_route(cid: str, body: PlanBody | None = None):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    ev_doc = await db.get("evidence", "campaign_id", cid)
    if not ev_doc:
        raise HTTPException(400, "Build evidence first (POST /evidence).")
    evidence = EvidenceSnapshot.model_validate(ev_doc)
    existing = await db.list_plans(cid)
    version = len(existing) + 1

    plan = build_plan(cid, camp.brief, evidence, version=version)

    # Try LLM upgrade in real mode only; validate + enforce exact budget.
    if camp.mode == "real":
        llm = await try_llm_plan(
            {
                "brief": camp.brief.model_dump(),
                "qloo": [s.model_dump() for s in evidence.qloo_signals],
                "venues": [v.model_dump() for v in evidence.geo_venues],
                "budget_inr": camp.brief.budget_inr,
            }
        )
        upgraded = _apply_llm(plan, llm, camp.brief.budget_inr) if llm else None
        if upgraded is not None:
            plan = upgraded

    if camp.mode == "demo":
        plan = demo_data.tag_plan_illustrative(plan)

    # Section regeneration: keep it honest — rebuild one part deterministically.
    # The refreshed section comes from the standard template, so the new
    # version is labeled as template-built even if an AI model drafted before.
    if body and body.section:
        plan = _regenerate_section(plan, body.section, camp.brief)
        plan.planner = "standard-template"

    await db.save("plans", {**plan.model_dump(), "id": f"{cid}_v{version}"}, key="id")
    return plan


def _apply_llm(base: Plan, llm: LlmPlan, budget_total: int) -> Plan | None:
    try:
        budget = [BudgetLine(label=b.label[:80], amount_inr=b.amount_inr) for b in llm.budget]
        total = sum(b.amount_inr for b in budget)
        if total != budget_total and budget:
            # Scale largest line so the sum is provably exact.
            diff = budget_total - total
            budget[0] = BudgetLine(
                label=budget[0].label, amount_inr=max(0, budget[0].amount_inr + diff)
            )
        return Plan(
            campaign_id=base.campaign_id,
            version=base.version,
            summary=llm.summary[:600],
            activities=[
                PlanActivity(
                    title=a.title[:120],
                    channel=a.channel[:80],
                    why=a.why[:500],
                    evidence_refs=a.evidence_refs[:5],
                    cost_inr=a.cost_inr,
                )
                for a in llm.activities
            ],
            venues=[
                VenueCandidate(
                    name=v.name[:120],
                    reason=v.reason[:500],
                    evidence_refs=v.evidence_refs[:5],
                )
                for v in llm.venues
            ],
            budget=budget,
            budget_total_inr=budget_total,
            materials=[
                DraftMaterial(kind=m.kind, title=m.title[:120], body=m.body[:1500])  # type: ignore[arg-type]
                for m in llm.materials
            ],
            metrics=[
                SuccessMetric(name=m.name[:80], target_range=m.target_range[:80], basis=m.basis[:300])
                for m in llm.metrics
            ],
            assumptions=list(llm.assumptions)[:8] + base.assumptions,
            limitations=list(base.limitations),
            has_cultural_signals=base.has_cultural_signals,
            planner="ai-model",
        )
    except Exception:
        return None


def _regenerate_section(plan: Plan, section: str, brief) -> Plan:
    if section == "materials":
        plan.materials = build_plan(plan.campaign_id, brief, EvidenceSnapshot(campaign_id=plan.campaign_id)).materials
        if plan.campaign_id.startswith("cmp_"):
            pass
    elif section == "budget":
        plan.budget = build_plan(plan.campaign_id, brief, EvidenceSnapshot(campaign_id=plan.campaign_id)).budget
        # Re-scale to actual total.
        plan.budget = _rescale(plan.budget, plan.budget_total_inr)
    elif section == "activities":
        plan.activities = build_plan(plan.campaign_id, brief, EvidenceSnapshot(campaign_id=plan.campaign_id)).activities
    return plan


def _rescale(lines: list[BudgetLine], total: int) -> list[BudgetLine]:
    if not lines:
        return lines
    s = sum(b.amount_inr for b in lines) or 1
    out: list[BudgetLine] = []
    acc = 0
    for i, b in enumerate(lines):
        if i < len(lines) - 1:
            v = b.amount_inr * total // s
            acc += v
            out.append(BudgetLine(label=b.label, amount_inr=v))
        else:
            out.append(BudgetLine(label=b.label, amount_inr=total - acc))
    return out


@router.post("/campaigns/{cid}/results")
async def save_results(cid: str, body: ResultsInput):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    await db.save(
        "results", {"campaign_id": cid, **body.model_dump(), "saved_at": datetime.utcnow().isoformat()}, key="campaign_id"
    )
    return {"ok": True}


@router.get("/campaigns/{cid}/analytics")
async def get_analytics(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    res = await db.get("results", "campaign_id", cid)
    plans = await db.list_plans(cid)
    planned_spend = camp.brief.budget_inr
    metrics = plans[-1].get("metrics", []) if plans else []
    planned_range = _metric_range(metrics, "Registrations", "120–300 people")
    planned_att = _metric_range(metrics, "Attendance", "80–220 people")
    if not res:
        return {"hasResults": False, "planned_spend_inr": planned_spend, "planned_range": planned_range}
    attendance_rate = (res["attendance"] / res["registrations"]) if res["registrations"] else None
    cpr = (res["spend_inr"] / res["registrations"]) if res["registrations"] else None
    analytics = Analytics(
        planned_registrations=str(planned_range),
        actual_registrations=res["registrations"],
        planned_attendance=str(planned_att),
        actual_attendance=res["attendance"],
        planned_spend_inr=planned_spend,
        actual_spend_inr=res["spend_inr"],
        cost_per_registration=round(cpr, 1) if cpr is not None else None,
        attendance_rate=round(attendance_rate, 3) if attendance_rate is not None else None,
    )
    return {"hasResults": True, "analytics": analytics.model_dump(), "results": res}


@router.get("/demo/scenario")
async def demo_scenario():
    return {
        "brief": demo_data.KOTHRUD_BRIEF.model_dump(),
        "geocode": demo_data.KOTHRUD_GEOCODE.model_dump(),
        "provenance": Provenance.ILLUSTRATIVE.value,
        "label": "Illustrative data",
    }
