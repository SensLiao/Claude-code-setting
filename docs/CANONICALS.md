# Canonical Decisions Registry

> Authority: User explicit sign-off after 5-subagent audit phase
> Date: 2026-05-25
> Purpose: Single source of truth for harness drift normalization (PR-0 through PR-6)
> Wave 2/3 subagents MUST read this file before applying edits

---

## 1. Four User-Approved Decisions (2026-05-25)

### D1 — ROE Item Count: DOC DUAL-TRACK

**Decision**: 11 user-visible sections + 13 internal validation fields

**Implementation**:
- `templates/planning/PENTEST-ROE.md` keeps **11 numbered sections** (unchanged)
- `agents/pentest-scope-planner.md` keeps **11-item checklist** (unchanged)
- `skills/pentest-scope-and-roe/SKILL.md` keeps **11-item structure** (unchanged)
- `skills/appsec-security-orchestrator/SKILL.md` §20.7 keeps **13 internal validation fields** (unchanged)
- `skills/authorized-pentest-validation/SKILL.md` keeps 11-item reference (unchanged)
- `agents/authorized-pentest-validator.md` keeps 11-item reference (unchanged)
- **CLAUDE.md / SKILLS-INDEX.md** must update language to:
  `"11 user-visible sections (validated as 13 internal fields by orchestrator v3 §20.7 — emergency_contact / rollback as separate fields, authorization_proof as anchor)"`
- `templates/planning/PENTEST-ROE.md` adds a top-of-file note explaining the dual-track

### D2 — Evidence Path: SDK ADAPTER

**Decision**: `.appsec/evidence/<tag>/` canonical; `.planning/security/` deprecated alias via SDK adapter

**Implementation**:
- `scripts/appsec-sdk.sh` adds `--legacy-path .planning/security/` flag and/or `migrate-evidence` subcommand
- `agents/appsec-evidence-validator.md` (small body edit): note that validator scans both paths, prefers `.appsec/`
- `agents/appsec-finding-triager.md` (small body edit): same
- **5 child skill SKILL.md bodies UNCHANGED**:
  - `security-platform-secrets`
  - `security-platform-iac-cloud`
  - `security-compliance-payment`
  - `security-response-incident-response`
  - `security-response-recovery`
- Docs note: `.appsec/` is canonical, `.planning/security/` kept for back-compat; migration via `appsec-sdk migrate-evidence`

### D3 — Hook Scope: PROJECT-INSTALLED + CLARIFY DOCS

**Decision**: Subsystem hooks remain project-installed-only; docs must explicitly state this

**Implementation**:
- All 20 subsystem hooks (AppSec 7, QA 5, UIUX 3, L12 5) stay registered in their respective `templates/.../settings.json.snippet` only
- GSD hooks stay globally registered (no change)
- `CLAUDE.md` §3 + §4 + §7 explicitly add:
  `"Subsystem hooks are config-gated, available via per-project install (appsec-sdk init / qa-sdk init / uiux-sdk init / python -m discoverability_sdk init). Fresh projects without the corresponding config file have NO subsystem-hook enforcement; only GSD hooks fire globally."`
- `SKILLS-INDEX.md` adds similar callout
- `rules/security-appsec.md` adds hook-scope clarification
- `rules/discoverability-l12.md` adds hook-scope clarification
- **NO change to `settings.json` or any hook file**

### D4 — ROE Writer: PROMOTE pentest-scope-planner

**Decision**: `pentest-scope-planner` agent is the canonical PENTEST-ROE.md writer; `doc-updater` phantom contract removed

**Implementation** (SURGICAL skill body edit, user explicitly approved):
- `skills/pentest-scope-and-roe/SKILL.md`:
  - Frontmatter `downstream:` field: replace `doc-updater (agent) for writing PENTEST-ROE.md` → `pentest-scope-planner (agent) for writing PENTEST-ROE.md`
  - `description` field: remove phantom doc-updater reference; mention pentest-scope-planner
  - §4.2 "path B" paragraph: update agent reference `doc-updater` → `pentest-scope-planner`
  - §6 closing note (line 255): same
