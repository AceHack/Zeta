// deps.ts — Dependency-graph and variable-passing engine (B-0821)
//
// Sits above Helm and below Flux/ArgoCD. Resolves dependency graphs,
// calculates topo-sort & sync-waves, and generates manifests with variable-flow bindings.

import { parse as yamlParse } from "../yaml/dom";
import { encode as yamlEncode } from "../yaml/encoder";
import type { YamlValue } from "../yaml/dom";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface DependencyNode {
  chart: string;
  version?: string;
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
    case "Null": return null;
    case "Bool": return v.value;
    case "Int": return Number(v.value);
    case "Float": return v.value;
    case "Str": return v.value;
    case "Seq": return v.items.map(toJs);
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

export function parseYaml(text: string): any {
  const res = yamlParse(text);
  if (!res.ok) {
    throw new Error(`YAML parse failed: ${res.feedback}`);
  }
  return toJs(res.value);
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
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
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
              throw new Error(`Validation error: target '${cons.target}' is malformed (must be '<chart>.values.<path>')`);
            }
            const consumer = parts[0];
            if (!nodes.has(consumer)) {
              throw new Error(`Validation error: consumer target '${cons.target}' references unknown chart '${consumer}'`);
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
              throw new Error(`Validation error: chart '${chart}' references output '${out.name}' which is not declared in its outputs contract`);
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

export function generateFlux(resolved: ResolvedGraph, namespace: string = "default"): Record<string, any> {
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
            version: node.version || "1.0.0",
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
    const node = resolved.nodes.get(chart)!;

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
