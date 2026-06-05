<!-- CONTRACT-SENTINEL: appsec.workflow-spec-dispatch.v2026-05-29 -->

# Relocated from appsec-security-orchestrator/SKILL.md — §16.10.2..16.10.6 workflow-spec operational elaboration

#### §16.10.2 Args Contract（Skill → Workflow）

```js
Workflow({
  scriptPath: '~/.claude/workflows/appsec-orchestrator.js',
  // or name once Skill harness registers it; scriptPath is canonical for now
  args: {
    spec,                    // REQUIRED — built by Skill per §16.11 (preset + inlined prompts/schemas)
    target,                  // project-root path (or short identifier)
    run_id,                  // REQUIRED — release tag from §16.2; sentinel + evidence dir name
    severity_floor,          // 'low' | 'medium' | 'high' | 'critical' from .appsec/config.json
    finders,                 // ctx.finders — array of {key, sub_skill, csf, oracle_hints}, scoped by §16.1
    policy,                  // { required_csf_functions: [...] } — from .appsec/config.json.csf_targets
    oracle,                  // { oracle_findings: [...], recall_metric: { minimum_acceptable: 0..1 } }
    previous_results,        // §16.10.3 resume snapshot's phase_outputs (object keyed by phase name); OK if {}
    spec_hash,               // 'sha256:'+sha256Hex(stableStringify(spec)) — canonical per shared/spec-hash.js; MUST match workflow body + hook
  }
})
```

**Required**: `spec`, `run_id`, `spec_hash`. **Optional with defaults** (workflow
body fills in): `target='unknown-target'`, `severity_floor='low'`, `finders=[]`,
`policy={required_csf_functions:[...6 functions]}`, `oracle={oracle_findings:[],
recall_metric:{minimum_acceptable:0}}`, `previous_results={}`.

**Skill responsibilities** (full list — see §16.11):
- Generate `run_id` matching `appsec-sdk init <tag>` (must satisfy `^[a-zA-Z0-9._-]+$`)
- Pick a preset matching `.appsec/config.json.{asvs_level, overlays, lifecycle_stage}`
- Inline prompt bodies (`prompts/<ref>.md`) into `spec.prompts[<ref>]`
- Inline schema bodies (`schemas/<REF>.json`) into `spec.schemas[<REF>]`
- Build `ctx.finders` from §16.1 classifier output — DO NOT pass all 11 blindly
- Build `oracle` from `.appsec/findings/<historical-tag>/` if exists; else empty
- Build `previous_results` from `.appsec/evidence/<tag>/workflow-state/*.yaml` if exists
- **Schema constraint** (P0 Step 2A finding, 2026-05-28): every inlined
  `spec.schemas[REF]` body MUST be `$schema: "http://json-schema.org/draft-07/schema#"`.
  Workflow's internal `agent({schema})` validator does NOT support draft-2020-12 and
  will fail-fast with `no schema with key or ref "draft/2020-12"`. Only the
  Skill-side `validate-spec.js` supports draft-2020-12 (via marketplace
  `ajv/dist/2020.js`); agent-executed schemas must target draft-07. All schemas in
  `~/.claude/orchestrator-runtime/appsec/schemas/*.json` already comply.
- Compute `spec_hash = 'sha256:' + sha256Hex(stableStringify(spec))` using the canonical algo
  (use `~/.claude/orchestrator-runtime/shared/spec-hash.js` — byte-identical with workflow body + preview-gate; legacy djb2 accepted by the hook only until the 2026-06-15 sunset)
- Render Execution Preview per §16.13 and obtain explicit user approval
- Write sentinel to `.appsec/state/preview-approved/<run_id>.json`
- Launch Workflow

**Workflow responsibilities**:
- Validate `spec.engine_version=="1.0"`, `spec.orchestrator=="appsec"`, all required fields
- Execute each phase per its node type (single / fanout / pipeline / deterministic)
- Whitelist-enforce ops: every `op`/`skip_if`/`post_invariant` name must appear in
  both the JS `OPS` registry AND `spec.ops_allowed.*`
- Fingerprint each phase output for cross-session resume
- Return `{run_id, target, reused_phases, cache_misses, phase_outputs, phase_outputs_fingerprinted}`
- **NO filesystem writes** (workflow body is deterministic — no `fs`, no `Date.now()`, no `Math.random()`, no Bash)

