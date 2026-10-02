// Falsifier: the ESSENTIAL tier runs above everything optional.
//
// WHY THIS EXISTS. WP11 run 36832486494 put the committed (`metal`) tree on a 4 vCPU /
// 12 GiB guest: requested CPU is 9122m against 3250m allocatable and requested memory
// 21822 Mi against 9228 Mi (rendered-resource-requests.snapshot.json, the WP11 envelope).
// A node that is over-committed 2-3x fills in sync-wave order and leaves the rest Pending,
// and every workload ran at the SAME priority 0, so nothing said which Pending pod was
// allowed to displace which running one. A real node under pressure must shed the optional
// apps first -- never the GitOps controller, the certificate and secret admission webhooks, the
// CNI, the storage layer or the databases.
//
// THE MECHANISM IS DELIBERATELY THE BUILT-IN CLASS. `system-cluster-critical` exists on
// every substrate (k3s, kind, k3d, metal), so a pod that names it can never be rejected for a
// missing PriorityClass -- which a custom class applied by ArgoCD could be, for the bootstrap
// charts that start BEFORE ArgoCD does. It is above every optional workload (priority 0), and
// the kubelet does not evict critical pods under node pressure. Cilium (system-node-critical /
// system-cluster-critical), Longhorn (`longhorn-critical`), Gatekeeper and CoreDNS already
// carry a class from their own charts; this file covers the ones that did not.
//
// THREE LEVELS, because each one rots separately:
//   A. the values coordinate is set, in the Application AND in the first-boot HelmChart that
//      shares its release (a mismatch is two reconcilers flipping one value);
//   B. the pinned chart ACCEPTS that coordinate -- the helm-gated render shows the class on
//      every long-running pod. A passes with a misspelt key; B does not.
//   C. the Postgres Clusters (custom resources, which `helm template` never sees) carry
//      `spec.priorityClassName`.
//
// B is helm-gated and SKIPPED LOUDLY, never silently passed.

import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, parseAllDocuments } from "yaml";
import { discoverApplications, renderApplication } from "./rendered-storage-claims.ts";

const REPO = join(import.meta.dir, "..", "..", "..");
const APPS = join(REPO, "full-ai-cluster/k8s/applications");
const BOOTSTRAP = join(REPO, "full-ai-cluster/k8s/bootstrap");

const ESSENTIAL = "system-cluster-critical";

type Json = Record<string, unknown>;

function dig(root: unknown, path: readonly string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Json)[key];
  }
  return cur;
}

interface EssentialApp {
  /** Directory under full-ai-cluster/k8s/applications. */
  readonly dir: string;
  /** Dotted values coordinates that must equal ESSENTIAL in the Application's valuesObject. */
  readonly coordinates: readonly string[];
  /** The first-boot HelmChart file that shares this release, if one exists. */
  readonly bootstrap?: string;
  /**
   * Workloads the render must prove carry the class. `"all"` = every Deployment, StatefulSet
   * and DaemonSet; otherwise the exact names (a chart whose web tier is deliberately optional).
   */
  readonly workloads: "all" | readonly string[];
}

const ESSENTIAL_APPS: readonly EssentialApp[] = [
  { dir: "argocd", coordinates: ["global.priorityClassName"], bootstrap: "argocd-install.yaml", workloads: "all" },
  { dir: "cert-manager", coordinates: ["global.priorityClassName"], bootstrap: "cert-manager-install.yaml", workloads: "all" },
  { dir: "trust-manager", coordinates: ["priorityClassName"], bootstrap: "trust-manager-install.yaml", workloads: "all" },
  {
    dir: "external-secrets",
    coordinates: ["priorityClassName", "webhook.priorityClassName", "certController.priorityClassName"],
    bootstrap: "external-secrets-install.yaml",
    workloads: "all",
  },
  { dir: "sealed-secrets", coordinates: ["priorityClassName"], workloads: "all" },
  { dir: "cloudnativepg", coordinates: ["priorityClassName"], workloads: "all" },
  { dir: "cnpg-barman-cloud", coordinates: ["priorityClassName"], workloads: "all" },
  {
    // GitLab's STATE is essential; its web, sidekiq and registry tiers are not. Its PostgreSQL and Redis are no longer
    // the chart's subcharts (they left with the 17.7 -> 19.4 upgrade): the Valkey StatefulSet is an extraObject that renders
    // with the class, and the CNPG Cluster is checked in section C below.
    dir: "gitlab",
    coordinates: ["gitlab.gitaly.priorityClassName"],
    workloads: ["gitlab-gitaly", "gitlab-valkey"],
  },
];

/** CNPG Clusters: custom resources the operator turns into pods, invisible to `helm template`. */
const POSTGRES_CLUSTERS: readonly { readonly file: string; readonly name: string }[] = [
  { file: "postgres-shared/cluster.yaml", name: "postgres-shared" },
  { file: "temporal/postgres/cluster.yaml", name: "temporal-postgres" },
];

