# Relocated from discoverability-orchestrator/SKILL.md — §9. CLI 约定

## 9. CLI 约定

L12 子层 narrow skill 应该实现 4 个标准命令（runner 由项目实现，本 skill 只定义契约）：

```bash
# 跑所有激活 domain 的 evidence collection
pnpm discoverability:audit

# 跑 gate 检查（blocker / warn-only 分流）
pnpm discoverability:gate

# 生成 report.md / report.pdf
pnpm discoverability:report

# 解释某条 finding 的修复方法（AI synthesis from evidence）
pnpm discoverability:explain --finding <finding-id>
```

可选子命令（per-domain 单独跑）：

```bash
pnpm discoverability:audit:seo
pnpm discoverability:audit:aeo
pnpm discoverability:audit:geo
pnpm discoverability:audit:aso
```

**注意**：本 skill **不实现** runner，只定义 CLI 契约。具体实现在 `web-seo` / `web-aeo` / `web-local-seo` / `app-aso` 各自的项目脚本里。

---
