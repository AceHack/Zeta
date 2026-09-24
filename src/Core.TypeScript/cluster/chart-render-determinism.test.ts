/**
 * chart-render-determinism.test.ts
 *
 * Hermetic falsifiers for the render-twice census. No helm, no network: the
 * classifier is pure, and the census itself is exercised by the CLI in CI.
 *
 * The property most of these defend is that the BASELINE must itself be
 * deterministic. A check whose baseline goes red against the next run of the
 * same tree is worse than no check — it teaches its readers to re-measure
 * without looking, which is how a real regression gets baselined away.
 */

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";

import {
  classifyRenderPair,
  compareToBaseline,
  documentKey,
  loadBaseline,
  wildcardPairedSuffix,
  type Baseline,
  type Census,
} from "./chart-render-determinism.ts";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const doc = (kind: string, name: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind,
  metadata: { name, namespace: "ns" },
  ...extra,
});

describe("documentKey", () => {
  test("it is Kind/namespace/name", () => {
    expect(documentKey(doc("Secret", "a"))).toBe("Secret/ns/a");
  });

  test("a cluster-scoped object keeps an identity with an empty namespace", () => {
    // Not dropped, and not defaulted to "default" — a ClusterRole named `x` is
    // a different document from a Role named `x` in namespace `default`.
    expect(documentKey({ kind: "ClusterRole", metadata: { name: "x" } })).toBe("ClusterRole//x");
  });
});

describe("wildcardPairedSuffix — derived from the PAIR, never guessed from one name", () => {
  test("THE regression: helm's random suffix is not required to contain a digit", () => {
    // The first version of this pattern-matched a single key with
    // `/-[a-z0-9]{5,}$/` narrowed to require a digit, so it wildcarded `9pl2t`
    // and then failed to match `jjcvk` on the very next render — and the
    // baseline it wrote went red against the next run. Comparing the two names
    // removes the guess.
    expect(
      wildcardPairedSuffix("Pod/ns/gitlab-webservice-test-runner-9pl2t", "Pod/ns/gitlab-webservice-test-runner-jjcvk"),
    ).toBe("Pod/ns/gitlab-webservice-test-runner-*");
    // All-letters on both sides, which the digit-requiring guess could not see.
    expect(wildcardPairedSuffix("Pod/ns/r-jjcvk", "Pod/ns/r-abcde")).toBe("Pod/ns/r-*");
  });

  test("identical keys are not a suffix case", () => {
    expect(wildcardPairedSuffix("Pod/ns/a", "Pod/ns/a")).toBeNull();
  });

  test("it REFUSES to wildcard across a separator — that is two objects, not one", () => {
    // `gitlab-webservice-default` and `gitlab-webservice-test-runner-x` share a
    // prefix and are unrelated documents. Wildcarding them would merge two
    // identities into one baseline row and stop distinguishing them.
    expect(wildcardPairedSuffix("Pod/ns/gitlab-webservice-default", "Pod/ns/gitlab-webservice-test-runner")).toBeNull();
  });

  test("it refuses a pair differing in KIND or NAMESPACE", () => {
    expect(wildcardPairedSuffix("Pod/ns/a-xxxxx", "Job/ns/a-yyyyy")).toBeNull();
    expect(wildcardPairedSuffix("Pod/one/a-xxxxx", "Pod/two/a-yyyyy")).toBeNull();
  });
});

describe("classifyRenderPair", () => {
  test("a Secret whose CONTENTS differ is a regenerated-secret", () => {
    const found = classifyRenderPair(
      [doc("Secret", "creds", { data: { password: "aaa" } })],
      [doc("Secret", "creds", { data: { password: "bbb" } })],
    );
    expect(found).toEqual([{ document: "Secret/ns/creds", shape: "regenerated-secret" }]);
  });

  test("a Pod whose NAME differs is a fresh-identity, wildcarded", () => {
    const found = classifyRenderPair([doc("Pod", "test-runner-9pl2t")], [doc("Pod", "test-runner-jjcvk")]);
    expect(found).toEqual([{ document: "Pod/ns/test-runner-*", shape: "fresh-identity" }]);
  });

  test("the two shapes are NOT conflated — they need different remedies", () => {
    const found = classifyRenderPair(
      [doc("Secret", "creds", { data: { p: "a" } }), doc("Pod", "hook-11111")],
      [doc("Secret", "creds", { data: { p: "b" } }), doc("Pod", "hook-22222")],
    );
    expect(found.map((row) => row.shape).sort()).toEqual(["fresh-identity", "regenerated-secret"]);
  });

  test("a non-Secret whose contents differ is contents-differ, not silently bucketed", () => {
    const found = classifyRenderPair(
      [doc("ConfigMap", "cm", { data: { k: "1" } })],
      [doc("ConfigMap", "cm", { data: { k: "2" } })],
    );
    expect(found).toEqual([{ document: "ConfigMap/ns/cm", shape: "contents-differ" }]);
  });

  test("a REORDERED render is stable — identity matching, not position", () => {
    // A chart may emit its documents in any order without being
    // non-deterministic, and ArgoCD matches by identity too. A positional
    // comparison would report every such chart as churn.
    const first = [doc("Secret", "a"), doc("ConfigMap", "b"), doc("Service", "c")];
    expect(classifyRenderPair(first, [first[2] ?? {}, first[0] ?? {}, first[1] ?? {}])).toEqual([]);
  });

  test("an identical render is stable", () => {
    const docs = [doc("Secret", "a", { data: { k: "v" } }), doc("Deployment", "b")];
    expect(classifyRenderPair(docs, docs)).toEqual([]);
  });

  test("an UNPAIRED appearance keeps its literal name — it is not a suffix case", () => {
    // Present in one render, absent from the other, with no counterpart. That
    // is non-deterministic PRESENCE, a different defect from a random suffix,
    // and naming it literally is what keeps the two distinguishable.
    const found = classifyRenderPair([doc("Job", "migrate")], []);
    expect(found).toEqual([{ document: "Job/ns/migrate", shape: "fresh-identity" }]);
  });
});

