# Style-Lens Registry — 统一 Style-DNA + 3 层 token 契约

> 加入 2026-06-14（IMPROVEMENT-PLAN P2-2）。把"实际只有 taste 一种能稳定自动产出"的风格层,扩成 **6 个统一格式的 Style-DNA lens**,跑在 **3 层 token 契约**上。
> **关键(additive,非 rip-out)**:本 registry 是 PICK 阶段的**风格词汇 + Style-DNA 来源**;L3 **互斥仍按现有 3 family enum**(`taste | luxury | brutalist`)运作 —— `uiux-style-mutex-guard.js`(lock-presence-keyed)、`catalog.json` mutex_groups、旧 `style-lock.yaml` **全部不变**。每个 lens 声明它锁哪个 `mutex_l3_family`;PICK 锁定时写 `l3_style=<family>` + `active_lens=<lens_id>`。
> Provenance(本地):`reference/articles/{klim-type-craft,comeau-designing-shadows,emil-great-animations,refactoring-ui-tactics,premium-ui-stripe-linear-vercel,bradfrost-themeable-design-systems,z-image-style-system}.md`；`reference/repos/{awesome-claude-design,styleseed,impeccable,awesome-design-md,system-prompts-and-models-of-ai-tools}`。

---

## 1. 3 层 token 契约（写进 chassis；组件只消费 semantic 层）

```
primitive（原始值，如 --gray-950: #0A0A0B）
  → semantic（意图层，如 --color-action-primary / --surface-page；组件只消费这层）
    → component（按需覆盖）
```

**硬规则**（借 Lovable 泄露提示，`system-prompts…`）:**禁止组件直接写色值类或直接消费 primitive,一律走 semantic token** —— 防跨 surface 色彩漂移。这条进 P4 UNIFY token-compliance 扫描（combination-policy §2 P4 已加"组件不直接消费 primitive"）。

---

## 2. 统一 Style-DNA record（每个 lens 一份，字段全一致 → 可换 / 可 lint / 模型被迫全力承诺一种风格）

```yaml
lens_id: <swiss|editorial|dark-editorial|soft-organic|terminal|brutalist>
display_name: <人类可读>
mutex_l3_family: <taste|luxury|brutalist>   # 锁哪个现有 enum(互斥用);PICK 写 l3_style=此值 + active_lens=lens_id
l3_variant_mode: <A|B|C|null>               # 仅当 family==taste 时映射 taste §11 变体
type_dna:
  display_family: <font>
  body_family: <font>                        # 强制双字体,弃单字体撑全身份
  weight_extremes: [<min>, <max>]            # 字重极端(借 Anthropic Cookbook:别都收敛中庸)
  tracking_rules: <按字号调字距>
  banned_fonts: [<该 lens 额外禁用;suite 级禁令见 anti-slop-suite.md>]
color_dna:
  neutral_family: <锁定中性色族>
  single_accent: <one accent token>
  meaning_map: { action: ..., success: ..., danger: ... }
  never: [<如 #000000 纯黑 / #FFFFFF 大面积 / AI-purple>]
space_grid_dna: { base_unit: <4|8>, scale: [...] }
material_dna:
  shadow_palette: <色相匹配分层阴影,never 透明黑（借 Comeau）>
  radius_scale: { card: ..., chip: ..., pill: ... }
  background_atmosphere: <gradient|noise|geometric|mesh|none(+理由)>   # 必填(anti-slop-suite §5)
motion_dna:
  curve: <ease-out 等>
  duration_cap: <ms>
  the_one_moment: <预算砸在哪个编排时刻（借 Emil + StyleSeed motion seed）>
reference_anchors:
  positive: [<1-3 个本地 58 DESIGN.md slug 正例>]
  negative: [<1 个 anti-reference>]
```

taste 的 3 dial(DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY)= **叠在选定 lens 之上的修饰器**,不是独立风格 —— PICK 锁 lens,dial 锁后微调强度。

---

## 3. 6 个 lens（取代"实际只有 taste"）

