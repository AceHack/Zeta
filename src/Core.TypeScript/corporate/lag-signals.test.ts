/**
 * lag-signals.test.ts — "a signal, not a hidden log line".
 *
 * A finding that stays inside the detector IS the log line, so the tests that matter are the ones
 * about the signal reaching somebody: it is addressed to the hat the finding derived, a caller
 * cannot name that recipient, and the sweep lands in the SAME round rather than after everyone has
 * already ticked.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { detectLag, LagKind, type LagInput } from "./lag-detection";
import { lagSignals, lagSignalsFor } from "./lag-signals";
import { SignalTool, evidenceSatisfies } from "./supervisor-signal";
import { driveRound, type DriveDeps, type DriveState } from "./org-drive";
import { EMPTY_BOARD } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import type { OrgView } from "./org-observe-bridge";
import type { Cascade } from "./goal-cascade";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 500_000;
const SLA = 60_000;

/** One of each subject shape: a work item, a run, a hat, and a queue. */
const BUSY: LagInput = {
  nowMs: NOW,
  reviews: [{ workId: "task-1" }],
  runs: [{ runId: "run-7" }],
  reservedSupply: [{ hatId: "qa_engineer", reservedAtMs: NOW - SLA, taskStarted: false }],
  reservationSlaMs: SLA,
  queues: [{ queueId: "review", depth: 9, drainingHats: 1, perHatCapacity: 2 }],
  blocked: [{ workId: "task-2", ownerHatId: "security_engineer", askedAtMs: NOW - SLA, answered: false }],
  silenceSlaMs: SLA,
};

let n = 0;
function emit(input: LagInput = BUSY, observerHatId = "rmo_office") {
  return lagSignals(chart, detectLag(chart, input), {
    observerHatId,
    atMs: NOW,
    createId: (p) => `${p}-${String(++n)}`,
    anchorId: "anchor-1",
  });
}

describe("EVERY FINDING BECOMES AN ADDRESSED SIGNAL", () => {
  test("a missing reviewer reaches the hat that provisions reviewers", () => {
    const r = emit();
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    const reviewer = r.signals.find((s) => s.title === LagKind.ReviewerMissing);
    expect(reviewer?.toHatId).toBe("engineering_manager");
    expect(reviewer?.fromHatId).toBe("rmo_office");
  });

  test("THE CALLER CANNOT NAME THE RECIPIENT — it is derived from what the problem IS", () => {
    // `lagSignals` takes an observer and nothing else about routing. The recipient came out of the
    // finding, which came out of the chart and the blocker roster. That is the same discipline
    // `routeSignal` enforces for a hat's own signals, reached by a different relation.
    const asObserver = emit(BUSY, "ceo");
    if (!asObserver.ok) throw new Error("expected signals");
    // Changing who is looking changes the sender and NOTHING about where each finding goes.
    const base = emit();
    if (!base.ok) throw new Error("expected signals");
    expect(asObserver.signals.map((s) => `${s.title}->${s.toHatId}`)).toEqual(
      base.signals.map((s) => `${s.title}->${s.toHatId}`),
    );
    expect(asObserver.signals.every((s) => s.fromHatId === "ceo")).toBe(true);
  });

  test("one signal per finding, none dropped", () => {
    const report = detectLag(chart, BUSY);
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    expect(r.signals).toHaveLength(report.findings.length);
    expect(report.findings.length).toBeGreaterThan(3);
  });

  test("a clean sweep produces no signals — nothing is manufactured to look busy", () => {
    const r = emit({ nowMs: NOW, reviews: [], runs: [] });
    if (!r.ok) throw new Error("expected signals");
    expect(r.signals).toEqual([]);
  });
});

describe("THE TOOL FOLLOWS WHAT THE RECIPIENT IS BEING ASKED TO DO", () => {
  test("a capacity problem asks for a resource, not a risk report", () => {
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    expect(r.signals.find((s) => s.title === LagKind.QueueSaturated)?.tool).toBe(SignalTool.RequestResource);
    expect(r.signals.find((s) => s.title === LagKind.ReservedSupplyIdle)?.tool).toBe(SignalTool.RequestResource);
  });

  test("AN UNANSWERED BLOCKER OWNER IS AN ESCALATION BY CONSTRUCTION", () => {
    // Somebody was asked, did not answer, and the finding is already addressed past them. Calling
    // that a risk report would understate what has to happen next.
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    const escalation = r.signals.find((s) => s.title === LagKind.BlockerOwnerSilent);
    expect(escalation?.tool).toBe(SignalTool.RequestEscalation);
    expect(escalation?.toHatId).toBe("security_director");
  });

  test("everything else is a risk", () => {
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    expect(r.signals.find((s) => s.title === LagKind.ReviewerMissing)?.tool).toBe(SignalTool.ReportRisk);
  });
});

