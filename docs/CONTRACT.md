# idea-to-requirements-orchestrator — Internal Build Contract

> **Single source of truth.** Every file in this build (schemas / SDK / agents / skills / hooks / examples /
> evals / docs) obeys this contract. **If a file disagrees with this doc, the file is wrong.** Fan-out
> subagents receive the relevant excerpt pinned in their prompt. Internal abbreviation: **I2R**.
>
> **v2 — Markdown-first (2026-06-22).** I2R no longer produces a "machine handoff bundle". It produces a
> **local Markdown-first requirements package** under a hidden `.i2r/` workspace: the reading layer (`out/`)
> is narrative Markdown for humans, teams, and downstream AI orchestration alike; structured JSON/YAML is
> kept **internal** for traceability, review, reproducibility, and deterministic gates.

---

## 0. Vendor-not-install discipline (load-bearing)

External projects are a **source of proven patterns**, NEVER runtime dependencies. For each pattern:
`research external → extract pattern → implement as our own i2r-* subskill → cite source in
docs/I2R-LEDGER.md §source-map → add examples/tests`. **I2R never installs or calls an external skill at
runtime.** Rationale: avoids upstream drift, license tangles, trigger conflicts, scope creep, context
pollution, and collision with GSD. The vendored sources are tracked in `docs/I2R-LEDGER.md`.

---

## 1. Identity & the one boundary

- **Skill name:** `idea-to-requirements-orchestrator` · **internal:** I2R · **agent prefix:** `i2r-`.
- **Produces:** a Markdown requirements package describing `WHAT` + `WHY` + `CONSTRAINTS` +
  `LOCKED DECISIONS` only.
- **Never produces:** `WHEN` (phases/roadmap) · `HOW` (architecture/impl/db/API/file-structure) ·
  `WHO-BUILDS-WHAT` (tasks). Downstream orchestration (GSD) re-derives all of those.
- **MUST NOT emit downstream orchestration commands.** No `/gsd:*`, no `plan-phase`, no `ingest-docs`, no
  "run this next" instruction, no machine-contract field (`next_command_hint`, `consumer_contract_version`,
  `required_gsd_behavior`, `handoff.gsd.json`). I2R MAY state reading order, readiness, boundaries, and
  locked decisions. Downstream systems read the same human-facing documents and apply their own routing.
- **Reader Model (one artifact set for all readers):** the `out/` Markdown documents are intended for human
  readers, product/engineering teams, AND downstream AI orchestration. There is **no separate GSD-specific
  instruction artifact**. Downstream reads what humans read.
- **Stack-swap test (the one-line boundary check):** if swapping the DB or framework forces a requirement
  edit, that requirement leaked HOW → rewrite it. Implementation-leakage = hard FAIL.

---

## 2. Run-folder layout (`.i2r/`, created at runtime by `i2r.py init`; NOT a build artifact)

`.i2r/` is a **local developer workspace**: hidden, local-only, **never committed** (§19). Source files
(schemas / scripts / `.claude/` / docs / examples) stay where they are; only **runtime runs** live in `.i2r/`.

