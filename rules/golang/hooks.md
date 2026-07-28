---
paths:
  - "**/*.go"
  - "**/go.mod"
  - "**/go.sum"
---
# Go Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Go specific content.
>
> **STATUS: advisory, NOT wired** — no global hook runs any of these. `~/.claude/settings.json` registers no formatter/linter for this language, so nothing below happens automatically. Treat it as the checklist to configure per project, not a description of what already runs.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **gofmt/goimports**: Auto-format `.go` files after edit
- **go vet**: Run static analysis after editing `.go` files
- **staticcheck**: Run extended static checks on modified packages
