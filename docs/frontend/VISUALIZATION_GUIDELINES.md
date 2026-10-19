# Visualization Guidelines — HealthReach AI

## Purpose

This document defines standards for all data visualizations in HealthReach: charts, maps, and data displays. The goal is **honest, accessible, and actionable** visual communication for non-technical health organizers.

## Core Principles

### 1. Honesty First
- **Estimates labeled as estimates** — never presented as facts
- **Ranges, not point values** — uncertainty communicated visually
- **Null states explicit** — "Not calculable" not "0" or "N/A"
- **Provenance on every data point** — icon + label + border
- **No causal language** — "Descriptive, not causal"

### 2. Accessibility Required
- **Text alternative for every chart** — data table or structured description
- **Keyboard navigation** — focusable elements, Arrow key support
- **Screen reader support** — `aria-label`, `role="img"`, `aria-describedby`
- **Color blind safe** — patterns + labels, not color alone
- **High contrast** — ≥ 4.5:1 for text, ≥ 3:1 for graphical elements

### 3. Clarity Over Decoration
- **No chartjunk** — no gradients, shadows, 3D effects, decorative icons
- **Direct labeling** — labels on data, not legends (where possible)
- **Meaningful titles** — what, where, when, provenance
- **Actionable insights** — what should the organizer do?

---

## Chart Standards

### Library

**Current**: None (planned: Recharts or Chart.js — lightweight, accessible)
**Fallback**: HTML `<table>` with semantic structure (always available)

### Chart Types & When to Use

| Data | Chart Type | Alternative |
|---|---|---|
| Planned vs Actual (categorical) | Grouped bar chart | Data table |
| Trend over time | Line chart | Data table |
| Part-to-whole | Stacked bar (not pie) | Data table |
| Distribution | Histogram | Data table |
| Correlation | Scatter (with caution) | Data table + correlation note |
| Single metric | Big number + sparkline | Data table row |

### Required Chart Elements

```typescript
interface ChartProps {
  // Data
  data: ChartDataPoint[];
  
  // Metadata (required)
  title: string;                    // "Planned vs Actual Registrations"
  subtitle?: string;                // "Based on template estimates + Qloo signals"
  provenance: Provenance;           // Badge on chart
  basis: string;                    // "Template estimate based on similar campaigns"
  
  // Accessibility
  ariaLabel: string;                // Full description for screen readers
  dataTable: TableData;             // Structured data for alternative view
  
  // Honesty
  showNullState: boolean;           // "Not calculable — needs at least 1 registration"
  estimateDisclaimer?: string;      // "Estimate only. Actual results may vary."
}
```

### Visual Encoding

| Variable | Encoding | Rule |
|---|---|---|
| Category | Position (x-axis) + direct label | No legend needed if ≤ 5 categories |
| Value | Bar length / line position | Zero baseline for bars |
| Estimate range | Error bars / band | Light fill, labeled "estimate range" |
| Provenance | Icon + border on legend items | Never color alone |
| Uncertainty | Dashed line / lighter fill | Labeled "estimated" |
| Actual | Solid line / full opacity | Labeled "actual" |

### Color Palette (Charts)

| Purpose | Color | Use |
|---|---|---|
| Planned (estimate) | `--hr-primary` `#2563eb` | Bars, lines for planned |
| Actual | `--hr-success` `#10b981` | Bars, lines for actual |
| Estimate range | `--hr-primary` at 20% opacity | Error bars, bands |
| Provenance qloo | `--hr-qloo` `#4F46E5` | Legend items |
| Provenance geo | `--hr-geo` `#10B981` | Legend items |
| Provenance ai | `--hr-ai` `#8B5CF6` | Legend items |
| Provenance user | `--hr-user` `#2563EB` | Legend items |
| Provenance illustrative | `--hr-illustrative` `#F59E0B` (dashed) | Legend items |
| Grid/axes | `--hr-border` `#e8e8ec` | Subtle, not dominant |
| Text | `--hr-text` `#0a0a0a` | Labels, titles |

**Color blind safe**: Verified with Coblis simulator. Patterns (dashed/dotted) supplement color.

---

## Specific Visualizations

### 1. Planned vs Actual (Bar Chart)

**Context**: Analytics section, after results entered

**Data**:
```typescript
interface PlannedActualData {
  metric: 'registrations' | 'attendance' | 'spend' | 'engagement';
  planned_range: string;      // "150-200"
  planned_midpoint: number;
  actual: number;
  unit: 'people' | 'USD' | 'count';
}
```

**Visual**:
- Grouped bars: Planned (range as error bar) vs Actual (solid)
- Direct labels on bars
- Variance callout: "+15% vs plan" / "-10% vs plan"
- Null state: "Not calculable — needs at least 1 registration"

**Accessibility**:
- Data table below chart (toggleable)
- `aria-label`: "Planned vs actual registrations. Planned range 150 to 200. Actual 180. Variance +15 percent."

---

### 2. Cost per Registration / Attendee

**Context**: Analytics section

**Visual**:
- Big number: `$26.94 per registration`
- Subtitle: "Planned: $25-33 | Actual: $26.94"
- Sparkline (optional): Trend if multiple campaigns
- Null state: "Not calculable — needs at least 1 registration"

---

### 3. Attendance Rate

**Visual**:
- Big number: `75% attendance rate`
- Subtitle: "135 of 180 registered attended"
- Visual: Progress ring or bar (accessible with text)
- Null state: "Not calculable — needs at least 1 registration"

---

### 4. Reach Estimates (Plan Section)

**Context**: PlanSection → Metrics

