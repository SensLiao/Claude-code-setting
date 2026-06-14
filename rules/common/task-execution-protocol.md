# Task Execution Protocol（任务执行协议）

> 本协议是硬规则。所有生成型任务（编码、文档编写、重构、测试、配置修改等）在执行前必须走此流程。

## 触发条件

**两类触发**（任一即触发）：

A. 任何**生成型任务**（会产出新文件或修改现有文件的任务），包括但不限于：
- 编写代码 / 实现功能
- 编写或更新文档
- 重构 / 迁移
- 补测试
- 配置修改
- 批量修复

B. 任何**重派发**（即使只读）—— 补 §A 漏掉的"只读 fan-out 不算生成型"缺口：
- 启动 **Workflow**（任何 `Workflow()` 调用）
- **≥3 个 sub-agent 的 fan-out**（含只读 audit / review / 调研 大 fan-out）
- 拉起**重 orchestrator / 重 skill**（GSD / UIUX / AppSec / QA 主线编排）

**不触发的情况**：纯回答问题、解释代码、读单个文件、单次搜索、1 个轻量只读 agent。

## 强制流程（五步）

### Step 1: 任务分类

根据预估规模判断复杂度：

| 复杂度 | 判断标准 |
|--------|---------|
| 简单 | 改动 1 个文件、不需要设计决策 |
| 中等 | 改动 2-3 个文件、单一功能/bug |
| 复杂 | 改动 4+ 文件、多步骤、需要架构决策、跨模块 |

- **简单任务**：直接执行，跳过后续步骤
- **中等/复杂任务**：必须继续 Step 2-5，且在执行前输出方案给用户审查

### Step 2: 搜索匹配 Skills

扫描当前可用的 skills 列表（全局 + 项目级 + 案例级），为任务选配所有匹配的 skill。

选配维度：
- **规划类**：任务需要拆解或设计时
- **执行类**：任务需要并行、委派、或长链路施工时
- **质量类**：任务完成后需要验证、审查时
- **领域类**：任务涉及特定技术领域时

**不确定就不选，但匹配了必须列出。**

### Step 3: 执行者路由

本步骤分两层：
- **3.1 内部执行者路由**：在 Claude 生态内部，决定由谁执行（主线程 / subagent / Codex）
- **3.2 外部协作路由**：是否引入外部强推理模型（如 GPT-5.5 Thinking）作为上游设计师 + 下游验收官

#### 3.1 内部执行者路由

为每个子任务决定由谁执行。Codex 走 **官方 plugin `codex@openai-codex`**（review 用 `/codex:review` 只读 / `/codex:adversarial-review` 对抗式；委派执行用 `/codex:rescue`，支持 `--model` / `--effort` / `--background`），不再走旧的 local skill。**何时用 Codex、用哪个命令、带什么纪律（切尺度 caps / wave 强制 cross-review / Windows UTF-8 / 版本号不写死 / governed-gate 边界 / 施工单模板）的完整 playbook 见 `~/.claude/skills/codex-dispatch/SKILL.md`** —— 本节是其速查，细则以该 skill 为准：

| 判断维度 | Codex（`codex@openai-codex` plugin） | Claude subagent | Claude 主线程 |
|---------|------------------------|-----------------|--------------|
| 任务性质 | 具体编码/测试/迁移/扫描/格式化（`/codex:rescue`）；跨模型 review（`/codex:review`、`/codex:adversarial-review`） | 需要当前上下文或 Codex 不适合 | 架构决策/审查/用户交互 |
| 边界清晰度 | 输入输出明确 | 有一定模糊性 | 需要判断力 |
| 风险等级 | 低（可验证） | 中 | 高（不可委派） |

优先级：**任务适配度 > 省 token**。选最适合的执行者，节省 token 是附带收益。

**固定不可委派（留 Claude 主线程，Codex 至多辅助调查不拍板）**：需求理解与任务拆分 / 架构与方案决策 / 高风险事项（安全·权限·认证·支付·数据迁移·公共 API·核心逻辑）/ 最终审查与合并决策 / 是否接受 reviewer 意见的判断。

**额度 fallback**：Codex 返回额度错误（rate limit / quota / 402）时，立即 fallback 到 Claude subagent（`Agent` tool，按 Step 4 模型路由选 `sonnet`/`opus`）。

**施工单模板**（经 `/codex:rescue` 委派执行任务时使用——边界清晰 + 可验证；纯 review 走 `/codex:review` 或 `/codex:adversarial-review`，可加 `focus`）：

```
## 任务目标
{一句话}

## 上下文摘要
{Codex 需要的背景，≤500 字；它拿不到当前对话上下文}

## 可改文件范围
{明确列出可改的文件/目录}

## 禁改文件范围
{明确列出不可改的文件/目录}

## 验收标准
{明确、可验证的条件}

## 必跑验证项
{改完后必须执行的命令}

## 返回格式
1. 本轮完成内容（一句话）
2. 修改文件列表
3. 改动说明
4. 验证结果
5. 未完成项 / 风险项
```

