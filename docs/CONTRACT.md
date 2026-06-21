# idea-to-requirements-orchestrator — Internal Build Contract

> **Single source of truth.** Every file in this build (~85 across schemas / SDK / agents / skills /
> hooks / examples / evals / docs) obeys this contract. **If a file disagrees with this doc, the file is
> wrong.** W1 fan-out subagents receive this contract pinned in their prompt. Internal abbreviation: **I2R**.

---

## 0. Vendor-not-install discipline (load-bearing)

External projects are a **source of proven patterns**, NEVER runtime dependencies. For each pattern:
`research external → extract pattern → implement as our own i2r-* subskill → cite source in
docs/I2R-LEDGER.md §source-map → add examples/tests`. **I2R never installs or calls an external skill at
runtime.** Rationale: avoids upstream drift, license tangles, trigger conflicts, scope creep, context
pollution, and collision with GSD. (Anthropic skill-security guidance: audit every skill; don't run
untrusted skills in production.) The vendored sources are tracked in `docs/I2R-LEDGER.md`.

---

## 1. Identity & the one boundary

- **Skill name:** `idea-to-requirements-orchestrator` · **internal:** I2R · **agent prefix:** `i2r-`.
- **Produces:** `WHAT` + `WHY` + `CONSTRAINTS` + `LOCKED DECISIONS` only.
- **Never produces:** `WHEN` (phases/roadmap) · `HOW` (architecture/impl/db/API/file-structure) ·
  `WHO-BUILDS-WHAT` (tasks). GSD re-derives all of those.
- **Stack-swap test (the one-line boundary check):** if swapping the DB or framework forces a requirement
  edit, that requirement leaked HOW → rewrite it. Implementation-leakage = hard FAIL.

---

## 2. Run-folder layout (created at runtime by `i2r.py init`; NOT a build artifact)

```
runs/i2r/<slug>/<timestamp>/
  00-raw/                    verbatim mirror of client material — IMMUTABLE
    clarifications-<n>.md    new answers appended here (never edit originals)
  00-mode-routing.json       L0 router output
  01-intake.json
  02-context.json
  02b-evidence.json          conditional (search mode)
  03-scope.json
  03b-scope-debate.json      conditional (scope debate)
  04-functional.json
  05-nfr.json
  06-acceptance.json
  07-review.json             Reviewer A (claude critic)
  07-review.codex.json       Reviewer B (codex adversarial | fallback fresh critic)
  08-repair-notes.json       conditional (repair loop)
  requirements.json          assemble output — rigorous layer
  PRD.md                     assemble output — GSD-native layer
  decisions/ADR-*.md         assemble output (ADR projection ON)
  gate-result.yaml           gate.check output
  MANIFEST.json              sha256 of every 00-raw input
  state.json                 machine state pointer (detect_state)
  run-log.md                 append-only audit (who did what, when)
```

Every stage writes **exactly one file** and is **idempotent** (skips if its output exists and inputs are
unchanged). Re-entry is safe → this is what makes runs resumable.

---

## 3. Stage → owner → schema map

Every stage JSON is an **object** carrying `_meta` (§4) **plus** that stage's payload key(s) (the array/
fields defined by its schema). Arrays always live under a named key (never a bare top-level array).

