# Feature Specification: InteractiveCharts

## Overview

Interactive charts for the analytics phase showing planned vs actual metrics, cost efficiency, attendance rates, and reach estimates. All charts include accessible data table alternatives and handle null/zero states gracefully.

**Current State**: Basic analytics display with text/table only. No charting library integrated.

**Target**: Production-ready interactive charts with full accessibility, null-safe rendering, and provenance-aware data display.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-IC-001 | Planned vs Actual: Registrations (bar chart) | P0 |
| FR-IC-002 | Planned vs Actual: Attendance (bar chart) | P0 |
| FR-IC-003 | Planned vs Actual: Spend (bar chart) | P0 |
| FR-IC-004 | Planned vs Actual: Engagement (bar chart) | P0 |
| FR-IC-005 | Cost per Registration (metric card + trend) | P0 |
| FR-IC-006 | Cost per Attendee (metric card + trend) | P1 |
| FR-IC-007 | Attendance Rate (metric card + gauge/progress) | P0 |
| FR-IC-008 | Reach Estimate Ranges (horizontal bar with range) | P1 |
| FR-IC-009 | Cultural Affinity vs Observed Reach (scatter) | P2 |
| FR-IC-010 | Data table alternative for every chart | P0 |
| FR-IC-011 | Null-safe: "Not calculable — needs at least 1 registration" | P0 |
| FR-IC-012 | Keyboard navigation + screen reader support | P0 |
| FR-IC-013 | Provenance badges on chart data points | P0 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-IC-001 | Chart library | Recharts (lightweight, accessible) |
| NFR-IC-002 | Bundle size impact | < 50KB gzipped |
| NFR-IC-003 | Accessibility | WCAG 2.1 AA, keyboard, screen reader |
| NFR-IC-004 | Responsive | 360px - 1200px |
| NFR-IC-005 | Color blind safe | Patterns + labels, not color alone |
| NFR-IC-006 | Provenance | Icon + label + border on data points |

---

## Data Structures

### Analytics Data (from API)

```typescript
interface Analytics {
  planned_registrations: string;      // "150-200" (range)
  actual_registrations: number;       // 180
  planned_attendance: string;         // "100-150"
  actual_attendance: number;          // 135
  planned_spend_usd: number;          // 5000
  actual_spend_usd: number;           // 4850
  cost_per_registration: number | null;  // 26.94 or null
  attendance_rate: number | null;     // 0.75 or null
  note: string;                       // "Descriptive comparison only..."
}

interface ChartDataPoint {
  metric: string;
  planned_min: number;
  planned_max: number;
  planned_mid: number;
  actual: number;
  unit: 'people' | 'USD' | 'count';
  provenance: 'ai' | 'user';
  basis?: string;  // For estimates
}
```

### Chart Configuration

```typescript
interface ChartConfig {
  // Planned vs Actual Bar Chart
  plannedVsActual: {
    data: ChartDataPoint[];
    xKey: 'metric';
    yKeys: ['planned_mid', 'actual'];
    plannedRangeKey: ['planned_min', 'planned_max'];
    colors: {
      planned: '#2563eb';   // primary blue
      actual: '#10b981';    // success green
      range: 'rgba(37, 99, 235, 0.2)';
    };
  };

  // Cost per Registration
  costPerRegistration: {
    value: number | null;
    plannedRange: string;  // "$20-30"
    unit: 'USD';
    format: (n) => `$${n.toFixed(2)}`;
  };

  // Attendance Rate
  attendanceRate: {
    value: number | null;  // 0.75
    format: (n) => `${(n * 100).toFixed(1)}%`;
    gauge: true;
  };

  // Reach Estimates
  reachEstimates: {
    data: ReachEstimate[];
    colors: {
      estimate: '#8b5cf6';  // AI purple
    };
  };
}
```

---

## Chart Components

### 1. Planned vs Actual Bar Chart (Primary)