```
.i2r/                                 LOCAL developer workspace — git-excluded, never committed (§19)
  config/i2r.config.yaml              OPTIONAL — defaults apply if absent (I2R stays config-less by default)
  latest.json                         pointer → most-recent run (slug + run-id + path + readiness)
  runs/<slug>/<run-id>/
    raw/                              verbatim mirror of client material — IMMUTABLE
      idea.md
      clarifications-<n>.md           appended answers (never edit originals)
    out/                              READING layer — humans + teams + downstream AI — MARKDOWN ONLY (§18)
      README.md                       reading entry (NOT a handoff/contract)
      PRD.md                          primary product doc (Executive Summary + structured Goals)
      REQUIREMENTS.md                 narrative functional + quality requirements
      ACCEPTANCE.md                   Gherkin + plain-language explanation
      DECISIONS.md                    locked-decision overview
      CONSTRAINTS.md                  hard limits / boundaries
      GLOSSARY.md                     terms
      QUESTIONS.md                    open questions + carried-forward assumptions
      READINESS.md                    human-readable readiness verdict
      TRACEABILITY.md                 human-readable source→requirement→acceptance matrix
      CHANGELOG.md                    per-run change notes
      decisions/ADR-*.md              one locked decision each
    internal/                         GOVERNANCE layer — JSON/YAML — NOT a primary reading artifact
      stages/
        00-mode-routing.json  01-intake.json  02-context.json  02b-evidence.json
        03-scope.json  03b-scope-debate.json  04-functional.json  05-nfr.json
        06-acceptance.json  07-review.json  07-review.codex.json  08-repair-notes.json
      requirements.json               rigorous machine bundle (regenerable projection of the stages)
      traceability-matrix.json        full source→claim→scope→requirement→acceptance→decision chain
      claim-ledger.json               STATED / ASSUMED / DECISION ledger w/ confidence + source_ref
      quality-report.json             ambiguity / coverage / leakage metrics
      data-dictionary.md  data-dictionary.json   field/enum governance (P2)
    audit/                            developer review + quality explanation
      gate-result.yaml                machine gate verdict
      gate-result.md                  human-readable gate explanation
      review-summary.md               reviewer A/B findings + disagreements + repairs
      evidence-log.md                 evidence sources (if search ran)
      repair-notes.md                 repair-loop before/after (if repair ran)
      run-summary.md                  one-page run summary + quality basis
    ops/                              run state machine
      MANIFEST.json                   sha256 of every raw input
      state.json                      machine state pointer + lang + slug + run_id + stale[]
      run-log.md                      append-only audit (who did what, when)
```

Every stage writes **exactly one file** under `internal/stages/` and is **idempotent** (skips if its output
exists and inputs are unchanged). Re-entry is safe → this is what makes runs resumable. The `out/`, `audit/`
projections are **deterministically regenerable** from `internal/stages/` by `i2r.py assemble` / `gate.check`.

**Two hard lines (never blur):**
- `out/`  = Markdown, given to humans / teams / downstream AI to read.
- `internal/` (+ `audit/` machine files, `ops/`) = JSON/YAML, for I2R's own governance. **No internal
  JSON/YAML artifact is the primary downstream reading artifact.** Every downstream-readable fact has a
  Markdown projection in `out/`.

---

## 3. Stage → owner → schema map (stage files live under `internal/stages/`)

Every stage JSON is an **object** carrying `_meta` (§4) **plus** that stage's payload key(s). Arrays always
live under a named key (never a bare top-level array).

| Stage file (under `internal/stages/`) | Owner agent | Schema | Payload key |
|---|---|---|---|
| `00-mode-routing.json` | `i2r-orchestrator` | `00-mode-routing.schema.json` | routing fields |
| `01-intake.json` | `i2r-intake-clarifier` | `01-intake.schema.json` | `stated[] assumed[] decisions[] …` |
| `02-context.json` | `i2r-context-analyst` | `02-context.schema.json` | `actors[] jobs_to_be_done[] …` |
| `02b-evidence.json` | `i2r-evidence-researcher` | `02b-evidence.schema.json` | `evidence[]` (or `{status:SKIPPED}`) |
| `03-scope.json` | `i2r-scope-architect` | `03-scope.schema.json` | `in_scope[] out_of_scope[] …` |
| `03b-scope-debate.json` | `i2r-orchestrator` (debate) | `03b-scope-debate.schema.json` | `positions[] resolution` (or SKIPPED) |
| `04-functional.json` | `i2r-functional-author` | `04-functional.schema.json` | `requirements[]` |
| `05-nfr.json` | `i2r-nfr-author` | `05-nfr.schema.json` | `nfrs[]` |
| `06-acceptance.json` | `i2r-acceptance-author` | `06-acceptance.schema.json` | `scenarios[]` |
| `07-review.json` | `i2r-completeness-critic` | `07-review.schema.json` | `findings[]` |
| `07-review.codex.json` | Codex / fallback critic | `07-review.schema.json` | `findings[]` |
| `08-repair-notes.json` | `i2r-orchestrator` | `08-repair-notes.schema.json` | `findings[] repair_prompt` (or SKIPPED) |
| `requirements.json` (in `internal/`) | `i2r.py assemble` ($0) | `requirements-handoff.schema.json` | bundle |

The `out/` Markdown package, `internal/{traceability-matrix,claim-ledger,quality-report}.json`,
`audit/*`, `ops/*` are deterministic projections (shapes in §8, §11, §18, gsd-projection-mode).

