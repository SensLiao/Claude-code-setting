#!/usr/bin/env node
// detect-bootstrap-needed: SessionStart hook
//
// Detects if the current working directory looks like a project that has not
// yet been bootstrapped with `claude-env-bootstrap` (i.e. has no .claude/
// CLAUDE.md or manifest.json). If so, prints a hint to stdout — Claude Code
// injects SessionStart hook stdout into the context, so Claude can see it and
// proactively ask the user whether to run `claude-env-bootstrap`.
//
// Silent (no output) when:
//   - cwd is ~/.claude itself (we don't want to bootstrap the global config)
//   - cwd is a known temp / Desktop root / Downloads root
//   - cwd already has .claude/CLAUDE.md or .claude/manifest.json
//   - cwd has no git repo and no source files (not a real project)
//
// Loud (prints BOOTSTRAP_HINT) when:
//   - cwd is a project (has git, source files, package.json, etc.)
//   - cwd has no .claude/ environment yet

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const homeDir = os.homedir();

// === Skip list — silent paths ===
const SKIP_EXACT = [
  path.join(homeDir, '.claude'),                                    // ~/.claude itself
  homeDir,                                                          // home root
  path.resolve('/'),                                                // FS root
];

const SKIP_PREFIX = [
  path.join(homeDir, 'Downloads'),
  path.join(homeDir, 'AppData'),
  path.join(homeDir, '.cache'),
  path.join(homeDir, '.config'),
  '/tmp',
  '/var/tmp',
];

// Desktop root only — Desktop subdirectories are fine (user puts projects there)
const SKIP_EXACT_NORMALIZED = SKIP_EXACT.map(p => path.normalize(p).toLowerCase());

function shouldSkip(dir) {
  const normalized = path.normalize(dir).toLowerCase();

  // Exact match
  if (SKIP_EXACT_NORMALIZED.includes(normalized)) return true;

  // Desktop root exactly (but allow Desktop/subdir)
  if (normalized === path.join(homeDir, 'Desktop').toLowerCase()) return true;

  // Prefix match for Downloads / AppData / tmp etc.
  for (const prefix of SKIP_PREFIX) {
    const normalizedPrefix = path.normalize(prefix).toLowerCase();
    if (normalized === normalizedPrefix || normalized.startsWith(normalizedPrefix + path.sep)) {
      return true;
    }
  }

  return false;
}

function hasBootstrap(dir) {
  const claudeDir = path.join(dir, '.claude');
  if (!fs.existsSync(claudeDir)) return false;
  // Look for either CLAUDE.md or manifest.json — either means bootstrapped
  return fs.existsSync(path.join(claudeDir, 'CLAUDE.md'))
      || fs.existsSync(path.join(claudeDir, 'manifest.json'));
}

function looksLikeProject(dir) {
  // Real project signals — at least ONE must be true
  const signals = [
    '.git',
    'package.json',
    'pubspec.yaml',
    'Cargo.toml',
    'go.mod',
    'pyproject.toml',
    'requirements.txt',
    'setup.py',
    'Package.swift',
    'pom.xml',
    'build.gradle',
    'CMakeLists.txt',
    'Gemfile',
    'composer.json',
    'CLAUDE.md',  // 已有根目录 CLAUDE.md 也算项目
  ];
  for (const sig of signals) {
    if (fs.existsSync(path.join(dir, sig))) return true;
  }

  // Or: has a "Design/" folder (sens-frontend-design style projects)
  if (fs.existsSync(path.join(dir, 'Design')) && fs.statSync(path.join(dir, 'Design')).isDirectory()) {
    return true;
  }

  // Or: has .planning/ (GSD projects)
  if (fs.existsSync(path.join(dir, '.planning'))) {
    return true;
  }

  return false;
}

function detectStack(dir) {
  const stack = [];
  if (fs.existsSync(path.join(dir, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (deps.next) stack.push('Next.js');
      else if (deps.react) stack.push('React');
      if (deps.vue || deps.nuxt) stack.push('Vue/Nuxt');
      if (deps.typescript || deps['@types/node']) stack.push('TypeScript');
      if (deps['@anthropic-ai/sdk']) stack.push('Claude SDK');
    } catch (e) { /* ignore parse errors */ }
  }
  if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) stack.push('Flutter');
  if (fs.existsSync(path.join(dir, 'Package.swift'))) stack.push('Swift');
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) stack.push('Rust');
  if (fs.existsSync(path.join(dir, 'go.mod'))) stack.push('Go');
  if (fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'requirements.txt'))) stack.push('Python');
  if (fs.existsSync(path.join(dir, 'Design'))) stack.push('Design/ folder');
  if (fs.existsSync(path.join(dir, '.planning'))) stack.push('GSD .planning/');
  return stack;
}

// === Main logic ===
try {
  if (shouldSkip(cwd)) {
    process.exit(0);
  }

  if (hasBootstrap(cwd)) {
    process.exit(0);
  }

  if (!looksLikeProject(cwd)) {
    process.exit(0);
  }

  // Project without .claude/ bootstrap — emit hint
  const stack = detectStack(cwd);
  const stackStr = stack.length > 0 ? stack.join(', ') : 'unspecified';

  const hint = `\n[BOOTSTRAP_HINT] Detected a project at \`${cwd}\` without a .claude/ environment.
Tech stack detected: ${stackStr}.

This project would benefit from running \`claude-env-bootstrap\` to install a tailored set of skills + rules + CLAUDE.md.

Action for Claude: At the start of this session, ask the user once:
  "检测到这个项目还没有 .claude/ 环境(detected stack: ${stackStr})。
   要不要现在跑 claude-env-bootstrap 装配一下?"
Wait for user confirmation before invoking the skill. If the user declines or says "later", do not ask again in this session.\n`;

  process.stdout.write(hint);
  process.exit(0);
} catch (err) {
  // Never block session start on hook errors — silently fail
  process.exit(0);
}
