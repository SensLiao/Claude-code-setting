# SCAN Vector Schema v2.0.0

> 本文件定义 `claude-env-bootstrap` v2.0.0 SCAN 阶段输出的 **signal_vector** 数据结构。
> 引擎依赖此向量做 selector 评估,所以**每个字段定义必须明确、可由文件信号检测**。
>
> 修改本 schema = 修改 catalog.json selector 的可用维度,务必同步更新两个文件。

---

## 1. 设计原则

1. **可机器检测**:每个 signal 都能由具体文件 / 目录 / 内容 grep 推断,不依赖用户主观判断
2. **正交**:维度之间不重叠(`framework: next` 跟 `runtime: node` 是两件事,不合并)
3. **数组优先**:支持多值就用数组(`lang: [ts, py]`),需要单选才用字符串
4. **缺省安全**:未检测到 = `[]` / `null` / `false`,不为 `unknown`(避免触发"防御性匹配")
5. **derived 在最后**:raw signals 由 SCAN 直接产出,derived signals 在 COMPOSE 前由 inference 规则推导

---

## 2. Raw Signals(25 维)

### 2.1 技术栈维度

| 字段 | 类型 | 取值 | 检测信号 |
|---|---|---|---|
| `lang` | `string[]` | `ts` / `js` / `py` / `go` / `rust` / `java` / `kotlin` / `swift` / `cpp` / `csharp` / `dart` / `php` / `ruby` | 文件后缀 + manifest 文件 |
| `framework` | `string[]` | `next` / `nuxt` / `remix` / `astro` / `svelte` / `vue` / `react-only` / `swiftui` / `spring` / `django` / `fastapi` / `rails` / `laravel` / `flutter` | `package.json` deps / `pom.xml` 关键字 / `pubspec.yaml` |
| `runtime` | `string[]` | `node` / `browser` / `ios` / `android` / `jvm` / `deno` / `bun` / `edge-function` | manifest 工具链 + 部署文件 |
| `package_manager` | `string` | `pnpm` / `yarn` / `npm` / `bun` / `pip` / `poetry` / `uv` / `cargo` / `go-mod` / `gradle` / `maven` / `swift-pm` / `pubspec` | lockfile 类型 / `packageManager` 字段 |
| `ci_state` | `string` | `github-actions` / `gitlab-ci` / `jenkins` / `none` | `.github/workflows/` / `.gitlab-ci.yml` / `Jenkinsfile` |

### 2.2 部署 / 运行环境

| 字段 | 类型 | 取值 | 检测信号 |
|---|---|---|---|
| `deploy_target` | `string[]` | `vercel` / `netlify` / `k8s` / `docker-compose` / `vm-systemd` / `serverless` / `cloudflare-workers` / `app-store` / `play-store` / `none` | `vercel.json` / `netlify.toml` / `k8s/` / `compose.yaml` / `systemd/` / `serverless.yml` / `wrangler.toml` / `Package.swift` / `android/` |
| `data_layer` | `string[]` | `sql-db` / `nosql` / `redis` / `queue` / `blob-storage` / `vector-db` / `none` | env 关键字 / docker-compose services / migration 目录 |
| `secrets_origin` | `string` | `local-env` / `github-secrets` / `k8s-secret` / `cloud-sm` / `vault` / `unknown` / `none` | `.env` / `.github/workflows/*secrets*` / `Secret.yaml` / sdk import |
| `env_baseline_gaps` | `string[]` | `missing-nvmrc` / `missing-lockfile` / `missing-env-example` / `missing-validator` / `missing-gitattributes` / `missing-editorconfig` / `missing-healthz` / `missing-migration-tool` / `secret-in-dockerfile` | 见 SKILL.md §3.4 检测表 |

### 2.3 表面 / 形态

| 字段 | 类型 | 取值 | 检测信号 |
|---|---|---|---|
| `surface` | `string[]` | `public-web` / `internal-web` / `mobile-app` / `cli` / `lib` / `docs-site` / `design-prototype` / `research` | 部署 + UI 检测 + Q2 答案 |
| `ui_present` | `bool` | `true` / `false` | 前端框架检测 / `*.tsx` / `*.vue` / `*.swift` view / `*.dart` widget |
| `content_type` | `string[]` | `marketing-site` / `docs-site` / `dashboard` / `editor` / `content-app` / `none` | 框架(docusaurus / starlight / nextra)/ 目录(`docs/`)/ Q1 描述 |
| `distribution` | `string[]` | `web-only` / `app-store` / `play-store` / `internal-only` / `none` | 部署 + native 工程 |

