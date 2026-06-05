# Chassis Schema

> SKILL.md §5 reference。`.uiux/lock/chassis.yaml` 是 GSD UI-SPEC.md 的机器可读 mirror。

## 1. 设计原则

- **Mirror not author**:本 schema 完全从 GSD UI-SPEC.md 提取,不发明新字段
- **GSD checker 已经把关质量**:`gsd-ui-checker` 已校 max 4 font sizes / 4px spacing / accent reservation,本 schema 不重审
- **drift detection**:lock 写完后,UI-SPEC.md 修改但 lock 未更新 → `uiux-sdk drift.check` 报警

## 2. Schema

```yaml
schema_version: 1.0
locked_at: <ISO8601>
locked_by: "uiux-sdk@2.1.0"   # mirror 写入者
release_tag: <tag>
phase: <gsd phase number>

source:
  type: gsd-ui-phase
  path: .planning/phases/<phase>/<phase>-UI-SPEC.md
  sha256: <hash of source UI-SPEC.md at mirror time>
  mirrored_at: <ISO8601>

design_contract:
  spacing:
    source_section: "## Spacing"
    raw_excerpt: |
      <markdown excerpt under the section>
    scale: [4, 8, 12, 16, 24, 32, 48, 64]   # extracted if numeric list found
    base_unit: 4
    notes: <any non-list content>

  typography:
    source_section: "## Typography"
    raw_excerpt: |
      <markdown excerpt>
    font_families:
      - <name>
    sizes: [<extracted px / rem / clamp values>]
    weights: [<numeric weights>]
    distinct_size_count: <int>     # GSD checker enforces ≤ 4
    notes: <...>

  color:
    source_section: "## Color"
    raw_excerpt: |
      <markdown excerpt>
    palette:
      dominant: <token / hex>
      secondary: <token / hex>
      accent: <token / hex>
    accent_reserved_for: <text>    # GSD checker enforces specific reservation
    mode: light | dark | both
    notes: <...>

  copywriting:
    source_section: "## Copywriting" | "## Copy"
    raw_excerpt: |
      <markdown excerpt>
    ctas: [<exact CTA strings found>]
    empty_states: [<...>]
    error_states: [<...>]
    generic_label_count: <int>     # generic = "Submit" / "OK" / "Cancel" etc.
    notes: <...>

  registry_safety:
    source_section: "## Registry Safety" | "## Third-Party Components"
    raw_excerpt: |
      <markdown excerpt>
    enabled: true | false
    third_party_blocks: [<list of registry / lib names>]
    evidence: [<paths or notes>]
    notes: <...>

validation:
  required_sections_present: true
  missing_sections: []
  warnings: []                     # informational; not block
```

## 3. Extraction Rules

`uiux-sdk mirror.gsd-ui-spec <phase> <release-tag>` 做以下提取:

| 字段 | 提取方法 |
|---|---|
| `source.path` | Glob `.planning/phases/<phase>*/<phase>*-UI-SPEC.md`,取第一个 |
| `source.sha256` | `sha256sum` 文件内容 |
| `*.source_section` | 找 `^## Spacing` / `^## Typography` / `^## Color` / `^## Copy(?:writing)?` / `^## Registry Safety` / `^## Third-Party` |
| `*.raw_excerpt` | 该 `##` 标题到下一个同级 `##` 之间的内容 |
| `spacing.scale` | 段内匹配 `\[\s*\d+(?:\s*,\s*\d+)+\s*\]` 或纯数字列表 |
| `typography.font_families` | 匹配 `font[-_ ]?family[:\s]+<name>` 或显式 backtick code |
| `typography.sizes` | 匹配 `\d+(?:px|rem|em|pt)` 或 `clamp\(.+?\)` |
| `typography.distinct_size_count` | sizes array 去重后长度 |
| `color.palette.*` | 匹配 `dominant\s*[:\=]\s*<token>` / 同理 secondary / accent |
| `copywriting.ctas` | 匹配段内 backtick CTA `\`<text>\`` 或 list items |
| `copywriting.generic_label_count` | count CTAs ∈ {"Submit","OK","Cancel","Save","Confirm","Done","Yes","No"} |

## 4. Required Sections

mirror 失败条件(exit 2):

| 缺失 | 原因 |
|---|---|
| 整个 UI-SPEC.md 文件 | `gsd-ui-phase` 未跑 |
| `## Spacing` | GSD checker 应已拒,本 mirror 复核 |
| `## Typography` | 同上 |
| `## Color` | 同上 |
| `## Copywriting` | 同上 |

`## Registry Safety` 是**条件 required**:仅当 UI-SPEC 含 shadcn / 第三方 registry 引用时必填(`gsd-ui-checker` 的 third-party safety gate)。

## 5. Drift Detection

`uiux-sdk drift.check <release-tag>`:

1. 读 `.uiux/lock/chassis.yaml.source.sha256`
2. 重算当前 UI-SPEC.md 的 sha256
3. 不一致 → exit 2,提示用户重跑 `uiux-sdk mirror.gsd-ui-spec`

mid-release UI-SPEC 修改但未重新 mirror = "chassis drift",这是 plan-execute 阶段的常见 bug 来源。

## 6. 与 GSD `gsd-ui-checker` 的关系

| 校验 | 谁负责 |
|---|---|
| `## Spacing` values are multiples of 4 | `gsd-ui-checker`(BLOCK if fail) |
| typography 最多 4 个 distinct sizes | `gsd-ui-checker` |
| accent color not "reserved for all interactive elements" | `gsd-ui-checker` |
| CTA labels not generic | `gsd-ui-checker`(BLOCK if too many generic) |
| third-party registry blocks have safety evidence | `gsd-ui-checker` |
| **UI-SPEC sections exist + mirror to chassis.yaml** | **本 sdk(mirror.gsd-ui-spec)** |
| **chassis.yaml drift from UI-SPEC** | **本 sdk(drift.check)** |

**铁律**:本 sdk **不重做** `gsd-ui-checker` 的质量审核。我们 trust GSD checker 的结论;如果 UI-SPEC 通过了 checker,本 mirror 就 mirror。