```tsx
function PlannedVsActualChart({ data, title }) {
  const chartData = data.map(d => ({
    metric: d.metric,
    'Planned (mid)': d.planned_mid,
    'Planned (min)': d.planned_min,
    'Planned (max)': d.planned_max,
    Actual: d.actual,
  });

  return (
    <figure className="chart-container">
      <figcaption className="chart-title">{title}</figcaption>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis type="number" tickFormatter={formatNumber} />
          <YAxis dataKey="metric" type="category" width={120} tick={{ fontSize: 12 }} />
          <Tooltip 
            formatter={(value, name) => [formatValue(value, name), name]}
            content={<CustomTooltip />}
          />
          <Legend />
          
          {/* Planned range as error bars */}
          <Bar 
            dataKey="Planned (mid)" 
            name="Planned (estimate)" 
            fill="#2563eb"
            radius={[0, 4, 4, 0]}
          >
            {data.map((d, i) => (
              <ErrorBar
                key={i}
                x={d.planned_mid}
                y={d.metric}
                min={d.planned_min}
                max={d.planned_max}
                stroke="#2563eb"
                strokeWidth={2}
              />
            ))}
          </Bar>
          
          <Bar 
            dataKey="Actual" 
            name="Actual" 
            fill="#10b981"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Required data table alternative */}
      <DataTableAlternative data={data} />
    </figure>
  );
}
```

### 2. Cost Per Registration / Attendee

```tsx
function CostPerMetric({ value, plannedRange, label, unit }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <h3>{label}</h3>
        <ProvenanceBadge provenance="ai" size="sm" />
      </div>
      
      {value !== null ? (
        <>
          <div className="metric-value">{formatUSD(value)}</div>
          <div className="metric-comparison">
            Planned: {plannedRange}
          </div>
        </>
      ) : (
        <div className="metric-null" role="status" aria-live="polite">
          Not calculable — needs at least 1 registration
        </div>
      )}
    </div>
  );
}
```

### 3. Attendance Rate Gauge

```tsx
function AttendanceRateGauge({ value }) {
  return (
    <div className="gauge-card">
      <h3>Attendance Rate</h3>
      {value !== null ? (
        <>
          <svg className="gauge" viewBox="0 0 200 100">
            <path 
              d="M 10 90 A 80 80 0 0 1 190 90" 
              stroke="#e5e5e5" 
              strokeWidth="20" 
              fill="none"
            />
            <path 
              d={`M 10 90 A 80 80 0 0 1 ${10 + 160 * value} 90`} 
              stroke="#10b981" 
              strokeWidth="20" 
              fill="none"
              strokeLinecap="round"
            />
            <text x="100" y="105" textAnchor="middle" fontSize="24" fill="#171717">
              {(value * 100).toFixed(1)}%
            </text>
          </svg>
          <p className="gauge-detail">
            {actualAttendance} of {actualRegistrations} attended
          </p>
        </>
      ) : (
        <div className="metric-null" role="status">
          Not calculable — needs at least 1 registration
        </div>
      )}
    </div>
  );
}
```

### 4. Reach Estimate Ranges

```tsx
function ReachEstimateChart({ estimates }) {
  return (
    <figure className="chart-container">
      <figcaption>Estimated Reach Ranges</figcaption>
      
      <div className="reach-estimates">
        {estimates.map((e, i) => (
          <div key={i} className="reach-estimate-card">
            <h4>{e.name}</h4>
            <div className="range-bar">
              <div 
                className="range-fill" 
                style={{ 
                  left: `${percentile(e.min, e.max, e.min)}%`,
                  width: `${percentile(e.min, e.max, e.max) - percentile(e.min, e.max, e.min)}%`
                }}
              />
            </div>
            <div className="range-labels">
              <span>{formatNumber(e.min)}</span>
              <span>{formatNumber(e.max)}</span>
            </div>
            <p className="basis">{e.basis}</p>
            <ProvenanceBadge provenance="ai" />
          </div>
        ))}
      </div>
      
      <DataTableAlternative data={estimates} />
    </figure>
  );
}
```

### 5. Cultural Affinity vs Reach Scatter (Stretch)

```tsx
function AffinityVsReachScatter({ data }) {
  // data: { affinity: number, reach: number, venue: string }[]
  return (
    <figure className="chart-container">
      <figcaption>Cultural Affinity vs Observed Reach</figcaption>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="affinity" 
            name="Cultural Affinity (-1 to 1)"
            domain={[-1, 1]}
          />
          <YAxis 
            dataKey="reach" 
            name="Observed Reach (people)"
          />
          <Tooltip formatter={v => [`${v} people`, v]} />
          <Scatter 
            name="Venues" 
            data={data} 
            fill="#8b5cf6"
            shape="circle"
            size={6}
          />
        </ScatterChart>
      </ResponsiveContainer>
      
      <p className="chart-disclaimer">
        Correlation ≠ causation. Cultural affinity ≠ attendance prediction.
      </p>
      
      <DataTableAlternative data={data} />
    </figure>
  );
}
```

