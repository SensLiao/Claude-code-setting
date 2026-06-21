#!/usr/bin/env node
'use strict'
/**
 * ledger-reminder.js — GLOBAL Stop hook  (CLAUDE.md §0.7 layer-2 "持久账本" 背书).
 *
 * Makes the durable-ledger 坎 deterministic on the default / prompt-only path: if the CURRENT
 * turn did FAN-OUT (Agent/Task/Workflow) and the WHOLE session never touched a `.goals/` or
 * `*LEDGER*` file, block ONCE with a reminder to record the goal/断点 in `<repo>/.goals/LEDGER.md`
 * (the §0.7 fixed entry) + a pointing `project` memory. Fires only on fan-out turns while no ledger
 * was touched, so creating/updating the ledger silences it.
 *
 * Honest scope: enforces that a ledger gets TOUCHED on multi-phase work (presence), NOT that its
 * content is good. Pairs with report-gate.js (§0.7 layer-3) + plan-card-reminder.js (§0.6).
 *
 * Safety posture: PRODUCTIVITY gate, not a security gate — FAILS OPEN on any parse/IO error
 * (never breaks a session) and is loop-safe via stop_hook_active.
 *
 * Tunables (env):
 *   CLAUDE_LEDGER_REMINDER_OFF=1   disable entirely
 */

const fs = require('fs')

const FANOUT = new Set(['Agent', 'Task', 'Workflow'])
const EDIT = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
// match a goal-ledger path: a `.goals/` dir (any case) OR an uppercase `LEDGER` filename token.
// uppercase-LEDGER avoids false-matching commercial_ledger.md / run-ledger.js (lowercase "ledger").
const LEDGER_RX = /\.goals[\\/]|LEDGER/

function allow() { process.exit(0) }
function roleOf(e) { return (e && (e.role || (e.message && e.message.role))) || (e && e.type) }
function blocksOf(e) {
  const c = e && (e.content || (e.message && e.message.content))
  if (Array.isArray(c)) return c
  if (typeof c === 'string') return [{ type: 'text', text: c }]
  return []
}
function isUserPrompt(e) {
  if (roleOf(e) !== 'user') return false
  const bs = blocksOf(e)
  const hasText = bs.some(b => b && b.type === 'text' && (b.text || '').trim().length)
  const onlyToolResult = bs.length > 0 && bs.every(b => b && b.type === 'tool_result')
  return hasText && !onlyToolResult
}
function pathOf(b) {
  const inp = b && b.input
  return (inp && (inp.file_path || inp.path || inp.notebook_path)) || ''
}

function main() {
  if (process.env.CLAUDE_LEDGER_REMINDER_OFF === '1') return allow()

  let payload
  try { payload = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') } catch { return allow() }
  if (!payload || typeof payload !== 'object') return allow()
  if (payload.stop_hook_active === true) return allow() // already continued once — never loop

  const tpath = payload.transcript_path || payload.transcriptPath
  if (!tpath || !fs.existsSync(tpath)) return allow()

  let entries
  try {
    entries = fs.readFileSync(tpath, 'utf8').split(/\r?\n/).filter(Boolean)
      .map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  } catch { return allow() }
  if (!entries.length) return allow()

  // (1) ledgerTouched: any Edit/Write to a `.goals/` or `*LEDGER*` path ANYWHERE in the session
  for (const e of entries) {
    if (roleOf(e) !== 'assistant') continue
    for (const b of blocksOf(e)) {
      if (b && b.type === 'tool_use' && EDIT.has(b.name) && LEDGER_RX.test(pathOf(b))) return allow()
    }
  }

  // (2) fan-out in the CURRENT turn (everything after the last genuine user prompt)
  let turnStart = 0
  for (let i = 0; i < entries.length; i++) if (isUserPrompt(entries[i])) turnStart = i
  let fanout = false
  for (const e of entries.slice(turnStart)) {
    if (roleOf(e) !== 'assistant') continue
    for (const b of blocksOf(e)) {
      if (b && b.type === 'tool_use' && FANOUT.has(b.name)) { fanout = true; break }
    }
    if (fanout) break
  }
  if (!fanout) return allow()

  const reason = '[ledger-reminder] 这一轮派发了 agent/Workflow，但整个 session 没碰过任何 `.goals/` / `*LEDGER*` 文件——' +
    '像是跨-session / 多阶段工作。按 CLAUDE.md §0.7 第 2 层：把**目标 + 当前断点 + 下一步**记进 `<repo>/.goals/LEDGER.md`' +
    '（固定入口；可一行重定向到工程自有 ledger），并在 `~/.claude/projects/<slug>/memory/` 落一条指向它的 `project` memory，' +
    '这样 `/clear` 后新 session 还能秒接。（确属一次性 / 无持续目标的工作，可忽略本提醒或设 `CLAUDE_LEDGER_REMINDER_OFF=1` 关。）'
  process.stdout.write(JSON.stringify({ decision: 'block', reason }))
  process.exit(0)
}

try { main() } catch { process.exit(0) } // fail-open: a productivity gate must never break a session
