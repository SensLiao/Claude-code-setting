---
description: Pre-/clear self-review ritual — adversarially audit THIS session for gaps / weak spots / unverified claims / uncommitted work, reconcile the durable ledger against git reality (catches stale ledger blocks), then update .goals/LEDGER.md so a fresh session resumes cleanly. Run right before /clear or a context reset. Composes /ledger (does NOT duplicate it).
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# /preclear — self-review + ledger reconcile before clearing

The ritual you run right before `/clear` (or before hitting a context limit): be a **skeptic about
this session**, catch what a normal "done" report glosses over, make the durable ledger tell the
truth, and set a clean resume point. Runs **inline in the main thread** — it reads THIS session's own
conversation, which a spawned subagent does not have. Do NOT fan out.

Posture: **adversarial, not celebratory.** The whole point is to surface what was missed / left weak /
claimed-without-proof. Do not rubber-stamp. Honesty rules apply throughout (CLAUDE.md §0.5: 真能跑 ≠
样片/mockup ≠ 没做完/看不见的后端 — never let something read as more-done than it is).

---

## Step 1 — Adversarial self-review of THIS session

Scan the conversation + working tree and produce a findings list (most important first). Hunt for:

- **Dropped / half-done** — things the user asked for that weren't fully delivered; multi-step work
  stopped mid-way; TODOs opened and never closed.
- **Unverified claims (§4.5 / §0.5)** — anything said to be "done / works / passing / fixed" **without
  terminal / browser / test evidence produced this session**. Flag each one explicitly.
- **Edited-but-not-verified / not-committed** — files changed but never run or tested; work the user
  likely expects committed that is still dirty. Check with `git status --short` + `git diff --stat`.
- **Honesty triage (§0.5)** — for each deliverable, classify 真能跑 / 样片-mockup / 看不见的后端引擎;
  flag anything that could be mistaken for more-complete than it is.
- **Blocked / deferred / parked** — anything BLOCK'd, skipped, or deferred that isn't written down.
- **Undocumented decisions** — choices made this session that a future session would re-litigate if not
  captured.
- **Weak spots** — shortcuts taken, assumptions left unconfirmed, tests skipped, edge cases ignored,
  "should work" reasoning used in place of verification.

If, after an honest pass, there genuinely is nothing → say so plainly. **Do not invent findings**, and
do not hide real ones to look clean.

## Step 2 — Reconcile the ledger against git reality

This is the check that catches a ledger block going stale while the reminder hook stayed satisfied
(the hook only enforces the ledger was *touched*, not that its content is *fresh*).

1. Resolve target: repo root via `git rev-parse --show-toplevel` (fallback: cwd) → `<root>/.goals/LEDGER.md`.
   If it contains a one-line redirect to a project-owned tracker, reconcile THERE instead.
2. Read its **当前指针 / 进行中 / 待办** blocks.
3. Cross-check every active claim against `git log --oneline -20` + `git status --short`:
   - Ledger says **"下一步 = X"** but `git log` shows X already committed → **STALE block**. Flag + fix
     (this is exactly the failure mode this command exists to catch).
   - Ledger says **"done + commit `abc123`"** but that SHA / file isn't present → flag the mismatch.
   - Work done **this session** not yet reflected in the ledger → carry into Step 3.
4. List every discrepancy found (or "ledger matches git — no drift").
5. **Size / staleness-of-structure check**: if the ledger has outgrown a single Read (~>1200
   lines) or closed/superseded blocks dominate it, flag it and **propose** the `/ledger`
   Archive / compaction procedure (see `~/.claude/commands/ledger.md`). Never archive silently —
   it needs the user's go, and must be skipped while another session may be writing the ledger.

## Step 3 — Update the ledger (reuse /ledger)

Perform the `/ledger` process (see `~/.claude/commands/ledger.md`) to write the semantic layer a hook
cannot:

- Move finished items → **完成** with commit / evidence refs.
- Record in-progress + blocked items **honestly** (fold in Step-1 findings + Step-2 stale-block fixes).
- Set **当前指针** = the single next concrete step, so a fresh session resumes with zero thinking.
- **Fold the self-review in**: a real gap from Step 1 becomes a 待办 / 断点 line so it survives the clear
  instead of evaporating with the context.
- Convert relative dates to absolute.
- Scope: `.goals/` is local-only by convention — **do NOT commit it unless the user explicitly asks.**

## Step 4 — Report to the user (§0.5, business-level)

Close with a short, plain-language summary:

1. **自查发现** — N 条 (遗漏 / 薄弱 / 未验证 / 未提交), most-important first — or "无遗漏(已逐项核过)".
2. **对账** — ledger 有没有过期块 / 对不上的地方，改了哪些。
3. **ledger 已更新** — 断点 = 一句话的下一步。
4. **能不能安全 clear** — 直接说"可以 /clear 了"，或列出"clear 前建议先处理的 M 件"（未提交、未验证等）。

---

## Notes

- Composes, does not duplicate: **`/ledger`** owns the ledger-writing mechanics; this command adds the
  adversarial audit + git reconcile in front of it.
- Related but different: **`/save-session`** = heavyweight full-state dump to `~/.claude/session-data/`
  (offer it only if the user wants long-term archival handoff); **`/checkpoint`** = git stash/commit
  points. Neither does the gap-audit — that's this command's job.
- The machine trail (`.harness/runs.jsonl`, auto-written by the `ledger-autolog` Stop hook) is
  metadata-only; `/preclear` writes the human semantic layer on top and sanity-checks it against git.
