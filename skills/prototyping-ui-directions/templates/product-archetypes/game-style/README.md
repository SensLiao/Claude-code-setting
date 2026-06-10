# Game-style Archetype

> 游戏化 / 有玩感的产品界面的知识库 —— reward loop、progress/streak/achievement、XP/level、tactile feedback、克制的庆祝时刻。
>
> Stage 0 用户选"加载 game-style archetype"时被引入主流程；否则休眠在这里不影响主流程。
>
> **核心信条**：gamification 不是给界面贴贴纸，而是设计一套**让进步可见、让反馈有手感、让坚持有回报**的结构。本 archetype 的存在是为了让 prototype 长得像 Duolingo / Apple Fitness，而**不是**像幼儿园 app 或赌场老虎机。

## 适用产品类型

- 习惯养成 / 打卡 app（Finch / Habitica / streak 类）
- 学习 / 语言 app（Duolingo / Brilliant / Monkeytype 风格）
- 健身 / 健康 app（Apple Fitness rings / Strava 成就 / 冥想连续天数）
- 带 reward 的 onboarding / 新手引导（progress quest、首日成就）
- 金融 / 储蓄 app 里的"目标进度 + 里程碑庆祝"层（Cash App / Robinhood 风格的克制 juice）
- 任何核心循环是 **做一个动作 → 拿到反馈 → 看到进步 → 想再做一次** 的产品

**不适用**：
- 严肃工具 / 生产力软件的主界面（gamification 会显得轻浮、降低信任）—— 例外是其中的 onboarding 子流程
- B2B / 企业后台 / admin 面板（XP 满天飞会破坏专业感）
- 金融 / 医疗 / 法律的**核心数据视图**（只可在边缘激励层用 juice，绝不在关键数字上加 confetti）
- Dashboard（信息密度型 → `data-dashboard`）
- Landing / marketing（线性滚动 → `landing-marketing`）
- 节点 / 白板 / 流程编辑器（空间化 → `canvas`）

> **红线**：如果一个产品的核心价值是"严肃、可信、高效"，gamification 是反作用力，不要硬套。Game-style 适合"养成 / 学习 / 坚持"这类**需要内在动机加持**的产品。

## 它和 L3 视觉风格怎么 COMPOSE（必读）

Game-style archetype 是**产品类型结构层 + reward 机制层**，它 **NEVER** 是一种 L3 视觉风格，**绝不进** `l3_style` enum，**绝不**抢 taste / luxury / brutalist 的槽位。

| 谁负责什么 | 归属 |
|-----------|------|
| 用什么 reward 机制（progress ring 还是 XP bar、要不要 streak、庆祝时刻放哪） | **game-style archetype（本库）** |
| 这些机制的 motion 手感（spring 参数、squash/stretch、anticipation） | **game-style archetype（本库）** |
| 反 dark-pattern / 反 childish slop 的铁律 | **game-style archetype（本库）** |
| progress ring 用什么颜色、字体、圆角、阴影、质感 | **锁定的 L3 视觉皮肤**（taste / luxury / brutalist） |
| 庆祝时刻的粒子长什么样、confetti 用什么色卡 | **L3 皮肤决定外观，archetype 决定时机与预算** |

**组合方式**：先锁 L3（比如 taste-skill 的 Editorial Monochrome），再叠 game-style archetype。archetype 提供"这里该有一个 streak counter、它该怎么 +1、庆祝该 ≤多少毫秒"，L3 提供"它长什么样"。

- ✅ 对：`taste-skill` 锁定皮肤 + game-style archetype 提供 streak/XP/celebration 结构 → 一个**有品味的**习惯 app
- ✅ 对：`brutalist-skill` 锁定皮肤 + game-style archetype → 一个**粗野风格的** Monkeytype 式打字训练
- ❌ 错：把 game-style 当成第 4 种 L3 风格去 style-lock
- ❌ 错：archetype 自己规定颜色 / 字体 / 圆角（那是 L3 的活）

> 一句话：**archetype 给骨架和机制，L3 给皮肤。** archetype 永远不画皮肤，只决定"哪里有反馈、反馈怎么动、什么时候庆祝、庆祝多久"。

## 这个 archetype 包含

| 文件 | 内容 |
|------|------|
| `patterns-index.md` | 12 个核心 gamification pattern（progress ring/bar、streak、XP/level meter、achievement/badge、reward reveal、daily-goal、leaderboard、combo/multiplier、lives/energy、milestone celebration、quest/checklist、empty/loss state），每个含 intent + structure + when-to-use + 它替代掉的 slop / dark-pattern |
| `game-style-rules.md` | 8 条铁律的 gate 形式（红队 checklist）—— 庆祝时长上限、单动作庆祝次数、反 fake-urgency、juice 不阻塞输入、粒子预算、motion-sensitive 兜底、诚实进度、不操纵 streak 焦虑 |
| `layout-engines.md` | 三种 playful 布局编排（card-deck / focus-mode single-task / hub-map）+ 推荐库（Framer Motion / Lottie / rive / canvas-confetti） |
| `motion-tokens.md` | juice motion token（spring overshoot / squash-stretch / anticipation）含具体 spring 参数 + 该避免什么 + reduced-motion 兜底（保留反馈语义） |
| `interaction.md` | tactile press / reward-claim flow / progress-update 动画 + 全 state 覆盖（含 success / celebration / locked） |
| `reference-anchors.md` | 8 个真实 gold-standard 范例（Duolingo / Apple Fitness / Headspace / Robinhood / Cash App / Finch / Habitica / Monkeytype），每个 = 名字 + 在哪看 + 为何典范 + 学这一件事。供 reference-grounding pipeline 消费 |

