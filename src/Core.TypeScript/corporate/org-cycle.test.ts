/**
 * org-cycle.test.ts — the end-to-end proof: a company goal reaching a dev and coming back delivered.
 *
 * The assertions are on the ORGANIZATION'S STATE — the cascade, the calendar, the anchor board —
 * not on the event log. The log is the cycle's account of itself, and an account is the easiest
 * thing in the world to make look right.
 */

import { describe, expect, test } from "bun:test";
import { firstContributorUnder, runOrgCycle, type OrgCycleDeps } from "./org-cycle";
import { buildOrgChart, reportsUpTo } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { accountableHatsFor, childrenOf, isDelivered, nodeById, WorkState, WorkType } from "./goal-cascade";
import { AnchorState, decisionsOn, producedItsOutput } from "./discussion-anchor";
import { blockAt, isBusy, meetingLegs, ScheduleBlockType } from "./work-schedule";
import { SignalTool } from "./supervisor-signal";
import { GateKind, GateOutcome, isPassing, mayEvaluate, ORDERED_GATES, RecoveryPath } from "./quality-gate";
import type { OrgChooser } from "./org-decision";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const H = 3_600_000;

function deps(over: Partial<OrgCycleDeps> = {}): OrgCycleDeps {
  let n = 0;
  return {
    chart,
    plan: {
      goalTitle: "cut checkout abandonment",
      acceptingHatId: "cto",
      initiativeTitles: ["fix the coupon path"],
      projectTitles: ["coupon service hardening"],
      taskTitles: ["stop the double-apply", "add the regression test"],
    },
    createId: (prefix) => `${prefix}-${String(++n).padStart(3, "0")}`,
    nowMs: 0,
    workBlockMs: H,
    resourceAuthorityHatId: "rmo_office",
    contributorFor: (task) => firstContributorUnder(chart, task.ownerHatId),
    outcomeFor: () => "done",
    ...over,
  };
}

