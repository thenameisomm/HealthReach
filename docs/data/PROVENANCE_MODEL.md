# Provenance Model — HealthReach AI

## Purpose

Every displayed value in HealthReach carries explicit provenance — the source of that information. This is **not** a visual-only feature; it's a first-class data model requirement enforced at the API, persistence, and UI layers.

## Provenance Enum

```python
# apps/api/app/models/__init__.py
class Provenance(str, Enum):
    QLOO = "qloo"              # Qloo cultural affinity signals
    GEO = "geo"                # OpenStreetMap/Nominatim/Overpass
    AI = "ai"                  # LLM or deterministic template planner
    USER = "user"              # Organizer input (brief, results)
    ILLUSTRATIVE = "illustrative"  # Demo data only
```

## Provenance Metadata (UI Rendering)

**File**: `packages/ui/src/index.ts` → `provenanceMeta`

| Provenance | Icon | Label | Border Style | Color (Never Used Alone) |
|---|---|---|---|---|
| `qloo` | ◈ | Qloo signal | Solid 3px left | Indigo (#4F46E5) |
| `geo` | ◎ | Verified place data | Solid 3px left | Green (#10B981) |
| `ai` | ✦ | AI interpretation | Solid 3px left | Purple (#8B5CF6) |
| `user` | ● | You provided | Solid 3px left | Blue (#2563EB) |
| `illustrative` | ◇ | Illustrative data | Dashed 3px left + hatch | Amber (#F59E0B) |

**Critical Rule**: Provenance is **never communicated by color alone**. Always: icon + text label + border treatment.

## Propagation Rules

### Campaign Brief (User Input)
```python
CampaignBrief fields → provenance: USER
GeocodeResult → provenance: GEO (from Nominatim)
```

### Evidence Gathering

| Step | Output | Provenance |
|---|---|---|
| Nominatim geocode | `GeocodeResult` | GEO |
| Qloo Step 1 (places) | `QlooSignal(kind="place-affinity")` | QLOO |
| Qloo Step 1 | `QlooChainStep(step=1)` | QLOO |
| Qloo Step 2 (tags) | `QlooSignal(kind="tag-affinity")` | QLOO |
| Qloo Step 2 | `QlooChainStep(step=2)` | QLOO |
| Qloo Step 3 (tags) | `QlooSignal(kind="tag-affinity")` | QLOO |
| Qloo Step 3 | `QlooChainStep(step=3)` | QLOO |
| Overpass venues | `GeoVenue` | GEO |

### Plan Generation

| Source | Output Fields | Provenance |
|---|---|---|
| LLM (when successful) | activities, venues, budget, materials, metrics | AI |
| Template planner (fallback/always) | activities, venues, budget, materials, metrics | AI |
| `Plan.planner` | `"ai-model"` or `"standard-template"` | N/A (meta) |
| `Plan.has_cultural_signals` | Boolean flag | N/A (meta) |

### Results Entry
```python
ResultsInput fields → provenance: USER
```

### Demo Mode
```python
All demo values (brief, geocode, evidence, plan) → provenance: ILLUSTRATIVE
Persistent "Illustrative data" banner in UI
Real-mode paths NEVER import demo_data.py
```

## UI Rendering Requirements

### ProvenanceBadge Component
```tsx
// packages/ui/src/ProvenanceBadge.tsx
interface ProvenanceBadgeProps {
  provenance: Provenance;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}
```

**Rendering**:
- Icon (SVG, 16px)
- Label text (when `showLabel=true`)
- Left border: `border-l-3` with provenance-specific style
- Tooltip/InfoTip with full explanation on hover/focus

### Section-Level Provenance
- Evidence section: Shows QLOO + GEO badges in source legend
- Plan section: Shows AI badge + planner type (`ai-model` | `standard-template`)
- Results section: Shows USER badge
- Demo banner: Shows ILLUSTRATIVE badge (dashed + hatch)

### Inline Provenance
- Every signal card: badge in corner
- Every venue card: badge in corner
- Every plan activity: badge on evidence_refs
- Every budget line: badge
- Every metric: badge

## API Contract

Every response model includes `provenance` field:

```typescript
// TypeScript (apps/web/lib/api.ts)
interface QlooSignal {
  kind: string;
  label: string;
  detail: string;
  affinity: number | null;
  popularity: number | null;
  entity_id: string | null;
  provenance: "qloo" | "geo" | "ai" | "user" | "illustrative";
}

interface GeoVenue {
  name: string;
  category: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  distance_m: number | null;
  provenance: "geo";
  needs_verification: boolean;
}

interface PlanActivity {
  title: string;
  channel: string;
  why: string;
  evidence_refs: string[];
  cost_inr: number;        // planned: cost_usd
  provenance: "ai";
}
```

## Persistence

Provenance stored in MongoDB with every document:

```javascript
// evidence_snapshots
{
  qloo_signals: [{ ..., provenance: "qloo" }],
  qloo_steps: [{ ..., provenance: "qloo" }],
  geo_venues: [{ ..., provenance: "geo" }],
  qloo_status: "ok",
  qloo_note: "Taste affinity, not a health or trust signal.",
  geo_status: "ok",
  geo_note: ""
}

// plans
{
  activities: [{ ..., provenance: "ai" }],
  venues: [{ ..., provenance: "ai" }],
  budget: [{ ..., provenance: "ai" }],
  materials: [{ ..., provenance: "ai" }],
  metrics: [{ ..., provenance: "ai" }],
  planner: "ai-model" | "standard-template"
}
```

## Validation Rules

1. **Every model with provenance field must populate it** — no nulls
2. **Demo data must use ILLUSTRATIVE** — enforced by `demo_data.py` being only source
3. **Real mode never produces ILLUSTRATIVE** — architecture enforcement
4. **UI must render provenance for every value** — no exceptions
5. **Provenance never inferred from color** — explicit icon+label+border

## Accessibility

- **Screen readers**: Provenance announced via `aria-label` on badge
- **Keyboard**: Badge focusable, InfoTip opens on Enter/Space
- **Color blind**: Border + icon + text, never color alone
- **Reduced motion**: Badge animations respect `prefers-reduced-motion`

## Testing

### Unit Tests
- All model constructors set provenance correctly
- Demo data produces ILLUSTRATIVE provenance
- Real mode never produces ILLUSTRATIVE
- ProvenanceBadge renders correct icon/label/border for each type

### Integration Tests
- Evidence snapshot: all signals have provenance
- Plan: all fields have provenance, planner field accurate
- Results: USER provenance
- Demo endpoint: all ILLUSTRATIVE

---

*Related: [Data Model](DATA_MODEL.md) · [MongoDB Collections](MONGODB_COLLECTIONS.md) · [Design System](../frontend/DESIGN_SYSTEM.md)*