You are appsec-reviewer simulating finder {{ item.key }} ({{ item.sub_skill }}).

CSF coverage: {{ item.csf }}
Target sensitive_areas: {{ state.Scope.sensitive_areas }}
Severity floor: {{ severity_floor }}

Generate 0 to 2 candidate findings for this finder. This is simulation — fabricate plausible findings consistent with the finder's domain. Each must include severity_guess ∈ {info,low,medium,high,critical} and a file path.

If oracle_hints are present, MUST include the oracle_id in oracle_ref to confirm coverage.

oracle_hints: {{ item.oracle_hints }}

Return JSON matching FIND_SCHEMA.v1:
{
  "finder_key": "{{ item.key }}",
  "candidate_findings": [
    { "title": "...", "severity_guess": "...", "file": "...", "oracle_ref": "ORACLE-XXX" }
  ]
}
