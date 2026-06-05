# 04 — Multi-video crossfade (HTML/CSS/JS)

## What this implements

Two product videos that crossfade smoothly: A → B → A → B forever, with no visible cut at the loop point. Total ~700ms opacity transition between clips. This is the runtime alternative to a single concatenated mp4 (which has a visible 1-frame seam at the join).

## Complete HTML

```html
<section class="hero" id="top">
  <div class="hero__media">
    <video
      class="hero__video hero__video--a is-active"
      data-hero-video
      autoplay
      muted
      playsinline
      preload="auto"
      aria-hidden="true"
    >
      <source src="./video/hero-a.h265.mp4" type='video/mp4; codecs="hvc1"' />
      <source src="./video/hero-a.h264.mp4" type="video/mp4" />
    </video>
    <video
      class="hero__video hero__video--b"
      data-hero-video
      muted
      playsinline
      preload="auto"
      aria-hidden="true"
    >
      <source src="./video/hero-b.h265.mp4" type='video/mp4; codecs="hvc1"' />
      <source src="./video/hero-b.h264.mp4" type="video/mp4" />
    </video>
    <div class="hero__veil"></div>
  </div>

  <div class="hero__chrome">
    <span class="hero__issue">Volume Nº 28 / SS 26</span>
    <span class="hero__locale">HKG — DONGGUAN / 22°20′N</span>
  </div>

  <div class="hero__content">
    <span class="hero__eyebrow">By [Founder], since [year-in-words]</span>
    <h1 class="hero__title">
      <span class="hero__line">Drawn for</span>
      <span class="hero__line hero__line--ital"><em>the rooms</em></span>
      <span class="hero__line">you keep.</span>
    </h1>
    <p class="hero__caption">[2-line subtitle here.]</p>
  </div>

  <a class="hero__cue" href="#manifesto">
    <span class="hero__cue-label">Begin the catalogue</span>
    <span class="hero__cue-num">001 / 028</span>
    <span class="hero__cue-line" aria-hidden="true"></span>
  </a>
</section>
```

## Complete CSS (hero block)

