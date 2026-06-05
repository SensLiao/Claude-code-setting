# Living Canvas Patterns — Index

> 完整 spec 在 `workflows/living-canvas-interaction.md`。本文件只做索引方便 cross-link。

| # | Pattern | Trigger | Motion ref | Reduced-motion fallback |
|---|---------|---------|------------|-------------------------|
| 1 | Seed Create | 空白处右键 New / 拖入 / `N` | scale + opacity, 240ms | opacity-only 100ms |
| 2 | Mitosis Duplicate | `Ctrl/Cmd+D` | scale + translate + 光带, 180ms | 复制到右下方 24px，无光带 |
| 3 | Absorb Delete | `Delete` | scale 1→0 + opacity, 220ms | scale 0.95 + opacity, 120ms |
| 4 | Tissue Group | `Ctrl/Cmd+G` | convex hull 收缩, 280ms | hull 直接显示 |
| 5 | Membrane Drag-In | drag 穿过 hull | hull 形变 + 60ms 脉冲 | hull border highlight |
| 6 | Ungroup Release | `Ctrl/Cmd+Shift+G` | hull 扩张 + 节点弹散, 180ms | hull 直接消失 |
| 7 | Evidence Granules | 新证据 | 颗粒飘出 ≤24px, 320ms | border 单次脉冲 |
| 8 | Signal Edge Pulse | 边数据流 | stroke-dashoffset, ≤400ms | 边变粗 1px, 120ms |
| 9 | Semantic Zoom | wheel / pinch | crossfade 内容, 120ms | 离散 step, 无 crossfade |
| 10 | Auto-layout Morph | Tidy / 新节点 / mode 切换 | 多节点同步, ≤400ms | 跳变 + 80ms opacity flicker |

## 兼容矩阵
见 `workflows/living-canvas-interaction.md` "Pattern × Layout Mode 兼容矩阵"。
