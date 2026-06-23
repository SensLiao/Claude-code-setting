# I2R Workflow — 8 phases + resumable state machine

This mirrors `scripts/i2r.py detect_state` exactly. The run folder is the state; `i2r.py status <run>`
reads it and prints the next action. Every stage writes exactly one file and is idempotent — re-entry is safe.

## Phase 0: Language selection (first interactive step)

Before `i2r.py init`, the orchestrator **asks the user**:

> "中文 or English? (Please reply with one word: `zh` or `en`.)"

Record the answer, then run:

```
python scripts/i2r.py init <idea|dir> --lang <zh|en>
```

The `lang` is stored in `ops/state.json` and echoed in every `_meta.lang`. The entire `out/` package is
produced in that one language — no simultaneous bilingual output. An optional secondary-language projection
is OFF by default and only emitted on explicit request.

## Phases

| # | Phase | Owner | Output | Gate |
|---|---|---|---|---|
| 0 | LANG + SCAFFOLD | orchestrator asks lang, then `i2r.py init --lang` | `raw/` + `ops/MANIFEST.json` + `ops/state.json` + `ops/run-log.md` | — |
| 0.5 | ROUTE | i2r-orchestrator | `internal/stages/00-mode-routing.json` | — |
| 1 | INTAKE | i2r-intake-clarifier | `internal/stages/01-intake.json` | ◇ CLARIFY-LOOP |
| 2 | CONTEXT | i2r-context-analyst | `internal/stages/02-context.json` | — |
| 2.5 | SEARCH (cond.) | i2r-evidence-researcher | `internal/stages/02b-evidence.json` | — |
| 3 | SCOPE | i2r-scope-architect | `internal/stages/03-scope.json` | ◇ SCOPE-GATE |
| 3.5 | SCOPE DEBATE (cond.) | i2r-orchestrator | `internal/stages/03b-scope-debate.json` | — |
| 4 | AUTHOR (∥) | i2r-functional-author ∥ i2r-nfr-author | `internal/stages/04-functional.json` + `internal/stages/05-nfr.json` | — |
| 5 | ACCEPTANCE | i2r-acceptance-author | `internal/stages/06-acceptance.json` | — |
| 6 | ASSEMBLE | `i2r.py assemble` | `out/` Markdown package + `internal/requirements.json` + `out/decisions/ADR-*.md` | — |
| 7 | REVIEW (∥) | i2r-completeness-critic ∥ Codex | `internal/stages/07-review.json` + `internal/stages/07-review.codex.json` (reviewed over the `out/` package) | ◇ REVIEW-LOOP |
| 8 | GATE | `i2r.py gate.check` | `audit/gate-result.yaml` + `audit/gate-result.md` + `out/READINESS.md` | ◇ G |

> Order note: ASSEMBLE runs **before** REVIEW because the santa-loop reviewers and the Reader Test review the
> `out/` Markdown package (what humans + downstream read), not the raw stage JSON. A repair re-authors the
> failed stage, then **re-assembles**, then re-reviews.

## Resumable state table (match `i2r.py status`)

| On-disk state | Next action |
|---|---|
| no run folder | PHASE 0: ask lang, then `i2r.py init --lang` |
| `raw/` present, no `internal/stages/00-mode-routing.json` | PHASE 0.5 author routing (see mode-router.md) |
| routed, no `internal/stages/01-intake.json` | PHASE 1 dispatch i2r-intake-clarifier |
| `01-intake.clarification_status == needs_clarification` | CLARIFY-LOOP: ask user (AskUserQuestion), `i2r.py discuss.record`, re-run intake |
| intake clear, missing context/search/scope | dispatch the named owner for the first missing stage |
| `03-scope.scope_confirmed != true` & ambiguous | SCOPE-GATE: confirm boundary with user |
| scope ok, missing `04`/`05` | PHASE 4 dispatch the missing author(s) **in parallel** |
| functional+nfr present, no `internal/stages/06-acceptance.json` | PHASE 5 dispatch i2r-acceptance-author |
| acceptance present, no `out/PRD.md` | PHASE 6 `i2r.py assemble` (build the out/ package for review) |
| `out/PRD.md` present, < 2 reviews | PHASE 7 dispatch BOTH reviewers (santa-loop) over the out/ package |
| any review `verdict == FAIL` | REVIEW-LOOP: `i2r.py repair.plan`, rerun failed stage, **re-assemble**, re-review (max 3) |
| both reviews present, no `audit/gate-result.yaml` | PHASE 8 `i2r.py gate.check` |
| `audit/gate-result.yaml` present | COMPLETE — `out/` package is the deliverable; downstream may consume per its own routing and planning logic |

## The two human gates (orchestrator-only)
- **CLARIFY-LOOP** (after intake): only if `clarification_status == needs_clarification` AND a question is
  blocking (changes FR/NFR/scope). Ask via AskUserQuestion; record answers to `raw/clarifications-<n>.md`
  via `i2r.py discuss.record` (this marks downstream STALE), then re-run intake.
- **SCOPE-GATE** (after scope): only if the in/out/deferred boundary is risky. Confirm, then set
  `scope_confirmed: true`.

Non-blocking uncertainty → proceed, recording explicit assumptions. Never block on non-blocking questions.

## Staleness & re-runs
Editing `raw/**` or any upstream stage marks downstream STALE (the `i2r-mark-stale` hook + `i2r.py
mark-stale`). A STALE downstream forces a re-run before the gate will pass. `ops/run-log.md` is append-only.
