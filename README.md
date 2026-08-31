<div align="right"><a href="README.zh-CN.md">简体中文</a></div>

<p align="center"><img src="docs/hero.png" alt="Claude Code Harness — one cross-platform installer to deploy your Claude Code agents, skills and hooks, safely" width="100%"></p>

<p align="center">
  <img src="https://img.shields.io/badge/runtime-Node.js%2018%2B-059669?style=flat" alt="Runtime: Node.js 18+">
  <img src="https://img.shields.io/badge/dependencies-zero-059669?style=flat" alt="Zero npm dependencies">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-059669?style=flat" alt="Windows, macOS and Linux">
  <img src="https://img.shields.io/badge/default-dry%20run-f59e0b?style=flat" alt="Dry run by default">
  <img src="https://img.shields.io/badge/license-MIT-2f9e44?style=flat" alt="License: MIT">
</p>

Claude Code Harness is the source-of-truth repository for a personal `~/.claude` setup — agents, skills, hooks, rules and commands — deployed into Claude Code's global config directory by a single Node installer. It exists to make a large, evolving agent library reproducible across machines: one read-only health check, one command to deploy, and safe-by-default writes that never touch your credentials, settings or sessions.

<p align="center">
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-the-safety-model">Safety model</a> ·
  <a href="#-common-workflows">Common workflows</a> ·
  <a href="#-installer-reference">Installer reference</a> ·
  <a href="#-whats-in-the-library">The library</a>
</p>

## 🧭 Overview

**Problem.** A serious Claude Code setup stops being a dotfile and becomes a small codebase: dozens of agents, commands and skills, hooks wired into `settings.json`, rules that have to be identical on every machine. Copying that around by hand goes wrong in two specific ways. Either a sync clobbers the one file that must stay local — your credentials, your machine's `settings.json`, your session history — or it silently leaves a stale copy behind and you spend an afternoon debugging a hook that no longer exists in the repository.

**Solution.** One dependency-free Node script owns the whole lifecycle, and every dangerous property is a hard rule rather than a habit. **Nothing is written until you pass `--apply`** — `status` and `install` are read-only previews by default. A `PRESERVE` list makes credentials, settings, memory, sessions and installed plugins structurally unwritable in every mode. Orphan cleanup is scoped to a fixed list of managed directories, so files the harness never installed are never deleted. Hook wiring is matched by script basename per event, so re-running it is idempotent instead of accumulating duplicates.

**Scope.** This is one person's configuration repository, published so the mechanism can be read and reused — not a general-purpose dotfile manager or a plugin marketplace. It deploys to `~/.claude`, mirrors bridge configs for other tools without deploying them, and does not manage your Claude Code installation itself.

## ✨ Highlights

- **Single cross-platform installer, zero dependencies** — one Node script that runs on Windows, macOS and Linux using only the standard library.
- **Dry-run by default** — nothing is written until you pass `--apply`, so you always see the exact set of changes first.
- **Install vs. update, with different contracts** — `install` is incremental (fills gaps, skips files that already exist); `update` force-overwrites managed files and prunes orphans.
- **Strong config protection** — `.credentials.json`, `settings.json`, `memory/`, `sessions/`, `projects/` and `plugins/` are never written and never deleted, in any mode.
- **Scoped orphan cleanup** — deletion is confined to the managed directories, so unrelated files in `~/.claude` survive an update untouched.
- **Idempotent hook wiring** — hooks are matched by script basename per event, so re-running `wire` never duplicates an entry, and it only ever adds.
- **Path portability built in** — text assets carry `__CLAUDE_HOME__` / `__USER_HOME__` placeholders that are substituted per machine at deploy time, in both JSON-escaped and native path forms.
- **Skill-visibility governance** — a generated override map keeps the skill listing inside its context budget; on this library, 112 of 173 skill entries would otherwise be silently truncated.
- **Auditable state** — a pin file records what was deployed and from which commit, so `status` can tell you `SAME` / `STALE` / `MISSING` / `ORPHAN` per file plus any broken hook references in `settings.json`.

## 🏗 Architecture

<p align="center"><img src="docs/architecture.png" alt="Claude Code Harness deployment architecture: the repository as source of truth, mirrored into ~/.claude by one installer, dry-run first, with protected paths never written" width="100%"></p>
<p align="center"><sub>The repository is the source of truth; <code>claude-config.js</code> mirrors it into <code>~/.claude</code>, dry-run first.</sub></p>

