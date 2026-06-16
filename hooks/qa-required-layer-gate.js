#!/usr/bin/env node
// qa-required-layer-gate — Stop hook (P3, 2026-06-16)
//
// Fail-closed correctness gate. If Architecture-Intake (§6 Step 1.7) produced a
// 00-test-plan.json marking layers required:true, EVERY such layer must have its
// expected_artifact on disk + non-empty (+ command_evidence for machine .json
// evidence). A required layer with no artifact = a silently-skipped MANDATED test
// → BLOCK. This closes "漏选某层让其证据不被 gate" for the path-graph-derived
// required set.
//
// ADDITIVE rollout: no 00-test-plan.json (intake not run) → NO-OP, so every legacy
// flow is unaffected. Stop-hook convention: block via emitStopBlock({decision:block})
// + exit 0 (NOT exit 2 — that is PreToolUse semantics).
//
// Self-contained: requires only the sibling _qa-common.js (installed alongside).

const fs = require('fs');
const path = require('path');
const { readInput, preflight, getActiveReleaseTag, emitStopBlock } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);
if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);
if (input.stop_hook_active === true) process.exit(0);
if (pre.mode === 'fail-closed') {
  emitStopBlock(`QA required-layer gate: .qa/config.json ${pre.reason}. Fix the config before claiming done.`);
  process.exit(0);
}

const projectRoot = pre.projectRoot;
const { activeTag, activeDir } = getActiveReleaseTag(projectRoot);
if (!activeTag || !activeDir) process.exit(0);

const planPath = path.join(activeDir, '00-test-plan.json');
if (!fs.existsSync(planPath)) process.exit(0); // intake not run → additive NO-OP

let plan;
try { plan = JSON.parse(fs.readFileSync(planPath, 'utf8')); }
catch (e) {
  emitStopBlock(`QA required-layer gate: 00-test-plan.json present but malformed (${e.message}) — fail-closed; fix or regenerate intake.`);
  process.exit(0);
}

const required = Array.isArray(plan.required_layers)
  ? plan.required_layers.filter(l => l && l.required === true)
  : [];
if (required.length === 0) process.exit(0);

const reasons = [];
for (const layer of required) {
  const name = layer.layer || '(unnamed)';
  const art = layer.expected_artifact;
  if (!art || typeof art !== 'string') { reasons.push(`required layer '${name}' has no expected_artifact declared in test-plan`); continue; }
  const artAbs = path.isAbsolute(art) ? art : path.join(projectRoot, art);
  if (!fs.existsSync(artAbs)) { reasons.push(`required layer '${name}': expected artifact missing: ${art}`); continue; }
  let stat; try { stat = fs.statSync(artAbs); } catch { reasons.push(`required layer '${name}': artifact unreadable: ${art}`); continue; }
  if (stat.size === 0) { reasons.push(`required layer '${name}': artifact empty: ${art}`); continue; }
  // Machine .json layer evidence must carry non-empty command_evidence.
  if (artAbs.endsWith('.json')) {
    try {
      const j = JSON.parse(fs.readFileSync(artAbs, 'utf8'));
      const ce = (Array.isArray(j.command_evidence) && j.command_evidence)
              || (j.derived && Array.isArray(j.derived.command_evidence) && j.derived.command_evidence);
      if (!Array.isArray(ce) || ce.length === 0) reasons.push(`required layer '${name}': artifact has no command_evidence: ${art}`);
    } catch (e) { reasons.push(`required layer '${name}': artifact not valid JSON: ${art}`); }
  }
}

if (reasons.length === 0) process.exit(0);
if (pre.mode === 'warn') {
  process.stderr.write('[qa-required-layer-gate] WARN (qa_enforcement=warn):\n');
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.exit(0);
}
emitStopBlock([
  'QA required-layer gate failed — a MANDATED test layer produced no evidence:',
  ...reasons.map(r => `  - ${r}`),
  '',
  `Active tag: ${activeTag}`,
  'Run the missing layer via its qa-* runner subagent (qa-sdk evidence.run produces the artifact),',
  'or justify the skip per §10 Evidence-Gated Skip and update 00-test-plan.json required:false with evidence.',
].join('\n'));
process.exit(0);
