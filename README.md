<div align="right"><a href="README.zh-CN.md">简体中文</a></div>

<p align="center"><img src="docs/hero.png" alt="Claude Code Harness banner" width="100%"></p>

<p align="center"><b>One cross-platform installer to deploy your Claude Code agents, skills and hooks — safely.</b></p>

<p align="center">
<img src="https://img.shields.io/badge/Node.js-18%2B-4ade80?style=flat-square" alt="Node.js 18+">
<img src="https://img.shields.io/badge/dependencies-zero-4ade80?style=flat-square" alt="Zero dependencies">
<img src="https://img.shields.io/badge/cross--platform-Win%20%7C%20macOS%20%7C%20Linux-4ade80?style=flat-square" alt="Cross-platform">
<img src="https://img.shields.io/badge/dry--run-by%20default-4ade80?style=flat-square" alt="Dry-run by default">
<img src="https://img.shields.io/badge/License-MIT-4ade80?style=flat-square" alt="License: MIT">
</p>

Claude Code Harness is the source-of-truth repository for a personal `~/.claude` setup — agents, skills, hooks, rules, and commands — deployed to Claude Code's global config directory by a single Node installer. It exists to make a large, evolving agent library reproducible across machines: one read-only health check, one command to deploy, and safe-by-default writes that never touch your credentials or sessions.

## ✨ Highlights

- **Single cross-platform installer, zero dependencies** — one Node script that runs on Windows, macOS, and Linux using only the standard library.
- **Dry-run by default** — nothing is written until you pass `--apply`, so you can always preview the exact changes first.
- **Install vs. update** — `install` is incremental (fills gaps, skips existing files); `update` force-overwrites managed files.
- **Scoped orphan management** — cleanup is limited to managed directories, so unrelated files are left untouched.
- **Idempotent hook wiring** — hooks are matched by script basename per event, so re-running never duplicates wiring.
- **Strong config protection** — `.credentials.json`, `settings.json`, `memory`, `sessions`, and `projects` are never written or deleted.
- **Skill-visibility governance** — trims the skill listing to fit a ~1% context budget; on this library, 112 of 173 skill entries would otherwise be silently truncated.

## 🏗 How it works

The repository is the source of truth; the installer mirrors it into your global Claude Code config, then keeps the two in sync without ever clobbering local state. The current library holds **37 agents, 52 commands, 31 skills, and 41 hooks**.

Everything runs through one script, `claude-config.js`:

- `status` — read-only health check comparing the repo against your installed config.
- `install` — incremental deploy that fills gaps and skips existing files (writes with `--apply`).
- `update` — force-overwrite managed files to match the repository.
- `wire` — idempotent hook wiring, matched by script basename per event.
- `export-profile` — export the current setup as a portable profile.

## 🧰 Tech stack

| Area | Details |
| --- | --- |
| Runtime | Node.js 18+ (the installer itself uses only Node-14-level syntax and the standard library — no npm dependencies) |
| Target | Claude Code global config directory (`~/.claude`) |
| Bridges | Ships bridges for other tools: `.cursor`, `.codex`, `.gemini` |

## 🚀 Getting started

Prerequisites: Node.js 18+.

```bash
# 1) Clone and run a read-only health check
git clone <repo> ~/.claude-config
cd ~/.claude-config
node claude-config.js status

# 2) Deploy (writes only with --apply)
node claude-config.js install --apply
```

## 📌 Project status

The library was deliberately slimmed in August 2026: a heavier orchestration layer was removed, captured in the snapshot tag `pre-orchestrator-removal`.

## 🙏 Acknowledgements

This project builds on and is adapted from the open-source **everything-claude-code** project by **Affaan Mustafa** (MIT-licensed). Its structure and approach are indebted to that work; this repository adapts and extends it for a personal setup.

## 📄 License

MIT. This project inherits from and credits the MIT-licensed everything-claude-code upstream (see [Acknowledgements](#-acknowledgements)).

<p align="center"><sub>Built by <a href="https://github.com/SensLiao">Ruixuan "Sens" Liao</a> · USYD Advanced Computing (Honours)</sub></p>
