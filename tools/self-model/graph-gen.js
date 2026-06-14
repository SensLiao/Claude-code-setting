#!/usr/bin/env node
/**
 * graph-gen.js — ONE-TIME VISUALIZATION ARTIFACT generator for the ~/.claude/ harness.
 *
 * WHY: produces a read-only "self-model" snapshot of the harness topology (orchestrators,
 * agents, SDKs, hook-groups, downstream gates) as a graph JSON for docs / debugging /
 * architecture review. This is a visualization artifact only — not a governance layer.
 *
 * *** CANONICALS D8 DISCLAIMER ***
 * This file and the graph it produces are NEVER read by any gate, hook, or enforcement
 * mechanism. The output graph NEVER blocks any operation. It carries no authority and
 * participates in no release decision. It is a read-only "self-model" picture of the harness,
 * regenerated on demand by a human, and committed as a static docs artifact.
 *
 * Dependency-free: built-in `fs` / `path` only (no ajv / js-yaml / npm).
 * Exit codes (Claude Code hook convention): 0 = ok · 2 = infra error.
 *
 * Sources consumed (read-only):
 *   ~/.claude/manifests/harness.registry.json  (primary source)
 *   ~/.claude/manifests/skill-routing-policy.json  (optional — routing edges only)
 *
 * Output:
 *   ~/.claude/docs/architecture/harness-self-model.graph.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const HARNESS_ROOT  = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(HARNESS_ROOT, 'manifests', 'harness.registry.json');
const ROUTING_PATH  = path.join(HARNESS_ROOT, 'manifests', 'skill-routing-policy.json');
const OUT_DIR       = path.join(HARNESS_ROOT, 'docs', 'architecture');
const OUT_PATH      = path.join(OUT_DIR, 'harness-self-model.graph.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeReadJson(filePath) {
  try { return readJson(filePath); } catch (_) { return null; }
}

// Produce a stable id from a name string.
function nodeId(name) {
  return name.replace(/\s+/g, '-').toLowerCase();
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------
function buildGraph(registry, routing) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  function addNode(id, type, subsystem, label) {
    if (nodeIds.has(id)) return;
    nodeIds.add(id);
    nodes.push({ id, type, subsystem, label });
  }

  function addEdge(from, to, kind) {
    // only add if both endpoints exist (or will exist — we add all nodes first)
    edges.push({ from, to, kind });
  }

  // ---- 1. Primary orchestrators ----------------------------------------
  const primaryOrchs = Array.isArray(registry.primary_orchestrators)
    ? registry.primary_orchestrators : [];

  for (const orch of primaryOrchs) {
    const id = nodeId(orch.name);
    addNode(id, 'orchestrator', 'primary', orch.role || orch.name);

    // SDK edge
    if (orch.sdk) {
      const sdkId = nodeId(`sdk-${orch.name}`);
      addNode(sdkId, 'sdk', orch.name, orch.sdk);
      addEdge(id, sdkId, 'sdk');
    }

    // downstream_gates from orchestrator record
    if (Array.isArray(orch.downstream_gates)) {
      for (const gname of orch.downstream_gates) {
        addEdge(id, nodeId(gname), 'downstream_gate');
      }
    }
  }

  // ---- 2. Downstream gates -----------------------------------------------
  const downstreamGates = Array.isArray(registry.downstream_gates)
    ? registry.downstream_gates : [];

  for (const gate of downstreamGates) {
    const id = nodeId(gate.name);
    addNode(id, 'downstream_gate', 'l12', gate.role || gate.name);

    // SDK edge for downstream gate
    if (gate.sdk) {
      const sdkId = nodeId(`sdk-${gate.name}`);
      addNode(sdkId, 'sdk', gate.name, gate.sdk);
      addEdge(id, sdkId, 'sdk');
    }
  }

  // ---- 3. SDKs from registry.sdks ----------------------------------------
  const sdks = (registry.sdks && typeof registry.sdks === 'object') ? registry.sdks : {};
  for (const [subsystem, sdk] of Object.entries(sdks)) {
    if (!sdk || typeof sdk !== 'object') continue;
    // Find the owning orchestrator
    const owner = primaryOrchs.find((o) => {
      const n = o.name.toLowerCase();
      return n.includes(subsystem) || subsystem === 'discoverability' && n === 'discoverability-orchestrator';
    }) || downstreamGates.find((g) => g.name.toLowerCase().includes(subsystem));

    const sdkNodeId = nodeId(`sdk-${subsystem}`);
    if (!nodeIds.has(sdkNodeId)) {
      addNode(sdkNodeId, 'sdk', subsystem, sdk.path || subsystem + '-sdk');
    }
    if (owner) {
      const ownerId = nodeId(owner.name);
      // avoid duplicate sdk edge (already added above per-orchestrator)
      const alreadyLinked = edges.some((e) => e.from === ownerId && e.to === sdkNodeId && e.kind === 'sdk');
      if (!alreadyLinked) {
        addEdge(ownerId, sdkNodeId, 'sdk');
      }
    }
  }

  // ---- 4. Agents ----------------------------------------------------------
  const agentGroups = (registry.agents && typeof registry.agents === 'object')
    ? registry.agents : {};

  for (const [subsystem, group] of Object.entries(agentGroups)) {
    if (!group || !Array.isArray(group.members)) continue;
    const ownerName = group.owner;
    const ownerId = ownerName ? nodeId(ownerName) : null;

    // hook-group node for this subsystem (groups the hook-set)
    const hookGroupId = nodeId(`hooks-${subsystem}`);
    addNode(hookGroupId, 'hook-group', subsystem, `${subsystem} hooks`);
    if (ownerId) addEdge(ownerId, hookGroupId, 'owns');

    for (const memberName of group.members) {
      const agentId = nodeId(memberName);
      addNode(agentId, 'agent', subsystem, memberName);
      if (ownerId) addEdge(ownerId, agentId, 'owns');
    }
  }

  // ---- 5. Hook-groups from primary orchestrator hook lists ---------------
  // (global_live hooks as a single group node per orchestrator)
  for (const orch of primaryOrchs) {
    if (!orch.hooks) continue;
    const globalLive = orch.hooks.global_live;
    if (!Array.isArray(globalLive) || globalLive.length === 0) continue;
    const groupId = nodeId(`hooks-global-${orch.name}`);
    if (!nodeIds.has(groupId)) {
      addNode(groupId, 'hook-group', orch.name, `${orch.name} global hooks`);
      addEdge(nodeId(orch.name), groupId, 'owns');
    }
  }

  // ---- 6. Routing edges from skill-routing-policy (optional) -------------
  if (routing && Array.isArray(routing.intent_to_orchestrator)) {
    for (const route of routing.intent_to_orchestrator) {
      // Single orchestrator target
      if (route.orchestrator && nodeIds.has(nodeId(route.orchestrator))) {
        // add a "routes" edge from a routing-policy virtual node to the orchestrator
        const policyId = 'routing-policy';
        if (!nodeIds.has(policyId)) {
          addNode(policyId, 'routing-policy', 'global', 'Skill Routing Policy');
        }
        addEdge(policyId, nodeId(route.orchestrator), 'routes');
      }
      // Sequence of orchestrators (pentest_active pattern)
      if (Array.isArray(route.orchestrator_sequence)) {
        const policyId = 'routing-policy';
        if (!nodeIds.has(policyId)) {
          addNode(policyId, 'routing-policy', 'global', 'Skill Routing Policy');
        }
        for (const orchName of route.orchestrator_sequence) {
          if (nodeIds.has(nodeId(orchName))) {
            addEdge(policyId, nodeId(orchName), 'routes');
          }
        }
      }
    }
  }

  // ---- 7. Deduplicate edges -----------------------------------------------
  const edgeKeys = new Set();
  const dedupedEdges = [];
  for (const e of edges) {
    const key = `${e.from}|${e.to}|${e.kind}`;
    if (!edgeKeys.has(key)) { edgeKeys.add(key); dedupedEdges.push(e); }
  }

  return { nodes, edges: dedupedEdges };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  // Load primary source
  let registry;
  try {
    registry = readJson(REGISTRY_PATH);
  } catch (err) {
    process.stderr.write(`[graph-gen] FAIL: cannot read registry at ${REGISTRY_PATH}\n  ${err.message}\n`);
    return 2;
  }

  // Load optional routing policy (defensive — shape may differ)
  const routing = safeReadJson(ROUTING_PATH);

  // Build graph
  let nodes, edges;
  try {
    ({ nodes, edges } = buildGraph(registry, routing));
  } catch (err) {
    process.stderr.write(`[graph-gen] FAIL: graph build error\n  ${err.message}\n${err.stack}\n`);
    return 2;
  }

  // Summarize node types
  const typeCounts = {};
  for (const n of nodes) { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; }

  // Compose artifact — NO Date.now() / new Date() to keep output deterministic/diff-stable
  const artifact = {
    generated_by: 'tools/self-model/graph-gen.js',
    generated_at_note: 'timestamp intentionally omitted — deterministic artifact (no Date.now / new Date)',
    disclaimer: 'CANONICALS D8: read-only visualization artifact. Never read by any gate/hook. Never blocks any operation.',
    node_count: nodes.length,
    edge_count: edges.length,
    nodes,
    edges,
  };

  // Write output
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  } catch (err) {
    process.stderr.write(`[graph-gen] FAIL: cannot write output to ${OUT_PATH}\n  ${err.message}\n`);
    return 2;
  }

  // Human summary to stdout
  process.stdout.write('[graph-gen] OK — harness self-model graph written\n');
  process.stdout.write(`  Output : ${OUT_PATH}\n`);
  process.stdout.write(`  Nodes  : ${nodes.length} total\n`);
  for (const [type, count] of Object.entries(typeCounts)) {
    process.stdout.write(`    ${type.padEnd(20)} ${count}\n`);
  }
  process.stdout.write(`  Edges  : ${edges.length} total\n`);
  const edgeKindCounts = {};
  for (const e of edges) { edgeKindCounts[e.kind] = (edgeKindCounts[e.kind] || 0) + 1; }
  for (const [kind, count] of Object.entries(edgeKindCounts)) {
    process.stdout.write(`    ${kind.padEnd(20)} ${count}\n`);
  }

  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { buildGraph };
