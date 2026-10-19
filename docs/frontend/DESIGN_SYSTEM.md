# Design System — HealthReach AI

## Overview

HealthReach uses a **provenance-first, accessibility-focused design system** built on Tailwind CSS with CSS custom properties. The design prioritizes clarity, honesty, and usability for non-technical health organizers.

**Planned Update**: Align with TasteBound-inspired brutalist editorial design (warm canvas, mint/voltage accents, SuisseIntlCond typography) — see [Phase C TODO](../project/TODO.md).

---

## Current Design Tokens (`packages/ui/src/tokens.css`)

### Color Palette

```css
:root {
  /* Actions */
  --hr-primary: #2563eb;           /* Primary action blue */
  --hr-primary-hover: #1e40af;     /* Hover state */

  /* Surfaces */
  --hr-bg: #fafafa;                /* Page background */
  --hr-surface: #ffffff;           /* Card surface */
  --hr-text: #0a0a0a;              /* Primary text */
  --hr-text-secondary: #6b6b6b;    /* Secondary text */
  --hr-border: #e8e8ec;            /* Borders */
  --hr-muted: #9c9c9c;             /* Disabled/decorative only */

  /* Status */
  --hr-success: #10b981;
  --hr-warning: #f59e0b;
  --hr-error: #ef4444;
  --hr-brand-mark: #20970b;

  /* Layout */
  --hr-radius-card: 16px;
  --hr-radius-input: 12px;
  --hr-ring: 0 0 0 3px rgba(37, 99, 235, 0.35); /* Focus ring */
}

.dark {
  --hr-bg: #0c0c10;
  --hr-surface: #141419;
  --hr-text: #f4f4f5;
  --hr-text-secondary: #b6b6bd;
  --hr-border: #26262e;
  --hr-muted: #6e6e78;
  --hr-ring: 0 0 0 3px rgba(96, 165, 250, 0.45);
}
```

### Typography

| Element | Font | Size | Weight | Line Height |
|---|---|---|---|---|
| Display heading | General Sans | 48-64px | 600-700 | 1.1 |
| Heading | General Sans | 24-32px | 600 | 1.2 |
| Subheading | DM Sans | 18-20px | 500 | 1.3 |
| Body | DM Sans | 16px | 400 | 1.5 |
| Body small | DM Sans | 14px | 400 | 1.5 |
| Label/Button | DM Sans | 16px | 500 | 1.4 |
| Caption/Mono | Monospace | 12px | 400 | 1.4 |

**Two-weight rule**: Display uses 600-700, body uses 400, UI labels/buttons may use 500 — never three weights together.

### Spacing Scale

Base unit: 4px

| Token | Value | Use |
|---|---|---|
| `--spacing-1` | 4px | Tight gaps |
| `--spacing-2` | 8px | Standard gaps |
| `--spacing-3` | 12px | Element gaps |
| `--spacing-4` | 16px | Card padding, form gaps |
| `--spacing-6` | 24px | Section gaps |
| `--spacing-8` | 32px | Large section gaps |
| `--spacing-12` | 48px | Hero/major sections |

### Border Radius

| Token | Value | Use |
|---|---|---|
| `--hr-radius-input` | 12px | Inputs, selects |
| `--hr-radius-card` | 16px | Cards, containers |
| `--radius-pill` | 9999px | Pills, tags, badges |

### Shadows

**Minimal shadows only** — depth via surface contrast:
- Cards: `0 1px 3px rgba(0,0,0,0.05)` (barely visible)
- Elevated: `0 4px 12px rgba(0,0,0,0.08)` (modals, dropdowns)
- No heavy shadows, no gradients

---

## Provenance-First Visual Language

### Core Principle

**Never communicate provenance through color alone.** Every provenance value uses:
1. **Icon** (distinct SVG)
2. **Text label** (visible on hover/focus, optional inline)
3. **Left border** (3px solid/dashed/hatch)

