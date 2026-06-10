---
name: game-style-interaction
description: Game-style 专项核心 — tactile press / reward-claim flow / progress-update 动画 + 全 state 覆盖（含 success / celebration / locked）。所有"按下去有手感 / 拿奖有仪式感 / 进度涨得爽 / 庆祝克制不油腻"的交互收敛在这里。命中条件：用户在做习惯 app / 学习 app / 健身 / 带 reward 的 onboarding / 任何 gamified 产品界面。
type: knowledge
parent: game-style-archetype
siblings:
  - patterns-index
  - layout-engines
  - motion-tokens
  - game-style-rules
---

# Game-style — Interaction Spec

## 责任边界

本文件**只**定义 game-style 的核心交互手感 + 完整 state 覆盖。

不做的事：
- 不定义 12 个 pattern 的机制结构（→ `patterns-index.md`）
- 不定义布局编排 / 库选型（→ `layout-engines.md`）
- 不定义 spring 参数 / duration / reduced-motion 兜底细节（→ `motion-tokens.md`）
- 不定义铁律 gate（→ `game-style-rules.md`）
- 不规定颜色 / 字体 / 圆角（→ 锁定的 L3 视觉风格）
- 不写最终生产代码（→ Stage 3 prototype）

## 核心交互三件套

game-style 的"手感"集中在三个交互上，做好这三个，产品就"活"了。

### A. Tactile Press（按下去有手感）

每个可点元素（按钮 / 卡片 / 答案选项）都要有**物理可信的按压反馈**。这是 game-style 区别于普通 UI 的第一道分水岭。

**按压三段**：

| 段 | 状态 | 表现 | token |
|----|------|------|-------|
| 1 | press-down（按下） | `scale 0.96`（或 `scaleY:0.94` 配 `transformOrigin:bottom`），≤80ms | `press-squash` |
| 2 | hold（按住） | 维持压下态；可叠极轻的阴影收缩（"贴近表面"） | — |
| 3 | release（松手） | 弹回经 `scale 1.03` overshoot 回 `1` | `release-stretch` + `spring-bouncy` |

**关键细节**：

- 按下用 `whileTap`（Framer Motion）或 `:active`（CSS），**立即响应**，零延迟 —— 延迟是手感杀手
- 触屏上 press 态要在 `touchstart` 就触发，不等 `click`
- 阴影 / 高光变化要跟着 press 走（按下"陷进去"，松手"浮起来"），强化拟物
- **不**给每个按钮配音效（铁律 8）；音效若有，只给关键动作且可关
- 主 CTA 可有一个极轻的常驻"待按"呼吸（scale 1↔1.02，2s 循环），但每屏 ≤1 个（避免满屏蠕动）

### B. Reward-Claim Flow（拿奖有仪式感）

领奖是 game-style 的情绪高点，要有**悬念 → 揭晓 → 入袋**的完整仪式（pattern 6）。

**领奖四段**：

```
1. ANTICIPATION  奖励容器（盒/卡/宝箱）出现 + 轻微蓄力下压（anticipation-dip, scale 0.92, 100ms）
       ↓ 用户点击"领取"（tactile press A）
2. BUILD-UP      容器抖动 / 蓄力 80-120ms，制造"要开了"的张力
       ↓
3. REVEAL        容器打开，奖励内容 overshoot 弹出（spring-bouncy）+ 一次微光扫过（≤1次）
       ↓
4. SETTLE        内容回稳入位（spring-soft），数值入账（XP/金币飞向计数器并 +N，pattern 4）
```

- 全程 ≤900ms（reward reveal），含的庆祝若升级到 milestone 级 ≤1200ms（铁律 1）
- **奖励必须是确定性的已挣得内容**（用户知道赢了什么类别）—— **绝不**做付费随机抽卡（铁律 3 / pattern 6）
- 领取按钮按下后**立即**进入流程，不能卡顿（铁律 4）
- 数值入账的"飞行 +N"要飞向真实的计数器位置，让因果可见

