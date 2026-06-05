# Surface Map — Template

> Stage 0 末出 draft，Stage 2 末根据 direction 候选可能调整。Stage 3 据此决定每 variant 生成哪些 HTML。

| Surface | What it does | Audience | Key states | Priority | Stage 3 file |
|---------|--------------|----------|------------|----------|--------------|
| <main-entry> | 产品门面 | 所有用户首屏 | default / signed-in / empty | P0 | `index.html` |
| <example-1> | 列表 / 库 | ... | default / filtered / empty | P0 | `surface-<name>.html` |
| <example-2> | 详情 / 工作面 | ... | default / loading / error | P1 | `surface-<name>.html` |
| <example-3> | 设置 / overlay | ... | open / closed | P2 | optional |

## 命名规则
- 用产品语义命名，不要 generic（`page1` / `view2` 禁用）
- 一句话能说清这个 surface "干什么"

## 数量上限
- 最少 1（主入口）
- 建议 3-5
- 上限 8（再多 Stage 3 一个 variant 写不完）

## P0 / P1 / P2 含义
- **P0**: 每个 variant 都必须生成
- **P1**: 至少一个 variant 生成；其他可省
- **P2**: 可省，仅当用户在 Stage 2 末显式勾上才进 Stage 3

## 关键状态
每个 surface 必须列至少 3 个核心状态。Stage 3 HTML 要在同一页 / 不同 anchor 展示这些状态。
