---
name: codex-dispatch
description: Delegate execution tasks to Codex CLI (GPT-5.4) for parallel work, long-chain operations, and high-noise investigations. Claude Code stays as orchestrator. Falls back to Claude Code subagents when Codex quota is exhausted.
---

# Claude Code × Codex CLI 协作调度

## 概述

通过 `codex exec` 将执行型子任务委派给 Codex CLI（GPT-5.4），Claude Code 保持主调度、主决策、主审查角色。两个不同模型家族并行工作，互相交叉验证，减少单模型盲点。

## 系统角色

| 角色 | 模型 | 职责 |
|------|------|------|
| **Claude Code**（主控） | Claude Opus/Sonnet | 理解、拆分、决策、审查、收口 |
| **Codex**（执行者） | GPT-5.4 | 执行、并行、施工、验证、汇报 |

## 何时触发

满足以下**任意一条**时考虑使用 Codex：

- 2+ 个独立子任务可并行，且 Claude Code subagent 已占满
- 长链路施工任务（多轮读文件 → 改代码 → 跑测试 → 再改）
- 高噪音调查（大量日志排查、调用点清点、依赖梳理）
- 需要不同模型视角做交叉 review
- 明确边界的执行任务（bug 修复、补测试、格式化、迁移）

## 何时不用

- 需求仍模糊、范围仍在变化
- 需要当前对话上下文（Codex 拿不到）
- 极小任务（不值得委派开销）
- 高风险决策（安全/权限/支付/核心逻辑）
- Codex 额度已耗尽 → **fallback 到 Claude Code subagent**

## Codex CLI 调用方式

> **Windows 必须**：所有 `codex exec` 调用必须加 `--skip-git-repo-check`，否则非 git 根目录会报 "Not inside a trusted directory" 错误。

### 基础执行

```bash
codex exec --full-auto --skip-git-repo-check -C "<working_dir>" "<prompt>"
```

### 指定模型

```bash
codex exec --full-auto --skip-git-repo-check -m "gpt-5.4" -C "<working_dir>" "<prompt>"
```

### 获取结构化结果

```bash
codex exec --full-auto --skip-git-repo-check -C "<working_dir>" -o "<output_file>" "<prompt>"
```

### 带附加可写目录

```bash
codex exec --full-auto --skip-git-repo-check -C "<working_dir>" --add-dir "<extra_dir>" "<prompt>"
```

### 沙箱模式选择

| 模式 | Flag | 适用场景 |
|------|------|---------|
| 只读 | `-s read-only` | 纯调查、代码审查 |
| 工作区写入 | `-s workspace-write` 或 `--full-auto` | 常规施工（默认推荐） |
| 完全访问 | `-s danger-full-access` | 需要网络/系统级操作（谨慎使用） |

## 额度检查与 Fallback

**每次调用前必须检查 Codex 是否可用：**

```bash
# 快速检查：用一个最小 prompt 测试
codex exec --full-auto --skip-git-repo-check --ephemeral "echo hello" 2>&1
```

如果返回额度错误（rate limit / quota exceeded / 402），立即 fallback：

```
Codex 额度不足，fallback 到 Claude Code subagent 执行。
```

Fallback 时使用 Agent tool 的 `model: "sonnet"` 或 `model: "opus"` 替代，按原有模型路由策略选择。

## Windows 后台执行约束

`codex exec` **可以**在 `run_in_background: true` 下运行，但必须注意 **prompt 传递方式**。

### 会卡死的模式

超长 prompt 内联在命令行中，且包含特殊字符（`#`、backtick、`→`、嵌套引号）时，shell 在后台模式下可能截断或误解析 prompt，导致 Codex 卡在 `Reading additional input from stdin...`。

### 安全的后台模式

**方式1：先写入变量再传递（推荐）**
```bash
PROMPT=$(cat /tmp/codex-task.txt) && codex exec --full-auto --skip-git-repo-check -C "<dir>" "$PROMPT"
```

**方式2：短 prompt 直接传递**
```bash
codex exec --full-auto --skip-git-repo-check --ephemeral "echo hello" 
```

**方式3：多个前台 Bash calls 并行（最可靠）**
```
# 在同一条消息中发出多个前台 Bash tool calls
Bash call 1: codex exec --full-auto --skip-git-repo-check -C <dir> "<prompt A>"
Bash call 2: codex exec --full-auto --skip-git-repo-check -C <dir> "<prompt B>"
```

### 施工单下发标准流程

对于包含中文、特殊字符、多行格式的施工单 prompt：
1. **先写入临时文件**：`Write tool → /tmp/codex-task-N.txt`
2. **再用变量传递**：`PROMPT=$(cat /tmp/codex-task-N.txt) && codex exec ... "$PROMPT"`
3. 这样后台模式 (`run_in_background: true`) 也能安全工作

## Windows 编码约束

Codex 沙箱会隔离注册表，导致 PowerShell 5.1 的 ExecutionPolicy 全部回退为 Restricted，profile 无法加载，`Get-Content` 默认使用 GBK 编码读取文件。

