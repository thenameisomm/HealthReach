# Estimates & Metrics — HealthReach AI

## Purpose

This document defines how HealthReach calculates, labels, and communicates all estimates, metrics, and derived values. **Honesty boundary**: Every number must carry its basis and uncertainty — never present estimates as promises.

## Metric Categories

### 1. Plan Metrics (Forward-Looking Estimates)

Generated during plan creation, shown in Plan Review.

| Metric | Source | Basis | Label Format |
|---|---|---|---|
| Registrations | Planner (template/LLM) | "Template estimate based on similar campaigns" OR "Grounded on Qloo affinity + venue capacity" | `target_range: "150-200"` |
| Attendance | Planner | Same as above | `target_range: "100-150"` |
| Cost per registration | Derived | `budget_total / target_registrations_midpoint` | `"$25-33 per registration"` |
| Engagement | Planner | "Template estimate" | `target_range: "300-400"` |

**UI Rendering**:
- Shows as range (never single number)
- Provenance badge: AI
- Basis text visible on hover/expand
- "Estimate" prefix in label

### 2. Actual Metrics (Organizer-Entered)

Entered after campaign via Results form.

| Metric | Input Field | Validation |
|---|---|---|
| Registrations | `registrations` | Integer ≥ 0 |
| Attendance | `attendance` | Integer ≥ 0, ≤ registrations |
| Spend | `spend_usd` | Float ≥ 0 (planned: USD) |
| Engagement | `engagement` | Integer ≥ 0 |

**UI Rendering**:
- Provenance badge: USER
- No basis needed (direct observation)

### 3. Analytics Metrics (Derived Comparisons)

Computed in `GET /api/campaigns/{id}/analytics`.

| Metric | Formula | Null Condition |
|---|---|---|
| Cost per registration | `actual_spend / actual_registrations` | `actual_registrations == 0` |
| Attendance rate | `actual_attendance / actual_registrations` | `actual_registrations == 0` |
| Registration variance | `actual_registrations - planned_midpoint` | Never null |
| Attendance variance | `actual_attendance - planned_midpoint` | Never null |

**Null Safety**: When denominator is zero:
```python
cost_per_registration = None
attendance_rate = None
note = "Not calculable — needs at least 1 registration"
```

**UI Rendering**:
- Shows "Not calculable — needs at least 1 registration" (not "N/A" or "0")
- Descriptive note always included
- Provenance: derived (no badge, but note explains)

---

## Reach Estimates

### What They Are
- **Not** attendance predictions
- **Not** footfall estimates
- **Are**: AI/template estimates of how many people *might* be reached based on:
  - Qloo cultural affinity signals (familiarity with messaging)
  - Venue capacity (OSM venue size proxies)
  - Duration and frequency of activities
  - Organizer budget allocation

### Calculation (Template Planner)
```
base_reach = venue_capacity_estimate * activity_frequency * duration_factor
cultural_multiplier = 1.0 + (avg_qloo_affinity * 0.3)  # 0.85 to 1.3
reach_estimate = base_reach * cultural_multiplier
range = reach_estimate ± 25%
```

### Calculation (LLM Planner)
- LLM proposes range based on evidence
- Validated: must include basis statement
- Fallback: template calculation

### Labeling Requirements
| Display | Required Text |
|---|---|
| Primary label | "Estimated reach: 200-350 people" |
| Basis tooltip | "Based on: Qloo community gathering affinity (0.65), 2 venues (est. 150 capacity), 7 days" |
| Provenance | AI badge |
| Disclaimer | "Estimate only. Actual reach depends on many factors not modeled here." |

---

## Cultural Affinity Metrics

### Qloo Affinity Score
- Range: -1.0 to 1.0
- Meaning: Taste alignment (negative = disaffinity)
- Source: `QlooSignal.affinity`
- Label: "Cultural affinity: 0.65 (moderate match)"

### Qloo Popularity Score
- Range: 0.0 to 1.0
- Meaning: General popularity in area
- Source: `QlooSignal.popularity`
- Label: "Local popularity: 0.72"

### Tag Affinity
- Range: -1.0 to 1.0
- Meaning: Affinity for specific taste tag
- Source: `QlooSignal.affinity` (for tag-affinity kind)
- Label: "Community gathering: 0.68"