#### 3.2 外部协作路由（GPT-5.5 Thinking ↔ Opus）

**触发**：Step 1 判定为"复杂"且涉及研究设计 / 论文 / 长链路 pipeline，或用户粘贴了外部模型产出的 spec / review。简单和中等任务直接走 3.1。

**分工**：外部强推理模型（GPT-5.5 Thinking）做上游设计 + 下游验收，Opus（当前主线程）做施工。

| 任务类型 | 归谁 |
|---------|------|
| 研究拆解 / 实验矩阵 / ablation 设计 | GPT-5.5 |
| 文献方法理解 / baseline 公平性判断 | GPT-5.5 |
| 论文 / PPT 故事线 / 长文档润色 | GPT-5.5 |
| 多文件代码修改 / refactor / debug / 跑脚本 | Opus |
| 代码审查 / 方案复核 | GPT-5.5 |

##### 五步循环

```
GPT-5.5   设计 spec + checklist
   ↓
Opus      改代码 + 跑测试 + 输出 diff summary
   ↓
GPT-5.5   review diff / 结果
   ↓
Opus      按 review 修 bug
   ↓
GPT-5.5   整理为实验记录 / report / slides
```

##### Opus 收到外部 spec 时的执行纪律

1. 只做 spec 列出的任务——不顺手重构、不新增抽象、不改未列出的文件
2. 保留现有 CLI / 接口——除非 spec 明确要求变更
3. 执行完毕输出结构化摘要：修改文件列表、关键逻辑变更、潜在风险、测试命令
4. spec 不明确 → 停下问用户，不替外部模型补决策

##### spec 书写正反例

反例（会幻读 / 越界）：
> 帮我完成这个项目。

正例（能精确执行）：
> 1. 阅读 `train_medsam3_lora.py` 和 `dataset.py`
> 2. 保持现有 CLI 参数不变
> 3. 新增 `--p2t_prompt_json` 参数，在 dataloader 中读取 click side text
> 4. 不修改 evaluation 逻辑
> 5. 输出 diff summary 和测试命令

##### 研究项目落地模板（P2T / MedSAM3 / ToothFairy3）

| 阶段 | 归谁 | 任务 |
|------|------|------|
| 设计 | GPT-5.5 | 方法定义、实验矩阵、baseline 公平性、evaluation protocol、PPT 故事线 |
| 施工 | Opus | 数据预处理、pipeline 改造、LoRA、evaluate_*.py、debug、跑实验 |
| 验收 | GPT-5.5 | 结果解读、可信度判断、discussion、supervisor slides |

### Step 4: Model 路由（仅 Claude subagent 适用）

| 任务层级 | Model | 适用 |
|---------|-------|------|
| 决策层 | opus | 架构设计、方案选型、复杂 debug、安全审查、内容质量终审 |
| 执行层 | sonnet | 功能开发、测试、常规 review、中等分析 |
| 工具层 | haiku | 格式转换、文档更新、简单 CRUD |

### Step 5: 渲染计划预览卡 → 用户审查 → 执行

**在执行任何生成操作 / 重派发之前**，必须先渲染 **PLAN-PREVIEW CARD（计划预览卡，坎）** —— 单一真相源 `~/.claude/orchestrator-runtime/shared/preview-template.md` 的 "Default user-facing card"（详见 [CLAUDE.md §0.6](../../CLAUDE.md)）。卡片不是纯文字，必须是**表 + 点线流程图**：

```
╔══ 执行计划预览 · PLAN PREVIEW — {{Domain}} / {{mode}} ══╗
🎯 目标 / 🧩 用到的能力 / ✅ 做完得到 / 📦 规模·成本 / 🚦 复杂度档 / 🤔 为什么这个形状

── Agents 调度（表）──
| # | 阶段/Agent | 模型 | 干什么 | 用的工具=作用 |   ← 工具列必填
|---|-----------|------|--------|---------------|

── 流程/结构图（dots & lines）──
{{ascii_flow_diagram}}   图例: ──►串行 ═►parallel×N ◇gate ⟳loop [det]纯代码 ?=skip

── 证据/产物 ──  - {{path}} …
🔒 spec_hash（仅 workflow-spec）
确认执行? OK/批准/跑 → 跑 · 改:说哪步 · 停:cancel
```

> 复杂度分档（§Step 1）决定卡的厚度：**简单**=跳过；**中等**=精简卡（表为主）；**复杂**=完整卡（表+图+成本）。这张卡取代了旧的纯文字"执行方案"摘要——同样含任务分类 / 匹配 skills / 执行者 / model / 理由，但以**表+图**呈现，并强制带"用的工具=作用"列和流程图。

**等用户确认后再开始执行。** 用户可以：
- 确认 → 按方案执行
- 修改 → 调整后再确认
- 拒绝 → 重新规划

## 例外

- 用户明确说"直接做"/"不用问我"→ 跳过 Step 5 的审查等待，但仍需内部走 Step 1-4
- 紧急修复（测试全挂、build 失败）→ 先修再报告
