---
name: ux-principles
description: UX foundation skill — bring named laws, heuristic audits, tactical typography/spacing rules, and product-teardown audit lens to any frontend design work. Use BEFORE designing (which laws to honor, which to avoid), DURING designing (tactical lookups for spacing/hierarchy/color/typography), and AFTER designing (NN 10-heuristic audit, Built-for-Mars-style teardown). Pairs with `prototyping-ui-directions` (exploration), `taste-skill` (single-page craft), `anchor-prototype-wave` (production wave), `luxury-editorial-site-builder` (landing page special). Trigger phrases include "ux audit / ux 审 / 评估这个 UX / 用 NN heuristic 检查 / 哪些 Laws of UX 适用 / built for mars 视角 / 我这个 UX 哪里不行 / 我想做个 ux review".
type: orchestrator
version: 1.0.0
---

# UX Principles — UX 设计的 Foundation 与 Audit 层

> **干什么**：每次前端设计任务，本 skill 在 3 个时机插入 UX 视角 — **设计前**（pre-design：哪些 law/heuristic 适用、哪些常见失败要避开）、**设计中**（mid-design：查具体的间距/层次/字体/颜色/状态战术值）、**设计后**（post-design audit：NN 10-heuristic 跑一遍 + Built-for-Mars-style 拆解）。
>
> **不干什么**：不画 UI（那是 `taste-skill` / `prototyping-ui-directions` / `anchor-prototype-wave` 的活），不做品牌 landing（那是 `luxury-editorial-site-builder` 的活）。本 skill 是 **横切层**——任何 UI skill 跑之前/中/后都可以套一层。

---

## 4 个 reference 支柱（写入 skill 缓存 + 必要时 WebFetch 拿冷门内容）

| 支柱 | 文件 | 用法 |
|---|---|---|
| **Laws of UX** (25 named laws) | `references/laws-of-ux-cheat.md` | 设计前列出适用 law；设计后统计命中数 |
| **NN 10 Heuristics** (Nielsen) | `references/nn-10-heuristics.md` | 审查 checklist，10 题逐一检查 |
| **Refactoring UI** (Adam Wathan / Steve Schoger) | `references/refactoring-ui-tactics.md` | 战术层数字 — 间距 / 层次 / 字号 / 颜色 / 阴影 |
| **Built for Mars audit lens** (Peter Ramsey) | `references/built-for-mars-audit-lens.md` | 站在拆解者角度看自己的设计 |

需要冷门内容时直接 `WebFetch`：
- `https://lawsofux.com/<law-slug>/`
- `https://www.nngroup.com/articles/<article-slug>/`
- `https://builtformars.com/case-studies/<product>/`
- `https://www.refactoringui.com/previews/<chapter>` (free chapter excerpts)

---

## AI-native 对话流 2 条专属 law（与 `ai-native-interface` 范式 skill 配套）

> 这 2 条不是经典 25 laws 之一，是为 **AI-native conversation-first** 产品补充的命名原则。它们是 **paradigm 范式层**（skill `ai-native-interface`）的 UX 侧投影：本 skill 提供"该尊重哪条 law"的判断，落地的 operational gate / interaction architecture 在 `ai-native-interface` 里。任何对话式 / 生成式 UI / 多步 flow 任务，MODE A 选 law 时优先把这 2 条纳入。

| Law | 含义 | 触发时机 | gate 在哪 |
|---|---|---|---|
| **Show-Then-Ask（先展示后追问）** | 用户意图模糊时，**先抛 2-3 个具体选项让用户反应**，不要一上来就连环追问；只有当意图已经清晰，才用问题收窄细节。"看到具体的东西反而帮用户想清楚自己要什么。" | 用户给出宽泛 / 一句话需求（"帮我做个 X / 我想把生意做大"），意图尚未收窄时 | operational gate 在 skill `ai-native-interface`（show-then-ask 闸门 + 骨架库取数规则） |
| **Give-Before-Take + Easy-Exit（先给后取 + 让离开容易）** | 任何对话式 / 多步 flow 里，每收到用户几条信息就**主动返还一条具体、有用、用户此前没想到的真观察**（绝不是"好的明白了 / 感谢分享"这类敷衍话）；同时全程保留一个清晰可见的"停下 / 直接给我看结果"退出入口，让用户始终感到**走不走由自己说了算**。 | 用户已开始投入信息分享的任何 conversational / multi-step 流程 | architecture context 在 skill `ai-native-interface`（give-before-take 节奏 + easy-exit affordance + continuous-interface 状态） |

**配套关系**：这 2 条 law 与 paradigm skill `ai-native-interface` 成对使用 —— ux-principles 负责"判断该不该尊重、有没有违例"，`ai-native-interface` 负责"在 interaction architecture 层把它做出来"。`ai-native-interface` 是 **orthogonal 范式层，不是 L3 视觉风格**，与锁定的 L3（taste / luxury / brutalist）组合使用，不参与 L3 互斥。

---

## 3 个使用模式

### MODE A — PRE-design（开工前 5 分钟）

**触发**：被分配设计任务（"做个 X 页"/"重做 Y 的 UX"/"audit Z 的 flow"）刚到手。

**动作**：
1. 1 行说清要做的 surface 类型 + 主用户行为
2. 从 [[references/laws-of-ux-cheat.md]] 选 4-6 个适用的 law（不超过 6 个，超过就抓不住重点）
3. 从 [[references/nn-10-heuristics.md]] 选 3-5 个最容易翻车的 heuristic
4. 列 3-5 个"常见反模式"（参考 [[templates/pre-design-checklist.md]]）

