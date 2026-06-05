# Reference Tier Criteria

> 由 `workflows/reference-intelligence.md` 引用。Stage 1 acquisition 时判定每个 reference 走哪个 Tier。

## Tier A — 开源代码可 clone
- 有公开 GitHub（或同类）仓库
- `git clone --depth=1` 成功
- 有 LICENSE 文件（兼容你的使用意图）
- 必须写 `_lineage.md`（URL / commit / clone 时间 / license）
- 改造时 port 代码必须保留 lineage 注释：
  ```
  // Adapted from <vendor> <relative-path> @<commit>
  // Modified for <reason>
  ```

## Tier B — 闭源但网站可访问
- 没开源仓库，但是产品本身有公开 web 入口（marketing + 试用 + docs）
- 用 Playwright / 浏览器截图脚本抓主页 + 关键 surface
- 抓 docs 页面的 marketing 文案 / 截图
- 不允许直接 inline 把它的 CSS / 字体复制走（只借 pattern）

## Tier C — 闭源且仅 marketing 可见
- 没开源、也访问不到产品（要付费 / 邀请 / 内测）
- 用户提供的 case study / 行业截图
- 仅作为"灵感来源"使用，不允许做代码级借鉴

## Portability Scoring（每维 0-10）

- **Pattern 强度**：这个 pattern 是该产品的核心交付能力还是装饰？核心 10 / 装饰 0
- **License 风险**：MIT/Apache 2.0/BSD = 10；GPL/AGPL = 3；商用 / 不明 = 0
- **与本产品 idea 的距离**：完全契合 10；完全错位 0
- **改造成本**：开箱即用 10；需要重写大半 0

**总分 < 20** → 不进 portability 池；用 Tier B/C 走 pattern 而非代码复用。

## Do-Not-Copy 清单（每个 reference 必填）

- 品牌色 / logo
- 字体（付费字体尤其重要）
- 独占动效 / 专利组件
- 商标级文案口吻
- 行业内强识别的视觉标志

## 失败情况

- clone 失败（403 / 限速 / 私仓）→ 写 manifest "status: failed, reason: ..."，**不绕过 license 检查**，问用户：换一个 / 跳过 / 提供 token
- LICENSE 不兼容 → 标记 Tier A 但 portability 总分自动 0；告诉用户
- 网站墙 → 降级到 Tier C，用用户提供材料
