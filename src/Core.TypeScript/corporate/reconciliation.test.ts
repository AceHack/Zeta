/**
 * reconciliation.test.ts — a reconciler that never looked must not report agreement.
 *
 * The disagreements themselves are the easy half. The load-bearing tests are the ones about the
 * THIRD state: a party that was not consulted contributes nothing to a clean bill, and a summary
 * that says "no disagreement found" has to say in the same breath what it did not check.
 */

import { describe, expect, test } from "bun:test";
import {
  DisagreementKind,
  fullyReconciled,
  ofKind,
  Party,
  reconcile,
  type ReconcileInput,
} from "./reconciliation";
import { WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";

function node(workId: string, state: WorkState): CascadeNode {
  return {
    workId,
    workType: WorkType.Task,
    title: workId,
    state,
    ownerHatId: "tech_lead",
    assigneeHatId: "backend_implementer",
  };
}

function evaluation(workId: string): GateEvaluation {
  return {
    workId,
    gate: GateKind.ReleaseReadiness,
    outcome: GateOutcome.Approved,
    byHatId: "tpm",
    atMs: 1,
    reason: "fine",
    evidenceRefs: [],
  };
}

const base: ReconcileInput = {
  cascade: [],
  changesLanded: [],
  changesUnlanded: [],
  gateEvaluations: [],
  delivered: false,
};

describe("UNKNOWN IS NOT AGREEMENT", () => {
  test("a tracker nobody asked is reported as NOT CHECKED, not as agreeing", () => {
    // The failure this prevents: a reconciler reporting "everything agrees" because it never
    // looked. That is worse than no reconciler — it manufactures confidence.
    const r = reconcile({ ...base, cascade: [node("a", WorkState.Open)] });
    expect(r.disagreements).toEqual([]);
    expect(r.notChecked).toContain(Party.Tracker);
    expect(r.checked).not.toContain(Party.Tracker);
  });

  test("`fullyReconciled` is FALSE when a party went unconsulted, despite zero disagreements", () => {
    const r = reconcile({ ...base, cascade: [node("a", WorkState.Open)] });
    expect(r.disagreements.length).toBe(0);
    expect(fullyReconciled(r)).toBe(false);
  });

  test("...and TRUE only when everything comparable was compared and agreed", () => {
    const r = reconcile({
      ...base,
      cascade: [node("a", WorkState.Done)],
      gateEvaluations: [evaluation("a")],
      trackerStates: new Map([["a", "Done"]]),
      trackerDoneStates: new Set(["Done"]),
    });
    expect(r.disagreements).toEqual([]);
    expect(fullyReconciled(r)).toBe(true);
  });

  test("THE SUMMARY NAMES WHAT IT SKIPPED, in the same breath as the clean result", () => {
    // Where the narrowing gets lost: "0 disagreements" over two of three parties sounds like a
    // clean bill and is a strictly narrower claim.
    const r = reconcile({ ...base, cascade: [node("a", WorkState.Open)] });
    expect(r.summary).toContain("no disagreement found");
    expect(r.summary).toContain("NOT checked: tracker");
  });

  test("AN EMPTY TRACKER WAS ASKED; AN ABSENT ONE WAS NOT — different facts", () => {
    const asked = reconcile({ ...base, cascade: [node("a", WorkState.Open)], trackerStates: new Map() });
    const notAsked = reconcile({ ...base, cascade: [node("a", WorkState.Open)] });
    expect(asked.checked).toContain(Party.Tracker);
    expect(notAsked.notChecked).toContain(Party.Tracker);
  });
});

describe("each disagreement is its own KIND, because each has its own fix", () => {
  test("projected as merged and the port refused", () => {
    const r = reconcile({
      ...base,
      cascade: [node("a", WorkState.Done)],
      gateEvaluations: [evaluation("a")],
      changesUnlanded: ["a"],
    });
    expect(ofKind(r, DisagreementKind.ProjectedMergedButNotLanded).length).toBe(1);
  });

  test("merged in the repository and still open in the organization", () => {
    const r = reconcile({ ...base, cascade: [node("a", WorkState.Open)], changesLanded: ["a"] });
    const d = ofKind(r, DisagreementKind.LandedButNotDone)[0];
    expect(d?.organizationSays).toBe(WorkState.Open);
    expect(d?.realitySays).toBe("merged");
  });

  test("DONE WITH NO GATE VERDICT — work that went round the process", () => {
    // Kept distinct from `LandedButNotDone` on purpose: a bookkeeping lag and work that skipped
    // its process are different problems, and one `Mismatch` kind would hide the second inside
    // the first.
    const r = reconcile({ ...base, cascade: [node("a", WorkState.Done)] });
    expect(ofKind(r, DisagreementKind.DoneWithoutGates).length).toBe(1);
  });

  test("an OPEN item with no gate verdicts is NOT a finding", () => {
    // The normal case. Reporting it would bury the real findings in noise, which is how a
    // reconciler stops being read.
    const r = reconcile({ ...base, cascade: [node("a", WorkState.Open)] });
    expect(ofKind(r, DisagreementKind.DoneWithoutGates)).toEqual([]);
  });

  test("the tracker contradicts the organization", () => {
    const r = reconcile({
      ...base,
      cascade: [node("a", WorkState.Done)],
      gateEvaluations: [evaluation("a")],
      trackerStates: new Map([["a", "In Progress"]]),
      trackerDoneStates: new Set(["Done"]),
    });
    const d = ofKind(r, DisagreementKind.TrackerDisagrees)[0];
    expect(d?.realitySays).toBe("In Progress");
  });

  test("AN ITEM THE TRACKER NEVER HEARD OF IS NOT A DISAGREEMENT", () => {
    // Plenty of work is created inside the organization. Only a tracker with an OPINION can
    // contradict one, and treating silence as contradiction would make every internal item a
    // finding.
    //
    // The item must be DONE for this to test anything. With an OPEN item the organization also
    // says "not done", so a mutant that treats silence as an opinion agrees by coincidence and
    // survives — which is exactly what happened on the first mutation pass.
    const r = reconcile({
      ...base,
      cascade: [node("internal", WorkState.Done)],
      gateEvaluations: [evaluation("internal")],
      trackerStates: new Map([["other", "Done"]]),
      trackerDoneStates: new Set(["Done"]),
    });
    expect(ofKind(r, DisagreementKind.TrackerDisagrees)).toEqual([]);
  });

  test("DONE STATES ARE THE CALLER'S TO NAME — a tracker whose done column is 'Shipped'", () => {
    // No default, because guessing produces a reconciler that silently disagrees with every
    // tracker that spells it differently.
    const r = reconcile({
      ...base,
      cascade: [node("a", WorkState.Done)],
      gateEvaluations: [evaluation("a")],
      trackerStates: new Map([["a", "Shipped"]]),
      trackerDoneStates: new Set(["Shipped"]),
    });
    expect(ofKind(r, DisagreementKind.TrackerDisagrees)).toEqual([]);
  });

  test("DELIVERED OVER AN UNLANDED CHANGE — the goal-level finding", () => {
    const r = reconcile({
      ...base,
      cascade: [node("a", WorkState.Done)],
      gateEvaluations: [evaluation("a")],
      changesUnlanded: ["a"],
      delivered: true,
    });
    expect(ofKind(r, DisagreementKind.DeliveredOverUnlandedChange).length).toBe(1);
  });

  test("...and it does not fire when nothing was left unlanded", () => {
    const r = reconcile({
      ...base,
      cascade: [node("a", WorkState.Done)],
      gateEvaluations: [evaluation("a")],
      changesLanded: ["a"],
      delivered: true,
    });
    expect(ofKind(r, DisagreementKind.DeliveredOverUnlandedChange)).toEqual([]);
  });
});

describe("it REPORTS and never repairs", () => {
  test("the cascade it was given is not modified", () => {
    // Repairing would destroy the evidence that the two disagreed, and the finding is the product.
    const cascade = [node("a", WorkState.Open)];
    const before = JSON.stringify(cascade);
    reconcile({ ...base, cascade, changesLanded: ["a"] });
    expect(JSON.stringify(cascade)).toBe(before);
  });

  test("it is a pure function — the same input twice gives the same report", () => {
    const input: ReconcileInput = { ...base, cascade: [node("a", WorkState.Done)], delivered: true };
    expect(JSON.stringify(reconcile(input))).toBe(JSON.stringify(reconcile(input)));
  });

  test("an empty organization reconciles cleanly, and still says what it skipped", () => {
    const r = reconcile(base);
    expect(r.itemsExamined).toBe(0);
    expect(r.disagreements).toEqual([]);
    expect(fullyReconciled(r)).toBe(false);
  });
});
