# Troubleshooting — HealthReach AI

## Quick Diagnosis

| Symptom | Likely Cause | Quick Fix |
|---|---|---|
| "Cannot create campaign" | MongoDB down, geocode timeout | Check `/health`, restart API |
| "Cultural signals unavailable" | Qloo key missing/invalid | Set `QLOO_API_KEY` or accept template |
| "No venues on map" | Overpass down, thin results | Check `geo_status`, retry |
| "Plan not generating" | Evidence required first | Click "Create outreach plan" after evidence |
| "Results not calculating" | Zero registrations | Enter ≥1 registration |
| "Map not loading" | Leaflet import failed, no internet | Check network, Leaflet CDN |
| "Autocomplete not working" | Nominatim blocked, query too short | Type ≥3 chars, check console |
| "Dark mode broken" | Tailwind config, missing `.dark` | Check `html.dark`, tokens |
| "Build fails" | TypeScript errors, missing deps | Run `pnpm typecheck`, `pnpm install` |
| "Tests fail" | Mock outdated, fixture changed | Update fixtures, check live behavior |

---

## Frontend Issues

### Build Errors

#### `Module not found: Can't resolve 'leaflet'`
```bash
# Leaflet is dynamically imported, but types needed
pnpm add -D @types/leaflet
```

#### `Type error: Property 'X' does not exist on type 'Y'`
```bash
# Regenerate API types (API must be running)
pnpm generate:api
# Or fix manually in lib/api.ts
```

#### `Tailwind class not applying`
```bash
# Check: class in safelist? dynamic class?
# Fix: use full class name, or add to safelist in tailwind.config.js
```

#### `Build succeeds but dev shows error`
```bash
# Never run build while dev running
rm -rf apps/web/.next
pnpm dev
```

### Runtime Errors

#### Hydration Mismatch
```
Warning: Text content did not match. Server: "X" Client: "Y"
```
**Cause**: Server/client render difference (date, random, `window` access)
**Fix**: Use `useEffect` for client-only, `suppressHydrationWarning` for known differences

#### Leaflet Map Not Rendering
```
Error: Map container not found / Leaflet CSS missing
```
**Fix**: 
1. Ensure `leaflet/dist/leaflet.css` imported in `globals.css`
2. Map container has explicit height: `<div ref={mapRef} style={{height: '400px'}} />`
3. Dynamic import: `const L = await import('leaflet')`

#### Autocomplete No Suggestions
```
User types, no dropdown appears
```
**Check**:
1. Query ≥ 3 chars
2. Network tab: `GET /api/geo/suggest?q=...` — 200? 503?
3. Console: CORS error? → Check `CORS_ORIGINS` includes frontend origin
4. DevTools: `LOG_LEVEL=DEBUG` backend logs

#### ClickMap Not Reverse Geocoding
```
Click map, field doesn't fill
```
**Check**:
1. Network: `GET /api/geo/reverse?lat=...&lon=...` — 200? 400?
2. 400 = coords out of range (-90 to 90, -180 to 180)
3. Console: Leaflet click event firing?
4. Field controlled? `value` + `onChange` sync

#### Provenance Badges Not Showing
```
Values appear without source badges
```
**Check**:
1. API response includes `provenance` field
2. `ProvenanceBadge` component receives correct prop
3. CSS: `border-l-3` classes applied

### Performance

#### Slow Initial Load
- Check bundle size: `pnpm build` → analyze `.next/analyze`
- Dynamic import heavy components: `MapView`, `ClickMap`, charts
- Enable gzip/brotli on hosting

#### Slow Evidence Loading
- Normal: Qloo 3-step chain ~5-30s depending on latency
- Check: Qloo call counter shows progress
- Optimize: Warm geocode cache, parallel OSM fetch

---

## Backend Issues

### Startup Errors

#### `ModuleNotFoundError: No module named 'app'`
```bash
cd apps/api
uv sync
# Or ensure PYTHONPATH includes apps/api
```

#### `pydantic-settings` Import Error
```bash
uv add pydantic-settings
```

#### `motor` Connection Error
```bash
# Check MONGODB_URI format
# mongodb://user:pass@host:port/db
# mongodb+srv://user:pass@cluster/db
# Empty = in-memory fallback
```

#### `QLOO_API_KEY` Not Configured
```bash
# Expected: qloo_configured=false in /health
# Not an error — graceful degradation
# Set key for real cultural signals
```

### Runtime Errors

#### POST /api/campaigns 500
```bash
# Check logs for traceback
# Common:
# - Geocode timeout → Nominatim slow, increase timeout
# - Validation error → check request body matches CampaignBrief
# - MongoDB write fail → check connection, fallback
```

#### POST /api/campaigns/{id}/evidence 500
```bash
# Check logs:
# - Qloo 401/403 → key invalid
# - Qloo 429 → rate limited, retry logic should handle
# - Overpass all fail → geo_status: unavailable
# - MongoDB write fail → check connection
```

#### POST /api/campaigns/{id}/plan 400 "Evidence needed"
```bash
# Must call /evidence first
# Frontend enforces phase order, but direct API calls need evidence first
```

#### GET /api/campaigns/{id}/analytics 400 "Results not entered"
```bash
# Must POST /results first
# Analytics computes from plan metrics + results
```

### Data Issues

#### Budget Not Exact
```python
# Planner bug: sum(budget) != brief.budget
# Check planner.py: _force_exact_budget() adjusts last line
# Test: assert sum(b.amount_inr for b in plan.budget) == brief.budget_inr
```

