---
description: "QA workflow-spec — commercial-cert mode (enterprise-qa-testing §18.5). Customer-visible / regulated release: adds Visual + A11y + Perf Audit→Gate. ~15 phases, ~60-120 min, ~1.5-3M tokens. MANDATORY explicit budget approval."
---

# /qa-commercial-cert

Run **`enterprise-qa-testing`** in **workflow-spec mode**, preset **`commercial-cert`** — the highest-assurance QA gate.

**What it does**: customer-visible / regulated-industry release certification. Everything in release-readiness PLUS Visual + A11y + Perf **Audit→Gate** triples (each: an agent Audit node running Playwright / Lighthouse / axe / pa11y → a deterministic Gate node emitting PASS/WARN/BLOCK by threshold policy). ~15 phases · ~60-120 min · ~1.5-3M tokens.

**⚠️ MANDATORY budget approval** (CLAUDE.md §3.6): the Execution Preview carries the banner `=== REQUIRES EXPLICIT BUDGET APPROVAL ===`. The sentinel `<project>/.qa/state/preview/<run_id>.json` MUST contain `approved_estimate_high` (positive number, tokens) AND `approval_text` matching approved / approve / 批准 / 确认 / 同意. `qa-preview-gate` blocks launch otherwise. No silent / model-self-minted approval.

**Execution** — follow SKILL **§18.5 14-step Launch Contract** (REQUIRED — no step skipped):
risk classify → pick `commercial-cert` preset → inline spec → `resolved_model` + `spec_hash` → preflight → render Execution Preview **with budget banner** → **user explicit budget approval** → `qa-sdk sentinel.write` (incl. `approved_estimate_high`) → `Workflow({name:"qa-orchestrator", ...})` → Visual/A11y/Perf Audit→Gate → full evidence bundle → `qa-sdk gate.check`.

**Governed Gate Mode (CLAUDE.md §3.7)**: governed gate — verdict from the deterministic `qa-orchestrator` + `spec_hash` approval + evidence bundle only. Dynamic Workflows / ultracode are barred from the verdict path (`governed-gate-workflow-guard` + `qa-preview-gate`). `spec.allow_dynamic_workflow` must be false/absent. ultracode does not skip the budget-approval gate.

Invoke: type `/qa-commercial-cert`, or `Skill("enterprise-qa-testing")` then select `commercial-cert`.
