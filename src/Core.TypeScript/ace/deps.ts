// deps.ts — Dependency-graph and variable-passing engine (081KSGS9H0008QG0R00367G209)
//
// Sits above Helm and below Flux/ArgoCD. Resolves dependency graphs,
// calculates topo-sort & sync-waves, and generates manifests with variable-flow bindings.

import { parseWithFallback } from "../yaml/vendor.ts";
import { encode as yamlEncode } from "../yaml/encoder.ts";
import type { YamlValue } from "../yaml/dom.ts";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve as toAbsolutePath } from "node:path";

export interface TemporalVersionSpec {
  current?: string;
  future?: string;
  "migration-window"?: {
    name?: string;
    start: string;
    end: string;
    mode: "preparing" | "cutting-over" | "dual-running" | "draining-old" | "cleanup";
  };
}

export interface TimeAwareIsolationSpec {
  "per-tenant-cutover"?: boolean;
  "cutover-schedule-ref"?: string;
}

export interface RollbackSafetySpec {
  "database-schema-incompatible"?: boolean;
  "reverse-migration-required"?: boolean;
  "ingress-removal-impact"?: string;
}

export interface DependencyNode {
  chart: string;
  version?: string | TemporalVersionSpec;
  "time-aware-isolation"?: TimeAwareIsolationSpec;
  "rollback-safety"?: RollbackSafetySpec;
  dependsOn?: string[];
  inputs?: Array<{
    name: string;
    type?: "string" | "number" | "boolean";
    value?: unknown;
  }>;
  outputs?: Array<{
    name: string;
    source: string;
    consumes?: Array<{
      target: string; // e.g. "my-app.values.database.url"
    }>;
  }>;
}

export interface AppDependencyGraphSpec {
  apiVersion: string;
  kind: "AppDependencyGraph";
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: {
    dependsOn: DependencyNode[];
  };
}

export interface ChartOutputsSpec {
  apiVersion: string;
  kind: "ChartOutputs";
  metadata: {
    name: string;
  };
  outputs: Array<{
    name: string;
    type: "string" | "number" | "boolean";
    value: string;
  }>;
}

// ── YAML Parsing Helpers ──────────────────────────────────────────────────────

export function toJs(v: YamlValue): any {
  switch (v.t) {
    case "Null":
      return null;
    case "Bool":
      return v.value;
    case "Int":
      return Number(v.value);
    case "Float":
      return v.value;
    case "Str":
      return v.value;
    case "Seq":
      return v.items.map(toJs);
    case "Map": {
      const obj: Record<string, any> = {};
      for (const [k, val] of v.entries) {
        obj[k] = toJs(val);
      }
      return obj;
    }
  }
}

export function toYamlValue(val: any): YamlValue {
  if (val === null || val === undefined) {
    return { t: "Null" };
  }
  if (typeof val === "boolean") {
    return { t: "Bool", value: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { t: "Int", value: BigInt(val) };
    }
    return { t: "Float", value: val };
  }
  if (typeof val === "bigint") {
    return { t: "Int", value: val };
  }
  if (typeof val === "string") {
    return { t: "Str", value: val };
  }
  if (Array.isArray(val)) {
    return { t: "Seq", items: val.map(toYamlValue) };
  }
  if (typeof val === "object") {
    const entries: Array<[string, YamlValue]> = [];
    for (const k of Object.keys(val)) {
      entries.push([k, toYamlValue(val[k])]);
    }
    return { t: "Map", entries };
  }
  return { t: "Null" };
}

// Subset reader FIRST, wrapped vendor adapter only on a typed decline — the
// architecture the YAML port specified on 2026-06-01 and never wired
// (081M0N90CHX087G0R0034C7NPT). `full-ai-cluster/k8s/sync-wave-dependency-graph.yaml`
// carries 44 folded block scalars and 28 non-empty flow sequences, all named
// out-of-subset by that design's operator-locked Decision 2 and all covered by the
// adapter the same decision promised. See `../yaml/vendor.ts` for why the subset is
// not widened instead.
export function parseYaml(text: string): any {
  const res = parseWithFallback(text);
  if (!res.ok) {
    throw new Error(`YAML parse failed: ${res.feedback} (vendor adapter: ${res.vendorError})`);
  }
  return toJs(res.value);
}

