import { describe, expect, test } from "bun:test";
import {
  PlanRefusal,
  USE_EMULATION_MERGE_PATCH,
  buildProofPlan,
  expandIncludeGlob,
  includedManifestPaths,
  renderPlan,
  splitOperatorAndCr,
  runPhase,
  summarise,
} from "./kubevirt-cdi-emulation-test.ts";
import type { ClusterControlPlane } from "./ports.ts";

// ---------------------------------------------------------------------------
// THE PATCH ITSELF
//
// Byte-pinned against `kubevirt/kubevirt.core`'s hack/e2e-setup.sh. If this
// string drifts, KubeVirt keeps requiring /dev/kvm on a runner that has none
// and the failure reads as "KubeVirt cannot work here" -- the wrong conclusion,
// which is exactly the misreport this lane exists to prevent.
// ---------------------------------------------------------------------------
describe("useEmulation patch", () => {
  test("is the exact upstream merge patch", () => {
    expect(USE_EMULATION_MERGE_PATCH).toBe(
      '{"spec":{"configuration":{"developerConfiguration":{"useEmulation":true}}}}',
    );
  });

  test("parses to useEmulation true and nothing else", () => {
    expect(JSON.parse(USE_EMULATION_MERGE_PATCH)).toEqual({
      spec: { configuration: { developerConfiguration: { useEmulation: true } } },
    });
  });
});

// ---------------------------------------------------------------------------
// GLOB EXPANSION -- every refusal has a test, because a refusal that never
// executes is indistinguishable from one that was never written.
// ---------------------------------------------------------------------------
describe("expandIncludeGlob", () => {
  test("expands the brace form both Applications actually use", () => {
    expect(expandIncludeGlob("{kubevirt-operator,kubevirt-cr}.yaml")).toEqual([
      "kubevirt-operator.yaml",
      "kubevirt-cr.yaml",
    ]);
    expect(expandIncludeGlob("{cdi-operator,cdi-cr}.yaml")).toEqual(["cdi-operator.yaml", "cdi-cr.yaml"]);
  });

  test("accepts a bare single filename", () => {
    expect(expandIncludeGlob("only.yaml")).toEqual(["only.yaml"]);
  });

  test("refuses a wildcard rather than guessing what ArgoCD would match", () => {
    expect(() => expandIncludeGlob("*.yaml")).toThrow(PlanRefusal);
  });

  test("refuses a path separator", () => {
    expect(() => expandIncludeGlob("{a,b}/x.yaml")).toThrow(PlanRefusal);
  });

  test("refuses an empty alternative", () => {
    expect(() => expandIncludeGlob("{a,}.yaml")).toThrow(PlanRefusal);
  });

  test("refuses nested or repeated brace groups", () => {
    expect(() => expandIncludeGlob("{a,{b,c}}.yaml")).toThrow(PlanRefusal);
    expect(() => expandIncludeGlob("{a,b}{c,d}.yaml")).toThrow(PlanRefusal);
  });

  test("refuses an unbalanced brace", () => {
    expect(() => expandIncludeGlob("{a,b.yaml")).toThrow(PlanRefusal);
    expect(() => expandIncludeGlob("a,b}.yaml")).toThrow(PlanRefusal);
  });

  test("refuses empty", () => {
    expect(() => expandIncludeGlob("   ")).toThrow(PlanRefusal);
  });
});

// ---------------------------------------------------------------------------
// DERIVATION FROM THE APPLICATION MANIFEST, not from a hand-copied list.
// ---------------------------------------------------------------------------
describe("includedManifestPaths", () => {
  const application = [
    "apiVersion: argoproj.io/v1alpha1",
    "kind: Application",
    "metadata:",
    "  name: kubevirt",
    "spec:",
    "  source:",
    "    path: full-ai-cluster/k8s/applications/kubevirt",
    "    directory:",
    "      include: '{kubevirt-operator,kubevirt-cr}.yaml'",
  ].join("\n");

  test("joins the source path to each expanded filename", () => {
    expect(includedManifestPaths(application)).toEqual([
      "full-ai-cluster/k8s/applications/kubevirt/kubevirt-operator.yaml",
      "full-ai-cluster/k8s/applications/kubevirt/kubevirt-cr.yaml",
    ]);
  });

  test("refuses an Application with no directory.include", () => {
    const without = application.split("\n").slice(0, -2).join("\n");
    expect(() => includedManifestPaths(without)).toThrow(PlanRefusal);
  });

  test("refuses an Application with no source path", () => {
    const without = application.replace("    path: full-ai-cluster/k8s/applications/kubevirt\n", "");
    expect(() => includedManifestPaths(without)).toThrow(PlanRefusal);
  });
});

