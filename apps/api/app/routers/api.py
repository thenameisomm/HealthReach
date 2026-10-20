from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app import db
from app.config import get_settings
from app.models import (
    Analytics,
    BudgetLine,
    Campaign,
    CampaignBrief,
    Currency,
    DraftMaterial,
    EvidenceSnapshot,
    GeocodeResult,
    Plan,
    PlanActivity,
    Provenance,
    QlooProgress,
    ResultsInput,
    SuccessMetric,
    VenueCandidate,
)
from app.rate_limit import rate_limit
from app.services import demo_data, exports
from app.services.geo_client import (
    geocode,
    nearby_venues,
    reverse_geocode,
    suggest_locations,
)
from app.services.llm_client import LlmPlan, try_llm_plan
from app.services.planner import build_plan
from app.services.qloo_client import fetch_cultural_signals
from app.services.qloo_progress import QlooProgressTracker

router = APIRouter(dependencies=[Depends(rate_limit)])

OSM_ATTRIBUTE = "© OpenStreetMap contributors (ODbL)"

# Live, backend-observed progress for an evidence request that is still running.
# In-memory by design: progress is transient and tied to one process.
_EVIDENCE_PROGRESS: dict[str, QlooProgressTracker] = {}


class CreateCampaignBody(BaseModel):
    brief: CampaignBrief
    mode: str = "real"
    # Only used in demo mode; "kothrud" is the default for backwards compat.
    scenario: str = "kothrud"


@router.get("/config")
async def config():
    s = get_settings()
    return {
        "qlooConfigured": s.qloo_configured,
        "llmConfigured": s.llm_configured,
        "dbConfigured": bool(s.MONGODB_URI),
        # Honest mode: "memory" means data is lost on restart.
        "dbMode": "mongo" if db.is_persistent() else "memory",
    }


@router.post("/campaigns")
async def create_campaign(body: CreateCampaignBody):
    mode = "demo" if body.mode == "demo" else "real"
    scenario = "us" if body.scenario == "us" else "kothrud"
    cid = db.new_id("cmp")
    geo: GeocodeResult | None = None
    if mode == "demo":
        geo = demo_data.demo_geocode(scenario)  # type: ignore[arg-type]
        brief = demo_data.demo_brief(scenario)  # type: ignore[arg-type]
    else:
        brief = body.brief
        try:
            geo = await geocode(brief.location_text)
        except Exception:
            geo = None
    camp = Campaign(
        id=cid,
        brief=brief,
        geocode=geo,
        mode=mode,
        demo_scenario=scenario if mode == "demo" else None,
    )
    await db.save("campaigns", camp.model_dump(mode="json"), key="id")
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


def _titles() -> dict[int, str]:
    return {
        1: "Looked at culture spots near here",
        2: "Checked what fans of the top place also like",
        3: "Double-checked with a second place",
    }


def _demo_progress(cid: str, ev: EvidenceSnapshot) -> None:
    """Record the demo chain as completed so the panel tells the same story."""
    tracker = QlooProgressTracker(cid)
    tracker.begin(_titles())
    for step in ev.qloo_steps:
        tracker.begin_step(step.step, step.title)
        tracker.record_request(step.step)
        tracker.complete_step(step.step)
    tracker.finish("completed")
    _EVIDENCE_PROGRESS[cid] = tracker


