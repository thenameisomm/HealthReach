# Frontend Architecture — HealthReach AI

## Overview

The HealthReach frontend is a **Next.js 14 App Router** application with React 18, strict TypeScript, and Tailwind CSS 3. It follows a **four-route architecture** with a phase-based campaign workspace.

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 14 (App Router) |
| UI Library | React | 18 |
| Language | TypeScript | 5.x (strict) |
| Styling | Tailwind CSS | 3 |
| Map | Leaflet | 1.9 (dynamic import) |
| State | React hooks + URL state | — |
| API Client | Custom typed client | `lib/api.ts` |

## Project Structure

```
apps/web/
├── app/
│   ├── layout.tsx          # Root layout, providers, navigation
│   ├── page.tsx            # Landing (/)
│   ├── globals.css         # Global styles, Tailwind imports
│   ├── icon.svg            # Favicon
│   ├── new/
│   │   └── page.tsx        # Brief form (/new)
│   └── campaigns/
│       ├── page.tsx        # Campaign list (/campaigns)
│       └── [id]/
│           └── page.tsx    # Workspace (/campaigns/[id])
├── components/
│   ├── Nav.tsx             # Top navigation with demo/real toggle
│   ├── ProvenanceBadge.tsx # Provenance icon+label+border
│   ├── SourceLegend.tsx    # Provenance legend for evidence/plan
│   ├── DemoBanner.tsx      # Persistent illustrative data banner
│   ├── InfoTip.tsx         # Accessible popover (keyboard operable)
│   ├── MapView.tsx         # Leaflet map (ref-based, no getElementById)
│   ├── ClickMap.tsx        # Click-to-pick location map
│   ├── LocationAutocomplete.tsx # Debounced combobox
│   ├── States/
│   │   ├── EmptyState.tsx
│   │   ├── Skeleton.tsx
│   │   └── ProgressStatus.tsx
│   └── ...
├── lib/
│   ├── api.ts              # Typed HTTP client (mirrors OpenAPI)
│   ├── types.ts            # Pointer to api.ts types
│   └── utils.ts            # Shared utilities
└── scripts/
    └── generate-api-types.mjs  # OpenAPI parity check
```

## Routing & Navigation

### Four Routes Only

| Route | Purpose | Key Components |
|---|---|---|
| `/` | Landing page | Hero, value props, demo entry, ground rules |
| `/new` | Campaign brief | LocationAutocomplete, ClickMap, guided form |
| `/campaigns` | Campaign list | Cards with next-step badges |
| `/campaigns/[id]` | Workspace | Phase-driven 4-section layout |

### Navigation Flow

```
Landing (/)
    ├─ "Start a campaign" → /new
    └─ "See a working example" → /new?mode=demo → /campaigns/[id]
/new
    └─ Submit → POST /api/campaigns → /campaigns/[id] (evidence-loading)
/campaigns
    └─ Click campaign → /campaigns/[id] (resumes at current phase)
/campaigns/[id]
    ├─ Phase: evidence-loading → evidence → plan-loading → ready
    ├─ Section regen → plan-loading (version++) → ready
    └─ Results entry → analytics
```

## Campaign Workspace — Phase State Machine

The workspace (`/campaigns/[id]`) is a **single page** driven by a `Phase` state machine:

```
Phase = 'loading' | 'brief' | 'evidence-loading' | 'evidence' | 'plan-loading' | 'ready'
```

### Phase Transitions

| From | Trigger | To | Action |
|---|---|---|---|
| `loading` | Campaign fetched | `brief` | Show brief recap |
| `brief` | User clicks "Create outreach plan" | `evidence-loading` | POST /evidence |
| `evidence-loading` | Evidence response | `evidence` | Show evidence + CTA |
| `evidence` | User clicks "Create outreach plan" | `plan-loading` | POST /plan |
| `plan-loading` | Plan response | `ready` | Show plan |
| `ready` | Section regen requested | `plan-loading` | POST /plan {section} |
| `plan-loading` | Plan response | `ready` | Show new version |
| `ready` | User clicks "Enter results" | `ready` (results section) | Show results form |
| `ready` | Results submitted | `ready` (analytics section) | GET /analytics |

### Phase UI Rendering

Each phase renders specific sections:

| Phase | Sections Visible |
|---|---|
| `brief` | Brief recap |
| `evidence-loading` | Brief recap + ProgressStatus (QlooCallCounter) |
| `evidence` | Brief recap + SourceLegend + Local Information + Places to Verify + CTA |
| `plan-loading` | Brief recap + ProgressStatus |
| `ready` | All: Brief recap → Local Information → Draft Plan → Results/Analytics |

## State Management

### No Global State Library

- **React hooks**: `useState`, `useEffect`, `useCallback`
- **URL as state**: Campaign ID in path, phase derived from data presence
- **Server state**: Fetched via `lib/api.ts`, cached in component state
- **Form state**: Controlled components with inline validation

### Key State Patterns

```typescript
// Campaign workspace phase derivation
function useCampaignPhase(campaign: Campaign, evidence: EvidenceSnapshot | null, plan: Plan | null, results: ResultsInput | null): Phase {
  if (!campaign) return 'loading';
  if (!evidence) return 'brief';
  if (evidence && evidence.qloo_status === 'loading') return 'evidence-loading';
  if (evidence && !plan) return 'evidence';
  if (plan && plan.version === 0) return 'plan-loading'; // transient
  return 'ready';
}

// Optimistic updates for section regeneration
async function regenerateSection(section: SectionName) {
  setPhase('plan-loading');
  const newPlan = await api.campaigns.regenerateSection(campaignId, section);
  setPlan(newPlan); // version incremented
  setPhase('ready');
}
```

## Component Architecture

### Component Categories

| Category | Components | Responsibility |
|---|---|---|
| Layout | `Nav`, `Layout` | Shell, navigation, demo/real toggle |
| Provenance | `ProvenanceBadge`, `SourceLegend`, `DemoBanner` | Source attribution UI |
| Interaction | `InfoTip`, `Button`, `Input`, `Select` | Accessible primitives |
| Maps | `MapView`, `ClickMap` | Leaflet integration, click-to-pick |
| Location | `LocationAutocomplete` | Debounced Nominatim combobox |
| Campaign | `CampaignCard`, `CampaignList` | List view |
| Workspace | `BriefRecap`, `EvidenceSection`, `PlanSection`, `ResultsSection` | Workspace sections |
| States | `EmptyState`, `Skeleton`, `ProgressStatus` | Loading/empty/error states |

### Component Composition (Workspace)

```
CampaignWorkspace (/campaigns/[id])
├── Nav
├── PhaseIndicator (step badges)
├── SourceLegend
├── BriefRecap
├── EvidenceSection (when evidence exists)
│   ├── FamiliarityHints
│   ├── TechnicalDetails (toggle)
│   ├── QlooChainSteps
│   └── PlacesToVerify
│       ├── MapView
│       └── VenueList (required text alternative)
├── PlanSection (when plan exists)
│   ├── Activities
│   ├── Venues
│   ├── Budget
│   ├── Materials
│   ├── Metrics
│   ├── AssumptionsLimitations
│   ├── PreUseChecklist
│   ├── HowItWasMade
│   └── SectionRegenButtons
├── ResultsSection (when in results phase)
│   ├── ResultsForm
│   └── Analytics (when results exist)
└── ErrorBoundary / OfflineBanner
```

## API Client (`lib/api.ts`)

### Design Principles

- **Single source of truth**: Mirrors FastAPI OpenAPI schema
- **Type-safe**: Full TypeScript inference for requests/responses
- **Error handling**: `friendlyError()` maps all failures to plain language
- **Parity check**: `pnpm generate:api` validates against live `/openapi.json`

### Key Functions

```typescript
// Campaign operations
api.campaigns.create(brief, mode)
api.campaigns.list(stage?)
api.campaigns.get(id)
api.campaigns.getEvidence(id)
api.campaigns.generatePlan(id, section?)
api.campaigns.regenerateSection(id, section)
api.campaigns.saveResults(id, results)
api.campaigns.getAnalytics(id)

// Geo operations
api.geo.suggest(query)
api.geo.reverse(lat, lon)
api.demo.getScenario()

// Error handling
api.friendlyError(error) → string
```

### Type Generation

```bash
# Run against live API
pnpm generate:api

# Verifies:
# - All endpoints present
# - Request/response types match
# - No drift between client and server
```

## Styling & Design System

