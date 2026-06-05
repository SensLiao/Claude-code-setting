# 06 — Design system convergence (terminal pass)

This is the final design pass before deploy. Don't do it earlier — token churn during build is OK; ship-time inconsistency is the #1 reason work "looks AI-made".

## Audit

```bash
cd <project>
echo "=== Distinct durations ==="
grep -oE '[0-9]+ms' styles.css | sort -u
echo "=== Distinct easings ==="
grep -oE 'cubic-bezier\([^)]+\)' styles.css | sort -u
echo "=== Distinct font weights (Fraunces wght axis) ==="
grep -oE 'wght" [0-9]+' styles.css | sort -u
echo "=== Distinct font-weight values ==="
grep -oE 'font-weight: [0-9]+' styles.css | sort -u
echo "=== Distinct letter-spacings ==="
grep -oE 'letter-spacing: [0-9.]+em' styles.css | sort -u
```

If you see 8+ durations, 4+ easings, 5+ weights — convergence territory.

## Target ladder (the canonical 4 sets)

### Durations (3 tiers)

```css
--dur-fast: 320ms;   /* button hover, link feedback, color shift */
--dur-base: 620ms;   /* reveal animations, image scale on hover, nav pill state */
--dur-slow: 1100ms;  /* hero entrance choreography, slow zoom */
```

Anything outside this needs explicit justification (the only valid exception in U2 was Ken Burns 4500ms — labeled as "the camera move is its own time").

### Easings (2 curves)

```css
--ease:      cubic-bezier(0.32, 0.72, 0, 1);   /* crisp — UI state transitions */
--ease-soft: cubic-bezier(0.22, 1, 0.36, 1);   /* soft — reveals, image scale */
```

Each transition uses one or the other. Mixing is fine across properties (`color` with `--ease`, `transform` with `--ease-soft`) but never invent a third curve.

### Font weights (4 tiers)

```css
--w-display: 340;   /* h1, h2 — generous letterforms */
--w-card:    380;   /* h3 cards — slightly heavier so list items index */
--w-italic:  320;   /* italic accent — opens up the eye */
--w-body:    400;   /* serif body text */
```

Apply via `font-weight: var(--w-display)` and `font-variation-settings: var(--fr-display)` (the latter sets opsz + SOFT + wght together).

### Tracking (4 tiers)

```css
--tr-pill:   0.22em;   /* pill buttons */
--tr-ghost:  0.24em;   /* ghost links */
--tr-meta:   0.28em;   /* eyebrows, chapter labels, hero chrome */
--tr-mono:   0.18em;   /* mono numerals, model codes */
```

## Button system (2 species)

### Pill button (`.cta`, `.nav__cta`)

```css
.cta,
.nav__cta {
  display: inline-flex; align-items: center; gap: 0.85rem;
  padding: 11px 18px 11px 22px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-family: var(--f-sans);
  font-size: 11.5px;
  letter-spacing: var(--tr-pill);
  text-transform: uppercase;
  background: transparent;
  width: fit-content;
  transition:
    background var(--dur-base) var(--ease),
    color var(--dur-base) var(--ease),
    border-color var(--dur-base) var(--ease);
  cursor: pointer;
}
.cta__arrow,
.nav__cta-arrow {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 999px;
  border: 1px solid currentColor;
  transition: transform var(--dur-base) var(--ease);
}
.cta__arrow svg,
.nav__cta-arrow svg { width: 10px; height: 10px; }

.cta:hover { background: var(--c-ink); color: var(--c-bg); }
.cta:hover .cta__arrow { transform: rotate(45deg); }
```

### Ghost link (`.hero__cue`, `.ghost-link`)

```css
.ghost-link,
.hero__cue {
  display: inline-flex; align-items: baseline; gap: 0.95rem;
  font-family: var(--f-sans);
  font-size: 11px;
  letter-spacing: var(--tr-ghost);
  text-transform: uppercase;
  color: currentColor;
  width: fit-content;
}
.ghost-link__line,
.hero__cue-line {
  display: inline-block;
  width: 56px; height: 1px;
  background: currentColor;
  opacity: 0.7;
  transition: width var(--dur-base) var(--ease), opacity var(--dur-base) var(--ease);
}
.ghost-link:hover .ghost-link__line,
.hero__cue:hover .hero__cue-line {
  width: 96px;
  opacity: 1;
}
```

### HTML usage

```html
<!-- Pill button -->
<a href="#index" class="cta">
  <span>Continue the index</span>
  <span class="cta__arrow" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9">
      <path d="M5 19 L19 5 M9 5 H19 V15" />
    </svg>
  </span>
</a>

<!-- Ghost link -->
<a href="#" class="ghost-link">
  <span>Read the note</span>
  <span class="ghost-link__line" aria-hidden="true"></span>
</a>
```

## Reveal animation (canonical)

```css
.reveal-block {
  opacity: 0;
  transform: translate3d(0, 14px, 0);
  transition:
    opacity var(--dur-base) var(--ease-soft),
    transform var(--dur-base) var(--ease-soft);
}
.reveal-block.is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}
.reveal-block:not(.is-visible) {
  will-change: transform, opacity;
}

/* Per-line reveal for paragraphs split by pretext */
.reveal-text .line {
  display: block;
  opacity: 0;
  transform: translate3d(0, 10px, 0);
  transition:
    opacity var(--dur-base) var(--ease-soft) calc(var(--i, 0) * 60ms),
    transform var(--dur-base) var(--ease-soft) calc(var(--i, 0) * 60ms);
}
.reveal-text.is-visible .line {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}
.reveal-text:not(:has(.line)) {
  opacity: 0;
  transform: translate3d(0, 14px, 0);
  transition:
    opacity var(--dur-base) var(--ease-soft),
    transform var(--dur-base) var(--ease-soft);
}
.reveal-text:not(:has(.line)).is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}
```

## Reduced-motion support

```css
@media (prefers-reduced-motion: reduce) {
  .reveal-block,
  .reveal-text .line,
  .reveal-text:not(:has(.line)) {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
  .hero__line, .hero__eyebrow, .hero__caption {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .hero__cue {
    animation: none !important;
    opacity: 1 !important;
    transform: translateX(-50%) !important;
  }
  .hero__video { animation: none !important; }
  .ribbon__track { animation: none !important; }
}
```

## Convergence checklist

```
[ ] All `transition: ... <Nms>` use --dur-fast / --dur-base / --dur-slow tokens
[ ] All `cubic-bezier(...)` either use --ease or --ease-soft
[ ] All `font-variation-settings "wght" N` use --w-* tokens (or var(--fr-*) bundles)
[ ] All `letter-spacing: Nem` use --tr-* tokens
[ ] All buttons render via .cta or .ghost-link family (no orphan custom buttons)
[ ] No `filter: blur` anywhere
[ ] No `mix-blend-mode` anywhere
[ ] No `mask-image: radial-gradient` over <video> (only via .hero__veil overlay)
[ ] @media (prefers-reduced-motion) overrides for all hero animations
[ ] Hover states have feedback on: pill buttons, ghost links, index cards, journal entries
```

If all 10 checked, design system is shipped-quality.
