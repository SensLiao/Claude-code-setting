---
name: uiux-living-canvas-interaction
description: Living Canvas 专项核心 — 10 个原创交互 pattern + 六条铁律。所有"细胞分裂式复制 / 吞噬式删除 / 放大看细节 / 缩小看全局 / 自动布局不死板"的创意都收敛在这里。命中条件：用户在做 CaseWorkspace Canvas、Module 视图、Node 编辑、白板式协作、agent 流程编辑器、模拟 / 仿生交互。
type: workflow
stage: 1
parent: living-canvas-pack
siblings:
  - canvas-layout-engine
  - semantic-zoom-system
  - creative-motion-governor
---

# Living Canvas — Interaction Spec

## 责任边界

本 sub-skill **只**定义 10 个核心 pattern。

不做的事：
- 不定义布局算法（→ `canvas-layout-engine.md`）
- 不定义 zoom 层级里的可视内容（→ `semantic-zoom-system.md`）
- 不定义 duration / easing / reduced-motion 兜底（→ `creative-motion-governor.md`）
- 不写实现代码（→ Stage 2 / Stage 3 的 prototype-engineer + frontend-design）

## 六条铁律（违反任意一条立即驳回）

### 铁律 1 · 操作语义必须保持传统

**用户看到的动作名只允许是**：
`Create`, `Duplicate`, `Delete`, `Group`, `Ungroup`, `Move`, `Drag`, `Zoom`, `Select`, `Connect`

**永远不允许出现在 UI 文案里的词**：
`Divide`, `Absorb`, `Mutate`, `Cellulate`, `Phagocytose`, `Mitose`, `Sprout`, `Cleave`

"生命感"是**反馈层**的视觉/动效语言，不是信息架构层的命名。用户菜单里写"Duplicate"，背后的 motion 可以叫 Mitosis，但用户绝不会读到 Mitosis。

### 铁律 2 · 创意只在反馈层，不在信息架构层

可以创新的层：
- 视觉过渡（duplicate 时短暂的 cell-split 动画）
- 微音效（如果产品支持）
- 残影 / 余韵 / 粒子（轻量）
- 边缘脉冲 / 数据流动可视化

不可以创新的层：
- 菜单结构
- keyboard shortcut（必须遵循 Figma / VSCode / macOS 默认期望）
- 选择模型（单选 / 多选 / 范围选 / lasso 必须可预测）
- 复制粘贴的数据语义

### 铁律 3 · 时间短

| 动作 | 上限 | 默认值建议 |
|------|------|------------|
| 微反馈（hover/focus/active） | 150 ms | 100-150 |
| 元素状态切换 | 200 ms | 160 |
| 创建 / 复制 / 删除 | 300 ms | 240 |
| 布局重排 / 组合 / 解组 | 400 ms | 320 |
| 任何动作 | **绝不超过 500 ms** | — |

超过 500 ms 一律判失败。用户感知到"等"就是失败。

### 铁律 4 · `prefers-reduced-motion` 必须支持

每个 pattern 都必须定义两套表现：

- **Full motion**：完整动画
- **Reduced motion fallback**：保留状态变化的因果可读性，但去除装饰性变形 / 粒子 / 边缘脉冲

Reduced fallback 不允许是"跳变"，至少保留 100ms 的 opacity / scale 渐变以维持感知连续性。

### 铁律 5 · 不可阻塞操作

动画**必须**可被打断：

- 用户点 Duplicate 后 100ms 又点 Delete → 不能等 Duplicate 动画跑完才响应 Delete
- 输入框打字时画布动画绝不能让输入丢字
- 任何动画必须有 `cancel()` / `interrupt()` 钩子
- 不允许任何动画过程中冻结 pointer events

### 铁律 6 · 不污染主视觉

Living Canvas 的所有动效都是**系统的运动逻辑**，不是产品的视觉主调。

- 不允许把整个产品做成生物 / 实验海报风
- Glow / Shimmer / Bloom / Particle 累计预算每屏 ≤ 2 处
- 任何"看起来很酷但功能不明"的动效一律删

## 10 个核心 Pattern

每个 pattern 必须按下面 6 字段定义：trigger / visual / motion / data / reduced / non-blocking。

### 1. Seed Create

