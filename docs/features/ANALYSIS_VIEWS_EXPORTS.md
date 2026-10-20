# Feature Specification: AnalysisViews & Exports

## Overview

Analysis views for deep-dive into evidence, venues, and plan versions. Export functionality for campaign data in CSV, PDF, and JSON formats with privacy protection.

**Current State**: Basic analytics display. No analysis views or exports.

**Target**: Production-ready analysis views and privacy-preserving exports.

---

## Part 1: Analysis Views

### 1. Evidence Dashboard

#### Purpose
Deep-dive into Qloo cultural signals and OSM venue evidence with provenance, freshness, and gap analysis.

#### Component: `EvidenceDashboard`

```tsx
function EvidenceDashboard({ evidence }: { evidence: EvidenceSnapshot }) {
  return (
    <section className="analysis-section" aria-labelledby="evidence-dashboard-title">
      <h2 id="evidence-dashboard-title">Evidence Dashboard</h2>
      
      {/* Qloo Signals Summary */}
      <div className="evidence-panel">
        <h3>Qloo Cultural Signals</h3>
        <div className="status-badges">
          <StatusBadge status={evidence.qloo_status} label="Qloo" />
        </div>
        <p className="evidence-note">{evidence.qloo_note}</p>
        
        {/* Signal Cards */}
        <div className="signal-grid">
          {evidence.qloo_signals.map((signal, i) => (
            <SignalCard key={i} signal={signal} />
          ))}
        </div>
        
        {/* Qloo Chain Steps */}
        <div className="chain-steps">
          <h4>Qloo Agent Chain</h4>
          {evidence.qloo_steps.map(step => (
            <ChainStepCard key={step.step} step={step} />
          ))}
        </div>
      </div>
      
      {/* OSM Venues Summary */}
      <div className="evidence-panel">
        <h3>OSM Community Venues</h3>
        <div className="status-badges">
          <StatusBadge status={evidence.geo_status} label="OSM" />
        </div>
        <p className="evidence-note">{evidence.geo_note}</p>
        
        <div className="venue-summary">
          <VenueCategoryBreakdown venues={evidence.geo_venues} />
          <VenueDistanceDistribution venues={evidence.geo_venues} />
        </div>
      </div>
    </section>
  );
}
```

#### Signal Card

```tsx
function SignalCard({ signal }: { signal: QlooSignal }) {
  const kindLabels = {
    'place-affinity': 'Place Affinity',
    'tag-affinity': 'Taste Tag',
    'demographics': 'Demographics'
  };
  
  return (
    <div className="signal-card">
      <div className="signal-header">
        <span className="signal-kind">{kindLabels[signal.kind]}</span>
        <ProvenanceBadge provenance="qloo" size="sm" />
      </div>
      <h4>{signal.label}</h4>
      <p className="signal-detail">{signal.detail}</p>
      <div className="signal-metrics">
        {signal.affinity !== null && (
          <span className="metric">Affinity: {signal.affinity.toFixed(2)}</span>
        )}
        {signal.popularity !== null && (
          <span className="metric">Popularity: {signal.popularity.toFixed(2)}</span>
        )}
      </div>
      {signal.entity_id && (
        <span className="entity-id">Entity: {signal.entity_id}</span>
      )}
    </div>
  );
}
```

#### Chain Step Card

