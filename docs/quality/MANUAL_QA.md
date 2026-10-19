# Manual QA — HealthReach AI

## Overview

Manual browser QA validates real-user workflows that automated tests cannot fully cover. Run before each release and after significant UI changes.

## Test Environment

| Requirement | Specification |
|---|---|
| Browser | Chrome (latest), Firefox (latest), Safari (latest) |
| Viewports | Desktop: 1280×900, Mobile: 390×844 |
| Network | Online, Offline (DevTools), Throttled (Slow 3G) |
| Data | Real mode (with keys), Demo mode (no keys) |
| Accessibility | NVDA (Windows), VoiceOver (macOS/iOS) |

## QA Scripts Location

Browser QA scripts kept outside repo in `/tmp/hr-qa/`:
- `launch_chrome.sh` — Launches Chrome with puppeteer-core
- `capture_screenshots.py` — Captures each step
- `check_console_errors.py` — Fails on console errors
- `check_overflow.py` — Detects horizontal scroll

## Test Scenarios

### Scenario 1: Demo Happy Path (No Keys Required)

**Goal**: Verify complete demo flow works without any API keys.

**Steps**:
1. Open `http://localhost:3000`
2. Verify landing page loads: hero, 4 value cards, 4 steps, sources, ground rules
3. Click "See a working example"
4. Verify `/new?mode=demo` loads with Kothrud pre-filled:
   - Topic: "Free diabetes screening camp"
   - Location: "Kothrud, Pune"
   - Audience: 30-60
   - Budget: ₹10,000
   - Duration: 7 days
   - Objective: "Bring people to a camp"
5. Click "Create outreach plan"
6. Verify evidence loading: Qloo call counter shows steps 1→2→3
7. Verify evidence review:
   - Familiarity hints in plain language
   - Technical details toggle works
   - Qloo chain steps 1-3 displayed with status
   - MapView + venue list (text alternative)
   - "Visit and verify" badges on venues
   - Provenance badges on all values
   - Dashed "Illustrative data" banner visible
8. Click "Create outreach plan"
9. Verify plan review:
   - Activities with evidence refs
   - Venues with reasons + verification badges
   - Budget lines sum to ₹10,000 exactly
   - Materials (poster, message, script) with review notice
   - Metrics with target ranges + basis
   - "How this draft was made" line shows planner type
   - Pre-use checklist
10. Click "Get fresh ideas" on Activities section
11. Verify version increments, new activities loaded
12. Click "Enter results"
12. Fill: 214 registrations, 156 attendance, 9450 spend, 380 engagement
13. Click "Save results"
14. Verify analytics:
    - Planned vs actual table
    - Cost per registration calculated
    - Attendance rate calculated
    - "Descriptive, not causal" notice
15. Reload page → verify results persist (in-memory)

**Pass Criteria**: All steps complete without console errors, no horizontal overflow, all provenance visible.

---

### Scenario 2: Real Mode with Missing Credentials

**Goal**: Verify honest degradation when Qloo/LLM keys missing.

**Setup**: Ensure `QLOO_API_KEY` and `LLM_API_KEY` not set in `.env`

**Steps**:
1. Open `/new`, fill real brief (US location)
2. Submit → evidence loading
3. Verify Qloo status: "unavailable" or "thin" with plain-language note
4. Verify plan banner: "This plan was created without cultural signals"
5. Verify planner: "standard-template"
6. Verify all other functionality works (OSM venues, budget, materials)

**Pass Criteria**: No crashes, honest statuses, plan still usable.

---

### Scenario 3: Invalid Input Validation

**Goal**: Verify form validation and error handling.

**Steps**:
1. Open `/new`
2. Submit empty form → verify inline errors on all required fields
3. Fill topic with 2 chars → verify "at least 3 characters"
4. Fill topic with 121 chars → verify "at most 120 characters"
5. Set audience min > max → verify "min must not exceed max"
6. Set budget $400 → verify "at least $500"
7. Set duration 0 → verify "at least 1 day"
8. Fix all errors → verify errors clear on edit, submit works

**Pass Criteria**: All validation messages clear, helpful, input preserved.

---

### Scenario 4: Network Offline / Timeout

**Goal**: Verify offline handling and timeout behavior.

**Steps**:
1. Open `/new`, fill valid brief
2. Open DevTools → Network → Offline
3. Submit form
4. Verify friendly error: "You're offline. Your input is safe — try again when connected."
5. Verify form input preserved
6. Go online → retry → verify success
7. Repeat with Slow 3G throttle → verify timeout message

**Pass Criteria**: No data loss, clear messages, retry works.

---

### Scenario 5: Location Autocomplete + ClickMap

**Goal**: Verify location picking works via both methods.

