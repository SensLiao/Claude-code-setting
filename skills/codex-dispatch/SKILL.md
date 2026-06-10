---
name: codex-dispatch
description: Cross-AI dispatch playbook — the harness decision + discipline layer for using Codex (OpenAI codex CLI, GPT 系列模型) as a second model family for delegated execution and cross-model review. This skill does NOT shell out to `codex exec` itself; all execution is routed to the official `codex@openai-codex` plugin commands (`/codex:rescue` delegate · `/codex:review` review · `/codex:adversarial-review` challenge · `/codex:status` `/codex:result` `/codex:cancel` lifecycle · `/codex:setup` readiness). It carries the harness-specific discipline the generic plugin lacks — when-to-delegate decision tree, work-order template, scope/chunking caps, mandatory wave cross-review, Windows caveats, quota fallback, model-version lock, and the governed-gate boundary. Trigger phrases include "用 codex / 让 codex / 派给 codex / delegate to codex / codex 调度 / codex 跑一下 / cross-review with codex / 跨模型 review / 该不该用 codex / codex 怎么调用 / codex 委派 / 第二个模型审".
---

# codex-dispatch — Codex 跨模型调度 playbook

> **v2（2026-06-10 重写）。这不是被删掉的那个老 skill。**
> 老 `codex-dispatch` 自己 shell 出 `codex exec` —— 那层已被官方 `codex@openai-codex` plugin 取代，所以删对了。
> 本 skill 是**决策 + 纪律 + 路由层**：执行全部转交官方 plugin 命令，自己**不**调 `codex exec`。
> 它把「老 skill 的调用智慧 + 散在各项目 memory 的硬经验 + 官方 plugin 的 7 个命令」合并成一个全局的家。

---

## 0. 这个 skill 是什么 / 不是什么

| | |
|---|---|
| ✅ **是** | "什么时候该用 Codex、用哪个命令、带什么纪律" 的决策 playbook |
| ✅ **是** | 把 NL 意图（"让 codex 修这个" / "cross-review 一下"）路由到正确的 `/codex:*` 命令 |
| ✅ **是** | harness 专属纪律的单一真相源（切尺度 / wave cross-review / Windows / fallback / 版本号 / governed-gate 边界） |
| ❌ **不是** | codex CLI 的二次封装 —— **绝不**自己写 `codex exec ...` 命令（那是官方 plugin 的 `codex-companion.mjs` 的活） |
| ❌ **不是** | release verdict 的来源 —— governed gate 里 Codex review 只是 advisory（见 §9） |
| ❌ **不是** | prompt 起草指南 —— 那是官方内置 `gpt-5-4-prompting` skill 的活，需要时引用它 |

执行引擎 = 官方 plugin。本 skill = 上面那层「判断力」。

---

