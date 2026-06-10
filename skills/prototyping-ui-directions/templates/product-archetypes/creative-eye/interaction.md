# Creative-Eye — Interaction Spec

> 12 个核心实验交互 pattern 的完整 cursor / hover / gaze spec + pointer/keyboard/touch 三轨兜底 + 全状态覆盖 + 性能 governor。
>
> 索引见 `patterns-index.md`，动效 token 见 `motion-tokens.md`，铁律 gate 见 `creative-eye-rules.md`。

## 责任边界

本 spec **只**定义 12 个 pattern 的交互行为与三轨兜底。

不做的事：
- 不定义视觉皮肤 / 调色 / 字体（→ 锁定的 L3 风格，本 archetype 只读 L3 token）
- 不定义构图模式（→ `layout-engines.md`）
- 不定义 token 数值表（→ `motion-tokens.md`）
- 不写生产实现代码（→ Stage 2/3 的 prototype-engineer + frontend-design）

## 八条铁律（违反任意一条立即驳回）

完整 gate 形式见 `creative-eye-rules.md`。速记：

1. 每个效果有 touch + keyboard 兜底（pointer-fine 才挂）
2. 效果永不阻塞内容获取
3. `prefers-reduced-motion` 杀所有装饰动效
4. Effect budget 受控（重效果 ≤2 / 磁吸 ≤5 / WebGL hero ≤1）
5. WebGL 优雅降级
6. 无 JS 内容可读
7. 性能预算达标（lerp <1ms / ≥60fps / WebGL ≤1.5MB）
8. cursor 不劫持系统行为（caret/grab 语义 + 焦点可见）

---

## 三轨兜底总则（所有 pattern 通用）

每个 pattern 必须同时定义三条轨道，**不是「桌面版 + 坏掉的移动版」**：

| 轨道 | 触发条件 | 设计要求 |
|------|---------|---------|
| **Pointer-fine（鼠标）** | `(pointer: fine)` 且非 reduced-motion | 完整实验交互（cursor-follow / 磁吸 / gaze / trail / distortion）|
| **Keyboard（键盘）** | `:focus-visible` / Tab 导航 | 焦点环清晰；磁吸不偏移、精确落位；hover-only 内容有 focus 等价；reveal 内容可 Tab reach |
| **Touch（触屏）** | `(pointer: coarse)` | 有意设计的静态/tap 版本：cursor 效果隐藏、hover→tap、trail→静态缩略、gaze→静止默认 |

> 探测用 `matchMedia('(pointer: fine)')` + `matchMedia('(prefers-reduced-motion: reduce)')`，且监听 change（用户可能外接/拔除鼠标）。

---

## 全状态覆盖矩阵（每个交互元素都要覆盖）

| 状态 | 鼠标 | 键盘 | 触屏 |
|------|------|------|------|
| default / rest | 自定义光标 idle | — | 系统默认 |
| hover / focus | 磁吸 + cursor morph + reveal | `:focus-visible` 环 + reveal 等价 | tap 显内容 |
| active / pressed | cursor 收缩反馈 | `:active` 视觉 | tap 反馈 |
| disabled | cursor `not-allowed` | focus 跳过 / `aria-disabled` | tap 无响应 + 视觉 disabled |
| loading | cursor `wait` / 进度 | aria-busy | spinner |
| text-input 区 | **恢复系统 caret** | caret + focus 环 | 系统键盘 |
| draggable 区 | `grab`/`grabbing` | 键盘拖拽等价（方向键）或说明 | touch drag |

---

## 12 个 Pattern 完整 spec

每个 pattern 按 7 字段定义：trigger / pointer-fine / keyboard / touch / reduced / state / non-blocking。

### 1. Custom Cursor

- **trigger**：页面加载 + `(pointer: fine)` 命中
- **pointer-fine**：`position: fixed` 光标元素（ring + dot 两层，`pointer-events: none`），rAF 跟随真实坐标。dot 用 `--cursor-lerp-dot`=1.0 贴真实位置；ring 用 `--cursor-lerp-ring`=0.15 滞后缓动。可选 `mix-blend-mode: difference` 反色。
- **keyboard**：无自定义光标概念；保证 `:focus-visible` 焦点环始终清晰可见
- **touch**：`(pointer: coarse)` 下**不渲染**自定义光标，用系统默认
- **reduced**：恢复系统默认光标，停止 lerp
- **state**：进入文本区恢复 `cursor: text`；可点区 morph（见 #12）；disabled 区 `not-allowed`
- **non-blocking**：光标层 `pointer-events: none`，不挡下层选择/点击（铁律 2）

### 2. Magnetic Button

- **trigger**：光标进入元素感应半径（`--magnetic-radius`=1.5× 尺寸）
- **pointer-fine**：按距离比例对元素 `translate`，最大位移 = 元素半宽 × `--magnetic-strength`(0.3)；离开用 `--magnetic-spring` 回弹
- **keyboard**：`:focus` 时**不偏移**，元素精确落位；焦点环正常（吸附只对鼠标生效，铁律 1）
- **touch**：无磁吸，普通 tap；保留正常按压反馈
- **reduced**：无磁吸，hover 仅颜色/边框反馈
- **state**：active 时光标收缩 + 元素轻按；disabled 不吸附 + `not-allowed`
- **non-blocking**：吸附不改变可点区 hit-test 的语义；同屏磁吸 ≤ 5（铁律 4）

