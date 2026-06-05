---
paths:
  # Web SEO / crawler policy files
  - "**/robots.txt"
  - "**/sitemap.xml"
  - "**/sitemap_*.xml"
  - "**/sitemap-*.xml"
  - "**/sitemap.txt"
  # AEO / AI search machine-readable docs
  - "**/llms.txt"
  - "**/llms-full.txt"
  # Framework-generated SEO / metadata entry points (Next.js App Router source)
  - "**/app/robots.ts"
  - "**/app/sitemap.ts"
  - "**/app/opengraph-image.*"
  - "**/app/twitter-image.*"
  # Next.js Pages Router source (legacy projects)
  - "**/pages/sitemap.xml.{ts,js,tsx,jsx}"
  - "**/pages/sitemap.{ts,js,tsx,jsx}"
  - "**/pages/robots.txt.{ts,js,tsx,jsx}"
  # Generic SEO / metadata source entry points
  - "**/metadata.{ts,js,tsx,jsx}"
  - "**/seo.{ts,js,tsx,jsx}"
  - "**/seo.config.*"
  - "**/schema*.{json,ts,tsx,jsx}"
  - "**/jsonld*.{ts,tsx,jsx}"
  - "**/og-image*.{ts,tsx,jsx,js,png,jpg}"
  # Discoverability config + runner + evidence
  - "discoverability.config.{yaml,yml,json}"
  - "**/discoverability/**/*"
  - "evidence/discoverability/**/*"
  # Store / GBP / ASO artifacts
  - "**/store-listing/**/*"
  - "**/app-store/**/*.{json,md,yaml,yml}"
  - "**/google-play/**/*.{json,md,yaml,yml}"
  - "**/business-profile/**/*"
  - "fastlane/metadata/**/*"
  - "fastlane/Deliverfile"
  - "fastlane/Supplyfile"
  # Local SEO / NAP artifacts (web-local-seo, 原 web-geo)
  - "**/local-seo/**/*"
  - "**/nap.{json,yaml,yml,md}"
---

> This rule is path-scoped. It loads only when Claude reads/edits files matching
> the paths above (robots.txt / sitemap / llms.txt / structured data / store
> listing / Business Profile artifacts / discoverability config / evidence).
> Extends [common/patterns.md](common/patterns.md).
>
> **Domain boundary**: SEO / AEO / GEO / ASO discoverability ONLY. For access
> control, authentication, authorization, threat modeling, secret handling,
> input validation, or any AppSec concern, see
> [rules/security-appsec.md](security-appsec.md). This rule never replaces
> AppSec; it only routes leak findings back to AppSec.

> **L12 Discoverability v1.2** (2026-05-25 — tag-scoped evidence layout).
> **Evidence path canonical**: `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json` + `gate-result.yaml`. Forbidden: flat `evidence/discoverability/<channel>/`, `<domain>` placeholder, `aeo.json`, `geo.json`, `gate-result.json` extension.
> **Hooks scope**: 5 L12 hooks (`disc-deploy-gate` / `disc-evidence-required` / `disc-mark-stale` / `disc-robots-sitemap-guard` / `disc-session-context`) register in `<project>/.claude/settings.json` via `python -m discoverability_sdk init` (or appropriate SDK init); fresh projects without `discoverability.config.yaml` have NO active enforcement.
> Authority: [docs/CANONICALS.md](../docs/CANONICALS.md) CL2 + D3.

# L12 Discoverability Rule (path-scoped)

## Hard rules (zero exception)

1. **`robots.txt` is crawler policy, NOT access control.** Polite crawlers may
   obey it; malicious crawlers will not. Sensitive content MUST be protected by
   server-side authentication and authorization. Never rely on
   `Disallow:` to keep private data safe.

2. **`noindex` is an index policy, NOT access control.** It hides a page from
   search results but does not stop direct URL access. Private / authenticated
   content MUST be gated by auth, not by `<meta name="robots" content="noindex">`
   or `X-Robots-Tag: noindex`.

3. **Never generate `llms.txt` / `llms-full.txt` / `sitemap.xml` / OG metadata
   entries pointing to private, staging, authenticated, or internal-only
   routes.** No `?token=` / preview / 401 / 403 URLs. Pre-flight check every
   URL with a 200-OK reachability probe before commit.

