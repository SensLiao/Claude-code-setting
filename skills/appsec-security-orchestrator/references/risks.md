# Relocated from appsec-security-orchestrator/SKILL.md — §21. Risks / Caveats

## 21. Risks / Caveats

| 风险 | 缓解 |
|---|---|
| Hook 误报（合法 hex string 被当 secret） | §18.1 / §18.6 走 entropy + context-aware（`key=value` 形式优先）；提供 `// appsec-allow:secret-shape <reason>` 单行豁免（写入 sdk audit log） |
| 外部终端跑 sqlmap 绕过 Claude hook | hook 只能拦 Claude 触发的 Bash；P4 toy project 模板带 gitleaks pre-push + Makefile gate 兜底 |
| Evidence 伪造（agent 写假 PASS） | §20.3 validator 强制 `command_evidence` + proof_path |
| Agent 输出非 YAML / 含 raw secret | PreToolUse §18.5a + §18.1 三层兜底 |
| Production URL 误判 | `.appsec/config.json.production_hosts[]` 显式列；hook 精确 host 匹配 |
| 17 sub-skill 改造工作量 | v3.0 仅要求 orchestrator + 3 agent + 6 hook + sdk + 模板；overlay sub-skill 平移到 evidence-write 模式后续做 |
| `.appsec/` 和 `.qa/` 交叉触发 | qa hook matcher `.qa/**`，appsec hook matcher `.appsec/**`，互不重叠 |
| pentest 用户自行复制 sqlmap 命令到 Claude | §18.2 active-scan-guard 是 PreToolUse(Bash) 全局拦截，不依赖 skill 调用路径 |
| Stop hook 兜底 secret 已经偏晚 | 三层叠加：§18.6 PreToolUse 防读 + §18.5 PreToolUse 防错 schema 落盘（间接防带 secret 的 finding）+ §18.1 Stop chat 兜底 |