```tsx
function ChainStepCard({ step }: { step: QlooChainStep }) {
  const statusColors = {
    ok: 'text-success',
    skip: 'text-warning'
  };
  
  return (
    <div className={`chain-step-card status-${step.status}`}>
      <div className="step-header">
        <span className="step-number">Step {step.step}</span>
        <span className="step-title">{step.title}</span>
        <span className={`status-badge ${statusColors[step.status]}`}>
          {step.status === 'ok' ? '✓ Completed' : '⊘ Skipped'}
        </span>
      </div>
      
      <div className="step-content">
        <p><strong>Asked:</strong> {step.asked}</p>
        <p><strong>Found:</strong> {step.found || '—'}</p>
        {step.next && <p><strong>Next:</strong> {step.next}</p>}
        {step.status === 'skip' && (
          <p className="skip-reason"><strong>Skipped:</strong> {step.skip_reason}</p>
        )}
      </div>
      
      {step.top_names.length > 0 && (
        <div className="top-names">
          {step.top_names.map((name, i) => (
            <span key={i} className="top-name-tag">{name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 2. Venue Analysis

#### Purpose
Geographic coverage, category distribution, verification status, and distance analysis for candidate venues.

#### Component: `VenueAnalysis`

```tsx
function VenueAnalysis({ venues }: { venues: GeoVenue[] }) {
  const stats = computeVenueStats(venues);
  
  return (
    <section className="analysis-section" aria-labelledby="venue-analysis-title">
      <h2 id="venue-analysis-title">Venue Analysis</h2>
      
      {/* Overview Stats */}
      <div className="stats-grid">
        <StatCard label="Total Venues" value={stats.total} />
        <StatCard label="Categories" value={stats.categoriesCount} />
        <StatCard label="Verified" value={stats.verifiedCount} />
        <StatCard label="Avg Distance" value={`${stats.avgDistanceMi} mi`} />
        <StatCard label="Closest" value={`${stats.minDistanceMi} mi`} />
        <StatCard label="Farthest" value={`${stats.maxDistanceMi} mi`} />
      </div>
      
      {/* Category Breakdown */}
      <div className="analysis-panel">
        <h3>Category Distribution</h3>
        <CategoryBreakdownChart categories={stats.categories} />
        <CategoryBreakdownTable categories={stats.categories} />
      </div>
      
      {/* Verification Status */}
      <div className="analysis-panel">
        <h3>Verification Status</h3>
        <VerificationStatusChart 
          worthEvaluating={stats.worthEvaluatingCount}
          verified={stats.verifiedCount}
          rejected={stats.rejectedCount}
        />
      </div>
      
      {/* Geographic Coverage */}
      <div className="analysis-panel">
        <h3>Geographic Coverage</h3>
        <DistanceDistributionChart distances={stats.distances} />
        <CoverageMap venues={venues} campaignCenter={campaignLocation} />
      </div>
      
      {/* Capacity Estimates (where available) */}
      <div className="analysis-panel">
        <h3>Capacity Estimates</h3>
        <CapacityEstimatesTable venues={venues} />
        <p className="capacity-disclaimer">
          Capacity estimates based on venue category proxies. 
          Not actual capacity. Verify on-site.
        </p>
      </div>
    </section>
  );
}
```

#### Venue Stats Computation

```typescript
function computeVenueStats(venues: GeoVenue[]) {
  const categories = {};
  const distances = [];
  let verifiedCount = 0;
  let rejectedCount = 0;
  let worthEvaluatingCount = 0;
  
  venues.forEach(v => {
    // Categories
    categories[v.category] = (categories[v.category] || 0) + 1;
    
    // Distances
    if (v.distance_m) {
      distances.push(v.distance_m);
    }
    
    // Verification status
    if (v.verification_status === 'verified') verifiedCount++;
    else if (v.verification_status === 'rejected') rejectedCount++;
    else worthEvaluatingCount++;
  });
  
  return {
    total: venues.length,
    categories,
    categoriesCount: Object.keys(categories).length,
    distances: distances.sort((a, b) => a - b),
    avgDistanceMi: distances.length ? round(mean(distances) * 0.000621371, 1) : 0,
    minDistanceMi: distances.length ? round(Math.min(...distances) * 0.000621371, 1) : 0,
    maxDistanceMi: distances.length ? round(Math.max(...distances) * 0.000621371, 1) : 0,
    verifiedCount,
    rejectedCount,
    worthEvaluatingCount,
  };
}
```

---

### 3. Plan Version Comparison

#### Purpose
Compare plan versions to see what changed between section regenerations.

#### Component: `PlanVersionComparison`

```tsx
function PlanVersionComparison({ plans }: { plans: Plan[] }) {
  const sortedPlans = [...plans].sort((a, b) => b.version - a.version);
  const currentPlan = sortedPlans[0];
  const previousPlan = sortedPlans[1];
  
  return (
    <section className="analysis-section" aria-labelledby="plan-comparison-title">
      <h2 id="plan-comparison-title">Plan Version Comparison</h2>
      
      <div className="version-selector">
        <label>
          Compare version:
          <select 
            value={currentPlan.version}
            onChange={e => setCurrentVersion(Number(e.target.value))}
          >
            {sortedPlans.map(p => (
              <option key={p.version} value={p.version}>
                Version {p.version} ({formatDate(p.created_at)})
                {p.planner === 'ai-model' ? ' — AI' : ' — Template'}
              </option>
            ))}
          </select>
        </label>
      </div>
      
      {previousPlan && (
        <div className="comparison-panels">
          <PlanDiff 
            oldPlan={previousPlan} 
            newPlan={currentPlan}
            fields={[
              'activities',
              'venues',
              'budget',
              'materials',
              'metrics',
              'assumptions',
              'limitations'
            ]}
          />
        </div>
      )}
      
      <div className="version-history">
        <h3>Version History</h3>
        <table className="version-history-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Date</th>
              <th>Planner</th>
              <th>Sections Changed</th>
              <th>Budget</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlans.map(p => (
              <tr key={p.version}>
                <td>v{p.version}</td>
                <td>{formatDate(p.created_at)}</td>
                <td>{p.planner === 'ai-model' ? 'AI Model' : 'Template'}</td>
                <td>{getChangedSections(p, sortedPlans[sortedPlans.indexOf(p) - 1])}</td>
                <td>{formatUSD(p.budget_total_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

#### Plan Diff Component

```tsx
function PlanDiff({ oldPlan, newPlan, fields }) {
  return (
    <div className="plan-diff">
      {fields.map(field => {
        const oldVal = oldPlan[field];
        const newVal = newPlan[field];
        const hasChanges = JSON.stringify(oldVal) !== JSON.stringify(newVal);
        
        if (!hasChanges) return null;
        
        return (
          <div key={field} className="field-diff">
            <h4>{field.charAt(0).toUpperCase() + field.slice(1)}</h4>
            <div className="diff-content">
              <div className="diff-old">
                <h5>Version {oldPlan.version}</h5>
                <pre>{JSON.stringify(oldVal, null, 2)}</pre>
              </div>
              <div className="diff-new">
                <h5>Version {newPlan.version}</h5>
                <pre>{JSON.stringify(newVal, null, 2)}</pre>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## Part 2: Exports

### Export Requirements

| Export | Format | Content | Privacy |
|--------|--------|---------|---------|
| Results | CSV | Aggregate results + campaign metadata | No PII, no secrets |
| Plan | PDF | Full plan (activities, venues, budget, materials, metrics) | Draft notices, no secrets |
| Evidence | JSON | Full evidence snapshot (Qloo signals, steps, OSM venues) | No raw provider responses, no secrets |

---

### 1. CSV Export (Results)

#### Endpoint: `GET /api/campaigns/{id}/export/csv`

```typescript
// Response: text/csv attachment
const csvHeaders = [
  'campaign_id',
  'topic',
  'location',
  'date',
  'registrations',
  'attendance',
  'spend_usd',
  'engagement',
  'cost_per_registration',
  'attendance_rate',
  'notes'
];

// Example output:
campaign_id,topic,location,date,registrations,attendance,spend_usd,engagement,cost_per_registration,attendance_rate,notes
cam_abc123,"Diabetes Screening","East Austin, TX","2026-10-27",180,135,4850,320,26.94,0.75,"Rain on day 2"
```

#### Implementation

```python
# apps/api/app/routers/api.py
@router.get("/campaigns/{campaign_id}/export/csv")
async def export_results_csv(campaign_id: str):
    campaign = await get_campaign(campaign_id)
    results = await get_results(campaign_id)
    analytics = await get_analytics(campaign_id)
    
    csv_content = generate_csv(campaign, results, analytics)
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="healthreach-results-{campaign_id}.csv"'
        }
    )
```

#### CSV Generation

```python
def generate_csv(campaign, results, analytics) -> str:
    rows = []
    row = {
        'campaign_id': campaign.id,
        'topic': campaign.brief.topic,
        'location': campaign.geocode.display_name if campaign.geocode else 'Unknown',
        'date': results.created_at.strftime('%Y-%m-%d'),
        'registrations': results.registrations,
        'attendance': results.attendance,
        'spend_usd': results.spend_inr,  # or spend_usd
        'engagement': results.engagement,
        'cost_per_registration': analytics.cost_per_registration or '',
        'attendance_rate': f"{analytics.attendance_rate:.2%}" if analytics.attendance_rate else '',
        'notes': results.notes or ''
    }
    # Use csv.writer for proper escaping
    return csv_string
```

---

### 2. PDF Export (Plan)

#### Endpoint: `GET /api/campaigns/{id}/export/pdf`

```python
@router.get("/campaigns/{campaign_id}/export/pdf")
async def export_plan_pdf(campaign_id: str):
    campaign = await get_campaign(campaign_id)
    plan = await get_latest_plan(campaign_id)
    evidence = await get_evidence(campaign_id)
    
    pdf_bytes = generate_plan_pdf(campaign, plan, evidence)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="healthreach-plan-{campaign_id}.pdf"'
        }
    )
```

#### PDF Generation (using reportlab)

```python
def generate_plan_pdf(campaign, plan, evidence) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    story.append(Paragraph(f"HealthReach Campaign Plan", styles['Title']))
    story.append(Paragraph(f"{campaign.brief.topic} — {campaign.geocode.display_name}", styles['Heading2']))
    story.append(Paragraph(f"Budget: ${plan.budget_total_usd:,} | Duration: {campaign.brief.duration_days} days", styles['Normal']))
    story.append(Spacer(1, 12))
    
    # Provenance legend
    story.append(Paragraph("Provenance Legend", styles['Heading3']))
    legend_data = [
        ['Symbol', 'Source', 'Description'],
        ['◈', 'Qloo', 'Taste affinity, never medical fact'],
        ['◎', 'Geo', 'OSM venues, needs verification'],
        ['✦', 'AI', 'Estimate/draft, inspect and approve'],
        ['●', 'User', 'Organizer input'],
    ]
    story.append(Table(legend_data))
    story.append(Spacer(1, 12))
    
    # Plan summary
    story.append(Paragraph("Plan Summary", styles['Heading2']))
    story.append(Paragraph(plan.summary, styles['Normal']))
    story.append(Spacer(1, 12))
    
    # Activities
    story.append(Paragraph("Activities", styles['Heading2']))
    act_data = [['Title', 'Channel', 'Why', 'Cost', 'Evidence Refs']]
    for a in plan.activities:
        act_data.append([
            a.title,
            a.channel,
            a.why,
            f"${a.cost_usd:,}",
            ', '.join(a.evidence_refs) or '—'
        ])
    story.append(Table(act_data, colWidths=[1.5*inch, 1*inch, 2.5*inch, 0.8*inch, 1.2*inch]))
    story.append(Spacer(1, 12))
    
    # Venues
    story.append(Paragraph("Venue Candidates", styles['Heading2']))
    venue_data = [['Name', 'Category', 'Reason', 'Status', 'Evidence Refs']]
    for v in plan.venues:
        venue_data.append([
            v.name,
            v.category,
            v.reason,
            v.status.replace('-', ' ').title(),
            ', '.join(v.evidence_refs) or '—'
        ])
    story.append(Table(venue_data))
    story.append(Spacer(1, 12))
    
    # Budget
    story.append(Paragraph("Budget", styles['Heading2']))
    budget_data = [['Line Item', 'Amount']]
    for b in plan.budget:
        budget_data.append([b.label, f"${b.amount_usd:,}"])
    budget_data.append(['Total', f"${plan.budget_total_usd:,}"])
    story.append(Table(budget_data))
    story.append(Spacer(1, 12))
    
    # Materials
    story.append(Paragraph("Draft Materials", styles['Heading2']))
    for m in plan.materials:
        story.append(Paragraph(f"<b>{m.kind.title()}: {m.title}</b>", styles['Normal']))
        story.append(Paragraph(m.body, styles['Normal']))
        story.append(Paragraph(f"<i>{m.review_notice}</i>", styles['Italic']))
        story.append(Spacer(1, 8))
    
    # Metrics
    story.append(Paragraph("Success Metrics", styles['Heading2']))
    metric_data = [['Metric', 'Target Range', 'Basis']]
    for m in plan.metrics:
        metric_data.append([m.name, m.target_range, m.basis])
    story.append(Table(metric_data))
    story.append(Spacer(1, 12))
    
    # Provenance & Limitations
    story.append(Paragraph("How This Plan Was Made", styles['Heading2']))
    story.append(Paragraph(f"Planner: {plan.planner.replace('-', ' ').title()}", styles['Normal']))
    story.append(Paragraph(f"Cultural Signals: {'Yes' if plan.has_cultural_signals else 'No'}", styles['Normal']))
    story.append(Spacer(1, 12))
    
    story.append(Paragraph("Assumptions", styles['Heading3']))
    for a in plan.assumptions:
        story.append(Paragraph(f"• {a}", styles['Normal']))
    
    story.append(Paragraph("Limitations", styles['Heading3']))
    for l in plan.limitations:
        story.append(Paragraph(f"• {l}", styles['Normal']))
    
    # Review notice on every page
    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.drawString(
            inch, 0.5 * inch,
            "Draft — requires review by a qualified health professional before use."
        )
        canvas.restoreState()
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    return buffer.getvalue()
```

---

### 3. JSON Export (Evidence Snapshot)

#### Endpoint: `GET /api/campaigns/{id}/export/json`

```python
@router.get("/campaigns/{campaign_id}/export/json")
async def export_evidence_json(campaign_id: str):
    evidence = await get_evidence(campaign_id)
    
    export_data = {
        "campaign_id": campaign_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "provenance": "mixed",
        "evidence": {
            "qloo_signals": [s.dict() for s in evidence.qloo_signals],
            "qloo_steps": [s.dict() for s in evidence.qloo_steps],
            "geo_venues": [v.dict() for v in evidence.geo_venues],
            "qloo_status": evidence.qloo_status,
            "qloo_note": evidence.qloo_note,
            "geo_status": evidence.geo_status,
            "geo_note": evidence.geo_note
        }
    }
    
    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": f'attachment; filename="healthreach-evidence-{campaign_id}.json"'
        }
    )
