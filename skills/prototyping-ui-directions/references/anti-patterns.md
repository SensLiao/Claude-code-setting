# Anti-Patterns（必须删除 / 必须拒绝）

> Stage 3 红队的核心 checklist。`taste-skill` 装了就让它跑这套；没装由主线程自审。

## 流程类

- 跨阶段维护可升级的"统一视觉文档 vN"（v2 / v3 / v4 仪式）
- 把所有 reference 同权对待，不做 Tier
- 单页面风格投票（必须 3-screen 比稿）
- 不冻结 direction 候选就开始 variant 生成
- Stage 3 内偷偷加 dimension 而不回 Stage 0 改 brief
- 产物命名带 `v2 / v3` 仪式（只允许 `<date>-<topic>`）

## 命名类

- HTML 文件叫 `page1.html / view2.html` 这种 generic 名字
- variant 叫 `option-a / option-b` 而不是有产品语义的名字
- palette token 用"暖色调"这种话当 token 值（必须给具体 oklch / hex）

## 视觉类

- 默认 card grid + 等距 padding，无层次
- Hero = 居中标题 + gradient blob + 模糊 CTA
- 未改的 Tailwind / shadcn 默认装作完成稿
- 扁平、无 layering、无 hover state
- 通用 gray-on-white 加一种装饰色
- 一种字体走天下、无 deliberate pairing
- 用 Lorem ipsum / 占位词 / "Click me" 当真实文案

## 动效类

- 任何动画 > 500ms
- 动 layout-bound 属性（width / height / top / left / margin / padding / border / font-size）
- 没有 `prefers-reduced-motion` 兜底
- 动画过程中冻结 pointer event / input
- 每屏 glow / shimmer / bloom / particle > 2 处
- 把动效作为产品视觉主调
- 跨 variant 共用同一段 keyframe 但 duration 不一致

## 评审类

- 产出者审自己（必须独立 red-team owner）
- 让 `taste-skill` 当风格制作器（它永远是红队）
- 让 `frontend-design` 在 Stage 0/1 拍方向（它永远在 Stage 3 写 HTML）
- 让 `design-system` 直接覆盖最终 token（它永远是候选输入）
- companion skill 越权当主导

## 输出物类

- variant 之间其实是同一风格换 accent 色（必须真差异化）
- index.html 跟 palette.html 长得一样（index 是产品门面，不是调色板）
- HTML 在浏览器里报 console error 还说"跑通了"
- palette.json 不齐全（必填 token 见 stage3 文档）
- readme.md 不写"不适合的场景"
