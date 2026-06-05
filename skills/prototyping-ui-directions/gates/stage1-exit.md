# Stage 1 Exit Gate

签字标准：

- [ ] `reference-manifest.md` 存在，每个 vendor 字段齐全（URL/commit/license/意图/do-not-copy/portability 评分）
- [ ] 每个 Tier A vendor 真的能在本地打开 `_lineage.md`
- [ ] 每个 Tier B/C vendor 有 ≥3 张截图
- [ ] 失败的 reference 已记录原因 + 用户决定
- [ ] 候选数量 ≤10（超过强制 Tier 化或砍）
- [ ] License 全部审过（GPL/AGPL/不明的标记并告诉用户）
- [ ] 独立 red-team 签字

签字格式：

```
stage_1 gate_owner: <name>
date: <ISO-8601>
acquired: <N> (A:<n> B:<m> C:<k>)
failed: <f>
notes: ...
```
