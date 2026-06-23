# SPEC: Skills UI/UX Expansion (20260521)

**Phase**: skills-ui-ux-expansion
**Date locked**: 2026-05-21
**Driver**: 用户要求安装文章中提到的 18 款 UI/UX skill + 5 款 Anthropic 官方 + 3 款 bonus，并彻底重构 CLAUDE.md 的前端工作流章节。
**Status**: LOCKED

---

## WHAT this phase delivers

26 款 UI/UX skill 安装 / 验证 / 文档化，并把使用规则落到 3 份核心配置：

1. `~/.claude/CLAUDE.md` — 彻底重构"全局 Skills 能力位"与"前端 N-skill 组合工作流"
2. `~/.claude/rules/common/agents.md` — 补 UI/UX 类 agent 路由
3. `~/.claude/SKILLS-INDEX.md` — 新建 26 款 skill 速查表

---

## 26 款 skill 分类

### 主力 18 款（文章主表）

| # | Skill | 来源 (GitHub) | 已装？ | 安装方式 | 状态 |
|---|---|---|---|---|---|
| 1 | Anthropic Frontend Design (官方) | anthropics/skills (frontend-design) | 旁出 `frontend-design:frontend-design` | `claude plugin` 或 marketplace | TBD |
| 2 | UI/UX Pro Max | nextlevelbuilder/ui-ux-pro-max-skill | ❌ | git clone（marketplace 备份） | 待装 |
| 3 | Taste Skill 套件 | Leonxlnx/taste-skill | ⚠ 已装简版 SKILL.md | `npx skills add` 升级 | 升级 |
| 4 | Interface Design | Dammyjay93/interface-design | ❌ | git clone | 待装 |
| 5 | Frontend Design Pro Demo | claudekit/frontend-design-pro-demo | ❌ | git clone | 待装 |
| 6 | Designer Skills (63 子 skill) | Owl-Listener/designer-skills | ❌ | git clone | 待装 |
| 7 | Bencium UX Designer | bencium/bencium-claude-code-design-skill | ❌ | git clone | 待装 |
| 8 | Vercel Agent Skills | vercel-labs/agent-skills | ❌ | git clone（marketplace） | 待装 |
| 9 | Refactoring UI | LovroPodobnik/refactoring-ui-skill | ❌ | git clone | 待装 |
| 10 | UX Heuristics | wondelai/skills (heuristics) | ❌ | git clone | 待装 |
| 11 | iOS HIG Design | rshankras/claude-code-apple-skills | ❌ | git clone | 待装 |
| 12 | Hooked UX | wondelai/skills (hooked) | ❌ | git clone | 待装 |
| 13 | Design Sprint | wondelai/skills (design-sprint) | ❌ | git clone | 待装 |

### Anthropic 官方 5 款（`npx skills add anthropics/skills --skill X`）

| # | Skill | 已装？ | 状态 |
|---|---|---|---|
| 14 | figma | ❌ | 待装 |
| 15 | theme-factory | ❌ | 待装 |
| 16 | brand-guidelines | ❌ | 待装 |
| 17 | canvas-design | ❌ | 待装 |
| 18 | skill-creator | ❌ | 待装 |

### Bonus 3 款

| # | Skill | 来源 | 已装？ | 安装方式 |
|---|---|---|---|---|
| 19 | Emil Kowalski 动画 | emilkowalski/skill | ❌ | `npx skills add` |
| 20 | App Store Screenshots | ParthJadhav/app-store-screenshots | ❌ | `npx skills add` |
| 21 | GStack (Y Combinator) | garrytan/gstack | ❌ | git clone |

### 已装 / 不再装的（避免冲突）

- `taste-skill` 已装（Leonxlnx 简版 SKILL.md，单文件）→ 用 `npx skills add` 升级到完整套件
- `prototyping-ui-directions` 已装 → 与 UI/UX Pro Max 互补，保留两者
- `anchor-prototype-wave` 已装 → 保留（量产专用）
- `luxury-editorial-site-builder` 已装 → 保留（领域型）
- `ux-principles` 已装 → 保留作为 foundation 层
- `Claude Design` (Anthropic Labs 产品) → **不装**，是付费产品不是 skill

---

## 分工矩阵（哪个 skill 在哪个阶段触发）