describe("the whole loop, end to end", () => {
  const report = runOrgCycle(deps());

  test("it runs clean — no step was refused", () => {
    expect(report.refusals).toEqual([]);
  });

  test("EVERY level from the C-suite down took part", () => {
    // The synergy question, answered by what the cycle actually did rather than by the chart.
    expect(report.levelsEngaged).toEqual([
      "c_suite",
      "director",
      "manager",
      "lead",
      "individual_contributor",
    ]);
  });

  test("the cascade is a real ladder, each rung owned at the right level", () => {
    const c = report.cascade;
    const goal = nodeById(c, report.goalWorkId);
    expect(goal?.workType).toBe(WorkType.Goal);

    const initiative = childrenOf(c, report.goalWorkId)[0];
    const project = childrenOf(c, initiative!.workId)[0];
    const tasks = childrenOf(c, project!.workId);

    expect(chart.byId.get(goal!.ownerHatId)?.level).toBe("c_suite");
    expect(chart.byId.get(initiative!.ownerHatId)?.level).toBe("director");
    expect(chart.byId.get(project!.ownerHatId)?.level).toBe("manager");
    expect(chart.byId.get(tasks[0]!.ownerHatId)?.level).toBe("lead");
    expect(tasks).toHaveLength(2);
  });

  test("every rung's owner really reports to the rung above — one reporting line, not two", () => {
    const c = report.cascade;
    for (const node of c.nodes) {
      if (node.parentWorkId === undefined) continue;
      const parent = nodeById(c, node.parentWorkId)!;
      expect(reportsUpTo(chart, node.ownerHatId, parent.ownerHatId)).toBe(true);
    }
  });

  test("the RMO was asked, and its answer is a DECISION RECORD, not a message", () => {
    const staffing = report.signals.filter((s) => s.tool === SignalTool.RequestResource);
    expect(staffing).toHaveLength(2);
    for (const s of staffing) {
      // Routed to the resource authority, not up the line.
      expect(s.toHatId).toBe("rmo_office");
      // …and the anchor it opened carries a decision with a rationale.
      const decisions = decisionsOn(report.board, s.anchorId);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.rationale.length).toBeGreaterThan(0);
      expect(producedItsOutput(report.board, s.anchorId)).toBe(true);
    }
  });

  test("every staffing anchor was RESOLVED — it produced what it owed", () => {
    for (const s of report.signals.filter((x) => x.tool === SignalTool.RequestResource)) {
      const anchor = report.board.anchors.find((a) => a.anchorId === s.anchorId);
      expect(anchor?.state).toBe(AnchorState.Resolved);
    }
  });

  test("assignees are ICs inside the owning line, and are actually BUSY on their calendars", () => {
    for (const taskId of report.staffedTaskIds) {
      const task = nodeById(report.cascade, taskId)!;
      expect(task.assigneeHatId).toBeDefined();
      expect(chart.byId.get(task.assigneeHatId!)?.level).toBe("individual_contributor");
      expect(reportsUpTo(chart, task.assigneeHatId!, task.ownerHatId)).toBe(true);
    }
    // The schedule is runtime authority: after the cycle, "is this hat busy" has an answer.
    const first = nodeById(report.cascade, report.staffedTaskIds[0]!)!;
    expect(isBusy(report.calendar, first.assigneeHatId!, 1)).toBe(true);
    expect(blockAt(report.calendar, first.assigneeHatId!, 1)?.blockType).toBe(
      ScheduleBlockType.PrioritizedWork,
    );
  });

  test("two tasks on one contributor are SERIALIZED, not double-booked", () => {
    // Both tasks go to the same IC in this seed. The calendar's overlap refusal is what forces the
    // second into the next slot; if it had accepted the overlap, "busy" would mean nothing.
    const workBlocks = report.calendar.blocks.filter(
      (b) => b.blockType === ScheduleBlockType.PrioritizedWork,
    );
    expect(workBlocks).toHaveLength(2);
    expect(workBlocks[0]?.hatId).toBe(workBlocks[1]?.hatId);
    expect(workBlocks[0]!.endMs).toBeLessThanOrEqual(workBlocks[1]!.startMs);
  });

  test("the accountable chain MET — one booking on every attendee's calendar", () => {
    const legs = report.calendar.blocks.filter((b) => b.blockType === ScheduleBlockType.Meeting);
    expect(legs.length).toBeGreaterThan(0);
    const meetingId = legs[0]?.meetingId;
    expect(meetingId).toBeDefined();
    const all = meetingLegs(report.calendar, meetingId!);
    // Four rungs of accountability: lead, manager, director, C-suite.
    const attendees = accountableHatsFor(report.cascade, report.staffedTaskIds[0]!);
    expect(all).toHaveLength(attendees.length);
    expect(all.map((l) => l.hatId).sort()).toEqual([...attendees].sort());
    // Every leg is the same interval — a meeting where attendees have different times is two meetings.
    expect(new Set(all.map((l) => `${l.startMs}..${l.endMs}`)).size).toBe(1);
  });

  test("the meeting does not collide with the work it is about", () => {
    const legs = report.calendar.blocks.filter((b) => b.blockType === ScheduleBlockType.Meeting);
    const work = report.calendar.blocks.filter((b) => b.blockType === ScheduleBlockType.PrioritizedWork);
    for (const leg of legs) {
      for (const w of work) {
        if (leg.hatId !== w.hatId) continue;
        expect(leg.startMs >= w.endMs || w.startMs >= leg.endMs).toBe(true);
      }
    }
  });

  test("DELIVERY ROLLED UP — the goal is delivered because the leaves are", () => {
    expect(report.delivered).toBe(true);
    // And nobody marked the goal done; it is a function of the work beneath it.
    expect(nodeById(report.cascade, report.goalWorkId)?.state).toBe(WorkState.Open);
    expect(isDelivered(report.cascade, report.goalWorkId)).toBe(true);
  });
});