**Steps**:
1. Open `/new`
2. Type "East Austin" in location → verify suggestions appear (debounced)
3. Select suggestion → verify field filled, coords stored
4. Clear field, click map near Austin → verify reverse geocode fills field
5. Verify text field = source of truth (edit field, map doesn't override)
6. Verify 120-char query cap
7. Verify no re-query after selection

**Pass Criteria**: Both methods work, sync correctly, debounce respected.

---

### Scenario 6: Campaign List & Resume

**Goal**: Verify campaign list shows correct state and resume works.

**Steps**:
1. Create 2-3 campaigns (mix of demo/real, different phases)
2. Open `/campaigns`
3. Verify each card shows: topic, location, date, mode badge, next-step badge
4. Click campaign at evidence phase → verify resumes at evidence section
5. Click campaign at plan phase → verify resumes at plan section
6. Click campaign at results phase → verify resumes at analytics

**Pass Criteria**: List accurate, resume works, badges correct.

---

### Scenario 7: Zero Results Analytics

**Goal**: Verify null-safe analytics rendering.

**Steps**:
1. Create campaign, generate plan
2. Enter results: 0 registrations, 0 attendance, 0 spend, 0 engagement
3. View analytics
4. Verify: "Not calculable — needs at least 1 registration"
5. Verify no division-by-zero errors in console
6. Enter 1 registration, 0 attendance → verify attendance rate = 0%, cost/reg calculable

**Pass Criteria**: No crashes, clear null messages, correct calculations.

---

### Scenario 8: Accessibility Spot Checks

**Goal**: Verify key accessibility requirements.

**Tools**: NVDA (Windows) / VoiceOver (macOS), axe-core browser extension

**Checks**:
| Check | Method |
|---|---|
| Heading hierarchy | NVDA: `H` key navigation |
| Form labels | NVDA: Tab through form, verify each announced |
| Error announcements | Submit invalid form, verify error announced |
| Provenance badges | NVDA: Focus badge, verify full description announced |
| Map alternative | NVDA: Verify venue list announced as alternative |
| Focus visible | Tab through page, verify focus ring visible |
| Color contrast | axe-core: Run full page scan |
| Reduced motion | OS setting: verify animations disabled |

**Pass Criteria**: axe-core zero violations, screen reader announces all content correctly.

---

### Scenario 9: Mobile Viewport (390×844)

**Goal**: Verify mobile layout and touch targets.

**Steps**:
1. Open DevTools → Device toolbar → iPhone 12 Pro (390×844)
2. Test landing page: hero stacks, CTAs full-width, readable text
3. Test brief form: fields stack, autocomplete usable, map touch-friendly
4. Test workspace: sections stack, venue list scrollable, charts readable
5. Verify touch targets ≥ 48px
6. Verify no horizontal scroll

**Pass Criteria**: All content accessible, no overflow, touch targets met.

---

### Scenario 10: Dark Mode

**Goal**: Verify dark mode works across all pages.

**Steps**:
1. Click dark mode toggle in Nav
2. Verify all pages: landing, brief, list, workspace
3. Check contrast: text on surfaces, borders visible
3. Check provenance badges: borders visible in dark
4. Check charts: colors distinguishable
5. Toggle back to light → verify all correct

**Pass Criteria**: No contrast failures, all components themed correctly.

---

## Reporting Template

```
## QA Report — <Date> — <Version/Commit>

### Environment
- Browser: Chrome 120 / Firefox 121 / Safari 17
- OS: macOS 14 / Windows 11
- Mode: Demo / Real (keys: Qloo ✓/✗, LLM ✓/✗)
- Viewport: 1280×900 / 390×844

### Scenarios Run
- [ ] Demo Happy Path
- [ ] Real Mode Missing Credentials
- [ ] Invalid Input Validation
- [ ] Network Offline/Timeout
- [ ] Location Autocomplete + ClickMap
- [ ] Campaign List & Resume
- [ ] Zero Results Analytics
- [ ] Accessibility Spot Checks
- [ ] Mobile Viewport
- [ ] Dark Mode

### Issues Found
| Scenario | Step | Issue | Severity | Screenshot |
|---|---|---|---|---|

### Console Errors
- [ ] Zero console errors (or documented expected)

### Overflow Check
- [ ] No horizontal scroll at any viewport

### Sign-off
QA Engineer: <name>
Date: <date>
Status: PASS / FAIL (with blockers)
```

---

## Known Limitations (Documented)

| Limitation | Workaround |
|---|---|
| No automated visual regression | Manual screenshot comparison |
| No automated accessibility in CI | Manual axe-core + screen reader |
| Live Qloo/LLM not tested in CI | Manual verification documented |
| No multi-browser automated | Manual cross-browser spot check |

---

*Related: [Test Strategy](TEST_STRATEGY.md) · [Acceptance Criteria](ACCEPTANCE_CRITERIA.md) · [Release Checklist](RELEASE_CHECKLIST.md)*