# System Overview — HealthReach AI

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HealthReach AI                             │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 14)          │  Backend (FastAPI)              │
│  ─────────────────────────────  │  ─────────────────────────────  │
│  / (landing)                    │  /api/campaigns                 │
│  /new (brief)                   │  /api/campaigns/{id}            │
│  /campaigns (list)              │  /api/campaigns/{id}/evidence   │
│  /campaigns/[id] (workspace)    │  /api/campaigns/{id}/plan       │
│                                 │  /api/campaigns/{id}/results    │
│  Components:                    │  /api/campaigns/{id}/analytics  │
│  - Nav, Provenance, InfoTip     │  /api/geo/suggest               │
│  - MapView, ClickMap            │  /api/geo/reverse               │
│  - LocationAutocomplete         │  /api/demo/scenario             │
│  - States (Empty, Skeleton)     │  /api/config, /health           │
│  lib/api.ts (typed client)      │                                 │
│                                 │  Services:                      │
│                                 │  - qloo_client (3-step chain)   │
│                                 │  - geo_client (Nominatim +      │
│                                 │    Overpass failover)           │
│                                 │  - llm_client (OpenAI-compat)   │
│                                 │  - planner (deterministic)      │
│                                 │  - demo_data (isolated)         │
│                                 │  DB: Motor (MongoDB) +          │
│                                 │    in-memory fallback           │
└─────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
healthreach/
├── apps/
│   ├── web/                    # Next.js 14 App Router
│   │   ├── app/                # Routes: /, /new, /campaigns, /campaigns/[id]
│   │   ├── components/         # Shared UI components
│   │   ├── lib/                # api.ts (typed client), types.ts
│   │   └── scripts/            # generate-api-types.mjs
│   └── api/                    # FastAPI
│       ├── app/
│       │   ├── config.py       # Pydantic Settings
│       │   ├── main.py         # FastAPI app, CORS, /health
│       │   ├── models/         # Pydantic v2 models (provenance-first)
│       │   ├── routers/        # api.py (all /api routes)
│       │   ├── services/       # qloo, geo, llm, planner, demo_data
│       │   ├── db.py           # Motor + in-memory fallback
│       │   └── rate_limit.py   # 60/min/IP
│       └── tests/              # pytest (34 tests)
├── packages/
│   ├── ui/                     # Design tokens + provenance metadata
│   │   └── src/
│   │       ├── tokens.css      # CSS custom properties
│   │       └── index.ts        # provenanceMeta (icon+label+border)
│   └── tsconfig/               # Shared strict TS config
├── .env.example                # Template (committed)
├── .env                        # Local only (gitignored)
├── AGENTS.md                   # Contributor instructions
├── README.md                   # User-facing documentation
├── pnpm-workspace.yaml         # Turborepo workspace
├── turbo.json                  # Turborepo config
└── package.json                # Root scripts
```

## Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Monorepo | Turborepo | 2 | Persistent dev tasks |
| Package Manager | pnpm | 9 | Workspaces |
| Frontend Framework | Next.js | 14 | App Router |
| UI Library | React | 18 | Strict Mode |
| Language | TypeScript | 5.x | Strict mode |
| Styling | Tailwind CSS | 3 | CSS variables from packages/ui |
| Map | Leaflet | 1.9 | Dynamically imported |
| Backend Framework | FastAPI | 0.110+ | Async |
| Validation | Pydantic | v2 | Fully typed models |
| Database | MongoDB | 7 | Motor (async) + in-memory fallback |
| HTTP Client | httpx | 0.27+ | Async, timeouts, retries |
| Testing | pytest | 7+ | pytest-asyncio |
| Lint/Format | ESLint + Prettier | Latest | next/core-web-vitals |

## Data Flow

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌────────┐    ┌──────────┐
│ Brief   │───▶│ Geocode  │───▶│ Evidence    │───▶│ Plan   │───▶│ Results  │
│ (POST   │    │ (Nominatim)          │    │ (POST  │    │ (POST    │
│ /campaigns)                    │    │ /evidence)   │    │ /plan)   │
└─────────┘    └──────────┘    └─────────────┘    └────────┘    └──────────┘
                    │                   │                   │            │
                    ▼                   ▼                   ▼            ▼
             ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  ┌──────────┐
             │ Geocode     │    │ Qloo 3-step │    │ Planner     │  │ Analytics│
             │ Result      │    │ Chain + OSM │    │ (LLM or     │  │ (planned │
             │ (lat/lon/   │    │ Venues      │    │ template)   │  │ vs actual)│
             │ display)    │    │ (stored)    │    │ (versioned) │  │          │
             └─────────────┘    └─────────────┘    └─────────────┘  └──────────┘
```

