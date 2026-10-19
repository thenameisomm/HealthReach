# Release Checklist — HealthReach AI

## Pre-Release Validation

Run all checks in order. Do not release if any required check fails.

### 1. Code Quality Gates

| Check | Command | Required | Status |
|---|---|---|---|
| Frontend TypeScript | `pnpm typecheck` | ✅ | ☐ |
| Frontend Lint | `pnpm lint` | ✅ | ☐ |
| Frontend Build | `pnpm build` | ✅ | ☐ |
| Backend Type Check | `cd apps/api && python -m mypy --strict app/` | ✅ | ☐ |
| Backend Tests | `cd apps/api && uv run pytest -m "not live"` | ✅ | ☐ |
| Backend Lint | `cd apps/api && python -m py_compile` (or ruff) | ✅ | ☐ |

### 2. Documentation Validation

| Check | Command | Required | Status |
|---|---|---|---|
| Markdown Links | `npx markdown-link-check docs/**/*.md` | ✅ | ☐ |
| SVG Validation | `npx svgo --check assets/README/*.svg` | ✅ | ☐ |
| API Parity | `pnpm generate:api` (API running) | ✅ | ☐ |
| README Links | Manual check GitHub rendering | ✅ | ☐ |

### 3. Security & Privacy

| Check | Method | Required | Status |
|---|---|---|---|
| No secrets in repo | `git-secrets --scan` or `trufflehog` | ✅ | ☐ |
| No `.env` committed | `git ls-files | grep -E "^\.env$"` | ✅ | ☐ |
| No PII in logs/code | Code review | ✅ | ☐ |
| Server-side secrets only | Verify `NEXT_PUBLIC_*` only for API URL | ✅ | ☐ |
| CORS configured | Verify `CORS_ORIGINS` for production | ✅ | ☐ |
| Rate limiting enabled | Verify 60/min/IP on `/api` | ✅ | ☐ |

### 4. Accessibility

| Check | Method | Required | Status |
|---|---|---|---|
| axe-core (WCAG 2.1 AA) | `npx @axe-core/cli http://localhost:3000 --tags wcag2aa` | ✅ | ☐ |
| Screen reader spot check | NVDA/VoiceOver on key flows | ✅ | ☐ |
| Keyboard navigation | Tab through all pages | ✅ | ☐ |
| Color contrast | DevTools contrast check | ✅ | ☐ |
| Provenance: icon+text+border | Visual review | ✅ | ☐ |
| Map + list alternative | Verify venue list below every map | ✅ | ☐ |
| Reduced motion | OS setting, verify animations disabled | ✅ | ☐ |

### 5. Functional Verification (Manual QA)

| Scenario | Required | Status |
|---|---|---|
| Demo Happy Path (full flow) | ✅ | ☐ |
| Real Mode Missing Credentials | ✅ | ☐ |
| Invalid Input Validation | ✅ | ☐ |
| Network Offline/Timeout | ✅ | ☐ |
| Location Autocomplete + ClickMap | ✅ | ☐ |
| Campaign List & Resume | ✅ | ☐ |
| Zero Results Analytics | ✅ | ☐ |
| Accessibility Spot Checks | ✅ | ☐ |
| Mobile Viewport (390×844) | ✅ | ☐ |
| Dark Mode | ✅ | ☐ |

### 5. Cross-Browser

| Browser | Viewport | Required | Status |
|---|---|---|---|
| Chrome (latest) | 1280×900 | ✅ | ☐ |
| Firefox (latest) | 1280×900 | ✅ | ☐ |
| Safari (latest) | 1280×900 | ⚠️ | ☐ |
| Chrome Mobile | 390×844 | ✅ | ☐ |
| Safari Mobile | 390×844 | ⚠️ | ☐ |

### 6. API Contract Verification

| Check | Method | Required | Status |
|---|---|---|---|
| OpenAPI schema served | `GET /openapi.json` returns 200 | ✅ | ☐ |
| Client parity | `pnpm generate:api` passes | ✅ | ☐ |
| All endpoints respond | Smoke test each endpoint | ✅ | ☐ |
| Error responses match spec | Verify 422/404/503 formats | ✅ | ☐ |
| Rate limiting works | 61st request returns 429 | ✅ | ☐ |

### 7. Data Integrity

| Check | Method | Required | Status |
|---|---|---|---|
| MongoDB indexes exist | `db.campaigns.getIndexes()` etc. | ✅ | ☐ |
| TTL index on ext_cache | Verify 24h expiry | ✅ | ☐ |
| In-memory fallback works | Test with `MONGODB_URI=""` | ✅ | ☐ |
| Plan versioning works | Regen increments version | ✅ | ☐ |
| Evidence steps persisted | Check `qloo_steps` in snapshot | ✅ | ☐ |

### 8. Demo Mode Isolation

| Check | Method | Required | Status |
|---|---|---|---|
| Demo data only in `demo_data.py` | `grep -r "illustrative" apps/api --include="*.py" | grep -v demo_data` | ✅ | ☐ |
| Real paths never import demo | Code review | ✅ | ☐ |
| Demo responses tagged illustrative | API response check | ✅ | ☐ |
| Persistent demo banner | UI check | ✅ | ☐ |

---

## Release Process

### Versioning

- **Scheme**: SemVer (MAJOR.MINOR.PATCH)
- **Current**: 0.1.0 (pre-1.0, breaking changes allowed)
- **Tag format**: `v0.1.0`

### Release Steps

1. **Update CHANGELOG.md** with version, date, changes
2. **Update version** in `package.json` and `apps/api/pyproject.toml`
3. **Create release branch**: `release/v0.1.0`
4. **Run all pre-release checks** (this checklist)
5. **Merge to integration branch**: `integration/healthreach-redesign`
6. **Tag release**: `git tag -a v0.1.0 -m "Release v0.1.0"`
7. **Push tag**: `git push origin v0.1.0`
8. **Deploy** (Vercel + Railway/Render)
9. **Verify production** (smoke test)
10. **Announce** (GitHub Release notes)

### Rollback Plan

If critical issue found post-deploy:

1. Revert deployment (Vercel: previous deployment; Railway: previous image)
2. Create hotfix branch from tag
3. Fix, test, release patch version
4. Document in CHANGELOG

---

## Post-Release

- [ ] Update `docs/project/CHANGELOG.md`
- [ ] Close related GitHub issues
- [ ] Update project board / milestones
- [ ] Communicate changes to stakeholders
- [ ] Monitor error rates (Sentry/logs) for 24h

---

## Release Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Lead Engineer | | | |
| QA Lead | | | |
| Product Owner | | | |

---

## Release History

| Version | Date | Branch | Key Changes |
|---|---|---|---|
| 0.1.0 | 2026-10-20 | integration/healthreach-redesign | Initial documentation system, API contracts, core features |

---

*Related: [Test Strategy](TEST_STRATEGY.md) · [Manual QA](MANUAL_QA.md) · [Test Strategy](TEST_STRATEGY.md)*