---
description: "QA workflow-spec — release-readiness mode (enterprise-qa-testing §18.5). merge-to-main / release-branch acceptance: full evidence bundle + FlakyTriage. ~9 phases, ~30-60 min, ~800k-1.5M tokens."
---

# /qa-release-readiness

Run **`enterprise-qa-testing`** in **workflow-spec mode**, preset **`release-readiness`**.

**What it does**: merge-to-main / release-branch acceptance gate — broader layer coverage, FlakyTriage, and a complete auditable evidence bundle. ~9 phases · ~30-60 min · ~800k-1.5M tokens.

**Execution** — follow SKILL **§18.5 14-step Launch Contract** (REQUIRED — no step skipped):
risk classify (`qa-risk-classifier`) → pick `release-readiness` preset → inline spec → `resolved_model` + `spec_hash` → preflight → render Execution Preview → **user approval** → `qa-sdk sentinel.write` → `Workflow({name:"qa-orchestrator", ...})` → FlakyTriage → evidence bundle persist → `qa-sdk gate.check` (release decision).

**Governed Gate Mode (CLAUDE.md §3.7)**: governed gate — verdict from the deterministic `qa-orchestrator` + `spec_hash` approval + full evidence bundle only. Dynamic Workflows / ultracode may scout, never produce the verdict (`governed-gate-workflow-guard` + `qa-preview-gate` enforce). `spec.allow_dynamic_workflow` must be false/absent.

Invoke: type `/qa-release-readiness`, or `Skill("enterprise-qa-testing")` then select `release-readiness`.