#### §16.10.3 Resume Pattern（跨 session / 电脑重启级别）

Workflow's built-in `resumeFromRunId` cache is **same-session only**. For
"laptop died yesterday, continue today" behavior, use evidence-based resume:

1. **Before Skill calls Workflow**: read `.appsec/evidence/<tag>/workflow-state/*.yaml`
   (latest by timestamp). The body of each YAML is JSON containing
   `phase_outputs_fingerprinted`.
2. Construct `args.previous_results = <parsed.phase_outputs_fingerprinted>` —
   structure is `{<PhaseName>: {node_fingerprint, output}, ...}`.
3. Pass as args to Workflow.
4. **Workflow at each phase entry**: computes `nodeFingerprint(node, spec, upstreamCtx)`.
   If it matches `previous_results[phase].node_fingerprint`, reuse
   `previous_results[phase].output`; else run live (cache miss with reason).
5. **After Workflow return**: Skill writes new `phase_outputs_fingerprinted` to
   `appsec-sdk evidence.append <tag> workflow-state` (redacted, auto-named).

**Fingerprint coverage** (codex-verified, see workflow body `hashNode()`):
- Node definition: name, type, model, agentType, prompt_ref, schema_ref, op, params, items_from, isolation
- Inlined prompt body + schema body (so prompt/schema edits invalidate cache)
- spec.engine_version, spec.orchestrator, spec.ops_allowed
- Upstream ctx (target, severity_floor, finders, policy, oracle) at phase entry
- Cumulative upstream state[*] at phase entry

Any change to any of these → cache miss with explicit reason logged. False
cache hits are impossible (no Date.now / Math.random in fingerprint).

**Known trade-off**: if Workflow crashes mid-phase, the Skill never receives a
result for that phase, so no resume snapshot is written. Mitigation: rerun is
idempotent if config + oracle + policy + previous_results are unchanged. Finer
crash resilience (per-phase Bash self-write) is a v3 future enhancement, costs
+N haiku agents.

#### §16.10.4 Evidence Mapping（Workflow phase_outputs → §17 SDK calls）

After Workflow returns, Skill **MUST** map outputs per the table below. This
runs on the Skill main thread (no fresh agent) and uses Bash to call
`appsec-sdk`. Every body goes through the SDK's redact pipeline.

| `result.phase_outputs.<phase>` | SDK call | Evidence layer | Notes |
|---|---|---|---|
| `Scope`            | `appsec-sdk evidence.append <tag> scope`           | scope            | YAML body |
| `Plan`             | `appsec-sdk evidence.append <tag> plan`            | plan             | includes `selected_finders` |
| `Find`             | `appsec-sdk evidence.append <tag> find-raw`        | find-raw         | per-finder candidate dump |
| `Normalize`        | each `findings[i]` → `appsec-sdk finding.add`      | findings/        | §18.5 schema-prewrite hook fires |
| `Verify`           | `appsec-sdk evidence.append <tag> verify-votes`    | verify-votes     | per-cluster vote ledger |
| `Map`              | `appsec-sdk evidence.append <tag> map-taxonomies`  | map-taxonomies   | ASVS/CSF/WSTG/APITop10 mapping |
| `Gate`             | transform to §16.9 schema → write `.appsec/decisions/<tag>/appsec_release_decision.yaml` | decision | §16.9 evidence-validator may overwrite |
| `Synthesize`       | append text to `SECURITY.md` §13                   | human-readable   | dev-facing report |
| `PersistEvidence`  | self-emits via `sdk.command` hint (agent invokes Bash directly) | varies | per preset (workflow-state / overlay-* / incident-response / recovery) |
| **Whole result**   | `appsec-sdk evidence.append <tag> workflow-state` (body = JSON of `phase_outputs_fingerprinted`) | workflow-state | resume snapshot for next run (§16.10.3) |

§16.9 evidence-validator **still runs** in workflow-spec mode — Workflow only
produces inputs faster; it does NOT bypass §16.9 schema/coverage/freshness/
redaction validation. Final release decision (PASS/FAIL/BLOCKED/CONDITIONAL_PASS)
still comes from `appsec-evidence-validator` agent.

**Persistence failure surface** (R8 / Patch A.1.2, 2026-05-28) — every SDK call
made by the Skill main thread after Workflow returns MUST be wrapped:

```bash
persistence_failures=()
for phase in Scope Plan Find Normalize Verify Map Gate Synthesize PersistEvidence; do
  payload="$(echo "$phase_outputs" | jq -r --arg p "$phase" '.[$p] // empty')"
  [[ -z "$payload" ]] && continue
  layer="$(resolve_layer_for_phase "$phase")"
  if ! echo "$payload" | "$HOME/.claude/scripts/appsec-sdk.sh" evidence.append "$tag" "$layer" >/dev/null 2>&1; then
    persistence_failures+=("phase=$phase layer=$layer")
  fi
done
# Workflow-state snapshot last (for resume)
if ! echo "$phase_outputs_fingerprinted" | "$HOME/.claude/scripts/appsec-sdk.sh" evidence.append "$tag" workflow-state >/dev/null 2>&1; then
  persistence_failures+=("phase=ResumeSnapshot layer=workflow-state")
fi
if (( ${#persistence_failures[@]} > 0 )); then
  echo "RUN-COMPLETED-BUT-PERSISTENCE-FAILED" >&2
  printf '  %s\n' "${persistence_failures[@]}" >&2
  # Do NOT exit 0 — the run is half-complete. Next resume will not see snapshot.
  # User MUST know so they can rerun or inspect SDK error.
  exit 1
fi
```

**Rule**: Workflow's result was correct, but if persistence failed, the run is
**half-complete**. Surface as `RUN-COMPLETED-BUT-PERSISTENCE-FAILED` with
per-phase / per-layer breakdown. Do NOT mark run as success. Resume from this
tag will fail because `workflow-state` snapshot was never written.

#### §16.10.5 Backward Compatibility

- FleetView / non-terminal env / Windows-without-DISABLE_TELEMETRY: Workflow
  unavailable → §16.4–§16.9 prompt-only path unchanged.
- v1.x / v2.x `.appsec/config.json` (no `execution_mode` field): default
  prompt-only — safer.
- **workflow-static** (legacy `appsec-full-sweep.js`): 30-day deprecation window
  starting at default-mode-switch in P2 (§16.12). After window, the file is
  deleted in P3 and `execution_mode == "workflow-static"` becomes equivalent to
  prompt-only with a log line.
- §18 hooks fire identically in all three modes — they gate `.appsec/findings/`
  and `.appsec/evidence/` paths, not the dispatch surface. Plus the new
  `appsec-preview-gate.js` (§16.13) which only fires on `tool_name=="Workflow"`
  AND `tool_input.name=="appsec-orchestrator"` (or scriptPath matching).
- §9 finding schemas unchanged — Workflow `result.phase_outputs.Normalize.findings[]`
  still flows through `appsec-sdk finding.add` schema validation.

#### §16.10.6 Failure Modes

