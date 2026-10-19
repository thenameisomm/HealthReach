# Agent Orchestration — HealthReach AI

## Qloo 3-Step Agent Chain

The Qloo integration is orchestrated as a **deterministic 3-step agent chain** in `apps/api/app/services/qloo_client.py`. This is **backend-controlled code**, not an LLM agent with tool calling.

### Chain Overview

```
Step 1: Place Affinities
    │
    ├── Input: location_text, lat, lon, topic
    ├── Query: /v2/insights
    │   ├── filter.type = "urn:entity:place"
    │   ├── filter.location.query = location_text
    │   ├── filter.location.radius = 5000
    │   ├── feature.explainability = "true"
    │   └── filter.location = "lat,lon" (if available)
    │
    ├── Output: places[0..7] (entities with affinity, popularity, tags, entity_id)
    ├── Signals Generated: QlooSignal(kind="place-affinity", ...) per place
    ├── Step Recorded: QlooChainStep(step=1, title="Looked at culture spots near here", ...)
    │
    └── Seeds Step 2: top place's entity_id → signal.interests.entities

Step 2: Taste Tags from Top Place
    │
    ├── Input: top_place.entity_id, location_text
    ├── Query: /v2/insights
    │   ├── filter.type = "urn:tag"
    │   ├── signal.interests.entities = top_place.entity_id
    │   └── signal.location.query = location_text
    │
    ├── Output: tags[0..5] (tags with affinity)
    ├── Signals Generated: QlooSignal(kind="tag-affinity", ...) per tag
    ├── Step Recorded: QlooChainStep(step=2, title="Checked what fans of X also like", ...)
    │
    └── Seeds Step 3: second place's entity_id (if available)

Step 3: Cross-Check with Second Place
    │
    ├── Input: second_place.entity_id, location_text, tags_from_step_2
    ├── Query: /v2/insights (same as Step 2, different entity_id)
    │
    ├── Output: tags[0..5]
    ├── Overlap Analysis: tags_step_2 ∩ tags_step_3
    ├── Signals Generated: QlooSignal(kind="tag-affinity", ...) per tag
    ├── Step Recorded: QlooChainStep(step=3, title="Double-checked with Y", ...)
    │
    └── Final: aggregated signals + all steps returned
```

### Step Status Handling

| Status | When | UI Treatment |
|---|---|---|
| `ok` | Step completed, data returned | Show step card with found/next |
| `skip` | Step couldn't run (predecessor empty, key rejected, error) | Show step card with `skip_reason`, no invented data |
| (no `error` status) | Errors caught and converted to `skip` with plain-language reason | Never show technical errors to organizer |

### Skip Reasons (Honest, Plain Language)

- Step 1: "The Qloo key was rejected. A valid key is needed before this lookup can run — retrying will not help." / "This lookup had trouble just now."
- Step 2: "The first check didn't find places, so this had nothing to start from." / "A taste-tag lookup could not run: [reason]"
- Step 3: "A double-check needs a second place from step 1." / "The double-check lookup could not run: [reason]"

### Persistence

Every evidence gathering creates/updates an `EvidenceSnapshot`:
```python
EvidenceSnapshot(
    campaign_id: str,
    qloo_signals: list[QlooSignal],      # All signals from all steps
    qloo_steps: list[QlooChainStep],     # Full chain trace (additive)
    geo_venues: list[GeoVenue],
    qloo_status: "ok" | "thin" | "unavailable",
    qloo_note: str,                       # Provenance note
    geo_status: "ok" | "thin" | "unavailable",
    geo_note: str,
)
```

### QlooCallCounter Data Source

For the planned `QlooCallCounter` component, the backend exposes:
- Total provider requests made (including retries)
- Requests per step
- Cache hits vs live calls
- Step completion status

This comes from backend-observed activity, not frontend polling.

---

## LLM Contract — Grounded Prose Generation Only

The LLM is **never** an autonomous agent. It only generates structured prose for plan fields, grounded on persisted evidence.