describe("finished work still has to cross the gates", () => {
  const report = runOrgCycle(deps());

  test("every completed task crossed all seven, each by an authorized hat", () => {
    expect(report.gateRuns).toHaveLength(2);
    for (const { run } of report.gateRuns) {
      expect(run.merged).toBe(true);
      expect(run.evaluations).toHaveLength(ORDERED_GATES.length);
      for (const e of run.evaluations) {
        expect(mayEvaluate(chart, e.byHatId, e.gate)).toBe(true);
      }
    }
    expect(report.gateBlocked).toEqual([]);
  });

  test("the gates pull in hats the delivery line never touches", () => {
    // The point of a gate is review by someone who did not do the work. Asserted structurally
    // rather than by hat name — naming them pinned `runGateChain`'s first-owner tie-break instead
    // of the property, and got the names wrong.
    const evaluators = new Set(report.gateRuns.flatMap(({ run }) => run.evaluations.map((e) => e.byHatId)));
    const cascadeHats = new Set(report.cascade.nodes.flatMap((n) => [n.ownerHatId, n.assigneeHatId ?? ""]));

    // Someone reviews who is nowhere in the cascade at all.
    const outsiders = [...evaluators].filter((id) => !cascadeHats.has(id));
    expect(outsiders.length).toBeGreaterThan(0);

    // And the review reaches outside Engineering — product, architecture and QA departments.
    const departments = new Set([...evaluators].map((id) => chart.byId.get(id)?.departmentId));
    expect(departments.size).toBeGreaterThan(1);
    expect(departments.has("qa_and_verification")).toBe(true);
    expect(departments.has("product_and_customer_discovery")).toBe(true);

    // The dev who did the work never signs off on it.
    expect(evaluators.has("backend_implementer")).toBe(false);
  });

  test("A REJECTED GATE MEANS NOT DELIVERED — even though the dev said done", () => {
    // The whole reason the gates exist. Before them, `outcomeFor: () => "done"` was sufficient for
    // a delivered goal: "delivered" meant "the dev said so".
    const rejected = runOrgCycle(
      deps({
        outcomeFor: () => "done",
        gateChooser: (legal, ctx) =>
          ctx.includes(GateKind.RuntimeValidation)
            ? { index: legal.indexOf(GateOutcome.Rejected), reason: "QA found a regression" }
            : { index: legal.indexOf(GateOutcome.Approved), reason: "fine" },
      }),
    );

    expect(rejected.delivered).toBe(false);
    // Two tasks, each reworked and re-presented up to the attempt bound.
    expect(rejected.gateBlocked.length).toBeGreaterThanOrEqual(2);
    for (const b of rejected.gateBlocked) {
      expect(b.gate).toBe(GateKind.RuntimeValidation);
      expect(b.recovery).toBe(RecoveryPath.ValidationProcessImprovement);
    }
    // The tasks stay OPEN — the cascade's own view agrees with the gate's.
    for (const taskId of rejected.staffedTaskIds) {
      expect(nodeById(rejected.cascade, taskId)?.state).toBe(WorkState.Open);
    }
  });

  test("a task that fails then passes is delivered — the retry is real, not decorative", () => {
    // Fail the first attempt at runtime validation, pass every attempt after. If rework were not
    // re-presented to the gates, this would never merge.
    const seen = new Map<string, number>();
    const flaky: OrgChooser<GateOutcome> = (legal, ctx) => {
      if (!ctx.includes(GateKind.RuntimeValidation)) {
        return { index: legal.indexOf(GateOutcome.Approved), reason: "fine" };
      }
      const n = (seen.get(ctx) ?? 0) + 1;
      seen.set(ctx, n);
      return n === 1
        ? { index: legal.indexOf(GateOutcome.Rejected), reason: "first pass found a regression" }
        : { index: legal.indexOf(GateOutcome.Approved), reason: "fixed" };
    };

    const report = runOrgCycle(deps({ gateChooser: flaky }));
    expect(report.delivered).toBe(true);
    // It really did bounce once per task before passing.
    expect(report.gateBlocked.length).toBe(2);
    expect(report.escalations).toEqual([]);
  });
});

