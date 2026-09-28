/**
 * cilium-k3d-values.test.ts — the k3d lane installs the SHIPPED Cilium surface.
 *
 * WHY THIS FILE EXISTS.
 *
 * `bringUpK3dDevCluster` hardcoded a five-value `--set` list. One of those values
 * was `ipam.mode=kubernetes`, against a shipped surface that says `cluster-pool`
 * with an explicit `clusterPoolIPv4PodCIDRList`. Measured on the first live k3d
 * run (2026-08-31): pods landed on `10.42.0.x` — k3s's default cluster-CIDR —
 * and every pod on the overlay failed its probes while Cilium's own pods were
 * 1/1 Running. The passing kind lane on the same commit put pods on `10.143.x`.
 *
 * The defect was NOT that the lane was red. It was that the provider closest to
 * metal was installing the CNI configuration furthest from metal, so a green run
 * would have proven nothing about what hardware boots. Nothing could notice,
 * because no check compared the two.
 *
 * These are structural assertions on the value surface, deliberately not a
 * cluster test: they cost milliseconds and run in the ordinary suite.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ciliumK3dValues, ciliumKindValues, readCiliumValueSurfaces } from "./cilium-kind-lane.ts";
import type { Json } from "./cilium-kind-lane.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const USE_CASES = join(REPO_ROOT, "src", "Core.TypeScript", "cluster", "dev-cluster", "use-cases.ts");

/** Source with block and line comments removed, so an assertion about CODE cannot be satisfied — or defeated — by prose. */
function codeWithoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function shippedCilium(): Readonly<Record<string, Json>> {
  const shipped = readCiliumValueSurfaces(REPO_ROOT).find((s) => s.path.includes("applications/cilium/"))?.values;
  if (shipped === undefined) throw new Error("shipped Cilium surface not found — this test is stale, not passing");
  return shipped;
}

/** The keys that decide how packets actually move. Divergence here is not cosmetic. */
const DATAPATH_KEYS = [
  "ipam",
  "routingMode",
  "ipv4NativeRoutingCIDR",
  "autoDirectNodeRoutes",
  "bpf",
  "l2announcements",
  "cluster",
  "kubeProxyReplacement",
] as const;

