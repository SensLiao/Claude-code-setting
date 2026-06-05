# AppSec Path B — P0 Closeout

> **Date**: 2026-05-28
> **Plan version**: ORCHESTRATION-MIGRATION-PLAN.md v2
> **Status**: COMPLETE for orchestration functionality

## Status table

| Layer | Verdict | Evidence |
|---|---|---|
| Build | PASS | All artifacts under `runtime/appsec/`, `workflows/`, `hooks/` exist + lint clean |
| Minimal runtime | PASS | graph-smoke: 10 agents, 392k tokens, 3min wall-clock, all 4 node types fired |
| Resume mechanic | PASS | Predictor 8/8 fingerprint match + same-session cache-hit: 0 tokens / 9ms |
| Hook gate | PASS | 19/19 unit tests (includes R10 round-trip TTL) + 14 OK fires + 5 BLOCKED fires in real session |
| Doc constraint surfaced | PASS | draft-07 hard requirement documented in `schemas/README.md` + enforced via `tests/lint-schemas.sh` |
| Existing content preserved | PASS | SKILL.md §1-§17 unchanged; agents/sub-skills/hooks/SDK untouched; workflow-spec is additive (§16.10-§16.13) |
| Capability registry + preflight | PASS | `registry.json` enumerates 4 agents + 15 conditional skills + 8 hooks + 1 SDK + 4 model aliases; `preflight-check.sh` blocks launches that reference missing capabilities with structured errors + "did you mean...?" suggestions |
| Closeout patches | PASS | R7 (Patch A.1.1) — bootstrap capability detection inline in §16.0 + bootstrap.log |
| | PASS | R8 (Patch A.1.2) — persistence try/catch surfaces RUN-COMPLETED-BUT-PERSISTENCE-FAILED |
| | PASS | R10 (Patch A.1.3) — configurable preview TTL via `.appsec/config.json.preview_approval_ttl_seconds`; hook round-trip test 18/19 |
| | PASS | N2 (Patch A.1.4) — `tests/lint-schemas.sh` enforces draft-07; wired into `validate-all-presets.sh` |
| | PASS | Patch A.1.5 — `HASHES.md` records SHA-256 of 5 safety-critical files |
| | PASS | Patch A.1.6 — capability registry + preflight (this section); 3 negative tests confirm fail-closed |
| | PASS | Patch A.1.7 — this closeout doc |

## What v2 deliberately removed from scope

- Oracle compare vs `appsec-full-sweep.js` (v1 P1, ~14M tokens) — measures the wrong thing
- Full L2 smoke (~2.4M tokens) — runtime is proven via 10-agent graph-smoke; preset quality is observed during real pilots
- Calendar-driven legacy deletion — manual when usage of `workflow-static` drops to zero

## What remains optional

- Full L2 smoke as a stress test of the `l2-default` preset specifically — run only on explicit user request with hard token cap
- Codex re-review of workflow / hook on any future edit (discipline, not roadmap)
- Patch A.2 (preview template rewrite — user-facing default + debug `<details>`)
- Patch A.3 (dynamic AppSec modes — quick-check / focused-review / release-gate / incident-response / deep-sweep)
- Patch A.4 (model-policy abstraction — replace literal `haiku`/`sonnet`/`opus` in presets with aliases)

## What triggers AppSec activation in real projects

Per CLAUDE.md §3, `appsec-security-orchestrator` fires on backend / API / auth /
user-data / file-upload / payment / admin / production triggers. When it fires,
the Skill chooses a **dynamic mode** based on task signals (see `presets/MODES.md`
after Patch A.3 lands), builds a spec from the chosen preset family + project
context + dynamic agent count, renders user-facing preview, gets explicit
approval, writes sentinel, runs validate-spec.js + preflight-check.sh, then
launches `workflows/appsec-orchestrator.js`.

## Preservation principle

Per ORCHESTRATION-MIGRATION-PLAN.md §1.9, Path B is an **additive** execution
rail. All existing AppSec content (SKILL.md §1-§17 mapping tables, 30+ sub-skills,
8 hooks, SDK, agent .md files, finding schema v1.0, CSF 2.0 mapping, ASVS 5.0
references, overlay checklists) is **preserved unchanged**. The prompt-only path
(§16.4-§16.9) keeps working. workflow-spec mode (§16.10-§16.13) is selected only
when the project explicitly opts in via `.appsec/config.json.execution_mode == "workflow-spec"`
AND the capability gates pass. Otherwise Skill silently continues prompt-only.

## Next step

Path B for AppSec is functionally complete. Remaining patches (A.2, A.3, A.4)
improve usability + readability + model-policy abstraction. They do not block
real-task pilots. Phase B (QA Path B) can start any time the user explicitly
triggers it.