### Provenance Specifications

| Provenance | Icon | Label | Border | Dark Mode |
|---|---|---|---|---|
| `qloo` | ◈ | Qloo signal | Solid 3px indigo (`#4F46E5`) | Lighter indigo |
| `geo` | ◎ | Verified place data | Solid 3px green (`#10B981`) | Lighter green |
| `ai` | ✦ | AI interpretation | Solid 3px purple (`#8B5CF6`) | Lighter purple |
| `user` | ● | You provided | Solid 3px blue (`#2563EB`) | Lighter blue |
| `illustrative` | ◇ | Illustrative data | **Dashed 3px amber + hatch** | Dashed + hatch |

### Implementation

```tsx
// packages/ui/src/ProvenanceBadge.tsx
const provenanceMeta = {
  qloo: { icon: QlooIcon, label: 'Qloo signal', border: 'border-l-3 border-indigo-600' },
  geo: { icon: GeoIcon, label: 'Verified place data', border: 'border-l-3 border-emerald-600' },
  ai: { icon: AiIcon, label: 'AI interpretation', border: 'border-l-3 border-violet-600' },
  user: { icon: UserIcon, label: 'You provided', border: 'border-l-3 border-blue-600' },
  illustrative: { 
    icon: IllustrativeIcon, 
    label: 'Illustrative data', 
    border: 'border-l-3 border-amber-600 border-dashed',
    className: 'bg-stripes' // CSS hatch pattern
  },
};
```

### Usage Rules

- **Every displayed value** carries provenance badge
- **Section-level**: SourceLegend shows all active provenances
- **Inline**: Badge on each signal card, venue card, plan activity, budget line, metric
- **Demo mode**: Persistent "Illustrative data" banner (dashed) + all values tagged illustrative

---

## Component Library

### Buttons

| Variant | Style | Use |
|---|---|---|
| Primary (`.btn-primary`) | `--hr-primary` bg, white text, pill radius (≥48px height) | Main CTAs: "Create outreach plan", "Save results" |
| Secondary (`.btn-secondary`) | White bg, `--hr-primary` border/text, pill radius | Secondary actions: "Get fresh ideas", "Technical details" |
| Ghost | Transparent, text only, underline hover | Tertiary: "Cancel", "Back" |
| Destructive | `--hr-error` bg, white text, pill radius | Delete, reject (rare) |

**Minimum touch target**: 48px height × 48px width

### Inputs

- Border: `--hr-border` (focus: `--hr-ring`)
- Radius: `--hr-radius-input` (12px)
- Height: 48px minimum
- Label: Above input, associated via `htmlFor`
- Error: `--hr-error` border + text, clears on edit
- Helper text: `--hr-text-secondary`, below input

### Cards

- Background: `--hr-surface`
- Border: `--hr-border` (optional, prefer surface contrast)
- Radius: `--hr-radius-card` (16px)
- Padding: 24px
- **No shadows** — depth via surface contrast

### Badges / Pills

- Radius: `--radius-pill` (9999px)
- Padding: 4px 12px
- Font: 12px monospace / 14px body
- Provenance badges: Icon + label + left border

### InfoTip (Accessible Popover)

- Trigger: Button with `aria-expanded`, `aria-describedby`
- Content: `role="tooltip"`, `id` referenced by trigger
- Keyboard: Enter/Space opens, Esc closes, focus trapped
- Position: Floating (Floating UI / similar)
- **Never `title` attribute** — content is essential

---

## Layout Patterns

### Page Structure

```
<Layout>
  <Nav />           {/* Fixed top, 64px height */}
  <main className="max-w-7xl mx-auto px-4 py-8">
    {/* Page content */}
  </main>
</Layout>
```

### Section Rhythm

```css
.section {
  @apply py-12 md:py-16;  /* 48px / 64px vertical */
}

.element-gap {
  @apply space-y-4 md:space-y-6;  /* 16px / 24px between elements */
}
```

