---
name: web-seo
canonical_id: "discoverability.web-seo"
aliases: ["web-seo", "seo", "search-engine-optimization"]
version: 1.0.0
status: stable
created_date: 2026-05-25
parent: "discoverability-orchestrator"
layer: "L12"
sibling-skills: ["web-aeo", "web-local-seo", "app-aso"]
children: []
upstream: ["discoverability-orchestrator"]
downstream: []
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion
forbidden-tools: []
disable-model-invocation: false
description: >
  Standard web SEO skill — make public web pages discoverable on traditional
  search engines (Google / Bing / DuckDuckGo / Baidu / Yandex). Covers crawl
  policy, indexability, canonicalization, hreflang, metadata, structured data
  (schema.org / JSON-LD), Lighthouse SEO audit, and Search Console signal
  monitoring. Script-first: runs Lighthouse / curl / parser before any AI
  interpretation. Does NOT cover AI search / answer engines (use web-aeo),
  Local SEO / Google Business Profile (use web-local-seo), App Store /
  Play Store (use app-aso), or any security / access control concern
  (escalate to appsec-security-orchestrator). Trigger phrases: "SEO /
  Google Search / Bing search / technical SEO / on-page SEO / sitemap.xml /
  robots.txt / canonical / structured data / Schema.org (general) /
  Lighthouse SEO / Search Console / meta description / title tag / hreflang /
  国际 SEO / canonical URL / 重定向 / 301 / 网站地图 / 搜索引擎收录".
---

# web-seo — 标准 Web SEO 子层

## 0. 重要定位（不要误解）

**这个 skill 只做一件事：让 public 网页能被传统搜索引擎（Google / Bing / DuckDuckGo / Baidu / Yandex）正确发现、抓取、索引、理解、展示。**

它不是：

- ❌ AI search / LLM answer engine 优化 → 见 [`web-aeo`](../web-aeo/SKILL.md)
- ❌ Local SEO / Google Business Profile / Apple Business Connect → 见 [`web-local-seo`](../web-local-seo/SKILL.md)
- ❌ App Store / Google Play discoverability → 见 [`app-aso`](../app-aso/SKILL.md)
- ❌ 任何 security / access control / authorization / threat model / pentest → 见 `appsec-security-orchestrator`

> **关键边界**：robots.txt 与 sitemap.xml 在本 skill 里只作为 **crawler policy + discoverability signal**，**不是** access control。如果有"敏感页被搜索引擎收录"这种 finding，本 skill 只负责标识、escalate 给 AppSec，**不**修复 authorization。

---

## 1. Mission

把任何 public 网页推进以下链路：

```
可抓取 (crawlable) → 可索引 (indexable) → 可理解 (parseable)
                  → 可展示 (rich result eligible) → 可监控 (measurable)
```

每一步都要有 **evidence**（fetch 出的 HTTP 状态、robots 规则、sitemap 内容、parsed metadata、Lighthouse 分数、Search Console 指标），而不是 AI 凭印象判断。

---

## 2. 适用场景

### 强激活

- public landing page / marketing site
- public blog / content site / docs site
- public product page / pricing page / e-commerce listing
- 多语言公开站点（hreflang 需求）
- 任何希望从 Google / Bing organic search 获得流量的站点

### 跳过

- 内部 admin / dashboard / 后台（应该 `noindex` + 不进 sitemap）
- 登录后才可见的内容（authenticated content，本 skill 不处理）
- 纯 API 服务（无 HTML 页面）
- 单文件实验 / 早期 prototype

---

## 3. 执行宪法（继承 L12 Discoverability）

### Script-first，AI 解释 second

**绝不让 AI"凭感觉审计 SEO"。**所有结论必须先由脚本/工具产出 evidence，AI 只做：

1. 解释 evidence 含义
2. 把多个信号关联起来
3. 标识 blocker vs warn-only
4. 提出可执行的 fix proposal

执行顺序固定：

```
1. curl → status code / response headers / raw HTML
2. parser → robots.txt / sitemap.xml / canonical / hreflang / metadata / JSON-LD
3. Lighthouse CLI → SEO / Performance / Accessibility / Best Practices score
4. Search Console API（可选）→ impressions / clicks / indexed pages
5. AI → 解释 + 关联 + 路由 fix
```

### Evidence-first

每一项 finding 必须能指向归一化后的 channel evidence `evidence/discoverability/<tag>/seo.json`（其 `findings[].evidence_ref` 指向具体 raw 文件位置）。没有 evidence 的 finding 不进 release gate。

### 增量验证

改完一项（比如加了 canonical），只重跑该项的 evidence，不重跑全套 Lighthouse。

---

## 4. 核心检查项（8 大类）

