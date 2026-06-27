# L12 Discoverability — SEO-Doc Audit Optimization LEDGER

> Created 2026-06-27. Durable progress ledger (CLAUDE.md §0.7) for the L12 (SEO/GEO/AEO/ASO)
> optimization triggered by the user's canonical SEO knowledge doc (Google-docs-based).
> **New session: read this first → find the pointer → continue.**
> Scope chosen by user: **全做 (P1 + P2 + P3 + doc-sync)**.
> Invariants: all changes ADDITIVE; frozen names (orchestrator §15.1) untouched; gate 定位 unchanged;
> measurement-only never feeds gate.check.

## Current pointer
→ **ALL PHASES DONE (2026-06-27).** P1 + P2 + P3 + doc-sync landed across 7 files; SDK gbp/aeo providers smoke-tested (py_compile OK, gbp→local, aeo→ai-search, measurement_only=true); repo-wide stale-tuple sweep clean. See session §0.5 report.

## Backlog (checkbox = done)

### P1 (highest leverage — genuine orphan)
- [x] **P1-1** [DONE — growth §4.5 advisory backlog + §4.5.3 AVOID table + GSC-Links anchor; §0 reframed 4→5 things] Off-site authority orphan → extend `discoverability-growth` with advisory off-site
  authority + digital-PR backlog + Google link-spam red-line table (buy links / PBN / link exchanges
  / hidden links / comment spam / parasite SEO / site-reputation abuse). GSC Links report = script-first
  anchor. **NEVER blocker · NOT a new evidence channel · NOT a new gate.** Keep existing "不买外链".

### P2 (clean core补强)
- [x] **P2-1** `local` channel post-launch measurement provider (GBP Performance API, free) — DONE + smoke-tested
  - `discoverability-sdk.py`: `MEASUREMENT_PROVIDERS += "gbp"`; `PROVIDER_CHANNEL["gbp"]="local"`;
    `MEASURE_METRICS +=` GBP metrics (profile_views / business_calls / direction_requests / bookings / website_clicks)
  - `disc-measurement-puller.md`: add `gbp` provider row + eligibility (local_service / physical_locations>0)
  - `web-local-seo/SKILL.md`: add "post-launch measurement (measurement-only)" section (mirror app-aso §16.6)
- [x] **P2-2** Keyword → intent → page-type mapping — DONE (web-seo §12 route + growth `intent`/`target_page_type` fields + Step 4 + hard-rule)
- [x] **P2-3** `web-seo` Core Web Vitals field thresholds — DONE (§4.7.1 PSI/CrUX warn-only + §15.3 lhci LCP/CLS/TBT lab-proxy; perf gate stays QA)
- [x] **P2-4** `web-seo` internal-link anchor quality + crawlability — DONE (§4.5.1 + warns `non_descriptive_anchor_text` / `internal_link_not_crawlable_anchor`)
- [x] **P2-5** (doc N/A — general ASO best practice) `app-aso` In-App Events (Apple §4.7) / LiveOps promo (Google §5.5)
  discovery surface + warns `in_app_events_unused` / `promotional_content_unused` — DONE

### P3 / doc-sync (polish)
- [x] **P3-1** aeo measurement provider doc-drift — DONE (puller table + web-aeo §20.6/§20.5 + harness-contract:109 + sdk comment all synced; SDK already supported aeo)
- [x] **P3-2** `web-seo` H2/H3 heading-outline check (`broken_heading_outline`) + click-depth (`critical_page_excessive_click_depth`) — DONE (§4.5.1)
- [x] **P3-3** `web-local-seo` relevance+distance+prominence framing section — DONE (folded into §13.5.4)
- [x] **P3-6** (new) `app-aso` §16.6.7 stale provider/metrics refs sync — DONE (§16.6.2 was already correct; §16.6.7 rewritten to show 6-provider tuple + ASO funnel keys present)
- [x] **P3-4** `web-aeo` Principle G callout near §1 (AEO is incremental on core SEO; cross-link web-seo) — DONE
- [x] **P3-5** `app-aso` keyword-locale arbitrage bullet (§6.1) — DONE

## Deliberate scope boundaries (documented, NOT implemented — not defects)
- **Phase 1 business/conversion/competitor intake** → upstream I2R / gsd-new-project, not L12 (release gate ≠ SEO-agency PM).
- **30/60/90 ongoing-campaign cadence + monthly report** → L12 is release-tag-scoped; ongoing monitoring = `measure.pull`/`measure.compare` + scheduled re-run. `report` command already emits a single-run release report.

## Key verified facts (this audit, evidence-cited)
- `discoverability-sdk.py:70` `MEASUREMENT_PROVIDERS` was `("gsc","ga4","bing","aso","aeo")` (audit finding: **no gbp/local**) → **now** `(…,"aeo","gbp")` (gbp added 2026-06-27).
- `discoverability-sdk.py:74-75` `PROVIDER_CHANNEL` has `aeo→ai-search` already wired.
- No `backlink`/`links`/`referring` concept anywhere in the SDK.
- `disc-scope-classifier` is technical-only (project.type / public_surfaces / channels) — no business intake.
- `report` command (sdk.py:917-960) = single-run release report, not recurring.
- Files in scope: discoverability-sdk.py · disc-measurement-puller.md · web-local-seo · web-seo · discoverability-growth · web-aeo · app-aso.

## Verification plan
- SDK change: `python -m py_compile discoverability-sdk.py` + smoke test (init temp tag → `measure.pull --provider gbp <fake gbp export>` → assert `channel=local`, `measurement_only=true`, exit 0).
- Doc edits: consistency pass — no frozen-name rename, additive sections only, match each skill's § numbering/style.

## Rollback
- Config repo: GitHub `SensLiao/Claude-code-setting` (per-commit). Local: `~/.claude/backups/`.
