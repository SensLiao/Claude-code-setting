# Reference-Mode Protocol — image-to-code-skill

> Supporting file for `SKILL.md §2.a Reference-Mode Override`.
> Created 2026-05-27 in response to `.feedback/2026-05-26-custom-ui-three-step-workflow-must-be-default.md` and `.feedback/2026-05-26-skipped-image-to-code-and-faked-uat-completion.md` (Agent Atlas project), now generalized.

## When this mode applies

The skill switches from "I generate the design first" to "the user owns the design; I analyze it and emit skeletons" when ANY of these is true:

- prompt contains literal `mode=reference`
- prompt contains "reference-mode" / "no new image" / "analyse only" / "do not regenerate"
- the orchestrator (uiux-product-orchestrator §2.0 Reference Mode Entry) routes here
- the project has `design/reference/` with PNG files AND `.claude/harness.config.json` present (Harness Pack v1)

## Hard rules

1. **Do NOT generate new images.** The user-provided PNG is the source of truth.
2. **Do NOT crop / resize / re-touch the reference.** If a region needs zoom, ask the user to regenerate.
3. **Output is text + JSX/HTML skeletons + token JSON.** Not new imagery.
4. **Layout skeletons are layout-only.** No real data, no product copy, no L3 style detailing. The job is to lock chassis (where things go), not aesthetic.
5. **Respect the canonical project structure** (Harness Pack v1 convention):
   ```
   design/
   ├── reference/    <- user input, never edit
   ├── anchor/       <- locked extraction (you may write here after user approves)
   │   ├── ANCHOR-STYLE.md
   │   ├── PAGE-INDEX.md
   │   ├── tokens.json
   │   └── pages/<n>.png       <- promoted from reference after user OK
   └── prototype/<phase>/<n>.jsx  <- your skeleton output goes here
   ```

## Two-phase workflow

### Phase A — Analysis (writes `design/anchor/`)

Use SKILL.md §9 "DEEP IMAGE ANALYSIS REQUIREMENT" but on the user's reference, not on a regenerated image.

Extract:

- Color tokens (paste hex values, do not normalize / shift)
- Type tokens (family if identifiable, sizes via measurement, weights)
- Spacing scale (gutter / padding / margin observable)
- Component anatomy per region (sidebar, hero, card, modal, etc.)
- Layout grid (column count, breakpoints)
- Forbidden deviations (what the reference explicitly does NOT do — e.g., "no purple gradients", "no centered hero")

Output to `design/anchor/tokens.json`, `ANCHOR-STYLE.md`, `PAGE-INDEX.md`. Promote curated PNGs into `design/anchor/pages/<n>.png` only after the user signals approval (do not silently copy).

### Phase B — Skeleton emission (writes `design/prototype/<phase>/`)

Per surface in `design/anchor/PAGE-INDEX.md`, emit one JSX (or HTML) file containing:

- Outer container with `data-anchor-region="page"`
- Sub-regions tagged `data-anchor-region="sidebar|main|aside|footer|hero|widget-N"` matching anchor anatomy
- Sizes from `tokens.json` (`var(--space-N)`, `var(--text-N)`) — no magic numbers
- `[placeholder]` strings for all text/copy positions
- `<img src="/placeholder.svg" alt="ref:01-dashboard.png#hero-photo" />` for image positions
- No interactivity beyond `<button data-action="primary">`
- No L3 style detailing (don't pick a font that doesn't exist in the user's reference, don't apply a shadow style not seen in reference)

Filename convention: `design/prototype/<phase>/<NN>-<surface-slug>.jsx`.

After emission:

1. Ask user to review the JSX skeleton in a separate window (or render via `index.html` shell if helpful).
2. Iterate on the **prompt** — not the image — until the skeleton matches reference layout.
3. Once user approves, the skeleton becomes the layout contract referenced by `.planning/phases/<phase>/UI-SPEC.md <layout_skeleton>`.

## Lock semantics (Harness Pack v1 projects)

After Phase A approved: caller runs `node .claude/scripts/harness-state.js lock-anchor`.
After Phase B approved: caller runs `node .claude/scripts/harness-state.js lock-prototype`.

Until both locks are set, `harness-gate.js pre-edit` will block any Edit/Write on `src/app/`, `src/components/`, `src/styles/`. This is the physical enforcement of the three-step protocol.

## What this mode does NOT do

- Does not pick aesthetic detail (font weight, exact shadow, hover state animation) — that's later L3 / L6 work
- Does not write real data fetching code
- Does not invent missing surfaces — if anchor PAGE-INDEX lists 6 surfaces and user provided only 3, mode=reference yields 3 skeletons and 3 [PENDING] entries
- Does not run image generation as fallback when reference is incomplete — instead ask the user to provide more references
