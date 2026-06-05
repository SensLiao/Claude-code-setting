# EXECUTION-WORKFLOW.md — 跑生图 + 集成 prototype 的执行手册

> **谁读这份文件**:负责执行 AI 生图 + 把素材集成进 prototype 的人。
> **作用**:把 N 方向 PROMPTS.md 拆解成可执行的"按顺序跑生图 + 落代码"step-by-step 手册。
> **配套**:必读 [PROMPTS-SCHEMA.md](./PROMPTS-SCHEMA.md)。

---

## 0. 三阶段流转总览

```
[起点] 已生成 N 方向 × PROMPTS.md(包含 Phase 1 + 2 + 3 全部 prompt)

PHASE 1 (现在做)
   ↓ 跑 N 方向 × M core-page 整页 prompt
   ↓ 出 N × M 张整页 mockup PNG
   ↓ 给客户看,横向对比 N 方向
   ↓ 客户挑出 1-2 个方向

PHASE 2 (客户拍板后做)
   ↓ 只跑选中方向的 Phase 2 prompt
   ↓ 出剩余 page 整页 mockup
   ↓ 客户二轮确认全套页面视觉

PHASE 3 (落代码时做,逐 page 推进)
   ↓ 对每一个 page,跑该页 Phase 3 prompt(独立素材)
   ↓ 出 PNG / SVG 单组件素材
   ↓ 把整页 mockup + 这些素材一起喂给 code AI
   ↓ 写出该 page 的 HTML
   ↓ 写完一页再开下一页(避免组件漂移)
```

---

## 1. Phase 1 执行(出 N 方向 core pages)

### 1.1 跑哪些 prompt

每个方向的 PROMPTS.md 里:
- 找 `# 🟢 PHASE 1 — Core Pages` 这一段
- 每个 H2(`## core-NN-name.png`)是一个独立 prompt
- 跑 prompt 时**完整复制** Section 0 的 Base Style + 该 page 的 Prompt 块

### 1.2 一个完整 prompt 的拼装

```
[Base Style 完整段]
+
[Direction Asset Tone 段(Section 0 末尾)]
+
[该 page 的 ### Prompt 内容]
+
"Output: 1440 × N px landscape"(从 page 的 Output 字段拿)
```

### 1.3 输出清单(N 方向 × M 页)

| 方向 | 输出文件名 |
|---|---|
| 1-{name} | core-01-{name} / core-02-{name} / ... |
| 2-{name} | 同上 M 张 |
| ... | ... |

落盘:`Design/2.Anchors/{target}/{X-direction}/core-NN-name.png`

### 1.4 Phase 1 完成验收(给客户看之前)

- [ ] N 方向 × M 张全部生成
- [ ] 同一 page 在 N 方向间能 1:1 横向对比(尺寸 / 内容 / 占位文字 / 数据数字一致)
- [ ] 每张图打开看视觉风格符合该方向定位
- [ ] 客户看前先内部审一遍,挑出明显失败的图重跑

### 1.5 给客户的展示方式

- 把 N 方向 × M 张拼成 N 个 grid(每方向 1 个 grid)
- 用 PDF / Figma board / Notion gallery 都行
- **不要**一张一张分开发,客户没法横向比

---

## 2. Phase 2 执行(客户拍板后)

### 2.1 触发条件

客户明确说"我们选 X 方向"。**没拍板之前不要跑 Phase 2**,浪费生图额度。

### 2.2 跑哪些 prompt

只跑选中方向的 PROMPTS.md 里:
- `# 🟡 PHASE 2 — Remaining Pages` 这一段下的所有 H2
- 同样的 prompt 拼装方式(Base Style + Direction Asset Tone + page Prompt)

### 2.3 输出

`Design/2.Anchors/{target}/{选中方向}/t2-NN-name.png`

### 2.4 Phase 2 完成验收

- [ ] 所有 t2-NN 全部生成
- [ ] 与 Phase 1 整页风格一致(同 direction asset tone)
- [ ] 客户看完 Phase 1 + Phase 2 全套后,二轮确认

---

## 3. Phase 3 执行(逐 page 推进,这是关键!)

### 3.1 核心约束(铁律)

> **绝对不要跨页并行跑 Phase 3 prompt。**

