#!/usr/bin/env node
/**
 * build-graph-smoke-args.js — assemble Workflow args for QA graph-smoke runtime
 * test. Reads graph-smoke preset, inlines prompts (.md → spec.prompts[ref]) and
 * schemas (.json → spec.schemas[ref]), computes canonical spec_hash, and emits
 * a single JSON document compatible with
 *   Workflow({scriptPath:"...qa-orchestrator.js", args:<this>})
 *
 * Stdout: JSON args
 * Stderr: assembly trace
 * Exit 0 on success, 1 on assembly failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOME = process.env.HOME || process.env.USERPROFILE;
const RUNTIME = path.join(HOME, '.claude', 'orchestrator-runtime', 'qa');
const PRESET_NAME = process.argv[2] || 'graph-smoke';
const PRESET_PATH = path.join(RUNTIME, 'presets', `${PRESET_NAME}.json`);
const PROMPT_DIR = path.join(RUNTIME, 'prompts');
const SCHEMA_DIR = path.join(RUNTIME, 'schemas');

if (!fs.existsSync(PRESET_PATH)) {
  console.error(`preset not found: ${PRESET_PATH}`);
  process.exit(1);
}

const preset = JSON.parse(fs.readFileSync(PRESET_PATH, 'utf8'));
const spec = JSON.parse(JSON.stringify(preset));  // deep clone

// ── inline prompts ──
function gatherPromptRefs(phases) {
  const refs = new Set();
  for (const p of phases) {
    if (p.prompt_ref) refs.add(p.prompt_ref);
    for (const s of (p.stages || [])) if (s.prompt_ref) refs.add(s.prompt_ref);
  }
  return [...refs];
}
const promptRefs = gatherPromptRefs(spec.phases);
spec.prompts = spec.prompts || {};
for (const ref of promptRefs) {
  const p = path.join(PROMPT_DIR, `${ref}.md`);
  if (!fs.existsSync(p)) {
    console.error(`prompt missing: ${p}`);
    process.exit(1);
  }
  spec.prompts[ref] = fs.readFileSync(p, 'utf8');
}
console.error(`inlined ${promptRefs.length} prompt(s)`);

// ── inline schemas ──
function gatherSchemaRefs(phases) {
  const refs = new Set();
  for (const p of phases) {
    if (p.schema_ref) refs.add(p.schema_ref);
    for (const s of (p.stages || [])) if (s.schema_ref) refs.add(s.schema_ref);
  }
  return [...refs];
}
const schemaRefs = gatherSchemaRefs(spec.phases);
spec.schemas = spec.schemas || {};
for (const ref of schemaRefs) {
  // schema files end in .json; ref like "STATIC_BASELINE_SCHEMA.v1" → "STATIC_BASELINE_SCHEMA.v1.json"
  const p = path.join(SCHEMA_DIR, `${ref}.json`);
  if (!fs.existsSync(p)) {
    console.error(`schema missing: ${p}`);
    process.exit(1);
  }
  spec.schemas[ref] = JSON.parse(fs.readFileSync(p, 'utf8'));
}
console.error(`inlined ${schemaRefs.length} schema(s)`);

// ── stable stringify + sha256 spec_hash ──
function stableStringify(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
const specHash = 'sha256:' + crypto.createHash('sha256').update(stableStringify(spec), 'utf8').digest('hex');
console.error(`spec_hash: ${specHash}`);

// ── assemble args ──
const runId = process.argv[3] || `b2-graph-smoke-2026-05-29`;
const releaseTag = process.argv[4] || `b2-graph-smoke-rt`;

const args = {
  spec,
  spec_hash: specHash,
  run_id: runId,
  release_tag: releaseTag,
  context: {
    // Skill-pre-resolved risk snapshot — graph-smoke needs minimal coverage.
    risk_snapshot: {
      final_level: 'Medium',
      floor_rule_status: { triggered: false, triggers: [] },
      impact_score: 3,
      likelihood_score: 3,
      modifier_attribution: [],
      modifier_cap_applied: false,
      evidence_confidence: 'Medium',
    },
    critical_release_paths: [],
    policy: {
      static_floor: { max_tsc_errors: 0, max_eslint_errors: 0, max_npm_audit_critical: 0 },
      require_full_coverage: false,
    },
    branch_sha: 'graph-smoke-sha',
    viewport: { width: 1280, height: 720, dpr: 1 },
  },
  previous_results: {},
};

process.stdout.write(JSON.stringify(args));
console.error(`OK: assembled args (${JSON.stringify(args).length} chars total)`);