## 1. 就绪自检（用之前先确认）

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion.mjs" setup --json
```
或直接 `/codex:setup`。期望 `"ready": true` + `auth.loggedIn: true`。
不就绪 → 提示用户 `/codex:setup`（会引导 `npm install -g @openai/codex` + `codex login`）。

**斜杠命令不存在 / `Skill("codex:*")` 报 Unknown？（2026-06-10 实测定性）**
plugin 的 commands/agents/skills 只在 **Claude Code 进程启动时**注册——`/clear` 开新会话**不会**重扫 plugin。装完/升级完 plugin 后必须**完整退出 Claude Code 再重开**（实证：同一进程内 `claude plugin list` 已显示 enabled 但命令不可见；新起的 `claude -p` 进程立即可见 `codex:setup` / `codex:rescue` + 3 个 plugin skills）。
**紧急桥（不重启临时用）**：直接 Bash 调 plugin 引擎，效果与斜杠命令等价（Windows 端到端实测产出真 review verdict）：

```bash
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/plugins/cache/openai-codex/codex/<version>"
node "$CLAUDE_PLUGIN_ROOT/scripts/codex-companion.mjs" setup --json
node "$CLAUDE_PLUGIN_ROOT/scripts/codex-companion.mjs" review "--wait"   # cwd = 目标 git repo
```

注意：直接调用绕过了 plugin 的 SessionStart/SessionEnd 生命周期 hooks，跑完可能残留 `codex` / `node` broker 进程占住 cwd（实测发生）——用完检查 `codex-companion.mjs status --json` 并清理残留进程。

> **review-gate 必须保持关闭**（`reviewGateEnabled: false`）。**绝不**跑 `/codex:setup --enable-review-gate` —— 官方明示会快速烧穿用量限额，且"自动循环复审"与 governed gate 的人类签字哲学冲突（CLAUDE.md 反模式）。跨模型 review 一律手动触发。

---

## 2. 命令地图（官方 plugin 的 7 个调用方式，全在这）

| 命令 | 干什么 | 关键 flag | 写盘? |
|---|---|---|---|
| `/codex:rescue` | **委派执行**：调查 / 修 bug / 实现 / 长链路施工 / 续跑 | `--background\|--wait` · `--resume\|--fresh` · `--model <m\|spark>` · `--effort none\|minimal\|low\|medium\|high\|xhigh` | 默认**可写**（workspace-write）；只读调查会自动降为 read-only |
| `/codex:review` | **原生 code review**（对本地 git 改动，只读） | `--base <ref>` · `--scope auto\|working-tree\|branch` | 否 |
| `/codex:adversarial-review` | **对抗式 review**：质疑实现思路 / 设计选型 / 假设（不只是更严的找 bug）；santa-loop 第二评审员 | 同上 + 末尾可加 focus 文本 | 否 |
| `/codex:status` | 看本仓库 active / 最近的 Codex job（配合 `--background`） | `[job-id]` · `--all` · `--wait` | 否 |
| `/codex:result` | 取某个已完成 job 的完整输出 | `[job-id]` | 否 |
| `/codex:cancel` | 取消一个后台 job | `[job-id]` | 否 |
| `/codex:setup` | 自检 + 装 codex + 切 review-gate | `--enable/--disable-review-gate`（**别开**） | 否 |

> **比老 skill 多出来的能力**：`--background` 异步 + job 追踪（status/result/cancel）、`--resume` 续跑同一 Codex 线程、`--effort` 调推理档。老 codex-dispatch 这些都没有。

> **谁能触发（2026-06-10 核实）**：`/codex:review` 和 `/codex:adversarial-review` 带 `disable-model-invocation: true` —— **只有用户手动敲**，模型不能自动调（与 CLAUDE.md"跨模型 review 一律手动"一致）。模型可自动调的只有 `/codex:rescue`（经 `codex:codex-rescue` subagent）和 `/codex:setup`。所以自动化流程（santa-loop / wave 收尾）需要 Codex review 时：**提示用户敲命令**，或经 §1 紧急桥直接调 companion `review`。

---

## 3. 决策树：该不该用 Codex、用哪个命令

```
任务来了
  │
  ├─ 需求还模糊 / 范围在变 / 需要当前对话上下文 ──────────► 不用 Codex（留 Claude 主线程）
  │
  ├─ 高风险决策（安全/权限/认证/支付/数据迁移/公共 API/核心逻辑）► 不委派拍板
  │       └─ Codex 至多辅助调查，最终决策留 Claude 主线程
  │
  ├─ 想让第二个模型审已写好的代码 ─────────────────────►
  │       ├─ 审实现缺陷 ............................ /codex:review
  │       └─ 质疑"这条路对不对" / santa-loop ........ /codex:adversarial-review
  │
  └─ 边界清晰、可验证的执行任务 ───────────────────────► /codex:rescue
          （已知改哪几个文件、改成什么样、验证命令是什么的 deterministic 施工）
          ├─ 预计长 / 多轮 → 加 --background，之后 /codex:status 看进度
          └─ 续上一轮 → --resume（"继续 / 接着改 / 应用 top fix / 再深挖"）