| Failure | Behavior | Recovery |
|---|---|---|
| `CLAUDE_CODE_WORKFLOWS` unset / Windows no `DISABLE_TELEMETRY` | Silent fallback §16.4–§16.9 | Set env vars and re-run if Workflow desired |
| `validate-spec.js` exits 2 (spec invalid) | Skill aborts BEFORE Workflow launch — 0 token cost | Fix preset / Skill builder, re-run |
| Spec validation passes but Workflow body throws (e.g. missing prompt body in spec.prompts) | Workflow tool reports error to Skill main thread | Cross-check `validate-spec.js` inline-ref coverage; fix Skill inliner |
| Preview gate hook (§16.13) blocks (no sentinel / expired / hash mismatch) | exit 2, Workflow does NOT launch | Re-render preview, get explicit approval |
| Phase agent schema-retry exhausted | Workflow returns `null` for that slot; downstream sees missing | Gate may BLOCK due to CSF gap; rerun |
| Workflow crashes mid-execution | Skill receives error, no partial snapshot written | Rerun is idempotent (resume snapshot from prior successful run still loads) |
| Skill resume snapshot write fails | Next run can't resume from this run | Manual `appsec-sdk evidence.list <tag>` inspect; preview will show `resume_source=none` |
| Render template variable missing (e.g. `{{ state.MissingPhase.x }}`) | Workflow body throws — caught by Workflow tool | Fix spec; cache for upstream phases still valid (won't replay) |
| User reply not in approval whitelist | No sentinel written → next hook fires → blocked | Reply with exact whitelist keyword per §16.13 |
| Schema uses `$schema: "https://json-schema.org/draft/2020-12/schema"` | Workflow `agent({schema})` rejects with `no schema with key or ref "draft/2020-12"` — 0 tokens spent (fail-fast) | Switch schema to `$schema: "http://json-schema.org/draft-07/schema#"`. Workflow's internal schema validator ships only draft-07 meta. **Only `validate-spec.js` (Skill-side) supports draft-2020-12** via the marketplace `ajv/dist/2020.js` build; agent-executed schemas MUST be draft-07 compatible. Discovered during P0 Step 2A smoke (2026-05-28) — all 8 `~/.claude/orchestrator-runtime/appsec/schemas/*.json` already switched to draft-07. |
| Args paste size exceeds tool limit (~25KB inline JSON observed to fail) | Workflow body sees `args=null`, throws `args must be an object` | Discovered during P0 Step 2A.7 resume verification. Mitigations: (a) ASCII-escape non-ASCII chars to keep paste deterministic; (b) prefer `resumeFromRunId` for same-session resume (no inline `previous_results` needed); (c) for true cross-session resume, future enhancement = persist args to disk and have Skill main thread pass via a smaller wrapper. Current workaround: keep `previous_results` minimal by storing only `phase_outputs_fingerprinted` (≈ output bytes), not the full result envelope. |


---

# Relocated from appsec-security-orchestrator/SKILL.md — §16.11 Spec Authoring Contract (14-step)

### §16.11 Spec Authoring Contract（Skill → Workflow handshake — workflow-spec mode only）

When `mode == "workflow-spec"` is selected (§16.10.1), Skill main thread
executes this 14-step authoring contract BEFORE any `Workflow()` call.

> **Governed Gate Mode (CLAUDE.md §3.7) — gate_active window**: as the FIRST action of this contract (before Step 1 / preview render), the Skill MUST write `.appsec/state.json` `gate_active: true`, and clear it on terminal verdict/abort. This closes the pre-sentinel window so `governed-gate-workflow-guard.js` blocks inline model-authored Dynamic Workflows for the ENTIRE gate, not just after the approval sentinel is written.

```
 1. Read .appsec/config.json
    → extract asvs_level, csf_targets[], overlays[], strict_mode, lifecycle_stage
    → if config missing → silent exit (non-appsec project, §16.0)

 2. Pick preset path under ~/.claude/orchestrator-runtime/appsec/presets/
    → asvs_level == L1                                  → l1-default.json
    → asvs_level == L2 && overlays == []                → l2-default.json
    → asvs_level == L2 && overlays includes "cn_data"   → l2-cn-data.json
    → asvs_level == L3 || overlays includes "payment"   → l3-payment.json
    → lifecycle_stage == "incident"                     → incident-response.json
    → smoke / dev iteration                              → smoke.json
    (Skill may compose: start from base preset, copy phases, add overlay-specific
     Persist nodes. Always re-validate via validate-spec.js after composition.)

 3. Load preset JSON → call it `spec`.

 4. Walk spec.phases (and pipeline stages) to collect all prompt_ref / schema_ref:
    for each ref → read corresponding file → inline body into spec.prompts[ref]
    or spec.schemas[ref]. Reference file layout:
      prompts:  ~/.claude/orchestrator-runtime/appsec/prompts/<ref>.md
      schemas:  ~/.claude/orchestrator-runtime/appsec/schemas/<REF>.json
    Missing file = hard fail (do NOT silently skip).

 5. Build ctx.finders from §16.1 classifier output (do NOT blindly pass all 11):
    - Always include: sca, secret-scan, sast (if codebase), code-review, headers-cookies
    - Conditionally include per .appsec/state.json.overlays[]:
        mobile        → security-app-mobile
        llm           → security-app-llm
        multitenant   → security-app-multitenant
        websocket     → security-app-websocket
        file_upload   → security-app-file-upload
        payment       → security-compliance-payment
        cn_data       → security-compliance-cn-data
    - Schema per finder: {key, sub_skill, csf:[Govern|Identify|Protect|Detect|Respond|Recover], oracle_hints:[]}

 6. Build oracle from .appsec/findings/<historical-tag>/*.yaml (most-recent prior tag):
    - oracle_findings: [...prior verified findings...]
    - recall_metric.minimum_acceptable: from .appsec/config.json (default 0)
    - First run / no history → oracle = {oracle_findings:[], recall_metric:{minimum_acceptable:0}}

 7. Build previous_results from .appsec/evidence/<tag>/workflow-state/*.yaml (latest):
    - Parse body (JSON) → extract phase_outputs_fingerprinted
    - If no file → previous_results = {}

 7.5. **Skill-side alias resolution** (§1.11 correction #2, 2026-05-28) — MANDATORY.
    The Workflow body cannot read files. Therefore alias-to-literal resolution
    MUST happen here, BEFORE Step 8 spec_hash is computed.

    For each node in spec.phases (and each stage in pipeline phases):
      - if node.model is an alias (cheap_fast / balanced / strongest_available / inherit) →
        compute node.resolved_model via:
          (a) per-project override map at .appsec/config.json.model_policy_overrides,
              then (b) shared/model-policy.md default mapping
      - keep node.model in place (the alias remains visible in preview & debug)
      - WRITE node.resolved_model alongside (e.g. {model: "cheap_fast", resolved_model: "haiku"})
      - record args.model_policy_version (sha256 prefix of the resolved override map +
        default-mapping snapshot) so any future re-resolution that yields different
        literals cleanly invalidates resume cache.

    Once written, Workflow body uses node.resolved_model directly and does NOT
    re-resolve. Workflow body never reads model-policy.md.

 8. Compute spec_hash = sha256(stableStringify(spec)) using canonical algorithm,
    stored with `sha256:` prefix per §1.11 correction #3.
    Implementation MUST match exactly:
      workflows/appsec-orchestrator.js (pure-JS SHA-256 embedded inline)
      hooks/appsec-preview-gate.js     (Node crypto.createHash('sha256'))
      orchestrator-runtime/appsec/tests/build-*-args.js (same Node crypto)
    Any drift = sentinel mismatch = blocked launch.

    **Transition note**: hook accepts BOTH legacy `djb2:` (8-hex) and new
    `sha256:` prefix during a window; once all args builders + Skill emit
    `sha256:`, the legacy `djb2:` path is removed.

    Node fingerprints in resume snapshots ALSO use `sha256:` per §1.11 #3 — the
    Workflow body embeds a pure-JS SHA-256 implementation so its hashNode and
    the predictor agree byte-for-byte.

 9a. **Spec validation** — `node ~/.claude/orchestrator-runtime/shared/validate-spec.js <spec.json>`
    → exit 0 = OK, exit 2 = SPEC INVALID (abort, do NOT launch, no token spend)
    → exit 3 = internal error (abort)

 9b. **Preflight capability check** (Patch A.1.6 / §1.10) — MANDATORY
     `bash ~/.claude/orchestrator-runtime/appsec/tests/preflight-check.sh <spec.json>`
     Verifies:
     - every `node.agentType` resolves to an agent `.md` with matching `name:` frontmatter
       (NOT filename — Claude Code identity comes from frontmatter per subagent docs)
     - every required hook from `registry.json` is referenced in `<project>/.claude/settings.json`
       (`appsec-preview-gate` always required in workflow-spec mode)
     - `appsec-sdk` is reachable + smoke command (`--help`) exits 0
     - every `node.model` alias resolves in `registry.json` or `shared/model-policy.md`
     - exit 0 = OK, exit 2 = MISSING_CAPABILITY (abort with structured stderr),
       exit 3 = internal error (abort)
     **Skip = fail-closed.** Step 9b is part of the Spec Authoring Contract.

10. Render Execution Preview per §16.13 (use shared/preview-template.md).
    Display to user and wait for reply.

11. Match user reply against §16.13 approval whitelist (exact, case-insensitive, trimmed).
    No match → no sentinel written → next Workflow call will be blocked by hook → abort.

12. Write sentinel JSON to <project>/.appsec/state/preview-approved/<safeRunId>.json:
      { run_id, spec_hash, preview_hash, approved_at:<ISO>, approval_text, ttl_seconds:<configured> }

    **R10 / Patch A.1.3 (2026-05-28)** — read TTL from config (still clamped by hook):
    ```bash
    ttl=$(node -e "try{
      const c=JSON.parse(require('fs').readFileSync('.appsec/config.json','utf8'));
      process.stdout.write(String(c.preview_approval_ttl_seconds||300));
    }catch{process.stdout.write('300')}")
    ```
    Hook (`appsec-preview-gate.js`) clamps to `[30, 3600]` defensively regardless
    of file value, so config tampering can't bypass the gate.

    Skill main thread CAN call Bash for `date -u +%FT%TZ` (workflow body cannot;
    hook CAN since Date.now() is permitted outside workflow body).

13. Invoke Workflow({scriptPath: '~/.claude/workflows/appsec-orchestrator.js',
                     args: {spec, target, run_id, severity_floor, finders,
                            policy, oracle, previous_results, spec_hash}}).
    On result: continue to step 14. On error: log, surface to user, retry path is
    user's call. NEVER re-launch silently.

14. Map result.phase_outputs through §16.10.4 SDK persist calls (Skill main
    thread or single haiku agent calls Bash for appsec-sdk). After all
    persists complete, write resume snapshot:
      echo '<JSON of result.phase_outputs_fingerprinted>' |
        appsec-sdk evidence.append <tag> workflow-state
```

**Non-negotiable Skill discipline** (failure to follow = silent bug):
- Step 8 (spec_hash) MUST be computed before step 9 (validate) so that any
  step-7 inline failure is caught even if hash drifts. Actually compute it AFTER
  inlining is complete, BEFORE preview rendering, since the preview displays the
  hash. Order: 4 (inline) → 8 (hash) → 9 (validate) → 10 (preview).
- Step 9 (validate-spec) is REQUIRED. Never skip "to save time" — invalid spec
  blows up mid-Workflow, wastes agent tokens.
- Step 11 (approval) is human-in-the-loop. Skill MUST NOT auto-approve, MUST NOT
  treat silence / unrelated reply as approval.
- Step 12 (sentinel) — fail-closed: if Bash fails to write the sentinel, abort.
  Do not call Workflow without a sentinel.
- Step 14 (persist) — every phase's data goes through `appsec-sdk` (which goes
  through `redact`). Never write raw `result.phase_outputs.Find` to disk
  directly — the find phase may contain raw secret excerpts from candidate code.


