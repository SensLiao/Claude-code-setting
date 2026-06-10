#!/usr/bin/env node
// appsec-evidence-required — Stop hook (sync block in strict, warn-only in lax)
// SKILL.md §18.4. When assistant claims "appsec done" / "security review complete" /
// "AppSec 审查通过" / "安全审查完成", verify .appsec/decisions/<tag>/appsec_release_decision.yaml
// exists AND decision ∈ {PASS, CONDITIONAL_PASS}.

'use strict';

const fs = require('fs');
const path = require('path');
const { readInputSafe, preflight, getActiveReleaseTag, readLastAssistantText, emitStopBlock } = require('./_appsec-common.js');

// ★ P7 fix (Tier 1 #1): fail-closed on JSON parse failure
const { input, parseError } = readInputSafe();
if (parseError) {
  emitStopBlock(`evidence-required fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(0);
}
const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

if (input.stop_hook_active === true) {
  process.stderr.write(`[appsec-evidence-required] stop_hook_active=true — yielding to avoid loop.\n`);
  process.exit(0);
}

if (pre.mode === 'fail-closed') {
  emitStopBlock(`AppSec evidence-required gate failed: ${pre.reason}. Fix the config before continuing.`);
  process.exit(0);
}

// Scan assistant output for "done" claims
const CLAIM_PATTERNS = [
  /appsec\s+done/i,
  /appsec\s+(review|audit)\s+(complete|done|passed?)/i,
  /security\s+(review|audit)\s+(complete|done|passed?)/i,
  /(安全|AppSec)\s*审查\s*(通过|完成)/,
  /appsec\s*release[- ]decision\s*[:=]\s*PASS/i,
];

// Read the final assistant turn — inline payload field if present, else fall back to
// the transcript_path JSONL tail (Stop payloads omit message text on current Claude Code).
const text = readLastAssistantText(input, 256) || '';
const claimed = CLAIM_PATTERNS.some(re => re.test(text));
if (!claimed) process.exit(0);

const projectRoot = pre.projectRoot;
const { activeTag, activeDir } = getActiveReleaseTag(projectRoot);

const reasons = [];

if (!activeTag) {
  reasons.push(`assistant claimed "appsec done" but no active release tag in .appsec/state.json`);
} else {
  const decisionFile = path.join(projectRoot, '.appsec', 'decisions', activeTag, 'appsec_release_decision.yaml');
  if (!fs.existsSync(decisionFile)) {
    reasons.push(`assistant claimed "appsec done" but ${decisionFile} does not exist`);
  } else {
    let txt = '';
    try { txt = fs.readFileSync(decisionFile, 'utf8'); } catch (e) {
      reasons.push(`cannot read ${decisionFile}: ${e.message}`);
    }
    if (txt) {
      const noComments = txt.replace(/^\s*#.*$/gm, '');
      const m = noComments.match(/^[ \t]{0,4}decision[ \t]*:[ \t]*([A-Z_]+)/m);
      if (!m) {
        reasons.push(`${decisionFile}: decision field missing or malformed`);
      } else {
        const decision = m[1];
        if (decision !== 'PASS' && decision !== 'CONDITIONAL_PASS') {
          reasons.push(`${decisionFile}: decision='${decision}' — not PASS or CONDITIONAL_PASS`);
        }
        // For CONDITIONAL_PASS, verify risk_acceptance block exists
        if (decision === 'CONDITIONAL_PASS') {
          const ra = noComments.match(/^[ \t]{0,4}risk_acceptance[ \t]*:/m);
          if (!ra) reasons.push(`CONDITIONAL_PASS requires risk_acceptance: block in decision YAML`);
        }
        // Verify redaction.attested == true
        const rb = noComments.match(/^[ \t]{0,4}redaction[ \t]*:[ \t]*\n((?:[ \t]+.+\n)+)/m);
        if (rb) {
          const att = rb[1].match(/^[ \t]+attested[ \t]*:[ \t]*(true|false)/m);
          if (!att || att[1] !== 'true') reasons.push(`redaction.attested != true in decision YAML`);
        } else {
          reasons.push(`redaction: block missing in decision YAML (must be nested {attested, method, proof_path})`);
        }
      }
    }
  }
}

if (reasons.length === 0) process.exit(0);

if (pre.mode === 'warn') {
  process.stderr.write(`[appsec-evidence-required] WARN (strict_mode=lax):\n`);
  for (const r of reasons) process.stderr.write(`  - ${r}\n`);
  process.exit(0);
}

const message = [
  'AppSec evidence-required gate (§18.4) failed — cannot mark session done:',
  ...reasons.map(r => `  - ${r}`),
  '',
  activeTag ? `Active tag: ${activeTag}` : 'No active release tag — run `appsec-sdk init <tag>` first.',
  `Resolve by running the full §16 dispatch contract to produce a valid appsec_release_decision.yaml.`,
].join('\n');
emitStopBlock(message);
process.exit(0);