| Stage file | Owner agent | Schema | Payload key |
|---|---|---|---|
| `00-mode-routing.json` | `i2r-orchestrator` | `00-mode-routing.schema.json` | routing fields |
| `01-intake.json` | `i2r-intake-clarifier` | `01-intake.schema.json` | `stated[] assumed[] decisions[] …` |
| `02-context.json` | `i2r-context-analyst` | `02-context.schema.json` | `actors[] jobs_to_be_done[] …` |
| `02b-evidence.json` | `i2r-evidence-researcher` | `02b-evidence.schema.json` | `evidence[]` |
| `03-scope.json` | `i2r-scope-architect` | `03-scope.schema.json` | `in_scope[] out_of_scope[] …` |
| `03b-scope-debate.json` | `i2r-orchestrator` (debate) | `03b-scope-debate.schema.json` | `positions[] resolution` |
| `04-functional.json` | `i2r-functional-author` | `04-functional.schema.json` | `requirements[]` |
| `05-nfr.json` | `i2r-nfr-author` | `05-nfr.schema.json` | `nfrs[]` |
| `06-acceptance.json` | `i2r-acceptance-author` | `06-acceptance.schema.json` | `scenarios[]` |
| `07-review.json` | `i2r-completeness-critic` | `07-review.schema.json` | `findings[]` |
| `07-review.codex.json` | Codex / fallback critic | `07-review.schema.json` | `findings[]` |
| `08-repair-notes.json` | `i2r-orchestrator` | `08-repair-notes.schema.json` | `findings[] repair_prompt` |
| `requirements.json` | `i2r.py assemble` ($0) | `requirements-handoff.schema.json` | bundle |

`PRD.md`, `decisions/ADR-*.md`, `gate-result.yaml` are deterministic projections (no schema; shape in §8, §11, gsd-projection-mode).

---

## 4. Stage metadata block (`_meta`) — every stage JSON MUST carry this

```json
{
  "_meta": {
    "artifact_version": "1.0",
    "stage": "04-functional",
    "run_id": "i2r-<slug>-<timestamp>",
    "generated_by_agent": "i2r-functional-author",
    "created_at": "<ISO-8601>",
    "input_hashes": [{ "file": "03-scope.json", "sha256": "…" }],
    "skills_used": ["i2r-fr-authoring-mode", "i2r-scope-mode"],
    "tools_used": ["Read", "Write", "Bash(python scripts/i2r.py validate --stage 4)"],
    "mode_context": { "search_mode": "not_required", "discussion_mode": "not_required", "debate_mode": "not_required" }
  }
}
```

`_meta.mode_context` (`search_mode` / `discussion_mode` / `debate_mode`) is **descriptive-only** — a
human-readable echo of what the run did. It is NOT a routing input; the AUTHORITATIVE routing flags are the
`requires_*` fields in `00-mode-routing.json` (read by `i2r.py required_stages` / `mode.check`).

`i2r-subagent-output-gate` (SubagentStop hook) verifies, before a subagent's work is accepted:
schema-valid · `generated_by_agent` == expected owner · `skills_used` ⊇ required-for-stage (**advisory** —
the SDK `validate` enforces only `generated_by_agent == owner`, not `skills_used`) · `tools_used` contains no
forbidden tool · `input_hashes` match current upstream · no STALE upstream.
(This is the CrewAI-guardrail pattern: validate + normalize output before it flows downstream.)

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

---

## 6. Canonical enums & field names (cross-file — never rename)

- `source` ∈ `{ stated, assumed, decision }`
- `priority` (MoSCoW) ∈ `{ MUST, SHOULD, COULD, WONT }`
- `ears_pattern` ∈ `{ ubiquitous, event_driven, state_driven, optional, unwanted, complex }`
- `fit_criterion` = `{ threshold, environment, period }` — **all three required** for any `required` NFR
- `coverage_status` ∈ `{ required, not_applicable, deferred }`
- `iso25010_category` ∈ ISO/IEC 25010**:2023** 9 chars: `Functional Suitability`, `Performance Efficiency`,
  `Compatibility`, `Interaction Capability`, `Reliability`, `Security`, `Maintainability`, `Flexibility`,
  `Safety`. (Aliases accepted on input: `Usability`→Interaction Capability, `Portability`→Flexibility.)
- `severity` ∈ `{ BLOCKER, MAJOR, MINOR }`
- `verdict` (per reviewer) ∈ `{ PASS, FAIL }`
- gate / handoff `verdict` ∈ `{ READY, NEEDS_REVIEW, BLOCKED }`
- `clarification_status` ∈ `{ clear, needs_clarification }`
- `requires_discussion` ∈ `{ none, non_blocking, blocking }`
- Every requirement carries `source_ref` → a pointer into `00-raw/` or a recorded assumption. Never fabricate.

