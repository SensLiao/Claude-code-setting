# Relocated from enterprise-qa-testing/SKILL.md — §13.1.1 Bridge 3-stage dispatch chain

### 13.1.1 Bridge skill 3-stage dispatch chain（v3.1 本 skill 自己跑全 chain）

对于 reference agent（`tdd-guide` / `e2e-runner` 等），本 skill **自己**执行 stages (b)(c)(d)：

```
┌─────────────────────────────────────────────────────────────────────┐
│ Stage (a) Caller invokes Skill(enterprise-qa-testing)               │
│   → §6 Step 1 起步                                                  │
└─────────────────┬───────────────────────────────────────────────────┘
                  ↓ enterprise-qa-testing 自己跑剩下 3 个 stage
┌─────────────────────────────────────────────────────────────────────┐
│ Stage (b) Skill(qa-e2e-coverage-gate, args={mode:"prepare_input"})  │
│   → bridge skill 把 QA-language input 翻译为 agent prompt          │
│   → 返回 dispatch_input YAML (flow / roles / browsers / retry)      │
└─────────────────┬───────────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Stage (c) Agent(subagent_type=e2e-runner, prompt=<stage b output>)  │
│   → reference agent 真正跑 Playwright + 输出 trace / report / log   │
└─────────────────┬───────────────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Stage (d) Skill(qa-e2e-coverage-gate, args={mode:"validate_evidence",│
│                  agent_output: <stage c>})                          │
│   → bridge skill 按 §6 acceptance criteria 验收                     │
│   → 返回 PASS / FAIL / BLOCKED + hard-rule violations               │
└─────────────────┬───────────────────────────────────────────────────┘
                  ↓
        bash "$HOME/.claude/scripts/qa-sdk.sh" evidence.append <tag> e2e <stage d output>
                  ↓
              §6 Step 7 evidence_validation.by_layer.e2e
```

**v3.1 自动规避**：本 skill 自己跑 (b)(c)(d)，不会出现"agent stdout 当 evidence 用"。

**禁止反模式**：
- ❌ 跳过 stage (d)，把 agent stdout 直接塞给 evidence-validator
- ❌ 把 stage (b) 和 (d) 合并为一次 Skill 调用（用途不同：input prep vs evidence acceptance）
- ❌ 让 bridge skill 自己调 Agent（bridge skill 的 allowed-tools 不含 Agent，必须本 parent 来调）

**适用 bridge skills**：`qa-test-design-tdd-bridge` (→ `tdd-guide`)、`qa-e2e-coverage-gate` (→ `e2e-runner`)。其他 11 个 owned child skill 是单次 dispatch，按 1-stage Skill 调用即可。
