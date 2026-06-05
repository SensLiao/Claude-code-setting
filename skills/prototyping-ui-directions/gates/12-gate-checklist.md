# Sample Quality Gates (Stage 3 内每个 variant 走的 checklist)

> 这是 Stage 3 内**每个 variant 的 HTML 必须打勾**的快速 checklist。`taste-skill` 装了就让它跑这套；没装由主线程自审。
>
> 与 stage-level exit gate 不同 — 这套是 per-variant 的快速过。

## 1. Semantic HTML
- [ ] 用 `<header> <main> <nav> <section> <article> <footer>` 等语义标签
- [ ] heading 层级合理（h1 → h2 → h3）
- [ ] 不用 div 套一切

## 2. Keyboard navigation
- [ ] Tab 顺序合理
- [ ] 关键动作能用键盘触发
- [ ] 没有 `tabindex="-1"` 的核心控件

## 3. Focus management
- [ ] 焦点环可见（不删 outline 又不补样式）
- [ ] 不与品牌色撞色

## 4. Screen reader
- [ ] 按钮 / 链接有可读名
- [ ] icon-only 控件给 aria-label
- [ ] form 控件 label 关联

## 5. Color contrast
- [ ] 正文 ≥ 4.5:1（WCAG AA）
- [ ] 大字（≥18px / ≥14px bold）≥ 3:1
- [ ] 状态色不只用色相，还有图标 / 文字辅助

## 6. Reduced motion
- [ ] `prefers-reduced-motion: reduce` 媒体查询里给所有动效兜底
- [ ] 兜底不是"什么都不显示"，至少保留 opacity / 状态指示

## 7. Responsive breakpoints
- [ ] 至少在 320 / 768 / 1024 / 1440 不 overflow / 不堆叠错位
- [ ] 触屏 hit target ≥ 44×44

## 8. Theme（若 variant 声明双轨）
- [ ] dark / light 都自洽
- [ ] 不是单轨用 invert 凑

## 9. No broken resource
- [ ] 字体 CDN / 图标 / 图片全部加载成功
- [ ] 无 console 404

## 10. Animation discipline
- [ ] 任何动画 ≤ 500ms
- [ ] 只动 `transform / opacity / clip-path / filter`
- [ ] 不动 width / height / top / left / margin / padding / border / font-size

## 11. Interruptibility
- [ ] 任何动画可 cancel
- [ ] 动画过程不冻结 pointer event / input

## 12. Anti-slop
- [ ] 不是默认 card grid + 居中 hero + gradient blob
- [ ] 不用 Lorem ipsum
- [ ] 调色板不是 gray-on-white + 一种 accent
- [ ] 有意识的层次（scale / color / weight 至少一项有梯度）
- [ ] 装了 `taste-skill` 就让它跑一遍
