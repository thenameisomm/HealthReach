# Routes & Workspace — HealthReach AI

## Route Overview

HealthReach has exactly **four routes** — no dashboards, settings, accounts, or admin sections.

| Route | Path | Purpose | Key Components |
|---|---|---|---|
| Landing | `/` | First impression, trust, entry points | Hero, value props, sources, ground rules, CTA |
| Brief | `/new` | Guided campaign brief creation | LocationAutocomplete, ClickMap, form with inline guidance |
| Campaign List | `/campaigns` | Revisit campaigns, see next step | CampaignCard, next-step badges, empty state |
| Workspace | `/campaigns/[id]` | Full campaign lifecycle | Phase-driven sections: brief → evidence → plan → results |

---

## Route Details

### 1. Landing (`/`)

**File**: `apps/web/app/page.tsx`

**Sections**:
1. **Hero**: "Plan a health camp people will actually attend" + dot-grid motif (`aria-hidden`)
2. **What you get**: 4 output cards (Evidence, Plan, Materials, Analysis)
3. **How it works**: 4 steps (Brief → Evidence → Plan → Results)
4. **Sources explained**: Qloo (cultural signals) + OSM (venues) in plain language
5. **Ground rules**: Cultural relevance ≠ trust, venues need verification, estimates labeled
6. **CTAs**: "Start a campaign" plus two demo buttons — East Austin, TX
   (default/USD) and Kothrud, Pune (INR)

**Responsive**: Stacks on mobile, side-by-side on desktop.

---

### 2. Brief Form (`/new`)

**File**: `apps/web/app/new/page.tsx`

**Query Parameters**:
- `?from=<campaignId>` — Copy brief from an existing campaign
- Demo campaigns are created from the landing-page buttons (no query flag)

**Form Fields**:

| Field | Type | Validation | "Why" Hint |
|---|---|---|---|
| Topic | Text | 3-120 chars, required | "What health topic is this camp about?" |
| Location | Autocomplete + Map | Required, resolved coords | "Where will the camp happen?" |
| Audience Age Min | Number | 0-120, ≤ max | "Youngest age group you want to reach" |
| Audience Age Max | Number | 0-120, ≥ min | "Oldest age group you want to reach" |
| Audience Notes | Textarea | 0-500 chars, optional | "Anything else about who should come?" |
| Budget + currency | Number + select | $500-$10M; USD default, INR supported | "Total budget for this campaign" |
| Duration | Number | 1-90 days, required | "How many days will the camp run?" |
| Objective | Select | Required (awareness/attendance/screening/vaccination) | "What's the main goal?" |

**Location Picking**:
- **LocationAutocomplete**: Debounced (300ms) Nominatim suggest, US-biased, 120-char cap
- **ClickMap**: Click map → reverse geocode → fills text field (field = source of truth)
- **Sync**: Selected location populates both components; text field stays authoritative

**Error Handling**:
- Inline field errors (clear on edit)
- Input preserved on network errors
- Friendly error messages via `friendlyError()`

**Submit**: `POST /api/campaigns` → redirects to `/campaigns/[id]`

---

### 3. Campaign List (`/campaigns`)

**File**: `apps/web/app/campaigns/page.tsx`

**Features**:
- List all campaigns (newest first)
- Per-campaign card:
  - Topic, location, date
  - Mode badge: "Real" | "Demo"
  - **Next-step badge**: "Step 2 of 4 — review local information"
- Click card → `/campaigns/[id]` (resumes at current phase)
- Empty state: "No campaigns yet — start your first one" + CTA to `/new`

**Stage Filter** (additive):
- `?stage=brief` — Campaigns at brief phase
- `?stage=info` — Campaigns at evidence phase
- `?stage=plan` — Campaigns at plan phase
- `?stage=results` — Campaigns at results phase

---

### 4. Workspace (`/campaigns/[id]`)

**File**: `apps/web/app/campaigns/[id]/page.tsx`

**Single-page, phase-driven layout** with four staged sections.

#### Phase State Machine

```
Phase = 'loading' | 'brief' | 'evidence-loading' | 'evidence' | 'plan-loading' | 'ready'
```

| Phase | Trigger | Sections Rendered |
|---|---|---|
| `loading` | Initial fetch | Skeleton |
| `brief` | Campaign loaded, no evidence | BriefRecap |
| `evidence-loading` | POST /evidence sent | BriefRecap + ProgressStatus |
| `evidence` | Evidence response | BriefRecap + EvidenceSection + CTA |
| `plan-loading` | POST /plan sent | BriefRecap + EvidenceSection (collapsed) + ProgressStatus |
| `ready` | Plan response | All sections: BriefRecap → EvidenceSection → PlanSection → ResultsSection |

#### Section Details

##### BriefRecap (Always Visible)
- Campaign topic, location, audience, budget, duration, objective
- Mode badge (Real/Demo)
- Edit link → `/new?from=<id>`

##### SourceLegend (Evidence & Plan Phases)
Provenance chips with icon + label + border:
- ◈ Qloo signal — taste affinity, never medical fact
- ◎ Verified place data — OSM, © OpenStreetMap contributors
- ✦ AI interpretation — estimate/draft, inspect and approve
- ● You provided — organizer input
- ◇ Illustrative data — dashed border, demo samples only

