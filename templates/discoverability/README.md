# L12 Discoverability Harness v1.0 — Templates

> Canonical templates a commercial project copies to bootstrap the
> **"after launch, can people find it?"** layer. Together they form a
> GSD-lite execution harness: orchestrator self-dispatch + named agents +
> deterministic SDK + project-level hooks + state directory +
> gate-result.yaml + CI-consumable evidence.

L12 covers 4 independent domains that share a CLI contract + evidence schema:

| Domain | Skill | Scope |
|---|---|---|
| Web SEO | `web-seo` | Google / Bing / Baidu indexing, sitemap, robots, structured data, Core Web Vitals |
| Web AEO | `web-aeo` | ChatGPT / Claude / Perplexity / Gemini citation, llms.txt, AI crawler policy |
| Web Local SEO | `web-local-seo` | Google Business Profile / Maps / NAP / LocalBusiness schema |
| App ASO | `app-aso` | App Store + Google Play listing, screenshots, metadata, store experiments |

The orchestrator `discoverability-orchestrator` decides which of the 4 are
activated for a given `project.type` and self-dispatches the full 8-step
workflow (scope → init → audit → evidence → validate → plan → gate → handoff).

---

## What this directory is

L12 Discoverability Harness **v1.0.0** templates — project-copy assets that
together implement the harness contract defined in `harness-contract.md`.

These templates are the source of truth. When a project copies them,
customizes the config, and runs the SDK + invokes the orchestrator skill,
they get a complete L12 audit pipeline with evidence-backed release gating.

---

## File inventory

| File / dir | Purpose | Copy to project? |
|---|---|---|
| `harness-contract.md` | Ground-truth contract for SDK, agents, hooks, orchestrator. Binding. Do NOT modify per-project. | No (reference only) |
| `discoverability.config.yaml` | Canonical config schema with `harness:` block. Copy to project root, customize, commit. | Yes → `<project-root>/discoverability.config.yaml` |
| `gate-result.schema.yaml` | Reference doc — full annotated schema for `evidence/discoverability/<tag>/gate-result.yaml` + decision algorithm + hard rules. | No (reference only) |
| `state.schema.json` | Reference doc — JSON example + `_field_docs` for `.discoverability/state.json`. | No (reference only) |
| `hooks/` | 5 disc-* hook scripts + `_disc-common.js` helper. Copy entire dir to project. | Yes → `<project-root>/.claude/hooks/` |
| `hooks/README.md` | Hook install + enable instructions. | Yes (alongside hooks) |
| `settings-snippet.json` | Hook-wiring JSON to merge into project `.claude/settings.json`. | Merge into project settings |
| `runner-skeleton/` | Optional `pnpm discoverability:*` CLI scaffold (legacy v1.1 layout; v1.0 harness uses SDK + orchestrator instead). | Optional |

---

## Quickstart

```bash
# 1. Copy assets into your project
cp ~/.claude/templates/discoverability/discoverability.config.yaml ./
cp -r ~/.claude/templates/discoverability/hooks ./.claude/
cp ~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py ./scripts/

# 2. Customize config (project.name, project.type, channels, ...)
$EDITOR discoverability.config.yaml

# 3. Wire hooks into .claude/settings.json (merge from settings-snippet.json)

# 4. Init a run and audit
TAG=$(git describe --tags --always)
python scripts/discoverability-sdk.py init "$TAG"

# 5. In Claude Code: invoke discoverability-orchestrator (it self-dispatches)
```

After the orchestrator finishes, inspect:

- `evidence/discoverability/<tag>/gate-result.yaml` — release-gate verdict
- `evidence/discoverability/<tag>/report.md` — human-readable narrative
- `.discoverability/state.json` — current run state

---

## Operating model

- **Orchestrator self-dispatches** the 8-step workflow (scope → init → audit per
  channel → evidence.append → validate → plan → gate.check → handoff). It does
  not just route — it owns the run and writes the evidence trail.
