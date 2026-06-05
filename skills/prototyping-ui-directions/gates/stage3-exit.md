# Stage 3 Exit Gate

签字标准（每 variant 一份 + 总体一份）：

## Per variant
- [ ] `index.{html,tsx}` + `palette.json` + `palette.html` + `token-candidates.{css,json}` + `readme.md` 都存在
- [ ] surface mock 至少 1 个（按 surface map 的 P0 surface 必须有）
- [ ] HTML 在浏览器（Chrome 最新版）真的能打开；React variant 在 `npm run dev` 真的能起
- [ ] 无 console error
- [ ] 无 broken external resource（字体 / 图标 / CDN）
- [ ] 不含 Lorem ipsum 或占位词
- [ ] palette.json + token-candidates schema 合规（schema 见 `templates/prototype-package-layout.md`）
- [ ] readme.md 包含 output type + dimension decisions + borrowing + 适合 / 不适合场景
- [ ] 用所选 archetype（如果选了）的铁律 / pattern（如果是 canvas → 六铁律）
- [ ] tokens.css 集中管理颜色，HTML/JSX 不写死颜色
- [ ] 同一 variant 不混用 HTML 与 React

## 总体
- [ ] `prototypes/_index.html` 存在，列出所有 variant，可点进
- [ ] `prototypes/comparison-report.md` 存在，对评审人有可读价值
- [ ] variant 之间在至少 **2 维** 真差异化（红队签字）
- [ ] 红队 owner ≠ 产出者
- [ ] 装了 `taste-skill` → 用了 + 通过；没装 → 用户已被告知"未经独立红队"
- [ ] 用户至少 accept 1 个 variant（全 reject 回 Stage 2）

签字格式：

```
stage_3 gate_owner: <name>
date: <ISO-8601>
variants_generated: <N>
variants_accepted: [variant-1, variant-3]
variants_rejected: [variant-2]
red_team_skill_used: taste-skill | self-audit
diversity_axes_passed: [palette, density, motion]
notes: ...
```

## 失败 → 回退

- 全 reject → 回 Stage 2 重出 direction
- 差异化不够 → 回 Stage 2 加反方向 direction
- HTML / React 报 console error → 修，不接受"基本可用"
- 一个 variant 混用 HTML 和 React → 立即重做

签字签完即 `current_stage = done`。Pipeline 结束。
