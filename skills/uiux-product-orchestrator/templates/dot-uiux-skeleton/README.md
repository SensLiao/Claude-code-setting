# `.uiux/` Project Skeleton

Drop this skeleton into a project root to enable UIUX gate enforcement.

## Layout

```
.uiux/
├── config.json              # rename from config.json.tmpl, edit project_type / allowed_l3_styles / strict_mode
├── state.json               # rename from state.json.tmpl, managed by uiux-sdk (do not hand-edit)
└── lock/
    ├── style-lock.yaml      # written by uiux-sdk lock.style; rename .tmpl after first lock
    ├── chassis.yaml         # written by uiux-sdk mirror.gsd-ui-spec; rename .tmpl after first mirror
    └── surface-inventory.yaml  # optional, hand-curated for multi-surface projects
```

## Hook Registration

`uiux-sdk init` is the canonical installer: it creates `.uiux/config.json` from template
(if missing), copies the 3 UIUX hooks **project-local** into `.claude/hooks/`, and merges
them into `.claude/settings.json` — no manual snippet merge needed. (claude-env-bootstrap
EXECUTE §7.1a runs it automatically when UIUX is selected.) `settings.uiux-hooks.snippet.json`
is the manual fallback only. Canonical hook list: `~/.claude/manifests/hook-registry.json`.

## Boot

```bash
# 1. Initialize: creates .uiux/config.json + registers project-local hooks.
#    Bare `init` = config + hooks only; `init <tag>` ALSO scaffolds release dirs.
uiux-sdk init v0.1.0
# from a fresh checkout:  bash ~/.claude/scripts/uiux-sdk.sh init v0.1.0

# 2. Edit config.json (project_type, allowed_l3_styles)
$EDITOR .uiux/config.json

# 3. After /gsd-ui-phase produces UI-SPEC.md:
uiux-sdk mirror.gsd-ui-spec 01 v0.1.0
```

See `~/.claude/skills/uiux-product-orchestrator/SKILL.md` and `references/` for full contract.