describe("repeated rejection becomes CHURN, and churn is broken structurally", () => {
  const report = runOrgCycle(
    deps({
      churnThreshold: 2,
      maxGateAttempts: 5,
      gateChooser: (legal, ctx) =>
        ctx.includes(GateKind.RuntimeValidation)
          ? { index: legal.indexOf(GateOutcome.Rejected), reason: "still failing" }
          : { index: legal.indexOf(GateOutcome.Approved), reason: "fine" },
    }),
  );

  test("the loop STOPS spinning — it does not run to the attempt bound", () => {
    // Threshold 2 with a bound of 5: churn is detected on the second bounce and the retry stops
    // there. Reaching 5 would mean the escalation changed nothing and the item just kept going.
    for (const taskId of report.staffedTaskIds) {
      const attempts = report.gateRuns.filter((g) => g.taskId === taskId).length;
      expect(attempts).toBe(2);
    }
  });

  test("a management hat escalated, and the escalation is structural", () => {
    expect(report.escalations).toHaveLength(2);
    for (const e of report.escalations) {
      // Decided by a manager-or-above inside the owning line — not a hardcoded hat.
      expect(chart.byId.get(e.byHatId)?.level).toBe("manager");
      expect(e.byHatId).toBe("engineering_manager");
      // And it either changes the input or halts the loop. "Try again" is not an option.
      expect(["changes_the_input", "halts_the_loop"]).toContain(e.effect);
    }
  });

  test("churn is counted from the gate record, not a counter", () => {
    // Every rejection that drove the escalation is in the report, re-derivable.
    const failures = report.gateEvaluations.filter((e) => !isPassing(e.outcome));
    expect(failures.length).toBeGreaterThanOrEqual(4);
    for (const f of failures) expect(f.gate).toBe(GateKind.RuntimeValidation);
  });

  test("nothing was delivered — an escalation is not a completion", () => {
    expect(report.delivered).toBe(false);
    for (const taskId of report.staffedTaskIds) {
      expect(nodeById(report.cascade, taskId)?.state).toBe(WorkState.Open);
    }
  });

  test("BELOW the threshold nothing escalates", () => {
    const quiet = runOrgCycle(
      deps({
        churnThreshold: 99,
        maxGateAttempts: 2,
        gateChooser: (legal, ctx) =>
          ctx.includes(GateKind.RuntimeValidation)
            ? { index: legal.indexOf(GateOutcome.Rejected), reason: "failing" }
            : { index: legal.indexOf(GateOutcome.Approved), reason: "fine" },
      }),
    );
    expect(quiet.escalations).toEqual([]);
    // …and it used its full attempt budget instead, because nothing broke the loop.
    for (const taskId of quiet.staffedTaskIds) {
      expect(quiet.gateRuns.filter((g) => g.taskId === taskId).length).toBe(2);
    }
  });

  test("a STAFFING HOLE is not churn — retrying cannot fix it, so nothing escalates", () => {
    // Escalating here would report a broken loop where the loop never ran.
    const stripped = buildOrgChart(
      SEED_HATS.map((h) =>
        h.approvalScopes === undefined
          ? h
          : { ...h, approvalScopes: h.approvalScopes.filter((s) => s !== GateKind.ReleaseReadiness) },
      ),
    );
    expect(stripped.ok).toBe(true);
    if (!stripped.ok) return;
    const report = runOrgCycle(deps({ chart: stripped.chart, churnThreshold: 1, maxGateAttempts: 5 }));
    expect(report.escalations).toEqual([]);
    for (const taskId of report.staffedTaskIds) {
      expect(report.gateRuns.filter((g) => g.taskId === taskId).length).toBe(1);
    }
  });

  test("a gate nobody owns blocks delivery rather than waving it through", () => {
    const stripped = buildOrgChart(
      SEED_HATS.map((h) =>
        h.approvalScopes === undefined
          ? h
          : { ...h, approvalScopes: h.approvalScopes.filter((s) => s !== GateKind.ReleaseReadiness) },
      ),
    );
    expect(stripped.ok).toBe(true);
    if (!stripped.ok) return;

    const report = runOrgCycle(deps({ chart: stripped.chart }));
    expect(report.delivered).toBe(false);
    expect(report.refusals.some((r) => r.includes("no hat holds the approval scope"))).toBe(true);
  });
});

describe("when work gets blocked, the signal rises and then escalates", () => {
  const report = runOrgCycle(deps({ outcomeFor: () => "blocked" }));

  test("nothing was delivered, and the report says so", () => {
    expect(report.delivered).toBe(false);
  });

  test("the blocker went to the assignee's own supervisor", () => {
    const blockers = report.signals.filter((s) => s.tool === SignalTool.ReportBlocker);
    expect(blockers.length).toBeGreaterThan(0);
    for (const b of blockers) {
      const boss = chart.byId.get(b.fromHatId)?.reportsTo;
      expect(boss).toBeDefined();
      expect(b.toHatId).toBe(boss!);
    }
  });

  test("the escalation SKIPS the supervisor that could not resolve it", () => {
    const escalations = report.signals.filter((s) => s.tool === SignalTool.RequestEscalation);
    expect(escalations.length).toBeGreaterThan(0);
    for (const e of escalations) {
      const senderBoss = chart.byId.get(e.fromHatId)!.reportsTo!;
      // NOT the sender's own supervisor — that is `report_blocker`'s route. An escalation delivered
      // to the level that already said it could not resolve this is a no-op that reports success.
      expect(e.toHatId).not.toBe(senderBoss);
      expect(e.toHatId).toBe(chart.byId.get(senderBoss)!.reportsTo!);
      expect(e.toHatId).not.toBe(e.fromHatId);
    }
    expect(report.escalatedTaskIds.length).toBeGreaterThan(0);
  });

  test("the escalation climbed TWO rungs of the chain", () => {
    const escalations = report.signals.filter((s) => s.tool === SignalTool.RequestEscalation);
    for (const e of escalations) {
      // dev → (blocker) → tech lead → (escalation) → engineering DIRECTOR, over the manager's head.
      expect(e.fromLevel).toBe("lead");
      expect(e.toLevel).toBe("director");
      expect(e.toHatId).toBe("engineering_director");
    }
  });

  test("the blocker anchor carries the supervisor's triage as EVIDENCE, on the artifact", () => {
    const blocker = report.signals.find((s) => s.tool === SignalTool.ReportBlocker)!;
    const posts = report.board.posts.filter((p) => p.anchorId === blocker.anchorId);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.byHatId).toBe(blocker.toHatId);
    expect(posts[0]?.evidence.length).toBeGreaterThan(0);
  });
});