@router.post("/campaigns/{cid}/evidence")
async def build_evidence(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    if camp.mode == "demo":
        scenario = "us" if camp.demo_scenario == "us" else "kothrud"
        ev = demo_data.demo_evidence(cid, scenario)  # type: ignore[arg-type]
        _demo_progress(cid, ev)
        await db.save("evidence", ev.model_dump(mode="json"), key="campaign_id")
        return ev

    lat = camp.geocode.lat if camp.geocode else None
    lon = camp.geocode.lon if camp.geocode else None
    tracker = QlooProgressTracker(cid)
    tracker.begin(_titles())
    _EVIDENCE_PROGRESS[cid] = tracker

    async def qloo_lookup() -> tuple[list, list, str, str]:
        try:
            return await fetch_cultural_signals(
                camp.brief.location_text, lat, lon, camp.brief.topic, tracker
            )
        except RuntimeError as e:
            if not any(s.status not in ("pending", "in_progress") for s in tracker.steps):
                tracker.fail_step(1, str(e))
                tracker.skip_step(2, "The first check could not run.")
                tracker.skip_step(3, "The double-check needs results from step 1.")
            tracker.finish("failed")
            return [], [], "unavailable", str(e)
        except Exception:
            if not any(s.status not in ("pending", "in_progress") for s in tracker.steps):
                tracker.fail_step(1, "This lookup had trouble just now.")
                tracker.skip_step(2, "The first check could not run.")
                tracker.skip_step(3, "The double-check needs results from step 1.")
            tracker.finish("failed")
            return [], [], "unavailable", "Qloo request failed just now."

    async def geo_lookup() -> tuple[list, str, str]:
        if lat is None or lon is None:
            return (
                [],
                "unavailable",
                "No coordinates — confirm the location to load nearby venues.",
            )
        return await nearby_venues(lat, lon)

    # Independent lookups run concurrently: the evidence screen waits for the
    # slower source, not the sum of both, staying under the client timeout.
    (signals, qloo_steps, qloo_status, qloo_note), (venues, geo_status, geo_note) = (
        await asyncio.gather(qloo_lookup(), geo_lookup())
    )
    if tracker.overall_status == "in_progress":
        tracker.finish()

    ev = EvidenceSnapshot(
        campaign_id=cid,
        qloo_signals=signals,
        qloo_steps=qloo_steps,
        geo_venues=venues,
        qloo_status=qloo_status,  # type: ignore[arg-type]
        qloo_note=qloo_note,
        geo_status=geo_status,  # type: ignore[arg-type]
        geo_note=geo_note,
    )
    await db.save("evidence", ev.model_dump(mode="json"), key="campaign_id")
    return ev


@router.get("/campaigns/{cid}/evidence/progress")
async def evidence_progress(cid: str):
    """Backend-observed progress for the evidence request in flight.

    Falls back to stored evidence for completed/older campaigns, so a refresh
    after completion still explains what happened.
    """
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    tracker = _EVIDENCE_PROGRESS.get(cid)
    if tracker:
        return tracker.snapshot()
    ev_doc = await db.get("evidence", "campaign_id", cid)
    if ev_doc:
        ev = EvidenceSnapshot.model_validate(ev_doc)
        return QlooProgress(
            campaign_id=cid,
            total_requests=0,
            steps=[
                {
                    "step": s.step,
                    "title": s.title,
                    "status": "completed" if s.status == "ok" else "skipped",
                    "skip_reason": s.skip_reason,
                }
                for s in ev.qloo_steps
            ],
            overall_status="completed" if ev.qloo_status != "unavailable" else "failed",
            current_step=len(ev.qloo_steps),
        )
    return QlooProgress(campaign_id=cid, steps=[])


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
                "brief": camp.brief.model_dump(mode="json"),
                "currency": (camp.brief.currency or Currency.USD).value,
                "budget": camp.brief.budget_amount,
                "qloo": [s.model_dump(mode="json") for s in evidence.qloo_signals],
                "venues": [v.model_dump(mode="json") for v in evidence.geo_venues],
            }
        )
        upgraded = (
            _apply_llm(plan, llm, camp.brief.budget_amount, evidence)
            if llm
            else None
        )
        if upgraded is not None:
            plan = upgraded

    if camp.mode == "demo":
        plan = demo_data.tag_plan_illustrative(plan)

    # Section regeneration: keep it honest — rebuild one part deterministically
    # from the SAME stored evidence, so citations stay real.
    # The refreshed section comes from the standard template, so the new
    # version is labeled as template-built even if an AI model drafted before.
    if body and body.section:
        plan = _regenerate_section(plan, body.section, camp.brief, evidence)
        plan.planner = "standard-template"

    await db.save("plans", {**plan.model_dump(), "id": f"{cid}_v{version}"}, key="id")
    return plan


