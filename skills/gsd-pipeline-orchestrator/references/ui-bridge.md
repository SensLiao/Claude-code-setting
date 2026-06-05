# UI Bridge — GSD ↔ Front-end 5-Skill Combo

> Reference doc for `gsd-pipeline-orchestrator`. Specifies how to bridge `/gsd-ui-phase` (which only produces UI-SPEC.md contracts) with the user's actual front-end design skills (ux-principles + prototyping-ui-directions + taste-skill + anchor-prototype-wave + luxury-editorial-site-builder).

---

## The Problem

`/gsd-ui-phase N` produces **UI-SPEC.md** — a design contract:
- Surface inventory (which pages / panels / modals)
- States (loading, empty, error, populated, disabled)
- Interactions + accessibility requirements
- Data shape per surface
- Validation gates for the UI implementation

It does **NOT** produce:
- Palette / typography / spacing tokens
- Layout, hierarchy, motion language
- Hi-fi mocks
- Visual chassis

Without the visual chassis locked, `/gsd-plan-phase` will plan tasks against a vague contract. The implementation will need re-work after visual decisions land. **The bridge prevents that.**

---

## Pipeline Position

```
Tier 1 step 2  →  /gsd-discuss-phase N --analyze
              ↓
Tier 2 (FRONTEND_OR_UI_HEAVY=true):
   ┌────────────────────────────────────────────────────────┐
   │  /gsd-ui-phase N        (produce UI-SPEC contract)     │
   │     ↓                                                   │
   │  UI BRIDGE — 5-skill front-end combo (this doc)        │
   │     ↓                                                   │
   │  Backfill locked tokens/chassis into UI-SPEC.md        │
   └────────────────────────────────────────────────────────┘
              ↓
Tier 1 step 4  →  /gsd-plan-phase N
```

---

## Bridge — 5 Stages

### Stage 0 — Read UI-SPEC.md + Decide Track

Open `.planning/phases/N/UI-SPEC.md`. Decide which TRACK applies:

| Track | When |
|---|---|
| **Track A: Greenfield (no anchor yet)** | First UI for this product / no existing visual chassis / want to explore directions |
| **Track B: Single surface (anchor locked)** | Visual chassis already exists; this phase touches 1-3 surfaces only |
| **Track C: Wave (anchor locked, 4-15 surfaces)** | Visual chassis already exists; this phase touches 4-15 surfaces |
| **Track D: Luxury brand landing** | Single-page editorial brand site (100dvh hero, magazine feel, video etc.) |
| **Track E: Audit-only (existing UI rework)** | UI already shipped; this phase fixes / improves it without redesign |

Each track uses a different combination of the 5 skills.

---

### Stage 1 — Pre-Design Foundation (ALL tracks)

Invoke **`ux-principles` MODE A (pre-design)** with the UI-SPEC.md surfaces:

```
Skill("ux-principles", args="MODE A | surfaces: {from UI-SPEC.md}")
```

Output: `pre-design-checklist.md` saved under `.planning/phases/N/ui-bridge/`:
- Which Laws of UX apply (Fitts, Hick, Jakob, Miller, etc.)
- Which NN heuristics to honor (visibility of system status, error prevention, etc.)
- Constraints to enforce (8px grid, 1.25 type scale, contrast minimums, etc.)
- Known anti-patterns to avoid

**Gate:** Pre-design checklist must be reviewable before Stage 2.

---

### Stage 2 — Design (track-specific)

#### Track A — Greenfield (no anchor)

```
Skill("prototyping-ui-directions",
      args="Stage 0-3 | brief: {UI-SPEC surfaces + pre-design-checklist}")
```

Produces:
- 3-5 variant directions (HTML/React mocks)
- Palette + token candidates per variant
- Comparison report
- Pre-prod prototype packages

**Then run `ux-principles` MODE C audit on each variant** to surface heuristic violations BEFORE the user picks one. Use sub-agents in parallel:

```
Agent(subagent_type="general-purpose",
      prompt="Audit variant A against ux-principles MODE C 10-heuristic + Built-for-Mars 5-lens")
Agent(...)  # variant B
Agent(...)  # variant C
```

**Gate:** User reviews variants + audits → locks ONE direction. Save locked chassis to `.planning/phases/N/ui-bridge/anchor.md` (palette, type stack, spacing scale, motion, key components).

#### Track B — Single surface (anchor locked)

```
Skill("taste-skill",
      args="anchor: {locked chassis path} | surface: {single surface from UI-SPEC}")
```

Produces: hi-fi craft for the single surface (HTML or React component), reusing locked tokens.

**Then run `ux-principles` MODE B (during-design)** for tactical look-up checks (spacing, hierarchy, color, typography numbers).

#### Track C — Wave (anchor locked, 4-15 surfaces)

```
Skill("anchor-prototype-wave",
      args="anchor: {locked chassis path} | surfaces: {list of 4-15 from UI-SPEC}")
```

Produces: master gallery `index.html` + N per-surface pages. Internal pipeline already runs deterministic validators + LLM grader + cross-AI review + fix-on-fail.

#### Track D — Luxury brand landing

```
Skill("luxury-editorial-site-builder",
      args="brief: {UI-SPEC surfaces + brand context}")
```

Track D is mostly self-contained and includes its own video gen / upscale / deploy pipeline. Skip Stage 4 wave reasoning — go straight to its own deploy.

#### Track E — Audit-only

