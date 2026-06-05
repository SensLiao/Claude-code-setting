# PROMPTS-SCHEMA.md — N 方向 PROMPTS.md 统一规范

> **谁读这份文件**:负责为某一方向写 / refactor PROMPTS.md 的 AI / 人。
> **目标**:让 N 个方向的 PROMPTS.md **结构 / 字段 / 命名完全一致**,
> 便于后续 dev 写脚本批量跑生图、批量集成进 prototype。
> **优先级**:Schema 是硬约束,各方向的视觉内容可以不同,但**结构和字段顺序不准改**。

---

## 1. 顶层结构(4 段固定)

每个方向的 PROMPTS.md 必须按以下顺序写,**4 个 H1 标题不变**:

```
# AI Image Generation Prompts — {Target} / Direction {N} / {Name}

## Section 0 — Base Style (所有页面共用)

# 🟢 PHASE 1 — Core Pages (M 张整页 mockup)

# 🟡 PHASE 2 — Remaining Pages (客户拍板后再跑)

# 🎨 PHASE 3 — Per-Page Asset Library (按 page 分组的单组件素材)
```

> 4 个 H1 标题 emoji + 文案严格按上面写,**dev 会用 regex 匹配它们**。

---

## 2. Section 0 — Base Style

不变,沿用现有内容。必须包含:
- 调色板(HEX,从 DIRECTION.md 抄)
- 字体方向(从 DIRECTION.md 抄)
- 圆角 / 阴影(从 DIRECTION.md 抄)
- 构图规则
- Avoid 清单(negative prompt)

> **唯一新增要求**:在 Section 0 末尾加一段「方向独有的素材风格基调」,
> 描述该方向的素材在统一基调下的特殊处理(例:Kids Playful → 装饰偏圆润手绘;
> Editorial Premium → 装饰偏极简线条)。Dev 重组时这一段会被注入到 Phase 3 各素材 prompt 的开头。

---

## 3. Phase 1 / Phase 2 整页 mockup 模板

每页(无论 core 还是 tier-2)都按下面这个**完整 8 字段**写:

```markdown
## {page-id}.png — {页面中文名} ({English Name})

**Page ID**: `{page-id}` (snake-case, 全局唯一,例: `core-01-home-hero`)
**Phase**: Phase 1 / Phase 2
**Source Section**: Page X / Section X.Y(对应 PAGE-WORKFLOW.md 章节)
**Output**:
  - Desktop: 1440 × {N} px landscape
  - Mobile (optional): 390 × {N} px portrait
**Used in Prototype**: `Design/3.Prototype/{target}/{direction}/{filename}.html` 的哪一区
**Required Assets** (Phase 3 链接):
  - [`{asset-id-1}`](#{asset-id-1}) — 用途简述
  - [`{asset-id-2}`](#{asset-id-2}) — 用途简述
  - ...

### Prompt

\`\`\`
[Base Style above]

{该页详细视觉 prompt}

Layout:
LEFT: ...
RIGHT: ...

Decorations: ...
Color emphasis: ...
\`\`\`

### 验收标准
- {3-5 条 checklist,例: "headline 必须 2 行 break","CTA 红色按钮不被装饰遮挡"}
```

字段说明:
- **Page ID**:全局唯一,Phase 1 用 `core-NN-{name}`,Phase 2 用 `t2-NN-{name}`。
- **Required Assets**:列出该 page 在 Phase 3 里需要的所有素材,以 markdown anchor link 链接到 Section 4 对应素材。
  - **这是核心字段** —— 没有它 Phase 3 就用不起来。
  - **不留空**:即使页面只需要 1 个素材,也写;真没有任何素材(纯文字页),写 "None — 纯文字页面"。
- **验收标准**:每页 3-5 条,直接给生图人对照检查。

---

## 4. Phase 3 — Per-Page Asset Library(关键改动)

### 4.1 结构原则

**按 page 分组**,**不**是平铺。每个 page 是一个 H2,该 page 需要的所有素材是 H3。

```markdown
## Phase 3 / Page: core-01-home-hero — 该页所需的素材

> 共 {N} 个素材。逐个生图,生完直接放进 `Design/3.Prototype/{target}/{direction}/assets/images/{page-id}/`。
> **本页素材类型覆盖**:{从 Section 5 的 9 类里挑出涉及的,例 1-3-5-7}

### {asset-id} — {素材中文名}

**Asset ID**: `{direction-prefix}-{page-prefix}-{semantic}` (例: `kp-h01-kid-portrait-hero`)
**Used on Page(s)**: `core-01-home-hero` (可能多页共用,逗号分隔)
**Output**:
  - Format: PNG transparent / SVG / JPG
  - Dimensions: {W} × {H} px
  - Background: transparent / soft pastel / white
**Generation Tool**: Midjourney v6.1 / GPT-image-1 / Imagen 3 / Stable Diffusion 3.5 / hand-SVG
**Variants Needed**: {如果同一素材需要多个变体,在这里列}

### Prompt

\`\`\`
[Base Style above]
[Direction asset tone — 来自 Section 0 末尾的"素材风格基调"]

{素材详细视觉 prompt}
\`\`\`

### Avoid
- {该素材独有的 avoid 列表}

### Filename
`{filename-on-disk}.png` → 落到 `assets/images/{page-id}/`

### 验收标准
- {2-3 条 checklist}
```

### 4.2 Asset ID 命名约定(强制)

```
{方向缩写}-{页面缩写}-{素材语义名}
```

例:
- `kp-h01-kid-portrait-hero`
- `bs-pri-pricing-card-mockup`
- `ep-tch-teacher-portrait`

