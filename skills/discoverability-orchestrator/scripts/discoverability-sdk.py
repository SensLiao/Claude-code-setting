#!/usr/bin/env python3
"""L12 Discoverability Harness SDK v1.0.0.

Single-file Python 3.9+ GSD-lite harness for L12 (web-seo / web-aeo /
web-local-seo / app-aso). Contract: ~/.claude/templates/discoverability/
harness-contract.md sections 1-4 + 9 (binding). Stdlib-only fallback
(PyYAML used automatically when available — see _PYYAML below).

Commands (frozen per §9): init / classify / audit / evidence.append /
evidence.validate / gate.check / report / mark-stale / explain / status.
Every command emits its result as a single-line JSON to stdout; logs go
to stderr.
"""

import argparse, hashlib, json, os, shutil, subprocess, sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# STOP_BUILDING follow-through (2026-05-29, NATIVE-OVERLAP-AUDIT §6 #9): prefer the
# battle-tested PyYAML when present; the hand-rolled yaml_load/yaml_dump below are the
# stdlib-only fallback for truly dependency-free environments. Do NOT invest further in
# the hand-rolled parser.
try:
    import yaml as _PYYAML
except ImportError:
    _PYYAML = None

HARNESS_VERSION = "1.0.0"
SDK_NAME = "discoverability-sdk"
GENERATOR_TAG = f"{SDK_NAME} v{HARNESS_VERSION}"
CANONICAL_CHANNELS = ("seo", "ai-search", "local", "aso")
CHANNEL_ALIASES = {"aeo": "ai-search", "geo": "local"}
NARROW_SKILL_OF = {"seo": "web-seo", "ai-search": "web-aeo",
                   "local": "web-local-seo", "aso": "app-aso"}
# Mirror of activation-rules.yaml.
# States: required | optional | warn_only | disabled | conditional_landing | conditional_local
ACTIVATION_TABLE: Dict[str, Dict[str, str]] = {
    "content_site":                       {"seo": "required",            "ai-search": "required",  "local": "disabled",          "aso": "disabled"},
    "ecommerce":                          {"seo": "required",            "ai-search": "optional",  "local": "conditional_local", "aso": "disabled"},
    "local_service":                      {"seo": "required",            "ai-search": "optional",  "local": "required",          "aso": "disabled"},
    "b2b_saas_marketing":                 {"seo": "required",            "ai-search": "warn_only", "local": "disabled",          "aso": "disabled"},
    "api_with_public_docs":               {"seo": "required",            "ai-search": "required",  "local": "disabled",          "aso": "disabled"},
    "pure_backend_api_no_public_surface": {"seo": "disabled",            "ai-search": "disabled",  "local": "disabled",          "aso": "disabled"},
    "mobile_app":                         {"seo": "conditional_landing", "ai-search": "disabled",  "local": "conditional_local", "aso": "required"},
    "web_app_plus_mobile_app":            {"seo": "required",            "ai-search": "optional",  "local": "conditional_local", "aso": "required"},
}
# Placeholder tokens the init template ships for project.type. classify treats
# these (case-insensitive) exactly like a missing type -> BLOCKED_NEEDS_CONFIG,
# so a fresh `init` never silently classifies against an unfilled placeholder.
PROJECT_TYPE_PLACEHOLDERS = ("set_me", "set-me", "todo", "changeme", "change_me", "<set_me>")
SCORE_LIKE_KINDS = ("citability_score", "aeo_score", "geo_score", "ai_search_score")
LLMS_TXT_BLOCKER_TYPES = ("api_with_public_docs",)
DETERMINISTIC_SOURCES = {"script", "api", "framework_adapter"}
EXIT_OK, EXIT_FAIL, EXIT_BLOCKED, EXIT_STALE = 0, 1, 2, 3
_RANK = {"PASS": 0, "SKIPPED": 0, "WARN": 1, "FAIL": 2, "BLOCKED": 3, "STALE": 3}

# ----- Minimal YAML reader (mappings/sequences/scalars/inline flow) ---------

class YamlParseError(Exception):
    pass

def _strip_comment(line: str) -> str:
    out: List[str] = []; in_str: Optional[str] = None
    for ch in line:
        if in_str:
            out.append(ch)
            if ch == in_str: in_str = None
        elif ch in ("'", '"'):
            in_str = ch; out.append(ch)
        elif ch == "#":
            break
        else:
            out.append(ch)
    return "".join(out).rstrip()

def _parse_scalar(s: str) -> Any:
    s = s.strip()
    if s in ("", "~") or s.lower() == "null": return None
    if s.lower() == "true": return True
    if s.lower() == "false": return False
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    try:
        return int(s) if not any(c in s for c in ".eE") else float(s)
    except ValueError:
        return s

def _split_csv(inner: str) -> List[str]:
    parts: List[str] = []; cur: List[str] = []; depth = 0; in_str: Optional[str] = None
    for ch in inner:
        if in_str:
            cur.append(ch)
            if ch == in_str: in_str = None
        elif ch in ("'", '"'):
            in_str = ch; cur.append(ch)
        elif ch in "[{":
            depth += 1; cur.append(ch)
        elif ch in "]}":
            depth -= 1; cur.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(cur).strip()); cur = []
        else:
            cur.append(ch)
    if cur: parts.append("".join(cur).strip())
    return parts

