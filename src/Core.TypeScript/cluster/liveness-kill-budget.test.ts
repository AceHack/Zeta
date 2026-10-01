/**
 * Falsifiers for `liveness-kill-budget.ts`.
 *
 * Two halves, same split as `crd-provider-consumer-order.test.ts`:
 *
 *   A. SYNTHETIC. The kill-budget arithmetic, the container walk, and the
 *      classification/allowlist logic, driven on hand-built fixtures -- no
 *      `helm` needed, so this half runs everywhere `bun test` runs.
 *   B. THE LIVE TREE. Requires `helm` on PATH (skipped, loudly, otherwise --
 *      never silently green). Proves the real catalog has zero
 *      UNACKNOWLEDGED findings -- the same assertion `.github/workflows/
 *      helm-validate.yml` makes by running the script directly, restated as
 *      a `bun test` so a regression reports as a structured failure rather
 *      than a bare non-zero exit code.
 */

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_KILL_BUDGET_THRESHOLD_SECONDS,
  KILL_BUDGET_ALLOWLIST,
  STALL_TOLERANCE_FLOORS,
  collectContainers,
  formatTable,
  needsStartupProbe,
  probeKillBudgetSeconds,
  probeStallToleranceSeconds,
  probeTimeoutSeconds,
  stallToleranceViolations,
  summarizeDoc,
  unacknowledgedFindings,
  type AuditResult,
  type ContainerProbeSummary,
} from "./liveness-kill-budget.ts";

// ---------------------------------------------------------------------------
// A. Synthetic
// ---------------------------------------------------------------------------

describe("probeKillBudgetSeconds", () => {
  test("the hindsight `api` DEFECT before WP15's fix: 30 + (3-1)*10 = 50s", () => {
    expect(
      probeKillBudgetSeconds({ httpGet: { path: "/health/live" }, initialDelaySeconds: 30, periodSeconds: 10, failureThreshold: 3 }),
    ).toBe(50);
  });

  test("the hindsight `api` FIX: 30 + (30-1)*10 = 320s", () => {
    expect(
      probeKillBudgetSeconds({ httpGet: { path: "/health/live" }, initialDelaySeconds: 30, periodSeconds: 10, failureThreshold: 30 }),
    ).toBe(320);
  });

  test("no probe at all -- null, not zero (absence is not a zero-second budget)", () => {
    expect(probeKillBudgetSeconds(undefined)).toBeNull();
    expect(probeKillBudgetSeconds(null)).toBeNull();
  });

  test("missing fields fall back to the Kubernetes API defaults (periodSeconds:10, failureThreshold:3, initialDelaySeconds:0)", () => {
    expect(probeKillBudgetSeconds({})).toBe(20); // 0 + (3-1)*10
  });

  test("a malformed probe (non-positive period or threshold) is refused as null, not silently treated as safe", () => {
    expect(probeKillBudgetSeconds({ periodSeconds: 0, failureThreshold: 3 })).toBeNull();
    expect(probeKillBudgetSeconds({ periodSeconds: 10, failureThreshold: 0 })).toBeNull();
    expect(probeKillBudgetSeconds({ periodSeconds: -5, failureThreshold: 3 })).toBeNull();
  });

  test("a probe object that is actually an array or a string is not a probe", () => {
    expect(probeKillBudgetSeconds([])).toBeNull();
    expect(probeKillBudgetSeconds("tcpSocket")).toBeNull();
  });
});

describe("collectContainers", () => {
  test("finds a container nested under Deployment.spec.template.spec.containers", () => {
    const doc = {
      kind: "Deployment",
      spec: { template: { spec: { containers: [{ name: "api", image: "x:1" }] } } },
    };
    expect(collectContainers(doc)).toEqual([{ name: "api", image: "x:1" }]);
  });

  test("finds initContainers too -- no pod-kind-specific path table to keep in sync", () => {
    const doc = {
      kind: "Deployment",
      spec: {
        template: {
          spec: {
            initContainers: [{ name: "migrate", image: "x:1" }],
            containers: [{ name: "api", image: "x:2" }],
          },
        },
      },
    };
    const names = collectContainers(doc).map((c) => c.name).sort();
    expect(names).toEqual(["api", "migrate"]);
  });

  test("finds a container under a CronJob's deeper nesting without any CronJob-specific code", () => {
    const doc = {
      kind: "CronJob",
      spec: { jobTemplate: { spec: { template: { spec: { containers: [{ name: "job", image: "x:1" }] } } } } },
    };
    expect(collectContainers(doc).map((c) => c.name)).toEqual(["job"]);
  });

  test("an object with `name` but no `image` is not a container (e.g. a named volume or port)", () => {
    const doc = { spec: { volumes: [{ name: "data" }] } };
    expect(collectContainers(doc)).toEqual([]);
  });
});

