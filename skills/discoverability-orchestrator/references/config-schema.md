# Relocated from discoverability-orchestrator/SKILL.md — §5. discoverability.config.yaml 约定

## 5. discoverability.config.yaml 约定

**Schema source of truth**：`~/.claude/templates/discoverability/discoverability.config.yaml`（文件顶部带 `_schema_version: "1.0.0"`）。本节示例是该 template 的精简摘录，结构必须保持一致；完整字段、默认值、注释见 template 原文。

每个 commercial 项目根目录建议有此配置文件，所有 runner 先读它：

```yaml
# discoverability.config.yaml — project root (精简摘录；以 template 为准)
_schema_version: "1.0.0"
version: 1

# ---------- project: identity + signals ----------
project:
  name: "<your-project>"
  canonical_url: "https://example.com"
  type: "b2b_saas_marketing"        # 见 project-types.yaml 的 8 种
  framework: "nextjs"               # nextjs | nuxt | astro | docusaurus | wordpress | sveltekit | ...
  auth_model: "public"              # public | mixed | authenticated_only
  locales: ["en", "zh-Hans"]        # BCP 47；第一个为 canonical
  regions: ["US", "CN"]             # ISO 3166-1 alpha-2
  physical_locations: 0             # int — 触发 conditional_local 用
  service_areas: []                 # list — 触发 conditional_local 用
  has_web_landing: false            # bool — mobile_app 项目用

# ---------- public_surfaces: 你实际上线了哪些 surface ----------
public_surfaces:
  - home
  - pricing
  - docs

# ---------- channels: 4 域开关（dict 形式，可扩展）----------
# 取值: required | optional | disabled | warn_only | conditional_local
# 默认值由 activation-rules.yaml 按 project.type 决定；此处显式 OVERRIDE
channels:
  seo:
    enabled: true
    state: required                 # required | optional | disabled | warn_only | conditional_local
    gate_level: blocker             # blocker | warn-only
  aeo:
    enabled: true
    state: warn_only
    gate_level: warn-only
  geo:                              # config key 仍叫 "geo" 但语义 = Local SEO，路由到 web-local-seo
    enabled: false
    state: disabled
    gate_level: blocker
  aso:
    enabled: false
    state: disabled
    gate_level: blocker

# ---------- crawler_policy: 单独章节，与 channels 并列 ----------
# 每个 bot 一个 enum 值（见 template 的完整 enum 列表）：
#   allow | disallow | policy_decision | verify_before_gate | user_initiated_not_robots_controlled
crawler_policy:
  googlebot: allow
  bingbot: allow
  oai_searchbot: allow
  claude_searchbot: allow
  perplexitybot: verify_before_gate
  gptbot: policy_decision
  claudebot: policy_decision
  google_extended: policy_decision
  applebot_extended: policy_decision
  chatgpt_user: user_initiated_not_robots_controlled
  claude_user: user_initiated_not_robots_controlled

# ---------- per-domain scope ----------
seo:
  sitemap_path: "/sitemap.xml"
  robots_path: "/robots.txt"
  critical_pages: ["/", "/pricing", "/docs"]
  search_console: { enabled: false, property: "https://example.com" }

aeo:
  llms_txt_path: "/llms.txt"
  llms_full_txt_path: "/llms-full.txt"
  citability_targets: ["/docs/quickstart", "/docs/api"]
  brand: { name: "<Your Brand>", aliases: [] }

# geo (Local SEO) — 路由到 web-local-seo skill
geo:
  has_physical_presence: false
  business_type: "service_area_business"   # service_area_business | brick_and_mortar | hybrid
  nap:
    name: ""
    address: { street: "", locality: "", region: "", postal_code: "", country: "" }
    phone: ""
  gbp: { account_id: null, location_id: null }
  service_areas: []

aso:
  platforms: []                     # [ios, android]
  bundle_ids: { ios: null, android: null }
  fastlane_metadata: { ios: "fastlane/metadata", android: "fastlane/android/metadata" }
  target_storefronts: []

# ---------- quality_gates: per-domain pass/fail ----------
quality_gates:
  lighthouse:
    min_seo_score: 0.90             # warn_only — L12 only OWNS lighthouse `seo` category
  seo:
    require_robots_txt: true
    require_sitemap_xml: true
    require_canonical: true
    require_no_unintended_noindex: true
    require_structured_data_for_supported_page_types: true
    require_hreflang_for_multilingual: true
    require_structured_data_matches_visible_content: true
    require_non_empty_server_rendered_primary_content: true
    require_sitemap_excludes_private_noindex_4xx_staging_urls: true
    require_production_robots_txt_not_staging: true
  aeo:
    require_llms_txt_for_docs_heavy_projects: true   # warn_only
    require_ai_crawler_policy_review: true           # warn_only
    require_no_private_pages_in_llms_txt: true       # blocker (AppSec escalation)
    require_answer_blocks_self_contained: true       # warn_only
    require_machine_readable_docs_path: true         # warn_only
  geo:                              # consumed when channels.geo != disabled
    require_business_profile_eligibility_check: true
    require_nap_consistency: true
    require_localbusiness_schema_for_local_landing: true
    forbid_doorway_service_area_pages: true
  aso:                              # consumed when channels.aso != disabled
    require_store_listing_metadata: true
    require_privacy_policy_url: true
    forbid_keyword_stuffing: true
    require_screenshots_min_count: { ios_iphone: 3, ios_ipad: 3, android_phone: 2 }
    require_feature_graphic_for_google_play: true
    require_data_safety_form_for_google_play: true

# ---------- evidence: 输出路径 + 保留策略 ----------
evidence:
  output_dir: "evidence/discoverability"
  report_formats: ["md", "json", "pdf"]
  upload_artifacts: true
  retention_days: 90

# ---------- monitoring: 观察 (audit 之外) ----------
monitoring:
  search_console: { enabled: false, property: "https://example.com" }
  chatgpt_referral_tracking:
    utm_source_patterns: ["chatgpt.com", "perplexity.ai", "claude.ai", "gemini.google.com"]
  lighthouse_ci: { enabled: false, budget_file: ".lighthouseci/budget.json" }

# ---------- vendor_tools: 固定 commit 的外部 runner ----------
vendor_tools:
  geo_seo_claude:
    enabled: false
    pinned_commit: "<PINNED_COMMIT_SHA>"
    path: "tools/vendor/geo-seo-claude"
```

**Schema 演化规则**：
- 顶部 `_schema_version` 是 sem-ver；任何 break-change 必须 bump major
- `channels.<domain>` 是 dict（`enabled / state / gate_level`），**不是** string 直值（向后兼容已删除）
- `geo` 这个 config key 名保留是历史原因；语义 = Local SEO，runner 必须路由到 `web-local-seo` skill
- 任何新字段加入 template 后，本 SKILL.md §5 摘录也要同步

**runner 行为**：缺失字段一律走 `activation-rules.yaml` default。**绝不**在缺失配置时静默激活全部 4 域——会浪费资源 + 输出无意义 evidence。

---
