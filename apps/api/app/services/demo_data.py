"""ISOLATED demo data. Everything here is tagged illustrative.

This module is the ONLY place illustrative values are defined, so demo data
can never leak into real-mode responses. The API marks every demo-derived
value with provenance=illustrative in the response itself.
"""

from __future__ import annotations

from app.models import (
    CampaignBrief,
    EvidenceSnapshot,
    GeocodeResult,
    GeoVenue,
    Objective,
    Plan,
    Provenance,
    QlooSignal,
    ResultsInput,
)

KOTHRUD_BRIEF = CampaignBrief(
    topic="Free diabetes screening camp",
    location_text="Kothrud, Pune",
    audience_age_min=30,
    audience_age_max=60,
    audience_notes="Adults 30-60, families, Marathi + Hindi speaking",
    budget_inr=10_000,
    duration_days=7,
    objective=Objective.ATTENDANCE,
)

KOTHRUD_GEOCODE = GeocodeResult(
    display_name="Kothrud, Pune, Maharashtra, India (illustrative)",
    lat=18.5074,
    lon=73.8077,
    provenance=Provenance.ILLUSTRATIVE,
)

KOTHRUD_QLOO = [
    QlooSignal(
        kind="place-affinity",
        label="Community food halls",
        detail="Illustrative: taste affinity for communal dining formats. Use for framing only — not health data.",
        affinity=0.72,
        popularity=0.61,
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooSignal(
        kind="tag-affinity",
        label="Family & wellness",
        detail="Illustrative: audience leans to family-oriented wellness content. Tone cue only.",
        affinity=0.68,
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooSignal(
        kind="tag-affinity",
        label="Local cinema & music",
        detail="Illustrative: regional film/music affinity suggests familiar-language creatives.",
        affinity=0.55,
        provenance=Provenance.ILLUSTRATIVE,
    ),
]

KOTHRUD_VENUES = [
    GeoVenue(
        name="Kothrud Community Hall (illustrative)",
        category="community_centre",
        address="Karve Putala, Kothrud, Pune",
        lat=18.5081,
        lon=73.8062,
        distance_m=420,
        provenance=Provenance.ILLUSTRATIVE,
        needs_verification=True,
    ),
    GeoVenue(
        name="Garden Plaza Forecourt (illustrative)",
        category="marketplace",
        address="Mahatma Society, Kothrud",
        lat=18.5055,
        lon=73.8091,
        distance_m=780,
        provenance=Provenance.ILLUSTRATIVE,
        needs_verification=True,
    ),
    GeoVenue(
        name="Neighbourhood Library Annex (illustrative)",
        category="library",
        address="Kothrud, Pune",
        lat=18.5090,
        lon=73.8040,
        distance_m=950,
        provenance=Provenance.ILLUSTRATIVE,
        needs_verification=True,
    ),
]

KOTHRUD_RESULTS = ResultsInput(
    registrations=214,
    attendance=156,
    spend_inr=9_450,
    engagement=380,
    notes="Illustrative aggregate counts for demo comparison.",
)


def demo_evidence(campaign_id: str) -> EvidenceSnapshot:
    return EvidenceSnapshot(
        campaign_id=campaign_id,
        qloo_signals=list(KOTHRUD_QLOO),
        geo_venues=list(KOTHRUD_VENUES),
        qloo_status="ok",
        qloo_note="Illustrative Qloo-style signals for demo.",
        geo_status="ok",
        geo_note="Illustrative venue list for demo.",
    )


def tag_plan_illustrative(plan: Plan) -> Plan:
    """Force every plan element to illustrative provenance."""
    for a in plan.activities:
        a.provenance = Provenance.ILLUSTRATIVE
    for v in plan.venues:
        v.provenance = Provenance.ILLUSTRATIVE
    for b in plan.budget:
        b.provenance = Provenance.ILLUSTRATIVE
    for m in plan.materials:
        m.provenance = Provenance.ILLUSTRATIVE
    for met in plan.metrics:
        met.provenance = Provenance.ILLUSTRATIVE
    return plan