describe("A SIGNAL THE ORGANIZATION WOULD REFUSE IS NOT PRODUCED", () => {
  test("every signal carries evidence its own tool accepts", () => {
    // `evidenceSatisfies` is what refuses an unsupported signal elsewhere. Producing one that would
    // fail it means the sweep manufactures signals the organization then throws away.
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    for (const s of r.signals) expect(evidenceSatisfies(s.tool, s.evidence)).toBe(true);
  });

  test("A RUN, A HAT AND A QUEUE ARE NOT WORK ITEMS", () => {
    // Putting them in `workItemId` would make a queue look like a task to everything downstream
    // that groups by it.
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    expect(r.signals.find((s) => s.title === LagKind.UnboundRun)?.workItemId).toBeUndefined();
    expect(r.signals.find((s) => s.title === LagKind.QueueSaturated)?.workItemId).toBeUndefined();
    expect(r.signals.find((s) => s.title === LagKind.ReservedSupplyIdle)?.workItemId).toBeUndefined();
    expect(r.signals.find((s) => s.title === LagKind.ReviewerMissing)?.workItemId).toBe("task-1");
  });

  test("AN UNKNOWN OBSERVER REFUSES THE WHOLE SWEEP", () => {
    // Every signal would be unattributable. "The system noticed" is how an accountability trail
    // ends at nobody.
    const r = emit(BUSY, "not_a_hat");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("unknown observer");
  });

  test("a finding whose owner the chart lacks refuses rather than being dropped", () => {
    const report = detectLag(chart, BUSY);
    const doctored = { ...report, findings: report.findings.map((f) => ({ ...f, ownerHatId: "a_hat_nobody_wears" })) };
    const r = lagSignals(chart, doctored, {
      observerHatId: "rmo_office",
      atMs: NOW,
      createId: (p) => `${p}-x`,
      anchorId: "a",
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("which this chart does not have");
  });

  test("A SIGNAL THE POLICY WOULD REJECT IS REFUSED BY THE SWEEP ITSELF", () => {
    // Not only asserted here. The module re-checks its own output against the rule that would
    // reject it downstream, because a signal built in one module and refused in another is a
    // finding lost between two that each did their job.
    //
    // HONEST LIMIT, measured rather than assumed: deleting that self-check is an EQUIVALENT mutant
    // under this file. Running it together with a deliberately wrong mapping still fails, because
    // the assertions below name the evidence kind directly. The guard earns its place only for a
    // kind these tests do not yet cover — a thirteenth condition whose mapping is wrong fails
    // loudly at this seam instead of silently at the next one.
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    const resource = r.signals.filter((s) => s.tool === SignalTool.RequestResource);
    expect(resource.length).toBeGreaterThan(0);
    // `RequestResource` accepts measurement or document and REFUSES a trace — which is what the
    // first version of this module attached to everything.
    expect(resource.every((s) => s.evidence[0]?.kind === "measurement")).toBe(true);
  });

  test("signals can be read back by recipient", () => {
    const r = emit();
    if (!r.ok) throw new Error("expected signals");
    expect(lagSignalsFor(r.signals, "engineering_manager").map((s) => s.title)).toEqual([LagKind.ReviewerMissing]);
    expect(lagSignalsFor(r.signals, "backend_implementer")).toEqual([]);
  });
});

describe("THE SWEEP RUNS INSIDE THE ROUND", () => {
  const view: OrgView = { chart, board: EMPTY_BOARD, signals: [], cascade: [], artifacts: new Map() };
  const state: DriveState = { view, cascade: { nodes: [], goalId: "g" } as unknown as Cascade, calendar: EMPTY_CALENDAR };
  const deps = (over: Partial<DriveDeps> = {}): DriveDeps => ({
    chart,
    nowMs: NOW,
    createId: (p) => `${p}-${String(++n)}`,
    resourceAuthorityHatId: "rmo_office",
    ...over,
  });

  test("findings join the organization's signals, so the owner sees them THIS round", () => {
    // After the ticks it would be a report about a round nobody could act in — the hidden log line
    // under another name.
    const r = driveRound(state, [], deps({ lagSweep: { observerHatId: "rmo_office", anchorId: "a", input: BUSY } }));
    expect(r.state.view.signals.length).toBeGreaterThan(3);
    expect(r.sweepRefusals).toEqual([]);
  });

  test("NO SWEEP IS ASKED FOR, NO SWEEP IS RUN — and none is faked over an empty input", () => {
    // Running it over nothing would report an organization with nothing wrong, which is exactly the
    // lie the detector was built to refuse.
    const r = driveRound(state, [], deps());
    expect(r.state.view.signals).toEqual([]);
    expect(r.sweepRefusals).toEqual([]);
  });

  test("A SWEEP THAT COULD NOT ADDRESS ITS FINDINGS IS REPORTED, not swallowed", () => {
    const r = driveRound(state, [], deps({ lagSweep: { observerHatId: "not_a_hat", anchorId: "a", input: BUSY } }));
    expect(r.state.view.signals).toEqual([]);
    expect(r.sweepRefusals).toHaveLength(1);
    expect(r.summary).toContain("sweep refusal");
  });
});
