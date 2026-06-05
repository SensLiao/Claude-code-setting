#!/usr/bin/env python3
"""
add-anthropic-provider.py — install Anthropic-compatible providers (GLM / Kimi /
MiniMax / DeepSeek / custom) into CC Switch's SQLite DB as NON-CURRENT claude
providers (provider-portability.md P4). Generalizes add-deepseek-provider.py.

Safe by design (identical guarantees to the DeepSeek installer):
  * Refuses to run while cc-switch.exe is open (live-DB corruption risk) unless --force.
  * Backs up cc-switch.db to ~/.cc-switch/backups/ before any write.
  * Clones the exact column shape of an existing claude provider row — never guesses
    the schema; only overrides id / name / settings_config / category / website / icon.
  * is_current = 0  → never changes your active provider. Switch in the CC Switch GUI,
    then run ccswitch-guard.js --check/--restore.

Key handling (keep secrets OUT of the chat transcript — prefer --from-file):
  * --from-file <path> : each non-empty, non-# line is "<preset> <key>" (space or '=').
                         Installs every listed provider in one run. Recommended: you
                         paste keys into a temp file yourself, I read it, then it is shred.
  * --preset X --key sk-... : single install (key inline — appears in transcript).
  * --preset X            : key read from env var <PRESET>_API_KEY (e.g. ZAI_API_KEY).

Model mapping notes (verified from each vendor's Claude Code docs, May 2026):
  * glm     : Z.ai coding-plan endpoint AUTO-MAPS claude-opus/sonnet/haiku server-side
              → no model env needed. (Pay-as-you-go without coding plan may need --model.)
  * kimi    : Moonshot's /anthropic does NOT auto-map → we pin ANTHROPIC_*_MODEL to one
              model id (default kimi-k2.5; override with --model).
  * minimax : same as kimi → pin to one model id (default MiniMax-M2.7; override --model).
  * deepseek: server auto-maps opus→v4-pro, sonnet/haiku→v4-flash → no model env.
  ⚠ Model ids drift monthly. After activating, run /model in Claude Code and update
    with --model <id> if the pinned id is stale.

Usage:
  python add-anthropic-provider.py --from-file ~/.cc-switch/_keys.tmp
  python add-anthropic-provider.py --preset glm --key <zai-key>
  ZAI_API_KEY=... python add-anthropic-provider.py --preset glm
  python add-anthropic-provider.py --preset kimi --key ... --model kimi-k2.6 --cn
  python add-anthropic-provider.py --preset custom --id foo --name "Foo" \
         --base-url https://api.foo/anthropic --key ...
"""
import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time

HOME = os.path.expanduser("~")
DB = os.path.join(HOME, ".cc-switch", "cc-switch.db")
BACKUP_DIR = os.path.join(HOME, ".cc-switch", "backups")

# preset -> {id, name, base, base_cn, website, model}. model=None means rely on
# server-side auto-map (no ANTHROPIC_*_MODEL written). A non-None model is pinned
# to every Claude tier (opus/sonnet/haiku/small-fast) because that vendor does not
# auto-map Claude model names.
PRESETS = {
    "glm": {
        "id": "glm-zai", "name": "GLM (Z.ai · Anthropic-compat)",
        "base": "https://api.z.ai/api/anthropic",
        "base_cn": "https://open.bigmodel.cn/api/anthropic",
        "website": "https://z.ai", "model": None,
    },
    "kimi": {
        "id": "kimi-moonshot", "name": "Kimi (Moonshot · Anthropic-compat)",
        "base": "https://api.moonshot.ai/anthropic",
        "base_cn": "https://api.moonshot.cn/anthropic",
        "website": "https://platform.moonshot.ai", "model": "kimi-k2.5",
    },
    "minimax": {
        "id": "minimax", "name": "MiniMax (Anthropic-compat)",
        "base": "https://api.minimax.io/anthropic",
        "base_cn": "https://api.minimaxi.com/anthropic",
        "website": "https://platform.minimax.io", "model": "MiniMax-M2.7",
    },
    "deepseek": {
        "id": "deepseek-v4", "name": "DeepSeek (V4 · Anthropic-compat)",
        "base": "https://api.deepseek.com/anthropic",
        "base_cn": "https://api.deepseek.com/anthropic",
        "website": "https://platform.deepseek.com", "model": None,
    },
}


def cc_switch_running() -> bool:
    # tasklist as BYTES — Chinese Windows emits CP936/GBK; image name is ASCII so a
    # bytes check is codec-proof. On any failure, assume RUNNING (fail-safe: block).
    try:
        out = subprocess.run(["tasklist"], capture_output=True, timeout=15)
        return b"cc-switch.exe" in out.stdout.lower()
    except Exception:
        return True


def build_settings_config(base_url: str, key: str, model) -> str:
    env = {"ANTHROPIC_BASE_URL": base_url, "ANTHROPIC_AUTH_TOKEN": key}
    if model:
        env.update({
            "ANTHROPIC_MODEL": model,
            "ANTHROPIC_DEFAULT_OPUS_MODEL": model,
            "ANTHROPIC_DEFAULT_SONNET_MODEL": model,
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": model,
            "ANTHROPIC_SMALL_FAST_MODEL": model,
        })
    return json.dumps({"env": env}, ensure_ascii=False)


