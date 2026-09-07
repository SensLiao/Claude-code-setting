---
description: General-purpose DURABLE planning — clarify a task of ANY kind (code / docs / research / ops / content), write a self-contained plan to .goals/plans/<slug>.plan.md so you can /clear and resume cold, then render a plan card. General (not code-only) unlike /prp-plan, durable (落盘) unlike /plan. Pairs with /lite-execute.
argument-hint: <task description>
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion
---

# /lite-plan — durable, general-purpose planning (plan → /clear → execute)

Turn a task of ANY kind into a small, self-contained plan written to disk, so the conversation can be
`/clear`ed and the work resumed cold in a fresh session via `/lite-execute`. The on-disk plan is what
survives the context reset — that is the whole point.

## When to use this (vs the alternatives)

| Want | Use |
|---|---|
| **Any task, planned durably, executed after `/clear`** (code OR docs / research / ops / content) | **`/lite-plan` → `/clear` → `/lite-execute`** ← this |
| Quick conversational plan you'll execute immediately (no `/clear`, no artifact) | `/plan` |
| Single-pass CODING feature needing deep codebase pattern extraction | `/prp-plan` → `/prp-implement` |

If the task is a 1–3 line fix, skip planning — just do it.

## Process

### 1. Resolve where the plan goes
- Repo root: `git rev-parse --show-toplevel` (fallback: cwd). Plans live in `<root>/.goals/plans/`.
- `mkdir -p <root>/.goals/plans`.
- slug = kebab-case of a short title (e.g. `migrate-auth-cookies`). File = `<root>/.goals/plans/<slug>.plan.md`.

### 2. Restate the goal in ONE line
What is being achieved, and why it matters. If you can't state it in one line, the task isn't clear enough yet.

### 3. Ambiguity gate — ask only if genuinely blocked
If the deliverable is vague, success is undefined, or there are multiple valid interpretations → ask 1–3
sharp questions via AskUserQuestion BEFORE writing the plan. Do NOT guess. If a question can be answered by
reading a file / running a command yourself, do that instead of asking the user.

### 4. Gather just-enough resume context
Collect only what a FRESH session (zero memory of this conversation) needs to start without re-discovery:
key files / links / prior decisions / constraints. This is generic context — NOT a codebase pattern dump
(that is `/prp-plan`'s job). Keep it tight.

### 5. Classify complexity
Tag 简单 / 中等 / 复杂 (CLAUDE.md §0.6 taxonomy) — it tells `/lite-execute` how much ceremony to apply.

### 6. Write the plan file
Write `<root>/.goals/plans/<slug>.plan.md` using the template below. Fill every section honestly; write
"N/A" rather than skipping. Use the real current date (absolute, e.g. 2026-06-30). Record `base_commit`
(`git rev-parse HEAD`) + `base_branch` (`git rev-parse --abbrev-ref HEAD`) into the metadata — `N/A` if not
a git repo — so `/lite-execute` can detect a plan that went stale before it runs.

### 7. Render the plan card + hand off
Show the user a compact plan-preview card (CLAUDE.md §0.6) reflecting the file, then tell them:

> Plan saved to `.goals/plans/<slug>.plan.md`. Review it, then `/clear` and run `/lite-execute <slug>`
> (or just `/lite-execute` to pick the most recent plan).

Do NOT start executing — `/lite-plan` only plans. Execution is a separate, post-`/clear` step.

## Plan template (deliberately NOT code-shaped)

```markdown
# Plan: <title>

- **slug**: <slug>
- **created**: <absolute date>
- **complexity**: 简单 | 中等 | 复杂
- **status**: planned
- **base_commit**: <sha, or N/A>
- **base_branch**: <branch>

## Goal (one line)
<what + why, in one sentence>

## Why / value
<who benefits, what changes>

## Context to resume cold
<key files / links / prior decisions / constraints — enough that a fresh session needs no re-discovery>

## Constraints / Out-of-scope
- <constraint>
- OUT: <explicitly not doing>

## Steps
- [ ] 1. <task-agnostic step — e.g. "draft section X" / "run experiment Y" / "edit config Z">
- [ ] 2. ...
- [ ] 3. ...

## Acceptance (done = ?)
<task-defined checks. Code: "tsc clean + tests green". Docs: "reviewed, links valid". Research: "result
reproduces". Whatever proves THIS task is actually finished — do NOT hardcode coding checks.>

## Resume pointer
当前指针: <the single next concrete action>

## Notes
<anything else worth carrying across the /clear>
```

## Notes
- The plan file doubles as the durable progress tracker — `/lite-execute` checks off steps in-place.
- `.goals/` is local-only by convention (gitignored). If you want a plan committed for teammates, move it
  to a tracked path and say so.
- This is instruction-layer — there is no enforcement hook behind it. The discipline is the
  loop itself: plan 落盘 → `/clear` → execute reads disk.