**Conditional-stage stubs (always present).** `02b-evidence`, `03b-scope-debate`, `08-repair-notes` are
**always** written. When their mode did not trigger, the SDK writes `{ "_meta": {…}, "status": "SKIPPED" }`.
`validate` / `required_stages` / `gate.check` treat a `SKIPPED` stub as *satisfied-absent* (no schema body
required). Rationale: the gate must never have to guess whether a missing file means "not triggered" or
"failed".

---

## 4. Stage metadata block (`_meta`) — every stage JSON MUST carry this

```json
{
  "_meta": {
    "artifact_version": "2.0",
    "stage": "04-functional",
    "run_id": "i2r-<slug>-<run-id>",
    "generated_by_agent": "i2r-functional-author",
    "created_at": "<ISO-8601>",
    "lang": "en",
    "input_hashes": [{ "file": "03-scope.json", "sha256": "…" }],
    "skills_used": ["i2r-fr-authoring-mode", "i2r-scope-mode"],
    "tools_used": ["Read", "Write", "Bash(python scripts/i2r.py validate --stage 4)"],
    "mode_context": { "search_mode": "not_required", "discussion_mode": "not_required", "debate_mode": "not_required" }
  }
}
```

`_meta.lang` ∈ `{ zh, en }` echoes the run language (§20). `_meta.mode_context` is **descriptive-only** — a
human-readable echo of what the run did; it is NOT a routing input. The AUTHORITATIVE routing flags are the
`requires_*` fields in `00-mode-routing.json` (read by `i2r.py required_stages` / `mode.check`).

`i2r-subagent-output-gate` (SubagentStop hook) verifies, before a subagent's work is accepted:
schema-valid · `generated_by_agent` == expected owner · `skills_used` ⊇ required-for-stage (**advisory**) ·
`tools_used` contains no forbidden tool · `input_hashes` match current upstream · no STALE upstream.

---

## 5. ID conventions (do not vary)

| Entity | Format | Example |
|---|---|---|
| Functional requirement | `<CAT>-NN` (CAT = UPPER category slug) | `AUTH-01` |
| Non-functional requirement | `NFR-<ISOCAT>-NN` | `NFR-REL-01` |
| Acceptance criterion | `AC-<FR_ID>-NN` | `AC-AUTH-01-01` |
| Evidence card | `EV-NNN` | `EV-001` |
| Research question | `RQ-NNN` | `RQ-001` |
| Evidence gap | `GAP-NNN` | `GAP-001` |
| ADR | `ADR-NNNN` | `ADR-0001` |
| Claim (ledger) | `<KIND>-NNN` (KIND = STATED/ASSUMED/DECISION) | `STATED-003` |

---

## 6. Canonical enums & field names (cross-file — never rename)

- `source` ∈ `{ stated, assumed, decision }` — on a functional requirement, and OPTIONALLY on an NFR (an NFR
  whose threshold is an engineered default NOT stated in raw should set `source: assumed`; `out/` then marks it
  "assumed default — pending confirmation")
- A `decisions[]` entry MAY carry optional `context` / `rationale` / `alternatives` / `tradeoffs` /
  `consequences` / `reversibility` (filled only when the raw idea grounds them) → they project into the ADR body;
  the SDK also computes each decision's **affected requirements** deterministically (FR/NFR sharing its `source_ref`)
- `priority` (MoSCoW) ∈ `{ MUST, SHOULD, COULD, WONT }`
- `ears_pattern` ∈ `{ ubiquitous, event_driven, state_driven, optional, unwanted, complex }`
- `fit_criterion` = `{ threshold, environment, period }` — **all three required** for any `required` NFR
- `coverage_status` ∈ `{ required, not_applicable, deferred }`
- `iso25010_category` ∈ ISO/IEC 25010**:2023** 9 chars: `Functional Suitability`, `Performance Efficiency`,
  `Compatibility`, `Interaction Capability`, `Reliability`, `Security`, `Maintainability`, `Flexibility`,
  `Safety`. (Aliases accepted on input: `Usability`→Interaction Capability, `Portability`→Flexibility.)