- `SKILLS-INDEX.md` line 50: update row to match
- `agents/doc-updater.md`: **NO change** (it doesn't claim ROE responsibility, so no removal needed)
- `agents/pentest-scope-planner.md`: **NO change** (already has `tools: Read, Write` + Step 3 writes; this is the actual writer)

---

## 2. Audit-Derived Canonical Decisions

### CL1 — AppSec Orchestrator Version

**Canonical**: v3.0 (skill body already declares; docs/manifests catch up)

**Affected files**:
- `CLAUDE.md` §3 lines 52, 54
- `SKILLS-INDEX.md` lines 31, 37, 56, 65, 107
- `manifests/skills.manifest.json` lines 44, 46, 59
- `rules/security-appsec.md` (add version stamp)

### CL2 — L12 Evidence Path Layout

**Canonical**: v1.2 tag-scoped — `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json` + `gate-result.yaml`

**Forbidden in paths**:
- flat `evidence/discoverability/<channel>/` directories
- `<domain>` placeholder
- `gate-result.json` extension (must be `.yaml`)
- `aeo.json` filename (must be `ai-search.json`)
- `geo.json` filename (must be `local.json`)

**Affected files**:
- `rules/discoverability-l12.md` (lines 31, 142-143, 352)
- `templates/discoverability/runner-skeleton/README.md` (legacy v1.1, rewrite or mark deprecated)

### CL3 — GEO Meaning (No Rename)

**Canonical**:
- "GEO" = "Generative Engine Optimization" → routes to `web-aeo`
- "Local SEO" → routes to `web-local-seo` (renamed 2026-05-25 from web-geo)
- `geo` allowed only as config-input alias key in `discoverability.config.yaml channels`; never in evidence paths

### CL4 — appsec-risk-classifier Output Format

**Canonical**: JSON (per agent body §Output Contract v3.0 P7 patch — most recent)

**Affected lines in `agents/appsec-risk-classifier.md`**:
- L3 description: `Output is structured YAML only.` → `Output is structured JSON only.`
- L117 Hard Rules: `Do NOT output anything other than the YAML document. ... orchestrator parses stdout as YAML.` → `Do NOT output anything other than the JSON document. ... orchestrator parses stdout as JSON.`
- L77, L83 body block: KEEP as-is (canonical)

---

## 3. Gate Decision Vocabulary (Canonical)

All harness gates use this enum:

| Decision | Release | Meaning |
|---|---|---|
| `PASS` | allowed | clean pass |
| `WARN` | allowed | must be in evidence bundle |
| `CONDITIONAL_PASS` | allowed only | with explicit risk acceptance reference |
| `FAIL` | blocked | release blocked |
| `BLOCKED` | blocked | evidence/process missing |
| `STALE` | blocked | evidence outdated, re-run required |
| `STRATEGY_READY` | n/a | plan/design phase only (not release decision) |

Source of truth = `schemas/gate-decision.schema.yaml` (human) mirrored by `schemas/gate-decision.schema.json` (the file `verdict-validator.js` actually loads). **Drift guard (2026-06-05):** `schemas/check-gate-decision-parity.js` (dependency-free; run in CI / before release; exit 1 = drift) compares the load-bearing invariants (enum / required / property keys / additionalProperties / provenance shape / x-release-semantics). First run caught a real drift — see §6 #11.

---

## 4. Safety-Critical Name Freeze List

Renaming any of these = breaking control surface. Test harness will fail loudly.

**AppSec safety gates**:
- `pentest-scope-and-roe`
- `authorized-pentest-validation`
- `dast-baseline-scanning`

**L12 skills**:
- `discoverability-orchestrator`
- `web-seo`
- `web-aeo`
- `web-local-seo`
- `app-aso`

**L12 agents**:
- `disc-scope-classifier`
- `disc-evidence-validator`
- `disc-remediation-planner`

**L12 hooks**:
- `disc-deploy-gate.js`
- `disc-evidence-required.js`
- `disc-mark-stale.js`
- `disc-robots-sitemap-guard.js`
- `disc-session-context.js`

**L12 SDK commands**:
- `init`, `classify`, `audit`, `evidence.append`, `evidence.validate`, `gate.check`, `report`, `mark-stale`, `explain`, `status`

---

## 5. File Scope (Permitted vs Forbidden)

### Permitted to change (Wave 2 subagents work here)
- `CLAUDE.md`
- `SKILLS-INDEX.md`
- `manifests/**/*.json` (including new `harness.registry.json`, `hook-registry.json`)
- `rules/**/*.md`
- `docs/**/*.md` (folder created in PR-0)
- `schemas/**/*.{yaml,json}` (folder created in PR-0)
- `templates/**/*.md` (but NOT placeholder SKILL.md inside templates)
- `tests/**`
- `tools/hooks/lint.js` NEW
- `tools/docs-drift/lint.js` NEW
- `scripts/appsec-sdk.sh` (for D2 SDK adapter)
- `package.json` (add test scripts)

### Permitted with surgical/agent exception
- `skills/pentest-scope-and-roe/SKILL.md` — ONLY frontmatter + §4.2 paragraph + §6 note (per D4)
- `agents/appsec-risk-classifier.md` — ONLY L3 description + L117 hard rules (per CL4)
- `agents/appsec-evidence-validator.md` — ONLY add legacy-path scan note (per D2)
- `agents/appsec-finding-triager.md` — ONLY add legacy-path scan note (per D2)

### NOT permitted (under any circumstances)
- Any other `skills/**/SKILL.md` (skill bodies)
- Any other `agents/**/*.md`
- Any `hooks/**` file
- `settings.json`
- `skills/**/references/**`
- `skills/**/scripts/**` (except `scripts/appsec-sdk.sh` which is shared)
- `skills/**/templates/**`

---

## 6. Audit-Confirmed Drift Inventory

P0/P1 issues verified by 5-subagent audit (2026-05-25):

1. **AppSec v2/v3 drift** across 7+ files (skill body v3, docs/manifests v2)
2. **`.appsec/` vs `.planning/security/`** across 5 child skills + 2 test fixtures
3. **ROE 11/13 contradiction** across 8+ files
4. **`appsec-risk-classifier` YAML/JSON** triangulated conflict (description vs body vs hard rules)
5. **20 subsystem hooks on disk, 0 globally registered** (by design, but docs misleading)
6. **ROE writer phantom contract** (doc-updater declared but unrealized; pentest-scope-planner de facto writer)
7. **L12 path split-brain** across orchestrator SKILL ASCII tree + 4 narrow skills + rules/discoverability-l12.md + runner-skeleton README
8. **`docs/ORCHESTRATOR-MAP.md` + `docs/L12-DISCOVERABILITY.md`** referenced but missing
9. **Registry incomplete**: L12 0/13, QA ~7%, UIUX ~25%, AppSec ~50% declaration coverage
10. **No root test runner** (`package.json` = `{"type":"commonjs"}`, no scripts)
11. **gate-decision.schema JSON↔YAML drift (2026-06-05) — RESOLVED**: the JSON mirror (loaded by `verdict-validator.js`) carried a `provenance` property the YAML source lacked. Found on first run of the new `schemas/check-gate-decision-parity.js`; YAML reconciled + parity guard added (see §3).

---

## 7. Execution PR Map

| PR | Owner | Scope | Verified by |
|---|---|---|---|
| PR-0 | (this file) | CANONICALS.md + dir scaffold | Self |
| PR-1+2+4+5+A | Wave 2 agents A1-A5 | Docs/Index/Rules + Manifests + Schemas + Missing-Docs + Surgical SKILL.md + SDK adapter + agent files + test fixtures | `test:appsec-routing` + spot-checks |
| PR-6 | Wave 3 agent | tests/harness/ + package.json scripts | `pnpm test:harness` |
| PR-7 (bash dispatcher) | DEFERRED | n/a | n/a |

---

## 8. Verification Strategy

After Wave 2 + 3 complete, `pnpm test:harness` must return exit 0 (all green). Sub-tests:

- `test:manifest-versions` — assert v3 / v1.2 / 13 / 11 dual-track present in expected files
- `test:routing-json` — assert manifests parse + key fields present
- `test:hook-registry` — assert every settings.json hook command resolves + project-installed hooks match snippets
- `test:docs-drift` — assert canonical strings present, legacy strings absent
- `test:sdk-matrix` — assert SDK exports declared commands
- `test:file-existence` — assert docs/ORCHESTRATOR-MAP.md + docs/L12-DISCOVERABILITY.md exist
- `test:safety-name-freeze` — assert every name in name_freeze list exists verbatim
- `test:release-gate-smoke` — smoke each subsystem SDK init/gate.check cycle
- `test:appsec-routing-bridge` — bridges existing tests/appsec-routing/runner.sh

---

## 9. Migration Roadmap (Post-Normalization)

After harness is green:
- v1: dispatcher (PR-7) — collapse 5 Bash PreToolUse hooks into 1
- v2: managed settings (team-level enforcement)
- v3: per-team registry override
- v4: per-skill auto-upgrade migration agent

These are deferred; harness normalization (PR-0 to PR-6) is the prerequisite.
