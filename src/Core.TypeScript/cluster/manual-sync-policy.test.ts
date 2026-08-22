import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  auditSyncPolicyDeclarations,
  classifySyncPolicy,
  manualSyncAssertion,
  MANUAL_SYNC_ACCEPTABLE_HEALTH,
  COMPARISON_COMPLETED_SYNC_STATUS,
} from "./manual-sync-policy.ts";
import { applicationOutcome, classifyApplications, discoverExpectedApplications } from "./argocd-health-test.ts";

const APPS_DIR = resolve(import.meta.dir, "../../../full-ai-cluster/k8s/applications");

const HEAD = ["apiVersion: argoproj.io/v1alpha1", "kind: Application", "metadata:", "  name: demo"];
const AUTOMATED = ["spec:", "  syncPolicy:", "    automated:", "      prune: false", "      selfHeal: true"];
const NO_AUTOMATED = ["spec:", "  syncPolicy:", "    syncOptions: [ ServerSideApply=true ]"];

const NL = String.fromCharCode(10);

function manifest(lines: readonly string[]): string {
  return lines.join(NL) + NL;
}

function withAnnotations(annotations: readonly string[], spec: readonly string[]): string {
  const head = HEAD.concat(["  annotations:"]);
  return manifest(head.concat(annotations).concat(spec));
}

const MANUAL_ANNOTATIONS = [
  "    zeta.io/sync-policy: manual",
  "    zeta.io/sync-policy-reason: adopts an operator installed by hand under live guests",
];

/**
 * THE CONVENTION ITSELF, falsified.
 *
 * The question these answer is not "do cdi and kubevirt pass" -- it is "can the
 * rule that lets them pass be abused". Each case below is a way the convention
 * could quietly become a mute button, and each one has to stay refused.
 */
describe("manual-sync convention", () => {
  test("REFUSED: automated omitted with no annotation -- omission is not a declaration", () => {
    const declaration = classifySyncPolicy(manifest(HEAD.concat(NO_AUTOMATED)));
    expect(declaration.kind).toBe("invalid");
    expect(declaration.kind === "invalid" ? declaration.problem : "").toContain("must SAY so");
  });

  test("REFUSED: the annotation with no reason -- a declaration without a why is a mute button", () => {
    const declaration = classifySyncPolicy(withAnnotations(["    zeta.io/sync-policy: manual"], NO_AUTOMATED));
    expect(declaration.kind).toBe("invalid");
    expect(declaration.kind === "invalid" ? declaration.problem : "").toContain("sync-policy-reason");
  });

  test("REFUSED: an empty reason is not a reason", () => {
    const annotations = ["    zeta.io/sync-policy: manual", '    zeta.io/sync-policy-reason: "   "'];
    expect(classifySyncPolicy(withAnnotations(annotations, NO_AUTOMATED)).kind).toBe("invalid");
  });

  test("REFUSED: annotation AND an automated block -- they may not be allowed to disagree", () => {
    const declaration = classifySyncPolicy(withAnnotations(MANUAL_ANNOTATIONS, AUTOMATED));
    expect(declaration.kind).toBe("invalid");
    expect(declaration.kind === "invalid" ? declaration.problem : "").toContain("disagree");
  });

  test("REFUSED: a near-miss annotation value is not case-folded into acceptance", () => {
    const annotations = ["    zeta.io/sync-policy: Manual", "    zeta.io/sync-policy-reason: because"];
    expect(classifySyncPolicy(withAnnotations(annotations, NO_AUTOMATED)).kind).toBe("invalid");
  });

  test("ACCEPTED: annotation, non-empty reason, no automated block", () => {
    const declaration = classifySyncPolicy(withAnnotations(MANUAL_ANNOTATIONS, NO_AUTOMATED));
    expect(declaration.kind).toBe("manual");
    expect(declaration.kind === "manual" ? declaration.reason : "").toContain("installed by hand");
  });

  test("ACCEPTED: an ordinary automated app stays automated", () => {
    expect(classifySyncPolicy(manifest(HEAD.concat(AUTOMATED))).kind).toBe("automated");
  });

  test("REFUSED: unparseable YAML is invalid, never silently automated", () => {
    const tab = String.fromCharCode(9);
    expect(classifySyncPolicy("metadata:" + NL + tab + "name: tabbed" + NL + "  - broken" + NL).kind).toBe("invalid");
  });
});

