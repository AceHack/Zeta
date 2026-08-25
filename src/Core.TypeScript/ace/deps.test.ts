// deps.test.ts — Unit tests for dependency graph engine (081KSGS9H0008QG0R00367G209)

import { expect, test, describe } from "bun:test";
import {
  resolveGraph,
  generateFlux,
  generateArgoCD,
  parseYaml,
  stringifyYaml,
  getTargetPath,
  setNestedProperty,
  getResolvedVersion,
  getMigrationPhase,
  checkRollbackSafety,
  generateMigrationRunbook,
  type AppDependencyGraphSpec,
  type ChartOutputsSpec,
  type UpgradeScheduleSpec,
} from "./deps";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("YAML parser helpers", () => {
  test("parseYaml parses a valid YAML string", () => {
    const yaml = `
"name": "my-app"
"version": "1.0.0"
"tags":
  - "k8s"
  - "helm"
`;
    const obj = parseYaml(yaml);
    expect(obj).toEqual({
      name: "my-app",
      version: "1.0.0",
      tags: ["k8s", "helm"],
    });
  });

  test("stringifyYaml serializes back to YAML correctly", () => {
    const obj = {
      name: "my-app",
      version: "1.0.0",
      tags: ["k8s", "helm"],
    };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('"name": "my-app"');
    expect(yaml).toContain('"version": "1.0.0"');
    expect(yaml).toContain('- "k8s"');
    expect(yaml).toContain('- "helm"');
  });
});

describe("Path formatting helpers", () => {
  test("getTargetPath formats correctly", () => {
    expect(getTargetPath("my-app.values.database.url")).toBe("database.url");
    expect(getTargetPath("my-app.database.url")).toBe("database.url");
  });

  test("setNestedProperty sets nested properties dynamically", () => {
    const obj: any = {};
    setNestedProperty(obj, "database.url", "postgres://localhost");
    expect(obj).toEqual({
      database: {
        url: "postgres://localhost",
      },
    });

    setNestedProperty(obj, "database.password", "secret");
    expect(obj.database.password).toBe("secret");
  });

  // CodeQL `js/prototype-pollution-utility`. `path` reaches here from a dependency
  // graph's `consumes.target` in YAML, so a spec -- not a caller -- picks these segments.
  test("setNestedProperty refuses a path that names the prototype chain", () => {
    const obj: any = {};
    expect(() => setNestedProperty(obj, "__proto__.polluted", "yes")).toThrow(/not a value key/);
    expect(() => setNestedProperty(obj, "a.constructor.prototype.polluted", "yes")).toThrow(/not a value key/);
    expect(() => setNestedProperty(obj, "a.prototype", "yes")).toThrow(/not a value key/);
    expect(({} as any).polluted).toBeUndefined();
    expect(obj).toEqual({});
  });

  // `in` walks the prototype chain, so an inherited name reads as already-present and the
  // walk descends into `Object.prototype.toString` instead of creating a fresh object.
  test("setNestedProperty creates an intermediate named like an inherited member", () => {
    const obj: any = {};
    setNestedProperty(obj, "toString.enabled", true);
    // The OWN-property assertion is the discriminating one: under `in`, `toString`
    // already "exists", so the walk descends into `Object.prototype.toString` and writes
    // `enabled` onto the shared function -- `obj.toString.enabled` then reads `true`
    // through the prototype chain and looks correct while every object in the process
    // has been mutated.
    expect(Object.prototype.hasOwnProperty.call(obj, "toString")).toBe(true);
    expect(obj.toString.enabled).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype.toString, "enabled")).toBe(false);
  });
});

