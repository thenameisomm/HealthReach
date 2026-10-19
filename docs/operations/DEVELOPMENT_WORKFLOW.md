# Development Workflow — HealthReach AI

## Daily Commands

```bash
# Start development (both services)
pnpm dev

# Frontend only
pnpm dev:web

# Backend only
pnpm dev:api

# Run all checks before commit
pnpm lint
pnpm typecheck
pnpm build
cd apps/api && uv run pytest -m "not live"

# Format code
pnpm exec prettier --write .
```

## Git Workflow

### Branch Strategy

```
main (protected)
  └── integration/healthreach-redesign (integration branch)
        ├── docs/documentation-system
        ├── docs/api-contracts
        ├── docs/frontend-quality-ops
        ├── feat/location-autocomplete-v2
        ├── feat/click-map-v2
        ├── feat/qloo-call-counter
        ├── feat/results-map
        ├── feat/analysis-views
        └── test/acceptance-coverage
```

### Creating a Feature Branch

```bash
# From integration branch
git checkout integration/healthreach-redesign
git pull origin integration/healthreach-redesign
git checkout -b feat/your-feature-name
```

### Commit Conventions

Use Conventional Commits:

| Type | Example |
|---|---|
| `feat:` | `feat: add location autocomplete debounce` |
| `fix:` | `fix: prevent stale autocomplete requests` |
| `docs:` | `docs: update API contracts for evidence endpoint` |
| `test:` | `test: add Qloo chain skip handling tests` |
| `refactor:` | `refactor: extract provenance badge component` |
| `chore:` | `chore: update dependencies` |
| `perf:` | `perf: cache Nominatim geocode results` |

**Format**: `<type>(<scope>): <description>`

### Before Commit

```bash
# 1. Check status
git status

# 2. Review diff
git diff
git diff --cached

# 3. Run relevant checks
pnpm lint
pnpm typecheck
# If backend changes:
cd apps/api && uv run pytest -m "not live" -x

# 4. Stage intentionally
git add -p  # or specific files
git commit -m "feat: your change description"
```

### Pushing & PRs

```bash
# Push feature branch
git push -u origin feat/your-feature-name

# Create PR via GitHub CLI (if available)
gh pr create --base integration/healthreach-redesign --head feat/your-feature-name

# Or via GitHub web UI
```

### Merging

```bash
# After PR approved and checks pass
# Merge via GitHub (squash or merge commit)

# Local merge (if PR not available)
git checkout integration/healthreach-redesign
git pull origin integration/healthreach-redesign
git merge feat/your-feature-name
git push origin integration/healthreach-redesign
```

### Keeping Branches Updated

```bash
# On feature branch
git fetch origin
git rebase origin/integration/healthreach-redesign
# Resolve conflicts, then force-push (only your branch)
git push -u origin feat/your-feature-name --force-with-lease
```

---

## Code Standards

### TypeScript (Frontend)

- **Strict mode**: `tsc --noEmit` must pass
- **No `any`** without justification comment
- **Prettier**: `pnpm exec prettier --write .`
- **ESLint**: `next/core-web-vitals` config
- **Types from API**: `lib/api.ts` mirrors OpenAPI, regenerate via `pnpm generate:api`

### Python (Backend)

- **Type hints**: Full annotation, mypy strict
- **Pydantic v2**: All request/response models
- **Async**: `async`/`await` throughout, `httpx.AsyncClient`
- **Tests**: `pytest` + `pytest-asyncio`, mocks via `respx`
- **Format**: `ruff format` or `black` (if configured)

### Shared

- **Provenance-first**: Every value carries source (qloo|geo|ai|user|illustrative)
- **Honest statuses**: `ok` | `thin` | `unavailable` — never fake data
- **Privacy**: Aggregate only, no PII, no patient data
- **Accessibility**: Semantic HTML, keyboard, screen reader, provenance not color-only

---

## Testing Workflow

### Backend Tests

```bash
cd apps/api

# All CI tests (unit + integration, mocked)
uv run pytest -m "not live" -v

# With coverage
uv run pytest -m "not live" --cov=app --cov-report=term-missing

# Specific test file
uv run pytest tests/test_pipeline.py -v

# Live tests (manual, requires keys)
uv run pytest -m "live" -v
```

### Frontend Checks

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Build (validates production compile)
pnpm build

# Generate API types (API must be running)
pnpm generate:api
```

### Manual QA

See [MANUAL_QA.md](../quality/MANUAL_QA.md) for browser test scenarios.

---

## Debugging

### Backend Logs

```bash
# Development logs in console
# Set LOG_LEVEL=DEBUG for verbose
LOG_LEVEL=DEBUG pnpm dev:api
```

### Common Debug Commands

```bash
# Check API health
curl http://localhost:8000/health

# Check API config
curl http://localhost:8000/api/config

# Test specific endpoint
curl -X POST http://localhost:8000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"brief":{"topic":"test","location_text":"Austin,TX",...},"mode":"demo"}'

# View OpenAPI schema
curl http://localhost:8000/openapi.json | jq .
```

### Database Inspection

```bash
# MongoDB shell
docker exec -it <mongo_container> mongosh healthreach

# Or with connection string
mongosh "mongodb://localhost:27017/healthreach"

# Useful queries
db.campaigns.find().sort({created_at: -1}).limit(5)
db.evidence_snapshots.findOne({campaign_id: "cam_123"})
db.plans.find({campaign_id: "cam_123"}).sort({version: -1})
```

---

## Dependency Management

### Frontend (pnpm)

```bash
# Add dependency
pnpm add <package>           # Production
pnpm add -D <package>        # Dev
pnpm add <package> -w        # Workspace root

# Update
pnpm update
pnpm update --latest

# Audit
pnpm audit
```

### Backend (uv/pip)

```bash
cd apps/api

# Add dependency
uv add <package>

# Add dev dependency
uv add --dev <package>

# Update lockfile
uv lock --upgrade

# Sync environment
uv sync
```

### Lockfile Policy

- **Commit lockfiles**: `pnpm-lock.yaml`, `apps/api/uv.lock`
- **Update together**: When updating deps, update both lockfiles
- **Audit before update**: `pnpm audit`, `uv pip audit`

---

## CI/CD (Planned)

### GitHub Actions Workflows

```yaml
# .github/workflows/ci.yml (planned)
on: [push, pull_request]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build
  
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: cd apps/api && uv sync
      - run: cd apps/api && uv run pytest -m "not live"
  
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

## Release Process

See [RELEASE_CHECKLIST.md](../quality/RELEASE_CHECKLIST.md)

---

## Troubleshooting Development Issues

| Issue | Solution |
|---|---|
| `pnpm dev` corrupts `.next` | Never run `pnpm build` while `pnpm dev` running |
| Python import errors | `cd apps/api && uv sync` |
| Port 3000/8000 in use | `lsof -ti:3000 | xargs kill -9` |
| API parity check fails | Ensure API running, then `pnpm generate:api` |
| MongoDB connection refused | Start MongoDB or remove `MONGODB_URI` for in-memory |
| CORS errors | Check `CORS_ORIGINS` includes frontend origin |
| Dark mode not working | Check `.dark` class on `<html>`, Tailwind config |

---

*Related: [Getting Started](GETTING_STARTED.md) · [Configuration](CONFIGURATION.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Test Strategy](../quality/TEST_STRATEGY.md)*