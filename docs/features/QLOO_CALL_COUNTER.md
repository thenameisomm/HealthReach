# Feature Specification: QlooCallCounter

## Overview

Real-time progress indicator showing actual backend-observed Qloo API activity during evidence gathering. Displays 3-step chain progress, actual provider request counts, retries, cache hits, and step completion status.

**Current State**: Evidence loading shows basic `ProgressStatus` component with generic loading state.

**Target**: Detailed QlooCallCounter component that accurately reflects backend provider activity — not frontend polling.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-QC-001 | Display current step (1/3, 2/3, 3/3) with plain-language titles | P0 |
| FR-QC-002 | Show actual provider request count (not frontend polls) | P0 |
| FR-QC-003 | Distinguish: successful requests, retries, cache hits, failed steps | P0 |
| FR-QC-004 | Per-step status: pending, in-progress, completed, skipped, failed | P0 |
| FR-QC-005 | Plain-language skip reasons (no technical jargon) | P0 |
| FR-QC-006 | Backend-observed progress (not frontend-inferred) | P0 |
| FR-QC-007 | Live updates during evidence gathering | P0 |
| FR-QC-008 | Accessible: aria-live, keyboard navigable | P0 |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-QC-001 | Progress accuracy | Backend-observed, not frontend polling |
| NFR-QC-002 | Update frequency | Real-time during evidence gathering |
| NFR-QC-003 | Accessibility | aria-live="polite", semantic HTML |
| NFR-QC-004 | Retry distinction | Separate counter for retries vs new requests |

---

## Backend API Contract

### Extended Evidence Endpoint

**Current**: `POST /api/campaigns/{id}/evidence` returns full `EvidenceSnapshot` after completion.

**Extended**: Add progress streaming endpoint or include progress in evidence response.

### Option A: Polling Progress Endpoint (Simpler)

**Endpoint**: `GET /api/campaigns/{id}/evidence/progress`

**Response (200):**
```json
{
  "data": {
    "campaign_id": "cam_abc123",
    "total_requests": 5,
    "requests_by_step": {
      "1": 2,
      "2": 2,
      "3": 1
    },
    "retries": 1,
    "cache_hits": 0,
    "steps": [
      {
        "step": 1,
        "status": "completed",
        "requests_made": 2,
        "retries": 1,
        "cache_hits": 0,
        "started_at": "2026-10-20T15:30:05Z",
        "completed_at": "2026-10-20T15:30:12Z"
      },
      {
        "step": 2,
        "status": "in_progress",
        "requests_made": 1,
        "retries": 0,
        "cache_hits": 0,
        "started_at": "2026-10-20T15:30:12Z"
      },
      {
        "step": 3,
        "status": "pending",
        "requests_made": 0,
        "retries": 0,
        "cache_hits": 0
      }
    ],
    "overall_status": "in_progress",
    "current_step": 2
  },
  "meta": { "timestamp": "2026-10-20T15:30:15Z" }
}
```

### Option B: Server-Sent Events (Real-time)

**Endpoint**: `GET /api/campaigns/{id}/evidence/stream`

**Event Stream:**
```
event: step_start
data: {"step": 1, "title": "Looked at culture spots near here"}

event: request_start
data: {"step": 1, "attempt": 1}

event: request_complete
data: {"step": 1, "attempt": 1, "cached": false, "results": 3}

event: step_complete
data: {"step": 1, "status": "ok", "found": "3 places..."}

event: step_start
data: {"step": 2, "title": "Checked what fans of East Austin Community Center also like"}

... etc ...
```

**Decision**: Use **Option A (polling)** for simplicity and reliability. Poll every 2 seconds during evidence gathering.

---

## Frontend Component Specification

### Props Interface

```typescript
interface QlooCallCounterProps {
  campaignId: string;
  initialProgress?: QlooProgress;  // From initial evidence response
  onComplete?: (evidence: EvidenceSnapshot) => void;
}

interface QlooProgress {
  total_requests: number;
  requests_by_step: Record<string, number>;
  retries: number;
  cache_hits: number;
  steps: QlooStepProgress[];
  overall_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  current_step: number;
}

interface QlooStepProgress {
  step: 1 | 2 | 3;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  requests_made: number;
  retries: number;
  cache_hits: number;
  title: string;
  started_at?: string;
  completed_at?: string;
  skip_reason?: string;
}
```