describe("summarizeDoc", () => {
  test("a Service (no pod template) summarizes to zero containers", () => {
    expect(summarizeDoc("app", { kind: "Service", metadata: { name: "svc" }, spec: { ports: [] } })).toEqual([]);
  });

  test("a doc missing kind or metadata.name summarizes to zero containers rather than throwing", () => {
    expect(summarizeDoc("app", { spec: {} })).toEqual([]);
    expect(summarizeDoc("app", { kind: "Deployment", spec: {} })).toEqual([]);
    expect(summarizeDoc("app", null)).toEqual([]);
    expect(summarizeDoc("app", "not an object")).toEqual([]);
  });

  test("reports hasLiveness/hasReadiness/hasStartup independently and computes the kill budget from liveness alone", () => {
    const doc = {
      kind: "Deployment",
      metadata: { name: "d", namespace: "ns" },
      spec: {
        template: {
          spec: {
            containers: [
              {
                name: "api",
                image: "x:1",
                livenessProbe: { initialDelaySeconds: 0, periodSeconds: 10, failureThreshold: 3 },
                readinessProbe: { initialDelaySeconds: 0, periodSeconds: 5, failureThreshold: 3 },
              },
            ],
          },
        },
      },
    };
    const [c] = summarizeDoc("myapp", doc);
    expect(c).toEqual({
      app: "myapp",
      kind: "Deployment",
      resource: "d",
      namespace: "ns",
      container: "api",
      hasLiveness: true,
      hasReadiness: true,
      hasStartup: false,
      killBudgetSeconds: 20,
      livenessTimeoutSeconds: 1,
      stallToleranceSeconds: 21,
    });
  });
});

describe("probeStallToleranceSeconds / probeTimeoutSeconds -- the steady-state axis", () => {
  test("k3s's packaged CoreDNS BEFORE the floor fix: (3-1)*10 + 1 = 21s -- killed on dispatch 36119931377", () => {
    const k3sCoreDns = { initialDelaySeconds: 60, periodSeconds: 10, timeoutSeconds: 1, failureThreshold: 3 };
    expect(probeStallToleranceSeconds(k3sCoreDns)).toBe(21);
    expect(probeTimeoutSeconds(k3sCoreDns)).toBe(1);
  });

  test("upstream Kubernetes' CoreDNS shape (the floor fix): (5-1)*10 + 5 = 45s", () => {
    expect(probeStallToleranceSeconds({ initialDelaySeconds: 60, periodSeconds: 10, timeoutSeconds: 5, failureThreshold: 5 })).toBe(45);
  });

  test("initialDelaySeconds does NOT enter the steady-state axis -- that is the startup budget's job", () => {
    const a = probeStallToleranceSeconds({ initialDelaySeconds: 0, periodSeconds: 10, failureThreshold: 3 });
    const b = probeStallToleranceSeconds({ initialDelaySeconds: 600, periodSeconds: 10, failureThreshold: 3 });
    expect(a).toBe(b);
  });

  test("an absent timeoutSeconds is the Kubernetes default 1s, not zero and not 'unknown'", () => {
    expect(probeTimeoutSeconds({})).toBe(1);
    expect(probeStallToleranceSeconds({})).toBe(21); // (3-1)*10 + 1
  });

  test("no probe is null; a malformed one (non-positive timeout/period/threshold) is refused as null", () => {
    expect(probeStallToleranceSeconds(undefined)).toBeNull();
    expect(probeTimeoutSeconds(undefined)).toBeNull();
    expect(probeStallToleranceSeconds({ timeoutSeconds: 0 })).toBeNull();
    expect(probeStallToleranceSeconds({ periodSeconds: 0 })).toBeNull();
    expect(probeStallToleranceSeconds({ failureThreshold: 0 })).toBeNull();
  });

  test("keda's 3 -> 20 widening moved this axis too: (20-1)*10 + 1 = 191s", () => {
    // keda-operator logged liveness FAILURES on 36119931377 but was not among the 28 killed.
    expect(probeStallToleranceSeconds({ periodSeconds: 10, failureThreshold: 20 })).toBe(191);
  });
});

