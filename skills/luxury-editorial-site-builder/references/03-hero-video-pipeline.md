# 03 — Hero video generation pipeline

## Tool selection (as of 2026-05)

**Default: Hailuo 02 Pro on fal.ai** — `fal.ai/models/fal-ai/minimax/hailuo-02/pro/image-to-video`

| Model | Verdict | When to use |
|---|---|---|
| **Hailuo 02 Pro** | ✅ DEFAULT | Product 3D shows, environment shots, anything that needs simple form + reliable upload + no-cut behavior |
| Veo 3.1 (full) | ⚠ Conditional | Best material rendering for ultra-premium textures (leather, marble, metallics), but $0.40/sec and aggressively cuts scenes by default. Use only if Hailuo failed twice and you need more material-realism. Always include "single uninterrupted take, one continuous shot from start to finish, ABSOLUTELY NO CUTS. NO SCENE CHANGES. NO TRANSITIONS. ONE SHOT ONLY" in prompt |
| Veo 3.1 Fast | ❌ Avoid | Material rendering is noticeably weaker; not worth the savings for a hero |
| Seedance Pro (v1) | ✅ Backup | URL `fal.ai/models/fal-ai/bytedance/seedance/v1/pro/image-to-video`. $0.047/sec, 1080p native. Form is more complex than Hailuo. Use when batching 5+ videos |
| Kling 3.0 Pro | ❌ Avoid for products | Form has 10+ optional fields (Multi Prompt / Element / End Image) that randomly break uploads with non-ASCII filenames. Strong for character/scene work, but overkill for furniture |
| Sora | ❌ Discontinued | OpenAI shut down Sora web/app on 2026-04-26 |

## Why Hailuo wins for editorial brand work

