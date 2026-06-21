#!/usr/bin/env node
/**
 * first-skill.js — routing probe for manual Tier-2 orchestrator-routing tests.
 *
 *   node first-skill.js [<target-project-cwd>]
 *
 * Reads the Claude Code session transcripts for the given project cwd and prints, per session:
 *   <session-id>  | <first real user prompt>  | first route  | full Skill/Agent order
 *
 * "first route" = the first Skill: or Agent: tool call in that session — what the model auto-picked
 * for the task. Run each fixture in a FRESH session so one transcript (jsonl) == one fixture.
 *
 * Honesty notes (proven during build):
 *  - "global latest mtime" is unreliable — it can grab another project's session. Always scope to
 *    the target project's transcript dir (this script encodes the cwd the way Claude Code does).
 *  - A live, in-progress session may not be flushed to disk yet — read AFTER the session settles.
 *  - A correct route can land as an Agent: (a gsd or appsec subagent) with no explicit Skill —
 *    both count, so this probe reports Skill AND Agent calls.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');

const cwd = process.argv[2] || 'D:/Project/Project_from_Other/routing-test';
// Claude Code encodes the project dir name by replacing every non-alphanumeric char with '-'.
const encoded = path.resolve(cwd).replace(/[^a-zA-Z0-9]/g, '-');
const dir = path.join(os.homedir(), '.claude', 'projects', encoded);

if (!fs.existsSync(dir)) {
  console.log(`no transcripts yet for: ${cwd}`);
  console.log(`(looked in ${dir})`);
  console.log('Open a FRESH session in that folder, paste one fixture, then re-run this.');
  process.exit(0);
}

function firstUserPrompt(lines) {
  for (const l of lines) {
    let o; try { o = JSON.parse(l); } catch { continue; }
    const m = o && o.message;
    if (!m || m.role !== 'user') continue;
    let text = '';
    if (typeof m.content === 'string') text = m.content;
    else if (Array.isArray(m.content)) text = m.content.filter(c => c && c.type === 'text').map(c => c.text).join(' ');
    text = (text || '').trim();
    if (!text) continue;
    // skip injected blocks / local-command echoes — we want the human's typed prompt
    if (text.startsWith('<') || text.startsWith('Caveat:') || text.startsWith('[BOOTSTRAP_HINT]')) continue;
    return text.replace(/\s+/g, ' ').slice(0, 90);
  }
  return '(no plain user prompt found)';
}

function routes(lines) {
  const hits = [];
  for (const l of lines) {
    let o; try { o = JSON.parse(l); } catch { continue; }
    const content = o && o.message && o.message.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c.type !== 'tool_use') continue;
      if (c.name === 'Skill') hits.push('Skill:' + ((c.input && c.input.skill) || '?'));
      else if (c.name === 'Agent') hits.push('Agent:' + ((c.input && c.input.subagent_type) || '?'));
    }
  }
  return hits;
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'))
  .map(f => { const p = path.join(dir, f); return { f, p, mt: fs.statSync(p).mtimeMs }; })
  .sort((a, b) => a.mt - b.mt);

console.log(`project    : ${cwd}`);
console.log(`transcripts: ${dir}`);
console.log(`sessions   : ${files.length}\n`);
for (const { f, p } of files) {
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  const r = routes(lines);
  console.log(`• ${f.slice(0, 8)}  "${firstUserPrompt(lines)}"`);
  console.log(`    first route : ${r[0] || '(none)'}`);
  console.log(`    full order  : ${r.join(' -> ') || '(no Skill/Agent calls)'}\n`);
}