### 4.1 robots.txt（crawler policy，不是 access control）

| Check | 期望值 | 失败影响 | 自动化方式 |
|---|---|---|---|
| 存在性 | `GET /robots.txt` 返回 200 | 缺失 → 搜索引擎按默认全抓，可能抓到不该抓的路径 | `curl -sS -o robots.txt -w "%{http_code}" https://<host>/robots.txt` |
| 语法合法 | 符合 RFC 9309（Robots Exclusion Protocol） | 错误指令会被忽略，预期不生效 | robots parser（如 `robotspec` / `urllib.robotparser` / `google/robotstxt`） |
| 不误封关键页 | 关键 public URL 通过 `Allow` 或不在任何 `Disallow` 路径下 | 整站被 `Disallow: /` → 完全消失 | 对 sitemap.xml 里每个 URL 调 robots parser 判断 |
| 声明 sitemap | 包含 `Sitemap: https://<host>/sitemap.xml`（推荐绝对 URL） | 搜索引擎需自行发现 sitemap，发现率下降 | 检查 robots.txt 是否含 `Sitemap:` 行 |
| 生产/暂存隔离 | production 域名不能 ship staging 用的 `Disallow: /` | 整站消失 → BLOCKER | 比对 robots.txt 与 host 环境 |

> **反模式**：把 robots.txt 当 access control。它只防"礼貌 crawler"，不能阻止任何人直接访问 URL。**敏感页要靠 auth、不是靠 robots.txt。**

### 4.2 sitemap.xml（discoverability signal）

| Check | 期望值 | 失败影响 | 自动化方式 |
|---|---|---|---|
| 存在性 | `GET /sitemap.xml`（或 robots.txt 声明位置）返回 200 | 大型站点 → 索引率下降 | `curl -sS -o sitemap.xml -w "%{http_code}" https://<host>/sitemap.xml` |
| XML schema 合法 | 符合 sitemaps.org schema（0.9） | 部分搜索引擎拒绝解析 | XML schema validator |
| URL 返回 200 | sitemap 内每条 URL `HEAD` 检查均为 2xx | sitemap 含 4xx/5xx URL → 浪费 crawl budget | 遍历 sitemap，对每个 URL 跑 `curl -sS -I -o /dev/null -w "%{http_code}\n"` |
| `lastmod` 合理 | 真实修改时间，不是 build 时间戳 | 频繁假更新 → 搜索引擎降低信任 | 比对 git log / 内容 hash |
| 覆盖关键 public pages | 关键 landing / pricing / product / blog 页都在 sitemap 中 | 漏页 → 该页索引延迟或不索引 | 用 site crawler 抽样比对 |
| 大型 sitemap 拆分 | 单 sitemap > 50,000 URL 或 > 50 MB（uncompressed）→ 用 sitemap index | 超限 → 不解析 | 统计 URL 数 + 文件大小 |
| 已提交 Search Console | Google Search Console / Bing Webmaster Tools 已 submit | 索引延迟 | 调 Search Console API 查 submitted status |
| 不包含 private / noindex 页 | sitemap 与 `noindex` 不一致 → 信号矛盾 | 搜索引擎抓了又删，浪费 budget | 比对 sitemap URL 列表 vs HTML `<meta name="robots">` |

### 4.3 canonical（URL 规范化）

| Check | 期望值 | 失败影响 | 自动化方式 |
|---|---|---|---|
| 每个关键页有 canonical | `<link rel="canonical" href="<https-abs-url>">` 存在 | 重复内容稀释 PageRank | HTML parser 取 `link[rel=canonical]` |
| 自指或指向正确版本 | canonical 指向"最优代表版" | 错指 → 该页不被索引 | 比对 canonical href vs 当前 URL |
| 参数页正确收敛 | `?utm_*` / `?ref=*` / 排序参数页 → canonical 指向干净版本 | 大量参数变体被独立索引 | 跑参数化 URL 测试 |
| 协议/域名一致 | https 主域 → canonical 不能指向 http / 子域 / IP | 主版本不被识别 | URL 解析 |
| 无 canonical chain | A canonical → B canonical → C 这种链路 | 信号混乱 | 追踪 canonical 链 |
| 无 cross-domain 误指 | 不应误把 canonical 指到第三方域名 | 把流量送给别人 | host 比对 |

### 4.4 hreflang（多语言 / 多区域）

仅当站点有多语言或多区域版本时需要。

