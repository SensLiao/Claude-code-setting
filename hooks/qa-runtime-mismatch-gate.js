#!/usr/bin/env node
// qa-runtime-mismatch-gate — Stop hook (P3, 2026-06-16)
//
// Fail-closed correctness gate. If Architecture-Intake detected a host_capable
// mobile / API / desktop target whose expected_e2e_kind is non-web, but the only
// E2E-class evidence produced is web (Playwright/Cypress), the actual surface was
// never tested → BLOCK. This is the "don't web-only fallback on a mobile/API app"
// lock, keyed off the intake's own runtime_targets (not a guess).
//
// ADDITIVE: no 00-test-plan.json (intake not run) → NO-OP. host_capable:false
// targets are NOT mismatches here (they are NOT_APPLICABLE / RUNTIME_HOST_INCAPABLE,
// handled upstream) — this gate never double-BLOCKs them. Stop-hook convention:
// emitStopBlock + exit 0.

const fs = require('fs');
const path = require('path');
const { readInput, preflight, getActiveReleaseTag, emitStopBlock } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);
if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);
if (input.stop_hook_active === true) process.exit(0);
if (pre.mode === 'fail-closed') {
  emitStopBlock(`QA runtime-mismatch gate: .qa/config.json ${pre.reason}.`);
  process.exit(0);
}

const projectRoot = pre.projectRoot;
const { activeTag, activeDir } = getActiveReleaseTag(projectRoot);
if (!activeTag || !activeDir) process.exit(0);

const planPath = path.join(activeDir, '00-test-plan.json');
if (!fs.existsSync(planPath)) process.exit(0); // additive NO-OP

let plan;
try { plan = JSON.parse(fs.readFileSync(planPath, 'utf8')); }
catch (e) { emitStopBlock(`QA runtime-mismatch gate: 00-test-plan.json malformed (${e.message}) — fail-closed.`); process.exit(0); }

const targets = Array.isArray(plan.runtime_targets) ? plan.runtime_targets : [];
if (targets.length === 0) process.exit(0);

const has = (n) => fs.existsSync(path.join(activeDir, n));
const hasWebE2E    = has('e2e.json') || has('e2e.yaml');
const hasMobileE2E = has('mobile_e2e.json') || has('mobile_e2e.yaml');
const hasContract  = has('contract.json') || has('contract.yaml');
const hasIntegration = has('integration.json') || has('integration.yaml');

const reasons = [];
for (const t of targets) {
  if (!t || t.host_capable !== true) continue; // host-incapable handled as NOT_APPLICABLE upstream
  const kind = String(t.kind || '');
  const ek = String(t.expected_e2e_kind || '');
  const isMobile = ek === 'mobile-maestro' || /^mobile-/.test(kind);
  const isApi = ek === 'api-contract' || kind === 'api-server' || kind === 'graphql-server';
  if (isMobile) {
    if (!hasMobileE2E && hasWebE2E) reasons.push(`target '${kind}' needs mobile E2E (Maestro) but only web E2E evidence exists`);
    else if (!hasMobileE2E)        reasons.push(`target '${kind}' needs mobile E2E (Maestro) — no mobile_e2e evidence produced`);
  } else if (isApi) {
    if (!hasContract && !hasIntegration && hasWebE2E) reasons.push(`target '${kind}' is an API surface needing contract/integration evidence, but only web E2E evidence exists`);
  }
}

if (reasons.length === 0) process.exit(0);
if (pre.mode === 'warn') {
  process.stderr.write('[qa-runtime-mismatch-gate] WARN (qa_enforcement=warn):\n');
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.exit(0);
}
emitStopBlock([
  'QA runtime-mismatch gate failed — the detected target type was not tested with a matching E2E kind:',
  ...reasons.map(r => `  - ${r}`),
  '',
  'Produce the matching evidence (mobile → qa-mobile-e2e-runner / Maestro; API → qa-contract-runner / integration),',
  'or, if the host genuinely cannot run it, mark the target host_capable:false (RUNTIME_HOST_INCAPABLE) with justification.',
].join('\n'));
process.exit(0);