### Detailed Flow

1. **Brief Creation** (`POST /api/campaigns`)
   - Input: `CampaignBrief` + `mode` (real|demo)
   - Real mode: geocode location_text via Nominatim → `GeocodeResult`
   - Demo mode: use fixed Kothrud geocode from `demo_data.py`
   - Returns: `Campaign` with `id`, `brief`, `geocode`, `mode`

2. **Evidence Gathering** (`POST /api/campaigns/{id}/evidence`)
   - Qloo 3-step chain (`qloo_client.fetch_cultural_signals`):
     - Step 1: Place affinities near location
     - Step 2: Taste tags from top place's entity_id
     - Step 3: Cross-check with second place
   - OSM venues (`geo_client.nearby_venues`): Overpass 3-endpoint failover
   - Persist: `EvidenceSnapshot` with `qloo_signals`, `qloo_steps`, `geo_venues`, statuses
   - Returns: `EvidenceSnapshot` with `qloo_status`, `geo_status`, notes

3. **Plan Generation** (`POST /api/campaigns/{id}/plan`)
   - Optional `{section}` for regeneration (increments version)
   - Planner: deterministic template (always) + LLM attempt (if key configured)
   - LLM: structured output validated by Pydantic, 1 repair retry, then fallback
   - Budget forced exact: sum of `BudgetLine.amount_inr` = `brief.budget_inr`
   - Persist: `Plan` with `version`, `planner` (ai-model|standard-template)
   - Returns: `Plan`

4. **Results Entry** (`POST /api/campaigns/{id}/results`)
   - Input: `ResultsInput` (aggregate counts only)
   - Persist: `Results` linked to campaign

5. **Analytics** (`GET /api/campaigns/{id}/analytics`)
   - Derive from stored plan metrics + results
   - Planned-vs-actual, cost/registration, attendance rate
   - Null-safe: "Not calculable — needs at least 1 registration"
   - Descriptive only note included

## External Integrations

| Service | Purpose | Auth | Key Config |
|---|---|---|---|
| Qloo API | Cultural affinity signals | `x-api-key` | `QLOO_API_KEY`, `QLOO_BASE_URL` |
| Nominatim | Geocoding (search, reverse, suggest) | None (UA) | `NOMINATIM` const, UA header |
| Overpass | Community venue queries | None | `OVERPASS_ENDPOINTS` (3) |
| LLM (OpenAI-compat) | Plan prose generation | Bearer token | `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` |
| MongoDB | Persistence | Connection string | `MONGODB_URI` |

## Deployment Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Vercel    │────▶│   Railway/  │
│  (Browser)  │     │  (Next.js)  │     │   Render    │
└─────────────┘     └─────────────┘     │  (FastAPI)  │
       │                                 └──────┬──────┘
       │                                        │
       ▼                                        ▼
┌─────────────┐                          ┌─────────────┐
│  CDN/Edge   │                          │  MongoDB    │
│  (Static)   │                          │  (Atlas/    │
└─────────────┘                          │   Self-host)│
                                         └─────────────┘
```

- Frontend: Vercel (static export compatible) or any Node host
- Backend: Any Python 3.11+ host (Railway, Render, Fly.io, self-hosted)
- Database: MongoDB Atlas or self-hosted; in-memory fallback for demo/dev
- All secrets in backend environment variables only

---

*Related: [Architecture Decisions](ARCHITECTURE_DECISIONS.md) · [Data Flow](DATA_FLOW.md) · [Agent Orchestration](AGENT_ORCHESTRATION.md) · [API Overview](../api/API_OVERVIEW.md)*