```

**Codex 擅长**：已明确复现路径的 bug 修复 · 边界清晰的小功能 · 补测试/补类型/补文档 · 规则明确的重构迁移 · 格式化清理 · 长链路 deterministic 施工 · 高噪音调查（日志排查/调用点清点/依赖梳理）。

**别给 Codex**（→ 走 Claude opus subagent 而非 Codex）：单次产出 ≥ 5000 字 / ≥ 10 protocol 横向对比 / "需要先想清楚整体结构再写"的综合性长 survey。Codex 在"宽而长"的任务上会撞 context 上限（见 §5）。

> 内部执行者路由（Codex vs Claude subagent vs 主线程）的完整规则见 `rules/common/task-execution-protocol.md` §3.1。本 skill 是它的 codex 操作细节展开。

---

## 4. 施工单模板（`/codex:rescue` 委派时用）

`/codex:rescue` 把原始请求当 prompt 转发给 Codex。委派 deterministic 施工时，把任务文本写成下面这个结构（Codex 拿不到当前对话上下文，必须自带背景）：

```
## 任务目标
{一句话}

## 上下文摘要
{Codex 需要的背景，≤500 字；它看不到当前对话}

## 可改文件范围
{明确列出可改的文件/目录}

## 禁改文件范围
{明确列出不可改的文件/目录}

## 验收标准
{明确、可验证的条件}

## 必跑验证项
{改完后必须执行的命令}

## 编码要求（Windows 必读 —— 见 §6，涉及读中文文件时必附）
读取任何文本文件时必须用 UTF-8，避免中文乱码：
- PowerShell: Get-Content -Path <file> -Encoding utf8
- PowerShell 读完整文件: [System.IO.File]::ReadAllText("<file>", [System.Text.Encoding]::UTF8)
- Python: open(file, encoding="utf-8")
禁止使用不带 -Encoding 参数的 Get-Content。

## 返回格式
1. 本轮完成内容（一句话）
2. 修改文件列表
3. 改动说明
4. 验证结果
5. 未完成项 / 风险项
```

> 起草更紧凑的 Codex prompt（XML 块结构 / output contract / verification loop）时，引用官方内置 `gpt-5-4-prompting` skill —— 不要在这里重复它的内容。

---

## 5. 切尺度纪律（chunking —— 一次只接"窄而深"）

**起因（2026-05-14 实战撞墙）**：把一份 19-section survey + 12 维矩阵 + 3 层架构提案一次塞给 Codex（xhigh + web search + full-auto），结果转了 40+ 次 web search、写出 11802 行 stdout，最后 `ran out of room in the model's context window`，一个字节文件都没产出。同 prompt fallback 到 opus subagent + fetch budget 立即可执行。

**硬约束（每个 Codex 施工单自带三道闸）**：
- 单次最多 **3 个 deep section** 或 **1 个 chunky implementation**
- 单次 web search **≤ 8 次**（超了改写为多轮）
- 单次产出 **≤ 3500 字 / ≤ 400 行 diff**
- **write-first, think-later**：让 Codex 先把 stub / 章节骨架写到磁盘再补内容，失败也至少留结构
- `xhigh` 慎用：default reasoning 多数够；`xhigh` 只在"单一非常难的决策点"用，**不要叠加** "xhigh + 大范围调研"
- 10+ 协议 / 多领域 / 多文件的调研 → **先拆 plan**（Claude 主线程画拆解图），再分多轮 dispatch，最后主线程合并

反模式：❌ 一次塞 19-section survey ❌ `xhigh + --full-auto + 大 prompt` 三者叠加 ❌ 不设 fetch budget 就 dispatch ❌ Codex 一挂就重试同样 prompt（必须先拆）。

---

## 6. Windows 注意事项

本机是 Windows + PowerShell。官方 plugin 用 `spawn` + prompt-file/stdin 传参，所以老 skill 那个**「后台长 prompt 卡在 stdin」的坑已经被 plugin 从根上绕过**，走 `/codex:rescue` 不用再操心传参。但还有两条仍然成立：

