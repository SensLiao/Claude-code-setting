# Reference Tier Package — Template

> 每个 reference 一份单独的卡（如果不走 manifest 单文件）。文件命名：`<date>-<vendor>-tier<A|B|C>.md`。

## Identity
- **Vendor**: <name>
- **Tier**: A / B / C
- **Location**: <local path or URL>
- **License**: <name + 是否兼容>
- **Acquired at**: ISO-8601
- **Acquired by**: <executor>

## What pattern to study
- pattern 1: ...
- pattern 2: ...

## What NOT to copy (Do-Not-Copy)
- 品牌色 / 字体 / 独占动效 / 专利组件 / ...

## Portability Score（0-10 per dim）
- pattern 强度: __ / 10
- license 风险: __ / 10
- 与本产品 idea 的距离: __ / 10
- 改造成本: __ / 10
- **总分**: __ / 40

## Lineage 注释模板（仅 Tier A）
```
// Adapted from <vendor> <relative-path> @<commit>
// Modified for <reason>
```

## Owner
- author: <agent id>
- red_team: <独立 owner>
- approved_at: ISO-8601
