# Qloo Agent Chain — HealthReach AI

## Purpose

This document specifies the **deterministic 3-step Qloo agent chain** that produces cultural evidence for each campaign. The chain is backend-controlled code in `qloo_client.fetch_cultural_signals()` — not an LLM agent.

## Chain Specification

### Step 1: Place Affinities Near Campaign Location

**Purpose**: Discover cultural venues near the campaign location that reflect local taste.

**Request**:
```http
GET /v2/insights
  ?filter.type=urn:entity:place
  &filter.location.query={location_text}
  &filter.location.radius=5000
  &feature.explainability=true
  &filter.location={lat},{lon}          # optional, when available
```

**Response Processing**:
- Take first 8 entities from `results.entities`
- For each entity, create `QlooSignal`:
  ```python
  QlooSignal(
      kind="place-affinity",
      label=entity.name,
      detail=f"Cultural venue near {location_text} tagged: {tag_names}. Taste affinity, not a health or trust signal.",
      affinity=clamp(entity.affinity, -1, 1),
      popularity=clamp01(entity.popularity),
      entity_id=entity.entity_id,
      provenance=Provenance.QLOO
  )
  ```

**Step Record**:
```python
QlooChainStep(
    step=1,
    title="Looked at culture spots near here",
    asked=f"Which places near {location_text} match the local crowd's taste?",
    found=f"{len(places)} places — for example: {', '.join(names[:3])}." if places else "No place lookups came back.",
    next=f"Now asking: what else do fans of {names[0]} also like?" if places else "",
    top_names=names[:3],
    status="ok" if places else "skip",
    skip_reason="The place-lookup step could not run: {reason}" if error else "",
    provenance=Provenance.QLOO
)
```

**Outputs for Next Step**: `places` list (with `entity_id`, `name`)

---

### Step 2: Taste Tags from Top Place

**Purpose**: Discover taste tags shared by fans of the top place from Step 1.

**Precondition**: Step 1 returned ≥ 1 place.

**Request**:
```http
GET /v2/insights
  ?filter.type=urn:tag
  &signal.interests.entities={top_place.entity_id}
  &signal.location.query={location_text}
```

**Response Processing**:
- Take first 6 tags from `results.tags`
- For each tag, create `QlooSignal`:
  ```python
  QlooSignal(
      kind="tag-affinity",
      label=tag.name,
      detail=f"Fans of {top_place.name} also tend to enjoy this. Tone/framing cue only — not health targeting.",
      affinity=clamp(tag.affinity, -1, 1),
      provenance=Provenance.QLOO
  )
  ```

**Step Record**:
```python
QlooChainStep(
    step=2,
    title=f"Checked what fans of {top_place.name} also like",
    asked=f"Shared taste tags of people who like {top_place.name}.",
    found=f"{len(tags)} tags — for example: {', '.join(tag_names[:3])}." if tags else "No shared tags came back.",
    next=f"Now double-checking the same question with {names[1] or 'another place'}." if len(names) > 1 else "",
    top_names=tag_names[:3],
    status="ok" if tags else "skip",
    skip_reason="A taste-tag lookup could not run: {reason}" if error else ("The first check didn't find places, so this had nothing to start from." if no_places else ""),
    provenance=Provenance.QLOO
)
```

**Outputs for Next Step**: `tags_two` list (tag names for overlap analysis)

---

### Step 3: Cross-Check with Second Place

**Purpose**: Validate the taste pattern by asking the same question about a second place.

**Precondition**: Step 1 returned ≥ 2 places.

**Request**:
```http
GET /v2/insights
  ?filter.type=urn:tag
  &signal.interests.entities={second_place.entity_id}
  &signal.location.query={location_text}
```

**Response Processing**:
- Take first 6 tags from `results.tags`
- Compute overlap: `set(tags_two_names) ∩ set(tags_three_names)`
- For each tag in Step 3, create `QlooSignal` (same as Step 2)

**Step Record**:
```python
if overlap:
    found = f"{len(overlap)} of the same tags appeared — for example: {', '.join(overlap[:3])}. The pattern holds for two different places."
else:
    found = f"{len(tags_three)} tags came back, but different from step 2 — treat the taste picture as mixed."

QlooChainStep(
    step=3,
    title=f"Double-checked with {second_place.name}",
    asked=f"Same taste question, asked about {second_place.name}.",
    found=found,
    top_names=tag_names_three[:3],
    status="ok",
    provenance=Provenance.QLOO
)
```

**If Precondition Not Met**:
```python
QlooChainStep(
    step=3,
    title="Double-check with a second place",
    asked="Not run — steps 1–2 gave one place or none.",
    status="skip",
    skip_reason="A double-check needs a second place from step 1.",
    provenance=Provenance.QLOO
)
```

---

## Aggregated Output

