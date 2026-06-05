# Context — Idea Intake

> Stage 0 加载本 context。

## 这个 context 干什么

跟用户做"模糊 idea → 可执行 brief"的转换。

- 不让用户自己想"我该回答什么"
- 主动问 4-6 个关键问题（见 `workflows/stage0-idea-intake.md` Step 1）
- 让用户给六个 dimension 打权重（默认 3）
- 决定加载 archetype（或不加载）

## 命名规则（output）

- 项目根：`output/<YYYY-MM-DD>-<nickname>/`
- `<nickname>` 是产品昵称（kebab-case），不是版本号
- **不允许** v2 / v3 仪式

## 可选 companion

- `grill-with-docs` 装了 → 推荐拉它做 grilling session 压模糊点
- 没装 → 主线程用 AskUserQuestion 问答兜底
