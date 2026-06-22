# out/ Package Shape (authoritative)

This is the exact shape that `i2r.py assemble` + `i2r_render.py` emit for the full `out/` Markdown
package. All 11 documents plus `decisions/ADR-*.md` are present every run, localized to `lang`.
Anchored on `examples/good-run/` (generated to the v2 layout).

No section may be added, removed, or reordered within any document. Agents may not deviate from
this shape. The `i2r_render.py` `render_*()` functions are the canonical implementation.

---

## Package overview (all files under `out/`)

| File | Purpose | Primary readers |
|---|---|---|
| `README.md` | Reading entry point | Humans + downstream AI |
| `PRD.md` | Primary product document | PMs, engineers, downstream AI |
| `REQUIREMENTS.md` | Full FR + NFR narrative | Engineers, QA |
| `ACCEPTANCE.md` | Acceptance criteria (Gherkin + prose) | QA, PMs, stakeholders |
| `DECISIONS.md` | Locked decisions + ADR index | All readers |
| `CONSTRAINTS.md` | Hard limits | All readers |
| `GLOSSARY.md` | Terms and definitions | All readers |
| `QUESTIONS.md` | Open questions + assumptions | Lead + stakeholders |
| `READINESS.md` | Gate verdict for humans | Lead + team |
| `TRACEABILITY.md` | Source→req→acceptance trace | Lead + QA |
| `CHANGELOG.md` | Per-run change notes | All readers |
| `decisions/ADR-*.md` | One locked decision each | Architecture + team |

**Hard package rules:**
- `out/` contains only `*.md` files (+ `decisions/*.md`). No `.json` or `.yaml` — gate BLOCKER.
- No downstream orchestration commands anywhere in `out/`: no `/gsd:*`, `plan-phase`, `ingest-docs`,
  `next_command_hint`, `consumer_contract_version`, `handoff.gsd` — gate BLOCKER.
- No machine-contract language in `out/` (no `consumer_contract_version`, `required_gsd_behavior`,
  `next_command_hint`) — gate MAJOR.
- Light frontmatter only: `title`, `source: i2r`, `run_id`, `readiness`, `lang`, `generated_at`.

---

## README.md

**Purpose:** reading entry — the first document a human or downstream AI system encounters.

**Required sections:**

```markdown
---
title: Requirements Package — <product name>
source: i2r
run_id: i2r-<slug>-<run-id>
readiness: <READY|NEEDS_REVIEW|BLOCKED>
lang: <zh|en>
generated_at: <ISO-8601>
---
# Requirements Package — <product name>

## Status
<Readiness verdict + one-sentence summary of any blocking items>

## Reading order
1. PRD.md — start here for goals and scope
2. REQUIREMENTS.md — full functional and quality requirements
3. ACCEPTANCE.md — acceptance criteria
4. DECISIONS.md — locked decisions and ADRs
5. CONSTRAINTS.md — hard limits
6. GLOSSARY.md — terms
7. QUESTIONS.md — open questions and assumptions
8. READINESS.md — gate verdict detail
9. TRACEABILITY.md — source-to-requirement-to-acceptance trace

## What this package is
<Two or three sentences: what problem it addresses, who it is for, what stage of the work it
covers (requirements definition — WHAT and WHY, not HOW or WHEN).>

## What this package does NOT contain
- Implementation plans, phases, roadmap, or task breakdown
- Architecture, database design, API routes, or file structures
- Technology choices or build instructions
- Downstream orchestration commands
```

---

## PRD.md

**Purpose:** primary product document — the human-readable and AI-readable statement of WHAT and WHY.

**Required section order (must match exactly; `i2r_render.py render_prd()`):**