---

## Data Table Alternative (Required for Every Chart)

```tsx
function DataTableAlternative({ data, columns }) {
  return (
    <details className="data-table-alternative">
      <summary>View as accessible data table</summary>
      <table role="table" aria-label="Chart data as table">
        <caption>{columns[0].header} Data</caption>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} scope="col">{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
```

---

## Null/Zero State Handling

### Null Safety Rules

| Metric | Null Condition | Display |
|--------|----------------|---------|
| `cost_per_registration` | `actual_registrations === 0` | "Not calculable — needs at least 1 registration" |
| `attendance_rate` | `actual_registrations === 0` | "Not calculable — needs at least 1 registration" |
| `cost_per_attendee` | `actual_attendance === 0` | "Not calculable — needs at least 1 attendee" |
| `reach_estimate` | No Qloo signals | "Insufficient cultural data for estimate" |
| `planned_range` | No plan metrics | "No plan generated yet" |

### Implementation

```typescript
function getDisplayValue(metric: Analytics, field: keyof Analytics): string {
  const value = metric[field];
  
  if (value === null || value === undefined) {
    return getNullMessage(field);
  }
  
  if (typeof value === 'number') {
    return formatMetric(field, value);
  }
  
  return value; // string (planned ranges)
}

function getNullMessage(field: string): string {
  const messages = {
    cost_per_registration: 'Not calculable — needs at least 1 registration',
    attendance_rate: 'Not calculable — needs at least 1 registration',
    cost_per_attendee: 'Not calculable — needs at least 1 attendee',
  };
  return messages[field] || 'Not available';
}
```

---

## Accessibility

### Chart Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard navigation** | Tab through chart elements, arrow keys for data points |
| **Screen reader** | `aria-label` on chart, `role="img"`, data table alternative |
| **Focus visible** | Custom focus ring on interactive elements |
| **Color blind safe** | Patterns + labels, not color alone |
| **High contrast** | WCAG 2.1 AA verified |
| **Reduced motion** | Respects `prefers-reduced-motion` |

### Implementation Patterns

```tsx
// Chart container
<figure 
  className="chart-container"
  role="img"
  aria-label={title}
  aria-describedby={`chart-desc-${id}`}
>
  <figcaption id={`chart-desc-${id}`} className="sr-only">
    {chartDescription}
  </figcaption>
  
  {/* Chart */}
  
  {/* Required data table alternative */}
  <DataTableAlternative data={data} columns={columns} />
</figure>

// Tooltip accessibility
<Tooltip 
  content={<CustomTooltip />}
  wrapperStyle={{ pointerEvents: 'none' }}
/>

// Custom tooltip with provenance
function CustomTooltip({ active, payload, label }) {
  if (!active) return null;
  return (
    <div className="chart-tooltip">
      <p>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="tooltip-row">
          <span className="tooltip-label">{entry.name}</span>
          <span className="tooltip-value">{formatValue(entry.value)}</span>
          <ProvenanceBadge provenance={entry.payload?.provenance} size="sm" />
        </div>
      ))}
    </div>
  );
}
```

---

## Color Palette (Chart-Safe)

| Purpose | Color | Hex | Color Blind Safe |
|---------|-------|-----|------------------|
| Planned (estimate) | Blue | `#2563eb` | ✅ |
| Actual | Green | `#10b981` | ✅ |
| Estimate range | Blue 20% | `rgba(37, 99, 235, 0.2)` | ✅ |
| AI estimate | Purple | `#8b5cf6` | ✅ |
| Warning | Amber | `#f59e0b` | ⚠️ Use pattern |
| Error | Red | `#ef4444` | ⚠️ Use pattern |
| Grid lines | Ash | `#c6c6c6` | ✅ |
| Text | Ink | `#171717` | ✅ |

**Patterns for non-color-blind-safe colors:**
```css
.warning-fill { background: repeating-linear-gradient(45deg, #f59e0b, #f59e0b 4px, transparent 4px, transparent 8px); }
.error-fill { background: repeating-linear-gradient(45deg, #ef4444, #ef4444 4px, transparent 4px, transparent 8px); }
```

---

## Provenance on Charts

Every data point shows provenance badge in tooltip and data table:

```typescript
interface ChartDataPoint {
  // ...
  provenance: 'ai' | 'user' | 'geo' | 'qloo' | 'illustrative';
  basis?: string;  // For estimates
}
```

