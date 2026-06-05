# Performance Optimization

## 模型路由策略

**核心原则：默认 Sonnet，关键节点升 Opus，轻量高频降 Haiku。**

目标不是让每一步都用最强模型，而是让最贵的能力只出现在真正值得的地方。路由判断按"任务复杂度 + 失败代价 + 输出用途"决定，不按任务名字。

### 三个模型的定位

| 模型 | 角色 | 适合 | 不适合 |
|------|------|------|--------|
| **opus** | 决策层 / 评审层 | 架构设计、方案选型、复杂多步 debug、安全/合规审查、高质量客户交付物、最终质量审查 | 高频重复任务、简单转换、纯模板化输出 |
| **sonnet** | 执行层 / 主力层 | 功能开发、前后端实现、测试编写、常规 code review、文档、中等复杂度分析、日常 agent 执行 | 极复杂长链路强歧义决策、高风险最终签发 |
| **haiku** | 工具层 / 预处理层 | 数据清洗、字段抽取、格式转换、规则分类、批处理粗筛、简单路由判断、CRUD 辅助 | 复杂架构推理、开放式问题、强创造性写作、跨模块深度 debug |

> **用无版本别名** `opus` / `sonnet` / `haiku`，由平台映射当前推荐版本（当前：opus=Opus 4.8、sonnet=Sonnet 4.6、haiku=Haiku 4.5）。换版本是平台的事，不改这张表。具体 model id + effort / fast / cache 事实见 [`docs/native-capabilities.md`](../../docs/native-capabilities.md)。**tier 策略本身不变**（user lock 2026-05-29）。

### 团队默认规则

1. 所有普通开发任务默认 Sonnet
2. 所有高风险决策任务升级 Opus
3. 所有轻量重复任务降级 Haiku
4. 客户可见输出在发布前至少经过一次更高等级模型复核
5. 安全、权限、支付、数据合规相关内容优先走更高等级审查

### 任务路由速查表

**opus（~10-15% 调用量）**
- 系统架构设计与技术路线选型
- Pipeline 设计（错了影响后续所有实现）
- 复杂多模块交互 debug
- 最终技术方案评审
- 高质量商业文案、咨询报告、客户交付物
- 安全与合规审查

**sonnet（~60-70% 调用量）**
- 功能开发（前端组件、后端接口）
- 单元测试 / 集成测试
- 常规 code review
- 一般技术文档撰写
- 中等复杂度分析
- 大多数 agent 的日常执行

**haiku（~20-25% 调用量）**
- JSON / CSV / YAML 格式转换
- 规则分类、标签判断
- 数据抽取、字段提取
- 日志归类
- 批量清洗
- 知识库基础 CRUD
- 前置过滤与粗筛

## Context Window Management

Avoid last 20% of context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## Extended Thinking + Plan Mode

Extended thinking is enabled by default, reserving up to 31,999 tokens for internal reasoning.

Control extended thinking via:
- **Toggle**: Option+T (macOS) / Alt+T (Windows/Linux)
- **Config**: Set `alwaysThinkingEnabled` in `~/.claude/settings.json`
- **Budget cap**: `export MAX_THINKING_TOKENS=10000`
- **Verbose mode**: Ctrl+O to see thinking output

For complex tasks requiring deep reasoning:
1. Ensure extended thinking is enabled (on by default)
2. Enable **Plan Mode** for structured approach
3. Use multiple critique rounds for thorough analysis
4. Use split role sub-agents for diverse perspectives

## Build Troubleshooting

If build fails:
1. Use **build-error-resolver** agent
2. Analyze error messages
3. Fix incrementally
4. Verify after each fix