### C. Progress-Update（进度涨得爽）

进度变化（ring 填充 / bar 增长 / streak +1 / XP 累加）要让用户**清楚地感到"我推进了"**。

| 进度类型 | 更新动画 | token |
|---------|---------|-------|
| Progress ring 填充 | `stroke-dashoffset` 平滑推进到新值；若闭合 → 闭合 pop（微胀回弹） | `--juice-base` + `spring-soft`（pop） |
| Segmented bar 进格 | 新段**阶跃**填充（强调"跨过一格"），非平滑滑动 | `--juice-quick` |
| Streak +1 | 数字翻牌（旧上滚出 / 新下滚入）+ 火苗脉冲一次 | `spring-snappy`（翻牌） |
| XP 累加 | bar 增量填充；若升级 → 溢出 → level-up（pattern 11） | `--juice-base` |
| Combo +1 | 数字弹跳缩放 + 颜色升温 | `spring-bouncy` |

- 进度动画**绝不**虚报（铁律 2）：填到的位置 = 真实进度，"差一点"是真的差一点
- 高频进度更新（打字 WPM / combo）要节流但**不丢反馈语义**，不能让输入卡（铁律 4）
- 进度从 99%→100% 闭合那一下是情绪点，值得一个 pop；但中途每次微涨不需要都庆祝

---

## 全 State 覆盖（每个交互元素都要齐）

game-style 元素的状态比普通 UI 多两个关键态：**celebration** 和 **locked**。下表是**每个可交互元素必须定义全的状态矩阵**。

| State | 何时 | 表现要点 | a11y |
|-------|------|---------|------|
| **default** | 静止可用 | 清晰可点的 affordance（不扁平、有层次） | 4.5:1 文本对比 |
| **hover**（指针） | 鼠标悬停 | 轻微抬起 / 高光 / 颜色微变，`--juice-micro` | 不依赖颜色单一通道 |
| **focus**（键盘） | Tab 聚焦 | **可见 focus ring**，不与品牌色撞 | 必须可见可定位 |
| **press / active** | 按下中 | tactile press A（squash） | 触屏 touchstart 即触发 |
| **disabled** | 不可用 | 降透明 / 去饱和，**明确"现在不行"** | `aria-disabled`，仍可被读屏感知 |
| **loading** | 等待中 | 部件内 spinner / skeleton，**不冻结整屏**（铁律 4） | `aria-busy` |
| **selected / correct** | 选中 / 答对 | 即时正反馈（变色 + 勾），combo 可累加 | 不只用绿色（配勾/图标） |
| **error / incorrect** | 答错 / 失败 | 即时负反馈（变色 + 轻 shake ≤200ms），**不羞辱** | 不只用红色（配 ✕/图标） |
| **success** | 动作成功完成 | 干净的成功态（勾 + 色），日常成就用轻量（≤400ms） | 颜色 + 图标 + 文案三通道 |
| **celebration** | **里程碑**达成 | 全套庆祝（pattern 11）：≤1200ms、confetti ≤1 burst、overlay 可消散、**下一步立即可点** | reduced-motion 兜底（铁律 6） |
| **locked** | 未解锁 | **灰阶剪影**（暗示"存在但没拿到"，制造目标）+ 锁图标 + 解锁条件提示 | 剪影可被读屏识别为"locked: <条件>" |
| **just-unlocked** | 刚解锁瞬间 | 灰 → 彩翻转 + 一次微光（≤1次），然后进 default | reduced: 100ms crossfade |
| **empty / streak-broken** | 无数据 / streak 断 | **温柔**的空态 / 鼓励文案（铁律 7），给恢复入口（freeze/补签） | 文案不恐吓、不羞辱 |

### 三个 game-style 特有态的细则

