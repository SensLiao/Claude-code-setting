# Trigger-Accuracy Rules — reference

> Owned by `i2r-skill-quality-mode`. Governs how to write and test `description` + `when_to_use`
> frontmatter so auto-invocation fires correctly. Source: Anthropic skill-creator pattern.

---

## Why trigger accuracy matters

An i2r-* skill only adds value if the hosting agent actually loads it at the right moment. Too sensitive: it fires on unrelated tasks, wasting context. Too narrow: it silently skips the cases it was built to catch. The `description` and `when_to_use` fields are the auto-invocation signal — they must be precise.

---

## Writing `description`

**Rules:**
1. State the skill's **discriminating action** in the first clause — the thing only this skill does.
2. Name the I2R stage or artifact it touches (e.g., "during intake", "on NFR fields", "at review").
3. End with "Internal I2R authoring mode." so it is not mistaken for a user-facing skill.
4. Keep it to one sentence, ≤ 20 words before "Internal I2R authoring mode."

**Good example:**
> Elicits past-behavior evidence and surfaces riskiest assumptions during I2R intake and context analysis. Internal I2R authoring mode.

**Bad examples:**
- Too vague: "Helps with requirements." — fires on any requirements-adjacent task
- Too broad: "Elicitation and analysis mode." — no stage anchor, fires on non-I2R analysis
- Too narrow: "Runs only when Mom Test is mentioned." — misses valid triggers

---

## Writing `when_to_use`

**Rules:**
1. Name the specific I2R agent(s) that should load this skill (e.g., `i2r-intake-clarifier`, `i2r-context-analyst`).
2. Describe the **signal** that indicates the skill is needed — not the task category, the observable event.
3. Use concrete nouns: stage file names, schema fields, defect classes. Avoid "when doing analysis."

**Good example:**
> When `i2r-intake-clarifier` or `i2r-context-analyst` is processing a raw idea and needs to separate STATED evidence from ASSUMED generics before writing `01-intake.json` or `02-context.json`.

**Bad example:**
> When the agent needs to gather requirements. ← no stage anchor, no observable signal

---

## Trigger-test file format

Each skill has a test file at `evals/trigger-tests/<skill-name>.yaml`:

```yaml
skill: i2r-elicitation-mode
should_trigger:
  - "I need to interview a founder about their idea for a customer-support tool"
  - "The raw idea mentions 'users' without specifying who they are"
  - "intake-clarifier is about to write 01-intake.json from a vague brief"
  # ... 10 total
should_not_trigger:
  - "Write the functional requirements for AUTH-01"
  - "Run gate.check on the assembled requirements"
  - "Generate the PRD.md from requirements.json"
  # ... 10 total
```

---

## Pass threshold

| Category | Required |
|---|---|
| should_trigger fires | ≥ 9 of 10 |
| should_not_trigger silent | ≥ 9 of 10 (fires ≤ 1 of 10) |

Measured by checking whether the skill name appears in the agent's `_meta.skills_used` array for each test prompt.

---

## Near-miss should-NOT-trigger patterns (anti-patterns)

These are prompts that superficially resemble the skill's domain but must NOT fire:

| Looks like | Correct non-trigger reason |
|---|---|
| "Analyze the user's feedback on the product" | Product feedback analysis ≠ I2R intake elicitation |
| "What are the NFRs for a banking app in general?" | General knowledge query ≠ I2R run-specific NFR authoring |
| "Review this PRD I wrote outside I2R" | External PRD review ≠ I2R stage processing |
| "Help me write acceptance tests in code" | Test code ≠ acceptance criterion authoring (WHAT/WHY boundary) |
| "Do Mom Test interview training" | General training ≠ I2R intake artifact production |

---

## Iteration guide

If a skill fails trigger tests:

1. **Fires too broadly:** narrow `description` to name the specific I2R stage or artifact. Add "Internal I2R authoring mode." if missing.
2. **Fires too rarely:** ensure `when_to_use` names the actual agent and the observable signal (stage file, schema field), not just the task type.
3. **Near-misses fire:** add a discriminating clause that distinguishes I2R artifact production from general analysis (e.g., "when writing to `01-intake.json`").
4. Rerun Stage 3 and Stage 6 of the evals pipeline after each edit.
