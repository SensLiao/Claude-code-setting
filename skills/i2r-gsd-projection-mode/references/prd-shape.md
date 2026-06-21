# PRD.md Shape (authoritative)

This is the exact section order that `i2r.py assemble` emits. No section may be added, removed, or
reordered. Anchored on `examples/good-run/PRD.md`.

---

## Section order (must match exactly)

```markdown
---
type: prd
source: idea-to-requirements-orchestrator
handoff_status: <READY|NEEDS_REVIEW|BLOCKED>
---
# <name — the product/feature name from 01-intake.json>

## Goals
- <Primary goal — what the product does + why, one sentence per goal>
- <Success metric — the measurable outcome if stated in intake>

## Non-Goals / Out of Scope
- <Explicit exclusion from 03-scope.json out_of_scope[]>
- (deferred) <Item explicitly deferred — prefix with "(deferred)">

## Requirements
### <CAT>
<FR_ID>: <prose of the EARS-pattern FR — WHAT not HOW>
<FR_ID>: <prose>

### <CAT2>
<FR_ID>: <prose>

## Acceptance Criteria
- <AC-ID>: <prose from 06-acceptance.json scenario.prose — "Passes when …">
- <AC-ID>: <prose>

## Constraints
- <NFR-ID> [<iso25010_category>]: <one-sentence statement of the NFR constraint — NOT the full fit_criterion; include the threshold in brackets if short>
- <plain language constraint from 03-scope.json constraints[] that is not already an NFR>

## Locked Decisions
- <One-sentence statement of each locked decision — from 00-raw/ or recorded human sign-off>

## Open Questions
- <Question text from 01-intake.json items with clarification_status: needs_clarification>
- (none)   ← use this if all questions resolved

## How to feed GSD
- /gsd:ingest-docs            (full bootstrap; classified as PRD)
- /gsd:plan-phase --prd PRD.md (lightweight single-doc)
```

---

## Section-by-section rules

### Frontmatter
- `type: prd` is literal — do not change.
- `handoff_status` must match `gate-result.yaml verdict` exactly.
- `source: idea-to-requirements-orchestrator` is literal.

### `# <name>`
- H1 heading is the feature/product name, not a sentence.
- Source: `01-intake.json` product name / `02-context.json` summary.

### `## Goals`
- Plain English, one bullet per goal.
- First bullet: WHAT the product does + WHY (user/business value). One sentence.
- Subsequent bullets: measurable success metrics if stated in intake.
- Never list implementation steps, phases, or technical architecture here.

### `## Non-Goals / Out of Scope`
- Source: `03-scope.json` `out_of_scope[]` items.
- Items explicitly deferred get `(deferred)` prefix.
- Items that were debated and ruled out get a brief reason in parentheses.

### `## Requirements`
- Group by category (CAT) with `### <CAT>` subsections.
- One line per FR: `<FR_ID>: <EARS prose>`.
- FR prose is the **`rendered`** EARS sentence from `04-functional.json` (the assembler falls back to
  `system_response` when `rendered` is absent) — there is no `description` field on a requirement.
- Never include `source`, `priority`, or `ears_pattern` metadata in the PRD line (those are in
  `requirements.json`). The PRD is a human-readable summary.

### `## Acceptance Criteria`
- One bullet per scenario from `06-acceptance.json`.
- Format: `- <AC-ID>: <prose>` — exactly as projected by assemble.
- `prose` is taken verbatim from the `prose` field; do not paraphrase.

### `## Constraints`
- Source: `05-nfr.json` `required` NFRs + `03-scope.json` `constraints[]`.
- NFR lines: `- <NFR-ID> [<iso25010_category>]: <one-sentence statement>` — human-readable, not raw JSON.
- Include the threshold inline if brief (e.g., `p95 <= 2s`).
- Non-NFR constraints (access, geography, regulatory): plain bullets without NFR ID.

### `## Locked Decisions`
- Source: `01-intake.json` items with `source: decision` + recorded human decisions.
- One sentence per decision. No rationale unless the rationale is itself a constraint.
- Never fabricate locked decisions.

### `## Open Questions`
- Source: `01-intake.json` items with `clarification_status: needs_clarification`.
- If all resolved: `- (none)`. The section is always present.

### `## How to feed GSD`
- Always exactly these two lines — do not modify.
- GSD derives phases, tasks, architecture; I2R never tells GSD how to split the work.
