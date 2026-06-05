# 前端 4-Skill 组合工作流

> 本文档说明 `ux-principles` 如何和另外 3 个核心前端 skill + 1 个特例 skill 组合使用。
> 配套全局 `~/.claude/CLAUDE.md` "前端 4-skill 组合工作流" 章节。

---

## 全景图

```
                ┌─────────────────────────────────────────────┐
                │  ux-principles （横切：pre / mid / post）   │  ← 本 skill
                └─────────────────────────────────────────────┘
                            │            │            │
            ┌───────────────┘            │            └───────────────┐
            ▼                            ▼                             ▼
┌─────────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────────┐
│ prototyping-ui-         │   │ taste-skill              │   │ anchor-prototype-wave   │
│ directions              │   │                          │   │                         │
│ (Stage 0-3 探索)        │   │ (单页 / 单组件 polish)   │   │ (4-15 surface 并行)     │
└─────────────────────────┘   └──────────────────────────┘   └─────────────────────────┘
                                                                          │
                                                                          ▼ (特例)
                                                  ┌─────────────────────────────────┐
                                                  │ luxury-editorial-site-builder    │
                                                  │ (高端品牌 landing — 单独工作流)  │
                                                  └─────────────────────────────────┘
```

---

## 4 个主 skill 的边界（写清楚谁干啥不抢活）

| Skill | 干什么 | 不干什么 | 触发 |
|---|---|---|---|
| **ux-principles** | UX 原则 / 启发式 / 审查 / 战术数字查询 | 不画 UI / 不写 HTML / 不决定 visual chassis | 任何 UI 任务的 pre / mid / post |
| **prototyping-ui-directions** | idea → 多 variant 探索包（HTML mock + palette + token） | 不是生产代码 / 不锁定方向 / 不批量铺 surface | "做几版 UI direction" / "出 prototype 包" |
| **taste-skill** | 单页 / 单组件 craft + 反 AI-slop 守门 | 不出 variant / 不铺全 surface / 不做策略 | "做一个 X 组件" / "写一个 landing 单页" |
| **anchor-prototype-wave** | 锁定 visual anchor 后并行铺 4-15 surface 的 hi-fi prototype gallery | 不做 idea 探索 / 不出方向选择 | "anchor prototype wave" / "全 surface 覆盖" |

特例：

| Skill | 干什么 | 何时启用 |
|---|---|---|
| **luxury-editorial-site-builder** | 高端品牌 100dvh hero video + editorial 杂志感单页 | 只做品牌官网 / 营销 / 落地页时 |

---

## 5 阶段时序（最完整路径）

### 阶段 1 — Discovery

**目的**：定方向，不画图

**主 skill**：`prototyping-ui-directions` Stage 0 (Idea Intake)

**ux-principles 插入**：MODE A — 输出 `pre-design-checklist.md`

**输出**：
- `idea-brief.md`（从 prototyping 来）
- `pre-design-brief.md`（从 ux-principles 来）— 列出适用 4-6 条 law + 3-5 条 NN heuristic + 视觉契约继承关系

---

### 阶段 2 — Variant 探索

**目的**：3-5 种风格 mock 并陈，选方向

**主 skill**：`prototyping-ui-directions` Stage 1-3 (Reference → Research → Package)

**ux-principles 插入**：每个 variant 出来后跑一次 MODE C（NN + Laws + BFM），把 audit 表附在 variant writeup §6

**输出**：
- 每个 variant 一个 prototype 包 + 一份 audit 表
- 综合对比报告标注哪个 variant 在 NN/Laws/BFM 三维评分上更优

**决策点**：用户选 1 个方向 → 进阶段 3

---

### 阶段 3 — 方向 lock + 单页精修

**目的**：把选定 variant 的「最关键 1 屏」做成 craft 标杆

**主 skill**：`taste-skill`（应用其 bias correction + 5 rules）

**ux-principles 插入**：
- MODE B：决定具体数字时查 [[../references/refactoring-ui-tactics.md]] 的 7 章表
- MODE C：单页完成后 audit 一次，作为后续 wave 的 reference 标杆

