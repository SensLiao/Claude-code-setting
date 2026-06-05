# Built for Mars · Audit Lens（Peter Ramsey 拆解法）

> 来源：[builtformars.com](https://builtformars.com) — Peter Ramsey 公开拆解 Stripe / Notion / Linear / Tinder / Headspace / Duolingo / Amazon 等真实产品的 UX。
> 用法：MODE C 用这 5 个 lens 站在拆解者角度审自己的 mock，问"如果 Peter 来拆我这个 surface 会吐槽哪 5 条？"
> 哲学：好 UX 不是设计师自己说好——是经得起外人逐帧拆解。

---

## 5 个拆解 lens

### Lens 1 — First Impression（3 秒测试）

**问题**：用户打开这屏 3 秒内能答出：
- 这是什么产品 / 什么 surface？
- 给我看的关键东西是哪一个？
- 我接下来该做什么？

**Audit 题**：
- [ ] 看一眼能识别 surface 类型（dashboard / list / form / canvas）？
- [ ] 主要 action 在 3 秒内能定位？
- [ ] 没有"这屏到底想让我干啥"的困惑？

**典型 fail**：8 个等高度 card 平铺，看不出哪个是 primary；或顶部一个含糊 hero 不知道这屏是 list 还是 detail。

**典型 pass**：Stripe Dashboard 首屏 = 大数字（current balance）+ recent transactions list + 1 个 "Send money" CTA，3 秒清晰。

---

### Lens 2 — Onboarding Clarity（新用户路径）

**问题**：第一次进入这屏，用户能在不读文档的前提下走通主路径吗？

**Audit 题**：
- [ ] 空状态有教学，不是"No data"？
- [ ] 关键 input 有 placeholder 示例 + 说明？
- [ ] 第一次见的 icon / 按钮有 tooltip？
- [ ] 有"下一步建议"或 default 操作？

**典型 fail**：进入 Case Workspace 看到 "No nodes yet" + 一个 "+" 按钮，不告诉用户怎么开始。

**典型 pass**：Notion 新页 = 顶部 "/" hint + slash-command popover + 模板建议。

---

### Lens 3 — Friction Points（卡点）

**问题**：走主流程时哪些步骤让用户停顿 / 退回 / 困惑？

**Audit 题**：
- [ ] 任何 click 之后界面不变 / 不知是否生效？
- [ ] 任何 input 不知格式要求？
- [ ] 任何 confirmation 用户看不懂后果？
- [ ] 任何 multi-step 流程让用户必须返回上一步？

**典型 fail**：填完 4 步表单第 5 步发现 step 1 写错，无法直接编辑只能从头开始。

**典型 pass**：Linear new issue = 单 modal 内全部字段，随时可见 / 修；keyboard-first；Escape 保留 draft。

---

### Lens 4 — Critical Path Completion（任务完成率）

**问题**：最重要的用户任务（不是所有任务）能否被一个普通用户独立完成？

**Audit 题**：
- [ ] 关键任务路径 ≤ 5 click？
- [ ] 没有"必须先做 X 才能 Y"但 X 不明显？
- [ ] 失败有 recovery 不要重头？
- [ ] success state 给用户继续干活的入口（不是 dead end）？

**典型 fail**：要创建一个 case 必须先 OAuth GitHub → 再创建 connector → 再绑定 → 再回来。
**典型 pass**：Stripe send money = 3 click（pick recipient / enter amount / confirm）。

---

### Lens 5 — Polish（细节）

**问题**：100 处细节里有多少处显得"用心"？

**Audit 题**：
- [ ] 动效有 timing curve / duration 一致？
- [ ] 间距 token 化没散落？
- [ ] 焦点 ring 一致？
- [ ] hover / active / focus / disabled 状态完整？
- [ ] empty / loading / error 状态画了？
- [ ] mobile 也 work 不是 desktop only？
- [ ] 关键 string 有 i18n 占位？

**典型 fail**：所有 button hover 都用浏览器 default outline。
**典型 pass**：Stripe 每个按钮 hover 都有微妙的 lift + tinted shadow + 200ms ease。

---

## 拆解输出格式（"如果 Peter 来拆"）

每次 MODE C audit 写一段 "BFM-style teardown"：

```markdown
## BFM Teardown · {surface name}

### Lens 1 — First Impression
**3-sec verdict**: dashboard for "my work today" — primary action ambiguous (chip strip too prominent, list de-emphasized).
**Fix**: shrink chip strip to 32px / promote list rows to 60px hero rows.

### Lens 2 — Onboarding
**Verdict**: empty state shows "No tasks today" — doesn't teach how tasks land here.
**Fix**: empty state with 3 reasons "you'll see tasks when: (1) someone assigns / (2) you create / (3) agent suggests" + "Create your first task" CTA.

### Lens 3 — Friction
**Verdict**: clicking task row jumps to /cases/:id with no breadcrumb back to /me/work.
**Fix**: breadcrumb chip "← Back to My Work" sticky top-left after navigation.

### Lens 4 — Critical Path
**Verdict**: main task "mark done" requires open task → status dropdown → click done → confirm = 4 click.
**Fix**: inline checkbox in row + optimistic strike-through; click row title for detail (不影响 mark done).

### Lens 5 — Polish
**Verdict**: hover state present but no focus ring; loading state missing on async checkmark.
**Fix**: add focus ring 2px outset rgba(0,0,0,0.15); add 200ms optimistic strike-through + revert on failure.

### Score
Lens 1: 6/10 · Lens 2: 4/10 · Lens 3: 7/10 · Lens 4: 6/10 · Lens 5: 7/10 · **Total 30/50**
Below ship threshold (40/50). Fix Lens 2 + Lens 1 first.
```

---

## 阈值（决定能否 ship）

- **40+/50**: ship ready
- **30-39**: 需要 1 轮 fix
- **20-29**: 需要 1 轮 fix + 一次 redesign 局部
- **< 20**: redesign

---

## 配合 NN heuristic + Laws of UX

3 个 reference 是**互补不重复**：

| Reference | 视角 | 适用 |
|---|---|---|
| NN 10 Heuristics | 是否违反工程师 + 学术共识的 10 条标准 | 客观对错 |
| Laws of UX | 哪些心理学规律适用 + 命中数 | 理由可证 |
| Built for Mars | 拆解者怎么看你 | 主观感觉 |

跑 audit 时 3 个都跑，然后看：
- NN FAIL = 客观错（必修）
- Laws miss = 没命中适用 law（应补）
- BFM low score = 用户感觉差（要 redesign）

---

## 真实拆解视频参考（值得反复看）

Peter Ramsey 的几个经典拆解（看完就知道"拆解视角"是什么）：

- **Stripe Onboarding** — 为什么他们的 onboarding 是 best-in-class
- **Notion vs Coda** — 同类产品的 UX 差距
- **Linear vs Jira** — 速度感如何被设计出来
- **Tinder Swipe** — 微交互的力量
- **Amazon Buy-Now** — 1-click 的设计代价
- **Headspace Sign-up** — emotional onboarding

(URL：`https://builtformars.com/case-studies/<product-slug>` — agent 可 WebFetch 拿原文)