1. Form has 4 fields (Prompt / Image / End Image URL / Prompt Optimizer) — nothing breaks
2. Default settings are right (768p output, 6s, 16:9 follows source aspect)
3. Reliable uploads (other than the Chinese-filename bug, which is universal)
4. Respects "no cuts" prompts more reliably than Veo (Veo cuts scenes by default; Hailuo's default is single take)
5. ~30-60s generation, ~$0.48 per 6s video

## Prompt template (Hailuo)

Hailuo doesn't take long prompts well. Keep concise. Use this template:

```
Slow smooth cinematic [push-in / 90-degree orbit / dolly pull-back / static medium shot] toward
the [product description with 2-3 specific material words], single continuous shot, no cuts.
[Lighting description, 1 sentence]. Photorealistic, premium [category] catalog aesthetic, luxury brand hero video.
```

### Examples for furniture

**Product orbit** (around-and-back-to-start):
```
Slow smooth cinematic 90-degree orbit around the gray fabric sectional sofa with white topstitching, 
chaise lounge, and adjustable headrests. Single continuous shot, no cuts. Soft warm studio lighting 
from upper left. Photorealistic, premium furniture catalog aesthetic, luxury brand hero video.
```

**Product push-in** (magazine cover feel):
```
Slow smooth cinematic push-in toward the gray fabric sofa-bed with fur throws, white linen, and beige 
quilt draped across it. Single continuous shot, no cuts. Soft morning sunlight from the left. 
Photorealistic, premium furniture catalog aesthetic, luxury sofa-bed brand hero video.
```

**Static atmospheric** (no camera move, environmental):
```
Static medium shot of the round porcelain stone dining table with sculptural pedestal base in a warm 
beige minimalist room, Hong Kong skyline through the window. Subtle natural light shifts only. 
Single continuous take, no cuts. Photorealistic, premium catalog aesthetic.
```

### Example for fashion / apparel

```
Slow smooth dolly-in toward the cashmere overcoat on a tailor's mannequin, soft directional 
window light revealing fabric weave and lapel stitching. Single continuous shot, no cuts. 
Photorealistic, premium fashion editorial aesthetic, luxury brand campaign video.
```

### What Hailuo respects

- Specific material words: `绒面 / 缝线 / 金属铰链 / 大理石纹理 / cashmere / topstitching / leather grain`
- Camera move type: `push-in`, `pull-back`, `90-degree orbit`, `static`
- Light direction: `from the left`, `upper-right window`, `soft warm overhead`
- Aesthetic anchor: `magazine quality`, `premium catalog`, `luxury brand hero video`

### What Hailuo ignores (don't waste prompt budget)

- Camera tech jargon (`ARRI Alexa`, `50mm`, `f/2.8`) — these are Veo-specific
- Aspect ratio in prompt — driven by source image
- Frame rate in prompt — fixed by model
- Color grading specs (`teal-orange`, `Kodak Portra`) — partially respects, but rarely changes much

## Settings (Hailuo 02 Pro)

```
Prompt: <above template, filled in>
Image: <ASCII-named source>     ← critical, no Chinese / no spaces
End Image URL: empty
Prompt Optimizer: OFF           ← critical, otherwise Hailuo's LLM rewrites your prompt and the result drifts
```

## Source image preparation

The source image's aspect ratio determines the video aspect ratio. For website hero, use 16:9.

### Generate via ChatGPT (DALL·E 3)

```
Generate a 16:9 horizontal hero image for a high-end [furniture / fashion / interior design] website.

[Specific product description: e.g., "Gray fabric sectional sofa with chaise lounge on the left, 
adjustable headrests, white topstitching on tufted cushions"]

Setting: pure white seamless background OR warm-cream minimalist room with [optional: window view].
Studio product lighting: soft key light from upper left, gentle fill, subtle rim light catching 
[material name] texture.

Style: photorealistic, premium furniture catalog aesthetic, magazine quality.
No text, no watermarks, no logos.
```

### File naming

After generating, save to `~/Downloads/<product-name>.png`. **Rename to ASCII before fal.ai upload** — Chinese characters or spaces in filenames trigger fal's "Error initiating upload" CDN bug.

```bash
mv "~/Downloads/ChatGPT Image 2026年5月4日 20_27_13.png" ~/Downloads/sofa.png
```

## Phase 5 — Topaz upscale to 4K

Hailuo outputs 720p or 768p. Web hero needs 2K minimum, ideally 4K.

URL: `fal.ai/models/fal-ai/topaz/upscale/video`

### Settings

| Field | Value | Why |
|---|---|---|
| Model | **Gaia HQ** (or **Gaia CG** for stylized AI / **Gaia 2** for half-cost animation) | Verified options on fal Topaz endpoint as of 2026-05: Gaia HQ / Gaia CG / Gaia 2 / Proteus / Artemis HQ / Artemis MQ / Artemis LQ / Nyx variants. NEVER pick Artemis variants for AI-generated content — Artemis treats AI artifacts as real detail and over-sharpens |
| Upscale Factor | **2.0** | 1080p × 2 = 4K UHD (3840×2160), exactly within H.264's 4096×4096 limit |
| Recover Detail | **0.3** | Gentle sharpening. Above 0.5 looks over-processed for AI material |
| Compression / Noise / Halo / Grain | 0 (default) | AI video is already clean, removing nothing helps |
| H264 Output | **ON** | Essential for web playback; without it you get HEVC/ProRes which not all browsers support |
| Target FPS | empty | Preserve source frame rate |

### Critical pitfall: H.264 codec cap

H.264 hard-caps at 4096×4096. If you set Upscale Factor too high you get this error:

```
Width × Factor exceeds H264 limits
```

| Source resolution | Max Upscale Factor | Output |
|---|---|---|
| 720p (1280×720) | 3 | 3840×2160 (4K) |
| 768p (1366×768) | 3 | 4098×2304 — borderline, drop to 2.8 if errors |
| 1080p (1920×1080) | **2** | 3840×2160 (4K) |
| 1440p (2560×1440) | 1.5 | 3840×2160 (4K) |

If you don't know the source resolution, run `ffprobe` first:

```bash
ffprobe -v error -show_entries stream=width,height your-video.mp4
```

### Cost & time

- $0.08/sec source → $0.48 for 6s clip
- ~1-2 min processing
- Output: a single 4K .mp4 file

## When generation results are bad

### "It cuts mid-clip"

Cause: model decided to compress the camera move.
Fix: Add to prompt: `single continuous take, one shot from start to finish, no cuts, no transitions`.
If still cutting: shorten the camera move (90° instead of 360°), or cap at 5-6s instead of 10s.

### "Sofa morphs / proportions wrong"

Cause: source image too cluttered, model gets confused.
Fix: Regenerate source with cleaner background (pure white or solid neutral), product centered, no other furniture in frame.

### "Result looks plastic / unrealistic"

Cause: Hailuo's default lighting is sometimes too clean.
Fix: Add `Soft directional warm light, subtle shadows, slight imperfections in [material]` to prompt.
If still plastic: switch to Veo 3.1 (full version, not Fast) which has stronger physical material rendering. Pay the $3-4 once for the hero.

### "Camera moves too fast"

Cause: 8s is too short for a full orbit.
Fix: Reduce to 90° orbit, or extend to 10s, or use push-in instead of orbit.

## Cost ledger (per video for the U2 Living project)

| Step | Tool | Cost | Time |
|---|---|---|---|
| Source image | ChatGPT (existing subscription) | $0 | ~30s |
| Video gen 6s | Hailuo 02 Pro | $0.48 | ~45s |
| Topaz upscale 6s | Topaz Gaia HQ × 2.0 | $0.48 | ~90s |
| **Per video total** | — | **$0.96** | ~3 min |
| Two videos for crossfade | — | $1.92 | ~6 min |
