# Layout Engines

> 报告里 §"布局引擎层" 的实现注释。由 `canvas-layout-engine.md` 编排，不是直接套死一个库。

## Structured
- **dagre** — DAG 自顶向下布局；适合审批链、有向 flow
- **d3-hierarchy** — 树形结构；注意：假定单根 + 节点宽高统一，不适合所有复杂图
- **elk**（Eclipse Layout Kernel） — 多算法套件；React Flow 官方 auto-layout 示例已演示

## Organic
- **d3-force**（force simulation） — networks / hierarchies
- 必须配 **forceCollide** 防止节点重叠

## Preserve
- **自研策略层** — 不是第三方库
- 触发约束：用户已手动整理过的画布；只对新增 / 未定位节点局部整理
- **不允许**在 Preserve 模式下触发 Auto-layout Morph（违反 Preserve 语义）

## 切换约定
- 模式切换必须由 `canvas-layout-engine.md` 显式触发
- 切换时所有受影响节点走 Auto-layout Morph（除 Preserve 模式）
- 模式持久化到 surface state（不要每次进 surface 都默认 Structured）

## Refs
- React Flow auto-layout examples (dagre / d3-hierarchy / elk runtime swap)
- React Flow layout overview (d3-hierarchy 限制说明)
- D3 force simulation docs (`forceCollide`)
