# LLM Contract — HealthReach AI

## Purpose

This document specifies the architectural contract between HealthReach and the LLM provider. The LLM is **only** a grounded prose generator — it never calls Qloo, OSM, or any other tool.

## Provider Requirements

| Requirement | Specification |
|---|---|
| API Format | OpenAI-compatible (Chat Completions) |
| Auth | Bearer token (`LLM_API_KEY`) |
| Base URL | Configurable (`LLM_BASE_URL`, default: OpenAI) |
| Model | Configurable (`LLM_MODEL`, default: `gpt-4o-mini`) |
| Timeout | 45 seconds |
| Structured Output | JSON matching Plan schema |

## When LLM Is Used

- `LLM_API_KEY` is configured (non-empty)
- Plan generation requested (`POST /api/campaigns/{id}/plan`)
- Evidence snapshot exists (Qloo signals + steps, OSM venues)

## When LLM Is NOT Used

- `LLM_API_KEY` not configured → deterministic template only
- Section regeneration (`{section}` in request) → template only
- Demo mode → illustrative data only, no LLM call
- Qloo unavailable → template proceeds with geo + organizer input

## Prompt Structure

### System Prompt
```
You are a health outreach planner. Generate a campaign plan as structured JSON.
Use ONLY the provided evidence. Cite evidence IDs. Admit when evidence is insufficient.
Never invent evidence references. Never make medical claims.
```

### User Prompt (Template)
```
Campaign Brief:
- Topic: {topic}
- Location: {location_text} (lat: {lat}, lon: {lon})
- Audience: Ages {age_min}-{age_max}
- Budget: ${budget_usd}
- Duration: {duration_days} days
- Objective: {objective}

Evidence:
Qloo Signals:
{qloo_signals_formatted}

Qloo Chain Steps:
{qloo_steps_formatted}

OSM Venues:
{geo_venues_formatted}

Generate: Plan JSON with activities, venues, budget, materials, metrics.
```

### Evidence Formatting
- Qloo signals: `kind`, `label`, `affinity`, `entity_id` (truncated to top 10)
- Qloo steps: step number, title, asked, found, next
- OSM venues: name, category, distance_m, needs_verification

## Expected Output Schema (JSON)

```json
{
  "summary": "string",
  "activities": [
    {
      "title": "string",
      "channel": "string",
      "why": "string",
      "evidence_refs": ["string"],
      "cost_usd": 0
    }
  ],
  "venues": [
    {
      "name": "string",
      "reason": "string",
      "evidence_refs": ["string"],
      "status": "worth-evaluating"
    }
  ],
  "budget": [
    {
      "label": "string",
      "amount_usd": 0
    }
  ],
  "materials": [
    {
      "kind": "poster|message|script",
      "title": "string",
      "body": "string"
    }
  ],
  "metrics": [
    {
      "name": "string",
      "target_range": "string",
      "basis": "string"
    }
  ],
  "assumptions": ["string"],
  "limitations": ["string"]
}
```

## Validation Rules (Pydantic)

1. **Schema compliance**: Output must match `Plan` model exactly
2. **Budget exactness**: `sum(budget[].amount_usd) == brief.budget_usd`
3. **Evidence refs valid**: Every `evidence_refs[]` item must exist in persisted evidence snapshot
4. **No hallucinated venues**: Venue names must match `geo_venues` or be generic descriptors
5. **Required fields**: All fields present, no nulls where not allowed
6. **Review notice**: Added server-side to all materials (not in LLM output)

## Repair & Fallback Flow

```
┌─────────────────────┐
│ LLM First Attempt   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Validate (Pydantic) │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
  Pass        Fail
    │           │
    ▼           ▼
┌─────────┐ ┌─────────────────────┐
│ Success │ │ Repair Retry (1x)   │
│ planner │ │ + "Fix JSON to      │
│ =ai-    │ │ match schema exactly"│
│ model   │ └─────────┬───────────┘
└─────────┘           │
              ┌───────┴───────┐
              │               │
            Pass           Fail
              │               │
              ▼               ▼
         ┌─────────┐  ┌──────────────────┐
         │ Success │  │ Deterministic    │
         │ planner │  │ Template         │
         │ =ai-    │  │ planner =        │
         │ model   │  │ standard-template│
         └─────────┘  └──────────────────┘
```

## Deterministic Template Planner

**Always runs first**. LLM output only replaces it if validation passes.

Location: `apps/api/app/services/planner.py`

### Template Logic

1. **Activities** (3-5 based on objective):
   - screening → screening stations, volunteer training, follow-up referrals
   - awareness → community info session, flyer distribution, social media
   - attendance → registration drive, reminder calls, transport coordination
   - vaccination → vaccine stations, cold chain, observation area

2. **Venues** (top 3-5 from OSM):
   - Reason: "High foot traffic, community trust, {category} relevance"
   - Status: "worth-evaluating", `needs_verification: true`

3. **Budget** (proportional, exact total):
   - venue: 20%, materials: 25%, staff: 30%, refreshments: 15%, contingency: 10%
   - Final line adjusted for exact total

4. **Materials** (poster, message, script):
   - All include review notice (server-added)

5. **Metrics** (3-4):
   - Registrations, Attendance, Cost per registration, Engagement
   - Basis: "Template estimate based on similar campaigns" or Qloo-grounded

## Provenance & Truthfulness

| Plan Field | Provenance When LLM Succeeds | Provenance When Template Used |
|---|---|---|
| activities | `ai` | `ai` (labeled standard-template) |
| venues | `ai` | `ai` |
| budget | `ai` | `ai` |
| materials | `ai` | `ai` |
| metrics | `ai` | `ai` |
| `Plan.planner` | `"ai-model"` | `"standard-template"` |

**Critical**: `Plan.planner` must **always** truthfully reflect the actual generator.

## Error Handling

| Error | Handling |
|---|---|
| Timeout (45s) | Fallback to template, `planner: standard-template` |
| 401/403 (auth) | Fallback to template, log warning |
| 429 (rate limit) | Retry once (2s), then fallback |
| 5xx (server error) | Retry once (2s), then fallback |
| Malformed JSON | Repair retry (1x), then fallback |
| Validation failure | Repair retry (1x), then fallback |
| Network error | Fallback to template |

## Testing

### Unit Tests
- Valid LLM output → `planner: ai-model`, all refs valid
- Invalid JSON → repair retry → valid → `planner: ai-model`
- Invalid JSON → repair fails → template → `planner: standard-template`
- Budget mismatch → repair retry → fixed → `planner: ai-model`
- Invalid evidence refs → repair retry → fixed → `planner: ai-model`
- Timeout → template → `planner: standard-template`
- Auth failure → template → `planner: standard-template`

### Integration Tests
- Full plan generation with mocked LLM
- Section regeneration uses template (not LLM)
- Demo mode never calls LLM

## Configuration

```python
# apps/api/app/config.py
LLM_API_KEY: str = ""           # Empty = template only
LLM_BASE_URL: str = "https://api.openai.com/v1"
LLM_MODEL: str = "gpt-4o-mini"
LLM_TIMEOUT_S: int = 45
LLM_MAX_RETRIES: int = 1        # Repair retry only
```

## Security

- LLM prompt contains **no PII** — only campaign parameters + evidence IDs
- Evidence snapshot contains no patient data
- LLM response not logged (only validation result)
- `LLM_API_KEY` server-side only, never in frontend

---

*Related: [Agent Orchestration](architecture/AGENT_ORCHESTRATION.md) · [Qloo Agent Chain](QLOO_AGENT_CHAIN.md) · [API Contracts](api/API_CONTRACTS.md)*