### Grid Patterns

| Pattern | Columns | Gap | Use |
|---|---|---|---|
| Single | 1 | — | Mobile, narrow content |
| Two-col | 2 | 24px | Dashboard, comparison |
| Three-col | 3 | 24px | Card grids (metrics, venues) |
| Auto-fit | `minmax(280px, 1fr)` | 24px | Responsive card grids |

---

## Dark Mode

- Toggle in `Nav` (persists in `localStorage`)
- CSS `.dark` class on `<html>`
- All tokens have dark variants
- **Test both modes** for contrast

---

## Responsive Design

### Breakpoints

| Breakpoint | Tailwind | Width | Use |
|---|---|---|---|
| Mobile | default | < 640px | Single column, stacked |
| Tablet | `md:` | 640px - 1023px | Two-column, condensed |
| Desktop | `lg:` | ≥ 1024px | Full layout, 1200px max-width |

### Mobile-First Approach

```tsx
// Example: Responsive card grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

---

## Icons

- **Source**: Lucide React (tree-shakeable, consistent stroke)
- **Size**: 16px (inline), 20px (standalone), 24px (large)
- **Stroke**: 2px (consistent)
- **Provenance icons**: Custom SVGs in `ProvenanceBadge`

---

## Motion & Animation

### Allowed

- **Focus ring**: 150ms ease-out
- **Hover transitions**: 150ms ease (color, border, transform)
- **Loading skeletons**: Pulse animation (respects `prefers-reduced-motion`)
- **Dot-grid hero**: Slow pulse (landing only, `aria-hidden`, respects reduced motion)

### Forbidden

- Page transitions
- Parallax
- Auto-playing animations
- Motion without `prefers-reduced-motion` guard

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility Checklist

See [ACCESSIBILITY.md](ACCESSIBILITY.md) for full WCAG 2.1 AA compliance details.

### Quick Reference

- [ ] Semantic HTML landmarks
- [ ] Heading hierarchy (h1 → h2 → h3)
- [ ] Color contrast ≥ 4.5:1 (text), ≥ 3:1 (UI)
- [ ] Focus visible on all interactive elements
- [ ] Keyboard operable (Tab, Enter, Space, Esc, Arrows)
- [ ] Screen reader labels (`aria-label`, `aria-describedby`)
- [ ] Provenance: icon + text + border (never color alone)
- [ ] Map + text alternative (venue list)
- [ ] Form errors: associated, clear on edit
- [ ] `prefers-reduced-motion` respected

---

## Planned TasteBound-Inspired Update

### Target Aesthetic

| Aspect | Current | Planned (TasteBound-inspired) |
|---|---|---|
| Canvas | `#fafafa` | Warm gray `#e5e5e5` |
| Surface | `#ffffff` | `#ffffff` (cards) |
| Text | `#0a0a0a` | Carbon black `#000000` |
| Primary accent | Blue `#2563eb` | Mint `#d1ffca` (tags, links) |
| Highlight | — | Voltage yellow `#fff100` (micro) |
| Display font | General Sans | SuisseIntlCond / Barlow Condensed Bold |
| Body font | DM Sans | SuisseIntl / Inter |
| Radius | 12-16px | 24-64px (cards), 48px (pills) |
| Shadows | Minimal | **Zero** (flat design) |
| Depth | Shadows | Surface contrast (canvas → white → black) |

### Migration Strategy

1. Update `packages/ui/src/tokens.css` with new tokens
2. Update `apps/web/app/globals.css` Tailwind config
3. Audit all components for visual regressions
4. Test dark mode, contrast, responsiveness
5. Update component library if needed

---

*Related: [Frontend Architecture](FRONTEND_ARCHITECTURE.md) · [Routes & Workspace](ROUTES_AND_WORKSPACE.md) · [Accessibility](ACCESSIBILITY.md) · [Visualization Guidelines](VISUALIZATION_GUIDELINES.md)*