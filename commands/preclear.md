---
description: Pre-/clear self-review ritual — adversarially audit THIS session for gaps / weak spots / unverified claims / uncommitted work, reconcile the durable ledger against git reality (catches stale ledger blocks) AND against /ledger's 内容规范 (catches abuse — a ledger must stay a concise record of high-level 事项, not a dump-everything work log), sweep for background servers this session left running, then update .goals/LEDGER.md so a fresh session resumes cleanly. Run right before /clear or a context reset. Composes /ledger (does NOT duplicate it).
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion
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
   - Work done **this session** not yet reflected in the ledger → carry into Step 4.
4. List every discrepancy found (or "ledger matches git — no drift").
5. **Content-discipline check (abuse audit)**: judge the ledger against the 内容规范 section of
   `~/.claude/commands/ledger.md` — it must read as a concise record of high-level 事项, not a
   work log. Flag abuse smells per block: pasted logs / diffs / code blocks, per-file
   play-by-play of how work was done, inlined plan copies, analysis essays, the same fact
   restated across blocks, or any single block sprawling far past its 1–3-line-per-item form.
   Route fixes by weight: light trimming (condense a verbose item back to one line + evidence
   ref) happens in Step 4's ledger update; wholesale compaction of offending blocks reuses the
   `/ledger` Archive procedure (summarize in place, move verbatim detail to
   `LEDGER-archive.md`) — and like archiving, needs the user's go first, never silent.
6. **Size / staleness-of-structure check**: if the ledger has outgrown a single Read (~>1200
   lines) or closed/superseded blocks dominate it, flag it and **propose** the `/ledger`
   Archive / compaction procedure (see `~/.claude/commands/ledger.md`). Never archive silently —
   it needs the user's go, and must be skipped while another session may be writing the ledger.

## Step 3 — Background server / process sweep

`/clear` (or a context reset) drops the visible handle to anything this session left running in the
background — a dev/preview server, a `pm2` process, a file watcher, a tunnel. The next session can't
see them, so they linger: ports stay held, resources leak, and the user forgets they exist. Catch them
now, while this session still remembers starting them — the thing a fresh session cannot do.

1. **Read THIS session first** (preclear's edge): scan the conversation for long-lived processes this
   session launched — anything started with `run_in_background: true`, a trailing `&`, or `start` — with
   an emphasis on servers and watchers: `npm/pnpm/yarn dev`, `vite`, `next dev`, `nuxt dev`, `astro dev`,
   `python -m http.server`, `uvicorn`, `flask run`, `pm2 start`, plus tunnels (`ngrok`, `cloudflared`).
2. **Confirm each is still alive** (started ≠ still running — it may have been stopped already, or died):
   - Claude Code background shells: check the background-task list/status for shells still in a running
     state (a finished / killed shell is already gone — don't report it).
   - Ports: for each port identified, on Windows `netstat -ano | findstr :<port>` then
     `tasklist /fi "pid eq <pid>"`; for pm2 use `pm2 list` (or `pm2 jlist`).
   - Only report processes **this session started or is responsible for** — do NOT sweep every listener
     on the machine, or you risk offering to kill something unrelated the user wants running.
3. **Ask — never auto-kill.** If any session-owned server is still running, list each one (what it is /
   port / how it was started) and ask the user with AskUserQuestion whether to stop it before clearing
   (per-item, or stop-all / keep-all).
   - **Stop** → run the matching teardown: kill the background shell, `pm2 stop <name>`, or
     `taskkill /pid <pid> /f` (kill by the PID that owns the port). Confirm it is actually down.
   - **Keep** → it MUST be folded into the ledger in Step 4 (当前指针 / 备注: `<port> — <server>, PID
     <pid>, started via <cmd>, stop with <teardown>`). A kept server that isn't written down is exactly
     the blind spot this step exists to prevent.
4. Nothing session-owned still running → say so in one line and move on.

## Step 4 — Update the ledger (reuse /ledger)

Perform the `/ledger` process (see `~/.claude/commands/ledger.md`) to write the semantic layer a hook
cannot:

- Move finished items → **完成** with commit / evidence refs.
- Record in-progress + blocked items **honestly** (fold in Step-1 findings + Step-2 stale-block fixes).
- Set **当前指针** = the single next concrete step, so a fresh session resumes with zero thinking.
- **Fold the self-review in**: a real gap from Step 1 becomes a 待办 / 断点 line so it survives the clear
  instead of evaporating with the context.
- **Fold in any kept background server** from Step 3: record it under 当前指针 / 备注 with its port, PID,
  how it was started, and how to stop it — so the next session inherits a live process it can actually see.
- Convert relative dates to absolute.
- Scope: `.goals/` is local-only by convention — **do NOT commit it unless the user explicitly asks.**

## Step 5 — Report to the user (§0.5, business-level)

Close with a short, plain-language summary:

1. **自查发现** — N 条 (遗漏 / 薄弱 / 未验证 / 未提交), most-important first — or "无遗漏(已逐项核过)".
2. **对账** — ledger 有没有过期块 / 对不上的地方 / 内容不规范的块（流水账、贴 log、抄计划），改了哪些。
3. **ledger 已更新** — 断点 = 一句话的下一步。
4. **后台进程** — 本 session 有无仍在跑的 server：关了哪些 / 留了哪些（留的已记进 ledger）；或"无后台常驻进程"。
5. **能不能安全 clear** — 直接说"可以 /clear 了"，或列出"clear 前建议先处理的 M 件"（未提交、未验证、后台 server 等）。

---

## Notes

- Composes, does not duplicate: **`/ledger`** owns the ledger-writing mechanics; this command adds the
  adversarial audit + git reconcile in front of it.
- Related but different: **`/save-session`** = heavyweight full-state dump to `~/.claude/session-data/`
  (offer it only if the user wants long-term archival handoff); **`/checkpoint`** = git stash/commit
  points. Neither does the gap-audit — that's this command's job.
- The machine trail (`.harness/runs.jsonl`, auto-written by the `ledger-autolog` Stop hook) is
  metadata-only; `/preclear` writes the human semantic layer on top and sanity-checks it against git.
