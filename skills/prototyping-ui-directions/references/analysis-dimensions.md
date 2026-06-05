# Analysis Dimensions — 通用 UI/UX 分析骨架

> 这是本 skill 的**通用骨架**，不依赖具体产品类型。所有产品都走这六个 dimension；不同产品类型只是权重不同。
> Stage 0 让用户给每个 dimension 打 1-5 分；Stage 2 提取卡 + direction 候选都按权重分配深度。

## 六个 Dimension

### 1. Visual
- **Palette**：主色 / 辅助 / 背景 / 文字 / 状态色 / 边框 / overlay
- **Typography**：display / text / mono 家族，scale，weight
- **Hierarchy**：怎么区分 primary / secondary / tertiary（scale / color / weight / position）
- **Texture & Atmosphere**：纹理 / 噪点 / 玻璃 / 光晕 / grain
- **Layering & Depth**：阴影 / 卡片层 / overlap

### 2. Interaction
- **Action semantics**：核心动作的命名（Create / Duplicate / Delete / Save 等），是否符合用户预期
- **States**：hover / focus / active / disabled / loading / selected 在每个组件上都齐全
- **Keyboard**：是否真的能用键盘走完核心 flow（Tab 顺序 / 快捷键）
- **Selection model**：单选 / 多选 / 范围 / lasso，是否可预测
- **Forgiveness**：undo / cancel / confirm 的可用性

### 3. Motion
- **Duration**：micro / base / complex 三档大概多少 ms
- **Easing**：是 ease-out / ease-in-out / spring 哪一类
- **Where to motion**：哪些场景必须有动效（状态变化 / 模态出现 / 列表重排），哪些不能有
- **Effect budget**：每屏 glow / shimmer / particle 累计
- **Interruptibility**：动画是否可被打断；输入不被冻结
- **Reduced motion**：`prefers-reduced-motion` 是否有合理兜底

### 4. Perspective（信息架构 / 视角）
- **Main entry**：用户第一眼看到什么
- **Navigation model**：顶导 / 侧栏 / 多面板 / 上下文菜单
- **Density vs Focus**：信息密度高（dashboard-like）还是单点聚焦（reader-like）
- **User vantage**：第一人称 / 鸟瞰 / 时间线 / 空间化
- **Surface depth**：是否有 drawer / overlay / modal 等二级层

### 5. Accessibility
- **Color contrast**：WCAG AA 起步（正文 4.5:1，大字 3:1）
- **Focus ring**：可见、可定位、不与品牌色撞
- **Screen reader**：label / role / state 都给到
- **Reduced motion fallback**：见 Motion dimension
- **Keyboard everything**：见 Interaction dimension

### 6. Responsive
- **Breakpoints**：通常 320 / 375 / 768 / 1024 / 1440 / 1920
- **Density switch**：触屏 vs 鼠标的 hit target 差异
- **Layout reflow**：从单列到多列的过渡
- **Hide / Reveal strategy**：哪些 surface 在小屏隐藏，哪些反而上提

## 不同产品类型的典型权重分布（仅供参考，不强制）

| 产品类型 | Visual | Interaction | Motion | Perspective | A11y | Responsive |
|----------|--------|-------------|--------|-------------|------|------------|
| Landing / marketing | 5 | 2 | 4 | 4 | 3 | 5 |
| Dashboard | 3 | 4 | 2 | 5 | 4 | 3 |
| Canvas / editor | 4 | 5 | 5 | 5 | 3 | 2 |
| Mobile-first consumer | 5 | 5 | 4 | 4 | 4 | 5 |
| Internal tool | 2 | 4 | 1 | 5 | 4 | 2 |
| Creative / artistic | 5 | 4 | 5 | 5 | 2 | 3 |
| Game-like | 5 | 5 | 5 | 4 | 2 | 2 |

> 这张表是"先验"，不是硬规则。用户自己拍权重，本表只在用户问"通常怎么分"时给参考。

## Dimension × Stage 怎么用

| Stage | 用 dimension 做什么 |
|-------|---------------------|
| 0 | 让用户给六个 dimension 打权重；这决定后续深度分配 |
| 1 | reference 选型时偏向"在高权重 dimension 上强"的 reference |
| 2 | 提取卡按六个 dimension 分节；direction 候选自评 dimension fit |
| 3 | 每个 variant 的 readme.md 写明"本 variant 在六个 dimension 上各自怎么处理" |
