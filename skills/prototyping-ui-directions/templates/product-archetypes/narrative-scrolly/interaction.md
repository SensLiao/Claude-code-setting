# Narrative-Scrolly — Interaction Spec

> scrollytelling 的交互核心：scroll 是唯一主输入，但它驱动的状态机必须**可预测、可逆、可达、可降级**。
> 本文件定义 scroll-progress / step-enter-exit / pin-unpin / skip-controls 的完整 spec + 全状态覆盖 + a11y。
> 八铁律见 `narrative-scrolly-rules.md`；pattern 见 `patterns-index.md`；motion token 见 `motion-tokens.md`；布局见 `layout-engines.md`。

## 责任边界

本 spec **只**定义"滚动如何驱动叙事状态"。

不做的事：
- 不定义视觉皮肤（→ 已锁定的 L3 风格 taste/luxury/brutalist）
- 不定义具体 pattern 的视觉构成（→ `patterns-index.md`）
- 不定义 duration/easing/threshold/depth 数值（→ `motion-tokens.md`）
- 不写实现代码（→ Stage 3 prototype-engineer + frontend-design）

## 核心交互模型：scroll = 时间轴，不是导航

scrollytelling 的心智是"读者用滚动**播放**一个故事"。所以：

- **单一输入主导**：滚动既是前进也是后退（可逆）；不引入"必须点这里才继续"的隐藏门（章节跳转除外，那是增强）。
- **单一真相**：叙事状态由 `scrollProgress`（0→1）+ `activeStepIndex` 两个派生值决定，不靠累加事件，保证回滚可恢复（铁律 6 幂等）。
- **逃生口常在**：skip-link + chapter anchor 让"不想看完整动效/想跳章"的人随时离场（铁律 4）。

---

## 交互 1 · Scroll Progress（全局进度）

- **trigger**：页面任意滚动
- **visual**：顶部 `scaleX` 进度条（0→1）或侧边 chapter dots 高亮当前章
- **motion**：进度条 `transform: scaleX(progress)`，linear 跟手（无缓动）；dots 切换用 `--scrolly-reveal-fast`
- **data**：`progress = scrollTop / (scrollHeight - innerHeight)`；当前章 = 命中视口中线的 `section[id]`
- **reduced**：进度条照常（它本身就是 transform，不属眩晕源）；smooth-scroll 关闭
- **non-blocking**：进度条 `position: fixed; pointer-events: none`，不挡内容；dots 可点（跳章）
- **a11y**：进度条加 `role="progressbar" aria-valuenow`；dots 是真 `<a href="#chapter-N">`，键盘可达，`aria-current` 标当前章

## 交互 2 · Step Enter / Exit（步进）

- **trigger**：某个 `.step` 进入/离开视口（IntersectionObserver，threshold `--io-threshold-step`=0.5）
- **visual**：sticky-graphic 切到该 step 对应状态（换数据子集 / 换 highlight / 换镜头 / 换图层）
- **motion**：graphic 状态过渡用 `--scrolly-step-swap`（≤400ms）+ `--ease-out-cubic`；只动 transform/opacity（铁律 7）
- **data**：`activeStepIndex` 单一真相；每个 step 声明自己的 graphic state（数据/轴/highlight/帧）；切换是**设置目标态**不是排队播放
- **reduced**：graphic 直接显示**所有 step 合并后的完整静态态**（如 data chart 显示全量+全注释），不分步（铁律 1）
- **non-blocking**：快速滚动跳过中间 step → 直接跳达终态，不补播中间动画；回滚进入已激活 step **不重播**（铁律 6 幂等）
- **a11y**：step 文字是正常 DOM 文档流，Tab/屏读按顺序读到；graphic 变化用 `aria-live="polite"` 播报关键状态变更（如"显示 2023 年数据"），避免屏读用户只看到一张哑图

## 交互 3 · Pin / Unpin（图钉与释放）

- **trigger**：pin 段顶部抵达视口顶（ScrollTrigger `start: "top top"`），到 `end`（≤3×100vh，铁律 3）释放
- **visual**：该段固定在视口，内部用 scrub 或 sub-step 演进；到 end 后正常向上滚出
- **motion**：pin 内部 scrub 用 `--scrub-tight`/`--scrub-smooth`，linear；pin/unpin 切换无突跳（ScrollTrigger 自动占位防 CLS）
- **data**：pin 占位元素必须**预留等高空间**（铁律 5 防 CLS）；pin 状态由 progress 派生，可逆
- **reduced**：**不 pin**——该段退化为正常文档流，内部 sub-step 全部线性展开（铁律 1）
- **non-blocking**：pin 期间滚动手感保持 native（不夺滚，铁律 2）；可随时用 chapter nav 跳出
- **a11y**：pin 段提供"跳过这一幕"链接（尤其长 pin / image-sequence）；pin 内可交互元素 focus 时确保在视口内（`scroll-margin`）

## 交互 4 · Reveal On Enter（进入即揭示）

- **trigger**：元素进入视口（IO，threshold `--io-threshold-reveal`=0.2，`--io-rootmargin` 底部收 10%）
- **visual**：元素以受控方式揭示（opacity 0→1 + 轻 translateY/clip-path 擦除）
- **motion**：`--scrolly-reveal-base`（320ms）+ `--ease-out-expo`；一次只揭一个叙事单元（铁律 8）
- **data**：加 `is-visible` class，CSS transition 接管；**幂等**——回滚不移除/不重播（除非显式 replay 设计）
- **reduced**：去掉位移/clip，仅保留 ≤120ms opacity 渐变，或直接默认可见（铁律 1）
- **non-blocking**：reveal 是装饰增强，元素内容/链接在揭示前已在 DOM 可被聚焦
- **a11y**：**绝不**用 `opacity:0` 同时阻断屏读/焦点——揭示前元素对 AT 仍可读；纯键盘用户 Tab 到时若未"揭示"，焦点样式照常可见