4. **Always verify Google Business Profile eligibility BEFORE drafting a GBP
   listing.** Refuse to help if the business is online-only, uses a P.O. box,
   uses a virtual office (Regus / WeWork hotdesk) as its sole address, has no
   staffed physical location, or is otherwise ineligible under Google
   Business Profile guidelines. Strong-arming a non-eligible listing through
   verification leads to permanent suspension of the listing AND the Google
   account.

5. **Always keep NAP (Name / Address / Phone) consistent across site footer,
   contact page, every service area landing page, LocalBusiness JSON-LD,
   Google Business Profile, Apple Business Connect, Bing Places, and every
   third-party directory.** Format drift (e.g. "St" vs "Street") is a warn;
   true conflicts (different phone / different address) are a blocker.

6. **Always ensure structured data (schema.org / JSON-LD) matches the visible
   page content.** Per Google quality guidelines, schema fields (`price`,
   `rating`, `name`, `headline`, `aggregateRating`, etc.) MUST be findable in
   the visible DOM. Mismatch = cloaking risk = spam flag.

7. **Never use deceptive / cloaking / doorway tactics.** Do not serve different
   content to search engine bots vs human users. Do not generate boilerplate
   "service in {city}" pages by templating city names — Google classifies
   these as doorway pages and demotes (or deindexes) them in batches.

8. **Never stuff keywords** in `<title>`, `meta description`, App Store
   `app name` / `subtitle` / `keywords field`, or Google Play `title` /
   `short description` / `full description`. Violates Apple App Store Review
   Guideline 2.3.7 and Google Play "Spam (Repetitive Content)" policy.
   Listing rejection or rank demotion follows.

9. **Never generate, suggest, or automate fake / paid / gated / incentivized
   reviews** for Google Business Profile, App Store, or Google Play. Review
   gating (filtering happy customers before requesting a public review) is
   explicitly banned by Google and the FTC. Never reply to negative reviews
   with customer PII (full name, order ID, medical record, case number).

10. **Never claim internal citability / SEO / ASO / AEO scores are an
    "official" Google / Apple / OpenAI / Anthropic / Perplexity ranking
    factor.** Official ranking algorithms are not published. Any score this
    skill emits is an **internal heuristic** and MUST be labeled
    `"source": "internal_heuristic"` in evidence — never `"official"`.

11. **Always route private-content-leak findings to AppSec for the underlying
    fix.** If discoverability audit finds an authenticated / sensitive page
    indexed by a search engine, this rule MAY identify and escalate, but MUST
    NOT attempt to fix authorization. Underlying fix belongs to
    [rules/security-appsec.md](security-appsec.md).

12. **Never ship production with a staging `robots.txt`.** A `User-agent: *`
    + `Disallow: /` on a production domain wipes the site from search
    results. Treat this as a release blocker on every deploy.

## Discoverability gate triggers

When you modify any path matched by this rule, you must:

- Route to `discoverability-orchestrator` for activation classification by
  `project_type` (`content_site` / `ecommerce` / `local_service` /
  `b2b_saas_marketing` / `api_with_public_docs` /
  `pure_backend_api_no_public_surface` / `mobile_app` /
  `web_app_plus_mobile_app`).
- Identify which of the 4 narrow domains the change affects: `web-seo`,
  `web-aeo`, `web-local-seo` (Local SEO; 2026-05-25 改名 web-local-seo,
  原 `web-geo`), `app-aso`.
- Run `pnpm discoverability:audit:<channel>` for affected channel(s) to produce
  fresh evidence; the evidence MUST predate the release by less than 24h.
  Channel values are `seo` / `ai-search` / `local` / `aso` (NOT `aeo` / `geo` /
  `<domain>` — these legacy placeholders are forbidden per v1.2 tag-scoped
  layout).
- Run `pnpm discoverability:gate --fail-on blocker` before declaring done.
- Update or create entries under
  `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json` (v1.2
  tag-scoped layout) with the new evidence; never overwrite without keeping
  the previous run in git. The `<tag>` dimension (release tag / phase tag) was
  added in v1.2 as a break change vs v1.1's flat layout.
