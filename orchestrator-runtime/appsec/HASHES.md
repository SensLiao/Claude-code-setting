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
>   ~/.claude/orchestrator-runtime/appsec/ops.manifest.json
> ```
>
> All entries below are SHA-256 (hex, lowercase). Sizes in bytes.

## Tracked files

| File | SHA-256 | Bytes | Last review | Date |
|---|---|---|---|---|
| `workflows/appsec-orchestrator.js` | `875ab62d0c6d2e325631beebc20e19ad028437994ce3910402ba011eac7a9460` | 26158 | §1.11 #2 (pickModel + resolved_model + model_policy_version in hashNode) | 2026-05-28 |
| `hooks/appsec-preview-gate.js` | `38229f565c533544ee808d0365abdead2c0ea41b4a8f44cb35bae4a5134ce894` | 8657 | §1.11 #3 (SHA-256 spec_hash + backward-compat djb2 acceptance) | 2026-05-28 |
| `orchestrator-runtime/shared/validate-spec.js` | `132c8bc4fc335f7586028ebe352d4108af8a64e84cbc994a4e2bf167c0a8a78f` | 19188 | Cross-review Item F (versioned literal) | 2026-05-28 |
| `orchestrator-runtime/shared/orchestrator-spec.v1.json` | `548c7c7762a5566c168d0da67b97c3f8820ae46e25fea47edfe4a4abb02c6b53` | 7050 | §1.11 #2 (resolved_model + model_policy_version fields) | 2026-05-28 |
| `orchestrator-runtime/appsec/ops.manifest.json` | `cf0cf873fad3babbbac053c7cb555dc1177dbc9cc01d0770700b06c433602764` | 2459 | Round 3 ACCEPT | 2026-05-28 |
| `orchestrator-runtime/appsec/registry.json` | `fc5530bb7dcfb9ca8c495bfc620d17e4bd5b13313d8e2866c5e6e00fec8e5ac4` | 8701 | §1.11 #8 (hook classification + version triplet) | 2026-05-28 |

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
