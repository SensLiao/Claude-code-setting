# Bubble-Physics Patterns — Index

> 11 个核心物理 pattern。完整 drag/throw/collision spec 见 `interaction.md`；spring 数值见 `motion-tokens.md`；引擎选型见 `layout-engines.md`。
>
> 每个 pattern 都标注它**替代的 gimmick 反模式**——即"用物理把一个本来很俗/很假的效果做对"。物理不是用来炫技，是用来让"重量/邻近/惯性"承载真实信息。

## 速查表

| # | Pattern | 核心动作 | 主引擎 | 默认 preset | 替代的 gimmick |
|---|---------|---------|--------|------------|----------------|
| 1 | Bubble Cluster | 多气泡自组织、互不重叠 | d3-force + forceCollide | gentle | "假装漂浮"的 CSS `@keyframes float` 无碰撞糊版 |
| 2 | Drag-and-Throw | 拖起→甩出→惯性滑停 | use-gesture + react-spring | snappy | drop 即 `transition: 0.3s` 的死板归位 |
| 3 | Magnetic Snap | 靠近吸附点自动吸入 | spring + 吸引力 | snappy | 硬 `if(dist<x) pos=slot` 的瞬移咔哒 |
| 4 | Collision Repel | 推一个、挤开邻居 | Matter.js / forceCollide | snappy | z-index 叠在一起的穿模 overlap |
| 5 | Gravity Well | 拖向中心/分类区被吸落 | 引力场 + friction | gentle | 拖到框上方就高亮的无重量 dropzone |
| 6 | Elastic List | 列表项过冲回弹 | spring per-item | gentle | `ease-in-out` 线性滑入的塑料感列表 |
| 7 | Rubber-band Scroll | 滚到边界橡皮筋阻尼 | spring(over-clamp) | gentle | 滚到底直接"哐"撞死的硬边界 |
| 8 | Soft-body Card | 拖动时卡片倾斜/形变/惯性尾随 | spring(rotate+skew) | snappy | 永远刚体平移的"贴纸卡片" |
| 9 | Floating Tags | 标签云轻浮 + 可推开 | d3-force 低 alpha | gentle | 旋转的 3D tag sphere（炫但不可用） |
| 10 | Pressure-Size Mapping | 用半径/重量编码数值 | force + radius scale | gentle | 一样大的 chip 配个小数字标签 |
| 11 | Settle-to-Rest | 一切运动收敛到静止 | velocity sleep | —（全局） | 永不停的 ambient jitter（晕 + 烧电） |

---

## 1. Bubble Cluster（气泡簇）

- **intent**：一堆同类元素（标签/头像/选项）自组织成有机簇，彼此**不重叠**，整体可拖可推，传达"它们是平等的一群"。
- **structure**：`d3-force` 跑 `forceManyBody`(轻斥力) + `forceCollide(r+pad)` + `forceCenter`；每个气泡 = 一个 node，radius 可按数据变（接 Pattern 10）。alpha 衰减到阈值后 freeze。
- **when-to-use**：兴趣/标签多选、团队头像墙、"挑几个"型选择器；元素数 5–60、无固定顺序、邻近无强语义时最佳。
- **替代的 gimmick**：纯 CSS `@keyframes float` + `position:absolute` 随机撒点——元素会穿模重叠、漂得没逻辑、拖不动。Bubble Cluster 用真碰撞让"一群"看起来是物理上成立的一群。

## 2. Drag-and-Throw（拖拽抛掷）

- **intent**：抓起元素→甩动→松手后带惯性滑行并摩擦停下，让元素有真实"重量"。
- **structure**：`@use-gesture` 采 `velocity`+`direction`；松手时把 velocity 喂给 `react-spring` 的 `decay`/`dragTransition`（power + timeConstant）；容器 `dragConstraints` clamp + rubber-band（接 Pattern 7）。
- **when-to-use**：可重排的卡片、把东西"丢进"某区（接 Pattern 5）、轻量游戏化操作；触屏主场。
- **替代的 gimmick**：松手即 `transition: transform 0.3s ease` 归位——丢得再用力都同一速度回弹，假。Drag-and-Throw 让甩得快=飞得远，符合直觉。