### 2.4 风险面 / AppSec 触发

| 字段 | 类型 | 取值 | 检测信号 |
|---|---|---|---|
| `risk_surface` | `string[]` | `auth` / `payment` / `multitenant` / `file-upload` / `websocket` / `llm-agentic` / `cn-data` / `pii` / `admin` / `public-api` / `financial` | grep 代码 + 依赖 + schema |
| `multitenant_signal` | `bool` | `true` / `false` | grep `tenant_id` / `org_id` / subdomain routing / Row-Level Security policy |
| `payment_signal` | `bool` | `true` / `false` | deps: `stripe` / `square` / `alipay-sdk` / `wechatpay-node-v3` |
| `cn_data_signal` | `bool` | `true` / `false` | `.cn` 域名 / 中文 README + 处理用户数据 / PIPL 关键字 / 服务部署阿里云腾讯云 |
| `mobile_native_signal` | `bool` | `true` / `false` | `Package.swift` / `android/` / `ios/` / `pubspec.yaml` |

### 2.5 工作流 / 历史状态

| 字段 | 类型 | 取值 | 检测信号 |
|---|---|---|---|
| `workflow_state` | `string[]` | `gsd-active` / `sens-design-active` / `design-folder-present` / `planning-present` / `fresh-init` / `bootstrap-existing` | `.planning/` / `Design/` / `.claude/CLAUDE.md` |
| `style_intent` | `string` | `taste` / `luxury` / `brutalist` / `undecided` / `none` | Q3 答案;默认 `none`(无 UI 时)；taste 含 Editorial / Double-Bezel / GSAP 三变体，原 minimalist / soft / gpt-taste 场景已并入 taste |
| `meeting_audio_present` | `bool` | `true` / `false` | `transcript/` / `*.aac` / `*.mp3` >5 个 |
| `notebook_research` | `bool` | `true` / `false` | `notebooks/` / `*.ipynb` >3 个 |

### 2.6 AI / LLM 维度

| 字段 | 类型 | 取值 | 检测信号 |
|---|---|---|---|
| `llm_provider` | `string[]` | `anthropic` / `openai` / `google` / `mixed` / `none` | deps: `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` |
| `ai_pattern` | `string` | `chat` / `agentic` / `rag` / `batch` / `eval-only` / `none` | grep `tool_use` / `tools=` / vector-db / eval framework |
| `ai_referenceable` | `bool` | `true` / `false` | 公开 docs site / 内容站点 / llms.txt 已存在或适合存在 |
| `local_seo_signal` | `bool` | `true` / `false` | NAP 信息 / store locator / `geo:` schema.org / "本地服务" Q1 答案 |

---

## 3. Derived Signals(由 inference 推导)

由 COMPOSE 第一步根据 raw signals 自动推导。**不由 SCAN 直接产出**。

| Derived | 推导规则 |
|---|---|
| `is_saas` | `payment_signal == true` AND `multitenant_signal == true` AND `surface ⊇ [public-web]` |
| `is_consumer_web` | `surface ⊇ [public-web]` AND NOT `risk_surface ⊇ [admin, multitenant]` |
| `is_b2b_internal` | `surface ⊇ [internal-web]` AND `risk_surface ⊇ [auth]` |
| `is_research_only` | `notebook_research == true` AND `deploy_target ⊇ [none]` AND `ui_present == false` |
| `is_proposal_demo` | `workflow_state ⊇ [design-folder-present]` AND Q2 答案 = `提案型 demo` |
| `needs_release_gate` | `surface ⊇ [public-web]` OR `distribution ⊇ [app-store, play-store]` |
| `needs_compliance_payment` | `payment_signal == true` AND `risk_surface ⊇ [financial]` |
| `needs_compliance_cn` | `cn_data_signal == true` AND `risk_surface ⊇ [pii]` |

