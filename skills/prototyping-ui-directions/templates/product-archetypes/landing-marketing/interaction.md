# Interaction — Landing-Marketing

> 营销页的交互态规范：CTA 状态 / nav scroll 行为 / lead-capture form 状态机 / sticky / scroll-spy。
>
> 营销页交互密度远低于 canvas(没有复杂操作模型)，但**每一个态都直接影响转化**——一个没有 hover/focus 态的 CTA、一个吞掉错误的表单，都在漏转化。
>
> 这里定义**交互结构与状态契约**；每个态的**具体视觉**(颜色/阴影/位移幅度)由锁定的 L3 风格套，本文件只规定"必须有哪些态、各态意味什么、不可阻塞什么"。

## 责任边界

- **只**定义营销页特有交互：CTA / nav / lead form / sticky / scroll-spy。
- 不定义 scroll-reveal 动效参数(→ `motion-tokens.md`)。
- 不定义 section 布局(→ `layout-engines.md`)。
- 不写实现代码(→ Stage 3 frontend-design)。
- 不做表单**后端 / 安全**(→ AppSec / 用户工程流程)；本文件只管前端状态机。

---

## 1. CTA 状态（primary / secondary）

每个 CTA **必须**定义完整 7 态。缺 hover/focus/active 任一 → 红队驳回。

| 态 | primary CTA | secondary CTA | 必须 |
|----|-------------|---------------|------|
| **default** | 实心强调色(角色由 L3 定) + 清晰可点尺寸 | ghost / outline / link | ✅ |
| **hover** | 明确反馈(L3 定：变深/抬起/微缩放 ≤2%) | underline / 微高亮 | ✅ |
| **focus-visible** | **可见焦点环**(键盘可达，对比 ≥ 3:1) | 同 | ✅ 必须，a11y |
| **active** | 按下反馈(轻微下沉/变深) | 同 | ✅ |
| **loading** | spinner / 文案变 "Starting…" + **禁用重复点击** | — | 表单型 CTA 必须 |
| **disabled** | 降透明 + `cursor:not-allowed` + `aria-disabled` | — | 视情况 |
| **success** | ✓ 短反馈("Sent!" 1.5s) | — | 表单提交后 |

**铁律**：
- 点击目标 **≥ 44×44px**(移动可点)，文字 CTA 也要足够 hit area。
- hover 态**只在 hover-capable 设备**(`@media (hover: hover)`)，触屏不靠 hover 传递信息。
- loading 态**必须禁止双击重复提交**(防重复线索/重复扣费)。
- transform-only 反馈(transform/opacity)，不动 layout 属性(见 `motion-tokens.md`)。

## 2. Nav scroll 行为（sticky + scroll-aware CTA）

