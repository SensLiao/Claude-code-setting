# Orchestrator Map

> Authority: CANONICALS.md (2026-05-25)
> Cross-references: [CLAUDE.md](../CLAUDE.md) §1 + §3 | [SKILLS-INDEX.md](../SKILLS-INDEX.md) | [L12-DISCOVERABILITY.md](L12-DISCOVERABILITY.md) | [HANDOFFS.md](HANDOFFS.md)
> Last reviewed: 2026-06-10 (was 2026-05-25 v4). 2026-06-10 refresh: AppSec sub-skill table → 16 skills (+security-app-api / security-platform-supply-chain / security-compliance-privacy); removed all dead `templates/<sub>/hooks/` + `settings.json.snippet` path descriptions (hook enumeration/triggers/install now point to `manifests/hook-registry.json` + `orchestrator-runtime/shared/install-subsystem-hooks.js`, per-family counts no longer hardcoded); route count aligned to SKILLS-INDEX 20-Route.

This document is the architectural reference for the 5 primary orchestrators and the L12 downstream gate. Use it to decide which entry point to call for a given task and to understand the boundaries between subsystems.

---

## 1. Overview

The harness is organized around **five primary orchestrators** plus **one downstream release gate** (L12 Discoverability). Three of the primary orchestrators map to "mainline" delivery work, and two are setup/safety bookends.

### 1.1 The 3-mainline mental model

```
Project setup ──► PM delivery ──┬──► UIUX main-line ──► L12 release gate
                                ├──► QA main-line
                                └──► AppSec main-line
```

- **Project setup** runs once per project (manual-first bootstrap).
- **PM delivery (GSD)** is the spine — every non-trivial task enters here.
- **UIUX / QA / AppSec** are co-equal main-lines fanning out from GSD per phase.
- **L12 Discoverability** is a UIUX-downstream release readiness gate, not a separate main-line.

### 1.2 At-a-glance table

| # | Orchestrator | Role | Activation | Evidence sink | Hook scope |
|---|---|---|---|---|---|
| 1 | `claude-env-bootstrap` | Project setup | manual-first (disable-model-invocation: true) | `.claude/` install report | n/a (one-shot) |
| 2 | `gsd-pipeline-orchestrator` | PM delivery main-line | auto | `.planning/` | global (GSD hooks always on) |
| 3 | `uiux-product-orchestrator` | UIUX main-line | auto | `.planning/<phase>/ui/` | project-installed (uiux-sdk init) |
| 4 | `enterprise-qa-testing` | QA main-line | auto | `.qa/` | project-installed (qa-sdk init) |
| 5 | `appsec-security-orchestrator` v3.0 | AppSec main-line | auto when triggers | `.appsec/evidence/<tag>/` | project-installed (appsec-sdk init) |
| — | `discoverability-orchestrator` | L12 release gate (UIUX-downstream) | auto when public surface present | `evidence/discoverability/<tag>/` | project-installed (discoverability-sdk init) |

> **Convention** — "Primary" means the entry point a user calls directly. "Downstream gate" means the entry point another orchestrator calls as a release-readiness child, not a top-level invocation.

---

## 2. Per-orchestrator detail

### 2.1 `claude-env-bootstrap` — project setup

| Field | Value |
|---|---|
| Layer | Bootstrap (pre-mainline) |
| Activation | **manual-first** — `disable-model-invocation: true` |
| Trigger phrases | "init / bootstrap / 装环境 / 装一下 .claude" |
| Owns | One-time install of `.claude/`, settings.json.snippet merging, SDK init dispatching |
| Hook footprint | None (runs as user-invoked slash command) |
| Evidence | Install transcript (stdout only) |

**Why manual-first:** automated install would mutate user-trusted config without consent. The SessionStart hook (`detect-bootstrap-needed.js`) only **prompts once** — the actual install requires explicit `/claude-env-bootstrap` invocation.

**Hand-off**: emits `bootstrap_complete` → GSD picks up on next phase.

---

### 2.2 `gsd-pipeline-orchestrator` — PM delivery main-line

| Field | Value |
|---|---|
| Layer | Spine / main-line |
| Activation | **auto** — fires for any non-trivial work (new project / new phase / cross-module / continue / milestone boundary) |
| Trigger phrases | "开新项目 / 开新 phase / 新功能 / 跨模块改造 / continue 上次 GSD / how should I run GSD on X" |
| Owns | `.planning/` source of truth, phase classification, Tier 1-4 command sequence, agent-team orchestration (single / parallel fan-out / GAN / santa-loop / convergence) |
| Hook footprint | **Global** — GSD hooks are always loaded from `~/.claude/settings.json` regardless of project |
| Evidence | `.planning/<milestone>/<phase>/` artifacts (PLAN.md / SPEC.md / UI-SPEC.md / AI-SPEC.md / PR-BODY.md / etc.) |