## 3. Magnetic Snap（磁吸对齐）

- **intent**：元素靠近某个目标槽位/网格点时，被"磁力"平滑吸入，给出确定的落点又不失柔顺。
- **structure**：drag 中实时算到最近 snap target 的距离；< 吸附半径时叠加一个指向 target 的 spring（高 stiffness 短行程）；松手在吸附区则 settle 到 target，否则自由 Drag-and-Throw。
- **when-to-use**：需要"自由摆 + 又要对齐"的场景——分组、排序到固定位、拖进具体槽。
- **替代的 gimmick**：`if (dist < threshold) position = slot` 的硬瞬移——咔一下跳过去，突兀。Magnetic Snap 用 spring 把"吸"做成可感知的连续过程。

## 4. Collision Repel（碰撞排斥）

- **intent**：拖动/新增一个元素会**物理地挤开**周围元素，永不穿模，传达"空间是被占用的、是实的"。
- **structure**：`Matter.js` 真刚体碰撞，或 `forceCollide` 在拖动节点上提高 strength；被推开的元素带阻尼回流。broadphase 先筛、只对邻近对做窄相位检测（接铁律 3 预算）。
- **when-to-use**：密度感重要的簇、"塞进去会挤"的收纳、物理拼图；元素少且大时手感最实。
- **替代的 gimmick**：直接 `z-index` 叠着放、互相穿过去——看起来像贴纸而非实体。Collision Repel 让"挤"成为真实反馈。

## 5. Gravity Well（引力井 / 吸落区）

- **intent**：某个区域（分类桶、收集篮、中心点）有"引力"，元素被拖近时加速吸落，明确"这里是归宿"。
- **structure**：对每个 well 定义一个 attraction field（距离越近力越大，带上限）；进入 capture 半径后切换到强 spring 吸入 + 轻微 squash 落地；friction 防止过冲弹出。
- **when-to-use**：分类/归档、"丢进桶"型 onboarding、把多选项收敛到几个目标。
- **替代的 gimmick**：拖到 dropzone 上方就整块高亮变色的无重量提示——没有"被吸"的体感。Gravity Well 让归类有引力的因果感。

## 6. Elastic List（弹性列表）

- **intent**：列表项进入/重排时带轻微过冲回弹，让"插入/移动"有弹性生命感，而非塑料滑动。
- **structure**：每个 item 一个 spring（`layout`/`FLIP` + spring 过渡）；进入用 `scale 0.9→1` overshoot 到 1.0；重排用 spring 跟随目标 y。**幅度极小**（过冲 ≤ 6px），这是点缀不是主物理场。
- **when-to-use**：可增删/可拖排的列表、待办、收件箱；整页仍是列表语义，只在动作瞬间注入弹性。
- **替代的 gimmick**：`ease-in-out` 线性滑入——所有项一个速度、毫无重量差异。Elastic List 用 spring 让插入有"落位感"。

## 7. Rubber-band Scroll（橡皮筋滚动）

- **intent**：滚动/拖动到内容边界时，超出部分以橡皮筋阻尼继续一点点再弹回，告知"到头了"而不生硬。
- **structure**：滚动位移越过 [min,max] 后，超出量乘衰减系数（如 0.5）做 resistance，松手 spring 回弹到边界；过冲上限 ≤ 容器 16%。
- **when-to-use**：可滚区域、横向 carousel、抽屉、任何"到边"需要软提示的地方；iOS 用户的肌肉记忆。
- **替代的 gimmick**：滚到底直接 `overflow:hidden` 硬撞停——像撞墙。Rubber-band 把边界做成有弹性的反馈。

## 8. Soft-body Card（软体卡片）