**方向缩写**:为每个方向定义一个 2 字母代号,在项目 README 里记一张映射表,N 方向不准重复。

**页面缩写**:常用 3 字母语义化命名(例 `home`、`pgs`、`tch`、`pri`、`ctc`、`abt`、`enr`、`faq`、`dsh`、`sch`、`att`)。

### 4.3 共用素材标记

如果一个素材在多页都用(例:Logo / Footer / 导航 icons),则:
- 放在**第一次出现的 page** 之下
- `Used on Page(s)` 字段列全部用到它的 page
- 在其他 page 的 H2 段落底部加 `> 复用:see [link to asset](#) (defined under core-01-home-hero)`

---

## 5. 必须覆盖的素材类型(Checklist — 防漏)

为防漏,每个 page 至少检查以下 9 类素材是否需要,需要就写,不需要明确写 "N/A":

| # | 类型 | 例 | 通常需要的页 |
|---|---|---|---|
| 1 | 真实人物照(transparent PNG) | 用户头像 / 老师头像 / 客户头像 | hero / team / reviews |
| 2 | 场景实拍 | 工作场景 / 教室 / 门店 | about / programs cards |
| 3 | 装饰元素 SVG/PNG | 星星 / 涂鸦箭头 / sparkle | 多页通用 |
| 4 | Logo / 品牌标识 | 主 logo / icon / wordmark | header / footer |
| 5 | Icons 套件 | 功能 icons / 社交 icons | programs / contact / 系统全站 |
| 6 | UI mockup PNG | 倾斜浏览器 / 卡片 / 手机 mockup | hero / about |
| 7 | Badges / stickers | "FREE" 印章 / 评级徽章 / 数据 badge | hero / pricing / trust |
| 8 | 背景 / 装饰底纹 | gradient blob / 涂鸦底图 / pattern | hero / section divider |
| 9 | Map / QR / 截图占位 | 地图 / 二维码 / dashboard 截图 | contact / footer |

> 每页 Phase 3 H2 段开头加一行 **"本页素材类型覆盖:{1-2-3-...-N}"**,
> 漏检的写在 NOTES.md 里。

---

## 6. 命名 / 路径标准(prototype 端)

Phase 3 素材生成后,落到:

```
Design/3.Prototype/{target}/{direction}/
└── assets/
    ├── images/
    │   ├── {page-id}/
    │   │   ├── {asset-filename}.png
    │   │   ├── {asset-filename}.svg
    │   │   └── ...
    │   └── shared/
    │       └── {复用素材}.png
    └── decor/
        └── {纯装饰类 SVG}.svg
```

---

## 7. 执行流(每个方向)

```
Step 1: 跑 Phase 1 M 个 prompt → 出 M 张整页 → 客户首轮提案

      ↓ (客户选定某方向)

Step 2: 跑该方向 Phase 2 所有 prompt → 出剩余整页 mockup → 客户二轮确认全套页

      ↓ (开始落 prototype)

Step 3: 逐 page 跑 Phase 3 素材
        对每一页:
          (1) 读它的 "Required Assets" 清单
          (2) 跑每个素材 prompt → 落到 assets/images/{page-id}/
          (3) 把整页 mockup + 这些素材一起喂给 frontend dev → 写出该页 HTML
          (4) 写完一页再开下一页(避免组件漂移)
```

**关键约束**:
- Phase 3 **绝对不要跨页并行**(同时跑 core-01 和 core-02 的素材)
- 每页跑完一轮后,在 NOTES.md 记一次:"该页素材完整 / 还差 X"

---

## 8. Refactor 注意事项(写给 subagent)

如果你是被派来 refactor 某方向 PROMPTS.md 的 subagent,**严格遵守**:

1. **保留所有现有 prompt 的视觉内容**。只重组,不重写视觉描述。
2. **补 Required Assets 字段**:每页扫一遍,识别该页 prompt 里提到的所有素材元素,
   在 Phase 3 里建对应 entry。
3. **Phase 3 现有的"平铺 N 个素材"要拆开按 page 重新组织**,该共用的标共用,该独占的归独占。
4. **每个 page 都要写 "本页素材类型覆盖"** (Section 5 的 9 类 checklist)。
5. **新加的素材** prompt 要简短但完整(用途 / 输出 / 视觉 / Avoid),不要灌水。
6. **不准改 Base Style 段** 的视觉规格(色板 / 字体 / 圆角 / 阴影)。可以在末尾补"方向独有素材风格基调"一段。
7. **不准动 BUILD-PROMPT.md** 或 PROMPTS.md 之外的任何文件。

---

## 9. 完工自检 Checklist(交还前必跑)

- [ ] 4 个 H1 标题完全按 Section 1 的格式
- [ ] Section 0 末尾有"方向独有素材风格基调"段
- [ ] Phase 1 / Phase 2 每页 8 字段齐全(Page ID / Phase / Source / Output / Used in / Required Assets / Prompt / 验收)
- [ ] Phase 1 = M 页(M 由 PAGE-WORKFLOW.md 定),Phase 2 ≥ 配套数量
- [ ] Phase 3 按 page 分组,**不是平铺**
- [ ] 每个 page 的 Phase 3 段开头有"本页素材类型覆盖:{X-Y-Z}"
- [ ] 所有 Asset ID 用 Section 4.2 的命名约定
- [ ] 共用素材在 `Used on Page(s)` 字段列出全部使用方
- [ ] 文件末尾保留 Negative Prompt + Fine-tuning Tips 段(如有)
