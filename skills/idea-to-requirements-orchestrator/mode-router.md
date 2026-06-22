# I2R Mode Router — authoring `00-mode-routing.json` (PHASE 0.5)

The router decides **how this run executes** before any authoring. It is a deliberate first step, not a
default pipeline: route first, then enter only the modes this idea needs. Validate with `i2r.py route <run>`.

## The decision (one object — schema: `schemas/00-mode-routing.schema.json`, output: `internal/stages/00-mode-routing.json`)

| Field | Decide by asking… |
|---|---|
| `idea_type` | new_product / feature / internal_tool / workflow / agent_system / refactor / unknown |
| `trigger_source` | model_auto / user_direct / parent_orchestrator / gsd_precheck |
| `requires_local_search` | Are there local docs/repos whose terminology or constraints must ground requirements? |
| `requires_external_search` | Is the domain unfamiliar, or do standards/compliance affect NFRs, or did the user reference an external tool/method? |
| `requires_discussion` | none / non_blocking / blocking — is there a boundary/actor/outcome ambiguity that would change FR/NFR/scope? |
| `requires_scope_debate` | Is downstream reinterpretation risk high (a wrong scope would poison FR/NFR)? |
| `requires_nfr_deep_dive` | Does this carry real reliability/security/perf/cost stakes needing a fuller ISO 25010 walk? |
| `requires_codex_review` | Default **true** — the santa-loop wants a cross-model Reviewer B. |
| `risk_flags` | ambiguous_actor / unclear_success_metric / domain_unknown / downstream_ai_misinterpretation_risk / … |
| `selected_modes` | the mode tokens you will enter (elicitation, scope, fr-authoring, …) |
| `excluded_modes` | `{mode, reason}` — always exclude `implementation` ("I2R boundary excludes HOW") |
| `rationale` | one paragraph: why this shape |

## Routing → required artifacts (enforced by `i2r.py mode.check` + the `i2r-mode-gate` hook)
- `requires_*search` true → `internal/stages/02b-evidence.json` MUST exist before the gate passes.
- `requires_scope_debate` true → `internal/stages/03b-scope-debate.json` MUST exist.
- `requires_discussion == blocking` → a `raw/clarifications-*.md` MUST exist.
- `requires_codex_review` true → `internal/stages/07-review.codex.json` (or the fresh-critic fallback) MUST exist.

If you flip a `requires_*` flag on, you have committed to producing the artifact — the gate will not let you
skip it. When in doubt, prefer the leaner route and let the critic escalate.

## Search is conditional, never always-on
Use search when the domain is unfamiliar, standards may affect NFRs, the user referenced an external
tool/method, or terminology needs grounding. Do **not** search when the user already supplied enough domain
context, or when search would invent scope. Search informs; it never decides scope. (See `i2r-search-mode`.)
