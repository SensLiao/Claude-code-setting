# Style Lock Policy

> SKILL.md §4 reference。`.uiux/lock/style-lock.yaml` 的写入 / 互斥 / unlock 规则。
> **v2.3 (2026-06-10)**:① 加 EXPLORE 采样例外(§0)——回应"组合 ≠ 打破单选";② 修正 stale 风格名(`minimalist`/`soft`/`gpt-tasteskill` 已并入 `taste §11` 三档变体;`stitch-skill`/`frontend-design-pro`/`frontend-pipeline` 已删)。

## 0. 无锁采样例外（v2.3 核心 — 先读）

调度引擎([combination-policy.md](combination-policy.md))把"多风格"与"单锁定"分开,互不冲突。**关键:`uiux-style-mutex-guard.js` 的判据是 LOCK 是否存在,不是 phase** —— hook 不感知 phase,它只看 `.uiux/lock/style-lock.yaml` 写没写。下表的 phase 列是**相关性说明**(EXPLORE 自然落在无锁窗口),不是 hook 的实际开关:

| Phase（与无锁窗口的相关性） | 多风格? | 写 lock? | mutex-guard 拦截? |
|---|---|---|---|
| **P1 EXPLORE**（lock 尚未写） | ✅ 出 N 个候选(采样) | ❌ 不写 `style-lock.yaml`、不写 `chassis` | ❌ **不拦**(无 lock → 多个 L3 候选 invoke 都放行) |
| **P2 PICK** | ❌ 用户挑定 1 个 | ✅ 此刻才 `lock.style`(写入 lock) | — |
| **P3+ BUILD/UNIFY/REVIEW**（lock 已写） | ❌ 全在唯一锁定 L3 下 | lock 已写 | ✅ 第二个 L3 → exit 2 |

**一句话**:多风格 = **lock 写入前**的采样(允许);单风格 = **lock 写入后**强制(互斥)。lock 未写时同时 render `taste` / `luxury` / `brutalist` 三个**候选预览**不是违规——它们不写 chassis、不调 `lock.style`,所以 hook 看不到 lock 也就不拦。详 combination-policy.md §6。

## 1. Schema

```yaml
schema_version: 1.1
locked_at: <ISO8601>
locked_by: "uiux-sdk@2.1.0" | "uiux-gsd-contract-validator@<git_sha>"
release_tag: <tag>

l3_style: taste | luxury | brutalist            # taste 含 §11 三档变体 A/B/C(语义切换,不是独立 enum)
l3_style_skill_id: <exact skill name>           # 例 taste-skill / luxury / brutalist-skill / luxury-editorial-site-builder
l3_variant_mode: A | B | C | null               # 仅 taste:A=Editorial Monochrome / B=Double-Bezel Agency / C=GSAP Scrollytelling
active_lens: <lens_id> | null                    # v1.2(2026-06-14,additive,optional):Style-Lens registry 选定的 lens(editorial/soft-organic/swiss/brutalist/terminal/dark-editorial)。mutex 仍按 l3_style family;lens 是该 family 下的 Style-DNA 具体化。缺省=按 registry §5 映射推断。详 references/style-lens-registry.md

rationale: |
  <≤ 200 chars,user-confirmed reason for picking this style>

grounding_evidence_path: design/grounding.md                  # P0 GROUND 产物(nullable but expected)
exploration_evidence_path: .uiux/evidence/<tag>/02-exploration.yaml   # P1 EXPLORE 候选 + 用户 PICK 记录(nullable)

excluded_alternatives: [luxury, brutalist]      # PICK 时被排除的候选
locked_until_release: <next-release-tag> | "permanent"
```

## 2. 允许的 L3 候选(全局)