**celebration（庆祝态）** —— 最容易出 slop 的地方：
- 只在**真正重要**的节点触发（升级 / 大目标 / 成就），日常小成就用 success 态即可
- ≤1200ms、≤1次/动作、confetti ≤80-150 粒单次 burst（铁律 1+5）
- overlay 必须**可一键或自动消散**，核心内容不被长时间遮挡
- **庆祝期间下一个动作立即可点**（铁律 4）—— 庆祝是糖不是墙
- reduced-motion：退化为 ≤150ms 的中心高亮 / 勾定格，**仍传达"达成了"**（铁律 6）

**locked（锁定态）** —— 目标拉力的来源：
- 用**灰阶剪影**而非完全隐藏（"我看得到但还没拿到" = 目标梯度）
- 给**明确的解锁条件**（"再完成 3 节解锁"），不要神秘到无从下手
- 解锁瞬间走 just-unlocked（翻转 + 微光），让"挣到了"有回报感
- 读屏要能读出"locked: 解锁条件"，不能只是个看不懂的灰块

**empty / streak-broken（空态 / 断签态）** —— 伦理高发区：
- streak 断了：温柔语气（"休息一天没关系，明天继续"）+ 恢复入口，**绝不**红字恐吓 / 损失轰炸（铁律 7）
- 首次空态：用鼓励 + 明确的"第一步"引导（呼应 quest pattern 12 的渐进暴露）
- 不在空态用焦虑 / 羞辱逼用户行动

---

## 交互 × Pattern 速查

| 你在做 | 用哪个交互 + 哪些 state |
|--------|------------------------|
| 答题选项 | tactile press A + correct/incorrect 即时态 + combo 累加 |
| 每日打卡按钮 | tactile press A + success → 触发 streak +1 (progress-update C) |
| 领取每日奖励 | reward-claim flow B + celebration 态 |
| 升级 | progress-update C (XP) → 溢出 → celebration 态 (milestone) |
| 成就墙 | locked 剪影态 + just-unlocked 翻转 |
| 技能树节点 | locked / current(脉冲) / done 三态 + 解锁庆祝 |
| 打字 / 节奏实时反馈 | correct/incorrect 即时态 + combo（高频节流不丢反馈，铁律 4）|

---

## 与其他文件的握手

| 何时 | 看哪个文件 |
|------|-----------|
| 需要某个 pattern 的机制结构 | `patterns-index.md` |
| 需要 spring 参数 / duration / 庆祝时长 | `motion-tokens.md` |
| 需要决定布局 / 选库 | `layout-engines.md` |
| 红队自查是否过 gate | `game-style-rules.md` |
| 需要外观（色/字/圆角/质感） | 锁定的 L3 风格（archetype 不管这个） |

## 失败模式

| 症状 | 急救 |
|------|------|
| 按钮点下去"没反应感" | 加 tactile press A（squash + 即时响应）；检查是不是有点击延迟 |
| 庆祝看起来很廉价 / 幼稚 | 走铁律 8 —— 减 emoji / 减彩虹 / 减音效；庆祝改克制（铁律 1+5）；重看 reference-anchors 的 Cash App / Apple Fitness |
| 答错动画让人有挫败 / 被羞辱感 | error 态去戏剧化（轻 shake ≤200ms 即可），不做夸张失败演出；检查文案 |
| reduced-motion 下庆祝完全没了 | 铁律 6 —— 补 ≤150ms 的高亮 / 勾定格，**保留"达成了"语义** |
| 庆祝期间点不了下一步 | 铁律 4 —— juice 不阻塞输入；庆祝改 overlay + 下一步立即可点 |
| streak 断了用户很受伤 | 铁律 7 —— 改温柔文案 + 加 freeze/补签恢复入口 |
| 进度条一进来就 30% | 铁律 2 —— 进度必须从真实状态起步，删水分 |
| 看起来像第 4 种视觉风格在抢 L3 槽 | 退回 README "怎么 COMPOSE" —— archetype 只给结构/机制，外观让 L3 出 |
