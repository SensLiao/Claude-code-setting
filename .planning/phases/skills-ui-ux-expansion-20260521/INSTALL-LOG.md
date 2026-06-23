# INSTALL-LOG: Skills UI/UX Expansion (20260521)

**Date**: 2026-05-21
**Phase**: skills-ui-ux-expansion

---

## 总览

- 文章主表 18 款 → 16 款落地（frontend-design 已装；Anthropic figma skill 上游不存在）
- Anthropic 官方 5 款 → 4 款落地（figma 上游不存在）
- Bonus 3 款 → 3 款落地（含 GStack 安装到 ~/.claude/tools/ 而非 skills/）
- Leonxlnx Taste 套件升级 → 12 个 variant 全部落地（升级自单 SKILL.md）
- 额外补充 → Apple 平台 2 dir（design-system + swiftui，相邻于 ios-hig）

**最终 ~/.claude/skills/ 目录数**：100（原 78 + 新增 22）
**最终 ~/.claude/plugins 已装 plugins**：15 新增 + 3 原有 = 18
**最终 ~/.claude/plugins/marketplaces**：6 新增 + 4 原有 = 10

---

## Wave A — git clone → manual copy（22 dirs）

| Skill | 来源 | 目标 dir | 文件数 | 状态 |
|---|---|---|---|---|
| brand-guidelines | anthropics/skills | ~/.claude/skills/brand-guidelines/ | 2 | ✔ |
| canvas-design | anthropics/skills | ~/.claude/skills/canvas-design/ | 83 | ✔ |
| skill-creator | anthropics/skills | ~/.claude/skills/skill-creator/ | 18 | ✔ |
| theme-factory | anthropics/skills | ~/.claude/skills/theme-factory/ | 13 | ✔ |
| brandkit | Leonxlnx/taste-skill | ~/.claude/skills/brandkit/ | 1 | ✔ |
| brutalist-skill | Leonxlnx/taste-skill | ~/.claude/skills/brutalist-skill/ | 1 | ✔ BETA |
| gpt-tasteskill | Leonxlnx/taste-skill | ~/.claude/skills/gpt-tasteskill/ | 1 | ✔ |
| image-to-code-skill | Leonxlnx/taste-skill | ~/.claude/skills/image-to-code-skill/ | 1 | ✔ |
| imagegen-frontend-mobile | Leonxlnx/taste-skill | ~/.claude/skills/imagegen-frontend-mobile/ | 1 | ✔ |
| imagegen-frontend-web | Leonxlnx/taste-skill | ~/.claude/skills/imagegen-frontend-web/ | 1 | ✔ |
| minimalist-skill | Leonxlnx/taste-skill | ~/.claude/skills/minimalist-skill/ | 1 | ✔ |
| output-skill | Leonxlnx/taste-skill | ~/.claude/skills/output-skill/ | 1 | ✔ |
| redesign-skill | Leonxlnx/taste-skill | ~/.claude/skills/redesign-skill/ | 1 | ✔ |
| soft-skill | Leonxlnx/taste-skill | ~/.claude/skills/soft-skill/ | 1 | ✔ |
| stitch-skill | Leonxlnx/taste-skill | ~/.claude/skills/stitch-skill/ | 2 | ✔ |
| taste-skill | Leonxlnx/taste-skill | ~/.claude/skills/taste-skill/ | 1 | ✔ 升级（备份 .pre-20260521 → ~/.claude/_backup-20260521/）|
| emil-design-eng | emilkowalski/skill | ~/.claude/skills/emil-design-eng/ | 1 | ✔ |
| app-store-screenshots | ParthJadhav/app-store-screenshots | ~/.claude/skills/app-store-screenshots/ | 54 | ✔ |
| apple-ios-hig | rshankras/claude-code-apple-skills | ~/.claude/skills/apple-ios-hig/ | 32 | ✔ |
| apple-design-system | rshankras/claude-code-apple-skills | ~/.claude/skills/apple-design-system/ | 7 | ✔ 额外 |
| apple-swiftui | rshankras/claude-code-apple-skills | ~/.claude/skills/apple-swiftui/ | 11 | ✔ 额外 |
| refactoring-ui | LovroPodobnik/refactoring-ui-skill | ~/.claude/skills/refactoring-ui/ | 6 | ✔ |

---

## Wave C — `claude plugin install` from new marketplaces（15 plugins）

### 6 个新增 marketplaces

| Marketplace 名 | GitHub source |
|---|---|
| bencium-marketplace | bencium/bencium-claude-code-design-skill |
| designer-skills | Owl-Listener/designer-skills |
| interface-design | Dammyjay93/interface-design |
| ui-ux-pro-max-skill | nextlevelbuilder/ui-ux-pro-max-skill |
| frontend-design-pro | claudekit/frontend-design-pro-demo |
| wondelai-skills | wondelai/skills |

### 15 个新 plugin（全部 exit 0）

