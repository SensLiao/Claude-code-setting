# L12 Discoverability — Architecture Reference

> Authority: CANONICALS.md (2026-05-25)
> Cross-references: [CLAUDE.md §7](../CLAUDE.md) | [SKILLS-INDEX.md](../SKILLS-INDEX.md) | [ORCHESTRATOR-MAP.md](ORCHESTRATOR-MAP.md) | [HANDOFFS.md](HANDOFFS.md) | [rules/discoverability-l12.md](../rules/discoverability-l12.md)
> Last reviewed: 2026-05-25 (harness v1.2)

This document describes the L12 Discoverability sub-architecture: what it is, why it lives under UIUX (not as a 6th primary orchestrator), its 4-narrow + 3-agent + 5-hook + SDK shape, and its boundaries with adjacent subsystems.

---

## 1. What is L12

**L12 Discoverability** is the UIUX-downstream release readiness gate for "post-launch discoverability" — i.e., once your product ships, can the world actually find it?

Scope:
- **Web SEO** — standard Google/Bing search visibility
- **Web AEO / GEO** (Generative Engine Optimization) — AI search engines (ChatGPT Search, Claude Search, Perplexity, Gemini, etc.)
- **Local SEO** — Google Business Profile, Maps, local pack, NAP consistency (renamed from `web-geo` to `web-local-seo` on 2026-05-25 to avoid confusion with the AI-search "GEO")
- **App ASO** — App Store Connect / Google Play store listings, metadata, screenshots, ratings, reviews, PPO experiments

L12 is the **L12 layer** in the 13-Layer UIUX skill stack (see SKILLS-INDEX.md). It runs after design, after build, after QA — at release time.

**Entry point**: `discoverability-orchestrator`

---

## 2. Why L12 is NOT a 6th primary orchestrator

L12 has 4 narrow skills, 3 named agents, 5 hooks, a deterministic SDK, and tag-scoped evidence — same shape as a primary orchestrator. Why isn't it primary?

| Trait | Primary orchestrator | L12 discoverability |
|---|---|---|
| Activation | Direct from user request | Dispatched by UIUX at release time |
| Mainline status | Owns a top-level concern (PM / UI / QA / AppSec) | Sub-concern within UIUX (post-launch findability) |
| Trigger phrases | Domain-defining ("design", "test", "security", "API") | Release-readiness specific ("discoverability", "AI search", "found by Google") |
| Workflow ownership | Drives full lifecycle of its domain | Single gate (audit + report + escalate) |
| Hand-off depth | Receives + emits across mainlines | Receives from UIUX, escalates to AppSec on edge cases |

L12 is the **release-readiness gate** for UIUX, comparable to:
- `dast-baseline-scanning` for AppSec (a deterministic gate, not a co-equal main-line)
- `qa-evidence-bundle` for QA (an evidence-aggregation gate, not co-equal)

If L12 were a 6th main-line, you'd have to reason about it during phase planning, which violates the "UIUX owns design through release" mental model.

