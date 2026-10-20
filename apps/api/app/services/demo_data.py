"""ISOLATED demo data. Everything here is tagged illustrative.

This module is the ONLY place illustrative values are defined, so demo data
can never leak into real-mode responses. The API marks every demo-derived
value with provenance=illustrative in the response itself.

Two scenarios are provided:
- kothrud: the original India example (INR, Pune).
- us: the US-focused East Austin, TX example (USD).
"""

from __future__ import annotations

from typing import Literal

from app.models import (
    CampaignBrief,
    Currency,
    EvidenceSnapshot,
    GeocodeResult,
    GeoVenue,
    Objective,
    Plan,
    Provenance,
    QlooChainStep,
    QlooSignal,
    ResultsInput,
)

DemoScenario = Literal["kothrud", "us"]

KOTHRUD_BRIEF = CampaignBrief(
    topic="Free diabetes screening camp",
    location_text="Kothrud, Pune",
    audience_age_min=30,
    audience_age_max=60,
    audience_notes="Adults 30-60, families, Marathi + Hindi speaking",
    budget_inr=10_000,
    currency=Currency.INR,
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

KOTHRUD_QLOO_STEPS = [
    QlooChainStep(
        step=1,
        title="Looked at culture spots near here (illustrative)",
        asked="Which places near Kothrud, Pune match the local crowd's taste?",
        found="3 kinds of spots — communal dining, garden plazas and libraries.",
        next="Now asking: what else do fans of community food halls also like?",
        top_names=["Community food halls", "Garden plazas", "Reading nooks"],
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooChainStep(
        step=2,
        title="Checked what fans of Community food halls also like (illustrative)",
        asked="Shared taste tags of people who like communal dining.",
        found="2 tags — family & wellness, and local cinema & music.",
        next="Now double-checking the same question with garden plazas.",
        top_names=["Family & wellness", "Local cinema & music"],
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooChainStep(
        step=3,
        title="Double-checked with Garden plazas (illustrative)",
        asked="Same taste question, asked about garden plazas.",
        found="1 of the same tags appeared — family & wellness. Pattern holds.",
        top_names=["Family & wellness", "Seasonal markets"],
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

# --- US-focused scenario: East Austin, TX --------------------------------

US_BRIEF = CampaignBrief(
    topic="Free diabetes screening camp",
    location_text="East Austin, Austin, TX",
    audience_age_min=30,
    audience_age_max=65,
    audience_notes="Predominantly Hispanic/Latino community; Spanish-speaking preferred",
    budget_usd=5_000,
    currency=Currency.USD,
    duration_days=7,
    objective=Objective.SCREENING,
)

US_GEOCODE = GeocodeResult(
    display_name="East Austin, Austin, Travis County, Texas, USA (illustrative)",
    lat=30.2500,
    lon=-97.7167,
    provenance=Provenance.ILLUSTRATIVE,
)

US_QLOO = [
    QlooSignal(
        kind="place-affinity",
        label="Neighborhood taquerias & mercados",
        detail="Illustrative: taste affinity for casual neighborhood food gathering spots. Framing cue only — not health data.",
        affinity=0.74,
        popularity=0.66,
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooSignal(
        kind="tag-affinity",
        label="Family & wellness",
        detail="Illustrative: audience leans to family-centered wellness content. Tone cue only.",
        affinity=0.69,
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooSignal(
        kind="tag-affinity",
        label="Local music & community festivals",
        detail="Illustrative: local music and festival affinity suggests familiar, celebratory framing.",
        affinity=0.58,
        provenance=Provenance.ILLUSTRATIVE,
    ),
]

US_QLOO_STEPS = [
    QlooChainStep(
        step=1,
        title="Looked at culture spots near here (illustrative)",
        asked="Which places near East Austin, TX match the local crowd's taste?",
        found="3 kinds of spots — neighborhood taquerias, community markets and parks.",
        next="Now asking: what else do fans of neighborhood taquerias also like?",
        top_names=["Neighborhood taquerias", "Community markets", "Neighborhood parks"],
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooChainStep(
        step=2,
        title="Checked what fans of Neighborhood taquerias also like (illustrative)",
        asked="Shared taste tags of people who like neighborhood taquerias.",
        found="2 tags — family & wellness, and local music & community festivals.",
        next="Now double-checking the same question with community markets.",
        top_names=["Family & wellness", "Local music & community festivals"],
        provenance=Provenance.ILLUSTRATIVE,
    ),
    QlooChainStep(
        step=3,
        title="Double-checked with Community markets (illustrative)",
        asked="Same taste question, asked about community markets.",
        found="1 of the same tags appeared — family & wellness. Pattern holds.",
        top_names=["Family & wellness", "Weekend markets"],
        provenance=Provenance.ILLUSTRATIVE,
    ),
]

US_VENUES = [
    GeoVenue(
        name="East Austin Neighborhood Center (illustrative)",
        category="community_centre",
        address="E 12th St, Austin, TX",
        lat=30.2520,
        lon=-97.7150,
        distance_m=320,
        provenance=Provenance.ILLUSTRATIVE,
        needs_verification=True,
    ),
    GeoVenue(
        name="Community Health Clinic — Eastside (illustrative)",
        category="federally qualified health center",
        address="E 7th St, Austin, TX",
        lat=30.2570,
        lon=-97.7200,
        distance_m=850,
        provenance=Provenance.ILLUSTRATIVE,
        needs_verification=True,
    ),
    GeoVenue(
        name="Public Library — East Branch (illustrative)",
        category="library",
        address="E Cesar Chavez St, Austin, TX",
        lat=30.2480,
        lon=-97.7090,
        distance_m=1100,
        provenance=Provenance.ILLUSTRATIVE,
        needs_verification=True,
    ),
    GeoVenue(
        name="Neighborhood Park Pavilion (illustrative)",
        category="park",
        address="Rosewood Ave, Austin, TX",
        lat=30.2460,
        lon=-97.7220,
        distance_m=1250,
        provenance=Provenance.ILLUSTRATIVE,
        needs_verification=True,
    ),
]

US_RESULTS = ResultsInput(
    registrations=180,
    attendance=135,
    spend_usd=4_850,
    engagement=320,
    notes="Illustrative aggregate counts for demo comparison.",
)


def demo_brief(scenario: DemoScenario = "kothrud") -> CampaignBrief:
    return US_BRIEF if scenario == "us" else KOTHRUD_BRIEF


def demo_geocode(scenario: DemoScenario = "kothrud") -> GeocodeResult:
    return US_GEOCODE if scenario == "us" else KOTHRUD_GEOCODE


def demo_evidence(campaign_id: str, scenario: DemoScenario = "kothrud") -> EvidenceSnapshot:
    if scenario == "us":
        return EvidenceSnapshot(
            campaign_id=campaign_id,
            qloo_signals=list(US_QLOO),
            qloo_steps=list(US_QLOO_STEPS),
            geo_venues=list(US_VENUES),
            qloo_status="ok",
            qloo_note="Illustrative Qloo-style signals and chain for the US demo.",
            geo_status="ok",
            geo_note="Illustrative venue list for the US demo.",
        )
    return EvidenceSnapshot(
        campaign_id=campaign_id,
        qloo_signals=list(KOTHRUD_QLOO),
        qloo_steps=list(KOTHRUD_QLOO_STEPS),
        geo_venues=list(KOTHRUD_VENUES),
        qloo_status="ok",
        qloo_note="Illustrative Qloo-style signals and chain for demo.",
        geo_status="ok",
        geo_note="Illustrative venue list for demo.",
    )


def demo_scenario_payload(scenario: DemoScenario = "kothrud") -> dict:
    brief = demo_brief(scenario)
    geo = demo_geocode(scenario)
    return {
        "scenario": scenario,
        "brief": brief.model_dump(mode="json"),
        "geocode": geo.model_dump(mode="json"),
        "provenance": Provenance.ILLUSTRATIVE.value,
        "label": (
            "Illustrative data — East Austin, TX (US), $5,000"
            if scenario == "us"
            else "Illustrative data — Kothrud, Pune (India), ₹10,000"
        ),
    }


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