def _known_refs(evidence: EvidenceSnapshot) -> set[str]:
    """Evidence ids an LLM is allowed to cite (anything else is dropped)."""
    refs = {"user:brief", "organizer brief", "mapped venues"}
    refs.update(f"qloo:{s.label}" for s in evidence.qloo_signals)
    refs.update(f"geo:{v.name}" for v in evidence.geo_venues)
    return refs


def _amount_fields(amount: int, currency: Currency) -> dict[str, int]:
    return {"amount_usd": amount} if currency == Currency.USD else {"amount_inr": amount}


def _cost_fields(amount: int, currency: Currency) -> dict[str, int]:
    return {"cost_usd": amount} if currency == Currency.USD else {"cost_inr": amount}


def _apply_llm(
    base: Plan, llm: LlmPlan, budget_total: int, evidence: EvidenceSnapshot
) -> Plan | None:
    """Merge validated LLM output into a Plan, enforcing app-side invariants.

    LLM output is untrusted: the budget is rescaled by application logic to
    sum exactly, venue names must match evidence venues, and evidence refs are
    filtered to ids that actually exist in the evidence snapshot.
    Returns None when output can't be grounded — the caller keeps the
    deterministic plan.
    """
    try:
        currency = base.currency or Currency.USD
        budget = [
            BudgetLine(
                label=b.label[:80],
                **_amount_fields(a, currency),  # type: ignore[arg-type]
            )
            for b, a in zip(
                llm.budget,
                _scale_amounts([b.amount for b in llm.budget], budget_total),
            )
        ]
        activity_costs = _scale_amounts(
            [a.cost for a in llm.activities], budget_total
        )

        known_names = [v.name.strip().lower() for v in base.venues]
        allowed = _known_refs(evidence)

        def clean(refs: list[str]) -> list[str]:
            return [r for r in refs if r in allowed]

        grounded_venues = [
            VenueCandidate(
                name=v.name[:120],
                reason=v.reason[:500],
                evidence_refs=clean(v.evidence_refs)[:5],
            )
            for v in llm.venues
            if any(
                v.name.strip().lower() in k or k in v.name.strip().lower()
                for k in known_names
            )
        ]

        return Plan(
            campaign_id=base.campaign_id,
            version=base.version,
            summary=llm.summary[:600],
            activities=[
                PlanActivity(
                    title=a.title[:120],
                    channel=a.channel[:80],
                    why=a.why[:500],
                    evidence_refs=clean(a.evidence_refs)[:5],
                    **_cost_fields(cost, currency),  # type: ignore[arg-type]
                )
                for a, cost in zip(llm.activities, activity_costs)
            ],
            venues=grounded_venues or base.venues,
            budget=budget,
            budget_total_usd=budget_total if currency == Currency.USD else None,
            budget_total_inr=budget_total if currency == Currency.INR else None,
            currency=currency,
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


def _regenerate_section(
    plan: Plan, section: str, brief, evidence: EvidenceSnapshot
) -> Plan:
    rebuilt = build_plan(plan.campaign_id, brief, evidence, version=plan.version)
    if section == "materials":
        plan.materials = rebuilt.materials
    elif section == "budget":
        currency = plan.currency or Currency.USD
        amounts = _scale_amounts(
            [b.amount for b in rebuilt.budget], plan.budget_total
        )
        plan.budget = [
            BudgetLine(label=b.label, **_amount_fields(a, currency))  # type: ignore[arg-type]
            for b, a in zip(rebuilt.budget, amounts)
        ]
    elif section == "activities":
        plan.activities = rebuilt.activities
    return plan


def _scale_amounts(amounts: list[int], total: int) -> list[int]:
    """Proportionally scale amounts so they sum exactly to `total`.

    Integer remainder goes to the final line, so the sum is provably exact
    and every amount stays >= 0.
    """
    if not amounts:
        return []
    s = sum(amounts)
    if s <= 0:
        out = [0] * len(amounts)
        out[0] = max(0, total)
        return out
    out: list[int] = []
    acc = 0
    for i, a in enumerate(amounts):
        if i < len(amounts) - 1:
            v = a * total // s
            acc += v
        else:
            v = total - acc
        out.append(v)
    return out


@router.post("/campaigns/{cid}/results")
async def save_results(cid: str, body: ResultsInput):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    currency = camp.brief.currency or Currency.USD
    if currency == Currency.USD:
        if body.spend_usd is None:
            raise HTTPException(
                400,
                "This campaign's budget is in US dollars — enter spend in USD.",
            )
        spend_fields = {"spend_usd": body.spend_usd}
    else:
        if body.spend_inr is None:
            raise HTTPException(
                400,
                "This campaign's budget is in Indian rupees — enter spend in INR.",
            )
        spend_fields = {"spend_inr": body.spend_inr}
    await db.save(
        "results",
        {
            "campaign_id": cid,
            **body.model_dump(mode="json", exclude={"spend_usd", "spend_inr"}),
            **spend_fields,
            "spend": body.spend_amount,
            "currency": currency.value,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        },
        key="campaign_id",
    )
    return {"ok": True}


def _actual_spend(res: dict, currency: Currency) -> int:
    if isinstance(res.get("spend"), (int, float)):
        return int(res["spend"])
    key = "spend_usd" if currency == Currency.USD else "spend_inr"
    return int(res.get(key) or 0)


@router.get("/campaigns/{cid}/analytics")
async def get_analytics(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    currency = camp.brief.currency or Currency.USD
    res = await db.get("results", "campaign_id", cid)
    plans = await db.list_plans(cid)
    planned_spend = camp.brief.budget_amount
    metrics = plans[-1].get("metrics", []) if plans else []
    # If the plan doesn't name these metrics, say so — never invent a range.
    planned_range = _metric_range(metrics, "Registrations", "Not stated in plan")
    planned_att = _metric_range(metrics, "Attendance", "Not stated in plan")
    planned_eng = _metric_range(metrics, "Engagement", "Not stated in plan")
    if not res:
        return {
            "hasResults": False,
            "currency": currency.value,
            "planned_spend": planned_spend,
            "planned_range": planned_range,
        }
    actual_spend = _actual_spend(res, currency)
    registrations = int(res.get("registrations") or 0)
    attendance = int(res.get("attendance") or 0)
    attendance_rate = (attendance / registrations) if registrations else None
    cpr = (actual_spend / registrations) if registrations else None
    cpa = (actual_spend / attendance) if attendance else None
    analytics = Analytics(
        currency=currency,
        planned_registrations=str(planned_range),
        actual_registrations=registrations,
        planned_attendance=str(planned_att),
        actual_attendance=attendance,
        planned_engagement=str(planned_eng),
        actual_engagement=int(res.get("engagement") or 0),
        planned_spend=planned_spend,
        actual_spend=actual_spend,
        planned_spend_usd=planned_spend if currency == Currency.USD else None,
        planned_spend_inr=planned_spend if currency == Currency.INR else None,
        actual_spend_usd=actual_spend if currency == Currency.USD else None,
        actual_spend_inr=actual_spend if currency == Currency.INR else None,
        cost_per_registration=round(cpr, 2) if cpr is not None else None,
        cost_per_attendee=round(cpa, 2) if cpa is not None else None,
        attendance_rate=round(attendance_rate, 3) if attendance_rate is not None else None,
    )
    return {"hasResults": True, "analytics": analytics.model_dump(mode="json"), "results": res}


@router.get("/geo/suggest")
async def geo_suggest(q: str = Query(..., min_length=3, max_length=120)):
    """Location autocomplete from OpenStreetMap (Nominatim). Stays 200 OK with
    an honest unavailable state so the typing flow is never broken by the
    open endpoint having a bad moment."""
    try:
        items = await suggest_locations(q)
    except Exception:
        return {
            "status": "unavailable",
            "suggestions": [],
            "note": "The place directory didn't answer just now. You can keep typing.",
            "attribution": OSM_ATTRIBUTE,
        }
    return {
        "status": "ok",
        "suggestions": [
            {"label": i["display_name"], "lat": i["lat"], "lon": i["lon"], "kind": i["type"]}
            for i in items
        ],
        "note": "",
        "attribution": OSM_ATTRIBUTE,
    }


@router.get("/geo/reverse")
async def geo_reverse(lat: float, lon: float):
    """Turn a picked map point into a place name. Honest 200 states again."""
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(400, "That map point is outside the map range.")
    try:
        res = await reverse_geocode(lat, lon)
    except ValueError:
        return {
            "status": "thin",
            "label": "",
            "lat": lat,
            "lon": lon,
            "note": "We found the point but couldn't read a place name there. Type the place instead.",
            "attribution": OSM_ATTRIBUTE,
        }
    except Exception:
        return {
            "status": "unavailable",
            "label": "",
            "lat": lat,
            "lon": lon,
            "note": "The naming service didn't answer just now. Try again in a moment.",
            "attribution": OSM_ATTRIBUTE,
        }
    return {
        "status": "ok",
        "label": res.display_name,
        "lat": res.lat,
        "lon": res.lon,
        "note": "",
        "attribution": OSM_ATTRIBUTE,
    }


@router.get("/demo/scenario")
async def demo_scenario(scenario: str = Query("kothrud")):
    return demo_data.demo_scenario_payload("us" if scenario == "us" else "kothrud")  # type: ignore[arg-type]


# --- Analysis & exports --------------------------------------------------


@router.get("/campaigns/{cid}/plans/compare")
async def compare_plans(cid: str, from_version: int, to_version: int):
    """Section-level diff between two stored plan versions.

    Returns only sections that actually changed; the UI renders the values in
    plain language. No raw model output or provider payloads are exposed.
    """
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    plans = {p.get("version"): p for p in await db.list_plans(cid)}
    old = plans.get(from_version)
    new = plans.get(to_version)
    if not old or not new:
        raise HTTPException(404, "One of those plan versions wasn't found")
    sections = [
        "activities",
        "venues",
        "budget",
        "materials",
        "metrics",
        "assumptions",
        "limitations",
        "summary",
    ]
    changed: dict[str, dict] = {}
    for section in sections:
        if old.get(section) != new.get(section):
            changed[section] = {
                "from": old.get(section),
                "to": new.get(section),
            }
    return {
        "campaign_id": cid,
        "from_version": from_version,
        "to_version": to_version,
        "changed_sections": sorted(changed),
        "changes": changed,
    }


@router.get("/campaigns/{cid}/export/csv")
async def export_csv(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    res = await db.get("results", "campaign_id", cid)
    plans = await db.list_plans(cid)
    analytics = await get_analytics(cid)
    content = exports.results_csv(camp, res, analytics, plans)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="healthreach-results-{cid}.csv"'
        },
    )


@router.get("/campaigns/{cid}/export/json")
async def export_json(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    ev_doc = await db.get("evidence", "campaign_id", cid)
    if not ev_doc:
        raise HTTPException(400, "Build evidence first (POST /evidence).")
    payload = exports.evidence_json(camp, EvidenceSnapshot.model_validate(ev_doc))
    return Response(
        content=payload,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="healthreach-evidence-{cid}.json"'
        },
    )


@router.get("/campaigns/{cid}/export/pdf")
async def export_pdf(cid: str):
    doc = await db.get("campaigns", "id", cid)
    if not doc:
        raise HTTPException(404, "Campaign not found")
    camp = Campaign.model_validate(doc)
    plans = await db.list_plans(cid)
    if not plans:
        raise HTTPException(400, "Create a plan first (POST /plan).")
    plan = Plan.model_validate(plans[-1])
    pdf = exports.plan_pdf(camp, plan)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="healthreach-plan-{cid}.pdf"'
        },
    )
