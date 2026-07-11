---
description: Execute a durable plan written by /lite-plan — reads .goals/plans/<slug>.plan.md in a FRESH context (no arg = most recent plan), works the checklist, checks off steps in-place, verifies against the plan's own Acceptance, updates .goals/LEDGER.md, then reports. The "execute" half of plan → /clear → execute.
argument-hint: "[slug]  (omit to use the most recent plan)"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, TodoWrite
---

# /lite-execute — execute a durable plan from disk

Counterpart to `/lite-plan`. Reads a plan that was written to disk BEFORE a `/clear`, and executes it in
this fresh context — the plan file is the only thing carried across the reset, so trust it and work from it.

## Process

### 1. Resolve the plan
- Repo root: `git rev-parse --show-toplevel` (fallback: cwd). Plans live in `<root>/.goals/plans/`.
- Arg given → `<root>/.goals/plans/<slug>.plan.md`.
- No arg → pick the most recently modified `*.plan.md` in `<root>/.goals/plans/`.
- None found → tell the user to run `/lite-plan <task>` first, then stop.

### 2. Read the whole plan + re-orient
Read the entire file. Echo a short briefing: Goal, complexity, remaining unchecked steps, and the current
Resume pointer. Confirm this is the plan to run (if the user passed a slug or said "continue"/"yes", proceed).

**Staleness preflight (soft, never blocks)**: read `base_commit`. If it resolves and HEAD has moved
(`git diff --name-only <base_commit> HEAD`), warn ⚠ that files in this plan's scope drifted ("plan 基于旧
commit,先核对再跑"), then proceed. If `base_commit` is `N/A` or won't resolve (rebased / other machine),
note it in one line and continue. Steps are prose, so unless they name files this is a coarse "HEAD moved,
touched these files" heads-up — not a precise collision check.

### 3. Set up live tracking (中等 / 复杂 only)
Mirror the plan's Steps into TodoWrite so progress is visible. 简单 plans can skip this.

### 4. Work the checklist
For each unchecked step, in order:
- Do the work, honoring **Constraints / Out-of-scope** — do NOT scope-creep beyond the plan.
- On completion, edit the plan file: flip `- [ ]` → `- [x]` for that step and update the **Resume pointer**
  to the next action. This keeps the file an accurate durable tracker if the session is interrupted again.
- If reality forces a deviation, note WHAT changed and WHY in the plan's Notes, then continue.

### 5. Verify against the plan's own Acceptance
Run whatever the **Acceptance** section declares — it is task-defined. Code → run the stated commands and
show real output. Docs / research / ops → perform the stated check. Do NOT claim done without satisfying it
(CLAUDE.md §0.7 completion gate + hard rule "先验证再声称完成").

### 6. Update the durable ledger
Update `<root>/.goals/LEDGER.md` (§0.7 layer-2): move finished items to 完成, set 当前指针 to the next step
(or "done"). If `.goals/LEDGER.md` redirects to a project-owned tracker, follow that instead. Keep it honest.

### 7. Report (CLAUDE.md §0.5)
Business-first: ① what the task now does / delivers, ② progress (which steps done vs left, can it be seen),
③ what is verified (with evidence) vs blocked. Mark blocked / unverified honestly — done ≠ mockup ≠ not-done.

## Notes
- If the plan is fully checked and Acceptance passes, set `status: done` in the plan file and say so.
- This is execution discipline, not a governed gate — the rigor is: read disk, work the list, verify against
  the plan's own bar, leave a resumable trail.
- Don't run two `/lite-execute` in the same working tree at once — they clobber each other's edits. To run
  plans in parallel, give each its own `git worktree`.