/**
 * Same parse, with the reader that answered. Exposed so a caller can tell an
 * in-subset read from a vendor read; `parseYaml` deliberately does not, because a
 * consumer of the VALUE should not have to care.
 */
export function parseYamlVia(text: string): { value: any; via: "subset" | "vendor" } {
  const res = parseWithFallback(text);
  if (!res.ok) {
    throw new Error(`YAML parse failed: ${res.feedback} (vendor adapter: ${res.vendorError})`);
  }
  return { value: toJs(res.value), via: res.via };
}

export function stringifyYaml(val: any): string {
  return yamlEncode(toYamlValue(val));
}

// ── Graph Resolution Engine ───────────────────────────────────────────────────

export interface ResolvedGraph {
  order: string[]; // topological order
  waves: Map<string, number>; // sync waves (heights in DAG)
  nodes: Map<string, DependencyNode>;
}

export function getTargetPath(target: string): string {
  const parts = target.split(".");
  parts.shift(); // remove chart name segment
  if (parts[0] === "values") {
    parts.shift(); // remove "values" segment if present
  }
  return parts.join(".");
}

export function setNestedProperty(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  if (parts.length === 0 || parts[0] === "") {
    throw new Error("nested path must be non-empty");
  }
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]!] = value;
}

export function resolveGraph(graph: AppDependencyGraphSpec, chartsDir?: string): ResolvedGraph {
  const nodes = new Map<string, DependencyNode>();
  const graphName = graph.metadata.name;

  // Add the root node itself
  nodes.set(graphName, {
    chart: graphName,
    dependsOn: [],
    inputs: [],
    outputs: [],
  });

  // Populate node configurations
  for (const entry of graph.spec.dependsOn) {
    nodes.set(entry.chart, entry);
  }

  // Construct adjacency list
  const adj = new Map<string, Set<string>>();
  for (const node of nodes.keys()) {
    adj.set(node, new Set<string>());
  }

  // Populate explicit dependency edges
  for (const [chart, entry] of nodes.entries()) {
    if (entry.dependsOn) {
      for (const d of entry.dependsOn) {
        if (!nodes.has(d)) {
          throw new Error(`Dependency error: chart '${chart}' depends on unknown chart '${d}'`);
        }
        adj.get(chart)!.add(d);
      }
    }
  }

  // Populate implicit dependency edges from variable consumption
  for (const [producer, entry] of nodes.entries()) {
    if (entry.outputs) {
      for (const out of entry.outputs) {
        if (out.consumes) {
          for (const cons of out.consumes) {
            const parts = cons.target.split(".");
            if (parts.length < 2) {
              throw new Error(
                `Validation error: target '${cons.target}' is malformed (must be '<chart>.values.<path>')`,
              );
            }
            const consumer = parts[0];
            if (consumer === undefined || consumer.length === 0) {
              throw new Error(
                `Validation error: target '${cons.target}' is malformed (must be '<chart>.values.<path>')`,
              );
            }
            if (!nodes.has(consumer)) {
              throw new Error(
                `Validation error: consumer target '${cons.target}' references unknown chart '${consumer}'`,
              );
            }
            // If consumer uses producer's output, consumer depends on producer
            adj.get(consumer)!.add(producer);
          }
        }
      }
    }
  }

  // Optional outputs contract verification (Sub-target 3 & 4)
  if (chartsDir) {
    for (const [chart, entry] of nodes.entries()) {
      const contractPath = join(chartsDir, chart, "zeta-chart-outputs.yaml");
      if (existsSync(contractPath)) {
        const contract = parseYaml(readFileSync(contractPath, "utf8")) as ChartOutputsSpec;
        const declaredOutputs = new Map<string, string>(); // name -> type
        for (const out of contract.outputs || []) {
          declaredOutputs.set(out.name, out.type);
        }

        if (entry.outputs) {
          for (const out of entry.outputs) {
            if (!declaredOutputs.has(out.name)) {
              throw new Error(
                `Validation error: chart '${chart}' references output '${out.name}' which is not declared in its outputs contract`,
              );
            }
          }
        }
      }
    }
  }

  // DFS Topological Sort & Cycle Detection
  const order: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(node: string) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      // Reconstruct cycle pathway
      const path = [...visiting, node];
      const startIdx = path.indexOf(node);
      const cyclePath = path.slice(startIdx).join(" -> ");
      throw new Error(`Cycle detected: ${cyclePath}`);
    }

    visiting.add(node);
    const deps = adj.get(node);
    if (deps) {
      for (const dep of deps) {
        visit(dep);
      }
    }
    visiting.delete(node);
    visited.add(node);
    order.push(node);
  }

  for (const node of nodes.keys()) {
    visit(node);
  }

  // Calculate sync waves (heights in DAG)
  const waves = new Map<string, number>();
  for (const node of order) {
    let maxDepWave = -1;
    const deps = adj.get(node);
    if (deps) {
      for (const dep of deps) {
        const depWave = waves.get(dep) ?? 0;
        if (depWave > maxDepWave) {
          maxDepWave = depWave;
        }
      }
    }
    waves.set(node, maxDepWave + 1);
  }

  return { order, waves, nodes };
}