describe("Graph Resolution & Topo Sort", () => {
  test("resolves a simple acyclic graph with correct order and waves", () => {
    const graph: AppDependencyGraphSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "AppDependencyGraph",
      metadata: {
        name: "my-app",
      },
      spec: {
        dependsOn: [
          {
            chart: "postgres",
            version: ">=15.0.0",
            outputs: [
              {
                name: "connection-url",
                source: ".Values.postgres.connectionUrl",
                consumes: [{ target: "my-app.values.database.url" }],
              },
            ],
          },
          {
            chart: "redis",
            outputs: [
              {
                name: "endpoint",
                source: ".Values.redis.endpoint",
                consumes: [{ target: "my-app.values.cache.endpoint" }],
              },
            ],
          },
        ],
      },
    };

    const res = resolveGraph(graph);

    // postgres and redis have no dependencies; they resolve first.
    // my-app depends on postgres and redis implicitly due to consumes bindings.
    expect(res.order.indexOf("postgres")).toBeLessThan(res.order.indexOf("my-app"));
    expect(res.order.indexOf("redis")).toBeLessThan(res.order.indexOf("my-app"));

    expect(res.waves.get("postgres")).toBe(0);
    expect(res.waves.get("redis")).toBe(0);
    expect(res.waves.get("my-app")).toBe(1);
  });

  test("throws detailed error when explicit cycle detected", () => {
    const graph: AppDependencyGraphSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "AppDependencyGraph",
      metadata: {
        name: "my-app",
      },
      spec: {
        dependsOn: [
          {
            chart: "chart-a",
            dependsOn: ["chart-b"],
          },
          {
            chart: "chart-b",
            dependsOn: ["chart-a"],
          },
        ],
      },
    };

    expect(() => resolveGraph(graph)).toThrow(
      /Cycle detected: (chart-a -> chart-b -> chart-a|chart-b -> chart-a -> chart-b)/,
    );
  });

  test("throws detailed error when implicit variable flow cycle detected", () => {
    const graph: AppDependencyGraphSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "AppDependencyGraph",
      metadata: {
        name: "my-app",
      },
      spec: {
        dependsOn: [
          {
            chart: "chart-a",
            outputs: [
              {
                name: "out-a",
                source: ".Values.a",
                consumes: [{ target: "chart-b.values.in-b" }],
              },
            ],
          },
          {
            chart: "chart-b",
            outputs: [
              {
                name: "out-b",
                source: ".Values.b",
                consumes: [{ target: "chart-a.values.in-a" }],
              },
            ],
          },
        ],
      },
    };

    expect(() => resolveGraph(graph)).toThrow(/Cycle detected:/);
  });

  test("resolves explicit dependsOn chain correctly", () => {
    const graph: AppDependencyGraphSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "AppDependencyGraph",
      metadata: {
        name: "my-app",
      },
      spec: {
        dependsOn: [
          {
            chart: "chart-a",
          },
          {
            chart: "chart-b",
            dependsOn: ["chart-a"],
          },
          {
            chart: "chart-c",
            dependsOn: ["chart-b"],
          },
        ],
      },
    };

    const res = resolveGraph(graph);
    expect(res.order.indexOf("chart-a")).toBeLessThan(res.order.indexOf("chart-b"));
    expect(res.order.indexOf("chart-b")).toBeLessThan(res.order.indexOf("chart-c"));

    expect(res.waves.get("chart-a")).toBe(0);
    expect(res.waves.get("chart-b")).toBe(1);
    expect(res.waves.get("chart-c")).toBe(2);
  });
});

