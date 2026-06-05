#!/usr/bin/env node
'use strict';

/**
 * tests/harness/sdk-matrix.test.js
 *
 * For each SDK declared in manifests/skills.manifest.json `sdks` block:
 *   - verify the SDK file exists
 *   - for SDKs that declare a `commands` array, verify each command appears
 *     in the SDK source (as a case branch or a function definition)
 *
 * Cmd matching strategy (built-in regex only — no parser):
 *   bash SDK: case "<cmd>"   |  cmd_<cmd-sanitized>()
 *   python SDK: "<cmd>": cmd_<sanitized>  |  case "<cmd>":  |  if cmd == "<cmd>"
 */

const path = require('path');
const H = require('./_helpers');

const h = new H.Harness('sdk-matrix');

const SKILLS_MANIFEST = path.join(H.claudeRoot, 'manifests', 'skills.manifest.json');
if (!H.existsSync(SKILLS_MANIFEST)) {
  h.error(`Missing: ${H.rel(SKILLS_MANIFEST)}`);
  process.exit(h.exit());
}

let manifest;
try {
  manifest = H.readJson(SKILLS_MANIFEST);
} catch (e) {
  h.error('skills.manifest.json parse error', e.message);
  process.exit(h.exit());
}

const sdks = manifest.sdks || {};
if (!Object.keys(sdks).length) {
  h.error('skills.manifest.json has no sdks block');
  process.exit(h.exit());
}

/**
 * Build a regex that matches a command in SDK source. Tolerant of either
 *   - exact match `init` → "init", or
 *   - prefix variants `evidence.validate` matches `evidence.validate-presence`
 *     (only when the canonical-prefix flag is set).
 *
 * We do NOT use the prefix variant by default — we require exact match in
 * the case-dispatch table OR a matching cmd_<sanitized> function name.
 */
function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitize(cmd) {
  // dot or hyphen → underscore (bash/python function name)
  return cmd.replace(/[.\-]/g, '_');
}

/**
 * Check a single command's presence in source. Returns:
 *   { found: true, where: 'case'|'function'|'prefix'|'string-key' }
 *   { found: false }
 */
function commandPresence(src, cmd) {
  const escaped = escapeForRegex(cmd);
  const fnName = `cmd_${sanitize(cmd)}`;

  // 1) bash case branch — e.g. `evidence.append)  cmd_evidence_append`
  //    or `case "<cmd>"`
  const caseBranchBash = new RegExp(`\\b${escaped}\\)\\s*cmd_`, 'm');
  if (caseBranchBash.test(src)) return { found: true, where: 'bash-case' };

  // 2) bash `"<cmd>")` inside case-statement (quoted)
  const caseQuotedBash = new RegExp(`["\']${escaped}["\']\\)`, 'm');
  if (caseQuotedBash.test(src)) return { found: true, where: 'bash-case-quoted' };

  // 3) python dict key e.g. `"evidence.append": cmd_evidence_append`
  const pythonDictKey = new RegExp(`["\']${escaped}["\']\\s*:`, 'm');
  if (pythonDictKey.test(src)) return { found: true, where: 'python-dict-key' };

  // 4) function definition matching cmd_<sanitized>
  //    bash:   `cmd_x()` `function cmd_x`
  //    python: `def cmd_x(`
  const fnBash = new RegExp(`\\b${fnName}\\s*\\(\\s*\\)`, 'm');
  const fnPyDef = new RegExp(`\\bdef\\s+${fnName}\\s*\\(`, 'm');
  if (fnBash.test(src)) return { found: true, where: 'bash-fn' };
  if (fnPyDef.test(src)) return { found: true, where: 'python-fn' };

  // 5) Tolerant prefix match — only counts as a partial hit. Surfaces drift
  //    where SDK has `evidence.validate-presence` and manifest wants
  //    `evidence.validate`. Detects both quoted and unquoted bash case forms.
  const prefixQuoted = new RegExp(`["\']${escaped}[\\-.][a-z0-9_-]+["\']`, 'm');
  if (prefixQuoted.test(src)) {
    const m = src.match(new RegExp(`["\']${escaped}[\\-.][a-z0-9_-]+["\']`));
    return { found: true, where: 'prefix-variant', actual: m ? m[0] : null };
  }
  // Unquoted bash case branch: `evidence.validate-presence)`
  const prefixUnquoted = new RegExp(
    `^\\s*${escaped}[\\-.][a-z0-9_-]+\\)\\s*cmd_`, 'm'
  );
  if (prefixUnquoted.test(src)) {
    const m = src.match(new RegExp(`${escaped}[\\-.][a-z0-9_-]+`));
    return { found: true, where: 'prefix-variant', actual: m ? m[0] : null };
  }

  return { found: false };
}

// --- iterate every SDK declared in the manifest -------------------------
for (const [subsystem, decl] of Object.entries(sdks)) {
  h.section(`SDK: ${subsystem}`);
  const sdkPath = decl.path;
  if (!sdkPath) {
    h.fail(`sdks.${subsystem}.path missing`);
    continue;
  }
  const full = path.isAbsolute(sdkPath)
    ? sdkPath
    : path.join(H.claudeRoot, sdkPath);
  if (!H.existsSync(full)) {
    h.fail(`SDK file does not exist on disk: ${H.rel(full)}`);
    continue;
  }
  h.ok(`SDK file exists: ${H.rel(full)}`);

  const commands = decl.commands;
  if (!Array.isArray(commands) || commands.length === 0) {
    h.assertSoft(true, `SDK ${subsystem} declares no commands array — skipping command matrix`);
    continue;
  }

  let src;
  try { src = H.readText(full); }
  catch (e) {
    h.error(`Could not read SDK source ${H.rel(full)}`, e.message);
    continue;
  }

  for (const cmd of commands) {
    const hit = commandPresence(src, cmd);
    if (hit.found && hit.where !== 'prefix-variant') {
      h.ok(`  ${subsystem}.${cmd}  (found: ${hit.where})`);
    } else if (hit.found && hit.where === 'prefix-variant') {
      const hint = hit.actual ? `SDK has prefix-variant: ${hit.actual}` : null;
      h.fail(`  ${subsystem}.${cmd}  declared in manifest but SDK only has prefix-variant`, hint);
    } else {
      h.fail(`  ${subsystem}.${cmd}  not found in ${H.rel(full)}`);
    }
  }
}

process.exit(h.exit());
