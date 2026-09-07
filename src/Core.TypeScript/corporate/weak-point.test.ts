/**
 * weak-point.test.ts — self-healing is exactly where a system talks itself into acting directly.
 *
 * The problem is visible, the fix is obvious, and the chain looks like ceremony. So the load-bearing
 * test here is the one that cannot be written: there is no way to construct an indicator whose
 * suggested action is a repair, because `SuggestedAction` has two cases and neither is one.
 *
 * The rest is the fold. An agent asking "is this local, team-level or platform-level" needs ONE
 * taxonomy, and the value of this module is that five report shapes arrive as eight indicator kinds
 * with nothing measured twice.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { detectLag } from "./lag-detection";
import { InefficiencyKind } from "./inefficiency";
import { Fidelity, Port } from "./providers";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";
import { SignalTool } from "./supervisor-signal";
import {
  classifyWeakPoints,
  MANUAL_REPEAT_THRESHOLD,
  WeakPoint,
  weakPointsOfKind,
  type WeakPointInput,
} from "./weak-point";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 100_000;
const SLA = 60_000;

function classify(over: WeakPointInput = {}) {
  return classifyWeakPoints(over);
}

describe("THE SUGGESTED ACTION IS NEVER A REPAIR", () => {
  test("every indicator suggests a signal or a work item, and nothing else", () => {
    // The doc's safety sentence, checked at every kind this module can produce. Self-healing is not
    // permission to mutate the runtime; the chain is what makes a repair auditable, and a repair
    // nobody can audit is indistinguishable from drift.
    const all = classify(everything());
    expect(all.length).toBeGreaterThan(5);
    for (const i of all) expect(["signal", "work_item"]).toContain(i.suggested.kind);
  });

  test("EVERY INDICATOR POINTS AT SOMETHING CHECKABLE", () => {
    // An indicator with no evidence is an opinion about the system, and an opinion routed as a
    // finding is how a self-healing loop starts chasing its own noise.
    for (const i of classify(everything())) expect(i.evidence.length).toBeGreaterThan(0);
  });
});

describe("the eight, folded from what the register already measured", () => {
  test("A STALL IS BLOCKED WORK; A SLOW QUEUE IS SLOW TRIAGE — and nothing is both", () => {
    const lag = detectLag(chart, {
      nowMs: NOW,
      runs: [{ runId: "run-1" }],
      queues: [{ queueId: "review", depth: 9, drainingHats: 1, perHatCapacity: 2 }],
    });
    const r = classify({ lag });
    expect(weakPointsOfKind(r, WeakPoint.BlockedWork)).toHaveLength(1);
    expect(weakPointsOfKind(r, WeakPoint.SlowTriage)).toHaveLength(1);
    // A stall is reported as a blocker; a slow queue asks for capacity. Both go up, neither repairs.
    expect(weakPointsOfKind(r, WeakPoint.BlockedWork)[0]?.suggested).toMatchObject({ tool: SignalTool.ReportBlocker });
    expect(weakPointsOfKind(r, WeakPoint.SlowTriage)[0]?.suggested).toMatchObject({ tool: SignalTool.RequestResource });
  });

  test("a missing reviewer is SLOW TRIAGE, not a stall", () => {
    const lag = detectLag(chart, { nowMs: NOW, reviews: [{ workId: "task-1" }] });
    expect(classify({ lag }).map((i) => i.kind)).toEqual([WeakPoint.SlowTriage]);
  });

  test("REPEATED FAILURE PROPOSES NOTHING — the fix is not this layer's call", () => {
    // `inefficiency.ts` refuses to name a workflow, and this must not name one either. Proposing
    // from here makes the call at the bottom of the chain with the least context about what else
    // the organization already has in flight.
    const r = classify({
      inefficiencies: [
        { kind: InefficiencyKind.GateDrift, pattern: "peer_review", workIds: ["task-1", "task-2"], summary: "'peer_review' blocked 2 different work item(s)" },
      ],
    });
    expect(r[0]?.kind).toBe(WeakPoint.RepeatedFailure);
    expect(r[0]?.suggested).toMatchObject({ kind: "signal", tool: SignalTool.SuggestImprovement });
    // One evidence ref per item it recurred over, so the recurrence itself is checkable.
    expect(r[0]?.evidence).toHaveLength(2);
  });

  test("AN UNATTESTED APPROVAL BECOMES A WORK ITEM, not a signal", () => {
    // An approval nobody can check is a defect in the work, and a defect is assigned, gated and
    // reviewed like anything else. Signalling it upward would ask a manager to fix a document.
    const r = classify({ unattestedApprovals: [approval()] });
    expect(r[0]?.kind).toBe(WeakPoint.MissingEvidence);
    expect(r[0]?.suggested.kind).toBe("work_item");
  });

  test("A POLICY DENIAL AND A HARNESS FAILURE ARE DIFFERENT INDICATORS", () => {
    const r = classify({
      refusals: [
        "'backend_implementer' may not approve its own work",
        "producer 'command' could not run",
      ],
    });
    expect(r.map((i) => i.kind).sort()).toEqual([WeakPoint.HarnessFailure, WeakPoint.PolicyDenied]);
    expect(weakPointsOfKind(r, WeakPoint.PolicyDenied)[0]?.suggested).toMatchObject({ tool: SignalTool.RequestDecision });
    expect(weakPointsOfKind(r, WeakPoint.HarnessFailure)[0]?.suggested.kind).toBe("work_item");
  });

  test("MOST REFUSALS ARE NEITHER, and classifying them would make the taxonomy ignored", () => {
    // A gate that legitimately failed and a steal with no trigger are guards WORKING. Calling every
    // one a weak point is the fastest way to teach everyone to skip the list.
    expect(classify({ refusals: ["no condition permits taking 'task-1' from 'backend_implementer'"] })).toEqual([]);
    expect(classify({ refusals: ["gate 'qa_uat' was rejected"] })).toEqual([]);
  });

  test("A SEAM EXPECTED REAL AND FOUND SIMULATED IS A TELEMETRY GAP", () => {
    // The most consequential form: everything downstream of it is a measurement of a stand-in.
    const r = classify({
      portsExpectedReal: [Port.ChangeControl],
      portFidelity: new Map([[Port.ChangeControl, Fidelity.Simulated]]),
    });
    expect(r[0]?.kind).toBe(WeakPoint.TelemetryGap);
    expect(r[0]?.summary).toContain("simulated");
  });

  test("...and a REAL one is not a gap", () => {
    expect(
      classify({ portsExpectedReal: [Port.ChangeControl], portFidelity: new Map([[Port.ChangeControl, Fidelity.Real]]) }),
    ).toEqual([]);
  });

  test("AN UNRESOLVED PORT IS A GAP TOO — absence is not fidelity", () => {
    // A port the run expected to be real and cannot even name the fidelity of is worse than a
    // simulated one, not better. Reading a missing entry as fine is the permissive default this
    // register keeps refusing.
    const r = classify({ portsExpectedReal: [Port.ChangeControl], portFidelity: new Map() });
    expect(r[0]?.kind).toBe(WeakPoint.TelemetryGap);
    expect(r[0]?.summary).toContain("unresolved");
  });

  test("A MISSING TOOL IS COUNTED, not felt", () => {
    expect(MANUAL_REPEAT_THRESHOLD).toBe(2);
    expect(classify({ manualRepeats: [{ hatId: "sre", what: "rotate the token", times: 1 }] })).toEqual([]);
    const r = classify({ manualRepeats: [{ hatId: "sre", what: "rotate the token", times: 2 }] });
    expect(r[0]?.kind).toBe(WeakPoint.MissingTool);
    expect(r[0]?.suggested).toMatchObject({ tool: SignalTool.RequestResource });
  });

  test("the doc's eight are all here", () => {
    expect(Object.values(WeakPoint)).toHaveLength(8);
  });
});

describe("ordering and emptiness", () => {
  test("indicators are ORDINAL by kind then summary, so two machines agree", () => {
    // A self-healing loop that reads its own findings in a different order every run cannot tell a
    // new problem from a reshuffled one.
    const r = classify(everything());
    const kinds = r.map((i) => i.kind);
    expect([...kinds].sort()).toEqual(kinds);
  });

  test("A CLEAN ORGANIZATION PRODUCES NOTHING — no manufactured concern", () => {
    expect(classify()).toEqual([]);
    expect(classify({ lag: detectLag(chart, { nowMs: NOW, reviews: [], runs: [] }), inefficiencies: [], refusals: [] })).toEqual([]);
  });

  test("nothing supplied is nothing classified — this is not a sweep and claims no completeness", () => {
    // Deliberately unlike `lag-detection.ts`, which reports what it did not check. A classifier says
    // what the supplied measurements imply and nothing about what was never measured; holding that
    // question is the caller's job, and pretending otherwise would put a second, weaker
    // completeness claim next to the real one.
    expect(classify({})).toEqual([]);
  });
});

function approval(): GateEvaluation {
  return {
    workId: "task-1",
    gate: GateKind.ImplementationReview,
    outcome: GateOutcome.Approved,
    byHatId: "tech_lead",
    reason: "looks fine",
    atMs: NOW,
    evidenceRefs: [],
  };
}

/** One of everything, so the type-level guarantee is checked across all eight kinds. */
function everything(): WeakPointInput {
  return {
    lag: detectLag(chart, {
      nowMs: NOW,
      runs: [{ runId: "run-1" }],
      queues: [{ queueId: "review", depth: 9, drainingHats: 1, perHatCapacity: 2 }],
      blocked: [{ workId: "task-2", ownerHatId: "security_engineer", askedAtMs: NOW - SLA, answered: false }],
      silenceSlaMs: SLA,
    }),
    inefficiencies: [
      { kind: InefficiencyKind.GateDrift, pattern: "peer_review", workIds: ["task-1", "task-2"], summary: "recurred" },
    ],
    unattestedApprovals: [approval()],
    refusals: ["'x' may not approve its own work", "producer 'command' could not run"],
    portsExpectedReal: [Port.ChangeControl],
    portFidelity: new Map([[Port.ChangeControl, Fidelity.Simulated]]),
    manualRepeats: [{ hatId: "sre", what: "rotate the token", times: 3 }],
  };
}
