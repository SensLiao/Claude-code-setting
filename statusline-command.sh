#!/usr/bin/env bash

input=$(cat)

# Parse JSON using jq if available, otherwise fall back to python3/python
parse_json() {
  local data="$1"
  if command -v jq >/dev/null 2>&1; then
    cwd=$(echo "$data" | jq -r '.cwd // .workspace.current_dir // "unknown"')
    model=$(echo "$data" | jq -r '.model.display_name // "unknown"')
    used_pct=$(echo "$data" | jq -r '.context_window.used_percentage // empty')
    remaining_pct=$(echo "$data" | jq -r '.context_window.remaining_percentage // empty')
    total_in=$(echo "$data" | jq -r '.context_window.total_input_tokens // empty')
    total_out=$(echo "$data" | jq -r '.context_window.total_output_tokens // empty')
    ctx_size=$(echo "$data" | jq -r '.context_window.context_window_size // empty')
    cur_in=$(echo "$data" | jq -r '.context_window.current_usage.input_tokens // empty')
    # Round percentages if present
    if [ -n "$used_pct" ] && [ "$used_pct" != "null" ]; then
      used_pct=$(printf "%.0f" "$used_pct" 2>/dev/null || echo "$used_pct")
    else
      used_pct=""
    fi
    if [ -n "$remaining_pct" ] && [ "$remaining_pct" != "null" ]; then
      remaining_pct=$(printf "%.0f" "$remaining_pct" 2>/dev/null || echo "$remaining_pct")
    else
      remaining_pct=""
    fi
  else
    # Try python3 first, then python
    local python_cmd=""
    if command -v python3 >/dev/null 2>&1; then
      python_cmd="python3"
    elif command -v python >/dev/null 2>&1; then
      python_cmd="python"
    fi

    if [ -n "$python_cmd" ]; then
      result=$(echo "$data" | "$python_cmd" -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cwd = d.get('cwd') or (d.get('workspace') or {}).get('current_dir', 'unknown') or 'unknown'
    model = (d.get('model') or {}).get('display_name', 'unknown') or 'unknown'
    cw = d.get('context_window') or {}
    used_val = cw.get('used_percentage')
    rem_val = cw.get('remaining_percentage')
    used = str(round(float(used_val))) if used_val is not None else ''
    remaining = str(round(float(rem_val))) if rem_val is not None else ''
    total_in = str(cw.get('total_input_tokens', '')) if cw.get('total_input_tokens') is not None else ''
    total_out = str(cw.get('total_output_tokens', '')) if cw.get('total_output_tokens') is not None else ''
    ctx_size = str(cw.get('context_window_size', '')) if cw.get('context_window_size') is not None else ''
    cur = cw.get('current_usage') or {}
    cur_in = str(cur.get('input_tokens', '')) if cur.get('input_tokens') is not None else ''
    print(cwd)
    print(model)
    print(used)
    print(remaining)
    print(total_in)
    print(total_out)
    print(ctx_size)
    print(cur_in)
except Exception as e:
    print('unknown')
    print('unknown')
    print('')
    print('')
    print('')
    print('')
    print('')
    print('')
" 2>/dev/null)
      cwd=$(echo "$result" | sed -n '1p')
      model=$(echo "$result" | sed -n '2p')
      used_pct=$(echo "$result" | sed -n '3p')
      remaining_pct=$(echo "$result" | sed -n '4p')
      total_in=$(echo "$result" | sed -n '5p')
      total_out=$(echo "$result" | sed -n '6p')
      ctx_size=$(echo "$result" | sed -n '7p')
      cur_in=$(echo "$result" | sed -n '8p')
    else
      cwd="unknown"
      model="unknown"
      used_pct=""
      remaining_pct=""
      total_in=""
      total_out=""
      ctx_size=""
      cur_in=""
    fi
  fi
}

parse_json "$input"

# Build context window usage string.
#
# NOTE: Claude Code does not expose subscription plan quota (weekly usage /
# reset time) in the status line JSON. The JSON only contains per-conversation
# context window data. used_percentage / remaining_percentage are null until
# the first message is sent in a session.
#
# What we show:
#   - Before first message : "new session"
#   - After messages start : "ctx: X% used, Y% left  [session: Nk in / Mk out]"
if [ -n "$used_pct" ]; then
  # Format cumulative session tokens in a readable way (e.g. 12k, 150k)
  fmt_tokens() {
    local n="$1"
    if [ -z "$n" ] || [ "$n" = "null" ]; then
      echo "?"
      return
    fi
    if [ "$n" -ge 1000 ] 2>/dev/null; then
      echo "$(( n / 1000 ))k"
    else
      echo "$n"
    fi
  }
  session_in=$(fmt_tokens "$total_in")
  session_out=$(fmt_tokens "$total_out")
  token_str="ctx:${used_pct}% used, ${remaining_pct}% left  [session: ${session_in} in / ${session_out} out]"
else
  # No messages yet in this session
  token_str="new session"
fi

# Get Git branch
git_str=""
if [ -n "$cwd" ] && git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null \
    || git -C "$cwd" --no-optional-locks rev-parse --short HEAD 2>/dev/null)
  if [ -n "$git_branch" ]; then
    git_str=" | branch:${git_branch}"
  fi
fi

# Print status line with ANSI colors
printf "\033[36m%s\033[0m | \033[33m%s\033[0m | \033[32m%s\033[0m\033[35m%s\033[0m" \
  "$cwd" "$model" "$token_str" "$git_str"
