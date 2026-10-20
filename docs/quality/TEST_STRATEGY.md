# Test Strategy — HealthReach AI

## Testing Philosophy

- **Network-isolated by default**: All CI tests use mocks/fixtures. No live external calls in CI.
- **Honest testing**: Never claim live integration passed if only mocks were used.
- **Contract-first**: API contracts define expected behavior; tests verify contracts.
- **Regression prevention**: Add test for every honesty-relevant behavior change.
- **Accessibility as default**: axe-core in CI, manual screen reader testing per release.

## Test Pyramid

```
                    ┌─────────────────┐
                    │  E2E (Manual)   │  ← Browser QA, Puppeteer in /tmp
                    │  ~10 scenarios  │
              ┌─────┴─────┐
              │ Integration│  ← API flow, component + API
              │  ~50 tests │
        ┌─────┴─────┐
        │   Unit    │  ← Pure functions, orchestrator logic
        │  ~200 tests│
        └───────────┘
```

---

## Backend Testing (Python/pytest)

### Structure

```
apps/api/tests/
├── test_pipeline.py      # Core pipeline: budget, LLM, Qloo chain, regen, demo isolation
├── test_api_flow.py      # End-to-end API: create→evidence→plan→results→analytics
├── fixtures/
│   ├── qloo_step1_places.json
│   ├── qloo_step2_tags.json
│   ├── qloo_step3_tags.json
│   ├── qloo_empty.json
│   ├── qloo_auth_error.json
│   ├── nominatim_geocode.json
│   ├── nominatim_reverse.json
│   ├── nominatim_suggest.json
│   ├── overpass_venues.json
│   └── overpass_empty.json
└── conftest.py           # Fixtures, async config, mock setup
```

### Test Categories

| Category | Marker | Runs In CI | Purpose |
|---|---|---|---|
| Unit | (default) | ✅ | Pure functions, orchestrators, validators |
| Integration | (default) | ✅ | API endpoints with mocked externals |
| Live | `@pytest.mark.live` | ❌ | Real Qloo, Nominatim, Overpass, LLM |

### Key Test Patterns

```python
# 1. Mock external services at the adapter level
async def test_qloo_chain_three_steps(mock_qloo):
    mock_qloo.step1.return_value = load_fixture("qloo_step1_places.json")
    mock_qloo.step2.return_value = load_fixture("qloo_step2_tags.json")
    mock_qloo.step3.return_value = load_fixture("qloo_step3_tags.json")
    
    signals, steps, status, note = await fetch_cultural_signals(...)
    
    assert status == "ok"
    assert len(steps) == 3
    assert all(s.status == "ok" for s in steps)

# 2. Test honest status propagation
async def test_qloo_auth_failure_returns_unavailable(mock_qloo):
    mock_qloo.side_effect = QlooAuthError("401")
    
    signals, steps, status, note = await fetch_cultural_signals(...)
    
    assert status == "thin"  # or unavailable per contract
    assert "key was rejected" in note.lower()

# 3. Test budget exactness
def test_planner_budget_exact():
    plan = build_plan(brief_budget=5000, ...)
    assert sum(b.amount_inr for b in plan.budget) == 5000

# 4. Test LLM fallback
async def test_llm_fallback_to_template(mock_llm):
    mock_llm.side_effect = ValidationError("bad json")
    
    plan = await build_plan(..., llm_available=True)
    
    assert plan.planner == "standard-template"

# 5. Test null-safe analytics
def test_analytics_zero_registrations():
    analytics = compute_analytics(plan, results_zero_reg)
    assert analytics.cost_per_registration is None
    assert "Not calculable" in analytics.note
```

### Fixture Management

- Fixtures stored as JSON in `tests/fixtures/`
- Loaded via `load_fixture(name)` helper
- Updated when live behavior changes (recorded manually)
- Version-controlled — no auto-generation in CI

### Running Tests

```bash
# All CI tests (unit + integration, no network)
cd apps/api && uv run pytest -m "not live" -v

# With coverage
cd apps/api && uv run pytest -m "not live" --cov=app --cov-report=term-missing

# Live tests (manual, requires keys)
cd apps/api && uv run pytest -m "live" -v
```

---

## Frontend Testing

### Current State

| Check | Tool | Command | Status |
|---|---|---|---|
| TypeScript | tsc | `pnpm typecheck` | ✅ Passing |
| Lint | ESLint | `pnpm lint` | ✅ Passing |
| Build | Next.js | `pnpm build` | ✅ Passing |
| Unit | — | — | ❌ Not configured |
| Integration | — | — | ❌ Not configured |
| E2E | Puppeteer | Manual in `/tmp` | ✅ Manual |
| Accessibility | axe-core | Planned | ❌ Not configured |

### Planned Frontend Tests

#### Unit Tests (React Testing Library)

