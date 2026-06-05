#!/usr/bin/env python3
"""
add-deepseek-provider.py — install a DeepSeek (Anthropic-compatible) provider into
CC Switch's SQLite DB as a NON-CURRENT claude provider (provider-portability.md P4).

Safe by design:
  * Refuses to run while cc-switch.exe is open (live-DB corruption risk) unless --force.
  * Backs up cc-switch.db to ~/.cc-switch/backups/ before any write.
  * Clones the exact column shape of the existing 'claude-official' row, so we never
    guess the schema — we only override id / name / settings_config / category / icon.
  * is_current = 0  → does NOT change your active Claude provider. You switch in the
    CC Switch GUI when you want, then run ccswitch-guard.js --check/--restore.

Auth: uses ANTHROPIC_AUTH_TOKEN (Bearer) — verified accepted by DeepSeek's endpoint.
Model: no model pinning — DeepSeek's gateway auto-maps claude-opus-* -> deepseek-v4-pro
       and claude-sonnet-*/claude-haiku-* -> deepseek-v4-flash (strategy (a) alias map).

Usage:
  DEEPSEEK_API_KEY=sk-... python add-deepseek-provider.py          # reads key from env
  python add-deepseek-provider.py --key sk-...                     # or pass inline
  python add-deepseek-provider.py --key sk-... --force             # bypass running check
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

PROVIDER_ID = "deepseek-v4"
PROVIDER_NAME = "DeepSeek (V4 · Anthropic-compat)"
BASE_URL = "https://api.deepseek.com/anthropic"
WEBSITE = "https://platform.deepseek.com"


def cc_switch_running() -> bool:
    # NOTE: read tasklist as BYTES — Chinese Windows emits CP936/GBK, so text=True
    # with a UTF-8 default raises UnicodeDecodeError and would silently mis-report
    # "not running". The image name "cc-switch.exe" is ASCII, so a bytes check is
    # codec-proof. On any failure we treat it as RUNNING (fail-safe: block the write).
    try:
        out = subprocess.run(["tasklist"], capture_output=True, timeout=15)
        return b"cc-switch.exe" in out.stdout.lower()
    except Exception:
        return True  # can't tell → assume running and block (backup is not enough alone)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", default=os.environ.get("DEEPSEEK_API_KEY"))
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not args.key or not args.key.startswith("sk-"):
        print("ERROR: provide the DeepSeek key via --key sk-... or DEEPSEEK_API_KEY env.", file=sys.stderr)
        return 2
    if not os.path.exists(DB):
        print(f"ERROR: CC Switch DB not found: {DB}", file=sys.stderr)
        return 2
    if cc_switch_running() and not args.force:
        print("ERROR: CC Switch is RUNNING. Fully quit it (incl. system tray), then re-run.", file=sys.stderr)
        print("       (or pass --force to write the DB anyway — NOT recommended)", file=sys.stderr)
        return 2

    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup = os.path.join(BACKUP_DIR, f"cc-switch.db.pre-deepseek-{time.strftime('%Y%m%d-%H%M%S')}.db")
    shutil.copy2(DB, backup)
    print(f"✓ DB backed up → {os.path.relpath(backup, HOME)}")

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(providers)")
    cols = [r[1] for r in cur.fetchall()]

    # clone the exact shape of an existing claude provider
    cur.execute("SELECT * FROM providers WHERE app_type='claude' AND id='claude-official'")
    tmpl = cur.fetchone()
    if tmpl is None:
        cur.execute("SELECT * FROM providers WHERE app_type='claude' LIMIT 1")
        tmpl = cur.fetchone()
    if tmpl is None:
        print("ERROR: no claude provider row to clone schema from.", file=sys.stderr)
        return 2
    row = {k: tmpl[k] for k in cols}

    settings_config = json.dumps({"env": {
        "ANTHROPIC_BASE_URL": BASE_URL,
        "ANTHROPIC_AUTH_TOKEN": args.key,
    }}, ensure_ascii=False)

    row.update({
        "id": PROVIDER_ID,
        "app_type": "claude",
        "name": PROVIDER_NAME,
        "settings_config": settings_config,
        "website_url": WEBSITE,
        "category": "custom",
        "created_at": int(time.time() * 1000),
        "sort_index": 1,
        "is_current": 0,            # SAFE: do not steal the active provider
        "in_failover_queue": 0,
    })
    if "icon" in row:
        row["icon"] = None
    if "meta" in row and not row.get("meta"):
        row["meta"] = "{}"

    placeholders = ",".join(["?"] * len(cols))
    collist = ",".join(cols)
    cur.execute(f"INSERT OR REPLACE INTO providers ({collist}) VALUES ({placeholders})",
                [row[c] for c in cols])
    conn.commit()

    # verify (masked)
    cur.execute("SELECT id,name,app_type,is_current,settings_config FROM providers WHERE id=? AND app_type='claude'", (PROVIDER_ID,))
    v = cur.fetchone()
    sc = json.loads(v["settings_config"])
    env = sc.get("env", {})
    tok = env.get("ANTHROPIC_AUTH_TOKEN", "")
    masked = (tok[:6] + "..." + tok[-3:]) if len(tok) > 12 else "<set>"
    print("✓ provider installed (NOT current):")
    print(f"    id={v['id']}  name={v['name']}  is_current={v['is_current']}")
    print(f"    ANTHROPIC_BASE_URL={env.get('ANTHROPIC_BASE_URL')}")
    print(f"    ANTHROPIC_AUTH_TOKEN={masked}")
    conn.close()
    print()
    print("NEXT: reopen CC Switch → you'll see the DeepSeek provider in the list.")
    print("      To activate: click it (CC Switch writes settings.json env), THEN run:")
    print("        node ~/.claude/tools/ccswitch-guard/ccswitch-guard.js --check    # verify hooks intact")
    print("        node ~/.claude/tools/ccswitch-guard/ccswitch-guard.js --restore  # if drift, re-assert")
    return 0


if __name__ == "__main__":
    sys.exit(main())