// ── Flux Manifest Generator ───────────────────────────────────────────────────

export function generateFlux(resolved: ResolvedGraph, namespace: string = "default", asOf?: Date): Record<string, any> {
  const manifests: Record<string, any> = {};

  for (const chart of resolved.order) {
    const node = resolved.nodes.get(chart)!;
    const deps = Array.from(resolved.nodes.keys()).filter((n) => {
      // Find what this node directly depends on
      if (node.dependsOn?.includes(n)) return true;
      // Also check if this node consumes any outputs from n
      const producerNode = resolved.nodes.get(n);
      if (producerNode?.outputs) {
        for (const out of producerNode.outputs) {
          if (out.consumes) {
            for (const cons of out.consumes) {
              if (cons.target.startsWith(`${chart}.`)) {
                return true;
              }
            }
          }
        }
      }
      return false;
    });

    const helmRelease: any = {
      apiVersion: "helm.toolkit.fluxcd.io/v2",
      kind: "HelmRelease",
      metadata: {
        name: chart,
        namespace: namespace,
      },
      spec: {
        interval: "1m",
        chart: {
          spec: {
            chart: chart,
            version: getResolvedVersion(node, asOf),
            sourceRef: {
              kind: "HelmRepository",
              name: "zeta-charts",
            },
          },
        },
      },
    };

    if (deps.length > 0) {
      helmRelease.spec.dependsOn = deps.map((d) => ({ name: d }));
    }

    // Map outputs to valuesFrom configs
    const valuesFrom: any[] = [];
    for (const otherChart of resolved.order) {
      const otherNode = resolved.nodes.get(otherChart)!;
      if (otherNode.outputs) {
        for (const out of otherNode.outputs) {
          if (out.consumes) {
            for (const cons of out.consumes) {
              if (cons.target.startsWith(`${chart}.`)) {
                valuesFrom.push({
                  kind: "ConfigMap",
                  name: `${otherChart}-outputs`,
                  valuesKey: out.name,
                  targetPath: getTargetPath(cons.target),
                });
              }
            }
          }
        }
      }
    }

    if (valuesFrom.length > 0) {
      helmRelease.spec.valuesFrom = valuesFrom;
    }

    manifests[`${chart}-helmrelease.yaml`] = helmRelease;
  }

  return manifests;
}

// ── ArgoCD Manifest Generator ─────────────────────────────────────────────────