def resolve_spec(args, preset_key, key):
    """Return (pid, name, base_url, website, model) for one install."""
    if preset_key == "custom":
        if not (args.id and args.name and args.base_url):
            raise ValueError("custom preset needs --id, --name, --base-url")
        return (args.id, args.name, args.base_url, args.website or "", args.model)
    p = PRESETS[preset_key]
    base = p["base_cn"] if args.cn else p["base"]
    base = args.base_url or base
    model = args.model if args.model is not None else p["model"]
    return (args.id or p["id"], args.name or p["name"], base, args.website or p["website"], model)


def install_one(cur, cols, tmpl, pid, name, base_url, website, key, model):
    row = {k: tmpl[k] for k in cols}
    row.update({
        "id": pid, "app_type": "claude", "name": name,
        "settings_config": build_settings_config(base_url, key, model),
        "website_url": website, "category": "custom",
        "created_at": int(time.time() * 1000), "sort_index": 1,
        "is_current": 0, "in_failover_queue": 0,
    })
    if "icon" in row:
        row["icon"] = None
    if "meta" in row and not row.get("meta"):
        row["meta"] = "{}"
    placeholders = ",".join(["?"] * len(cols))
    collist = ",".join(cols)
    cur.execute(f"INSERT OR REPLACE INTO providers ({collist}) VALUES ({placeholders})",
                [row[c] for c in cols])
    masked = (key[:6] + "..." + key[-3:]) if len(key) > 12 else "<set>"
    print(f"  ✓ {pid:16s} {name}")
    print(f"      base={base_url}  token={masked}  model={model or '(server auto-map)'}")


def parse_from_file(path):
    out = []
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.replace("=", " ", 1).split(None, 1)
            if len(parts) != 2:
                print(f"  ! skip malformed line: {line[:30]}", file=sys.stderr)
                continue
            preset, key = parts[0].strip().lower(), parts[1].strip()
            out.append((preset, key))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preset", choices=list(PRESETS) + ["custom"])
    ap.add_argument("--key")
    ap.add_argument("--from-file", help="batch install: lines '<preset> <key>'")
    ap.add_argument("--model", default=None, help="pin/override model id for this provider")
    ap.add_argument("--cn", action="store_true", help="use China endpoint variant")
    ap.add_argument("--id"); ap.add_argument("--name")
    ap.add_argument("--base-url"); ap.add_argument("--website")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(DB):
        print(f"ERROR: CC Switch DB not found: {DB}", file=sys.stderr)
        return 2
    if cc_switch_running() and not args.force:
        print("ERROR: CC Switch is RUNNING. Fully quit it (incl. system tray), then re-run.", file=sys.stderr)
        return 2

    # Build the install list.
    jobs = []  # (preset_key, key)
    if args.from_file:
        jobs = parse_from_file(args.from_file)
        for pk, _ in jobs:
            if pk not in PRESETS:
                print(f"ERROR: unknown preset in file: {pk} (allowed: {', '.join(PRESETS)})", file=sys.stderr)
                return 2
    elif args.preset:
        key = args.key or os.environ.get(f"{args.preset.upper()}_API_KEY")
        if not key:
            print(f"ERROR: provide --key, --from-file, or env {args.preset.upper()}_API_KEY", file=sys.stderr)
            return 2
        jobs = [(args.preset, key)]
    else:
        print("ERROR: need --preset or --from-file. Presets:", ", ".join(PRESETS), file=sys.stderr)
        return 2

    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup = os.path.join(BACKUP_DIR, f"cc-switch.db.pre-add-{time.strftime('%Y%m%d-%H%M%S')}.db")
    shutil.copy2(DB, backup)
    print(f"✓ DB backed up → {os.path.relpath(backup, HOME)}\n")

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(providers)")
    cols = [r[1] for r in cur.fetchall()]
    cur.execute("SELECT * FROM providers WHERE app_type='claude' AND id='claude-official'")
    tmpl = cur.fetchone() or cur.execute("SELECT * FROM providers WHERE app_type='claude' LIMIT 1").fetchone()
    if tmpl is None:
        print("ERROR: no claude provider row to clone schema from.", file=sys.stderr)
        return 2

    print("Installing providers (is_current=0, NOT activated):")
    for preset_key, key in jobs:
        pid, name, base_url, website, model = resolve_spec(args, preset_key, key)
        install_one(cur, cols, tmpl, pid, name, base_url, website, key, model)
    conn.commit()

    # verify
    print("\nDB now holds these custom claude providers:")
    for r in cur.execute("SELECT id,name,is_current FROM providers WHERE app_type='claude' AND category='custom' ORDER BY id"):
        print(f"  - {r['id']:16s} current={r['is_current']}  {r['name']}")
    conn.close()
    print("\nNEXT: reopen CC Switch → providers appear in the list.")
    print("  Activate one → run: node ~/.claude/tools/ccswitch-guard/ccswitch-guard.js --check")
    print("  (drift → ... --restore) → new session to take effect → /model to confirm model id.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
