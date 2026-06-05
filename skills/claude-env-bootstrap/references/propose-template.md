# Relocated from claude-env-bootstrap/SKILL.md — §6.1 PROPOSE 输出格式

### 6.1 输出格式

```markdown
## Bootstrap 方案预览(v2.0.0 selector-engine)

### SCAN 摘要
- 推断: {key derived signals}
- Raw vector: {折叠显示完整向量,可展开}

### ASK 答案
- Q1: ...
- Q2: ...

### 将装的 skills(共 N 个,按 domain 分组)

#### GSD 核心(M 个)
- ★ gsd-spec-phase — selector: workflow_state contains fresh-init
- ★ gsd-plan-phase — selector: workflow_state contains fresh-init
- ...

#### AppSec(K 个)
- ★ appsec-security-orchestrator — selector: risk_surface contains [auth, payment]
- ★ security-app-multitenant — auto-pulled by selector + requires
- ★ security-compliance-payment — selector: payment_signal == true
- ...

#### Discoverability(L 个)
- ★ discoverability-orchestrator — selector: _derived.needs_release_gate
- ★ web-seo — selector: surface contains public-web AND content_type contains marketing-site
- ★ app-aso — selector: distribution contains app-store
- ...

#### UIUX(P 个)
- ★ ux-principles — ui_present
- ★ taste-skill — mutex winner (style_intent == taste)
- ...

### 将装的 rules
- common/* (默认)
- typescript/* (lang contains ts)
- security-appsec.md (appsec-security-orchestrator rules_addon)
- discoverability-l12.md (discoverability-orchestrator rules_addon)

### 将装的 templates
- planning/SECURITY.md
- planning/threat-model-STRIDE.md
- planning/PENTEST-ROE.md (若 Q-pentest = 是)
- discoverability/* (若 discoverability-orchestrator 入选)

### 将装的 agents
- appsec-reviewer (sonnet)
- security-remediation-engineer (sonnet)
- dast-baseline-engineer (sonnet, 若入选)

### 将创建的文件
- `.claude/CLAUDE.md`
- `.claude/manifest.json`(v2 schema,含 selector evidence)
- `.claude/skills/` × N
- `.claude/rules/`
- `.claude/agents/` × K
- `.claude/templates/` × L

### 排除清单(SCAN 检测到但未入选)
- `security-app-llm` — 排除原因: ai_pattern == none
- `web-local-seo` — 排除原因: local_seo_signal == false
- `brutalist-skill` — 排除原因: 用户未点名

确认执行? [Y / 调整清单 / 取消]
```
