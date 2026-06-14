#!/usr/bin/env node
/**
 * evidence-export.js — dependency-free industry-format evidence export adapter.
 *
 * WHY (Wave 2, T2.2): harness evidence is collected as custom YAML/JSON (canonical).
 * External tooling (SIEM, SCA, CI dashboards) expects SARIF 2.1.0, CycloneDX 1.5, or
 * JUnit XML. This adapter converts already-collected harness evidence (passed as JSON)
 * into those formats without touching the canonical store — the canonical files stay as
 * written by the SDK. This is a READ-ONLY export view.
 *
 * Usage: node evidence-export.js --format <sarif|cyclonedx|junit> [<input.json>]
 *        (no file arg → read stdin)
 *
 * Exit codes: 0 = wrote output  ·  2 = bad input / unknown format / read error
 * Dependency-free: built-in Node only (fs, path). No npm. No node_modules.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ★ R3 adversarial-sweep hardening (2026-06-14): this exporter previously passed every finding
// field straight through — raw secrets (sk-proj-…, AKIA…, PEM, JWT, credential KV) leaked into
// SARIF/SBOM/JUnit output. Now every output string value is redacted at this single choke point.
// Zero-width / BOM / soft-hyphen chars are stripped FIRST so a split token (sk-proj-abc<U+200B>def)
// is rejoined and caught (mirrors the R1 BOM-anywhere fix). Patterns kept in lock-step with
// appsec-sdk contains_raw_secret / redact_stdin.
const ZERO_WIDTH_RE = /[​‌‍⁠﻿­]/g;
const SECRET_RES = [
  /AKIA[0-9A-Z]{16}/g,
  /ASIA[0-9A-Z]{16}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,                       // GitHub fine-grained PAT
  /glpat-[A-Za-z0-9_-]{20,}/g,                           // GitLab PAT
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,                       // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g,    // OpenAI
  /[sr]k_live_[A-Za-z0-9]{20,}/g,                        // Stripe live secret/restricted
  /AIza[A-Za-z0-9_-]{30,}/g,                             // Google API key
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}/gi,           // bearer token
  /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s/:@]+:[^\s/:@]+@/g, // user:pass@ in a URL
];
function redactSecrets(s) {
  if (typeof s !== 'string' || !s) return s;
  let out = s.replace(ZERO_WIDTH_RE, '');
  for (const re of SECRET_RES) out = out.replace(re, '<REDACTED:secret>');
  // credential KV (PASSWORD/SECRET/TOKEN/API_KEY/PRIVATE_KEY = value{8,})
  out = out.replace(/\b(PASSWORD|PASSWD|PWD|SECRET|SECRET_KEY|CLIENT_SECRET|TOKEN|API_KEY|APIKEY|ACCESS_KEY|ACCESSKEY|ACCOUNTKEY|PRIVATE_KEY)\b(\s*[:=]\s*)(\S{8,})/gi,
    (_m, k, sep) => `${k}${sep}<REDACTED:credential>`);
  return out;
}

/** Safely coerce any value to a non-empty string (REDACTED), or return the fallback. */
function str(v, fallback = '') {
  if (v == null) return fallback;
  const s = redactSecrets(String(v).trim());
  return s.length ? s : fallback;
}

/** Read `field1` first, then `field2` (defensive alias resolution). */
function pick(obj, field1, field2, fallback) {
  if (obj == null) return fallback;
  if (obj[field1] != null) return obj[field1];
  if (field2 != null && obj[field2] != null) return obj[field2];
  return fallback;
}

/** Ensure value is an array; wrap non-array non-null values. */
function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------------------------------------------------------------------------
// XML escaping (hand-emit only — no xml lib)
// ---------------------------------------------------------------------------
const XML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

function xmlEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => XML_ESC[c]);
}

// ---------------------------------------------------------------------------
// SARIF 2.1.0 export
// ---------------------------------------------------------------------------
const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const SARIF_SEVERITY_MAP = {
  critical: 'error',
  high:     'error',
  medium:   'warning',
  low:      'note',
};