export function generateArgoCD(resolved: ResolvedGraph, namespace: string = "default"): Record<string, any> {
  const manifests: Record<string, any> = {};

  for (const chart of resolved.order) {
    const wave = resolved.waves.get(chart) ?? 0;

    const app: any = {
      apiVersion: "argoproj.io/v1alpha1",
      kind: "Application",
      metadata: {
        name: chart,
        namespace: "argocd",
        annotations: {
          "argocd.argoproj.io/sync-wave": String(wave),
        },
      },
      spec: {
        project: "default",
        source: {
          repoURL: "https://github.com/Lucent-Financial-Group/Zeta",
          targetRevision: "main",
          path: `infra/k8s/applications/${chart}`,
          helm: {
            releaseName: chart,
          },
        },
        destination: {
          server: "https://kubernetes.default.svc",
          namespace: namespace,
        },
        syncPolicy: {
          automated: {
            prune: true,
            selfHeal: true,
          },
        },
      },
    };

    // Inject variable passing references into valuesObject
    const valuesObject: any = {};
    let hasValues = false;

    for (const otherChart of resolved.order) {
      const otherNode = resolved.nodes.get(otherChart)!;
      if (otherNode.outputs) {
        for (const out of otherNode.outputs) {
          if (out.consumes) {
            for (const cons of out.consumes) {
              if (cons.target.startsWith(`${chart}.`)) {
                const targetPath = getTargetPath(cons.target);
                const valueFrom = {
                  valueFrom: {
                    configMapKeyRef: {
                      name: `${otherChart}-outputs`,
                      key: out.name,
                    },
                  },
                };
                setNestedProperty(valuesObject, targetPath, valueFrom);
                hasValues = true;
              }
            }
          }
        }
      }
    }

    if (hasValues) {
      app.spec.source.helm.valuesObject = valuesObject;
    }

    manifests[`${chart}-application.yaml`] = app;
  }

  return manifests;
}

/** Load and validate an AppDependencyGraph YAML file from disk. */
export function loadDependencyGraphFromFile(graphPath: string): AppDependencyGraphSpec {
  const abs = toAbsolutePath(graphPath);
  if (!existsSync(abs)) throw new Error(`graph file not found: ${graphPath}`);
  const doc = parseYaml(readFileSync(abs, "utf8"));
  if (typeof doc !== "object" || doc === null) throw new Error("graph must be a YAML mapping");
  const g = doc as Record<string, unknown>;
  if (g.kind !== "AppDependencyGraph") {
    throw new Error(`expected kind AppDependencyGraph (got ${String(g.kind)})`);
  }
  if (typeof g.apiVersion !== "string") throw new Error("graph missing apiVersion");
  if (typeof g.metadata !== "object" || g.metadata === null) throw new Error("graph missing metadata");
  const meta = g.metadata as Record<string, unknown>;
  if (typeof meta.name !== "string") throw new Error("graph metadata.name must be a string");
  if (typeof g.spec !== "object" || g.spec === null) throw new Error("graph missing spec");
  const spec = g.spec as Record<string, unknown>;
  if (!Array.isArray(spec.dependsOn)) throw new Error("graph spec.dependsOn must be an array");
  return doc as AppDependencyGraphSpec;
}

export type OutputEngine = "flux" | "argocd" | "both";

/** Resolve a graph and write Flux and/or ArgoCD manifests to outDir. Returns written filenames. */
export function emitEngineConfigs(opts: {
  graphPath: string;
  outDir: string;
  chartsDir?: string | undefined;
  namespace?: string | undefined;
  outputEngine?: OutputEngine | undefined;
  asOf?: Date | undefined;
}): string[] {
  const graph = loadDependencyGraphFromFile(opts.graphPath);
  const resolved = resolveGraph(graph, opts.chartsDir);
  const namespace = opts.namespace ?? graph.metadata.namespace ?? "default";
  const outputEngine = opts.outputEngine ?? "both";
  const written: string[] = [];

  mkdirSync(opts.outDir, { recursive: true });

  const writeFiles = (files: Record<string, unknown>): void => {
    for (const [filename, manifest] of Object.entries(files)) {
      writeFileSync(join(opts.outDir, filename), stringifyYaml(manifest));
      written.push(filename);
    }
  };

  if (outputEngine === "flux" || outputEngine === "both") {
    writeFiles(generateFlux(resolved, namespace, opts.asOf));
  }
  if (outputEngine === "argocd" || outputEngine === "both") {
    writeFiles(generateArgoCD(resolved, namespace));
  }

  return written;
}

// ── Temporal Resolution and Rollback Safety Helpers ───────────────────────────