- `severity` ∈ `{ BLOCKER, MAJOR, MINOR }`
- `verdict` (per reviewer) ∈ `{ PASS, FAIL }`
- gate / readiness `verdict` ∈ `{ READY, NEEDS_REVIEW, BLOCKED }`
- `clarification_status` ∈ `{ clear, needs_clarification }`
- `requires_discussion` ∈ `{ none, non_blocking, blocking }`
- `lang` ∈ `{ zh, en }` (run language, §20)
- `confidence` ∈ `{ high, medium, low }` (claim ledger + assumptions)
- Every requirement carries `source_ref` → a pointer into `raw/` or a recorded assumption. Never fabricate.

---

## 7. Defect taxonomy (`defect_class` — completeness-critic + 07-review schema, fixed set)

`AMBIGUITY` · `UNTESTABLE` · `UNSOURCED` · `SCOPE_LEAK` · `IMPLEMENTATION_LEAK` · `DUPLICATE` · `CONFLICT` ·
`NFR_MISSING` · `ACCEPTANCE_GAP` · `GSD_INCOMPATIBLE` · `DOWNSTREAM_REINTERPRETATION_RISK` ·
`READER_TEST_FAIL` · `PLACEHOLDER` · `DOWNSTREAM_COMMAND_LEAK`

`NFR_MISSING` covers **either** a `required` NFR lacking its `fit_criterion` **or** an in-scope capability with
observable quality attributes that has no NFR at all. `DOWNSTREAM_COMMAND_LEAK` (new, BLOCKER) = any `/gsd:*`,
`plan-phase`, `ingest-docs`, or machine-contract field in an `out/` document (§1, §18). Full per-class
definitions + default severities live in `i2r-debate-review-mode/references/defect-taxonomy.md`.

---

## 8. Gate logic — `i2r.py gate.check` → `audit/gate-result.yaml` + `audit/gate-result.md` + `out/READINESS.md` (deterministic, $0)

**Semantic checks** (existing):
1. All required stages present + schema-valid (SKIPPED stubs count as satisfied-absent).
2. **Both** reviews PASS (Reviewer A + Reviewer B), distinct + independent + never an author.
3. No open `BLOCKER` finding.
4. `placeholder_scan` clean (§9).
5. `prd_grade` meets thresholds (§10).
6. `reader_test` == PASS over the whole `out/` package (§11).

**Markdown-first structural checks** (new, deterministic; §18). Each maps to a gate finding:
- `out_markdown_only` — `out/` contains only `*.md` (+ `decisions/*.md`); any `.json/.yaml` → **BLOCKER**.
- `no_downstream_commands` — no `/gsd:`, `plan-phase`, `ingest-docs`, `next_command_hint`,
  `consumer_contract_version`, `handoff.gsd` in any `out/*.md` → **BLOCKER** (`DOWNSTREAM_COMMAND_LEAK`).
- `prd_has_executive_summary` — `PRD.md` has the Executive Summary section → else **MAJOR**.
- `requirements_are_narrative` — `REQUIREMENTS.md` has per-requirement sections, not just one table → **MAJOR**.
- `acceptance_has_plain_language` — every Gherkin block in `ACCEPTANCE.md` is followed by a plain-language
  explanation → else **MAJOR**.
- `readiness_markdown_exists` / `traceability_markdown_exists` / `constraints_visible` /
  `questions_assumptions_visible` — the corresponding `out/*.md` exist and are non-empty → else **BLOCKER**.
- `no_machine_contract_language` — `out/` free of machine-contract phrases → else **MAJOR**.

**Verdict:** `READY` (all hold) · `NEEDS_REVIEW` (open `MAJOR`, no `BLOCKER`, gate-soft items) · `BLOCKED`
(any `BLOCKER`, missing required stage, failed reader-test, placeholder hit, or `out/` structural BLOCKER).
Exit codes: 0 / 1 / 2. `out/READINESS.md` renders the verdict for humans; `audit/gate-result.yaml` is the
machine record; `audit/gate-result.md` is the human-readable explanation.

---

## 9. `placeholder_scan` reject list (vendored: PRD Taskmaster)

Reject these as a **requirement value / fit_criterion / acceptance line** (context-aware — allowed inside
`rationale`/notes): `TBD`, `TODO`, `FIXME`, `nice to have`, `fast`, `secure`, `scalable`, `robust`,
`user-friendly`, `performant`, `flexible`, `efficient`, `as appropriate`, `as needed`, `etc.`, `and so on`,
`to be determined`. A hit on a requirement/NFR/AC field → `PLACEHOLDER` finding (BLOCKER).

