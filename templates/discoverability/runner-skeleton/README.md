# Discoverability Runner — Skeleton

> **DEPRECATED v1.1 REFERENCE — for v1.2 architecture see [templates/discoverability/harness-contract.md](../harness-contract.md)**
>
> This document describes the **legacy v1.1 layout**. The current canonical architecture is **v1.2 tag-scoped**:
> - Evidence path: `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json` (NOT flat `<module>/` directories)
> - Gate result: `gate-result.yaml` (NOT `gate-result.json`)
> - Filename mapping: `aeo.json` → `ai-search.json`, `geo.json` → `local.json`
>
> See [docs/L12-DISCOVERABILITY.md](../../../docs/L12-DISCOVERABILITY.md) for the current contract and [docs/CANONICALS.md](../../../docs/CANONICALS.md) CL2 for the path-layout decision.
>
> This file is kept for historical reference and to assist v1.1 → v1.2 migration. Do NOT use it as a fresh-project starting template — use `templates/discoverability/harness-contract.md` instead.

---

This is a **skeleton** for the `pnpm discoverability:*` CLI that L12 Discoverability
expects every commercial-grade project to ship. The 5 L12 skills
(`discoverability-orchestrator` + `web-seo` + `web-aeo` + `web-local-seo` + `app-aso`)
define the contract; this skeleton shows you what to implement.

The skeleton is intentionally minimal. Pick a runtime (Node/TS recommended) and
fill in the runners as your project grows. Each L12 narrow skill SKILL.md
documents the checks; this README documents the wiring.

---

## 1. What this skeleton provides

| File | Purpose |
|---|---|
| `package.json` | Minimal npm scripts that match the L12 CLI contract |
| `ci-workflow.yml` | GitHub Actions workflow — place at `.github/workflows/discoverability.yml` |
| `.gitignore` | Sensible defaults for evidence + vendor artifacts |
| `README.md` | This file — explains contract + recommended layout |

The skeleton itself does NOT include a runtime implementation. You implement
`src/cli.ts` (or `src/cli.py`, etc.) by following the contract below.

---

## 2. Architecture

```
pnpm discoverability:audit
  |
  +-- 1. load discoverability.config.yaml
  |     - validate schema (zod / pydantic recommended)
  |     - fail fast if `project.type` missing
  |
  +-- 2. classify project_type
  |     - read project.type from config
  |     - cross-check against project-types.yaml signals
  |     - write evidence/discoverability/00-activation.json
  |
  +-- 3. resolve activated modules
  |     - read channels.* from config
  |     - apply activation-rules.yaml defaults for unset entries
  |     - resolve conditional_local based on geo.has_physical_presence
  |
  +-- 4. for each activated module:
  |     |
  |     +-- invoke runner (script / framework adapter / vendor tool)
  |     +-- normalize output to evidence JSON (schema v1.0)
  |     +-- write evidence/discoverability/<module>/*.json
  |
  +-- 5. write evidence/discoverability/<module>/*-evidence.json (aggregate)
  |
  +-- 6. compute gate result
  |     - apply quality_gates.* thresholds
  |     - bucket findings into blockers / warnings / escalations
  |     - write evidence/discoverability/gate-result.json
  |
  +-- 7. (optional) generate report
        - md / json / pdf via `pnpm discoverability:report`
```

---

## 3. CLI sub-commands (the L12 contract)

These subcommands MUST exist with these names. The narrow skills emit findings
that reference these commands; CI workflows assume these names.

### `audit` — collect evidence

```bash
pnpm discoverability:audit \
  [--module seo|aeo|geo|aso|all]   # default: all activated channels
  [--url <url>]                    # override project.canonical_url
  [--config <path>]                # default: ./discoverability.config.yaml
  [--out <dir>]                    # default: evidence/discoverability
  [--skip-manual]                  # skip manual-required checks (CI mode)
```

Convenience aliases (each invokes `audit --module X`):

```bash
pnpm discoverability:audit:seo
pnpm discoverability:audit:aeo
pnpm discoverability:audit:geo
pnpm discoverability:audit:aso
```

### `gate` — evaluate evidence against thresholds

```bash
pnpm discoverability:gate \
  [--evidence <dir>]               # default: evidence/discoverability
  [--fail-on blocker|warn]         # default: blocker
```

