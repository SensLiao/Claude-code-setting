# Context — Visual Research

> Stage 1 + Stage 2 加载本 context。

## 命名规则

- 不允许 `v1 / v2 / v3 / v4` 仪式
- 必须 `<YYYY-MM-DD>-<topic>.md`
- 允许 topic 举例：`palette-shootout` / `typography-pairing` / `surface-tone` / `hero-treatment` / `motion-vocab` / `density-study`

## 目录骨架

```
output/<date>-<nick>/
  reference/<vendor>/...           # Stage 1 clone / 截图
  research/
    extract-cards/<vendor>.md      # Stage 2 提取
    cross-reference.md             # Stage 2 横向对比
    direction-candidates.md        # Stage 2 收敛
```

## 输入 / 输出

- 输入：Stage 0 idea brief + dimension priorities + archetype 选择
- 中间：reference manifest（Stage 1）→ extract cards（Stage 2）
- 输出：direction-candidates.md（Stage 2 末），喂给 Stage 3

## 与主代码库的边界

本 context 下产生的所有产物只落到 `output/<date>-<nick>/` 下，**永不直接**改用户的主代码库 token / 组件 / 路由。
