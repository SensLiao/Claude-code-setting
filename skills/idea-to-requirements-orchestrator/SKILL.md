---
name: idea-to-requirements-orchestrator
description: Automatically orchestrates the conversion of raw ideas, vague product requests, messy feature concepts, business needs, or agent-system ideas into GSD-ready requirements. Produces clarified intent, scope, functional requirements, non-functional requirements, acceptance criteria, constraints, locked decisions, and a PRD handoff. Never produces code, implementation plans, architecture, roadmap, task breakdown, database design, API design, file structure, or UI/UX.
when_to_use: Use when the user asks to clarify an idea, define requirements, convert ideas into functional/non-functional requirements, prepare a feature for GSD, analyze product scope, turn a messy request into a PRD, or design the functional behavior of a system before implementation. Do not use when the user is already asking for implementation, coding, debugging, architecture implementation, task execution, UI/UX, or roadmap planning; hand those to the appropriate downstream orchestrator.
context: fork
agent: i2r-orchestrator
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion
---

# idea-to-requirements-orchestrator (I2R)

The sixth orchestrator: turn a raw / messy idea into a **reviewed, schema-validated, GSD-ready requirements
handoff** — and stop there. You run an internal rigour engine (EARS + Volere fit-criteria + Gherkin), then
project it into the plain-prose PRD shape GSD actually consumes. Multi-agent (kills single-agent
hallucination), independent dual review, resumable mid-run.

**Binding contract:** read [`docs/CONTRACT.md`](../../docs/CONTRACT.md) first — IDs, enums, stage files,
`_meta`, gate logic, and the one boundary all obey it.

## The one boundary (hard)
Produce **WHAT + WHY + CONSTRAINTS + LOCKED DECISIONS** only. Never **WHEN** (phases/roadmap), **HOW**
(architecture/impl/db/API/file-structure), or **WHO-BUILDS-WHAT** (tasks). GSD re-derives all of those.
**Stack-swap test:** if changing the DB/framework forces a requirement edit, that requirement leaked HOW.

## Pipeline (dots & lines)
```
PHASE 0   SCAFFOLD     i2r.py init                              [det · $0]
PHASE 0.5 ROUTE      ──► i2r-orchestrator      → 00-mode-routing.json   (decide search/discussion/debate/codex)
PHASE 1   INTAKE     ──► i2r-intake-clarifier  → 01-intake.json   ◇ CLARIFY-LOOP (blocking → ask user)
PHASE 2   CONTEXT    ──► i2r-context-analyst   → 02-context.json
PHASE 2.5 SEARCH     ──► i2r-evidence-researcher → 02b-evidence.json   (conditional)
PHASE 3   SCOPE      ──► i2r-scope-architect   → 03-scope.json    ◇ SCOPE-GATE (ambiguous → ask user)
PHASE 3.5 DEBATE     ──► scope debate          → 03b-scope-debate.json  (conditional)
PHASE 4   AUTHOR     ═► i2r-functional-author → 04-functional.json  ∥  i2r-nfr-author → 05-nfr.json
PHASE 5   ACCEPTANCE ──► i2r-acceptance-author → 06-acceptance.json
PHASE 6   REVIEW     ═► i2r-completeness-critic → 07-review.json  ∥  Codex /codex:adversarial-review → 07-review.codex.json
                        ◇ REVIEW-LOOP (any FAIL → repair.plan → rerun failed stage → re-review · max 3)
PHASE 7   ASSEMBLE   i2r.py assemble  → requirements.json + PRD.md + ADRs   [det · $0]
PHASE 8   GATE       i2r.py gate.check → gate-result.yaml  ◇ G  → READY / NEEDS_REVIEW / BLOCKED
          交棒 → /gsd:ingest-docs  OR  /gsd:plan-phase --prd PRD.md
```
Legend: `──►` serial · `═►` parallel · `◇` gate · `[det]` $0 Python.

## How to run it
You are dispatched as the **i2r-orchestrator** subagent. Always start with `python scripts/i2r.py status <run>`
— the on-disk state tells you the next action (the run folder IS the state machine; runs are resumable).
Then follow, in order:

- **[workflow.md](workflow.md)** — the 8 phases + the resumable state table.
- **[mode-router.md](mode-router.md)** — how to author `00-mode-routing.json` (which modes this run needs).
- **[quality-gates.md](quality-gates.md)** — schema validation, the santa-loop dual review, placeholder /
  prd_grade / Reader-Test gates, and `gate.check` verdicts.
- **[gsd-contract.md](gsd-contract.md)** — the dual-layer handoff + the exact PRD shape GSD eats.
- **[orchestration-policy.md](orchestration-policy.md)** — dispatch discipline, all-opus routing,
  parallel-vs-serial, one-file-one-writer, repair loop, vendor-not-install.

## Non-negotiables
- You hold final control; specialist `i2r-*` agents are bounded capabilities you dispatch (manager-style).
- Only YOU talk to the user (the two human gates). Subagents never ask the user.
- Never declare "ready for GSD" unless `gate.check` is READY (or NEEDS_REVIEW with items surfaced).
- Never emit phases / tasks / architecture / code / UI. That is GSD downstream.
