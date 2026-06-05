# 05 — Image asset pipeline

## Aspect ratio map (canonical)

| Slot | Container ratio | Source ratio to generate | Notes |
|---|---|---|---|
| Hero video source | 16:9 | 16:9 horizontal | Drives video aspect ratio |
| Index `--feature` card | 5:6 | 5:6 portrait or 4:5 (CSS object-fit cover crops) | Tallest of the index cards |
| Index `--offset` card | 4:5 | 4:5 portrait | Standard product portrait |
| Index card 3rd-child | 4:5 | 4:5 portrait | |
| Index `--quiet` card | 5:7 | 5:7 portrait or 2:3 | Tallest, narrowest |
| Object section media | 4:5 | 4:5 portrait or 3:4 | Editorial featured product |
| Atelier frames | 3:4 / 4:5 / 3:4 | Skip — use placeholder.svg | Workshop/process frames are hard to source authentically |

## ChatGPT prompt template

```
Generate a [aspect ratio] [horizontal/portrait/vertical] hero image for a high-end [category] website.

Subject: [specific product description with materials]

Setting: [pure white seamless OR warm-cream minimalist room with optional context]

Lighting: studio product lighting — soft key light from upper left, gentle fill, subtle rim light catching [material name] texture, soft shadows.

Style: photorealistic, premium [category] catalog aesthetic, magazine quality, no text, no watermarks, no logos.
```

## sips compression (macOS built-in, no install)

Single image:

```bash
sips -s format jpeg -s formatOptions 85 -Z 1600 \
  "<source.png>" --out <name>.jpg
```

Batch (drop into your project's `img/` folder):

```bash
cd <project>/img
for f in /Users/qinyuan/Downloads/sofa.png \
         /Users/qinyuan/Downloads/table.png \
         /Users/qinyuan/Downloads/cabinet.png; do
  name=$(basename "$f" .png).jpg
  sips -s format jpeg -s formatOptions 85 -Z 1600 "$f" --out "$name" >/dev/null
  ls -la "$name"
done
```

### Why these flags

- `-s format jpeg` — universal browser support
- `-s formatOptions 85` — quality 85 is the editorial sweet spot. 90+ is wasted bits, 80- shows visible artifacts in gradients
- `-Z 1600` — resize longest edge to 1600px while preserving aspect. Hero card on 1440 retina ≈ 1600px wide max display, so larger source is wasted

Typical compression: 2.5 MB PNG → 500 KB JPEG, ~80% reduction.

## File naming

ASCII-only, lowercase, hyphenated, descriptive:

```
img/mari-table.jpg
img/gianni-sofabed.jpg
img/kori-table.jpg
img/u26-material.jpg
```

NOT: `img/Mari Table.jpg`, `img/01_产品.jpg`, `img/IMG_2738.jpg`. ASCII naming dodges the same fal.ai upload bug + makes Vercel CDN hashing predictable.

## HTML pattern

```html
<div class="index__media">
  <img
    src="./img/mari-table.jpg"
    alt="The Mari Table, in porcelain stone — round on a sculptural pedestal."
    loading="lazy"
    decoding="async"
    onerror="this.onerror=null;this.src='./img/placeholder.svg';"
  />
</div>
```

- `loading="lazy"` — only loads when scrolled near, saves first-paint bytes
- `decoding="async"` — non-blocking image decode
- `onerror` fallback — if the JPG ever 404s (deploy hiccup, file rename), shows the placeholder SVG instead of broken image icon

## Placeholder SVG (canonical, save as `img/placeholder.svg`)

The "image awaiting production" placeholder works as a graceful fallback AND as a permanent stand-in for atelier frames where you can't source authentic shots.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#DCD7C9"/>
      <stop offset="60%" stop-color="#CCC4B2"/>
      <stop offset="100%" stop-color="#B9B19D"/>
    </linearGradient>
    <radialGradient id="light" cx="30%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#E8E2D2" stop-opacity="0.85"/>
      <stop offset="60%" stop-color="#D4CCB7" stop-opacity="0"/>
    </radialGradient>
    <pattern id="hairlines" x="0" y="0" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M0 22 H44" stroke="#1A1715" stroke-width="0.4" stroke-opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#warm)"/>
  <rect width="100%" height="100%" fill="url(#light)"/>
  <rect width="100%" height="100%" fill="url(#hairlines)"/>
  <g font-family="ui-monospace, 'Geist Mono', monospace" fill="#1A1715" fill-opacity="0.22">
    <text x="44" y="80" font-size="13" letter-spacing="3">PLATE Nº — / —</text>
    <text x="44" y="100" font-size="11" letter-spacing="2">[BRAND]</text>
  </g>
  <g font-family="'Fraunces', Georgia, serif" fill="#1A1715" fill-opacity="0.12" font-style="italic" text-anchor="middle">
    <text x="400" y="540" font-size="44">image awaiting</text>
    <text x="400" y="610" font-size="44">production</text>
  </g>
  <g font-family="ui-monospace, 'Geist Mono', monospace" fill="#1A1715" fill-opacity="0.32" text-anchor="end">
    <text x="756" y="956" font-size="11" letter-spacing="2">P2 · SITE-07</text>
  </g>
</svg>
```

Replace `[BRAND]` with the actual brand wordmark. Keep the warm-cream gradient + hairline pattern + italic "image awaiting production" — that's what makes it look intentional rather than broken.

## CSS for image rendering (canonical)

```css
.index__media,
.object__media,
.atelier__frame > img {
  width: 100%;
  background: var(--c-bg-alt);
  object-fit: cover;
  transform: scale(1.02);
  transition:
    transform var(--dur-slow) var(--ease-soft),
    filter var(--dur-base) var(--ease);
  filter: saturate(0.88) contrast(0.97);
}
.index__item:hover .index__media img,
.atelier__frame:hover > img {
  transform: scale(1.06);
  filter: saturate(0.95) contrast(1.0);
}
```

The `saturate(0.88) contrast(0.97)` filter is part of the editorial look — desaturates slightly so even the most colorful product images blend into the warm-cream tonal palette. Hover restores to natural saturation.

## Image reuse strategy

When you have one strong shot of the hero product, reuse it across multiple slots:

- Index card 01 (feature) — uses `mari-table.jpg`
- Object section — uses `mari-table.jpg` (same file, browser caches, zero extra fetch)

Don't reuse the same shot across cards within the index grid — each card needs distinct content. But cross-section reuse is fine and saves bytes.

## When ChatGPT can't render the product

Symptom: AI-generated product looks generic / wrong details / wrong proportions despite specific prompts.

Two paths:
1. **Provide a reference image** when using a ChatGPT/DALL·E tier with image-input support (Plus and Pro tiers as of 2026-05). Drop the actual product photo as input + ask DALL·E to generate the editorial setting around it.
2. **Use the placeholder.svg** for that slot. Editorial brands often have "image awaiting production" plates in their actual catalogs. It's not a workaround, it's a pattern.

## Output budget

For a typical 4-card index + 1 object section site:

| Asset | Size |
|---|---|
| Hero video A (1440p H.265) | ~5 MB |
| Hero video A (H.264 fallback) | ~10 MB |
| Hero video B (1440p H.265) | ~7 MB |
| Hero video B (H.264 fallback) | ~14 MB |
| 4 product JPGs @ 500 KB | 2 MB |
| placeholder.svg | 2 KB |
| **Total static** | ~38 MB |
| **First-paint transfer** | ~5 MB (one video + HTML/CSS/JS, others lazy/cached) |

That's a fast load on any reasonable connection. If you target sub-3MB first paint, reduce hero video to 1080p H.265 (saves ~40%).
