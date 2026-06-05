---
name: uiux-creative-motion-governor
description: duration ceiling / effect budget / transform-only / interruptibility / reduced-motion fallback / anti-glow。Living Canvas 专项 4/4。
type: workflow
stage: 1
parent: living-canvas-pack
status: stub
---

# Creative Motion Governor — Stub

## 责任边界
**只**当 Living Canvas 所有动效的"宪法管理人"。任何 pattern / surface / element 的动效都必须经过本治理规则。

## 五条治理规则

1. **Duration ceiling** — 见 `living-canvas-interaction.md` 铁律 3。任何动画 > 500ms 一律驳回
2. **Effect budget** — 每屏 glow / shimmer / bloom / particle 累计 ≤ 2 处
3. **Transform-only** — 仅允许动 `transform / opacity / clip-path / filter（慎用）`。不允许动 `width / height / top / left / margin / padding / border / font-size`
4. **Interruptibility** — 任何动画必须可被打断；不允许阻塞 pointer event
5. **Reduced-motion fallback** — 每个动效必须有 `prefers-reduced-motion: reduce` 的兜底（W3C SC 2.3.3）

## 不允许
- 把动效作为产品视觉主调
- 跨 surface 共用同一段 keyframe 但 duration 不一致（必须用 token）
- 不写 reduced-motion 兜底的 motion

## 执行者
- Claude subagent (Task)，model: opus

## Done 条件
- duration token 表（`templates/motion-tokens.md`）
- effect budget 计数规则
- reduced-motion fallback 规范
- 每个 pattern × element 的"是否进 governor 审"标记