describe("the cycle refuses rather than pretending", () => {
  test("a goal accepted below the top ends it, and says why", () => {
    const report = runOrgCycle(deps({ plan: { ...deps().plan, acceptingHatId: "engineering_manager" } }));
    expect(report.delivered).toBe(false);
    expect(report.refusals[0]).toContain("accepted at the top");
    expect(report.cascade.nodes).toHaveLength(0);
    expect(report.levelsEngaged).toEqual([]);
  });

  test("an unstaffable task leaves its anchor OPEN — an unanswered request is a real state", () => {
    const report = runOrgCycle(deps({ contributorFor: () => undefined }));
    expect(report.staffedTaskIds).toEqual([]);
    expect(report.refusals.some((r) => r.includes("could not staff"))).toBe(true);
    // The request was made and never answered. Closing it to tidy the report would hide exactly
    // what the RMO needs to see.
    const staffing = report.signals.filter((s) => s.tool === SignalTool.RequestResource);
    expect(staffing).toHaveLength(2);
    for (const s of staffing) {
      expect(report.board.anchors.find((a) => a.anchorId === s.anchorId)?.state).toBe(AnchorState.Open);
    }
    expect(report.delivered).toBe(false);
  });

  test("a goal whose line has no contributors is refused, not invented around", () => {
    // The CFO has no directors, and its one report — `cost_controller` — supervises nobody, so
    // nothing under this hat can be done by anyone. The refusal comes at the first decomposition,
    // which is the moment the fact is knowable.
    //
    // This has been three different answers. It first refused here for want of a DIRECTOR — the
    // rigid ladder complaining about a rung shape. Then the ladder bent and it built two work items
    // before discovering nobody could do the third, which looked like progress and was worse: two
    // rungs of a plan nobody could execute, and the refusal three steps from the fact.
    const report = runOrgCycle(deps({ plan: { ...deps().plan, acceptingHatId: "cfo" } }));
    expect(report.refusals.some((r) => r.includes("cannot be staffed"))).toBe(true);
    expect(report.delivered).toBe(false);
    // The goal exists — the C-suite did accept it — and nothing hangs off it, because nothing could.
    expect(childrenOf(report.cascade, report.goalWorkId)).toHaveLength(0);
  });

  test("staffing that lands outside the owning line is REFUSED at assignment", () => {
    // The RMO proposes a real IC from another department. The cascade must not take it.
    const report = runOrgCycle(deps({ contributorFor: () => "qa_engineer" }));
    expect(report.staffedTaskIds).toEqual([]);
    expect(report.refusals.some((r) => r.includes("does not report up to"))).toBe(true);
    expect(report.delivered).toBe(false);
  });
});

describe("the cycle is a function of its inputs", () => {
  test("the same inputs produce the same report", () => {
    // No clock, no randomness — which is what lets this be a test rather than a demo, and what
    // two hats agreeing about a meeting requires.
    const a = runOrgCycle(deps());
    const b = runOrgCycle(deps());
    expect(a.events).toEqual(b.events);
    expect(a.cascade).toEqual(b.cascade);
    expect(a.calendar).toEqual(b.calendar);
    expect(a.board).toEqual(b.board);
    expect(a.delivered).toBe(b.delivered);
  });
});