---

## 10. `prd_grade` + GSD ambiguity precheck (vendored: PRD Taskmaster + local GSD rubric)

Weighted ambiguity score over the requirements package, mirroring GSD `/gsd:spec-phase`:
`goal 35% · boundary 25% · constraint 20% · acceptance 20%`, **target ≤ 0.20**. Plus a standalone
`downstream_ai_ambiguity_risk` flag. Recorded under `07-review.*.gsd_ambiguity_precheck`. Above target → `MAJOR`.

---

## 11. Reader Test Gate (vendored: Anthropic doc-coauthoring) — now over the whole `out/` package

A **fresh critic receives ONLY the `out/` Markdown package** (no `internal/`, no `raw/`). It must independently infer:
**(1) what to build · (2) why · (3) who benefits · (4) what is explicitly out · (5) which decisions are locked ·
(6) which assumptions are still open · (7) how it is accepted · (8) current readiness · (9) no HOW/WHEN/WHO
leakage.** If it cannot → `READER_TEST_FAIL` (BLOCKER). Run inside the review-debate layer
(`i2r-debate-review-mode`), recorded in `07-review.*`, required `PASS` by `gate.check`. This is the real "is
the package readable standalone" test — and because the same package is what downstream AI reads, passing it
means downstream gets the same clear picture a human does.

---

## 12. Model routing

- **Runtime: ALL agents on `opus`** — lead orchestrator + all 9 `i2r-*` agents. The `$0` Python SDK is
  **no-LLM**. Reviewer B = Codex `/codex:adversarial-review`; on Codex quota/rate-limit → fallback to a
  **2nd fresh-context `i2r-completeness-critic` (opus)**. Bounded review loop: **max 3 iters**.
- **Build-time (constructing this repo):** contract / schemas / SDK / hooks = main thread (opus);
  prose clusters (agents, subskills, docs) = `sonnet` fan-out with this contract pinned.

---

## 13. Hooks (9) — project-local in `.claude/hooks/`, registered via committed `.claude/settings.json` (written by `i2r.py install`, NOT by `init`); fail-open/silent on non-i2r projects

| Hook | Event | Blocking | Enforces |
|---|---|---|---|
| `_i2r-common.js` | — (shared lib) | — | run-folder discovery (`.i2r/runs`), state read, redaction helpers |
| `i2r-session-context` | SessionStart | no | inject active run + current stage pointer + `status` cmd (no downstream command hints) |
| `i2r-auto-trigger-boundary` | UserPromptSubmit | no | requirements-shaped prompt → nudge I2R; impl/code prompt → nudge AWAY |
| `i2r-write-boundary` | PreToolUse | **yes** | block writes to impl dirs while I2R active (§14) |
| `i2r-mode-gate` | Stop | **yes** | routing-required search/discussion/debate not done → block downstream |
| `i2r-mark-stale` | PostToolUse | no | upstream artifact changed → mark downstream STALE |
| `i2r-subagent-output-gate` | SubagentStop | **yes** | owned artifact exists in `internal/stages/` + schema-valid + `_meta` complete (§4) |
| `i2r-citation-gate` | SubagentStop / Stop | **yes** | evidence CARDS in `02b-evidence.json` carry a `source_ref` (reuses `i2r.py evidence.validate`) |
| `i2r-readiness-gate` | Stop | **yes** | block "requirements done / ready" claims unless both reviews PASS + gate ∈ {READY, NEEDS_REVIEW} + no open BLOCKER. **Emits NO downstream command.** (file: `i2r-readiness-gate.js`) |

Registration: the hook `.js` files live in `.claude/hooks/`; `i2r.py install` writes a committed
`.claude/settings.json` wiring them to events + appends `.i2r/` to the project's git-exclude (§19). Pilot
note: hooks only fire when this folder is the active project. Global promotion (registering into
`~/.claude/settings.json` + `hook-registry.json`) is a separate step.

> Naming note: the readiness gate file is `i2r-readiness-gate.js` (was `i2r-handoff-gate.js`). The
> enforcement is unchanged — only the framing dropped the "handoff" word and any downstream-command text.

