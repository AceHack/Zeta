/**
 * end-to-end.test.ts — a real task, through a real organization, driving itself.
 *
 * Every other test in this register checks one seam. This one runs the whole thing on one inbound
 * ticket and asserts the properties that decide whether it can be put to work:
 *
 *   the work gets owned            an intake item becomes a staffed, scheduled task
 *   the reviews get ASKED FOR      and the hats asked are the hats with the time
 *   the calendar means something   reviews and QA are booked, not just performed
 *   the deliberation is DURABLE    signals, anchors and decisions survive the store
 *   the loop SETTLES               it stops, and says whether it stopped or stalled
 *
 * A test that only asserted "it ran" would pass over an organization that did nothing, which is
 * the failure this file exists to make impossible.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { appendRun, readEvents } from "./org-store";
import { foldBoard, foldSupervisorSignals } from "./org-fold";
import { SignalTool } from "./supervisor-signal";
import { ScheduleBlockType } from "./work-schedule";
import { driveStateFrom, driveUntilSettled, type DriveDeps } from "./org-drive";
import { orgSurfaceFor } from "./org-observe-bridge";
import { headsOf } from "./artifact-deliberation";
import { WorkState } from "./goal-cascade";
import { GateKind, gateOwners } from "./quality-gate";
import { RunOutcome } from "./qa";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const HATS = SEED_HATS.map((h) => h.id);

/** One real inbound ticket — the kind a tracker would hand over. */
const TICKET = {
  source: "jira",
  externalId: "PROJ-9",
  title: "checkout double-charges when a coupon is applied twice",
  body: "apply the same coupon twice at checkout and the order is billed twice",
};

