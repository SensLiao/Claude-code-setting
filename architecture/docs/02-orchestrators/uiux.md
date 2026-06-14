# UIUX Product Orchestrator — 深度解析

> **版本**: v2.3.0 (Product Experience Orchestrator)  
> **主线**: UIUX | **执行模式**: SKILL-direct only（L3 风格互斥 + 交互式选择不适合单 pass DAG）  
> **触发条件**: `.uiux/config.json` 存在时 auto 激活；`strict_mode=strict` 硬 block release，`lax` 仅 hook warn

UIUX 主线负责设计质量、视觉一致性和前端产品体验，从接地消除幻觉到六阶段质量引擎，再到
下游 QA / AppSec / L12 Discoverability 的 release gate。

---

## 1. 六阶段质量引擎状态机（P0 → P5）

六阶段是一个**有环状态机**：P4 检查不过回 P3，P5 review 不过回 P4 / P3，直到
`uiux-sdk gate.ship` 放行。每次启动前按 ask-first tier（`min` / `optimal` / `max`，
default `optimal`）决定深度。

```mermaid
flowchart TB
  Start([create / optimize UIUX task]) --> Ask{ask-first tier\nmin · optimal · max}
  Ask --> P0

  subgraph P0["P0 GROUND — 硬前提"]
    GCheck{local 58-brand\nDESIGN.md corpus?}
    GCheck -->|0 hits| StopAsk[STOP — 询问人类\n绝不回退到模型先验]
    GCheck -->|found| WriteGround[写 design/grounding.md\npalette · type · spacing · motion\n+ provenance]
  end

  WriteGround --> P1

  subgraph P1["P1 EXPLORE — 并行探索"]
    Fan[prototyping-ui-directions\nparallel fan-out N candidates]
    Fan --> Dirs["写 design/directions/&lt;n&gt;.md ×N\n不写 chassis · 不触发 mutex"]
    Dirs --> ShowUser[SHOW to human]
  end

  ShowUser --> P2

  subgraph P2["P2 PICK — 唯一锁点"]
    PreSel[orchestrator 预选 1-3 候选\n禁止 default-select]
    PreSel --> HumanPick{人类决定}
    HumanPick --> WriteLock["写 .uiux/lock/style-lock.yaml\nactive_lens 从 6 lenses 中选 1"]
    WriteLock --> MutexOn["mutex guard 激活\nuiux-style-mutex-guard.js"]
  end

  MutexOn --> P3

  subgraph P3["P3 BUILD — 单一风格构建"]
    Build[在锁定 lens 下构建多 surface\nsurface-inventory.yaml build_status 追踪]
    Build --> NoPad[no-silent-truncation:\npending · failed 必须 surface]
    NoPad --> Chassis[写 chassis.yaml]
  end

  Chassis --> P4

  subgraph P4["P4 UNIFY — 机械 gate，确定性"]
    Tok[tokenize → ux-principles MODE B → visual-critique]
    Tok --> Scan["token-compliance 扫描\n☑ 模块化 type scale\n☑ 4·8 spacing grid\n☑ no hardcoded hex\n☑ semantic token layer\n☑ nested radius\n☑ shadows ≤ 4\n☑ background_atmosphere declared\n☑ 每个交互元素有状态描述"]
    Scan --> P4Pass{全部通过?}
    P4Pass -->|fail| P3
    P4Pass -->|pass| P5
  end

  subgraph P5["P5 REVIEW — 循环，无早退"]
    R1["ux-principles MODE C\nNielsen 10-heuristic + Built-for-Mars"]
    R1 --> R2["gsd-ui-review (6-pillar)\n— GSD-owned source of truth"]
    R2 --> R3["santa-loop dual-model\nCodex /codex:adversarial-review\n(max tier)"]
    R3 --> AllPass{所有 surface\nreview_status == reviewed-pass?}
    AllPass -->|fail| P4
    AllPass -->|pass| Ship
  end

  Ship["uiux-sdk gate.ship"] --> Downstream["下游: QA · AppSec · L12 Discoverability"]

  StopAsk -.->|人类提供 brand docs| P0
```

> P5 是**设计质量 prompt-level gate**，不是 governed release verdict（那是 AppSec / QA 的责任域）。

---

## 2. 各阶段详解