## 八条铁律（速查）

完整 gate 形式见 `game-style-rules.md`。

1. **庆祝有上限** — celebration 动画 ≤ 1200ms 完整、≤ 1 次 / 动作；confetti / level-up 不连发、不全屏霸占
2. **诚实进度** — 进度条 / ring 反映真实状态，不灌水、不在 99% 卡住逼充值；"差一点点"必须是真的差一点点
3. **没有 fake urgency** — 不准 fake countdown、不准"再不打卡 streak 就没了"式焦虑勒索、不准虚假稀缺
4. **juice 永不阻塞输入** — 庆祝 / 弹跳 / 粒子期间，下一个动作立刻可点；动画可被打断
5. **粒子有预算** — confetti ≤ 一次 burst（建议 ≤ 80-150 粒）、持续 ≤ 2s；常驻 shimmer / glow 每屏 ≤ 1 处
6. **motion-sensitive 兜底** — `prefers-reduced-motion` 下保留**反馈语义**（数字变了、勾出现了、色块亮了），只去掉弹跳 / 粒子 / 屏幕抖动
7. **streak 不绑架** — streak 断了给温柔的恢复机制（streak freeze / 补签），不羞辱用户、不用损失厌恶逼复购
8. **反 childish slop** — 不堆 emoji、不彩虹渐变满屏、不卡通弹簧音效轰炸；juice 是"克制的手感"不是"廉价的热闹"

## Dimension 权重先验

| Dimension | 典型权重 | 备注 |
|-----------|---------|------|
| Visual | 4 | progress 可视化 / badge / 状态色是核心表达 |
| Interaction | 5 | tactile press / reward-claim / state 切换密集，必须有手感 |
| Motion | 5 | juice 是 game-style 的灵魂，但要克制 |
| Perspective | 4 | hub / focus-mode / 进度叙事的信息架构 |
| Accessibility | 4 | motion-sensitive 用户 + 色盲友好的进度色，**权重比 canvas 高** |
| Responsive | 4 | 这类产品**移动优先**，触屏 hit target 是一等公民 |

> 这是先验，用户可在 Stage 0 调整。注意：相比 canvas（桌面优先、a11y=3），game-style 把 **Responsive 和 Accessibility 都拉到 4** —— 因为它天生是 mobile-first 消费产品，且 motion 重，必须照顾 motion-sensitive。

## Stage 加载行为

| Stage | 加载本 archetype 后多做什么 |
|-------|----------------------------|
| 0 | dimension 权重建议用先验表打底（Motion/Interaction=5，Responsive/A11y=4）；提醒用户先锁 L3 视觉风格 |
| 1 | reference 选型推荐 `reference-anchors.md` 的 8 个范例；优先研究"在 reward loop 上强"的 reference |
| 2 | extract card 多一节"game-style pattern observed"（这个产品的 reward loop 是什么 / 庆祝放在哪 / 怎么避免 dark pattern）；direction 候选必须明确选 layout 模式（card-deck / focus-mode / hub-map）+ 主 reward 机制 |
| 3 | variant 中必须至少有一个 surface 跑通一个完整 reward loop（动作 → 反馈 → 进步 → 庆祝）；红队跑 8 铁律 + dark-pattern 审查 |

## 运行时推荐（不强制）

- **Framer Motion**（Motion）— spring 物理、`AnimatePresence`、`layout` 动画、gesture（tap/whileTap 的 press 手感）
- **Lottie**（lottie-web / lottie-react）— 复杂的 mascot / 成就解锁 / level-up 矢量动画（设计师在 After Effects 出，工程零手写）
- **rive**（@rive-app/react-canvas）— 交互式、状态机驱动的角色 / 进度部件（比 Lottie 更适合"会响应用户输入"的动画）
- **canvas-confetti** — 一次性庆祝 confetti burst（轻量、零依赖、易加预算上限）

详见 `layout-engines.md` 的库选型决策树。

> **不推荐** Pixi.js / Three.js 作为默认 —— 那是给真·游戏渲染的重武器，做"gamified 产品 UI"用 Framer Motion + Lottie + confetti 足够，且更容易守住"克制"和"不阻塞输入"两条铁律。

## 不允许

- 跨类型套用（把 game-style archetype 拿来做 dashboard / admin / 严肃工具主界面）
- 把 game-style 当成 L3 视觉风格去 style-lock（它是结构 + 机制层，不是皮肤）
- archetype 自己规定颜色 / 字体 / 圆角 / 阴影（那是锁定的 L3 的活）
- 在主流程的 `SKILL.md` / `program-director.md` 里硬引用本 archetype
- 把 8 铁律当成"建议"而不是"红队 gate"
- 用 dark-pattern gamification（fake urgency / streak 勒索 / 进度灌水 / 损失厌恶逼充值）—— 这是**伦理红线**，不是风格选择