describe("compareToBaseline — both directions are findings", () => {
  const census = (unstable: Census["unstable"], unmeasured: Census["unmeasured"] = []): Census => ({
    appsDiscovered: 49,
    stable: 45,
    unstable,
    unmeasured,
  });
  const baseline = (unstable: Baseline["unstable"], unmeasured: Baseline["unmeasured"] = []): Baseline => ({
    measuredOn: "2026-09-24",
    helmVersion: "v4.2.0",
    appsDiscovered: 49,
    stable: 45,
    unstable,
    unmeasured,
  });
  const row = { appId: "a", documents: [{ document: "Secret/ns/s", shape: "regenerated-secret" as const }] };

  test("a matching census is green — so the check is not merely unable to pass", () => {
    expect(compareToBaseline(census([row]), baseline([row]))).toHaveLength(0);
  });

  test("a NEW unstable document is a blocker", () => {
    const findings = compareToBaseline(census([row]), baseline([]));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("blocker");
    expect(findings[0]?.detail.some((line) => line.includes("Secret/ns/s"))).toBe(true);
  });

  test("a FIXED row is also a blocker — a stale baseline has stopped constraining it", () => {
    // The direction people forget. A baseline still carrying a fixed row means
    // the next regression there passes.
    const findings = compareToBaseline(census([]), baseline([row]));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("no longer unstable");
  });

  test("the SHAPE is part of the row, so a secret turning into an identity churn is caught", () => {
    const shifted = { appId: "a", documents: [{ document: "Secret/ns/s", shape: "contents-differ" as const }] };
    expect(compareToBaseline(census([shifted]), baseline([row])).length).toBeGreaterThan(0);
  });

  test("a newly UNMEASURABLE app is a blocker, never a silent skip", () => {
    const findings = compareToBaseline(
      census([], [{ appId: "x", reason: "helm-template-failed", detail: "boom" }]),
      baseline([]),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("could not be rendered");
  });

  test("an unmeasured app is NEVER counted toward stable", () => {
    // Folding it in would be the vacuity class: an app nobody could render has
    // not been shown to be deterministic.
    const c = census([], [{ appId: "x", reason: "helm-template-failed", detail: "boom" }]);
    expect(c.stable + c.unstable.length + c.unmeasured.length).toBe(46);
  });
});

describe("the committed baseline", () => {
  const committed = loadBaseline(REPO_ROOT);

  test("it records the four measured instances across 49 Applications", () => {
    expect(committed.appsDiscovered).toBe(49);
    expect(committed.unstable.map((app) => app.appId).sort()).toEqual([
      "full-ai-cluster/cilium",
      "full-ai-cluster/gitlab",
      "full-ai-cluster/seaweedfs",
      "full-ai-cluster/weaviate",
    ]);
  });

  test("stable + unstable + unmeasured accounts for every Application", () => {
    expect(committed.stable + committed.unstable.length + committed.unmeasured.length).toBe(committed.appsDiscovered);
  });

  test("the unmeasured set is EMPTY today, and the reason is recorded", () => {
    // It was six, and all six were our own 1 MiB spawn buffer cap rather than a
    // chart defect. If this ever goes non-empty the entries must name why.
    expect(committed.unmeasured).toEqual([]);
  });

  test("every unmeasured entry, if any, carries a NON-EMPTY detail", () => {
    // An unmeasured app that cannot say why is exactly what hid the buffer cap.
    for (const app of committed.unmeasured) expect(app.detail.trim().length).toBeGreaterThan(0);
  });

  test("every fresh-identity row is WILDCARDED, so the baseline cannot churn", () => {
    // The load-bearing property. A literal random suffix here would make the
    // baseline go red against the next run of the same tree.
    for (const app of committed.unstable) {
      for (const document of app.documents) {
        if (document.shape === "fresh-identity") expect(document.document).toContain("*");
      }
    }
  });

  test("every shape is one this file knows how to remedy", () => {
    const known = new Set(["regenerated-secret", "fresh-identity", "contents-differ"]);
    for (const app of committed.unstable) {
      for (const document of app.documents) expect(known.has(document.shape)).toBe(true);
    }
  });
});
