"""Deterministic evidence-to-plan pipeline (fallback + test target).

Used when no LLM key is set, the LLM fails validation, or tests need a
stable output. Still cites real evidence ids and keeps budget exact.
"""

from __future__ import annotations

from app.models import (
    BudgetLine,
    CampaignBrief,
    DraftMaterial,
    EvidenceSnapshot,
    GeoVenue,
    Plan,
    PlanActivity,
    Provenance,
    QlooSignal,
    SuccessMetric,
    VenueCandidate,
)


def build_plan(
    campaign_id: str,
    brief: CampaignBrief,
    evidence: EvidenceSnapshot,
    version: int = 1,
) -> Plan:
    q0 = _ref(evidence.qloo_signals, 0, "organizer brief")
    q1 = _ref(evidence.qloo_signals, 1, "organizer brief")
    g0 = _gref(evidence.geo_venues, 0, "mapped venues")
    # Plain labels for human-readable prose; the qloo:/geo: prefixed refs above
    # stay machine-readable for evidence_refs (the UI translates them).
    # Plain labels for human-readable prose; the qloo:/geo: prefixed refs above
    # stay machine-readable for evidence_refs (the UI translates them).
    q0_name = _signal_label(evidence.qloo_signals, 0, "your brief")
    q1_name = _signal_label(evidence.qloo_signals, 1, "your brief")
    g0_name = _venue_label(evidence.geo_venues, 0, "mapped places")
    tone_phrase = (
        f"tone informed by {q0_name}."
        if q0_name == q1_name
        else f"tone informed by {q0_name} and {q1_name}."
    )
    has_culture = len(evidence.qloo_signals) > 0

    culture_line = (
        f"Qloo taste signals ({len(evidence.qloo_signals)}) shape tone and channel mix"
        if has_culture
        else "No usable Qloo signals — plan leans on verified venues + organizer input"
    )

    budget = _split_budget(brief.budget_inr)
    total = sum(b.amount_inr for b in budget)
    assert total == brief.budget_inr, f"budget must sum: {total} != {brief.budget_inr}"

    activities = [
        PlanActivity(
            title="Morning screening desk at community venue",
            channel="On-ground camp",
            why=(
                "In-person desk matches a short screening objective; "
                f"venue choice grounded in {g0_name}. {culture_line}."
            ),
            evidence_refs=[g0, q0],
            cost_inr=budget[0].amount_inr,
            provenance=Provenance.AI,
        ),
        PlanActivity(
            title="Neighbourhood outreach via local groups + posters",
            channel="Community + print",
            why=f"Low-cost awareness for ages {brief.audience_age_min}–{brief.audience_age_max}; {tone_phrase}",
            evidence_refs=[q0, q1],
            cost_inr=budget[1].amount_inr,
            provenance=Provenance.AI,
        ),
        PlanActivity(
            title="Reminder messages + follow-up day",
            channel="Messaging + camp",
            why="Reminders lift show-up for free camps; schedule fits a "
            f"{brief.duration_days}-day window.",
            evidence_refs=[q0],
            cost_inr=budget[2].amount_inr,
            provenance=Provenance.AI,
        ),
    ]

    venues = [
        VenueCandidate(
            name=v.name,
            reason=f"{v.category} within campaign area — culturally relevant, worth evaluating. Needs on-ground verification of space, permissions, accessibility.",
            evidence_refs=[f"geo:{v.name}"],
            provenance=Provenance.AI,
        )
        for v in evidence.geo_venues[:5]
    ] or [
        VenueCandidate(
            name="Organizer-provided venue (to confirm)",
            reason="No mapped community venues found; use the organizer's own site after an access check.",
            evidence_refs=["user:brief"],
            provenance=Provenance.AI,
        )
    ]

    materials = [
        DraftMaterial(
            kind="poster",
            title="Free diabetes screening camp — poster draft",
            body=(
                f"Free diabetes screening camp near {brief.location_text}. "
                f"Open to adults aged {brief.audience_age_min}–{brief.audience_age_max}. "
                "Walk in with a family member. Timings and venue to be confirmed. "
                "This is a general awareness camp, not medical advice. "
                "Draft — requires review by a qualified health professional before use."
            ),
            provenance=Provenance.AI,
        ),
        DraftMaterial(
            kind="message",
            title="WhatsApp/SMS reminder draft",
            body=(
                "Reminder: free diabetes screening camp this week near you. "
                "No fasting needed unless staff advise. Bring a family member. "
                "Reply STOP to opt out. Draft — requires review by a qualified health professional."
            ),
            provenance=Provenance.AI,
        ),
        DraftMaterial(
            kind="script",
            title="Volunteer welcome script draft",
            body=(
                "Welcome. This is a free awareness and screening camp. "
                "We will register you, answer general questions, and guide you to the screening desk. "
                "We do not diagnose or prescribe here; staff will refer you for follow-up care as needed. "
                "Draft — requires review by a qualified health professional."
            ),
            provenance=Provenance.AI,
        ),
    ]

    metrics = [
        SuccessMetric(
            name="Registrations",
            target_range=_range(brief.budget_inr, 120, 300),
            basis="AI estimate from budget/duration; assumes steady footfall. Range, not a promise.",
            provenance=Provenance.AI,
        ),
        SuccessMetric(
            name="Attendance",
            target_range=_range(brief.budget_inr, 80, 220),
            basis="AI estimate; assumes 60–75% show-up of registrations.",
            provenance=Provenance.AI,
        ),
        SuccessMetric(
            name="Cost per registration",
            target_range=f"₹{_cpr(brief.budget_inr, 300):,}–₹{_cpr(brief.budget_inr, 120):,}",
            basis="Budget ÷ registration range above.",
            provenance=Provenance.AI,
        ),
    ]

    return Plan(
        campaign_id=campaign_id,
        version=version,
        summary=(
            f"{brief.topic} outreach in {brief.location_text} for ages "
            f"{brief.audience_age_min}–{brief.audience_age_max} over {brief.duration_days} days "
            f"(₹{brief.budget_inr:,}). {culture_line}; venues are candidates needing verification."
        ),
        activities=activities,
        venues=venues,
        budget=budget,
        budget_total_inr=brief.budget_inr,
        materials=materials,
        metrics=metrics,
        assumptions=[
            "Reach/registration figures are AI-estimate ranges with stated basis, not guarantees.",
            "Qloo signals describe taste affinity, not health need or community trust.",
            "Venue suitability (space, power, permissions, accessibility) is unverified.",
        ],
        limitations=[
            "No footfall, health-need, or trust data used.",
            "Thin-evidence mode" if not has_culture else "Cultural signals present but limited",
        ],
        has_cultural_signals=has_culture,
    )