```markdown
---
title: <product name>
source: i2r
run_id: i2r-<slug>-<run-id>
readiness: <READY|NEEDS_REVIEW|BLOCKED>
lang: <zh|en>
generated_at: <ISO-8601>
---
# <product name — from 01-intake.json>

## Executive Summary

| Field | Value |
|---|---|
| Problem | <one sentence> |
| Desired outcome | <one sentence> |
| Primary users | <role/persona> |
| In scope | <core capability boundary> |
| Out of scope | <explicit exclusions> |
| Locked decisions | <or "(none)"> |
| Main risks | <top 1–2 risks> |
| Readiness | <READY|NEEDS_REVIEW|BLOCKED> |

## Goals

| Goal | Target | Source | Confidence |
|---|---|---|---|
| <goal phrase> | <measurable target> | <stated|assumed|decision> | <high|medium|low> |

## Non-Goals

- <explicit exclusion>
- (deferred) <deferred item>

## Scope

**In scope:** …

**Out of scope:** …

**Deferred:** …

## Users, Actors, and Jobs-to-be-Done

| Actor | Role | Primary job | Success condition |
|---|---|---|---|
| … | … | … | … |

## Requirements Overview

Detailed requirements and acceptance criteria: see [REQUIREMENTS.md](./REQUIREMENTS.md) and
[ACCEPTANCE.md](./ACCEPTANCE.md). Decisions: see [DECISIONS.md](./DECISIONS.md).

### <CAT>
<FR_ID>: <EARS prose — WHAT not HOW>
<FR_ID>: <EARS prose>

### <CAT2>
<FR_ID>: <EARS prose>

**NFR summary:**
- NFR-<ISOCAT>-01 [<iso25010_category>]: <one-sentence statement with threshold if brief>
```

**Section rules:**

- `## Executive Summary`: MUST be the first section after the H1. Gate check: `prd_has_executive_summary`.
  All 8 fields required. `Readiness` echoes `gate-result.yaml verdict`.
- `## Goals`: structured table, NOT a prose sentence. Each row: one goal phrase + measurable target +
  source (`stated|assumed|decision`) + confidence (`high|medium|low`). Source: `01-intake.json` /
  `02-context.json` success metrics. Never list implementation steps, phases, or technical architecture.
- `## Non-Goals`: source `03-scope.json out_of_scope[]`. Deferred items get `(deferred)` prefix.
- `## Scope`: three labelled paragraphs (In scope / Out of scope / Deferred).
- `## Users, Actors, and Jobs-to-be-Done`: source `02-context.json actors[]` + `jobs_to_be_done[]`.
- `## Requirements Overview`: contains links to REQUIREMENTS.md and ACCEPTANCE.md, then a brief
  `### <CAT>` subsection per category with FR summary lines (`<FR_ID>: <EARS prose>`) and an NFR summary.
  This is a summary — full detail is in the sibling docs. No `source`, `priority`, or `ears_pattern`
  metadata on the summary lines.

---

## REQUIREMENTS.md

**Purpose:** narrative per-requirement sections with full detail for engineers and QA.

**Required structure:**

```markdown
---
title: Requirements — <product name>
source: i2r
…
---
# Requirements — <product name>

## Functional Requirements

### <CAT>-01: <requirement name>

**Requirement:** <EARS prose sentence — WHAT not HOW>

**Why:** <rationale — the user/business need this addresses>

**Source:** <stated|assumed|decision> — <source_ref>

**Priority:** <MUST|SHOULD|COULD|WONT>

**Acceptance coverage:** <AC-CAT-01-01, AC-CAT-01-02, …>

**Implementation boundary note:** <explicit note on what is out of I2R scope — e.g. "no DB choice made">

---

### <CAT>-02: <requirement name>
…

## Non-Functional Requirements

### NFR-<ISOCAT>-01: <requirement name>

**Quality attribute:** <ISO/IEC 25010:2023 category>

**Requirement:** <one-sentence NFR statement>

**Fit criterion:**
- Threshold: <measurable threshold, e.g. "p95 response time ≤ 2 seconds">
- Environment: <measurement environment, e.g. "production under normal load">
- Period: <measurement period, e.g. "every release">

**Why:** <rationale>

**Source:** <stated|assumed|decision> — <source_ref>

**Priority:** <MUST|SHOULD|COULD|WONT>

**Acceptance coverage:** <AC-NFR-…>

**Measurement context:** <how this will be measured — tool, signal, frequency>

**Validation:** <how to validate the fit criterion is met>
```

Gate check: `requirements_are_narrative` — must have per-requirement sections, not a single table dump.

---

## ACCEPTANCE.md

