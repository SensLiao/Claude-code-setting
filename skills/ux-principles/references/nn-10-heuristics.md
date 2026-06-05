# Nielsen Norman Group · 10 Usability Heuristics

> 来源：[nngroup.com/articles/ten-usability-heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) — Jakob Nielsen 1994 提出，2020 修订。
> 用法：MODE C audit 必跑 10 题。每题 PASS / WARN / FAIL + 例证。
> 这 10 条是行业 30 年标准，不是 LLM 编造的——任何 UX review 写 NN heuristic 字样都自动可信。

---

## H1. Visibility of System Status — 状态可见

**问题**：用户是否始终知道"现在系统在做什么 / 我处于流程哪一步 / 上次操作的结果"？

**Audit 题**：
- [ ] 每个异步操作有 loading 状态？
- [ ] 长流程有 step indicator / breadcrumb？
- [ ] 操作完成有明确反馈（toast / status change / new screen）？
- [ ] 连接状态可见（online / offline / syncing）？

**违例 example**：点 "Save" 后页面没动静，5 秒后才跳，期间用户不知是否点中。
**Fix example**：点击立即 disable + spinner，2 秒后 toast "Saved" + UI 同步刷新。

---

## H2. Match Between System and Real World — 系统语言贴合现实

**问题**：词汇 / icon / 流程顺序是否符合用户领域的真实概念，而不是开发者术语？

**Audit 题**：
- [ ] 没有 dev jargon（"node_id" / "FK violation" / "404"）？
- [ ] icon 含义清晰（不要 emoji 含义猜谜）？
- [ ] 流程顺序符合用户做事顺序？
- [ ] 错误提示用人话（"Your network is unreachable" 而非 "ECONNREFUSED"）？

**违例 example**：表单错误显示 "validation failed for field caseSetupForm.casePropertiesGroup.titleInputControl"。
**Fix example**："Case title is required. Add a name to continue."

---

## H3. User Control and Freedom — 用户控制权

**问题**：用户能否撤销 / 重做 / 退出当前操作而不被锁住？

**Audit 题**：
- [ ] Undo 可用（Ctrl+Z / 撤销按钮）？
- [ ] modal 可关闭（Escape / 点击外部）？
- [ ] 长流程可中断 + 状态保留（draft）？
- [ ] 误操作有 confirmation（删除 / 不可逆操作）？

**违例 example**：点 "Delete case" 立即生效无确认，30 个 node 没了。
**Fix example**：modal "Delete 30 nodes? This is irreversible. Type case name to confirm." + 7-day soft delete with recovery.

---

## H4. Consistency and Standards — 一致 + 行业惯例

**问题**：同一概念是否在 product 内 / 行业内都用相同表达？

**Audit 题**：
- [ ] 同一 action 在不同位置叫法一致（不要 "Delete" / "Remove" / "Trash" 混用）？
- [ ] 同一 status 用同一 chip 风格？
- [ ] icon meaning 行业一致（齿轮 = 设置 / 放大镜 = 搜索）？
- [ ] 快捷键贴合 OS 习惯（Ctrl+C / Ctrl+S）？

**违例 example**：Case Setup 用 "Save"，Case Settings 用 "Apply"，Case Governance 用 "Update"。
**Fix example**：统一 "Save changes"。

---

## H5. Error Prevention — 错误预防比提示更重要

**问题**：能否在用户犯错前阻止 / 提醒，而不是事后报错？

**Audit 题**：
- [ ] 危险操作有 confirmation + 解释后果？
- [ ] 表单实时校验（不到 submit 时才一片红）？
- [ ] 格式约束在 input 层强制（type / max / pattern）？
- [ ] 命名冲突在输入时就提示？

**违例 example**：填完 50 字段表单提交后才告诉你 "email 格式错"。
**Fix example**：blur 时就标红 + 错误信息内嵌。

---

## H6. Recognition Rather Than Recall — 识别优于回忆

**问题**：用户是否需要记住前面页的信息才能完成当前操作？

**Audit 题**：
- [ ] 选项可见而不是要凭记忆输入？
- [ ] 多步流程在当前步骤显示前面填的内容？
- [ ] 命令支持搜索而不是要记完整名字？
- [ ] 最近用过的项放在前面？

**违例 example**：4 步 wizard，到 step 4 忘了 step 1 填了啥，要返回查。
**Fix example**：每步顶部展示前面 step 的摘要 chip。

---

## H7. Flexibility and Efficiency of Use — 新手老手都顺手

