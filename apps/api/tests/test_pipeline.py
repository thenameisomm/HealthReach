"""Backend tests: evidence-to-plan pipeline + honesty invariants."""

import json

import httpx
import pytest

from app.models import CampaignBrief, EvidenceSnapshot, Objective, Provenance
from app.routers.api import _apply_llm, _regenerate_section, _scale_amounts
from app.services import demo_data, llm_client
from app.services.llm_client import LlmPlan
from app.services.planner import build_plan
from app.services.qloo_client import _QLOO_CACHE
from app.services.qloo_progress import QlooProgressTracker


@pytest.fixture(autouse=True)
def _clear_qloo_cache():
    """The cache is process-wide production behaviour; isolate tests."""
    _QLOO_CACHE.clear()
    yield
    _QLOO_CACHE.clear()


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


def _llm_plan(**overrides) -> LlmPlan:
    base = {
        "summary": "A grounded draft.",
        "activities": [
            {"title": "Desk", "channel": "Camp", "why": "Evidence-based.", "evidence_refs": [], "cost_inr": 5000},
            {"title": "Posters", "channel": "Print", "why": "Evidence-based.", "evidence_refs": [], "cost_inr": 3000},
        ],
        "venues": [
            {"name": "Invented Palace", "reason": "Not in evidence.", "evidence_refs": []},
        ],
        "budget": [
            {"label": "Venue", "amount_inr": 1},
            {"label": "Outreach", "amount_inr": 1},
        ],
        "materials": [
            {"kind": "poster", "title": "P", "body": "B"},
            {"kind": "message", "title": "M", "body": "B"},
        ],
        "metrics": [
            {"name": "Registrations", "target_range": "1-2", "basis": "guess"},
            {"name": "Attendance", "target_range": "1-2", "basis": "guess"},
        ],
        "assumptions": [],
    }
    base.update(overrides)
    return LlmPlan.model_validate(base)


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


def test_scale_amounts_rounding_is_exact():
    assert _scale_amounts([1, 1, 1], 10_000) == [3333, 3333, 3334]
    assert _scale_amounts([0, 0], 10_000) == [10_000, 0]
    assert _scale_amounts([5], 0) == [0]
    assert _scale_amounts([], 10_000) == []
    assert all(a >= 0 for a in _scale_amounts([3, 0, 7], 2))
    assert sum(_scale_amounts([3, 0, 7], 999)) == 999


def test_apply_llm_budget_forced_exact_and_activities_consistent():
    ev = EvidenceSnapshot(campaign_id="t5")
    base = build_plan("t5", _brief(), ev)
    plan = _apply_llm(base, _llm_plan(), 10_000, ev)
    assert plan is not None
    assert sum(b.amount_inr for b in plan.budget) == 10_000
    assert sum(a.cost_inr for a in plan.activities) == 10_000
    assert all(b.amount_inr >= 0 for b in plan.budget)


def test_apply_llm_grounds_venues_and_refs_in_evidence():
    ev = EvidenceSnapshot(campaign_id="t6")
    base = build_plan("t6", _brief(), ev)
    llm = _llm_plan(
        venues=[
            {"name": "Invented Palace", "reason": "x", "evidence_refs": ["qloo:Made Up"]}
        ],
        activities=[
            {"title": "A", "channel": "C", "why": "w", "evidence_refs": ["qloo:Made Up", "user:brief"], "cost_inr": 1},
            {"title": "B", "channel": "C", "why": "w", "evidence_refs": [], "cost_inr": 1},
        ],
    )
    plan = _apply_llm(base, llm, 10_000, ev)
    assert plan is not None
    # Invented venue is dropped; the evidence-based fallback list is kept.
    assert all(v.name != "Invented Palace" for v in plan.venues)
    assert plan.venues[0].name == base.venues[0].name
    # Made-up refs are dropped; user:brief is allowed.
    assert plan.activities[0].evidence_refs == ["user:brief"]


def test_apply_llm_keeps_matching_evidence_venue():
    ev = demo_data.demo_evidence("t7")
    base = build_plan("t7", _brief(), ev)
    known = ev.geo_venues[0].name
    llm = _llm_plan(
        venues=[{"name": known, "reason": "Grounded.", "evidence_refs": [f"geo:{known}"]}]
    )
    plan = _apply_llm(base, llm, 10_000, ev)
    assert plan is not None
    assert plan.venues[0].name == known
    assert plan.venues[0].evidence_refs == [f"geo:{known}"]
    assert plan.planner == "ai-model"


