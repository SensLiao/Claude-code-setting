#!/usr/bin/env node
'use strict'
/**
 * plan-card-reminder.js — GLOBAL PreToolUse[Agent|Task|Workflow] hook
 *   (ask #3, hybrid strictness: plan-card = SOFT reminder, never blocks).
 *
 * Makes the §0.6 "render a plan-preview card before fan-out / Workflow" 坎 visible
 * deterministically on the default path. When a real fan-out (the >=3rd Agent/Task
 * of the turn) or ANY Workflow launch happens WITHOUT a plan-preview card having
 * been rendered this turn, inject a deterministic reminder (additionalContext).
 *
 * NEVER blocks (the user chose soft-remind for the card). Reminds at most once per
 * turn. Suppresses itself once a card marker appears in the turn. Fails OPEN.
 *
 * Tunables (env):
 *   CLAUDE_PLAN_CARD_MINAGENTS   fan-out width that triggers the reminder (default 3)
 *   CLAUDE_PLAN_CARD_OFF=1       disable entirely
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const MIN_AGENTS = parseInt(process.env.CLAUDE_PLAN_CARD_MINAGENTS || '3', 10) || 3
const CARD_MARKER = /PLAN PREVIEW|执行计划预览|计划预览卡|PLAN-PREVIEW CARD/

function allow(ctx) {
  if (ctx) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: ctx }
    }))
  }
  process.exit(0)
}
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
  if (process.env.CLAUDE_PLAN_CARD_OFF === '1') return allow()

  let payload
  try { payload = JSON.parse(readFd(0) || '{}') } catch { return allow() }
  const tool = payload && payload.tool_name
  if (tool !== 'Workflow' && tool !== 'Agent' && tool !== 'Task') return allow()

  const tpath = payload.transcript_path || payload.transcriptPath
  const sid = String(payload.session_id || payload.sessionId || 'nosession')

  let agentThisTurn = 0, cardShown = false, turnNo = 0
  try {
    if (tpath && fs.existsSync(tpath)) {
      const entries = fs.readFileSync(tpath, 'utf8').split(/\r?\n/).filter(Boolean)
        .map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
      let start = 0
      for (let i = 0; i < entries.length; i++) if (isUserPrompt(entries[i])) { start = i; turnNo++ }
      for (const e of entries.slice(start)) {
        if (roleOf(e) !== 'assistant') continue
        for (const b of blocksOf(e)) {
          if (b && b.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) agentThisTurn++
          if (b && b.type === 'text' && CARD_MARKER.test(b.text || '')) cardShown = true
        }
      }
    }
  } catch { return allow() }

  const isWorkflow = tool === 'Workflow'
  const requiresCard = isWorkflow || (agentThisTurn + 1 >= MIN_AGENTS)
  if (!requiresCard || cardShown) return allow()

  // remind at most once per turn (sentinel keyed by session + turn number)
  try {
    const sf = path.join(os.tmpdir(), 'cc-plan-card-reminder-' + sid.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json')
    let st = {}
    try { st = JSON.parse(fs.readFileSync(sf, 'utf8')) } catch {}
    if (st && st.turn === turnNo && st.reminded) return allow() // already reminded this turn
    fs.writeFileSync(sf, JSON.stringify({ turn: turnNo, reminded: true }))
  } catch { /* non-fatal — fall through and remind */ }

  const trigger = isWorkflow
    ? '启动 Workflow'
    : ('第 ' + (agentThisTurn + 1) + ' 个并行 agent（fan-out ≥ ' + MIN_AGENTS + '）')
  const msg = '[plan-card-reminder] 检测到' + trigger + '，但本轮还没渲染**计划预览卡**。' +
    '按 CLAUDE.md §0.6：中等 / 复杂任务在 fan-out / Workflow 前应先渲染**表 + 点线流程图**的计划卡（含「用的工具=作用」列）并等用户确认，' +
    '单一真相源 ~/.claude/orchestrator-runtime/shared/preview-template.md。' +
    '（用户已说「直接做 / 自主推进」时可只渲染、不等待。）这是确定性提醒，不阻断本次调用。'
  return allow(msg)
}

try { main() } catch { process.exit(0) } // fail-open
