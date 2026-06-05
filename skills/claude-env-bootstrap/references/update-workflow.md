# Relocated from claude-env-bootstrap/SKILL.md — §8. `--update` 模式

## 8. `--update` 模式

调用形式:`/claude-env-bootstrap --update` 或对话里说"同步全局到项目"。

### 8.1 流程

```
1. Read .claude/manifest.json
2. 若 manifest.version < 2.0.0 → 触发 v1→v2 迁移(重跑 SCAN + 生成 selector_evidence)
3. 对每个已装 skill:
   - 比对全局当前版本 vs manifest 记录版本
   - 若 user_modified == true → 警告,需手动 merge
   - 若全局更新 + user_modified == false → 候选更新
4. 重跑 SCAN(可能 catalog.json 已升级,新 skill 现在匹配了)
5. 跑 COMPOSE,diff 当前安装 vs 新计划
   - 新匹配但未装 → 询问是否装
   - 已装但不再匹配 → 询问是否卸(默认保留,标记 "deprecated")
6. 用户确认后执行
```

### 8.2 catalog 升级处理

全局 `catalog.json` 升级后,`--update` 自动跑 selector 重评估。比如:
- 全局加了 `security-app-graphql` skill(catalog.json 新增条目)→ 本地项目若 `risk_surface.graphql` 匹配,提示新装
- 全局把 `security-app-llm` 的 selector 改严了 → 本地项目若不再匹配,提示移除

---
