#!/usr/bin/env node
// appsec-active-scan-guard — PreToolUse(Bash) hook (sync block, exit 2 on deny)
// SKILL.md §18.2. Blocks sqlmap/nmap-active/nuclei/ffuf/gobuster/wfuzz/burp/zap-active/
// masscan/hydra/msfconsole/msfvenom unless active ROE covers target AND target not in
// production_hosts[]. production_hosts are hard-deny even with valid ROE.

'use strict';

const fs = require('fs');
const path = require('path');
const {
  readInputSafe, preflight, detectActiveScanTool, extractTargetHosts, preToolBlockMessage,
} = require('./_appsec-common.js');

// ★ P7 fix (Tier 1 #1): fail-closed PreToolUse on JSON parse failure
const { input, parseError } = readInputSafe();
if (parseError) {
  preToolBlockMessage(`active-scan-guard fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}
const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

// Only act on Bash tool calls
const toolName = input.tool_name || input.tool || '';
if (toolName !== 'Bash') process.exit(0);

if (pre.mode === 'fail-closed') {
  preToolBlockMessage(`active-scan-guard fail-closed: ${pre.reason}`);
  process.exit(2);
}

const tinp = input.tool_input || {};
const cmd = tinp.command || '';
const tool = detectActiveScanTool(cmd);
if (!tool) process.exit(0);

const cfg = pre.config || {};
const productionHosts = Array.isArray(cfg.production_hosts) ? cfg.production_hosts.map(s => String(s).toLowerCase()) : [];

const targets = extractTargetHosts(cmd);

// Hard-deny: any target matches a production host (suffix match for *.example.com style)
for (const t of targets) {
  for (const prod of productionHosts) {
    if (!prod || prod.startsWith('REPLACE_')) continue;  // template placeholder
    if (t === prod || t.endsWith('.' + prod)) {
      preToolBlockMessage(
        `active-scan-guard BLOCKED: active-scan tool '${tool}' targeting PRODUCTION host '${t}' ` +
        `(matched .appsec/config.json production_hosts[]='${prod}'). Production scans are hard-denied even with valid ROE. ` +
        `See SKILL.md §18.2.`
      );
      process.exit(2);
    }
  }
}

// Check active ROE
const activeRoe = cfg.active_roe;
if (!activeRoe || typeof activeRoe !== 'string') {
  preToolBlockMessage(
    `active-scan-guard BLOCKED: active-scan tool '${tool}' invoked but .appsec/config.json.active_roe is null/missing. ` +
    `Active scans require a signed ROE per SKILL.md §18.3. Run pentest-scope-and-roe first.`
  );
  process.exit(2);
}

const projectRoot = pre.projectRoot || process.cwd();
const roePath = path.isAbsolute(activeRoe) ? activeRoe : path.join(projectRoot, activeRoe);
if (!fs.existsSync(roePath)) {
  preToolBlockMessage(
    `active-scan-guard BLOCKED: active_roe='${activeRoe}' but file not found at '${roePath}'. ` +
    `See SKILL.md §18.2.`
  );
  process.exit(2);
}

let roe = '';
try { roe = fs.readFileSync(roePath, 'utf8'); }
catch (e) {
  preToolBlockMessage(`active-scan-guard BLOCKED: cannot read ROE at '${roePath}': ${e.message}`);
  process.exit(2);
}

// Parse in_scope (list under in_scope: ) and time_window (start / end)
function extractList(text, key) {
  const re = new RegExp(`^[ \\t]{0,4}${key}[ \\t]*:[ \\t]*\\[([^\\]]*)\\]`, 'mi');
  const m = text.match(re);
  if (m) {
    return m[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  // Block-list form:
  // in_scope:
  //   - host1
  //   - host2
  const blockRe = new RegExp(`^[ \\t]{0,4}${key}[ \\t]*:[ \\t]*\\n((?:[ \\t]+-[ \\t]*.+\\n?)+)`, 'mi');
  const bm = text.match(blockRe);
  if (bm) {
    return bm[1].split('\n').map(l => l.replace(/^[ \t]+-[ \t]*/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return [];
}

function extractScalar(text, key) {
  const re = new RegExp(`^[ \\t]{0,4}${key}[ \\t]*:[ \\t]*(.+)$`, 'mi');
  const m = text.match(re);
  return m ? m[1].trim().replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '') : null;
}

const inScope = extractList(roe, 'in_scope').concat(extractList(roe, 'scope')).map(s => s.toLowerCase());
const timeStart = extractScalar(roe, 'time_window_start') || extractScalar(roe, 'window_start') || extractScalar(roe, 'start_time');
const timeEnd   = extractScalar(roe, 'time_window_end')   || extractScalar(roe, 'window_end')   || extractScalar(roe, 'end_time');

// Target must be in scope
if (targets.length === 0) {
  preToolBlockMessage(
    `active-scan-guard BLOCKED: could not extract any target host from command '${tool}'. ROE scope cannot be verified.`
  );
  process.exit(2);
}
for (const t of targets) {
  const hit = inScope.find(s => s === t || (s.startsWith('*.') && t.endsWith(s.slice(1))));
  if (!hit) {
    preToolBlockMessage(
      `active-scan-guard BLOCKED: target '${t}' not in ROE in_scope[]=${JSON.stringify(inScope)}. ` +
      `Active scan tool='${tool}'. See SKILL.md §18.2.`
    );
    process.exit(2);
  }
}

// Time window
const now = Date.now();
if (timeStart) {
  const ts = Date.parse(timeStart);
  if (Number.isFinite(ts) && now < ts) {
    preToolBlockMessage(`active-scan-guard BLOCKED: current time before ROE time_window_start='${timeStart}'`);
    process.exit(2);
  }
}
if (timeEnd) {
  const te = Date.parse(timeEnd);
  if (Number.isFinite(te) && now > te) {
    preToolBlockMessage(`active-scan-guard BLOCKED: current time after ROE time_window_end='${timeEnd}'`);
    process.exit(2);
  }
}

// All checks passed
process.exit(0);