The repository holds the library — agents, skills, hooks, rules and commands — and the installer mirrors it into your global Claude Code config, then keeps the two in sync without ever clobbering local state. Every path through the installer starts read-only: `status` compares the repo against what is installed, and `install` reports the exact changes it would make until you pass `--apply`.

The green shield in the diagram marks what is out of bounds in every mode. The blue note covers the two housekeeping behaviours — orphan cleanup, scoped to managed directories so unrelated files survive, and rollback, pinned to the repository as the single source of truth.

## 🛡 The safety model

Three lists decide what the installer may touch, and they are enforced in code rather than left to the operator:

| List | What it means | Contents |
| --- | --- | --- |
| **PRESERVE** | Never written, never deleted, in any mode | `.credentials.json`, `settings.json`, `settings.local.json`, `memory/`, `projects/`, `sessions/`, `tasks/`, `history.jsonl`, `plugins/` |
| **SKIP** | Lives in the repo but is never deployed | `README.md`, `CLAUDE.md` (this repo's own contract), `claude-config.js`, `wire-manifest.json`, `profiles/`, and the `.cursor` / `.codex` / `.gemini` bridge configs |
| **MANAGED** | The only directories orphan cleanup may delete from | `agents`, `commands`, `skills`, `hooks`, `scripts`, `rules`, `docs`, `manifests`, `schemas`, `templates`, `tools`, `workflows`, `mcp-servers`, `mcp-configs`, `orchestrator-runtime` |

Two details are worth spelling out. First, the repository's own `CLAUDE.md` is in SKIP while `CLAUDE.global.md` is renamed to `CLAUDE.md` on deploy — that is what keeps this repo's maintenance contract from overwriting your global behavioural rules. Second, a user-owned carve-out protects locally generated assets (learned skills and personal hooks) plus anything listed in the pin file, so material the harness did not install is not treated as an orphan.

> [!NOTE]
> The bridge configs for Cursor, Codex and Gemini are stored here for backup and version history only. They are read from `~/` or the project root by those tools, not from `~/.claude`, so the installer deliberately never deploys them.

## 🚀 Quick start

### Requirements

- **Node.js 18+** (the installer itself only uses Node-14-level syntax and the standard library — there is nothing to `npm install`)
- Claude Code installed, so `~/.claude` exists

### Look before you leap

```bash
git clone <repo> ~/.claude-config
cd ~/.claude-config
node claude-config.js status
```

### What you should see

`status` is completely read-only. It prints the deployed commit pinned in `~/.claude/.config-source.json` against the repository's current HEAD, then a per-file comparison summarised as `SAME` / `STALE` / `MISSING` / `ORPHAN`, the number of hook references in your `settings.json` and any that are broken, and finally any drift against the default profile. Nothing has changed on disk at this point.

### Deploy

```bash
node claude-config.js install            # still a dry run — prints the exact plan
node claude-config.js install --apply    # writes
```

`install` is incremental: it fills gaps and skips files that already exist, then distributes the skill-visibility overrides and offers to wire hooks. In a non-interactive shell it never blocks — it prints the `wire` command to run instead.

## 📖 Common workflows

### Set up a new machine

```bash
git clone <repo> ~/.claude-config && cd ~/.claude-config
node claude-config.js status             # see what is already there
node claude-config.js install --apply    # deploy everything missing
node claude-config.js wire --apply       # wire the hooks into settings.json
```

### Pull the latest library and force a resync

```bash
node claude-config.js update --pull --apply
```

`update` force-overwrites managed files, deletes orphans inside the managed directories, prunes empty directories, and re-pins. Add `--no-clean` to keep orphans, and drop `--pull` if you would rather manage the git side yourself.

### Add a new agent or skill

Drop the file into `agents/`, `commands/` or `skills/` in the repository, commit, then:

```bash
node claude-config.js install --apply    # incremental: adds the new file, touches nothing else
```

### Re-wire hooks after editing the manifest

```bash
node claude-config.js wire --apply --hooks=A,B     # wire selected batches only
```

Wiring is idempotent and additive: it matches by script basename per event, never duplicates an entry, and never removes one you added by hand.

### Capture the current machine as a profile

```bash
node claude-config.js export-profile default --apply
```

Live hook paths are templatised back to `__CLAUDE_HOME__` / `__NODE_BIN__` / `__USER_HOME__`, so the exported profile is portable to another machine.

### Deploy somewhere else (or test safely)

```bash
node claude-config.js install --target /tmp/claude-test --apply
```

## 🧾 Installer reference

Everything runs through one script, `claude-config.js`. The default command is `status`, and the default mode is a dry run.

| Command | What it does |
| --- | --- |
| `status` | Read-only health check: pinned commit vs HEAD, per-file `SAME`/`STALE`/`MISSING`/`ORPHAN`, hook reference count and broken refs, profile drift. |
| `install` | Incremental deploy — fills gaps, skips existing files, then distributes skill overrides and offers to wire hooks. |
| `update` | Force-overwrite managed files, delete orphans (unless `--no-clean`), prune empty managed directories, re-pin. |
| `wire` | (Re-)wire hooks from the manifest into `settings.json`. Idempotent, matched by basename per event, additive only. |
| `skills` | Distribute the recommended skill-visibility overrides into `settings.json`, backing up the previous file first. |
| `export-profile [name]` | Write the live wired hooks to `profiles/<name>.json` with machine paths templatised. |

| Flag | Effect |
| --- | --- |
| `--apply` | Actually write. **Without it, every command is a dry run.** |
| `--no-clean` | On `update`, keep orphans instead of deleting them. |
| `--pull` | Stash if dirty, fetch, fast-forward pull, then restore, before deploying. |
| `--target DIR` | Deploy somewhere other than `~/.claude`. |
| `--wire` / `--no-wire` / `--hooks=A,B` | Control hook wiring non-interactively; `--hooks` implies `--wire`. |
| `--yes` | Accept defaults without prompting. |

Interactive prompts only appear on a TTY, so headless and agent-driven runs never block.

## 📦 What's in the library

| Asset | Count | Shape |
| --- | --- | --- |
| **Agents** | 37 | Per-language reviewers (TypeScript, Python, Go, Rust, Java, Kotlin, C++, C#, Flutter, database, healthcare), build-error resolvers per toolchain, planning and architecture agents, UI/UX reviewers, an open-source packaging trio, and harness/meta agents. Every one declares its model explicitly. |
| **Commands** | 52 | Planning and execution (`plan`, `lite-plan`, `lite-execute`), review and quality gates, session save/resume, a PRP workflow set, learning and skill authoring, and per-language build/review/test triads. |
| **Skills** | 31 | A UI/UX cluster (one foundation skill, six mutually exclusive primary styles, five workflow skills, seven design-system skills), code-comprehension skills, cross-model dispatch, two skill/workflow makers, and eight general tools. Indexed in [`SKILLS-INDEX.md`](SKILLS-INDEX.md). |
| **Hooks** | 5 wired, 3 dormant | Wired: block `--no-verify` commits, auto-log substantial turns to a run ledger, protect linter/formatter configs from being weakened, auto-format edited files, and warn on generic-looking frontend UI. Dormant ones are opt-in via the manifest. |
| **MCP** | 28 configs + 1 vendored server | A copy-paste catalogue of MCP server definitions with placeholder credentials, plus a full TypeScript XMind MCP server with 8 tools and 6 format converters. |

Skills are governed rather than dumped in: a generated override map assigns each one `on`, `name-only`, `user-invocable-only` or `off`, because skill names and descriptions load into every context and the listing has a budget. On this library that matters concretely — without trimming, 112 of 173 skill entries would be silently truncated. A drift test guards the map against the budget.

## 🗺 Repository map

| Path | What it holds |
| --- | --- |
| [`claude-config.js`](claude-config.js) | The whole installer — one file, zero dependencies |
| [`agents/`](agents/) · [`commands/`](commands/) · [`skills/`](skills/) | The library that gets deployed |
| [`hooks/`](hooks/) · `scripts/hooks/` | Hook implementations; `wire-manifest.json` decides which are wired |
| [`manifests/`](manifests/) | The hook registry, the harness registry, and the skill-visibility override map |
| [`mcp-configs/`](mcp-configs/) · [`mcp-servers/`](mcp-servers/) | MCP server catalogue and the vendored XMind server |
| [`orchestrator-runtime/shared/`](orchestrator-runtime/shared/) | The run ledger, git-context helper, and the plan-preview template |
| [`tests/harness/`](tests/harness/) | Drift tests: file existence, frontmatter health, hook registry lint, registry schema, skill-visibility budget |
| [`docs/`](docs/) | Operating principles, native-capability notes, a compatibility matrix, provider portability |
| `CLAUDE.global.md` | The global behavioural rules deployed as `~/.claude/CLAUDE.md` |
| [`CLAUDE.md`](CLAUDE.md) | This repository's own maintenance contract — never deployed |

## 🧪 Testing

```bash
npm run test:harness
```

The harness suite discovers every `*.test.js` under `tests/harness/`, runs each in its own Node process and aggregates: exit `0` when everything passes, `1` on drift, `2` on an infrastructure error. `--bail` stops at the first failure, `-q` quietens the output. The five suites check that every canonical file exists, that agent and skill frontmatter parses (a broken description silently downgrades a skill to name-only), that the hook registry lints, that the harness registry matches its schema, and that the skill-visibility map has not drifted out of budget.

## 📚 Documentation

- [`docs/OPERATING-PRINCIPLES.md`](docs/OPERATING-PRINCIPLES.md) — why the harness is organised around scarce judgement, plus review cadence and admission rubric
- [`docs/native-capabilities.md`](docs/native-capabilities.md) — what Claude Code provides natively, with a confidence legend separating session-confirmed from doc-cited facts; the source of the skill-listing budget
- [`docs/cc-compat-matrix.md`](docs/cc-compat-matrix.md) — per-surface version floors protecting hooks, settings keys and skills from upstream changes, with an append-only breaking-change log
- [`docs/provider-portability.md`](docs/provider-portability.md) — what is bound to Claude Code versus bound to the model, and how to swap providers
- [`SKILLS-INDEX.md`](SKILLS-INDEX.md) — the one-line-per-skill index (deliberately not auto-loaded; read it on purpose)

## 🖥 Compatibility

| Component | Support |
| --- | --- |
| Node.js | 18+ (the script itself is Node-14-level syntax, standard library only) |
| Operating systems | Windows, macOS, Linux — path handling and placeholders cover all three |
| Target | Claude Code's global config directory, `~/.claude` by default, overridable with `--target` |
| Other tools | Bridge configs for Cursor, Codex and Gemini are versioned here but never deployed |

## 📊 Project status

- **Stable** — the installer and its safety model: dry-run default, PRESERVE protection, scoped orphan cleanup, idempotent wiring, placeholder substitution, pinning and profile export. This is the part worth reading.
- **Actively churning** — the library itself. A large orchestration layer was removed in August 2026 and a snapshot tag marks the state before it; the current shape is deliberately simpler, with tool-style skills and general-purpose agents invoked by name rather than an auto-triggered pipeline.
- **Inherited metadata, not authoritative** — `plugin.json` and `marketplace.json` come from the upstream project this repository was adapted from, and their counts describe that project rather than this library. The same is true of `AGENTS.md`.
- **Known rough edges** — several `test:harness:*` npm aliases still point at suites that were removed with the orchestration layer (`npm run test:harness` itself works and is the one to use), and no `LICENSE` file has been committed yet.

## 🙋 Getting help

- **Before deploying** — run `status`, and read the plan that `install` prints without `--apply`. If something looks wrong, it has not happened yet.
- **Recovering** — the repository is the rollback path: check out any commit and re-run `update --apply`. A pre-orchestrator tag exists for a wholesale revert.
- **Bugs** — open a GitHub issue with your OS, Node version, the exact command and the `status` output.

## 🙏 Acknowledgements

This project builds on and is adapted from the open-source **everything-claude-code** project by **Affaan Mustafa** (MIT-licensed). Its structure and approach are indebted to that work; this repository adapts and extends it for a personal setup.

## 📄 License

MIT. This project inherits from and credits the MIT-licensed everything-claude-code upstream (see [Acknowledgements](#-acknowledgements)); a `LICENSE` file carrying that attribution has not yet been committed to this repository.

<p align="center"><sub>Built by <a href="https://github.com/SensLiao">Ruixuan "Sens" Liao</a> · USYD Advanced Computing (Honours)</sub></p>
