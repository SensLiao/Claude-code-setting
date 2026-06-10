# Reference Anchors — Game-style Gold Standards

> 8 个**真实**的 gamified-UI 范例，供 reference-grounding pipeline（Stage 1 reference 选型 + Stage 2 提取）消费。
>
> 每个 = **名字 / 在哪看 / 为何典范 / 学这一件事（ONE thing）**。"学这一件事"是关键 —— 不要笼统模仿整个 app，而是精准提取它做得最好的那一点。
>
> **重要边界**：这些是**学机制和手感**的参照，不是抄视觉。视觉皮肤由锁定的 L3 风格决定。从这里学"streak 怎么动 / 庆祝怎么克制 / 进度怎么可视化"，**不**学"它用什么颜色 / 字体"。

| # | 范例 | 类型 | ONE thing |
|---|------|------|-----------|
| 1 | Duolingo | 语言学习 | streak 火苗 + 联赛分组的"健康竞争" |
| 2 | Apple Fitness | 健身 | 三环闭合 = 一眼可读的目标梯度 |
| 3 | Headspace | 冥想 | 克制、温暖、非焦虑的成长激励 |
| 4 | Robinhood | 金融 | 把 juice 用在边缘而非关键数字上 |
| 5 | Cash App | 金融/支付 | 成熟、有质感的微 juice（反幼稚） |
| 6 | Finch | 习惯养成 | mascot 情感联结驱动坚持 |
| 7 | Habitica | 习惯/RPG | 完整 RPG 机制映射真实生活任务 |
| 8 | Monkeytype | 打字训练 | 极简载体上的即时连击/正误反馈 |

---

## 1. Duolingo

- **在哪看**：iOS / Android app（duolingo.com）；设计公开分享见 Duolingo Design（design.duolingo.com）+ 他们的设计博客。
- **为何典范**：行业公认的 gamification 天花板 —— streak、XP、联赛（League）、宝石、lives、quest 一整套机制咬合得极好，且**克制不油腻**。吉祥物 Duo 有性格但不幼稚（"专业的可爱"）。
- **学这一件事**：**streak 火苗 + 联赛分组**。streak 用损失厌恶驱动留存，但配 streak freeze 给台阶（正是本 archetype 铁律 7）；联赛把全球用户**分成 ~30 人小组按周晋降级**，让每个人都在势均力敌的同温层竞争 —— 这是把"对比"做健康的范本（铁律对应 pattern 8）。研究它**怎么避免让排名变成羞辱**。

## 2. Apple Fitness（Activity Rings）

- **在哪看**：Apple Watch / iPhone Fitness app；Apple HIG 有 Activity rings 的设计说明（developer.apple.com → Human Interface Guidelines）。
- **为何典范**：三环（Move / Exercise / Stand）是**信息可视化 + 目标梯度**的极致 —— 不看一个数字，看"环闭没闭"，闭环带来强烈的完成冲动。多年验证的留存利器。
- **学这一件事**：**闭环作为目标梯度**。一个 progress ring 凭"差一点就满了"的视觉张力，比任何百分比文字都更能驱动行为。研究**闭合瞬间的那个 pop**（环微胀回弹）—— 克制、一次性、有分量，是 pattern 1 的黄金参照。也学它**月度成就徽章**的稀缺感。

## 3. Headspace

- **在哪看**：iOS / Android app（headspace.com）；其插画 / 动画风格在设计圈被反复引用。
- **为何典范**：把 gamification 做得**温暖、非焦虑**的代表。冥想 streak / run streak 存在但**绝不勒索** —— 断了的语气是"没关系"。圆润的角色、柔和的动效，营造"安全感"而非"竞争压力"。
- **学这一件事**：**非焦虑的激励语气**。同样是 streak，Headspace 证明可以**激励而不施压**（铁律 7 的活教材）。研究它的**动效节奏（慢、柔、呼吸感）** —— 对冥想 / 健康 / 心理类产品，juice 要"安抚"不要"亢奋"，是 `motion-tokens.md` 里 `spring-soft`/`spring-heavy` 的应用场景。

## 4. Robinhood

- **在哪看**：iOS / Android app（robinhood.com）；其交互动效（尤其早期的开户彩纸、数字滚动）被广泛讨论。
- **为何典范**：金融产品里**juice 用得克制且精准**的样本 —— 把动效放在**边缘激励层**（开户完成、达成里程碑），核心的资产数字 / 交易确认保持冷静专业。注：Robinhood 曾因庆祝彩纸被批评"把交易游戏化"后**移除了下单彩纸** —— 这本身就是**反 dark-pattern 的活案例**。
- **学这一件事**：**juice 放边缘，不放关键决策**。这是 game-style 用于金融 / 严肃产品的核心纪律（README "不适用" + 铁律 3）：成长 / 储蓄目标的里程碑可以庆祝，但**不在"下单 / 转账"这种高风险动作上加 confetti 诱导冲动**。研究它**移除下单彩纸前后的争议**，理解边界在哪。