def yaml_load(text: str) -> Any:
    if _PYYAML is not None:
        return _PYYAML.safe_load(text)
    lines: List[Tuple[int, str]] = []
    for ln in text.replace("\t", "  ").splitlines():
        s = _strip_comment(ln)
        if s.strip() == "": continue
        lines.append((len(ln) - len(ln.lstrip(" ")), s.lstrip(" ")))
    if not lines: return None
    pos = [0]

    def block(base: int) -> Any:
        if pos[0] >= len(lines): return None
        ind, c = lines[pos[0]]
        if ind < base: return None
        return parse_seq(ind) if c.startswith("- ") else parse_map(ind)

    def parse_map(base: int) -> Dict[str, Any]:
        r: Dict[str, Any] = {}
        while pos[0] < len(lines):
            ind, c = lines[pos[0]]
            if ind < base: break
            if ind > base: raise YamlParseError(f"unexpected indent: {c}")
            if c.startswith("- "): raise YamlParseError(f"expected map, got list: {c}")
            if ":" not in c: raise YamlParseError(f"map missing ':': {c}")
            k, _, rest = c.partition(":")
            k = k.strip().strip('"').strip("'")
            rest = rest.strip(); pos[0] += 1
            if rest == "":
                if pos[0] < len(lines) and lines[pos[0]][0] > base:
                    r[k] = block(lines[pos[0]][0])
                else:
                    r[k] = None
            elif rest.startswith("[") and rest.endswith("]"):
                inner = rest[1:-1].strip()
                r[k] = [_parse_scalar(p) for p in _split_csv(inner)] if inner else []
            elif rest.startswith("{") and rest.endswith("}"):
                inner = rest[1:-1].strip(); d: Dict[str, Any] = {}
                if inner:
                    for pair in _split_csv(inner):
                        kk, _, vv = pair.partition(":")
                        d[kk.strip()] = _parse_scalar(vv.strip())
                r[k] = d
            else:
                r[k] = _parse_scalar(rest)
        return r

    def parse_seq(base: int) -> List[Any]:
        items: List[Any] = []
        while pos[0] < len(lines):
            ind, c = lines[pos[0]]
            if ind < base or not c.startswith("- "): break
            if ind > base: raise YamlParseError(f"unexpected indent in seq: {c}")
            item = c[2:].strip(); pos[0] += 1
            if item == "":
                items.append(block(lines[pos[0]][0]) if pos[0] < len(lines) and lines[pos[0]][0] > base else None)
            elif ":" in item and not (item.startswith('"') or item.startswith("'")):
                k, _, v = item.partition(":")
                inline: Dict[str, Any] = {k.strip(): _parse_scalar(v.strip()) if v.strip() else None}
                child = base + 2
                while pos[0] < len(lines) and lines[pos[0]][0] >= child and not lines[pos[0]][1].startswith("- "):
                    si, sc = lines[pos[0]]
                    if si < child or ":" not in sc: break
                    sk, _, sv = sc.partition(":"); sv = sv.strip(); pos[0] += 1
                    if sv == "" and pos[0] < len(lines) and lines[pos[0]][0] > si:
                        inline[sk.strip()] = block(lines[pos[0]][0])
                    else:
                        inline[sk.strip()] = _parse_scalar(sv) if sv else None
                items.append(inline)
            else:
                items.append(_parse_scalar(item))
        return items

    return block(lines[0][0])

# ----- Minimal YAML emitter -------------------------------------------------

_SPECIAL = set(":#-?*&!|>{}[],%@`'\"\n")

def _quote_needed(s: str) -> bool:
    if s == "" or s.strip() != s or s.lower() in ("true", "false", "null", "yes", "no", "~"):
        return True
    if any(c in _SPECIAL for c in s): return True
    try: int(s); return True
    except ValueError: pass
    try: float(s); return True
    except ValueError: return False

def _emit_scalar(v: Any) -> str:
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    s = str(v)
    if _quote_needed(s):
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'
    return s

def _emit(obj: Any, depth: int) -> str:
    pad = "  " * depth
    if isinstance(obj, dict):
        if not obj: return f"{pad}{{}}" if depth > 0 else "{}"
        out: List[str] = []
        for k, v in obj.items():
            if isinstance(v, dict):
                if not v: out.append(f"{pad}{k}: {{}}")
                else: out.append(f"{pad}{k}:"); out.append(_emit(v, depth + 1))
            elif isinstance(v, list):
                if not v: out.append(f"{pad}{k}: []")
                else: out.append(f"{pad}{k}:"); out.append(_emit(v, depth + 1))
            else:
                out.append(f"{pad}{k}: {_emit_scalar(v)}")
        return "\n".join(out)
    if isinstance(obj, list):
        if not obj: return f"{pad}[]"
        out = []
        for item in obj:
            if isinstance(item, dict):
                if not item: out.append(f"{pad}- {{}}"); continue
                keys = list(item.keys())
                fk, fv = keys[0], item[keys[0]]
                if isinstance(fv, (dict, list)):
                    out.append(f"{pad}-"); out.append(_emit(item, depth + 1))
                else:
                    out.append(f"{pad}- {fk}: {_emit_scalar(fv)}")
                    for k in keys[1:]:
                        v = item[k]
                        if isinstance(v, (dict, list)):
                            out.append(f"{pad}  {k}:"); out.append(_emit(v, depth + 2))
                        else:
                            out.append(f"{pad}  {k}: {_emit_scalar(v)}")
            elif isinstance(item, list):
                out.append(f"{pad}-"); out.append(_emit(item, depth + 1))
            else:
                out.append(f"{pad}- {_emit_scalar(item)}")
        return "\n".join(out)
    return f"{pad}{_emit_scalar(obj)}"

def yaml_dump(obj: Any) -> str:
    if _PYYAML is not None:
        return _PYYAML.safe_dump(obj, default_flow_style=False, sort_keys=False, allow_unicode=True)
    return _emit(obj, 0).rstrip() + "\n"

# ----- Context + helpers ----------------------------------------------------

@dataclass
class Context:
    project_root: Path
    config_path: Path
    config: Dict[str, Any]
    config_hash: str
    @property
    def dot_root(self) -> Path: return self.project_root / ".discoverability"
    @property
    def state_path(self) -> Path: return self.dot_root / "state.json"
    @property
    def evidence_root(self) -> Path: return self.project_root / "evidence" / "discoverability"
    def run_dir(self, tag: str) -> Path: return self.dot_root / "runs" / tag
    def evidence_dir(self, tag: str) -> Path: return self.evidence_root / tag
    def rel_config(self) -> str:
        try: return str(self.config_path.relative_to(self.project_root))
        except ValueError: return str(self.config_path)

def err(msg: str) -> None: print(f"[{SDK_NAME}] {msg}", file=sys.stderr)
def now_iso() -> str: return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
def sha256_bytes(data: bytes) -> str: return "sha256:" + hashlib.sha256(data).hexdigest()
def sha256_file(path: Path) -> str: return sha256_bytes(path.read_bytes()) if path.exists() else ""

def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(str(tmp), str(path))

def emit_result(payload: Dict[str, Any]) -> None:
    """Final stdout: single-line JSON per contract §2.3."""
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))

def load_config(config_path: Path) -> Tuple[Dict[str, Any], str]:
    if not config_path.exists(): return {}, ""
    try:
        text = config_path.read_text(encoding="utf-8")
        h = sha256_bytes(text.encode("utf-8"))
        loaded = yaml_load(text)
        if loaded is None: return {}, h
        if not isinstance(loaded, dict):
            err("config.yaml top-level must be a mapping; ignoring"); return {}, h
        return loaded, h
    except YamlParseError as e:
        err(f"config.yaml could not be parsed by minimal reader ({e}) — install PyYAML or simplify")
        sys.exit(1)
    except Exception as e:
        err(f"failed to read config: {e}"); sys.exit(1)

def load_state(ctx: Context) -> Dict[str, Any]:
    if not ctx.state_path.exists(): return {}
    try: return json.loads(ctx.state_path.read_text(encoding="utf-8"))
    except Exception as e: err(f"state.json unreadable: {e}"); return {}

def write_state(ctx: Context, state: Dict[str, Any]) -> None:
    atomic_write(ctx.state_path, json.dumps(state, ensure_ascii=False, indent=2))