---

## 14. Write boundary (`i2r-write-boundary`)

**Allow while I2R active:** `.i2r/**` · `docs/requirements/**` · `docs/adr/**` ·
`.claude/skills/idea-to-requirements-orchestrator/**`
**Deny while I2R active:** `src/** app/** lib/** packages/** tests/** database/** migrations/** api/**
routes/** components/** ui/**` — keeps I2R from doing GSD's job.

---

## 15. Component registry

**10 mode subskills** (`.claude/skills/`): `i2r-skill-quality-mode` · `i2r-elicitation-mode` ·
`i2r-search-mode` · `i2r-discussion-mode` · `i2r-scope-mode` · `i2r-fr-authoring-mode` ·
`i2r-nfr-authoring-mode` · `i2r-acceptance-mode` · `i2r-debate-review-mode` · `i2r-gsd-projection-mode`.
Root orchestration skill dir (`idea-to-requirements-orchestrator/`): `SKILL.md` + `workflow.md` +
`mode-router.md` + `output-contract.md` (was `gsd-contract.md`) + `quality-gates.md` + `orchestration-policy.md`.

**9 agents** (`.claude/agents/`, all opus): `i2r-orchestrator` · `i2r-intake-clarifier` ·
`i2r-context-analyst` · `i2r-evidence-researcher` · `i2r-scope-architect` · `i2r-functional-author` ·
`i2r-nfr-author` · `i2r-acceptance-author` · `i2r-completeness-critic`.

**SDK — `scripts/i2r.py` (core) + `scripts/i2r_render.py` (Markdown rendering, pure functions, zh/en i18n).**
`i2r.py` commands (`$0`, no-LLM): `init` · `install` · `status` · `route` · `validate --stage N` ·
`mode.check` · `evidence.validate` · `discuss.record` · `repair.plan` · `assemble` · `gate.check` ·
`mark-stale` · `unstale` · `diff` · `explain-fail` · `archive` · `export` · `evals.run`.
`validate --stage N` accepts stage tokens (incl. `2b` / `3b` / `8`), bare numbers, and `all`. `assemble`
writes the `out/` Markdown package + `internal/` machine artifacts. `gate.check` writes `audit/` +
`out/READINESS.md` and updates `latest.json`. `archive` moves old runs to `.i2r/archive/`; `export` emits a
sanitized share package (raw/internal stripped). `install` writes the committed `.claude/settings.json`,
copies the toolchain (i2r.py + i2r_render.py + schemas + hooks + CONTRACT), and appends `.i2r/` to git-exclude.

**`i2r_render.py`** is **pure**: it takes already-loaded stage data + `lang` and returns `{filename: content}`
strings. It performs no path resolution and no file IO (i2r.py owns those). This keeps both files < 800 lines
and makes the Markdown rendering independently testable.

---

## 16. Portability (vendored: open Agent Skills standard / OpenAI Codex skills)

Each subskill is written portably: lean `SKILL.md` + `references/` (+ `examples/`, `schemas/` as needed),
not a Claude-only mega-prompt. Depth lives in `references/`; `SKILL.md` stays a thin router. This keeps the
whole orchestrator migratable to Codex / other Agent-Skills-standard runtimes later.

---

## 17. Hard rules (critics + SDK enforce; lead supervises)

1. WHAT/WHY not HOW — implementation leakage = hard FAIL (§1 stack-swap test).
2. Every `required` NFR needs a real `fit_criterion` (threshold+environment+period) or the gate blocks.
3. Grounding — every requirement tagged `source` + `source_ref`; assumptions surfaced to the human, never
   silently promoted to `stated`; never fabricated.
4. Singular — one requirement = one behaviour (flag hidden `and`/`or` conjunctions).
5. Dual independent review (santa-loop) — two reviewers, fresh context, never an author; **both must PASS**.
6. Bounded review loop — max 3 iterations; still failing → stop, surface to human.
7. One file, one writer (structural race prevention).
8. Never output phases / tasks / architecture / code / UI.
9. `raw/` immutable; new answers → `raw/clarifications-<n>.md`; logs append-only.
10. **`out/` is Markdown-only.** No JSON/YAML in `out/`. Every downstream-readable fact has a Markdown
    projection; no internal JSON/YAML is the primary downstream reading artifact.
