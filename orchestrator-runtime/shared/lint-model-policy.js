#!/usr/bin/env node
/**
 * shared/lint-model-policy.js — enforce the model-tier policy on workflow presets.
 *
 * Policy A (user lock 2026-05-30, replaces the never-implemented claim in
 * enterprise-qa-testing §18.5 + appsec §16.x that "workflow-lint rejects opus"):
 *
 *   1. NO HAIKU IN REAL GATES — any non-smoke preset whose phase/stage `model`
 *      or `resolved_model` resolves to the haiku tier (cheap_fast / haiku) is a
 *      violation. Haiku is allowed ONLY in smoke-exempt presets.
 *   2. NO OPUS IN FANOUT — any fanout node whose `model`/`resolved_model`
 *      resolves to the opus tier (strongest_available / opus) is a violation
 *      (11×opus = budget kill).
 *
 * Smoke-exempt presets (haiku allowed, policy skipped): quick-check, smoke, graph-smoke.
 *
 * Usage:
 *   node shared/lint-model-policy.js <presets-dir> [smoke-exempt-csv]
 *   echo '<preset-json>' | node shared/lint-model-policy.js --stdin <preset-name>   # single-preset test
 *
 * Exit: 0 clean | 2 violation(s) | 3 bad input.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_SMOKE_EXEMPT = ['quick-check', 'smoke', 'graph-smoke'];

const HAIKU = new Set(['cheap_fast']);
const OPUS = new Set(['strongest_available']);
function tierOf(model) {
  if (typeof model !== 'string') return null;
  if (HAIKU.has(model)) return 'haiku';
  if (OPUS.has(model)) return 'opus';
  if (model === 'balanced') return 'sonnet';
  if (model === 'inherit') return 'inherit';
  const base = model.split('-')[0];
  if (base === 'haiku') return 'haiku';
  if (base === 'opus') return 'opus';
  if (base === 'sonnet') return 'sonnet';
  return null; // unknown — not our concern
}

function checkNode(node, presetName, label, violations) {
  if (!node || typeof node !== 'object') return;
  const isFanout = node.type === 'fanout';
  for (const field of ['model', 'resolved_model']) {
    const t = tierOf(node[field]);
    if (t === 'haiku') {
      violations.push(`${presetName}: ${label} — ${field}=${node[field]} (HAIKU) forbidden in a real-gate preset (Policy A: haiku only in smoke).`);
    }
    if (isFanout && t === 'opus') {
      violations.push(`${presetName}: ${label} (fanout) — ${field}=${node[field]} (OPUS) forbidden in fanout (Policy A: fanout capped at sonnet).`);
    }
  }
}

function lintPreset(presetName, json, violations) {
  for (const ph of json.phases || []) {
    checkNode(ph, presetName, ph.name || '?', violations);
    for (let i = 0; i < (ph.stages || []).length; i++) {
      checkNode(ph.stages[i], presetName, `${ph.name}/stage${i + 1}`, violations);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const violations = [];

  if (args[0] === '--stdin') {
    const name = args[1] || 'stdin-preset';
    let json;
    try { json = JSON.parse(fs.readFileSync(0, 'utf8')); }
    catch (e) { console.error('bad stdin json: ' + e.message); process.exit(3); }
    if (!DEFAULT_SMOKE_EXEMPT.includes(name)) lintPreset(name, json, violations);
  } else {
    const dir = args[0];
    if (!dir || !fs.existsSync(dir)) { console.error('usage: lint-model-policy.js <presets-dir> [smoke-exempt-csv]'); process.exit(3); }
    const exempt = args[1] ? args[1].split(',').map(s => s.trim()) : DEFAULT_SMOKE_EXEMPT;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const stem = f.replace(/\.json$/, '');
      if (exempt.includes(stem)) continue;
      let json;
      try { json = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
      catch (e) { violations.push(`${stem}: unreadable JSON (${e.message})`); continue; }
      lintPreset(stem, json, violations);
    }
  }

  if (violations.length === 0) {
    console.log('lint-model-policy: OK (no haiku in real gates, no opus in fanout)');
    process.exit(0);
  }
  console.error('lint-model-policy FAILED:');
  for (const v of violations) console.error('  x ' + v);
  process.exit(2);
}

main();