营销页 nav 是"持续转化入口"，但不能挡内容(`patterns-index.md` #14)。

| 滚动阶段 | nav 表现 |
|---------|---------|
| **hero 内(top)** | nav 轻量/透明背景、无投影、**不显** nav-CTA(hero 内已有 CTA) |
| **滚过 hero** | nav 变**紧凑**(高度收到 ≤56-64px) + 半透明背景(`backdrop-blur`) + 轻投影分隔 |
| **接力 CTA** | hero CTA 滚出视口后，nav 内**渐显**一个紧凑 primary CTA(文案同 hero) |
| **向上滚** | (可选)hide-on-scroll-down / show-on-scroll-up，给内容更多空间 |

**铁律**：
- nav 状态切换用 `--motion-quick` + `--ease-in-out-quart`(见 `motion-tokens.md`)，不闪。
- 用 `IntersectionObserver` 侦测 hero 边界触发状态切换，**不**用高频 scroll handler。
- mobile：nav 收为 hamburger，展开 menu 时**锁 body 滚动** + ESC/点遮罩可关 + focus trap。
- nav 高度**绝不**全程占满厚条挡内容(反模式见 #14)。

## 3. Scroll-spy（长页可选）

- 长页(6+ section)nav 高亮当前 section，给用户方位感。
- 用 `IntersectionObserver`(rootMargin 调到视口中部触发)判定当前 section，**不**逐帧算 offset。
- 高亮态由 L3 定视觉；切换 ≤ `--motion-micro`。
- 点 nav 锚点平滑滚动到 section，但 `prefers-reduced-motion` 下**即时跳转**(`scroll-behavior:auto`)。
- scroll-spy 是**增强**：无 JS 时锚点链接仍能跳转(原生 `#anchor`)。

## 4. Lead-capture Form 状态机（waitlist / signup / contact / newsletter）

营销页表单是**转化终点**——状态不全 = 漏线索。完整状态机：

```
            ┌─────────┐
            │  empty  │  初始：placeholder + label 可见，无报错
            └────┬────┘
                 │ focus
            ┌────▼────┐
   ┌────────│  focus  │  焦点环 + 实时格式提示(非报错)
   │        └────┬────┘
   │ blur(空,可选)  │ input
   │        ┌────▼─────┐
   │        │ filling  │  输入中，不打断、不过早报错
   │        └────┬─────┘
   │             │ submit
   │        ┌────▼─────┐
   │        │ loading  │  按钮 spinner + 禁用 + 防重复提交
   │        └──┬────┬──┘
   │     fail  │    │ ok
   │     ┌─────▼┐ ┌─▼────────┐
   └─────│error │ │ success  │  ✓ 确认 + 明确下一步("Check inbox")
         └──┬───┘ └──────────┘
            │ 用户改输入 → 回 filling，**清除该字段错误**
```

| 态 | 行为 | 必须 |
|----|------|------|
| **empty** | label **可见**(不靠 placeholder 当 label)；placeholder 是示例非标签 | ✅ a11y |
| **focus** | 可见焦点环；实时**格式提示**(不是报错)，如 email 格式灰字 | ✅ |
| **filling** | **不过早报错**——blur 或 submit 才校验，输入中只给正向提示 | ✅ UX |
| **loading** | 按钮 loading 态 + **禁用防双提** + 输入锁定 | ✅ 防重复线索 |
| **error** | 错误**贴在对应字段下方**、具体可行动("Enter a valid email" 非 "Invalid")、`aria-invalid`+`aria-describedby` | ✅ a11y+UX |
| **success** | inline 成功态(✓ + 下一步指引)，**不**只弹个 toast 就没了 | ✅ 转化确认 |
| **empty-state(列表型)** | 若表单后展示结果且为空 → 友好空态 + 引导，不留白屏 | 视情况 |

**铁律**：
- **绝不静默吞错**——网络失败/校验失败必须可见可行动(对应 `~/.claude/rules/common/coding-style.md` 错误处理)。
- 错误信息**具体**："Enter a valid work email" > "Invalid input"。
- 字段 label 必须真实 `<label for>`，**不**用 placeholder 冒充 label(focus 后消失=失忆)。
- 单字段 waitlist(只要 email)优先——字段越少转化越高；多字段表单分组 + 进度感。
- success 后**明确下一步**("We'll email you" / "Check your inbox")，不让用户悬着。
- 防滥用用 honeypot / 轻量校验，**不**默认上重型 CAPTCHA 挡转化(见 `~/.claude/rules/web/security.md` 表单段)。

## 5. Pricing 交互

- **月/年 toggle**：切换即时更新所有价格 + 标注年付折扣("Save 20%")；状态由 URL param 或 local 保持。
- **推荐档高亮**：默认视觉强调一档("Most popular")，hover 其他档可平等高亮(不抢推荐档的转化引导)。
- 每档**单个** CTA(不并列多按钮)；最高档可 "Contact sales"(但不能全部都是,见铁律)。

## 6. FAQ Accordion 交互

- 默认**全折叠**(首屏只露问题，降低视觉负担)。
- 点击展开：`--motion-quick` 高度过渡 + chevron 旋转；可单开或多开(单开更聚焦)。
- 键盘可达(`button` + `aria-expanded` + Enter/Space)；`aria-controls` 关联答案区。
- reduced-motion 下即时展开(无高度动画)。
- 无 JS 兜底：可用 `<details>/<summary>` 原生(无 JS 也能开)。

## 不允许

- CTA 缺 hover / focus-visible / active 任一态(键盘用户 + 反馈缺失)。
- 表单**静默吞错** / 错误不贴字段 / 用 placeholder 当 label。
- loading 态不防重复提交(重复线索/重复操作)。
- nav 厚条全程占满挡内容 / 用高频 scroll handler 驱动状态。
- 交互动效违反 `motion-tokens.md`(动 layout 属性 / 超 ceiling / 无 reduced-motion 兜底)。
- 把后端/安全逻辑写进本层(本文件只管前端状态机)。

## Refs

- `patterns-index.md` #10 pricing / #12 FAQ / #13 final CTA / #14 sticky nav
- `motion-tokens.md`(各态 micro-motion 的 duration/easing)
- `~/.claude/rules/common/coding-style.md`(错误处理 / 输入校验)
- `~/.claude/rules/web/security.md`(表单 CSRF / 防滥用 / 校验——后端层)
