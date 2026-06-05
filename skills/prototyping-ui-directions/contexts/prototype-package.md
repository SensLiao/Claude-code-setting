# Context — Prototype Package

> Stage 3 加载本 context。

## 这个 context 干什么

把 Stage 2 选定的 N 个 direction 转成 N 个 variant prototype package。每 variant 10-12 个文件。另外出一份 comparison-report.md 给评审人。

## 输出位置

```
output/<date>-<nick>/prototypes/
  _index.html                   # 总入口画廊
  comparison-report.md          # 横向对比报告（review-ready）
  variant-1/
    index.html  (or index.tsx)
    palette.json
    palette.html
    token-candidates.css
    token-candidates.json
    surface-<a>.{html,tsx}
    surface-<b>.{html,tsx}
    readme.md
    assets/tokens.css
  variant-2/ ...
  variant-N/ ...
```

## 红队约定

- 装了 `taste-skill` → 强制让它跑一次 anti-slop
- 没装 → 主线程按 `references/anti-patterns.md` 自审，并在 user-facing report 里**明确告诉用户"未经独立红队"**

## 验收终点

- 在浏览器里打开 `prototypes/_index.html`（HTML variant）或 `npm run dev`（React variant）
- 用户从这里点进去看每个 variant
- 评审人入口：`comparison-report.md` + `_index.html` 两个文件
- 必须无 console error / 无 broken resource / 无 Lorem ipsum
