# Canvas Archetype

> 节点编辑器 / 白板 / 流程编辑器 / 空间化协作工具的知识库。
>
> Stage 0 用户选"加载 canvas archetype"时被引入主流程；否则休眠在这里不影响主流程。

## 适用产品类型

- 节点流程编辑器（n8n / Dify / LangFlow / Flowise / tldraw / Excalidraw 风格）
- 白板 / 自由画布
- agent 工作面 / pipeline 编辑器
- mind map / 知识图谱编辑器
- workflow designer

**不适用**：
- Dashboard（信息密度 + 数据可视化为主）
- Landing / marketing（线性滚动）
- 表单密集型工具
- 任何"用户主要在线性时间线上操作"的产品

## 这个 archetype 包含

| 文件 | 内容 |
|------|------|
| `interaction.md` | 10 pattern 完整 spec（Seed Create / Mitosis Duplicate / Absorb Delete / Tissue Group / Membrane Drag-In / Ungroup Release / Evidence Granules / Signal Edge Pulse / Semantic Zoom / Auto-layout Morph） + 6 铁律 |
| `patterns-index.md` | 10 pattern 索引（方便 cross-link） |
| `six-rules.md` | 6 铁律的 gate 形式（红队 checklist） |
| `layout-engines.md` | Structured / Organic / Preserve 三模式布局编排（dagre / d3-hierarchy / elk / d3-force） |
| `layout-engines-ref.md` | layout 库的具体实现注释 |
| `semantic-zoom.md` | Z0–Z4 五层缩放策略 |
| `motion-governor.md` | duration / transform-only / interruptibility / reduced-motion / effect budget 治理 |
| `motion-tokens.md` | 该 archetype 推荐的动效 token |

## 六条铁律（速查）

1. **操作语义保持传统** — 用户菜单只允许 Create/Duplicate/Delete/Group/Move/Zoom 等标准词，**不准** Divide/Absorb/Mutate 等自嗨词
2. **创意只在反馈层** — 视觉过渡可以创新；keyboard / 信息架构 / 选择模型必须可预测
3. **时间短** — micro 150-300ms / 复杂 ≤400ms / 硬上限 500ms
4. **`prefers-reduced-motion` 必须兜底** — 每个 pattern 双轨表现
5. **不可阻塞操作** — 动画可 cancel；不冻结 pointer event / input
6. **不污染主视觉** — glow/shimmer/bloom 每屏 ≤2 处；不把产品做成生物海报

## Dimension 权重先验

| Dimension | 典型权重 | 备注 |
|-----------|---------|------|
| Visual | 4 | hull / aura / 边的视觉 |
| Interaction | 5 | pattern 密集，必须严谨 |
| Motion | 5 | 全 archetype 的灵魂 |
| Perspective | 5 | zoom + 空间化是核心 |
| Accessibility | 3 | 键盘操作复杂，至少基础 a11y |
| Responsive | 2 | canvas 类天然桌面优先 |

> 这是先验，用户可在 Stage 0 调整。

## Stage 加载行为

| Stage | 加载本 archetype 后多做什么 |
|-------|----------------------------|
| 0 | dimension 权重建议用先验表打底 |
| 1 | reference 选型推荐：tldraw / Excalidraw / n8n / Dify / Flowise / LangFlow / dagre 示例库 |
| 2 | extract card 多一节"canvas pattern observed"；direction 候选必须明确选 layout 模式 + 主 zoom 策略 |
| 3 | variant HTML 中必须至少有一个 canvas surface；红队跑六铁律 + anti-pattern |

## 运行时推荐（不强制）

- **React Flow** (xyflow) — node-based UI
- **Motion** (Framer Motion) — `layout` / `layoutId` / `AnimatePresence`
- **dagre / d3-hierarchy / elk** — auto-layout
- **d3-force + forceCollide** — organic layout

详见 `layout-engines.md`。

## 不允许

- 跨类型套用（把 canvas archetype 拿来做 dashboard / landing）
- 在主流程的 SKILL.md / program-director.md 里硬引用本 archetype
- 把 6 铁律 当成"建议"而不是"红队 gate"