> See [ORCHESTRATOR-MAP.md §1.1](ORCHESTRATOR-MAP.md#11-the-3-mainline-mental-model) for the canonical mental model.

---

## 3. Architecture — 4 narrow + 3 agents + 5 hooks + SDK

### 3.1 4 narrow skills

| Skill | Domain | Storefront / Surface | Trigger phrases |
|---|---|---|---|
| `web-seo` | Standard search | Google / Bing | "SEO / robots.txt / sitemap / canonical / structured data / Lighthouse / Search Console" |
| `web-aeo` | AI search / answer engines | ChatGPT / Claude / Perplexity / Gemini | "AEO / GEO (Generative Engine Optimization) / llms.txt / citability / answer engine" |
| `web-local-seo` | Local Search (renamed from `web-geo`) | Google Business Profile / Maps / Apple Maps | "Local SEO / GBP / Maps / NAP / near me / 附近 / 本地服务 / 实体店" |
| `app-aso` | App stores | App Store Connect / Google Play | "ASO / app store / store listing / product page / screenshots / app keywords" |

These skills are **all in the safety-critical name freeze list** (CANONICALS.md §4). Renaming = breaks routing tables in the orchestrator and SDK.

### 3.2 3 named agents

| Agent | Role | Step in workflow |
|---|---|---|
| `disc-scope-classifier` | Classify project type → determine which channels are activated | Step 1 (after config load) |
| `disc-evidence-validator` | Validate evidence JSONs against schema + freshness window | Step 5 (after narrow-skill dispatch) |
| `disc-remediation-planner` | Translate findings into prioritized remediation actions | Step 6 (post-validation) |

All three agents are in the safety-critical name freeze list (CANONICALS.md §4).

### 3.3 5 project-installed hooks

Located at `templates/discoverability/hooks/`, copied into `<project>/.claude/hooks/` by `python -m discoverability_sdk init`:

| Hook | When | Purpose |
|---|---|---|
| `disc-session-context.js` | SessionStart | Inject L12 config status into session context |
| `disc-deploy-gate.js` | PreToolUse (deploy commands) | Block deploy if gate-result.yaml = FAIL |
| `disc-evidence-required.js` | PreToolUse (release commands) | Require fresh evidence before release |
| `disc-mark-stale.js` | PostToolUse (file edits to robots / sitemap / metadata) | Mark related evidence as STALE |
| `disc-robots-sitemap-guard.js` | PreToolUse (Edit to robots.txt / sitemap.xml / llms.txt) | Warn on policy-changing edits |

All 5 hooks are in the safety-critical name freeze list (CANONICALS.md §4). Per CANONICALS.md D3, these are **project-installed only** — fresh projects without `discoverability-sdk init` have no L12 hook enforcement.

### 3.4 SDK — `discoverability-sdk.py`

Location: `~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py`

10 commands (all in the safety-critical name freeze list per CANONICALS.md §4):

| Command | Purpose |
|---|---|
| `init` | Bootstrap L12 in a project (config + hooks + .gitignore + CI workflow) |
| `classify` | Run scope-classifier agent + emit `00-activation.json` |
| `audit` | Run all activated narrow skills via dispatched runners |
| `evidence.append` | Atomically append a narrow-skill evidence file |
| `evidence.validate` | Run validator agent over `evidence/discoverability/<tag>/` |
| `gate.check` | Apply quality_gates thresholds + emit `gate-result.yaml` |
| `report` | Render evidence to md / json / pdf |
| `mark-stale` | Mark evidence as STALE (manual override + auto via hook) |
| `explain` | AI-readable narrative of evidence (only place AI synthesis is allowed) |
| `status` | Quick "what's activated, what's fresh, what's blocking" digest |

---

## 4. Script-first / AI-last execution principle

L12 enforces a deterministic evidence pipeline. The rationale: SEO/AEO/Local/ASO data is verifiable and structured — there is no excuse for letting an LLM "vibe-audit" a robots.txt.

### 4.1 Execution priority (highest → lowest)

1. **Deterministic script / API / CLI** — Lighthouse CLI, `curl https://example.com/robots.txt`, App Store Connect API, Search Console API
2. **Framework adapter** — Next.js / Nuxt / Astro / Docusaurus / WordPress sitemap and metadata extractors
3. **Structured evidence parser** — JSON-LD, schema.org, App Privacy form, llms.txt
4. **AI synthesis from evidence** — the `explain` SDK command transforms evidence-already-collected into prioritized narrative
5. **Manual AI scan** — fallback only when no script / API / adapter exists; must be flagged with `confidence: low` in evidence

### 4.2 Forbidden anti-patterns

- ❌ Asking an LLM "how is my SEO?" without first running the script-based audit
- ❌ Using AI to interpret raw HTML for metadata that has a JSON-LD or meta-tag answer
- ❌ Letting AI "judge" sitemap freshness when `curl` + date math gives a deterministic answer

---

## 5. Evidence layout v1.2 — tag-scoped (canonical)

Per CANONICALS.md CL2, the **v1.2 canonical evidence layout** is tag-scoped:

```
<project-root>/
└── evidence/
    └── discoverability/
        └── <tag>/                        # tag = release tag, commit SHA, or env-stamp (e.g. "v1.2.3" or "preview-abc1234")
            ├── 00-activation.json        # from disc-scope-classifier agent
            ├── seo.json                  # from web-seo narrow skill
            ├── ai-search.json            # from web-aeo narrow skill (NOTE: NOT aeo.json)
            ├── local.json                # from web-local-seo narrow skill (NOTE: NOT geo.json)
            ├── aso.json                  # from app-aso narrow skill
            └── gate-result.yaml          # from `discoverability-sdk gate.check` (NOTE: YAML, NOT JSON)
```

### 5.1 Forbidden in paths (per CANONICALS.md CL2)

- ❌ Flat `evidence/discoverability/<channel>/` (legacy v1.1) — must be nested under `<tag>/`
- ❌ `<domain>` placeholder — use real tag
- ❌ `gate-result.json` — must be `.yaml`
- ❌ `aeo.json` filename — must be `ai-search.json`
- ❌ `geo.json` filename — must be `local.json`

### 5.2 GEO disambiguation in paths

The string `geo` is allowed **only** as a config-input alias key in `discoverability.config.yaml channels` for back-compat with v1.1 configs. It is **forbidden** in evidence file paths. See §8 below for full disambiguation.

### 5.3 Why tag-scoped

- **Audit trail**: evidence per release tag is immutable and traceable
- **Comparison**: diff `<tag-a>/` vs `<tag-b>/` to see what changed
- **Freshness**: STALE detection is per-tag (latest tag's evidence is canonical)
- **Multi-env**: preview vs staging vs prod each get their own tag namespace

---

## 6. Gate decisions

Per CANONICALS.md §3 gate decision vocabulary:

| Decision | Release | Meaning in L12 |
|---|---|---|
| `PASS` | allowed | All activated channels pass + no blocker findings + evidence fresh |
| `WARN` | allowed (with bundle) | No blockers; one or more warn-level findings (e.g. Lighthouse SEO 0.88 < 0.90) — must be visible in release evidence bundle |
| `CONDITIONAL_PASS` | allowed only with risk acceptance | Blocker exists but waived with explicit `risk_acceptance_ref` in `gate-result.yaml` |
| `FAIL` | blocked | One or more blockers (e.g. critical public page has unintended noindex, NAP inconsistency on home/contact) |
| `BLOCKED` | blocked | Evidence missing or process not completed (e.g. `audit` never ran on this tag) |
| `STALE` | blocked | Evidence exists but freshness window exceeded (default 24h; override via `discoverability.config.yaml harness.evidence_freshness_hours`) — re-run `audit` |
| `STRATEGY_READY` | n/a | Used by plan-time strategy outputs (not L12 release gate) — included for vocabulary completeness |

Hook `disc-deploy-gate.js` reads `gate-result.yaml` and blocks deploy if decision is `FAIL` / `BLOCKED` / `STALE`. `CONDITIONAL_PASS` requires non-empty `risk_acceptance_ref`.

---

## 7. Handoffs

See [HANDOFFS.md](HANDOFFS.md) for payload schemas. L12-relevant handoffs:

### 7.1 Incoming: UIUX → L12 (`uiux_to_l12`)

**Trigger**: A UIUX phase ships public surface (web page / docs site / store listing / marketing site).

**Payload fields** (schema ref `schemas/handoff.schema.yaml#/uiux_to_l12`):
- `surface_type`: `web` / `docs` / `app_store_listing` / `marketing_site`
- `release_tag`: stable tag string used to scope evidence
- `urls`: array of canonical URLs (or store URLs)
- `project_type`: matches `discoverability-orchestrator/project-types.yaml`
- `has_physical_presence`: bool (gates `web-local-seo` activation)

### 7.2 Outgoing escalation: L12 → AppSec (`l12_to_appsec_escalation`)

**Trigger**: L12 finds that **private content has been leaked to a crawler** — i.e., a robots.txt mis-rule, accidentally-public draft route, or sitemap entry that exposes data the access control layer should have hidden.

**Important boundary**: robots.txt / noindex / llms.txt are **crawler policy**, **not access control**. If L12 detects a leak, it is an AppSec problem — L12 does NOT implement the access control fix. The escalation hands off to `appsec-security-orchestrator`, which routes to `security-app-multitenant` or `security-platform-iac-cloud` depending on root cause.

**Payload fields** (schema ref `schemas/handoff.schema.yaml#/l12_to_appsec_escalation`):
- `leak_type`: `noindex_misconfig_with_authenticated_route` / `sitemap_exposed_draft` / `llms_txt_exposes_private_url` / `robots_txt_hints_internal_path`
- `affected_urls`: array
- `discovered_by`: which narrow skill found it (`web-seo` / `web-aeo`)
- `evidence_ref`: path into the relevant evidence JSON
- `severity`: `blocker` / `warn` (severity mapping below)

### 7.3 Outbound (back to UIUX)

L12 emits its `gate-result.yaml` for UIUX (and GSD via UIUX) to consume. No explicit handoff schema needed — UIUX reads the gate result directly.

---

## 8. GEO disambiguation (CANONICALS.md CL3)

The string "GEO" has two meanings in this ecosystem. The canonical decisions:

| Term | Meaning | Routes to |
|---|---|---|
| **GEO** = Generative Engine Optimization | AI search (ChatGPT / Claude / Perplexity / Gemini) | `web-aeo` |
| **Local SEO** | Google Business Profile / Maps / local pack | `web-local-seo` (renamed 2026-05-25 from `web-geo`) |

### 8.1 Rationale for the rename

The industry uses "GEO" inconsistently:
- Some treat GEO = Generative Engine Optimization (AI search), making it a synonym for AEO
- Others treat GEO = Geographic Engine Optimization (Local SEO)

Within this harness, **GEO unambiguously means Generative Engine Optimization → web-aeo**. The skill formerly called `web-geo` (which actually meant Local SEO) was renamed to `web-local-seo` to eliminate the collision.

### 8.2 Evidence path implications

- ❌ NEVER use `geo.json` in evidence paths (banned per CANONICALS.md CL2)
- ❌ NEVER use `aeo.json` in evidence paths (banned per CANONICALS.md CL2)
- ✅ Use `ai-search.json` for AEO/GEO output
- ✅ Use `local.json` for Local SEO output
- ✅ `geo` allowed as config-input alias key only (`channels: { geo: ... }` mapped internally to `local`)

### 8.3 Trigger phrase routing

| User says | Routes to |
|---|---|
| "AEO" | `web-aeo` |
| "GEO" (alone) | `web-aeo` (Generative Engine Optimization) |
| "GEO" + "AI search" | `web-aeo` |
| "GEO" + "Maps" or "near me" or "本地" | `web-local-seo` (override based on Local SEO context cues) |
| "Local SEO" | `web-local-seo` |
| "Google Business Profile" / "GBP" | `web-local-seo` |
| "discoverability" / "可发现性" (general) | `discoverability-orchestrator` |

---

## 9. Hook scope (CANONICALS.md D3)

L12 hooks are **project-installed only**. They live in `~/.claude/templates/discoverability/hooks/` as source-of-truth, and are copied into `<project>/.claude/hooks/` by `python -m discoverability_sdk init`.

**Implication**: a fresh project without running `discoverability-sdk init` has **no L12 hook enforcement**. The skills still exist and can be invoked, but the PreToolUse / PostToolUse / SessionStart gates do not fire automatically.

This matches the design pattern documented in [ORCHESTRATOR-MAP.md §6](ORCHESTRATOR-MAP.md#6-hook-scope-clarification-canonicalsmd-d3) — only GSD hooks are globally registered; AppSec / QA / UIUX / L12 are all opt-in per project.

### 9.1 settings.json snippet

The 5 hook registrations live in `~/.claude/templates/discoverability/settings-snippet.json`. `discoverability-sdk init` merges this snippet into `<project>/.claude/settings.json`.

### 9.2 Manual install (no SDK)

If the SDK is unavailable, a user can manually:
1. Copy hooks from `~/.claude/templates/discoverability/hooks/` to `<project>/.claude/hooks/`
2. Merge `settings-snippet.json` into `<project>/.claude/settings.json`
3. Create `<project>/discoverability.config.yaml` from `~/.claude/templates/discoverability/discoverability.config.yaml`

---

## 10. Safety-critical name freeze (CANONICALS.md §4)

The following names are **frozen**. Renaming any of them breaks the control surface — routing tables, SDK registries, and hook bindings will silently desync.

**Skills** (5):
- `discoverability-orchestrator`
- `web-seo`
- `web-aeo`
- `web-local-seo`
- `app-aso`

**Agents** (3):
- `disc-scope-classifier`
- `disc-evidence-validator`
- `disc-remediation-planner`

**Hooks** (5):
- `disc-deploy-gate.js`
- `disc-evidence-required.js`
- `disc-mark-stale.js`
- `disc-robots-sitemap-guard.js`
- `disc-session-context.js`

**SDK commands** (10):
- `init`, `classify`, `audit`, `evidence.append`, `evidence.validate`, `gate.check`, `report`, `mark-stale`, `explain`, `status`

Test harness (`tests/harness/test:safety-name-freeze`) asserts every name in this list exists verbatim. Renaming a name without updating the freeze list AND the routing tables AND the test fixtures will fail loudly.

---

## 11. Anti-patterns (L12-specific)

- ❌ Treating robots.txt / noindex / llms.txt as access control — they are crawler policy; access control is AppSec's domain
- ❌ Letting AI "audit" a sitemap without first running `curl + xmllint`
- ❌ Using `evidence/discoverability/<channel>/` flat layout (v1.1 legacy — banned per CANONICALS.md CL2)
- ❌ Naming evidence files `aeo.json` or `geo.json` (banned per CANONICALS.md CL2)
- ❌ Emitting `gate-result.json` instead of `gate-result.yaml` (banned per CANONICALS.md CL2)
- ❌ Treating L12 as a 6th primary orchestrator — it is a UIUX-downstream gate
- ❌ Skipping L12 for "internal tools" — if there's a public surface, L12 applies (escalation path is what handles internal-leak detection)
- ❌ Mixing GEO (Generative Engine Optimization) and Local SEO without disambiguation
- ❌ Auto-fixing private-content-in-sitemap by editing robots.txt — escalate to AppSec instead (the leak is a symptom of an access control failure)

---

## 12. Cross-references

| Doc / file | Purpose |
|---|---|
| [CLAUDE.md §7](../CLAUDE.md) | L12 short section in operating charter |
| [docs/ORCHESTRATOR-MAP.md](ORCHESTRATOR-MAP.md) | 5 primary orchestrator architecture; L12 is downstream of UIUX |
| [docs/HANDOFFS.md](HANDOFFS.md) | Cross-orchestrator payload schemas including `uiux_to_l12` + `l12_to_appsec_escalation` |
| [docs/CANONICALS.md](CANONICALS.md) | Authority for CL2 (path layout) + CL3 (GEO disambiguation) + name freeze |
| [rules/discoverability-l12.md](../rules/discoverability-l12.md) | Path-scoped rules and script-first enforcement |
| [SKILLS-INDEX.md](../SKILLS-INDEX.md) | L12 narrow-skill table and trigger phrase disambiguation |
| [skills/discoverability-orchestrator/SKILL.md](../skills/discoverability-orchestrator/SKILL.md) | Source of truth for orchestrator workflow (§10 self-dispatch steps) |
| [templates/discoverability/harness-contract.md](../templates/discoverability/harness-contract.md) | Ground-truth contract between SDK / agents / hooks / orchestrator |
| [templates/discoverability/runner-skeleton/README.md](../templates/discoverability/runner-skeleton/README.md) | Project runner skeleton (currently flagged v1.1 deprecated; v1.2 contract is in harness-contract.md) |
| [skills/discoverability-orchestrator/scripts/discoverability-sdk.py](../skills/discoverability-orchestrator/scripts/discoverability-sdk.py) | Deterministic SDK (10 commands) |