---

## 7. Defect taxonomy (`defect_class` — completeness-critic + 07-review schema, fixed set)

`AMBIGUITY` · `UNTESTABLE` · `UNSOURCED` · `SCOPE_LEAK` · `IMPLEMENTATION_LEAK` · `DUPLICATE` · `CONFLICT` ·
`NFR_MISSING` · `ACCEPTANCE_GAP` · `GSD_INCOMPATIBLE` · `DOWNSTREAM_REINTERPRETATION_RISK` ·
`READER_TEST_FAIL` · `PLACEHOLDER`

`NFR_MISSING` covers **either** a `required` NFR lacking its `fit_criterion` (the SDK `placeholder_scan`
emits this when any of `threshold`/`environment`/`period` is absent) **or** an in-scope capability with
observable quality attributes that has no NFR at all. Full per-class definitions + default severities live in
`i2r-debate-review-mode/references/defect-taxonomy.md`.

---

## 8. Gate logic — `i2r.py gate.check` → `gate-result.yaml` (deterministic, $0)

Aggregate checks (all must hold for READY):
1. All required stages present + schema-valid (per routing: search/discussion/debate artifacts exist if required).
2. **Both** reviews PASS (Reviewer A + Reviewer B).
3. No open `BLOCKER` finding.
4. `placeholder_scan` clean (§9).
5. `prd_grade` meets thresholds (§10).
6. `reader_test` == PASS (§11).

**Verdict:** `READY` (all hold) · `NEEDS_REVIEW` (open `MAJOR`, no `BLOCKER`, gate-soft items) · `BLOCKED`
(any `BLOCKER`, missing required stage, failed reader-test, or placeholder hit). Exit codes: 0 / 1 / 2.

---

## 9. `placeholder_scan` reject list (vendored: PRD Taskmaster)

Reject these as a **requirement value / fit_criterion / acceptance line** (context-aware — allowed inside
`rationale`/notes): `TBD`, `TODO`, `FIXME`, `nice to have`, `fast`, `secure`, `scalable`, `robust`,
`user-friendly`, `performant`, `flexible`, `efficient`, `as appropriate`, `as needed`, `etc.`, `and so on`,
`to be determined`. A hit on a requirement/NFR/AC field → `PLACEHOLDER` finding (BLOCKER).

---

## 10. `prd_grade` + GSD ambiguity precheck (vendored: PRD Taskmaster + local GSD rubric)

Weighted ambiguity score over the PRD, mirroring GSD `/gsd:spec-phase`:
`goal 35% · boundary 25% · constraint 20% · acceptance 20%`, **target ≤ 0.20**. Plus a standalone
`downstream_ai_ambiguity_risk` flag. Recorded under `07-review.*.gsd_ambiguity_precheck`. Above target → `MAJOR`.

---

## 11. Reader Test Gate (vendored: Anthropic doc-coauthoring)

A **fresh critic receives ONLY `PRD.md`** (no run folder, no other artifacts). It must independently infer:
**goals · scope boundary · constraints · acceptance**. If it cannot → `READER_TEST_FAIL` (BLOCKER) → the
PRD is not GSD-ready. Run inside the review-debate layer (`i2r-debate-review-mode`), recorded in
`07-review.*`, required `PASS` by `gate.check`. This is the real "is the handoff readable standalone" test.

---

## 12. Model routing

- **Runtime (user lock §11): ALL agents on `opus`** — lead orchestrator + all 9 `i2r-*` agents. The `$0`
  Python SDK is **no-LLM**. Reviewer B = Codex `/codex:adversarial-review`; on Codex quota/rate-limit →
  fallback to a **2nd fresh-context `i2r-completeness-critic` (opus)**. Bounded review loop: **max 3 iters**.
- **Build-time (constructing this repo):** contract / schemas / SDK / hooks = main thread (opus);
  prose clusters (agents, subskills) = `sonnet` fan-out with this contract pinned.

---

