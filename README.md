# HealthReach AI

Plan community health outreach with **cultural intelligence, verified ground truth, and AI-assisted planning** — then compare plan with results.

An organizer describes a campaign (topic, place, audience, budget, duration, objective). HealthReach gathers two kinds of evidence — **taste/cultural affinity signals from Qloo** (what framing and channels feel familiar) and **verified community venues from OpenStreetMap** (where you could go) — and turns them into an inspectable outreach plan (activities, venues to evaluate, exact budget, draft materials, estimate ranges). After the camp, aggregate results show planned-vs-actual as a **descriptive comparison, never a causal claim**.

> **Why cultural intelligence matters:** a free screening camp fails when its posters, language, timing, and gathering format feel alien. Qloo tells you which formats and framings an audience already leans toward — so outreach lands instead of lecturing. It never tells you who is sick, where disease is, or whom to trust. This product enforces that boundary in code and copy.

---

## 1. Quick start (one command)

**Prerequisites:** Node ≥ 18, `pnpm` ≥ 9, Python ≥ 3.11, MongoDB (optional — the API falls back to in-memory storage).

```bash
cp .env.example .env        # then fill in keys you have; empty keys degrade gracefully
pnpm install
pnpm dev                    # runs web (:3000) + api (:8000) via Turborepo
```

Open http://localhost:3000. No keys? The **Kothrud demo** on the landing page runs the full flow on labeled illustrative data.

**Individual commands**

| Task                                   | Command                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| Web only                               | `pnpm dev:web`                                                    |
| API only                               | `pnpm dev:api` (or `uvicorn app.main:app --reload` in `apps/api`) |
| Build all                              | `pnpm build`                                                      |
| Lint / typecheck                       | `pnpm lint`, `pnpm typecheck`                                     |
| Backend tests                          | `pnpm --filter @healthreach/api test` (or `pytest` in `apps/api`) |
| Refresh typed client from live OpenAPI | `pnpm generate:api` (API must be running)                         |
| MongoDB (optional)                     | `docker run -d -p 27017:27017 mongo:7`                            |

## 2. Environment variables (server-side only)

All secrets live in the API process. Nothing prefixed `NEXT_PUBLIC_` except the API base URL (not a secret).

| Var                                                    | Where | Required?                 | Effect when empty                                                                                                                      |
| ------------------------------------------------------ | ----- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `QLOO_API_KEY`                                         | API   | For real cultural signals | Qloo section shows an honest “unavailable” state; plan is marked as lacking cultural signals; retry offered. No fake data substituted. |
| `LLM_API_KEY` (+ optional `LLM_BASE_URL`, `LLM_MODEL`) | API   | For LLM-drafted plans     | Deterministic, evidence-citing fallback planner is used (same schema, same budget-exactness guarantee).                                |
| `MONGODB_URI`                                          | API   | For persistence           | Falls back to in-memory store (data lost on restart).                                                                                  |
| `CORS_ORIGINS`                                         | API   | —                         | Defaults to `http://localhost:3000`.                                                                                                   |
| `NEXT_PUBLIC_API_URL`                                  | Web   | —                         | Defaults to `http://localhost:8000`. Public, not secret.                                                                               |

See `.env.example` (committed). Missing keys produce setup messages in dev, never crashes.

## 3. Architecture

```
apps/web      Next.js 14 App Router · React 18 · TS strict · Tailwind 3
  app/            / (landing) · /new (brief) · /campaigns (list) · /campaigns/[id] (workspace)
  components/     ProvenanceBadge · InfoTip (accessible popover) · MapView (Leaflet, dynamic) · States
  lib/api.ts      Typed HTTP client mirroring the FastAPI OpenAPI schema (single source of truth)
apps/api      FastAPI · Pydantic v2 (fully typed models) · Motor (async MongoDB) + in-memory fallback
  app/routers/    REST: campaigns · evidence · plan (+section regen) · results/analytics · demo/scenario · config
  app/services/   qloo_client · geo_client · llm_client · planner · demo_data (isolated)
  tests/          evidence→plan pipeline invariants (pytest, 5 tests)
packages/ui    Design tokens (CSS vars for light/dark) + provenance metadata (icon+label+border)
packages/tsconfig  Shared strict TS base
```

**Request flow:** Brief → geocode (Nominatim) → evidence snapshot (`Qloo` + `Overpass`, stored per campaign for traceability) → plan (LLM if configured, else deterministic fallback; both schema-validated, budget forced exact) → plan versions stored → aggregate results → planned-vs-actual analytics.

**Cross-language types:** `lib/api.ts` is the hand-maintained typed client; `pnpm generate:api` hits the live `/openapi.json` and verifies route parity (fails loudly if the API is unreachable, so drift is caught, not silent).