**Data**:
```typescript
interface ReachEstimate {
  name: string;           // "Estimated reach"
  target_range: string;   // "200-350 people"
  basis: string;          // "Based on: Qloo community gathering affinity (0.65), 2 venues (est. 150 capacity), 7 days"
  provenance: 'ai';
}
```

**Visual**:
- Card with range prominently displayed
- Basis text visible (not tooltip-only)
- Provenance badge (AI)
- Disclaimer: "Estimate only. Actual reach depends on many factors not modeled here."

---

### 5. Cultural Affinity Signals (Evidence Section)

**Context**: EvidenceSection → Familiarity Hints

**Visual**:
- Horizontal bar for each signal
- Label: Signal name (e.g., "Community gathering")
- Bar length: Affinity (-1 to 1, centered at 0)
- Color: Green for positive, red for negative, gray for neutral
- Tooltip: Full detail + provenance
- **Plain language hint**: "Moderate match — could mean people here respond well to community-gathering formats"

---

### 6. Qloo Chain Steps (Evidence Section)

**Visual**: Numbered step cards (not a flowchart)

```
Step 1: Looked at culture spots near here
  Asked: "Which places near East Austin match the local crowd's taste?"
  Found: "3 places — East Austin Community Center, East Austin Library, Walgreens Pharmacy"
  Next: "Now asking: what else do fans of East Austin Community Center also like?"
  Status: ✓ OK

Step 2: Checked what fans of East Austin Community Center also like
  Asked: "Shared taste tags of people who like East Austin Community Center."
  Found: "4 tags — community gathering, family activities, local food, outdoor recreation"
  Next: "Now double-checking with East Austin Library."
  Status: ✓ OK

Step 3: Double-checked with East Austin Library
  Asked: "Same taste question, asked about East Austin Library."
  Found: "2 of the same tags appeared — community gathering, family activities. The pattern holds."
  Status: ✓ OK
```

---

## Map Visualization (ResultsMap)

### Requirements

| Element | Spec |
|---|---|
| Base map | OSM Standard tiles (Leaflet) |
| Attribution | "© OpenStreetMap contributors (ODbL)" — always visible |
| Campaign pin | Distinct marker (star/diamond), labeled "Campaign location" |
| Venue markers | Circle markers, color by category |
| Clustering | Leaflet.markercluster for > 10 venues |
| Verification badge | On marker popup + list: "Visit and verify" |
| Reach overlay | **Optional**, only if methodology documented |
| Text alternative | Venue list below map (required) |

### Reach Overlay (If Implemented)

**Must have**:
- Defensible methodology documented
- Explicit limitations stated
- Provenance: AI estimate
- Toggleable (off by default)
- Never presented as actual attendance

---

## Data Tables (Chart Alternatives)

### Required for Every Chart

```tsx
// Always provide structured data table
<table role="table" aria-label="Planned vs actual registrations data">
  <caption>Planned vs Actual Registrations</caption>
  <thead>
    <tr>
      <th scope="col">Metric</th>
      <th scope="col">Planned Range</th>
      <th scope="col">Actual</th>
      <th scope="col">Variance</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Registrations</td>
      <td>150-200</td>
      <td>180</td>
      <td>+15%</td>
    </tr>
  </tbody>
</table>
```

### Table Accessibility

- `<caption>` describes the table
- `<th scope="col|row">` for headers
- Zebra striping for readability
- Responsive: horizontal scroll on mobile
- Sortable columns (where meaningful)

---

## Export Visualizations

### PDF Export (Plan)

- Charts rendered as vector (SVG → PDF)
- Data tables included
- Provenance badges rendered as text labels
- Page size: A4 / Letter
- Margins: 1 inch

### CSV Export (Results)

```csv
campaign_id,topic,location,date,registrations,attendance,spend_usd,engagement,cost_per_registration,attendance_rate,notes
cam_abc123,"Diabetes Screening","East Austin, TX","2026-10-27",180,135,4850,320,26.94,0.75,"Rain on day 2"
```

### JSON Export (Evidence)

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

## Implementation Checklist

### Per Chart Component

- [ ] Title + subtitle + provenance badge
- [ ] Basis/estimation disclaimer visible
- [ ] Null state handled ("Not calculable — needs...")
- [ ] Data table alternative provided
- [ ] Keyboard navigable (if interactive)
- [ ] Screen reader label (`aria-label`)
- [ ] Color blind tested (Coblis)
- [ ] Contrast verified (both themes)
- [ ] Responsive (360px - 1200px)
- [ ] No chartjunk (gradients, shadows, 3D)
- [ ] Direct labels > legends
- [ ] Zero baseline for bars
- [ ] Estimate ranges shown (not point values)

---

## Planned Chart Library Evaluation

| Library | Bundle Size | Accessibility | Tree-shaking | License |
|---|---|---|---|---|
| Recharts | ~80KB | Good (ARIA) | Yes | MIT |
| Chart.js | ~60KB | Good (plugin) | Yes | MIT |
| Victory | ~120KB | Good | Yes | MIT |
| D3 + custom | ~30KB | Manual | Yes | BSD |
| **HTML Table only** | **0KB** | **Native** | **N/A** | **—** |

**Recommendation**: Start with **HTML tables + minimal Recharts** for key charts (planned vs actual). Add more only if user testing demands.

---

*Related: [Design System](DESIGN_SYSTEM.md) · [Accessibility](ACCESSIBILITY.md) · [Estimates & Metrics](data/ESTIMATES_AND_METRICS.md) · [ResultsMap Spec](../project/TODO.md)*