| 阶段 | Primary skill | Foundation | 战术 / 审计辅助 |
|---|---|---|---|
| **Discovery / 探索方向** | `prototyping-ui-directions` Stage 0-1 | `ux-principles` MODE A | `Design Sprint` (5天冲刺) |
| **Variant 多方案** | `prototyping-ui-directions` Stage 2-3 / `UI/UX Pro Max` | `ux-principles` MODE A | `Frontend Design Pro Demo` (风格采样) |
| **单页 / 单组件 craft** | `taste-skill` (套件全开) / `frontend-design:frontend-design` | `ux-principles` MODE B | `Bencium UX` / `Interface Design` (一致性) |
| **全 surface 量产** | `anchor-prototype-wave` | — | `theme-factory` + `brand-guidelines` |
| **品牌 landing 特例** | `luxury-editorial-site-builder` | `ux-principles` MODE A | `canvas-design` (海报) |
| **iOS / 原生移动** | `iOS HIG Design` | `ux-principles` | `App Store Screenshots` (素材) |
| **视觉审计 / 修补** | `Refactoring UI` | `ux-principles` MODE C | `UX Heuristics` (NN 10) |
| **可用性审计 (上线前)** | `UX Heuristics` | `ux-principles` MODE C | `GStack` (0-10 评分) |
| **留存与参与度** | `Hooked UX` | — | — |
| **设计研究 / UX 战略** | `Designer Skills` (8 插件 63 子 skill) | — | — |
| **元开发** | `skill-creator` | — | — |
| **Figma 转代码** | `figma` | — | — |
| **动画细节** | `Emil Kowalski 动画` | — | `Anthropic Frontend Design` (动画规则) |
| **技术品质 (a11y / React perf)** | `Vercel Agent Skills` | — | — |

---

## 非目标（OUT OF SCOPE）

- 不安装 Anthropic Claude Design（产品不是 skill）
- 不卸载现有 `taste-skill` / `prototyping-ui-directions` / `anchor-prototype-wave` / `luxury-editorial-site-builder` / `ux-principles` / `frontend-design:frontend-design`
- 不动 GSD 全家桶（67 个）
- 不动 codex-dispatch / grill-with-docs / competitive-teardown / meeting-analyzer / remotion-best-practices
- 不修改 dashboard 项目代码（这是全局配置变更，不是项目代码变更）

---

## 验收标准

1. **安装层**：26 款 skill 中 ≥ 22 款成功安装（git clone 类目标 100%，marketplace plugin 类允许失败但需有兜底 git clone）
2. **安全层**：每个新装 SKILL.md 跑 grep 扫描，0 命中 prompt injection 关键词，或所有命中已审查并白名单化
3. **文档层**：CLAUDE.md / agents.md / SKILLS-INDEX.md 三份文件最终对得上：每款新 skill 都能在至少一份文档里被检索到
4. **回滚层**：`~/.claude/_backup-20260521/` 备份完好
5. **review gate**：CLAUDE.md / agents.md 改动以 **draft** 形式给用户过目，用户 approve 后才真正 Write

---

## 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| `claude plugin` 子命令在当前 CLI 版本不存在 | 18 款里 5 款无法装 | 全部走 git clone 兜底 |
| Snyk 36% prompt injection 概率 | 安全风险 | 每个 SKILL.md 跑 grep；可疑的标记后人工 review |
| `taste-skill` 升级后参数（DESIGN_VARIANCE 等）改变 | 现有项目行为漂移 | 备份现有 SKILL.md，升级后做 diff |
| CLAUDE.md 彻底重构后 GSD-first 规则丢失 | 工作流退化 | 重构方案先 draft，用户 review；保留 GSD-first 硬规则不动 |
| Designer Skills 63 个子 skill 涌入 | 上下文窗口压力 | 装在子目录，靠 trigger word 按需激活，不全部塞 SKILL.md description |

---

## 完成顺序

```
Step 1: SPEC.md (本文件) + INVENTORY.md          [当前]
Step 2: Wave A — git clone 5 个                   [parallel-ready]
Step 3: Wave B — npx skills add 6 个 (5 官方+taste)
Step 4: Wave C — claude plugin add 5 个 (marketplace)
Step 5: Wave D — bonus 3 个
Step 6: Security grep → SECURITY-SCAN.md
Step 7: INSTALL-LOG.md
Step 8: 草稿 CLAUDE.md / agents.md / SKILLS-INDEX.md → 用户 review gate
Step 9: 用户 approve 后正式 Write 到 ~/.claude/
```