```css
.hero {
  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 640px;
  overflow: hidden;
  isolation: isolate;
  color: #fff;
  background: var(--c-bg);
}

.hero__media,
.hero__video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
}

.hero__video {
  object-fit: cover;
  transform: scale(1.0) translateZ(0);
  /* One-shot Ken Burns drift — outside the standard duration ladder */
  animation: heroDrift 4500ms var(--ease-soft) 100ms forwards;
  will-change: opacity;
  /* Crossfade contract */
  opacity: 0;
  transition: opacity 800ms var(--ease-soft);
  /* NO mask-image here — it's a GPU slow path on video. Edge fade is in .hero__veil */
}
.hero__video.is-active { opacity: 1; }
@keyframes heroDrift {
  from { transform: scale(1.0)  translateZ(0); }
  to   { transform: scale(1.04) translateZ(0); }
}

/* Veil — combines edge fade + center darken + top/bottom darken in one cached layer */
.hero__veil {
  position: absolute; inset: 0;
  pointer-events: none;
  background:
    /* Edge fade — replaces mask-image. Cream stop matches --c-bg so seam is invisible */
    radial-gradient(
      ellipse 72% 78% at 50% 50%,
      transparent 0%,
      transparent 38%,
      rgba(230,227,220,0.55) 78%,
      #E6E3DC 100%
    ),
    /* Centre darken under headline */
    radial-gradient(ellipse 60% 50% at 50% 55%, rgba(15,12,10,0.32), transparent 75%),
    /* Top/bottom darken under chrome and cue */
    linear-gradient(180deg, rgba(15,12,10,0.22) 0%, transparent 22%, transparent 78%, rgba(15,12,10,0.30) 100%);
}

.hero__chrome {
  position: absolute;
  top: 102px;
  left: var(--pad-x); right: var(--pad-x);
  display: flex; justify-content: space-between;
  font-family: var(--f-sans);
  font-size: 10.5px;
  letter-spacing: var(--tr-meta);
  text-transform: uppercase;
  color: rgba(255,255,255,0.78);
  z-index: 5;
}

.hero__content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: clamp(8rem, 18vh, 12rem) var(--pad-x) clamp(8rem, 18vh, 12rem);
  gap: clamp(1.6rem, 3.2vh, 2.6rem);
  z-index: 5;
}

.hero__eyebrow {
  display: inline-flex; align-items: center; gap: 0.7rem;
  font-family: var(--f-sans);
  font-size: 11px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.84);
  opacity: 0;
  transform: translateY(14px);
  animation: heroIn var(--dur-slow) var(--ease) 200ms forwards;
}

.hero__title {
  font-family: var(--f-display);
  font-variation-settings: var(--fr-display);
  font-size: clamp(3.4rem, 12vw, 12rem);
  line-height: 0.92;
  letter-spacing: -0.024em;
  color: #fff;
  font-weight: var(--w-display);
  text-align: center;
}
.hero__line {
  display: block;
  opacity: 0;
  transform: translateY(34px);
  animation: heroIn var(--dur-slow) var(--ease) forwards;
}
.hero__line:nth-child(1) { animation-delay: 280ms; }
.hero__line:nth-child(2) { animation-delay: 440ms; }
.hero__line:nth-child(3) { animation-delay: 600ms; }
.hero__line--ital {
  font-style: italic;
  font-variation-settings: var(--fr-display-italic);
  color: rgba(255,255,255,0.94);
}

.hero__caption {
  font-family: var(--f-sans);
  font-size: 13px;
  font-weight: 300;
  line-height: 1.7;
  color: rgba(255,255,255,0.82);
  max-width: 38ch;
  margin: 0 auto;
  text-align: center;
  opacity: 0;
  transform: translateY(16px);
  animation: heroIn var(--dur-slow) var(--ease) 760ms forwards;
}

.hero__cue {
  position: absolute;
  bottom: clamp(2.4rem, 6vh, 3.8rem);
  left: 50%;
  display: inline-flex; align-items: baseline; gap: 0.95rem;
  font-family: var(--f-sans);
  font-size: 11px;
  letter-spacing: var(--tr-ghost);
  text-transform: uppercase;
  color: rgba(255,255,255,0.92);
  z-index: 6;
  opacity: 0;
  transform: translate(-50%, 16px);
  animation: heroCueIn var(--dur-slow) var(--ease) 1100ms forwards;
}
@keyframes heroCueIn {
  to { opacity: 1; transform: translate(-50%, 0); }
}
.hero__cue-line {
  margin-left: 0.3rem;
  display: inline-block;
  width: 56px; height: 1px;
  background: rgba(255,255,255,0.7);
  transition: width var(--dur-base) var(--ease), background var(--dur-base) var(--ease);
}
.hero__cue:hover .hero__cue-line { width: 96px; background: rgba(255,255,255,1); }

@keyframes heroIn { to { opacity: 1; transform: translateY(0); } }
```

## Complete JS scheduler

Drop into `script.js` inside an async IIFE:

