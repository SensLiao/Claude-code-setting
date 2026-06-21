# GSD Handoff Rules

How I2R's output is consumed by the GSD pipeline, and what GSD must NOT receive.

---

## GSD has no formal EARS/Gherkin/fit-criterion schema

GSD (`gsd-pipeline-orchestrator`) ingests user-centric prose documents. It does not parse
JSON schemas, EARS pattern tags, or Gherkin arrays. It reads:

- Plain prose requirements (`[CAT]-NN: <sentence>`)
- Prose acceptance criteria (`Passes when …`)
- NFR constraints as readable sentences
- Locked decisions as plain statements
- Open Questions as plain bullets

The **rigorous layer** (`requirements.json` with EARS, Gherkin, Volere) is for I2R's internal
validator (`i2r.py validate`) and downstream tooling. GSD never reads it directly.

## The two feed paths

### Path A: Full bootstrap — `/gsd:ingest-docs`

```
/gsd:ingest-docs
```

GSD reads `PRD.md` (and any co-located planning docs) and runs its full classification and
synthesis pipeline. Best when the project has no existing GSD plan. GSD will:
- Classify PRD.md as type `PRD`
- Synthesize with other docs (ADR-*.md if present)
- Create `.planning/PROJECT.md`, `PLAN.md`, etc.

### Path B: Lightweight single-doc — `/gsd:plan-phase --prd PRD.md`

```
/gsd:plan-phase --prd PRD.md
```

GSD reads PRD.md for a specific phase planning run. Best when GSD already has a project context
and the team is planning a new phase from the requirements.

## What GSD derives on its own (I2R must NEVER emit this)

| GSD derives | I2R must NOT include in PRD.md |
|---|---|
| Phase plan / roadmap | No phases, sprints, milestones |
| Task list / ticket breakdown | No tasks, subtasks, JIRA items |
| Architecture decisions | No database choice, framework, API routes |
| File / directory structure | No file names, module names, folder layout |
| UI components | No component names, HTML structure, CSS classes |
| Technology stack | No library names, cloud provider, runtime |
| Build pipeline | No CI/CD steps, deployment scripts |
| Effort estimation | No story points, hours, team sizing |

**The golden rule:** if GSD reads the PRD and says "I need to decide X", that is correct — I2R
left the right gap. If GSD reads the PRD and says "I2R already decided X for me", I2R leaked HOW.

## Reader Test Gate (CONTRACT §11)

Before `gate.check` passes, the `i2r-completeness-critic` runs the Reader Test:

1. Agent receives ONLY `PRD.md` — no other run artifacts.
2. Agent must independently infer: goals · scope boundary · constraints · acceptance.
3. If any of these cannot be inferred → `READER_TEST_FAIL` → gate verdict: BLOCKED.

**Implication for PRD authors:** the PRD must stand alone. It cannot rely on `requirements.json`
or any other stage file to fill in blanks.

## Defect classes that indicate GSD-incompatibility (CONTRACT §7)

- `GSD_INCOMPATIBLE` — PRD contains EARS syntax, JSON fragments, or schema metadata.
- `IMPLEMENTATION_LEAK` — PRD mentions HOW (stack, API, DB, architecture).
- `READER_TEST_FAIL` — PRD not self-contained; GSD cannot infer goals/scope/constraints.
- `DOWNSTREAM_REINTERPRETATION_RISK` — requirement so ambiguous GSD will guess wrong.
