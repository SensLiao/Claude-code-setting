#!/usr/bin/env node
// disc-deploy-gate — PreToolUse(Bash) hook (block, exit 2 on deny)
// L12 Discoverability harness contract §7.4.
//
// Blocks deploy commands (vercel deploy / netlify deploy --prod / wrangler
// deploy / firebase deploy / pnpm release / npm run deploy / gsd-ship /
// any command in harness.deploy_commands[]) when the L12 gate is not green:
//   - state.gate_status ∈ {STALE, FAIL, BLOCKED}
//   - gate-result.yaml missing for active_run_tag
//   - gate-result.yaml decision not in {PASS, WARN}
//   - last_gate_at older than harness.evidence_freshness_hours
// Mode 'warn' downgrades to stderr advisory + exit 0. Mode 'off' bypasses.

'use strict';

const {
  readInputSafe,
  preflight,
  getActiveRunTag,
  loadGateResult,
  isGateStale,
  buildDeployPatterns,
  preToolBlockMessage,
} = require('./_disc-common.js');

const { input, parseError } = readInputSafe();
if (parseError) {
  preToolBlockMessage(`deploy-gate fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}
const safeInput = input || {};

const pre = preflight(safeInput);
if (pre.mode === 'silent' || pre.mode === 'disabled') process.exit(0);
if (pre.mode === 'fail-closed') {
  preToolBlockMessage(`deploy-gate fail-closed: ${pre.reason}`);
  process.exit(2);
}

const harness = (pre.config && pre.config.harness) || {};
const hookModes = harness.hook_modes || {};
const modeSetting = hookModes.deploy_gate || 'block';  // off | warn | block
if (modeSetting === 'off') process.exit(0);

// Only act on Bash
const toolName = safeInput.tool_name || safeInput.tool || '';
if (toolName !== 'Bash') process.exit(0);

const tinp = safeInput.tool_input || {};
const cmd = tinp.command || '';
if (!cmd) process.exit(0);

// Match against deploy command list
const deployPatterns = buildDeployPatterns(pre.config);
let matchedCommand = null;
for (const dp of deployPatterns) {
  if (dp.re.test(cmd)) { matchedCommand = dp.command; break; }
}
if (!matchedCommand) process.exit(0);

// Load state + gate result
const projectRoot = pre.projectRoot;
const { activeTag, activeRun, gateStatus, lastGateAt } = getActiveRunTag(projectRoot);

const reasons = [];

if (!activeTag) {
  reasons.push(
    `no active L12 run tag in .discoverability/state.json. ` +
    `Run \`python ~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py --project-root . init <tag>\` then full audit before deploying.`
  );
} else {
  // Check gate_status
  if (gateStatus === 'STALE') {
    reasons.push(`state.json gate_status=STALE for tag '${activeTag}' (a triggering file was edited after the last gate.check)`);
  } else if (gateStatus === 'FAIL') {
    reasons.push(`state.json gate_status=FAIL for tag '${activeTag}' (a required channel has blocker findings)`);
  } else if (gateStatus === 'BLOCKED') {
    reasons.push(`state.json gate_status=BLOCKED for tag '${activeTag}' (evidence missing or non-deterministic for required channel)`);
  }

  // Load gate-result.yaml
  const gr = loadGateResult(projectRoot, activeTag);
  if (!gr.exists) {
    reasons.push(`gate-result.yaml not found at ${gr.path || `evidence/discoverability/${activeTag}/gate-result.yaml`}. Run \`python ~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py --project-root . gate.check ${activeTag}\` first.`);
  } else if (!gr.decision) {
    reasons.push(`gate-result.yaml exists but decision field could not be parsed`);
  } else if (gr.decision !== 'PASS' && gr.decision !== 'WARN') {
    reasons.push(`gate-result.yaml decision='${gr.decision}' — only PASS or WARN are allowed for deploy`);
  }

  // Check evidence freshness
  const freshnessHours = Number(harness.evidence_freshness_hours);
  if (Number.isFinite(freshnessHours) && freshnessHours > 0) {
    if (isGateStale(lastGateAt, freshnessHours)) {
      const ageHint = lastGateAt ? `last_gate_at=${lastGateAt}` : 'last_gate_at unset';
      reasons.push(`evidence older than harness.evidence_freshness_hours=${freshnessHours} (${ageHint}); rerun gate.check before deploy`);
    }
  }
}

if (reasons.length === 0) {
  process.exit(0);  // green light
}

const blockHeader = `deploy command '${matchedCommand}' blocked by L12 Discoverability gate`;
const detailLines = reasons.map(r => `  - ${r}`).join('\n');
const SDK = '~/.claude/skills/discoverability-orchestrator/scripts/discoverability-sdk.py';
const guidance =
  '\nTo proceed:\n' +
  `  1. python ${SDK} --project-root . audit <tag> --channel <c>  (for each active channel)\n` +
  `  2. python ${SDK} --project-root . gate.check <tag>\n` +
  `  3. confirm gate-result.yaml decision is PASS or WARN, then retry deploy.\n` +
  'If you must deploy despite this gate, set harness.hook_modes.deploy_gate=off in discoverability.config.yaml (not recommended for production).';

// Warn mode
if (modeSetting === 'warn' || pre.mode === 'warn') {
  process.stderr.write(`[disc-deploy-gate] WARN: ${blockHeader}\n${detailLines}\n`);
  process.exit(0);
}

// Block mode (default)
preToolBlockMessage(`${blockHeader}:\n${detailLines}${guidance}`);
process.exit(2);
