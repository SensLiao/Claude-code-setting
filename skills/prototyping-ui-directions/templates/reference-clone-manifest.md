# Reference Manifest — Template

> Stage 1 产物。落到 `output/<date>-<nick>/reference-manifest.md`。

```markdown
# Reference Manifest — <YYYY-MM-DD>

## Cohort summary
- 总计 <N> 份 reference
- Tier A: <n>（开源 clone）
- Tier B: <m>（网站截图）
- Tier C: <k>（仅 marketing）
- 失败: <f>

---

## Tier A — 可 clone

### <vendor-name>
- repo: https://github.com/...
- clone path: reference/<vendor-name>/
- commit: <hash>
- license: MIT
- 研究意图: 看它的 [pattern / surface / motion] 怎么做
- portability score: pattern=8, license=10, distance=7, cost=5  → 30/40
- do-not-copy: 品牌色 (#xxxxxx) / 字体 (PaidFont) / 独占动效 (...)

### <vendor-2>
...

---

## Tier B — 网站截图

### <vendor-name>
- url: https://...
- screenshot path: reference/<vendor-name>/screenshots/
- pages captured: [home, dashboard, settings, ...]
- 研究意图: ...
- do-not-copy: ...

---

## Tier C — 仅 marketing

### <vendor-name>
- materials provided by user: <path>
- 研究意图: ...

---

## Failures
| Vendor | Reason | User decision |
|--------|--------|---------------|
| vendor-x | 403 (private repo) | skip |
| vendor-y | rate-limited | retry with token |
```
