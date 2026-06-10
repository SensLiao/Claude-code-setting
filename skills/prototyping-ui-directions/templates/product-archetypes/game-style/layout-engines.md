# Layout Engines — Game-style 布局编排

> game-style 不靠"自动布局算法"（那是 canvas 的事），它靠**三种 playful 组合逻辑**决定 reward 机制摆在哪、聚焦还是铺开。
>
> 布局是**结构层**，外观（颜色/字体/圆角/阴影）由锁定的 L3 风格决定。这里只管"骨架怎么排"。

## 三种布局模式

| 模式 | 心智模型 | 适用 | 反模式 |
|------|---------|------|--------|
| **card-deck** | 一叠可滑动 / 可翻的卡片，每张是一个独立可操作单元 | 习惯列表、课程目录、成就墙、每日任务集 | 退化成无层次的等距 card grid（违反 design-quality 反模板政策）|
| **focus-mode** | 单任务全屏聚焦，一次只做一件事，强 reward loop | 答题 / 打字 / 冥想计时 / 单次锻炼、reward reveal、combo 实时反馈 | 在聚焦页塞侧栏 / leaderboard / 多个 CTA，破坏"心流" |
| **hub-map** | 地图 / 路径 / 节点，进度沿路径推进，节点 = 关卡 / 里程碑 | 学习路径（Duolingo 技能树）、关卡制、长期旅程可视化 | 把地图做成纯装饰却无导航功能 / 节点状态不可读 |

### card-deck

- **结构**：垂直滚动的卡片流，或可横扫的卡片栈。每张卡承载一个 pattern（一张 daily-goal、一张 streak、一张 quest）。
- **手感**：卡片入场 stagger（依次 60-80ms 错峰）；tap 时 `whileTap` 轻微下压（scale 0.97）；完成的卡可"收起 / 飞走"。
- **何时选**：内容是**并列的多个单元**、用户需要扫视和挑选。这是 game-style 最常见的首屏。
- **铁律提醒**：卡片之间要有**层次和节奏**（大小 / 强调对比），不是一堆一样大的方块 —— 否则就是通用反模式里的"默认 card grid"。

### focus-mode

- **结构**：单一主元素居中（progress ring / 当前题目 / 计时器），周边极简，顶部最多一条常驻条（streak / lives）。
- **手感**：进出用 page-level transition；主元素是 juice 的舞台（combo 弹跳、reward reveal 悬念都在这里）。
- **何时选**：核心交互是**重复的单一动作**、需要心流、反馈要即时且不被干扰。答题 / 打字 / 单次锻炼。
- **铁律提醒**：focus-mode 是 leaderboard 的禁区（铁律：破坏聚焦）；庆祝用 overlay 但必须可快速消散（铁律 1）。

### hub-map

- **结构**：路径 / 节点图。节点有状态（locked 灰剪影 / current 高亮脉冲 / done 实心 + 勾）。当前节点用 anticipation 脉冲吸引点击。
- **手感**：进度推进时路径"点亮"一段（draw-in）；解锁新节点时该节点从灰 → 彩翻转。可滚动 / 可缩放查看全程。
- **何时选**：有**线性 / 分支的长期旅程**、想让用户看到"走了多远、还有多远"。技能树、关卡、储蓄目标里程碑路径。
- **铁律提醒**：节点状态必须**一眼可读**（locked/current/done 三态清晰）；地图不是纯装饰，每个节点要可操作或有信息。

## Pattern × Layout 兼容矩阵

| Pattern | card-deck | focus-mode | hub-map |
|---------|-----------|-----------|---------|
| Progress Ring | ✅ 卡片角标/主图 | ✅ 中心主元素 | ✅ 节点完成度 |
| Progress Bar (seg) | ✅ 卡内 | ✅ 顶部 | ✅ 路径总进度 |
| Streak Counter | ✅ 顶部常驻 | ✅ 顶部常驻 | ✅ 顶部常驻 |
| XP / Level Meter | ✅ 顶/底 bar | ✅ 顶/底 bar | ✅ 顶/底 bar |
| Achievement/Badge | ✅ 专属卡片墙 | ⚠️ 仅解锁瞬间 overlay | ✅ 地图收藏点 |
| Reward Reveal | ✅ | ✅ **最佳** | ✅ |
| Daily Goal | ✅ 首张卡 | ✅ **最佳** | ✅ 中心/起点节点 |
| Leaderboard | ✅ 专属卡片 | ❌ 破坏聚焦 | ⚠️ 入口而非展开 |
| Combo/Multiplier | ⚠️ | ✅ **最佳** | ❌ |
| Lives/Energy | ✅ 顶部常驻 | ✅ 顶部常驻 | ✅ 顶部常驻 |
| Milestone Celebration | ✅ overlay | ✅ overlay | ✅ overlay（节点解锁） |
| Quest/Checklist | ✅ **最佳** | ⚠️ 单任务视图 | ✅ 路径即 quest |

## 推荐库（运行时）

| 库 | 用途 | 何时用 | 注意 |
|----|------|--------|------|
| **Framer Motion**（`motion` / `framer-motion`） | spring 物理动画、`AnimatePresence`、`layout` 自动动画、`whileTap`/`whileHover` 手势 | 默认主力 —— press 手感、卡片进出、数字弹跳、布局重排几乎都用它 | spring 参数见 `motion-tokens.md`；`layout` 动画注意只在必要处用，避免误动 layout-bound 属性 |
| **Lottie**（`lottie-react` / `lottie-web`） | 复杂矢量动画：mascot 表情、成就解锁、level-up 序列 | 设计师在 After Effects 出好、工程零手写的"成片"动画 | 体积可观，按需 lazy-load；交互响应弱（要响应输入用 rive） |
| **rive**（`@rive-app/react-canvas`） | 状态机驱动的交互式动画：会响应进度 / 输入的角色、进度部件 | 当动画需要**随用户状态实时变化**（mascot 随 streak 变情绪、进度部件随数值变形） | 比 Lottie 更适合"活的"部件；学习曲线略高 |
| **canvas-confetti** | 一次性庆祝 confetti burst | milestone celebration（pattern 11）的彩纸 | **必须设粒子上限**（铁律 5：≤80-150 粒、单次 burst）；零依赖、易控预算 |

### 库选型决策树

```
要做一个动画？
├─ 是庆祝彩纸？                          → canvas-confetti（设上限）
├─ 是 press / hover / 卡片进出 / 数字跳？  → Framer Motion（默认）
├─ 是设计师出的成片序列（解锁/level-up）？
│   ├─ 需要随用户状态实时变化？           → rive
│   └─ 一次性播放即可？                   → Lottie
└─ 是布局重排 / 列表增删？                → Framer Motion 的 layout / AnimatePresence
```

### 选型纪律

- **默认 Framer Motion**，不要一上来就上 Pixi/Three（重武器，违反"克制 + 不阻塞输入"两条铁律）
- 任何外部库必须在 variant 的 `readme.md` 写明版本 + 用途 + license
- Lottie / rive 资产要 lazy-load，不阻塞首屏
- 一个 variant 不混多个动画框架做同类事（别 Framer Motion + GSAP 同时管 press 手感）
- 即便加载 game-style archetype，**variant 仍允许用 vanilla CSS** 写简单 juice（spring 可用 CSS `linear()` easing 近似，confetti 可纯 canvas）—— archetype 是知识库不是强依赖
