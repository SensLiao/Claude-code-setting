---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
---
# Rust Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Rust-specific content.
>
> **STATUS: advisory, NOT wired** — no global hook runs any of these. `~/.claude/settings.json` registers no formatter/linter for this language, so nothing below happens automatically. Treat it as the checklist to configure per project, not a description of what already runs.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **cargo fmt**: Auto-format `.rs` files after edit
- **cargo clippy**: Run lint checks after editing Rust files
- **cargo check**: Verify compilation after changes (faster than `cargo build`)
