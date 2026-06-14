# Self-Hosted shadcn Registry — Template Scaffold

Reuse **your own** design system across every project. This scaffold is a ready-to-fill private
[shadcn registry](https://ui.shadcn.com/docs/registry/getting-started): your components, blocks,
hooks, and design tokens distributed as plain JSON over HTTP — framework-agnostic, free, OSS, no MCP.

> Skill that drives this: `shadcn-registry` (`~/.claude/skills/shadcn-registry/SKILL.md`).
> Pairs with `design-token-pipeline` (U1 — token source) and `uiux-surface-builder` (U3 — consumer).
> Cross-platform: every command is `npx` / `pnpm dlx` and runs identically in PowerShell and Bash.

## What's in here

```
shadcn-registry/
├── README.md                 # this file
├── registry.json             # the index: example style / ui / block / hook items (placeholders)
├── registry/
│   ├── ui/button.tsx         # example registry:ui item source
│   ├── blocks/stat-card.tsx  # example registry:block item (depends on button)
│   └── hooks/use-mounted.ts  # example registry:hook item source
├── components.example.json   # CONSUMER-side namespaced-registries snippet
└── package.example.json      # registry-host build/check scripts
```

## Step 1 — Copy into your registry-host project

The host can be any project that serves static files (a small Next.js app is the canonical choice,
so `public/r/*.json` is served automatically). Copy this scaffold into it:

```bash
# from your registry-host project root
cp -r ~/.claude/templates/shadcn-registry/registry ./registry
cp ~/.claude/templates/shadcn-registry/registry.json ./registry.json
npx shadcn@latest init        # creates components.json if absent
```

## Step 2 — Replace placeholders with YOUR system

1. In `registry.json`: change `"name": "acme"` + `"homepage"` to yours; replace the example items
   with your real components/blocks/hooks. Put each item's source under `registry/<type>/<name>.tsx`.
2. In the `acme-style` item's `cssVars`: paste your **design tokens** (sourced from
   `design-token-pipeline` U1 — see Step 5). The var names (`--primary`, `--background`, `--radius`,
   `--duration-*`) are shadcn's expected contract; map your U1 semantic tokens onto them ONCE.

## Step 3 — Build (validate + flatten)

```bash
npx shadcn@latest build                  # registry.json -> public/r/*.json (the wire format)
# add the scripts from package.example.json, then:  npm run registry:build
```
`build` validates every item against the schema and emits one flat JSON per item.

## Step 4 — Host + consume

```bash
# Host: deploy the project (Vercel/Netlify) → https://<domain>/r/<name>.json
#        or commit public/r/ and use GitHub raw URLs
#        or `next dev` → http://localhost:3000/r/<name>.json

# Consume from ANY project — direct URL:
npx shadcn@latest add https://acme.com/r/button.json

# Or namespaced (merge components.example.json's `registries` block into the consumer's components.json):
npx shadcn@latest registry add @acme=https://acme.com/r/{name}.json
npx shadcn@latest add @acme/button
npx shadcn@latest add @acme/stat-card

# Ship the WHOLE design system into a fresh project in one command (the registry:style item):
npx shadcn@latest add @acme/acme-style
```

For a **private** registry, embed an env-var token in the URL
(`https://reg.acme.com/r/{name}.json?token=${REGISTRY_TOKEN}`) — never commit the token.

## Step 5 — Wire tokens to design-token-pipeline (U1)

The `acme-style` item's `cssVars` is where your tokens ride along — `shadcn add` merges them into the
consumer's `:root` / `.dark`, so one install delivers components AND tokens together.

- **Source the values from U1**, don't hand-maintain them: have the Style Dictionary / Terrazzo build
  emit shadcn-named vars (`--primary`, `--background`, `--radius`, `--duration-*`) for `:root` and `.dark`,
  and reflect those into `acme-style.cssVars.light` / `.dark` / `.theme`.
- The U1 CI guard (`git diff --exit-code build/`) plus this registry's `registry:check`
  (`git diff --exit-code public/r/`) together keep tokens and registry from drifting.

| U1 output | → registry field | consumer effect |
|---|---|---|
| `build/css/variables.css` (`:root` + dark selector) | `acme-style.cssVars.light` / `.dark` | tokens merged into consumer theme |
| `--duration-*` / `--ease-*` motion tokens | `acme-style.cssVars.theme` | motion-engineering recipes read them |

## Hard rules

- Source of truth = `registry.json` + the source files. `public/r/*.json` are **build artifacts** — never hand-edit.
- Run `npx shadcn build` after any change; guard `public/r/` with `git diff --exit-code` in CI.
- Map tokens to shadcn's var contract ONCE (in the `registry:style` item), sourced from U1.
- Consumers install the built `/r/<name>.json`, never the raw `registry.json`.
- Don't design components or compile tokens here — that's L3 + `frontend-design` (components) and
  `design-token-pipeline` (tokens). This scaffold only **packages** them for distribution.