## 5. Cash App

- **在哪看**：iOS / Android app（cash.app）；其品牌 / 动效以"大胆但成熟"著称。
- **为何典范**：证明 micro-juice 可以**有质感、不幼稚**。转账成功的反馈、Boost 解锁、扫码的交互都有手感，但整体气质是**自信的极简**，不是廉价热闹。是"gamified ≠ childish"（铁律 8）的最佳反例证。
- **学这一件事**：**成熟的微 juice**。研究它**单个成功反馈的克制**（一次干净的确认动效，不堆砌）—— 这正是铁律 8 想要的"克制的手感"。当 L3 锁的是高级 / 品牌向风格时，参照 Cash App 的 juice 密度（少而精）。

## 6. Finch

- **在哪看**：iOS / Android app（finchcare.com）；App Store 自我关怀 / 习惯类常年高榜。
- **为何典范**：用一只需要被照顾的**宠物（mascot）**把"习惯养成"和"情感联结"绑定 —— 完成自我关怀任务 → 宠物获得能量去冒险。情感驱动比纯数字激励更黏。
- **学这一件事**：**mascot 作为情感杠杆**。研究它**怎么让一个角色的状态（情绪 / 成长）映射用户的坚持**，让"为自己坚持"变成"为它坚持"（这是 rive 状态机动画的典型用例，见 `layout-engines.md`）。注意它如何**不施压**地用陪伴而非焦虑驱动（呼应铁律 7）。

## 7. Habitica

- **在哪看**：iOS / Android / web（habitica.com，开源）；社区 wiki 详尽记录其机制。
- **为何典范**：把生活任务**完整映射成 RPG**（HP / XP / 金币 / 装备 / 副本 / 公会）的极端样本 —— 完成习惯加经验、漏掉扣血。展示了"全套游戏机制套在真实任务上"能走多远。开源 = 可深挖实现。
- **学这一件事**：**机制到任务的映射逻辑**。研究它**怎么把抽象的"坚持"翻译成具体的游戏后果**（任务 = 怪、漏做 = 掉血、连续 = 升级）。学它的**机制完整性**，但**警惕过度**：Habitica 的复杂度对很多产品是过载 —— 提取它的映射思路，按你的产品**做减法**（呼应 pattern 12 的"渐进暴露"而非"一次塞满"）。

## 8. Monkeytype

- **在哪看**：monkeytype.com（web，开源，github.com/monkeytypegame/monkeytype）。
- **为何典范**：极简打字训练，**几乎没有传统 gamification 装饰**，却把**即时反馈做到极致** —— 每个字符的正 / 误即时变色、WPM 实时跳动、连续正确的流畅感。证明"juice"可以是**纯粹的即时反馈手感**，不需要彩纸和徽章。
- **学这一件事**：**极简载体上的即时正误反馈 + combo 流畅感**（pattern 9 的纯净形态）。研究它**怎么用最少的视觉做最强的即时反馈** —— 字符着色 / 数字跳动 / 节奏感，全在 focus-mode（`layout-engines.md`）里。当 L3 锁的是 brutalist / 极简风格时，这是"克制到极致仍有手感"的最佳参照。

---

## 给 Stage 1 / Stage 2 的使用提示

- **Stage 1（reference 选型）**：从这 8 个里挑**与目标产品 reward loop 最接近**的 2-3 个深研，而非全抓。习惯类 → Finch/Duolingo/Habitica；健身 → Apple Fitness/Headspace；金融边缘激励 → Robinhood/Cash App；纯反馈手感 → Monkeytype。
- **Stage 2（提取卡）**：每个 reference 的提取聚焦它的 **ONE thing**，填进 extract card 的"game-style pattern observed"节 —— 别把一个 app 的所有东西平铺照搬。
- **反 slop 提醒**：这些范例的共同点是**克制**（铁律 8）。如果你的提取结论是"满屏 emoji + 彩纸 + 弹跳"，说明抄错了方向 —— 重看它们**为何不幼稚**。
- **L3 边界**：从这里抽**机制和手感**，视觉皮肤永远由锁定的 L3 风格出。截图它们做参考研究 OK；把它们的配色 / 字体直接搬进 variant 不 OK。
