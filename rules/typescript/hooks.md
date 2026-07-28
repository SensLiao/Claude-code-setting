---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---
# TypeScript/JavaScript Hooks

> This file extends [common/hooks.md](../common/hooks.md) with TypeScript/JavaScript specific content.
>
> **STATUS: partially wired.** Prettier/Biome formatting on `.ts/.tsx/.js/.jsx` **does** run globally via `scripts/hooks/post-edit-format.js` (it auto-detects the project's formatter and prefers the local `node_modules/.bin` binary). The `tsc` check and the console.log audit are **NOT** wired — configure those per project.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **Prettier**: Auto-format JS/TS files after edit
- **TypeScript check**: Run `tsc` after editing `.ts`/`.tsx` files
- **console.log warning**: Warn about `console.log` in edited files

## Stop Hooks

- **console.log audit**: Check all modified files for `console.log` before session ends