**Why this is the spine:** GSD owns the workflow state machine — phases, plans, audits, milestones. UIUX / QA / AppSec are capabilities that GSD dispatches **into**, not orchestrators that replace GSD.

**Hand-off matrix** (see [HANDOFFS.md](HANDOFFS.md) for payload schemas):

| Outbound to | Trigger | Payload |
|---|---|---|
| `uiux-product-orchestrator` | phase has UI surface (gsd-spec-phase WHAT = UI) | `gsd_to_uiux` |
| `enterprise-qa-testing` | phase reaches verify/ship stage | `gsd_to_qa` |
| `appsec-security-orchestrator` | phase touches backend/API/auth/user-data/payment/file-upload/admin | `gsd_to_appsec` |
| `discoverability-orchestrator` | phase ships public surface (web/docs/store listing) — indirect via UIUX | `uiux_to_l12` |

---

### 2.3 `uiux-product-orchestrator` — UIUX main-line

| Field | Value |
|---|---|
| Layer | Mainline |
| Activation | **auto** — UI/UX design / visual / style / reference / audit UI work |
| Trigger phrases | "UI / UX design / visual / style / reference / audit UI / 前端设计 / 给我做个页面" |
| Owns | 13-layer skill routing (L0 foundation → L12 discoverability), L3 style lock (mutually exclusive: taste / luxury / brutalist; taste includes §11 variant modes A/B/C), workflow vs collection skill discipline |
| Hook footprint | **Project-installed only** — hook enumeration / triggers / install are sourced from `manifests/hook-registry.json` + `orchestrator-runtime/shared/install-subsystem-hooks.js` (single source of truth; per-family counts are not written down in docs) |
| Evidence | `.planning/<phase>/ui/` design artifacts |

**Why project-installed hooks:** UIUX enforcement applies only when the project has actual UI surface. A pure backend project has no UI gate to enforce — installing UIUX hooks globally would create noise.

**Downstream release gate:** when a UIUX phase ships public surface, the orchestrator routes to `discoverability-orchestrator` (L12) for post-launch findability. See [L12-DISCOVERABILITY.md](L12-DISCOVERABILITY.md).

**Style lock rule** (CLAUDE.md §3): exactly **one** L3 style skill may be active per phase. Collection skills (ui-ux-pro-max / ux-design@wondelai) never override narrower skills.

---

### 2.4 `enterprise-qa-testing` — QA main-line

| Field | Value |
|---|---|
| Layer | Mainline |
| Activation | **auto** — testing / QA / E2E / release readiness / CI gate |
| Trigger phrases | "测试策略 / QA / SDET / E2E / 集成测试 / visual regression / release readiness / CI 质量门禁 / 验收测试 / commercial quality / 工业级测试" |
| Owns | Layered test strategy (static / unit/TDD / component / integration / contract / E2E / visual / a11y / perf / smoke), QA-owned sub-skills, references to execution agents (tdd-guide / e2e-runner / code-reviewer) |
| Hook footprint | **Project-installed only** — hook enumeration / triggers / install are sourced from `manifests/hook-registry.json` + `orchestrator-runtime/shared/install-subsystem-hooks.js` (single source of truth; per-family counts are not written down in docs) |
| Evidence | `.qa/` release evidence bundle |

**Why project-installed hooks:** QA gates fire only when the project is past stub/prototype — early-phase code has no test surface to enforce.

**Hand-off matrix:**

| Outbound to | Trigger | Payload |
|---|---|---|
| `appsec-security-orchestrator` | security-relevant test failure (auth bypass / injection / data leak) | `qa_to_appsec` |
| `gsd-pipeline-orchestrator` (back) | release evidence bundle complete | embedded in `.qa/release-bundle.json` |

---

### 2.5 `appsec-security-orchestrator` v3.0 — AppSec main-line

| Field | Value |
|---|---|
| Layer | Mainline |
| Activation | **auto when triggers present** — backend / API / auth / user-data / file-upload / payment / admin / production + threat modeling / SAST / SCA / secrets / IaC / cloud / CSF 2.0 / incident response / recovery |
| Trigger phrases | See `manifests/skill-routing-policy.json` `appsec_defensive` |
| Owns | NIST CSF 2.0 six-function alignment (Govern / Identify / Protect / Detect / Respond / Recover), 6-layer capability routing (governance / app / platform / operations / response / compliance), ASVS 5.0 versioned identifiers |
| Hook footprint | **Project-installed only** — hook enumeration / triggers / install are sourced from `manifests/hook-registry.json` + `orchestrator-runtime/shared/install-subsystem-hooks.js` (single source of truth; per-family counts are not written down in docs) |
| Evidence | `.appsec/evidence/<tag>/` (canonical) + `.planning/security/` (deprecated alias via SDK adapter — see CANONICALS.md D2) |

