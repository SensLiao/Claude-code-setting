#!/usr/bin/env node
/*
 * security-viz — Security Visualization generator.
 *
 * Renders security DIAGRAMS from EXISTING fact-sources. It NEVER parses code
 * (that is arch-viz's job, via tree-sitter). It reads security artifacts that
 * other harness components already emit, and renders Mermaid + markdown.
 *
 * Pure Node. No external npm deps — only fs/path. The harness avoids deps.
 *
 * Subcommands:
 *   agent-risk-graph [--harness <dir>] [--out <file>]
 *   vuln-board <tag> [--project <dir>] [--out <file>]
 *   evidence-dashboard <tag> [--project <dir>] [--out <file>]
 *   pentest-scope-map [<roe-file>] [--project <dir>] [--out <file>]
 *   all <tag> [--project <dir>] [--harness <dir>]
 *
 * Project-scoped diagrams write to <project>/.appsec/evidence/<tag>/viz/.
 * agent-risk-graph reads the GLOBAL harness registry and writes to --out
 * (default <cwd>/security-agent-risk-graph.md).
 *
 * Honesty contract: diagrams are rendered FROM fact-sources. An empty or
 * missing fact-source produces a clear message (never fabricated nodes). A
 * missing fact-source for a project-scoped command exits non-zero.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

// ───────────────────────────── small utilities ─────────────────────────────

function die(msg, code) {
  process.stderr.write('security-viz: ' + msg + '\n');
  process.exit(code === undefined ? 1 : code);
}

function info(msg) {
  process.stderr.write(msg + '\n');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return null;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (e) {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function safeTag(tag) {
  if (!tag || !SAFE_NAME.test(tag)) {
    die('invalid release tag "' + (tag === undefined ? '' : tag) +
      '" — must match ^[A-Za-z0-9._-]+$ (no slashes, no spaces).', 2);
  }
  return tag;
}

// Sanitize a string for safe inclusion inside a Mermaid node/edge label.
// Mermaid breaks on quotes, backticks, pipes, angle brackets, parens, braces.
function mlabel(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/[`]/g, "'")
    .replace(/[<>]/g, '')
    .replace(/[|]/g, '/')
    .replace(/[(){}[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Deterministic node id from an arbitrary string.
function nodeId(prefix, raw) {
  return prefix + '_' + String(raw).replace(/[^A-Za-z0-9]/g, '_');
}

// ──────────────────── tiny YAML readers (regex line based) ───────────────────
// We do NOT pull in a YAML lib (harness avoids deps). These readers cover the
// flat-key + one-level-nested + simple-list shapes used by the appsec schemas.
// They are intentionally conservative: anything they cannot parse is reported,
// not guessed.

// Extract the leading `---`…`---` frontmatter block from a markdown file.
function extractFrontmatter(text) {
  if (text === null) return null;
  // Allow an optional UTF-8 BOM, then the opening fence.
  const m = text.match(/^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  return m ? m[1] : null;
}

// Parse a flat scalar value: "key: value" with optional quotes / inline comment.
function scalarValue(raw) {
  if (raw === undefined || raw === null) return null;
  let v = raw.trim();
  // strip a trailing inline comment that is NOT inside quotes
  if (v[0] !== '"' && v[0] !== "'") {
    const hash = v.indexOf(' #');
    if (hash !== -1) v = v.slice(0, hash).trim();
  }
  if ((v[0] === '"' && v[v.length - 1] === '"') ||
      (v[0] === "'" && v[v.length - 1] === "'")) {
    v = v.slice(1, -1);
  }
  return v;
}

// Read a top-level (col-0) scalar key from a YAML block.
function yamlTopScalar(block, key) {
  if (!block) return null;
  const re = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    ':[ \\t]*(.*)$', 'm');
  const m = block.match(re);
  if (!m) return null;
  const val = scalarValue(m[1]);
  return (val === '' || val === null) ? null : val;
}

// Read an inline list `key: [a, b, c]` (top-level only). Returns array or null.
function yamlInlineList(block, key) {
  if (!block) return null;
  const re = new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    ':[ \\t]*\\[(.*)\\][ \\t]*$', 'm');
  const m = block.match(re);
  if (!m) return null;
  const inner = m[1].trim();
  if (inner === '') return [];
  return inner.split(',').map(function (x) { return scalarValue(x); })
    .filter(function (x) { return x !== null && x !== ''; });
}

// Read a block list:
//   key:
//     - item one
//     - item two
// Stops at the next key with equal-or-lesser indentation. Returns array.
function yamlBlockList(block, key) {
  if (!block) return null;
  const lines = block.split(/\r?\n/);
  let i = 0;
  const keyRe = new RegExp('^(\\s*)' +
    key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':[ \\t]*(.*)$');
  for (; i < lines.length; i++) {
    const km = lines[i].match(keyRe);
    if (km) {
      // inline form on the same line takes precedence
      const inline = yamlInlineList(lines[i], key);
      if (inline) return inline;
      if (km[2] && km[2].trim() !== '' && km[2].trim()[0] !== '#') {
        // scalar, not a list
        return null;
      }
      const baseIndent = km[1].length;
      const out = [];
      for (let j = i + 1; j < lines.length; j++) {
        const ln = lines[j];
        if (ln.trim() === '' || ln.trim()[0] === '#') continue;
        const indent = ln.match(/^(\s*)/)[1].length;
        const item = ln.match(/^\s*-\s+(.*)$/);
        if (item && indent > baseIndent) {
          out.push(scalarValue(item[1]));
        } else if (indent <= baseIndent) {
          break;
        }
      }
      return out;
    }
  }
  return null;
}

// Read a nested one-level scalar: parent: \n  child: value  → value
function yamlNestedScalar(block, parent, child) {
  if (!block) return null;
  const lines = block.split(/\r?\n/);
  const parentRe = new RegExp('^(\\s*)' +
    parent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':[ \\t]*$');
  for (let i = 0; i < lines.length; i++) {
    const pm = lines[i].match(parentRe);
    if (pm) {
      const baseIndent = pm[1].length;
      for (let j = i + 1; j < lines.length; j++) {
        const ln = lines[j];
        if (ln.trim() === '' || ln.trim()[0] === '#') continue;
        const indent = ln.match(/^(\s*)/)[1].length;
        if (indent <= baseIndent) break;
        const cm = ln.match(new RegExp('^\\s*' +
          child.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':[ \\t]*(.*)$'));
        if (cm) {
          const v = scalarValue(cm[1]);
          return (v === '' || v === null) ? null : v;
        }
      }
      return null;
    }
  }
  return null;
}

// ───────────────────────── shared rendering helpers ─────────────────────────

function vizHeader(title, factSources) {
  let out = '# ' + title + '\n\n';
  out += '> Generated by `security-viz` on ' + nowIso() + '\n';
  out += '> Rendered FROM existing fact-sources (no code parsing, no new data collection).\n';
  if (factSources && factSources.length) {
    out += '>\n> Fact-source(s):\n';
    factSources.forEach(function (f) { out += '> - `' + f + '`\n'; });
  }
  out += '\n';
  return out;
}

function mermaidBlock(body) {
  return '```mermaid\n' + body.trimEnd() + '\n```\n';
}

function writeOut(outFile, content) {
  ensureDir(path.dirname(outFile));
  fs.writeFileSync(outFile, content, 'utf8');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. AI AGENT RISK GRAPH  (reads the GLOBAL harness registry)
// ═══════════════════════════════════════════════════════════════════════════

// Parse one agent .md → { name, model, tools[], disableModelInvocation, desc }
function parseAgentFile(file) {
  const text = readFileSafe(file);
  const fm = extractFrontmatter(text);
  if (!fm) return null;
  const name = yamlTopScalar(fm, 'name');
  if (!name) return null;
  // tools: either ["A","B"] inline or "A, B" bare comma list
  let tools = yamlInlineList(fm, 'tools');
  if (!tools) {
    const raw = yamlTopScalar(fm, 'tools');
    if (raw) {
      tools = raw.split(',').map(function (t) { return t.trim(); })
        .filter(Boolean);
    } else {
      tools = [];
    }
  }
  const model = yamlTopScalar(fm, 'model'); // may be null (inherits parent)
  const dmiRaw = yamlTopScalar(fm, 'disable-model-invocation');
  const disableModelInvocation = (dmiRaw === 'true' || dmiRaw === true);
  return {
    name: name,
    model: model,
    tools: tools,
    disableModelInvocation: disableModelInvocation,
    desc: yamlTopScalar(fm, 'description') || ''
  };
}

// Parse one skill SKILL.md → security-relevant frontmatter, or null.
function parseSkillFile(file) {
  const text = readFileSafe(file);
  const fm = extractFrontmatter(text);
  if (!fm) return null;
  const name = yamlTopScalar(fm, 'name');
  if (!name) return null;
  let allowed = yamlInlineList(fm, 'allowed-tools');
  if (!allowed) {
    const raw = yamlTopScalar(fm, 'allowed-tools');
    allowed = raw ? raw.split(',').map(function (t) { return t.trim(); })
      .filter(Boolean) : [];
  }
  let forbidden = yamlInlineList(fm, 'forbidden-tools');
  if (!forbidden) {
    const raw = yamlTopScalar(fm, 'forbidden-tools');
    forbidden = raw ? raw.split(',').map(function (t) { return t.trim(); })
      .filter(Boolean) : [];
  }
  const dmiRaw = yamlTopScalar(fm, 'disable-model-invocation');
  const manualRaw = yamlTopScalar(fm, 'manual_gate_required');
  return {
    name: name,
    allowedTools: allowed,
    forbiddenTools: forbidden,
    disableModelInvocation: (dmiRaw === 'true'),
    manualGateRequired: (manualRaw === 'true'),
    upstream: yamlBlockList(fm, 'upstream') || [],
    downstream: yamlBlockList(fm, 'downstream') || []
  };
}

function cmdAgentRiskGraph(opts) {
  const harness = opts.harness || path.join(process.env.USERPROFILE ||
    process.env.HOME || '', '.claude');
  const manifestPath = path.join(harness, 'manifests', 'skills.manifest.json');
  const agentsDir = path.join(harness, 'agents');
  const skillsDir = path.join(harness, 'skills');

  const manifestRaw = readFileSafe(manifestPath);
  if (manifestRaw === null) {
    die('harness manifest not found: ' + manifestPath +
      '\n  (pass --harness <dir> to point at a ~/.claude directory)', 3);
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (e) {
    die('could not parse skills.manifest.json: ' + e.message, 3);
  }

  // ── Collect agents from disk (the registry IS the fact-source) ──
  const agents = [];
  if (isDir(agentsDir)) {
    fs.readdirSync(agentsDir).filter(function (f) {
      return f.endsWith('.md');
    }).forEach(function (f) {
      const a = parseAgentFile(path.join(agentsDir, f));
      if (a) agents.push(a);
    });
  }

  // ── Collect safety-critical / appsec skills from the manifest ──
  // We focus the graph on AppSec-family + safety-gated skills (the security
  // surface). Pull names from the manifest's appsec_* + name_freeze buckets.
  const skillNames = {};
  const ss = manifest.supporting_skills || {};
  ['appsec_governance', 'appsec_platform', 'appsec_app', 'appsec_app_overlay',
    'appsec_response', 'appsec_compliance', 'appsec_governance_visible',
    'appsec_manual_only', 'appsec_gsd_adapter', 'qa_supporting']
    .forEach(function (bucket) {
      (ss[bucket] || []).forEach(function (n) { skillNames[n] = true; });
    });
  (manifest.name_freeze || []).forEach(function (n) {
    if (!n.endsWith('.js')) skillNames[n] = true;
  });
  // primary appsec orchestrator
  (manifest.primary_orchestrators || []).forEach(function (o) {
    if (o.name === 'appsec-security-orchestrator') skillNames[o.name] = true;
  });

  const skills = [];
  Object.keys(skillNames).forEach(function (n) {
    // plugin-namespaced skills (a:b) live elsewhere; skip frontmatter read
    const dir = path.join(skillsDir, n);
    const sk = parseSkillFile(path.join(dir, 'SKILL.md'));
    if (sk) {
      skills.push(sk);
    } else {
      // record by name even if SKILL.md not locally present
      skills.push({
        name: n, allowedTools: [], forbiddenTools: [],
        disableModelInvocation: false, manualGateRequired: false,
        upstream: [], downstream: [], _frontmatterMissing: true
      });
    }
  });

  // ── Build Mermaid graph ──
  const safetyGateAgents = agents.filter(function (a) {
    return a.disableModelInvocation;
  });
  const safetyGateSkills = skills.filter(function (s) {
    return s.disableModelInvocation || s.manualGateRequired;
  });
  const forbiddenSkills = skills.filter(function (s) {
    return s.forbiddenTools && s.forbiddenTools.length;
  });

  let g = 'graph LR\n';
  g += '  classDef gate fill:#ffe0e0,stroke:#c0392b,stroke-width:2px,color:#900;\n';
  g += '  classDef manual fill:#fff3cd,stroke:#d68910,stroke-width:2px,color:#7a5200;\n';
  g += '  classDef forbidden fill:#f5e0ff,stroke:#7d3c98,color:#4a235a;\n';
  g += '  classDef agent fill:#e8f4fd,stroke:#2471a3,color:#1b4f72;\n';
  g += '  classDef skill fill:#e9f7ef,stroke:#1e8449,color:#145a32;\n\n';

  // Tool nodes are shared; collect the union of all referenced tools.
  const toolSet = {};
  agents.forEach(function (a) {
    a.tools.forEach(function (t) { toolSet[t] = true; });
  });
  skills.forEach(function (s) {
    s.allowedTools.forEach(function (t) { toolSet[t] = true; });
  });

  g += '  subgraph TOOLS["Tools / Permissions"]\n';
  Object.keys(toolSet).sort().forEach(function (t) {
    g += '    ' + nodeId('tool', t) + '["' + mlabel(t) + '"]\n';
  });
  g += '  end\n\n';

  // Agents subgraph
  g += '  subgraph AGENTS["Agents (' + agents.length + ')"]\n';
  agents.forEach(function (a) {
    const flag = a.disableModelInvocation ? ' 🔒 manual-only' : '';
    const modelTag = a.model ? ' / ' + a.model : ' / (inherit)';
    g += '    ' + nodeId('agent', a.name) + '["' + mlabel(a.name) +
      modelTag + flag + '"]\n';
  });
  g += '  end\n\n';

  // Skills subgraph
  g += '  subgraph SKILLS["AppSec / safety-critical skills (' +
    skills.length + ')"]\n';
  skills.forEach(function (s) {
    let flag = '';
    if (s.disableModelInvocation) flag += ' 🔒 manual-only';
    if (s.manualGateRequired) flag += ' ⚠ manual-gate';
    if (s.forbiddenTools.length) flag += ' ⛔forbidden:' +
      s.forbiddenTools.join('/');
    g += '    ' + nodeId('skill', s.name) + '["' + mlabel(s.name) +
      flag + '"]\n';
  });
  g += '  end\n\n';

  // Edges: agent → tool (uses)
  agents.forEach(function (a) {
    a.tools.forEach(function (t) {
      g += '  ' + nodeId('agent', a.name) + ' --> ' + nodeId('tool', t) + '\n';
    });
  });
  // Edges: skill → tool (allowed)
  skills.forEach(function (s) {
    s.allowedTools.forEach(function (t) {
      g += '  ' + nodeId('skill', s.name) + ' -.allowed.-> ' +
        nodeId('tool', t) + '\n';
    });
    // forbidden edges (rendered as a blocked relationship)
    s.forbiddenTools.forEach(function (t) {
      if (toolSet[t]) {
        g += '  ' + nodeId('skill', s.name) + ' x-.forbidden.-x ' +
          nodeId('tool', t) + '\n';
      }
    });
    // upstream/downstream wiring (skill → skill / agent)
    s.downstream.forEach(function (d) {
      if (skillNames[d]) {
        g += '  ' + nodeId('skill', s.name) + ' ==> ' + nodeId('skill', d) +
          '\n';
      }
    });
  });

  // class assignments
  safetyGateAgents.forEach(function (a) {
    g += '  class ' + nodeId('agent', a.name) + ' gate;\n';
  });
  agents.filter(function (a) { return !a.disableModelInvocation; })
    .forEach(function (a) {
      g += '  class ' + nodeId('agent', a.name) + ' agent;\n';
    });
  safetyGateSkills.forEach(function (s) {
    g += '  class ' + nodeId('skill', s.name) +
      (s.disableModelInvocation ? ' gate;' : ' manual;') + '\n';
  });
  forbiddenSkills.forEach(function (s) {
    if (!s.disableModelInvocation && !s.manualGateRequired) {
      g += '  class ' + nodeId('skill', s.name) + ' forbidden;\n';
    }
  });
  skills.filter(function (s) {
    return !s.disableModelInvocation && !s.manualGateRequired &&
      !(s.forbiddenTools && s.forbiddenTools.length);
  }).forEach(function (s) {
    g += '  class ' + nodeId('skill', s.name) + ' skill;\n';
  });

  // ── Assemble markdown ──
  let md = vizHeader('AI Agent Risk Graph', [
    path.relative(harness, manifestPath).replace(/\\/g, '/'),
    'agents/*.md (frontmatter)',
    'skills/<appsec-family>/SKILL.md (frontmatter)'
  ]);
  md += 'Agents × skills × tools × permissions across the harness, with safety ' +
    'gates flagged. Source of truth is the harness registry — this graph adds ' +
    'no data, it only renders what the manifest + frontmatter declare.\n\n';

  md += '## Safety-gate summary\n\n';
  md += '| Control surface | Count | Items |\n|---|---|---|\n';
  md += '| 🔒 `disable-model-invocation: true` agents (manual-only) | ' +
    safetyGateAgents.length + ' | ' +
    (safetyGateAgents.map(function (a) { return '`' + a.name + '`'; })
      .join(', ') || '—') + ' |\n';
  md += '| 🔒 manual-only / ⚠ manual-gate skills | ' +
    safetyGateSkills.length + ' | ' +
    (safetyGateSkills.map(function (s) { return '`' + s.name + '`'; })
      .join(', ') || '—') + ' |\n';
  md += '| ⛔ skills with `forbidden-tools` | ' + forbiddenSkills.length +
    ' | ' + (forbiddenSkills.map(function (s) {
      return '`' + s.name + '` (' + s.forbiddenTools.join('/') + ')';
    }).join(', ') || '—') + ' |\n';
  md += '| Agents total | ' + agents.length + ' | — |\n';
  md += '| AppSec / safety-critical skills inspected | ' + skills.length +
    ' | — |\n\n';

  if (safetyGateAgents.length === 0 && safetyGateSkills.length === 0) {
    md += '> NOTE: no safety gates detected in the inspected set. Verify the ' +
      'harness path is correct.\n\n';
  }

  md += '## Graph\n\n' + mermaidBlock(g) + '\n';

  md += '## Legend\n\n';
  md += '- 🔒 red node = `disable-model-invocation: true` — manual hard gate ' +
    '(never auto-fires).\n';
  md += '- ⚠ amber node = `manual_gate_required: true`.\n';
  md += '- ⛔ purple node / `x-.forbidden.-x` edge = a tool the skill is ' +
    'forbidden from using.\n';
  md += '- Solid `-->` = agent uses tool. Dotted `-.allowed.->` = skill allowed ' +
    'tool. Bold `==>` = skill→skill downstream wiring.\n';

  const outFile = opts.out || path.join(process.cwd(),
    'security-agent-risk-graph.md');
  writeOut(outFile, md);
  info('security-viz: AI Agent Risk Graph → ' + outFile);
  info('  ' + agents.length + ' agents · ' + skills.length +
    ' appsec/safety skills · ' + Object.keys(toolSet).length + ' tools · ' +
    safetyGateAgents.length + ' manual-only agents · ' +
    (safetyGateSkills.length) + ' gated skills');
  return outFile;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. VULNERABILITY LIFECYCLE BOARD  (reads .appsec/findings/<tag>/*.yaml)
// ═══════════════════════════════════════════════════════════════════════════

// Map canonical finding status → lifecycle lane.
// Canonical schema status enum: open | in_progress | mitigated | resolved | accepted
const STATUS_LANE = {
  open: 'Open',
  in_progress: 'In Remediation',
  mitigated: 'Verified',     // mitigated == fix in place, awaiting closure
  resolved: 'Closed',
  accepted: 'Closed (risk-accepted)'
};
const LANES = ['Open', 'In Remediation', 'Verified', 'Closed',
  'Closed (risk-accepted)'];

function parseFinding(file) {
  const text = readFileSafe(file);
  if (text === null) return null;
  // findings are flat YAML (no frontmatter fences) — treat whole file as block
  const block = text.replace(/^﻿/, '');
  const id = yamlTopScalar(block, 'id');
  if (!id) return null;
  return {
    id: id,
    severity: (yamlTopScalar(block, 'severity') || 'unknown').toLowerCase(),
    computedRisk: (yamlTopScalar(block, 'computed_risk') || '').toLowerCase(),
    status: (yamlTopScalar(block, 'status') || 'open').toLowerCase(),
    verification: yamlTopScalar(block, 'verification_status') || '',
    slaDue: yamlTopScalar(block, 'sla_due') || '',
    source: yamlTopScalar(block, 'source') || '',
    owner: yamlTopScalar(block, 'owner') || '',
    _file: path.basename(file)
  };
}

// Determine SLA flag for a finding given today's date.
function slaFlag(f) {
  if (!f.slaDue) return { sym: '', text: 'no SLA set' };
  const due = Date.parse(f.slaDue);
  if (isNaN(due)) return { sym: '⚠', text: 'unparseable sla_due' };
  // Closed items don't breach.
  if (f.status === 'resolved' || f.status === 'accepted') {
    return { sym: '✅', text: 'closed' };
  }
  const today = Date.now();
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return { sym: '🔴', text: 'OVERDUE by ' + (-days) + 'd' };
  if (days <= 3) return { sym: '🟠', text: 'due in ' + days + 'd' };
  return { sym: '🟢', text: 'due in ' + days + 'd' };
}

function cmdVulnBoard(tag, opts) {
  safeTag(tag);
  const project = opts.project || process.cwd();
  const findDir = path.join(project, '.appsec', 'findings', tag);
  if (!isDir(findDir)) {
    die('findings directory not found: ' + findDir +
      '\n  (expected .appsec/findings/<tag>/*.yaml — run the AppSec ' +
      'orchestrator first, or pass --project <dir>)', 4);
  }
  const files = fs.readdirSync(findDir).filter(function (f) {
    return f.endsWith('.yaml') || f.endsWith('.yml');
  });

  let md = vizHeader('Vulnerability Lifecycle Board — ' + tag,
    ['.appsec/findings/' + tag + '/*.yaml (finding schema v1.0)']);

  if (files.length === 0) {
    md += '> The findings directory exists but contains **no finding YAML ' +
      'files**. Nothing to render — this is reported honestly rather than ' +
      'fabricating cards.\n';
    const outFile = opts.out || path.join(project, '.appsec', 'evidence',
      tag, 'viz', 'vuln-board.md');
    writeOut(outFile, md);
    info('security-viz: Vulnerability Board (empty) → ' + outFile);
    return outFile;
  }

  const findings = [];
  files.forEach(function (f) {
    const fd = parseFinding(path.join(findDir, f));
    if (fd) findings.push(fd);
  });

  // Group into lanes
  const lanes = {};
  LANES.forEach(function (l) { lanes[l] = []; });
  findings.forEach(function (fd) {
    const lane = STATUS_LANE[fd.status] || 'Open';
    lanes[lane].push(fd);
  });

  // Severity tallies
  const sevCount = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  findings.forEach(function (fd) {
    const s = sevCount[fd.severity] !== undefined ? fd.severity : 'unknown';
    sevCount[s]++;
  });
  const breaches = findings.filter(function (fd) {
    return slaFlag(fd).sym === '🔴';
  });

  // Summary
  md += '## Summary\n\n';
  md += '- **' + findings.length + '** findings · ' +
    'critical ' + sevCount.critical + ' · high ' + sevCount.high +
    ' · medium ' + sevCount.medium + ' · low ' + sevCount.low +
    (sevCount.unknown ? ' · unknown ' + sevCount.unknown : '') + '\n';
  md += '- **' + breaches.length + '** SLA breach(es) 🔴' +
    (breaches.length ? ': ' + breaches.map(function (b) {
      return '`' + b.id + '`';
    }).join(', ') : '') + '\n\n';

  // Kanban (Mermaid flowchart, columns as subgraphs)
  let k = 'flowchart TB\n';
  k += '  classDef crit fill:#ffd6d6,stroke:#c0392b,color:#7b241c;\n';
  k += '  classDef high fill:#ffe8cc,stroke:#d68910,color:#7e5109;\n';
  k += '  classDef med fill:#fff7cc,stroke:#b7950b,color:#7d6608;\n';
  k += '  classDef low fill:#e8f8f5,stroke:#138d75,color:#0b5345;\n';
  k += '  classDef breach stroke:#c0392b,stroke-width:3px,stroke-dasharray:4 2;\n\n';
  LANES.forEach(function (lane, li) {
    const cards = lanes[lane];
    k += '  subgraph L' + li + '["' + mlabel(lane) + ' (' + cards.length +
      ')"]\n';
    if (cards.length === 0) {
      k += '    L' + li + '_empty["—"]\n';
    } else {
      cards.forEach(function (c) {
        const fl = slaFlag(c);
        k += '    ' + nodeId('f', c.id) + '["' + mlabel(c.id) + '<br/>' +
          mlabel(c.severity.toUpperCase()) +
          (fl.sym ? ' ' + fl.sym : '') + '<br/>' + mlabel(fl.text) + '"]\n';
      });
    }
    k += '  end\n';
  });
  // class per severity + breach outline
  findings.forEach(function (c) {
    const cls = { critical: 'crit', high: 'high', medium: 'med', low: 'low' }[c.severity];
    if (cls) k += '  class ' + nodeId('f', c.id) + ' ' + cls + ';\n';
    if (slaFlag(c).sym === '🔴') k += '  class ' + nodeId('f', c.id) +
      ' breach;\n';
  });

  md += '## Board\n\n' + mermaidBlock(k) + '\n';

  // Markdown table fallback (always present — survives non-Mermaid viewers)
  md += '## Findings table\n\n';
  md += '| ID | Severity | Risk | Status → Lane | SLA due | SLA flag | ' +
    'Verification | Owner | Source |\n';
  md += '|---|---|---|---|---|---|---|---|---|\n';
  findings.sort(function (a, b) {
    const order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
    return (order[a.severity] - order[b.severity]) || a.id.localeCompare(b.id);
  }).forEach(function (c) {
    const fl = slaFlag(c);
    md += '| `' + c.id + '` | ' + c.severity + ' | ' + (c.computedRisk || '—') +
      ' | ' + c.status + ' → ' + (STATUS_LANE[c.status] || 'Open') + ' | ' +
      (c.slaDue || '—') + ' | ' + (fl.sym ? fl.sym + ' ' : '') + fl.text +
      ' | ' + (c.verification || '—') + ' | ' + (c.owner || '—') + ' | ' +
      (c.source || '—') + ' |\n';
  });

  md += '\n## Lane mapping (canonical schema → board)\n\n';
  md += 'The finding schema v1.0 `status` enum maps to lanes as: ' +
    '`open`→Open, `in_progress`→In Remediation, `mitigated`→Verified, ' +
    '`resolved`→Closed, `accepted`→Closed (risk-accepted).\n';

  const outFile = opts.out || path.join(project, '.appsec', 'evidence',
    tag, 'viz', 'vuln-board.md');
  writeOut(outFile, md);
  info('security-viz: Vulnerability Board → ' + outFile);
  info('  ' + findings.length + ' findings · ' + breaches.length +
    ' SLA breaches');
  return outFile;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SECURITY EVIDENCE DASHBOARD  (reads appsec_release_decision.yaml)
// ═══════════════════════════════════════════════════════════════════════════

const CSF_FUNCS = [
  ['GV', 'Govern'], ['ID', 'Identify'], ['PR', 'Protect'],
  ['DE', 'Detect'], ['RS', 'Respond'], ['RC', 'Recover']
];

function light(status) {
  switch ((status || '').toUpperCase()) {
    case 'PASS': return '🟢';
    case 'PARTIAL': return '🟡';
    case 'MISSING': return '🔴';
    default: return '⚪';
  }
}

function decisionLight(d) {
  switch ((d || '').toUpperCase()) {
    case 'PASS': return '🟢 PASS';
    case 'CONDITIONAL_PASS': return '🟡 CONDITIONAL_PASS';
    case 'FAIL': return '🔴 FAIL';
    case 'BLOCKED': return '⛔ BLOCKED';
    default: return '⚪ ' + (d || 'UNKNOWN');
  }
}

function cmdEvidenceDashboard(tag, opts) {
  safeTag(tag);
  const project = opts.project || process.cwd();
  const decFile = path.join(project, '.appsec', 'decisions', tag,
    'appsec_release_decision.yaml');
  const raw = readFileSafe(decFile);
  if (raw === null) {
    die('release decision not found: ' + decFile +
      '\n  (expected .appsec/decisions/<tag>/appsec_release_decision.yaml — ' +
      'run the AppSec evidence-validator first, or pass --project <dir>)', 5);
  }
  const block = raw.replace(/^﻿/, '');

  const decision = yamlTopScalar(block, 'decision');
  const asvsLevel = yamlTopScalar(block, 'asvs_level');
  const asvsVersion = yamlTopScalar(block, 'asvs_version');
  const decidedAt = yamlTopScalar(block, 'decided_at');
  const decidedBy = yamlTopScalar(block, 'decided_by');
  const redactionAttested = yamlNestedScalar(block, 'redaction', 'attested');
  const redactionMethod = yamlNestedScalar(block, 'redaction', 'method');
  const redactionProof = yamlNestedScalar(block, 'redaction', 'proof_path');
  const pentestStatus = yamlTopScalar(block, 'pentest_status');
  const overlays = yamlInlineList(block, 'overlays_activated') ||
    yamlBlockList(block, 'overlays_activated') || [];

  // findings_summary nested scalars
  const fs_total = yamlNestedScalar(block, 'findings_summary', 'total');
  const fs_crit = yamlNestedScalar(block, 'findings_summary', 'critical');
  const fs_high = yamlNestedScalar(block, 'findings_summary', 'high');
  const fs_med = yamlNestedScalar(block, 'findings_summary', 'medium');
  const fs_low = yamlNestedScalar(block, 'findings_summary', 'low');

  // csf2_coverage.<FN>.status — nested two levels; read each function block
  function csfStatus(fn) {
    // find "  FN:" under csf2_coverage, then "    status:"
    const re = new RegExp('csf2_coverage:[\\s\\S]*?\\n\\s{2}' + fn +
      ':\\s*\\n([\\s\\S]*?)(?=\\n\\s{2}\\w|\\n\\S|$)');
    const m = block.match(re);
    if (!m) return null;
    const sm = m[1].match(/^\s*status:\s*(\S+)/m);
    return sm ? scalarValue(sm[1]) : null;
  }

  let md = vizHeader('Security Evidence Dashboard — ' + tag,
    ['.appsec/decisions/' + tag + '/appsec_release_decision.yaml']);

  // Headline traffic light
  md += '## Release decision\n\n';
  md += '# ' + decisionLight(decision) + '\n\n';
  md += '| Field | Value |\n|---|---|\n';
  md += '| Release tag | `' + tag + '` |\n';
  md += '| Decision | ' + decisionLight(decision) + ' |\n';
  md += '| ASVS | ' + (asvsLevel || '—') + ' (ASVS ' +
    (asvsVersion || '?') + ') |\n';
  md += '| Decided at | ' + (decidedAt || '—') + ' |\n';
  md += '| Decided by | ' + (decidedBy || '—') + ' |\n';
  md += '| Redaction attested | ' +
    (redactionAttested === 'true' ? '🟢 yes' :
      (redactionAttested === null ? '⚪ not stated' : '🔴 ' +
        redactionAttested)) +
    (redactionProof ? ' (proof: `' + redactionProof + '`)' : '') + ' |\n';
  md += '| Pentest status | ' + (pentestStatus || '—') + ' |\n';
  md += '| Overlays activated | ' +
    (overlays.length ? overlays.map(function (o) {
      return '`' + o + '`';
    }).join(', ') : 'none') + ' |\n\n';

  // CSF coverage table + Mermaid
  md += '## CSF 2.0 coverage (internal evidence-completeness gate)\n\n';
  md += '> NOTE: this is an internal evidence-completeness signal, NOT a NIST ' +
    'CSF certification claim.\n\n';
  md += '| Function | Status |\n|---|---|\n';
  let csfMermaid = 'flowchart LR\n';
  csfMermaid += '  classDef pass fill:#d5f5e3,stroke:#1e8449,color:#145a32;\n';
  csfMermaid += '  classDef part fill:#fcf3cf,stroke:#b7950b,color:#7d6608;\n';
  csfMermaid += '  classDef miss fill:#fadbd8,stroke:#c0392b,color:#7b241c;\n';
  csfMermaid += '  classDef unk fill:#eaecee,stroke:#7f8c8d,color:#424949;\n\n';
  CSF_FUNCS.forEach(function (pair) {
    const st = csfStatus(pair[0]);
    md += '| ' + light(st) + ' ' + pair[0] + ' ' + pair[1] + ' | ' +
      (st || 'not stated') + ' |\n';
    const cls = { PASS: 'pass', PARTIAL: 'part', MISSING: 'miss' }[
      (st || '').toUpperCase()] || 'unk';
    csfMermaid += '  ' + pair[0] + '["' + pair[0] + ' ' + pair[1] + '<br/>' +
      mlabel(st || 'not stated') + '"]\n';
    csfMermaid += '  class ' + pair[0] + ' ' + cls + ';\n';
  });
  csfMermaid += '  GV --> ID --> PR --> DE --> RS --> RC\n';
  md += '\n' + mermaidBlock(csfMermaid) + '\n';

  // Findings summary
  md += '## Findings summary\n\n';
  if (fs_total === null) {
    md += '> `findings_summary` not present in the decision file.\n\n';
  } else {
    md += '| Total | Critical | High | Medium | Low |\n|---|---|---|---|---|\n';
    md += '| ' + fs_total + ' | ' + (fs_crit || '0') +
      (Number(fs_crit) > 0 ? ' 🔴' : ' 🟢') + ' | ' + (fs_high || '0') +
      ' | ' + (fs_med || '0') + ' | ' + (fs_low || '0') + ' |\n\n';
  }

  // Gate-blocking conditions (decoded for a non-expert reader)
  md += '## What this means\n\n';
  const blockers = [];
  if (redactionAttested !== 'true') {
    blockers.push('Secret-scan redaction is **not attested** — a release gate ' +
      'will hold until `redaction.attested: true` with a proof path.');
  }
  if (Number(fs_crit) > 0) {
    blockers.push('There are **' + fs_crit + ' critical** finding(s) — these ' +
      'normally block a PASS.');
  }
  CSF_FUNCS.forEach(function (pair) {
    if ((csfStatus(pair[0]) || '').toUpperCase() === 'MISSING') {
      blockers.push('CSF ' + pair[0] + ' (' + pair[1] + ') evidence is ' +
        '**MISSING** — the validator blocks on any MISSING function.');
    }
  });
  if (blockers.length === 0) {
    md += '- No gate-blocking conditions detected in this decision file.\n';
  } else {
    blockers.forEach(function (b) { md += '- ' + b + '\n'; });
  }

  const outFile = opts.out || path.join(project, '.appsec', 'evidence',
    tag, 'viz', 'evidence-dashboard.md');
  writeOut(outFile, md);
  info('security-viz: Evidence Dashboard → ' + outFile);
  info('  decision=' + (decision || '?') + ' · redaction.attested=' +
    (redactionAttested || '?'));
  return outFile;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PENTEST SCOPE MAP  (reads .planning/PENTEST-ROE.md frontmatter)
// ═══════════════════════════════════════════════════════════════════════════

function cmdPentestScopeMap(roeArg, opts) {
  const project = opts.project || process.cwd();
  const roeFile = roeArg || path.join(project, '.planning', 'PENTEST-ROE.md');
  const text = readFileSafe(roeFile);
  if (text === null) {
    die('ROE file not found: ' + roeFile +
      '\n  (expected .planning/PENTEST-ROE.md — draft it via the ' +
      '`pentest-scope-and-roe` skill first, or pass the path explicitly)', 6);
  }
  const fm = extractFrontmatter(text);
  if (!fm) {
    die('PENTEST-ROE.md has no machine-readable YAML frontmatter block ' +
      '(the parser surface). Cannot render a scope map from prose alone — ' +
      'draft via `pentest-scope-and-roe` which emits the frontmatter.', 6);
  }

  const target = yamlTopScalar(fm, 'target_identification');
  const authProof = yamlTopScalar(fm, 'authorization_proof');
  const env = yamlTopScalar(fm, 'environment');
  const inScope = yamlBlockList(fm, 'in_scope') || [];
  const outScope = yamlBlockList(fm, 'out_of_scope') || [];
  const allowed = yamlBlockList(fm, 'allowed_methods') || [];
  const disallowed = yamlBlockList(fm, 'disallowed_methods') || [];
  const timeWindow = yamlTopScalar(fm, 'time_window');
  const twStart = yamlTopScalar(fm, 'time_window_start');
  const twEnd = yamlTopScalar(fm, 'time_window_end');
  const rateLimits = yamlTopScalar(fm, 'rate_limits');
  const signoff = yamlTopScalar(fm, 'authorization_signoff');

  // Detect unfilled REPLACE_ placeholders → ROE not ready (honest flag).
  function isPlaceholder(v) {
    return typeof v === 'string' && /REPLACE_/.test(v);
  }
  const unfilled = [];
  [['target_identification', target], ['authorization_proof', authProof],
    ['environment', env], ['time_window_start', twStart],
    ['time_window_end', twEnd], ['authorization_signoff', signoff]]
    .forEach(function (p) {
      if (p[1] === null || isPlaceholder(p[1])) unfilled.push(p[0]);
    });
  inScope.forEach(function (a) { if (isPlaceholder(a)) unfilled.push('in_scope'); });

  let md = vizHeader('Pentest Scope Map', [
    path.relative(project, roeFile).replace(/\\/g, '/') + ' (YAML frontmatter — 11-section ROE)'
  ]);

  if (unfilled.length) {
    md += '> ⚠ **ROE NOT READY.** Unfilled / placeholder field(s): `' +
      unfilled.join('`, `') + '`. The fail-closed gate keeps active testing ' +
      'BLOCKED until these are filled. This map renders what exists but must ' +
      'not be read as an authorization.\n\n';
  }

  md += '## At a glance\n\n';
  md += '| Field | Value |\n|---|---|\n';
  md += '| Target | ' + mdcell(target) + ' |\n';
  md += '| Environment | ' + mdcell(env) +
    (env && /production/i.test(env) ? ' ⚠ production' : '') + ' |\n';
  md += '| Authorization proof | ' + mdcell(authProof) + ' |\n';
  md += '| Time window | ' + mdcell(timeWindow || (twStart && twEnd ?
    twStart + ' → ' + twEnd : null)) + ' |\n';
  md += '| Rate limits | ' + mdcell(rateLimits) + ' |\n';
  md += '| Sign-off | ' + mdcell(signoff) + ' |\n';
  md += '| In-scope assets | ' + inScope.length + ' |\n';
  md += '| Out-of-scope assets | ' + outScope.length + ' |\n\n';

  // Scope boundary diagram
  let g = 'flowchart TB\n';
  g += '  classDef ins fill:#d5f5e3,stroke:#1e8449,stroke-width:2px,color:#145a32;\n';
  g += '  classDef outs fill:#fadbd8,stroke:#c0392b,stroke-width:2px,color:#7b241c;\n';
  g += '  classDef ctx fill:#eaf2f8,stroke:#2471a3,color:#1b4f72;\n';
  g += '  classDef allow fill:#e8f8f5,stroke:#138d75,color:#0b5345;\n';
  g += '  classDef deny fill:#f9ebea,stroke:#922b21,color:#641e16;\n\n';

  g += '  CTX["Target: ' + mlabel(target || 'UNSPECIFIED') + '<br/>Env: ' +
    mlabel(env || '?') + '<br/>Window: ' +
    mlabel(timeWindow || (twStart ? twStart + '→' + twEnd : '?')) + '"]\n';
  g += '  class CTX ctx;\n\n';

  g += '  subgraph IN["✅ IN SCOPE (' + inScope.length + ')"]\n';
  if (inScope.length === 0) {
    g += '    in_empty["— none declared —"]\n';
  } else {
    inScope.forEach(function (a, i) {
      g += '    ' + nodeId('in', i) + '["' + mlabel(a) + '"]\n';
    });
  }
  g += '  end\n';
  g += '  subgraph OUT["⛔ OUT OF SCOPE (' + outScope.length + ')"]\n';
  if (outScope.length === 0) {
    g += '    out_empty["— none declared —"]\n';
  } else {
    outScope.forEach(function (a, i) {
      g += '    ' + nodeId('out', i) + '["' + mlabel(a) + '"]\n';
    });
  }
  g += '  end\n';
  g += '  CTX --> IN\n  CTX -. forbidden .-> OUT\n';

  // method nodes
  g += '  subgraph METH["Methods"]\n';
  g += '    direction LR\n';
  g += '    subgraph ALLOWED["Allowed (' + allowed.length + ')"]\n';
  if (allowed.length === 0) g += '      allow_empty["—"]\n';
  allowed.forEach(function (m, i) {
    g += '      ' + nodeId('al', i) + '["' + mlabel(m) + '"]\n';
  });
  g += '    end\n';
  g += '    subgraph DENIED["Disallowed — HARD limits (' + disallowed.length +
    ')"]\n';
  if (disallowed.length === 0) g += '      deny_empty["—"]\n';
  disallowed.forEach(function (m, i) {
    g += '      ' + nodeId('dn', i) + '["' + mlabel(m) + '"]\n';
  });
  g += '    end\n';
  g += '  end\n';
  g += '  IN --> ALLOWED\n';

  // classes
  inScope.forEach(function (a, i) { g += '  class ' + nodeId('in', i) + ' ins;\n'; });
  outScope.forEach(function (a, i) { g += '  class ' + nodeId('out', i) + ' outs;\n'; });
  allowed.forEach(function (m, i) { g += '  class ' + nodeId('al', i) + ' allow;\n'; });
  disallowed.forEach(function (m, i) { g += '  class ' + nodeId('dn', i) + ' deny;\n'; });

  md += '## Scope boundary\n\n' + mermaidBlock(g) + '\n';

  // method tables
  md += '## Allowed methods\n\n';
  if (allowed.length === 0) md += '_None declared._\n\n';
  else allowed.forEach(function (m) { md += '- ✅ ' + m + '\n'; });
  md += '\n## Disallowed methods (FORBIDDEN — hard limits)\n\n';
  if (disallowed.length === 0) md += '_None declared._\n\n';
  else disallowed.forEach(function (m) { md += '- ⛔ ' + m + '\n'; });

  md += '\n## Boundary note\n\n';
  md += 'This map renders the ROE scope only. It is **not** an authorization. ' +
    'Active validation runs solely via `authorized-pentest-validation` ' +
    '(manual hard gate) after full sign-off. A viewer/diagram never gates ' +
    'access — that is the AppSec orchestrator\'s job.\n';

  const outFile = opts.out || path.join(project, '.appsec', 'evidence',
    'pentest', 'viz', 'pentest-scope-map.md');
  writeOut(outFile, md);
  info('security-viz: Pentest Scope Map → ' + outFile);
  info('  in-scope=' + inScope.length + ' · out-of-scope=' + outScope.length +
    ' · unfilled=' + unfilled.length);
  return outFile;
}

function mdcell(v) {
  if (v === null || v === undefined || v === '') return '_unspecified_';
  if (/REPLACE_/.test(String(v))) return '⚠ `' + v + '` (placeholder)';
  return mlabel(v);
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

function parseFlags(args) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') { opts.out = args[++i]; }
    else if (a === '--project') { opts.project = args[++i]; }
    else if (a === '--harness') { opts.harness = args[++i]; }
    else if (a === '-h' || a === '--help') { opts.help = true; }
    else { positional.push(a); }
  }
  return { opts: opts, positional: positional };
}

function usage() {
  return [
    'security-viz — render security diagrams from existing fact-sources',
    '',
    'Usage:',
    '  security-viz agent-risk-graph [--harness <dir>] [--out <file>]',
    '  security-viz vuln-board <tag> [--project <dir>] [--out <file>]',
    '  security-viz evidence-dashboard <tag> [--project <dir>] [--out <file>]',
    '  security-viz pentest-scope-map [<roe-file>] [--project <dir>] [--out <file>]',
    '  security-viz all <tag> [--project <dir>] [--harness <dir>]',
    '',
    'Fact-sources (NOT code — see arch-viz for code structure):',
    '  agent-risk-graph    ~/.claude/manifests/skills.manifest.json + agents/*.md + skills/*/SKILL.md',
    '  vuln-board          <project>/.appsec/findings/<tag>/*.yaml',
    '  evidence-dashboard  <project>/.appsec/decisions/<tag>/appsec_release_decision.yaml',
    '  pentest-scope-map   <project>/.planning/PENTEST-ROE.md (YAML frontmatter)',
    '',
    'Outputs Mermaid-fenced markdown. Project diagrams → <project>/.appsec/evidence/<tag>/viz/.'
  ].join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const { opts, positional } = parseFlags(argv.slice(1));

  if (!cmd || cmd === '-h' || cmd === '--help' || opts.help) {
    process.stdout.write(usage() + '\n');
    process.exit(cmd ? 0 : 1);
  }

  try {
    switch (cmd) {
      case 'agent-risk-graph':
        cmdAgentRiskGraph(opts);
        break;
      case 'vuln-board':
        cmdVulnBoard(positional[0], opts);
        break;
      case 'evidence-dashboard':
        cmdEvidenceDashboard(positional[0], opts);
        break;
      case 'pentest-scope-map':
        cmdPentestScopeMap(positional[0], opts);
        break;
      case 'all': {
        const tag = positional[0];
        safeTag(tag);
        cmdAgentRiskGraph({ harness: opts.harness,
          out: path.join(opts.project || process.cwd(), '.appsec',
            'evidence', tag, 'viz', 'agent-risk-graph.md') });
        cmdVulnBoard(tag, opts);
        cmdEvidenceDashboard(tag, opts);
        // pentest map is best-effort in `all` (ROE may not exist yet)
        try {
          cmdPentestScopeMap(null, opts);
        } catch (e) {
          info('security-viz: pentest-scope-map skipped in `all` (no ROE) — ' +
            'run it explicitly once .planning/PENTEST-ROE.md exists.');
        }
        break;
      }
      default:
        die('unknown subcommand "' + cmd + '"\n\n' + usage(), 1);
    }
  } catch (e) {
    // Never crash with a raw stack trace for fact-source problems.
    die('unexpected error: ' + e.message, 10);
  }
}

main();
