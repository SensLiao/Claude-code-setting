# AppSec Routing Regression Test Harness

> Per Codex Round 1 cross-review recommendation:
> "Build a routing regression harness. You need prompt fixtures and path
>  fixtures proving that each skill activates, refuses, or delegates correctly;
>  otherwise this restructure is just documentation with no enforcement."

---

## Purpose

This harness verifies that AppSec routing actually works:
- New skills activate on their intended trigger phrases
- Aliases resolve to canonical skills
- Safety-critical skills do NOT auto-trigger (manual gate preserved)
- Cross-namespace boundaries (GSD vs AppSec) are respected
- ASVS 5.0 (not 4.x) identifiers are used in outputs
- Standardized Finding Schema is the canonical contract

## Test Format

Two layers:

### Layer 1: Static fixtures (this directory)
- `fixtures/*.yaml` — declarative test cases (prompt → expected routing)
- `expected-routes.json` — machine-readable contract
- `runbook.md` — how a human or subagent runs the test suite

### Layer 2: Live subagent testing (Phase 9 of restructure)
- Spawn subagents with each fixture prompt
- Observe which skill they activate (or refuse)
- Compare against expected behavior
- Report deviations as findings

## Why this matters

Without routing tests:
- A skill rename silently breaks routing (no error, just dead route)
- Manual gates can be accidentally weakened by a docs edit
- ASVS version drift goes unnoticed
- Cross-skill aliases can collide
- Anti-pattern of "documentation without enforcement" recurs

## How to use

### As a human reviewer
1. Read `runbook.md`
2. Spawn a fresh Claude session
3. Paste each fixture's `prompt`
4. Observe which skill activates / what gets refused
5. Compare against `expected_behavior`
6. Log deviations to `results/<date>.md`

### As an automated subagent (Phase 9)
See `runbook.md` "Subagent Test Mode" section.

## Coverage

Test categories:
- **Activation tests** — does the right skill activate?
- **Refusal tests** — do safety-critical skills refuse auto-trigger?
- **Boundary tests** — are namespace boundaries respected?
- **Schema tests** — do outputs use ASVS 5.0 + Finding Schema?
- **Handoff tests** — do skills delegate to downstream correctly?

## Files

- `README.md` — this file
- `runbook.md` — how to run tests
- `expected-routes.json` — machine-readable expected behavior
- `fixtures/` — declarative test cases
- `results/` — observed runs (gitignored — instance-specific)
