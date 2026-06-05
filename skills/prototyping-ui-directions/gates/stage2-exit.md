# Stage 2 Exit Gate

签字标准：

- [ ] 每个 vendor 一份 extract card，六 dimension 字段齐全（n/a 也算齐全，但要明确写）
- [ ] cross-reference matrix 完整
- [ ] direction 候选 ≥3 且 ≤5
- [ ] direction 之间至少 **2 维**真的拉开（palette tone / density / motion stance / perspective stance）
- [ ] 每个 direction 自评 dimension fit
- [ ] 每个 direction 写"不适合的场景"
- [ ] 独立 red-team 签字 — 红队核心责任："差异化够不够"
- [ ] 用户确认哪几个 direction 进 Stage 3

签字格式：

```
stage_2 gate_owner: <name>
date: <ISO-8601>
directions_total: <N>
user_chosen: [...]
diversity_axes: [palette, density, motion, perspective]  # 至少 2 个真拉开
notes: ...
```
