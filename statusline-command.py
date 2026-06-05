#!/usr/bin/env python3
"""
Claude Code status line script for Windows CMD.
Reads JSON from stdin and outputs a formatted status line with ANSI colors.
"""

import sys
import json
import subprocess


def fmt_tokens(n):
    """Format a token count as a short string, e.g. 12000 -> '12k'."""
    try:
        n = int(n)
        if n >= 1000:
            return f"{n // 1000}k"
        return str(n)
    except (TypeError, ValueError):
        return "?"


def get_git_branch(cwd):
    """Return the current git branch name, or empty string if not in a repo."""
    if not cwd or cwd == "unknown":
        return ""
    try:
        result = subprocess.run(
            ["git", "-C", cwd, "--no-optional-locks",
             "symbolic-ref", "--short", "HEAD"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0:
            branch = result.stdout.strip()
            if branch:
                return branch
        # Detached HEAD: fall back to short commit hash
        result2 = subprocess.run(
            ["git", "-C", cwd, "--no-optional-locks",
             "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=3
        )
        if result2.returncode == 0:
            return result2.stdout.strip()
    except Exception:
        pass
    return ""


def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
    except Exception:
        return

    try:
        # --- Extract fields ---
        cwd = (
            data.get("cwd")
            or (data.get("workspace") or {}).get("current_dir")
            or "unknown"
        )

        model = (data.get("model") or {}).get("display_name") or "unknown"

        cw = data.get("context_window") or {}
        used_pct = cw.get("used_percentage")
        remaining_pct = cw.get("remaining_percentage")
        total_in = cw.get("total_input_tokens")
        total_out = cw.get("total_output_tokens")

        # --- Context window string ---
        if used_pct is not None:
            used_str = str(round(float(used_pct)))
            rem_str = str(round(float(remaining_pct))) if remaining_pct is not None else "?"
            session_in = fmt_tokens(total_in)
            session_out = fmt_tokens(total_out)
            token_str = (
                f"ctx:{used_str}% used, {rem_str}% left"
                f"  [session: {session_in} in / {session_out} out]"
            )
        else:
            token_str = "new session"

        # --- Git branch ---
        git_branch = get_git_branch(cwd)
        git_str = f" | branch:{git_branch}" if git_branch else ""

        # --- ANSI color codes ---
        CYAN    = "\033[36m"
        YELLOW  = "\033[33m"
        GREEN   = "\033[32m"
        MAGENTA = "\033[35m"
        RESET   = "\033[0m"

        output = (
            f"{CYAN}{cwd}{RESET}"
            f" | {YELLOW}{model}{RESET}"
            f" | {GREEN}{token_str}{RESET}"
            f"{MAGENTA}{git_str}{RESET}"
        )

        sys.stdout.write(output)
        sys.stdout.flush()

    except Exception:
        pass


if __name__ == "__main__":
    main()