function severityToSarif(sev) {
  return SARIF_SEVERITY_MAP[str(sev).toLowerCase()] || 'none';
}

function exportSarif(input) {
  // Accept array of findings or {findings:[...]}
  const findings = Array.isArray(input)
    ? input
    : toArray(pick(input, 'findings', null, []));

  const rules = [];
  const results = [];
  const ruleIds = new Set();

  for (const f of findings) {
    if (f == null || typeof f !== 'object') continue;

    const ruleId = str(pick(f, 'id', 'finding_id', ''), 'UNKNOWN');
    const title  = str(f.title, ruleId);
    const sev    = str(f.severity, 'low');
    const level  = severityToSarif(sev);
    const desc   = str(pick(f, 'description', 'reason', ''), '');
    const file   = str(pick(f, 'file', 'location', ''), '');
    const line   = f.line != null ? Number(f.line) : undefined;
    const asvs   = toArray(f.asvs_mapping);
    const csf    = str(f.csf_function, '');

    // Deduplicate rules
    if (!ruleIds.has(ruleId)) {
      ruleIds.add(ruleId);
      rules.push({
        id: ruleId,
        name: title,
        shortDescription: { text: title },
        defaultConfiguration: { level },
      });
    }

    // Build result object
    const result = {
      ruleId,
      level,
      message: { text: desc || title },
      properties: {},
    };

    if (asvs.length) result.properties.asvs_mapping = asvs;
    if (csf)         result.properties.csf_function = csf;

    if (file) {
      const loc = { physicalLocation: { artifactLocation: { uri: file, uriBaseId: '%SRCROOT%' } } };
      if (line != null && !isNaN(line)) {
        loc.physicalLocation.region = { startLine: line };
      }
      result.locations = [loc];
    }

    if (!Object.keys(result.properties).length) delete result.properties;

    results.push(result);
  }

  return {
    version: '2.1.0',
    $schema: SARIF_SCHEMA,
    runs: [{
      tool: {
        driver: {
          name: 'claude-harness-appsec',
          rules,
        },
      },
      results,
    }],
  };
}

// ---------------------------------------------------------------------------
// CycloneDX 1.5 JSON SBOM export
// ---------------------------------------------------------------------------
function exportCycloneDx(input) {
  // Accept array or {components:[...]}
  const raw = Array.isArray(input)
    ? input
    : toArray(pick(input, 'components', null, []));

  const components = [];
  for (const c of raw) {
    if (c == null || typeof c !== 'object') continue;
    const name    = str(c.name, 'unknown');
    const version = str(c.version, '');
    const type    = str(c.type, 'library');
    const purl    = str(c.purl, '');
    const comp = { type, name };
    if (version) comp.version = version;
    if (purl)    comp.purl    = purl;
    components.push(comp);
  }

  return {
    bomFormat:   'CycloneDX',
    specVersion: '1.5',
    version:     1,
    components,
  };
}