## 13. Hooks (9) — project-local in `.claude/hooks/`, registered via a committed `.claude/settings.json` (written by `i2r.py install`, NOT by `init`); fail-open/silent on non-i2r projects

| Hook | Event | Blocking | Enforces |
|---|---|---|---|
| `_i2r-common.js` | — (shared lib) | — | run-folder discovery, state read, redaction helpers |
| `i2r-session-context` | SessionStart | no | inject active run + current stage pointer + `status` cmd |
| `i2r-auto-trigger-boundary` | UserPromptSubmit | no | requirements-shaped prompt → nudge I2R; impl/code prompt → nudge AWAY |
| `i2r-write-boundary` | PreToolUse | **yes** | block writes to impl dirs while I2R active (§14) |
| `i2r-mode-gate` | Stop | **yes** | routing-required search/discussion/debate not done → block downstream |
| `i2r-mark-stale` | PostToolUse | no | upstream artifact changed → mark downstream STALE |
| `i2r-subagent-output-gate` | SubagentStop | **yes** | owned artifact exists + schema-valid + `_meta` complete (§4) |
| `i2r-citation-gate` | SubagentStop / Stop | **yes** | ensures evidence CARDS in `02b-evidence.json` carry a `source_ref` (reuses `i2r.py evidence.validate`) |
| `i2r-handoff-gate` | Stop | **yes** | block "requirements done / ready for GSD" unless both reviews PASS + gate ∈ {READY, NEEDS_REVIEW} + no open BLOCKER |

Registration: the 9 hook `.js` files live in `.claude/hooks/`; `i2r.py install` writes a committed
`.claude/settings.json` that wires them to their events (this is what `init` does NOT do — `init` only
scaffolds the run folder). Pilot note: in the Desktop pilot, hooks only fire when this folder is the active
project. Global promotion (registering into `~/.claude/settings.json` + `hook-registry.json`) is a separate
later step — not this build.

---

## 14. Write boundary (`i2r-write-boundary`)

**Allow while I2R active:** `runs/i2r/**` · `docs/requirements/**` · `docs/adr/**` ·
`.claude/skills/idea-to-requirements-orchestrator/**`
**Deny while I2R active:** `src/** app/** lib/** packages/** tests/** database/** migrations/** api/**
routes/** components/** ui/**` — keeps I2R from doing GSD's job.

---

## 15. Component registry

**10 mode subskills** (`.claude/skills/`): `i2r-skill-quality-mode` · `i2r-elicitation-mode` ·
`i2r-search-mode` · `i2r-discussion-mode` · `i2r-scope-mode` · `i2r-fr-authoring-mode` ·
`i2r-nfr-authoring-mode` · `i2r-acceptance-mode` · `i2r-debate-review-mode` · `i2r-gsd-projection-mode`.
Root orchestration skill dir (`idea-to-requirements-orchestrator/`): `SKILL.md` + `workflow.md` +
`mode-router.md` + `gsd-contract.md` + `quality-gates.md` + `orchestration-policy.md`.

**9 agents** (`.claude/agents/`, all opus): `i2r-orchestrator` · `i2r-intake-clarifier` ·
`i2r-context-analyst` · `i2r-evidence-researcher` · `i2r-scope-architect` · `i2r-functional-author` ·
`i2r-nfr-author` · `i2r-acceptance-author` · `i2r-completeness-critic`.

**`i2r.py` commands (16, $0):** `init` · `install` · `status` · `route` · `validate --stage N` ·
`mode.check` · `evidence.validate` · `discuss.record` · `repair.plan` · `assemble` · `gate.check` ·
`mark-stale` · `unstale` · `diff` · `explain-fail` · `evals.run`.
`validate --stage N` accepts the stage tokens (incl. `2b` / `3b` / `8`) as well as the bare numbers, plus
`all`. `unstale` clears a STALE flag after a stage is genuinely re-authored (`--stage <name>` or `--all`).
`install` writes the committed `.claude/settings.json` that registers the §13 hooks.

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
9. `00-raw/` immutable; new answers → `00-raw/clarifications-<n>.md`; logs append-only.
