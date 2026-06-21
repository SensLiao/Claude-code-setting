# I2R → GSD Handoff Contract

I2R is the requirements front-end for GSD. The payoff is a **dual-layer handoff**: an internal rigorous layer
for machines/reviewers, and an external GSD-native layer that drops in with zero rework.

## Critical fact about GSD
GSD has **no formal requirements schema** — no EARS, no Gherkin, no fit-criterion. GSD eats **user-centric
prose** (`User can X`), **`[CAT]-NN`** IDs grouped by feature category, NFRs under `## Constraints`, and
**prose pass/fail** acceptance. So I2R keeps the rigour internal and **projects** it to GSD-native prose.

## The two layers (both emitted by `i2r.py assemble`, deterministically)
1. **`requirements.json`** — rigorous layer: EARS objects + Volere NFRs + Gherkin + traceability. The
   unambiguous, testable machine truth; for any AI consumer or future workflow port.
2. **`PRD.md`** — GSD-native projection, the zero-rework drop-in:
   ```
   ---
   type: prd
   source: idea-to-requirements-orchestrator
   handoff_status: READY            # set by gate.check
   ---
   # <Project / Feature>
   ## Goals
   ## Non-Goals / Out of Scope
   ## Requirements          (### <CAT>, then "[CAT]-NN: <plain-prose behaviour>")
   ## Acceptance Criteria   (prose pass/fail — Gherkin translated; GSD can't eat Given/When/Then)
   ## Constraints           (= required NFRs with fit criteria + locked constraints)
   ## Locked Decisions
   ## Open Questions
   ## How to feed GSD
   ```
3. **`decisions/ADR-*.md`** — each locked product decision as `type: adr / status: Accepted` → GSD's
   highest-precedence LOCKED decisions.

The canonical PRD shape lives in `examples/good-run/PRD.md` and `i2r-gsd-projection-mode` — match it exactly.

## Two consumption paths (document both in the handoff)
- `/gsd:ingest-docs` — full bootstrap; the PRD is classified as a PRD (mid-precedence).
- `/gsd:plan-phase --prd PRD.md` — lightweight single-doc (bypasses discuss-phase).

## What I2R must NOT emit (GSD re-derives all of these)
Phase structure / roadmap · requirement→phase traceability · task breakdown · architecture / tech selection ·
implementation · UI/UX. If any appears in the PRD, it failed the boundary AND the Reader Test.

## Reuse GSD's ambiguity rubric
The critic pre-checks against GSD spec-phase weights (goal 0.35 / boundary 0.25 / constraint 0.20 /
acceptance 0.20, target ≤ 0.20) so the handoff sails through `/gsd:spec-phase` with no rework.
