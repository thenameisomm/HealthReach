# User Flows — HealthReach AI

## Flow 1: First-Time User — Demo Mode (Kothrud)

```
1. Landing (/)
   ├─ Hero: "Plan a health camp people will actually attend"
   ├─ What you get: 4 outputs (evidence, plan, materials, analysis)
   ├─ How it works: 4 steps (brief → evidence → plan → results)
   ├─ Sources explained: Qloo (cultural signals) + OSM (venues)
   ├─ Ground rules: cultural relevance ≠ trust, venues need verification
   └─ CTA: "See a working example" (demo mode)

2. Demo Brief Pre-filled (/new?mode=demo)
   ├─ Topic: "Free diabetes screening camp"
   ├─ Location: "Kothrud, Pune" (illustrative)
   ├─ Audience: ages 30–60
   ├─ Budget: ₹10,000
   ├─ Duration: 7 days
   ├─ Goal: "Bring people to a camp"
   └─ CTA: "Create outreach plan"

3. Evidence Loading (/campaigns/[id] — evidence-loading phase)
   ├─ Live Qloo call counter (step 1/3, 2/3, 3/3)
   ├─ Progress: place affinities → taste tags → cross-check
   ├─ OSM venue fetch in parallel
   └─ Auto-advance when complete

4. Evidence Review (/campaigns/[id] — evidence phase)
   ├─ Brief recap card
   ├─ Source legend (provenance chips)
   ├─ Local Information section
   │   ├─ Familiarity hints (plain language: "moderate match — could mean...")
   │   ├─ Technical details toggle (raw Qloo signals)
   │   └─ Qloo chain steps (1–3 with status, asked/found/next)
   ├─ Places to Verify section
   │   ├─ MapView (Leaflet, OSM tiles, attribution)
   │   └─ Venue list below map (required text alternative)
   │       ├─ Name, category, address, distance
   │       ├─ "Visit and verify before use" badge
   │       └─ Provenance: geo (OSM)
   └─ CTA: "Create outreach plan"

5. Plan Loading (/campaigns/[id] — plan-loading phase)
   ├─ Deterministic planner runs (or LLM attempt + fallback)
   └─ Auto-advance when complete

6. Plan Review (/campaigns/[id] — ready phase)
   ├─ Brief recap
   ├─ Draft Plan section
   │   ├─ Activities (title, channel, why, evidence refs, cost, provenance)
   │   ├─ Venue candidates (name, reason, evidence refs, status, needs_verification)
   │   ├─ Budget (line items + exact total = brief budget)
   │   ├─ Draft materials (poster, message, script — with review notice)
   │   ├─ Success metrics (name, target range, basis, provenance)
   │   ├─ Assumptions & limitations
   │   └─ "How this draft was made" line (planner: ai-model | standard-template)
   ├─ Pre-use checklist
   └─ Section regeneration: "Get fresh ideas" → new version

7. Results Entry (/campaigns/[id] — results phase)
   ├─ Aggregate counts only: registrations, attendance, spend, engagement
   ├─ Optional notes
   └─ CTA: "Save results"

8. Analytics (/campaigns/[id] — analytics phase)
   ├─ Planned-vs-actual table
   ├─ Cost per registration
   ├─ Attendance rate
   ├─ "Descriptive, not causal" notice
   └─ Null-safe: "Not calculable — needs at least 1 registration"
```

## Flow 2: Real Campaign — Organizer Creates New Campaign

```
1. Landing (/) → "Start a campaign"
2. Brief Form (/new)
   ├─ Topic (required, 3–120 chars, "Why this matters" hint)
   ├─ Location (required)
   │   ├─ LocationAutocomplete v2: debounced US-biased suggestions
   │   ├─ ClickMap v2: click map → reverse geocode → fills field
   │   ├─ Field stays source of truth; map always has text path
   │   └─ Max 120 chars, no re-query after selection
   ├─ Audience age range (min/max, validation min ≤ max)
   ├─ Audience notes (optional, 500 chars)
   ├─ Budget USD (required, $500–$10M, "Why this matters" hint)
   ├─ Duration days (required, 1–90)
   ├─ Objective (dropdown: awareness | attendance | screening | vaccination)
   └─ CTA: "Create outreach plan" → POST /api/campaigns

3. Evidence Loading → Evidence Review → Plan Loading → Plan Review
   (Same as demo but with live Qloo/OSM, real provenance chips)

4. Results Entry → Analytics
   (Same as demo)
```

## Flow 3: Returning Organizer — Campaign List

```
1. Landing (/) → "My campaigns" or /campaigns
2. Campaign List (/campaigns)
   ├─ Each card: topic, location, date, mode badge (real/demo)
   ├─ Next-step badge: "Step 2 of 4 — review local information"
   ├─ Click → /campaigns/[id] (resumes at current phase)
   └─ Empty state: "No campaigns yet — start your first one"
```

## Flow 4: Section Regeneration (Plan Refinement)

```
1. Plan Review (/campaigns/[id])
2. Click "Get fresh ideas" on any section (Activities, Venues, Budget, Materials, Metrics)
3. POST /api/campaigns/[id]/plan {section: "activities"}
4. New plan version created (version++)
5. Plan Review reloads with new version
6. Version history accessible (planned)
```

## Flow 5: Error/Edge Cases

| Scenario | Behavior |
|---|---|
| Qloo key missing/invalid | Evidence shows `unavailable`; plan flagged `has_cultural_signals: false`; retry offered |
| Qloo thin response | Evidence shows `thin`; plan notes limited signals; proceeds with geo + organizer input |
| OSM unavailable | Venue list shows `unavailable`; plan proceeds with activities/budget only |
| LLM fails (malformed/retry exhausted) | Falls back to deterministic template; `planner: standard-template` |
| Geocode fails | Inline field error; input preserved; retry on edit |
| Network offline | Friendly error banner; form input preserved; retry when online |
| Zero results (analytics) | "Not calculable — needs at least 1 registration" |

## State Machine (Campaign Workspace Phase)

```
loading
  ↓ (brief fetched)
brief
  ↓ (evidence requested)
evidence-loading
  ↓ (evidence fetched)
evidence
  ↓ (plan requested)
plan-loading
  ↓ (plan generated)
ready  ←──┐
          │ (section regen requested)
          └── plan-loading (version++)
```

---

*Related: [Product Brief](PRODUCT_BRIEF.md) · [Product Requirements](PRODUCT_REQUIREMENTS.md) · [Frontend Routes](frontend/ROUTES_AND_WORKSPACE.md)*