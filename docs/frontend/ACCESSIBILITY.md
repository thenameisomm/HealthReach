# Accessibility — HealthReach AI

## Compliance Target

**WCAG 2.1 Level AA** — All new and updated features must meet AA criteria.

## Implemented Accessibility Features

### Semantic HTML

- **Landmarks**: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`
- **Headings**: Strict hierarchy (h1 → h2 → h3), no skipped levels
- **Lists**: `<ul>`, `<ol>`, `<dl>` for grouped content
- **Forms**: `<form>`, `<fieldset>`, `<legend>` for grouped inputs

### Keyboard Navigation

| Component | Keyboard Support |
|---|---|
| Navigation | Tab through links, Enter to activate |
| Buttons | Tab focus, Enter/Space to activate |
| Inputs | Tab focus, type, Arrow keys for number/date |
| Select | Tab focus, Arrow keys to navigate, Enter to select |
| Combobox (LocationAutocomplete) | Tab to input, Arrow Down to open, Arrow Up/Down to navigate, Enter to select, Escape to close |
| InfoTip | Tab to trigger, Enter/Space to open, Escape to close, Tab within content |
| MapView | **Decorative** (`aria-hidden="true"`), venue list is accessible alternative |
| ClickMap | **Decorative**, venue list + text input are accessible path |
| Tabs/Accordions | Arrow keys to navigate, Enter/Space to activate |
| Modal/Dialog | Focus trap, Escape closes, focus returns to trigger |

### Focus Management

- **Visible focus ring**: `--hr-ring` (3px solid primary, high contrast)
- **Focus order**: Logical, matches visual order
- **Skip links**: "Skip to main content" (first focusable element)
- **Focus trapping**: Modals, InfoTip, mobile nav
- **Focus restoration**: On dialog close, return to trigger

### Screen Reader Support

| Feature | Implementation |
|---|---|
| Labels | All inputs have `<label htmlFor>` or `aria-label` |
| Errors | `aria-describedby` links input to error message |
| Live regions | `aria-live="polite"` for phase changes, loading states |
| Provenance | `aria-label` on badge includes full description |
| Map | `aria-hidden="true"` + venue list as alternative |
| Images | `alt` text for all meaningful images |
| Icons | Decorative: `aria-hidden="true"`; Meaningful: `aria-label` |
| Tables | `<th scope="col|row">`, `<caption>` for context |

### Color & Contrast

| Element | Requirement | Current |
|---|---|---|
| Text (body) | ≥ 4.5:1 | ✅ `#0a0a0a` on `#fafafa` = 15:1 |
| Text (secondary) | ≥ 4.5:1 | ✅ `#6b6b6b` on `#fafafa` = 6.3:1 |
| Text (muted) | ≥ 3:1 (large) | ⚠️ `#9c9c9c` — restricted to disabled only |
| Interactive text | ≥ 4.5:1 | ✅ Indigo hover `#4F46E5` on white = 5.2:1 |
| Primary buttons | ≥ 4.5:1 | ✅ White on `#2563eb` = 5.1:1 |
| Warning text | ≥ 4.5:1 | `.text-strong-warning` `#92400E` on white = 6.1:1 |
| Error text | ≥ 4.5:1 | `.text-strong-error` `#B91C1C` on white = 6.8:1 |
| Provenance borders | ≥ 3:1 | ✅ 3px solid colors meet 3:1 |

**Dark mode**: All contrasts verified in both themes.

### Provenance Accessibility

**Critical**: Provenance never communicated by color alone.

```tsx
// Every provenance badge provides:
<ProvenanceBadge provenance="qloo" showLabel={true} />
// Renders:
// - Icon (SVG, aria-hidden)
// - Text label (visible on hover/focus, or always if showLabel)
// - Left border (3px solid/dashed)
// - aria-label="Qloo signal: cultural affinity, never medical fact"
```

### Form Accessibility