**每个施工单 prompt 末尾必须附加以下编码指令：**

```
## 编码要求（Windows 必读）
读取任何文本文件时，必须使用 UTF-8 编码，避免中文乱码：
- PowerShell: Get-Content -Path <file> -Encoding utf8
- PowerShell 读取完整文件: [System.IO.File]::ReadAllText("<file>", [System.Text.Encoding]::UTF8)
- Python: open(file, encoding="utf-8")
禁止使用不带 -Encoding 参数的 Get-Content。
```

## 标准施工单格式

每次向 Codex 下发任务时，prompt 必须包含以下结构：

```
## 任务目标
{一句话说明}

## 上下文摘要
{Codex 需要知道的背景，不超过 500 字}

## 可改文件范围
{明确列出可以修改的文件/目录}

## 禁改文件范围
{明确列出不可修改的文件/目录}

## 验收标准
{明确的可验证条件}

## 必跑验证项
{改完后必须执行的命令}

## 编码要求（Windows 必读）
读取任何文本文件时，必须使用 UTF-8 编码，避免中文乱码：
- PowerShell: Get-Content -Path <file> -Encoding utf8
- PowerShell 读取完整文件: [System.IO.File]::ReadAllText("<file>", [System.Text.Encoding]::UTF8)
- Python: open(file, encoding="utf-8")
禁止使用不带 -Encoding 参数的 Get-Content。

## 返回格式
请按以下结构返回：
1. 本轮完成内容（一句话）
2. 修改文件列表
3. 改动说明
4. 验证结果
5. 未完成项 / 风险项
```

## Claude Code 固定负责（不可委派）

- 需求理解与任务拆分
- 架构与方案决策
- 高风险事项处理（安全/权限/认证/支付/数据迁移/公共 API/核心逻辑）
- 最终审查与合并决策
- 是否接受 reviewer 意见的判断

## Codex 固定负责（优先委派）

### 执行类
- 已明确复现路径的 bug 修复
- 边界清晰的小功能实现
- 补测试 / 补类型 / 补文档
- 规则明确的重构 / 迁移
- 格式化与清理

### 长链路类
- 多轮读文件 → 定位 → 修改 → 验证
- 长时间调试
- 持续执行的工程任务

### 并行类
- 多个独立模块的修复
- 多个独立目录的迁移
- 多组测试补齐
- 多项互不依赖的实现

### 高噪音类
- 日志排查 / 大量文件扫描
- 调用点清点 / 依赖关系梳理
- 大量命令输出处理

## 标准协作流程

```
Step 1: Claude Code 建模任务
  → 任务目标、改动范围、禁改范围、验收标准、风险点、是否可委派

Step 2: Claude Code 决定委派
  → 执行型 → Codex
  → 判断型 → Claude Code
  → 高风险 → Claude Code（Codex 可辅助调查，不可拍板）

Step 3: Claude Code 下发施工单
  → codex exec --full-auto -C <dir> "<施工单 prompt>"

Step 4: Codex 执行并返回结果

Step 5: Claude Code 收口
  → 审查 diff / 测试结果 / 是否偏离需求
  → 决定：接受 / 要求返工 / 继续派工 / 合并
```

## 禁止事项

### Claude Code 禁止
- 把最终风险决策完全交给 Codex
- 跳过最终审查直接接受 Codex 结果
- 在需求不清晰时直接外包施工
- 把所有任务都留在主线程不委派

### Codex 禁止（通过 prompt 约束）
- 擅自扩大改动范围
- 修改禁改区域
- 跳过规定验证项
- 在无明确验收标准时自由发挥核心逻辑

## 实战示例

### 示例 1：并行修复两个独立 bug

```bash
# Bug A: schema 校验问题
codex exec --full-auto --skip-git-repo-check -C "/path/to/project" -o "/tmp/bugA.md" "
## 任务目标
修复 client-analysis-package.schema.json 中 module_types 允许空对象的问题

## 可改文件范围
shared/schemas/client-analysis-package.schema.json

## 禁改文件范围
其他所有文件

## 验收标准
空 module_types ({}) 必须校验失败

## 必跑验证项
cd tests && python -m pytest test_schema_validation.py::TestAnalysisPackageSchema -v

## 返回格式
（标准格式）
"

# Bug B: 同时由 Claude Code subagent 处理另一个 bug
```

### 示例 2：交叉 Code Review

```bash
codex exec --full-auto --skip-git-repo-check -s read-only -C "/path/to/project" "
## 任务目标
Review 以下文件的改动，检查安全性、正确性、边界情况

## 上下文摘要
这是一个教育视频生产流水线的 S0 分析工具，刚完成 fail-fast 改造

## 可改文件范围
无（只读 review）

## 验收标准
输出 review 报告，按 CRITICAL / HIGH / MEDIUM / LOW 分级

## 必跑验证项
无

## 返回格式
（标准格式，改动说明替换为 review 发现）
"
```
