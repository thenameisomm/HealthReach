"""Route-level API tests: the five-stage flow, validation, honest states.

Runs against the app with the in-memory store (no lifespan startup), so no
MongoDB or network access is required.
"""

import httpx
import pytest

from app import db as db_module
from app import rate_limit
from app.main import app
from app.models import GeocodeResult

VALID_BRIEF = {
    "topic": "Free diabetes screening camp",
    "location_text": "Kothrud, Pune",
    "audience_age_min": 30,
    "audience_age_max": 60,
    "audience_notes": "",
    "budget_inr": 10_000,
    "duration_days": 7,
    "objective": "attendance",
}


@pytest.fixture(autouse=True)
def _fresh_store():
    for store in db_module._mem.values():
        store.clear()
    rate_limit._hits.clear()
    yield


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _demo_campaign(client, scenario="kothrud", brief=None) -> str:
    r = await client.post(
        "/api/campaigns",
        json={"brief": brief or VALID_BRIEF, "mode": "demo", "scenario": scenario},
    )
    assert r.status_code == 200
    return r.json()["id"]


async def test_demo_flow_end_to_end(client):
    cid = await _demo_campaign(client)

    ev = (await client.post(f"/api/campaigns/{cid}/evidence")).json()
    assert ev["qloo_status"] == "ok" and ev["geo_status"] == "ok"
    assert all(v["provenance"] == "illustrative" for v in ev["geo_venues"])

    plan = (await client.post(f"/api/campaigns/{cid}/plan", json={})).json()
    assert plan["planner"] == "standard-template"
    assert plan["budget_total_inr"] == 10_000
    assert sum(b["amount_inr"] for b in plan["budget"]) == 10_000
    assert all(a["provenance"] == "illustrative" for a in plan["activities"])

    r = await client.post(
        f"/api/campaigns/{cid}/results",
        json={
            "registrations": 214,
            "attendance": 156,
            "spend_inr": 9450,
            "engagement": 380,
            "notes": "",
        },
    )
    assert r.status_code == 200

    a = (await client.get(f"/api/campaigns/{cid}/analytics")).json()
    assert a["hasResults"] is True
    assert a["analytics"]["cost_per_registration"] == 44.16
    assert a["analytics"]["attendance_rate"] == 0.729
    assert a["analytics"]["planned_registrations"] == "120–300 people"

    camps = (await client.get("/api/campaigns")).json()
    assert [c for c in camps if c["id"] == cid][0]["stage"] == "results"


async def test_analytics_null_safe_with_zero_registrations(client):
    cid = await _demo_campaign(client)
    await client.post(f"/api/campaigns/{cid}/evidence")
    await client.post(f"/api/campaigns/{cid}/plan", json={})
    await client.post(
        f"/api/campaigns/{cid}/results",
        json={
            "registrations": 0,
            "attendance": 0,
            "spend_inr": 1000,
            "engagement": 0,
            "notes": "",
        },
    )
    a = (await client.get(f"/api/campaigns/{cid}/analytics")).json()
    assert a["analytics"]["cost_per_registration"] is None
    assert a["analytics"]["attendance_rate"] is None


async def test_analytics_says_not_stated_when_plan_lacks_metrics(client):
    cid = await _demo_campaign(client)
    # Simulate an older/foreign plan without recognizable metric names.
    await db_module.save(
        "plans",
        {"id": f"{cid}_v1", "campaign_id": cid, "version": 1, "metrics": [], "budget_total_inr": 10_000},
        key="id",
    )
    await client.post(
        f"/api/campaigns/{cid}/results",
        json={
            "registrations": 10,
            "attendance": 5,
            "spend_inr": 100,
            "engagement": 0,
            "notes": "",
        },
    )
    a = (await client.get(f"/api/campaigns/{cid}/analytics")).json()
    assert a["analytics"]["planned_registrations"] == "Not stated in plan"
    assert a["analytics"]["planned_attendance"] == "Not stated in plan"


