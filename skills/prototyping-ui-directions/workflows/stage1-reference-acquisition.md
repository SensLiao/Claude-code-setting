---
name: uiux-stage1-reference-acquisition
description: Stage 1 — 跟用户敲定参考清单，skill 自己跑 git clone / 截图 / 抓 wiki，落到 reference/ 目录。产物：reference/<vendor>/* + reference-manifest.md。
type: workflow
stage: 1
gate: gates/stage1-exit.md
---

# Stage 1 — Reference Acquisition

## 目的

把 Stage 0 的"vibe references"（"看起来像 X"）变成**本地可读源码、可截图、可量化分析的参考素材**。skill 主动 clone / 截图 / 抓 wiki，不再要求用户预先 clone。

## 流程

### Step 1 · 敲定候选清单

跟用户对话（companion `competitive-teardown` 装了就拉它做候选发现）：

```
- 用户已经在 idea brief 里给的"vibe references" → 转成具体 vendor 候选
- skill 主动建议 3-5 个用户没提但可能相关的（注明"补充建议"，不强加）
- 用户从候选里勾选 + 添加自己的 URL
```

**铁律 1**：每个候选必须经过用户**显式同意**才能进入 clone 队列。不允许 skill 自作主张 clone。

### Step 2 · 分类（Tier）

参考 `references/tier-criteria.md`，给每个 reference 打 Tier：

- **Tier A** — 有 GitHub 开源仓库，可 `git clone`
- **Tier B** — 没开源但是可访问网站，做截图 + 抓 marketing/docs 页面
- **Tier C** — 闭源 / 仅 marketing material 可见，做截图 + 用户提供的 case study

### Step 3 · 执行 acquisition

写入位置：`output/<date>-<nickname>/reference/<vendor>/`

| Tier | 怎么搞 | 落到 |
|------|--------|------|
| A | `git clone --depth=1 <url> reference/<vendor>` | `reference/<vendor>/` 全部代码 |
| B | Playwright / 浏览器截图脚本 + 抓 marketing / docs | `reference/<vendor>/screenshots/*.png` + `reference/<vendor>/marketing.md` |
| C | 仅截图 + 用户提供材料 | `reference/<vendor>/screenshots/*.png` + `reference/<vendor>/notes-from-user.md` |

**铁律 2**：clone 用 `--depth=1` 节省空间；clone 失败（私仓 / 限速 / 网络）不要假装成功，写入 manifest "status: failed"，问用户要不要换。

**铁律 3**：每个 vendor 目录下必须有一份 `_lineage.md` 记录：URL / commit / clone 时间 / license（从 LICENSE 文件读）。

### Step 4 · 写 manifest

落到 `output/<date>-<nickname>/reference-manifest.md`：

```markdown
# Reference Manifest — <date>

## Cohort summary
共 N 份 reference：Tier A × n, Tier B × m, Tier C × k

## Tier A
### <vendor>
- repo: <url>
- commit: <hash>
- license: <name>
- 研究意图: (要看它的什么 — "module 视觉分组方式" / "node 编辑器的快捷键" / ...)
- do-not-copy: 品牌色 / 字体 / 独占动效 / ...

### ...

## Tier B / C
... 同样字段，clone 部分换成截图路径 ...

## 失败记录
- <vendor>: status: failed, reason: <403 / private / timeout / ...>, action: <skipped | replaced by Y>
```

## Gate（`gates/stage1-exit.md`）

- [ ] reference-manifest.md 存在，每个 vendor 字段齐全（URL/commit/license/意图/do-not-copy）
- [ ] 每个 Tier A vendor 真的能在本地打开 `_lineage.md`
- [ ] 每个 Tier B/C vendor 有 ≥3 张截图
- [ ] 失败的 reference 已记录原因 + 用户决定（跳过 / 替换）
- [ ] 独立 red-team 签字

## 失败模式

| 症状 | 急救 |
|------|------|
| 候选清单超过 13 个 | 强制 Tier 化 + 让用户选权重；最多保留 8-10 个深入研究，其余降为 light scan |
| 用户希望"参考越多越好" | 拒绝；告诉用户 reference 同权 = 研究失焦；按 Tier 加权 |
| GitHub 限速 | 改用 SSH / 等几分钟 / 用户提供 token；不为速度跳过 license 检查 |
| 私仓无权限 | 不绕过；记 failed，问用户能否提供截图 / 替换公开版 |