| Phase | 名称 | 核心逻辑 | 产物路径 |
|---|---|---|---|
| **P0** | GROUND | local-first 读取 58-brand DESIGN.md 语料；0 命中 → 立即 STOP，**绝不**静默回退到模型先验 | `design/grounding.md` |
| **P1** | EXPLORE | parallel fan-out N 方向；`prototyping-ui-directions` 驱动；**不**写 chassis，**不**触发 mutex | `design/directions/<n>.md` ×N |
| **P2** | PICK | 唯一的 style lock 写入点；orchestrator 只能 pre-select 候选，不能 default-select；人类拍板 | `.uiux/lock/style-lock.yaml` |
| **P3** | BUILD | 在单一 locked lens 下迭代构建；`surface-inventory.yaml` 追踪每个 surface 的 `build_status` | `chassis.yaml` |
| **P4** | UNIFY | 8 项 token-compliance 机械扫描，全部确定性规则，**无主观判断** | unified token report |
| **P5** | REVIEW | 三轮 review 循环（Nielsen → 6-pillar → santa-loop）；fail 回 P4 / P3，无早退 | `uiux_release_decision.yaml` |

---

## 3. L0–L8 + P 能力分层

| 层 | Skill / 工具 | 说明 |
|---|---|---|
| **L0** | `ux-principles` | MODE A 前置 / MODE B 战术查表 / MODE C 审查；每个 BUILD+REVIEW 阶段强制触发 |
| **Layer P** | `ai-native-interface` | AI 原生交互范式；与 L3 **正交**，可与任意 L3 风格组合；**永不**占 L3 lock |
| **L1** | `grill-with-docs` / `competitive-teardown` | 需求澄清与竞品拆解 |
| **L2** | `prototyping-ui-directions` / `imagegen-frontend-web` | 并行探索 + 图像生成 |
| **L2.5** | `image-to-code-skill` | 截图 / 参考图 / DESIGN.md → 代码；workflow skill，**不是** L3 风格 |
| **L3** | 互斥风格锁（见下节） | 一次只能锁一个 |
| **L4** | `anchor-prototype-wave` / `sens-frontend-design` / `luxury-editorial-site-builder` / `frontend-design@official` / `bencium-innovative-ux-designer` | 多 surface 量产 + 创意执行 |
| **L5** | `vercel:nextjs` / `:react-best-practices` / `:shadcn` / `:turbopack` | 平台实现层 |
| **L6** | `visual-critique` / `redesign-skill` / `gsd-ui-review` | 精炼审查；`redesign-skill` 是 workflow skill，**不是** L3 |
| **L7** | `design-systems:*` / `ui-design:*` / `interaction-design:*` | 设计系统 + 标注规范 |
| **L8** | `brandkit` / `theme-factory` / `canvas-design` | 资产生成 |

---

## 4. L3 Style Mutex — 互斥风格锁

`uiux-style-mutex-guard.js`（project hook）通过 **lock-file 存在性**检测，而非 phase 检测。
这意味着 P1 EXPLORE 阶段可以并行采样多个候选，**不触发** mutex；mutex 在 P2 写入
`style-lock.yaml` 后才激活。

### 可锁定的 L3 风格（exactly one at a time）

| Skill | 变体 / Mode | 说明 |
|---|---|---|
| `taste-skill` | MODE A Editorial Monochrome / MODE B Double-Bezel Agency / MODE C GSAP Scrollytelling | 默认 L3 |
| `luxury` | dark-editorial / terminal lens | 深色编辑风格 |
| `brutalist-skill` | — | 仅用户 explicit 调用 |

### 永不可锁为 L3

`redesign-skill` · `image-to-code-skill` · `frontend-design@official` ·
`luxury-editorial-site-builder` · `bencium-innovative-ux-designer`

### Style-Lens Registry（6 lenses）

P2 PICK 阶段 `active_lens` 从以下 6 个中选 1，每个 lens 有统一 Style-DNA + 3-layer token contract：

`editorial` · `soft-organic` · `swiss` · `brutalist` · `terminal` · `dark-editorial`

```yaml
# .uiux/lock/style-lock.yaml 示例
style_lock:
  active: true
  selected_lens: swiss
  source_direction: design/directions/02-swiss.md
  locked_by: human
  locked_at: 2026-06-14T09:00:00+08:00
```

---

## 5. GSD Bridge — 薄层双向同步

orchestrator 不替代 GSD UI 子系统（`/gsd-ui-phase` / `/gsd-ui-review` / `gsd-ui-researcher` /
`gsd-ui-checker` / `gsd-ui-auditor` 仍是 GSD-owned 的 source of truth），而是通过
**thin bridge** 同步状态：

| GSD 产物 | 同步方向 | `.uiux/` 镜像路径 | 工具 |
|---|---|---|---|
| `UI-SPEC.md` | GSD → .uiux | `.uiux/lock/chassis.yaml` | `uiux-sdk mirror.gsd-ui-spec` |
| `UI-REVIEW.md` | GSD → .uiux | `.uiux/evidence/<tag>/gsd-ui-review.yaml` | `uiux-sdk mirror.gsd-ui-review` |

