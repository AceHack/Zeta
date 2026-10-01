// Falsifier: the `cilium` Application renders NO Service of type LoadBalancer.
//
// WHY THIS EXISTS. `ingressController.enabled: true` rendered Service
// kube-system/cilium-ingress as `type: LoadBalancer`. ArgoCD's Service health is
// Progressing until `status.loadBalancer.ingress` is populated, which needs a Cilium
// LB-IPAM pool, and the pool is INSTALL-TIME configuration that is legitimately absent
// when the operator supplied no range (docs/ops/INSTALL-TIME-CONFIG.md row 3). So the
// CNI's own Application sat at Synced+Progressing -- every pod Running -- on every
// install without a range, and the roster lanes (k3d run 35924216557, the first-boot
// replica run 36831938019, WP11 run 36832486494) all carried it as "unconverged".
//
// Nothing in the tree uses the Ingress surface: exposure is Gateway API, no Ingress of
// class `cilium` exists, and every chart that could render one has it off. The Service was
// an address spent on a listener nobody dials.
//
// TWO HALVES.
//   A. hermetic -- the value is false in BOTH the ArgoCD Application and the first-boot
//      HelmChart that shares its Helm release, and the two agree (a mismatch is two
//      reconcilers flipping one flag).
//   B. the chart render (helm on PATH; SKIPPED LOUDLY otherwise, never silently passed) --
//      the real chart at the pinned version, with this Application's real valuesObject,
//      emits no LoadBalancer Service. This is the half that bites: half A passes if the key
//      is misspelled (`ingresscontroller`) or the chart renames it, B does not.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { discoverApplications, renderApplication } from "./rendered-storage-claims.ts";

const REPO = join(import.meta.dir, "..", "..", "..");
const APPLICATION = join(REPO, "full-ai-cluster/k8s/applications/cilium/Application.yaml");
const BOOTSTRAP = join(REPO, "full-ai-cluster/k8s/bootstrap/cilium-install.yaml");

type Json = Record<string, unknown>;

function dig(root: unknown, ...path: string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Json)[key];
  }
  return cur;
}

function applicationValues(): Json {
  const doc = parseYaml(readFileSync(APPLICATION, "utf8")) as Json;
  return dig(doc, "spec", "source", "helm", "valuesObject") as Json;
}

function bootstrapValues(): Json {
  const doc = parseYaml(readFileSync(BOOTSTRAP, "utf8")) as Json;
  const content = dig(doc, "spec", "valuesContent");
  if (typeof content !== "string") throw new Error("cilium-install.yaml carries no spec.valuesContent string");
  return parseYaml(content) as Json;
}

describe("A. cilium ingress controller is off, in both places that install the release", () => {
  test("the ArgoCD Application sets ingressController.enabled to the literal false", () => {
    expect(dig(applicationValues(), "ingressController", "enabled")).toBe(false);
  });

  test("the first-boot HelmChart sets it to the literal false", () => {
    expect(dig(bootstrapValues(), "ingressController", "enabled")).toBe(false);
  });

  test("the two agree on the whole ingressController block (they share one Helm release)", () => {
    expect(dig(bootstrapValues(), "ingressController")).toEqual(dig(applicationValues(), "ingressController"));
  });

  test("Gateway API stays on: it is the exposure surface that replaced the ingress", () => {
    expect(dig(applicationValues(), "gatewayAPI", "enabled")).toBe(true);
    expect(dig(bootstrapValues(), "gatewayAPI", "enabled")).toBe(true);
  });
});

const HELM = Bun.spawnSync(["sh", "-c", "command -v helm"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
if (!HELM) console.warn("cilium-ingress-disabled.test: helm not on PATH -- the chart-render half is SKIPPED, not passed");

describe.skipIf(!HELM)("B. the cilium chart render", () => {
  const T = { timeout: 300_000 };

  function renderCilium(): { documents: readonly Json[]; cleanup: () => void } {
    const source = discoverApplications().find((a) => a.appId === "full-ai-cluster/cilium");
    if (source === undefined) throw new Error("cilium Application not discovered");
    const cacheDir = mkdtempSync(join(tmpdir(), "cilium-ingress-"));
    const result = renderApplication(source, { cacheDir });
    if (!result.ok) {
      rmSync(cacheDir, { recursive: true, force: true });
      throw new Error(`cilium render failed: ${result.reason} ${result.detail}`);
    }
    return { documents: result.documents, cleanup: () => rmSync(cacheDir, { recursive: true, force: true }) };
  }

  test("no Service in the render is type LoadBalancer", () => {
    const { documents, cleanup } = renderCilium();
    try {
      const loadBalancers = documents
        .filter((d) => d["kind"] === "Service" && dig(d, "spec", "type") === "LoadBalancer")
        .map((d) => String(dig(d, "metadata", "name")));
      expect(loadBalancers).toEqual([]);
    } finally {
      cleanup();
    }
  }, T);

  test("the render is not vacuous: the agent, operator and hubble Services are still there", () => {
    const { documents, cleanup } = renderCilium();
    try {
      const services = documents.filter((d) => d["kind"] === "Service").map((d) => String(dig(d, "metadata", "name")));
      expect(services).toContain("hubble-relay");
      expect(services).not.toContain("cilium-ingress");
      expect(documents.some((d) => d["kind"] === "DaemonSet" && dig(d, "metadata", "name") === "cilium")).toBe(true);
    } finally {
      cleanup();
    }
  }, T);
});