function applicationValues(dir: string): Json {
  const doc = parseYaml(readFileSync(join(APPS, dir, "Application.yaml"), "utf8")) as Json;
  const values = dig(doc, ["spec", "source", "helm", "valuesObject"]);
  if (typeof values !== "object" || values === null) throw new Error(`${dir}: no helm valuesObject`);
  return values as Json;
}

function bootstrapValues(file: string): Json {
  for (const doc of parseAllDocuments(readFileSync(join(BOOTSTRAP, file), "utf8"))) {
    const obj = doc.toJS() as Json | null;
    if (obj?.["kind"] !== "HelmChart") continue;
    const content = dig(obj, ["spec", "valuesContent"]);
    if (typeof content !== "string") throw new Error(`${file}: HelmChart without valuesContent`);
    return parseYaml(content) as Json;
  }
  throw new Error(`${file}: no HelmChart document`);
}

describe("A. the essential tier's values coordinates", () => {
  test("the class is a built-in one, so no substrate can reject a pod for lacking it", () => {
    expect(["system-cluster-critical", "system-node-critical"]).toContain(ESSENTIAL);
  });

  for (const app of ESSENTIAL_APPS) {
    test(`${app.dir}: every coordinate in the Application equals ${ESSENTIAL}`, () => {
      const values = applicationValues(app.dir);
      for (const coordinate of app.coordinates) {
        expect([coordinate, dig(values, coordinate.split("."))]).toEqual([coordinate, ESSENTIAL]);
      }
    });

    if (app.bootstrap !== undefined) {
      const file = app.bootstrap;
      test(`${app.dir}: the first-boot HelmChart ${file} sets the same coordinates to the same class`, () => {
        const boot = bootstrapValues(file);
        for (const coordinate of app.coordinates) {
          expect([coordinate, dig(boot, coordinate.split("."))]).toEqual([coordinate, ESSENTIAL]);
        }
      });
    }
  }
});

describe("C. the Postgres Clusters carry the class on the custom resource", () => {
  test("gitlab-rails-db: spec.priorityClassName is the essential class (a Cluster declared in the gitlab release's extraObjects)", () => {
    const extra = dig(applicationValues("gitlab"), ["gitlab-runner", "extraObjects"]);
    expect(Array.isArray(extra)).toBe(true);
    const found = (extra as Json[]).find((d) => d?.["kind"] === "Cluster" && dig(d, ["metadata", "name"]) === "gitlab-rails-db");
    expect(found).toBeDefined();
    expect(dig(found, ["spec", "priorityClassName"])).toBe(ESSENTIAL);
  });

  for (const cluster of POSTGRES_CLUSTERS) {
    test(`${cluster.name}: spec.priorityClassName is ${ESSENTIAL}`, () => {
      const docs = parseAllDocuments(readFileSync(join(APPS, cluster.file), "utf8")).map((d) => d.toJS() as Json | null);
      const found = docs.find((d) => d?.["kind"] === "Cluster" && dig(d, ["metadata", "name"]) === cluster.name);
      expect(found).toBeDefined();
      expect(dig(found, ["spec", "priorityClassName"])).toBe(ESSENTIAL);
    });
  }
});

const HELM = Bun.spawnSync(["sh", "-c", "command -v helm"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
if (!HELM) console.warn("essential-priority.test: helm not on PATH -- the chart-render half is SKIPPED, not passed");

describe.skipIf(!HELM)("B. the pinned charts ACCEPT the coordinate: every long-running pod carries the class", () => {
  const T = { timeout: 600_000 };
  const WORKLOAD_KINDS = new Set(["Deployment", "StatefulSet", "DaemonSet"]);
  const cacheDir = mkdtempSync(join(tmpdir(), "essential-priority-"));
  const sources = discoverApplications();

  for (const app of ESSENTIAL_APPS) {
    test(`${app.dir}: ${app.workloads === "all" ? "every workload" : app.workloads.join(", ")}`, () => {
      const source = sources.find((s) => s.appId === `full-ai-cluster/${app.dir}`);
      if (source === undefined) throw new Error(`${app.dir} not discovered`);
      const result = renderApplication(source, { cacheDir });
      if (!result.ok) throw new Error(`${app.dir} render failed: ${result.reason} ${result.detail}`);
      const workloads = result.documents.filter((d) => WORKLOAD_KINDS.has(String(d["kind"])));
      const named = (d: Json) => String(dig(d, ["metadata", "name"]));
      const governed = app.workloads === "all" ? workloads : workloads.filter((d) => (app.workloads as readonly string[]).includes(named(d)));
      // Not vacuous: a renamed workload must not silently shrink the set to nothing.
      expect(governed.length).toBeGreaterThan(0);
      if (app.workloads !== "all") expect(governed.map(named).sort()).toEqual([...app.workloads].sort());
      const classes = governed.map((d) => [`${String(d["kind"])}/${named(d)}`, dig(d, ["spec", "template", "spec", "priorityClassName"])]);
      expect(classes.filter(([, cls]) => cls !== ESSENTIAL)).toEqual([]);
    }, T);
  }

  afterAll(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });
});
