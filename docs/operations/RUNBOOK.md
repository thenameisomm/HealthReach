# Runbook — HealthReach AI

## Common Operations

### Start Services

```bash
# Development (both)
pnpm dev

# Production-like (build + start)
pnpm build
pnpm start  # If configured
```

### Stop Services

```bash
# Dev: Ctrl+C in terminal
# Docker MongoDB:
docker stop <container_id>
```

### Restart Services

```bash
# Full restart
pnpm dev  # After Ctrl+C

# Backend only (if frontend running)
pnpm dev:api

# Frontend only (if backend running)
pnpm dev:web
```

---

## Health Checks

### API Health

```bash
# Liveness
curl -f http://localhost:8000/health || echo "API DOWN"

# Readiness (checks dependencies)
curl -f http://localhost:8000/api/config || echo "API NOT READY"
```

### Expected Healthy Responses

```json
// GET /health
{
  "status": "ok",
  "qloo_configured": true,
  "llm_configured": false,
  "mongodb_connected": true,
  "timestamp": "2026-10-20T15:30:00Z"
}

// GET /api/config
{
  "qloo_configured": true,
  "llm_configured": false,
  "demo_mode_available": true,
  "version": "0.1.0"
}
```

### Database Health

```bash
# MongoDB ping
docker exec <mongo_container> mongosh --eval "db.adminCommand('ping')"

// Or from API container
curl -f http://localhost:8000/health | jq .mongodb_connected
```

---

## Log Analysis

### Log Locations

| Environment | Location |
|---|---|
| Development | Console (stdout/stderr) |
| Railway/Render | Platform dashboard |
| Vercel | Vercel dashboard → Functions → Logs |
| Self-hosted | `journald` / log files |

### Key Log Patterns

| Pattern | Meaning | Action |
|---|---|---|
| `Qloo lookup failed (status=401)` | Qloo auth failed | Check `QLOO_API_KEY` |
| `Qloo lookup failed (status=429)` | Qloo rate limited | Wait, check usage |
| `Overpass lookup failed on all endpoints` | OSM unavailable | Retry later, check endpoints |
| `Nominatim throttle wait` | Normal (1 req/s) | No action |
| `LLM validation failed, retrying` | LLM output invalid | Normal (1 retry) |
| `LLM fallback to template` | LLM failed twice | Check `LLM_API_KEY` |
| `MongoDB unavailable, using in-memory fallback` | DB connection failed | Check `MONGODB_URI` |

### Log Levels

| Level | When |
|---|---|
| `DEBUG` | Verbose: every external request, cache hits |
| `INFO` | Startup, config, major state changes |
| `WARNING` | External service degraded, retries |
| `ERROR` | Unexpected exceptions, failed requests |

---

## Incident Response

### Severity Levels