def normalize_channels(channels_cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Map legacy aeo/geo keys to canonical ai-search/local; warn on aliasing."""
    if not isinstance(channels_cfg, dict): return {}
    out: Dict[str, Any] = {}
    for k, v in channels_cfg.items():
        if k in CHANNEL_ALIASES:
            new = CHANNEL_ALIASES[k]
            err(f"config uses legacy channel key '{k}' -> mapping to canonical '{new}'")
            out[new] = v
        else:
            out[k] = v
    return out

def resolve_activation(project_cfg: Dict[str, Any], project_type: str) -> Dict[str, str]:
    table = ACTIVATION_TABLE.get(project_type)
    if table is None:
        err(f"unknown project.type '{project_type}'; defaulting all channels to disabled")
        return {c: "disabled" for c in CANONICAL_CHANNELS}
    has_landing = bool(project_cfg.get("has_web_landing"))
    try: physical = int(project_cfg.get("physical_locations") or 0)
    except (TypeError, ValueError): physical = 0
    areas = project_cfg.get("service_areas") or []
    has_local = physical > 0 or (isinstance(areas, list) and len(areas) > 0)
    out: Dict[str, str] = {}
    for ch, raw in table.items():
        if raw == "conditional_landing": out[ch] = "required" if has_landing else "disabled"
        elif raw == "conditional_local": out[ch] = "required" if has_local else "disabled"
        else: out[ch] = raw
    return out

def disabled_reason(ch: str, project_type: str) -> str:
    raw = ACTIVATION_TABLE.get(project_type, {}).get(ch, "disabled")
    if raw == "conditional_local":
        return "conditional_local trigger evaluated FALSE (no physical_locations and no service_areas)"
    if raw == "conditional_landing":
        return "conditional_landing trigger evaluated FALSE (project.has_web_landing is false)"
    labels = {"aso": "no mobile app", "local": "no local-business surface",
              "ai-search": "no AI-search-eligible public content"}
    return f"project type '{project_type}' has {labels.get(ch, 'channel disabled')}"

def worst(a: str, b: str) -> str:
    return b if _RANK.get(b, 0) > _RANK.get(a, 0) else a

def count_findings(findings: List[Dict[str, Any]]) -> Dict[str, int]:
    c = {"blocker": 0, "warn": 0, "info": 0}
    for f in findings or []:
        sev = (f.get("severity") or "info").lower()
        c[sev if sev in c else "info"] += 1
    return c

def is_score_like(finding: Dict[str, Any]) -> bool:
    kind = (finding.get("kind") or finding.get("id") or "").lower()
    return any(s in kind for s in SCORE_LIKE_KINDS)

def load_scope(ctx: Context, tag: str) -> Optional[Dict[str, Any]]:
    p = ctx.evidence_dir(tag) / "00-scope.yaml"
    if not p.exists(): return None
    try: return yaml_load(p.read_text(encoding="utf-8"))
    except YamlParseError as e: err(f"00-scope.yaml parse failed: {e}"); return None

def load_evidence_json(ctx: Context, tag: str, channel: str) -> Optional[Dict[str, Any]]:
    p = ctx.evidence_dir(tag) / f"{channel}.json"
    if not p.exists(): return None
    try: return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e: err(f"{channel}.json parse failed: {e}"); return None

# ----- Hook install + config bootstrap (project-installed model) ------------

def _claude_home() -> Path:
    return Path(os.environ.get("CLAUDE_HOME") or (Path.home() / ".claude"))

def ensure_disc_config(ctx: Context) -> bool:
    """Create discoverability.config.yaml from the global template if the project
    has none. The L12 hooks gate on this file's presence, so it must exist for
    enforcement to be live. Returns True if a new config was created."""
    if ctx.config_path.exists():
        return False
    template = _claude_home() / "templates" / "discoverability" / "discoverability.config.yaml"
    ctx.config_path.parent.mkdir(parents=True, exist_ok=True)
    if template.exists():
        shutil.copyfile(str(template), str(ctx.config_path))
        err(f"init: created {ctx.rel_config()} from template")
    else:
        # No hardcoded project.type fallback: ship an explicit placeholder the user
        # MUST replace. classify() treats SET_ME (and other placeholders) as missing
        # -> BLOCKED, so a fresh project can never silently classify against a guess.
        ctx.config_path.write_text(
            "project:\n"
            "  # REQUIRED: replace SET_ME with one of:\n"
            "  #   content_site | ecommerce | local_service | b2b_saas_marketing |\n"
            "  #   api_with_public_docs | pure_backend_api_no_public_surface |\n"
            "  #   mobile_app | web_app_plus_mobile_app\n"
            "  type: SET_ME\n"
            "harness:\n  enabled: true\n  strict_mode: true\n",
            encoding="utf-8")
        err(f"init: created minimal {ctx.rel_config()} (template missing) — set project.type (currently SET_ME placeholder)")
    return True

def install_disc_hooks(ctx: Context) -> Dict[str, Any]:
    """Copy L12 hooks into <project>/.claude/hooks/ and register them in
    <project>/.claude/settings.json via the shared node installer. Single source
    of truth for the hook list = manifests/hook-registry.json."""
    helper = _claude_home() / "orchestrator-runtime" / "shared" / "install-subsystem-hooks.js"
    node = shutil.which("node")
    if not helper.exists():
        err(f"init: WARN hook installer missing at {helper} — hooks NOT registered")
        return {"ok": False, "reason": "installer_missing"}
    if not node:
        err("init: WARN 'node' not on PATH — L12 hooks NOT registered "
            "(merge templates/discoverability/settings-snippet.json manually)")
        return {"ok": False, "reason": "node_missing"}
    try:
        proc = subprocess.run(
            [node, str(helper), "--subsystem", "discoverability",
             "--project-root", str(ctx.project_root), "--quiet"],
            capture_output=True, text=True)
    except Exception as e:  # pragma: no cover - spawn failure is environmental
        err(f"init: WARN hook install failed to spawn: {e}")
        return {"ok": False, "reason": "spawn_failed"}
    if proc.returncode != 0:
        err(f"init: WARN hook installer exited {proc.returncode}: {(proc.stderr or '').strip()}")
    try:
        return json.loads((proc.stdout or "").strip().splitlines()[-1])
    except Exception:
        return {"ok": proc.returncode == 0}

# ----- Commands -------------------------------------------------------------

def cmd_init(args: argparse.Namespace, ctx: Context) -> int:
    # tag is OPTIONAL: bare `init` bootstraps discoverability.config.yaml + registers
    # project-local hooks (no run tag yet). `init <tag>` ALSO scaffolds the run +
    # evidence dirs for that tag. Hooks gate on config presence, so bare init is enough.
    tag = args.tag
    created_config = ensure_disc_config(ctx)
    if created_config:  # refresh hash now that the config exists on disk
        ctx.config, ctx.config_hash = load_config(ctx.config_path)
    hook_result = install_disc_hooks(ctx)
    ctx.dot_root.mkdir(parents=True, exist_ok=True)
    (ctx.dot_root / "cache").mkdir(parents=True, exist_ok=True)
    if tag:
        ctx.run_dir(tag).mkdir(parents=True, exist_ok=True)
        ctx.evidence_dir(tag).mkdir(parents=True, exist_ok=True)
        for name, default in (("dispatch-log.json", {"tag": tag, "entries": []}),
                              ("stale-reasons.json", {"tag": tag, "events": []})):
            p = ctx.run_dir(tag) / name
            if not p.exists(): atomic_write(p, json.dumps(default, indent=2))
        fl = ctx.run_dir(tag) / "failures.log"
        if not fl.exists(): fl.write_text("", encoding="utf-8")
    state = load_state(ctx)
    state.update({
        "_schema_version": "1.0.0",
        "active_run_tag": tag or state.get("active_run_tag"),
        "active_run": bool(tag) or state.get("active_run", False),
        "gate_status": state.get("gate_status", "PENDING") if not tag else "PENDING",
        "stale_reasons": state.get("stale_reasons", []),
        "last_gate_at": state.get("last_gate_at"),
        "last_gate_result": state.get("last_gate_result"),
        "last_gate_evidence_hash": state.get("last_gate_evidence_hash"),
        "config_path": ctx.rel_config(), "config_hash": ctx.config_hash,
        "harness_version": HARNESS_VERSION,
    })
    write_state(ctx, state)
    err(f"init OK: tag={tag} config_created={created_config} hooks_ok={hook_result.get('ok')}")
    emit_result({"command": "init", "tag": tag, "exit_code": EXIT_OK,
                 "config_created": created_config,
                 "hooks_installed": bool(hook_result.get("ok")),
                 "evidence_dir": str(ctx.evidence_dir(tag)) if tag else None,
                 "run_dir": str(ctx.run_dir(tag)) if tag else None})
    return EXIT_OK

def cmd_classify(args: argparse.Namespace, ctx: Context) -> int:
    tag = args.tag
    if not ctx.config:
        err("config missing — cannot classify (run init first or provide --config)")
        emit_result({"command": "classify", "tag": tag, "exit_code": EXIT_FAIL, "error": "config_missing"})
        return EXIT_FAIL
    project_cfg = ctx.config.get("project") or {}
    raw_type = project_cfg.get("type")
    project_type = (str(raw_type).strip() if raw_type is not None else "")
    # Never default a missing / placeholder / invalid project.type. Defaulting it
    # (old behavior: -> pure_backend_api_no_public_surface) silently disabled every
    # channel -> gate.check produced an empty hollow PASS. Align with the
    # disc-scope-classifier contract ("project.type missing -> BLOCKED. Never guess").
    is_placeholder = project_type == "" or project_type.lower() in PROJECT_TYPE_PLACEHOLDERS
    if is_placeholder or project_type not in ACTIVATION_TABLE:
        reason = ("project.type missing or placeholder" if is_placeholder
                  else f"project.type '{project_type}' not one of {tuple(ACTIVATION_TABLE)}")
        err(f"classify BLOCKED: {reason} — set a real project.type in {ctx.rel_config()} (never guessed)")
        scope_path = ctx.evidence_dir(tag) / "00-scope.yaml"
        atomic_write(scope_path, yaml_dump({
            "_schema_version": "1.0.0", "tag": tag, "classified_at": now_iso(),
            "classified_by": "discoverability-sdk classify",
            "status": "BLOCKED_NEEDS_CONFIG", "blocked_reason": reason,
            "project_type": None, "public_surfaces": [], "active_channels": {},
            "geo_resolution": {"input_term_observed": None, "resolved_to": None, "reason": None},
            "disabled_reasons": {},
        }))
        emit_result({"command": "classify", "tag": tag, "exit_code": EXIT_BLOCKED,
                     "status": "BLOCKED_NEEDS_CONFIG", "error": "project_type_missing_or_invalid",
                     "blocked_reason": reason, "scope_path": str(scope_path)})
        return EXIT_BLOCKED
    channels_cfg = normalize_channels(ctx.config.get("channels") or {})
    resolved = resolve_activation(project_cfg, project_type)
    active: Dict[str, str] = {}; disabled: Dict[str, str] = {}
    for ch, st in resolved.items():
        if st == "disabled":
            disabled[ch] = disabled_reason(ch, project_type); active[ch] = "not_applicable"; continue
        ov = channels_cfg.get(ch)
        if isinstance(ov, dict) and ov.get("state"): st = ov["state"]
        active[ch] = st
    surfaces = ctx.config.get("public_surfaces") or []
    if not isinstance(surfaces, list): surfaces = []
    scope = {
        "_schema_version": "1.0.0", "tag": tag, "classified_at": now_iso(),
        "classified_by": "disc-scope-classifier (via discoverability-sdk classify)",
        "project_type": project_type, "public_surfaces": surfaces,
        "active_channels": active,
        "geo_resolution": {"input_term_observed": None, "resolved_to": None, "reason": None},
        "disabled_reasons": disabled,
    }
    scope_path = ctx.evidence_dir(tag) / "00-scope.yaml"
    atomic_write(scope_path, yaml_dump(scope))
    enabled = [c for c, s in active.items() if s not in ("not_applicable", "disabled")]
    err(f"classify OK: project_type={project_type} active={enabled}")
    emit_result({"command": "classify", "tag": tag, "exit_code": EXIT_OK,
                 "project_type": project_type, "active_channels": active,
                 "scope_path": str(scope_path)})
    return EXIT_OK

def cmd_audit(args: argparse.Namespace, ctx: Context) -> int:
    tag, channel = args.tag, args.channel
    if channel not in CANONICAL_CHANNELS:
        err(f"invalid --channel '{channel}' (must be one of {CANONICAL_CHANNELS})")
        emit_result({"command": "audit", "tag": tag, "exit_code": EXIT_FAIL, "error": "invalid_channel"})
        return EXIT_FAIL
    log_path = ctx.run_dir(tag) / "dispatch-log.json"
    if not log_path.exists():
        err(f"run not initialised — run `init {tag}` first")
        emit_result({"command": "audit", "tag": tag, "exit_code": EXIT_FAIL, "error": "run_not_initialised"})
        return EXIT_FAIL
    try: doc = json.loads(log_path.read_text(encoding="utf-8"))
    except Exception: doc = {"tag": tag, "entries": []}
    expected = ctx.evidence_dir(tag) / f"{channel}.json"
    doc.setdefault("entries", []).append({
        "ts": now_iso(), "step": "audit_scaffold", "channel": channel,
        "narrow_skill": NARROW_SKILL_OF[channel],
        "evidence_expected_at": str(expected),
    })
    atomic_write(log_path, json.dumps(doc, indent=2, ensure_ascii=False))
    err(f"audit scaffold OK: channel={channel} narrow_skill={NARROW_SKILL_OF[channel]}")
    emit_result({"command": "audit", "tag": tag, "channel": channel, "exit_code": EXIT_OK,
                 "evidence_expected_at": str(expected)})
    return EXIT_OK

def cmd_evidence_append(args: argparse.Namespace, ctx: Context) -> int:
    tag, channel, src = args.tag, args.channel, Path(args.file)
    if channel in CHANNEL_ALIASES:
        canon = CHANNEL_ALIASES[channel]
        err(f"channel '{channel}' is legacy alias -> using canonical '{canon}'")
        channel = canon
    if channel not in CANONICAL_CHANNELS:
        err(f"invalid channel '{channel}'")
        emit_result({"command": "evidence.append", "tag": tag, "exit_code": EXIT_FAIL, "error": "invalid_channel"})
        return EXIT_FAIL
    if not src.exists():
        err(f"source file not found: {src}")
        emit_result({"command": "evidence.append", "tag": tag, "exit_code": EXIT_FAIL, "error": "source_missing"})
        return EXIT_FAIL
    try: new_data = json.loads(src.read_text(encoding="utf-8"))
    except Exception as e:
        err(f"source JSON parse failed: {e}")
        emit_result({"command": "evidence.append", "tag": tag, "exit_code": EXIT_FAIL, "error": "source_parse"})
        return EXIT_FAIL
    target = ctx.evidence_dir(tag) / f"{channel}.json"
    existing: Dict[str, Any] = {}
    if target.exists():
        try: existing = json.loads(target.read_text(encoding="utf-8"))
        except Exception: existing = {}
    if not isinstance(existing, dict): existing = {}
    merged: Dict[str, Any] = dict(existing)
    if isinstance(new_data, dict):
        nfs = new_data.get("findings") or []
        ofs = merged.get("findings") or []
        if isinstance(nfs, list) and nfs:
            merged["findings"] = (ofs if isinstance(ofs, list) else []) + nfs
        for k, v in new_data.items():
            if k != "findings": merged[k] = v
    warnings = list(merged.get("_validation_warnings") or [])
    if "source" not in merged:
        merged["source"] = "unknown"; warnings.append("source_field_missing_in_input")
    merged.setdefault("_schema_version", "1.0.0")
    merged.setdefault("channel", channel); merged.setdefault("tag", tag)
    merged["appended_at"] = now_iso()
    if warnings: merged["_validation_warnings"] = warnings
    atomic_write(target, json.dumps(merged, ensure_ascii=False, indent=2))
    fc = len(merged.get("findings") or [])
    err(f"evidence.append OK: {channel}.json source={merged.get('source')} findings={fc}")
    emit_result({"command": "evidence.append", "tag": tag, "channel": channel,
                 "exit_code": EXIT_OK, "evidence_path": str(target),
                 "source": merged.get("source"), "findings": fc, "warnings": warnings})
    return EXIT_OK

def _channel_validation(ctx: Context, tag: str, ch: str, state: str,
                        project_type: str, appsec: List[Dict[str, Any]]) -> Dict[str, Any]:
    if state in ("not_applicable", "disabled"):
        return {"status": "SKIPPED", "skipped_reason": "channel disabled in scope"}
    ev = load_evidence_json(ctx, tag, ch)
    if ev is None:
        return {"status": "BLOCKED" if state == "required" else "WARN",
                "schema_match": False, "deterministic_source_present": False,
                "command_evidence_present": False,
                "findings_count": {"blocker": 0, "warn": 0, "info": 0},
                "hard_rule_violations": ["evidence_file_missing"],
                "notes": "no evidence file present"}
    findings = ev.get("findings") if isinstance(ev.get("findings"), list) else []
    findings = findings or []
    sources = {(f.get("source") or ev.get("source") or "unknown") for f in findings} or {ev.get("source", "unknown")}
    ev_source = ev.get("source", "unknown")
    deterministic = bool(sources & DETERMINISTIC_SOURCES) or ev_source in DETERMINISTIC_SOURCES
    all_manual = (len(findings) > 0 and sources.issubset({"manual_ai_scan"})) or \
                 (len(findings) == 0 and ev_source == "manual_ai_scan")
    violations: List[str] = []
    if state == "required" and (all_manual or (not deterministic and len(findings) == 0)):
        violations.append("all_evidence_manual_ai_scan_no_deterministic_fallback")
    # Per-finding hard-rule enforcement (in-place downgrade + violation tagging).
    # MUST stay in sync with cmd_gate_check's downgrade logic so that validate and
    # gate.check agree on final severity counts — otherwise a CI pipeline that
    # calls only `evidence.validate` will get false FAILs.
    for idx, f in enumerate(findings):
        fid = (f.get("id") or "").lower()
        sev = (f.get("severity") or "").lower()
        # Rule 1: llms.txt missing — blocker only for api_with_public_docs
        if "llms" in fid and "missing" in fid:
            if project_type not in LLMS_TXT_BLOCKER_TYPES and sev == "blocker":
                err(f"downgrading llms.txt blocker -> warn (project_type='{project_type}' is not in {LLMS_TXT_BLOCKER_TYPES})")
                f["severity"] = "warn"
                if "llms_txt_blocker_downgraded_to_warn_for_non_docs_project" not in violations:
                    violations.append("llms_txt_blocker_downgraded_to_warn_for_non_docs_project")
        # Rule 2: score-like findings (citability/aeo/geo/ai-search _score) never blocker
        if is_score_like(f) and sev == "blocker":
            err(f"downgrading score-like blocker on channel '{ch}' (id={f.get('id')}) to warn — score-type findings cannot block per contract §4.2")
            f["severity"] = "warn"
            if "score_like_finding_used_as_blocker" not in violations:
                violations.append("score_like_finding_used_as_blocker")
        # Rule 3: private/leak/secret signals → appsec handoff
        tags = [t.lower() for t in (f.get("tags") or [])]
        if "private" in fid or "leak" in fid or "secret" in fid or "private" in tags:
            appsec.append({"channel": ch, "id": f.get("id"), "severity": f.get("severity"),
                           "evidence_ref": f"{ch}.json#/findings/{idx}"})
    counts = count_findings(findings)
    if "all_evidence_manual_ai_scan_no_deterministic_fallback" in violations and state == "required":
        status = "BLOCKED"
    elif counts["blocker"] > 0:
        status = "FAIL" if state == "required" else "WARN"
    elif counts["warn"] > 0 or violations:
        status = "WARN"
    else:
        status = "PASS"
    notes = ev.get("_validation_warnings") or []
    return {"status": status, "schema_match": True,
            "deterministic_source_present": deterministic,
            "command_evidence_present": deterministic,
            "findings_count": counts, "hard_rule_violations": violations,
            "notes": "; ".join(notes) if notes else ""}

def cmd_evidence_validate(args: argparse.Namespace, ctx: Context) -> int:
    tag = args.tag
    scope = load_scope(ctx, tag)
    if not scope:
        err(f"00-scope.yaml missing for tag={tag}; run `classify {tag}` first")
        emit_result({"command": "evidence.validate", "tag": tag,
                     "exit_code": EXIT_BLOCKED, "error": "scope_missing"})
        return EXIT_BLOCKED
    active = scope.get("active_channels", {}) or {}
    project_type = scope.get("project_type", "")
    by_channel: Dict[str, Any] = {}; appsec: List[Dict[str, Any]] = []
    worst_decision = "PASS"
    for ch in CANONICAL_CHANNELS:
        e = _channel_validation(ctx, tag, ch, active.get(ch, "not_applicable"), project_type, appsec)
        by_channel[ch] = e
        if e.get("status") and e["status"] != "SKIPPED":
            worst_decision = worst(worst_decision, e["status"])
    score = enabled = 0
    for data in by_channel.values():
        if data.get("status") == "SKIPPED": continue
        enabled += 1
        if data.get("deterministic_source_present"): score += 2
        elif data.get("schema_match"): score += 1
    if enabled == 0: confidence = "n/a"
    else:
        ratio = score / (enabled * 2)
        confidence = "high" if ratio >= 0.85 else "medium" if ratio >= 0.5 else "low"
    out = {
        "_schema_version": "1.0.0", "tag": tag, "validated_at": now_iso(),
        "validated_by": "disc-evidence-validator (via discoverability-sdk evidence.validate)",
        "by_channel": by_channel,
        "overall_evidence_confidence": confidence,
        "release_decision_input": worst_decision,
        "appsec_handoff": {"required": bool(appsec), "findings": appsec},
    }
    out_path = ctx.evidence_dir(tag) / "evidence-validation.yaml"
    atomic_write(out_path, yaml_dump(out))
    exit_code = {"BLOCKED": EXIT_BLOCKED, "FAIL": EXIT_FAIL}.get(worst_decision, EXIT_OK)
    err(f"evidence.validate OK: release_decision_input={worst_decision} confidence={confidence}")
    emit_result({"command": "evidence.validate", "tag": tag, "exit_code": exit_code,
                 "release_decision_input": worst_decision,
                 "by_channel": {c: by_channel[c].get("status") for c in by_channel},
                 "validation_path": str(out_path)})
    return exit_code

def _load_remediation(ctx: Context, tag: str) -> Dict[str, Any]:
    p = ctx.evidence_dir(tag) / "remediation-plan.yaml"
    if not p.exists(): return {}
    try: data = yaml_load(p.read_text(encoding="utf-8")) or {}
    except YamlParseError: return {}
    tasks = data.get("tasks") or {}; handoff: Dict[str, List[str]] = {}
    for owner, items in tasks.items():
        if isinstance(items, list):
            handoff[owner] = [it.get("id") for it in items if isinstance(it, dict) and it.get("id")]
        else:
            handoff[owner] = []
    return handoff

def _gate_doc(ctx: Context, tag: str, decision: str, hard_block: List[str],
              fails: List[Any], warns: List[Any], channels: Dict[str, Any],
              remediation: Dict[str, Any], evidence_hashes: Dict[str, Optional[str]],
              config_hash: str) -> Dict[str, Any]:
    return {
        "_schema_version": "1.0.0", "tag": tag, "generated_at": now_iso(),
        "generated_by": f"{GENERATOR_TAG} gate.check",
        "decision": decision, "hard_block_reasons": hard_block,
        "fail_reasons": fails, "warn_reasons": warns, "channels": channels,
        "remediation_handoff": remediation or {"frontend": [], "uiux": [],
            "growth": [], "mobile": [], "appsec": [], "qa": []},
        "config_hash": config_hash, "evidence_hashes": evidence_hashes,
        "config_path": ctx.rel_config(),
        "scope_path": str(ctx.evidence_dir(tag) / "00-scope.yaml"),
        "validation_path": str(ctx.evidence_dir(tag) / "evidence-validation.yaml"),
    }

def _update_state_after_gate(ctx: Context, state: Dict[str, Any],
                              decision: str, gate_path: Path) -> None:
    state.update({"gate_status": decision, "last_gate_at": now_iso(),
                  "last_gate_result": decision,
                  "last_gate_evidence_hash": sha256_file(gate_path),
                  "harness_version": HARNESS_VERSION})
    if not state.get("config_hash"): state["config_hash"] = ctx.config_hash
    write_state(ctx, state)

def cmd_gate_check(args: argparse.Namespace, ctx: Context) -> int:
    tag = args.tag
    state = load_state(ctx)
    if state.get("gate_status") == "STALE":
        doc = _gate_doc(ctx, tag, "STALE",
                        ["state marked STALE — rerun audit + gate.check"],
                        [], [], {}, {}, {}, ctx.config_hash or state.get("config_hash", ""))
        path = ctx.evidence_dir(tag) / "gate-result.yaml"
        atomic_write(path, yaml_dump(doc))
        _update_state_after_gate(ctx, state, "STALE", path)
        emit_result({"command": "gate.check", "tag": tag, "decision": "STALE",
                     "exit_code": EXIT_STALE, "channels": {}, "gate_path": str(path)})
        return EXIT_STALE
    scope = load_scope(ctx, tag)
    if not scope:
        err("00-scope.yaml missing — cannot gate.check")
        emit_result({"command": "gate.check", "tag": tag, "decision": "BLOCKED",
                     "exit_code": EXIT_BLOCKED, "error": "scope_missing"})
        return EXIT_BLOCKED
    val_path = ctx.evidence_dir(tag) / "evidence-validation.yaml"
    if not val_path.exists():
        err("evidence-validation.yaml missing — run evidence.validate first")
        emit_result({"command": "gate.check", "tag": tag, "decision": "BLOCKED",
                     "exit_code": EXIT_BLOCKED, "error": "validation_missing"})
        return EXIT_BLOCKED
    try: validation = yaml_load(val_path.read_text(encoding="utf-8")) or {}
    except YamlParseError as e:
        err(f"validation parse failed: {e}")
        emit_result({"command": "gate.check", "tag": tag, "decision": "BLOCKED",
                     "exit_code": EXIT_BLOCKED, "error": "validation_parse"})
        return EXIT_BLOCKED
    active = scope.get("active_channels", {}) or {}
    by_channel = validation.get("by_channel", {}) or {}
    decision = "PASS"; hard_block: List[str] = []
    fails: List[Dict[str, Any]] = []; warns: List[Dict[str, Any]] = []
    channels_doc: Dict[str, Any] = {}; channels_summary: Dict[str, str] = {}
    evidence_hashes: Dict[str, Optional[str]] = {}
    for ch in CANONICAL_CHANNELS:
        ch_state = active.get(ch, "not_applicable")
        ev_path = ctx.evidence_dir(tag) / f"{ch}.json"
        evidence_hashes[ch] = sha256_file(ev_path) if ev_path.exists() else None
        if ch_state in ("not_applicable", "disabled"):
            channels_doc[ch] = {"state": "disabled", "enabled": False, "decision": "SKIPPED",
                "skipped_reason": (scope.get("disabled_reasons") or {}).get(ch, f"channel '{ch}' disabled")}
            channels_summary[ch] = "SKIPPED"; continue
        v_entry = by_channel.get(ch) or {}
        ev = load_evidence_json(ctx, tag, ch) or {}
        findings = ev.get("findings") if isinstance(ev.get("findings"), list) else []
        findings = findings or []
        ch_blockers: List[Dict[str, Any]] = []; ch_warnings: List[Dict[str, Any]] = []
        for f in findings:
            sev = (f.get("severity") or "info").lower()
            if sev == "blocker" and is_score_like(f):
                err(f"downgrading score-like blocker on channel '{ch}' (id={f.get('id')}) to warn — score-type findings cannot block per contract §4.2")
                sev = "warn"
            entry = {"id": f.get("id"), "detail": f.get("title") or f.get("detail") or ""}
            if sev == "blocker": ch_blockers.append(entry)
            elif sev == "warn": ch_warnings.append(entry)
        deterministic = bool(v_entry.get("deterministic_source_present"))
        violations = v_entry.get("hard_rule_violations") or []
        if ch_state == "required":
            if not ev_path.exists():
                ch_decision = "BLOCKED"; hard_block.append(f"channel {ch}: no evidence file")
            elif "all_evidence_manual_ai_scan_no_deterministic_fallback" in violations or \
                 (not deterministic and not ch_blockers and not ch_warnings):
                ch_decision = "BLOCKED"
                hard_block.append(f"channel {ch}: no deterministic evidence (source=manual_ai_scan only)")
            elif ch_blockers:
                ch_decision = "FAIL"
                fails.extend({"channel": ch, **b} for b in ch_blockers)
            elif ch_warnings:
                ch_decision = "WARN"
                warns.extend({"channel": ch, **w} for w in ch_warnings)
            else:
                ch_decision = "PASS"
        else:
            if not ev_path.exists():
                ch_decision = "WARN"
                warns.append({"channel": ch, "id": "evidence_missing",
                              "detail": f"non-required channel '{ch}' has no evidence file"})
            elif ch_blockers:
                ch_decision = "WARN"
                warns.extend({"channel": ch, "id": b.get("id"),
                              "detail": f"[downgraded from blocker on non-required channel] {b.get('detail')}"}
                             for b in ch_blockers)
            elif ch_warnings:
                ch_decision = "WARN"
                warns.extend({"channel": ch, **w} for w in ch_warnings)
            else:
                ch_decision = "PASS"
        channels_summary[ch] = ch_decision
        decision = worst(decision, ch_decision)
        channels_doc[ch] = {
            "state": ch_state, "enabled": True, "decision": ch_decision,
            "blockers": ch_blockers, "warnings": ch_warnings,
            "evidence_path": str(ev_path) if ev_path.exists() else None,
            "source": ev.get("source", "unknown"),
            "deterministic_source_present": deterministic,
            "finding_count": count_findings(findings),
        }
    if decision == "PASS" and warns: decision = "WARN"
    remediation = _load_remediation(ctx, tag)
    config_hash = ctx.config_hash or state.get("config_hash", "")
    doc = _gate_doc(ctx, tag, decision, hard_block, fails, warns,
                    channels_doc, remediation, evidence_hashes, config_hash)
    gate_path = ctx.evidence_dir(tag) / "gate-result.yaml"
    atomic_write(gate_path, yaml_dump(doc))
    exit_code = {"PASS": EXIT_OK, "WARN": EXIT_OK, "FAIL": EXIT_FAIL,
                 "BLOCKED": EXIT_BLOCKED, "STALE": EXIT_STALE}[decision]
    _update_state_after_gate(ctx, state, decision, gate_path)
    err(f"gate.check decision={decision} channels={channels_summary}")
    emit_result({"command": "gate.check", "tag": tag, "decision": decision,
                 "exit_code": exit_code, "channels": channels_summary,
                 "gate_path": str(gate_path)})
    return exit_code

def cmd_report(args: argparse.Namespace, ctx: Context) -> int:
    tag = args.tag
    scope = load_scope(ctx, tag) or {}
    val_path = ctx.evidence_dir(tag) / "evidence-validation.yaml"
    gate_path = ctx.evidence_dir(tag) / "gate-result.yaml"
    try: validation = yaml_load(val_path.read_text(encoding="utf-8")) if val_path.exists() else {}
    except YamlParseError: validation = {}
    try: gate = yaml_load(gate_path.read_text(encoding="utf-8")) if gate_path.exists() else {}
    except YamlParseError: gate = {}
    validation = validation or {}; gate = gate or {}
    project_type = scope.get("project_type", "unknown")
    active = scope.get("active_channels", {})
    decision = gate.get("decision", "PENDING")
    channels = gate.get("channels") or {}
    L: List[str] = [
        f"# L12 Discoverability Report — {tag}", "",
        f"- Generated: {now_iso()}", f"- Generator: {GENERATOR_TAG}",
        f"- Project type: `{project_type}`", f"- Decision: **{decision}**", "",
        "## Active channels", "",
        "| Channel | State | Decision |", "|---|---|---|",
    ]
    for ch in CANONICAL_CHANNELS:
        L.append(f"| {ch} | {active.get(ch, 'not_applicable')} | {(channels.get(ch) or {}).get('decision', 'SKIPPED')} |")
    L.append("")
    for label, key in (("BLOCKED reasons", "hard_block_reasons"),
                       ("FAIL findings (required channel blockers)", "fail_reasons"),
                       ("Warnings", "warn_reasons")):
        items = gate.get(key) or []
        if not items: continue
        L += [f"## {label}", ""]
        for it in items:
            if isinstance(it, dict):
                L.append(f"- [{it.get('channel','-')}] {it.get('id','-')}: {it.get('detail','')}")
            else:
                L.append(f"- {it}")
        L.append("")
    handoff = gate.get("remediation_handoff") or {}
    if any(v for v in handoff.values() if v):
        L += ["## Remediation handoff", ""]
        for owner, ids in handoff.items():
            if ids: L.append(f"- **{owner}**: {', '.join(ids)}")
        L.append("")
    appsec = validation.get("appsec_handoff") or {}
    if appsec.get("required"):
        L += ["## AppSec handoff required", ""]
        for f in appsec.get("findings") or []:
            L.append(f"- {f.get('channel')} :: {f.get('id')} ({f.get('severity')}) — {f.get('evidence_ref')}")
        L.append("")
    L += ["## Evidence references", "",
          f"- Scope: `{ctx.evidence_dir(tag) / '00-scope.yaml'}`",
          f"- Validation: `{val_path}`", f"- Gate result: `{gate_path}`"]
    for ch in CANONICAL_CHANNELS:
        p = ctx.evidence_dir(tag) / f"{ch}.json"
        if p.exists(): L.append(f"- {ch}: `{p}`")
    L.append("")
    out_path = ctx.evidence_dir(tag) / "report.md"
    atomic_write(out_path, "\n".join(L))
    err(f"report OK: {out_path}")
    emit_result({"command": "report", "tag": tag, "exit_code": EXIT_OK,
                 "report_path": str(out_path), "decision": decision})
    return EXIT_OK

def cmd_mark_stale(args: argparse.Namespace, ctx: Context) -> int:
    state = load_state(ctx)
    reason, file_path = args.reason, args.file
    event = {"reason": reason, "file_path": file_path, "marked_at": now_iso(),
             "marked_by": "disc-mark-stale (via discoverability-sdk mark-stale)"}
    state.setdefault("stale_reasons", []).append(event)
    state["gate_status"] = "STALE"
    state["harness_version"] = HARNESS_VERSION
    write_state(ctx, state)
    active_tag = state.get("active_run_tag")
    if active_tag:
        stale_file = ctx.run_dir(active_tag) / "stale-reasons.json"
        if stale_file.exists():
            try: doc = json.loads(stale_file.read_text(encoding="utf-8"))
            except Exception: doc = {"tag": active_tag, "events": []}
        else:
            doc = {"tag": active_tag, "events": []}
        doc.setdefault("events", []).append(event)
        atomic_write(stale_file, json.dumps(doc, ensure_ascii=False, indent=2))
    err(f"mark-stale OK: reason='{reason}' file='{file_path}'")
    emit_result({"command": "mark-stale", "tag": active_tag, "exit_code": EXIT_OK,
                 "gate_status": "STALE", "reason": reason, "file_path": file_path})
    return EXIT_OK

def cmd_explain(args: argparse.Namespace, ctx: Context) -> int:
    tag, finding_id = args.tag, args.finding
    scope = load_scope(ctx, tag) or {}
    val_path = ctx.evidence_dir(tag) / "evidence-validation.yaml"
    try: validation = yaml_load(val_path.read_text(encoding="utf-8")) if val_path.exists() else {}
    except YamlParseError: validation = {}
    validation = validation or {}
    payload: Dict[str, Any] = {
        "command": "explain", "tag": tag, "exit_code": EXIT_OK,
        "project_type": scope.get("project_type"),
        "active_channels": scope.get("active_channels", {}),
        "validation_summary": validation.get("by_channel", {}),
        "channels": {},
    }
    for ch in CANONICAL_CHANNELS:
        ev = load_evidence_json(ctx, tag, ch)
        if ev is None: continue
        all_findings = ev.get("findings") if isinstance(ev.get("findings"), list) else []
        all_findings = all_findings or []
        findings = [f for f in all_findings if f.get("id") == finding_id] if finding_id else all_findings
        payload["channels"][ch] = {"source": ev.get("source"),
            "findings_count": count_findings(all_findings), "findings": findings}
    emit_result(payload)
    return EXIT_OK

def cmd_status(args: argparse.Namespace, ctx: Context) -> int:
    state = load_state(ctx)
    tag = args.tag or state.get("active_run_tag")
    gate_summary: Dict[str, Any] = {}
    if tag:
        gate_path = ctx.evidence_dir(tag) / "gate-result.yaml"
        if gate_path.exists():
            try:
                doc = yaml_load(gate_path.read_text(encoding="utf-8")) or {}
                gate_summary = {"decision": doc.get("decision"),
                                "generated_at": doc.get("generated_at"),
                                "channels": {c: (doc.get("channels", {}).get(c) or {}).get("decision")
                                             for c in CANONICAL_CHANNELS}}
            except YamlParseError:
                gate_summary = {"error": "gate-result.yaml parse failed"}
    err(f"active_tag={tag} gate_status={state.get('gate_status')} last_gate={state.get('last_gate_at')}")
    emit_result({"command": "status", "tag": tag, "exit_code": EXIT_OK,
                 "state": state, "gate_summary": gate_summary})
    return EXIT_OK

# ----- CLI dispatch ---------------------------------------------------------

COMMANDS = {
    "init": cmd_init, "classify": cmd_classify, "audit": cmd_audit,
    "evidence.append": cmd_evidence_append, "evidence.validate": cmd_evidence_validate,
    "gate.check": cmd_gate_check, "report": cmd_report,
    "mark-stale": cmd_mark_stale, "explain": cmd_explain, "status": cmd_status,
}

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog=SDK_NAME,
        description=f"L12 Discoverability Harness SDK v{HARNESS_VERSION}")
    p.add_argument("--config", default="discoverability.config.yaml")
    p.add_argument("--project-root", default=".")
    sub = p.add_subparsers(dest="command", required=True)
    sp = sub.add_parser("init"); sp.add_argument("tag", nargs="?", default=None)
    for name in ("classify", "report"):
        sp = sub.add_parser(name); sp.add_argument("tag")
    sp = sub.add_parser("audit"); sp.add_argument("tag"); sp.add_argument("--channel", required=True)
    sp = sub.add_parser("evidence.append")
    sp.add_argument("tag"); sp.add_argument("channel"); sp.add_argument("file")
    sp = sub.add_parser("evidence.validate"); sp.add_argument("tag")
    sp = sub.add_parser("gate.check"); sp.add_argument("tag")
    sp = sub.add_parser("mark-stale")
    sp.add_argument("--reason", required=True); sp.add_argument("--file", default=None)
    sp = sub.add_parser("explain"); sp.add_argument("tag"); sp.add_argument("--finding", default=None)
    sp = sub.add_parser("status"); sp.add_argument("--tag", default=None)
    return p

def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    project_root = Path(args.project_root).resolve()
    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = (project_root / config_path).resolve()
    config, config_hash = load_config(config_path)
    ctx = Context(project_root=project_root, config_path=config_path,
                  config=config, config_hash=config_hash)
    handler = COMMANDS.get(args.command)
    if handler is None:
        err(f"unknown command: {args.command}"); return EXIT_FAIL
    try:
        return handler(args, ctx)
    except SystemExit:
        raise
    except Exception as e:
        err(f"FATAL in {args.command}: {e}")
        emit_result({"command": args.command, "exit_code": EXIT_FAIL, "error": str(e)})
        return EXIT_FAIL

if __name__ == "__main__":
    sys.exit(main())