---

# Relocated from appsec-security-orchestrator/SKILL.md — §16.12 Static to Spec Migration

### §16.12 Static → Spec Migration（30-day window）

`workflow-static` mode (legacy `~/.claude/workflows/appsec-full-sweep.js`) is
DEPRECATED as of 2026-05-28. Migration timeline:

| Phase | Date | Default mode | Legacy file | Action |
|---|---|---|---|---|
| **P0 (now)** | 2026-05-28 | `prompt-only` | exists, working | Build workflow-spec engine + presets + tests (this file) |
| **P0 Step 2** | TBD (~+1 week, user approval) | `prompt-only` | exists | Smoke test l2-default preset live (~2.4M tokens) |
| **P1** | TBD (~+2 weeks, user approval) | `prompt-only` | exists | Oracle compare 3-5 historical tags v2-static vs v1-spec (~24M tokens, expensive — explicit user budget required) |
| **P2** | After P1 100% Gate-agreement | recommended `workflow-spec` | exists, marked DEPRECATED | Update §16.10.1 to recommend `workflow-spec`; default still `prompt-only` for fresh projects |
| **P3** | P2 + 30 days, no fallback complaints | recommended `workflow-spec` | DELETED | Remove `~/.claude/workflows/appsec-full-sweep.js`, archive this section to references/ |

