#!/usr/bin/env bun
// tools/cluster/deps-to-engine-config.ts
//
// B-0820 sub-target 4 + B-0821 variable-passing scope.
// Cluster-facing wrapper: one AppDependencyGraph → Flux + ArgoCD manifests.
// Engine logic lives in src/Core.TypeScript/ace/deps.ts; ace deps resolve is the
// operator CLI alias. This tool is the build-time path CI and GitOps pipelines call.
//
// Usage:
//   bun tools/cluster/deps-to-engine-config.ts \
//       --graph examples/helm-dependency-graph/my-app-postgres/zeta-deps.yaml \
//       --out-dir /tmp/manifests \
//       [--charts-dir examples/helm-dependency-graph/charts] \
//       [--namespace staging] \
//       [--engine flux|argocd|both]
//
// Exit codes:
//   0 — manifests written
//   1 — invocation error
//   2 — graph validation / resolution error
import { emitEngineConfigs, loadDependencyGraphFromFile, resolveGraph, } from "../ace/deps.js";
export function parseArgs(argv) {
    let graphPath = "";
    let outDir = "";
    let chartsDir;
    let namespace;
    let engine = "both";
    let validateOnly = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--graph" || a === "-g") {
            const v = argv[i + 1];
            if (!v || v.startsWith("-"))
                return { error: "--graph requires a path" };
            graphPath = v;
            i++;
        }
        else if (a === "--out-dir" || a === "-o") {
            const v = argv[i + 1];
            if (!v || v.startsWith("-"))
                return { error: "--out-dir requires a path" };
            outDir = v;
            i++;
        }
        else if (a === "--charts-dir") {
            const v = argv[i + 1];
            if (!v || v.startsWith("-"))
                return { error: "--charts-dir requires a path" };
            chartsDir = v;
            i++;
        }
        else if (a === "--namespace" || a === "-n") {
            const v = argv[i + 1];
            if (!v || v.startsWith("-"))
                return { error: "--namespace requires a name" };
            namespace = v;
            i++;
        }
        else if (a === "--engine") {
            const v = argv[i + 1];
            if (v !== "flux" && v !== "argocd" && v !== "both") {
                return { error: "--engine must be flux, argocd, or both" };
            }
            engine = v;
            i++;
        }
        else if (a === "--validate-only") {
            validateOnly = true;
        }
        else if (a === "-h" || a === "--help") {
            return {
                error: "Usage: bun tools/cluster/deps-to-engine-config.ts --graph <path> --out-dir <dir> " +
                    "[--charts-dir <dir>] [--namespace <ns>] [--engine flux|argocd|both] [--validate-only]",
            };
        }
        else {
            return { error: `unknown argument: ${a}` };
        }
    }
    if (!graphPath)
        return { error: "--graph <path> is required" };
    if (!validateOnly && !outDir)
        return { error: "--out-dir <dir> is required unless --validate-only" };
    return { graphPath, outDir, chartsDir, namespace, engine, validateOnly };
}
export function runDepsToEngineConfig(args) {
    try {
        const graph = loadDependencyGraphFromFile(args.graphPath);
        resolveGraph(graph, args.chartsDir);
        if (args.validateOnly) {
            return { ok: true, written: [] };
        }
        const written = emitEngineConfigs({
            graphPath: args.graphPath,
            outDir: args.outDir,
            chartsDir: args.chartsDir,
            namespace: args.namespace,
            outputEngine: args.engine,
        });
        return { ok: true, written };
    }
    catch (e) {
        return { ok: false, message: e.message };
    }
}
function main() {
    const parsed = parseArgs(process.argv.slice(2));
    if ("error" in parsed) {
        process.stderr.write(`deps-to-engine-config: ${parsed.error}\n`);
        return 1;
    }
    const result = runDepsToEngineConfig(parsed);
    if (!result.ok) {
        process.stderr.write(`deps-to-engine-config: ${result.message}\n`);
        return 2;
    }
    if (parsed.validateOnly) {
        process.stdout.write(`deps-to-engine-config: graph valid (${parsed.graphPath})\n`);
        return 0;
    }
    process.stdout.write(`deps-to-engine-config: wrote ${result.written.length} manifest(s) to ${parsed.outDir}\n`);
    for (const f of result.written) {
        process.stdout.write(`  ${f}\n`);
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main());
}