##### EvidenceSection (Evidence & Ready Phases)

**Local Information**:
- Familiarity hints (plain language): "Moderate match — could mean people here respond well to community-gathering formats"
- Technical details toggle: Raw Qloo signals (affinity, popularity, tags, entity IDs)
- Qloo chain steps (1-3): Title, asked, found, next, status (ok/skip), skip reason

**Places to Verify**:
- MapView (Leaflet, OSM tiles, attribution)
- Venue list below map (**required text alternative**):
  - Name, category, address, distance
  - "Visit and verify before use" badge
  - Provenance: geo

##### PlanSection (Ready Phase)

**Draft Plan**:
- Activities: Title, channel, why, evidence refs, cost, provenance
- Venue candidates: Name, reason, evidence refs, status, needs_verification
- Budget: Line items + exact total = brief budget
- Draft materials: Poster, message, script + review notice
- Success metrics: Name, target range, basis, provenance
- Assumptions & limitations

**Pre-use Checklist**:
- [ ] Visit and verify all venues
- [ ] Review all materials with qualified professional
- [ ] Confirm budget availability
- [ ] Recruit volunteers/staff

**How This Draft Was Made**:
- Planner: "AI model" | "Standard template"
- Evidence summary: "Based on Qloo signals (3 steps) + 5 OSM venues"

**Section Regeneration**:
- "Get fresh ideas" button per section (Activities, Venues, Budget, Materials, Metrics)
- `POST /api/campaigns/{id}/plan {section}` → new version (version++)
- Shows loading, replaces section on response

##### ResultsSection (Ready Phase — After Plan)

**Results Entry** (if no results):
- Aggregate counts only: Registrations, Attendance, Spend, Engagement
- Optional notes
- "Save results" → `POST /api/campaigns/{id}/results`

**Analytics** (if results exist):
- Planned vs Actual table
- Cost per registration
- Attendance rate
- "Descriptive, not causal" notice
- Null-safe: "Not calculable — needs at least 1 registration"

---

## Navigation & Deep Linking

### Direct Access Patterns

| URL | Behavior |
|---|---|
| `/campaigns/abc123` | Resumes at current phase |
| `/campaigns/abc123?section=plan` | Scrolls to plan section (planned) |
| `/new?from=abc123` | Copies brief from campaign abc123 |

### Browser History
- Standard pushState navigation
- Back button works correctly
- Refresh preserves phase (server-rendered)

---

## Loading & Error States

### Per-Phase Loading

| Phase | Component | Message |
|---|---|---|
| Campaign fetch | `Skeleton` | Animated placeholders |
| Evidence gathering | `ProgressStatus` | Qloo call counter + step progress |
| Plan generation | `ProgressStatus` | "Building your outreach plan..." |
| Section regen | Inline spinner | "Getting fresh ideas for [section]..." |
| Results save | Button spinner | "Saving results..." |

### Error States

| Error | UI | Recovery |
|---|---|---|
| Campaign not found | `ErrorState` + link to `/campaigns` | Navigate away |
| Evidence failed | Inline banner in EvidenceSection | "Try again" button |
| Plan failed | Inline banner in PlanSection | "Try again" button |
| Network offline | Persistent banner | Auto-retry when online |
| Validation error | Inline field messages | Edit field to clear |

---

## Accessibility Per Route

| Route | Key Requirements |
|---|---|
| `/` | Semantic headings, alt text for hero, keyboard CTA focus |
| `/new` | Combobox ARIA, map decorative (`aria-hidden`), list alternative, field labels |
| `/campaigns` | List semantics, button cards, next-step badge as text |
| `/campaigns/[id]` | Section headings, phase as `aria-live`, map+list, provenance badges |

---

## Data Flow Per Route

```
Landing (/)
  └─ Static content, no API calls

Brief (/new)
  ├─ GET /api/geo/suggest?q= (debounced, autocomplete)
  ├─ GET /api/geo/reverse?lat=&lon= (map click)
  └─ POST /api/campaigns (submit)

Campaign List (/campaigns)
  └─ GET /api/campaigns?stage= (list with filter)

Workspace (/campaigns/[id])
  ├─ GET /api/campaigns/{id} (initial load: campaign + plan + evidence + results)
  ├─ POST /api/campaigns/{id}/evidence (evidence gathering)
  ├─ POST /api/campaigns/{id}/plan (plan generation)
  ├─ POST /api/campaigns/{id}/plan {section} (section regen)
  ├─ POST /api/campaigns/{id}/results (results entry)
  └─ GET /api/campaigns/{id}/analytics (analytics)
```

---

## Responsive Breakpoints

| Breakpoint | Layout Changes |
|---|---|
| < 640px (mobile) | Single column, stacked sections, bottom nav |
| 640px - 1023px (tablet) | Two-column where appropriate |
| ≥ 1024px (desktop) | Full layout, side-by-side hero, max-width 1200px |

---

*Related: [Frontend Architecture](FRONTEND_ARCHITECTURE.md) · [Design System](DESIGN_SYSTEM.md) · [API Contracts](../api/API_CONTRACTS.md)*