Migration path for a project currently using `execution_mode == "workflow-static"`:

1. Verify `~/.claude/workflows/appsec-orchestrator.js` exists (P0 done).
2. Pick the closest preset (likely `l2-default.json`).
3. Compare your current finder set vs preset's expected `ctx.finders` — adjust Skill builder.
4. Change `.appsec/config.json.execution_mode` to `"workflow-spec"`.
5. Run once. Compare evidence layers + gate decision vs prior `workflow-static` run.
6. If gate decision matches → cutover complete. If not → file an issue, stay on `workflow-static`.

Compatibility shim during migration: if `execution_mode == "workflow-static"`
AND `~/.claude/workflows/appsec-full-sweep.js` exists → use it. If file deleted
(P3) → log "workflow-static legacy file removed; falling back to prompt-only.
Consider migration to workflow-spec per SKILL.md §16.12." and continue
prompt-only.


---

# Relocated from appsec-security-orchestrator/SKILL.md — §16.13 Execution Preview Contract

### §16.13 Execution Preview Contract（hard human-in-the-loop gate）

> See `~/.claude/orchestrator-runtime/shared/preview-template.md` for the full
> template literal. This section documents the contract — preview shape,
> approval keywords, sentinel, hook enforcement.

**Why this gate exists**: Workflow can spawn dozens of fresh-context agents in
parallel — a single misclicked Skill could burn millions of tokens. The
preview gate forces the user to see the spec breakdown (phase count, model
mix, evidence outputs, estimated cost) and explicitly approve before launch.

