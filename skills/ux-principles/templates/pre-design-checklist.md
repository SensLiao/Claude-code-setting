# Pre-Design Checklist — MODE A 产出

> 在动手画任何 UI 之前 5 分钟内填完。
> 写完贴到 design-brief / prototype writeup / PR description 顶部。

---

```markdown
## Pre-Design Brief · {surface or feature name} · {date}

### 1. 这屏 / 这功能 用户来干什么
（一句话，主谓宾，不要含糊）
…

### 2. 关键用户行为（按频率排）
1. （高频）…
2. （中频）…
3. （低频）…

### 3. 适用 Laws of UX（选 4-6 条，多了等于没选）
- **{law name}**: 怎么应用 → 具体动作
- ...

### 4. 最容易翻车的 NN heuristic（选 3-5 条）
- **{H#}**: 这屏最容易在哪儿犯 → 预防措施
- ...

### 5. 已知反模式（每条都不能犯）
- [ ] 不要 …
- [ ] 不要 …
- [ ] 不要 …

### 6. 视觉契约
（继承哪个 visual chassis / token system / 哪个 surface 的风格）
…

### 7. 出口标准
（什么样算"做完"，要送 audit 通过 + 用户测过 + …）
- [ ] MODE C audit 通过（NN heuristic FAIL = 0；Laws hits ≥ 4；BFM ≥ 40/50）
- [ ] 视觉契约一致
- [ ] empty / loading / error 三态都画了
- [ ] keyboard 可达
- [ ] mobile / 窄屏 fallback 画了
```

---

## 示例（v2 wave 2 — Marketplace 差异化）

```markdown
## Pre-Design Brief · Marketplace Detail Pages (Node / Workflow / SOP / Connector) · 2026-05-14

### 1. 用户做什么
浏览 Marketplace 里某个具体的 capability 商品，决定要不要 install / configure。

### 2. 关键行为
1. （高频）扫描 metadata 判断 fit
2. （高频）看 signature visualization 判断"这是哪类东西"
3. （中频）读 description / 看 used-in cases / scopes
4. （低频）查 version history

### 3. 适用 Laws of UX
- **Jakob's Law**: 像 GitHub Marketplace / Zapier app directory 那样布局（hero + metadata rail + signature viz + details）
- **Hick's Law**: 4 类 chip 顶层导航（不要更多）；详情页操作 ≤ 3 个（primary + 2 secondary）
- **Aesthetic-Usability**: 单色 mono accent，没 secondary 色，没 glass
- **Tesler's Law**: 不让用户填 raw OAuth scope；勾 capability，scope 自动派生
- **Peak-End Rule**: 详情页底部 CTA 不仅 install，要给 "已经在 N 个 case 用" 这种 social proof

### 4. NN 容易翻车
- **H4 Consistency**: 4 类 detail page CTA 不能都叫 "Install"，要根据类型变 verb（Install / Create case from / Attach to / Configure）
- **H8 Aesthetic-Minimalist**: 不要为每类型加装饰，差异化用 signature element 不是用色
- **H2 Real-world Match**: Connector 用"plug"图，不用 abstract triangle

### 5. 反模式
- [ ] 不要 4 个 detail page 长一样只换 H1
- [ ] 不要 5 个 secondary CTA 平铺
- [ ] 不要 hero 用 full-bleed 1320px

### 6. 视觉契约
继承 C5 Base (Inter / 8px radius / hairline / mono #171717 / no glass)，详见 `vault/wiki/design-research/visual-language/2026-05-12-c5-base-v2-product-anchor.md`

### 7. 出口标准
- [ ] 4 类 detail page 互看，3 秒内能分出是哪一类（盖住 H1 也行）
- [ ] BFM Lens 1 ≥ 8/10
- [ ] NN H4 + H8 PASS
- [ ] Laws hits: Jakob + Hick + Aesthetic-Usability + Tesler + Peak-End 全 hit
```

---

## 不允许的反模式

- 不允许把 Pre-Design 跳过直接开画 — 这会撞进"4 个页面看起来一样"的陷阱（2026-05-13 Marketplace wave 教训）
- 不允许选 > 8 条 law — 等于没选
- 不允许"反模式"列没具体例子 — 必须 cite 类似产品的真实 fail
- 不允许 6.「视觉契约」写"待定" — 要么继承现有 chassis，要么明确"新 chassis 需要 user approval"