**问题**：新手能用最简路径完成，老手能用加速器（快捷键 / 批量 / 模板）？

**Audit 题**：
- [ ] 有 keyboard shortcut（关键操作至少 1 个）？
- [ ] 有批量操作（多选 + 批处理）？
- [ ] 有模板 / saved view / 收藏？
- [ ] 有 Command Palette（⌘K）？

**违例 example**：批量分配 20 个 node 必须 20 次点击 + 20 次拖拽。
**Fix example**：marquee 选 20 个 + 一次右键 "Assign to..." + bulk dialog。

---

## H8. Aesthetic and Minimalist Design — 美观且去冗

**问题**：界面是否只显当前任务需要的信息，无装饰性噪音？

**Audit 题**：
- [ ] 每个 section 都有必要存在的功能（不是装饰）？
- [ ] 没有伪装数据感的占位（"Lorem ipsum dolor sit amet ..."）？
- [ ] 图标 / 边框 / 阴影都有功能，不是"看起来更复杂"？
- [ ] 信息密度恰当（不空也不挤）？

**违例 example**：dashboard 8 个无意义 metric card + 渐变背景 + glow shadow。
**Fix example**：3 个 actionable metric + hairline + 留白。

---

## H9. Help Users Recognize, Diagnose, and Recover from Errors — 错误恢复

**问题**：错误信息是否说清问题 + 原因 + 解决路径？

**Audit 题**：
- [ ] 错误信息 ≠ "Something went wrong"？
- [ ] 错误说明原因（"Token expired" 而非 "401"）？
- [ ] 错误提供恢复路径（"Reconnect" 按钮 / 文档链接）？
- [ ] 错误位置可定位（哪个字段 / 哪个 node）？

**违例 example**："Error 500"。
**Fix example**："Couldn't save changes — your GitHub token expired. [Reconnect GitHub]"

---

## H10. Help and Documentation — 帮助文档

**问题**：用户卡住能否快速找到帮助 + 帮助是否任务导向？

**Audit 题**：
- [ ] 关键功能有 inline tooltip / 第一次见时引导？
- [ ] 文档以任务为单位（"how to invite a collaborator"）而非以功能罗列？
- [ ] 文档触达 ≤ 2 click？
- [ ] 文档支持搜索？

**违例 example**：用户要分享 case 找不到入口，文档藏在 footer 链 9 级深。
**Fix example**：Share button 在每个 case header + tooltip "Invite people to this case"。

---

## Audit 输出模板

每次 MODE C audit 跑完 10 题，按 [[../templates/heuristic-audit.md]] 写成 ux-audit.md：

```markdown
# UX Audit · {surface name} · {date}

## 10 Heuristics

| # | Heuristic | Verdict | Evidence | Fix |
|---|---|---|---|---|
| H1 | Visibility of system status | WARN | save 后没 toast 仅 button text 变 "Saved" | 加 toast，2 秒淡出 |
| H2 | Real-world match | PASS | dev jargon 已替换 | — |
| H3 | User control | FAIL | delete 无 confirmation | 加 modal + type-to-confirm |
| ... |

## Severity Summary

- **FAIL (must fix before ship)**: 1 (H3)
- **WARN (should fix soon)**: 2 (H1, H7)
- **PASS**: 7

## Top 3 fix priorities

1. H3 Delete confirmation modal — 30 min work
2. H7 Add keyboard shortcut for status change — 1h work
3. H1 Save toast — 15 min work
```

---

## 与项目 anti-pattern 关联（agent-console 专用扩展）

- 违 H1：agent run 跑无 progress bar → 已修
- 违 H2："blocked_action_kind" 直接显示给 user → 改成 "Merge to main is currently restricted"
- 违 H3：archive case 立即生效 → 现在要 type case name to confirm
- 违 H4：Inspector tab 命名乱（Trace / Outputs / Agent Output）→ 改 Outputs 统一
- 违 H5：GitHub install URL 没 input 校验 → 现在 server side regex 强制
- 违 H6：4-step wizard 第 4 步看不到前面填的 → 现在 step 顶端显 chip
- 违 H7：批 assign 没快捷键 → marquee + ⌘+A 已加
- 违 H8：bento grid 太密 → wave 2 重排已修
- 违 H9："403 Forbidden" → 现在 explain dialog 6-block + Request Approval 按钮
- 违 H10：第一次进 case workspace 没引导 → x-onboarding overlay 已 mock
