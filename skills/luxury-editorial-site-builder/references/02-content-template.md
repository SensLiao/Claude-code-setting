# 02 — Fill-in content template

## Why use a template

Asking the user "what's your tagline" → "what's your address" → "what's your manifesto" inside chat is brutally slow. Generating a single markdown template they fill at their own pace converts 50+ chat turns into one async batch.

## Where to put it

`~/Downloads/<brand-slug>-content.md`. Downloads folder is universal Mac-friendly, doesn't pollute the project.

## Template structure

Each block has 4 parts:
1. **Where it appears** (specific section + element)
2. **Current placeholder** (what's in the HTML now)
3. **Writing guide** (length / tone / forbidden patterns)
4. **2-3 sample variations** (so user can pick a voice instead of starting from blank)

## Skeleton template (paste & adapt)

```markdown
# [Brand Name] — Content Fill-In

> Fill the blanks below. You can keep / edit / replace the suggested options under each block.
> When done, ping back the path to this file.

---

## §0 — Brand basics (machine-fillable, do these first)

- **Brand legal name**: ___________________
- **Brand display wordmark**: ___________________
- **Founded year**: ___________________
- **Founder name + title**: ___________________
- **Primary city / region**: ___________________
- **Industry / category**: ___________________
- **Tagline (≤ 8 words)**: ___________________
- **Trade registration / company number** (if you want it in footer): ___________________

---

## §1 — Hero (the 100dvh moment)

### Hero eyebrow (small caps line above the title)
- Where: top of hero, above the H1
- Current placeholder: `By [Founder], since [year in words]`
- Guide: 6-12 words, set in small caps. Don't say "WELCOME". Speak as if you've been here forever.
- Options:
  1. `By [Founder Name], since [year in words]`
  2. `Drawn in [city], shipped from [city]`
  3. `[Volume Nº] / [Season Year]`

### Hero title (3 lines, line 2 italic)
- Where: H1 in hero, oversized serif
- Current placeholder: `Drawn for / the rooms / you keep.`
- Guide: 3 lines, line 2 italic in muted-olive accent. ≤ 6 words per line. Should feel like a magazine cover line, not a value prop.
- Options:
  1. `Drawn for / *the rooms* / you keep.`
  2. `Made by hand, / *for the houses* / that wait.`
  3. `[Verb-ed] in [city], / *worn* / by the world.`

### Hero caption (2-line subtitle)
- Where: below H1, smaller sans
- Current placeholder: `[Brand] makes furniture in [city], since [year], / shipped — by the container — to [region].`
- Guide: ≤ 24 words total. Two phrases joined by a comma or em-dash. State a fact, not a promise.

### Hero scroll cue
- Where: bottom-center of hero
- Current placeholder: `Begin the catalogue   001 / 028   ____`
- Guide: 2-4 words label + a numeric "spread / volume" indicator. Mono numerals. Decorative trailing line (no clickbait).

---

## §2 — Top marquee ribbon (3 phrases that loop)

- Where: the topmost edge, scrolling sideways
- Current placeholder: 3 short phrases separated by `·`
- Guide: each phrase 4-9 words. Mix one operational, one editorial, one product update.
- Options:
  1. `Volume Nº [N] · Spring / Summer [year]`
  2. `Showroom by appointment · [address]`
  3. `[Product] is now in production · [model code]`

---

## §3 — Manifesto (section 001)

### Manifesto title (3 lines, line 2 italic)
- Guide: same shape as hero title but slightly smaller. State the brand's stance, not its slogan.
- Options:
  1. `Built for / *the container,* / made for the room.`
  2. `Slow / *for the few,* / shipped for the many.`

### Lede paragraph (the editorial hook, 3-5 sentences)
- Guide: first-person plural ("we"). State concrete facts (city, year, count). Don't sell, narrate.

### Body paragraph (philosophy, 4-6 sentences)
- Guide: explain materials, process, naming convention. Reveal one quirk or unusual choice.

### Signature line
- `— [Founder], [Title]`
- `[City], [Month Year]`

---

## §4 — Index of products (3-4 cards)

For each product, fill these fields:

#### Product 1
- **Product name + variant**: ____________________
- **Material / spec one-liner**: ____________________
- **Trade code / dimension stamp**: ____________________
- **Chapter label**: `Chapter 01 · [Category]`

(Repeat for products 2, 3, 4. Card 4 can be "forthcoming/not yet named".)

---

## §5 — Featured object (section 003 — single product editorial)

- **Object section eyebrow**: `003 — A piece, alone`
- **Object title (3 lines, line 3 italic)**: e.g. `The [Product] / — twenty-eight years / *of one round.*`
- **Object lede (1 sentence, evocative)**: e.g. "We draw the [product] for one particular hour — when the table has been cleared..."
- **Spec table** (4 rows, key/value pairs):
  - Frame: ____________________
  - Top / Cover: ____________________
  - Series: [code] · [dimension] · [volume]
  - Lead time: ____________________
- **CTA label**: e.g. "Continue the index"

---

## §6 — Workshop / Atelier (section 004 — 3 process frames)

3 frames, each with 1 sentence caption:

1. **I. [Verb-ing]**: "[Sentence about step 1, ≤ 12 words]"
2. **II. [Verb-ing]**: "[Sentence about step 2, ≤ 12 words]"
3. **III. [Verb-ing]**: "[Sentence about step 3, ≤ 12 words]"

Example: "I. Drawing. Every piece begins on paper, in [city]." / "II. Sampling. The first round is built by hand, in [city]." / "III. Loading. The container is the unit; the room, the destination."

Plus section header:
- Eyebrow: `004 — The Workshop`
- Title (large): `From the [start] / to the [end].`
- Caption (right column, ~30 words): describe pacing, season, headcount.

---

## §7 — Notes / Journal (section 005 — editorial 2-col)

For each entry (4 entries fits a balanced grid):

- **Meta**: `[Type] · [Read time] · [Date DD . MM . YYYY]`
- **Title** (≤ 12 words)
- **Dek** (1-2 sentence summary, ≤ 30 words)

Plus section header:
- Eyebrow: `005 — Notes, between fairs`
- Title (with italic accent): e.g. `Drawn for / *the next season.*`

---

## §8 — Footer (4 columns + giant wordmark)

### Showroom column
- Address (3 lines)
- Hours / appointment line

### Workshop column
- Address (3 lines)
- Hours / sampling line

### Correspondence column
- Email
- Phone
- Reply policy line

### Index column
- (Auto-populated from nav)

### Footer base row
- Roman numeral copyright: e.g. `© [start year in Roman] — [end year in Roman]`
- Made-where line: e.g. `Drawn in [city A], made in [city B]`
- Registration: e.g. `[Country] CR No. [N]`

---

When done, paste this file's path back to me and I'll batch-replace. ~30 minutes' work; saves us 50 chat turns of back-and-forth.
```

## Tips when generating

- **Pre-fill with the brand's actual public data** if you can find it (website footer, About page, LinkedIn). The user only fills the gaps.
- **Use bracketed placeholders** like `[Founder Name]` consistently so search-replace works batch-wise later.
- **Keep options short**. 3 max per field. Too many options paralyzes; 0 options blocks.
- **Anchor tone**. Write all options in the same voice (editorial / understated / first-person plural) — gives the user a target without lecturing.

## After receiving the filled file

1. Read the entire file once
2. Use `Edit` tool with `replace_all: false` per block
3. For repeated placeholders (e.g., `[Brand]` appearing 30+ times), use `replace_all: true`
4. After replacement, rerun the page in browser — most things look right immediately, but watch for:
   - Words that broke line wrapping in titles (add `&nbsp;` between glued pairs)
   - Italic accents that became too long (shorten the italic clause)
   - Spec table rows with trailing line breaks

The U2 Living version of this template was 531 lines for a furniture brand with 4 products, 4 journal entries, 3 workshop frames. That's a useful size benchmark.
