"""Backend tests: evidence-to-plan pipeline + honesty invariants."""

from app.models import CampaignBrief, EvidenceSnapshot, Objective, Provenance
from app.services import demo_data
from app.services.planner import build_plan


def _brief() -> CampaignBrief:
    return CampaignBrief(
        topic="Free diabetes screening camp",
        location_text="Kothrud, Pune",
        audience_age_min=30,
        audience_age_max=60,
        audience_notes="",
        budget_inr=10_000,
        duration_days=7,
        objective=Objective.ATTENDANCE,
    )


def test_budget_sums_exactly():
    ev = EvidenceSnapshot(campaign_id="t1")
    plan = build_plan("t1", _brief(), ev)
    assert sum(b.amount_inr for b in plan.budget) == 10_000
    assert plan.budget_total_inr == 10_000


def test_thin_evidence_flagged():
    ev = EvidenceSnapshot(campaign_id="t2", qloo_status="thin")
    plan = build_plan("t2", _brief(), ev)
    assert plan.has_cultural_signals is False
    assert any("No usable Qloo" in plan.summary for _ in [1])


def test_demo_module_isolated_and_tagged():
    ev = demo_data.demo_evidence("demo1")
    assert all(s.provenance == Provenance.ILLUSTRATIVE for s in ev.qloo_signals)
    assert all(v.provenance == Provenance.ILLUSTRATIVE for v in ev.geo_venues)
    plan = build_plan("demo1", demo_data.KOTHRUD_BRIEF, ev)
    tagged = demo_data.tag_plan_illustrative(plan)
    assert all(a.provenance == Provenance.ILLUSTRATIVE for a in tagged.activities)


def test_venues_need_verification():
    ev = demo_data.demo_evidence("demo2")
    plan = build_plan("demo2", _brief(), ev)
    assert all(v.needs_verification for v in plan.venues)
    assert all(v.status == "worth-evaluating" for v in plan.venues)


def test_materials_carry_review_notice():
    plan = build_plan("t3", _brief(), EvidenceSnapshot(campaign_id="t3"))
    assert all("qualified health professional" in m.review_notice for m in plan.materials)
    assert "not medical advice" in plan.materials[0].body.lower()


def test_deterministic_plan_labels_template_planner():
    plan = build_plan("t4", _brief(), EvidenceSnapshot(campaign_id="t4"))
    assert plan.planner == "standard-template"


def test_stage_for_ordering():
    from app.routers.api import stage_for

    assert stage_for(False, 0, False) == "brief"
    assert stage_for(True, 0, False) == "info"
    assert stage_for(True, 1, False) == "plan"
    assert stage_for(True, 2, True) == "results"
    # Results without a plan cannot happen through the UI; brief wins.
    assert stage_for(False, 0, True) == "brief"


def test_metric_range_lookup():
    from app.routers.api import _metric_range

    metrics = [
        {"name": "Registrations", "target_range": "120–300 people"},
        {"name": "Attendance", "target_range": "80–220 people"},
    ]
    assert _metric_range(metrics, "Attendance", "fallback") == "80–220 people"
    assert _metric_range(metrics, "Missing", "fallback") == "fallback"
    assert _metric_range([], "Attendance", "fallback") == "fallback"


def test_prose_has_no_machine_refs():
    ev = demo_data.demo_evidence("demo3")
    plan = build_plan("demo3", _brief(), ev)
    prose = " ".join([a.why for a in plan.activities] + [plan.summary])
    assert "qloo:" not in prose
    assert "geo:" not in prose
    # ...while evidence links keep machine-readable refs for traceability.
    assert any(r.startswith(("qloo:", "geo:")) for a in plan.activities for r in a.evidence_refs)
