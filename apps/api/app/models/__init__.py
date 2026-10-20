"""Pydantic v2 request/response models with explicit provenance.

Provenance is a first-class field: every evidence/plan value carries one of
qloo | geo | ai | user | illustrative. Demo data always uses illustrative.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


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


class Currency(str, Enum):
    USD = "USD"
    INR = "INR"


class CampaignBrief(BaseModel):
    topic: str = Field(min_length=3, max_length=120)
    location_text: str = Field(min_length=2, max_length=200)
    audience_age_min: int = Field(ge=0, le=120)
    audience_age_max: int = Field(ge=0, le=120)
    audience_notes: str = Field(default="", max_length=500)
    # USD is the product default. INR stays accepted so existing campaigns and
    # the legacy Kothrud demo keep working; `currency` records which one a
    # brief actually uses.
    budget_usd: int | None = Field(default=None, ge=500, le=10_000_000)
    budget_inr: int | None = Field(default=None, ge=500, le=10_000_000)
    currency: Currency | None = None
    duration_days: int = Field(ge=1, le=90)
    objective: Objective = Objective.AWARENESS

    @model_validator(mode="after")
    def _validate(self) -> "CampaignBrief":
        if self.audience_age_min > self.audience_age_max:
            raise ValueError("audience_age_min must not exceed audience_age_max")
        if self.budget_usd is None and self.budget_inr is None:
            raise ValueError("a budget is required (budget_usd or budget_inr)")
        if self.currency is None:
            self.currency = (
                Currency.USD if self.budget_usd is not None else Currency.INR
            )
        if self.currency == Currency.USD and self.budget_usd is None:
            raise ValueError("budget_usd is required when currency is USD")
        if self.currency == Currency.INR and self.budget_inr is None:
            raise ValueError("budget_inr is required when currency is INR")
        return self

    @property
    def budget_amount(self) -> int:
        if self.currency == Currency.USD:
            return int(self.budget_usd or 0)
        return int(self.budget_inr or 0)


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
    # Which illustrative scenario a demo campaign uses ("kothrud" | "us").
    # Additive so older demo documents still validate.
    demo_scenario: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class QlooSignal(BaseModel):
    kind: str = Field(description="e.g. tag-affinity, place-affinity, demographics")
    label: str
    detail: str
    affinity: float | None = Field(default=None, ge=-1, le=1)
    popularity: float | None = Field(default=None, ge=0, le=1)
    entity_id: str | None = None
    provenance: Provenance = Provenance.QLOO


class QlooChainStep(BaseModel):
    """One linked Qloo lookup in a chain, in plain language.

    Each step feeds the next (step 1's findings seed step 2, etc.) so the
    reasoning path stays traceable. Status `skip` means the step couldn't
    run (its predecessor produced nothing) — recorded honestly, never invented.
    """

    step: int
    title: str
    asked: str
    found: str = ""
    next: str = ""
    top_names: list[str] = Field(default_factory=list)
    status: Literal["ok", "skip"] = "ok"
    skip_reason: str = ""
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
    # The linked-lookup trace for how the signals were derived. Additive and
    # optional so older stored evidence still validates.
    qloo_steps: list[QlooChainStep] = Field(default_factory=list)
    geo_venues: list[GeoVenue] = Field(default_factory=list)
    qloo_status: Literal["ok", "thin", "unavailable"] = "ok"
    qloo_note: str = ""
    geo_status: Literal["ok", "thin", "unavailable"] = "ok"
    geo_note: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PlanActivity(BaseModel):
    title: str
    channel: str
    why: str
    evidence_refs: list[str] = Field(default_factory=list)
    cost_usd: int | None = Field(default=None, ge=0)
    cost_inr: int | None = Field(default=None, ge=0)
    provenance: Provenance = Provenance.AI

    @model_validator(mode="after")
    def _one_cost(self) -> "PlanActivity":
        if self.cost_usd is None and self.cost_inr is None:
            raise ValueError("an activity cost is required")
        return self

    @property
    def cost(self) -> int:
        return int(self.cost_usd if self.cost_usd is not None else self.cost_inr or 0)


class VenueCandidate(BaseModel):
    name: str
    reason: str
    evidence_refs: list[str] = Field(default_factory=list)
    status: Literal["worth-evaluating", "verified", "rejected"] = "worth-evaluating"
    needs_verification: bool = True
    provenance: Provenance = Provenance.AI


class BudgetLine(BaseModel):
    label: str
    amount_usd: int | None = Field(default=None, ge=0)
    amount_inr: int | None = Field(default=None, ge=0)
    provenance: Provenance = Provenance.AI

    @model_validator(mode="after")
    def _one_amount(self) -> "BudgetLine":
        if self.amount_usd is None and self.amount_inr is None:
            raise ValueError("a budget amount is required")
        return self

    @property
    def amount(self) -> int:
        return int(
            self.amount_usd if self.amount_usd is not None else self.amount_inr or 0
        )


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
    budget_total_usd: int | None = None
    budget_total_inr: int | None = None
    currency: Currency | None = None
    materials: list[DraftMaterial]
    metrics: list[SuccessMetric]
    assumptions: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    has_cultural_signals: bool = True
    # Which engine drafted the plan. Shown in the UI so users know whether an
    # external AI model was involved ("ai-model") or a fixed template was used
    # ("standard-template"). Defaults to the template for old stored plans.
    planner: Literal["ai-model", "standard-template"] = "standard-template"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def _currency(self) -> "Plan":
        if self.budget_total_usd is None and self.budget_total_inr is None:
            raise ValueError("a budget total is required")
        if self.currency is None:
            self.currency = (
                Currency.USD
                if self.budget_total_usd is not None
                else Currency.INR
            )
        return self

    @property
    def budget_total(self) -> int:
        if self.currency == Currency.USD:
            return int(self.budget_total_usd or 0)
        return int(self.budget_total_inr or 0)


class ResultsInput(BaseModel):
    registrations: int = Field(ge=0, le=10_000_000)
    attendance: int = Field(ge=0, le=10_000_000)
    spend_usd: int | None = Field(default=None, ge=0, le=100_000_000)
    spend_inr: int | None = Field(default=None, ge=0, le=100_000_000)
    engagement: int = Field(ge=0, le=10_000_000)
    notes: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def _one_spend(self) -> "ResultsInput":
        if self.spend_usd is None and self.spend_inr is None:
            raise ValueError("a spend amount is required (spend_usd or spend_inr)")
        return self

    @property
    def spend_amount(self) -> int:
        return int(self.spend_usd if self.spend_usd is not None else self.spend_inr or 0)


class Analytics(BaseModel):
    currency: Currency = Currency.USD
    planned_registrations: str
    actual_registrations: int
    planned_attendance: str
    actual_attendance: int
    planned_engagement: str = "Not stated in plan"
    actual_engagement: int = 0
    planned_spend: int
    actual_spend: int
    planned_spend_usd: int | None = None
    planned_spend_inr: int | None = None
    actual_spend_usd: int | None = None
    actual_spend_inr: int | None = None
    cost_per_registration: float | None
    cost_per_attendee: float | None = None
    attendance_rate: float | None
    note: str = (
        "Descriptive comparison only. Differences may reflect many factors "
        "and do not prove the plan caused the outcome."
    )


class QlooStepProgress(BaseModel):
    """Backend-observed progress for one linked Qloo lookup."""

    step: int
    title: str
    status: Literal[
        "pending", "in_progress", "completed", "skipped", "failed"
    ] = "pending"
    requests_made: int = 0
    retries: int = 0
    cache_hits: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    skip_reason: str = ""


class QlooProgress(BaseModel):
    campaign_id: str
    total_requests: int = 0
    requests_by_step: dict[str, int] = Field(default_factory=dict)
    retries: int = 0
    cache_hits: int = 0
    steps: list[QlooStepProgress] = Field(default_factory=list)
    overall_status: Literal[
        "pending", "in_progress", "completed", "failed"
    ] = "pending"
    current_step: int = 0
    attribution: str = "Qloo Insights — taste/cultural signals only"