describe("splitOperatorAndCr", () => {
  test("separates the CR from the operator regardless of glob order", () => {
    expect(splitOperatorAndCr(["d/x-cr.yaml", "d/x-operator.yaml"])).toEqual({
      operators: ["d/x-operator.yaml"],
      customResources: ["d/x-cr.yaml"],
    });
  });

  test("refuses a set with no CR -- nothing would be reconciled, so nothing asserted", () => {
    expect(() => splitOperatorAndCr(["d/x-operator.yaml"])).toThrow(PlanRefusal);
  });

  test("refuses a set with no operator -- a CR alone never reconciles", () => {
    expect(() => splitOperatorAndCr(["d/x-cr.yaml"])).toThrow(PlanRefusal);
  });
});

// ---------------------------------------------------------------------------
// THE PLAN, BUILT AGAINST THE LIVE TREE. These assert on the real
// full-ai-cluster/k8s/applications/{cdi,kubevirt}/Application.yaml, so a change
// to either manifest moves this test with it.
// ---------------------------------------------------------------------------
describe("buildProofPlan on the live tree", () => {
  const plan = buildProofPlan({ timeoutSec: 600 });

  test("has exactly two independently-reportable phases, cdi first", () => {
    expect(plan.phases.map((p) => p.name)).toEqual(["cdi", "kubevirt"]);
  });

  test("applies the vendored operator BEFORE the CR in each phase", () => {
    for (const phase of plan.phases) {
      const applied = phase.steps.flatMap((s) => (s.kind === "apply" ? [s.path] : []));
      const operatorIndex = applied.findIndex((p) => p.endsWith("-operator.yaml"));
      const crIndex = applied.findIndex((p) => p.endsWith("-cr.yaml"));
      expect(operatorIndex).toBeGreaterThanOrEqual(0);
      expect(crIndex).toBeGreaterThan(operatorIndex);
    }
  });

  test("applies exactly the files the Application's own include glob names", () => {
    const applied = plan.phases.flatMap((p) => p.steps.flatMap((s) => (s.kind === "apply" ? [s.path] : [])));
    expect(applied).toEqual([
      "full-ai-cluster/k8s/applications/cdi/cdi-operator.yaml",
      "full-ai-cluster/k8s/applications/cdi/cdi-cr.yaml",
      "full-ai-cluster/k8s/applications/kubevirt/kubevirt-operator.yaml",
      "full-ai-cluster/k8s/applications/kubevirt/kubevirt-cr.yaml",
    ]);
  });

  test("patches useEmulation AFTER applying the verbatim CR, never instead of it", () => {
    const kubevirt = plan.phases.find((p) => p.name === "kubevirt")!;
    const crIndex = kubevirt.steps.findIndex((s) => s.kind === "apply" && s.path.endsWith("kubevirt-cr.yaml"));
    const patchIndex = kubevirt.steps.findIndex((s) => s.kind === "patch");
    expect(crIndex).toBeGreaterThanOrEqual(0);
    expect(patchIndex).toBeGreaterThan(crIndex);
    const patch = kubevirt.steps[patchIndex]!;
    expect(patch.kind === "patch" ? patch.patchJson : "").toBe(USE_EMULATION_MERGE_PATCH);
  });

  test("the cdi phase carries NO emulation patch -- CDI needs no virtualization", () => {
    const cdi = plan.phases.find((p) => p.name === "cdi")!;
    expect(cdi.steps.filter((s) => s.kind === "patch")).toEqual([]);
  });

  test("each phase ends in a wait that can actually fail", () => {
    for (const phase of plan.phases) {
      const last = phase.steps[phase.steps.length - 1]!;
      expect(last.kind).toBe("wait");
      if (last.kind === "wait") expect(last.timeoutSec).toBe(600);
    }
  });

  test("waits on the CR's documented readiness signal, per operator", () => {
    const expressions = plan.phases.flatMap((p) =>
      p.steps.flatMap((s) => (s.kind === "wait" ? [`${p.name}:${s.resourceRef}:${s.forExpression}`] : [])),
    );
    expect(expressions).toEqual([
      // cluster-scoped, phase-based
      "cdi:cdi.cdi.kubevirt.io/cdi:jsonpath={.status.phase}=Deployed",
      // namespaced, condition-based -- the expression upstream's own e2e uses
      "kubevirt:kubevirt/kubevirt:condition=Available",
    ]);
  });

  test("waits for each CRD to be Established before applying its CR", () => {
    for (const phase of plan.phases) {
      const crdIndex = phase.steps.findIndex((s) => s.kind === "wait-crd");
      const crIndex = phase.steps.findIndex((s) => s.kind === "apply" && s.path.endsWith("-cr.yaml"));
      expect(crdIndex).toBeGreaterThanOrEqual(0);
      expect(crIndex).toBeGreaterThan(crdIndex);
    }
  });

  test("the timeout knob reaches the waits", () => {
    const short = buildProofPlan({ timeoutSec: 42 });
    const waits = short.phases.flatMap((p) => p.steps.flatMap((s) => (s.kind === "wait" ? [s.timeoutSec] : [])));
    expect(waits).toEqual([42, 42]);
  });

  test("renders every step", () => {
    const rendered = renderPlan(plan);
    expect(rendered).toContain("phase cdi:");
    expect(rendered).toContain("phase kubevirt:");
    expect(rendered).toContain("enable software emulation");
  });
});

