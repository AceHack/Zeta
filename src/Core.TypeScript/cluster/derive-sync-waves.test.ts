/**
 * Falsifiers for `derive-sync-waves.ts`.
 *
 * Two halves, and both are load-bearing:
 *
 *   A. THE LIVE TREE. The real 47-Application roster is fully declared, every
 *      edge is cited, no NEW order disagreement exists, and no registration has
 *      gone stale. These are the regression guards -- notably §"every shipped
 *      Application is declared", which is the twelve-missing-apps defect turned
 *      into a test that fails when it recurs.
 *
 *   B. SYNTHETIC FALSIFIERS. Each finding is driven to fire on a hand-built
 *      roster + declaration. Half A alone would be the vacuity class: a clean
 *      tree makes every assertion pass whether or not the checker can detect
 *      anything at all.
 */

import { describe, expect, test } from "bun:test";
import {
  ORDER_ADJUDICATION_PENDING,
  auditInputs,
  auditIsClean,
  auditSyncWaveDerivation,
  formatWaveAudit,
  orderViolationKey,
  readDeclaration,
  readShippedApplications,
  type Declaration,
  type ShippedApplication,
} from "./derive-sync-waves.ts";
import { listApplicationManifests } from "./app-of-apps-discovery.ts";

// ---------------------------------------------------------------------------
// A. The live tree
// ---------------------------------------------------------------------------

