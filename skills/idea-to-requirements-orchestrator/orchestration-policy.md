# I2R Orchestration Policy

How the lead dispatches — the discipline that keeps a multi-agent run correct, cheap, and non-conflicting.

## Manager-style control
The orchestrator holds final control. Specialist `i2r-*` agents are **bounded capabilities** you call, not
hand-offs that take over the run. Each returns its one artifact; you decide what happens next.

## One file, one writer
Every stage artifact has exactly one owning agent (CONTRACT §3). Never let two agents write the same file.
This is structural race prevention, not a style preference.

## Parallel vs serial
- **Parallel** when outputs are independent and there is no write race: PHASE 4 (`i2r-functional-author` ∥
  `i2r-nfr-author`) and PHASE 6 (Reviewer A ∥ Reviewer B). Dispatch them in one batch.
- **Serial** when an output is the next stage's input (intake → context → scope → authoring → acceptance →
  review → assemble). When in doubt, serial.

## Model routing
**Runtime: every agent on `opus`** (user lock) — the lead and all 9 specialists. Max quality; this is a
high-stakes, low-volume decision pipeline. The `$0` Python SDK is **no-LLM** and does all mechanical work
(scaffold, validate, assemble, gate). Reviewer B is Codex `/codex:adversarial-review`, fallback a 2nd fresh
opus critic.

## Human gates are yours alone
Only the orchestrator talks to the user (CLARIFY-LOOP, SCOPE-GATE), and only on **blocking** questions —
those that would change FR/NFR/scope. Subagents never ask the user. Non-blocking gaps → proceed with explicit
assumptions recorded in the artifacts.

## Repair loop (bounded)
On any review FAIL: `i2r.py repair.plan <run>` writes `internal/stages/08-repair-notes.json`, marks the
failed stage STALE, and you re-dispatch **only that stage's owner**, then re-review. Never re-run the whole
pipeline. Max 3 iterations; still failing → stop and surface to the human.

## Vendor-not-install
The mode subskills vendor proven patterns from external projects (Spec Kit gates, doc-coauthoring reader
test, AutoGen debate, The Mom Test, EARS, Volere, ISO 25010, pm-skills anchoring). They are our own stable
implementations — I2R never calls an external skill at runtime (avoids drift, license, trigger conflict,
scope creep, and collision with GSD). Sources are tracked in `docs/I2R-LEDGER.md`.

## Honesty discipline
Never self-declare READY; the gate + dual review decide. Never relax a check to make it pass — fix the root
cause. Convert relative dates to absolute. Log decisions to `ops/run-log.md`. Maintain the WHAT/WHY boundary
at every step: the moment a draft names a framework/db/endpoint/file, it leaked HOW — send it back.
Never emit downstream orchestration commands (`/gsd:*`, `plan-phase`, `ingest-docs`, `next_command_hint`,
or any machine-contract field) in any `out/` document. I2R may state reading order, readiness, and locked
decisions. Downstream systems read the `out/` package and apply their own routing and planning logic.