| skill | 触发方式 | 用途 |
|---|---|---|
| `taste-skill` | auto / manual | **默认通用 premium craft**;§11 三档变体(A Editorial Monochrome / B Double-Bezel Agency / C GSAP Scrollytelling)已吸收原 `minimalist`/`soft`/`gpt-taste` 风格,语义切换即可 |
| `luxury` | auto / manual | 暗色编辑 / fashion |
| `luxury-editorial-site-builder` | auto(brand landing) | luxury 的 brand landing 专用 variant |
| `brutalist-skill` | **manual-only** | Swiss / 数据密集 / 工业粗野 |

`luxury` 和 `luxury-editorial-site-builder` 在同一 release_tag 内视为**互相兼容**(同一 family);但不能再混入 `taste-skill` / `brutalist-skill`。

> **Style-Lens registry(2026-06-14,additive)**:上表 4 个候选是 **mutex family**;真正的设计词汇是 `references/style-lens-registry.md` 的 6 个 lens(各声明 `mutex_l3_family`)。PICK 选 lens → 锁对应 family(`taste|luxury|brutalist`)+ 记 `active_lens`。`luxury` family 首选 lens = **`dark-editorial`**(修正版,非裸 `luxury` 的纯黑/Oswald)。互斥机制(family enum + lock-presence-keyed guard)**零变化**。

## 3. 项目级白名单

`.uiux/config.json.allowed_l3_styles` 是项目级过滤:

```json
{ "allowed_l3_styles": ["taste", "luxury", "brutalist"] }
```

- 全局允许 ≠ 本项目允许
- `brutalist` 即使全局是 manual-only,本项目 config 不列也拒
- 空 array `[]` = 不限制(等同列全部)

## 4. Mutex 规则

> **前提**:mutex 只在 **P2 PICK 写 lock 起**生效。P1 EXPLORE 采样不触发(§0)。

| 当前 lock 状态 | 新 invoke 的 style | 行为 |
|---|---|---|
| 无 lock(含 EXPLORE 采样期) | 任一允许的 L3 当**候选预览** | 不写 lock,放行(采样) |
| 无 lock + 用户 PICK | 选中的那个 L3 | 写 lock,放行 |
| lock=`luxury` | `luxury` 或 `luxury-editorial-site-builder` | 放行(同 family) |
| lock=`luxury` | `taste-skill` / `brutalist-skill` | **拒**,exit 2 |
| lock=`taste` | `taste-skill`(任意变体 mode 切换) | 放行 |
| 任何 lock | 同一 L3 重复 invoke | 放行 |

**Workflow skill semantics**(澄清——分两层 enforcement):

| 情况 | SDK `lock.style` | Hook `style-mutex-guard` |
|---|---|---|
| 试图把 workflow skill 当 L3 锁定(`lock.style v0.1.0 redesign-skill`) | **永远拒**,exit 2 | n/a |
| `Skill(redesign-skill)` invoke,无 L3 lock | n/a | **拒**(Case 1):workflow skill 需要先有 style 才能套用 |
| `Skill(redesign-skill)` invoke,已有 L3 lock | n/a | 放行(legitimate workflow on top of locked style) |
| `Skill(anchor-prototype-wave)` invoke,已有 L3 lock | n/a | 放行(production workflow,需要已锁的 style 才能 fan-out) |

**关键**:workflow skill 永远**不能作为 L3 style 本身**(SDK 拒),但 workflow skill 可以在 L3 lock 之后作为合法 production workflow 被 invoke(hook 放行)。

> **两层 enforcement,两个集合(2026-06-10 校正 —— 与 `_uiux-common.js` 对齐)**:
> - **NEVER_LOCKABLE**(§5 全表):永远不能 BE 一个 L3 style。SDK `lock.style` 拒。
> - **BLOCK_BEFORE_LOCK**(§4 Case 1 拦的子集):`redesign-skill` / `frontend-design` / `anchor-prototype-wave` —— 这些是 **post-lock** production workflow,无锁时 hook Case 1 拦("先定 style")。
> - **二者之差 = pre-lock 合法流**:`prototyping-ui-directions`(EXPLORE 采样器)/ `image-to-code-skill`(导入)/ `sens-frontend-design`(提案)—— 它们仍 NEVER_LOCKABLE(不能 BE style),但**无锁时不拦**(combination-policy.md P1 EXPLORE 是无锁窗口)。早先版本把这三个也算进 Case 1 → 会拦掉引擎自己的 EXPLORE 主路径,已修。