| lens_id | mutex_l3_family | 取材 | 对应现状 | positive anchors（本地 58 桶） |
|---|---|---|---|---|
| `editorial` | taste (A) | 杂志/暖编辑 | taste MODE A 升格 | notion, claude, linear, vercel |
| `soft-organic` | taste (B) | 暖/柔和/$150k agency | taste MODE B 升格 | airbnb, clay, sanity |
| `swiss` | brutalist | 国际主义/网格精密 | 新(brutalist 的克制亲戚) | vercel, spacex, hashicorp, figma |
| `brutalist` | brutalist | 工业粗野 | 现 brutalist-skill | (brutalist-skill 自带) |
| `terminal` | luxury | dark-tech / developer | 新(本地 Developer Terminal 桶) | warp, supabase, ollama, resend |
| `dark-editorial` | luxury | 暗色奢华(**修正版**) | **取代 luxury 当锁定风格** | linear, bmw, lamborghini, elevenlabs |

> family 三选一仅为**互斥**服务(一个项目内不混 family);lens 才是真正的设计词汇。swiss/terminal 是新 lens,分别挂 brutalist(精密系统)/ luxury(dark)family 做互斥归属。

### 3.1 `dark-editorial`（修正 luxury 的 3 处 AI-tell —— P2-1 核心）

```yaml
lens_id: dark-editorial
mutex_l3_family: luxury
type_dna:
  display_family: Anton | Archivo Expanded   # condensed display
  body_family: Newsreader | Inter Tight       # 双字体!弃 Oswald 单字体撑全身份
  weight_extremes: [300, 800]
  banned_fonts: [Oswald-as-sole-identity]
color_dna:
  neutral_family: 近黑暖灰(--ink-950: #0A0A0B → off-white #F4F2EC)   # 弃纯黑 #000 / 纯白 #FFF
  single_accent: 一个克制金/铜或品牌色
  never: [#000000 纯黑大面积, #FFFFFF 大面积平铺, AI-purple]
material_dna:
  shadow_palette: 暖色相分层(never 透明黑)
  background_atmosphere: gradient(暗渐变) | noise(细噪点)    # 弃纯色平背景
motion_dna: { curve: ease-out, duration_cap: 300, the_one_moment: hero 入场逐行揭示 }   # 借 Emil(luxury 原零运动语言)
reference_anchors: { positive: [linear, bmw, elevenlabs], negative: ["Oswald-on-pure-black AI fashion default"] }
```

> 这 3 处修正正是审计 §3 指出的 luxury 自相矛盾:纯黑(taste 明令永不#000)、Oswald 单字体(fashion tell)、零运动语言。`dark-editorial` 全部修掉。

---

## 4. 怎么 slot 进现有机制（orchestration-first，不破互斥）

1. **PICK 自动选 lens**(combination-policy §2 P2):orchestrator 按 `grounding.md` matched_references + 用户 mood 词,从本 registry **预选 1-3 个 lens 候选** SHOW 给用户挑(EXPLORE 的 N 个方向各对应一个 lens 候选预览,无锁采样)。
2. **锁**(style-lock-policy §1):PICK 选定后写 `l3_style=<lens.mutex_l3_family>` + `active_lens=<lens_id>` + `l3_variant_mode`(family==taste 时)。**mutex 仍按 l3_style family** —— `uiux-style-mutex-guard.js` 不变。
3. **chassis mirror**(chassis-schema):chassis.yaml 加 `active_lens` + `token_tiers`(primitive/semantic/component),仍从 GSD UI-SPEC mirror(Mirror not author 不变)。
4. **BUILD**:在锁定 lens 的 Style-DNA + suite anti-slop 下 fan-out(combination-policy §2 P3)。
5. **routing**(uiux-routing-table Layer 3):mood→lens_id 映射复用 `local-template-index.md` §2 的 9 桶(桶已是 mood 分类)。

---

## 5. 反向兼容（lens_id ↔ 旧 enum 一一映射，可回滚）

旧 `style-lock.yaml` 只有 `l3_style: taste|luxury|brutalist` 没 `active_lens` → 视为:
- `taste` → `editorial`(若 `l3_variant_mode==B` 则 `soft-organic`)
- `luxury` → `dark-editorial`
- `brutalist` → `brutalist`

新增 `active_lens` 是 **additive optional 字段**;不认它的旧工具(mutex guard / catalog)照常按 `l3_style` family 工作。**回滚 = 忽略 registry + active_lens,退回纯 3-enum,零数据丢失。**

---

## 6. 边界

- 本 registry **不改互斥机制**(family enum + lock-presence-keyed guard 不变)、**不进 governed gate**、**不动 GSD**(chassis 仍 mirror GSD UI-SPEC)。
- `luxury/SKILL.md` 文件保留(deprecation banner → 指向 `dark-editorial`),作为 dark-editorial 的 token 出发点之一,不再单独被 PICK 当锁定风格首选。