**trigger**: 用户在画布空白处右键 → New / 拖入新节点 / 快捷键 `N`
**visual**: 节点从 0 透明 + 0.6 scale 渐入，附带极轻的边缘吸光（≤120ms）
**motion**: `opacity 0→1 + scale 0.6→1, ease-out-expo, 240ms`
**data**: 落地时已 commit 到 store，动画失败也不丢数据
**reduced**: 仅 opacity 0→1, 100ms
**non-blocking**: 渐入过程中可以再次右键 / 拖入新节点叠加

### 2. Mitosis Duplicate

**trigger**: 选中节点 + `Ctrl/Cmd + D` / 右键 Duplicate
**visual**: 原节点轻微抖动 80ms，从其右下方"裂"出新节点，两者短暂以一条收缩的光带相连（≤180ms 后断开）
**motion**: 新节点 `scale 0.4→1 + translate(20,20)`，光带 `scaleX 1→0, 180ms`
**data**: 新节点继承所有 prop 但获得新 id；位置由 layout engine 决定（preserve 模式下贴右下方 24px）
**reduced**: 直接复制到右下方 24px，无光带，opacity 0→1
**non-blocking**: Mitosis 期间用户可立即 drag 任一节点

### 3. Absorb Delete

**trigger**: 选中节点 + `Delete` / 右键 Delete
**visual**: 节点向自身中心收缩并褪色，连接它的边像被"吸入"中心点（≤220ms）
**motion**: `scale 1→0 + opacity 1→0, ease-in-cubic, 220ms`；相邻边 `path stroke 渐褪 + endpoint 向中心 lerp`
**data**: 节点和边在 commit 时同步删除；undo 必须恢复**完整连接关系**
**reduced**: scale 1→0.95 + opacity 1→0, 120ms，无边吸入动画
**non-blocking**: Absorb 期间用户可再次 Delete 选中其他节点

### 4. Tissue Group

**trigger**: 多选节点 + `Ctrl/Cmd + G` / 右键 Group
**visual**: 选中节点周围浮出一个 convex hull aura（**不是** axis-aligned rect，**不是** blob），aura 短暂从外向内"包裹"
**motion**: hull 从 1.15× 收缩到 1.0×，opacity 0→0.6, 280ms
**data**: 节点获得 groupId；layout engine 在 Organic 模式下对 group 内节点开启微弱 attractor force
**reduced**: hull 直接显示，无收缩动画
**non-blocking**: 包裹动画进行中可立即移动整个 group

### 5. Membrane Drag-In

**trigger**: 拖一个节点穿过 group 的 hull
**visual**: hull 边缘在节点穿过点处产生一次轻微的"膜形变"（凹陷 ≤6px）+ 一次 60ms 的脉冲
**motion**: SVG path morph，单次脉冲，无重复
**data**: 节点 groupId 在 drop 时才提交（drag 中是 preview）
**reduced**: 只显示 hull 高亮（border opacity 0.6→1），无形变
**non-blocking**: drag 期间任何时候可以 ESC 取消，hull 恢复

### 6. Ungroup Release

**trigger**: 选中 group + `Ctrl/Cmd + Shift + G`
**visual**: hull 向外扩张 + 褪色（180ms），group 内节点轻微"弹散"（位移 ≤8px 随机方向）
**motion**: hull `scale 1→1.1 + opacity 0.6→0, 180ms`；节点 `translate ±8px, ease-out-back, 200ms`
**data**: groupId 清空，attractor force 撤除
**reduced**: hull 直接消失，节点不弹散
**non-blocking**: 弹散过程中可立即重新 Group

### 7. Evidence Granules

**trigger**: 节点获得新证据 / 数据 / 输出
**visual**: 节点边缘短暂浮现 1-3 个小颗粒，从节点边缘飘出 ≤24px 后淡出
**motion**: `translate 0→24px + opacity 1→0, ease-out, 320ms`，颗粒位置基于节点出口侧
**data**: 颗粒数量 = 新增证据条数，上限 3；多余的合并为一个数字徽章
**reduced**: 节点边缘单次脉冲 (border opacity 0.6→1→0.6, 160ms)，无颗粒
**non-blocking**: 颗粒不阻挡 click / hover

### 8. Signal Edge Pulse

**trigger**: 一条边上有数据流动 / 信号传递（agent 执行、消息发送等）
**visual**: 边上有一道 ≤16% 长度的 highlight 沿 path 行进
**motion**: `stroke-dashoffset` 动画沿 path，单次 ≤400ms；高频信号合并为单次脉冲
**data**: 不与节点 store 耦合，纯视觉，可丢失不补帧
**reduced**: 边短暂变粗 1px（120ms），无行进 highlight
**non-blocking**: 不阻挡边的 click / hover / 选择

