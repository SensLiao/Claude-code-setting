#!/usr/bin/env node
'use strict'
/**
 * ledger-autolog.js — GLOBAL Stop hook (the MACHINE layer of CLAUDE.md §0.7).
 *
 * On a SUBSTANTIAL turn (fan-out Agent/Task/Workflow OR >= N file edits) append ONE
 * deterministic metadata row to the machine ledger (`<project>/.harness/runs.jsonl`) via the
 * canonical `orchestrator-runtime/shared/run-ledger.js` appendRun — so multi-step work always
 * leaves a resumable audit trail WITHOUT relying on the model to write it.
 *
 * Pairs with: /ledger command (human-readable SEMANTIC ledger, .goals/LEDGER.md) +
 * ledger-reminder.js (nag when the human ledger was never touched on a fan-out turn).
 *
 * RECORD-ONLY — never blocks (always exit 0). FAILS OPEN on any error (productivity gate, not a
 * safety gate; must never break a session). Loop-safe via stop_hook_active. Metadata only
 * (tools / files / last-request) — NOT a semantic "what was achieved" (that's /ledger's job).
 *
 * Tunables (env): CLAUDE_LEDGER_AUTOLOG_OFF=1 disable · CLAUDE_LEDGER_AUTOLOG_MINEDITS (default 3).
 */
const fs = require('fs')
const path = require('path')

const FANOUT = new Set(['Agent', 'Task', 'Workflow'])
const EDIT = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

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
function firstText(e) {
  for (const b of blocksOf(e)) if (b && b.type === 'text' && (b.text || '').trim()) return b.text.trim()
  return ''
}
function pathOf(b) {
  const inp = b && b.input
  return (inp && (inp.file_path || inp.path || inp.notebook_path)) || ''
}

function main() {
  if (process.env.CLAUDE_LEDGER_AUTOLOG_OFF === '1') return allow()

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

  // current turn = everything after the last genuine user prompt
  let turnStart = 0, lastPrompt = ''
  for (let i = 0; i < entries.length; i++) {
    if (isUserPrompt(entries[i])) { turnStart = i; lastPrompt = firstText(entries[i]) }
  }

  const tools = new Set(), agents = [], files = new Set()
  for (const e of entries.slice(turnStart)) {
    if (roleOf(e) !== 'assistant') continue
    for (const b of blocksOf(e)) {
      if (!(b && b.type === 'tool_use' && b.name)) continue
      tools.add(b.name)
      if (FANOUT.has(b.name)) agents.push((b.input && b.input.subagent_type) || b.name)
      if (EDIT.has(b.name)) { const p = pathOf(b); if (p) files.add(p) }
    }
  }

  const minEdits = parseInt(process.env.CLAUDE_LEDGER_AUTOLOG_MINEDITS || '3', 10)
  const substantial = agents.length > 0 || files.size >= (Number.isFinite(minEdits) ? minEdits : 3)
  if (!substantial) return allow() // trivial turn — don't log

  // append ONE metadata row via the canonical writer; fail-open if it's unavailable
  try {
    const { appendRun } = require(path.join(__dirname, '..', 'orchestrator-runtime', 'shared', 'run-ledger.js'))
    appendRun({
      subsystem: 'session',
      stage: 'turn-autolog',
      decision: 'RECORDED',
      tools_used: Array.from(tools),
      agents_used: agents,
      files_changed: Array.from(files),
      edit_count: files.size,
      turn_summary: (lastPrompt || '').replace(/\s+/g, ' ').slice(0, 200),
    }, { cwd: payload.cwd || process.cwd() })
  } catch { /* fail-open: missing writer / IO error must never break a session */ }

  return allow()
}

try { main() } catch { process.exit(0) } // fail-open
