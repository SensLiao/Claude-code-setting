---
name: arch-viz
description: Use the local **arch-viz** CLI to turn any repo into a committable, presentable architecture bundle — an interactive offline viewer (`viz/index.html`), an agent-readable `graph.json`, an `architecture.svg`, and an `ARCHITECTURE.md` — written into the repo's `docs/architecture/`. Use this whenever the user wants to **visualize / map / diagram a repo's architecture**, generate an architecture diagram or code-graph picture, produce a **shareable or committable architecture artifact** for clients/teammates, or refresh a repo's `docs/architecture/` — even when they don't name the tool. Trigger phrases include "visualize the architecture / map this repo / architecture diagram / code graph / how is this codebase structured / show clients the architecture / 架构图 / 可视化架构 / 看这个仓库结构 / 生成架构图 / 给客户看的架构图". For quick "who calls X / blast radius" symbol lookups use `codegraph-cli` instead; for a permissive, committable artifact prefer arch-viz over the Noncommercial `gitnexus-repo-map`.
---

# arch-viz

> Supporting utility skill (Layer 11 Meta · "Code Reading Tools", alongside `codegraph-cli` and `gitnexus-repo-map`).
> Wraps the **arch-viz** CLI — a local tool that scans any repo (via CodeGraph) and emits a **committable, client-presentable architecture bundle** with a 100% permissive license chain.
> Upstream: <https://github.com/kplliaoshen666-droid/arch-viz-studio> · License: MIT.

## 1. Purpose

`arch-viz scan` runs CodeGraph (tree-sitter parse → local SQLite) as a subprocess, normalizes the result into a **deterministic** `graph.json`, and writes a four-file bundle into the target repo's `docs/architecture/`:

| File | For | What it is |
|---|---|---|
| `graph.json` | **AI agents + tooling** | the stable, versioned, deterministic graph contract (nodes · edges · clusters · metrics) |
| `viz/index.html` | **humans, zero-install** | a self-contained offline viewer — double-click to open, no server, no install |
| `architecture.svg` | docs / slides | rendered diagram |
| `ARCHITECTURE.md` | humans | narrative overview |

The point that makes arch-viz distinct from the other two code-reading tools: it produces a **deliverable you can commit and hand to a client or teammate** (and that an agent can read + safely annotate), with **zero non-permissive licenses** in the chain — so it is the right choice when the output needs to travel, be shown, or be committed.

## 2. Use this skill when

- The user wants to **visualize / map / diagram** a repo's architecture or overall shape.
- The user wants an **architecture diagram, code graph, or module map** they can show to clients/teammates.
- The user wants a **committable** architecture artifact (something to `git add` into `docs/architecture/`).
- The user wants to **refresh** an existing `docs/architecture/` bundle after code changes.
- The user wants an **agent-readable** view of a codebase to answer structural questions (what are the clusters? where are the hotspots? what does module X import?).

## 3. Do NOT use this skill when

- The user asks a **single symbol-level question** — "who calls `charge()` / blast radius of X / affected tests" → use `codegraph-cli` (faster, no bundle written).
- The user only wants a **conceptual explanation** with no repo in front of them → answer from knowledge; don't scan for nothing.
- The repo is **tiny and the user just needs to read 1-2 files** → use Read/Grep; don't pay the scan cost.
- The user wants to **change** the architecture (not see it) → that's a design decision; route through `gsd-pipeline-orchestrator`.
- The user is treating `robots.txt` / `noindex` / a viewer as **access control** → it is not; route security to `appsec-security-orchestrator`.

## 4. Pre-flight check

```bash
arch-viz --version 2>/dev/null || echo "arch-viz not installed"
codegraph --version 2>/dev/null || echo "codegraph not installed"   # required dependency
```

If **arch-viz** is not installed, it is installed from the `arch-viz-studio` repo (not via a public npm package) — tell the user and offer, but do not run global installs without consent:

```bash
git clone https://github.com/kplliaoshen666-droid/arch-viz-studio.git
cd arch-viz-studio && npm install && npm run install:global   # puts `arch-viz` on PATH
```

If **codegraph** is missing: `npm i -g @colbymchenry/codegraph`.

Node floor: **≥ 22.12** — and **avoid Node 25** (a V8 WASM JIT bug hard-exits CodeGraph). Use Node 22 or 24 LTS.

## 5. Workflow

The default and overwhelmingly common case is **scan the current repo**:

```bash
cd /path/to/the/repo        # or already there
arch-viz scan               # scans the current directory → ./docs/architecture/
```

Point it elsewhere, or tune it, with flags:

```bash
arch-viz scan /path/to/repo
arch-viz scan . --out build/arch         # custom output directory
arch-viz scan --no-sync                  # reuse the existing CodeGraph index (skip re-index)
arch-viz scan --use-target-codegraph     # allow the target repo's local CodeGraph (off by default — see §7)
arch-viz --help
arch-viz --version
```

Expected output:

```
• CodeGraph 0.9.4 → syncing /path/to/repo
✓ bundle → /path/to/repo/docs/architecture
  157 nodes · 265 edges · 36 clusters
  files: graph.json · architecture.svg · ARCHITECTURE.md · viz/index.html
```

After scanning, do the useful follow-through:

1. **Report** the counts and where the bundle landed.
2. **Answer the user's actual question** by reading `graph.json` (see §6) — don't just announce "done". If they asked "what are the main modules?", read the clusters; if "where's the complexity?", sort nodes by `metrics`.
3. **Tell them how to view it**: open `docs/architecture/viz/index.html` in a browser (zero install), or, in the arch-viz-studio repo, `npm run dev:app` for the full 4-pane explorer.
4. **Offer to commit** the bundle (`git add docs/architecture`) so it travels with the repo — that is the whole point.

## 6. Reading `graph.json` (the agent-facing contract)

`graph.json` is a versioned, deterministic contract. Read it directly to answer architecture questions. Essential shape:

```jsonc
{
  "meta": { "schemaVersion": "1.0.0", "sourceRepo": "...", "counts": { "nodes": N, "edges": M, "clusters": K }, ... },
  "nodes": [{
    "id": "<stable content-hash>", "kind": "file|class|function", "label": "name",
    "qualifiedName": "...", "path": "src/...", "lang": "ts",
    "cluster": <clusterId>, "flags": { "exported": true, ... },
    "metrics": { "loc": 42, "fanIn": 3, "fanOut": 5, "descendants": 12 },
    "annotations": null
  }],
  "edges": [{ "source": "<id>", "target": "<id>", "kind": "calls|imports|contains", "weight": 1 }],
  "clusters": [{ "id": 0, "label": "src", "color": "#4f8cff", "nodeIds": [...], "size": 16, "annotations": null }]
}
```

- **Hotspots** = nodes with high `fanIn` (heavily depended on) or high `descendants`/`fanOut`.
- **Modules** = `clusters` (seeded Louvain communities), labelled by their dominant directory.
- **Dependencies** = `edges` of kind `imports` (file→file) and `calls` (symbol→symbol).
- **Annotating**: an agent may set a node's `annotations` to a short string. It is **carried forward by stable id** on the next `arch-viz scan`, so notes you add survive a re-scan instead of being clobbered. This is what makes the file safely agent-updatable.
- Full schema + `validate()` live in the tool's `shared/README.md`.

## 7. Safety & boundaries (do not violate)

1. **It's a read tool.** arch-viz observes structure; it does not change code or make architecture decisions. Decisions route through GSD.
2. **No shell injection.** arch-viz spawns CodeGraph with an argv array, never a shell string — don't wrap it in `sh -c`.
3. **Trust boundary on scan.** By default only a **trusted global** CodeGraph is executed. `--use-target-codegraph` runs the *target repo's* `node_modules/.../codegraph` — only pass it for repos you trust, since scanning an untrusted repo would otherwise execute code it shipped.
4. **Writes stay in the target repo.** Output is path-fenced to `<repo>/docs/architecture/`. Don't redirect it outside with crafted `--out`.
5. **`.codegraph/` is a cache, not an artifact.** CodeGraph gitignores it; the committable thing is `docs/architecture/`, not the SQLite DB.
6. **Permissive chain only.** The shipped bundle's chain is 100% MIT/MPL. Do not introduce a Noncommercial path (e.g. GitNexus) into anything that gets committed or handed to a client.
7. **A viewer is not access control.** If the user thinks publishing `viz/index.html` gates access, correct them and route to `appsec-security-orchestrator`.

## 8. Handoff matrix

| Downstream | When to hand off |
|---|---|
| [[codegraph-cli]] | User narrows to a **specific symbol** — "who calls this / blast radius / affected tests". arch-viz draws the map; codegraph-cli aims at one node. |
| [[gitnexus-repo-map]] | User explicitly wants GitNexus's exploration UI **and** the output will never be committed/shipped (its license is Noncommercial). For anything client-facing, stay with arch-viz. |
| `gsd-pipeline-orchestrator` | The picture revealed a change worth planning — hand the structure to `plan-phase`. |
| `gsd-code-review` / `appsec-security-orchestrator` | A cluster or high-fanIn hotspot touches auth / payment / user-data — size the blast radius here, decide there. |

## 9. Two-line decision card

- **"Show me / draw / commit the repo's architecture (and I may show a client)"** → `arch-viz`
- **"Who calls / what breaks if I change this one symbol"** → `codegraph-cli`

## 10. Anti-patterns

- ❌ Running `arch-viz scan` to answer a single "who calls X" — that's a `codegraph-cli` one-liner; the full bundle is wasted work.
- ❌ Committing `.codegraph/` (the cache) instead of `docs/architecture/` (the artifact).
- ❌ Passing `--use-target-codegraph` on an untrusted repo to "make it work" — that runs the repo's own code.
- ❌ Re-scanning and reporting "done" without reading `graph.json` to answer what the user actually asked.
- ❌ Reaching for `gitnexus-repo-map` when the output must be committed/shown — its Noncommercial license disqualifies it from deliverables; arch-viz exists precisely for that case.
- ❌ Hand-editing `graph.json` formatting — it's canonical + schema-validated on write; edit only `annotations` values and let the next scan re-emit.

## 11. Maintenance

- Tool/flag changes → update §5 and §6 here only. Keep the CLI surface in this file aligned with `arch-viz --help`.
- This is a **global** user skill; it is intentionally **not** committed into the arch-viz-studio repo (that repo stays tool-only).
- If arch-viz ever ships as a published npm package, update §4's install path; until then it is installed from source via `npm run install:global`.