def test_regenerated_activities_keep_real_evidence_refs():
    ev = demo_data.demo_evidence("t8")
    plan = build_plan("t8", _brief(), ev)
    regen = _regenerate_section(plan, "activities", _brief(), ev)
    refs = [r for a in regen.activities for r in a.evidence_refs]
    assert any(r.startswith(("qloo:", "geo:")) for r in refs)


class _FakeSettings:
    llm_configured = True
    LLM_MODEL = "test-model"
    LLM_BASE_URL = "https://example.invalid/v1"
    LLM_API_KEY = "test-key"


async def test_llm_disabled_returns_none(monkeypatch):
    class _Off:
        llm_configured = False

    monkeypatch.setattr(llm_client, "get_settings", lambda: _Off())
    assert await llm_client.try_llm_plan({}) is None


async def test_llm_repair_attempt_includes_invalid_reply(monkeypatch):
    monkeypatch.setattr(llm_client, "get_settings", lambda: _FakeSettings())
    calls: list[dict] = []

    async def fake_post(body, timeout):
        calls.append(body)
        if len(calls) == 1:
            return "sorry, no JSON here"
        return json.dumps(_llm_plan().model_dump())

    monkeypatch.setattr(llm_client, "_post_chat", fake_post)
    plan = await llm_client.try_llm_plan({"brief": {}})
    assert plan is not None and plan.summary == "A grounded draft."
    assert len(calls) == 2
    # The repair conversation shows the model its own invalid reply.
    assert calls[1]["messages"][-2]["content"] == "sorry, no JSON here"


async def test_llm_two_bad_replies_return_none(monkeypatch):
    monkeypatch.setattr(llm_client, "get_settings", lambda: _FakeSettings())

    async def fake_post(body, timeout):
        return "still not json"

    monkeypatch.setattr(llm_client, "_post_chat", fake_post)
    assert await llm_client.try_llm_plan({}) is None


async def test_llm_network_error_skips_straight_to_fallback(monkeypatch):
    monkeypatch.setattr(llm_client, "get_settings", lambda: _FakeSettings())

    async def fake_post(body, timeout):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(llm_client, "_post_chat", fake_post)
    assert await llm_client.try_llm_plan({}) is None


def _place(name: str, eid: str) -> dict:
    return {
        "entity_id": eid,
        "name": name,
        "affinity": 0.6,
        "popularity": 0.5,
        "tags": [{"name": "wellness"}],
    }


def _qloo_settings():
    import types

    return types.SimpleNamespace(
        QLOO_API_KEY="k", QLOO_BASE_URL="http://mock", qloo_configured=True
    )


async def test_qloo_chain_runs_linked_calls(monkeypatch):
    from app.services import qloo_client as qc

    monkeypatch.setattr(qc, "get_settings", lambda: _qloo_settings())
    calls = []

    async def fake_get(path, params):
        calls.append(dict(params))
        if params.get("filter.type") == "urn:entity:place":
            return {"results": {"entities": [_place("Golden Cafe", "e1"), _place("City Park", "e2")]}}
        if params.get("filter.type") == "urn:tag":
            return {"results": {"tags": [{"name": "wellness", "affinity": 0.5}]}}
        raise AssertionError("unexpected call")

    monkeypatch.setattr(qc, "_get", fake_get)
    signals, steps, status, note = await qc.fetch_cultural_signals(
        "Kothrud, Pune", 18.5, 73.8, "Free diabetes screening camp"
    )
    assert status == "ok"
    assert len(steps) == 3 and all(s.status == "ok" for s in steps)
    # The chain: tag lookups are fed by the place lookup's own entity ids.
    tag_calls = [p for p in calls if p.get("filter.type") == "urn:tag"]
    assert tag_calls[0]["signal.interests.entities"] == "e1"
    assert tag_calls[1]["signal.interests.entities"] == "e2"
    assert any(s.kind == "tag-affinity" for s in signals)
    assert steps[1].found and steps[2].found