### 3. Cursor-Follow Eye / Gaze

- **trigger**：眼睛/注视主体在视口内 + `(pointer: fine)`
- **pointer-fine**：瞳孔按光标相对眼球中心的角度，在受限半径内 `translate`，lerp `--cursor-lerp-eye`=0.08；可选父容器 `rotate`（≤ `--tilt-max`=8deg）
- **keyboard**：眼睛静止居中（眼睛不承载信息，键盘用户无损失）
- **touch**：静止默认朝向
- **reduced**：完全静止居中
- **state**：眼睛只是人格糖，无 disabled/loading 语义
- **non-blocking**：不阻挡任何 click/hover；同屏 gaze 主体 ≤ 2（铁律 4）

### 4. Hover Image-Trail

- **trigger**：光标在导航/列表项上移动（`pointermove` 节流）
- **pointer-fine**：沿光标轨迹激活预加载图序列，每张 `opacity`+`scale` 按 `--trail-decay`=0.92 衰减；并存 ≤ 6 张；OGL/WebGL 位移版更顺
- **keyboard**：`:focus` 时显示该项**单张静态**对应图（不做 trail）
- **touch**：tap 显示静态缩略预览（无 trail）
- **reduced**：hover 直接显静态图，无残影
- **state**：图懒加载；加载中显占位
- **non-blocking**：残影区避开正文；不挡链接点击；WebGL trail 计入重效果预算（铁律 4）

### 5. Sticky / Distortion Hover

- **trigger**：光标进入元素
- **pointer-fine**：元素跟随光标受限 `translate`（≤ `--sticky-offset-max`=12px）或 shader/SVG distortion（displacement ≤ `--distortion-scale-max`=20）；离开 spring 复位
- **keyboard**：`:focus` 用静态 outline / 轻微 scale 等价，不做形变
- **touch**：tap 反馈，无粘随
- **reduced**：无形变，hover 仅静态反馈
- **state**：active 时形变到位；distortion 版计入重效果预算
- **non-blocking**：形变不破坏内容可读性与可点区（铁律 2）

### 6. Marquee (kinetic)

- **trigger**：进入视口 / 持续滚动
- **pointer-fine**：内容 2× 拼接 `translateX` 循环（≈ 50-100px/s）；进阶按 scroll velocity 改速/向（GSAP + Lenis）
- **keyboard**：内容是真实文本/链接，可 Tab reach（marquee 是视觉增强，不阻断可达性）
- **touch**：同样滚动，但可被用户滚动手势影响（不抢手势）
- **reduced**：停在静态可读位置
- **state**：承载真实信息（客户名/服务），不是无意义重复
- **non-blocking**：不捕获滚动手势；hover 可暂停（可选）

### 7. Scramble / Decode Text

- **trigger**：标题进入视口（IntersectionObserver）
- **pointer-fine**：Splitting.js 拆字符，每字符按 `--scramble-cycle`=40ms 切乱码、按 `--text-char-stagger`=14ms 定格为目标字符
- **keyboard**：终态文本是 DOM 真实文本，读屏正常念终态（不念乱码 —— 用 `aria-label` 锁定终态，或动画仅作用于视觉副本）
- **touch**：同 pointer 或直接显终态（按性能）
- **reduced**：**直接显示终态文本**，不 scramble
- **state**：终态文本始终在 DOM（铁律 6）；同屏 scramble ≤ 2
- **non-blocking**：scramble 不阻塞页面其他交互

### 8. WebGL Hero

- **trigger**：首屏加载 + WebGL 可用
- **pointer-fine**：全屏 canvas shader，rAF 驱动；可响应光标做交互 ripple
- **keyboard**：WebGL 是装饰层，关键内容（标题/CTA）是 DOM，键盘正常 reach
- **touch**：可降低粒子数/分辨率；或直接静态图
- **reduced**：停止 idle 动画，保留静态首帧或退化静态图
- **state**：context 检测 → 不可用则静态 fallback（铁律 5）；不可见时 IntersectionObserver 暂停 rAF
- **non-blocking**：canvas `pointer-events: none`（除非确需交互）；首屏内容不依赖它（铁律 5）；资源 ≤ 1.5MB（铁律 7）

### 9. Page-Transition Curtain

- **trigger**：路由跳转（链接点击 / 浏览器导航）
- **pointer-fine**：离场 → 幕布/clip-path 覆盖（≤ `--cm-transition`=700ms）→ 新页就绪 → 揭幕；用 View Transitions API 或 Barba/GSAP
- **keyboard**：键盘触发的导航同样过渡；焦点在新页正确落位
- **touch**：同样过渡
- **reduced**：退化为 ≤ 80ms opacity crossfade
- **state**：可中断；浏览器后退/前进即时响应（铁律 2）
- **non-blocking**：覆盖层动画结束**立即移除/禁 pointer-events**；不阻塞后退