### Tailwind CSS + CSS Variables

- **Design tokens**: `packages/ui/src/tokens.css` → CSS custom properties
- **Provenance styles**: Icon + label + border (never color alone)
- **Dark mode**: `.dark` class toggle via `Nav`
- **Responsive**: Mobile-first, breakpoints at 640px, 1024px

### Key Design Tokens (Current)

```css
:root {
  --hr-primary: #2563eb;           /* Action blue */
  --hr-primary-hover: #1e40af;
  --hr-bg: #fafafa;                /* Page background */
  --hr-surface: #ffffff;           /* Card surface */
  --hr-text: #0a0a0a;              /* Primary text */
  --hr-text-secondary: #6b6b6b;    /* Secondary text */
  --hr-border: #e8e8ec;            /* Borders */
  --hr-muted: #9c9c9c;             /* Muted (disabled only) */
  --hr-success: #10b981;
  --hr-warning: #f59e0b;
  --hr-error: #ef4444;
  --hr-radius-card: 16px;
  --hr-radius-input: 12px;
  --hr-ring: 0 0 0 3px rgba(37, 99, 235, 0.35);
}

.dark {
  --hr-bg: #0c0c10;
  --hr-surface: #141419;
  --hr-text: #f4f4f5;
  --hr-text-secondary: #b6b6bd;
  --hr-border: #26262e;
  --hr-muted: #6e6e78;
  --hr-ring: 0 0 0 3px rgba(96, 165, 250, 0.45);
}
```

**Planned Update**: Align with TasteBound-inspired design (warm canvas, mint/voltage, editorial typography) — see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Accessibility

### Implemented

- Semantic HTML (`<main>`, `<section>`, `<nav>`, `<article>`)
- Associated labels/errors (`htmlFor`, `aria-describedby`)
- Keyboard-operable popovers (`InfoTip`: `aria-expanded`, `aria-describedby`, Esc to close)
- Focus visible (`--hr-ring` focus ring)
- Map + list pairing (MapView + VenueList)
- Provenance: icon + text + border (never color alone)
- `prefers-reduced-motion` respected (dot-grid animation disabled)
- 24px minimum touch targets

### Planned Improvements

- WCAG 2.1 AA audit
- Screen reader testing for charts
- Keyboard navigation for all interactive elements
- Color contrast verification for all tokens

---

## Map Integration (Leaflet)

### Implementation Details

- **Dynamic import**: `const L = await import('leaflet')` (SSR-safe)
- **Ref-based**: `useRef<HTMLDivElement>` for map container (no `getElementById`)
- **Tiles**: OSM Standard + CARTO Light with attribution
- **Markers**: Campaign pin + venue markers (clustering planned)
- **Cleanup**: `useEffect` return removes map on unmount

### MapView Component

```typescript
// apps/web/components/MapView.tsx
interface MapViewProps {
  center: [number, number];
  zoom: number;
  markers: MarkerData[];
  readOnly?: boolean;
  onClick?: (lat: number, lon: number) => void;
}
```

### ClickMap Component

```typescript
// apps/web/components/ClickMap.tsx
interface ClickMapProps {
  value: ResolvedLocation | null;
  onSelect: (location: ResolvedLocation) => void;
  disabled?: boolean;
}
```

---

## Performance

### Current Optimizations

- Dynamic Leaflet import (reduces initial bundle)
- Code splitting by route (Next.js App Router)
- Image optimization (Next.js Image)
- In-memory geocode cache (backend)

### Planned

- Virtualized venue lists for large results
- Chart lazy loading
- Service worker for offline error states

---

## Testing Strategy

### Current

- TypeScript strict (`tsc --noEmit`)
- ESLint (`next/core-web-vitals`)
- Production build (`next build`)
- Manual browser QA (Puppeteer in `/tmp`)

### Planned

- Component unit tests (React Testing Library)
- Integration tests (MSW for API mocking)
- Visual regression (Chromatic or similar)
- Accessibility tests (axe-core)

---

## Environment Variables (Frontend)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |

---

*Related: [Routes & Workspace](ROUTES_AND_WORKSPACE.md) · [Design System](DESIGN_SYSTEM.md) · [Accessibility](ACCESSIBILITY.md) · [API Client](api/API_CONTRACTS.md)*