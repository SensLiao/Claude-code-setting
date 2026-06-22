# Output Package Rules

> **(This file documents the output package rules; the "handoff" framing is retired.)**
>
> I2R produces a Markdown requirements package. It does not produce a "handoff bundle",
> machine-contract fields, or downstream orchestration commands. Downstream systems read
> the same `out/` Markdown that humans read and apply their own routing and planning logic.

---

## Reader Model (CONTRACT §1)

The `out/` Markdown package is intended for **human readers, product/engineering teams, AND
downstream AI orchestration**. There is **no separate GSD-specific instruction artifact**.
Downstream reads what humans read. This is the Reader Model.

A downstream AI orchestrator that receives the `out/` package can read `PRD.md`, `REQUIREMENTS.md`,
`ACCEPTANCE.md`, and the other documents exactly as a human PM would. It derives its own planning,
phases, and task breakdown from that reading. I2R does not tell it what to do next.

---

## What I2R's output IS

`out/` is a Markdown requirements package describing:
- **WHAT** — the functional and non-functional requirements
- **WHY** — the goals, user needs, and business rationale
- **CONSTRAINTS** — hard limits and quality requirements
- **LOCKED DECISIONS** — decisions made before implementation begins

---

## What I2R MUST NOT emit (hard rules — gate enforced)

### In any `out/*.md` file:

| Prohibited | Why | Gate finding |
|---|---|---|
| `/gsd:*` commands (e.g. `/gsd:ingest-docs`, `/gsd:plan-phase`) | Downstream command leak | `DOWNSTREAM_COMMAND_LEAK` — BLOCKER |
| `plan-phase` instruction | Downstream command leak | `DOWNSTREAM_COMMAND_LEAK` — BLOCKER |
| `ingest-docs` instruction | Downstream command leak | `DOWNSTREAM_COMMAND_LEAK` — BLOCKER |
| `next_command_hint` field | Machine-contract language | `DOWNSTREAM_COMMAND_LEAK` — BLOCKER |
| `consumer_contract_version` field | Machine-contract language | MAJOR |
| `required_gsd_behavior` field | Machine-contract language | MAJOR |
| `handoff.gsd.json` references | Machine-contract language | MAJOR |
| JSON or YAML blobs in `out/` | `out/` is Markdown-only | `out_markdown_only` — BLOCKER |

### In any `out/*.md` file — content boundaries:

| I2R must NOT produce | Why | Defect class |
|---|---|---|
| WHEN — phases, sprints, roadmap, milestones | Not I2R's domain | `SCOPE_LEAK` |
| HOW — architecture, DB choice, API routes, UI components, file structure | Stack-swap test (CONTRACT §1) | `IMPLEMENTATION_LEAK` |
| WHO-BUILDS-WHAT — tasks, team assignments, effort estimates | Not I2R's domain | `SCOPE_LEAK` |
| Technology choices | HOW leak | `IMPLEMENTATION_LEAK` |
| Build or deployment steps | HOW leak | `IMPLEMENTATION_LEAK` |

---

## What downstream systems derive on their own

I2R's output is designed to leave the right gaps. If a downstream AI system reads the package and
says "I need to decide X", that is correct — I2R left the right gap. If it says "I2R already
decided X for me", I2R leaked HOW.

| Downstream derives | I2R must NOT include |
|---|---|
| Phase plan / roadmap | No phases, sprints, milestones |
| Task list / ticket breakdown | No tasks, subtasks, JIRA items |
| Architecture decisions | No database choice, framework, API routes |
| File / directory structure | No file names, module names, folder layout |
| UI components | No component names, HTML structure, CSS classes |
| Technology stack | No library names, cloud provider, runtime |
| Build pipeline | No CI/CD steps, deployment scripts |
| Effort estimation | No story points, hours, team sizing |

---

## Reader Test Gate (CONTRACT §11)

Before `gate.check` issues any verdict, the Reader Test runs:

1. A fresh critic receives **ONLY the `out/` package** — no `internal/` stages, no `raw/`, no
   other context.
2. The critic must independently infer all nine things:
   - (1) what to build
   - (2) why
   - (3) who benefits
   - (4) what is explicitly out of scope
   - (5) which decisions are locked
   - (6) which assumptions are still open
   - (7) how it is accepted
   - (8) current readiness
   - (9) no HOW/WHEN/WHO leakage
3. If it cannot infer any of these → `READER_TEST_FAIL` → gate verdict: `BLOCKED`.

This test serves a dual purpose: it validates the package is readable by humans, AND it confirms
that a downstream AI reading the same package gets the same clear picture.

---

## Frontmatter rules for `out/*.md`

Light frontmatter only — six fields, no more:

```yaml
title: <document title>
source: i2r
run_id: i2r-<slug>-<run-id>
readiness: <READY|NEEDS_REVIEW|BLOCKED>
lang: <zh|en>
generated_at: <ISO-8601>
```

**Prohibited frontmatter fields:** `handoff_status`, `consumer_contract_version`,
`required_gsd_behavior`, `next_command_hint`, or any other machine-contract field.
`handoff_status` is replaced by `readiness` in v2.

---

## Defect classes relevant to output package compliance (CONTRACT §7)

| Defect class | Meaning | Severity |
|---|---|---|
| `DOWNSTREAM_COMMAND_LEAK` | `/gsd:*`, `plan-phase`, `ingest-docs`, `next_command_hint`, or `consumer_contract_version` in any `out/` doc | BLOCKER |
| `IMPLEMENTATION_LEAK` | Any HOW content (stack, API, DB, file structure, component names) | BLOCKER |
| `SCOPE_LEAK` | Phases, tasks, roadmap, or team assignments in `out/` | MAJOR |
| `GSD_INCOMPATIBLE` | EARS syntax, JSON fragments, or schema metadata in `out/` docs | MAJOR |
| `READER_TEST_FAIL` | Package not self-contained; downstream cannot infer goals/scope/constraints | BLOCKER |
| `DOWNSTREAM_REINTERPRETATION_RISK` | Requirement so ambiguous downstream will guess wrong | MAJOR |

---

## Internal vs reading layer (never blur)

| Layer | Path | What it is |
|---|---|---|
| Reading layer | `out/` | Markdown — given to humans, teams, and downstream AI to read |
| Governance layer | `internal/` | JSON/YAML — I2R's own governance artifacts |
| Audit layer | `audit/` | YAML/Markdown — gate results and review summaries |

The `internal/requirements.json` and other machine bundles are **regenerable projections** of the
stage JSONs, not the primary downstream reading artifact. Every fact that downstream needs is
present in `out/` Markdown.
