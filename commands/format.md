---
description: Format changed files with the project formatter (Prettier or Biome)
allowed-tools: Bash
---

Format the project's changed files using its configured formatter. (Per-file
auto-format already runs on edit; use this to bulk-format existing changes.)

1. Detect the formatter: Biome (`biome.json`/`biome.jsonc`) or Prettier (`.prettierrc*` / `prettier.config.*`). If neither is configured, tell me and stop — do not guess.
2. Collect changed files: `git diff --name-only` + `git diff --name-only --staged`. If not a git repo, ask before formatting the whole project.
3. Run the formatter in write mode on those files, preferring the local `node_modules/.bin` binary:
   - Biome: `biome check --write <files>`
   - Prettier: `prettier --write <files>`
4. Report which files were reformatted.