describe("manual-sync convention, over the real tree", () => {
  test("every Application in full-ai-cluster declares a valid sync policy", () => {
    expect(auditSyncPolicyDeclarations(APPS_DIR)).toEqual([]);
  });

  test("the five manual-sync apps are exactly the ones that omit an automated block", () => {
    const manual = discoverExpectedApplications()
      .filter((app) => app.manualSync)
      .map((app) => app.dir);
    expect(manual).toEqual(["cdi", "forgejo", "kubevirt", "ollama", "vllm"]);
  });

  test("PROOF IT GOES RED: an undeclared omission in a temp tree is reported", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-sync-policy-"));
    try {
      const appDir = join(root, "newcomer");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(join(appDir, "Application.yaml"), manifest(HEAD.concat(NO_AUTOMATED)));
      const violations = auditSyncPolicyDeclarations(root);
      expect(violations.map((violation) => violation.dir)).toEqual(["newcomer"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("PROOF IT GOES RED: annotation plus an automated block in a temp tree is reported", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-sync-policy-"));
    try {
      const appDir = join(root, "contradictory");
      mkdirSync(appDir, { recursive: true });
      writeFileSync(join(appDir, "Application.yaml"), withAnnotations(MANUAL_ANNOTATIONS, AUTOMATED));
      const violations = auditSyncPolicyDeclarations(root);
      expect(violations.map((violation) => violation.dir)).toEqual(["contradictory"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function snapshot(name: string, syncStatus: string, healthStatus: string, message = "") {
  return { name, syncStatus, healthStatus, message };
}

function expectedApp(dir: string, manualSync: boolean) {
  return {
    dir,
    name: dir,
    excludedFromDev: false,
    manualSync,
    path: "full-ai-cluster/k8s/applications/" + dir + "/Application.yaml",
  };
}

/**
 * WHAT THE WEAKER ASSERTION STILL CATCHES.
 *
 * The lazy fix for the failing kind lane was to add cdi and kubevirt to an
 * exclusion list. That is refused here, and these are the tests that make the
 * refusal mean something: the two Applications adopted onto the box running
 * production Windows guests must still be able to turn this lane red.
 */
describe("manual-sync live assertion", () => {
  test("the MEASURED CI state (OutOfSync + Missing) is accepted -- that is the designed steady state", () => {
    expect(manualSyncAssertion(snapshot("cdi", "OutOfSync", "Missing")).ok).toBe(true);
    expect(manualSyncAssertion(snapshot("kubevirt", "OutOfSync", "Missing")).ok).toBe(true);
  });

  test("a hand-synced healthy app is accepted too -- the same rule holds on node-5b2dfa", () => {
    expect(manualSyncAssertion(snapshot("kubevirt", "Synced", "Healthy")).ok).toBe(true);
  });

  test("STILL RED: a ComparisonError -- the vendored operator manifest did not render", () => {
    const outcome = manualSyncAssertion(snapshot("kubevirt", "Unknown", "Missing", "rpc error: path does not exist"));
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain("never completed a comparison");
    expect(outcome.reason).toContain("path does not exist");
  });

  test("STILL RED: an empty sync status -- ArgoCD never evaluated the Application at all", () => {
    expect(manualSyncAssertion(snapshot("cdi", "", "")).ok).toBe(false);
  });

  test("STILL RED: Degraded health after a hand sync -- the operator is broken", () => {
    const outcome = manualSyncAssertion(snapshot("kubevirt", "Synced", "Degraded", "virt-handler CrashLoopBackOff"));
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain("Degraded");
    expect(outcome.reason).toContain("CrashLoopBackOff");
  });

  test("STILL RED: the Application is gone entirely -- existence is never waived", () => {
    const verdicts = classifyApplications([expectedApp("kubevirt", true)], []);
    expect(verdicts[0]?.ok).toBe(false);
    expect(verdicts[0]?.syncStatus).toBe("Missing");
  });

  test("STILL RED: Progressing that never settles is not accepted as good enough", () => {
    expect(MANUAL_SYNC_ACCEPTABLE_HEALTH.has("Progressing")).toBe(false);
    expect(manualSyncAssertion(snapshot("cdi", "Synced", "Progressing")).ok).toBe(false);
  });

  test("BOUNDARY: only Synced and OutOfSync count as a completed comparison", () => {
    expect(COMPARISON_COMPLETED_SYNC_STATUS.has("Unknown")).toBe(false);
    expect(COMPARISON_COMPLETED_SYNC_STATUS.has("Synced")).toBe(true);
    expect(COMPARISON_COMPLETED_SYNC_STATUS.has("OutOfSync")).toBe(true);
  });

  test("FAIL-CLOSED: an app that is NOT a declared manual-sync keeps the full contract", () => {
    const outcome = applicationOutcome(
      expectedApp("cockroachdb", false),
      snapshot("cockroachdb", "OutOfSync", "Missing"),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe("expected Synced/Healthy");
  });

  test("FAIL-CLOSED: the weaker contract is reachable only through the manifest, not a name list", () => {
    const strict = applicationOutcome(expectedApp("cdi", false), snapshot("cdi", "OutOfSync", "Missing"));
    const weak = applicationOutcome(expectedApp("cdi", true), snapshot("cdi", "OutOfSync", "Missing"));
    expect(strict.ok).toBe(false);
    expect(weak.ok).toBe(true);
  });
});