// ---------------------------------------------------------------------------
// JUnit XML export (hand-emitted, properly XML-escaped)
// ---------------------------------------------------------------------------
function exportJunit(input) {
  // Accept {suites:[{name,tests:[...]}]} or flat {tests:[...]}
  let suites;
  if (Array.isArray(input)) {
    suites = [{ name: 'harness', tests: input }];
  } else if (input && Array.isArray(input.suites)) {
    suites = input.suites;
  } else {
    suites = [{ name: 'harness', tests: toArray(pick(input, 'tests', null, [])) }];
  }

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<testsuites>'];

  for (const suite of suites) {
    if (suite == null || typeof suite !== 'object') continue;
    const suiteName = str(suite.name, 'suite');
    const tests     = toArray(suite.tests);
    let failures = 0, skipped = 0;

    // Pre-count for attributes
    for (const t of tests) {
      const st = str(pick(t, 'status', null, 'pass')).toLowerCase();
      if (st === 'fail') failures++;
      else if (st === 'skip' || st === 'skipped') skipped++;
    }

    lines.push(
      `  <testsuite name="${xmlEsc(suiteName)}" tests="${tests.length}" ` +
      `failures="${failures}" skipped="${skipped}">`
    );

    for (const t of tests) {
      if (t == null || typeof t !== 'object') continue;
      const name   = str(pick(t, 'name', null, 'unnamed'));
      const status = str(pick(t, 'status', null, 'pass')).toLowerCase();
      const time   = t.time != null ? ` time="${xmlEsc(t.time)}"` : '';
      const msg    = str(t.message, '');

      lines.push(`    <testcase name="${xmlEsc(name)}"${time}>`);
      if (status === 'fail') {
        lines.push(`      <failure message="${xmlEsc(msg || 'test failed')}"/>`);
      } else if (status === 'skip' || status === 'skipped') {
        lines.push('      <skipped/>');
      }
      lines.push('    </testcase>');
    }

    lines.push('  </testsuite>');
  }

  lines.push('</testsuites>');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Public library API
// ---------------------------------------------------------------------------
/**
 * convert(format, input) → string (JSON or XML)
 * Throws Error on unknown format.
 */
function convert(format, input) {
  let out;
  switch (format) {
    case 'sarif':
      out = JSON.stringify(exportSarif(input), null, 2); break;
    case 'cyclonedx':
      out = JSON.stringify(exportCycloneDx(input), null, 2); break;
    case 'junit':
      out = exportJunit(input); break;
    default:
      throw new Error(`Unknown format '${format}'. Supported: sarif, cyclonedx, junit`);
  }
  // ★ R3 — final-pass redaction over the FULLY-SERIALIZED output, so any field that bypassed the
  // per-field str() choke point (CycloneDX purl, SARIF properties / rule metadata, nested objects)
  // is still scrubbed before the secret ever reaches disk / a SIEM. <REDACTED:…> is JSON/XML-safe.
  return redactSecrets(out);
}

module.exports = { convert, exportSarif, exportCycloneDx, exportJunit, xmlEsc };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  let format = null;
  let inputFile = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--format' || argv[i] === '-f') {
      format = argv[++i];
    } else if (argv[i].startsWith('--format=')) {
      format = argv[i].slice('--format='.length);
    } else if (!argv[i].startsWith('-')) {
      inputFile = argv[i];
    } else {
      process.stderr.write(`[evidence-export] Unknown flag: ${argv[i]}\n`);
      process.exit(2);
    }
  }

  if (!format) {
    process.stderr.write(
      'Usage: node evidence-export.js --format <sarif|cyclonedx|junit> [<input.json>]\n' +
      '       (no file arg → read stdin)\n'
    );
    process.exit(2);
  }

  let rawText;
  try {
    if (inputFile) {
      rawText = fs.readFileSync(inputFile, 'utf8');
    } else {
      // Cross-platform stdin: read fd 0 synchronously (works on Windows + POSIX).
      const chunks = [];
      let buf;
      const CHUNK = 65536;
      do {
        buf = Buffer.alloc(CHUNK);
        let n = 0;
        try { n = fs.readSync(0, buf, 0, CHUNK, null); } catch { n = 0; }
        if (n > 0) chunks.push(buf.slice(0, n));
        else break;
      } while (buf.length === CHUNK);
      rawText = Buffer.concat(chunks).toString('utf8');
    }
  } catch (e) {
    process.stderr.write(`[evidence-export] Read error: ${e.message}\n`);
    process.exit(2);
  }

  let input;
  try {
    input = JSON.parse(rawText);
  } catch (e) {
    process.stderr.write(`[evidence-export] JSON parse error: ${e.message}\n`);
    process.exit(2);
  }

  let output;
  try {
    output = convert(format, input);
  } catch (e) {
    process.stderr.write(`[evidence-export] ${e.message}\n`);
    process.exit(2);
  }

  process.stdout.write(output);
  process.exit(0);
}
