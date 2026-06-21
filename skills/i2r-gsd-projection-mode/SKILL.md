---
name: i2r-gsd-projection-mode
description: Dual-layer projection — rigorous requirements.json to GSD-native PRD.md; documents the shape i2r.py assemble emits
when_to_use: Preloaded into i2r-orchestrator (assemble step) and i2r-completeness-critic (Reader Test Gate check); describes the PRD.md shape the assemble script deterministically emits
user-invocable: false
---

# i2r-gsd-projection-mode

Owned by: `i2r.py assemble` ($0, no LLM). Consumed by: `i2r-orchestrator` (assemble),
`i2r-completeness-critic` (Reader Test Gate — CONTRACT §11).
Output: `PRD.md` + `requirements.json` (bundle). Optionally: `decisions/ADR-*.md`.

## The dual-layer

| Layer | File | Consumer | Language |
|---|---|---|---|
| **Rigorous** | `requirements.json` | downstream tooling, validators | EARS patterns, Gherkin ACs, Volere fit_criterion |
| **GSD-native** | `PRD.md` | GSD pipeline, human PMs | Plain prose, `[CAT]-NN` IDs, prose pass/fail ACs |

`i2r.py assemble` is a deterministic Python script that reads all stage JSONs and emits both files
with zero LLM involvement. The shape documented here is what it ALWAYS emits. No agent may deviate
from this shape.

## Hard rules

- PRD.md MUST be readable standalone (Reader Test Gate, CONTRACT §11): a fresh reader given ONLY the
  PRD must be able to infer goals, scope boundary, constraints, acceptance. If not → READER_TEST_FAIL.
- WHAT/WHY only — NEVER HOW. The stack-swap test (CONTRACT §1): if swapping the DB/framework forces a
  PRD edit → HOW leaked → fix before assemble.
- No phases, roadmap, sprints, tasks, architecture, API routes, UI components, database schemas,
  file structures.
- `[CAT]-NN` IDs must match FR IDs from `04-functional.json` exactly.
- `NFR-ISOCAT-NN` IDs must match `05-nfr.json` exactly.
- Prose ACs must match `prose` fields from `06-acceptance.json` exactly (prefixed with ID).
- Locked decisions come from `00-raw/` or a recorded human decision — never fabricated.
- Open Questions section must be present; use `(none)` if all are resolved.

## References (depth lives here)

- `references/prd-shape.md` — PRD.md section order (authoritative shape)
- `references/gsd-handoff-rules.md` — GSD feed paths + what GSD does NOT want
- `references/PRD_TEMPLATE.md` — empty PRD skeleton
- `references/GOOD_PRD.md` — GOOD example anchored on good-run PRD.md
- `references/BAD_PRD.md` — PRD that leaks HOW + Reader Test failure + fixes

Sources: local GSD skill read; Anthropic doc-coauthoring (Reader Test); PM Skills templates;
product-on-purpose anchoring.

## Minimal execution flow (assemble step)

```
1. Confirm all required stage JSONs are schema-valid (i2r.py validate --stage N for each)
2. i2r.py assemble reads: 02-context, 03-scope, 04-functional, 05-nfr, 06-acceptance
3. Emits requirements.json (rigorous bundle) + PRD.md (GSD-native projection)
4. If ADR projection ON: emits decisions/ADR-*.md for each locked decision
5. i2r.py gate.check → gate-result.yaml
6. Reader Test Gate: completeness-critic receives ONLY PRD.md, infers goals / scope boundary / constraints / acceptance (CONTRACT §11)
7. gate.check records reader_test result; FAIL → BLOCKED
```