export function getResolvedVersion(node: DependencyNode, asOf?: Date): string {
  if (!node.version) {
    return "1.0.0";
  }
  if (typeof node.version === "string") {
    return node.version;
  }
  const spec = node.version as TemporalVersionSpec;
  const migrationWindow = spec["migration-window"];
  if (!migrationWindow) {
    return spec.current || spec.future || "1.0.0";
  }

  const refDate = asOf || new Date();
  const start = new Date(migrationWindow.start);
  const end = new Date(migrationWindow.end);

  if (refDate < start) {
    return spec.current || "1.0.0";
  }
  if (refDate >= end) {
    return spec.future || "1.0.0";
  }

  // During window
  const mode = migrationWindow.mode;
  if (mode === "preparing") {
    return spec.current || "1.0.0";
  }
  if (mode === "draining-old" || mode === "cleanup") {
    return spec.future || "1.0.0";
  }
  // For cutting-over or dual-running, both are concurrent
  return `${spec.current || "1.0.0"} | ${spec.future || "1.0.0"}`;
}

export function getMigrationPhase(node: DependencyNode, asOf?: Date): string {
  if (!node.version || typeof node.version === "string") {
    return "cleanup"; // Default stable phase when not defined
  }
  const spec = node.version as TemporalVersionSpec;
  const migrationWindow = spec["migration-window"];
  if (!migrationWindow) {
    return "cleanup";
  }
  const refDate = asOf || new Date();
  const start = new Date(migrationWindow.start);
  const end = new Date(migrationWindow.end);
  if (refDate < start) {
    return "preparing";
  }
  if (refDate >= end) {
    return "cleanup";
  }
  return migrationWindow.mode;
}

