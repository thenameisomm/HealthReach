# AGENTS.md — HealthReach AI contributor instructions

This file is the operating manual for AI coding agents (and humans) working in
this repository. Follow it before proposing or making changes. The README is
the user-facing story; this file is the builder-facing contract.

## 1. Project overview and purpose

HealthReach AI helps community health organizers (NGOs, clinics, outreach
coordinators — often non-technical) **plan and evaluate community outreach
campaigns** (screening camps, vaccination drives, awareness events).

Core loop, in order: **describe the campaign (brief) → review local
information (evidence) → review a draft outreach plan → enter aggregate
results → compare planned vs actual.** That is the whole product. Do not turn
it into hospital management, patient records, or medical-diagnosis software.

Every screen must answer, in plain words: what this is, why it matters, what
to do next, where each fact came from, and whether a number is real,
estimated, or illustrative.

## 2. Technology stack (do not substitute without explicit approval)

- **Monorepo:** Turborepo 2 + pnpm 9 workspaces (`pnpm-workspace.yaml`).
- **Frontend (`apps/web`):** Next.js 14 (App Router), React 18, TypeScript
  strict, Tailwind CSS 3, Leaflet 1.9 (map, dynamically imported).
- **Backend (`apps/api`):** Python ≥3.11, FastAPI, Pydantic v2
  (+ `pydantic-settings`), `httpx`, `motor` (async MongoDB), `pytest` +
  `pytest-asyncio`. Installed via pip (see `pyproject.toml`); there is no
  venv committed — use the system/homebrew Python or create a local venv
  (which is gitignored).
- **Packages:** `@healthreach/ui` (design tokens + provenance metadata),
  `@healthreach/tsconfig` (shared strict base). Do not add speculative
  packages.
- **Formatting/lint:** Prettier 3 (root `format` script), ESLint with
  `next/core-web-vitals` (`apps/web/.eslintrc.json`).

## 3. Repository structure

```
.env.example            # committed template; .env is local-only, never committed
README.md               # user story, setup, demo script — keep in sync (see §14)
AGENTS.md               # this file
apps/web/
  app/                  # / (landing) · /new (brief) · /campaigns (list) ·
                        # /campaigns/[id] (workspace) · layout · globals.css · icon.svg
  components/           # Nav · Provenance (+SourceLegend, DemoBanner) · InfoTip ·
                        # MapView · States (EmptyState, Skeleton, ProgressStatus)
  lib/api.ts            # typed HTTP client + friendlyError() — mirrors OpenAPI
  lib/types.ts          # pointer file; real types live in lib/api.ts
  scripts/generate-api-types.mjs  # verifies client/OpenAPI parity (API must run)
apps/api/
  app/config.py         # server-side settings (pydantic-settings; reads .env)
  app/main.py           # FastAPI app, CORS, /health
  app/models/           # Pydantic v2 request/response models (provenance-first)
  app/routers/api.py    # all /api routes + stage_for() + _metric_range()
  app/services/         # qloo_client · geo_client · llm_client · planner ·
                        # demo_data (ISOLATED illustrative data — see §13)
  app/db.py · app/rate_limit.py
  tests/test_pipeline.py
packages/ui/src/        # tokens.css (light/dark vars) · index.ts (provenanceMeta)
packages/tsconfig/      # base.json strict config
```

There is no `design.md`; design decisions live in README §7 and in code
comments. There are no frontend unit tests (only backend tests + manual/
browser QA scripts kept outside the repo in `/tmp`).

## 4. Architecture

**Frontend.** Four routes only; no dashboards, accounts, or settings. The
workspace (`/campaigns/[id]`) is one page with four staged sections (brief
recap → local information → draft plan → results) driven by a `Phase` state
machine (`loading | brief | evidence-loading | evidence | plan-loading |
ready`). All server communication goes through `lib/api.ts`; never hand-dup
types — update `lib/api.ts` and run `pnpm generate:api` to check parity
against the live `/openapi.json`. Maps render with Leaflet via a ref-based
`MapView` (never `getElementById` + shared ids — that caused double-init
crashes); the venue **list below the map is the required text alternative**.
Copy must stay plain-language: field-level "why", no jargon-first
explanations, technical terms only as secondary labels.

**Backend.** Routers are thin; logic lives in `services/` adapters
(`qloo_client`, `geo_client`, `llm_client`) plus the deterministic
`planner`. Each adapter owns timeouts, retries/failover, and error mapping
so it can be mocked in tests and demo mode. `demo_data.py` is the ONLY module
allowed to define illustrative values. MongoDB via Motor with transparent
in-memory fallback (`db.py`); evidence snapshots and plan versions are stored
per campaign so reasoning stays traceable.