**Resilience built in:** per-IP rate limiting (60/min), 12–45 s adapter timeouts, Overpass 3-endpoint failover, Nominatim 1 req/s throttle + 24 h geocode cache, LLM retry-then-fallback, honest empty/thin/error states everywhere.

## 4. Verified Qloo capabilities (read from docs.qloo.com, Oct 2026)

We built only what the official docs confirm:

- **Endpoint:** `GET https://api.qloo.com/v2/insights`, auth via `x-api-key`. `filter.type` is **required**.
- **Entity types** (`filter.type` enum): `urn:entity:place | artist | brand | movie | person | book | podcast | tv_show | videogame`, plus `urn:heatmap`, `urn:demographics`, `urn:tag`, and partially-supported `urn:entity:locality`. (`urn:entity:audience` is deprecated.)
- **Signals we use:** `filter.location.query` (fuzzy locality name, e.g. “Kothrud”) + `filter.location.radius` (meters), `filter.location` (lat,lon / WKT / locality UUID), `filter.tags`, `signal.interests.*`, `signal.demographics.*`, `feature.explainability=true`.
- **Outputs we show:** `affinity` (−1…1), `popularity` (0…1), tags, entity ids — labeled **taste affinity**.
- **Lookup helpers** (for validating inputs): entity search, audiences, tag search, tag types.
- **What Qloo does NOT provide** (and we never claim): venues with footfall, healthcare facilities, community-trust scores, epidemiology, diagnoses, or health-need data. `place` results are cultural/leisure venues — we describe them only as “culturally relevant / worth evaluating”.
- **Attribution/caching terms:** public docs specify no fixed attribution string or cache TTL; behavior is governed by the MSA. We attribute “Cultural signals by Qloo” in UI + README and cache conservatively (in-memory geocode cache; Qloo responses stored as per-campaign evidence snapshots, not a shared cache).

## 5. Geographic & mapping sources (choice + compliance)

**Chosen: OpenStreetMap stack** — Nominatim (geocoding) + Overpass (community venues: clinic, pharmacy, community_centre, library, school, park, marketplace) + Leaflet rendering OSM tiles.

- **Why:** open data, no billing key (demo works for anyone), clear written usage policies, sufficient for “candidate venues near camp” decisions. Google/Mapbox need billing keys and were rejected for a hackathon demo.
- **License:** venue/geocode data © OpenStreetMap contributors, **ODbL**; tiles with visible attribution on every map.
- **Usage-policy compliance:** Nominatim ≤ 1 req/s (client-side throttle), identifying `User-Agent`, 24 h result cache, no autocomplete-against-API, end-user-triggered queries only; Overpass timeouts + multi-endpoint failover instead of hammering one instance. (Implementation note: Nominatim’s WAF rejects some `User-Agent` strings containing `example.org` and HTTP/2 fingerprints — we use HTTP/1.1 + a clean identifier.)
- **Honesty boundary:** OSM venues are _mapped_ places, not vetted or trusted ones — every venue carries a persistent “needs on-ground verification” state.

## 6. Information architecture (decided, with reasons)

One coherent guided workflow — **Brief → Evidence → Plan → Results** — instead of dashboards. Four routes only:

| Route                       | Purpose                                                                                                                                                                                                                                                                                                                            | Why it exists                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/` landing                 | Plain-language hero (“Plan a health camp people will actually attend”), what-you-get outputs, 4 steps, sources in plain words, ground rules, **Start a campaign** + marked sample example                                                                                                                                          | First-impression + trust + immediate entry                                             |
| `/new`                      | Guided brief with per-field “why”, example placeholders, explained goal options, ₹ budget, associated errors, `?from=` copy-from-earlier                                                                                                                                                                                           | Collects only what the planner needs; nothing personal                                 |
| `/campaigns`                | Campaign list with per-campaign next-step badges (e.g. “Step 3 of 4 · create the outreach plan”)                                                                                                                                                                                                                                   | Revisit the full story; always clear what remains                                      |
| `/campaigns/[id]` workspace | Stage subtitles + source legend → brief recap → local information (familiarity hints in plain words + places to verify, map + list) → draft plan (activities, places, exact budget, drafts, estimates, pre-use checklist, how-it-was-made line) → results (defined metrics, “not calculable” explanations, descriptive comparison) | The chain stays visible: audience & place → information → suggestion → measured result |

No settings, users, notifications, or admin sections — they don’t serve the core objective.

## 7. Design reconciliation (Genesis reference conflicts, resolved)

- **Two-weight rule vs bold/regular/medium:** display headings use General Sans 600–700; body uses DM Sans 400; UI labels/buttons may use 500 **instead of** 400 on the same screen — never three weights together.
- **Muted gray `#9C9C9C` contrast failure:** restricted to disabled/decorative use; all meaningful text uses `#6B6B6B` or darker. Interactive indigo text uses the darker hover `#4F46E5` (passes AA on white); primary buttons use `#4F46E5` fill so white text passes AA. Warning/error _text_ uses darkened variants (`.text-strong-warning` `#92400E`, `.text-strong-error` `#B91C1C`, lighter in dark mode) — base `#F59E0B`/`#EF4444` are borders/icons only.
- **`title`-attribute tooltips → accessible popovers:** `InfoTip` is a real button (`aria-expanded`, `aria-describedby`, Esc to close) — required because provenance explanations are core content.
- **Dot-grid motif:** used once, on the landing hero, as a subtle community-reach echo (`aria-hidden` decoration over content, disabled under `prefers-reduced-motion`); omitted elsewhere.
- **Dark mode:** full token set (`packages/ui/src/tokens.css`), toggle in nav; light is the polished default, dark is fully usable.
- **Provenance ≠ indigo:** indigo is reserved for interaction. Evidence types use icon + text label + left-border weight/style (dashed + hatch for illustrative), never color alone.