**输出**：1 个 hi-fi craft 单页 + 1 份 audit

---

### 阶段 4 — 全 surface 量产

**目的**：把阶段 3 标杆扩到所有 surface（4-15 个）

**主 skill**：`anchor-prototype-wave`（用阶段 3 的 craft 单页作 anchor，spawn 4-15 parallel subagent）

**ux-principles 插入**：
- 每个 subagent 产出 surface 后跑 MODE C audit（subagent 自身或主线程并行跑）
- 任何 audit FAIL = block，回 subagent 修
- master gallery 顶部 update log 记录所有 audit 通过/失败的 surface

**输出**：4-15 surface 的 hi-fi prototype gallery + master audit summary

**Gate 12**：用户审 prototype gallery，approve 才能 promote 进 Track A baseline

---

### 阶段 5 — 特例：品牌 landing

**触发条件**：用户要做「100dvh hero video / 杂志感 / editorial / 品牌官网」类的单页（不是 product UI）

**主 skill**：`luxury-editorial-site-builder`（这个 skill 自带 Hailuo/Veo 视频生成 + Topaz upscale + Vercel deploy 全套）

**ux-principles 插入**：
- 仍跑 MODE A + MODE C
- 但 BFM 评分标准不同（editorial 的 "Lens 1 First Impression" 更看情绪击中 vs product 看任务清晰）

**输出**：高端品牌单页 + deploy

---

## 极简快速路径（90% 场景）

如果只是改一个已有 surface（不做 v2 / 不重做风格）：

```
直接进阶段 3：taste-skill + ux-principles MODE B + MODE C
跳过阶段 1 / 2 / 4
```

如果只是审一个现成 prototype 没改动：

```
只跑 ux-principles MODE C
不调用其他 3 个 skill
```

如果只是 idea 阶段没动手：

```
只跑 prototyping-ui-directions Stage 0 + ux-principles MODE A
不调用 taste / anchor / editorial
```

---

## 何时不组合（单独跑某个 skill）

| 场景 | 用哪个 skill 单独 |
|---|---|
| 修一个 button hover bug | `taste-skill` 单独 |
| 评估别家产品 UX | `ux-principles` 单独（MODE C） |
| 做 landing page 不是 product | `luxury-editorial-site-builder` + `ux-principles` MODE C |
| 探索 idea 还没做 | `prototyping-ui-directions` + `ux-principles` MODE A |
| 已有 chassis 铺全 surface | `anchor-prototype-wave` + `ux-principles` MODE C |

---

## 反模式（组合错误）

- ❌ 跳过 `ux-principles` 直接进 `anchor-prototype-wave` — 会撞 v2 wave 1 那种 4 类 Marketplace 长一样的坑
- ❌ `taste-skill` 用在 4-15 surface 量产上 — 那不是它擅长的，要用 `anchor-prototype-wave`
- ❌ `prototyping-ui-directions` 用在已锁方向的 surface 量产上 — 这是 anchor wave 的活
- ❌ `luxury-editorial-site-builder` 用在 product UI 上 — 它只做品牌 landing，把它套到 dashboard 会撞 visual budget
- ❌ 4 个 skill 全部串起来跑 — 浪费 token，看任务实际范围只挑 2-3 个

---

## 在 PR description 里如何标注用了哪几个 skill

```markdown
## Frontend Skill Composition Used

This change used the following frontend skill stack:

- ✅ ux-principles MODE A (pre) — design brief at [link]
- ✅ ux-principles MODE C (post) — audit at [link]
- ✅ taste-skill — single-page craft applied to ChosenPage.tsx
- ⏸ prototyping-ui-directions — not invoked (in-scope was rework, not new direction)
- ⏸ anchor-prototype-wave — not invoked (single surface)
- ⏸ luxury-editorial-site-builder — not invoked (product UI, not brand landing)
```

让 reviewer 一眼知道你走了哪条路径。