### Architectural Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ qloo_client.fetch_cultural_signals()                │    │
│  │   → Returns: (signals, steps, status, note)         │    │
│  │   → Side effect: EvidenceSnapshot persisted         │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ planner.build_plan()                                │    │
│  │   ├── Deterministic template (always runs)          │    │
│  │   └── LLM attempt (if LLM_API_KEY configured)       │    │
│  │       ├── Prompt: brief + evidence → JSON           │    │
│  │       ├── Validation: Plan Pydantic model           │    │
│  │       ├── Repair: 1 retry on validation failure     │    │
│  │       └── Fallback: deterministic output used       │    │
│  │   → Plan.planner = "ai-model" | "standard-template" │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      LLM PROVIDER (External)                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ OpenAI-compatible endpoint                          │    │
│  │   - Receives: structured prompt with evidence       │    │
│  │   - Returns: JSON matching Plan schema              │    │
│  │   - Cannot call Qloo, OSM, or any other tool        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### LLM Prompt Structure

```
System: You are a health outreach planner. Generate a campaign plan
        as structured JSON. Use ONLY the provided evidence. Cite
        evidence IDs. Admit when evidence is insufficient.

User: Campaign Brief:
      - Topic: Free diabetes screening camp
      - Location: East Austin, TX (lat: 30.25, lon: -97.72)
      - Audience: Ages 30-60
      - Budget: $5,000
      - Duration: 7 days
      - Objective: screening

      Evidence:
      Qloo Signals:
      - place-affinity: "East Austin Community Center" (affinity: 0.72)
      - tag-affinity: "community gathering" (affinity: 0.65)
      - tag-affinity: "family activities" (affinity: 0.58)
      - tag-affinity: "local food" (affinity: 0.51)

      Qloo Chain Steps:
      1. Found 3 places near East Austin...
      2. Fans of East Austin Community Center also like: community gathering, family activities...
      3. Double-checked with East Austin Library: 2 overlapping tags (community gathering, family activities)

      OSM Venues:
      - East Austin Community Center (community_centre, 0.2 mi)
      - East Austin Library (library, 0.4 mi)
      - Walgreens Pharmacy (pharmacy, 0.6 mi)
      - Dell Children's Clinic (clinic, 0.8 mi)

      Generate: Plan JSON with activities, venues, budget, materials, metrics.
```

### LLM Output Validation

```python
# Pydantic Plan model validates:
- activities[].evidence_refs ⊆ evidence_snapshot.signal_ids
- budget sum == brief.budget_inr (exact)
- All required fields present
- No hallucinated venue names (must match geo_venues or be generic)
- Review notice included on all DraftMaterial
```

### Repair & Fallback

1. **First attempt**: LLM generates JSON
2. **Validation fails** (malformed JSON, missing fields, budget mismatch, invalid refs):
   - Log failure
   - One retry with "Fix the JSON to match schema exactly" appended
3. **Second attempt fails** or **LLM unavailable** (timeout, 4xx, 5xx, no key):
   - Use deterministic template planner output
   - `Plan.planner = "standard-template"`
4. **Success**:
   - `Plan.planner = "ai-model"`
   - Plan persisted with version

### Section Regeneration

- `POST /api/campaigns/{id}/plan {section: "activities"}`
- Always uses deterministic template planner (not LLM)
- Increments `Plan.version`
- Preserves other sections from previous version
- Updates `evidence_refs` to current evidence snapshot

---

## Planner Deterministic Template

The deterministic planner (`apps/api/app/services/planner.py`) is the **guaranteed fallback** and **always runs first**. LLM output only replaces it if validation passes.

### Template Logic

1. **Activities**: 3-5 items based on objective + evidence
   - Screening → "Set up screening stations", "Volunteer training", "Follow-up referrals"
   - Awareness → "Community info session", "Flyer distribution", "Social media posts"
   - Each has `evidence_refs` pointing to Qloo signal IDs or venue IDs

2. **Venues**: Top 3-5 from `geo_venues` with reasons
   - Reason template: "High foot traffic, community trust, [category] relevance"
   - Status: "worth-evaluating", `needs_verification: true`

3. **Budget**: Proportional allocation summing to exact brief budget
   - Categories: venue, materials, staff, refreshments, contingency
   - Exact total enforced by final line adjustment

4. **Materials**: Poster, Message (SMS/WhatsApp), Script (volunteer talking points)
   - All include: `review_notice: "Draft — requires review by a qualified health professional before use."`

5. **Metrics**: 3-4 metrics with target ranges
   - Registrations, Attendance, Cost per registration, Engagement
   - Basis: "Template estimate based on similar campaigns" or "Grounded on Qloo affinity + venue capacity"

---

*Related: [Qloo Integration](integrations/QLOO_INTEGRATION.md) · [LLM Contract](integrations/LLM_CONTRACT.md) · [Data Flow](DATA_FLOW.md)*