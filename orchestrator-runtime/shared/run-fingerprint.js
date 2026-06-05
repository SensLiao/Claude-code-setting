#!/usr/bin/env node
/**
 * shared/run-fingerprint.js — execution_fingerprint (run_hash) for evidence integrity.
 *
 * Per cross-review (2026-05-30): spec_hash alone is insufficient as a provenance
 * anchor. spec_hash hashes the assembled spec (it DOES capture resolved_model +
 * inlined prompts/schemas + injected context, since it is computed post-assembly),
 * but it does NOT capture:
 *   - agent-definition drift  (spec references agentType by NAME; the agent .md
 *     system-prompt/tools can change without changing spec_hash)
 *   - AppSec's runtime-resolved model (AppSec presets do not bake resolved_model,
 *     so the literal model that actually ran is not in the spec)
 *   - policy_version / lint_version (which alias-mapping + which enforcer ran)
 *   - actual fanout expansion (runtime-determined from a phase output)
 *
 * execution_fingerprint folds all of these. It is a POST-RUN PROVENANCE anchor
 * recorded in evidence / workflow-state — NOT the pre-launch approval gate (that
 * stays spec_hash, validated by {qa,appsec}-preview-gate.js). Two runs with the
 * same spec_hash but a drifted agent/policy/lint/fanout get DIFFERENT fingerprints.
 *
 * Usage:
 *   node shared/run-fingerprint.js <assembled-spec.json> <project-root> [--fanout '<json>'] [--domain qa|appsec]
 *   echo '<spec>' | node shared/run-fingerprint.js - <project-root>
 *
 * Output (stdout): JSON { execution_fingerprint: 'sha256:<hex>', components: {...} }
 * Exit: 0 ok | 1 read/parse error.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { stableStringify, sha256Hex, specHash } = require('./spec-hash.js');

function shortHashFile(p) {
  try { return 'sha256:' + sha256Hex(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function resolveAgentFile(name, projectRoot) {
  // precedence: project > user (mirrors resolve-capabilities.js)
  const candidates = [
    path.join(projectRoot, '.claude', 'agents', `${name}.md`),
    path.join(os.homedir(), '.claude', 'agents', `${name}.md`),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function collectAgentTypes(spec) {
  const set = new Set();
  for (const p of spec.phases || []) {
    if (p.agentType) set.add(p.agentType);
    for (const s of p.stages || []) if (s.agentType) set.add(s.agentType);
  }
  return [...set].sort();
}

function collectResolvedModels(spec) {
  const out = [];
  for (const p of spec.phases || []) {
    if (p.model || p.resolved_model) out.push(`${p.name}:${p.model ?? '-'}=>${p.resolved_model ?? '-'}`);
    for (let i = 0; i < (p.stages || []).length; i++) {
      const s = p.stages[i];
      if (s.model || s.resolved_model) out.push(`${p.name}/s${i + 1}:${s.model ?? '-'}=>${s.resolved_model ?? '-'}`);
    }
  }
  return out.sort();
}

function main() {
  const args = process.argv.slice(2);
  const specSrc = args[0];
  const projectRoot = args[1] || process.cwd();
  let fanout = null, domain = 'qa';
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--fanout') { try { fanout = JSON.parse(args[++i]); } catch { fanout = args[i]; } }
    else if (args[i] === '--domain') { domain = args[++i]; }
  }

  let spec;
  try {
    const raw = (!specSrc || specSrc === '-') ? fs.readFileSync(0, 'utf8') : fs.readFileSync(specSrc, 'utf8');
    spec = JSON.parse(raw);
  } catch (e) { process.stderr.write(`run-fingerprint: ${e.message}\n`); process.exit(1); }

  const HOME = os.homedir();
  const policyFile = path.join(HOME, '.claude', 'orchestrator-runtime', 'shared', 'model-policy.md');
  const lintFile = path.join(HOME, '.claude', 'orchestrator-runtime', 'shared', 'lint-model-policy.js');

  // agent content hashes (the key drift gap)
  const agent_hashes = {};
  for (const a of collectAgentTypes(spec)) {
    const f = resolveAgentFile(a, projectRoot);
    agent_hashes[a] = f ? shortHashFile(f) : 'MISSING';
  }

  const components = {
    spec_hash: specHash(spec),
    resolved_models: collectResolvedModels(spec),
    agent_hashes,
    prompt_hashes: Object.fromEntries(Object.entries(spec.prompts || {}).map(([k, v]) => [k, 'sha256:' + sha256Hex(String(v))])),
    schema_hashes: Object.fromEntries(Object.entries(spec.schemas || {}).map(([k, v]) => [k, 'sha256:' + sha256Hex(stableStringify(v))])),
    policy_version: shortHashFile(policyFile) || 'MISSING',
    lint_version: shortHashFile(lintFile) || 'MISSING',
    model_policy_version: spec.model_policy_version || (spec.context && spec.context.model_policy_version) || null,
    fanout_expansion: fanout,
    domain,
  };

  const execution_fingerprint = 'sha256:' + sha256Hex(stableStringify(components));
  process.stdout.write(JSON.stringify({ execution_fingerprint, components }, null, 2) + '\n');
}

main();
