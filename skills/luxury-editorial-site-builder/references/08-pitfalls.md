# 08 — Pitfalls library (19 catalogued)

Each entry: **symptom → diagnosis → fix**. Skim this on Phase 4-9 — they're where most pitfalls live.

## Performance / GPU compositing

### 1. Hero scroll jank from `filter: blur`
- **Symptom**: page jerks or drops frames on scroll, especially during reveals
- **Diagnosis**: `filter: blur(...)` triggers GPU's slow alpha-blend path; with image-heavy reveals it's fatal
- **Fix**: replace with `transform + opacity` reveal (translate Y 14px, opacity 0→1)

### 2. Hero video `mask-image: radial-gradient` kills 60fps
- **Symptom**: subtle stutter on 1440p@60fps video, worse during crossfade
- **Diagnosis**: `mask-image` runs alpha-mask compositing every frame
- **Fix**: delete `mask-image` from `.hero__video`. Add the same fade-to-cream effect via a sibling overlay (`.hero__veil`) using normal `radial-gradient(...)` background — that's a cached static layer

### 3. `mix-blend-mode` overlay hurts scrolling
- **Symptom**: continuous slight GPU load even when idle
- **Diagnosis**: `mix-blend-mode` forces non-accelerated compositing
- **Fix**: just delete the noise/grain overlay. The editorial aesthetic doesn't need it; if you want texture use a low-opacity static SVG pattern instead

### 4. Long `will-change: transform` never clears
- **Symptom**: GPU memory grows over time
- **Diagnosis**: `will-change` was set on reveal elements but never removed after animation completes
- **Fix**: use `will-change` only while pending: `.reveal-block:not(.is-visible) { will-change: transform, opacity }`. After IO callback fires, `setTimeout` to clear: `target.style.willChange = "auto"` after ~1500ms

### 5. Off-viewport hero still consuming GPU
- **Symptom**: 10% baseline GPU usage when scrolled past hero
- **Diagnosis**: video continues decoding, marquee animation continues running
- **Fix**: IntersectionObserver on `.hero` — when not intersecting, pause active video + add `.is-paused` to ribbon. Add `document.visibilitychange` listener as tab-backgrounded fallback

## External CDN / hotlink

### 6. Pexels / picsum images return 403
- **Symptom**: some images broken in production but worked in dev
- **Diagnosis**: image hosts check Referer for hotlinking; cross-domain requests get blocked unpredictably
- **Fix**: never depend on third-party CDN for site-critical images. Generate via ChatGPT, store local, or use a placeholder SVG fallback via `onerror`

## Pretext text reveal

### 7. Pretext double-wraps lines (single dash on its own row)
- **Symptom**: pretext output looks fine in isolation but browser re-wraps in DOM, producing weird short lines like just `—`
- **Diagnosis**: pretext computes line breaks using canvas measureText with no letter-spacing; CSS `letter-spacing` (e.g. `0.005em`) shifts breaks slightly so browser disagrees with pretext
- **Fix**: parse `getComputedStyle(el).letterSpacing` to px and pass to pretext: `prepareWithSegments(text, fontStr, { letterSpacing })`. Also subtract 6px safety margin from `maxWidth`

### 8. `innerHTML` blocked by XSS hook
- **Symptom**: pretext line spans never appear; console shows hook block
- **Diagnosis**: project has a hook that intercepts `innerHTML` writes
- **Fix**: build with DOM API only — `createDocumentFragment()` + `createElement('span')` + `setProperty('--i', i)` + `textContent` + `replaceChildren(frag)`

### 9. `<script defer>` can't `await import`
- **Symptom**: pretext fails to load with `Cannot use import statement outside a module`
- **Diagnosis**: `defer` attribute scripts aren't ES modules
- **Fix**: use `<script type="module" src="./script.js"></script>` instead

## Video generation

### 10. 4K@60fps@200+Mbps source unusable on web
- **Symptom**: hero video file is 160+ MB, page takes 30s to load
- **Diagnosis**: raw AI generator output is over-bitrated for web
- **Fix**: `ffmpeg -c:v libx265 -crf 24 -preset medium -tag:v hvc1 -vf "scale=2560:-2,fps=60" -an -movflags +faststart output.mp4` → 5-10 MB at 1440p H.265

### 11. H.265 not supported in Firefox / Chromium
- **Symptom**: video doesn't play in Firefox; works in Safari/Chrome/Edge
- **Diagnosis**: H.265 is proprietary; Mozilla doesn't ship the codec
- **Fix**: provide multi-source — H.265 first, H.264 fallback:
  ```html
  <source src="./video/hero-a.h265.mp4" type='video/mp4; codecs="hvc1"' />
  <source src="./video/hero-a.h264.mp4" type="video/mp4" />
  ```