### Component Structure

```tsx
function QlooCallCounter({ campaignId, initialProgress, onComplete }) {
  const [progress, setProgress] = useState<QlooProgress>(initialProgress);
  const [polling, setPolling] = useState(false);

  // Poll every 2s during evidence gathering
  useEffect(() => {
    if (progress.overall_status === 'in_progress') {
      const interval = setInterval(() => fetchProgress(), 2000);
      return () => clearInterval(interval);
    }
  }, [progress.overall_status]);

  return (
    <section aria-live="polite" aria-label="Qloo evidence gathering progress">
      {/* Overall progress header */}
      <div className="progress-header">
        <span>Evidence gathering: Step {progress.current_step} of 3</span>
        <span className="request-count">
          {progress.total_requests} Qloo requests
          {progress.retries > 0 && <span className="retry-badge">+{progress.retries} retries</span>}
          {progress.cache_hits > 0 && <span className="cache-badge">{progress.cache_hits} cached</span>}
        </span>
      </div>

      {/* Step cards */}
      <ol className="step-list">
        {progress.steps.map(step => (
          <StepCard key={step.step} step={step} />
        ))}
      </ol>

      {/* Overall status */}
      <StatusBadge status={progress.overall_status} />
    </section>
  );
}
```

### Step Card Component

```tsx
function StepCard({ step }: { step: QlooStepProgress }) {
  const statusColors = {
    pending: 'text-muted',
    in_progress: 'text-primary',
    completed: 'text-success',
    skipped: 'text-warning',
    failed: 'text-error'
  };

  return (
    <li className="step-card">
      <div className="step-header">
        <span className="step-number">Step {step.step}</span>
        <span className={statusColors[step.status]}>{step.title}</span>
        <StatusIndicator status={step.status} />
      </div>

      <div className="step-meta">
        <span>Requests: {step.requests_made}</span>
        {step.retries > 0 && <span className="retry">Retries: {step.retries}</span>}
        {step.cache_hits > 0 && <span className="cached">Cached: {step.cache_hits}</span>}
      </div>

      {step.status === 'skipped' && (
        <p className="skip-reason" role="alert">
          Skipped: {step.skip_reason}
        </p>
      )}

      {step.status === 'failed' && (
        <p className="error-reason" role="alert">
          Failed: {step.skip_reason}
        </p>
      )}
    </li>
  );
}
```

---

## Backend Implementation

### Progress Tracking in `qloo_client.py`

```python
class QlooProgressTracker:
    def __init__(self):
        self.steps: list[QlooStepProgress] = []
        self.total_requests = 0
        self.retries = 0
        self.cache_hits = 0
        self.current_step = 0

    async def track_step(self, step_num: int, title: str, coro, *args, **kwargs):
        self.current_step = step_num
        step_progress = QlooStepProgress(
            step=step_num,
            status='in_progress',
            requests_made=0,
            retries=0,
            cache_hits=0,
            title=title,
            started_at=datetime.now(timezone.utc)
        )
        self.steps.append(step_progress)

        try:
            result = await coro(*args, **kwargs)
            step_progress.status = 'completed'
            step_progress.completed_at = datetime.now(timezone.utc)
            return result
        except Exception as e:
            step_progress.status = 'failed'
            step_progress.skip_reason = str(e)
            raise
```

### Modified `fetch_cultural_signals`

```python
async def fetch_cultural_signals(...) -> tuple[...]:
    tracker = QlooProgressTracker()
    
    # Step 1
    places = await tracker.track_step(1, "Looked at culture spots near here", _fetch_places, ...)
    
    # Step 2
    if places:
        tags_two = await tracker.track_step(2, f"Checked what fans of {places[0].name} also like", _fetch_tags, ...)
    
    # Step 3
    if len(places) > 1:
        tags_three = await tracker.track_step(3, f"Double-checked with {places[1].name}", _fetch_tags, ...)
    
    # Return signals + steps + progress data
    return signals, tracker.steps, status, note, tracker.get_progress()
```

