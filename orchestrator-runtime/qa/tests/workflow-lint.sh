#!/usr/bin/env bash
# workflow-lint.sh — R14 (QA-PHASE-B-BLUEPRINT §22 reviewer round).
# Scans ~/.claude/workflows/qa-orchestrator.js for forbidden APIs and patterns
# that would break determinism, cause IO inside workflow body, or bypass
# schema-forced agent output.
#
# Forbidden inside workflow body:
#   - Date.now() / new Date() (would break resume cache)
#   - Math.random() (would break determinism)
#   - fetch / axios / http(s) module / net module (network IO)
#   - require('fs') / fs.* / process.cwd / __dirname (filesystem IO)
#   - require('child_process') / exec / spawn (process IO)
#   - require() of anything (module loading)
#   - eval / new Function (arbitrary code execution)
#   - agent() call without schema option (must use schema-forced output)
#   - .filter(Boolean) on fanout/pipeline results (R7 — must record MISSING)
#
# Allowed in `description:` string (just doc, not code path).
#
# Exit:
#   0 — clean
#   2 — at least one violation (listed on stderr)

set -u
WF="${1:-$HOME/.claude/workflows/qa-orchestrator.js}"
if [[ ! -f "$WF" ]]; then
  echo "internal: workflow file not found: $WF" >&2
  exit 3
fi

# Strip the meta description string and any code comments before scanning.
# This avoids false positives on documentation lines like
#   "description: '... no Date.now / Math.random ...'"
stripped=$(awk '
  BEGIN { in_meta=0 }
  /^export const meta = \{/ { in_meta=1; next }
  in_meta==1 && /^\}/ { in_meta=0; next }
  in_meta==1 { next }
  # Strip line comments (// ...) but keep code on same line
  { sub(/\/\/.*$/, ""); print }
' "$WF")

violations=()

scan() {
  local pattern="$1" label="$2"
  if echo "$stripped" | grep -nE "$pattern" >/dev/null; then
    echo "$label:"
    echo "$stripped" | grep -nE "$pattern" | head -5 | sed 's/^/  /'
    violations+=("$label")
  fi
}

scan 'Date\.now\(\)' "Date.now() call"
scan 'new Date\(' "new Date() instantiation"
scan 'Math\.random\(\)' "Math.random() call"
scan '\bfetch\(' "fetch() call"
scan 'require\(' "require() module load"
scan '\bfs\.' "fs.* filesystem access"
scan '\bprocess\.cwd' "process.cwd() call"
scan '\b__dirname\b' "__dirname access"
scan '\beval\(' "eval() call"
scan 'new Function\(' "new Function() dynamic code"
scan 'child_process' "child_process module"
scan '\.filter\(Boolean\)' "filter(Boolean) silent drop (R7 forbidden)"
scan '\bhttp\.|\bhttps\.|\bnet\.|\baxios\.' "http/https/net/axios IO"

# Verify agent() always has schema option
# Pattern: agent( ... ) — must contain schema:
# We grep all agent( calls and check each block ends with schema: somewhere.
awk '
/agent\(/ {
  start = NR
  buf = $0
  depth = gsub(/\(/, "&", $0) - gsub(/\)/, "&", $0)
  while (depth > 0 && (getline next_line) > 0) {
    buf = buf "\n" next_line
    depth += gsub(/\(/, "&", next_line) - gsub(/\)/, "&", next_line)
  }
  # Skip the agent() inside the shim comment "// Workflow primitives"
  if (buf ~ /shim|stub|comment/) next
  if (buf !~ /schema:/) {
    print "AGENT-NO-SCHEMA at line " start ":"
    n = split(buf, lines, "\n")
    for (i = 1; i <= n && i <= 6; i++) print "  " lines[i]
  }
}
' <<<"$stripped" > /tmp/_qa_wflint_agentcheck.$$ 2>/dev/null

if [[ -s /tmp/_qa_wflint_agentcheck.$$ ]]; then
  cat /tmp/_qa_wflint_agentcheck.$$
  violations+=("agent() without schema option")
fi
rm -f /tmp/_qa_wflint_agentcheck.$$ 2>/dev/null

if (( ${#violations[@]} == 0 )); then
  echo "QA workflow-lint OK: $(wc -l < "$WF") lines scanned, 0 violations"
  exit 0
fi

echo "" >&2
echo "QA workflow-lint FAILED: ${#violations[@]} violation kind(s):" >&2
for v in "${violations[@]}"; do echo "  x $v" >&2; done
exit 2