**Purpose:** acceptance criteria — Gherkin for machine parsers + plain language for humans.

**Required structure per scenario:**

```markdown
---
title: Acceptance Criteria — <product name>
source: i2r
…
---
# Acceptance Criteria — <product name>

## <AC-ID>: <scenario name>

**Covers:** <FR_ID or NFR_ID>

**Type:** <functional|non-functional|edge-case|negative>

```gherkin
Given <context>
When <action>
Then <observable outcome>
And <additional observable outcome, if needed>
```

**Plain-language explanation:** <One or two sentences explaining in plain English what this
scenario tests and what observable evidence confirms it passed.>

**Observable evidence:** <What a tester will actually see, measure, or check — no HOW.>

**Not covered:** <AC IDs that cover related but distinct scenarios, if applicable — or "(none)".>
```

Gate check: `acceptance_has_plain_language` — every Gherkin block must be followed by a
`**Plain-language explanation:**` paragraph.

---

## DECISIONS.md

**Purpose:** locked decisions overview + separation of decisions vs preferences vs assumptions + ADR index.

**Required structure:**

```markdown
---
title: Decisions — <product name>
source: i2r
…
---
# Decisions — <product name>

## Locked Decisions

| Decision | Rationale | ADR | Affected requirements |
|---|---|---|---|
| <one-sentence decision> | <brief rationale> | [ADR-0001](./decisions/ADR-0001.md) | <CAT-01, …> |

## Preferences (not locked)

<Preferences noted during elicitation that are not binding. Downstream may follow them or not.>

## Assumptions elevated to decisions

<Assumptions that the team confirmed as decisions during review — with source_ref.>

## Open (not yet decided)

<Items that looked like decisions but remain open — with blocking/non-blocking flag.>

## ADR Index

- [ADR-0001](./decisions/ADR-0001.md): <title>
```

---

## CONSTRAINTS.md

**Purpose:** hard limits — product, quality, decision.

**Required structure:**

```markdown
---
title: Constraints — <product name>
source: i2r
…
---
# Constraints — <product name>

## Product constraints
<Explicit boundary conditions on what the product can/cannot do — access, geography, regulatory, etc.>

## Quality constraints
<Measurable quality limits — summarised from NFRs with thresholds. Full detail in REQUIREMENTS.md.>

## Decision constraints
<Constraints imposed by locked decisions — e.g. "tool is read-only per ADR-0001".>

## Not constraints
<Items that were raised as constraints but are actually implementation choices or preferences —
explicitly excluded here so downstream does not treat them as blockers.>
```

Gate check: `constraints_visible` — file must be present and non-empty.

---

## GLOSSARY.md

**Purpose:** terms, ambiguity resolutions, intentionally-undefined terms.

**Required structure:**

```markdown
---
title: Glossary — <product name>
source: i2r
…
---
# Glossary — <product name>

## Terms

| Term | Meaning | Notes | Source |
|---|---|---|---|
| <term> | <meaning> | <disambiguation if needed> | <stated|assumed|source_ref> |

## Ambiguous terms resolved

<Terms that appeared in intake with multiple possible meanings — how they are defined for this run.>

## Intentionally undefined

<Terms that are out of I2R scope to define — downstream will decide.>
```

---

## QUESTIONS.md

**Purpose:** open questions + carried-forward assumptions with risk and affected requirements.

**Required structure:**

```markdown
---
title: Open Questions and Assumptions — <product name>
source: i2r
…
---
# Open Questions and Assumptions — <product name>

## Open questions

| # | Question | Blocking? | Affected requirements |
|---|---|---|---|
| OQ-01 | <question text> | <yes|no> | <CAT-01, …> |

## Carried-forward assumptions

| ID | Assumption | Confidence | Risk if wrong | Affected requirements |
|---|---|---|---|---|
| ASSUMED-001 | <assumption text> | <high|medium|low> | <consequence> | <CAT-01, …> |

## Resolved

<Questions and assumptions that were resolved during the run, with the resolution.>
```

Gate check: `questions_assumptions_visible` — file must be present and non-empty.

---

## READINESS.md

**Purpose:** human-readable gate verdict — written by `i2r.py gate.check`, not `assemble`.