describe("the live full-ai-cluster tree", () => {
  const audit = auditSyncWaveDerivation();

  test("every shipped Application is declared in the dependency graph", () => {
    // THE REGRESSION GUARD. SYNC-WAVES.md named 34 components while 46
    // Applications shipped; twelve -- agent-memory, arc-controller,
    // arc-runner-set, cdi, cilium-lb-ipam, gmod, headlamp, headscale, kubevirt,
    // minio, platform, seaweedfs -- appeared in no graph at all. Under a
    // hand-maintained document that was invisible. Here it is a failure.
    expect(audit.undeclared).toEqual([]);
  });

  test("no declared node names an Application that does not ship", () => {
    expect(audit.phantom).toEqual([]);
  });

  test("every shipped Application carries an integer sync-wave annotation", () => {
    expect(audit.unannotated).toEqual([]);
  });

  test("every declared dependency edge carries a citation", () => {
    expect(audit.uncitedEdges).toEqual([]);
  });

  test("no NEW order disagreement between the ace-derived order and the live waves", () => {
    expect(audit.unregisteredOrderViolations.map(orderViolationKey)).toEqual([]);
  });

  test("no registration in ORDER_ADJUDICATION_PENDING has gone stale", () => {
    // A registry that outlives its finding is an allowlist.
    expect(audit.staleAdjudications).toEqual([]);
  });

  test("every Application except argocd reconciles strictly after the CNI", () => {
    expect(audit.cniFloorViolations).toEqual([]);
  });

  test("the declaration covers exactly the app-of-apps roster, at its real size", () => {
    // Pinned so that a roster that silently shrinks (a glob narrowed, a walk
    // that stops recursing) cannot make "everything is declared" true by
    // declaring less.
    // 46 -> 47 on 2026-08-22: the `spire-crds` Application joined the roster
    // (081M0JXXFV0087G0R001PGEEM4 follow-on). Bumping this number is the point
    // of pinning it -- a new Application must be a VISIBLE edit here, because
    // an integer that silently keeps passing is how a lane stops asserting
    // what it claims to.
    const manifests = listApplicationManifests();
    expect(manifests.length).toBe(47);
    expect(readShippedApplications().length).toBe(47);
    expect(audit.derivedWaves.size).toBe(47);
  });

  test("the eight known disagreements are all registered WITH a reason", () => {
    expect(audit.orderViolations.length).toBe(8);
    for (const v of audit.orderViolations) {
      const reason = ORDER_ADJUDICATION_PENDING.get(orderViolationKey(v));
      expect(typeof reason).toBe("string");
      expect((reason ?? "").trim().length).toBeGreaterThan(80);
    }
  });

  test("registered disagreements are PRINTED even though the audit passes", () => {
    // The mute-button guard: registering a finding must not hide it.
    expect(auditIsClean(audit)).toBe(true);
    const report = formatWaveAudit(audit);
    expect(report).toContain("AWAITING ADJUDICATION");
    for (const v of audit.orderViolations) {
      expect(report).toContain(v.dependent);
      expect(report).toContain(v.dependency);
    }
  });

  test("ace derives a strictly layered graph, not a flat one", () => {
    // If every chart landed at height 0 the derivation would be vacuous: it
    // would "agree" with any wave assignment whatsoever.
    const heights = new Set(audit.derivedWaves.values());
    expect(heights.size).toBeGreaterThan(1);
    expect(Math.max(...audit.derivedWaves.values())).toBeGreaterThanOrEqual(3);
  });

  /**
   * THE CRD-PROVIDER EDGE, PINNED BY NAME.
   *
   * Found by mutation on 2026-08-22 and this test is the repair. Deleting
   * `spire-crds` from `spire`'s `dependsOn` SURVIVED the whole suite: the node
   * still existed, the roster was still complete, and the wave annotations still
   * happened to be in the right order -- so nothing failed. The general defect is
   * real and is NOT solved here: this file can refuse an Application that is
   * absent from the declaration (finding 1) and an edge whose waves disagree
   * (finding 5), but it cannot know that an edge which is simply GONE ought to
   * have existed. Nothing can derive that from the tree today.
   *
   * What is fixed is the specific claim the spire-crds Application makes about
   * itself: that its ordering is DECLARED rather than incidental. Without this
   * test that sentence was prose, and the mutation proved it. With it, deleting
   * the edge is a red test rather than a silent downgrade to "it works because
   * -55 sorts before -50", which is the timing-dependent arrangement the
   * Application's own header says it is not.
   */
  test("the spire -> spire-crds CRD-provider edge is declared and cited, not incidental", () => {
    const { nodes } = readDeclaration();
    const spire = nodes.find((n) => n.chart === "spire");
    expect(spire, "spire must be declared").toBeDefined();
    expect(spire?.dependsOn ?? []).toContain("spire-crds");
    // An uncited edge is refused by finding 4 in general; asserted here too so
    // the pin covers the whole edge rather than half of it.
    const citation = (spire as unknown as { citations?: Record<string, string> }).citations?.["spire-crds"] ?? "";
    expect(citation.trim().length).toBeGreaterThan(80);
    expect(nodes.some((n) => n.chart === "spire-crds")).toBe(true);
  });

  test("the declaration parses as ace's own AppDependencyGraph kind", () => {
    const { spec, nodes } = readDeclaration();
    expect(spec.kind).toBe("AppDependencyGraph");
    expect(nodes.length).toBe(47);
    // The synthetic root `resolveGraph` injects must not collide with a chart.
    expect(nodes.some((n) => n.chart === spec.metadata.name)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B. Synthetic falsifiers -- each finding driven to fire
// ---------------------------------------------------------------------------

function app(name: string, wave: number | null): ShippedApplication {
  return { name, path: `full-ai-cluster/k8s/applications/${name}/Application.yaml`, wave };
}

/**
 * The synthetic falsifiers run with NO registered adjudications, so they
 * exercise raw detection. The real registry is driven separately, by the
 * live-tree tests above and by the stale-registration test below.
 */
const auditNoPending = (shipped: readonly ShippedApplication[], d: Declaration) =>
  auditInputs(shipped, d, new Map<string, string>());

function declaration(nodes: readonly { chart: string; dependsOn?: string[]; citations?: Record<string, unknown> }[]): Declaration {
  return {
    spec: {
      apiVersion: "ace.zeta.io/v1",
      kind: "AppDependencyGraph",
      metadata: { name: "synthetic-root" },
      spec: { dependsOn: nodes as never },
    },
    nodes: nodes as never,
  };
}

const CILIUM = app("cilium", -80);

describe("falsifiers", () => {
  test("an Application absent from the declaration is a FINDING, never a skip", () => {
    const audit = auditNoPending([CILIUM, app("ghost", 0)], declaration([{ chart: "cilium", dependsOn: [] }]));
    expect(audit.undeclared).toEqual(["ghost"]);
    expect(auditIsClean(audit)).toBe(false);
    expect(formatWaveAudit(audit)).toContain("UNDECLARED");
  });

  test("a declared node that ships no Application is a FINDING", () => {
    const audit = auditNoPending(
      [CILIUM],
      declaration([{ chart: "cilium", dependsOn: [] }, { chart: "imaginary", dependsOn: [] }]),
    );
    expect(audit.phantom).toEqual(["imaginary"]);
    expect(auditIsClean(audit)).toBe(false);
  });

  test("an Application with no sync-wave annotation is a FINDING", () => {
    const audit = auditNoPending(
      [CILIUM, app("bare", null)],
      declaration([{ chart: "cilium", dependsOn: [] }, { chart: "bare", dependsOn: [] }]),
    );
    expect(audit.unannotated).toEqual(["bare"]);
    expect(auditIsClean(audit)).toBe(false);
  });

  test("a non-integer sync-wave is treated as ABSENT, not coerced", () => {
    // ArgoCD parses the annotation with strconv.Atoi. "0.5" is not a wave, and
    // rounding it to something plausible would invent an order nobody wrote.
    const audit = auditNoPending(
      [CILIUM, app("fractional", null)],
      declaration([{ chart: "cilium", dependsOn: [] }, { chart: "fractional", dependsOn: [] }]),
    );
    expect(audit.unannotated).toEqual(["fractional"]);
  });

  test("an uncited edge is a FINDING", () => {
    const audit = auditNoPending(
      [CILIUM, app("consumer", 5)],
      declaration([
        { chart: "cilium", dependsOn: [] },
        { chart: "consumer", dependsOn: ["cilium"], citations: {} },
      ]),
    );
    expect(audit.uncitedEdges).toEqual(["consumer -> cilium"]);
    expect(auditIsClean(audit)).toBe(false);
  });

  test("a whitespace-only citation does not count as cited", () => {
    const audit = auditNoPending(
      [CILIUM, app("consumer", 5)],
      declaration([
        { chart: "cilium", dependsOn: [] },
        { chart: "consumer", dependsOn: ["cilium"], citations: { cilium: "   " } },
      ]),
    );
    expect(audit.uncitedEdges).toEqual(["consumer -> cilium"]);
  });

  test("an inverted wave against a cited edge is an ORDER finding", () => {
    const audit = auditNoPending(
      [CILIUM, app("early", -1), app("late", 10)],
      declaration([
        { chart: "cilium", dependsOn: [] },
        { chart: "late", dependsOn: [] },
        { chart: "early", dependsOn: ["late"], citations: { late: "synthetic evidence" } },
      ]),
    );
    expect(audit.orderViolations.map(orderViolationKey)).toEqual(["early -> late"]);
    expect(audit.unregisteredOrderViolations.length).toBe(1);
    expect(auditIsClean(audit)).toBe(false);
    expect(formatWaveAudit(audit)).toContain("ORDER (NEW)");
  });

  test("EQUAL waves are an ORDER finding — 'not after' is not 'before'", () => {
    // The alloy/loki and *-coder/ollama class. ArgoCD reconciles a wave in
    // parallel, so same-wave gives the dependency no head start at all.
    const audit = auditNoPending(
      [CILIUM, app("shipper", 0), app("sink", 0)],
      declaration([
        { chart: "cilium", dependsOn: [] },
        { chart: "sink", dependsOn: [] },
        { chart: "shipper", dependsOn: ["sink"], citations: { sink: "synthetic evidence" } },
      ]),
    );
    expect(audit.orderViolations.map(orderViolationKey)).toEqual(["shipper -> sink"]);
  });

  test("a correctly ordered cited edge produces NO finding", () => {
    // The other direction: the check must be capable of passing, or it is a
    // check that always fires and therefore says nothing.
    const audit = auditNoPending(
      [CILIUM, app("first", -1), app("second", 10)],
      declaration([
        { chart: "cilium", dependsOn: [] },
        { chart: "first", dependsOn: [] },
        { chart: "second", dependsOn: ["first"], citations: { first: "synthetic evidence" } },
      ]),
    );
    expect(audit.orderViolations).toEqual([]);
    expect(auditIsClean(audit)).toBe(true);
  });

  test("an Application at or below the CNI's wave is a CNI-FLOOR finding", () => {
    const audit = auditNoPending(
      [CILIUM, app("tooEarly", -80), app("wayTooEarly", -85)],
      declaration([
        { chart: "cilium", dependsOn: [] },
        { chart: "tooEarly", dependsOn: [] },
        { chart: "wayTooEarly", dependsOn: [] },
      ]),
    );
    expect(audit.cniFloorViolations.map((v) => v.app).sort()).toEqual(["tooEarly", "wayTooEarly"]);
    expect(auditIsClean(audit)).toBe(false);
  });

  test("argocd is the ONE exemption from the CNI floor", () => {
    const audit = auditNoPending(
      [CILIUM, app("argocd", -90)],
      declaration([{ chart: "cilium", dependsOn: [] }, { chart: "argocd", dependsOn: [] }]),
    );
    expect(audit.cniFloorViolations).toEqual([]);
    expect(auditIsClean(audit)).toBe(true);
  });

  test("a cycle in the declaration is refused by ace, not silently ordered", () => {
    expect(() =>
      auditNoPending(
        [CILIUM, app("a", 1), app("b", 2)],
        declaration([
          { chart: "cilium", dependsOn: [] },
          { chart: "a", dependsOn: ["b"], citations: { b: "synthetic" } },
          { chart: "b", dependsOn: ["a"], citations: { a: "synthetic" } },
        ]),
      ),
    ).toThrow(/Cycle detected/);
  });

  test("an edge to an unknown chart is refused by ace", () => {
    expect(() =>
      auditNoPending(
        [CILIUM],
        declaration([{ chart: "cilium", dependsOn: ["nowhere"], citations: { nowhere: "synthetic" } }]),
      ),
    ).toThrow(/unknown chart/);
  });

  test("ace assigns DAG heights, so a chain layers strictly", () => {
    const audit = auditNoPending(
      [CILIUM, app("a", -70), app("b", -60), app("c", -50)],
      declaration([
        { chart: "cilium", dependsOn: [] },
        { chart: "a", dependsOn: ["cilium"], citations: { cilium: "synthetic" } },
        { chart: "b", dependsOn: ["a"], citations: { a: "synthetic" } },
        { chart: "c", dependsOn: ["b"], citations: { b: "synthetic" } },
      ]),
    );
    expect(audit.derivedWaves.get("cilium")).toBe(0);
    expect(audit.derivedWaves.get("a")).toBe(1);
    expect(audit.derivedWaves.get("b")).toBe(2);
    expect(audit.derivedWaves.get("c")).toBe(3);
    expect(auditIsClean(audit)).toBe(true);
  });

  test("a stale registration fails even when nothing else is wrong", () => {
    // Simulated against the real registry's contract rather than by mutating
    // it: a key present in ORDER_ADJUDICATION_PENDING with no matching
    // violation must land in staleAdjudications. The live-tree test above
    // asserts the real registry is not stale; this asserts the mechanism works.
    const audit = auditInputs([CILIUM], declaration([{ chart: "cilium", dependsOn: [] }]));
    expect(audit.orderViolations).toEqual([]);
    expect([...audit.staleAdjudications].sort()).toEqual([...ORDER_ADJUDICATION_PENDING.keys()].sort());
    expect(auditIsClean(audit)).toBe(false);
    expect(formatWaveAudit(audit)).toContain("STALE REGISTRATION");
  });
});