describe("Chart contract verification", () => {
  const tmpDir = join(__dirname, "tmp-test-charts");

  test("verifies valid chart outputs contract", () => {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "postgres"), { recursive: true });

    const contract: ChartOutputsSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "ChartOutputs",
      metadata: { name: "postgres" },
      outputs: [{ name: "connection-url", type: "string", value: ".Values.postgres.connectionUrl" }],
    };

    writeFileSync(join(tmpDir, "postgres", "zeta-chart-outputs.yaml"), stringifyYaml(contract));

    const graph: AppDependencyGraphSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "AppDependencyGraph",
      metadata: { name: "my-app" },
      spec: {
        dependsOn: [
          {
            chart: "postgres",
            outputs: [
              {
                name: "connection-url",
                source: ".Values.postgres.connectionUrl",
                consumes: [{ target: "my-app.values.database.url" }],
              },
            ],
          },
        ],
      },
    };

    const res = resolveGraph(graph, tmpDir);
    expect(res.order).toContain("postgres");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("throws validation error when output is not in outputs contract", () => {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "postgres"), { recursive: true });

    const contract: ChartOutputsSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "ChartOutputs",
      metadata: { name: "postgres" },
      outputs: [{ name: "admin-password", type: "string", value: ".Values.postgres.adminPassword" }],
    };

    writeFileSync(join(tmpDir, "postgres", "zeta-chart-outputs.yaml"), stringifyYaml(contract));

    const graph: AppDependencyGraphSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "AppDependencyGraph",
      metadata: { name: "my-app" },
      spec: {
        dependsOn: [
          {
            chart: "postgres",
            outputs: [
              {
                name: "connection-url",
                source: ".Values.postgres.connectionUrl",
                consumes: [{ target: "my-app.values.database.url" }],
              },
            ],
          },
        ],
      },
    };

    expect(() => resolveGraph(graph, tmpDir)).toThrow(
      /Validation error: chart 'postgres' references output 'connection-url' which is not declared in its outputs contract/,
    );
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("Manifest Generation", () => {
  const graph: AppDependencyGraphSpec = {
    apiVersion: "zeta.lucent-financial-group.com/v1",
    kind: "AppDependencyGraph",
    metadata: {
      name: "my-app",
    },
    spec: {
      dependsOn: [
        {
          chart: "postgres",
          version: "15.2.0",
          outputs: [
            {
              name: "connection-url",
              source: ".Values.postgres.connectionUrl",
              consumes: [{ target: "my-app.values.database.url" }],
            },
          ],
        },
      ],
    },
  };

  test("generates correct Flux HelmReleases", () => {
    const res = resolveGraph(graph);
    const manifests = generateFlux(res, "staging");

    expect(manifests["postgres-helmrelease.yaml"]).toBeDefined();
    expect(manifests["my-app-helmrelease.yaml"]).toBeDefined();

    const pg = manifests["postgres-helmrelease.yaml"];
    expect(pg.metadata.name).toBe("postgres");
    expect(pg.metadata.namespace).toBe("staging");
    expect(pg.spec.chart.spec.version).toBe("15.2.0");

    const app = manifests["my-app-helmrelease.yaml"];
    expect(app.spec.dependsOn).toEqual([{ name: "postgres" }]);
    expect(app.spec.valuesFrom).toEqual([
      {
        kind: "ConfigMap",
        name: "postgres-outputs",
        valuesKey: "connection-url",
        targetPath: "database.url",
      },
    ]);
  });

  test("generates correct ArgoCD Applications with sync waves and valuesObject configmaps", () => {
    const res = resolveGraph(graph);
    const manifests = generateArgoCD(res, "production");

    expect(manifests["postgres-application.yaml"]).toBeDefined();
    expect(manifests["my-app-application.yaml"]).toBeDefined();

    const pg = manifests["postgres-application.yaml"];
    expect(pg.metadata.annotations["argocd.argoproj.io/sync-wave"]).toBe("0");

    const app = manifests["my-app-application.yaml"];
    expect(app.metadata.annotations["argocd.argoproj.io/sync-wave"]).toBe("1");
    expect(app.spec.source.helm.valuesObject).toEqual({
      database: {
        url: {
          valueFrom: {
            configMapKeyRef: {
              name: "postgres-outputs",
              key: "connection-url",
            },
          },
        },
      },
    });
  });
});