### Progress Endpoint in `api.py`

```python
@router.get("/campaigns/{campaign_id}/evidence/progress")
async def get_evidence_progress(campaign_id: str):
    # Fetch from in-memory tracker or Redis
    # For MVP: store progress in campaign document or in-memory dict
    return progress_data
```

---

## Frontend Polling Logic

```typescript
// In campaign workspace component
function useEvidenceProgress(campaignId: string, isLoading: boolean) {
  const [progress, setProgress] = useState<QlooProgress | null>(null);

  useEffect(() => {
    if (!isLoading) return;

    const poll = async () => {
      try {
        const res = await api.campaigns.getEvidenceProgress(campaignId);
        setProgress(res.data);
        
        if (res.data.overall_status === 'completed') {
          setIsLoading(false);
          // Fetch full evidence
          const evidence = await api.campaigns.getEvidence(campaignId);
          setEvidence(evidence.data);
        }
      } catch (e) {
        // Handle error silently, retry
      }
    };

    const interval = setInterval(poll, 2000);
    poll(); // Initial fetch
    return () => clearInterval(interval);
  }, [campaignId, isLoading]);

  return progress;
}
```

---

## Accessibility

### Live Region
```tsx
<section aria-live="polite" aria-label="Qloo evidence gathering progress">
  {/* Progress content */}
</section>
```

### Status Announcements
- Step completion: "Step 1 completed. Step 2 started."
- Retry: "Retrying step 1, attempt 2"
- Skip: "Step 2 skipped: The first check didn't find places"
- Error: "Step 1 failed: The Qloo key was rejected"

### Keyboard Navigation
- Focusable step cards (if interactive)
- Tab order follows visual order
- Escape to dismiss (if modal)

---

## Testing Requirements

### Unit Tests (Backend)
- [ ] Progress tracker increments requests correctly
- [ ] Retries counted separately from new requests
- [ ] Cache hits tracked
- [ ] Skip reasons captured
- [ ] Step timing recorded

### Unit Tests (Frontend)
- [ ] Polling starts/stops with evidence loading state
- [ ] Step cards render correct status
- [ ] Retry badge shows correct count
- [ ] Cache badge shows correct count
- [ ] Skip reason displayed
- [ ] aria-live announcements work

### Integration Tests
- [ ] Full evidence gathering shows correct progress
- [ ] Polling stops when evidence complete
- [ ] Error handling: polling continues on transient errors
- [ ] Progress matches actual backend requests (mocked)

### Accessibility Tests
- [ ] aria-live="polite" on progress container
- [ ] Status changes announced
- [ ] Semantic HTML (ol/li for steps)
- [ ] Color contrast for status indicators

---

## Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-QC-001 | Shows 3 steps with correct titles | Visual test |
| AC-QC-002 | Displays actual provider request count | Integration test (mocked) |
| AC-QC-003 | Distinguishes retries from new requests | Unit test |
| AC-QC-004 | Cache hits tracked separately | Unit test |
| AC-QC-005 | Step statuses: pending/in-progress/completed/skipped | Visual test |
| AC-QC-006 | Skip reasons in plain language | Visual test |
| AC-QC-007 | Progress from backend, not frontend polling | Code review |
| AC-QC-008 | Live updates during evidence gathering | E2E test |
| AC-QC-008 | Accessible: aria-live, semantic HTML | axe-core |

---

## Rollout Plan

1. **Branch**: `feat/qloo-call-counter`
2. **Backend**: Add progress tracking to `qloo_client.py`, add `/evidence/progress` endpoint
3. **Frontend**: Create `QlooCallCounter` component, integrate in workspace
4. **Test** unit + integration + accessibility
5. **Merge** to `integration/healthreach-redesign`

---

*Related: [Qloo Agent Chain](docs/integrations/QLOO_AGENT_CHAIN.md) · [Evidence Gathering](docs/integrations/QLOO_INTEGRATION.md) · [API Contracts](docs/api/API_CONTRACTS.md)*