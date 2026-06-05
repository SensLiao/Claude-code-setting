# Research Extract Card — Template

> Stage 2 per-vendor 提取卡。落到 `output/<date>-<nick>/research/extract-cards/<vendor>.md`。

```markdown
# Extract Card — <vendor> — <YYYY-MM-DD>

## Visual
- palette:
  - 主色: <oklch / hex>
  - 辅助: ...
  - 背景: ...
  - 文字: ...
  - 状态色: ...
- typography:
  - display: <family + scale>
  - text: <family + scale>
  - mono: <if any>
- hierarchy: 通过 [scale / color / weight / position] 区分 primary/secondary
- texture: 纹理 / 噪点 / 玻璃 / 光晕 / —
- layering: 阴影 / 卡片层 / overlap

## Interaction
- 核心动作语义命名: [Create, Duplicate, Delete, ...]
- 状态切换: hover/focus/active/disabled/loading 是否齐全
- 键盘期望: 是否真的能用键盘走完
- selection model: 单选 / 多选 / lasso / ...
- forgiveness: undo / cancel / confirm 可见性

## Motion
- 估算 micro duration: ~<ms>
- 估算 base duration: ~<ms>
- 哪些场景给了动效: [...]
- 哪些场景明确不给: [...]
- effect budget 估算: 每屏 ~<N> 处装饰

## Perspective
- 主入口长什么样（2-3 行描述）:
- navigation model: 顶导 / 侧栏 / 多面板 / 上下文菜单
- 信息密度: 高 / 中 / 低
- 用户视角: 鸟瞰 / 第一人称 / 时间线 / 空间化

## Accessibility (可见的)
- 焦点环: 可见 / 隐藏 / 自定义
- contrast: 估算够 / 不够
- 减动效兜底: 可见 / 看不出来

## Responsive (可见的)
- breakpoints: [320, 768, 1024, ...]
- 触屏适配: 是 / 否
- 密度切换: 是 / 否

## Quote-worthy 引用片段
- "<截屏 / 代码片段 / 文档原话 + 路径或 URL>"
- "..."

## Do-not-copy
- 品牌色 / 字体 / 独占动效 / 文案口吻

## 评分
- portability total: <X>/40
- 跟本产品 idea 距离: <1-10>
```