**Render**: Skill main thread renders the preview template populated with:
- orchestrator, mode, workflow_base_path, preset_name, spec_hash (8 hex chars)
- target, release_tag (= run_id)
- resume_source path + cached_count + exec_count + cache_misses_list
- capability gates (CLAUDE_CODE_WORKFLOWS, platform compat)
- per-node table: index, status (CACHED/RUN/SKIPPED), name, type, model, agentType, op/items_from/stages/sdk hints
- evidence outputs list
- hooks that will fire
- risks (any node missing fingerprint? any unverified prompt? any cache_miss reason?)
- estimated cost (agent_count, token_total, wall-clock, model mix)

**Approval keyword whitelist** (exact match, case-insensitive, leading/trailing
whitespace trimmed; NO fuzzy match, NO substring match):

| Language | Keywords |
|---|---|
| English | `OK`, `okay`, `approve`, `approved`, `go`, `yes`, `proceed`, `ship it`, `LGTM` |
| Chinese | `跑`, `批准`, `同意`, `继续`, `好`, `执行` |

ANY other reply (including `maybe`, `idk`, `..`, `?`, `let me think`, silence,
question mark) = NO approval → NO sentinel → next Workflow call blocked.

**Sentinel** (Skill writes via Bash after approval):

```
<project>/.appsec/state/preview-approved/<safeRunId>.json
```

`safeRunId` = `runId.replace(/[^A-Za-z0-9._-]/g, '_')` — path-traversal safe.

Body shape:
```json
{
  "run_id": "v3.2.1-pre-release",
  "spec_hash": "a1b2c3d4",
  "preview_hash": "e5f6g7h8",
  "approved_at": "2026-05-28T04:20:59.123Z",
  "approval_text": "<exact user reply>",
  "ttl_seconds": 300
}
```

**TTL config**: default 300s; clamped to `[30, 3600]` by hook regardless of
file value (so an attacker can't write `ttl_seconds: 99999999` to bypass).
Override via `.appsec/config.json.preview_approval_ttl_seconds` (still clamped).

**Hook enforcement** (`~/.claude/hooks/appsec-preview-gate.js`):

Trigger: `PreToolUse` matcher `Workflow`. Hook only fires when
`tool_input.name == "appsec-orchestrator"` OR `tool_input.scriptPath` ends with
`appsec-orchestrator.js`. All other Workflow calls pass through.

Pass criteria (ALL must be true):
1. `args.run_id` is a non-empty string.
2. `args.spec_hash` is a non-empty string.
3. `args.spec` is an object.
4. `'sha256:'+sha256Hex(stableStringify(args.spec)) == args.spec_hash` (recomputed — defends against caller lying; legacy `djb2:` accepted only until the 2026-06-15 sunset, see §16.13 transition note).
5. Sentinel file exists at `<safeRunId>.json` under `.appsec/state/preview-approved/`.
6. Sentinel JSON parses cleanly.
7. `sentinel.run_id == args.run_id`.
8. `sentinel.spec_hash == recomputed_hash` (defends against approved-A-run-B).
9. `sentinel.approved_at` parses as ISO8601.
10. `now_ms - approved_at_ms` is in `[0, ttl_seconds*1000]` (no future skew, no expiry).

Any failure → `exit 2` + stderr explaining which check failed → Workflow tool
aborts launch. Pass → `exit 0` + brief OK log to stderr.

Unit tests: 17 scenarios in
`~/.claude/orchestrator-runtime/appsec/tests/hook-mock-test.sh`. Run before any
hook edit.

---