11. **MUST NOT emit downstream orchestration commands** (`/gsd:*` / plan / phase / execution mode / task
    sequencing) or machine-contract language in any `out/` document.
12. **One language per run** (§20) — never simultaneous bilingual output.

---

## 18. Output package (`out/`) contract — the Markdown-first reading layer

`out/` is what humans, teams, and downstream AI read. Markdown-only. Narrative where it aids understanding,
tables only for overviews. Files (all present every run; localized to the run `lang`):

| File | Purpose | Must contain |
|---|---|---|
| `README.md` | reading entry | status, reading order, what this package is, what it does NOT do; **no** downstream commands |
| `PRD.md` | primary product doc | `## Executive Summary` (problem/outcome/users/in-scope/out-of-scope/locked decisions/risks/readiness) + structured `## Goals` (each goal: signal · target · source · confidence) + Non-Goals + Scope + Actors/JTBD + Requirements overview + links |
| `REQUIREMENTS.md` | detailed FR + NFR | per-requirement sections (ID, name, requirement sentence, why, source, priority, acceptance coverage, notes); NFR adds quality attribute + fit criterion + measurement context + validation. **Not a single table dump.** |
| `ACCEPTANCE.md` | acceptance | per scenario: Covers, Type, Gherkin code block, **plain-language explanation**, observable evidence, not-covered |
| `DECISIONS.md` | locked decisions | overview table + separation of Locked Decisions vs Preferences vs Assumptions + ADR index |
| `CONSTRAINTS.md` | boundaries | Product / Quality / Decision constraints + an explicit "Not Constraints" section |
| `GLOSSARY.md` | terms | term/meaning/notes/source + ambiguous-terms-resolved + intentionally-undefined |
| `QUESTIONS.md` | open questions + assumptions | open questions (blocking?) + carried-forward assumptions (confidence, risk-if-wrong, affected reqs) + resolved |
| `READINESS.md` | gate result for humans | verdict + why + blocking/major/minor + checks table + reviewer notes + remaining risks + suggested follow-up (NOT "run this plan") |
| `TRACEABILITY.md` | trace matrix for humans | source→requirement, requirement→acceptance, decision→impact tables |
| `CHANGELOG.md` | per-run change notes | Added/Changed/Removed + why + affected documents |
| `decisions/ADR-*.md` | one decision each | Status, Context, Decision, Rationale, Alternatives, Tradeoffs, Consequences, Reversibility, Affected requirements, Source |

Frontmatter on `out/*.md` stays **light**: `title`, `source: i2r`, `run_id`, `readiness`, `lang`,
`generated_at`. No machine-contract fields.

---

## 19. Storage & git policy (`.i2r/` is local-only)

`.i2r/` is a **local developer workspace**, not product source. It is **never committed**. `i2r.py install`
appends `.i2r/` to the project's `.git/info/exclude` (local, un-shared) and, if a `.gitignore` exists, adds a
`.i2r/` line. Defense-in-depth (documented in `docs/STORAGE.md`): (1) git-exclude, (2) `.gitignore` line,
(3) a pre-commit guard that rejects staged `.i2r/` paths, (4) `gate.check` notes if `.i2r/` looks tracked.
Hidden ≠ secure — it is visual only; the git-exclusion is what keeps it out of commits.

**Truth source vs projection.** The truth source is `internal/stages/*.json` (+ `raw/`). `out/`, `audit/`,
and `internal/{requirements,traceability-matrix,...}.json` are **regenerable projections** — safe to delete
and rebuild via `i2r.py assemble` / `gate.check`.

---

## 20. Language policy (one language per run)

Each run has exactly one language `lang ∈ { zh, en }`, chosen at the **start of the run** (the orchestrator
asks the user "中文 or English?" before authoring). The SDK boilerplate (section headings, labels, READINESS
text, README) renders in `lang` via `i2r_render.py` i18n tables; the i2r-* agents author requirement content
in `lang`. **No simultaneous bilingual output** — the dual `PRD.zh.md`/`PRD.en.md` projection is intentionally
NOT produced (it drifts). An optional secondary-language projection is OFF by default and only emitted on
explicit request. `lang` is stored in `ops/state.json` and echoed in every `_meta.lang`.