def _ref(signals: list[QlooSignal], i: int, fallback: str) -> str:
    if i < len(signals):
        return f"qloo:{signals[i].label}"
    return fallback


def _gref(venues: list[GeoVenue], i: int, fallback: str) -> str:
    if i < len(venues):
        return f"geo:{venues[i].name}"
    return fallback


def _signal_label(signals: list[QlooSignal], i: int, fallback: str) -> str:
    if i < len(signals):
        return signals[i].label
    return fallback


def _venue_label(venues: list[GeoVenue], i: int, fallback: str) -> str:
    if i < len(venues):
        return venues[i].name
    return fallback


def _split_budget(total: int) -> list[BudgetLine]:
    # 50 / 30 / 20 split, remainder-safe so the sum is provably exact.
    a = total * 50 // 100
    b = total * 30 // 100
    c = total - a - b
    return [
        BudgetLine(label="Venue + screening desk", amount_inr=a),
        BudgetLine(label="Outreach + print", amount_inr=b),
        BudgetLine(label="Messaging + contingency", amount_inr=c),
    ]


def _range(budget: int, lo: int, hi: int) -> str:
    scale = max(0.5, min(2.0, budget / 10_000))
    return f"{int(lo * scale)}–{int(hi * scale)} people"


def _cpr(budget: int, n: int) -> int:
    return max(1, budget // max(1, n))
