"""Pydantic v2 request/response models with explicit provenance.

Provenance is a first-class field: every evidence/plan value carries one of
qloo | geo | ai | user | illustrative. Demo data always uses illustrative.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Provenance(str, Enum):
    QLOO = "qloo"
    GEO = "geo"
    AI = "ai"
    USER = "user"
    ILLUSTRATIVE = "illustrative"


class Objective(str, Enum):
    AWARENESS = "awareness"
    ATTENDANCE = "attendance"
    SCREENING = "screening"
    VACCINATION = "vaccination"


class CampaignBrief(BaseModel):
    topic: str = Field(min_length=3, max_length=120)
    location_text: str = Field(min_length=2, max_length=200)
    audience_age_min: int = Field(ge=0, le=120)
    audience_age_max: int = Field(ge=0, le=120)
    audience_notes: str = Field(default="", max_length=500)
    budget_inr: int = Field(ge=500, le=10_000_000)
    duration_days: int = Field(ge=1, le=90)
    objective: Objective = Objective.AWARENESS


class GeocodeResult(BaseModel):
    display_name: str
    lat: float
    lon: float
    provenance: Provenance = Provenance.GEO
    attribution: str = "© OpenStreetMap contributors (Nominatim, ODbL)"


class Campaign(BaseModel):
    id: str
    brief: CampaignBrief
    geocode: GeocodeResult | None = None
    mode: Literal["real", "demo"] = "real"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class QlooSignal(BaseModel):
    kind: str = Field(description="e.g. tag-affinity, place-affinity, demographics")
    label: str
    detail: str
    affinity: float | None = Field(default=None, ge=-1, le=1)
    popularity: float | None = Field(default=None, ge=0, le=1)
    entity_id: str | None = None
    provenance: Provenance = Provenance.QLOO


class GeoVenue(BaseModel):
    name: str
    category: str
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    distance_m: int | None = None
    provenance: Provenance = Provenance.GEO
    needs_verification: bool = True


class EvidenceSnapshot(BaseModel):
    campaign_id: str
    qloo_signals: list[QlooSignal] = Field(default_factory=list)
    geo_venues: list[GeoVenue] = Field(default_factory=list)
    qloo_status: Literal["ok", "thin", "unavailable"] = "ok"
    qloo_note: str = ""
    geo_status: Literal["ok", "thin", "unavailable"] = "ok"
    geo_note: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PlanActivity(BaseModel):
    title: str
    channel: str
    why: str
    evidence_refs: list[str] = Field(default_factory=list)
    cost_inr: int = Field(ge=0)
    provenance: Provenance = Provenance.AI


class VenueCandidate(BaseModel):
    name: str
    reason: str
    evidence_refs: list[str] = Field(default_factory=list)
    status: Literal["worth-evaluating", "verified", "rejected"] = "worth-evaluating"
    needs_verification: bool = True
    provenance: Provenance = Provenance.AI


class BudgetLine(BaseModel):
    label: str
    amount_inr: int = Field(ge=0)
    provenance: Provenance = Provenance.AI


class DraftMaterial(BaseModel):
    kind: Literal["poster", "message", "script"]
    title: str
    body: str
    review_notice: str = "Draft — requires review by a qualified health professional before use."
    provenance: Provenance = Provenance.AI


class SuccessMetric(BaseModel):
    name: str
    target_range: str
    basis: str
    provenance: Provenance = Provenance.AI


class Plan(BaseModel):
    campaign_id: str
    version: int = 1
    summary: str
    activities: list[PlanActivity]
    venues: list[VenueCandidate]
    budget: list[BudgetLine]
    budget_total_inr: int
    materials: list[DraftMaterial]
    metrics: list[SuccessMetric]
    assumptions: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    has_cultural_signals: bool = True
    # Which engine drafted the plan. Shown in the UI so users know whether an
    # external AI model was involved ("ai-model") or a fixed template was used
    # ("standard-template"). Defaults to the template for old stored plans.
    planner: Literal["ai-model", "standard-template"] = "standard-template"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ResultsInput(BaseModel):
    registrations: int = Field(ge=0, le=10_000_000)
    attendance: int = Field(ge=0, le=10_000_000)
    spend_inr: int = Field(ge=0, le=100_000_000)
    engagement: int = Field(ge=0, le=10_000_000)
    notes: str = Field(default="", max_length=1000)


class Analytics(BaseModel):
    planned_registrations: str
    actual_registrations: int
    planned_attendance: str
    actual_attendance: int
    planned_spend_inr: int
    actual_spend_inr: int
    cost_per_registration: float | None
    attendance_rate: float | None
    note: str = (
        "Descriptive comparison only. Differences may reflect many factors "
        "and do not prove the plan caused the outcome."
    )
