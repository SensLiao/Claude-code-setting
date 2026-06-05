#!/usr/bin/env node
// appsec-finding-schema-prewrite — PreToolUse(Write|Edit) hook (sync block, exit 2)
// SKILL.md §18.5a. Canonical write path for .appsec/findings/** is `appsec-sdk finding.add`.
// Direct Write/Edit is blocked unless content begins with the marker `# written-by: appsec-sdk@<version>`.
// Also pre-validates schema v1.0: required fields, ASVS 5.0 regex, raw-secret absence.

'use strict';

const path = require('path');
const {
  readInputSafe, preflight, detectSecrets, matchesProtectedPath, preToolBlockMessage,
} = require('./_appsec-common.js');

// ★ P7 fix (Tier 1 #1): fail-closed on JSON parse failure (was: silently {} → bypass)
const { input, parseError } = readInputSafe();
if (parseError) {
  preToolBlockMessage(`finding-schema-prewrite fail-closed: stdin JSON parse failed (${parseError})`);
  process.exit(2);
}
const pre = preflight(input);
if (pre.mode === 'silent') process.exit(0);

const toolName = input.tool_name || input.tool || '';
// ★ E7 codex hooks finding HIGH-3 (2026-06-05): MultiEdit was uncovered → a direct MultiEdit to a
// protected .appsec finding/decision bypassed this guard entirely. It is now an edit-class tool.
// (Matcher in hook-registry.json / SKILL.md §18.5a updated to Write|Edit|MultiEdit in lockstep.)
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit']);
if (toolName !== 'Write' && !EDIT_TOOLS.has(toolName)) process.exit(0);

const tinp = input.tool_input || {};
const filePath = tinp.file_path || tinp.path || '';

// ★ P7 fix (Tier 1 #3): path-matcher must use path.resolve + case-insensitive compare,
// otherwise `.APPSEC/` (Windows) or `../../.appsec/` bypasses the block.
const projectRoot = pre.projectRoot || process.cwd();
const isFinding  = matchesProtectedPath(filePath, projectRoot, '.appsec', 'findings');
const isDecision = matchesProtectedPath(filePath, projectRoot, '.appsec', 'decisions');
if (!isFinding && !isDecision) process.exit(0);

if (pre.mode === 'fail-closed') {
  preToolBlockMessage(`finding-schema-prewrite fail-closed: ${pre.reason}`);
  process.exit(2);
}

// ★ E7 codex hooks finding HIGH-2 (2026-06-05): block Edit/MultiEdit OUTRIGHT on protected paths
// (mirrors qa-bundle-write-guard). A partial edit can place the marker as the first line of
// `new_string` while injecting attacker-controlled content elsewhere, and snippet-level schema
// validation only inspects the replacement, not the resulting artifact. Canonical write path is
// `appsec-sdk finding.add` / gate.check (Bash — bypasses this Write/Edit matcher by design); a
// model never legitimately partial-edits these files.
if (EDIT_TOOLS.has(toolName)) {
  preToolBlockMessage(
    `finding-schema-prewrite BLOCKED: direct ${toolName} of a protected .appsec finding/decision ` +
    `file (${filePath}) is not allowed. These artifacts are written wholesale by ` +
    `\`appsec-sdk finding.add\` / gate.check, never partially edited. Use the SDK write path.`
  );
  process.exit(2);
}

const content = (tinp.content || '');   // only Write reaches here (Edit/MultiEdit blocked above)

// ★ P7 fix (drift D-005): require marker on FIRST LINE only (anywhere = trivially spoofable).
const FIRST_LINE_MARKER_RE = /^#\s*written-by:\s*appsec-sdk@\S+/;
const firstLine = content.split('\n', 1)[0] || '';
if (!FIRST_LINE_MARKER_RE.test(firstLine)) {
  preToolBlockMessage(
    `finding-schema-prewrite BLOCKED: direct ${toolName} to ${filePath} not permitted. ` +
    `Use \`appsec-sdk finding.add\` (canonical write path per SKILL.md §18.5a). ` +
    `If you are intentionally writing an sdk-stamped artifact, the first line MUST be ` +
    `\`# written-by: appsec-sdk@<version>\` exactly.`
  );
  process.exit(2);
}