Exit code:
- `0` — pass
- `1` — gate failed (blocker found, or `--fail-on warn` + warning found)
- `2` — config / evidence schema error (not a finding)

### `report` — render evidence to human-readable formats

```bash
pnpm discoverability:report \
  [--evidence <dir>]               # default: evidence/discoverability
  [--format md,json,pdf]           # default: md,json
  [--out <dir>]                    # default: evidence/discoverability
```

### `explain` — AI-readable narrative of evidence

```bash
pnpm discoverability:explain \
  [--evidence <dir>]               # default: evidence/discoverability
  [--output <path>]                # default: stdout
  [--finding <id>]                 # explain one finding by id
```

Use case: feed the output to an LLM (or human reviewer) to translate raw
evidence into a prioritized action plan. This is the only place AI synthesis
is allowed; all checks above are deterministic.

---

## 4. Recommended directory layout

You don't have to use this exact layout, but L12 skills assume something like it.

```
packages/discoverability/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                       # entrypoint: dispatches to audit/gate/report/explain
│   ├── config/
│   │   ├── schema.ts                # zod schema for discoverability.config.yaml
│   │   └── load.ts                  # load + validate + apply defaults
│   ├── activation/
│   │   ├── rules.ts                 # mirrors activation-rules.yaml
│   │   └── classify.ts              # project_type classifier + 00-activation.json
│   ├── runners/
│   │   ├── seo/
│   │   │   ├── robots.ts            # fetch + parse robots.txt
│   │   │   ├── sitemap.ts           # fetch + validate sitemap.xml
│   │   │   ├── lighthouse.ts        # wrap Lighthouse CLI
│   │   │   ├── canonical.ts         # canonical / hreflang / metadata audit
│   │   │   ├── structured-data.ts   # JSON-LD parser + schema.org validator
│   │   │   └── index.ts             # orchestrates above + emits seo-evidence.json
│   │   ├── aeo/
│   │   │   ├── crawler-policy.ts    # robots.txt vs business policy consistency
│   │   │   ├── llms-txt.ts          # validate + (optionally) generate llms.txt
│   │   │   ├── citability.ts        # invokes geo-seo-claude scorer adapter
│   │   │   ├── answer-blocks.ts     # self-containment + question H2/H3 check
│   │   │   ├── brand-entity.ts      # invokes brand_scanner.py adapter
│   │   │   └── index.ts             # emits aeo-evidence.json
│   │   ├── geo/
│   │   │   ├── eligibility.ts       # business-profile-eligibility checklist
│   │   │   ├── completeness.ts      # GBP fields presence audit
│   │   │   ├── nap.ts               # site NAP cross-check vs GBP canonical
│   │   │   ├── schema.ts            # LocalBusiness JSON-LD validator
│   │   │   ├── service-areas.ts     # service-area page doorway detection
│   │   │   └── index.ts             # emits geo-evidence.json
│   │   └── aso/
│   │       ├── app-store.ts         # App Store Connect API adapter
│   │       ├── google-play.ts       # Google Play Developer API adapter
│   │       ├── fastlane.ts          # fastlane metadata directory parser
│   │       ├── visual-assets.ts     # screenshot/icon/preview spec validator
│   │       ├── localization.ts      # locale × field coverage matrix
│   │       └── index.ts             # emits aso-evidence.json
│   ├── checks/
│   │   └── ...                      # cross-cutting checkers used by multiple runners
│   ├── gates/
│   │   ├── apply.ts                 # threshold application
│   │   ├── bucket.ts                # blocker / warn / info bucketing
│   │   └── result.ts                # writes gate-result.json
│   ├── evidence/
│   │   ├── schema.ts                # shared evidence + finding shape
│   │   ├── write.ts                 # atomic JSON writer (tmp + rename)
│   │   └── normalize.ts             # adapter-output → canonical evidence shape
│   └── reports/
│       ├── markdown.ts              # report.md renderer
│       ├── json.ts                  # report.json (machine-readable digest)
│       └── pdf.ts                   # report.pdf renderer (puppeteer / playwright)
└── README.md
```

---

## 5. Module runner responsibilities