**产出**：一段 ≤ 200 字的 design-brief 顶部段落，写明"这个 surface 要尊重 X/Y/Z 三条 law，要规避 A/B/C 三类反模式"。这段产出会沿着设计流程一直被 mid 和 post 阶段引用。

### MODE B — MID-design（实际写 HTML / CSS / Figma 时）

**触发**：决定具体数字（间距、字号、颜色、行高、可点击区大小、状态切换时长）。

**动作**：直接查 [[references/refactoring-ui-tactics.md]] 7 章对应表，**不要凭感觉**：
- Hierarchy → 字号 + 字重 + 颜色三要素的层级映射
- Layout → grid / 留白 / cap reading width
- Typography → 字号阶梯 / line-height / max-width
- Color → 9-shade palette / 限制 accent / 状态色
- Depth → 影子 / 边框 / 高度
- Imagery → 真实数据 vs 占位
- Final tips → 干净度收尾

**产出**：可被 reviewer 验证的具体数字。不允许"约 16px 左右"这种含糊表达。

### MODE C — POST-design audit（写完之后、ship 之前）

**触发**：设计稿/prototype 完成，要送 review/Gate 12/code merge 之前。

**动作**：
1. 跑 NN 10 Heuristics audit（[[templates/heuristic-audit.md]] 模板）
2. 跑 BFM 5-lens audit（[[references/built-for-mars-audit-lens.md]] 5 视角）
3. 给每条违规一个 severity（BLOCK / WARN / INFO）
4. 列 fix 建议（具体到改哪一行 / 哪个数字）

**产出**：一份 `ux-audit.md`，可以直接交给设计师/工程师修。`BLOCK` 必须在 ship 前修。

---

## 与其他 4 个前端 skill 的组合（详见 [[workflows/composition-with-other-skills.md]]）

```
                  ┌─────────────────────────────────────────────────┐
                  │  ux-principles 横切所有阶段（pre/mid/post）       │
                  └─────────────────────────────────────────────────┘
                           │            │            │
            ┌──────────────┘            │            └──────────────┐
            ▼                           ▼                            ▼
   prototyping-ui-directions       taste-skill                anchor-prototype-wave
   （Stage 0-3 探索 + variant）    （单页 / 组件 polish）     （多 surface 并行 hi-fi）
                           │
                           ▼
              luxury-editorial-site-builder
              （特例：高端 brand landing page）
```

**典型 5 阶段时序**：

| 阶段 | 主 skill | ux-principles 模式 | 产出 |
|---|---|---|---|
| 1. Discovery | prototyping-ui-directions Stage 0-1 | MODE A | idea-brief.md + UX risk list |
| 2. Variant 探索 | prototyping-ui-directions Stage 2-3 | MODE A + MODE C(audit 每 variant) | 3-5 variant prototype + 每份 audit |
| 3. 方向 lock | taste-skill | MODE C | 单 page 精修版 + final audit |
| 4. 全 surface 量产 | anchor-prototype-wave | MODE C 每 surface | hi-fi gallery + master audit |
| 5.（特例）Brand landing | luxury-editorial-site-builder | MODE C with editorial criteria | 高端品牌单页 |

---

## 触发优先级

本 skill 是**"附加层"**，不抢主 skill 的活：

- 任何 UI 任务开工前 → 主动套 MODE A（不到 5 分钟产出 brief 头）
- 写具体数字时 → MODE B 是查工具，不需要每次都"调用"，但要保证产出可追溯
- 任何 UI 任务收尾前 → 强制 MODE C，audit 没过不 ship

**不触发**：纯文案改 / 数据更新 / 类型修复 / 单文件 bug fix。

---

## 反模式（10 条 — 设计时碰到立刻停手）

1. **未列适用 law 就开工** — 上来就画，没有先 4-6 条 law 框定边界
2. **"AI Slop" 美学** — 默认 Inter + 紫蓝渐变 + 居中 hero + 三卡 grid + 安全灰
3. **可点击区 < 44px** — Fitts's Law 触发：任何 interactive 行高 ≥ 44px，icon button ≥ 32×32
4. **行内信息 > 7 chunks** — Miller's Law 触发：单 chip 排 / 单工具栏不超 7
5. **Hick's Law 违例** — 一屏给用户 > 5 个一级选择
6. **Doherty Threshold 违例** — 关键交互响应 > 400ms 不给 feedback（skeleton/spinner/optimistic update）
7. **Aesthetic-Usability 倒打** — 视觉很丑但功能"对"——用户会断定它不可用
8. **没有 empty/loading/error state** — 只画 happy path
9. **错误把"UI 一致"理解成"全部用同一个 component"** — Setup 和 Governance 用同 bento grid → 用户撞穿
10. **审完不归档** — audit 写完不进 vault，下次又踩坑

---

## 必读 reference 一览

- [[references/laws-of-ux-cheat.md]] — 25 laws 即用 cheat sheet
- [[references/nn-10-heuristics.md]] — 10 题 audit checklist
- [[references/refactoring-ui-tactics.md]] — 7 章战术数字
- [[references/built-for-mars-audit-lens.md]] — Peter Ramsey 5 lens 拆解法
- [[templates/heuristic-audit.md]] — MODE C 产出模板
- [[templates/pre-design-checklist.md]] — MODE A 产出模板
- [[workflows/composition-with-other-skills.md]] — 4-skill 组合工作流详解

---

## 历史与归属

- v1.0.0 创建于 2026-05-14（用户 directive：library 里都是 product reference 没有 UX 原则参考，开 PR-2 时 Marketplace 4 类商品视觉趋同就是因为缺 UX heuristic 把关）
- 与全局 CLAUDE.md "前端 4-skill 组合工作流" 章节配套
- 与 `agent-console` 项目的 Track B Stage 4 Gate 12 评审流程对齐