- If the change touches Google Business Profile eligibility decisions,
  escalate to a human (business owner) — never auto-claim a listing on
  behalf of someone else.
- If the change exposes or could expose private content via discoverability
  surfaces (sitemap / OG / llms.txt / structured data), escalate to
  [rules/security-appsec.md](security-appsec.md). Do not "fix" via robots.

## Channel Activation Decisions

These decisions resolve ambiguous `activation-rules.yaml` entries. They are
binding and override any narrower-skill default that disagrees.

### `mobile_app` web-seo activation by `has_web_landing`

`mobile_app` projects activate `web-seo` based on `project.has_web_landing`
in `discoverability.config.yaml`:

- `has_web_landing: true` → web-seo **optional (warn-only)** — the marketing
  landing page benefits from standard SEO, but it is not a release blocker
  for the app itself.
- `has_web_landing: false` → web-seo **disabled** — no public web surface
  means no SEO to audit; record `00-activation.json` with
  `disabled_reason: "no_web_landing"`.

When the field is missing, default to `false` and warn the human to set it
explicitly. Never infer silently.

### `conditional_local` web-local-seo trigger

For `ecommerce`, `b2b_saas_marketing`, and `web_app_plus_mobile_app`, the
`web-local-seo` (Local SEO) channel activates only when the project has a
real physical presence. The trigger is satisfied by **any** of:

- `project.physical_locations > 0` (count of staffed physical addresses) →
  web-local-seo **required (blocker)**.
- `len(project.service_areas) > 0` (declared service-area regions for
  service-area businesses without a customer-facing storefront) →
  web-local-seo **required (blocker)**.
- Both `physical_locations == 0` and `service_areas == []` (defaults) →
  web-local-seo **disabled**; record `00-activation.json` with
  `disabled_reason: "no_local_footprint"`.

Either field present alone is enough; both are not required. Never auto-
activate `web-local-seo` from a guessed signal (e.g., a contact form
mentioning a city) — the human must set the config.

## Script-first Execution Constitution

L12 has one constitutional ladder. Follow this priority every time:

1. **Deterministic script / API / CLI**
   PageSpeed Insights API, Google Search Console API, GBP API, App Store
   Connect API, Google Play Developer API, Lighthouse CLI, schema.org
   validator, sitemap fetch + parse, robots.txt parser, `curl` reachability.

2. **Framework adapter**
   Next.js Metadata API + `app/robots.ts` + `app/sitemap.ts`; Nuxt SEO module
   (`@nuxtjs/seo`); Astro `@astrojs/sitemap`; Docusaurus
   `@docusaurus/plugin-sitemap`; SvelteKit sitemap adapter; WordPress
   Yoast / Rank Math export. Use the framework instead of hand-writing HTML.

3. **Structured evidence parser**
   Normalize framework / CMS / config output into the evidence JSON schema
   defined by `discoverability-orchestrator`. No AI in this step.

4. **AI synthesis from evidence**
   Read the evidence JSON produced by steps 1–3. Produce narrative
   explanation, prioritized fix list, and routing. AI never "audits the page
   by feel"; AI only interprets deterministic evidence.

5. **Manual AI scan (LAST RESORT)**
   Only allowed when no framework adapter, no API, and no parseable config
   exists. The output MUST be labeled `"source": "manual_ai_scan"` with
   `"confidence": "low"` in evidence. Never silently elevate manual scan to
   blocker.

**Reverse rule**: Never let AI freelance audit pages by reading HTML and
"feeling" the SEO / AEO / ASO score. If you find yourself doing that, stop
and find a script or API for the underlying check.

## 4 Domain Quick Rules

Detailed checks live in each narrow skill's `SKILL.md`. The hard constraints
below are non-negotiable.

### web-seo (standard search engines)

- Public business-critical pages MUST be server-rendered (SSR / SSG /
  hydration with HTML payload). Bing / Baidu / Yandex / most AI crawlers do
  not execute JavaScript; CSR-only pages are invisible to them.
- `<link rel="canonical">` MUST be self-referential or correctly converge
  duplicates; never canonical-chain to a redirect; never canonical to
  another domain unintentionally.