## 5. API endpoints and data flow

Base: `http://localhost:8000`. All `/api` routes are rate-limited (60/min/IP).

| Method & path | Purpose |
|---|---|
| `GET /health`, `GET /api/config` | liveness; which integrations are configured (no secrets) |
| `POST /api/campaigns` | create brief (`{brief, mode}`); geocodes real mode, uses fixed Kothrud brief in `demo` mode |
| `GET /api/campaigns` | list with additive `stage`: `brief \| info \| plan \| results` |
| `GET /api/campaigns/{id}` | campaign + plans + evidence + results |
| `POST /api/campaigns/{id}/evidence` | fetch Qloo + OSM snapshot (honest `ok/thin/unavailable` statuses) |
| `POST /api/campaigns/{id}/plan` | build plan; optional `{section}` regenerates one section as a new version; `planner` = `ai-model` only when the LLM path succeeded, else `standard-template` |
| `POST /api/campaigns/{id}/results` | save aggregate counts only |
| `GET /api/campaigns/{id}/analytics` | planned-vs-actual (descriptive; nulls when incalculable) |
| `GET /api/demo/scenario` | fixed Kothrud brief + illustrative geocode |

Data flow: brief → Nominatim geocode → evidence snapshot (Qloo signals +
Overpass venues, stored) → plan (LLM upgrade attempted in real mode only;
schema-validated; budget forced exact) → versioned plan storage → aggregate
results → analytics derived from stored plan metrics by name.

## 6. Development setup and environment

```bash
cp .env.example .env   # fill only keys you have; empty keys degrade gracefully
pnpm install
pnpm dev               # web :3000 + api :8000 (Turbo persistent tasks)
```

Optional: `docker run -d -p 27017:27017 mongo:7` (without it the API uses
the in-memory store and data is lost on restart).

| Variable | Required? | Empty behavior |
|---|---|---|
| `QLOO_API_KEY` | for live cultural signals | honest “unavailable” state; plan flagged as missing hints |
| `LLM_API_KEY` (+`LLM_BASE_URL`, `LLM_MODEL`) | for AI-drafted plans | deterministic template planner (same schema, exact budget) |
| `MONGODB_URI` | for persistence | in-memory fallback |
| `CORS_ORIGINS` | — | defaults to `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | — | public, not secret; defaults to `http://localhost:8000` |

## 7. Commands (run from repo root unless noted)

| Task | Command |
|---|---|
| dev all / web / api | `pnpm dev` · `pnpm dev:web` · `pnpm dev:api` |
| build | `pnpm build` (runs `next build`; then restart dev — never build while dev runs, it corrupts `.next`) |
| lint | `pnpm lint` (web: `eslint .`; api: `py_compile`) |
| typecheck | `pnpm typecheck` (web: `tsc --noEmit`; api: import check) |
| tests | `pnpm --filter @healthreach/api test` (pytest, `apps/api/`) |
| format | `pnpm exec prettier --write …` (root `format` script covers ts/tsx/js/json/css/md) |
| API parity | `pnpm generate:api` (API must be running) |

## 8. Coding conventions

- **TypeScript strict everywhere** (`tsc --noEmit` must pass); no `any`
  without justification; Prettier-formatted; ESLint clean.
- **Pydantic v2 models for every API shape**; new response fields must be
  optional/additive so old stored documents still validate.
- **Provenance-first:** every displayed value carries `qloo | geo | ai |
  user | illustrative` with icon + text label + border treatment (see
  `provenanceMeta`), never color alone.
- **Plain-language microcopy:** short sentences, field-level “why”, action
  labels that name the outcome (“Create outreach plan”, not “Generate”);
  technical terms only as secondary text; anthropomorphize nothing.
- **Design tokens:** use CSS vars/`packages/ui` tokens; indigo is reserved
  for interaction; warning/error *text* uses the darkened
  `.text-strong-warning` / `.text-strong-error` classes (base tokens fail AA
  for small text); dot-grid motif on landing hero only, via `::before` so
  the mask never touches text.
- **Accessibility:** semantic HTML, associated labels/errors, 24px minimum
  touch targets, keyboard-operable popovers (never `title` tooltips for
  content), map always paired with its list, `prefers-reduced-motion`
  respected.

## 9. Testing and regression requirements