async def test_qloo_chain_skips_honestly_when_places_empty(monkeypatch):
    from app.services import qloo_client as qc

    monkeypatch.setattr(qc, "get_settings", lambda: _qloo_settings())

    async def fake_get(path, params):
        return {"results": {"entities": []}}

    monkeypatch.setattr(qc, "_get", fake_get)
    signals, steps, status, note = await qc.fetch_cultural_signals(
        "Kothrud, Pune", None, None, "Free diabetes screening camp"
    )
    assert status == "thin"
    assert [s.status for s in steps] == ["ok", "skip", "skip"]
    assert "nothing to start from" in steps[1].skip_reason
    # Exception class names never surface in user-facing text.
    for s in steps:
        assert "Error" not in s.skip_reason and "Exception" not in s.skip_reason


async def test_qloo_chain_records_failed_double_check(monkeypatch):
    from app.services import qloo_client as qc

    monkeypatch.setattr(qc, "get_settings", lambda: _qloo_settings())

    async def fake_get(path, params):
        if params.get("filter.type") == "urn:entity:place":
            return {"results": {"entities": [_place("Golden Cafe", "e1"), _place("City Park", "e2")]}}
        raise httpx.ConnectTimeout("down")

    monkeypatch.setattr(qc, "_get", fake_get)
    signals, steps, status, note = await qc.fetch_cultural_signals(
        "Kothrud, Pune", 18.5, 73.8, "Free diabetes screening camp"
    )
    # Places still yield signals, but the failed chained tag steps are recorded.
    assert status == "ok"
    assert [s.status for s in steps] == ["ok", "skip", "skip"]
    assert steps[1].skip_reason == "This lookup had trouble just now."


def test_demo_chain_steps_illustrative():
    ev = demo_data.demo_evidence("demo3")
    assert len(ev.qloo_steps) == 3
    assert all(s.provenance == Provenance.ILLUSTRATIVE for s in ev.qloo_steps)


def test_us_brief_and_plan_use_usd_exactly():
    brief = CampaignBrief(
        topic="Free diabetes screening camp",
        location_text="East Austin, Austin, TX",
        audience_age_min=30,
        audience_age_max=65,
        audience_notes="Spanish-speaking families",
        budget_usd=5_000,
        duration_days=7,
        objective=Objective.SCREENING,
    )
    assert brief.currency.value == "USD"
    plan = build_plan("us1", brief, demo_data.demo_evidence("us1", "us"))
    assert plan.currency.value == "USD"
    assert plan.budget_total_usd == 5_000
    assert plan.budget_total_inr is None
    assert sum(b.amount_usd for b in plan.budget) == 5_000
    assert all(a.cost_usd is not None and a.cost_inr is None for a in plan.activities)


def test_us_demo_is_distinct_and_illustrative():
    us = demo_data.demo_evidence("us2", "us")
    in_ = demo_data.demo_evidence("in2", "kothrud")
    assert us.geo_venues[0].name != in_.geo_venues[0].name
    assert all(v.provenance == Provenance.ILLUSTRATIVE for v in us.geo_venues)
    assert demo_data.US_BRIEF.budget_usd == 5_000
    assert demo_data.KOTHRUD_BRIEF.budget_inr == 10_000


def test_qloo_progress_tracker_counts_requests_retries_and_cache():
    tracker = QlooProgressTracker("c1")
    tracker.begin()
    tracker.begin_step(1, "first")
    tracker.record_request(1)
    tracker.record_request(1, retry=True)
    tracker.record_request(1, cached=True)
    tracker.complete_step(1)
    tracker.skip_step(2, "no places to ask about")
    tracker.begin_step(3, "third")
    tracker.record_request(3)
    tracker.fail_step(3, "provider timed out")
    tracker.finish("failed")
    snap = tracker.snapshot()
    assert snap.total_requests == 3
    assert snap.retries == 1
    assert snap.cache_hits == 1
    assert snap.requests_by_step == {"1": 2, "3": 1}
    assert [s.status for s in snap.steps] == ["completed", "skipped", "failed"]
    assert snap.overall_status == "failed"


def test_us_venue_categories_and_distance_helper():
    from app.services import geo_client

    categories = {v.category for v in demo_data.US_VENUES}
    assert {"community_centre", "library", "park"} <= categories
    assert any("health" in c for c in categories)
    meters = geo_client.distance_m(30.25, -97.7167, 30.2520, -97.7150)
    assert 0 < meters < 1000
