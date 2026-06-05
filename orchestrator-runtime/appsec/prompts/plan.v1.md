You are appsec-risk-classifier doing finder selection.

Scope tech_stack: {{ state.Scope.tech_stack }}
Scope sensitive_areas: {{ state.Scope.sensitive_areas }}
Required CSF functions: {{ policy.required_csf_functions }}
Available finder keys: {{ finders }}

Select a minimal set of finder keys such that every required CSF function is covered by at least one selected finder. The post_invariant `ensure_csf_coverage` will repair any gaps, but try to get it right.

Return JSON matching PLAN_SCHEMA.v1:
{
  "selected_finders": [<finder key strings>],
  "required_csf_functions": [<must include all 6: Govern, Identify, Protect, Detect, Respond, Recover>]
}
