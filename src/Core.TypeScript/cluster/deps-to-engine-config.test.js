// tools/cluster/deps-to-engine-config.test.ts — unit tests for B-0821 cluster emitter
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs, runDepsToEngineConfig } from "./deps-to-engine-config.js";
import { parseYaml } from "../ace/deps.js";
const repoRoot = join(import.meta.dir, "../../..");
const exampleGraph = join(repoRoot, "examples/helm-dependency-graph/my-app-postgres/zeta-deps.yaml");
const exampleCharts = join(repoRoot, "examples/helm-dependency-graph/charts");
describe("deps-to-engine-config parseArgs", () => {
    test("requires --graph", () => {
        const r = parseArgs(["--out-dir", "/tmp/out"]);
        expect(r).toEqual({ error: "--graph <path> is required" });
    });
    test("requires --out-dir unless --validate-only", () => {
        const r = parseArgs(["--graph", exampleGraph]);
        expect(r).toEqual({ error: "--out-dir <dir> is required unless --validate-only" });
    });
    test("parses full invocation", () => {
        const r = parseArgs([
            "--graph",
            exampleGraph,
            "--out-dir",
            "/tmp/out",
            "--charts-dir",
            exampleCharts,
            "--namespace",
            "staging",
            "--engine",
            "both",
        ]);
        expect("error" in r).toBe(false);
        if ("error" in r)
            return;
        expect(r.graphPath).toBe(exampleGraph);
        expect(r.engine).toBe("both");
        expect(r.namespace).toBe("staging");
    });
});
describe("deps-to-engine-config run", () => {
    test("validate-only succeeds on canonical example", () => {
        const r = runDepsToEngineConfig({
            graphPath: exampleGraph,
            outDir: "",
            chartsDir: exampleCharts,
            engine: "both",
            validateOnly: true,
        });
        expect(r.ok).toBe(true);
    });
    test("writes Flux and ArgoCD manifests from one graph", () => {
        const outDir = mkdtempSync(join(tmpdir(), "deps-engine-out-"));
        try {
            const r = runDepsToEngineConfig({
                graphPath: exampleGraph,
                outDir,
                chartsDir: exampleCharts,
                namespace: "staging",
                engine: "both",
                validateOnly: false,
            });
            expect(r.ok).toBe(true);
            if (!r.ok)
                return;
            expect(r.written).toContain("postgres-helmrelease.yaml");
            expect(r.written).toContain("my-app-helmrelease.yaml");
            expect(r.written).toContain("postgres-application.yaml");
            expect(r.written).toContain("my-app-application.yaml");
        }
        finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });
});
describe("B-0821 acceptance — variable flow on shipped example", () => {
    test("postgres connection-url → my-app database.url in Flux and ArgoCD outputs", () => {
        const outDir = mkdtempSync(join(tmpdir(), "b0821-accept-"));
        try {
            const r = runDepsToEngineConfig({
                graphPath: exampleGraph,
                outDir,
                chartsDir: exampleCharts,
                namespace: "staging",
                engine: "both",
                validateOnly: false,
            });
            expect(r.ok).toBe(true);
            if (!r.ok)
                return;
            const fluxPath = join(outDir, "my-app-helmrelease.yaml");
            const argoPath = join(outDir, "my-app-application.yaml");
            expect(existsSync(fluxPath)).toBe(true);
            expect(existsSync(argoPath)).toBe(true);
            const flux = parseYaml(readFileSync(fluxPath, "utf8"));
            expect(flux.spec.dependsOn).toEqual([{ name: "postgres" }]);
            expect(flux.spec.valuesFrom).toEqual([
                {
                    kind: "ConfigMap",
                    name: "postgres-outputs",
                    valuesKey: "connection-url",
                    targetPath: "database.url",
                },
            ]);
            const argo = parseYaml(readFileSync(argoPath, "utf8"));
            expect(argo.spec.source.helm.valuesObject.database.url.valueFrom.configMapKeyRef).toEqual({
                name: "postgres-outputs",
                key: "connection-url",
            });
        }
        finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });
});