- Structured data (schema.org / JSON-LD) MUST match visible content
  (rule §6 above) — this is the single most common cloaking trap.
- `sitemap.xml` MUST NOT include `noindex` pages, MUST NOT link to 4xx/5xx
  URLs, MUST NOT exceed 50,000 URLs / 50 MB uncompressed (split via sitemap
  index), and MUST be declared in `robots.txt` via `Sitemap:` line.
- An unintended `noindex` on a production critical page is a release
  **blocker**. So is an unintended `Disallow: /` for a production domain.

### web-aeo (AI search / answer engines)

- Three AI-bot business decisions MUST be made independently and never
  conflated: (a) allow AI search index (`OAI-SearchBot`, `Claude-SearchBot`,
  `PerplexityBot`), (b) allow AI training crawl (`GPTBot`, `ClaudeBot`,
  `Google-Extended`, `Applebot-Extended`), (c) allow user-initiated fetch
  (`ChatGPT-User`, `Claude-User`).
- `llms.txt` is an **enhancement, not a universal release blocker.** Strength
  is graded by `project_type` — see the "llms.txt grading" table below for
  the binding policy. The Hard rule: `llms.txt` is a release blocker for
  `api_with_public_docs` and for developer tools / SDK / CLI projects
  **that ship a public docs site or a public API surface**. All other
  project types are warn-only or disabled.
- Any AI crawler present in `robots.txt` MUST have an explicit `Allow:` or
  `Disallow:`. Silent defaults are a warn — the policy must reflect a real
  business decision, not absent-mindedness.
- Internal "citability" / "answer-ability" scores MUST be labeled internal
  heuristic; never presented to clients as official ranking signals.
- Stated business policy (privacy policy / ToS / AI content section) MUST
  match actual `robots.txt` rules for AI bots. Mismatch = blocker.

#### llms.txt grading (binding by `project_type`)

This table is the single source of truth when `activation-rules.yaml`,
narrow-skill docs, or audit output disagree on whether `llms.txt` is a
blocker. Higher rows win over lower rows; the row that matches the
configured `project_type` wins over any inference.

| `project_type` | `llms.txt` status | Reasoning |
|---|---|---|
| `api_with_public_docs` | **required (blocker)** | Docs-heavy project; AI-citation entry point is core to the surface. |
| `content_site` | required (warn-only) | Docs / blog paths are llms.txt-friendly, but marketing content can rely on standard SEO. |
| `b2b_saas_marketing` | optional (warn-only) | A `/docs` path can benefit; marketing pages alone do not require it. |
| `ecommerce` | optional (warn-only) | Product pages are better served by `schema.org/Product`; llms.txt is supplemental. |
| `local_service` | optional (warn-only) | Information density is low; the LocalBusiness schema carries the load. |
| `mobile_app` / `web_app_plus_mobile_app` | depends on web surface | With a marketing site (`has_web_landing: true`) → optional (warn-only); without → **disabled**. |
| `pure_backend_api_no_public_surface` | **disabled** | No public surface to advertise; record `disabled_reason`. |

**Hard rule** (resolves the §11 anti-pattern conflict): `llms.txt` is a
release blocker for `api_with_public_docs` and for developer tools / SDK /
CLI projects **with a public docs site or public API surface**. All other
project types remain warn-only or disabled per the table above. The
warn-only entries MUST still surface a recommendation in the audit report;
they just do not fail the gate.

### web-local-seo (Local SEO ONLY — not Generative Engine Optimization)

> Renamed 2026-05-25: `web-geo` → `web-local-seo`. The old name conflicted
> with the industry meaning of "GEO" (Generative Engine Optimization), which
> is now routed to `web-aeo` instead.

- Google Business Profile eligibility is a **hard pre-check** (rule §4).
  Refuse to help unsupported business types.
- NAP MUST be consistent across site / GBP / schema.org / Apple Business
  Connect / Bing Places / industry directories (rule §5).
- `LocalBusiness` JSON-LD MUST use the most specific schema.org subtype
  (`Restaurant`, `Dentist`, `Plumber`, `Attorney`, etc.) — never the generic
  `LocalBusiness` parent type when a subtype fits.
- Service area landing pages MUST have ≥ 400 words of genuinely unique
  content per city/region. Boilerplate `"plumber in {city}"` templates =
  doorway page = batch demotion.