```js
(async () => {
  const heroVideos = Array.from(document.querySelectorAll("[data-hero-video]"));
  if (heroVideos.length < 2) return;

  const FADE_LEAD = 0.8;       // source-time seconds before clip end to start next
  const PLAYBACK_RATE = 0.75;  // editorial slow-down (0.7-0.8 sweet spot)
  let activeIdx = 0;

  // Prime: kick active video, decode inactive's first frame so first switch is zero-latency
  heroVideos.forEach((v, i) => {
    v.muted = true;
    v.playsInline = true;
    v.playbackRate = PLAYBACK_RATE;
    v.defaultPlaybackRate = PLAYBACK_RATE;
    if (i === activeIdx) {
      v.play().catch(() => {});
    } else {
      v.play()
        .then(() => { v.pause(); v.currentTime = 0; })
        .catch(() => { v.currentTime = 0; });
    }
  });

  const advance = () => {
    const current = heroVideos[activeIdx];
    const nextIdx = (activeIdx + 1) % heroVideos.length;
    const next = heroVideos[nextIdx];

    try { next.currentTime = 0; } catch {}
    next.playbackRate = PLAYBACK_RATE;  // defensive — some browsers reset rate after seek
    next.play().catch(() => {});
    next.classList.add("is-active");
    current.classList.remove("is-active");

    // After fade settled, rewind previous and pause to free decoder
    setTimeout(() => {
      try { current.pause(); current.currentTime = 0; } catch {}
    }, 850);

    activeIdx = nextIdx;
  };

  // Schedule advance whenever active clip is within FADE_LEAD of its end
  heroVideos.forEach((v) => {
    v.addEventListener("timeupdate", () => {
      if (!v.classList.contains("is-active")) return;
      if (!v.duration || isNaN(v.duration)) return;
      if (v.currentTime >= v.duration - FADE_LEAD) advance();
    });
    // Safety net — if timeupdate misses window (tab throttled), ended event fires advance
    v.addEventListener("ended", () => {
      if (v.classList.contains("is-active")) advance();
    });
  });

  // Suspend when offscreen — saves GPU + prevents background decode burning power
  const hero = document.querySelector(".hero");
  const ribbon = document.querySelector(".ribbon");
  let suspended = false;
  const suspend = () => {
    if (suspended) return;
    suspended = true;
    heroVideos[activeIdx]?.pause();
    ribbon?.classList.add("is-paused");
  };
  const resume = () => {
    if (!suspended) return;
    suspended = false;
    heroVideos[activeIdx]?.play().catch(() => {});
    ribbon?.classList.remove("is-paused");
  };

  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => e.isIntersecting ? resume() : suspend(), { threshold: 0.05 }).observe(hero);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      suspend();
    } else if (hero) {
      const r = hero.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) resume();
    }
  });
})();
```

Script tag:
```html
<script type="module" src="./script.js"></script>
```

`type="module"` is required if you use `await import` for pretext or other ES modules.

## Why this beats single concatenated mp4

| Feature | Concat mp4 | This setup |
|---|---|---|
| Loop seam | 1-frame artifact at join | Clean 800ms opacity crossfade |
| File-size cost | Single 8MB file | Two 5MB files (per source) but only one decoded at a time |
| Switch flexibility | Recompile to change order | Reorder `<source>` or add 3rd `<video>` |
| Per-video aspect | Must match | Can differ |
| Off-viewport pause | Single video pauses | Both videos + ribbon pause |
| Codec fallback | One codec only | H.265 + H.264 multi-source |

## Three+ video extension

Generalize to N videos by adding more `<video data-hero-video>` elements. The scheduler already uses `(activeIdx + 1) % heroVideos.length` so it cycles through all of them.

## Tuning knobs

- **`PLAYBACK_RATE = 0.75`** — slower feels more editorial. Below 0.5 looks comically slow on most furniture content. Above 0.9 isn't visibly slow. 0.7-0.8 is the sweet spot.
- **`FADE_LEAD = 0.8`** — must be ≥ CSS transition duration (800ms = 0.8s). Don't reduce below 0.8 or transition won't complete.
- **CSS `transition: opacity 800ms`** — tied to FADE_LEAD. Increase both proportionally for slower crossfade.
- **`--dur-slow 1100ms`** — hero entrance stagger. For chrome/eyebrow/title/caption/cue choreography.
- **Ken Burns `4500ms`** — outside the standard duration ladder on purpose. The drift is the only "camera move" the user sees, so it gets its own time. Don't tokenize this.

## Adding a third codec (AV1)

If you encode with `libsvtav1`:

```html
<source src="./video/hero-a.av1.mp4" type='video/mp4; codecs="av01.0.05M.08"' />
<source src="./video/hero-a.h265.mp4" type='video/mp4; codecs="hvc1"' />
<source src="./video/hero-a.h264.mp4" type="video/mp4" />
```

Order matters: browsers pick the first supported. AV1 → H.265 → H.264.
