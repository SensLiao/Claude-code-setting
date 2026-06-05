# Direction Candidate — Template

> Stage 2 收敛产物。每个 direction 一份；落到 `output/<date>-<nick>/research/direction-candidates.md`（一份文档多个 direction），或 `research/directions/<id>.md`（拆分）。

```markdown
# Direction Candidate — <id> — <一句话风格描述>

> 一句话能让人 5 秒判断这个 direction 长什么样、像谁、不像谁。

## Palette
| Token | Value |
|-------|-------|
| color-bg-base | oklch(...) |
| color-bg-raised | oklch(...) |
| color-text-primary | oklch(...) |
| color-text-muted | oklch(...) |
| color-accent | oklch(...) |
| color-accent-on | oklch(...) |
| color-success | oklch(...) |
| color-warn | oklch(...) |
| color-danger | oklch(...) |
| color-info | oklch(...) |
| color-border | oklch(...) |
| color-overlay | oklch(...) |

## Typography
- display: <family + scale>
- text: <family + scale>
- mono: <if needed>
- 字体来源 + license:

## Motion stance
- micro 默认: <ms>
- base 默认: <ms>
- complex 上限: <ms>
- ceiling: 400ms (硬上限)
- effect budget: 每屏 ≤<N>

## Perspective stance
- 主入口 2-3 行描述:
- 用户视角:
- 信息密度: 高 / 中 / 低

## Dimension fit (对照 Stage 0 weight)
| Dimension | Stage 0 weight | 本 direction 处理 |
|-----------|----------------|-------------------|
| Visual | 5 | ... |
| Interaction | 4 | ... |
| Motion | 3 | ... |
| Perspective | 5 | ... |
| Accessibility | 4 | ... |
| Responsive | 3 | ... |

## Borrowing from
- <vendor-a>: 借 ... pattern（在 surface-X 体现）
- <vendor-b>: 借 ... 排版思路（在 index 体现）
- 严格区分 borrow vs copy

## 适合的场景
- ...

## 不适合的场景
- ...

## 跟其他 direction 的核心差异
- 跟 direction-<other-id>: ...
```

## 差异化硬指标（候选集层面）

如果三个 direction 凑出来：
- 全部 palette tone 一样 → 重做
- 全部 density 一样 → 重做
- 全部 motion stance 一样 → 重做
- 全部 perspective stance 一样 → 重做

至少要有 **2 维**真的拉开。