### 12. Native `<video loop>` snaps back with no fade
- **Symptom**: at end of clip, video resets to frame 0 with a hard cut
- **Diagnosis**: `loop` attribute does instant rewind, no transition primitive
- **Fix**: remove `loop` attribute, use the JS scheduler from `references/04-multi-video-crossfade.md`

### 13. `playbackRate` resets to 1.0 after currentTime jump
- **Symptom**: A→B crossfade: A plays at 0.75x but B plays at 1.0x
- **Diagnosis**: some browsers (Chromium-based) reset playbackRate when you set currentTime=0
- **Fix**: defensively re-set `next.playbackRate = PLAYBACK_RATE` right before `next.play()` in the advance() function

### 14. First A→B crossfade has black flash
- **Symptom**: first time A transitions to B, B shows 1 frame of black
- **Diagnosis**: B was preloaded but first frame not yet decoded; play() takes ~100-200ms to deliver frame 0
- **Fix**: at init, prime B by calling `B.play().then(() => { B.pause(); B.currentTime = 0 })`. This forces the decoder to deliver frame 0 immediately

### 15. fal.ai upload "Error initiating upload"
- **Symptom**: image upload fails with cryptic error after seemingly accepting the file
- **Diagnosis**: filename has Chinese characters, spaces, or emoji — fal's CDN URL-encoding pipeline breaks
- **Fix**: rename to ASCII before upload — `mv "ChatGPT Image 2026年5月4日.png" sofa.png`

### 16. Topaz upscale H.264 codec exceeds limits
- **Symptom**: Topaz returns "Width × Factor exceeds H264 limits"
- **Diagnosis**: H.264 hard-caps at 4096×4096; your factor pushes output above
- **Fix**: for 1080p source use Factor 2 (→ 4K UHD 3840×2160). For 720p source use Factor 3. Run `ffprobe -v error -show_entries stream=width,height` first to know

## Vercel deploy

### 17. New `*.vercel.app` alias returns 401 after rename
- **Symptom**: original short alias serves fine; newly added alias returns 401 unauthorized
- **Diagnosis**: Vercel's default `ssoProtection: "all_except_custom_domains"` exempts the original short alias but blocks new ones
- **Fix**: PATCH via API:
  ```bash
  curl -sS -X PATCH "https://api.vercel.com/v9/projects/${PROJ}?teamId=${TEAM}" \
    -H "Authorization: Bearer ${VTOKEN}" -H "Content-Type: application/json" \
    -d '{"ssoProtection":null}'
  ```

### 18. Vercel rename doesn't auto-create new short alias
- **Symptom**: API rename succeeded; `<newname>.vercel.app` returns 404
- **Diagnosis**: Vercel only auto-creates short aliases on initial project creation
- **Fix**: `vercel alias set <full-deployment-url> <newname>.vercel.app`

## Layout / responsive

### 19. Section title wrapping word-by-word in narrow grid column
- **Symptom**: at 1440px, "From the desk / to the container." breaks into 4 lines (each word own row)
- **Diagnosis**: `.section-head--wide` had `grid-template-columns: 1fr 1fr` giving title only ~660px; with 9rem font-size 11ch wants ~792px
- **Fix**: change to `grid-template-columns: 1.4fr 1fr` and constrain `.section-head__title { max-width: 13ch }` for the wide variant

### 20. Mobile caption squeezed to 1-2 words per line
- **Symptom**: at 390px, atelier section caption renders 1 word per line
- **Diagnosis**: `.section-head--wide .section-head__caption { grid-column: 2/3 }` causes implicit 2nd column when grid collapses to 1fr — caption gets phantom narrow column
- **Fix**: in mobile media query, explicitly reset grid-column + max-width:
  ```css
  @media (max-width: 760px) {
    .section-head--wide { grid-template-columns: 1fr; gap: 1.6rem; }
    .section-head--wide .section-head__title,
    .section-head--wide .section-head__caption {
      grid-column: 1; max-width: none;
    }
  }
  ```

## Quick reference: top 5 to keep in active memory

1. **Hero jank** — grep `filter: blur` and `mix-blend-mode`, delete both
2. **Mask over video** — use `.hero__veil` overlay, never `mask-image` on `<video>`
3. **fal upload error** — rename source files to ASCII before upload
4. **Topaz factor** — 1080p source × 2 = 4K (Factor 2 is the only safe answer for 1080p)
5. **Vercel new alias 401** — `PATCH ssoProtection: null` via API