#### Plan Version Not Incrementing
```python
# Section regen should increment version
# Check: POST /plan {section} → new Plan with version = old + 1
# Other sections preserved from previous version
```

#### Analytics Null When Should Calculate
```python
# Check: actual_registrations > 0 for cost_per_registration
# Check: actual_registrations > 0 for attendance_rate
# Zero denominator → None + "Not calculable" note
```

---

## Integration Issues

### Qloo API

| Error | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Invalid/expired key | Rotate `QLOO_API_KEY` |
| 403 Forbidden | Key lacks permission | Check Qloo plan, key scope |
| 429 Too Many Requests | Rate limit exceeded | Backoff, check monthly quota |
| 500/502/503 | Qloo service down | Retry with backoff, fallback |
| Empty results | Thin coverage area | Status: thin, proceed with geo |
| Timeout | Network/latency | Increase timeout (current 12s) |

### Nominatim (Geocoding)

| Error | Cause | Fix |
|---|---|---|
| 403 Forbidden | WAF blocked UA/IP | Use HTTP/1.1, clean UA, check IP |
| 429 Too Many Requests | >1 req/s | Throttle client-side (1.1s) |
| 500/503 | Service down | Retry, cache fallback |
| Empty results | Query too vague | Require ≥3 chars, add context |
| Wrong location | Ambiguous name | Use map click for precision |

### Overpass (Venues)

| Error | Cause | Fix |
|---|---|---|
| All endpoints fail | Network/blocking | Check firewall, try VPN |
| Timeout | Query too complex | Reduce radius, timeout |
| Empty results | No venues in area | Status: thin, larger radius |
| Invalid JSON | Malformed query | Validate Overpass QL |

### LLM Provider

| Error | Cause | Fix |
|---|---|---|
| 401/403 | Invalid key | Rotate `LLM_API_KEY` |
| 429 | Rate limited | Backoff, check quota |
| Timeout (45s) | Slow model | Reduce max tokens, simpler prompt |
| Validation error | Malformed JSON | Repair retry (1x), then fallback |
| Budget mismatch | LLM ignores constraint | Repair retry, then template fallback |

---

## Database Issues

### MongoDB Connection

| Error | Cause | Fix |
|---|---|---|
| Connection refused | Not running | Start MongoDB / check URI |
| Authentication failed | Bad credentials | Check `MONGODB_URI` user/pass |
| SSL/TLS error | Cert mismatch | Check `tls=true` in URI |
| Timeout | Network/firewall | Check security groups, VPC |

### In-Memory Fallback

| Behavior | Note |
|---|---|
| Data lost on restart | Expected — demo/dev only |
| No indexes | Manual queries slower |
| No TTL on ext_cache | Manual cleanup needed |

---

## Environment Issues

### Missing `.env`

```bash
cp .env.example .env
# Fill required keys
```

### Wrong `NEXT_PUBLIC_API_URL`

```bash
# Frontend calls wrong backend
# Check: browser Network tab → API calls to correct host
# Fix: Set NEXT_PUBLIC_API_URL in .env, restart web
```

### CORS Errors

```
Access to fetch at 'http://localhost:8000/api/campaigns' from origin 'http://localhost:3000' has been blocked by CORS policy
```
**Fix**: Add frontend origin to `CORS_ORIGINS` in backend `.env`
```bash
CORS_ORIGINS=http://localhost:3000,https://your-preview.vercel.app
```

### Port Conflicts

```bash
# Port 3000/8000 in use
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
pnpm dev
```

---

## Testing Issues

### Backend Tests Fail

```bash
# Run with verbose
cd apps/api && uv run pytest tests/test_pipeline.py -v -s

# Common:
# - Fixture outdated → update from live behavior
# - Mock not matching → check respx patterns
# - Async fixture → ensure @pytest.fixture async
```

### Frontend TypeCheck Fails

```bash
pnpm typecheck
# Common:
# - API types outdated → pnpm generate:api
# - Missing import → add import
# - Type mismatch → fix to match API contract
```

### Lint Fails

```bash
pnpm lint
# Common:
# - Unused var → remove or prefix _
# - React hooks exhaustive-deps → add dependency
# - Prettier format → pnpm exec prettier --write .
```

---

## Getting Help

### Internal

1. Check this troubleshooting guide
2. Search GitHub Issues (open/closed)
3. Ask in `#healthreach-dev` Slack
4. Pair with teammate

### External

- **Qloo**: Support portal / API docs
- **Nominatim**: Operations list / GitHub Issues
- **Overpass**: Mailing list / GitHub
- **MongoDB**: Atlas support / Community forums
- **Vercel/Railway/Render**: Platform support

---

## Debugging Checklist

Before asking for help:

- [ ] Check `/health` and `/api/config`
- [ ] Check browser console (F12)
- [ ] Check Network tab for failed requests
- [ ] Check backend logs
- [ ] Verify `.env` has correct values
- [ ] Run `pnpm typecheck` and `pnpm lint`
- [ ] Run backend tests: `cd apps/api && uv run pytest -m "not live"`
- [ ] Try demo mode (no keys needed)
- [ ] Search existing GitHub Issues

---

*Related: [Runbook](RUNBOOK.md) · [Configuration](CONFIGURATION.md) · [Getting Started](GETTING_STARTED.md)*