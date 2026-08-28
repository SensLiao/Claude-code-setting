---
description: Update this repo's durable work ledger (.goals/LEDGER.md) — record the current goal, 当前断点, and next step (CLAUDE.md §0.7 layer-2). On-demand human-readable ledger; pairs with the auto machine trail (.harness/runs.jsonl via ledger-autolog hook). Use to checkpoint progress so a /clear or new session can resume.
allowed-tools: Read, Write, Edit, Bash
---

# /ledger — checkpoint durable progress

Maintain `<repo>/.goals/LEDGER.md` — the §0.7 layer-2 durable, human-readable progress ledger — so
cross-session / multi-phase work is always resumable. This is the SEMANTIC layer a hook cannot write
(a hook only records metadata; what was *achieved / 断点 / next* must be written by the model or you).

## Process

1. **Resolve target**: repo root via `git rev-parse --show-toplevel` (fallback: cwd). Target = `<root>/.goals/LEDGER.md`.
2. **If it exists** → Read it. If it contains a one-line redirect to a project-owned tracker (e.g. `STATUS.md`), follow/append THERE instead — never duplicate ledgers.
3. **If missing** → create `.goals/LEDGER.md` with the §0.7 skeleton: `当前指针 (resume here)` / `完成 (done)` / `进行中 (in progress)` / `计划但未做 (planned)` / `待办 (todo)` / `备注 (notes)`.
4. **Update it to reflect NOW**, from THIS session's actual work — read the conversation, do NOT invent:
   - **当前指针**: one line — the next concrete step (so a fresh session resumes instantly).
   - move finished items → `完成` with commit/evidence refs where they exist.
   - record in-progress + blocked items honestly (CLAUDE.md §0.5: done ≠ mockup ≠ not-done).
   - convert relative dates to absolute.
5. **Honesty + scope**: keep it concise + truthful; `.goals/` is local-only by convention (gitignored) — do NOT commit it unless the user explicitly asks.

## 内容规范 (content discipline)

The ledger is a **concise record of high-level 事项** — a resume entrypoint, not a work log.
The test for every line: *does a fresh session need this to resume correctly?* If not, it
doesn't belong here.

- **One item ≈ 1–3 lines, ≤ ~1,000 characters**: what it is / state (完成 · 进行中 · 卡住) / evidence
  ref (commit SHA, file path, test name). Detail lives at the ref, not in the ledger. Measure in
  characters, not lines — a single 17 KB line passes any line count.
- **Write it as a pointer the first time.** Drafting in detail and compressing later guarantees
  every update starts oversized.
- **Belongs**: goals, work-block outcomes, 当前指针 / 断点, blockers, key decisions + 不变量,
  kept background processes, pointers to plans / docs.
- **Does NOT belong (abuse smells)**:
  - pasted logs / diffs / code blocks / error dumps (→ commit message, issue, or docs);
  - per-file or per-tool-call play-by-play of *how* the work was done;
  - full plan copies (plans live in `.goals/plans/` — link them, don't inline);
  - long analysis / design essays (→ docs or ADR, link from here);
  - the same fact restated across multiple blocks.
- When an update genuinely needs that much detail, write it where it belongs and put ONE line +
  a pointer here. `/preclear` Step 2 audits the ledger against this section.
- **Ratchet**: new or rewritten items meet the cap. An existing oversized item is debt — shrink it
  when you next touch it, never let it grow; no dedicated cleanup pass.

## Archive / compaction (when the ledger outgrows itself)

An append-only ledger eventually stops working as a resume entrypoint: the file grows past a
single Read, and old blocks whose headers still say 进行中/待办 mislead fresh sessions into
re-investigating closed work. **Trigger check** — propose archiving when either holds (ask the
user first; never archive silently):

- the file no longer fits in one Read (~25k tokens — judge by `wc -c`, never by line count: one
  oversized line can hold half the file), or
- closed / superseded history blocks dominate (> ~2/3 of blocks).

**Procedure** (archive = move, never delete; git history keeps everything regardless):

1. **Harvest live items first**: scan the blocks about to be archived for still-open backlog
   ideas / conditional to-dos / research queues buried inside them; lift those into a small
   `待办 backlog` section of the main ledger so they don't sink with the history.
2. Move closed/superseded history blocks **verbatim** into `<root>/.goals/LEDGER-archive.md`
   (also append-only; add a dated one-line header per archive pass). The archive only ever
   receives moved-in closed blocks — never continue or edit narrative there.
3. Keep in the main ledger: TL;DR / 当前指针, live blocks, 关键事实 / 不变量 sections, a
   one-line-per-item done/commit index, and a pointer line
   `> 历史块已归档 → .goals/LEDGER-archive.md（YYYY-MM-DD）`.
4. **Safety**: don't archive a block that an open item still references; skip the whole pass if
   another concurrent session may be writing the ledger; the repo's `.goals/` scope convention
   (local-only vs tracked) stays whatever it already is.

## Optional

Show the recent machine trail (auto-logged by the `ledger-autolog` Stop hook):
```
node ~/.claude/orchestrator-runtime/shared/run-ledger.js list --limit 10
```
The machine trail (`.harness/runs.jsonl`) is metadata-only (tools / files / timestamp); this command
writes the human semantic layer on top of it.