原因:同一组件(如 sidebar / portrait / card mockup)在不同 page 里出现时,如果并行跑会出现 N 个不同版本。**永远是一页跑完一页再开下一页**。

### 3.2 单页 Phase 3 执行流(对每一页重复)

```
Step 1: 在 PROMPTS.md 找该 page 的 Phase 3 H2
        例:`## Phase 3 / Page: core-01-home-hero — 该页所需素材`

Step 2: 读 H2 段开头的 "本页素材类型覆盖:{X-Y-Z}"
        了解该页要哪些素材类型(从 schema Section 5 九类)

Step 3: 看 H2 段下面所有 H3(`### {asset-id}`)
        每个 H3 是一个独立素材的完整 prompt

Step 4: 对每个 H3 素材:
   4a. 复制 Asset Prompt 内容
   4b. 按 Output 字段指定的格式 / 尺寸 / 透明背景 跑生图
   4c. 用 Filename 指定的名字保存到
       `Design/3.Prototype/{target}/{direction}/assets/images/{page-id}/{filename}`
   4d. 跑完一个素材立即 verify 验收标准
       (大小对、透明背景对、风格匹配)

Step 5: 如果 H2 段写的是"复用(无独占素材)"
        → 此页不跑任何 Phase 3 prompt,直接到 Step 6
        → 该页用的素材都已在其他 page 跑完了

Step 6: 把整页 mockup + 该页所有素材交给 code AI
        Code AI 按 mockup 写 HTML,使用 assets/images/{page-id}/ 下的素材

Step 7: 该页 HTML 写完后,在 NOTES.md 记一次:
        "[page-id] Phase 3 完整 / 缺什么 / 需要返工的"

Step 8: 进入下一页,从 Step 1 重新开始
```

### 3.3 推荐执行顺序(因 target 而异)

**对外营销 target(landing 类)**:
1. home-hero(最重要,客户第一眼)
2. programs / products(主销售页)
3. teachers / team(信任 page)
4. pricing(转化 page)
5. contact / enrollment
6. about
7. 其他 page

**对内系统 target(system 类)**:
1. **最大卖点页**(直接打动客户的核心引擎演示页)
2. **KEY DEMO 触发页**(关键交互 / modal 演示页)
3. Dashboard / 首页
4. 其他 page

### 3.4 共用素材的特殊处理

```
如果一个素材在多页都用(看 H3 的 `Used on Page(s)` 字段):
  - 只在第一次出现的 page 跑 1 次生图
  - 其他 page 直接复用同一文件
  - 文件落 `assets/images/shared/` 而不是某个 page-id/ 子目录
```

### 3.5 Phase 3 完成验收(单页)

每跑完一页所有 Phase 3 素材,确认:
- [ ] 该页 PROMPTS.md 列出的所有 Required Assets 都已生成
- [ ] 文件名按 Filename 字段命名
- [ ] 落盘路径正确(`{page-id}/` 或 `shared/`)
- [ ] 透明背景 PNG 没有白边
- [ ] 与该页整页 mockup 风格一致(尺寸 / 比例 / 颜色)
- [ ] 已交给 code AI,HTML 已写出可见效果

---

## 4. 文件路径速查

### 4.1 PROMPTS.md 位置

```
Design/2.Anchors/
├── PROMPTS-SCHEMA.md             ← 总规范
├── EXECUTION-WORKFLOW.md          ← 本文件
├── {target-A}/
│   ├── PAGE-WORKFLOW.md           ← target 共用 page 定义
│   ├── 1-{direction}/PROMPTS.md
│   ├── 2-{direction}/PROMPTS.md
│   └── ...
└── {target-B}/
    └── (同结构)
```

### 4.2 生图产物落盘

```
# Phase 1 + 2 整页 mockup → 放在 Anchors 这边(参考用)
Design/2.Anchors/{target}/{direction}/{page-id}.png

# Phase 3 单组件素材 → 放在 Prototype 这边(代码直接引用)
Design/3.Prototype/{target}/{direction}/assets/
├── images/
│   ├── {page-id}/                ← 该页独占素材
│   └── shared/                    ← 多页共用素材
└── decor/                          ← 纯装饰 SVG
```

### 4.3 prototype HTML 文件

```
Design/3.Prototype/
├── {target-A}/
│   ├── BUILD-PROMPT.md            ← 通用 prototype 规范
│   ├── 1-{direction}/
│   │   ├── BUILD-PROMPT.md       ← 方向特色补丁
│   │   ├── index.html
│   │   ├── {page-2}.html
│   │   ├── ...
│   │   └── assets/
│   └── ...
└── {target-B}/
    └── (同结构)