| Check | 期望值 | 自动化方式 |
|---|---|---|
| 每语言版本互相声明 | A 页声明 B 页，B 页也声明 A 页（**双向**） | parse `link[rel=alternate][hreflang]` |
| 含 `x-default` | 给无匹配语言的兜底版本声明 `hreflang="x-default"` | 解析 hreflang 集合 |
| 语言代码合法 | 符合 BCP 47（如 `en` / `en-US` / `zh-Hans` / `zh-Hant-TW`） | regex 校验 |
| URL 全部可达 | hreflang 指向的每个 URL 返回 200 | `curl -I` 遍历 |

### 4.5 metadata（基础页头）

| Element | 期望值 | 失败影响 |
|---|---|---|
| `<title>` | 50–60 半角字符（包含品牌），独一无二 | 截断 / 重复 → CTR 下降 |
| `<meta name="description">` | 150–160 字符，含目标关键词 + 价值主张 | 截断 / 搜索引擎自动生成 → 不可控 |
| `<h1>` | 每页恰好 1 个，与 title 语义对齐 | 主题不清 |
| `<meta name="robots">` | 默认无；明确 `index,follow` 或 `noindex,follow` | 误设 noindex → 该页不被索引（BLOCKER） |
| Open Graph | `og:title` / `og:description` / `og:image` / `og:url` / `og:type` | 社交分享卡片不可读 |
| Twitter Card（注：Twitter 已改名 X，业界正过渡到 "X card" 命名，技术 spec `twitter:card` meta tag 仍保留兼容） | `twitter:card` (`summary_large_image`) / `twitter:title` / `twitter:description` / `twitter:image` | Twitter 分享退化为纯链接 |
| `<img alt>` | 关键图片有 alt（Image Search + a11y） | Image Search 流量丢失 |
| `<html lang="...">` | 与页面主语言一致 | 语言检测错误 |
| Viewport | `<meta name="viewport" content="width=device-width,initial-scale=1">` | Mobile 不友好，影响 mobile-first indexing |

### 4.6 structured data（schema.org / JSON-LD）

> 推荐 **JSON-LD**（Google 官方首选），不要 Microdata / RDFa 混用。

| Page type | Recommended schema |
|---|---|
| 公司首页 | `Organization` + `WebSite` + `SearchAction` |
| 文章 / blog | `Article` 或 `BlogPosting`，含 `author` / `datePublished` / `image` / `headline` |
| 产品 | `Product` + `Offer` + `AggregateRating`（如有真实评分） |
| 面包屑 | `BreadcrumbList` |
| FAQ | `FAQPage`（仅当页面 visibly 显示 Q&A 时） |
| HowTo | `HowTo`（仅当页面 visibly 显示步骤时） |
| Video | `VideoObject` |
| `LocalBusiness` | **不在本 skill 范围** → 路由给 [`web-local-seo`](../web-local-seo/SKILL.md) |

**核心质量规则**：