```
Skill("ux-principles", args="MODE C post-audit | existing surfaces: {paths}")
```

Produces: scored UI-REVIEW.md with NN 10-heuristic + Laws of UX hits + Built-for-Mars 5-lens findings. Treat as the spec input for `/gsd-plan-phase`.

---

### Stage 3 — Post-Design Audit (ALL tracks except E, which IS the audit)

Invoke **`ux-principles` MODE C (post-audit)** on the locked design output:

```
Skill("ux-principles", args="MODE C | design output: {paths from Stage 2}")
```

Output: `post-audit.md` in `.planning/phases/N/ui-bridge/`:
- NN 10-heuristic findings (severity-scored)
- Laws of UX hit list
- Built-for-Mars 5-lens teardown
- Required fixes vs. nice-to-haves

**Gate:** All CRITICAL + HIGH heuristic findings must be addressed before Stage 4.

---

### Stage 4 — Backfill UI-SPEC.md

Edit `.planning/phases/N/UI-SPEC.md` to embed:

1. **Locked chassis path** (e.g., `→ .planning/phases/N/ui-bridge/anchor.md`)
2. **Token table** — palette, type scale, spacing, radii, shadows, motion durations/easings
3. **Per-surface link** — pointing to the locked mock or component
4. **Audit pass status** — Stage 3 verdict + remaining medium/low items as TODO in the plan

This is the **handoff contract** to `/gsd-plan-phase`.

---

### Stage 5 — Return to Tier 1 step 4

Resume the master pipeline at `/gsd-plan-phase N`. The planner now has a locked visual contract and won't generate tasks like "decide layout" or "pick palette" — those decisions are already in UI-SPEC.md.

---

## Track Decision Tree

```
Is there an existing locked anchor / design system for this product?
├── NO  → Track A (greenfield + variant exploration)
└── YES
    │
    ├── Is this a high-end brand landing page (editorial / hero video)?
    │   └── YES → Track D (luxury-editorial-site-builder, self-contained)
    │
    ├── Are we just auditing existing shipped UI without redesign?
    │   └── YES → Track E (ux-principles MODE C only)
    │
    ├── Single surface only (1-3 surfaces in scope)?
    │   └── YES → Track B (taste-skill)
    │
    └── 4-15 surfaces in scope?
        └── YES → Track C (anchor-prototype-wave)
```

---

## Anti-Patterns

- ❌ Skip `/gsd-ui-phase` and jump straight to design — the contract step prevents downstream rework
- ❌ Skip the bridge and go straight from `/gsd-ui-phase` to `/gsd-plan-phase` — planner will produce vague tasks
- ❌ Use `taste-skill` for a 4-15 surface wave — use `anchor-prototype-wave` instead
- ❌ Use `prototyping-ui-directions` after the anchor is locked — its job is BEFORE the anchor
- ❌ Use `luxury-editorial-site-builder` for product UI — it's for brand landing only
- ❌ Skip Stage 1 (`ux-principles` MODE A) — you'll re-discover problems in Stage 3 audit
- ❌ Skip Stage 3 (`ux-principles` MODE C audit) — visual taste without heuristic check ships UI that looks good and works poorly
- ❌ Run all 5 skills serially on every phase — 90% of UI phases use 2-3 skills total

---

## Composition with Agent Orchestration Patterns

| Stage | Agent pattern | Notes |
|---|---|---|
| Stage 1 (pre-design) | None — `ux-principles` runs in-thread | Quick |
| Stage 2 Track A variant audit | **Pattern 2** parallel fan-out | One audit agent per variant in parallel |
| Stage 2 Track C wave | Internal — `anchor-prototype-wave` already runs Pattern 2 + Pattern 5 (validator + LLM grader + cross-AI) | Don't double up |
| Stage 3 post-audit | **Pattern 1** single agent | unless cross-domain implications |
| If visual chassis is high-stakes (product launch) | **Pattern 6** santa-loop on locked anchor.md before backfill | Two independent visual reviewers |

---

## Output Artifacts (under `.planning/phases/N/ui-bridge/`)

```
ui-bridge/
├── pre-design-checklist.md   (Stage 1)
├── variants/                 (Stage 2 Track A only)
│   ├── variant-a/
│   ├── variant-b/
│   └── comparison.md
├── anchor.md                 (locked chassis after Stage 2)
├── surfaces/                 (Stage 2 output)
│   ├── <surface-slug>/
│   │   └── index.html or component.tsx
│   └── ...
├── audit/                    (Stage 3)
│   ├── nn-heuristics.md
│   ├── laws-of-ux.md
│   └── built-for-mars.md
└── handoff.md                (Stage 4 — what's been locked, what's TODO)
```

`/gsd-plan-phase` reads from `handoff.md` to know which decisions are locked vs. still open.

---

## Quick Reference

| User asks | Track | Skills invoked |
|---|---|---|
| "做个新 dashboard，几个方向看看" | A | ux-principles + prototyping-ui-directions + (audit per variant) |
| "在已有 design system 上加个 settings 页" | B | ux-principles + taste-skill |
| "v2 wave 把 5-12 个 surface 一次铺出来" | C | ux-principles + anchor-prototype-wave |
| "做个品牌 landing，杂志感 + 100dvh hero video" | D | luxury-editorial-site-builder (self-contained) |
| "审一下现在 UI 哪里不行" | E | ux-principles MODE C only |