function container(overrides: Partial<ContainerProbeSummary>): ContainerProbeSummary {
  return {
    app: "app",
    kind: "Deployment",
    resource: "app",
    namespace: "app",
    container: "app",
    hasLiveness: true,
    hasReadiness: true,
    hasStartup: false,
    killBudgetSeconds: 50,
    livenessTimeoutSeconds: 1,
    stallToleranceSeconds: 21,
    ...overrides,
  };
}

describe("needsStartupProbe", () => {
  test("flags: liveness present, no startup, budget under the threshold", () => {
    expect(needsStartupProbe(container({ killBudgetSeconds: 50 }))).toBe(true);
  });

  test("does not flag: budget at or above the threshold", () => {
    expect(needsStartupProbe(container({ killBudgetSeconds: DEFAULT_KILL_BUDGET_THRESHOLD_SECONDS }))).toBe(false);
    expect(needsStartupProbe(container({ killBudgetSeconds: 500 }))).toBe(false);
  });

  test("does not flag: no liveness probe at all (nothing to widen, nothing killing it early)", () => {
    expect(needsStartupProbe(container({ hasLiveness: false, killBudgetSeconds: null }))).toBe(false);
  });

  test("does not flag: already has a startupProbe (the preferred fix is already in place)", () => {
    expect(needsStartupProbe(container({ hasStartup: true, killBudgetSeconds: 20 }))).toBe(false);
  });

  test("threshold is a parameter, not hardcoded -- a stricter caller-supplied threshold flags more", () => {
    expect(needsStartupProbe(container({ killBudgetSeconds: 100 }), 120)).toBe(true);
    expect(needsStartupProbe(container({ killBudgetSeconds: 100 }), 50)).toBe(false);
  });
});