// ── D1: canonical gate-result/verdict files written under .appsec/decisions/** are
// schema-validated at WRITE TIME against gate-decision.schema (complements appsec-sdk
// gate.check, which validates the rich appsec_release_decision.yaml at CONSUMPTION time).
//
// IMPORTANT SCOPE: the canonical verdict schema (decision/reason/evidence_refs/timestamp/
// gate_tag — the 7-value harness vocabulary) is a DIFFERENT artifact from the rich
// appsec_release_decision.yaml (release_tag/csf2_coverage/redaction/...). Blindly running
// verdict-validator on the rich decision file would fail-closed on EVERY legit write
// (additionalProperties:false + missing required fields). So we POSITIVELY detect a
// canonical-shaped verdict — it must declare `gate_tag:` AND `evidence_refs:` AND NOT
// carry the rich-decision markers (`csf2_coverage:` / `release_tag:` / `decided_by:`).
// Only then do we validate. Anything that is NOT positively canonical keeps the existing
// behavior (marker check already ran above) — additive, never widens rejection of the
// rich decision file. Validator is loaded lazily so a missing validator never breaks the
// finding/marker path (it degrades to the prior behavior + a stderr note).
if (isDecision && /\.(ya?ml)$/i.test(filePath)) {
  const strippedDec = content.replace(/^\s*#.*$/gm, '').replace(/\s+#.*$/gm, '');
  const hasGateTag      = /^[ \t]{0,4}gate_tag[ \t]*:/m.test(strippedDec);
  const hasEvidenceRefs = /^[ \t]{0,4}evidence_refs[ \t]*:/m.test(strippedDec);
  const looksRich = /^[ \t]{0,4}(csf2_coverage|release_tag|decided_by|findings_summary)[ \t]*:/m.test(strippedDec);
  const looksCanonical = hasGateTag && hasEvidenceRefs && !looksRich;

  if (looksCanonical) {
    let V = null;
    try { V = require(path.join(require('os').homedir(), '.claude', 'schemas', 'verdict-validator.js')); }
    catch (_) { /* validator unavailable — degrade gracefully (do NOT block on infra gap) */ }
    const validatorUsable = V && typeof V.validateVerdict === 'function' && typeof V.parseFlatYamlV2 === 'function';
    if (validatorUsable) {
      let obj = null;
      try {
        obj = V.parseFlatYamlV2(strippedDec);
      } catch (e) {
        // fail-closed: an unparseable canonical-shaped gate artifact in a gate context is a block
        preToolBlockMessage(
          `finding-schema-prewrite BLOCKED: ${filePath} looks like a canonical gate-result ` +
          `(has gate_tag + evidence_refs) but is not parseable flat-YAML: ${e.message}. ` +
          `Use the SDK write path; gate-result.yaml must be flat (see gate-decision.schema).`
        );
        process.exit(2);
      }
      // ★ E7 codex hooks finding MEDIUM-2 (2026-06-05): a throwing or malformed-shape validator
      // must fail-closed (exit 2), NOT crash to an uncaught exception (exit 1, which lets the
      // write proceed). Wrap the call AND guard the result shape (no res / res.errors undefined).
      let res;
      try {
        res = V.validateVerdict(obj, {});
      } catch (e) {
        preToolBlockMessage(
          `finding-schema-prewrite BLOCKED: ${filePath} canonical gate-result validation threw ` +
          `(${e && e.message}); fail-closed. Use the SDK write path.`
        );
        process.exit(2);
      }
      if (!res || res.ok !== true) {
        const errs = (res && Array.isArray(res.errors)) ? res.errors.join('\n  - ') : 'validator returned no parseable result';
        preToolBlockMessage(
          `finding-schema-prewrite BLOCKED: ${filePath} fails gate-decision.schema validation:\n  - ` +
          `${errs}\n` +
          `(canonical gate-result vocabulary — decision/reason/evidence_refs/timestamp/gate_tag).`
        );
        process.exit(2);
      }
    } else {
      // ★ E7 codex hooks finding MEDIUM-1 (2026-06-05): validator missing OR present-but-incomplete
      // (partial exports) must NOT silently skip a POSITIVELY canonical-shaped gate artifact. Emit
      // an explicit NOTE (non-silent) and degrade to the marker check already enforced above; the
      // authoritative fail-closed schema gate is `appsec-sdk gate.check` at consumption time.
      process.stderr.write(
        `[appsec] finding-schema-prewrite NOTE: verdict-validator.js ${V ? 'missing required exports' : 'not found'} — ` +
        `skipped canonical schema check for ${filePath} (marker check still enforced; ` +
        `appsec-sdk gate.check remains the fail-closed gate).\n`
      );
    }
  }
}

// For findings, also pre-validate schema v1.0
if (isFinding && /\.yaml$/i.test(filePath)) {
  // Strip comments before pattern checks
  const stripped = content.replace(/^\s*#.*$/gm, '').replace(/\s+#.*$/gm, '');

  // ASVS 4.x detection
  if (/\bV\d+\.\d+\.\d+\b/.test(stripped)) {
    preToolBlockMessage(
      `finding-schema-prewrite BLOCKED: ASVS 4.x identifier detected (V<n>.<n>.<n>) in finding body. ` +
      `Migrate to ASVS 5.0 format v5.0.0-<chapter>.<section>.<requirement>. See SKILL.md §6.1.`
    );
    process.exit(2);
  }

  // ASVS 5.0 regex check on asvs_mapping entries
  const asvsBlock = stripped.match(/asvs_mapping\s*:\s*\[([^\]]*)\]/);
  if (asvsBlock) {
    const entries = asvsBlock[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    for (const e of entries) {
      if (!/^v5\.0\.0-\d+\.\d+\.\d+$/.test(e)) {
        preToolBlockMessage(
          `finding-schema-prewrite BLOCKED: asvs_mapping entry '${e}' does not match ^v5\\.0\\.0-\\d+\\.\\d+\\.\\d+$`
        );
        process.exit(2);
      }
    }
  }

  // Raw secret detection
  const secrets = detectSecrets(stripped);
  if (secrets.length > 0) {
    preToolBlockMessage(
      `finding-schema-prewrite BLOCKED: raw secret patterns detected in finding body: ` +
      `${secrets.map(s => s.name).join(', ')}. Pipe through \`appsec-sdk redact\` first.`
    );
    process.exit(2);
  }

  // Required fields presence
  const required = ['schema_version', 'id', 'source', 'detector', 'severity', 'confidence', 'asvs_mapping', 'csf_function', 'description'];
  const missing = required.filter(k => !new RegExp(`^[ \\t]{0,4}${k}[ \\t]*:`, 'm').test(stripped));
  if (missing.length > 0) {
    preToolBlockMessage(
      `finding-schema-prewrite BLOCKED: required schema v1.0 fields missing: ${missing.join(', ')}`
    );
    process.exit(2);
  }
}

// All checks passed
process.exit(0);