## 5. Workflow Blacklist(NEVER_LOCKABLE —— 永远不能作为 L3)

> 此表 = 「不能 BE 一个 L3 style」。是否「无锁时被 Case 1 拦」是另一层,见 §4 上方注(只有标 *post-lock* 的会被拦)。

| skill | 为什么不是 L3 | 无锁时 Case 1 |
|---|---|---|
| `redesign-skill` | workflow:已有 UI → 升级,不是风格 | **拦**(post-lock workflow) |
| `image-to-code-skill` | workflow:截图 → 代码,不是风格 | 放行(pre-lock 导入) |
| `frontend-design@official` | workflow:production React 默认入口 | **拦**(post-lock workflow) |
| `anchor-prototype-wave` | workflow:多 surface 量产 | **拦**(post-lock workflow) |
| `sens-frontend-design` | workflow:3-stage 提案 | 放行(pre-lock 探索) |
| `prototyping-ui-directions` | workflow:P1 EXPLORE 多方向探索器(出候选,不是锁定风格) | 放行(pre-lock 采样) |

## 6. Unlock / Relock 流程

合法场景:用户明确决定整页 redesign / 品牌方向变更。

流程:
1. 用户 explicit prompt:"unlock style for redesign" 或类似(provenance check)
2. 调 `uiux-sdk lock.style <tag> <new-style> --force --reason "<≥ 30 chars>"`
3. sdk 写 `.uiux/design-debt.yaml`(签字 record)
4. 旧 lock 移到 `.uiux/lock/.history/<timestamp>-style-lock.yaml`
5. 新 lock 生效

无 `--force` + `--reason` 的 unlock 调用 → exit 2。

## 7. Provenance Check —— 由 orchestrator prompt 层承担,**不在 hook 内**(2026-06-10 校正)

> **实现现状(写实,不虚构能力)**:`uiux-style-mutex-guard.js` **不做** provenance check,也**不识别**任何 inline marker(grep `uiux-allow` 在 hooks/ + scripts/uiux-sdk.sh = 0 命中)。PreToolUse 阶段拿不到可靠的「这是 user explicit 还是 model auto-invoke」信号 —— 在 hook 里硬判 provenance 会产生假阴/假阳。因此 provenance 判定是 **orchestrator prompt 层**(SKILL.md §4 + 本文件)的策略义务,不是 hook 的机械能力。

**hook 机械上只做两件事**(见 §4 / gsd-bridge-contract.md Step 5):
1. 无锁窗口 → 放行 L3 与 pre-lock 探索流;只拦 post-lock production workflow(BLOCK_BEFORE_LOCK)。
2. 有锁且 invoke 的 L3 属不同 family → exit 2;relock 只认 `uiux-sdk lock.style --force --reason`。

**orchestrator 应执行的 provenance 策略**(prompt 层判断,违反不是 hook 能拦的):

| 触发源 | orchestrator 期望处理 |
|---|---|
| User message 含 explicit skill name(`/luxury` / "use the luxury skill") | 接受为 lock 意图 |
| User message 含 unlock 意图("redesign with brutalist" + 已 lock taste) | 走 §6 unlock 流程(`lock.style --force --reason`) |
| 模型 auto-invoke 但无 user explicit | 不自作主张换已锁 family(若已锁,hook 也会 exit 2 兜底) |
| GSD pipeline orchestrator 在合规 dispatch 中触发 | 接受(lock 由流程写,非 hook;**无** marker 机制) |
| 引擎 P1 EXPLORE 阶段 render 多候选预览 | 采样,不写 lock(§0)——hook 在无锁窗口本就放行 |