| Severity | Definition | Response Time | Escalation |
|---|---|---|---|
| SEV-1 | Core workflow broken (can't create campaign) | 15 min | Page on-call |
| SEV-2 | Major feature degraded (Qloo/OSM down) | 1 hour | Notify team |
| SEV-3 | Minor issue (UI bug, slow performance) | Next business day | Ticket |

### Common Incidents

#### SEV-1: Cannot Create Campaign

**Symptoms**: POST `/api/campaigns` returns 500 or times out

**Diagnosis**:
1. Check API health: `curl /health`
2. Check logs for traceback
3. Common causes:
   - MongoDB connection failed → in-memory fallback should work
   - Geocoding timeout → Nominatim issue
   - Validation error → check request format

**Resolution**:
- If MongoDB: verify `MONGODB_URI`, restart API
- If Nominatim: check throttle, cache, fallback to demo mode
- If validation: fix client, deploy hotfix

#### SEV-2: Qloo Cultural Signals Unavailable

**Symptoms**: Evidence shows `qloo_status: unavailable`, plan banner "without cultural signals"

**Diagnosis**:
1. Check `/health` → `qloo_configured`
2. Check logs for `Qloo lookup failed`
3. Test Qloo directly: `curl -H "x-api-key: $KEY" "https://api.qloo.com/v2/insights?..."`

**Resolution**:
- If 401/403: rotate `QLOO_API_KEY`
- If 429: wait, implement backoff
- If 5xx: Qloo issue, wait for recovery
- If key missing: configure key or accept template-only mode

#### SEV-2: OSM Venues Unavailable

**Symptoms**: Evidence shows `geo_status: unavailable`, no venues on map

**Diagnosis**:
1. Check logs for `Overpass lookup failed on all endpoints`
2. Test endpoints manually: `curl https://overpass-api.de/api/interpreter`

**Resolution**:
- Usually transient — wait and retry
- If persistent: check endpoint status, consider alternative endpoints

#### SEV-3: Slow Performance

**Symptoms**: Evidence loading > 90s, plan generation > 10s

**Diagnosis**:
1. Check network latency to Qloo/Nominatim/Overpass
2. Check MongoDB query performance
3. Check for cold starts (serverless)

**Resolution**:
- Verify cache hits (geocode, Qloo)
- Optimize queries if needed
- Consider warming cache

---

## Deployment Operations

### Deploy to Vercel (Frontend)

```bash
# Automatic on push to main/integration
# Manual:
vercel --prod
```

**Environment Variables** (Vercel Dashboard):
- `NEXT_PUBLIC_API_URL`

### Deploy to Railway/Render (Backend)

```bash
# Automatic on push
# Manual: push to deploy branch or use CLI
railway up
# or
render deploy
```

**Environment Variables** (Platform Dashboard):
- All server-side variables from [CONFIGURATION.md](CONFIGURATION.md)

### Database Migration

```bash
# No formal migrations (Pydantic handles additive changes)
# For schema changes:
# 1. Make field optional with default
# 2. Deploy
# 3. Run one-time script if needed
# 4. Make required in next version
```

### Rollback

```bash
# Vercel: Dashboard → Deployments → Promote previous
# Railway: Dashboard → Deployments → Rollback
# Render: Dashboard → Deploys → Rollback
# Docker: docker tag previous_image current_image && docker push
```

---

## Monitoring & Alerting

### Key Metrics to Watch

| Metric | Target | Alert If |
|---|---|---|
| API p95 latency | < 500ms | > 2s |
| API error rate | < 1% | > 5% |
| Qloo success rate | > 95% | < 90% |
| OSM success rate | > 95% | < 90% |
| MongoDB connection | 100% | Any failure |
| Build success | 100% | Any failure |

### Recommended Alerts (Platform)

```yaml
# Example: Datadog / Prometheus alerts
- alert: APIHighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "API p95 latency > 2s"

- alert: QlooUnavailable
  expr: qloo_success_rate < 0.9
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Qloo success rate below 90%"
```

---

## Backup & Recovery

### MongoDB Backup

```bash
# Atlas: Automatic continuous backups
# Self-hosted:
mongodump --uri="mongodb://..." --out=/backup/$(date +%F)
```

### Recovery

```bash
# Point-in-time (Atlas)
# mongorestore (self-hosted):
mongorestore --uri="mongodb://..." /backup/2026-10-20
```

### Critical Data

| Collection | Recovery Priority |
|---|---|
| campaigns | High (user work) |
| evidence_snapshots | High (traceability) |
| plans | High (versioned work) |
| results | High (user data) |
| ext_cache | Low (rebuildable) |

---

## Security Operations

### Secret Rotation

```bash
# 1. Generate new key in provider
# 2. Update in platform (Vercel/Railway/Render)
# 3. Restart service
# 3. Verify /health shows configured=true
# 4. Revoke old key in provider
```

### Security Scan

```bash
# Dependencies
pnpm audit
cd apps/api && uv pip audit

# Secrets in code
git-secrets --scan
trufflehog filesystem .

# Container (if Docker)
docker scan <image>
```

---

## Maintenance Windows

### Scheduled

| Task | Frequency | Window |
|---|---|---|
| Dependency updates | Weekly | Monday 02:00 UTC |
| Security patches | As needed | Immediate |
| Database maintenance | Monthly | Sunday 04:00 UTC |
| Log rotation | Daily | Automatic |

### Emergency

```bash
# Emergency maintenance mode (if needed)
# 1. Deploy maintenance page (Vercel)
# 2. Scale API to 0 (Railway/Render)
# 3. Perform fix
# 4. Scale up, verify, remove maintenance page
```

---

## Contacts

| Role | Contact | Escalation |
|---|---|---|
| On-call Engineer | Slack @oncall | SEV-1 |
| Backend Lead | Slack @backend-lead | SEV-2 |
| Frontend Lead | Slack @frontend-lead | SEV-2 |
| DevOps | Slack @devops | Infrastructure |

---

*Related: [Configuration](CONFIGURATION.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Getting Started](GETTING_STARTED.md)*