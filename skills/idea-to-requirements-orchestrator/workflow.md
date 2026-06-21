# I2R Workflow — 8 phases + resumable state machine

This mirrors `scripts/i2r.py detect_state` exactly. The run folder is the state; `i2r.py status <run>`
reads it and prints the next action. Every stage writes exactly one file and is idempotent — re-entry is safe.

## Phases

| # | Phase | Owner | Output | Gate |
|---|---|---|---|---|
| 0 | SCAFFOLD | `i2r.py init <idea\|dir>` | `00-raw/` + MANIFEST + state.json + run-log | — |
| 0.5 | ROUTE | i2r-orchestrator | `00-mode-routing.json` | — |
| 1 | INTAKE | i2r-intake-clarifier | `01-intake.json` | ◇ CLARIFY-LOOP |
| 2 | CONTEXT | i2r-context-analyst | `02-context.json` | — |
| 2.5 | SEARCH (cond.) | i2r-evidence-researcher | `02b-evidence.json` | — |
| 3 | SCOPE | i2r-scope-architect | `03-scope.json` | ◇ SCOPE-GATE |
| 3.5 | SCOPE DEBATE (cond.) | i2r-orchestrator | `03b-scope-debate.json` | — |
| 4 | AUTHOR (∥) | i2r-functional-author ∥ i2r-nfr-author | `04-functional.json` + `05-nfr.json` | — |
| 5 | ACCEPTANCE | i2r-acceptance-author | `06-acceptance.json` | — |
| 6 | REVIEW (∥) | i2r-completeness-critic ∥ Codex | `07-review.json` + `07-review.codex.json` | ◇ REVIEW-LOOP |
| 7 | ASSEMBLE | `i2r.py assemble` | `requirements.json` + `PRD.md` + ADRs | — |
| 8 | GATE | `i2r.py gate.check` | `gate-result.yaml` | ◇ G |

## Resumable state table (match `i2r.py status`)

| On-disk state | Next action |
|---|---|
| no run folder | PHASE 0 `i2r.py init` |
| `00-raw/` present, no `00-mode-routing.json` | PHASE 0.5 author routing (see mode-router.md) |
| routed, no `01-intake.json` | PHASE 1 dispatch i2r-intake-clarifier |
| `01-intake.clarification_status == needs_clarification` | CLARIFY-LOOP: ask user (AskUserQuestion), `i2r.py discuss.record`, re-run intake |
| intake clear, missing context/search/scope | dispatch the named owner for the first missing stage |
| `03-scope.scope_confirmed != true` & ambiguous | SCOPE-GATE: confirm boundary with user |
| scope ok, missing `04`/`05` | PHASE 4 dispatch the missing author(s) **in parallel** |
| functional+nfr present, no `06-acceptance.json` | PHASE 5 dispatch i2r-acceptance-author |
| acceptance present, < 2 reviews | PHASE 6 dispatch BOTH reviewers (santa-loop) |
| any review `verdict == FAIL` | REVIEW-LOOP: `i2r.py repair.plan`, rerun failed stage, re-review (max 3) |
| both reviews PASS, no `PRD.md` | PHASE 7 `i2r.py assemble` |
| `PRD.md` present, no `gate-result.yaml` | PHASE 8 `i2r.py gate.check` |
| `gate-result.yaml` present | COMPLETE → handoff to GSD |

## The two human gates (orchestrator-only)
- **CLARIFY-LOOP** (after intake): only if `clarification_status == needs_clarification` AND a question is
  blocking (changes FR/NFR/scope). Ask via AskUserQuestion; record answers to `00-raw/clarifications-<n>.md`
  via `i2r.py discuss.record` (this marks downstream STALE), then re-run intake.
- **SCOPE-GATE** (after scope): only if the in/out/deferred boundary is risky. Confirm, then set
  `scope_confirmed: true`.

Non-blocking uncertainty → proceed, recording explicit assumptions. Never block on non-blocking questions.

## Staleness & re-runs
Editing `00-raw/**` or any upstream stage marks downstream STALE (the `i2r-mark-stale` hook + `i2r.py
mark-stale`). A STALE downstream forces a re-run before the gate will pass. `run-log.md` is append-only.