## 8. Demo vs real mode

|          | Real mode                                                   | Demo mode                                                                                                                                                    |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trigger  | “Start a campaign”                                          | “See a working example” (sample diabetes-camp plan, Kothrud Pune)                                                                                            |
| Data     | Live Qloo + OSM; honest empty/error states when unavailable | Fixed Kothrud scenario (Rs 10,000, 7 days, ages 30–60) from `apps/api/app/services/demo_data.py` — the **only** module allowed to define illustrative values |
| Labeling | Provenance chips per value                                  | Persistent dashed “Illustrative data” banner + `illustrative` provenance on **every** value in the API response itself, not just the UI                      |
| Leakage  | —                                                           | Impossible by construction: real-mode code paths never import `demo_data` except the demo endpoints                                                          |

## 9. Honest limitations

- Qloo coverage is uneven outside major metros; thin responses are shown as thin, and plans say so.
- Overpass community data varies in completeness; all venues need on-ground verification (space, permissions, access, power).
- No footfall, health-need, trust, or outcome data is used — reach figures are labeled AI-estimate ranges with stated basis.
- LLM plans (when a key is set) are constrained to cite evidence ids and admit insufficiency; malformed output retries once, then falls back deterministically.
- No Hindi/Marathi localization yet (copy is written short and plain to allow it); no offline support beyond honest error states.

## 10. Privacy

Aggregate counts only (registrations, attendance, spend, engagement). No patient, personal, or medical data is collected, sent to Qloo/LLM/geocoder, or logged. Stated in plain language on the landing page, the brief form, and the results form.

## 11. Provenance legend (visible in UI next to data, icon + label + border)

- ◈ **Qloo signal** — taste affinity, never medical fact
- ◎ **Verified place data** — OSM, © OpenStreetMap contributors
- ✦ **AI interpretation** — estimate/draft, inspect and approve
- ● **You provided** — organizer input
- ◇ **Illustrative data** — dashed border, demo samples only

## 12. Three-minute demo script (Kothrud diabetes screening camp)

1. **Landing (0:00–0:40).** “HealthReach drafts outreach plans from familiar message styles + real nearby places. Hints about familiarity are never health facts. Every fact carries a source label.” Point at “What you walk away with” and “Where do the suggestions come from?”.
2. **Run the example (0:40–1:10).** Click **“See a working example”**. Note the dashed sample-data banner. Brief: free diabetes screening camp, Kothrud Pune, ages 30–60, ₹10,000, 7 days, goal “bring people to a camp”.
3. **Local information (1:10–1:50).** Show familiarity hints in plain words (“moderate match” + what it could mean) and “Technical details” toggle. Show the map + venue list; stress “Visit and verify before use”.
4. **Plan (1:50–2:30).** Activities show “Based on: …” in plain words. Budget parts total exactly ₹10,000. Point at the “Before you use this plan” checklist and the “How this draft was made” line. Refresh one section live (“Get fresh ideas”).
5. **Results (2:30–3:00).** Enter 214 / 156 / 9450 / 380 → planned-vs-actual table, cost/registration ₹44.2, attendance 73%. Close: “Descriptive, not causal.”

## 13. Tests & verification status

- `apps/api/tests/test_pipeline.py` (7 tests): budget exactness, thin-evidence flagging, demo isolation/tagging, venue verification defaults, material review notices, template-planner label, stage ordering — **passing**.
- Web: `tsc --noEmit` clean, `next lint` clean, `next build` succeeds; UI states (loading/empty/thin/error/offline/illustrative) covered by deliberate components, verified manually against stopped-API and keyless modes.