```

---

## 5. 跑生图的工具选择

| 素材类型 | 推荐工具 | 备注 |
|---|---|---|
| 整页 mockup(Phase 1+2) | Midjourney v6.1 / GPT-image-1 | MJ 出图质感最稳,GPT-image 文字渲染最清晰 |
| 真实人物照片(透明 PNG) | Midjourney v6.1 + remove.bg | MJ 出图后用 remove.bg 抠图 |
| 装饰 SVG / icons | hand-SVG(直接写代码)/ Iconify | SVG 优于 PNG,清晰且可改色 |
| Logo / wordmark | hand-SVG + 描线 / Logo.com / Looka | 占位用 hand-SVG 写即可 |
| UI mockup(浏览器框 / 卡片) | Figma 手作 + 导出 / GPT-image-1 | 自己拼比 AI 出来稳 |
| Map / QR placeholder | 占位 SVG / 截图加滤镜 | 不必真实地图 |
| 场景照 | Midjourney v6.1 + 自己挑 | 多跑几张选最合适的 |
| Empty state illustration | Recraft / Storyset CC0 / 自己画 | Storyset 风格统一好用 |

---

## 6. 常见问题

### 6.1 "生图工具出来的颜色和 hex 对不上"

- MJ:prompt 末尾加 `precise color palette: #XXXXXX #XXXXXX` + `--style raw`
- GPT-image:prompt 里写明每个元素的 hex
- 实在不行:Photoshop / Figma 调色

### 6.2 "AI 出来的人像有畸形手指 / 表情诡异"

- 加 negative prompt:`distorted hands, extra fingers, fake AI smile, uncanny`
- 多跑几张挑最自然的
- 或用真实 Unsplash CC0 图

### 6.3 "同一组件在不同 page 风格漂移了"

- 这是 Phase 3 没按"逐页推进"导致的,**不要并行**
- 已经漂移:重新跑该组件,**统一**用最先生成那一版

### 6.4 "客户看了 Phase 1 后说想混搭(target A 方向 1 + target B 方向 3)"

- 完全 OK,不同 target 的视觉本来就是独立的
- 客户可以挑任意 target A 方向 × 任意 target B 方向 的组合

### 6.5 "客户说 N 方向都不喜欢,要重出"

- 先复盘:是 DIRECTION.md 没写清楚,还是参考图选错了
- 重新走 Stage 1 选新方向,**不要**在 Stage 2 硬调
- 时间成本:重做 Stage 1 大约 2-3 天 + 重跑 Phase 1 2-3 天

---

## 7. 完整流程时间预估

| 阶段 | 工作量 | 推荐周期 |
|---|---|---|
| Phase 1 跑生图 + 整理 | N × M 张 + 拼 grid | 2-3 天 |
| 客户审 Phase 1 + 反馈 | — | 3-5 天 |
| 客户拍板 + Phase 2 跑 | 选中方向 × N 张 | 1-2 天 |
| 客户二轮审 + 反馈 | — | 2-3 天 |
| Phase 3 + Code AI 落代码 | 每页约 4-8 小时 | 视页数 2-4 周 |
| 最终 prototype 整合 + QA | — | 3-5 天 |
| **总计** | | **4-6 周** |

> 这是按"开发方是学生兼职 / 单人作业"的现实预估,不是 1 周冲刺。

---

## 8. 最后检查清单(全流程结束前)

- [ ] 所有 Phase 1 + Phase 2 mockup 已生成并归档到 Anchors
- [ ] 选中方向所有 Phase 3 素材已生成并归档到 Prototype/assets/
- [ ] 所有 HTML page 引用素材正确(开浏览器看视觉一致)
- [ ] 每个 page NOTES.md 写清"已用素材 / 占位待补 / 已知 bug"
- [ ] Prototype 可以本地双击 index.html 跑起来
- [ ] 可以部署到 Vercel(static HTML 拖文件即可)
- [ ] 截图打包成 PDF / Notion gallery 交付给客户