**16 sub-skills** (20 AppSec-family incl. dual pentest gates + GSD adapter — matches CLAUDE.md §3) organized by the 6-layer capability map. Canonical list: `manifests/skills.manifest.json` appsec_* families + `SKILLS-INDEX.md` AppSec table:

| Layer | Sub-skills |
|---|---|
| governance | `security-governance-threat-modeling` |
| app | `security-remediation`, `dast-baseline-scanning` |
| app overlay | `security-app-mobile` / `security-app-llm` / `security-app-multitenant` / `security-app-websocket` / `security-app-file-upload` / `security-app-api` |
| platform | `security-platform-secrets` / `security-platform-iac-cloud` / `security-platform-supply-chain` |
| response | `security-response-incident-response` / `security-response-recovery` / `pentest-scope-and-roe` / `authorized-pentest-validation` |
| compliance | `security-compliance-payment` / `security-compliance-cn-data` / `security-compliance-privacy` |

**Pentest dual gate** (safety-critical, never auto-fire):

1. `pentest-scope-and-roe` — visible governance, Read-only allowed-tools; writes `templates/planning/PENTEST-ROE.md` via `pentest-scope-planner` agent (per CANONICALS.md D4)
2. `authorized-pentest-validation` — manual-only (`disable-model-invocation: true`); requires completed ROE + 11 user-visible sections + 13 internal validation fields (per CANONICALS.md D1)

**Safety-critical name freeze:** `pentest-scope-and-roe`, `authorized-pentest-validation`, `dast-baseline-scanning` — renaming any of these breaks the control surface (per CANONICALS.md §4).

---

## 3. Routing decision tree

Use this when deciding which orchestrator to invoke first.

```
                              ┌──────────────────┐
                              │ User Input       │
                              └────────┬─────────┘
                                       │
                  ┌────────────────────┼────────────────────────┐
                  │                    │                        │
                  ▼                    ▼                        ▼
        "init / bootstrap"      "non-trivial work"       "trivial 1-3 line"
                  │                    │                        │
                  ▼                    ▼                        ▼
       claude-env-bootstrap   gsd-pipeline-orchestrator    direct execute
       (manual /command)             │                     (no orchestrator)
                                     │
                ┌────────────────────┼────────────────────────┐
                │                    │                        │
                ▼                    ▼                        ▼
       phase has UI?         phase has tests?       phase touches backend?
                │                    │                        │
                ▼                    ▼                        ▼
       uiux-product-     enterprise-qa-testing    appsec-security-
       orchestrator                                orchestrator
                │
                │ (ships public surface)
                ▼
       discoverability-orchestrator
       (L12 release gate)
```

**Skip GSD when:**
- 1-3 line bug fix
- Answer-only question (read code / explain)
- User explicitly says "不用 GSD" or "skip GSD"

**Always re-enter GSD when:**
- New phase boundary
- Milestone boundary
- Multi-file refactor
- Cross-module change

---

## 4. Handoff matrix

See [HANDOFFS.md](HANDOFFS.md) for payload schemas. Summary:

| From | To | When | Payload |
|---|---|---|---|
| GSD | UIUX | phase has UI surface | `gsd_to_uiux` |
| GSD | QA | phase reaches verify | `gsd_to_qa` |
| GSD | AppSec | phase touches sensitive surface | `gsd_to_appsec` |
| UIUX | L12 | UIUX phase ships public surface | `uiux_to_l12` |
| L12 | AppSec | private content leaked to crawler | `l12_to_appsec_escalation` |
| QA | AppSec | security-relevant test failure | `qa_to_appsec` |

All handoffs MUST follow `schemas/handoff.schema.yaml` (see CANONICALS.md §5 file scope).

---

## 5. Why these are primary (vs supporting / narrow skills)

Three traits make an orchestrator "primary":

1. **Owns workflow state** — drives phases, gates releases, accumulates evidence. Narrow skills perform one task; orchestrators sequence many.
2. **Has a configured SDK** — `appsec-sdk.sh` / `qa-sdk.sh` / `uiux-sdk.sh` / `discoverability-sdk.py` ship structured commands (init / audit / gate.check / evidence.append). Narrow skills consume these; orchestrators expose them.
3. **Has project-level hooks (or global for GSD)** — enforcement is not advisory. Hooks block at PreToolUse / Stop boundaries to make evidence-driven gates non-bypassable.

