# I2R Output Contract

I2R produces a **Markdown-first requirements package** under `.i2r/runs/<slug>/<run-id>/out/`. This document
defines what that package is, who reads it, what I2R must not emit, and how downstream systems may consume it.

## What the `out/` package is

The `out/` layer is the **primary deliverable** of every I2R run. It is a set of Markdown documents that
describe WHAT the system should do, WHY, for WHOM, under what CONSTRAINTS, and with what LOCKED DECISIONS —
and nothing else.

`i2r.py assemble` produces the full package deterministically from `internal/stages/*.json` via
`i2r_render.py` (pure Markdown renderer, zh/en i18n). The package is localized to the run `lang`.

| File | Purpose |
|---|---|
| `out/README.md` | Reading entry: status, reading order, what the package is, what it does NOT do |
| `out/PRD.md` | Primary product doc: Executive Summary + Goals + Non-Goals + Scope + Actors + Requirements overview |
| `out/REQUIREMENTS.md` | Detailed FR + NFR in per-requirement narrative sections (not a table dump) |
| `out/ACCEPTANCE.md` | Per-scenario: Gherkin + plain-language explanation + observable evidence |
| `out/DECISIONS.md` | Locked decisions overview + ADR index |
| `out/CONSTRAINTS.md` | Product / Quality / Decision constraints + explicit "Not Constraints" section |
| `out/GLOSSARY.md` | Terms, ambiguous-terms-resolved, intentionally-undefined |
| `out/QUESTIONS.md` | Open questions (blocking?) + carried-forward assumptions + resolved |
| `out/READINESS.md` | Human-readable gate verdict + why + blocking/major/minor findings + suggested follow-up |
| `out/TRACEABILITY.md` | Source→requirement, requirement→acceptance, decision→impact tables |
| `out/CHANGELOG.md` | Per-run change notes: Added/Changed/Removed + why + affected documents |
| `out/decisions/ADR-*.md` | One locked product decision each |

`out/` is **Markdown-only**. No JSON or YAML files belong in `out/`. Every downstream-readable fact has a
Markdown projection here; no internal JSON/YAML artifact is the primary reading artifact.

## Reader Model (one artifact set for all readers)

The `out/` Markdown documents are intended for **human readers** (product, engineering, stakeholders),
**product/engineering teams**, and **downstream AI orchestration** alike.

**There is no separate GSD-specific instruction artifact.** Downstream reads what humans read — the same
`out/` package. This is the Reader Model.

Because the same package is what downstream AI reads, the Reader Test gate (a fresh critic given only `out/`
must independently infer all nine dimensions — §11 of `docs/CONTRACT.md`) simultaneously validates that the
package is clear to humans AND usable by downstream AI.

## What I2R must NOT emit

I2R produces WHAT/WHY/CONSTRAINTS/LOCKED DECISIONS only. The following are **hard prohibitions** — their
presence in any `out/` document is a `DOWNSTREAM_COMMAND_LEAK` BLOCKER that fails the gate:

- `/gsd:*` commands of any kind
- `plan-phase` or `ingest-docs` invocation hints
- `next_command_hint`, `consumer_contract_version`, `required_gsd_behavior`, `handoff.gsd.json`
- Any machine-contract field or "run this next" instruction
- Phase structure / roadmap / task breakdown / architecture / tech selection / UI/UX

I2R MAY (and should) state:
- Reading order of the `out/` documents
- Readiness verdict and what remains open
- Which decisions are locked and why
- Explicit boundaries (in-scope / out-of-scope)

## How downstream may consume the package

Downstream orchestration (or human teams) reads the `out/` Markdown package and applies its own routing and
planning logic. I2R does not prescribe how; that is downstream's responsibility.

Typical consumption patterns (not commands I2R emits):
- A human reads `out/README.md` for orientation, then `out/PRD.md` for the product story.
- A downstream AI orchestrator reads the full `out/` package as context before its own planning step.
- `out/decisions/ADR-*.md` carry locked decisions that downstream treats as highest-precedence constraints.

## Internal artifacts (not primary reading artifacts)

`internal/` holds the governance layer: stage JSON, `requirements.json`, traceability matrix, claim ledger,
quality report. These are for I2R's own gate enforcement and are regenerable projections of `internal/stages/`.
`audit/` holds gate verdicts and review summaries. `ops/` holds run state. None of these are the primary
downstream reading artifact — that role belongs exclusively to `out/`.

## Ambiguity rubric (carried forward from v1)

The completeness-critic pre-checks the `out/` package against the downstream ambiguity rubric:
`goal 35% · boundary 25% · constraint 20% · acceptance 20%`, target ≤ 0.20. This ensures the package is
unambiguous enough for any downstream planning system to proceed without rework.
