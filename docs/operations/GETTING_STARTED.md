# Getting Started — HealthReach AI

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18 | `brew install node` / `nvm install 18` |
| pnpm | ≥ 9 | `corepack enable && corepack prepare pnpm@latest --activate` |
| Python | ≥ 3.11 | `brew install python@3.11` |
| MongoDB | 7 (optional) | `docker run -d -p 27017:27017 mongo:7` |
| uv | latest | `pip install uv` |

**Verify**:
```bash
node --version    # v18+
pnpm --version    # 9+
python --version  # 3.11+
uv --version      # latest
```

---

## Quick Start (3 Commands)

```bash
# 1. Clone and enter
git clone https://github.com/thenameisomm/HealthReach.git
cd HealthReach

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in keys you have (all optional for demo)

# 3. Install & run
pnpm install
pnpm dev
```

**Open**: http://localhost:3000

- **Web**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/openapi.json
- **Health**: http://localhost:8000/health

---

## Environment Configuration

### `.env` (Local, Never Committed)

```bash
# Qloo — cultural affinity signals (optional for demo)
QLOO_API_KEY=your_qloo_key_here
QLOO_BASE_URL=https://api.qloo.com

# LLM — AI-drafted plans (optional, fallback to template)
LLM_API_KEY=your_openai_compatible_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# MongoDB — persistence (optional, in-memory fallback)
MONGODB_URI=mongodb://localhost:27017/healthreach

# CORS — frontend origin
CORS_ORIGINS=http://localhost:3000

# Frontend API URL (public, not secret)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `.env.example` (Committed Template)

All keys empty — copy to `.env` and fill as needed.

### Key Behaviors When Empty

| Variable | Empty Behavior |
|---|---|
| `QLOO_API_KEY` | Qloo section shows "unavailable", plan flagged, retry offered |
| `LLM_API_KEY` | Deterministic template planner used (same schema, exact budget) |
| `MONGODB_URI` | In-memory fallback (data lost on restart) |
| `CORS_ORIGINS` | Defaults to `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Defaults to `http://localhost:8000` |

---

## Running the Application

### Development (Both Services)

```bash
pnpm dev
# Runs: web (:3000) + api (:8000) via Turborepo
```

### Individual Services

```bash
# Web only
pnpm dev:web

# API only
pnpm dev:api
# Or directly:
cd apps/api && uv run uvicorn app.main:app --reload
```

### Production Build

```bash
# Build all
pnpm build
# Note: Restart dev after build — never build while dev runs (corrupts .next)
```

### Database

```bash
# Start MongoDB (if not using in-memory)
docker run -d -p 27017:27017 mongo:7

# Reset (dev only)
# No migrations needed — Motor creates collections on first write
```

---

## Verifying Installation

### 1. Health Checks

```bash
# API health
curl http://localhost:8000/health
# {"status":"ok","qloo_configured":false,"llm_configured":false,"mongodb_connected":false}

# API config
curl http://localhost:8000/api/config
# {"qloo_configured":false,"llm_configured":false,"demo_mode_available":true}
```

### 2. Demo Flow (No Keys Required)

1. Open http://localhost:3000
2. Click "See a working example"
3. Verify Kothrud demo loads with illustrative data banner
4. Complete full flow: evidence → plan → results → analytics

### 3. API Parity Check

```bash
# API must be running
pnpm generate:api
# Verifies TypeScript client matches live OpenAPI schema
```

### 4. Run Tests

```bash
# Backend tests
pnpm --filter @healthreach/api test
# Or directly:
cd apps/api && uv run pytest -m "not live" -v

# Frontend checks
pnpm typecheck
pnpm lint
```

---

## Project Structure

```
HealthReach/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   └── api/          # FastAPI backend
├── packages/
│   ├── ui/           # Design tokens + provenance metadata
│   └── tsconfig/     # Shared TypeScript config
├── docs/             # Documentation (this file)
├── .env.example      # Environment template
├── AGENTS.md         # Contributor instructions
├── README.md         # User-facing documentation
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## Common Issues

### Port Already in Use

```bash
# Find and kill
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

### Build Corrupts `.next`

```bash
# Never run pnpm build while pnpm dev is running
# If corrupted:
rm -rf apps/web/.next
pnpm build
```

### Python Import Errors

```bash
cd apps/api
uv sync  # Re-installs dependencies
```

### MongoDB Connection Failed

```bash
# Check if running
docker ps | grep mongo
# Or use in-memory fallback (remove MONGODB_URI from .env)
```

### API Parity Check Fails

```bash
# Ensure API is running first
pnpm dev:api &
sleep 5
pnpm generate:api
```

---

## Next Steps

- **Explore the demo**: Click "See a working example" on landing
- **Read the docs**: Start with `docs/README.md`
- **Check the API**: http://localhost:8000/docs (Swagger UI)
- **Run tests**: `pnpm --filter @healthreach/api test`

---

## Support

- **Issues**: GitHub Issues
- **Documentation**: `docs/README.md`
- **Architecture**: `docs/architecture/SYSTEM_OVERVIEW.md`
- **Contributing**: `AGENTS.md`

---

*Related: [Configuration](CONFIGURATION.md) · [Development Workflow](DEVELOPMENT_WORKFLOW.md) · [Troubleshooting](TROUBLESHOOTING.md)*