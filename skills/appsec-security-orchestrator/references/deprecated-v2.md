# Relocated from appsec-security-orchestrator/SKILL.md — §7. AppSec Standard Workflow (DEPRECATED)

## 7. AppSec Standard Workflow （DEPRECATED → 见 §16）

> ⚠️ **v3.0 DEPRECATED**：本节为 v2.0 的"文档约定"版工作流，保留供历史读者参考。
> v3.0 起所有运行时执行走 **§16 Dispatch Contract**（self-dispatching execution machine）。
> 不要按本节 12-step 文字直接执行——按 §16 的 Step 0-9 由 orchestrator 自己 dispatch。

旧 12-step 工作流摘要：激活判断 → 阶段定位 → 自动扫描（dep audit + secret scan + SAST）→ appsec-reviewer code review → headers/cookies/session → 威胁建模 → DAST 决策 → 叠加层激活 → pentest 决策 → 修复路由 → SECURITY.md → Release Evidence。

---