1. **JSON-LD 优先**，放在 `<head>` 或 `<body>` 末尾
2. **schema 与可见内容必须一致** —— Google quality guidelines 明确：visible content 没出现的字段不能放进 schema（违反 → spam 标记）
3. **必填字段齐全** —— 用 [Schema Markup Validator](https://validator.schema.org) + [Google Rich Results Test](https://search.google.com/test/rich-results) 验证
4. **不要堆砌 schema** —— 用真正适合该页类型的，不要在 landing page 塞 7 个无关 schema

| Check | 自动化方式 |
|---|---|
| JSON-LD 解析 | parse `<script type="application/ld+json">`，跑 JSON.parse + schema validator |
| 必填字段 | 对照 schema.org spec 检查 |
| 与 visible content 一致 | 解析 DOM 取可见文本，比对 schema 字段值（核心字段如 `name` / `price` / `headline`） |

### 4.7 Lighthouse 自动化审计

最低跑 4 类，固定 CLI 命令：

```bash
npx lighthouse https://<url> \
  --only-categories=seo,performance,accessibility,best-practices \
  --output=json \
  --output-path="evidence/discoverability/$TAG/raw/lighthouse.json" \
  --chrome-flags="--headless --no-sandbox"
```

| Category | 默认目标 |
|---|---|
| SEO | ≥ 95 |
| Performance | ≥ 80（mobile）/ ≥ 90（desktop） |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 90 |

低于目标 → **warn-only**（不阻断 release，进报告）。但 SEO score 涉及 `noindex` / robots 误封等 → 升级为 BLOCKER（见 §6）。

### 4.8 Search Console / Bing Webmaster（监控）

| Check | 来源 | 期望 |
|---|---|---|
| Sitemap submitted | Search Console API `sitemaps.list` | 已提交且无错误 |
| Indexed pages | Search Console URL Inspection API | 关键页 `INDEXED` 状态 |
| Coverage errors | Search Console API | 0 critical error（关键页） |
| Impressions / clicks 趋势 | Search Analytics API（`searchanalytics.query`） | 用于 baseline，不强制阈值 |
| Manual action | Search Console UI / API | 必须 0（一旦有 manual action → BLOCKER） |

> 没有 OAuth credentials 时，本 skill 跳过 Search Console 子项，但在报告里标 "search_console_not_configured: true"，提示用户后续接入。

---

## 5. Framework adapter 速查

每个框架给关键文件 + 关键 API。**本 skill 不重写框架文档，只指向正确入口**。

### Next.js (App Router, ≥ 13.3)

| 任务 | 文件 / API |
|---|---|
| robots.txt | `app/robots.ts` → export default `() => Robots` |
| sitemap.xml | `app/sitemap.ts` → export default `() => MetadataRoute.Sitemap` |
| metadata | per-route `export const metadata: Metadata` 或 `generateMetadata()` |
| canonical | `metadata.alternates.canonical` |
| hreflang | `metadata.alternates.languages` |
| Open Graph image | `app/opengraph-image.tsx`（动态 OG 图） |
| Twitter image | `app/twitter-image.tsx` |
| JSON-LD | 在 layout / page 里渲染 `<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>` |

### Nuxt (3.x)

| 任务 | 文件 / API |
|---|---|
| 全局 site config | `nuxt.config.ts` → `site: { url, name, description, defaultLocale }` |
| robots / sitemap / schema.org / og image | `@nuxtjs/seo`（Nuxt SEO module bundle） |
| canonical | `useHead({ link: [{ rel: 'canonical', href }] })` 或 `@nuxtjs/seo` 自动 |
| JSON-LD | `useSchemaOrg([...])`（来自 `nuxt-schema-org`） |

### Astro

| 任务 | 文件 / API |
|---|---|
| sitemap | integration `@astrojs/sitemap` |
| canonical | 在 layout 里 `<link rel="canonical" href={canonicalURL.toString()}>`，`canonicalURL = new URL(Astro.url.pathname, Astro.site)` |
| metadata | frontmatter prop → `<head>` 渲染 |
| JSON-LD | astro component 渲染 `<script type="application/ld+json" set:html={JSON.stringify(jsonLd)}>` |

### Docusaurus (≥ 3.x)

| 任务 | 文件 / API |
|---|---|
| sitemap | 内置 `@docusaurus/plugin-sitemap`（默认启用） |
| docs frontmatter | `title` / `description` / `keywords` / `image` / `slug` |
| canonical | docs frontmatter `slug` + `presets[0].docs.routeBasePath`；versioned docs 自动生成 canonical 指向 latest |
| 全站 metadata | `docusaurus.config.js` → `themeConfig.metadata` |

### WordPress

| 任务 | 文件 / API |
|---|---|
| sitemap | core XML sitemap（5.5+ 内置 `/wp-sitemap.xml`），或用 Yoast / Rank Math 覆盖 |
| title meta | 主题 `wp_head()` + Yoast / Rank Math |
| schema / JSON-LD | Yoast / Rank Math 插件，或主题 functions.php 注入 |
| canonical | 默认由 Yoast / Rank Math 输出 |

### Generic static site（无框架）

手动维护：

```
public/
├── robots.txt
├── sitemap.xml
└── <each .html>
    └── <head>
        ├── <title>
        ├── <meta name="description">
        ├── <link rel="canonical">
        ├── <link rel="alternate" hreflang="...">
        ├── <meta property="og:*">
        ├── <meta name="twitter:*">
        └── <script type="application/ld+json">{...}</script>
```

---

## 6. Blocker（必须阻断 release）

下列任一成立 → release gate FAIL，必须修复才能 ship。

| Blocker ID | 触发条件 | 原因 |
|---|---|---|
| `critical_public_page_returns_4xx_or_5xx` | 任何关键 public URL（首页 / pricing / 主要 product page）follow redirects 后最终响应为 4xx/5xx，**或** redirect chain 错误 / 跨域误跳 / 循环 redirect。合法 301/308 canonical redirect **不**算 blocker。 | 用户与搜索引擎都看不到 |
| `critical_public_page_has_unintended_noindex` | 关键页 HTML 含 `<meta name="robots" content="noindex">` 或响应头 `X-Robots-Tag: noindex`，且非主观设计 | 该页彻底从搜索索引消失 |
| `critical_public_page_blocked_by_robots` | robots.txt `Disallow` 命中关键 URL | 搜索引擎被礼貌挡在外面 |
| `canonical_misdirected_to_404_or_cross_domain` | canonical 指向 4xx URL / 跨域 / IP / 错误协议（关键页可索引性受影响） | 该页不被索引；流量被送给错误目标 |
| `structured_data_content_mismatch_with_visible_page` | schema 字段（`price` / `rating` / `name` 等）与可见内容不一致 | 违反 Google quality guidelines → spam 风险 |
| `pure_client_rendered_page_has_empty_primary_content` | 主要内容只在 JS 执行后存在（CSR-only），server-rendered HTML 为空骨架 | Google JS 渲染有延迟，Bing / Baidu / AI crawler 通常不执行 JS → 关键内容不可索引 |
| `private_or_authenticated_content_exposed_publicly` | 应 auth 的页面被搜索引擎抓到（discoverability 失误） | **本 skill 标识 + escalate → AppSec 处理 authorization**，本 skill 不做修复 |
| `production_site_serves_staging_robots_txt_disallow_all` | production 域名 `robots.txt` 含 `User-agent: *` + `Disallow: /` | 整站从搜索消失，致命 |
| `search_console_manual_action_active` | Google Search Console 显示 active manual action | 已被 Google 惩罚，必须先 cleanup |

---

## 7. Warn-only（不阻断，进报告）

| Warn ID | 含义 |
|---|---|
| `missing_canonical_on_duplicate_or_parameterized_pages` | 重复内容 / 参数化 URL 无 canonical（warn-only；仅当 canonical 指向 404 / 跨域 / 错协议时升级为 blocker `canonical_misdirected_to_404_or_cross_domain`） |
| `sitemap_missing_for_multi_page_public_site` | 站点超过 ~20 个 public page 但无 sitemap.xml（warn-only；索引延迟但不致命） |
| `structured_data_invalid_on_required_page_type` | 关键 schema（Article / Product / Breadcrumb）JSON-LD 解析失败或必填字段缺（warn-only；仅当与可见内容不一致时升级为 blocker `structured_data_content_mismatch_with_visible_page`） |
| `lighthouse_seo_score_below_target` | Lighthouse SEO < 95 |
| `lighthouse_performance_score_below_target` | Lighthouse Performance 低于 mobile 80 / desktop 90 |
| `missing_open_graph_or_twitter_cards` | 缺 og / twitter card，社交分享降级 |
| `weak_meta_description` | 描述短于 80 字符或缺失（搜索引擎自动生成） |
| `title_too_long_or_too_short` | title < 30 或 > 70 字符 |
| `image_alt_text_sparse` | 关键图片 alt 缺失比例 > 30% |
| `weak_internal_linking` | 关键页之间无内链（PageRank 流不畅） |
| `hreflang_missing_for_multilingual_site` | 检测到多语言 URL 但无 hreflang 声明 |
| `mixed_canonical_protocols` | canonical 协议与当前 URL 不一致（http vs https） |
| `sitemap_lastmod_is_build_timestamp` | `lastmod` 字段疑似 build 时间而非真实更新时间 |
| `search_console_not_configured` | 无 OAuth credentials 接入 Search Console，无法监控索引状态 |

---

## 8. CLI 命令示例

### 入口命令（统一调度）

> **路径约定（v1.2 harness）**：下列 raw 脚本产物写到 **tag-scoped** 的 raw 工作目录 `evidence/discoverability/<tag>/raw/`，最终经 `discoverability-sdk evidence.append <tag> seo <file>` 归一化进 canonical channel evidence `evidence/discoverability/<tag>/seo.json`。**禁止**写 flat `evidence/discoverability/seo/`（无 `<tag>` 维度，命中 harness forbidden_paths）。下例用 shell 变量 `TAG` 占位。

```bash
pnpm discoverability:audit:seo \
  --url https://example.com \
  --out "evidence/discoverability/$TAG/raw"
```

该命令应按顺序执行下列子任务并写出 raw JSON，随后 append 进 `seo.json`。

### 8.1 fetch robots.txt

```bash
mkdir -p "evidence/discoverability/$TAG/raw"
curl -sS -A "web-seo-audit/1.0" \
  -o "evidence/discoverability/$TAG/raw/robots.txt" \
  -w '{"status":%{http_code},"url":"%{url_effective}","time_total":%{time_total}}' \
  https://example.com/robots.txt \
  > "evidence/discoverability/$TAG/raw/robots-meta.json"
```

### 8.2 fetch sitemap.xml

```bash
curl -sS -A "web-seo-audit/1.0" \
  -o "evidence/discoverability/$TAG/raw/sitemap.xml" \
  -w '{"status":%{http_code},"size":%{size_download}}' \
  https://example.com/sitemap.xml \
  > "evidence/discoverability/$TAG/raw/sitemap-meta.json"
```

### 8.3 Lighthouse 全套

```bash
npx lighthouse https://example.com \
  --only-categories=seo,performance,accessibility,best-practices \
  --form-factor=mobile \
  --output=json \
  --output-path="evidence/discoverability/$TAG/raw/lighthouse-mobile.json" \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"

npx lighthouse https://example.com \
  --only-categories=seo,performance,accessibility,best-practices \
  --form-factor=desktop \
  --preset=desktop \
  --output=json \
  --output-path="evidence/discoverability/$TAG/raw/lighthouse-desktop.json" \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"
```

### 8.4 批量 status code 检查（来自 sitemap）

```bash
# 假设 sitemap.xml 解析后产出 urls.txt（一行一个 URL）
while IFS= read -r url; do
  code=$(curl -sS -o /dev/null -A "web-seo-audit/1.0" -w "%{http_code}" "$url")
  printf '{"url":"%s","status":%s}\n' "$url" "$code"
done < urls.txt > "evidence/discoverability/$TAG/raw/status-codes.ndjson"
```

### 8.5 parse structured data

使用 Node 脚本（建议项目内 `scripts/parse-jsonld.mjs`）：

```bash
node scripts/parse-jsonld.mjs https://example.com \
  > "evidence/discoverability/$TAG/raw/structured-data.json"
```

脚本要点：fetch HTML → 提取所有 `<script type="application/ld+json">` → `JSON.parse` → 输出 `[{ valid, type, errors, raw }]`。

---

## 8.6 quality_gates 字段映射

`discoverability.config.yaml` 的 `quality_gates.seo.*` 字段与本 SKILL 章节的对应关系。runner 拿 config 字段决定 audit 严格度时用此表反查具体 check 的所在节。

| Config 字段 | 对应 SKILL 章节 | Blocker / Warn |
|---|---|---|
| `require_robots_txt` | §4.1 robots.txt | blocker（缺失 + production 时）|
| `require_sitemap_xml` | §4.2 sitemap.xml | blocker（多页公开站缺失时）|
| `require_canonical` | §4.3 canonical | blocker（关键页 misdirected）/ warn（其余）|
| `require_status_200_for_critical_pages` | §6 `critical_public_page_returns_4xx_or_5xx` | blocker |
| `require_no_unintended_noindex` | §6 `critical_public_page_has_unintended_noindex` | blocker |
| `require_structured_data_for_supported_page_types` | §4.6 structured data | warn（缺失）/ blocker（与可见内容不一致）|
| `require_open_graph_for_share_targets` | §4.5 metadata (Open Graph) | warn |
| `require_hreflang_for_multilingual` | §4.4 hreflang | warn（多语言站缺 hreflang 升级为 §7 `hreflang_missing_for_multilingual_site`；仅当 `project.locales` > 1 才强制）|
| `require_structured_data_matches_visible_content` | §4.6 + §6 `structured_data_content_mismatch_with_visible_page` | blocker |
| `require_non_empty_server_rendered_primary_content` | §6 `pure_client_rendered_page_has_empty_primary_content` | blocker |
| `require_sitemap_excludes_private_noindex_4xx_staging_urls` | §4.2 sitemap.xml（不包含 private / noindex 页）| warn / escalate to AppSec（若涉及私密页）|
| `require_production_robots_txt_not_staging` | §6 `production_site_serves_staging_robots_txt_disallow_all` | blocker |

字段名在 `quality_gates.seo.*` 下显式 false 时，对应 check 降级为 info 或跳过；显式 true 或缺省按上表 severity 强制。

---

## 9. Evidence 输出格式

Canonical channel evidence（v1.2 harness，tag-scoped）：归一化后的 finding 落 `evidence/discoverability/<tag>/seo.json`（由 `discoverability-sdk evidence.append <tag> seo <file>` 写入）；raw 脚本产物落同一 tag 下的 `raw/` 工作目录，供 `evidence_ref` 反查：

```
evidence/discoverability/<tag>/
├── seo.json                     # ← canonical channel evidence（findings[] 聚合 + source 字段，append 产出）
└── raw/                         # raw 脚本产物（pre-append 工作文件，被 seo.json 的 evidence_ref 引用）
    ├── robots.json              # parsed robots.txt rules + sitemap declarations
    ├── robots.txt               # raw fetch
    ├── sitemap.json             # parsed URL list + lastmod + size + child sitemaps
    ├── sitemap.xml              # raw fetch
    ├── canonical.json           # per-page: { url, canonical, self-referential, conflicts }
    ├── hreflang.json            # per-page: { url, alternates: [{ hreflang, href, status }] }
    ├── status-codes.json        # per-URL: { url, status, redirect_chain }
    ├── metadata.json            # per-page: { title, description, h1, og, twitter, viewport, lang }
    ├── structured-data.json     # per-page: parsed JSON-LD + validation
    ├── lighthouse-mobile.json   # raw Lighthouse output (mobile)
    ├── lighthouse-desktop.json  # raw Lighthouse output (desktop)
    └── search-console.json      # Search Console API snapshot（可选）
```

> **禁止** flat `evidence/discoverability/seo/`（无 `<tag>`）、`findings.json` 顶层聚合文件、`gate-result.json`。gate 产物只由 `discoverability-sdk gate.check` 写 `<tag>/gate-result.yaml`；channel 聚合统一为 `<tag>/seo.json`。

`seo.json` 的 `findings[]` 元素 schema（contract §4 canonical channel schema）：

```json
{
  "_schema_version": "1.0.0",
  "tag": "<tag>",
  "channel": "seo",
  "source": "script",
  "findings": [
    {
      "id": "critical_public_page_has_unintended_noindex",
      "severity": "blocker",
      "evidence_path": "raw/metadata.json#/pages/0/robots",
      "url": "https://example.com/pricing",
      "title": "<meta name=\"robots\" content=\"noindex\"> present on critical page",
      "suggested_fix": "remove noindex meta in app/pricing/page.tsx"
    },
    {
      "id": "lighthouse_seo_score_below_target",
      "severity": "warn",
      "evidence_path": "raw/lighthouse-mobile.json#/categories/seo/score",
      "actual": 0.88,
      "target": 0.95
    }
  ]
}
```

> 私密页被公开收录类问题 → 在 finding 上加 `tags: ["private"]`，validator 会自动 escalate 给 `appsec-security-orchestrator`（见 §14.3）；本 skill 只标识不修。

---

## 10. 常见误区 / 反模式

| ❌ 反模式 | ✅ 正确做法 |
|---|---|
| 把 robots.txt 当 access control | 用 auth / authorization；robots.txt 只防礼貌 crawler |
| 用 `noindex` 替代权限控制 | `noindex` 是 discoverability 信号，不阻止直接访问；敏感页要 auth |
| 让 AI 自己读网页"猜 SEO" | 先跑 Lighthouse / curl / parser 出 evidence，AI 只解释 |
| 用 SPA 但不做 SSR/SSG | Bing / Baidu / 多数 AI crawler 不执行 JS；关键 public 内容必须 server-render（Next SSR/SSG、Nuxt SSR、Astro static、Docusaurus build） |
| structured data 和可见内容不一致 | schema 字段必须能在 visible DOM 上找到对应内容 |
| production 留 staging `robots.txt: Disallow /` | 部署 pipeline 必须按环境注入正确 robots.txt |
| 一个站点多份 sitemap，各家自动生成互不知道 | 用 sitemap index 统一 |
| canonical 指向 redirect 链 | canonical 应指向最终 200 URL，不要再触发 redirect |
| 把内部 admin 路径放进 sitemap | sitemap 只放希望被索引的 public URL |
| 修改后立刻声称"SEO 修好了" | 等 Search Console 重新爬过并出现新 status，再下结论 |
| 改 title / description 不看 SERP CTR baseline | 先记 baseline，修改后对比 impressions/clicks 趋势 |

---

## 11. 权威来源参考

权威性递减，引用克制：

1. **Google Search Essentials** —— [`https://developers.google.com/search/docs/essentials`](https://developers.google.com/search/docs/essentials)
2. **Google JavaScript SEO Basics** —— [`https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics`](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
3. **sitemaps.org Protocol** —— [`https://www.sitemaps.org/protocol.html`](https://www.sitemaps.org/protocol.html)
4. **RFC 9309: Robots Exclusion Protocol** —— [`https://www.rfc-editor.org/rfc/rfc9309.html`](https://www.rfc-editor.org/rfc/rfc9309.html)
5. **schema.org** —— [`https://schema.org/docs/schemas.html`](https://schema.org/docs/schemas.html)
6. **Lighthouse Scoring** —— [`https://developer.chrome.com/docs/lighthouse/overview`](https://developer.chrome.com/docs/lighthouse/overview)
7. **Google Search Console API** —— [`https://developers.google.com/webmaster-tools/v1/api_reference_index`](https://developers.google.com/webmaster-tools/v1/api_reference_index)

> **不要在本 skill 里复述这些文档的细节**。指向入口，让用户/AI 必要时去查。

---

## 12. 上下游路由

| 情况 | 路由到 |
|---|---|
| 想做 AI search / LLM answer engine 优化 | [`web-aeo`](../web-aeo/SKILL.md) |
| 涉及 LocalBusiness / Google Business Profile / 地区门店 | [`web-local-seo`](../web-local-seo/SKILL.md) |
| 涉及 App Store / Google Play | [`app-aso`](../app-aso/SKILL.md) |
| 发现敏感页被搜索引擎收录 / authorization 问题 | `appsec-security-orchestrator`（本 skill 只标识，不修） |
| 性能问题超出 SEO 范围（CWV 深度优化） | `qa-performance-reliability` |
| 发现 a11y 失败导致 SEO 信号变差 | `qa-a11y-compliance` |
| 多环境一致性问题（dev robots vs prod robots 漂移） | `env-parity-baseline` |

---

## 13. 完成判据

本 skill 视为"已完成一轮 audit"，必须满足：

- [ ] `evidence/discoverability/<tag>/seo.json` 已生成（canonical channel evidence，经 evidence.append 归一化），raw 产物在 `<tag>/raw/` 下齐全
- [ ] `seo.json` 的 `findings[]` 中 blocker 数 = 0 或全部已被用户 acknowledge
- [ ] Lighthouse mobile + desktop 各跑过一次
- [ ] sitemap.xml 内所有关键 URL 均 200
- [ ] robots.txt 未误封任何关键 public URL
- [ ] 关键页 canonical + metadata 齐全
- [ ] structured data 在 schema.org validator 全部 valid（如有声明）
- [ ] 报告给出至少 3 条可执行 fix（如有 warnings）

不要在 evidence 缺失的情况下声称"SEO 已 OK"。

---

## 14. L12 Harness Integration (v1.2+)

本 skill 在 L12 harness v1.0 模式下作为 `seo` channel 的 deterministic auditor，evidence 必须经 `discoverability-sdk.py evidence.append` 入库。

### 14.1 Canonical evidence channel

| 维度 | 值 |
|---|---|
| Config 端 | `channels.seo` |
| Evidence / SDK / harness channel key | `seo`（canonical，与 config 同名）|
| Narrow skill name | `web-seo`（frozen — 改名 = 打掉 safety surface）|
| Evidence path | `evidence/discoverability/<tag>/seo.json` |
| 必备 schema 字段 | `_schema_version`, `tag`, `channel: seo`, `source ∈ {script, api, framework_adapter, manual_ai_scan}`, `findings[]` |
| 提交命令 | `python scripts/discoverability-sdk.py evidence.append <tag> seo <path-to-your-raw-output>` |

### 14.2 Script-first 强制（harness §8.2 + orchestrator §3）

必须先跑 deterministic source（Lighthouse / curl status-code probe / sitemap parser / robots.txt parser / Schema.org validator / Search Console API），然后才让 AI synthesis。**至少 1 个 finding 的 `source` 必须 ∈ {`script`, `api`, `framework_adapter`}**。

全部 source=`manual_ai_scan` → `disc-evidence-validator` 标 hard_rule_violation `all_evidence_manual_ai_scan_no_deterministic_fallback` → `gate.check` 输出 **BLOCKED**。反模式：让 AI 凭感觉读 raw HTML 给"看起来合理的"分数。

### 14.3 SEO 域 blocker / warn 与 harness gate-result 对齐

**Blocker（强制 release 阻断）**：

- `critical_public_page_returns_4xx_or_5xx`
- `critical_public_page_has_unintended_noindex`
- `critical_public_page_blocked_by_robots`
- `missing_canonical_on_duplicate_or_parameterized_pages`
- `structured_data_invalid_on_required_page_type`
- `structured_data_content_mismatch_with_visible_page`（cloaking）
- `production_site_serves_staging_robots_txt_disallow_all`
- `private_or_authenticated_content_exposed_publicly` → **escalate to AppSec**

**Warn-only（不阻断 release，进 report）**：

- `lighthouse_seo_score_below_target`
- `missing_open_graph_or_twitter_cards`
- `weak_meta_description`
- `image_alt_text_sparse`
- `hreflang_missing_for_multilingual_site`

详细 finding ID 定义见 §6（Blocker）+ §7（Warn-only）；harness 对齐细则见 `~/.claude/rules/discoverability-l12.md` 与 harness-contract §10.1。

### 14.4 Safety-critical name freeze

引用 `discoverability-orchestrator/SKILL.md §15.1`。本 skill 相关受保护名称（改名 = 打掉 evidence validator / SDK / hooks 全链路 safety surface）：

- skill name: **`web-seo`**
- channel key: **`seo`**
- evidence path 前缀: **`evidence/discoverability/<tag>/seo.*`**

### 14.5 依赖 harness 组件清单

| 组件 | 路径 |
|---|---|
| Orchestrator | `discoverability-orchestrator/SKILL.md` §10 |
| SDK | `scripts/discoverability-sdk.py`（10 commands）|
| Contract | `~/.claude/templates/discoverability/harness-contract.md` §1 §4 |
| Validator agent | `disc-evidence-validator` |