**Tooltip includes:**
- Metric name
- Value
- Provenance badge (icon + label + border)
- Basis (for estimates)

---

## Responsive Design

| Breakpoint | Chart Height | Layout |
|------------|--------------|--------|
| < 640px | 250px | Stacked vertically |
| 640px - 1023px | 300px | 2-column grid |
| ≥ 1024px | 300-400px | 2-3 column grid |

```css
.chart-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--hr-space-6);
}

@media (min-width: 640px) {
  .chart-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .chart-grid { grid-template-columns: repeat(3, 1fr); }
}

.chart-container {
  min-height: 250px;
}
```

---

## Testing Requirements

### Unit Tests
- [ ] Planned vs Actual renders with correct data
- [ ] Null state shows "Not calculable" message
- [ ] Data table alternative renders correct data
- [ ] Tooltip shows provenance badge
- [ ] Null state accessibility (role="status", aria-live)
- [ ] Responsive breakpoints work

### Integration Tests
- [ ] Charts render with real analytics data
- [ ] Data table matches chart data
- [ ] Null states from API render correctly
- [ ] Provenance badges in tooltips

### Accessibility Tests (axe-core)
- [ ] Charts have `role="img"` + `aria-label`
- [ ] Data tables have proper headers
- [ ] Color contrast ≥ 4.5:1
- [ ] Keyboard navigation works
- [ ] Screen reader reads data table
- [ ] `prefers-reduced-motion` respected

### Visual Tests
- [ ] 360px mobile viewport
- [ ] 1200px desktop viewport
- [ ] Dark mode colors
- [ ] Color blind simulation (Coblis)

---

## Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-IC-001 | Planned vs Actual: Registrations bar chart | Visual test |
| AC-IC-002 | Planned vs Actual: Attendance bar chart | Visual test |
| AC-IC-003 | Planned vs Actual: Spend bar chart | Visual test |
| AC-IC-004 | Planned vs Actual: Engagement bar chart | Visual test |
| AC-IC-005 | Cost per Registration metric card | Visual test |
| AC-IC-006 | Cost per Attendee metric card | Visual test |
| AC-IC-007 | Attendance Rate gauge | Visual test |
| AC-IC-008 | Reach Estimate range bars | Visual test |
| AC-IC-009 | Data table alternative for every chart | axe-core |
| AC-IC-010 | Null state: "Not calculable — needs at least 1 registration" | Visual test |
| AC-IC-011 | Keyboard navigation through charts | Manual test |
| AC-IC-012 | Screen reader reads data table | NVDA/VoiceOver |
| AC-IC-013 | Color blind safe (patterns + labels) | Coblis |
| AC-IC-014 | Provenance badges in tooltips | Visual test |
| AC-IC-015 | Responsive at 360px and 1200px | Visual test |

---

## Implementation Notes

### Files to Create
- `apps/web/components/charts/PlannedVsActualChart.tsx`
- `apps/web/components/charts/CostPerMetricCard.tsx`
- `apps/web/components/charts/AttendanceRateGauge.tsx`
- `apps/web/components/charts/ReachEstimateChart.tsx`
- `apps/web/components/charts/DataTableAlternative.tsx`
- `apps/web/components/charts/ChartTooltip.tsx`
- `apps/web/app/campaigns/[id]/page.tsx` — Integrate in analytics phase

### Dependencies
```json
{
  "recharts": "^2.10.0"
}
```

### CSS Classes
```css
.chart-container { /* figure wrapper */ }
.chart-title { /* figcaption */ }
.metric-card { /* card for single metrics */ }
.metric-value { /* large number */ }
.metric-null { /* null state styling */ }
.gauge-card { /* SVG gauge wrapper */ }
.reach-estimates { /* horizontal range bars */ }
.data-table-alternative { /* details/summary */ }
.chart-tooltip { /* custom tooltip */ }
.chart-disclaimer { /* small print */ }
```

---

## Rollout Plan

1. **Branch**: `feat/interactive-charts`
2. **Add** Recharts dependency
3. **Implement** chart components + data table alternative
4. **Integrate** in analytics phase
5. **Test** unit + integration + accessibility + visual
6. **Merge** to `integration/healthreach-redesign`

---

*Related: [Visualization Guidelines](../frontend/VISUALIZATION_GUIDELINES.md) · [Analytics API](../api/API_CONTRACTS.md) · [Accessibility](../frontend/ACCESSIBILITY.md)*