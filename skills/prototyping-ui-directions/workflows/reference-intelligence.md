---
name: uiux-reference-intelligence
description: 通用工具型 sub-skill — 被 Stage 1（clone / 截图）和 Stage 2（提取卡）共用。Tier 化、portability scoring、do-not-copy 清单。
type: workflow-tool
used_by: [stage1-reference-acquisition, stage2-research-analysis]
---

# Reference Intelligence — 通用工具

## 责任边界

- **Stage 1** 调用：决定每个 reference 的 Tier、跑 acquisition、写 manifest
- **Stage 2** 调用：从 reference 素材里抽取 dimension 上的证据

## Tier 定义

参考 `references/tier-criteria.md`。

| Tier | 是什么 | 怎么处理 |
|------|--------|----------|
| A | 开源代码可 clone | `git clone --depth=1` + 写 `_lineage.md` |
| B | 闭源但网站可访问 | Playwright / 浏览器截图 + 抓 marketing/docs |
| C | 闭源且仅 marketing 可见 | 用户提供 + 截图 |

## Portability Scoring（0-10 每维）

- pattern 强度：这个 pattern 是该产品核心交付能力还是装饰
- license 风险：MIT/Apache/BSD 高分；GPL/AGPL/商用低分；写明
- 与本产品 idea 的距离：完全契合高分
- 改造成本：开箱 vs 重写

总分 < 20 → 不进 portability 池，只借 pattern 不借代码。

## Do-Not-Copy 清单（每个 reference 必填）

- 品牌色
- 字体（特别是付费字体）
- 独占动效（专利 / 强识别）
- 文案口吻 / 商标短语

## 输出位置

- Stage 1：写到 `output/<date>-<nick>/reference/<vendor>/_lineage.md` + 加入 manifest
- Stage 2：写到 `output/<date>-<nick>/research/extract-cards/<vendor>.md`

## 执行者

- Stage 1 clone：主线程（小心 git 副作用），量大时 `/codex:rescue`
- Stage 2 提取：每个 vendor 一个 Claude subagent (Task) sonnet，并行；或 `/codex:rescue`
