# Heuristic Audit Template — MODE C 产出

> 文件名：`ux-audit-{surface-slug}-{YYYY-MM-DD}.md`
> 落点：`vault/wiki/design-research/ux-audits/`（项目）或 `docs/ux/`（一般项目）

---

```markdown
---
slug: ux-audit-{surface-slug}-{date}
title: UX Audit · {Surface Name} · {date}
type: synthesis
status: active
confidence: high
created: {date}
updated: {date}
related:
  - "[[{surface or prototype slug}]]"
tags: [ux-audit, heuristic, {surface-tag}]
---

# UX Audit · {Surface Name} · {date}

**Audited by**: ux-principles MODE C
**Sources**: NN 10 Heuristics + Laws of UX hit/miss + BFM 5 lens

---

## Section 1 — NN 10 Heuristics

| # | Heuristic | Verdict | Evidence (cite element) | Fix |
|---|---|---|---|---|
| H1 | Visibility of system status | PASS / WARN / FAIL | … | … |
| H2 | Match between system and real world | … | … | … |
| H3 | User control and freedom | … | … | … |
| H4 | Consistency and standards | … | … | … |
| H5 | Error prevention | … | … | … |
| H6 | Recognition rather than recall | … | … | … |
| H7 | Flexibility and efficiency of use | … | … | … |
| H8 | Aesthetic and minimalist design | … | … | … |
| H9 | Recognize / diagnose / recover from errors | … | … | … |
| H10 | Help and documentation | … | … | … |

**Severity Summary**:
- FAIL (must fix before ship): {count} → {list of H#}
- WARN (should fix soon): {count} → {list}
- PASS: {count}

---

## Section 2 — Laws of UX Hit/Miss

| Law | Status | Evidence | Note |
|---|---|---|---|
| Hick's Law | HIT / MISS / N/A | … | … |
| Fitts's Law | … | … | … |
| Miller's Law | … | … | … |
| Doherty Threshold | … | … | … |
| Aesthetic-Usability | … | … | … |
| Jakob's Law | … | … | … |
| Peak-End Rule | … | … | … |
| Tesler's Law | … | … | … |
| Goal-Gradient Effect | … | … | … |
| Pareto Principle | … | … | … |

**Hits**: {count} / **Misses where applicable**: {count}

Target ≥ 4 applicable hits per surface.

---

## Section 3 — Built for Mars 5 Lens Teardown

### Lens 1 — First Impression
**Verdict**: …
**Score**: …/10
**Fix**: …

### Lens 2 — Onboarding Clarity
**Verdict**: …
**Score**: …/10
**Fix**: …

### Lens 3 — Friction Points
**Verdict**: …
**Score**: …/10
**Fix**: …

### Lens 4 — Critical Path Completion
**Verdict**: …
**Score**: …/10
**Fix**: …

### Lens 5 — Polish
**Verdict**: …
**Score**: …/10
**Fix**: …

**BFM Total**: …/50

---

## Section 4 — Decision

**Ship-ready?**
- [ ] All H FAIL fixed
- [ ] Laws hits ≥ 4
- [ ] BFM total ≥ 40/50

**Verdict**: SHIP / FIX-AND-SHIP / REDESIGN

**Top 3 fix priorities**:
1. {H or BFM finding} — {estimated effort}
2. …
3. …

**Open questions for next pass**: …
```

---

## 使用方法

1. 把上面的代码块 copy 进新文件
2. 把 `{...}` 全部替换成实际内容
3. 对应每行写真实的 evidence（要 cite element / class / line），不要写"good" / "OK"
4. Fix 列要 actionable（具体改哪一行 / 哪个数字）
5. 最底 Decision 部分必须给一个 SHIP/FIX/REDESIGN verdict，不允许 ambiguous
