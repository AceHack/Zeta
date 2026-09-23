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
  collectContainers,
  formatTable,
  needsStartupProbe,
  probeKillBudgetSeconds,
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
    });
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
  }
});