describe("the k3d lane installs metal's Cilium configuration", () => {
  test("every datapath key is the shipped value, byte-for-byte", () => {
    const shipped = shippedCilium();
    const { values } = ciliumK3dValues(shipped, "k3d-zeta-ci-server-0");
    for (const key of DATAPATH_KEYS) {
      expect(values[key]).toEqual(shipped[key]);
    }
  });

  test("ipam stays cluster-pool — the exact key whose divergence broke the first run", () => {
    const { values } = ciliumK3dValues(shippedCilium(), "k3d-zeta-ci-server-0");
    const ipam = values["ipam"] as { mode?: string } | undefined;
    expect(ipam?.mode).toBe("cluster-pool");
    expect(JSON.stringify(values)).not.toContain('"mode":"kubernetes"');
  });

  test("exactly ONE delta from shipped, and it is k8sServiceHost", () => {
    const shipped = shippedCilium();
    const { values, deltas } = ciliumK3dValues(shipped, "k3d-zeta-ci-server-0");
    expect(deltas.map((d) => d.path)).toEqual(["k8sServiceHost"]);
    const changed = Object.keys({ ...shipped, ...values }).filter(
      (k) => JSON.stringify(values[k]) !== JSON.stringify(shipped[k]),
    );
    expect(changed).toEqual(["k8sServiceHost"]);
  });

  test("the delta carries a reason that names BOTH sides of the substitution", () => {
    // A length threshold was the first draft and it was VACUOUS: the reason is
    // built from concatenated string fragments, so deleting one still cleared
    // 80 characters and the mutation survived. Assert the CONTENT instead —
    // the reason has to say what resolves the name on metal and what resolves
    // it here, which is the only thing that makes a delta reviewable.
    const [delta] = ciliumK3dValues(shippedCilium(), "k3d-zeta-ci-server-0").deltas;
    const reason = delta?.reason ?? "";
    expect(reason).toContain("control-plane");
    expect(reason).toContain("k3s-server.nix");
    expect(reason).toContain("k3d");
  });

  test("k3d and kind take the SAME single delta — neither is the odd one out", () => {
    const shipped = shippedCilium();
    expect(ciliumK3dValues(shipped, "k3d-zeta-ci-server-0").deltas.map((d) => d.path)).toEqual(
      ciliumKindValues(shipped, "zeta-ci-cilium").deltas.map((d) => d.path),
    );
  });

  test("the k3d bring-up reads the surface and does not hand-write --set values", () => {
    // CODE ONLY, comments stripped. The first draft of this test grepped raw
    // source and failed on the fix's own explanatory comment, which quotes the
    // literal it forbids. A check that cannot tell code from prose would also
    // pass if someone left the values in a commented-out block and re-enabled
    // it later, so stripping is the stricter reading as well as the working one.
    const code = codeWithoutComments(readFileSync(USE_CASES, "utf8"));
    expect(code).toContain("ciliumK3dValues");
    // The exact literals the old hardcoded list carried. Their return is the regression.
    expect(code).not.toContain("ipam.mode=kubernetes");
    expect(code).not.toContain("hubble.relay.enabled=false");
    expect(code).not.toContain("kubeProxyReplacement=true");
  });

  test("ArgoCD is ClusterIP on BOTH providers — one host port 80 cannot serve two LoadBalancers", () => {
    // The shipped Cilium values enable `ingressController`, which creates a
    // LoadBalancer Service. Metal disables k3s servicelb so Cilium owns L4;
    // k3d now matches that flag. ClusterIP remains the ArgoCD type so a
    // re-enable of klipper cannot collide on host :80/:443 -- measured
    // 2026-08-31, the run after the CNI was corrected.
    const code = codeWithoutComments(readFileSync(USE_CASES, "utf8"));
    expect(code).not.toContain("server.service.type=LoadBalancer");
    // Both installs now share ONE list (ARGOCD_HELM_SET_VALUES, 2026-09-28), so
    // the literal appears once and the list is spread at both call sites.
    expect(code.match(/server\.service\.type=ClusterIP/g)?.length ?? 0).toBe(1);
    expect(code.match(/setValues: \[\.\.\.ARGOCD_HELM_SET_VALUES\]/g)?.length ?? 0).toBe(2);
  });

  test("both helm installs read the Application pin — a restated chart version would desync ArgoCD adopt", () => {
    const code = codeWithoutComments(readFileSync(USE_CASES, "utf8"));
    expect((code.match(/shippedCiliumChartVersion\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(code).not.toMatch(/version:\s*"1\.16\.\d+"/);
  });

  test("the k3d bring-up points CoreDNS at a reachable upstream — 127.0.0.11 is not one", () => {
    // MEASURED: k3s's Corefile ends `forward . /etc/resolv.conf`, and inside a
    // k3d node that file names Docker's embedded resolver 127.0.0.11 -- which,
    // from a POD netns, is the pod's own loopback. Cluster names still resolve
    // (the `kubernetes` plugin answers locally), so the cluster looks healthy
    // while every external name fails. That is what stopped ArgoCD's repo-server
    // fetching github.com for three runs.
    const code = codeWithoutComments(readFileSync(USE_CASES, "utf8"));
    // SCOPED TO THE K3D BRING-UP BODY, not the whole file. The first version of
    // this assertion searched the file for the function NAME and therefore
    // matched its own DEFINITION -- so deleting the CALL SITE left it green.
    // Existence is not invocation.
    const k3dBody = code.slice(
      code.indexOf("export function bringUpK3dDevCluster"),
      code.indexOf("export function tearDownK3dDevCluster"),
    );
    expect(k3dBody).toContain("applyK3dCoreDnsUpstreamOverride(ports)");
    expect(k3dBody).toContain("applyVendoredGatewayApiCrds(ports)");
    expect(k3dBody).toContain("applyK3dControlPlaneHostsAlias(ports, options.kubeApiHost)");
    expect(k3dBody).toContain("waitForAllNodesReady(180)");
    expect(k3dBody).not.toContain("gateway-api/releases/download");
    expect(code).toContain("coredns-custom");
    // The restart must be a REAL call. The first draft used
    // `controlPlane.restartDeployment?.()` -- a method absent from that
    // interface, so the optional-call compiled and did nothing.
    expect(code).not.toContain("restartDeployment");
    expect(code).toContain("rollout");
  });

  test("the override is k3d's coredns-custom — kindnetd must not get it, kind+Cilium patches the kubeadm Corefile", () => {
    const src = readFileSync(USE_CASES, "utf8");
    const kindFn = src.slice(src.indexOf("export function bringUpKindCiCluster"), src.indexOf("export function tearDownKindCluster"));
    expect(kindFn).not.toContain("applyK3dCoreDnsUpstreamOverride");
    expect(kindFn).not.toContain("applyK3dControlPlaneHostsAlias");
    expect(kindFn).toContain("applyKindCiliumCoreDnsUpstreamOverride(ports)");
    expect(kindFn).toContain("applyVendoredGatewayApiCrds(ports)");
  });

  test("a missing surface REFUSES rather than falling back to chart defaults", () => {
    const code = codeWithoutComments(readFileSync(USE_CASES, "utf8"));
    expect(code).toContain("refusing to invent values");
  });
});