Each module's `runners/<module>/index.ts` is the single entry point its
narrow skill expects. The cross-skill contract:

### SEO runner (`runners/seo/index.ts`)

Inputs: `config.seo`, `project.canonical_url`, `project.locales`.

Required checks (see `web-seo` SKILL §4):
1. Fetch `/robots.txt` via curl; parse rules; verify critical URLs not blocked.
2. Fetch `/sitemap.xml`; validate against sitemaps.org schema; HEAD each URL.
3. Per critical page: parse `<head>` → title, description, canonical, hreflang, og, twitter.
4. Per page: parse all `<script type="application/ld+json">` → schema.org validator.
5. Invoke Lighthouse CLI (mobile + desktop) with categories=seo,perf,a11y,best-practices.
6. (Optional) Search Console API: sitemap status, indexed page count, manual actions.
7. Aggregate → `seo/seo-evidence.json`.

### AEO runner (`runners/aeo/index.ts`)

Inputs: `config.aeo`, `crawler_policy.*`, optional vendor tool path.

Required checks (see `web-aeo` SKILL §5-§8):
1. Parse robots.txt for AI bot directives; cross-check against `crawler_policy.*`.
2. Fetch + validate llms.txt + llms-full.txt (link reachability, no private URLs).
3. Invoke `geo-seo-claude/scripts/citability_scorer.py` per `citability_targets`.
4. Per page: answer-block self-containment heuristic, H2/H3 question-form check.
5. Optional: `brand_scanner.py` for Wikipedia/Reddit/YouTube signal scan.
6. Aggregate → `aeo/aeo-evidence.json`.

### GEO runner (`runners/geo/index.ts`)

Inputs: `config.geo` (only consumed if `has_physical_presence: true`).

Required checks (see `web-local-seo` SKILL §4-§10):
1. Eligibility checklist (§4.2 anti-signals → BLOCKER if any hit).
2. GBP completeness via API or manual checklist.
3. Site NAP scan (Grep across source) vs canonical NAP in config.
4. LocalBusiness JSON-LD: subtype specificity + NAP/hours consistency.
5. Service-area pages: unique-word-count + boilerplate-ratio doorway detector.
6. Reviews / multi-maps presence (often partial-manual; mark `audit_mode`).
7. Aggregate → `geo/geo-evidence.json`.

### ASO runner (`runners/aso/index.ts`)

Inputs: `config.aso`, `bundle_ids.*`, `target_storefronts`.

Required checks (see `app-aso` SKILL §4-§6):
1. Read metadata via App Store Connect API + Google Play Developer API,
   OR parse `fastlane/metadata/` and `fastlane/android/metadata/` offline.
2. Per storefront × per locale × per field: presence + char-count limits.
3. Visual asset inventory: icon (1024×1024 / 512×512), screenshots (min counts,
   per-device sizes), feature graphic (Google), preview video.
4. Privacy policy URL reachability + App Privacy / Data Safety form presence.
5. PPO / Store Listing Experiments configuration audit.
6. Aggregate → `aso/aso-evidence.json`.

---

## 6. Evidence schema — common fields

