# Anti-Slop Suite — suite 级、风格无关的生成护栏（所有 lens 通用）

> 加入 2026-06-14（IMPROVEMENT-PLAN P2-3）。把原本只活在 `taste-skill` 内的 anti-slop 提炼成 **suite 级、风格无关**的注入 block。
> orchestrator 在 **P0 GROUND + P3 BUILD 注入本 block** —— 无论 PICK 锁定哪个风格（taste / luxury / brutalist / 任何 lens），这套护栏一律生效。根治"AI 味只在非 taste 风格漏进来"。
> 它是**约束**不是风格：不改任何 lens 的 Style-DNA，只拦所有 lens 共有的 AI tell。
> Provenance（本地）：`reference/articles/anthropic-frontend-aesthetics-cookbook.md` / `925studios-ai-slop-guide.md` / `ai-slop-diagnosis-1.md` / `ai-slop-diagnosis-2.md` / `refactoring-ui-tactics.md` / `comeau-designing-shadows.md`；`reference/repos/{awesome-claude-design,impeccable,claude-cookbooks}`。

---

## 0. 怎么用（注入点）

- **P0 GROUND**：读进上下文当生成约束（与 `grounding.md` 并列）。
- **P3 BUILD**：builder 上下文**必注入**本 block —— 锁定哪个 lens 都生效。
- **P4 UNIFY**：§5 background-atmosphere + §2 color tells 进 token-compliance 扫描项。

---

## 1. Banned fonts（被用烂的 AI tell 字体）

> 借 Anthropic Frontend-Aesthetics Cookbook：模型**会自动收敛到 Space Grotesk / Inter 中庸默认**——主动反它。

- **默认就 ban**（除非该 lens 的 Style-DNA `type_dna` 显式选用并给理由）：Space Grotesk（最强 AI tell）、未经选择的 Inter everywhere、Oswald 单字体撑全身份（fashion tell）、Montserrat 大标题、Poppins 圆体可爱化。
- **强制双字体**：display family + body family 分离；单字体撑全站 = tell。
- **字重用极端**（借 Cookbook isolated-dimension 法）：别全收敛到 400/500/600 中庸；display 用 ≥700 或反差 300。

## 2. Color tells（永不）

- ❌ 纯黑 `#000000` 大面积 / 纯白 `#FFFFFF` 大面积平铺 —— 用近黑（`#0A0A0B` 暖偏）/ off-white。
- ❌ "AI-purple" 默认渐变（`#7C3AED → #A855F7` 那类）/ Tailwind `indigo-500` 直接当主色（`ai-slop-diagnosis-2` 点名同质化）。
- ✅ 单一 accent；中性色族**锁定不混**（一套 gray family，别 warm/cool 乱跳）。
- ✅ 阴影**色相匹配 + 只降亮度，永不用透明黑**（借 `comeau-designing-shadows`）。

## 3. Layout / hierarchy tells

- ❌ 防居中：hero 别默认"水平+垂直全居中一个标题一个按钮"。
- ❌ 防呆板对称：刻意非对称、刻意张力。
- ✅ 层级靠"贴近背景色弱化"而非灰字；阴影 = 高度语言（借 `refactoring-ui-tactics`）。
- ✅ 留白是设计不是空缺；密度由 lens 的 `space_grid_dna` 定，但**绝不**等距填满。

## 4. Content realism

- ❌ lorem ipsum / "Your Company" / `[placeholder]` 进交付物。
- ❌ emoji 当装饰撑场（🚀✨🎯 堆 feature 卡）。
- ✅ 真实 copy、真实数据、真实人名场景（"Jane Doe / Acme" 占位是反面——要具体可信）。

## 5. Background atmosphere（**新维度，必填**）

> 裸纯色平背景本身是 AI tell（Anthropic Cookbook 专门点名）。

每个 lens / surface **必须声明**背景配方之一并给参数：
`gradient`（含 mesh / 暗渐变）｜ `noise`（细噪点/film grain）｜ `geometric`（网格/线条/dot-grid）｜ `mesh` ｜ `none`（**仅当 lens 显式选 none 且说明理由**）。
P4 UNIFY 检查：`material_dna.background_atmosphere` 已声明且非裸纯色平背景（除非显式 none + 理由）。

## 6. 主动反默认（break-default-aesthetic）

> 借 `reference/repos/awesome-claude-design` 的 `break-default-aesthetic` 提示。

每次生成前自问："这是不是模型的**默认审美**？" 若是 —— 主动偏移一个维度（字体/背景/布局节奏/accent），让它有**观点**（`vanschneider`：好设计是有观点的，不是平均化的）。

## 7. Anti-reference 词汇（方向调节）

> 借 `reference/repos/impeccable` 的单词词汇表 + PRODUCT.md anti-references。

用方向词收敛而非堆细节：`bolder` / `quieter` / `distill`（减到本质）/ `warmer` / `denser` / `more editorial`。并记一条 **anti-reference**（"不要像 X"）防漂移。

---

## 8. 与 lens Style-DNA 的关系（不冲突）

本 suite 拦的是**所有风格共有的 AI tell**；lens 的 `type_dna.banned_fonts` / `color_dna.never` 是**该 lens 的额外**禁令。两者叠加：suite 是地板，lens-DNA 是该风格的特化。**lens 不能放宽 suite**（如某 lens 想用纯黑，必须在其 Style-DNA `color_dna.never` 显式豁免并写理由，否则 suite 的"永不纯黑"生效）。