---

## 4. 示例向量(参考)

### 4.1 Next.js + Stripe + Supabase 多租户 SaaS

```json
{
  "lang": ["ts"],
  "framework": ["next"],
  "runtime": ["node", "edge-function", "browser"],
  "package_manager": "pnpm",
  "ci_state": "github-actions",
  "deploy_target": ["vercel"],
  "data_layer": ["sql-db"],
  "secrets_origin": "github-secrets",
  "env_baseline_gaps": ["missing-env-example"],
  "surface": ["public-web"],
  "ui_present": true,
  "content_type": ["dashboard", "marketing-site"],
  "distribution": ["web-only"],
  "risk_surface": ["auth", "payment", "multitenant", "pii", "public-api"],
  "multitenant_signal": true,
  "payment_signal": true,
  "cn_data_signal": false,
  "mobile_native_signal": false,
  "workflow_state": ["fresh-init"],
  "style_intent": "taste",
  "meeting_audio_present": false,
  "notebook_research": false,
  "llm_provider": ["anthropic"],
  "ai_pattern": "agentic",
  "ai_referenceable": true,
  "local_seo_signal": false,
  "_derived": {
    "is_saas": true,
    "is_consumer_web": false,
    "is_b2b_internal": false,
    "is_research_only": false,
    "is_proposal_demo": false,
    "needs_release_gate": true,
    "needs_compliance_payment": false,
    "needs_compliance_cn": false
  }
}
```

→ 触发(部分):`gsd-*` core + `enterprise-qa-testing` + `appsec-security-orchestrator` + `security-app-multitenant` + `security-app-llm` + `security-platform-secrets` + `discoverability-orchestrator` + `web-seo` + `web-aeo` + `taste-skill` + `vercel:*` + `claude-api`

### 4.2 纯 Python research 项目(notebook + 论文)

```json
{
  "lang": ["py"],
  "framework": [],
  "runtime": ["browser"],
  "package_manager": "poetry",
  "ci_state": "none",
  "deploy_target": ["none"],
  "data_layer": ["none"],
  "secrets_origin": "none",
  "env_baseline_gaps": ["missing-lockfile"],
  "surface": ["research"],
  "ui_present": false,
  "content_type": ["none"],
  "distribution": ["none"],
  "risk_surface": [],
  "multitenant_signal": false,
  "payment_signal": false,
  "cn_data_signal": false,
  "mobile_native_signal": false,
  "workflow_state": ["fresh-init"],
  "style_intent": "none",
  "meeting_audio_present": false,
  "notebook_research": true,
  "llm_provider": [],
  "ai_pattern": "none",
  "ai_referenceable": false,
  "local_seo_signal": false,
  "_derived": {
    "is_research_only": true,
    "needs_release_gate": false
  }
}
```

→ 触发(部分):`gsd-spec-phase` + `gsd-plan-phase` + `gsd-execute-phase` + `python-reviewer` + `env-parity-baseline`
不装:任何 UI / AppSec / Discoverability / QA — 因为 surface = research,risk_surface 为空,distribution = none

---

## 5. 检测优先级

raw signal 检测有顺序:**文件结构** > **manifest 内容** > **代码 grep** > **用户回答**

例如 `risk_surface ⊇ [payment]`:
1. 先看 deps(`stripe` / `square`)
2. 再 grep 代码(`createPaymentIntent` / `chargeCard`)
3. 都没有再依赖 Q3 "处理支付吗?"答案

**不准只靠用户主观回答触发** — 否则用户胡乱填会污染向量。SCAN 必须先尽力机器推断,ASK 只补缺。

---

## 6. 修改本 schema 的约束

加新字段时:
1. 必须给出可靠的检测信号(可由 Read/Grep/Glob 完成)
2. 必须更新 catalog.json 至少一个 selector 引用它,否则字段无用
3. 同步更新 SKILL.md §3 SCAN 章节的检测表

删除或重命名字段时:
1. catalog.json 中所有引用必须同步改
2. 在 SKILL.md CHANGELOG 留一行说明

不准:
- 加"模糊布尔"(`is_complex` / `looks_like_X`)— 不可机器检测
- 加 raw signal 而不加检测规则