describe("Temporal Graph & 081KSGS9H0008QG0R002PT5C7J Features", () => {
  const nodeWithTemporalSpec = {
    chart: "postgres",
    version: {
      current: ">=15.0.0",
      future: "==17.x",
      "migration-window": {
        name: "postgres-v17-cutover",
        start: "2026-06-01T00:00:00Z",
        end: "2026-08-01T00:00:00Z",
        mode: "dual-running" as const,
      },
    },
    "rollback-safety": {
      "database-schema-incompatible": true,
      "reverse-migration-required": true,
      "ingress-removal-impact": "in-flight requests will fail",
    },
  };

  test("getResolvedVersion and getMigrationPhase before, during, and after migration window", () => {
    // Before migration
    const beforeDate = new Date("2026-05-15T00:00:00Z");
    expect(getResolvedVersion(nodeWithTemporalSpec, beforeDate)).toBe(">=15.0.0");
    expect(getMigrationPhase(nodeWithTemporalSpec, beforeDate)).toBe("preparing");

    // During migration (dual-running mode)
    const duringDate = new Date("2026-07-01T00:00:00Z");
    expect(getResolvedVersion(nodeWithTemporalSpec, duringDate)).toBe(">=15.0.0 | ==17.x");
    expect(getMigrationPhase(nodeWithTemporalSpec, duringDate)).toBe("dual-running");

    // After migration
    const afterDate = new Date("2026-08-15T00:00:00Z");
    expect(getResolvedVersion(nodeWithTemporalSpec, afterDate)).toBe("==17.x");
    expect(getMigrationPhase(nodeWithTemporalSpec, afterDate)).toBe("cleanup");
  });

  test("getResolvedVersion resolves simple string version", () => {
    const simpleNode = { chart: "redis", version: "7.0.0" };
    expect(getResolvedVersion(simpleNode, new Date())).toBe("7.0.0");
  });

  test("checkRollbackSafety audits rollback window and logs warnings", () => {
    // Audit before window expiry
    const testDateWithin = new Date("2026-06-02T00:00:00Z"); // 1 day after start
    const safetyWithin = checkRollbackSafety(nodeWithTemporalSpec, testDateWithin, undefined, "72h");

    // It should have warnings from the compatibility settings but NOT rollback window expiry
    expect(safetyWithin.safe).toBe(false);
    expect(safetyWithin.warnings.some((w) => w.includes("expired"))).toBe(false);
    expect(safetyWithin.warnings).toContain("Reverse migration required: Yes.");

    // Audit after window expiry
    const testDateExpired = new Date("2026-06-05T00:00:00Z"); // 4 days after start (exceeds 72h)
    const safetyExpired = checkRollbackSafety(nodeWithTemporalSpec, testDateExpired, undefined, "72h");

    expect(safetyExpired.safe).toBe(false);
    expect(
      safetyExpired.warnings.some((w) => w.includes("WARNING: Rollback window of 72h for postgres has expired")),
    ).toBe(true);
  });

  test("generateMigrationRunbook generates a valid markdown runbook with blast radius", () => {
    const graph: AppDependencyGraphSpec = {
      apiVersion: "zeta.lucent-financial-group.com/v1",
      kind: "AppDependencyGraph",
      metadata: { name: "my-app" },
      spec: {
        dependsOn: [
          nodeWithTemporalSpec,
          {
            chart: "my-service",
            dependsOn: ["postgres"],
          },
        ],
      },
    };

    const schedule: UpgradeScheduleSpec = {
      schedules: [
        {
          upgrade: "postgres",
          from: "15.x",
          to: "17.x",
          when: "2026-06-15T03:00:00Z",
          "pre-conditions": ["canary-cluster has 7-day clean run with v17"],
          "blast-radius": "all-tenants-using-postgres",
          "rollback-window": "72h",
        },
      ],
    };

    const outDir = join(__dirname, "tmp-test-runbook");
    const runbookPath = generateMigrationRunbook(graph, schedule, outDir, new Date("2026-06-01T00:00:00Z"));

    const fs = require("node:fs");
    expect(fs.existsSync(runbookPath)).toBe(true);
    const content = fs.readFileSync(runbookPath, "utf8");

    expect(content).toContain("# Migration Runbook");
    expect(content).toContain("## Upgrade Schedule for 'postgres'");
    expect(content).toContain("- **Target Chart**: postgres");
    expect(content).toContain("- **Version Migration**: 15.x -> 17.x");
    expect(content).toContain("- **Rollback Window**: 72h");
    expect(content).toContain("- **Transitive Dependents in Graph**: my-service");
    expect(content).toContain("#### Phase 1: Preparing");
    expect(content).toContain("#### Phase 5: Cleanup");

    fs.rmSync(outDir, { recursive: true, force: true });
  });
});