1. **UTF-8 读文件（仍会咬人）**：Codex 沙箱隔离注册表 → PowerShell 5.1 ExecutionPolicy 退回 Restricted → profile 不加载 → `Get-Content` 默认 GBK 读文件 → 中文乱码。这是 codex CLI 自身运行时行为，跟谁启动它无关。**凡施工单涉及读中文文本文件，必附 §4 的「编码要求」块。**
2. **非 git 目录信任（留意）**：raw `codex exec` 在非 git 根目录会报 "Not inside a trusted directory"，老办法是加 `--skip-git-repo-check`。走官方 `/codex:rescue` 时由 companion 处理；若某次在非 git 目录跑失败且报 trust 错误，提示用户在 git 仓库内跑，或回退到 raw CLI 时补 `--skip-git-repo-check`。
3. **review 日志大量 `exit -1` / `Command failed` 是噪音不是失败（2026-06-10 实测）**：Codex 沙箱内 PowerShell 跑 `git diff` / `pwd` / `Write-Output` 等会成片 fail/declined，但 Codex 会自己换命令绕过（`Get-Content` / `git status` 可用），最终 review 照常产出 verdict。**别看到 failed 行就判死、别中途 kill**——以末尾 `Review output captured` / `Turn completed` 为准。

---

## 7. 额度 fallback

Codex 返回额度错误（rate limit / quota exceeded / 402）→ **立即 fallback 到 Claude subagent**（`Agent` tool），按 `rules/common/performance.md` 模型路由选 `sonnet`/`opus`。
做 cross-review 的 fallback 时，prompt 明确要求："假装你是另一个模型，不要重复 Claude 主线程的思路"（保留跨模型视角的意义）。

---

## 8. Wave 收尾强制 cross-review

每次 wave 编排（spawn 多个 subagent 并行执行）收尾，**强制**走一次 Codex cross-review：

1. Subagent 报"完成 + tests PASS" 后 **不立刻 commit**
2. 对每个 subagent 的 diff 拉一次 `/codex:review`（或 `/codex:adversarial-review`）
3. Claude 主线程收到 review 后**亲自修**（不再转手 subagent 来回扯皮），minimal diff
4. 修完再 commit → 再进 UAT

**Why**：同模型写+审有系统性盲点（写代码的模型也审代码 → 撞同样的盲点）。Codex（不同模型家族）能在 commit 前抓到同模型自审漏掉的。
**边界**：trivial 单文件改 / 纯文档改 → 跳过；紧急 hotfix → 先修，fix 后立刻补一轮 audit；Codex 额度耗尽 → §7 fallback。

---

## 9. Governed-gate 边界（硬约束）

在 governed gate（appsec/qa release · commercial-cert · pentest · `/gsd-ship` release gate）里：
- Codex review **只是 advisory / 侦察兵**，产出候选发现，**绝不**产出 release verdict
- verdict 只能由 deterministic spec-runner + `spec_hash` 人类审批 + evidence bundle 产出（CLAUDE.md §3.7）
- Codex 的发现必须喂回 spec-runner 走验证/证据/审批，不得直接落地为 gate 结论
- **绝不**开 review-gate stop hook（§1）

---

## 10. 版本号不写死（user lock 2026-05-02）

任何 skill / 方案 / 文档 / commit / 提示里提到 Codex 模型，**不写具体 GPT 版本号**（不写 GPT-5.4/5.5/5.x），统一写"Codex GPT 系列模型"或"Codex CLI（GPT 系列）"。版本会持续升级，写死会让记录快速过期、误导路由判断。
例外：用户明确问"Codex 现在跑哪个版本" → 才答具体版本号。
`--model spark` → 仅在用户明确要 spark 时映射为 `gpt-5.3-codex-spark`，否则 model 留空（用 Codex 默认）。

---

## 11. Cross-links

- 执行引擎：官方 `codex@openai-codex` plugin（命令见 §2）
- prompt 起草：官方内置 `gpt-5-4-prompting` skill（`user-invocable: false`，由 codex-rescue 内部用）
- 内部执行者路由：`rules/common/task-execution-protocol.md` §3.1
- 模型路由 / fallback 选档：`rules/common/performance.md`
- 跨模型双盲收敛：`santa-loop` skill（Codex 当第二评审员）
- governed-gate 哲学：`CLAUDE.md` §3.7 + 反模式区