### Chain Step Status
- Step 1: Place affinities found (count)
- Step 2: Tags from top place (count, examples)
- Step 3: Cross-check overlap (count, examples or "mixed")
- Overall: `ok` | `thin` | `unavailable`

---

## Budget Metrics

### Plan Budget
- **Exact total**: Sum of budget lines = brief budget (enforced)
- **Line items**: Venue, Materials, Staff, Refreshments, Contingency
- **Provenance**: AI (template or LLM)
- **Currency**: INR (current) → USD (planned)

### Actual Spend
- Organizer-entered: `spend_usd`
- May differ from plan (over/under)
- Analytics shows variance

### Cost Efficiency Metrics
| Metric | Formula | Label |
|---|---|---|
| Cost per registration (planned) | `budget_total / planned_reg_midpoint` | "Planned: $25-33 per registration" |
| Cost per registration (actual) | `actual_spend / actual_registrations` | "Actual: $26.94 per registration" |
| Budget variance | `actual_spend - budget_total` | "Under budget by $150" / "Over budget by $200" |

---

## Venue Metrics

### Venue Capacity (Estimate)
- **Not** from OSM (no capacity data)
- **Proxy**: Venue category → default capacity
  - `community_centre`: 150
  - `library`: 80
  - `school`: 200
  - `park`: 300 (open space)
  - `pharmacy`: 30
  - `clinic`: 50
- **Label**: "Estimated capacity: ~150 (community center proxy)"

### Distance
- Computed: Haversine from campaign center to venue
- Display: Miles (1 decimal) — planned US focus
- Current: Meters (integer)

### Verification Status
- All venues: `needs_verification: true`
- Status options: `worth-evaluating` | `verified` | `rejected`
- Default: `worth-evaluating`
- UI: "Visit and verify before use" badge

---

## Null & Missing Data Handling

### Planned Metrics Missing
- If Qloo unavailable: `has_cultural_signals: false`
- Plan notes: "This plan was created without cultural signals"
- Metrics use template-only basis

### Actual Metrics Missing
- Results not entered: Analytics shows "No results entered yet"
- Partial results: Only entered fields computed

### Analytics Null Conditions
```python
# In analytics computation
if actual_registrations == 0:
    cost_per_registration = None
    attendance_rate = None
    note = "Not calculable — needs at least 1 registration"
else:
    cost_per_registration = actual_spend / actual_registrations
    attendance_rate = actual_attendance / actual_registrations
```

---

## Export Formats

### CSV (Results Export)
```csv
campaign_id,topic,location,date,registrations,attendance,spend_usd,engagement,cost_per_registration,attendance_rate,notes
cam_abc123,"Diabetes Screening","East Austin, TX","2026-10-27",180,135,4850,320,26.94,0.75,"Rain on day 2"
```

### PDF (Plan Export)
- Includes all plan sections
- Provenance badges rendered as text labels
- Estimates clearly labeled with basis
- "Draft — requires review" on all materials

### JSON (Evidence Snapshot Export)
```json
{
  "campaign_id": "cam_abc123",
  "evidence": {
    "qloo_signals": [...],
    "qloo_steps": [...],
    "geo_venues": [...],
    "qloo_status": "ok",
    "geo_status": "ok"
  },
  "exported_at": "2026-10-20T15:30:00Z",
  "provenance": "mixed"
}
```

---

## Honest Communication Checklist

For every number displayed:

- [ ] Is it an estimate or actual? (Labeled)
- [ ] Is the basis stated? (Tooltip or inline)
- [ ] Is the provenance shown? (Badge)
- [ ] Is uncertainty communicated? (Range, not point)
- [ ] Are null states handled? ("Not calculable — needs...")
- [ ] Is causal language avoided? ("Descriptive, not causal")

### Forbidden Patterns
| Forbidden | Required Alternative |
|---|---|
| "Will reach 200 people" | "Estimated reach: 150-250 people" |
| "Cost per person: $25" | "Planned cost per registration: $20-30" |
| "Venue capacity: 200" | "Estimated capacity: ~200 (community center proxy)" |
| "Plan caused 75% attendance" | "Attendance rate: 75% (descriptive, not causal)" |
| "High trust venue" | "Community center — visit and verify before use" |

---

*Related: [Data Model](DATA_MODEL.md) · [Provenance Model](PROVENANCE_MODEL.md) · [Analytics API](api/API_CONTRACTS.md)*