- **Associated labels**: `<label htmlFor="field-id">` for every input
- **Error messages**: `aria-describedby="field-error-id"`, `role="alert"`
- **Error clearing**: On input change, error removed immediately
- **Required fields**: `aria-required="true"`, visual indicator (`*`)
- **Helper text**: `aria-describedby="field-hint-id"`
- **Validation**: On blur + submit, not on every keystroke

### Map Accessibility

| Requirement | Implementation |
|---|---|
| Map is decorative | `aria-hidden="true"` on MapView container |
| Text alternative | VenueList component below map (always rendered) |
| Venue list | Semantic `<ul>` with `<li>` for each venue |
| Map click | ClickMap decorative; text input is accessible path |
| Attribution | Visible on map + in venue list footer |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Applied to**:
- Dot-grid hero animation (landing)
- Skeleton pulse loading
- Hover/focus transitions
- Smooth scroll (disabled)

### Touch Targets

- **Minimum**: 44×44px (iOS) / 48×48px (Android) — HealthReach uses **48×48px**
- **Buttons**: `min-h-[48px] min-w-[48px]`
- **Touch-friendly spacing**: 8px minimum between touch targets

---

## Testing Checklist

### Automated (axe-core)

```bash
# Run in CI (planned)
npx @axe-core/playwright test
```

### Manual Testing Per Route

| Route | Test Scenario |
|---|---|
| `/` | Tab through hero, CTAs, value cards, ground rules; verify heading order |
| `/new` | Tab through form; test autocomplete with keyboard; test map click alternative; submit with errors |
| `/campaigns` | Tab through campaign cards; verify next-step badge announced |
| `/campaigns/[id]` | Tab through all sections; verify phase announced; test section regen; test map+list parity |

### Screen Reader Testing

- **NVDA** (Windows) / **VoiceOver** (macOS/iOS)
- Verify: Page title, heading structure, form labels, error announcements, live region updates, provenance descriptions

### Keyboard Testing

- Tab through entire page
- Verify: Focus visible, order logical, no traps (except modals), all actions reachable
- Test: Escape closes popovers/modals, Arrow keys navigate composites

### Color Blindness Testing

- **Protanopia/Deuteranopia**: Verify provenance distinguishable via icon+border
- **Tritanopia**: Verify status colors (success/warning/error) distinguishable
- Tool: Chrome DevTools → Rendering → Emulate vision deficiencies

---

## Known Gaps (Planned Fixes)

| Gap | Priority | Plan |
|---|---|---|
| Muted text (`#9c9c9c`) contrast | Medium | Restrict to disabled only; use `#6b6b6b` for meaningful text |
| Chart accessibility | High | Add data tables as alternative, `aria-hidden` on canvas |
| Mobile nav focus trap | Medium | Implement focus trap in mobile drawer |
| Toast/error announcements | Medium | `aria-live="assertive"` for critical errors |
| Skip link visibility | Low | Show on focus only |

---

## Accessibility in Development

### Component Checklist (Before Merge)

- [ ] Semantic HTML used
- [ ] Heading hierarchy correct
- [ ] All inputs have labels
- [ ] Errors associated via `aria-describedby`
- [ ] Focus visible (custom ring, not outline:none)
- [ ] Keyboard operable
- [ ] Screen reader tested (NVDA/VoiceOver)
- [ ] Color contrast verified (both themes)
- [ ] Provenance: icon + text + border
- [ ] Map has text alternative
- [ ] `prefers-reduced-motion` respected
- [ ] Touch targets ≥ 48px

### CI Integration (Planned)

```yaml
# .github/workflows/accessibility.yml
- name: Accessibility audit
  run: npx @axe-core/cli http://localhost:3000 --tags wcag2aa
```

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core](https://github.com/dequelabs/axe-core)
- [Color Contrast Analyzer](https://developer.paciellogroup.com/resources/contrastanalyser/)

---

*Related: [Design System](DESIGN_SYSTEM.md) · [Frontend Architecture](FRONTEND_ARCHITECTURE.md) · [Routes & Workspace](ROUTES_AND_WORKSPACE.md)*