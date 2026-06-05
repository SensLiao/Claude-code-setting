---
description: "QA workflow-spec — quick-check mode (enterprise-qa-testing §18.5). Dev-branch pre-commit self-check: Static baseline + risk-selected critical layers, fail-fast. ~5 phases, ~5-10 min, ~200-400k tokens. Not a release sign-off."
---

# /qa-quick-check

Run **`enterprise-qa-testing`** in **workflow-spec mode**, preset **`quick-check`**.

**What it does**: cheapest QA gate — Static baseline + the risk-classified critical layers, fail-fast. For dev-branch commit self-checks, NOT release sign-off. ~5 phases · ~5-10 min · ~200-400k tokens.

**Execution** — follow SKILL **§18.5 14-step Launch Contract** (REQUIRED — no step skipped):
risk classify (`qa-risk-classifier`) → pick `quick-check` preset → inline spec → `resolved_model` + `spec_hash` → preflight (`resolve-capabilities.js`) → render Execution Preview → **user approval** → `qa-sdk sentinel.write` → `Workflow({name:"qa-orchestrator", args:{spec, spec_hash, run_id, release_tag}})` → evidence persist (`qa-sdk evidence.append`) → `qa-sdk gate.check`.

**Governed Gate Mode (CLAUDE.md §3.7)**: this is a governed gate. The verdict comes ONLY from the deterministic `qa-orchestrator` + `spec_hash` approval + evidence bundle. Dynamic Workflows / ultracode may scout but MUST NOT produce the verdict — `governed-gate-workflow-guard` + `qa-preview-gate` enforce this. `spec.allow_dynamic_workflow` must be false/absent.

Invoke: type `/qa-quick-check`, or `Skill("enterprise-qa-testing")` then select `quick-check`.