- P.O. box / virtual office / shared hot-desk without independent signage =
  **never** acceptable as the sole physical location for GBP claim.

### app-aso (App Store / Google Play)

- Field length limits are hard caps: Apple `app name` ≤ 30 chars,
  `subtitle` ≤ 30, `keywords field` ≤ 100, `promotional text` ≤ 170,
  `description` ≤ 4000; Google `title` ≤ 30, `short description` ≤ 80,
  `full description` ≤ 4000. Exceeding = rejection.
- Keyword stuffing in any of the above = blocker (violates Apple Guideline
  2.3.7 / Google Play "Spam — Repetitive Content").
- `privacy policy URL` is **required** by both Apple and Google. Missing or
  non-200 URL = release blocker.
- Localization is more than text translation. Screenshots / icons / preview
  videos SHOULD be culturally re-shot for the top 3–5 target markets.
- Never generate scripts or workflows for review gating, paid reviews,
  incentivized reviews, or fake reviews — banned by Apple, Google, and the
  FTC.

## Cross-rule boundary

| Concern | Owner | Notes |
|---|---|---|
| Access control / authn / authz / IDOR / BOLA | [rules/security-appsec.md](security-appsec.md) | Discoverability never replaces auth. |
| Threat modeling / pentest / OWASP | [rules/security-appsec.md](security-appsec.md) | Out of L12 scope. |
| Secrets / credentials / `.env` / tokens | [rules/security-appsec.md](security-appsec.md) | L12 never reads or writes these. |
| Input validation / SQL injection / XSS | [rules/security-appsec.md](security-appsec.md) | L12 never touches. |
| CSP / HSTS / cookie flags / TLS | [rules/web/security.md](web/security.md) + [rules/security-appsec.md](security-appsec.md) | Security headers are not discoverability. |
| Release evidence bundle | [rules/testing-policy.md](testing-policy.md) + `qa-evidence-bundle` | L12 evidence is referenced by QA bundle, not produced by QA. |
| Lighthouse Performance budget | [rules/web/performance.md](web/performance.md) | L12 only consumes the Lighthouse `seo` category; performance budget owned by web rule. |
| A11y compliance (axe / WCAG / keyboard) | `qa-a11y-compliance` | L12 cares about `alt` text for Image Search but does not run a11y audits. |
| Cross-platform parity (dev / staging / prod robots drift) | `env-parity-baseline` | Coordinate when production ships staging robots. |
| Generic UX / Laws of UX / NN heuristics | `ux-principles` | Out of L12 scope. |

Any time these boundaries blur, the narrower rule wins and L12 hands off.

## Pre-release Discoverability Checklist

Tick before declaring discoverability done on a release:

- [ ] `discoverability.config.yaml` exists at project root with `project_type`
      explicitly set (never inferred silently).
- [ ] `pnpm discoverability:audit` was run within the last 24 hours and
      succeeded against the current build.
- [ ] `pnpm discoverability:gate --fail-on blocker` passes with zero
      blockers, OR every blocker has a documented human override / waiver
      with a responsible owner.
- [ ] Per-channel evidence files exist under
      `evidence/discoverability/<tag>/{seo,ai-search,local,aso}.json` (v1.2
      tag-scoped layout) according to `activation-rules.yaml` (only required
      channels; disabled channels record `00-activation.json` with
      `disabled_reason`). Plus `evidence/discoverability/<tag>/gate-result.yaml`
      for the final gate decision. Forbidden filenames: `aeo.json` (must be
      `ai-search.json`) / `geo.json` (must be `local.json`) /
      `gate-result.json` (must be `.yaml`).
- [ ] All evidence files have `source` field set (`script` / `api` /
      `framework_adapter` / `manual` / `manual_ai_scan`) — never blank.
- [ ] Evidence is committed (or uploaded as CI artifact) so it can be
      audited post-release.
- [ ] `robots.txt` and `sitemap.xml` are reachable on the production
      domain (HTTP 200) and reflect the production environment, not staging.
- [ ] Structured data on every production-critical page passes Google's
      Rich Results Test and Schema Markup Validator (zero errors).