**`uiux-gsd-contract-validator`**（opus agent）是唯一的 bridge agent，职责：
- 检测 GSD ↔ `.uiux/` 之间的 drift
- 生成 `uiux_release_decision.yaml`（P5 最终产物）
- 作为 `/gsd-ship` release gate 的 UI 验收凭证

---

## 6. Project Hooks（项目级安装）

三个 project hook 通过 `uiux-sdk init` 安装到 `<project>/.claude/hooks/`，
**不是 user-global**；fresh project 无 `.uiux/config.json` 时零 enforcement。

| Hook 文件 | 触发时机 | 行为 |
|---|---|---|
| `uiux-gsd-plan-guard.js` | `PreToolUse[gsd-plan-phase]` | frontend phase 下，`UI-SPEC.md` 缺失则 block |
| `uiux-style-mutex-guard.js` | `PreToolUse[任何 L3 skill]` | `style-lock.yaml` 已存在时拦截重复锁定 |
| `uiux-release-guard.js` | `PreToolUse[gsd-ship]` | `uiux_release_decision.yaml` 非 PASS / CONDITIONAL_PASS 则 block |

---

## 7. L12 Discoverability — UIUX 下游 Release Gate

L12 是 UIUX 主线的**下游 release gate**（不在前期设计阶段触发），通过
`discoverability-orchestrator` 入口，采用 **Script-first, AI-last** 执行宪法。

### 4 个 narrow skill

| Skill | 域 | 关键词 |
|---|---|---|
| `web-seo` | Google / Bing / Baidu search | robots.txt · sitemap · canonical · structured data · Lighthouse |
| `web-aeo` | Answer Engine Optimization = **GEO** | ChatGPT / Claude / Perplexity 引用；llms.txt；Generative Engine Optimization |
| `web-local-seo` | Local SEO（2026-05-25 由 `web-geo` 改名） | GBP · Maps · NAP · near me · 附近 · 实体店 |
| `app-aso` | App Store / Google Play | store listing · product page · screenshots · app keywords |

> **命名陷阱**："GEO" 单独出现 → `web-aeo`；"GEO" + maps / local → `web-local-seo`。

### GSD-lite Harness

- **SDK**: `discoverability-sdk.py`（10 commands: init / classify / audit / evidence.append /
  evidence.validate / gate.check / report / mark-stale / explain / status）
- **Agents**: `disc-scope-classifier` / `disc-evidence-validator` / `disc-remediation-planner`
- **Project hooks**: 5 个（`disc-deploy-gate` / `disc-evidence-required` / `disc-mark-stale` /
  `disc-robots-sitemap-guard` / `disc-session-context`）
- **8-step self-dispatch**: Config → scope-classifier → SDK init → 4 narrow skills →
  evidence.append → evidence-validator → remediation-planner → gate.check → handoff
- **Gate verdicts**: `PASS` / `WARN` / `FAIL` / `BLOCKED` / `STALE`

### UIUX → 下游完整映射

| UIUX 输出 | 下游系统 | 关注点 |
|---|---|---|
| visual regression 需求 | QA (`enterprise-qa-testing`) | 截图对比 · Chromatic · Playwright |
| accessibility / WCAG | QA | axe-core · pa11y · Lighthouse a11y |
| Core Web Vitals / LCP / CLS | QA (`qa-perf-runner`) | Lighthouse CI · bundle-analyzer |
| auth / API / session / security headers | AppSec (`appsec-security-orchestrator`) | ASVS 5.0 · CSF 2.0 |
| web SEO / AEO / local SEO / ASO | L12 Discoverability | 4 narrow skills + GSD-lite harness |

---

## 8. 反模式速查

| 反模式 | 正确做法 |
|---|---|
| P0 没找到 brand docs，静默用模型先验继续 | STOP，询问人类提供 brand / DESIGN.md 语料 |
| P1 探索阶段写了 `style-lock.yaml` | P1 严禁写 lock；lock 只在 P2 人类决定后写入 |
| orchestrator 自动 default-select L3 风格 | P2 只能 pre-select 1-3 候选，人类必须拍板 |
| 同时激活多个 L3 风格（taste + luxury） | mutex 保证任意时刻只有一个 L3 active |
| 把 `redesign-skill` 当 L3 风格锁定 | redesign-skill 是 L6 workflow skill，永不占 L3 |
| P5 出现一个 surface 未通过就整体放行 | 所有 surface 必须达到 `review_status == reviewed-pass` |
| L12 用 AI "感觉审计 SEO" | Script-first：先跑 Lighthouse / Search Console API，AI 只做 evidence 解读 |
| 把 robots.txt / llms.txt 当访问控制 | 它们是 crawler policy；访问控制走 AppSec |