```typescript
// components/__tests__/ProvenanceBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';

test('renders correct icon, label, border for each provenance', () => {
  const { rerender } = render(<ProvenanceBadge provenance="qloo" showLabel />);
  expect(screen.getByLabelText('Qloo signal')).toBeInTheDocument();
  expect(screen.getByTestId('provenance-border')).toHaveClass('border-indigo-600');
  
  rerender(<ProvenanceBadge provenance="illustrative" showLabel />);
  expect(screen.getByLabelText('Illustrative data')).toBeInTheDocument();
  expect(screen.getByTestId('provenance-border')).toHaveClass('border-dashed');
});
```

#### Integration Tests (MSW)

```typescript
// tests/integration/brief-form.test.tsx
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewPage from '@/app/new/page';

const server = setupServer(
  rest.post('/api/campaigns', (req, res, ctx) => {
    return res(ctx.json({ data: { id: 'cam_123', ... } }));
  })
);

test('brief form submits and redirects', async () => {
  const user = userEvent.setup();
  render(<NewPage />);
  
  await user.type(screen.getByLabelText('Topic'), 'Diabetes screening');
  await user.type(screen.getByLabelText('Location'), 'East Austin');
  // ... fill all fields
  await user.click(screen.getByRole('button', { name: /create outreach plan/i }));
  
  await waitFor(() => expect(window.location.pathname).toMatch('/campaigns/'));
});
```

#### E2E Tests (Playwright)

```typescript
// tests/e2e/campaign-flow.spec.ts
import { test, expect } from '@playwright/test';

test('full campaign flow: brief → evidence → plan → results', async ({ page }) => {
  await page.goto('/new');
  
  // Fill brief
  await page.fill('[name="topic"]', 'Free diabetes screening');
  await page.fill('[name="location_text"]', 'East Austin, TX');
  // ... fill rest
  await page.click('button:has-text("Create outreach plan")');
  
  // Wait for evidence
  await expect(page.locator('text=Local Information')).toBeVisible();
  await page.click('button:has-text("Create outreach plan")');
  
  // Wait for plan
  await expect(page.locator('text=Draft Plan')).toBeVisible();
  
  // Enter results
  await page.click('button:has-text("Enter results")');
  await page.fill('[name="registrations"]', '180');
  // ...
  await page.click('button:has-text("Save results")');
  
  // Verify analytics
  await expect(page.locator('text=Planned vs Actual')).toBeVisible();
  await expect(page.locator('text=Descriptive, not causal')).toBeVisible();
});
```

#### Accessibility Tests (axe-core)

```typescript
// tests/accessibility/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing page has no accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('workspace page has no accessibility violations', async ({ page }) => {
  await page.goto('/campaigns/test-id'); // mocked
  const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
```

---

## Test Data Management

### Principles

- **No real PII in tests** — even in fixtures
- **Fixtures version-controlled** — JSON in `tests/fixtures/`
- **Deterministic** — same input → same output
- **Isolated** — each test creates own data, no shared state

### Demo vs Real Test Data

| Data Type | Source |
|---|---|
| Unit test input | Inline or fixture |
| Integration test input | Fixture + factory |
| E2E test input | MSW handlers + factory |
| Live test input | Real API (manual only) |

---

## CI/CD Integration

### GitHub Actions (Planned)

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: cd apps/api && uv sync
      - run: cd apps/api && uv run pytest -m "not live" --cov=app
  
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build
  
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm dev &
      - run: sleep 10
      - run: npx @axe-core/cli http://localhost:3000 --tags wcag2aa
```

---

## Manual QA Process

See [MANUAL_QA.md](MANUAL_QA.md) for browser QA scripts, viewports, and checklists.

---

## Release Verification

Before any release:

1. ✅ All CI tests pass
2. ✅ `pnpm typecheck` clean
3. ✅ `pnpm lint` clean
4. ✅ `pnpm build` succeeds
5. ✅ `pytest -m "not live"` all pass (45 tests)
6. ✅ Manual QA: desktop (1280×900) + mobile (390×844)
7. ✅ Accessibility: axe-core zero violations
8. ✅ No secrets in build output
9. ✅ Documentation links valid

---

## Metrics & Reporting

| Metric | Target | Current |
|---|---|---|
| Backend test count | ≥ 40 | 45 |
| Backend coverage | ≥ 90% | ~85% |
| Frontend type errors | 0 | 0 |
| ESLint errors | 0 | 0 |
| Axe violations (WCAG 2.1 AA) | 0 | Not measured |
| Live integration verified | Per release | Manual only |

---

*Related: [Acceptance Criteria](ACCEPTANCE_CRITERIA.md) · [Manual QA](MANUAL_QA.md) · [Release Checklist](RELEASE_CHECKLIST.md)*