### 9. Semantic Zoom

**trigger**: 用户 wheel zoom / pinch zoom / 快捷键 `+ / -`
**visual**: 缩放跨过阈值时，节点内容**不是**简单 scale，而是切换不同 detail level（详见 `semantic-zoom-system.md` 的 Z0–Z4 策略）
**motion**: zoom 本身 ease-out-cubic, 200ms；内容切换用 crossfade 120ms
**data**: 每个 Z 层级的内容由组件自己声明，不由 canvas 决定
**reduced**: zoom 改为离散 step（4 档），无 crossfade
**non-blocking**: zoom 过程中可立即拖动画布

### 10. Auto-layout Morph

**trigger**: 触发布局（用户点 "Tidy" / 新节点落地 / mode 切换）
**visual**: 所有受影响节点同步移动到新位置，路径平滑
**motion**: 见 `creative-motion-governor.md`；上限 400ms；用户位置受保护节点（preserve 模式标记）**不动**
**data**: 布局算法由 `canvas-layout-engine.md` 选（Structured / Organic / Preserve）
**reduced**: 跳变到目标位置（仅保留 80ms opacity flicker 提示已重排）
**non-blocking**: 重排期间用户可 drag 任意节点，drag 的节点立即脱离动画

## Pattern × Layout Mode 兼容矩阵

| Pattern | Structured | Organic | Preserve |
|---------|-----------|---------|----------|
| Seed Create | ✅ 落地后立即 dagre/elk 重排 | ✅ 落地后 force tick | ✅ 落在 viewport 中心，不触发重排 |
| Mitosis Duplicate | ✅ 重排时贴近源 | ✅ 受 attractor 拉到源附近 | ✅ 贴源右下 24px |
| Absorb Delete | ✅ 删后重排 | ✅ 力学松弛 | ✅ 不重排 |
| Tissue Group | ⚠️ 谨慎 — group 在结构化布局可能扭曲 | ✅ 最自然 | ✅ |
| Membrane Drag-In | ⚠️ 同上 | ✅ | ✅ |
| Ungroup Release | ✅ | ✅ | ✅ |
| Evidence Granules | ✅ | ✅ | ✅ |
| Signal Edge Pulse | ✅ | ✅ | ✅ |
| Semantic Zoom | ✅ | ✅ | ✅ |
| Auto-layout Morph | ✅ 主战场 | ✅ | ❌ 不允许，违反 Preserve 语义 |

## 出口 artifact

本 sub-skill 完成时必须产出：

- `vault/wiki/synthesis/<date>-living-canvas-interaction-spec.md`（10 pattern 完整 spec）
- `vault/wiki/synthesis/<date>-living-canvas-six-rules.md`（六条铁律的产品化解释）
- 至少 1 份 hi-fi prototype（React + Motion + React Flow），覆盖 Pattern 1-4 + 9（最高优先级 5 件）
- 12-gate 自测：本 sub-skill 出 spec 不算完成，必须能通过 Quality Gate 红队

## 与其他 sub-skill 的握手

| 何时 | 跟谁握手 |
|------|---------|
| pattern 在 Stage 1 立完 | 立即通知 `surface-architecture.md`，让 surface 在 spec 里引用 pattern id 而不是自创交互 |
| pattern 进 Stage 3 闭环 | 调用 `vendored/taste-skill/` 红队 + `vendored/ui-ux-pro-max-skill-pointer.md` 反 slop |
| pattern 落到 Stage 4 package | Visual Composition Package 必须含 5 件 hi-fi prototype；Production Implementation Package 必须含运行时依赖（React Flow / Motion）与 token diff |
| pattern 触发回归测试 | `vendored/ai-regression-testing/` 跑 Playwright 截图基线 + reduced motion 双轨快照 |

## 失败模式

| 症状 | 急救 |
|------|------|
| 一个 surface 自己发明了 Pattern 11 | 立即驳回；要么把这个新 pattern 升级到本文档（需要走 Stage 0 amendment 流程），要么用现有 10 个组合出来 |
| 动画总超时（>500ms） | 检查是不是把 layout morph 跟 mitosis duplicate 串行了——它们应该并行而不是排队 |
| reduced-motion 模式下信息丢失 | 至少要保留状态变化提示（opacity / border / 数字徽章），不许"安静地什么都不显示" |
| 用户反馈"觉得太花" | 走 Pattern × surface 使用矩阵，把高频 surface（MyWorkFocus）的预算压到 ≤2 处 |
