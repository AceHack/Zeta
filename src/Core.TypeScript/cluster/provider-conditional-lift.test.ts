/**
 * provider-conditional-lift.test.ts — a LIFTS WHEN the mechanism can evaluate.
 *
 * WHY THIS FILE EXISTS.
 *
 * `cilium`'s recorded exclusion reason says it lifts when "the app-of-apps
 * included proof runs on that profile, so ArgoCD is reconciling a cluster whose
 * CNI slot Cilium already owns." That became true on 2026-08-31 when the k3d
 * lane went green at `--scope included`.
 *
 * It could not fire. `isExcludedFromIncludedProof` took no provider argument and
 * `discoverExpectedApplications` threaded none, so the condition was unevaluable
 * by the code that enforces it — a promise in prose with no mechanism behind it.
 * That is the vacuity class pointed at an EXIT condition rather than at a check.
 *
 * The other half is `cilium-lb-ipam`, and it is the more interesting one: its
 * lift is CONJUNCTIVE and the second conjunct is measurably FALSE, so it must
 * stay excluded even though its sibling lifted.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlan, discoverExpectedApplications, isExcludedFromIncludedProof, parseArgs } from "./argocd-health-test.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

function included(provider: "kind" | "k3d" | null): readonly string[] {
  return discoverExpectedApplications(REPO_ROOT, provider)
    .filter((a) => !a.excludedFromDev)
    .map((a) => a.dir);
}

describe("cilium lifts when Cilium owns the CNI slot, and only then", () => {
  test("k3d includes cilium — the condition its own reason names", () => {
    expect(included("k3d")).toContain("cilium");
  });

  test("kind default does NOT include cilium — kindnetd already owns the slot", () => {
    expect(included("kind")).not.toContain("cilium");
  });

  test("kind --cni cilium DOES include cilium — same condition, now evaluable on kind", () => {
    expect(
      discoverExpectedApplications(REPO_ROOT, "kind", "cilium")
        .filter((a) => !a.excludedFromDev)
        .map((a) => a.dir),
    ).toContain("cilium");
  });

  test("kind --cni cilium asserts weaviate; kindnetd and k3d do not", () => {
    // MEASURED run 33697305243: both weaviate LoadBalancer Services got IPs
    // from zeta-lb-pool. kindnetd has no LB. k3d does not apply the kind alias.
    expect(included("kind")).not.toContain("weaviate");
    expect(included("k3d")).not.toContain("weaviate");
    expect(
      discoverExpectedApplications(REPO_ROOT, "kind", "cilium")
        .filter((a) => !a.excludedFromDev)
        .map((a) => a.dir),
    ).toContain("weaviate");
  });

  test("an UNKNOWN provider lifts nothing — absence of information is not permission", () => {
    expect(included(null)).not.toContain("cilium");
  });

  test("the lift is the ONLY difference k3d makes to the roster", () => {
    const k3d = new Set(included("k3d"));
    const kind = new Set(included("kind"));
    const onlyK3d = [...k3d].filter((d) => !kind.has(d));
    const onlyKind = [...kind].filter((d) => !k3d.has(d));
    expect(onlyK3d).toEqual(["cilium"]);
    expect(onlyKind).toEqual([]);
  });

  test("kind --cni cilium matches the k3d roster plus weaviate", () => {
    // k3d and kind --cni cilium share the CNI-slot lift for `cilium`.
    // weaviate is an extra on kind --cni cilium only: MEASURED run 33697305243
    // assigned both LoadBalancer Services from zeta-lb-pool. k3d does not
    // apply that kind alias, so weaviate stays deferred there.
    const k3d = included("k3d");
    const kindCilium = discoverExpectedApplications(REPO_ROOT, "kind", "cilium")
      .filter((a) => !a.excludedFromDev)
      .map((a) => a.dir);
    const onlyKindCilium = kindCilium.filter((dir) => !k3d.includes(dir));
    const onlyK3d = k3d.filter((dir) => !kindCilium.includes(dir));
    expect(onlyKindCilium).toEqual(["weaviate"]);
    expect(onlyK3d).toEqual([]);
  });
});

describe("cilium-lb-ipam stays excluded — half a conjunction is not a condition", () => {
  test("it is excluded on EVERY provider, including k3d", () => {
    for (const p of ["k3d", "kind", null] as const) {
      expect(included(p)).not.toContain("cilium-lb-ipam");
    }
    expect(
      discoverExpectedApplications(REPO_ROOT, "kind", "cilium")
        .filter((a) => !a.excludedFromDev)
        .map((a) => a.dir),
    ).not.toContain("cilium-lb-ipam");
  });

  test("the unmet conjunct is REAL and checkable: the metal pool is install-time, so this Application has none to apply", () => {
    // This used to read: "the pool is parameterised per substrate rather than pinned to one
    // maintainer's subnet" -- measurably false (ip-pool.yaml pinned 192.168.1.240-250), so
    // the lift must not fire. The pin is gone (docs/ops/INSTALL-TIME-CONFIG.md row 3): the
    // range is now resolved by the installer and applied by a SEPARATE Application
    // (`cilium-lb-ipam-pool`) that exists only on a node that was given one. The
    // conjunct's WORDING is now true and the conclusion is unchanged: lifting
    // `cilium-lb-ipam` on a dev substrate would apply only an L2 policy for a pool that is
    // not there, and the kind alias below is what provides a pool where one can exist.
    // The exclusion's evidence is now "no pool in git" - stronger than "a pinned pool",
    // because editing the pinned range to another subnet cannot satisfy it.
    const dir = join(REPO_ROOT, "full-ai-cluster/k8s/applications/cilium-lb-ipam");
    expect(existsSync(join(dir, "ip-pool.yaml"))).toBe(false);
    for (const f of ["Application.yaml", "l2-policy.yaml"]) {
      const body = readFileSync(join(dir, f), "utf8")
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("#"))
        .join("\n");
      expect(body).not.toMatch(/192\.168\.\d+\.\d+/);
      expect(body).not.toContain("CiliumLoadBalancerIPPool");
    }
  });

  test("the kind bring-up alias is not a lift of this Application", () => {
    // A pool that is not 192.168.1.x exists. That is the testing substrate.
    // It is not this Application, and lifting this Application would selfHeal
    // the metal range over it.
    const alias = readFileSync(
      join(REPO_ROOT, "full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml"),
      "utf8",
    );
    expect(alias).toContain("kind: CiliumLoadBalancerIPPool");
    expect(alias).toContain('start: "172.18.255.200"');
    expect(alias).not.toMatch(/start:\s*"192\.168\.1\./);
    expect(alias).not.toMatch(/stop:\s*"192\.168\.1\./);
    expect(
      discoverExpectedApplications(REPO_ROOT, "kind", "cilium")
        .filter((a) => !a.excludedFromDev)
        .map((a) => a.dir),
    ).not.toContain("cilium-lb-ipam");
  });
});

describe("the default is conservative", () => {
  test("isExcludedFromIncludedProof with no provider behaves exactly as before", () => {
    // Same call shape the 16 repo-level call sites use.
    expect(isExcludedFromIncludedProof("cilium", "", join(REPO_ROOT, "full-ai-cluster/k8s/applications/cilium"))).toBe(
      true,
    );
  });
});

describe("the provider actually REACHES the plan — the wiring, not just the predicate", () => {
  // M4 OF THE MUTATION SUITE SURVIVED WITHOUT THIS. Every test above calls
  // `discoverExpectedApplications` directly, so deleting `options.provider` from
  // `buildPlan` broke nothing: the lift worked in isolation and never reached
  // production. A capability with no consumer is the same defect as a lift
  // condition nothing evaluates, one layer up.
  function planIncluded(provider: string): readonly string[] {
    // `parseArgs` returns `CliOptions | Failure` DIRECTLY, discriminated by
    // `"kind" in x` — not a `{ok, value}` wrapper. My first draft assumed the
    // wrapper and all three tests failed identically in the control, which is
    // the tell that the TEST was wrong rather than the code.
    const parsed = parseArgs(["--dry-run", "--provider", provider, "--scope", "included"], {});
    if ("kind" in parsed) throw new Error(`parseArgs rejected a valid argv: ${parsed.message}`);
    const plan = buildPlan(parsed, REPO_ROOT);
    if ("kind" in plan) throw new Error(`buildPlan failed: ${plan.message}`);
    return plan.expectedApplications.filter((a) => !a.excludedFromDev).map((a) => a.dir);
  }

  test("a k3d PLAN includes cilium", () => {
    expect(planIncluded("k3d")).toContain("cilium");
  });

  test("a kind PLAN does not", () => {
    expect(planIncluded("kind")).not.toContain("cilium");
  });

  test("a kind --cni cilium PLAN includes cilium", () => {
    const parsed = parseArgs(
      ["--dry-run", "--provider", "kind", "--cni", "cilium", "--scope", "included"],
      {},
    );
    if ("kind" in parsed) throw new Error(`parseArgs rejected a valid argv: ${parsed.message}`);
    const plan = buildPlan(parsed, REPO_ROOT);
    if ("kind" in plan) throw new Error(`buildPlan failed: ${plan.message}`);
    const dirs = plan.expectedApplications.filter((a) => !a.excludedFromDev).map((a) => a.dir);
    expect(dirs).toContain("cilium");
    expect(dirs).toContain("weaviate");
    expect(dirs).not.toContain("cilium-lb-ipam");
  });

  test("neither plan includes cilium-lb-ipam", () => {
    expect(planIncluded("k3d")).not.toContain("cilium-lb-ipam");
    expect(planIncluded("kind")).not.toContain("cilium-lb-ipam");
  });
});