- **intent**：拖动卡片时它略微倾斜、尾随、形变，松手回正，赋予"卡片有柔性和惯性"的体感（≠刚体平移）。
- **structure**：drag 速度映射到 `rotateZ`/`skew`（小角度，≤ 8°）用 spring 跟随；位置 spring 比指针**略滞后**制造惯性尾随；松手回 `rotate:0`。形变只走 transform。
- **when-to-use**：卡片是主角的界面（Tinder 式、相册、看板卡）；少量大元素时最值。
- **替代的 gimmick**：拖动时卡片永远水平刚性平移的"贴纸感"。Soft-body 用倾斜+滞后让卡片像有质量的实物。

## 9. Floating Tags（浮动标签）

- **intent**：标签/关键词轻轻浮动、可被指针推开，营造"活的标签云"，但**克制**——浮动幅度极小且会 settle。
- **structure**：`d3-force` 极低 alphaTarget 维持微动 + `forceCollide` 防重叠；指针附近加一个排斥力把标签推开，移开后 spring 回流并最终 settle（受铁律 4 约束，不许永浮）。
- **when-to-use**：关键词探索、tag picker、装饰性但需可交互的 hero 标签区。
- **替代的 gimmick**：旋转的 3D tag sphere（TagCanvas 式球）——炫但难点中、对触屏和 a11y 灾难。Floating Tags 保持 2D 可点、可键盘遍历，物理只做"轻盈感"。

## 10. Pressure / Size Mapping（压力—尺寸映射）

- **intent**：用气泡的**半径/重量**直接编码数值（热度、人数、价格、权重），让"大小=多少"一眼可读，而非读小字。
- **structure**：node.radius = `scaleSqrt(value)`（用面积而非直径线性，避免视觉夸大）；radius 越大 mass 越大 → 在 force/collision 里更"沉"、更难被推动，物理上也体现权重。
- **when-to-use**：需要把"量级差异"做成可感知物理量的簇——市值气泡、话题热度、技能熟练度。
- **替代的 gimmick**：所有 chip 一样大、靠旁边一个小数字区分——量级感全靠读。Pressure-Size 让数值变成可见的体积 + 可感的重量。

## 11. Settle-to-Rest（收敛静止）—— 全局约束 pattern

- **intent**：以上所有运动最终都**安静下来**。这是约束所有其它 pattern 的"终态契约"，不是独立特效。
- **structure**：全局 velocity 阈值（< 0.01）触发 sleep，停止 RAF tick；d3-force 跑到低 alpha 后 `stop()`；spring 到达 rest 后卸载监听。交互打断则唤醒。
- **when-to-use**：**永远**。每个物理 surface 都必须实现，否则违反铁律 4。
- **替代的 gimmick**：永不停的 ambient jitter / 持续漂浮——视觉噪音 + 持续占 CPU/GPU + 让人晕。Settle-to-Rest 保证物理是"被触发的瞬时反馈"，不是"永动的背景动画"。

---

## Pattern × 引擎 / 预算 速查

| Pattern | d3-force | spring(react-spring/Framer) | Matter.js/Rapier | 典型刚体数 |
|---------|----------|------------------------------|------------------|-----------|
| 1 Bubble Cluster | ✅ 主战场 | ⚠️ 元素少时可逐元素 | ⚠️ 过重 | 5–60 |
| 2 Drag-and-Throw | ❌ | ✅ 主战场 | ⚠️ | 1–10 |
| 3 Magnetic Snap | ❌ | ✅ | ❌ | 1–10 |
| 4 Collision Repel | ✅(forceCollide) | ❌ | ✅ 真刚体时 | ≤ 40 |
| 5 Gravity Well | ⚠️(自定义力) | ✅ | ✅ | 1–20 |
| 6 Elastic List | ❌ | ✅ 主战场 | ❌ | 5–50(虚拟化) |
| 7 Rubber-band Scroll | ❌ | ✅ | ❌ | 1 |
| 8 Soft-body Card | ❌ | ✅ 主战场 | ❌ | 1–5 |
| 9 Floating Tags | ✅ 主战场 | ⚠️ | ❌ | 8–40 |
| 10 Pressure-Size | ✅(radius) | ⚠️ | ✅ | 5–60 |
| 11 Settle-to-Rest | ✅(alpha) | ✅(rest) | ✅(sleep) | — |

> 详细选型决策树见 `layout-engines.md`。
