// deps.test.ts — Unit tests for dependency graph engine (081KSGS9H0008QG0R00367G209)

import { expect, test, describe } from "bun:test";
import {
  resolveGraph,
  generateFlux,
  generateArgoCD,
  parseYaml,
  stringifyYaml,
  getTargetPath,
  defineOwn,
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
import { readDeclaredTrees } from "../cluster/declared-cluster-trees.ts";

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

    // THE PATH IS ASSERTED, because it was not. `spec.source.path` is what ArgoCD syncs
    // from; an emitted Application carrying a path that resolves to nothing is a manifest
    // that looks correct and deploys nothing, and no test could go red on it. Assert the
    // whole source block rather than a substring, so a repoURL or revision change is a
    // visible diff here too.
    expect(pg.spec.source.path).toBe("full-ai-cluster/k8s/applications/postgres");
    expect(manifests["my-app-application.yaml"].spec.source.path).toBe(
      "full-ai-cluster/k8s/applications/my-app",
    );
    // Negative half: no emitted path may sit under a tree the roster declares STALE. The
    // stale set is read from the roster rather than spelled here, so this guard covers
    // whatever is scheduled for deletion at the time it runs — and this file does not itself
    // become a consumer of a tree that is going away.
    const stale = readDeclaredTrees().stale;
    expect(stale.length).toBeGreaterThan(0); // else the loop below asserts nothing
    for (const name of Object.keys(manifests)) {
      const emitted = manifests[name]?.spec?.source?.path;
      if (typeof emitted !== "string") continue;
      for (const s of stale) expect(emitted.startsWith(`${s}/`)).toBe(false);
    }

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

// CodeQL `js/prototype-pollution-utility` (alert 207). The segment-NAME guard above was
// added for this alert and does not close it: refusing the spellings `__proto__` /
// `constructor` / `prototype` stops a path SPELLING its way to the prototype chain and does
// nothing about a path that WALKS there, because traversal follows values and a value can
// be a prototype object under any name. MEASURED 2026-09-09, before the container guard.
describe("setNestedProperty: the cursor may not LAND on a prototype object", () => {
  test("Object.prototype reached through an ordinary value is refused", () => {
    const obj: any = {};
    setNestedProperty(obj, "a", Object.prototype);
    expect(() => setNestedProperty(obj, "a.polluted", "yes")).toThrow(/resolves to a prototype object/);
    // The discriminating assertion: without the guard this read is "yes" on EVERY object.
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted")).toBe(false);
  });

  test("Array.prototype is refused too -- the guard is not a hardcoded Object.prototype", () => {
    const obj: any = { a: Array.prototype };
    expect(() => setNestedProperty(obj, "a.polluted", "yes")).toThrow(/resolves to a prototype object/);
    expect(([] as any).polluted).toBeUndefined();
  });

  test("a user class prototype is refused", () => {
    class Widget {}
    const obj: any = { a: Widget.prototype };
    expect(() => setNestedProperty(obj, "a.polluted", "yes")).toThrow(/resolves to a prototype object/);
    expect((new Widget() as any).polluted).toBeUndefined();
  });

  test("a plain object and a null-prototype object are NOT refused (no false positive)", () => {
    const plain: any = { a: {} };
    setNestedProperty(plain, "a.b", 1);
    expect(plain.a.b).toBe(1);
    const bare: any = { a: Object.create(null) };
    setNestedProperty(bare, "a.b", 2);
    expect(bare.a.b).toBe(2);
  });
});

describe("setNestedProperty: a path that means something other than what it says is refused", () => {
  test("an empty segment is refused by index, not normalised away", () => {
    const obj: any = {};
    // MEASURED 2026-09-09 before the guard: "a..b" yielded {"a":{"":{"b":1}}} and "a."
    // yielded {"a":{"":1}} -- a key named "" that no dependency graph ever asked for.
    expect(() => setNestedProperty(obj, "a..b", 1)).toThrow(/segment 1 is empty/);
    expect(() => setNestedProperty(obj, "a.", 1)).toThrow(/segment 1 is empty/);
    expect(() => setNestedProperty(obj, ".a", 1)).toThrow(/segment 0 is empty/);
    expect(obj).toEqual({});
  });

  test("the whole-path-empty message is unchanged", () => {
    expect(() => setNestedProperty({}, "", 1)).toThrow(/nested path must be non-empty/);
  });

  test("traversing into a non-container names the segment and the type", () => {
    const obj: any = {};
    setNestedProperty(obj, "a", 1);
    // Before: an opaque `TypeError: Attempted to assign to readonly property.` naming
    // neither the path nor the field, from a strict-mode write to a primitive.
    expect(() => setNestedProperty(obj, "a.b", 2)).toThrow(/segment "a" already holds a number/);
    expect(() => setNestedProperty({ a: "s" }, "a.b", 2)).toThrow(/already holds a string/);
    expect(() => setNestedProperty({ a: null }, "a.b", 2)).toThrow(/already holds a null/);
    expect(obj).toEqual({ a: 1 });
  });

  test("a non-object target is refused instead of throwing a raw TypeError", () => {
    expect(() => setNestedProperty(null, "a", 1)).toThrow(/target must be an object, got null/);
    expect(() => setNestedProperty(7 as any, "a", 1)).toThrow(/target must be an object, got number/);
  });
});

describe("setNestedProperty: every refusal is ATOMIC", () => {
  const REFUSED: Array<[string, string]> = [
    ["prototype-chain name deep in the path", "keep.constructor.prototype.polluted"],
    ["prototype-chain name at the head", "__proto__.polluted"],
    ["empty segment", "keep.fresh..leaf"],
    ["non-container in the way", "primitive.leaf"],
  ];
  for (const [name, path] of REFUSED) {
    test(name + " leaves the target byte-identical", () => {
      const obj: any = { keep: { already: 1 }, primitive: 7 };
      const before = JSON.stringify(obj);
      expect(() => setNestedProperty(obj, path, "x")).toThrow();
      // A half-applied refusal leaves a shape neither the caller nor the spec asked for.
      expect(JSON.stringify(obj)).toBe(before);
      expect(Object.keys(obj)).toEqual(["keep", "primitive"]);
    });
  }
});

describe("setNestedProperty: defineProperty writes are indistinguishable from assignment", () => {
  test("the written property is an own, writable, enumerable data property", () => {
    const obj: any = {};
    setNestedProperty(obj, "database.url", "postgres://localhost");
    const d = Object.getOwnPropertyDescriptor(obj.database, "url")!;
    expect(d).toEqual({ value: "postgres://localhost", writable: true, enumerable: true, configurable: true });
    expect(Object.keys(obj.database)).toEqual(["url"]);
    expect(JSON.stringify(obj)).toBe(JSON.stringify({ database: { url: "postgres://localhost" } }));
    expect({ ...obj.database }).toEqual({ url: "postgres://localhost" });
    obj.database.url = "changed";
    expect(obj.database.url).toBe("changed");
  });

  test("intermediates are ordinary plain objects", () => {
    const obj: any = {};
    setNestedProperty(obj, "a.b.c", 1);
    expect(Object.getPrototypeOf(obj.a)).toBe(Object.prototype);
    expect(obj).toEqual({ a: { b: { c: 1 } } });
  });
});

// MEASURED, NOT ENDORSED. Two consumes targets where one path is a PREFIX of the other are
// order-dependent: writing "db" then "db.url" merges, and writing "db.url" then "db" silently
// DISCARDS the url. Pinned here so the behaviour is a recorded fact rather than a surprise;
// which of the two is correct is a manifest-semantics question, not a security one, and is
// deliberately left unchanged by the prototype-pollution fix.
describe("setNestedProperty: prefix-colliding paths are order-dependent (recorded fact)", () => {
  test("shallow-then-deep merges", () => {
    const obj: any = {};
    setNestedProperty(obj, "db", { valueFrom: "one" });
    setNestedProperty(obj, "db.url", { valueFrom: "two" });
    expect(obj).toEqual({ db: { valueFrom: "one", url: { valueFrom: "two" } } });
  });
  test("deep-then-shallow DISCARDS the deeper write, with no error", () => {
    const obj: any = {};
    setNestedProperty(obj, "db.url", { valueFrom: "two" });
    setNestedProperty(obj, "db", { valueFrom: "one" });
    expect(obj).toEqual({ db: { valueFrom: "one" } });
  });
});

// The mutation that SURVIVED the first draft of this file: swapping defineOwn back to
// `container[key] = value` changed nothing any test could see, because setNestedProperty
// refuses the only keys on which the two differ. A safety property no test can distinguish
// is decoration, so the helper is exercised directly against exactly that key.
describe("defineOwn: assignment runs the __proto__ setter, defineProperty does not", () => {
  test("defineOwn makes __proto__ an inert OWN property", () => {
    const target: any = {};
    defineOwn(target, "__proto__", { polluted: "yes" });
    expect(Object.prototype.hasOwnProperty.call(target, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
    expect(({} as any).polluted).toBeUndefined();
  });

  test("CONTROL: plain assignment on the same key DOES move the prototype", () => {
    const target: any = {};
    target["__proto__"] = { polluted: "yes" };
    // This is what defineOwn exists to avoid. Note the own property is ABSENT and the
    // prototype moved -- the exact inverse of the assertions above.
    expect(Object.prototype.hasOwnProperty.call(target, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(target)).not.toBe(Object.prototype);
    expect(target.polluted).toBe("yes");
    // Contained: assignment moved THIS object.s prototype, it did not touch Object.prototype.
    expect(({} as any).polluted).toBeUndefined();
  });

  test("for an ordinary key the two are indistinguishable", () => {
    const viaDefine: any = {};
    defineOwn(viaDefine, "url", "x");
    const viaAssign: any = {};
    viaAssign["url"] = "x";
    expect(Object.getOwnPropertyDescriptor(viaDefine, "url")).toEqual(
      Object.getOwnPropertyDescriptor(viaAssign, "url")!,
    );
  });
});

// CodeQL alert 929 (`js/prototype-pollution-utility`) named a real gap rather than a false
// positive: `defineOwn` is exported, and `defineProperty` makes the KEY inert without making
// the TARGET safe. `setNestedProperty` refused this one level up; the exported helper did not.
describe("defineOwn refuses a prototype object as its CONTAINER (alert 929)", () => {
  test("Object.prototype is refused", () => {
    expect(() => defineOwn(Object.prototype, "polluted929", "yes")).toThrow(/prototype object as its container/u);
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "polluted929")).toBe(false);
    expect(({} as Record<string, unknown>)["polluted929"]).toBeUndefined();
  });

  test("a class prototype is refused", () => {
    class Widget {}
    expect(() => defineOwn(Widget.prototype, "polluted929b", 1)).toThrow(/prototype object as its container/u);
    expect(new Widget() as unknown as Record<string, unknown>).not.toHaveProperty("polluted929b");
  });

  test("an ordinary object is still accepted, and __proto__ is still inert", () => {
    // The pre-existing property must survive the new guard: the guard is on the container,
    // the falsifier varies the key.
    const target: Record<string, unknown> = {};
    defineOwn(target, "__proto__", { polluted: "no" });
    expect(Object.prototype.hasOwnProperty.call(target, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
  });

  test("Object.create(null) is NOT a prototype object and is accepted", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    defineOwn(bare, "k", 1);
    expect(bare["k"]).toBe(1);
  });
});
