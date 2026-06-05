#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * tools/docs-drift/lint.js
 *
 * Documentation drift linter for the Claude Code harness.
 *
 * Verifies (per docs/CANONICALS.md):
 *
 *   LEGACY (must be ZERO occurrences across watched files):
 *     - "AppSec v2.0"
 *     - "v2.0 Phase"
 *     - "AppSec Orchestrator (v2.0"   (note: trailing paren intentional — matches "v2.0 — ...")
 *     - "<domain>" inside L12 evidence paths (must be <tag>)
 *     - "gate-result.json"            (must be gate-result.yaml)
 *     - "evidence/discoverability/<channel>" flat path (must be <tag>/<channel>)
 *     - "aeo.json" / "geo.json"       (must be ai-search.json / local.json)
 *
 *   CANONICAL (must appear in at least one watched file):
 *     - "AppSec v3.0" or "v3.0 GSD-lite" or "appsec-security-orchestrator v3.0"
 *     - "13 internal validation fields" or "13-item ROE" with dual-track explanation
 *     - "11 user-visible sections" with dual-track explanation
 *     - "gate-result.yaml"
 *     - "<tag>" placeholder in evidence path context
 *
 *   FLAGS (informational, do not block):
 *     - "11-item ROE" without a "dual-track" / "13" companion mention in same file
 *     - "13-item ROE" without a "dual-track" / "11" companion mention in same file
 *
 * Exit codes:
 *   0   all clean
 *   1   drift (any legacy string present, or any required canonical string absent
 *       from every watched file)
 *
 * Uses Node built-ins only (path, fs). No npm deps.
 *
 * Usage:
 *   node tools/docs-drift/lint.js                # default ~/.claude/
 *   node tools/docs-drift/lint.js --root <dir>
 *   node tools/docs-drift/lint.js --json         # machine-readable output
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { root: null, json: false, quiet: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root' && i + 1 < argv.length) {
      args.root = argv[i + 1];
      i += 1;
    } else if (a === '--json') {
      args.json = true;
    } else if (a === '--quiet' || a === '-q') {
      args.quiet = true;
    } else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`docs-drift/lint.js: unknown argument: ${a}`);
      printUsage();
      process.exit(1);
    }
  }
  if (!args.root) args.root = path.join(os.homedir(), '.claude');
  return args;
}

function printUsage() {
  console.error('Usage: node tools/docs-drift/lint.js [--root <claude-dir>] [--json] [--quiet]');
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function existsSync(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch (_e) { return false; }
}

function listFilesRecursive(dir, predicate) {
  const out = [];
  if (!existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (_e) { continue; }
    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile() && (!predicate || predicate(full))) {
        out.push(full);
      }
    }
  }
  return out;
}

function gatherWatchedFiles(claudeRoot) {
  const files = [];
  // Top-level docs
  const topLevel = ['CLAUDE.md', 'SKILLS-INDEX.md'];
  for (const f of topLevel) {
    const full = path.join(claudeRoot, f);
    if (existsSync(full)) files.push(full);
  }
  // manifests/*.json
  const manifestsDir = path.join(claudeRoot, 'manifests');
  files.push(...listFilesRecursive(manifestsDir, (f) => f.endsWith('.json')));
  // rules/*.md (root + subdirs are ok; markdown only)
  const rulesDir = path.join(claudeRoot, 'rules');
  files.push(...listFilesRecursive(rulesDir, (f) => f.endsWith('.md')));
  // docs/*.md
  const docsDir = path.join(claudeRoot, 'docs');
  files.push(...listFilesRecursive(docsDir, (f) => f.endsWith('.md')));
  return Array.from(new Set(files));
}

