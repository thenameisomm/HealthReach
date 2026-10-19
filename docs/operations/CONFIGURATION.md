# Configuration — HealthReach AI

## Environment Variables Reference

All configuration via environment variables. **Server-side only** — nothing prefixed `NEXT_PUBLIC_` except API base URL.

### Required for Full Functionality

| Variable | Service | Description | Default |
|---|---|---|---|
| `QLOO_API_KEY` | Qloo | API key for cultural signals | `""` (demo mode) |
| `QLOO_BASE_URL` | Qloo | Qloo API base URL | `https://api.qloo.com` |
| `LLM_API_KEY` | LLM | OpenAI-compatible API key | `""` (template planner) |
| `LLM_BASE_URL` | LLM | LLM API base URL | `https://api.openai.com/v1` |
| `LLM_MODEL` | LLM | Model identifier | `gpt-4o-mini` |
| `MONGODB_URI` | MongoDB | Connection string | `""` (in-memory) |
| `MONGODB_DB` | MongoDB | Database name | `healthreach` |

### Frontend (Public)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000` |

### Server Behavior

| Variable | Description | Default |
|---|---|---|
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |
| `RATE_LIMIT_PER_MINUTE` | Requests per IP per minute | `60` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Complete `.env.example`

```bash
# ============================================
# Qloo Cultural Intelligence (Optional)
# Get key at https://qloo.com
# ============================================
QLOO_API_KEY=
QLOO_BASE_URL=https://api.qloo.com

# ============================================
# LLM Provider (Optional)
# OpenAI-compatible endpoint for AI-drafted plans
# Without this, deterministic template planner is used
# ============================================
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# ============================================
# MongoDB (Optional)
# Without this, in-memory fallback is used (data lost on restart)
# ============================================
MONGODB_URI=
MONGODB_DB=healthreach

# ============================================
# Server Configuration
# ============================================
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_PER_MINUTE=60
LOG_LEVEL=INFO

# ============================================
# Frontend (Public - NOT Secret)
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Configuration by Environment

### Local Development

```bash
# .env (create from .env.example)
QLOO_API_KEY=sk_live_...          # If you have one
LLM_API_KEY=sk-...                # If you have one
MONGODB_URI=mongodb://localhost:27017/healthreach
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Staging / Preview

```bash
QLOO_API_KEY=sk_live_...
LLM_API_KEY=sk-...
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/healthreach_staging
CORS_ORIGINS=https://staging.healthreach.example.com
NEXT_PUBLIC_API_URL=https://api-staging.healthreach.example.com
```

### Production

```bash
QLOO_API_KEY=sk_live_...
LLM_API_KEY=sk-...
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/healthreach_prod
CORS_ORIGINS=https://healthreach.example.com
NEXT_PUBLIC_API_URL=https://api.healthreach.example.com
RATE_LIMIT_PER_MINUTE=60
LOG_LEVEL=WARNING
```

---

## Configuration Validation

### Startup Checks

The API validates configuration on startup:

```python
# apps/api/app/config.py
class Settings(BaseSettings):
    QLOO_API_KEY: str = ""
    QLOO_BASE_URL: str = "https://api.qloo.com"
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    MONGODB_URI: str = ""
    MONGODB_DB: str = "healthreach"
    CORS_ORIGINS: str = "http://localhost:3000"
    RATE_LIMIT_PER_MINUTE: int = 60
    LOG_LEVEL: str = "INFO"
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"

    @property
    def qloo_configured(self) -> bool:
        return bool(self.QLOO_API_KEY.strip())

    @property
    def llm_configured(self) -> bool:
        return bool(self.LLM_API_KEY.strip())

    @property
    def mongodb_configured(self) -> bool:
        return bool(self.MONGODB_URI.strip())
```

### Health Endpoint Reports Config

```bash
curl http://localhost:8000/health
# {
#   "status": "ok",
#   "qloo_configured": true,
#   "llm_configured": false,
#   "mongodb_connected": true,
#   "timestamp": "2026-10-20T15:30:00Z"
# }
```

---

## Secrets Management

### Rules

1. **Never commit `.env`** — in `.gitignore`
2. **Never put secrets in `NEXT_PUBLIC_*`** — only `NEXT_PUBLIC_API_URL`
3. **Never log secrets** — `LOG_LEVEL=DEBUG` redacts keys
4. **Rotate keys** via platform (Vercel, Railway, GitHub Environments)
5. **Use platform secret stores** — not `.env` in production

### Platform-Specific

| Platform | Secret Storage |
|---|---|
| Vercel (Frontend) | Project Settings → Environment Variables |
| Railway (Backend) | Variables tab |
| Render (Backend) | Environment → Environment Variables |
| GitHub Actions | Repository/Environment Secrets |
| Docker | `--env-file` or orchestration secrets |

### Key Rotation

| Key | Rotation Frequency | Process |
|---|---|---|
| `QLOO_API_KEY` | Per Qloo policy | Update in platform, restart API |
| `LLM_API_KEY` | Per provider policy | Update in platform, restart API |
| `MONGODB_URI` | Per MongoDB policy | Update in platform, restart API |

---

## Feature Flags (Via Empty Config)

| Feature | Enabled When | Disabled Behavior |
|---|---|---|
| Qloo Cultural Signals | `QLOO_API_KEY` set | `qloo_status: unavailable`, plan flagged |
| LLM Plan Drafting | `LLM_API_KEY` set | Template planner (`standard-template`) |
| MongoDB Persistence | `MONGODB_URI` set | In-memory fallback |
| Rate Limiting | Always | N/A |

---

## Verifying Configuration

### Check All Settings

```bash
# API reports config status
curl http://localhost:8000/api/config
# {
#   "qloo_configured": true,
#   "llm_configured": false,
#   "demo_mode_available": true,
#   "version": "0.1.0"
# }
```

### Common Misconfigurations

| Symptom | Likely Cause | Fix |
|---|---|---|
| Qloo "unavailable" in real mode | `QLOO_API_KEY` empty or invalid | Set valid key |
| LLM not used | `LLM_API_KEY` empty | Set key or accept template |
| Data lost on restart | `MONGODB_URI` empty | Set MongoDB URI |
| CORS errors | `CORS_ORIGINS` missing frontend URL | Add frontend origin |
| Rate limited immediately | `RATE_LIMIT_PER_MINUTE` too low | Increase or check proxy headers |

---

## Debugging Config Issues

### Enable Debug Logging

```bash
LOG_LEVEL=DEBUG pnpm dev:api
```

### Test Individual Integrations

```bash
# Test Qloo (requires key)
cd apps/api && uv run python -c "
from app.services.qloo_client import fetch_cultural_signals
import asyncio
result = asyncio.run(fetch_cultural_signals('East Austin, TX', 30.25, -97.72, 'diabetes screening'))
print(result)
"

# Test Nominatim
cd apps/api && uv run python -c "
from app.services.geo_client import geocode
import asyncio
result = asyncio.run(geocode('East Austin, TX'))
print(result)
"

# Test Overpass
cd apps/api && uv run python -c "
from app.services.geo_client import nearby_venues
import asyncio
result = asyncio.run(nearby_venues(30.25, -97.72))
print(result)
"
```

---

*Related: [Getting Started](GETTING_STARTED.md) · [Development Workflow](DEVELOPMENT_WORKFLOW.md) · [Troubleshooting](TROUBLESHOOTING.md)*