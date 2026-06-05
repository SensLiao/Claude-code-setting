#!/usr/bin/env node
// qa-floor-rule-prompt — PostToolUse Edit|Write|MultiEdit hook
// Advisory: inject Floor Rule reminder when high-risk paths are touched.
// HIGH fix: H-01 root via walk-up
// MEDIUM fix: M-01 warn-mode unchanged (PostToolUse is already advisory only)

const path = require('path');
const { readInput, preflight, emitAdvisory } = require('./_qa-common.js');

const input = readInput();
const pre = preflight(input);

if (pre.mode === 'silent' || pre.mode === 'off') process.exit(0);
// PostToolUse never blocks; treat fail-closed same as warn (still inject advisory)

const tool = input.tool_name || input.tool || '';
if (!['Edit', 'Write', 'MultiEdit'].includes(tool)) process.exit(0);

const filePath = (input.tool_input && (input.tool_input.file_path || input.tool_input.path)) || '';
if (!filePath) process.exit(0);

// Resolve against project root (not cwd) so signals are stable
let normalized = filePath;
if (pre.projectRoot) {
  try { normalized = path.relative(pre.projectRoot, filePath) || filePath; } catch {}
}
// Use forward slashes for pattern matching consistency on Windows
const matchPath = String(normalized).replace(/\\/g, '/');

const patterns = [
  { re: /(^|\/)auth\//i,                          reason: 'auth/* — Impact ≥ 5, Floor Rule forces ≥ High' },
  { re: /(^|\/)(session|login|signup|password|jwt|oauth)/i, reason: 'auth flow — Impact ≥ 5, Floor Rule forces ≥ High' },
  { re: /(^|\/)payment/i,                         reason: 'payment/* — +5 modifier, Floor Rule forces Critical' },
  { re: /\bstripe\b|\bbraintree\b|\badyen\b/i,    reason: 'payment provider — +5 modifier' },
  { re: /(^|\/)(billing|invoice|charge)/i,        reason: 'billing/* — +5 modifier' },
  { re: /(^|\/)admin\//i,                         reason: 'admin/* — privileged, Floor Rule forces ≥ High' },
  { re: /(^|\/)(tenant|rbac|permission)/i,        reason: 'multi-tenant/rbac — Floor Rule forces ≥ High' },
  { re: /(^|\/)(pii|gdpr|hipaa)/i,                reason: 'PII/regulatory — Floor Rule forces Critical' },
  { re: /(^|\/)(migration|migrate|schema)/i,      reason: 'schema migration — production data write path' },
  { re: /\bprisma\//i,                            reason: 'DB layer — production data write path' },
  { re: /(^|\/)api\//i,                           reason: 'API surface — likely public, AppSec handoff candidate' },
  { re: /\/middleware\.(t|j)sx?$/i,               reason: 'middleware — request gate, AppSec handoff likely' },
];

const matches = patterns.filter(p => p.re.test(matchPath));
if (matches.length === 0) process.exit(0);

const fileLabel = pre.projectRoot ? normalized : filePath;
emitAdvisory('PostToolUse', [
  `[qa-floor-rule-prompt] QA FLOOR RULE TRIGGERED for ${fileLabel}:`,
  ...matches.map(m => `  - ${m.reason}`),
  '',
  'Reminder: enterprise-qa-testing §6 Step 2 must record this in floor_status.* and likely force final_level >= High.',
  'If you intend to ship without High QA coverage, you MUST write .qa/risk-acceptance.yaml with explicit human sign-off.',
].join('\n'));
process.exit(0);
