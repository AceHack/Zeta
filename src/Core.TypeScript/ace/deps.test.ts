// deps.test.ts — Unit tests for dependency graph engine (B-0821)

import { expect, test, describe } from "bun:test";
import {
  resolveGraph,
  generateFlux,
  generateArgoCD,
  parseYaml,
  stringifyYaml,
  getTargetPath,
  setNestedProperty,
  type AppDependencyGraphSpec,
  type ChartOutputsSpec,
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

    expect(() => resolveGraph(graph)).toThrow(/Cycle detected: (chart-a -> chart-b -> chart-a|chart-b -> chart-a -> chart-b)/);
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
      outputs: [
        { name: "connection-url", type: "string", value: ".Values.postgres.connectionUrl" },
      ],
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
      outputs: [
        { name: "admin-password", type: "string", value: ".Values.postgres.adminPassword" },
      ],
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

    expect(() => resolveGraph(graph, tmpDir)).toThrow(/Validation error: chart 'postgres' references output 'connection-url' which is not declared in its outputs contract/);
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