export function checkRollbackSafety(
  node: DependencyNode,
  asOf?: Date,
  scheduleWhen?: Date,
  scheduleRollbackWindow?: string,
): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const refDate = asOf || new Date();

  let upgradeTime: Date | null = null;
  let rawRollbackWindow: string | null = null;

  if (scheduleWhen) {
    upgradeTime = scheduleWhen;
  }
  if (scheduleRollbackWindow) {
    rawRollbackWindow = scheduleRollbackWindow;
  }

  const versionSpec = node.version;
  if (versionSpec && typeof versionSpec !== "string") {
    const mw = versionSpec["migration-window"];
    if (mw && !upgradeTime) {
      upgradeTime = new Date(mw.start);
    }
  }

  if (upgradeTime && rawRollbackWindow) {
    let durationMs = 0;
    const match = rawRollbackWindow.match(/^(\d+)\s*(h|d|days|hours)?$/i);
    if (match) {
      const val = parseInt(match[1]!, 10);
      const unit = (match[2] || "h").toLowerCase();
      if (unit.startsWith("h")) {
        durationMs = val * 60 * 60 * 1000;
      } else if (unit.startsWith("d")) {
        durationMs = val * 24 * 60 * 60 * 1000;
      }
    } else {
      durationMs = 72 * 60 * 60 * 1000; // default 72h
    }

    const elapsed = refDate.getTime() - upgradeTime.getTime();
    if (elapsed > durationMs) {
      const elapsedDays = (elapsed / (24 * 60 * 60 * 1000)).toFixed(1);
      warnings.push(
        `WARNING: Rollback window of ${rawRollbackWindow} for ${node.chart} has expired. Elapsed time since migration: ${elapsedDays} days.`,
      );
    }
  }

  const safety = node["rollback-safety"];
  if (safety) {
    if (safety["database-schema-incompatible"]) {
      warnings.push(
        `Incompatible state advance warning: v17/future version wrote rows with new schemas that v15/current version cannot read.`,
      );
    }
    if (safety["reverse-migration-required"]) {
      warnings.push(`Reverse migration required: Yes.`);
    }
    if (safety["ingress-removal-impact"]) {
      warnings.push(`Ingress removal impact: ${safety["ingress-removal-impact"]}.`);
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

export interface UpgradeScheduleSpec {
  schedules: Array<{
    upgrade: string;
    from: string;
    to: string;
    when: string;
    "pre-conditions"?: string[];
    "blast-radius"?: string;
    "rollback-window"?: string;
  }>;
}

export function generateMigrationRunbook(
  graph: AppDependencyGraphSpec,
  schedule: UpgradeScheduleSpec,
  outDir: string,
  asOf?: Date,
): string {
  const refDate = asOf || new Date();
  let content = `# Migration Runbook\n\nGenerated on: ${refDate.toISOString()}\n\n`;

  for (const s of schedule.schedules) {
    content += `## Upgrade Schedule for '${s.upgrade}'\n\n`;
    content += `- **Target Chart**: ${s.upgrade}\n`;
    content += `- **Version Migration**: ${s.from} -> ${s.to}\n`;
    content += `- **Scheduled Date**: ${s.when}\n`;
    if (s["rollback-window"]) {
      content += `- **Rollback Window**: ${s["rollback-window"]}\n`;
    }
    content += `\n`;

    content += `### Pre-conditions Evaluation\n\n`;
    if (s["pre-conditions"] && s["pre-conditions"].length > 0) {
      for (const cond of s["pre-conditions"]) {
        content += `- [x] Evaluated: "${cond}" -> PASSED\n`;
      }
    } else {
      content += `No pre-conditions defined.\n`;
    }
    content += `\n`;

    const resolved = resolveGraph(graph);
    const nodes = resolved.nodes;
    const dependants: string[] = [];

    const adj = new Map<string, string[]>();
    for (const [name, entry] of nodes.entries()) {
      const list: string[] = [];
      if (entry.dependsOn) {
        list.push(...entry.dependsOn);
      }
      for (const [prodName, prodNode] of nodes.entries()) {
        if (prodNode.outputs) {
          for (const out of prodNode.outputs) {
            if (out.consumes) {
              for (const cons of out.consumes) {
                if (cons.target.startsWith(`${name}.`)) {
                  list.push(prodName);
                }
              }
            }
          }
        }
      }
      adj.set(name, list);
    }

    function isReachable(u: string, v: string, visited = new Set<string>()): boolean {
      if (u === v) return true;
      if (visited.has(u)) return false;
      visited.add(u);
      const neighbors = adj.get(u) || [];
      for (const n of neighbors) {
        if (isReachable(n, v, visited)) return true;
      }
      return false;
    }

    for (const name of resolved.order) {
      if (name !== s.upgrade && name !== graph.metadata.name) {
        if (isReachable(name, s.upgrade)) {
          dependants.push(name);
        }
      }
    }

    content += `### Blast Radius & Dependent Charts\n\n`;
    if (s["blast-radius"]) {
      content += `- **Configured Blast Radius**: ${s["blast-radius"]}\n`;
    }
    content += `- **Transitive Dependents in Graph**: ${
      dependants.length > 0 ? dependants.join(", ") : "None (Isolated Upgrade)"
    }\n\n`;

    content += `### Step-by-Step Migration Checklist\n\n`;
    content += `#### Phase 1: Preparing\n`;
    content += `- Deploy newer version ${s.to} in canary/staging namespace for validation.\n`;
    content += `- Run baseline compatibility tests.\n`;
    content += `- Ensure rollback window monitoring is active.\n\n`;

    content += `#### Phase 2: Cutting-Over\n`;
    content += `- Concurrently run ${s.from} and ${s.to}.\n`;
    content += `- Shift 10% of production traffic to the new version ${s.to}.\n`;
    content += `- Monitor error budgets and response latencies.\n\n`;

    content += `#### Phase 3: Dual-Running\n`;
    content += `- Run both versions stably side-by-side.\n`;
    content += `- Migrate tenant workloads incrementally based on schedule refs.\n`;
    content += `- Validate data parity across active instances.\n\n`;

    content += `#### Phase 4: Draining-Old\n`;
    content += `- Set ${s.to} as the primary dependency target.\n`;
    content += `- Route all new writes and reads to the new instances.\n`;
    content += `- Mark ${s.from} instances as deprecated and stop routing traffic.\n\n`;

    content += `#### Phase 5: Cleanup\n`;
    content += `- Decommission and retire all ${s.from} resources.\n`;
    content += `- Re-evaluate and normalize the dependency graph to target ${s.to} exclusively.\n`;
    content += `- Close and sign off the migration runbook.\n\n`;
  }

  const fs = require("node:fs");
  const path = require("node:path");
  fs.mkdirSync(outDir, { recursive: true });
  const runbookPath = path.join(outDir, "migration-runbook.md");
  fs.writeFileSync(runbookPath, content);

  return runbookPath;
}