### 10. Parallax Depth

- **trigger**：滚动（Lenis / ScrollTrigger / IntersectionObserver 驱动）
- **pointer-fine**：分层 `translateY` = scroll 进度 × `--parallax-ratio`(0.1-0.4)
- **keyboard**：滚动可用键盘（Space/PageDown）；视差不干扰滚动语义
- **touch**：同样视差（克制幅度，防晕）
- **reduced**：所有层锁死（ratio=0）
- **state**：预留空间防 CLS
- **non-blocking**：只动 transform（铁律 7）；不裸写 scroll handler（用 rAF/observer）

### 11. Gaze-Aware Element

- **trigger**：光标在元素附近移动 + `(pointer: fine)`
- **pointer-fine**：元素按光标相对中心向量做受限 `rotateX/rotateY`（≤ `--tilt-max`=8deg）或指向角度，lerp `--cursor-lerp-gaze`=0.10
- **keyboard**：静止默认朝向；`:focus` 有静态反馈
- **touch**：静止默认朝向
- **reduced**：静止默认朝向
- **state**：不承载关键信息（信息靠文字）；同屏 ≤ 2
- **non-blocking**：倾斜不遮挡/不抢主内容注意力（铁律 4）

### 12. Cursor-State Morph

- **trigger**：光标 hover 带 `data-cursor` 的目标
- **pointer-fine**：按目标类型切换 cursor 形态/尺寸/文字标签（作品→"VIEW"、拖拽→"DRAG"、链接→放大 ring），morph `--cm-cursor-morph`=200ms；dot 始终贴真实坐标
- **keyboard**：无自定义光标；`:focus-visible` 环 + 必要时可见标签
- **touch**：用区域内视觉 affordance（角标/图标）替代光标标签
- **reduced**：恢复系统语义光标（pointer/text/grab），无 morph 动画
- **state**：**进入 input/textarea/[contenteditable] 必须恢复系统 text caret**（铁律 8）；拖拽区 grab；disabled 区 not-allowed
- **non-blocking**：morph ≤ 200ms 跟手；语义光标不丢失

---

## 性能 Governor（铁律 7 的执行细则）

所有 pointer / scroll 驱动的 pattern 必须遵守：

### rAF 节流
- **绝不**在 `pointermove` / `scroll` 回调里直接做重计算或读布局（`getBoundingClientRect` / `offsetTop` 等会触发 layout）
- `pointermove` 只存最新坐标到变量；实际 lerp / transform 更新在单一 rAF 循环里做
- 一个全局 rAF 循环驱动所有 cursor/磁吸/gaze 更新，**不要每个元素一个 rAF**
- 单帧内所有 lerp 计算 < 1ms

### will-change 纪律
- `will-change: transform`（或 opacity）**只在动画进行时**加，结束**立即移除**
- **不**长期挂在大量元素上（会吃显存、反而拖慢）
- 磁吸/gaze 元素：进入感应区时加，离开复位后移除

### transform-only
- 只动 `transform` / `opacity` / `clip-path`（`filter` 慎用，distortion 除外且计预算）
- **禁止**动画 `width/height/top/left/margin/padding/border/font-size`

### 可见性暂停
- WebGL / marquee / 持续动画用 IntersectionObserver，元素**不可见时暂停 rAF**
- 标签页 `visibilitychange` 隐藏时暂停所有装饰循环

### 资源
- heavy lib（Three.js/GSAP/Matter.js）`import()` code-split 懒加载
- WebGL hero 资源（shader+texture+几何）≤ 1.5MB
- trail 图懒加载 + 尺寸受控（不超渲染尺寸）

---

## 失败模式

| 症状 | 急救 |
|------|------|
| 光标点击落点不准 | dot 的 lerp 必须是 1.0（贴真实坐标），只让 ring 滞后 |
| 触屏上效果坏掉 / 拿不到内容 | 补 `(pointer: coarse)` 静态/tap 轨道，别让 touch 用残废桌面版 |
| 键盘走不完流程 | hover-only 内容补 `:focus-visible` 等价；磁吸 focus 不偏移 |
| reduced-motion 下内容消失 | 改为显终态/静止，绝不「安静地什么都不显示」 |
| WebGL 没出来就白屏 | 加 context 检测 + 静态 fallback，关键内容移出 WebGL |
| 滚动/光标卡顿掉帧 | 查是否在事件回调里读布局；改 rAF 节流 + transform-only + will-change 纪律 |
| 一屏堆了 3 个 WebGL / 5 条 trail | 数预算，砍到重效果 ≤ 2 |
| 输入框里光标是装饰球不是 caret | 进 input/textarea 区恢复 `cursor: text`（铁律 8）|
| 用户反馈「炫但晕」 | tilt ≤ 8deg / sticky ≤ 12px / 视差 ratio 调小；distortion 降幅 |
