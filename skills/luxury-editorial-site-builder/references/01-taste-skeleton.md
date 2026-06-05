# 01 — Phase 0/1: Alignment + Taste-Driven Skeleton

This reference covers the first two phases (alignment interview + skeleton build with placeholder brand). Phase 0 happens BEFORE you write any code; Phase 1 produces a reviewable artifact gated by user sign-off.

## Phase 0 step-by-step

### Step A — Discover which taste skill is installed

```bash
ls ~/.claude/skills/ | grep -iE 'taste|design|visual'
```

Priority for invocation (use the highest available):
1. `high-end-visual-design` — preferred; has the strongest "high-end agency" presets (fonts, spacing, shadows, casing)
2. `design-taste-frontend` — strong fallback; senior UI/UX presets
3. `gpt-taste` — GSAP-leaning; OK fallback
4. `stitch-design-taste` — Google Stitch flavor; fallback

Invoke via the Skill tool: `Skill(skill: "high-end-visual-design")`. The skill's preset prompts load into your context — colors, type pairings, spacing scales, motion philosophy. **Don't paraphrase those — they're now in your context, build against them directly.**

### Step B — The 7-question alignment interview

Send this exact message to the user (Chinese, since the original developer's language preference is Chinese):

```
我准备开始搭建。在动手之前对齐 7 个问题：

1. 品牌中英文全称？是否有正式 wordmark（比如 U2 LIVING 全大写带空格）？
2. 行业 / 品类？（家具 / 服装 / 室内设计 / 工作室 / 其他）
3. 创立年份 + 创始人 / 城市？（决定 hero eyebrow 和 footer 法律行）
4. 参考品牌（任何让你"就要这种感觉"的网站）？
5. 主要城市 / 工作室地址？（决定 footer 列结构）
6. 网站核心场景：纯展示 / 邀约预约 / 批发渠道 / 设计师对接？
7. 有没有任何不能用的元素或必须有的元素？（PROJECT.md 风格 anti-CTA 规则、宗教 / 文化禁忌、必须出现的产品名等）
```

If the user is English-speaking, translate. If they already mentioned some answers earlier in the conversation, pre-fill and only ask the missing ones.

**Wait for full answers. Do not proceed with partial answers.**

### Step C — Confirm understanding before building

Once you have all 7 answers, send this 6-line confirmation:

```
确认理解：
- 品牌：[name]，[industry]，[city]，[year]
- 风格锚：[reference brands] → editorial / 杂志感 / 浅色中性
- 主场景：[scenario]
- 必有 / 禁忌：[constraints]
- Hero 形式：100dvh full-bleed [video / image]，oversized serif headline + italic accent
- 我会先用占位品牌跑通骨架，搭好后给你 desktop+mobile 截图过审

如果以上有偏差告诉我，否则我开干。
```

User confirms or corrects → enter Phase 1.

## Phase 1: Skeleton briefing template

After alignment, hand the taste skill (and your own building process) this exact briefing structure:

## Briefing template

Hand the taste skill this exact briefing structure (adapt brand keywords):

```
[Brand keywords]
- Reference brand: ESTUDIO ANÓNIMO (or whatever the user names)
- Style: editorial-luxury / 杂志感排版 / 大量留白 / 克制动效 / 浅色中性色
- Language: all-English copy (signals international luxury)

[Hero requirements — non-negotiable]
- Full-bleed 100dvh (use dvh not vh, for iOS dynamic viewport)
- Image or video covers entire hero, no margin/border
- Oversized serif headline (clamp(3rem, 12vw, 12rem))
- Italic accent line (one of three lines is italic, lighter weight)
- No "SaaS hero" tropes (no big CTA buttons, no tagline-with-button-pair)
- Centered or asymmetric editorial composition; never standard "left text right image"

[Section blueprint]
- 001 Manifesto: editorial first-person prose with italic accent in muted-olive
- 002 Index: 3-4 product cards in staggered grid (12-col with offsets)
- 003 Object: featured product as editorial split (large media + spec table + cta)
- 004 Atelier/Workshop: 3 staggered process frames
- 005 Journal/Notes: 2-col offset list of editorial entries
- Footer: 4-col (Showroom / Workshop / Correspondence / Index) + giant brand wordmark + base row

[Type system requirements]
- Display: variable serif with opsz/wght/SOFT/ital axes (Fraunces canonical)
- Sans: Geist or similar geometric utility sans
- Mono: Geist Mono or JetBrains Mono for plate numbers / specs
- 4 weight tiers: display 340 / card 380 / italic 320 / body 400

[Motion contract]
- 3-tier duration ladder (320/620/1100ms)
- 2-curve easing (--ease for state, --ease-soft for reveals)
- No filter:blur ever
- Reveals are translate + opacity only, max 14px Y offset
```

## Canonical design tokens (paste into `styles.css :root`)

```css
:root {
  /* Surface */
  --c-bg:        #E6E3DC;
  --c-bg-alt:    #DCD7C9;
  --c-bg-deep:   #1F1B18;
  --c-bg-deep-2: #15110F;

  /* Ink */
  --c-ink:       #1A1715;
  --c-ink-soft:  #6F6659;
  --c-ink-mute:  #9C9384;

  /* Lines & accent */
  --c-line:      #C8C0AE;
  --c-line-fine: #D2CBB9;
  --c-accent:    #6B6E3D;       /* muted-olive, italic accent only */
  --c-veil:      rgba(20,16,13,0.32);

  /* Type families */
  --f-display: "Fraunces", "Times New Roman", Georgia, serif;
  --f-sans:    "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono:    "Geist Mono", "JetBrains Mono", ui-monospace, monospace;

  /* Type weight ladder */
  --w-display: 340;
  --w-card:    380;
  --w-italic:  320;
  --w-body:    400;

  /* Optical sizes (Fraunces opsz + SOFT) */
  --fr-display:        "opsz" 144, "SOFT" 28, "wght" 340;
  --fr-display-italic: "opsz" 144, "SOFT" 60, "wght" 320;
  --fr-card:           "opsz" 36,  "SOFT" 30, "wght" 380;
  --fr-card-italic:    "opsz" 36,  "SOFT" 60, "wght" 340;
  --fr-body:           "opsz" 16,  "SOFT" 50, "wght" 400;
  --fr-light:          "opsz" 24,  "SOFT" 60, "wght" 320;

  /* Rhythm */
  --pad-x:      clamp(1.25rem, 4.5vw, 3rem);
  --section-py: clamp(7rem, 14vw, 13rem);
  --grid-gap:   clamp(1.25rem, 2.4vw, 2.25rem);

  /* Tracking ladder */
  --tr-pill:   0.22em;
  --tr-ghost:  0.24em;
  --tr-meta:   0.28em;
  --tr-mono:   0.18em;

  /* Motion */
  --ease:      cubic-bezier(0.32, 0.72, 0, 1);
  --ease-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast:  320ms;
  --dur-base:  620ms;
  --dur-slow:  1100ms;
}
```

## Google Fonts link

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..900,0..100;1,9..144,300..900,0..100&family=Geist:wght@300..600&family=Geist+Mono:wght@400&display=swap" rel="stylesheet" />
```

## Phase 1 deliverable: skeleton at sign-off readiness

Before sending to user for review, verify:
- [ ] Hero composition feels right at 1440×900 (screenshot)
- [ ] Mobile 390×844 stacks cleanly (screenshot)
- [ ] Headline italic accent uses muted-olive `#6B6E3D`, not pure black
- [ ] No `filter: blur` anywhere yet
- [ ] No mix-blend-mode anywhere yet
- [ ] All 7 sections render with placeholder content
- [ ] Pretext text reveal works on at least one paragraph

## Phase 1 review hand-off

Send the user this message with both screenshots:

```
骨架搭好了。截图：
- desktop: [/tmp/skeleton-desktop.png]
- mobile: [/tmp/skeleton-mobile.png]

请 review 三件事：
1. Hero 的字体 + 留白 + 标题排版是不是你想要的"杂志感"？
2. 各 section 的节奏（manifesto 编辑感 / index 错位卡片 / object 编辑式分屏 / workshop 三框 / notes 双栏）方向对不对？
3. 整体浅色中性调 + 米褐意大利体强调 OK 吗？

要改就告诉我哪一块；OK 的话我去做下一步（生成填空 md 让你填真实信息）。
```

**Iterate on aesthetic until user verbally signs off ("OK / 可以 / 继续" type confirmation). Do NOT proceed past Phase 1 without explicit confirmation.**

If the user wants changes, common adjustment levers (without breaking the system):
- Italic accent color: try `#7A8050` (more olive) or `#8C7355` (more rose-grey) instead of canonical `#6B6E3D`
- Headline weight: try `--w-display: 320` (lighter, more delicate) or `360` (slightly heavier, less Vogue)
- Section gap: increase `--section-py` clamp upper to `15rem` for more breathing room
- Marquee speed: change `animation: ribbon 60s linear infinite` to `90s` (slower, more elegant)

Don't change the typography pairing (Fraunces + Geist) or the warm-cream + ink palette — those define the brand of this skill, not the brand of the project.