async def test_invalid_brief_and_results_rejected(client):
    r = await client.post(
        "/api/campaigns",
        json={"brief": {**VALID_BRIEF, "budget_inr": 100}, "mode": "real"},
    )
    assert r.status_code == 422
    r = await client.post(
        "/api/campaigns",
        json={"brief": {**VALID_BRIEF, "audience_age_min": 70, "audience_age_max": 40}, "mode": "real"},
    )
    # Backend bounds match the frontend: inconsistent ages are rejected.
    assert r.status_code == 422

    cid = await _demo_campaign(client)
    r = await client.post(
        f"/api/campaigns/{cid}/results",
        json={
            "registrations": -1,
            "attendance": 0,
            "spend_inr": 100,
            "engagement": 0,
            "notes": "",
        },
    )
    assert r.status_code == 422


async def test_plan_before_evidence_rejected_and_unknown_campaign_404(client):
    cid = await _demo_campaign(client)
    r = await client.post(f"/api/campaigns/{cid}/plan", json={})
    assert r.status_code == 400
    assert (await client.get("/api/campaigns/nope")).status_code == 404
    assert (await client.post("/api/campaigns/nope/evidence")).status_code == 404
    r = await client.post(
        "/api/campaigns/nope/results",
        json={
            "registrations": 1,
            "attendance": 1,
            "spend_inr": 1,
            "engagement": 1,
            "notes": "",
        },
    )
    assert r.status_code == 404


async def test_section_regeneration_bumps_version_and_keeps_budget(client):
    cid = await _demo_campaign(client)
    await client.post(f"/api/campaigns/{cid}/evidence")
    await client.post(f"/api/campaigns/{cid}/plan", json={})
    p2 = (await client.post(f"/api/campaigns/{cid}/plan", json={"section": "activities"})).json()
    assert p2["version"] == 2
    assert p2["planner"] == "standard-template"
    assert sum(b["amount_inr"] for b in p2["budget"]) == 10_000


async def test_evidence_reports_geo_unavailable_honestly(client, monkeypatch):
    async def fake_geocode(text):
        return GeocodeResult(display_name="Test Place", lat=18.5, lon=73.8)

    async def no_qloo(*args, **kwargs):
        raise RuntimeError("QLOO_API_KEY is not configured")

    async def failed_geo(lat, lon):
        return [], "unavailable", "The map directory didn't respond, so no nearby places could be listed."

    monkeypatch.setattr("app.routers.api.geocode", fake_geocode)
    monkeypatch.setattr("app.routers.api.fetch_cultural_signals", no_qloo)
    monkeypatch.setattr("app.routers.api.nearby_venues", failed_geo)

    r = await client.post("/api/campaigns", json={"brief": VALID_BRIEF, "mode": "real"})
    cid = r.json()["id"]
    ev = (await client.post(f"/api/campaigns/{cid}/evidence")).json()
    assert ev["qloo_status"] == "unavailable"
    assert "QLOO_API_KEY" in ev["qloo_note"]
    assert ev["geo_status"] == "unavailable"
    assert "didn't respond" in ev["geo_note"]


async def test_evidence_reports_geo_thin_when_few_venues(client, monkeypatch):
    async def fake_geocode(text):
        return GeocodeResult(display_name="Test Place", lat=18.5, lon=73.8)

    async def no_qloo(*args, **kwargs):
        raise RuntimeError("QLOO_API_KEY is not configured")

    async def empty_geo(lat, lon):
        return [], "thin", "Few mapped community venues in this radius."

    monkeypatch.setattr("app.routers.api.geocode", fake_geocode)
    monkeypatch.setattr("app.routers.api.fetch_cultural_signals", no_qloo)
    monkeypatch.setattr("app.routers.api.nearby_venues", empty_geo)

    r = await client.post("/api/campaigns", json={"brief": VALID_BRIEF, "mode": "real"})
    cid = r.json()["id"]
    ev = (await client.post(f"/api/campaigns/{cid}/evidence")).json()
    assert ev["geo_status"] == "thin"