| Plugin@Marketplace | 版本 | 用途 |
|---|---|---|
| bencium-controlled-ux-designer@bencium-marketplace | 1.0.0 | "Always-ask-first" 严格控制变体 |
| bencium-innovative-ux-designer@bencium-marketplace | 2.0.0 | 大胆创意变体（基于 Anthropic Frontend Designer） |
| design-research@designer-skills | 1.0.0 | 用户研究：personas、empathy maps、journey maps |
| design-systems@designer-skills | 1.0.0 | 设计系统：tokens、spacing、a11y |
| ux-strategy@designer-skills | 1.0.0 | IA、内容策略、user flows、UX 竞品 |
| ui-design@designer-skills | 1.0.0 | 调色板、字体系统、layout grids、视觉层级 |
| interaction-design@designer-skills | 1.0.0 | 微交互、动画原则、state machines |
| prototyping-testing@designer-skills | 1.0.0 | wireframe、可用性、a11y audits |
| design-ops@designer-skills | 1.0.0 | handoff、critique、sprint planning |
| designer-toolkit@designer-skills | 1.0.0 | portfolio、resume、case study |
| visual-critique@designer-skills | 1.0.0 | hierarchy 分析、brand 一致性、/critique-screen 命令 |
| interface-design@interface-design | 2026.2.9.1212 | session 间一致的设计决策（.interface-design/system.md）|
| ui-ux-pro-max@ui-ux-pro-max-skill | 2.5.0 | 67 风格 + 161 调色板 + 57 字体组合 + 161 推理规则 + 99 UX 指南 |
| frontend-design-pro@frontend-design-pro | 1.0.0 | 11 种美学（Swiss/Neumorphism/Glassmorphism/Brutalism/etc）|
| ux-design@wondelai-skills | 1.0.0 | Refactoring UI + iOS HIG + 启发式 + Hooked + Don Norman + 排版 |

---

## 已经预装（不需要再装）

| 已装 | 来源 | 等价文章项 |
|---|---|---|
| frontend-design@claude-plugins-official | Anthropic 官方 | ① Anthropic Frontend Design |
| vercel@claude-plugins-official | Vercel 官方 | ⑧ Vercel Agent Skills（含 web-design-guidelines + react-best-practices + composition-patterns + react-native-skills 等 8 个）|

---

## 不能装 / 跳过的

| 文章提到的 | 原因 | 替代 |
|---|---|---|
| Figma to Code（anthropics/skills figma） | 上游 anthropics/skills/skills/ 下无 figma 子目录 | 用 `vercel:vercel-agent` 或手动 dev tools |
| Anthropic Claude Design（产品） | 是 Anthropic Labs 付费产品，不是 skill | N/A |

---

## Bonus 安装

| Bonus | 位置 | 备注 |
|---|---|---|
| GStack | ~/.claude/tools/gstack/ | CLI workflow（含 agents/、autoplan/、bin/），不是 SKILL，按文章 `git clone` 方式装在 tools 下；如需 PATH 接入请手动 |
| Emil Kowalski | ~/.claude/skills/emil-design-eng/ | ✔ |
| App Store Screenshots | ~/.claude/skills/app-store-screenshots/ | ✔ |
| Luxury (typeui.sh) | ~/.claude/skills/luxury/ | ✔ 手写版（暗色编辑风 + Oswald + 单色调色板）。⚠ typeui.sh CLI 的 `pull luxury` 拉的是错误的 codex 浅色模板，slug 映射坏了；据用户粘贴的页面内容手写为正确的 Luxury 暗色规格。Loaded & triggered by system. |

---

## 安全扫描结果（SECURITY-SCAN）

**扫描范围**：~/.claude/skills/ 内所有 SKILL.md 文件
**扫描时间**：2026-05-21

| 模式 | 命中数 | 备注 |
|---|---|---|
| `ignore previous instructions` / `forget your instructions` / `disregard ...` | 0 | ✔ 全清 |
| `jailbreak` / `sudo override` / `admin mode` / `you are now (unrestricted/admin/root)` | 0 | ✔ 全清 |
| `new system prompt` | 0 | ✔ 全清 |
| `<\|im_start\|>` / `<\|im_end\|>` / `<\|system\|>` 等 IM tag | 0 | ✔ 全清 |
| `curl ... \| sh` / `wget ... \| sh` / `eval(atob(...))` / `powershell -enc` | 0 hits in skills/ | ⚠ 仅在 user 自己的 bash-commands.log 里有正常命令历史，与 skill 内容无关 |

**结论**：26 款新装 / 升级 skill 全部通过 Snyk-style prompt-injection 扫描。无需 quarantine。

---

## 备份位置

- 原始 CLAUDE.md：`~/.claude/_backup-20260521/CLAUDE.md`
- 原始 rules/：`~/.claude/_backup-20260521/rules/`（81 个文件齐全）
- 原 taste-skill：`~/.claude/_backup-20260521/taste-skill.pre-20260521/`

如需回滚：
```powershell
Copy-Item "$HOME\.claude\_backup-20260521\CLAUDE.md" "$HOME\.claude\CLAUDE.md" -Force
Copy-Item "$HOME\.claude\_backup-20260521\rules" "$HOME\.claude\rules" -Recurse -Force
```

---

## 临时 clone 目录（可清理）

`$env:TEMP\skills-clone-20260521\` 含 10 个 clone（apple-skills、wondelai-skills、refactoring-ui-skill、emilkowalski-skill、appstore-screenshots、anthropic-skills、leonxlnx-taste、bencium-ux、designer-skills、interface-design、ui-ux-pro-max-skill、frontend-design-pro-demo、vercel-agent-skills、gstack）。已无依赖，可删。