// ---------------------------------------------------------------------------
// REPORTING. A KubeVirt failure must never erase the CDI verdict -- "can CDI be
// tested independently of KubeVirt" is half the question being answered.
// ---------------------------------------------------------------------------
describe("summarise", () => {
  test("reports both phases when one fails", () => {
    const text = summarise([
      { name: "cdi", ok: true, reason: "" },
      { name: "kubevirt", ok: false, reason: "timed out" },
    ]);
    expect(text).toContain("PROVED   cdi");
    expect(text).toContain("FAILED   kubevirt: timed out");
  });

  test("reports both when both pass", () => {
    const text = summarise([
      { name: "cdi", ok: true, reason: "" },
      { name: "kubevirt", ok: true, reason: "" },
    ]);
    expect(text.split("\n").filter((line) => line.startsWith("PROVED"))).toHaveLength(2);
    expect(text).not.toContain("FAILED");
  });
});

// ---------------------------------------------------------------------------
// THE RUNNER HALF, over a recording fake of the control-plane port.
//
// These exist because the plan being right says nothing about the executor
// honouring it -- and two of the properties below are ones a reviewer cannot
// see by reading the plan: that manifests go on SERVER-SIDE (the vendored
// KubeVirt CRD is at 91% of the client-side annotation ceiling, and the
// Application declares ServerSideApply=true), and that a failed wait REPORTS
// rather than exits.
// ---------------------------------------------------------------------------
function recordingControlPlane(waitResult: (expr: string) => boolean) {
  const log: string[] = [];
  const controlPlane: ClusterControlPlane = {
    selectContext: () => {},
    waitForAllNodesReady: () => {},
    waitForApiReady: () => {},
    applyRemoteManifest: () => {},
    applyFileManifest: (path, ssa) => log.push(`apply${ssa === true ? "-ssa" : "-client"}:${path}`),
    applyInlineManifest: () => {},
    ensureNamespace: () => {},
    // The virt proof never asks; answering `false` keeps that visible -- a fake
    // that said `true` would let a future caller's existence guard pass here
    // without anyone having decided it should.
    resourceExists: (ref, ns) => {
      log.push(`exists?:${ref}@${ns ?? "-"}`);
      return false;
    },
    waitForCrdEstablished: (crd) => log.push(`crd:${crd}`),
    mergePatch: (ref, ns, patch) => log.push(`patch:${ref}@${ns ?? "-"}:${patch}`),
    waitForResource: (ref, _ns, expr) => {
      log.push(`wait:${ref}:${expr}`);
      return waitResult(expr);
    },
    clearContextIfCurrent: () => {},
  };
  return { controlPlane, log };
}

describe("runPhase", () => {
  const plan = buildProofPlan({ timeoutSec: 5 });
  const kubevirtPhase = plan.phases.find((p) => p.name === "kubevirt")!;

  test("applies every manifest SERVER-SIDE, never client-side", () => {
    const { controlPlane, log } = recordingControlPlane(() => true);
    for (const phase of plan.phases) runPhase(controlPlane, phase);
    const applies = log.filter((line) => line.startsWith("apply"));
    expect(applies).toHaveLength(4);
    expect(applies.filter((line) => line.startsWith("apply-ssa:"))).toHaveLength(4);
    expect(applies.some((line) => line.startsWith("apply-client:"))).toBe(false);
  });

  test("executes the steps in plan order", () => {
    const { controlPlane, log } = recordingControlPlane(() => true);
    runPhase(controlPlane, kubevirtPhase);
    expect(log.map((line) => line.split(":")[0])).toEqual(["apply-ssa", "crd", "apply-ssa", "patch", "wait"]);
  });

  test("a failed wait REPORTS rather than throwing -- the other phase must still run", () => {
    const { controlPlane } = recordingControlPlane(() => false);
    const result = runPhase(controlPlane, kubevirtPhase);
    expect(result.ok).toBe(false);
    expect(result.name).toBe("kubevirt");
    expect(result.reason).toContain("condition=Available");
    expect(result.reason).toContain("5s");
  });

  test("a failed CDI wait does not stop the kubevirt phase from being run and reported", () => {
    // Only the CDI expression fails. Both phases are still executed and both
    // verdicts survive -- "can CDI be tested independently of KubeVirt" is half
    // the question this lane answers, and it is answered in both directions.
    const { controlPlane } = recordingControlPlane((expr) => !expr.startsWith("jsonpath="));
    const results = plan.phases.map((phase) => runPhase(controlPlane, phase));
    expect(results.map((r) => [r.name, r.ok])).toEqual([
      ["cdi", false],
      ["kubevirt", true],
    ]);
  });

  test("a phase that passes reports an empty reason", () => {
    const { controlPlane } = recordingControlPlane(() => true);
    expect(runPhase(controlPlane, kubevirtPhase)).toEqual({ name: "kubevirt", ok: true, reason: "" });
  });
});