describe("KILL_BUDGET_ALLOWLIST and unacknowledgedFindings", () => {
  test("every checked-in allowlist entry carries a non-empty reason", () => {
    for (const entry of KILL_BUDGET_ALLOWLIST) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  test("an allowlisted app+container is excluded from unacknowledgedFindings even though it would otherwise flag", () => {
    expect(KILL_BUDGET_ALLOWLIST.length).toBeGreaterThan(0);
    const entry = KILL_BUDGET_ALLOWLIST[0]!;
    const result: AuditResult = {
      containers: [container({ app: entry.app, container: entry.container, killBudgetSeconds: 10 })],
      renderErrors: [],
    };
    expect(unacknowledgedFindings(result)).toEqual([]);
  });

  test("the SAME shape for an app/container NOT on the allowlist IS reported", () => {
    const result: AuditResult = {
      containers: [container({ app: "definitely-not-a-real-app-xyz", container: "c", killBudgetSeconds: 10 })],
      renderErrors: [],
    };
    expect(unacknowledgedFindings(result)).toHaveLength(1);
  });

  test("formatTable marks an allowlisted finding as ALLOWLISTED, not FLAG, and prints its reason", () => {
    const entry = KILL_BUDGET_ALLOWLIST[0]!;
    const result: AuditResult = {
      containers: [container({ app: entry.app, container: entry.container, killBudgetSeconds: 10 })],
      renderErrors: [],
    };
    const table = formatTable(result);
    expect(table).toContain("ALLOWLISTED");
    expect(table).not.toContain("| FLAG |");
  });

  test("formatTable surfaces render errors separately from the container rows", () => {
    const result: AuditResult = { containers: [], renderErrors: [{ app: "broken-app", error: "helm template failed" }] };
    const table = formatTable(result);
    expect(table).toContain("broken-app");
    expect(table).toContain("helm template failed");
  });
});

// ---------------------------------------------------------------------------
// B. The live tree -- requires helm on PATH
// ---------------------------------------------------------------------------

function helmOnPathForTest(): boolean {
  return Bun.spawnSync(["sh", "-c", "command -v helm"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
}

describe("STALL_TOLERANCE_FLOORS / stallToleranceViolations (081M3TS67PE087G0R002ZZ1XYT)", () => {
  const mk = (app: string, container: string, probe: unknown): ContainerProbeSummary =>
    summarizeDoc(app, {
      kind: "Deployment",
      metadata: { name: container },
      spec: { template: { spec: { containers: [{ name: container, image: "x:1", livenessProbe: probe }] } } },
    })[0]!;

  test("the CHART DEFAULT (timeout 1s x 3 failures, 21s) is below every floor -- the defect these floors close", () => {
    const defaults = STALL_TOLERANCE_FLOORS.map((f) =>
      mk(f.app, f.container, { httpGet: { path: "/h", port: 1 }, periodSeconds: 10 }),
    );
    const violations = stallToleranceViolations(defaults);
    expect(violations.length).toBe(STALL_TOLERANCE_FLOORS.length);
    expect(violations.every((v) => v.includes("a running stall of 21s kills it"))).toBe(true);
  });

  test("the widened shape (timeout 5s x 12 failures at 10s = 115s) meets every floor", () => {
    const widened = STALL_TOLERANCE_FLOORS.map((f) =>
      mk(f.app, f.container, { periodSeconds: 10, timeoutSeconds: 5, failureThreshold: 12 }),
    );
    expect(stallToleranceViolations(widened)).toEqual([]);
  });

  test("a floor that names a container the render does not produce is a violation, not a silent pass", () => {
    const v = stallToleranceViolations([], [{ app: "a", container: "b", minStallToleranceSeconds: 10, why: "w" }]);
    expect(v).toEqual(["a/b: NOT FOUND in the render -- the floor did not run (w)"]);
  });

  test("a probe removed outright is reported, not read as infinite tolerance", () => {
    const gone = mk("sealed-secrets", "controller", undefined);
    const v = stallToleranceViolations(
      [gone],
      [{ app: "sealed-secrets", container: "controller", minStallToleranceSeconds: 100, why: "w" }],
    );
    expect(v.length).toBe(1);
    expect(v[0]).toContain("no liveness probe");
  });

  test("a widened container has left the grandfather allowlist (it would otherwise hide a regression)", () => {
    for (const f of STALL_TOLERANCE_FLOORS) {
      if (f.app === "open-policy-agent") continue; // timeout-only widening; startup budget stays short and allowlisted
      expect(KILL_BUDGET_ALLOWLIST.some((e) => e.app === f.app && e.container === f.container)).toBe(false);
    }
  });
});

describe("the live full-ai-cluster catalog", () => {
  const skip = !helmOnPathForTest();
  if (skip) {
    test.skip("SKIPPED -- helm is not on PATH; this suite proves nothing about the real catalog without it", () => {});
  } else {
    test(
      "every container in the real catalog is either safe or acknowledged in KILL_BUDGET_ALLOWLIST",
      () => {
        const { readShippedApplications } = require("./derive-sync-waves.ts") as typeof import("./derive-sync-waves.ts");
        const { auditCatalog } = require("./liveness-kill-budget.ts") as typeof import("./liveness-kill-budget.ts");
        const apps = readShippedApplications();
        const result = auditCatalog(apps);
        expect(result.containers.length).toBeGreaterThan(0); // the render lane actually rendered something
        const findings = unacknowledgedFindings(result);
        if (findings.length > 0) {
          // eslint-disable-next-line no-console
          console.error(formatTable(result));
        }
        expect(findings).toEqual([]);
      },
      300_000,
    );
    test(
      "every stall-tolerance floor holds against the REAL render (the chart default would be 21s)",
      () => {
        const { readShippedApplications } = require("./derive-sync-waves.ts") as typeof import("./derive-sync-waves.ts");
        const { auditCatalog } = require("./liveness-kill-budget.ts") as typeof import("./liveness-kill-budget.ts");
        const result = auditCatalog(readShippedApplications());
        expect(stallToleranceViolations(result.containers)).toEqual([]);
      },
      300_000,
    );
  }
});
