# Claude Code Harness — Configuration & Architecture

> 五主线 orchestrator 架构（Bootstrap · GSD PM · UIUX `v2.3` · QA `v3.2` · AppSec `v3.0`），以 hooks + 确定性 gate + spec_hash + evidence bundle + 人工签字治理 agentic 交付。`context loading != enforcement`。

## 📐 Architecture

完整架构展示（5 主线 workflow、能力矩阵"什么测试 / 防什么安全 / 什么攻击"、门禁与证据链、安全边界）见 **[`architecture/`](architecture/)**，从 [`architecture/README.md`](architecture/README.md) 开始。

| 入口 | 内容 |
|---|---|
| [`architecture/docs/00-overview.md`](architecture/docs/00-overview.md) | 5 主线、4 层控制面、核心原则 |
| [`architecture/docs/01-routing.md`](architecture/docs/01-routing.md) | 路由策略、优先级、tie-break、handoff |
| [`architecture/docs/02-orchestrators/`](architecture/docs/02-orchestrators/) | 每条主线深挖到 agent / hook / SDK 级 |
| [`architecture/docs/03-capability-matrix.md`](architecture/docs/03-capability-matrix.md) | 测什么 / 防什么 / 攻什么 + 标准 |
| [`architecture/docs/04-governance-and-evidence.md`](architecture/docs/04-governance-and-evidence.md) | verdict、spec_hash、evidence、dynamic workflow 边界 |

标准底座：OWASP ASVS 5.0 · NIST CSF 2.0 · OWASP Top 10:2025 · WCAG 2.2 · ISO/IEC 25010:2023 · PCI DSS 4.0.1 · MITRE ATT&CK。

---

### Plugin Manifest Gotchas

If you plan to edit `.claude-plugin/plugin.json`, be aware that the Claude plugin validator enforces several **undocumented but strict constraints** that can cause installs to fail with vague errors (for example, `agents: Invalid input`). In particular, component fields must be arrays, `agents` must use explicit file paths rather than directories, and a `version` field is required for reliable validation and installation.

These constraints are not obvious from public examples and have caused repeated installation failures in the past. They are documented in detail in `.claude-plugin/PLUGIN_SCHEMA_NOTES.md`, which should be reviewed before making any changes to the plugin manifest.

### Custom Endpoints and Gateways

ECC does not override Claude Code transport settings. If Claude Code is configured to run through an official LLM gateway or a compatible custom endpoint, the plugin continues to work because hooks, skills, and any retained legacy command shims execute locally after the CLI starts successfully.

Use Claude Code's own environment/configuration for transport selection, for example:

```bash
export ANTHROPIC_BASE_URL=https://your-gateway.example.com
export ANTHROPIC_AUTH_TOKEN=your-token
claude
```
