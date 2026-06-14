#!/usr/bin/env node
'use strict'
/**
 * report-gate.js — GLOBAL Stop hook  (ask #3, hybrid strictness: report = HARD block).
 *
 * Makes the §0.5/§0.6/§0.7 "must report" 坎 DETERMINISTIC on the default/prompt-only
 * path. After a NON-TRIVIAL turn (the model used Agent/Task/Workflow, OR made >=3
 * file edits), the closing assistant message MUST be a real written summary
 * (>= threshold chars). If it isn't, block the stop (decision:block) so the model
 * is forced to produce the report before the turn can end.
 *
 * Honest scope (told to the user): this enforces that a report EXISTS (structural /
 * presence), NOT that it is well written (semantic). FORMAT stays prompt-guided
 * (CLAUDE.md §0.5/§0.6); PRESENCE is enforced here. It raises the floor from "might
 * forget entirely" to "cannot end a non-trivial turn silently".
 *
 * Safety posture: this is a PRODUCTIVITY gate, not a security gate — it FAILS OPEN on
 * any parse/IO error (never breaks a session) and is loop-safe via stop_hook_active.
 *
 * Tunables (env):
 *   CLAUDE_REPORT_GATE_MINCHARS   closing-report min length (default 200)
 *   CLAUDE_REPORT_GATE_MINTURN    turn-total comms that satisfy "reported" despite a
 *                                 short/unflushed final message — flush-race fallback (default 600)
 *   CLAUDE_REPORT_GATE_MINEDITS   edit count that makes a turn "non-trivial" (default 3)
 *   CLAUDE_REPORT_GATE_OFF=1      disable entirely
 */

const fs = require('fs')

const MIN = parseInt(process.env.CLAUDE_REPORT_GATE_MINCHARS || '200', 10) || 200
const MIN_TURN = parseInt(process.env.CLAUDE_REPORT_GATE_MINTURN || '600', 10) || 600
const MIN_EDITS = parseInt(process.env.CLAUDE_REPORT_GATE_MINEDITS || '3', 10) || 3
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const FANOUT_TOOLS = new Set(['Agent', 'Task', 'Workflow'])

function allow() { process.exit(0) }
function readFd(fd) { try { return fs.readFileSync(fd, 'utf8') } catch { return '' } }

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

function main() {
  if (process.env.CLAUDE_REPORT_GATE_OFF === '1') return allow()

  let payload
  try { payload = JSON.parse(readFd(0) || '{}') } catch { return allow() }
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
  let turnStart = 0
  for (let i = 0; i < entries.length; i++) if (isUserPrompt(entries[i])) turnStart = i
  const turn = entries.slice(turnStart)

  let editCount = 0, fanout = false, finalText = '', turnText = ''
  for (const e of turn) {
    if (roleOf(e) !== 'assistant') continue
    let txt = ''
    for (const b of blocksOf(e)) {
      if (b && b.type === 'tool_use') {
        if (EDIT_TOOLS.has(b.name)) editCount++
        if (FANOUT_TOOLS.has(b.name)) fanout = true
      }
      if (b && b.type === 'text') txt += (b.text || '')
    }
    if (txt.trim().length) { finalText = txt; turnText += '\n' + txt } // finalText = last assistant text; turnText = all of it
  }

  const requiresReport = fanout || editCount >= MIN_EDITS
  if (!requiresReport) return allow()
  // (1) Normal path: a substantial CLOSING report is present as the last assistant message.
  if (finalText.trim().length >= MIN) return allow()
  // (2) Flush-race / ended-on-tool fallback: a Stop hook can fire BEFORE the final assistant
  //     message is flushed to the transcript JSONL — the hook would then see the prior (often
  //     short, tool-ending) message and false-positive. Earlier turn messages ARE flushed, so
  //     if substantial total communication happened this turn, treat "must report" as satisfied.
  //     (Confirmed root cause 2026-06-15: truncate-before-report reproduces the false block.)
  if (turnText.trim().length >= MIN_TURN) return allow()

  const did = fanout ? '派发了 agent / Workflow' : (editCount + ' 处文件改动')
  const reason = '[report-gate] 这一轮做了实质工作（' + did + '）但收尾没有给用户的汇报。' +
    '在结束前，请按 CLAUDE.md §0.5（业务/领导视角）+ §0.6/§0.7 给一段收尾汇报：' +
    '① 做了什么（大白话，业务价值）② 验证结果（真跑了什么命令 / 是否通过 / 有无 terminal 证据）' +
    '③ 还剩什么 / 风险 / 被 BLOCK 的项。诚实分清「真能用」≠「样片」≠「没做完」。' +
    '（这是确定性的收尾坎；格式按 prompt，但汇报必须出。如确属简单任务可给一句明确的完成说明。）'
  process.stdout.write(JSON.stringify({ decision: 'block', reason }))
  process.exit(0)
}

try { main() } catch { process.exit(0) } // fail-open: a productivity gate must never break a session