- [ ] Lighthouse SEO category meets the project-defined target (default
      ≥ 95) on both mobile and desktop runs.
- [ ] Sitemap has been submitted to Google Search Console and Bing
      Webmaster Tools (where applicable).
- [ ] (ASO) Privacy policy URL returns 200 on both Apple and Google
      listings; "data safety" / App Privacy "nutrition label" forms are
      complete.
- [ ] (web-local-seo) NAP information is **normalized-equivalent** across site,
      GBP, schema, Apple Business Connect, Bing Places, and reviewed
      third-party directories (format drift like "St" vs "Street" is a
      warn, not a blocker; **true conflicts — different phone number or
      different physical address — are a blocker**). Eligibility verified.
- [ ] (web-aeo) `llms.txt` (if required for the project type) has every
      link returning HTTP 200; AI bot policy in `robots.txt` aligns with
      the public AI content / privacy policy.
- [ ] No private / authenticated URL appears in any discoverability
      artifact (sitemap, OG metadata, llms.txt, structured data, store
      listing description).

## Anti-patterns

- ❌ Letting AI "freelance audit SEO" by reading raw HTML — always script
  first; the AI only interprets evidence.
- ❌ Treating `robots.txt` as access control — it is a polite request, not
  a security boundary.
- ❌ Using `noindex` instead of authentication for "private" content — it
  hides from search, not from users.
- ❌ Treating `llms.txt` as a universal release blocker — it is required
  only for docs-heavy / API-heavy projects.
- ❌ Wrapping internal citability / SEO / ASO scores as "official" Google /
  Apple / OpenAI / Anthropic ranking factors — they are not.
- ❌ Helping ineligible businesses claim Google Business Profile (online-
  only, P.O. box, virtual office, shared hot-desk without signage).
- ❌ Generating boilerplate "service in {city}" landing pages by templating
  city names — Google classifies these as doorway pages.
- ❌ Implementing review gating (only inviting happy customers to leave a
  public review) — banned by Google and the FTC.
- ❌ Keyword-stuffing App Store / Google Play `app name`, `title`,
  `subtitle`, `description`, or `keywords field`.
- ❌ Letting structured data drift from visible page content — cloaking
  risk; spam flag risk; manual action risk.
- ❌ Cross-pollinating the 4 narrow domains (AEO / SEO / GEO / ASO).
  Evidence paths, gate rules, and report sections stay separate.
- ❌ Shipping production with `robots.txt: Disallow: /` left over from
  staging — wipes the site from search results.
- ❌ Replying to a negative review in public with customer PII (full name,
  order ID, medical record, case number) — use "this customer" + offline
  contact.
- ❌ Conflating "GEO = Generative Engine Optimization" with `web-local-seo`
  (the renamed `web-geo`) — in this configuration `web-local-seo` is
  strictly Local SEO; AI search / Generative Engine Optimization goes to
  `web-aeo`. The 2026-05-25 rename from `web-geo` to `web-local-seo` exists
  specifically to retire this ambiguity.
- ❌ Treating Lighthouse `performance` and `seo` categories as the same
  number — they are independent audits.

## Authoritative References (short list)

Quick `see-also` for resolving disagreements. Do not over-link.

- **Google Search Essentials** — `https://developers.google.com/search/docs/essentials`
- **sitemaps.org protocol** — `https://www.sitemaps.org/protocol.html`
- **RFC 9309 (Robots Exclusion Protocol)** — `https://www.rfc-editor.org/rfc/rfc9309.html`
- **schema.org** — `https://schema.org`
- **Google Business Profile guidelines** — `https://support.google.com/business/answer/3038177`
- **OpenAI bots overview** — `https://platform.openai.com/docs/bots`
- **Anthropic crawler documentation** — `https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler` (ClaudeBot / Claude-SearchBot / Claude-User)
- **llmstxt.org** — `https://llmstxt.org`
- **Apple App Store Review Guidelines** — `https://developer.apple.com/app-store/review/guidelines/`
- **Google Play Console: optimize your store listing** — `https://support.google.com/googleplay/android-developer/answer/4448378`

This is a deliberate short list. Official ranking algorithms are not
published; this rule never promises rank improvement, only conformance to
public specs and policies.