```

---

## Frontend Export UI

```tsx
function ExportPanel({ campaignId }: { campaignId: string }) {
  const [exporting, setExporting] = useState<Record<string, boolean>>({});
  
  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    setExporting(prev => ({ ...prev, [format]: true }));
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/export/${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healthreach-${format}-${campaignId}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(prev => ({ ...prev, [format]: false }));
    }
  };
  
  return (
    <section className="export-panel" aria-labelledby="export-title">
      <h2 id="export-title">Export Campaign Data</h2>
      <p className="export-description">
        Download campaign data for reporting and records. 
        All exports are privacy-preserving: no PII, no secrets, no raw provider responses.
      </p>
      
      <div className="export-buttons">
        <button 
          onClick={() => handleExport('csv')}
          disabled={exporting.csv}
          className="btn-secondary"
        >
          {exporting.csv ? 'Exporting...' : 'Download CSV (Results)'}
        </button>
        
        <button 
          onClick={() => handleExport('pdf')}
          disabled={exporting.pdf}
          className="btn-secondary"
        >
          {exporting.pdf ? 'Exporting...' : 'Download PDF (Plan)'}
        </button>
        
        <button 
          onClick={() => handleExport('json')}
          disabled={exporting.json}
          className="btn-secondary"
        >
          {exporting.json ? 'Exporting...' : 'Download JSON (Evidence)'}
        </button>
      </div>
      
      <div className="export-privacy">
        <h4>Privacy Guarantees</h4>
        <ul>
          <li>No patient names, phones, or medical data</li>
          <li>No API keys or secrets</li>
          <li>No raw Qloo/OSM provider responses</li>
          <li>Aggregate counts only</li>
        </ul>
      </div>
    </section>
  );
}
```

---

## Privacy & Security

### Export Privacy Rules

| Export | Includes | Excludes |
|--------|----------|----------|
| CSV (Results) | Campaign metadata, aggregate counts, derived metrics | PII, secrets, raw provider responses |
| PDF (Plan) | Full plan with provenance, review notices | Secrets, raw provider responses |
| JSON (Evidence) | Qloo signals, chain steps, OSM venues, statuses | Raw provider responses, secrets |

### Security Checks

```python
def validate_export_privacy(export_data: dict) -> bool:
    """Ensure no sensitive data in exports."""
    forbidden_keys = {'api_key', 'secret', 'password', 'token', 'key'}
    forbidden_patterns = [r'\b\d{3}-\d{2}-\d{4}\b', r'\b[\w.]+@[\w.]+\b']  # SSN, email
    
    def check_obj(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k.lower() in forbidden_keys:
                    return False
                if not check_obj(v):
                    return False
        elif isinstance(obj, list):
            for item in obj:
                if not check_obj(item):
                    return False
        elif isinstance(obj, str):
            for pattern in forbidden_patterns:
                if re.search(pattern, obj):
                    return False
        return True
    
    return check_obj(export_data)
```

---

## Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-EV-001 | Evidence Dashboard shows Qloo signals + chain steps | Visual test |
| AC-EV-002 | Venue Analysis shows category breakdown + verification | Visual test |
| AC-EV-003 | Plan Version Comparison shows diffs | Visual test |
| AC-EX-001 | CSV export downloads with correct columns | Integration test |
| AC-EX-002 | PDF export includes all plan sections + review notices | Visual test |
| AC-EX-003 | JSON export includes Qloo signals + steps + OSM venues | Integration test |
| AC-EX-004 | No PII/secrets in any export | Security scan |
| AC-EX-005 | Export buttons show loading state | Visual test |
| AC-EX-006 | Privacy guarantees displayed | Visual test |

---

## Implementation Notes

### Files to Create
- `apps/web/components/analysis/EvidenceDashboard.tsx`
- `apps/web/components/analysis/VenueAnalysis.tsx`
- `apps/web/components/analysis/PlanVersionComparison.tsx`
- `apps/web/components/export/ExportPanel.tsx`
- `apps/api/app/routers/api.py` — Add export endpoints

### Dependencies
```json
{
  "recharts": "^2.10.0",
  "reportlab": "^4.0.0"
}
```

### API Endpoints Added
- `GET /api/campaigns/{id}/export/csv`
- `GET /api/campaigns/{id}/export/pdf`
- `GET /api/campaigns/{id}/export/json`

---

## Rollout Plan

1. **Branch**: `feat/analysis-views`
2. **Implement** analysis views + export endpoints
3. **Test** unit + integration + privacy validation
4. **Merge** to `integration/healthreach-redesign`

---

*Related: [Evidence Dashboard](docs/integrations/QLOO_INTEGRATION.md) · [Export Privacy](docs/architecture/SECURITY_AND_PRIVACY.md) · [Visualization Guidelines](docs/frontend/VISUALIZATION_GUIDELINES.md)*