# Contributing to This Architecture Repository

这个仓库的重点是展示和维护架构，不是提交业务功能代码。

## 修改原则

1. 修改 README 时，只放概览，不塞细节。
2. 修改某条主线时，同步更新：
   - `docs/02-orchestrators/<name>.md`
   - `data/orchestrators.yml`
   - 相关 `diagrams/*.mmd`
3. 修改 verdict、gate 或 evidence 时，同步更新：
   - `docs/04-governance-and-evidence.md`
   - `data/verdicts.yml`
   - `examples/evidence/*.yaml`
4. 修改安全边界时，同步更新：
   - `docs/05-security-boundaries.md`
   - `docs/02-orchestrators/appsec.md`
   - `data/capability-matrix.yml`

## 文档质量检查

提交前检查：

- README 第一屏是否仍然能在 30 秒内读懂；
- 每个 Mermaid 图是否有对应 `.mmd` 源文件；
- 每个主线是否说明 trigger、mode、gate、output；
- 安全相关描述是否避免暗示“自动主动攻击”；
- evidence 示例是否仍符合 schema；
- 新增术语是否进入 `docs/glossary.md`。

## PR checklist

- [ ] 更新了相关 docs。
- [ ] 更新了相关 data YAML。
- [ ] 更新了相关 diagram source。
- [ ] 没有把 dynamic workflow 写成 release verdict 来源。
- [ ] 没有弱化 ROE / manual-only / production hard-refuse 规则。