Narrow skills (e.g. `web-seo`, `security-app-file-upload`, `qa-static-baseline`) own a single capability and emit findings to the orchestrator that dispatched them. They do **not** own evidence sinks or release decisions.

Workflow skills (e.g. `redesign-skill`, `image-to-code-skill`, `frontend-design-pro`) are **never** primary orchestrators — they are activity-shaped, not workflow-shaped, and must be invoked from a primary orchestrator's plan.

---

## 6. Hook scope clarification (CANONICALS.md D3)

> **Single source of truth**: hook enumeration, per-hook triggers, snippet paths, and install commands live in `manifests/hook-registry.json`; the copy + settings-merge is performed by the one shared installer `orchestrator-runtime/shared/install-subsystem-hooks.js`. Per-family hook **counts are deliberately not written here** (they drift) — read the registry.

| Subsystem | Scope | Registration |
|---|---|---|
| GSD | **Global** | `~/.claude/settings.json` always loaded |
| AppSec | **Project-installed only** | `appsec-sdk init` (enumeration + snippet path per `hook-registry.json`, installed via `install-subsystem-hooks.js`) |
| QA | **Project-installed only** | `qa-sdk init` (per `hook-registry.json`) |
| UIUX | **Project-installed only** | `uiux-sdk init` (per `hook-registry.json`) |
| L12 | **Project-installed only** | `python -m discoverability_sdk init` (per `hook-registry.json`) |

**Implication for fresh projects**: subsystem hook enforcement is opt-in via SDK init. A bare `.claude/` install has only GSD hooks firing. Docs (CLAUDE.md §3, §4, §7; SKILLS-INDEX.md; rules/security-appsec.md; rules/discoverability-l12.md) must state this explicitly to avoid the misleading reading "many hooks on disk but 0 registered = broken."

---

## 7. Anti-patterns (orchestrator-level)

- ❌ Calling a narrow skill (`web-seo`, `security-app-mobile`) directly when the work spans multiple checks — use the orchestrator instead.
- ❌ Auto-firing `claude-env-bootstrap` / `authorized-pentest-validation` from a hook or model invocation — these are user-only by design.
- ❌ Treating L12 as a 6th primary orchestrator — it is a UIUX-downstream release gate, not a sibling main-line.
- ❌ Stacking multiple L3 style skills concurrently (taste + luxury + minimalist) — exactly one per phase.
- ❌ Using collection skills (ui-ux-pro-max / ux-design@wondelai) to override narrower skills — collection skills lose by spec.
- ❌ Using workflow skills (redesign / image-to-code / frontend-design-pro / stitch) as L3 main style.
- ❌ Letting AppSec auto-run active scans — defensive auto, offensive (pentest) always manual.
- ❌ Skipping QA-to-AppSec handoff when a security-relevant test fails — handoff is mandatory per `qa_to_appsec` schema.

---

## 8. Versioning notes

- AppSec orchestrator: **v3.0** canonical (per CANONICALS.md CL1). Docs/manifests still showing v2.0 must be updated.
- L12 harness: **v1.2** canonical (per CANONICALS.md CL2) — tag-scoped evidence layout `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json` + `gate-result.yaml`.
- ROE template: **11 user-visible sections + 13 internal validation fields** dual-track (per CANONICALS.md D1).
- ROE writer: `pentest-scope-planner` agent (per CANONICALS.md D4; `doc-updater` phantom contract removed).

---

## 9. Cross-references

| Doc | Purpose |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Operating charter; §1 three-mainline; §3 orchestrator table; §7 L12 |
| [SKILLS-INDEX.md](../SKILLS-INDEX.md) | 13-Layer skill list, 20-Route UIUX pipeline (A–T), disambiguation table |
| [docs/L12-DISCOVERABILITY.md](L12-DISCOVERABILITY.md) | L12 sub-architecture: 4 narrow skills + 3 agents + 5 hooks + SDK |
| [docs/HANDOFFS.md](HANDOFFS.md) | Cross-orchestrator payload schemas |
| [docs/CANONICALS.md](CANONICALS.md) | Canonical decisions registry (read-only after 2026-05-25) |
| [rules/security-appsec.md](../rules/security-appsec.md) | AppSec path-scoped detail |
| [rules/discoverability-l12.md](../rules/discoverability-l12.md) | L12 path-scoped detail |
| [manifests/skill-routing-policy.json](../manifests/skill-routing-policy.json) | Machine-readable activation rules |
| [manifests/skills.manifest.json](../manifests/skills.manifest.json) | Machine-readable skill registry |
