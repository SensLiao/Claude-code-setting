# AppSec safety-critical file hashes

> Patch A.1.5 — drift detector. Purpose: trivially detect divergence between
> SKILL.md docs and actual implementation. Update on every edit of a tracked file.
>
> Hash command (Git Bash on Windows):
> ```bash
> sha256sum ~/.claude/workflows/appsec-orchestrator.js \
>   ~/.claude/hooks/appsec-preview-gate.js \
>   ~/.claude/orchestrator-runtime/shared/validate-spec.js \
>   ~/.claude/orchestrator-runtime/shared/orchestrator-spec.v1.json \
>   ~/.claude/orchestrator-runtime/appsec/ops.manifest.json \
>   ~/.claude/orchestrator-runtime/appsec/registry.json
> ```
>
> All entries below are SHA-256 (hex, lowercase). Sizes in bytes.

## Tracked files

| File | SHA-256 | Bytes | Last review | Date |
|---|---|---|---|---|
| `workflows/appsec-orchestrator.js` | `3ca5944593c0a0ccde3abce3192ed7464ee9993f3a62a4b0c82ebcf6fe53abd1` | 30333 | runtime-appsec #1/#2/#3 (fanout string-item normalize + state_summary_json persist render + seeded_state channel for incident-response). hashNode/stableStringify/djb2 UNCHANGED → resume fingerprints stable. | 2026-06-10 |
| `hooks/appsec-preview-gate.js` | `8b7a84ea10dc8b934d23614439dd00dc3b108c37aa56a7a2820d4f65d65d2c49` | 10078 | 2026-06-10 morning audit remediation (sign-off phrase fix + hardening); reconciled at round-2 final verification | 2026-06-10 |
| `orchestrator-runtime/shared/validate-spec.js` | `32a3b7f4a7a3215aecad914fc4a3aa14b1337577679cb246c88e32f99557d09a` | 22705 | sdk-shared#1: structural fallback allow-lists now schema-derived from orchestrator-spec.v1.json (13/13 shipped presets pass fallback; strictness retained) | 2026-06-10 |
| `orchestrator-runtime/shared/orchestrator-spec.v1.json` | `a474f52a697652e503a0f8575f9e0e0327ac715bf9725d399302cd00af6fcdd6` | 15464 | 2026-06-10 morning audit remediation; reconciled at round-2 final verification | 2026-06-10 |
| `orchestrator-runtime/appsec/ops.manifest.json` | `cf0cf873fad3babbbac053c7cb555dc1177dbc9cc01d0770700b06c433602764` | 2459 | Round 3 ACCEPT | 2026-05-28 |
| `orchestrator-runtime/appsec/registry.json` | `7f31228d2761240cbd8b9f27293b84e077e315b71d5f0a125a1bbf836e3bda16` | 10153 | 2026-06-10 morning audit remediation (hook classification refresh); reconciled at round-2 final verification | 2026-06-10 |

## Drift detection workflow

1. Before any edit of a tracked file → record current hash + reason for edit
2. After edit → recompute hash + commit-style note (what changed, why)
3. If any tracked file is mutated without an updated row → the Skill SHOULD
   treat the orchestrator as "drift-suspect" and run an extra preflight check
   before relying on it for release-gate decisions

## When to bump

- Any code edit to workflow body / hook / validator
- Any structural change to spec schema or ops manifest
- Any new node type / safety surface added

The bump itself is **manual** (not automated yet). Discipline rule: every PR
that touches a tracked file MUST update this table in the same commit.
