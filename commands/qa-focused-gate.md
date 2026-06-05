---
description: "QA workflow-spec — focused-qa-gate mode (enterprise-qa-testing §18.5). PR-review gate: layers fanned out by risk_snapshot over changed surfaces. ~6 phases, ~15-30 min, ~500-800k tokens."
---

# /qa-focused-gate

Run **`enterprise-qa-testing`** in **workflow-spec mode**, preset **`focused-qa-gate`**.

**What it does**: PR-review gate — selects test layers by `risk_snapshot` and fans them out over the changed surfaces. Heavier than quick-check, scoped to the diff. ~6 phases · ~15-30 min · ~500-800k tokens.

**Execution** — follow SKILL **§18.5 14-step Launch Contract** (REQUIRED — no step skipped):
risk classify (`qa-risk-classifier`) → pick `focused-qa-gate` preset → inline spec (fanout width from changed-surface count) → `resolved_model` + `spec_hash` → preflight → render Execution Preview → **user approval** → `qa-sdk sentinel.write` → `Workflow({name:"qa-orchestrator", ...})` → evidence persist → `qa-sdk gate.check`.

**Governed Gate Mode (CLAUDE.md §3.7)**: governed gate — verdict from the deterministic `qa-orchestrator` + `spec_hash` approval + evidence bundle only. Dynamic Workflows / ultracode may scout, never produce the verdict (`governed-gate-workflow-guard` + `qa-preview-gate` enforce). `spec.allow_dynamic_workflow` must be false/absent.

Invoke: type `/qa-focused-gate`, or `Skill("enterprise-qa-testing")` then select `focused-qa-gate`.