function relativize(p, root) {
  const norm = path.normalize(p).replace(/\\/g, '/');
  const rootNorm = path.normalize(root).replace(/\\/g, '/');
  if (norm.toLowerCase().startsWith(rootNorm.toLowerCase())) {
    return norm.slice(rootNorm.length).replace(/^\/+/, '');
  }
  return norm;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

// Lines that mention a legacy string in a NEGATIVE-EXAMPLE context (i.e.
// they document that the string is forbidden) are not drift. We detect
// these by surrounding markers on the same line. Authors documenting
// "must be X (NOT Y)" or "❌ Y" or "Forbidden: Y" should not trip the
// linter.
const NEGATIVE_EXAMPLE_MARKERS = [
  /❌/,                    // ❌ (cross mark)
  /✖/,                    // ✖
  /\bNOT\b/,
  /\bMUST NOT\b/i,
  /\bmust be\b/i,              // "must be ai-search.json (NOT aeo.json)"
  /\bForbidden\b/i,
  /\bForbidden filenames?\b/i,
  /\bnever use\b/i,
  /\bBanned\b/i,
  /\bdeprecated\b/i,
  /\bsuperseded\b/i,
  /\blegacy\b/i,
  /\bfrom .*?(v1\.1|v2\.0)\b/i,
  /\(banned per\b/i,
  /\(deprecated\)/i,
];

// Files that exhaustively LIST forbidden strings as their primary
// purpose. Any legacy string occurrence inside these files is treated
// as documentation, not drift. Acts like docs/CANONICALS.md treatment.
const NEGATIVE_EXAMPLE_FILES = [
  /(?:^|[\\/])docs[\\/]CANONICALS\.md$/i,
];

function isNegativeExampleLine(line) {
  if (typeof line !== 'string') return false;
  for (const m of NEGATIVE_EXAMPLE_MARKERS) if (m.test(line)) return true;
  return false;
}

// Some negative-example contexts span multiple lines (e.g. a JSON array
// keyed `forbidden_paths` where each element on its own line lists a
// banned string). Check up to N lines back for an array-key like
// "forbidden_*", "deprecated_*", "legacy_*", "banned_*", or a heading
// like "Forbidden / Legacy / Banned / Deprecated".
function isInNegativeExampleBlock(lines, lineNumber, lookback) {
  const back = lookback || 5;
  const start = Math.max(0, lineNumber - 1 - back);
  for (let i = start; i < lineNumber - 1; i += 1) {
    const ln = lines[i] || '';
    if (
      /\b(forbidden|deprecated|legacy|banned)(_paths|_strings|_filenames|_aliases|_examples)?\b\s*[":]/i.test(ln)
      || /^#+\s*(Forbidden|Legacy|Banned|Deprecated)/i.test(ln)
      || /❌[^\n]*$/.test(ln)
    ) {
      return true;
    }
  }
  return false;
}

function isPrimarilyNegativeExampleFile(absPath) {
  return NEGATIVE_EXAMPLE_FILES.some((re) => re.test(absPath));
}

// Legacy patterns: any occurrence anywhere is a drift error UNLESS the
// match line is a documented negative-example (see isNegativeExampleLine).
// Each pattern uses literal-string contains semantics so we don't
// accidentally match canonical text containing the legacy substring.
const LEGACY_PATTERNS = [
  {
    id: 'appsec_v2_label',
    description: 'Literal "AppSec v2.0" label — superseded by v3.0',
    regex: /AppSec v2\.0\b/g,
  },
  {
    id: 'appsec_v2_phase',
    description: 'Literal "v2.0 Phase" — AppSec is now v3.0',
    regex: /v2\.0 Phase\b/g,
  },
  {
    id: 'appsec_orchestrator_v2',
    description: 'Literal "AppSec Orchestrator (v2.0" — superseded by (v3.0 ...)',
    regex: /AppSec Orchestrator \(v2\.0/g,
  },
  {
    id: 'appsec_security_orchestrator_v2',
    description: 'Literal "appsec-security-orchestrator v2.0" — superseded by v3.0',
    regex: /appsec-security-orchestrator v2\.0\b/g,
  },
  {
    id: 'l12_domain_placeholder',
    description: '<domain> placeholder in L12 evidence path context — must be <tag>',
    // Match <domain> when it appears inside or near a discoverability/L12 evidence path
    // We anchor with surrounding "discoverability" / "evidence/" / "channels" to avoid
    // false positives where <domain> means something else (HTTP domain in a URL example).
    regex: /(?:discoverability\/[^\n`'"]*?<domain>|<domain>[^\n`'"]*?(?:discoverability|seo|aeo|ai-search|local|aso)\b)/g,
  },
  {
    id: 'gate_result_json_extension',
    description: '"gate-result.json" — canonical is gate-result.yaml',
    regex: /gate-result\.json\b/g,
  },
  {
    id: 'l12_flat_channel_path',
    description: 'Flat L12 evidence path "evidence/discoverability/<channel>" without <tag> dimension',
    regex: /evidence\/discoverability\/<channel>/g,
  },
  {
    id: 'l12_aeo_filename',
    description: '"aeo.json" filename — canonical is ai-search.json (L12 v1.2)',
    regex: /\baeo\.json\b/g,
  },
  {
    id: 'l12_geo_filename',
    description: '"geo.json" filename — canonical is local.json (L12 v1.2)',
    regex: /\bgeo\.json\b/g,
  },
];

// Canonical patterns: at least one watched file must match each.
const CANONICAL_PATTERNS = [
  {
    id: 'appsec_v3',
    description: 'AppSec v3.0 marker present',
    regex: /(?:AppSec v3\.0|appsec-security-orchestrator v3\.0|v3\.0 GSD-lite|v3\.0 — GSD-lite|v3\.0 GSD-lite engine|v3\.0 \(GSD-lite|v3\.0 Phase 6)/i,
  },
  {
    id: 'gate_result_yaml',
    description: 'gate-result.yaml canonical filename present',
    regex: /gate-result\.yaml\b/,
  },
  {
    id: 'l12_tag_dimension',
    description: '<tag> dimension in L12 evidence path present',
    // Match `evidence/discoverability/<tag>` OR a path with <tag> + L12 channels
    regex: /evidence\/discoverability\/<tag>|<tag>\/(?:seo|ai-search|local|aso)\.json/,
  },
  {
    id: 'roe_dual_track_11_or_13',
    description: 'Either "11 user-visible" or "13 internal" ROE dual-track explanation present somewhere',
    regex: /(?:11 user-visible sections|13 internal (?:validation )?fields|11 sections.*13 internal|13 internal.*11 sections)/i,
  },
];

// Per-file flags: each file that mentions one side of the ROE count should
// also acknowledge the dual track, OR carry "dual-track" / the other count.
const ROE_FLAG_RULES = [
  {
    id: 'roe_11_without_dual',
    description: 'Mentions "11-item ROE" without dual-track / 13 explanation in same file',
    triggerRegex: /11-item ROE\b/g,
    counterRegex: /(?:dual[- ]track|13 internal|13-item)/i,
  },
  {
    id: 'roe_13_without_dual',
    description: 'Mentions "13-item ROE" without dual-track / 11 explanation in same file',
    triggerRegex: /13-item ROE\b/g,
    counterRegex: /(?:dual[- ]track|11 user-visible|11-item|11 sections)/i,
  },
];

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

function scanFile(absPath, claudeRoot) {
  const rel = relativize(absPath, claudeRoot);
  const raw = fs.readFileSync(absPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const findings = [];

  // Files like docs/CANONICALS.md exhaustively LIST forbidden strings as
  // their primary purpose — any occurrence inside them is documentation,
  // not drift. Skip legacy scans entirely for those files.
  const skipLegacy = isPrimarilyNegativeExampleFile(absPath);

  // Legacy scans
  if (!skipLegacy) {
    for (const pat of LEGACY_PATTERNS) {
      let m;
      // We need .lastIndex behavior, so rebuild per-iteration with global
      const re = new RegExp(pat.regex.source, pat.regex.flags);
      while ((m = re.exec(raw)) !== null) {
        const idx = m.index;
        const lineNumber = raw.slice(0, idx).split(/\r?\n/).length;
        const line = lines[lineNumber - 1] || '';
        // Skip lines that are explicit negative examples (documenting
        // that the matched string is forbidden — e.g. "❌ aeo.json").
        if (isNegativeExampleLine(line)) continue;
        // Skip matches inside a multi-line negative-example block
        // (e.g. JSON array keyed `forbidden_paths`).
        if (isInNegativeExampleBlock(lines, lineNumber, 5)) continue;
        findings.push({
          level: 'error',
          rule: pat.id,
          description: pat.description,
          file: rel,
          line: lineNumber,
          snippet: line.trim().slice(0, 200),
          match: m[0],
        });
      }
    }
  }

  // ROE dual-track flags (per file)
  for (const rule of ROE_FLAG_RULES) {
    const triggerRe = new RegExp(rule.triggerRegex.source, rule.triggerRegex.flags);
    const hits = [];
    let m;
    while ((m = triggerRe.exec(raw)) !== null) {
      const idx = m.index;
      const lineNumber = raw.slice(0, idx).split(/\r?\n/).length;
      hits.push({ line: lineNumber, snippet: (lines[lineNumber - 1] || '').trim().slice(0, 200) });
    }
    if (hits.length > 0 && !rule.counterRegex.test(raw)) {
      for (const h of hits) {
        findings.push({
          level: 'warn',
          rule: rule.id,
          description: rule.description,
          file: rel,
          line: h.line,
          snippet: h.snippet,
        });
      }
    }
  }

  return findings;
}

function main() {
  const args = parseArgs(process.argv);
  const claudeRoot = path.normalize(args.root);
  const verbose = !args.quiet;

  if (!existsSync(claudeRoot)) {
    if (args.json) {
      console.log(JSON.stringify({ ok: false, error: `claude_root not found: ${claudeRoot}` }, null, 2));
    } else {
      console.error(`docs-drift/lint.js: claude_root not found: ${claudeRoot}`);
    }
    process.exit(1);
  }

  const files = gatherWatchedFiles(claudeRoot);
  if (verbose && !args.json) {
    console.log(`Scanning ${files.length} files under ${claudeRoot}...`);
  }

  // Collect per-file findings + raw text for canonical-coverage check
  const allFindings = [];
  const canonicalHits = new Map();
  for (const p of CANONICAL_PATTERNS) canonicalHits.set(p.id, []);

  for (const f of files) {
    const findings = scanFile(f, claudeRoot);
    allFindings.push(...findings);
    let raw;
    try { raw = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    for (const pat of CANONICAL_PATTERNS) {
      if (pat.regex.test(raw)) {
        canonicalHits.get(pat.id).push(relativize(f, claudeRoot));
      }
    }
  }

  // Canonical coverage errors
  for (const pat of CANONICAL_PATTERNS) {
    if (canonicalHits.get(pat.id).length === 0) {
      allFindings.push({
        level: 'error',
        rule: `missing_canonical:${pat.id}`,
        description: `Required canonical string absent from all watched files — ${pat.description}`,
        file: '(no file)',
        line: 0,
        snippet: '',
      });
    }
  }

  const errors = allFindings.filter((f) => f.level === 'error');
  const warns = allFindings.filter((f) => f.level === 'warn');

  if (args.json) {
    console.log(JSON.stringify({
      ok: errors.length === 0,
      claude_root: claudeRoot,
      files_scanned: files.length,
      errors,
      warnings: warns,
      canonical_coverage: Array.from(canonicalHits.entries()).map(([id, hits]) => ({ id, hits })),
    }, null, 2));
    process.exit(errors.length === 0 ? 0 : 1);
  }

  if (verbose) {
    console.log('--- docs-drift lint summary ---');
    console.log(`claude_root:        ${claudeRoot}`);
    console.log(`files scanned:      ${files.length}`);
    console.log(`errors:             ${errors.length}`);
    console.log(`warnings:           ${warns.length}`);
    console.log('');
  }

  for (const w of warns) {
    console.warn(`WARN  ${w.file}:${w.line}  [${w.rule}]  ${w.description}`);
    if (w.snippet) console.warn(`        ${w.snippet}`);
  }
  for (const e of errors) {
    console.error(`ERROR ${e.file}:${e.line}  [${e.rule}]  ${e.description}`);
    if (e.snippet) console.error(`        ${e.snippet}`);
    if (e.match)   console.error(`        match: ${e.match}`);
  }

  if (errors.length === 0 && warns.length === 0 && verbose) {
    console.log('docs-drift lint: OK (no drift, all canonical strings present)');
  } else if (verbose) {
    console.log('');
    console.log(`docs-drift lint: ${errors.length} error(s), ${warns.length} warning(s)`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