Every JSON file under `evidence/discoverability/<module>/` MUST share this
shape so `gate` and `report` can consume them generically.

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-05-25T01:30:00Z",
  "source": "lighthouse@12.x",
  "domain": "seo",
  "check": "lighthouse-mobile",
  "status": "pass",
  "audit_mode": "auto",
  "findings": [
    {
      "id": "lighthouse_seo_score_below_target",
      "severity": "warn",
      "evidence_path": "seo/lighthouse-mobile.json#/categories/seo/score",
      "actual": 0.88,
      "expected": ">= 0.90",
      "detail": "Lighthouse mobile SEO score 0.88 below target 0.90",
      "suggested_fix": "Review missing meta description on /pricing"
    }
  ],
  "raw": { /* the underlying tool output, untouched */ }
}
```

Field reference:

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | `"1.0"` (this schema); bump on breaking change |
| `generated_at` | ISO 8601 | UTC, second precision |
| `source` | string | `<tool>@<version>`, e.g. `lighthouse@12.x`, `manual`, `app_store_connect_api@2024-10` |
| `domain` | string | One of: `seo` / `aeo` / `geo` / `aso` |
| `check` | string | Stable check ID (kebab-case) |
| `status` | enum | `pass` / `warn` / `fail` / `unknown` / `manual_required` |
| `audit_mode` | enum | `auto` / `manual` / `pending` / `mixed` |
| `findings[]` | array | Zero or more findings (empty = pass) |
| `findings[].id` | string | Stable finding ID, matches blocker/warn IDs in skill SKILL.md |
| `findings[].severity` | enum | `blocker` / `warn` / `info` |
| `findings[].evidence_path` | string | JSON pointer or file ref pointing to the underlying data |
| `findings[].actual` | any | Observed value |
| `findings[].expected` | any | Expected value or threshold expression |
| `findings[].detail` | string | Human-readable explanation |
| `findings[].suggested_fix` | string | Optional, AI-friendly fix hint |
| `raw` | object | Raw tool output for traceability |

---

## 7. Gate result schema

`evidence/discoverability/gate-result.json` is the single artifact a release
pipeline (e.g. `gsd-ship`, `gsd-verify-work`) consumes.

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-05-25T01:35:00Z",
  "config_path": "discoverability.config.yaml",
  "evaluated_modules": ["seo", "aeo"],
  "blockers": [
    {
      "id": "critical_public_page_has_unintended_noindex",
      "domain": "seo",
      "evidence_ref": "seo/seo-evidence.json#/findings/2",
      "url": "https://example.com/pricing",
      "detail": "<meta name=\"robots\" content=\"noindex\"> on /pricing"
    }
  ],
  "warnings": [
    {
      "id": "lighthouse_seo_score_below_target",
      "domain": "seo",
      "evidence_ref": "seo/seo-evidence.json#/findings/5"
    }
  ],
  "escalations": [
    {
      "to": "appsec-security-orchestrator",
      "reason": "private_or_authenticated_content_exposed_publicly",
      "evidence_ref": "seo/seo-evidence.json#/findings/7"
    }
  ],
  "summary": {
    "blocker_count": 1,
    "warn_count": 5,
    "escalation_count": 1,
    "modules_activated": 2,
    "modules_disabled": 2
  },
  "pass": false
}
```

A `pass: true` result means: no blockers AND no escalations to higher-priority
orchestrators. Warnings are reported but do not flip `pass` to false.

---

## 8. Implementation notes

- **Atomic writes**: write to `*.tmp` then rename — partial JSON breaks `gate`.
- **No AI in checks**: AI is allowed in `explain` only. `audit` is deterministic.
- **Manual evidence**: when a check requires human input, write
  `status: "manual_required"` + `audit_mode: "pending"` so reports flag it.
- **Vendor tools**: pin commits in `vendor_tools.*.pinned_commit`. Never track
  vendor `main` branches — evidence schema must be stable.
- **Secrets**: API tokens (Search Console, App Store Connect, Play Developer)
  must come from env vars or your secret manager. Never write to disk.
- **Locale**: render JSON with sorted keys + 2-space indent for diffability.

---

## 9. Onboarding checklist for a new project

1. Copy `discoverability.config.yaml` to your project root.
2. Pick `project.type` from `~/.claude/skills/discoverability-orchestrator/project-types.yaml`.
3. Adjust `channels.*` per project type.
4. Run `pnpm install` (or your equivalent) to grab the deps from `package.json`.
5. Implement the runners you need first (usually `seo` is required for any public site).
6. Add `.github/workflows/discoverability.yml` from `ci-workflow.yml` template.
7. Wire `pnpm discoverability:gate` into your release pipeline.
8. After first successful audit, commit `evidence/discoverability/` OR rely on CI artifact uploads.

---

## 10. Where to learn more

- L12 entry point: `~/.claude/skills/discoverability-orchestrator/SKILL.md`
- Per-domain deep dive:
  - `~/.claude/skills/web-seo/SKILL.md`
  - `~/.claude/skills/web-aeo/SKILL.md`
  - `~/.claude/skills/web-local-seo/SKILL.md`
  - `~/.claude/skills/app-aso/SKILL.md`
- Activation rules: `~/.claude/skills/discoverability-orchestrator/activation-rules.yaml`
- Project type catalogue: `~/.claude/skills/discoverability-orchestrator/project-types.yaml`