async def test_geo_suggest_maps_nominatim(client, monkeypatch):
    import httpx as _httpx  # noqa: F401

    async def ok_suggest(q, limit=5):
        return [
            {"display_name": "Kothrud, Pune, India", "lat": 18.5, "lon": 73.8, "type": "residential"}
        ]

    monkeypatch.setattr("app.routers.api.suggest_locations", ok_suggest)
    r = await client.get("/api/geo/suggest", params={"q": "kothrud"})
    d = r.json()
    assert d["status"] == "ok" and d["suggestions"][0]["label"] == "Kothrud, Pune, India"
    assert "OpenStreetMap" in d["attribution"]


async def test_geo_suggest_unavailable_honest(client, monkeypatch):
    async def boom(q, limit=5):
        raise RuntimeError("nominatim down")

    monkeypatch.setattr("app.routers.api.suggest_locations", boom)
    r = await client.get("/api/geo/suggest", params={"q": "kothrud"})
    d = r.json()
    assert r.status_code == 200
    assert d["status"] == "unavailable" and d["suggestions"] == []
    assert "RuntimeError" not in d["note"]


async def test_geo_reverse_validates_and_maps(client, monkeypatch):
    async def ok_rev(lat, lon):
        return GeocodeResult(display_name="Paud Road, Kothrud", lat=lat, lon=lon)

    monkeypatch.setattr("app.routers.api.reverse_geocode", ok_rev)
    r = await client.get("/api/geo/reverse", params={"lat": 18.5, "lon": 73.8})
    assert r.json()["label"] == "Paud Road, Kothrud"
    assert "OpenStreetMap" in r.json()["attribution"]
    bad = await client.get("/api/geo/reverse", params={"lat": 999, "lon": 0})
    assert bad.status_code == 400


async def test_demo_evidence_chain_end_to_end(client):
    r = await client.post("/api/campaigns", json={"brief": VALID_BRIEF, "mode": "demo"})
    cid = r.json()["id"]
    ev = (await client.post(f"/api/campaigns/{cid}/evidence")).json()
    assert len(ev["qloo_steps"]) == 3
    assert all(s["provenance"] == "illustrative" for s in ev["qloo_steps"])


US_BRIEF = {
    "topic": "Free diabetes screening camp",
    "location_text": "East Austin, Austin, TX",
    "audience_age_min": 30,
    "audience_age_max": 65,
    "audience_notes": "Spanish-speaking families",
    "budget_usd": 5000,
    "currency": "USD",
    "duration_days": 7,
    "objective": "screening",
}


async def test_us_demo_currency_end_to_end(client):
    cid = await _demo_campaign(client, scenario="us", brief=US_BRIEF)
    camp = (await client.get(f"/api/campaigns/{cid}")).json()["campaign"]
    assert camp["demo_scenario"] == "us"
    assert camp["brief"]["currency"] == "USD"

    ev = (await client.post(f"/api/campaigns/{cid}/evidence")).json()
    assert ev["geo_venues"][0]["distance_m"] is not None
    plan = (await client.post(f"/api/campaigns/{cid}/plan", json={})).json()
    assert plan["currency"] == "USD"
    assert plan["budget_total_usd"] == 5000
    assert plan["budget_total_inr"] is None
    assert sum(b["amount_usd"] for b in plan["budget"]) == 5000

    await client.post(
        f"/api/campaigns/{cid}/results",
        json={
            "registrations": 180,
            "attendance": 135,
            "spend_usd": 4850,
            "engagement": 320,
            "notes": "",
        },
    )
    a = (await client.get(f"/api/campaigns/{cid}/analytics")).json()
    assert a["analytics"]["currency"] == "USD"
    assert a["analytics"]["planned_spend"] == 5000
    assert a["analytics"]["actual_spend"] == 4850
    assert a["analytics"]["cost_per_registration"] == 26.94
    assert a["analytics"]["cost_per_attendee"] == 35.93
    assert a["analytics"]["attendance_rate"] == 0.75


async def test_inr_campaign_rejects_usd_results(client):
    cid = await _demo_campaign(client)
    await client.post(f"/api/campaigns/{cid}/evidence")
    await client.post(f"/api/campaigns/{cid}/plan", json={})
    r = await client.post(
        f"/api/campaigns/{cid}/results",
        json={"registrations": 1, "attendance": 1, "spend_usd": 10, "engagement": 0, "notes": ""},
    )
    assert r.status_code == 400
    assert "INR" in r.text