**Required structure:**

```markdown
---
title: Readiness — <product name>
source: i2r
run_id: i2r-<slug>-<run-id>
readiness: <READY|NEEDS_REVIEW|BLOCKED>
lang: <zh|en>
generated_at: <ISO-8601>
---
# Readiness — <product name>

## Verdict: <READY | NEEDS_REVIEW | BLOCKED>

<One-sentence summary of why this verdict was reached.>

## Gate checks

| Check | Result | Finding |
|---|---|---|
| out_markdown_only | PASS/FAIL | <detail if failed> |
| no_downstream_commands | PASS/FAIL | <detail if failed> |
| prd_has_executive_summary | PASS/FAIL | … |
| requirements_are_narrative | PASS/FAIL | … |
| acceptance_has_plain_language | PASS/FAIL | … |
| readiness_markdown_exists | PASS/FAIL | … |
| traceability_markdown_exists | PASS/FAIL | … |
| constraints_visible | PASS/FAIL | … |
| questions_assumptions_visible | PASS/FAIL | … |
| no_machine_contract_language | PASS/FAIL | … |
| both_reviews_pass | PASS/FAIL | … |
| no_open_blocker | PASS/FAIL | … |
| placeholder_scan | PASS/FAIL | … |
| prd_grade | PASS/FAIL | <score / threshold> |
| reader_test | PASS/FAIL | … |

## Blocking findings
<List of BLOCKER findings, if any — or "(none)".>

## Major findings
<List of MAJOR findings, if any — or "(none)".>

## Reviewer notes
<Summary of Reviewer A and Reviewer B findings.>

## Remaining risks
<Open questions or assumptions that could affect implementation — not "run this plan".>

## Suggested follow-up
<Human-language suggestions for what the team might do next — NOT downstream commands.>
```

Gate check: `readiness_markdown_exists` — file must be present and non-empty.
Note: READINESS.md must NEVER contain downstream orchestration commands or machine-contract language.

---

## TRACEABILITY.md

**Purpose:** human-readable source→requirement→acceptance trace.

**Required structure:**

```markdown
---
title: Traceability — <product name>
source: i2r
…
---
# Traceability — <product name>

## Source → Requirement

| Source ref | Claim type | Requirement(s) |
|---|---|---|
| <source_ref> | <STATED|ASSUMED|DECISION> | <CAT-01, NFR-REL-01, …> |

## Requirement → Acceptance

| Requirement | Acceptance criteria |
|---|---|
| <CAT-01> | <AC-CAT-01-01, AC-CAT-01-02> |

## Decision → Impact

| Decision (ADR) | Affected requirements | Constraint imposed |
|---|---|---|
| <ADR-0001> | <CAT-01, …> | <constraint text> |
```

Gate check: `traceability_markdown_exists` — file must be present and non-empty.

---

## CHANGELOG.md

**Purpose:** per-run change notes.

**Required structure:**

```markdown
---
title: Changelog — <product name>
source: i2r
…
---
# Changelog — <product name>

## Run <run_id> — <generated_at>

### Added
- <new requirement / document / decision>

### Changed
- <modified requirement — what changed and why>

### Removed
- <removed item — why>

### Affected documents
- <list of out/ files that changed>
```

---

## decisions/ADR-*.md

**Purpose:** one locked decision per file.

**Required sections:**

```markdown
---
title: <decision title>
source: i2r
run_id: i2r-<slug>-<run-id>
lang: <zh|en>
generated_at: <ISO-8601>
---
# ADR-<NNNN>: <decision title>

**Status:** <Proposed|Accepted|Superseded|Deprecated>

## Context
<What situation or question required this decision.>

## Decision
<The decision itself — one clear statement.>

## Rationale
<Why this decision was made — evidence from intake / context / constraints.>

## Alternatives considered
<What else was considered and why it was not chosen.>

## Tradeoffs
<What is gained and what is given up.>

## Consequences
<What changes downstream as a result of this decision.>

## Reversibility
<Can this be changed later, and at what cost?>

## Affected requirements
<CAT-01, NFR-SEC-01, …>

## Source
<source_ref — where the decision was recorded in raw/ or by human sign-off.>
```