- **SDK is deterministic** (`scripts/discoverability-sdk.py`, Python stdlib
  only, 10 frozen commands). All state transitions go through the SDK; agents
  and hooks never write `state.json` directly except through `mark-stale`.
- **Agents do scope + validate + remediation plan** — three thin reasoning
  layers (`disc-scope-classifier`, `disc-evidence-validator`,
  `disc-remediation-planner`). They consume deterministic evidence and produce
  structured YAML; they do NOT invent findings.
- **Hooks enforce harness invariants** at the project level (session context,
  mark-stale on relevant edits, robots/sitemap/llms.txt guard, deploy gate,
  Stop-event evidence check). All 5 hooks silent-exit when
  `discoverability.config.yaml` is absent or `harness.enabled == false`.
- **CI consumes `gate-result.yaml`** as the L12 release verdict. Exit codes
  (0/1/2/3) map directly to CI PASS/FAIL/BLOCKED/STALE. `enterprise-qa-testing`
  release bundles may reference (never replace) this verdict.

---

## Cross-references

### Skills (contract these templates implement)

- `~/.claude/skills/discoverability-orchestrator/SKILL.md` — L12 orchestrator (v1.2.0)
- `~/.claude/skills/web-seo/SKILL.md` — Web SEO narrow skill
- `~/.claude/skills/web-aeo/SKILL.md` — AI search / answer engine
- `~/.claude/skills/web-local-seo/SKILL.md` — Local SEO / Maps / NAP
- `~/.claude/skills/app-aso/SKILL.md` — App Store + Google Play

### Architecture + rules

- `~/.claude/docs/L12-DISCOVERABILITY.md` — full architecture write-up
- `~/.claude/rules/discoverability-l12.md` — path-scoped L12 rules
- `~/.claude/templates/discoverability/harness-contract.md` — binding harness contract

### Activation logic + project type catalogue

- `~/.claude/skills/discoverability-orchestrator/activation-rules.yaml`
- `~/.claude/skills/discoverability-orchestrator/project-types.yaml`

---

## Versioning

| Component | Current version | Bump policy |
|---|---|---|
| Harness contract (this directory) | **1.0.0** | Major on break to SDK commands, state.json schema, gate-result.yaml schema, hook semantics, or agent IO contract |
| Orchestrator skill SKILL.md | **1.2.0** | First version supporting harness self-dispatch |
| discoverability.config.yaml schema | **1.0.0** | Tracked via `_schema_version`; major on break to top-level keys / enums / nesting |
| state.json schema | **1.0.0** | Tracked via `_schema_version`; major on field add/remove/rename |
| gate-result.yaml schema | **1.0.0** | Tracked via `_schema_version`; major on enum / structure change |

**Compatibility rule**: harness version is independent of orchestrator skill
version. A project may upgrade the orchestrator skill (e.g. 1.2 → 1.3) without
re-copying these templates, AS LONG AS the upgraded skill targets the same
harness version. Cross-version upgrades (e.g. harness 1.0 → 2.0) require a
migration plan in `harness-contract.md` and bumping `_schema_version` fields.

**Safety-critical names are FROZEN** (see `harness-contract.md` §9): skill /
agent / hook / SDK-command identifiers are part of the control surface.
Renaming them defeats the harness; do not rename per-project.

---

## Strict boundaries (what L12 does NOT do)

These templates intentionally do not contain anything related to:

- Security, threat modeling, pentest, AppSec — see `appsec-security-orchestrator`
- Access control, authorization, authentication — `robots.txt` / `noindex` /
  `llms.txt` are crawler policy, **not** access control
- DAST / SAST / secret scanning
- UI/UX design, visual design
- Accessibility compliance (a11y is QA's `qa-a11y-compliance`; L12 only
  observes alt text for image discoverability)
- General QA testing — see `enterprise-qa-testing`

If an L12 finding suggests a security issue (e.g. authenticated content
exposed via sitemap.xml, secret leaked in llms.txt), the orchestrator's
`remediation_handoff.appsec[]` is populated and the issue escalates to
`appsec-security-orchestrator`. L12 itself does **not** attempt remediation.