async def test_evidence_progress_endpoint_is_backend_observed(client):
    cid = await _demo_campaign(client)
    await client.post(f"/api/campaigns/{cid}/evidence")
    p = (await client.get(f"/api/campaigns/{cid}/evidence/progress")).json()
    assert p["overall_status"] == "completed"
    assert p["total_requests"] == 3
    assert p["requests_by_step"] == {"1": 1, "2": 1, "3": 1}
    assert [s["status"] for s in p["steps"]] == ["completed", "completed", "completed"]
    assert p["steps"][0]["title"]
    assert p["campaign_id"] == cid


async def test_exports_csv_pdf_json_and_redaction(client):
    cid = await _demo_campaign(client, scenario="us", brief=US_BRIEF)
    await client.post(f"/api/campaigns/{cid}/evidence")
    await client.post(f"/api/campaigns/{cid}/plan", json={})
    await client.post(
        f"/api/campaigns/{cid}/results",
        json={
            "registrations": 180,
            "attendance": 135,
            "spend_usd": 4850,
            "engagement": 320,
            "notes": "Call 512-555-1212 or email organizer@example.com",
        },
    )

    csv_r = await client.get(f"/api/campaigns/{cid}/export/csv")
    assert csv_r.status_code == 200
    assert "text/csv" in csv_r.headers["content-type"]
    assert "attachment" in csv_r.headers["content-disposition"]
    assert "spend_usd" in csv_r.text
    assert "organizer@example.com" not in csv_r.text
    assert "512-555-1212" not in csv_r.text
    assert "[redacted email]" in csv_r.text

    pdf_r = await client.get(f"/api/campaigns/{cid}/export/pdf")
    assert pdf_r.status_code == 200
    assert pdf_r.headers["content-type"] == "application/pdf"
    assert pdf_r.content.startswith(b"%PDF-1.4")
    assert b"qualified health professional" in pdf_r.content
    assert b"East Austin" in pdf_r.content

    json_r = await client.get(f"/api/campaigns/{cid}/export/json")
    assert json_r.status_code == 200
    body = json_r.json()
    assert body["campaign"]["id"] == cid
    assert body["evidence"]["qloo_status"] == "ok"
    assert len(body["evidence"]["qloo_steps"]) == 3
    assert "api_key" not in json_r.text.lower()


async def test_exports_require_the_right_stage(client):
    cid = await _demo_campaign(client)
    assert (await client.get(f"/api/campaigns/{cid}/export/json")).status_code == 400
    assert (await client.get(f"/api/campaigns/{cid}/export/pdf")).status_code == 400
    csv_r = await client.get(f"/api/campaigns/{cid}/export/csv")
    assert csv_r.status_code == 200
    assert "0" in csv_r.text


async def test_plan_compare_endpoint(client):
    cid = await _demo_campaign(client)
    await client.post(f"/api/campaigns/{cid}/evidence")
    await client.post(f"/api/campaigns/{cid}/plan", json={})
    await client.post(f"/api/campaigns/{cid}/plan", json={"section": "activities"})
    r = await client.get(
        f"/api/campaigns/{cid}/plans/compare",
        params={"from_version": 1, "to_version": 2},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["from_version"] == 1 and body["to_version"] == 2
    assert isinstance(body["changed_sections"], list)
    assert set(body["changes"]) == set(body["changed_sections"])
    missing = await client.get(
        f"/api/campaigns/{cid}/plans/compare",
        params={"from_version": 1, "to_version": 9},
    )
    assert missing.status_code == 404


async def test_demo_scenario_selector(client):
    us = (await client.get("/api/demo/scenario", params={"scenario": "us"})).json()
    assert us["scenario"] == "us"
    assert us["brief"]["budget_usd"] == 5000
    assert us["brief"]["currency"] == "USD"
    assert "East Austin" in us["brief"]["location_text"]
    in_ = (await client.get("/api/demo/scenario", params={"scenario": "kothrud"})).json()
    assert in_["scenario"] == "kothrud"
    assert in_["brief"]["budget_inr"] == 10000