```python
def fetch_cultural_signals(...) -> tuple[
    list[QlooSignal],      # All signals from all steps
    list[QlooChainStep],   # All 3 steps (ok or skip)
    str,                   # Overall status: "ok" | "thin" | "unavailable"
    str                    # Provenance note
]:
```

### Overall Status Logic

| Condition | Status | Note |
|---|---|---|
| `key_rejected` (401/403 in any step) | `thin` | "Qloo did not run because the configured key was rejected — no lookups were possible. The plan will say so and lean on place data + organizer input." |
| No signals generated (all steps skipped/empty) | `thin` | "Qloo returned little for this audience/area. {step_notes}. The plan will say so and lean on place data + organizer input." |
| ≥ 1 signal generated | `ok` | "Taste affinity, not a health or trust signal." |

---

## Persistence

All chain outputs persisted in `EvidenceSnapshot`:

```python
EvidenceSnapshot(
    campaign_id=campaign_id,
    qloo_signals=all_signals,           # Combined from all 3 steps
    qloo_steps=all_steps,               # All 3 steps with status
    geo_venues=venues,
    qloo_status=status,
    qloo_note=note,
    geo_status=geo_status,
    geo_note=geo_note,
)
```

**Additive design**: `qloo_steps` is additive — older snapshots without steps still validate.

---

## Frontend Consumption

### Evidence Review UI (`/campaigns/[id]` — evidence phase)

1. **Source Legend**: Shows provenance chips (Qloo, Geo, AI, User, Illustrative)
2. **Familiarity Hints**: Plain-language summaries from `qloo_signals`:
   - Group by `kind`
   - Show `label` + `detail` (truncated, expandable)
   - ProvenanceBadge on each
3. **Technical Details Toggle**: Raw signals table (affinity, popularity, entity_id)
4. **Qloo Chain Steps**: 3 numbered cards:
   - Step title, asked, found, next
   - Status badge (ok/skip)
   - Skip reason if skipped
5. **Overall Status Banner**: `qloo_status` + `qloo_note`

### QlooCallCounter (Planned)

Backend exposes per-run metrics:
- Total provider requests (including retries)
- Requests per step
- Cache hits
- Step completion status

Frontend polls or receives via SSE/websocket during evidence loading.

---

## Testing Requirements

### Unit Tests (`test_pipeline.py`)

- [ ] Chain executes 3 steps with valid responses → `ok` status, signals + steps
- [ ] Step 1 empty → Steps 2-3 skipped with correct reasons
- [ ] Step 1 returns 1 place → Step 3 skipped with correct reason
- [ ] Step 2 error → Step 2 skipped, Step 3 skipped (depends on Step 2)
- [ ] Step 3 error → Step 3 skipped, Steps 1-2 preserved
- [ ] Auth failure (401) → `thin` status, key rejected note, no signals
- [ ] Thin response (1 place, 0 tags) → `thin` status, signals preserved
- [ ] All skip reasons are plain language (no technical terms)
- [ ] Overlap analysis correct (set intersection)
- [ ] Provenance on all signals and steps = QLOO
- [ ] Affinity clamped to [-1, 1], popularity to [0, 1]
- [ ] Step record includes `top_names` for UI

### Integration Tests (`test_api_flow.py`)

- [ ] Demo flow: evidence endpoint returns illustrative chain
- [ ] Real mode: evidence endpoint calls Qloo (mocked in tests)
- [ ] Evidence snapshot persisted with all steps
- [ ] Plan receives evidence snapshot with steps
- [ ] Plan `has_cultural_signals` reflects Qloo status

---

## Configuration

| Setting | Value | Description |
|---|---|---|
| `QLOO_BASE_URL` | `https://api.qloo.com` | Qloo API base |
| `QLOO_API_KEY` | (from env) | Required for real mode |
| Step 1 radius | 5000 meters | Place affinity search radius |
| Step 1 limit | 8 places | Max places to process |
| Step 2/3 limit | 6 tags | Max tags per step |
| Timeout | 12 seconds | Per-request timeout |
| Retry | 3 attempts (0.5, 1, 2s + jitter) | On 429/5xx/timeout |
| No retry | 400, 401, 403 | Client errors |

---

## Future Enhancements

| Idea | Effort | Blocker |
|---|---|---|
| Heatmap strategy (Strategy H) | M | Need to verify heatmap quality vs baseline |
| Demographics signal (age/gender) | S | Qloo demographics not health-specific |
| Entity search for venue validation | S | Verify `urn:entity:locality` support |
| Trending signals for timing | L | Verify `/v2/trending` availability |

---

*Related: [Qloo Integration](QLOO_INTEGRATION.md) · [Agent Orchestration](../architecture/AGENT_ORCHESTRATION.md) · [Data Flow](../architecture/DATA_FLOW.md)*