- Backend: `apps/api/tests/test_pipeline.py` (budget exactness, thin-evidence
  flags, demo isolation, verification defaults, review notices, planner
  label, stage ordering, metric lookup, no machine refs in prose). Add a test
  for every honesty-relevant behavior you change.
- Frontend has no unit-test harness; verify by `tsc` + `eslint` + `next
  build` plus real-browser checks: @healthreach/web `test` script is a
  placeholder — do not present it as coverage.
- Browser QA method that works here: headless Chrome
  (`/Applications/Google Chrome.app/...`) driven by `puppeteer-core`
  (install in `/tmp`, never add to the repo), viewports 1280×900 and
  390×844, capturing screenshots + console/page errors + overflow. Check
  `/tmp/hr-qa/` conventions from prior sessions if present.
- Never claim a check passed unless you ran it and saw the result. Never
  claim real-user testing unless real users participated.

## 10. Integrations (verified behavior — preserve it)

- **Qloo** (`GET {base}/v2/insights`, `x-api-key`, `filter.type` required):
  provides taste/cultural affinity (`affinity` −1…1, `popularity` 0…1, tags)
  with location signals (`filter.location.query` + `radius`). It does NOT
  provide venues-with-footfall, healthcare facilities, trust scores,
  epidemiology, or diagnoses — never claim otherwise. Missing key / thin
  response → honest `unavailable`/`thin` states, plan flagged, retry only
  when retry can help (not for missing keys).
- **OpenStreetMap:** Nominatim geocode (≤1 req/s client throttle, 24h cache,
  identifying UA over HTTP/1.1 — some UA strings/WAFs reject HTTP/2 or
  `example.org`; keep the proven header set) + Overpass venues with
  3-endpoint failover. Attribute `© OpenStreetMap contributors (ODbL)` on
  data and tiles. Mapped places are *candidates*; every venue keeps
  `needs_verification` and “visit and verify” UI.
- **LLM:** any OpenAI-compatible endpoint behind `llm_client`; structured
  JSON output validated by Pydantic, one repair retry, then deterministic
  fallback. `Plan.planner` must truthfully read `ai-model` or
  `standard-template` (section regenerations are template-built).
- **Database:** MongoDB via Motor + in-memory fallback; `ext_cache` TTL index
  declared for external responses; never store personal/health data (only
  aggregate counts).

## 11. Error handling and fallback behavior

- Adapters: 12–45s timeouts, no silent fabrication — failures surface as
  honest statuses with retry where meaningful.
- Frontend `friendlyError()` maps every failure class (offline, timeout,
  404/400/429/5xx, plan-before-evidence) to plain language; form input is
  never cleared by failures; field errors clear on edit.
- Loading/empty/error states must say what happened, whether data is safe,
  and what to do next. Zero/missing analytics inputs render “Not calculable —
  needs at least 1 registration”, never divide-by-zero.

## 12. Security and secret management

- All secrets server-side only, from environment (`app/config.py`).
  **Never** put keys in `NEXT_PUBLIC_*`, client code, logs, or the repo.
  `.env` is gitignored; only `.env.example` (empty keys) is committed.
- Sensible CORS allowlist, 60/min/IP rate limiting, adapter timeouts, no
  stack traces to end users, no PII in prompts/logs. Privacy by design:
  aggregate counts only — no names, phones, diagnoses, or patient data
  anywhere (forms, API, DB, analytics).

## 13. Health-related safety and data honesty (mandatory — override aesthetics)

- Never present Qloo output as diagnosis, epidemiology, health need,
  footfall, or trust. Cultural relevance ≠ community trust.
- Venues are “worth evaluating / visit and verify”, never “trusted”.
- Reach/registration figures are labeled estimate ranges with stated basis;
  never promise outcomes; analytics stay descriptive, never causal.
- Draft posters/messages/scripts are factual, make no medical-advice or
  diagnosis claims, and always carry the qualified-professional review
  notice.
- Demo/illustrative data lives ONLY in `demo_data.py`, is tagged
  `illustrative` in API responses (not just UI), and stays behind the
  persistent demo banner. Real-mode paths must never import it.
- `Plan.planner` must stay truthful; never imply an AI model was used when
  the template ran.

## 14. Documentation and architecture maintenance

- Keep `README.md` in sync with behavior: setup/commands, IA route table,
  demo script, test counts, known limitations. Update it in the same change
  as the behavior.
- Update this file when architecture, commands, integrations, or safeguards
  change. Preserve existing stack and route structure; do not add routes,
  dashboards, settings, accounts, or dependencies without a demonstrated
  need. Prefer the smallest coherent change that fixes the problem.