async function runOrg() {
  let n = 0;
  return runOrgRuntime({
    chart,
    agents: agentsFromChart(chart),
    observations: [],
    externalEvents: [TICKET],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p: string) => `${p}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    priorityInputsFor: () => ({
      executivePriority: 0.5,
      customerImpact: 1,
      severity: 1,
      releaseRisk: 0.2,
      blockedDownstreamCount: 2,
      dependencyFanOut: 1,
      queueAgeMs: 0,
      hatScarcity: 0,
      budgetBurn: 0,
      estimatedEffort: 0.2,
    }),
  } as unknown as OrgRuntimeDeps);
}

describe("A TICKET BECOMES OWNED, SCHEDULED WORK", () => {
  test("the inbound item reaches the cascade and gets a hat", async () => {
    const report = await runOrg();
    const staffed = report.cascade.nodes.filter((n) => n.assigneeHatId !== undefined);
    expect(report.cascade.nodes.length).toBeGreaterThan(0);
    expect(staffed.length).toBeGreaterThan(0);
  });

  test("STAFFING WAS ASKED FOR, not assumed — a resource request went to the RMO", async () => {
    // The organization asking itself for people, rather than a function quietly picking one.
    const report = await runOrg();
    const asks = report.signals.filter((s) => s.tool === SignalTool.RequestResource);
    expect(asks.length).toBeGreaterThan(0);
    expect(asks[0]?.toHatId).toBe("rmo_office");
  });
});

describe("THE REVIEWS ARE ASKED FOR, AND THE ASK MATCHES THE CALENDAR", () => {
  test("a review request exists for the gates, spread across the hats that hold them", async () => {
    // Before the writer existed this list was empty and `review_artifact` was unreachable.
    const report = await runOrg();
    const reviews = report.signals.filter((s) => s.tool === SignalTool.RequestReview);
    expect(reviews.length).toBeGreaterThan(0);
    expect(new Set(reviews.map((s) => s.toHatId)).size).toBeGreaterThan(1);
    for (const r of reviews) {
      expect(gateOwners(chart, r.title as GateKind).map((h) => h.id)).toContain(r.toHatId);
    }
  });

  test("EVERY ASKED REVIEWER ALSO HAS THE TIME BOOKED", async () => {
    // The property that makes the two halves one act. A reviewer with a request and no block is
    // one whose tick cannot see it is meant to review; a block with no request is time nobody
    // asked for.
    const report = await runOrg();
    const booked = new Set(
      report.calendar.blocks.filter((b) => b.blockType === ScheduleBlockType.Review).map((b) => b.hatId),
    );
    const reviews = report.signals.filter((s) => s.tool === SignalTool.RequestReview);
    for (const r of reviews) expect(booked.has(r.toHatId)).toBe(true);
  });

  test("QA HAS TIME TOO, and it is not booked as a review", async () => {
    const report = await runOrg();
    const qa = report.calendar.blocks.filter((b) => b.blockType === ScheduleBlockType.PromptFlowExecution);
    expect(qa.length).toBeGreaterThan(0);
    for (const b of qa) expect(b.blockType).not.toBe(ScheduleBlockType.Review);
  });

  test("THE CALENDAR COVERS MANY HATS, not just the one doing the work", async () => {
    // The state this replaces: thirteen gates evaluated by hats with nothing on their calendars.
    const report = await runOrg();
    expect(new Set(report.calendar.blocks.map((b) => b.hatId)).size).toBeGreaterThan(3);
  });
});

describe("THE DELIBERATION SURVIVES THE STORE", () => {
  test("signals, anchors and decisions all fold back off disk", async () => {
    const report = await runOrg();
    const root = mkdtempSync(join(tmpdir(), "zeta-e2e-"));
    try {
      appendRun(
        {
          atMs: 0,
          delivered: report.delivered,
          levelsEngaged: report.levelsEngaged,
          refusals: report.refusals,
          trace: report.trace,
          replayable: report.fidelity.replayable,
          realPorts: report.fidelity.realPorts,
        },
        root,
      );
      const fromDisk = readEvents(root);

      // Read by a fold, not from the in-memory report — the whole question is whether a second
      // process can reconstruct what happened.
      expect(foldSupervisorSignals(fromDisk).length).toBe(report.signals.length);
      const board = foldBoard(fromDisk);
      expect(board.anchors.length).toBe(report.board.anchors.length);
      expect(board.decisions.length).toBe(report.board.decisions.length);
      for (const d of board.decisions) expect(d.rationale.trim()).not.toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("THE RUN RECONCILES, and says what it could not check", async () => {
    const report = await runOrg();
    // No tracker was supplied, so the reconciliation is honest about having skipped it rather than
    // reporting a clean bill over two of three parties.
    expect(report.reconciliation.notChecked).toContain("tracker");
    expect(report.reconciliation.summary).toContain("NOT checked");
  });
});

describe("AND THEN IT DRIVES ITSELF", () => {
  function deps(over: Partial<DriveDeps> = {}): DriveDeps {
    let n = 0;
    return {
      chart,
      nowMs: 10_000_000,
      createId: (p) => `${p}-d${String(++n)}`,
      resourceAuthorityHatId: "rmo_office",
      ...over,
    };
  }

  test("the loop SETTLES rather than spinning", async () => {
    // Settled means a whole round in which nothing changed. A driver that cannot detect that burns
    // a budget producing nothing and reports success by never admitting it finished.
    const report = await runOrg();
    const state = driveStateFrom(report, chart);
    const r = driveUntilSettled(state, HATS, deps(), 20);
    expect(r.settled).toBe(true);
    expect(r.rounds.length).toBeLessThan(20);
    expect(r.rounds[r.rounds.length - 1]?.changes).toBe(0);
  });

  test("A BLOCKED AGENT'S REPORT REACHES ITS SUPERVISOR, in a real organization", async () => {
    // The chain, end to end, over the state a real run produced. Nobody wrote "engineering
    // managers unblock people" — the report routes up because the chart says so.
    const report = await runOrg();
    const blocked = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined);
    expect(blocked).toBeDefined();
    const state = driveStateFrom(
      report,
      chart,
      new Map(),
      new Map([[blocked!.assigneeHatId!, [{ about: "which store the port writes to", blocking: blocked!.workId }]]]),
    );
    const r = driveUntilSettled(state, HATS, deps(), 5);
    const raised = r.state.view.signals.filter((s) => s.tool === SignalTool.ReportBlocker);
    expect(raised.length).toBeGreaterThan(0);
    expect(raised[0]?.fromHatId).toBe(blocked!.assigneeHatId);
    // Routed, not chosen.
    expect(raised[0]?.toHatId).not.toBe(blocked!.assigneeHatId);
  });

  test("A DRY RUN CHANGES NOTHING and still says what would happen", async () => {
    const report = await runOrg();
    const state = driveStateFrom(report, chart);
    const r = driveUntilSettled(state, HATS, deps({ dryRun: true }), 3);
    expect(r.rounds[0]?.changes).toBe(0);
    expect(r.rounds[0]?.summary).toContain("DRY RUN");
    expect(r.state.cascade.nodes.length).toBe(report.cascade.nodes.length);
  });

  test("AN UNBOUNDED DRIVE IS NOT ON OFFER", async () => {
    const report = await runOrg();
    expect(() => driveUntilSettled(driveStateFrom(report, chart), HATS, deps(), 0)).toThrow();
  });

  test("the drive is DETERMINISTIC — the same organization twice gives the same rounds", async () => {
    const a = driveUntilSettled(driveStateFrom(await runOrg(), chart), HATS, deps(), 10);
    const b = driveUntilSettled(driveStateFrom(await runOrg(), chart), HATS, deps(), 10);
    expect(a.rounds.length).toBe(b.rounds.length);
    expect(a.rounds.map((r) => r.changes)).toEqual(b.rounds.map((r) => r.changes));
  });
});

describe("WHAT THIS RUN HONESTLY DID NOT DO", () => {
  test("every port was simulated, and the run says so rather than implying otherwise", async () => {
    // The claim this file must not make. Nothing here touched a repository, a tracker or a test
    // runner, and a passing end-to-end suite over simulated adapters is evidence about the
    // ORGANIZATION's wiring — not about work having been delivered.
    const report = await runOrg();
    expect(report.fidelity.realPorts).toEqual([]);
    expect(report.fidelity.replayable).toBe(true);
  });

  test("and delivery is not claimed on an undelivered goal", async () => {
    const report = await runOrg();
    const done = report.cascade.nodes.filter((n) => n.state === WorkState.Done).length;
    // Whatever the run achieved, `delivered` agrees with the cascade rather than with optimism.
    if (report.delivered) expect(done).toBeGreaterThan(0);
  });
});

describe("WHEN IT GOES WRONG, A DIRECTOR IS ASKED", () => {
  async function failingRun() {
    let n = 0;
    return runOrgRuntime({
      chart,
      agents: agentsFromChart(chart),
      observations: [],
      externalEvents: [TICKET],
      acceptingHatId: "cto",
      resourceAuthorityHatId: "rmo_office",
      priorityDeciderHatId: "cto",
      createId: (p: string) => `${p}-${String(++n).padStart(3, "0")}`,
      nowMs: 0,
      workBlockMs: 3_600_000,
      leaseMs: 300_000,
      qaFallback: RunOutcome.Failed,
      priorityInputsFor: () => ({
        executivePriority: 0.5,
        customerImpact: 1,
        severity: 1,
        releaseRisk: 0.2,
        blockedDownstreamCount: 2,
        dependencyFanOut: 1,
        queueAgeMs: 0,
        hatScarcity: 0,
        budgetBurn: 0,
        estimatedEffort: 0.2,
      }),
    } as unknown as OrgRuntimeDeps);
  }

  test("an escalation ASKS the level above rather than deciding alone", async () => {
    // `RequestDecision`'s own policy: "multiple valid paths exist and authority sits above the
    // hat". It had ZERO senders, so the one family meant to carry "how should we execute this?"
    // upward was never used and an escalation was a call the hat that noticed made for itself.
    const report = await failingRun();
    expect(report.escalations.length).toBeGreaterThan(0);
    const asks = report.signals.filter((s) => s.tool === SignalTool.RequestDecision);
    expect(asks.length).toBe(report.escalations.length);
    // Up the line, to a DIRECTOR — derived from the chart, not named anywhere.
    expect(asks[0]?.toHatId).toBe("engineering_director");
  });

  test("...and it carries the gate record, so nobody re-derives the problem to decide it", async () => {
    const report = await failingRun();
    const ask = report.signals.find((s) => s.tool === SignalTool.RequestDecision);
    expect(ask?.evidence.some((e) => e.ref.startsWith("gates:"))).toBe(true);
  });

  test("A CLEAN RUN ASKS NOBODY — the signal fires on escalation, not on every run", async () => {
    // The other half. A decision request on a run with nothing wrong would be noise that trains
    // the level above to ignore them.
    const report = await runOrg();
    expect(report.escalations.length).toBe(0);
    expect(report.signals.filter((s) => s.tool === SignalTool.RequestDecision)).toEqual([]);
  });

  test("the local decision is RECORDED AS WELL, not instead", async () => {
    // The run did decide something, and the ask is what the organization was told. A supervisor
    // overruling it later is the chain working, and it cannot overrule what it never heard.
    const report = await failingRun();
    for (const e of report.escalations) expect(e.action).not.toBe("");
  });
});

describe("THE RUN PRODUCES ARTIFACTS, AND THE DELIBERATION IS ABOUT THEM", () => {
  function deps(): DriveDeps {
    let k = 0;
    return {
      chart,
      nowMs: 10_000_000,
      createId: (p) => `${p}-a${String(++k)}`,
      resourceAuthorityHatId: "rmo_office",
    };
  }

  test("each delivered item has a walkable artifact history", async () => {
    const report = await runOrg();
    expect(report.artifacts.size).toBeGreaterThan(0);
    for (const [, history] of report.artifacts) {
      expect(history.revisions.length).toBeGreaterThan(0);
      // One head: a pipeline run is not concurrent, so there is a single current version.
      expect(headsOf(history).length).toBe(1);
    }
  });

  test("REVIEWS ARE NOW OFFERABLE — the reader has a writer", async () => {
    // Before the run produced histories this was zero for every hat: `reviewsAskedOf` needs an
    // artifact to name a revision of, so `review_artifact` was a verb nobody could be offered.
    const report = await runOrg();
    const state = driveStateFrom(report, chart);
    const offered = HATS.flatMap((h) => orgSurfaceFor(state.view, h).reviewsAsked ?? []);
    expect(offered.length).toBeGreaterThan(0);
    // And each names a revision that resolves in the artifact it belongs to.
    for (const ask of offered.slice(0, 5)) {
      const history = report.artifacts.get(ask.artifactId);
      expect(history).toBeDefined();
      expect(history!.revisions.some((r) => r.revisionId === ask.revisionId)).toBe(true);
    }
  });

  test("THE DRIVE SETTLES EVEN WITH ROOMS OPEN — it does not chatter", async () => {
    // With turns available the loop must still reach quiescence. It did not at first: every hat
    // was offered a turn every tick, so the drive ran to its bound posting about a document
    // nobody had changed. "One turn per version" is what makes a conversation end.
    const report = await runOrg();
    const r = driveUntilSettled(driveStateFrom(report, chart), HATS, deps(), 30);
    expect(r.settled).toBe(true);
    expect(r.rounds[r.rounds.length - 1]?.changes).toBe(0);
  });

  test("...and every turn is attributed to the hat that SPOKE", async () => {
    // This read the anchor's first participant, so a room of three recorded one hat saying
    // everything — and the speak-once rule could never match the hat that actually ticked.
    const report = await runOrg();
    const r = driveUntilSettled(driveStateFrom(report, chart), HATS, deps(), 30);
    const posts = r.state.view.board.posts;
    expect(posts.length).toBeGreaterThan(0);
    expect(new Set(posts.map((p) => p.byHatId)).size).toBeGreaterThan(1);
    // Nobody speaks twice about one revision on one anchor.
    const seen = new Set<string>();
    for (const p of posts) {
      const key = `${p.anchorId}|${p.byHatId}|${p.evidence[0]?.ref ?? ""}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("A PACE PROBLEM IS REPORTED AS A RISK", () => {
  async function pacedRun(nowMs: number, failing: boolean) {
    let n = 0;
    return runOrgRuntime({
      chart,
      agents: agentsFromChart(chart),
      observations: [],
      externalEvents: [TICKET],
      acceptingHatId: "cto",
      resourceAuthorityHatId: "rmo_office",
      priorityDeciderHatId: "cto",
      createId: (p: string) => `${p}-${String(++n).padStart(3, "0")}`,
      nowMs,
      workBlockMs: 3_600_000,
      leaseMs: 300_000,
      missionWindow: { startsAtMs: 0, targetAtMs: 10_000_000 },
      ...(failing ? { qaFallback: RunOutcome.Failed } : {}),
      priorityInputsFor: () => ({
        executivePriority: 0.5,
        customerImpact: 1,
        severity: 1,
        releaseRisk: 0.2,
        blockedDownstreamCount: 2,
        dependencyFanOut: 1,
        queueAgeMs: 0,
        hatScarcity: 0,
        budgetBurn: 0,
        estimatedEffort: 0.2,
      }),
    } as unknown as OrgRuntimeDeps);
  }

  test("a mission 90% through its window with nothing delivered reports a risk UPWARD", async () => {
    // `ReportRisk` had no senders, so the organization measured its own pace and told nobody: the
    // trigger went into `refusals`, a list for things that went wrong rather than a channel anyone
    // is watching.
    const report = await pacedRun(9_000_000, true);
    expect(report.trajectory?.status).toBe("off_track");
    const risks = report.signals.filter((s) => s.tool === SignalTool.ReportRisk);
    expect(risks.length).toBe(1);
    // Up the line, derived — the goal's owner to its supervisor.
    expect(risks[0]?.toHatId).not.toBe(risks[0]?.fromHatId);
  });

  test("...and carries the pace MEASUREMENT, not an opinion about the schedule", async () => {
    const report = await pacedRun(9_000_000, true);
    const risk = report.signals.find((s) => s.tool === SignalTool.ReportRisk);
    expect(risk?.evidence.some((e) => e.kind === "measurement" && e.ref.startsWith("pace:"))).toBe(true);
  });

  test("AN ON-TIME MISSION REPORTS NO RISK — a warning on every run is noise", async () => {
    const report = await pacedRun(0, false);
    expect(report.trajectory?.status).toBe("on_track");
    expect(report.signals.filter((s) => s.tool === SignalTool.ReportRisk)).toEqual([]);
  });

  test("RECURRING FRICTION BECOMES AN IMPROVEMENT REQUEST — I had this backwards", async () => {
    // I recorded `SuggestImprovement` as deliberately unsent, reasoning that an improvement is a
    // judgement with no observable trigger. That was wrong, and wrong in the way this register is
    // least allowed to be: I asserted a limit about the design without reading the part that
    // specifies it. `ORGANIZATION_RUNTIME_ARCHITECTURE.md` has agents request new workflows "when
    // they discover repeatable organizational inefficiency", and every example it gives is
    // countable — repeated review drift, repeated missed coverage.
    //
    // The trigger is REPETITION ACROSS ITEMS, which is measurable, and the previous version of
    // this test asserted the count stays zero: a falsifier pinning my mistake in place.
    const report = await pacedRun(0, true);
    expect(report.inefficiencies.length).toBeGreaterThan(0);
    const asks = report.signals.filter((s) => s.tool === SignalTool.SuggestImprovement);
    expect(asks.length).toBe(report.inefficiencies.length);
    // Up the chain, from the hat that felt the friction.
    expect(asks[0]?.toHatId).not.toBe(asks[0]?.fromHatId);
  });

  test("...and a run where nothing recurred asks for nothing", async () => {
    // The other half. An organization filing a workflow request every run manufactures opinions
    // nobody held, which is the failure my wrong reasoning was actually reaching for.
    const report = await pacedRun(0, false);
    expect(report.inefficiencies).toEqual([]);
    expect(report.signals.filter((s) => s.tool === SignalTool.SuggestImprovement)).toEqual([]);
  });
});