## 交互 5 · Skip Controls（跳过 / 跳章）

- **trigger**：页首 skip-link（Tab 首个焦点）/ chapter anchor 点击 / `#hash` 直达
- **visual**：skip-link 默认 visually-hidden，`:focus` 时显形（"跳到正文" / "跳过开场动画"）；chapter nav 列出各章
- **motion**：锚点跳转默认 smooth（`scroll-behavior: smooth`），但 **reduced-motion 下 `auto`**（瞬移，不滚动眩晕）
- **data**：每个 `section` 有稳定 `id` + `scroll-margin-top`（防固定头遮挡）；hash 进入页面直达对应章
- **reduced**：跳转瞬时完成，无平滑滚动
- **non-blocking**：跳过/跳章是逃生口，**任何时候可用**，包括 pin/scrub 进行中
- **a11y**：skip-link 是 WCAG 必备（绕过重复/动画内容）；chapter nav `<nav aria-label="章节">`；跳转后焦点移到目标章标题（`tabindex="-1"` + `.focus()`），屏读用户才知道"跳到哪了"

---

## 全状态覆盖矩阵

每个 scrollytelling surface 必须覆盖以下状态，缺一不可：

| 状态 | 要求 |
|------|------|
| **初始 / 首屏** | 静态可读；hero 关键资源已 LCP；无需滚动即知"这是什么故事" |
| **滚动进行中** | progress 实时；当前 step/章正确高亮；手感 native |
| **快速滚动 / 跳跃** | step 跳达终态不补播；不闪烁（铁律 6） |
| **回滚 / 反向** | 状态可逆恢复；reveal 不重播；scrub 反向跟手 |
| **pin 中 / pin 释放** | 占位防 CLS；释放无突跳；可跳出 |
| **到达章节边界** | 不在边界反复 enter/leave 抖动（rootMargin 已收） |
| **故事结尾 / Coda** | 有情绪落点 + 单一主 CTA；不直接撞 footer |
| **resize / 旋转** | 重算 trigger（refresh）；sticky 高度跟 svh；横向 act 重算距离 |
| **加载中 / 资源未到** | 占位尺寸已留；序列帧/图懒载有 fallback；不抖布局 |
| **JS 失败 / 禁用** | 完整故事线性可读（铁律 1） |
| **reduced-motion** | 叙事顺序不变、信息不丢；scroll-driven 全停（铁律 1） |
| **窄屏 / 移动端** | sticky→内嵌、horizontal→纵堆、parallax→关（pattern×设备矩阵） |
| **键盘 only** | Tab 顺序=叙事顺序；skip-link；可读完 |
| **屏读器** | step 文字顺序读到；graphic 关键变更 aria-live 播报；图有 alt/desc |

## Accessibility 硬约束（scrollytelling 专属）

scrollytelling 是 WCAG 重灾区，以下为不可妥协项：

1. **焦点顺序 = 视觉顺序 = 叙事顺序**：绝不用 CSS order/absolute/transform 把视觉与 DOM 顺序拧开（WCAG 1.3.2 / 2.4.3）。
2. **prefers-reduced-motion 必兜底**：scroll-driven 动效全停（WCAG 2.3.3 动画 from interactions）；smooth-scroll 关闭。
3. **skip-link + chapter nav**：绕过动画/重复内容的旁路（WCAG 2.4.1 Bypass Blocks）。
4. **内容不锁在动效后**：信息可读性独立于滚动/动画状态（铁律 1）。
5. **图形可访问**：data chart / image-sequence 提供文本等价（alt / `<desc>` / 数据表 fallback）；关键状态变更 `aria-live="polite"` 播报。
6. **可暂停/可控**：image-sequence/scrub 由用户滚动控制（天然可暂停=停止滚动）；绝不自动播放夺控（WCAG 2.2.2）。
7. **对比与可读**：full-bleed 图上的文字保证对比度（叠遮罩/底色），不因背景图变化而读不清（WCAG 1.4.3）。
8. **锚点跳转移焦点**：跳章后把焦点移到目标章标题，屏读/键盘用户感知到位置变化。

## 出口 artifact

本 spec 完成时（Stage 3）必须产出：

- 至少 1 份真实可滚的 scrollytelling prototype（HTML / React），含 **sticky-visual + ≥3 step** + progress 指示 + skip-link + chapter nav。
- **reduced-motion 双轨快照**：全动效版 + reduced-motion 版各一张全文长图，证明内容一致。
- **no-JS 快照**：禁 JS 后全文长图，证明故事完整可读（铁律 1）。
- 红队过八铁律 gate（`narrative-scrolly-rules.md`）+ 全状态覆盖矩阵自查。

## 失败模式

| 症状 | 急救 |
|------|------|
| 某 surface 自己发明"必须点击才继续"的隐藏门 | 驳回；scroll 是唯一主推进，跳转只能是增强逃生口 |
| reveal 回滚就重播/闪 | 改幂等：单一 active-step 真相，class 只加不反复切 |
| 屏读用户面对一张哑 graphic | 补 aria-live 播报 step 变更 + 图文本等价 |
| 跳章后用户"不知道跳哪了" | 跳转后移焦点到目标章标题（tabindex=-1 + focus） |
| reduced-motion 下信息丢失 | 静态态必须是合并完整态（data 全量+全注释），不许"安静地少显示" |
| pin 期间手感被夺/卡死 | 违铁律 2/3：保 native 手感、缩 pin 距离、留跳过口 |
