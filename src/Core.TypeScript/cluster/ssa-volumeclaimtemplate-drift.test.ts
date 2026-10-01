// Falsifiers for `ssa-volumeclaimtemplate-drift.ts` -- work item
// 081M3JFZ59B087G0R0014NP4J7. Live evidence: on a fresh bare-metal install
// `agent-memory` sat OutOfSync/Healthy with ONE OutOfSync resource,
// StatefulSet/agent-memory, whose live `volumeClaimTemplates[0]` carried
// `apiVersion: v1`, `kind: PersistentVolumeClaim`, `spec.volumeMode: Filesystem`
// and `status.phase: Pending` the manifest never wrote, while the controller
// re-ran "serverside-applied ... successfully synced" every ~5 minutes. The
// structurally identical `headscale` (SSA dropped) was Synced on the same node.

import { describe, expect, test } from "bun:test";
import { parse } from "yaml";
import {
  DEFERRED,
  DEFERRED_HELM,
  auditHelmSsaVolumeClaimTemplateDrift,
  auditSsaVolumeClaimTemplateDrift,
  findingsForApplication,
  helmFindingsForApplication,
  statefulSetsWithClaimTemplates,
} from "./ssa-volumeclaimtemplate-drift.ts";

const STS = `apiVersion: apps/v1
kind: StatefulSet
metadata: { name: memory-sts }
spec:
  volumeClaimTemplates:
    - metadata: { name: memory }
      spec: { accessModes: [ReadWriteOnce], resources: { requests: { storage: 1Gi } } }
`;

const app = (syncOptions: string[], annotations: Record<string, string> = {}) =>
  parse(`apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: demo
  annotations: ${JSON.stringify(annotations)}
spec:
  source: { repoURL: x, path: some/dir, directory: { include: "statefulset.yaml" } }
  syncPolicy: { syncOptions: ${JSON.stringify(syncOptions)} }
`) as Record<string, unknown>;

const files = () => [{ path: "some/dir/statefulset.yaml", text: STS }];

describe("SSA + volumeClaimTemplates drift", () => {
  test("a claim-templated StatefulSet is recognised, a plain one is not", () => {
    expect(statefulSetsWithClaimTemplates(STS)).toEqual(["memory-sts"]);
    expect(statefulSetsWithClaimTemplates("kind: StatefulSet\nmetadata: {name: a}\nspec: {}\n")).toEqual([]);
  });

  test("refuses ServerSideApply=true with no ServerSideDiff", () => {
    expect(findingsForApplication("a/Application.yaml", app(["CreateNamespace=true", "ServerSideApply=true"]), files)).toHaveLength(1);
  });

  test("accepts either closure: SSA dropped, or ServerSideDiff=true", () => {
    expect(findingsForApplication("a", app(["CreateNamespace=true"]), files)).toEqual([]);
    expect(
      findingsForApplication("a", app(["ServerSideApply=true"], { "argocd.argoproj.io/compare-options": "ServerSideDiff=true" }), files),
    ).toEqual([]);
  });

  test("the real tree: no git-directory Application pairs SSA with a claim-templated StatefulSet", () => {
    const findings = auditSsaVolumeClaimTemplateDrift();
    const offending = findings.filter((f) => !(f.application in DEFERRED)).map((f) => `${f.application}: StatefulSet/${f.statefulSet} (${f.statefulSetFile})`);
    expect(offending).toEqual([]);
  });

  test("every DEFERRED entry still names a live finding (no stale excuses)", () => {
    const hit = new Set(auditSsaVolumeClaimTemplateDrift().map((f) => f.application));
    expect(Object.keys(DEFERRED).filter((name) => !hit.has(name))).toEqual([]);
  });
});

// The Helm half. Nothing of the above could see a chart-rendered StatefulSet, and
// loki, mimir, tempo and redis -- four Helm charts rendering claim-templated
// StatefulSets -- all shipped on ServerSideApply=true. Every other Helm
// Application that renders one (spire, nats, opensearch, hindsight, weaviate,
// cockroachdb, headscale) had already dropped SSA after being measured OutOfSync.
describe("SSA + volumeClaimTemplates drift -- Helm Applications", () => {
  const helmApp = (syncOptions: string[], annotations: Record<string, string> = {}, source = "{ repoURL: x, chart: demo, targetRevision: 1.0.0 }") =>
    parse(`apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: demo
  annotations: ${JSON.stringify(annotations)}
spec:
  source: ${source}
  syncPolicy: { syncOptions: ${JSON.stringify(syncOptions)} }
`) as Record<string, unknown>;

  test("refuses SSA on a chart that renders a claim-templated StatefulSet", () => {
    const f = helmFindingsForApplication("a/Application.yaml", helmApp(["ServerSideApply=true"]), ["demo-sts"]);
    expect(f).toHaveLength(1);
    expect(f[0]?.statefulSet).toBe("demo-sts");
  });

  test("accepts either closure, and a chart with no such StatefulSet", () => {
    expect(helmFindingsForApplication("a", helmApp(["CreateNamespace=true"]), ["demo-sts"])).toEqual([]);
    expect(
      helmFindingsForApplication("a", helmApp(["ServerSideApply=true"], { "argocd.argoproj.io/compare-options": "ServerSideDiff=true" }), ["demo-sts"]),
    ).toEqual([]);
    expect(helmFindingsForApplication("a", helmApp(["ServerSideApply=true"]), [])).toEqual([]);
  });

  test("a git-directory source is the other audit's business", () => {
    const dirApp = helmApp(["ServerSideApply=true"], {}, "{ repoURL: x, path: some/dir }");
    expect(helmFindingsForApplication("a", dirApp, ["demo-sts"])).toEqual([]);
  });

  test("the real tree: no Helm Application pairs SSA with a chart-rendered claim-templated StatefulSet", () => {
    const offending = auditHelmSsaVolumeClaimTemplateDrift()
      .filter((f) => !(f.application in DEFERRED_HELM))
      .map((f) => `${f.application}: StatefulSet/${f.statefulSet}`);
    expect(offending).toEqual([]);
  });

  test("every DEFERRED_HELM entry still names a live finding (no stale excuses)", () => {
    const hit = new Set(auditHelmSsaVolumeClaimTemplateDrift().map((f) => f.application));
    expect(Object.keys(DEFERRED_HELM).filter((name) => !hit.has(name))).toEqual([]);
  });
});
