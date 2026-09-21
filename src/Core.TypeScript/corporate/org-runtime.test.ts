/**
 * org-runtime.test.ts — the end-to-end proof for the WHOLE register.
 *
 * `org-cycle.test.ts` proves the delivery loop. This proves the pipeline that surrounds it: a
 * customer report arrives, is de-duplicated and triaged, is prioritized by an authority, becomes a
 * goal, cascades to owned tasks, is staffed by ranked assignment into real expiring bindings, is
 * scheduled, is picked up by the dev's OWN observe tick, is claimed and reviewed through the work
 * market, is verified by QA, crosses seven gates, and comes back delivered.
 *
 * Assertions are on organizational STATE — the cascade, the bindings, the queue, the board — not on
 * the event log. The log is the runtime's account of itself, and an account is the easiest thing to
 * make look right.
 */

import { chainFor, chainOf, producesCode } from "./gate-demand";
import { describe, expect, test } from "bun:test";
import { agentsFromChart, gateStaffing, runOrgRuntime, staffingReadout, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart, reportsUpTo } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, externalRefOf, type ExternalEvent } from "./intake";
import { parseRequestRef } from "./request";
import { foldTicketReports } from "./org-fold";
import { childrenOf, isDelivered, nodeById, WorkState, WorkType, isLeafType } from "./goal-cascade";
import { isAuthorizing, BindingPhase } from "./hat-binding";
import { GateKind, GateOutcome, ORDERED_GATES, mayEvaluate } from "./quality-gate";
import { RunOutcome } from "./qa";
import { ShardState } from "./work-market";
import { Fidelity, Port } from "./providers";
import { ProcessSetting, type SettingBinding } from "./practice";
import { defaultProviderSet } from "./org-runtime";
import type { ProducerPort } from "./pipeline";
import { PriorityClass } from "./prioritization";
import { AnchorState } from "./discussion-anchor";
import { SignalTool } from "./supervisor-signal";
import { OrgEventKind, type OrgEvent } from "./org-event";
import { foldOrganization } from "./org-fold";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const GOOD: ExternalEvent = {
  source: "portal",
  externalId: "T-1",
  kind: IntakeKind.Defect,
  severity: Severity.High,
  title: "checkout double-charges",
  reproduction: "add the coupon twice",
  evidenceRefs: ["log/1"],
};

function deps(over: Partial<OrgRuntimeDeps> = {}): OrgRuntimeDeps {
  let n = 0;
  return {
    chart,
    externalEvents: [GOOD],
    agents: agentsFromChart(chart),
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId: (p) => `${p}-${String(++n).padStart(3, "0")}`,
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
    ...over,
  };
}

describe("THE WHOLE PIPELINE, end to end", () => {
  let report: Awaited<ReturnType<typeof runOrgRuntime>>;

  test("it runs, and the only refusals are the ones the inputs asked for", async () => {
    report = await runOrgRuntime(deps());
    // ── OUT-OF-DISCIPLINE AUTHORSHIP IS A REAL FINDING, NOT NOISE ────────────
    // This fixture staffs implementers and nobody from QA, so the QA phases end up authored by an
    // implementer — and the run now SAYS so instead of crediting them silently, which is how a
    // Backend Implementer came to be recorded as the author of a customer RFP review.
    //
    // Asserted by shape rather than deleted: any OTHER refusal still fails this test, so the
    // "nothing else went wrong" half of it survives.
    const offDiscipline = report.refusals.filter((r) => r.includes("outside its discipline"));
    expect(report.refusals.filter((r) => !r.includes("outside its discipline"))).toEqual([]);
    // …and, since a verify leaf runs the suite at qa_uat too (see the QaUat producer), at that gate as well.
    expect(offDiscipline.every((r) => r.includes("runtime_validation") || r.includes("qa_uat"))).toBe(true);
    expect(report.delivered).toBe(true);
  });

  test("EVERY level from the C-suite to the contributor took part", async () => {
    report = await runOrgRuntime(deps());
    expect(report.levelsEngaged).toEqual([
      "c_suite",
      "director",
      "manager",
      "lead",
      "individual_contributor",
    ]);
  });

  test("1. INTAKE — the report was accepted, normalized and keyed", async () => {
    report = await runOrgRuntime(deps());
    expect(report.intakeAccepted).toHaveLength(1);
    expect(report.intakeAccepted[0]?.externalRef).toBe(externalRefOf("portal", "T-1"));
    expect(report.intakeAccepted[0]?.severity).toBe(Severity.High);
  });

  test("2. PRIORITIZE — an authority set the class, and the recommendation is kept", async () => {
    report = await runOrgRuntime(deps());
    expect(report.priorities).toHaveLength(1);
    const p = report.priorities[0]!;
    expect(p.decidedByHatId).toBe("cto");
    expect(p.priorityClass).not.toBe(PriorityClass.Paused);
    expect(p.reasonCodes).toContain("severity");
    expect(p.recommended).toBeDefined();
  });

  test("3. CASCADE — goal → initiative → project → task, each rung owned in one line", async () => {
    report = await runOrgRuntime(deps());
    const c = report.cascade;
    const goal = nodeById(c, report.goalWorkId!);
    expect(goal?.workType).toBe(WorkType.Goal);
    const initiative = childrenOf(c, goal!.workId)[0]!;
    const project = childrenOf(c, initiative.workId)[0]!;
    const tasks = childrenOf(c, project.workId);
    expect(tasks).toHaveLength(2);
    expect(chart.byId.get(goal!.ownerHatId)?.level).toBe("c_suite");
    expect(chart.byId.get(initiative.ownerHatId)?.level).toBe("director");
    expect(chart.byId.get(project.ownerHatId)?.level).toBe("manager");
    expect(chart.byId.get(tasks[0]!.ownerHatId)?.level).toBe("lead");
    for (const n of c.nodes) {
      if (n.parentWorkId === undefined) continue;
      expect(reportsUpTo(chart, n.ownerHatId, nodeById(c, n.parentWorkId)!.ownerHatId)).toBe(true);
    }
  });

  test("4. STAFF — the RMO was asked, and real bindings were issued", async () => {
    report = await runOrgRuntime(deps());
    const staffing = report.signals.filter((s) => s.tool === SignalTool.RequestResource);
    expect(staffing).toHaveLength(2);
    for (const s of staffing) {
      expect(s.toHatId).toBe("rmo_office");
      expect(report.board.anchors.find((a) => a.anchorId === s.anchorId)?.state).toBe(AnchorState.Resolved);
    }
    expect(report.bindings).toHaveLength(2);
  });

  test("EACH TASK LANDS ON A DIFFERENT HAT, both inside the owning line", async () => {
    // The first run of this pipeline put both tasks on one hat and the second was refused at the
    // supply cap — a selection bug that read as a capacity problem.
    report = await runOrgRuntime(deps());
    const assignees = report.cascade.nodes
      .map((n) => n.assigneeHatId)
      .filter((h): h is string => h !== undefined);
    expect(assignees).toHaveLength(2);
    expect(new Set(assignees).size).toBe(2);
    for (const hatId of assignees) {
      expect(chart.byId.get(hatId)?.level).toBe("individual_contributor");
      expect(reportsUpTo(chart, hatId, "tech_lead")).toBe(true);
    }
  });

  test("the bindings are ACTIVE and authorizing — a hat is worn, not owned", async () => {
    report = await runOrgRuntime(deps());
    const warmed = Math.max(...report.bindings.map((b) => b.warmupEndsMs));
    for (const b of report.bindings) {
      expect(b.phase).toBe(BindingPhase.Active);
      expect(isAuthorizing(b, warmed)).toBe(true);
      // …and they will expire. A binding with no end is ownership.
      expect(isAuthorizing(b, b.expiresMs)).toBe(false);
    }
  });

  test("5. SCHEDULE — assignees are booked and the accountable chain met", async () => {
    report = await runOrgRuntime(deps());
    const work = report.calendar.blocks.filter((b) => b.blockType === "prioritized_work");
    const meeting = report.calendar.blocks.filter((b) => b.blockType === "meeting");
    expect(work).toHaveLength(2);
    expect(meeting).toHaveLength(4); // lead, manager, director, C-suite
    expect(new Set(meeting.map((m) => `${m.startMs}..${m.endMs}`)).size).toBe(1);
  });

  test("6. THE DEV'S OWN LOOP was offered its work and picked it", async () => {
    report = await runOrgRuntime(deps());
    expect(report.loopTicks).toHaveLength(2);
    for (const t of report.loopTicks) {
      expect(t.offered).toBeGreaterThan(0);
      expect(t.pickedWorkId).toBeDefined();
    }
    // ONE TICK PER HAT, not per agent: this agent wears two, and each tick names which.
    expect(new Set(report.loopTicks.map((t) => t.hatId)).size).toBe(2);
    // …and each picked its OWN task, not the same one twice.
    expect(new Set(report.loopTicks.map((t) => t.pickedWorkId)).size).toBe(2);
  });

  test("7. MARKET — every shard was claimed, completed, approved by someone else, and merged", async () => {
    report = await runOrgRuntime(deps());
    expect(report.queue.shards).toHaveLength(2);
    for (const s of report.queue.shards) expect(s.state).toBe(ShardState.Merged);
    expect(report.queueReadout.merged).toBe(2);
    // The approver is never the claimant — the quorum rule.
    for (const a of report.queue.approvals) {
      const claimant = report.queue.claims.find((c) => c.shardId === a.shardId);
      expect(a.byAgentId).not.toBe(claimant?.ownerAgentId);
    }
  });

  test("8. QA — real cases derived from the criteria, and they ran", async () => {
    report = await runOrgRuntime(deps());
    // Two leaves, each running at qa_uat AND runtime_validation.
    expect(report.qa).toHaveLength(4);
    expect(report.testCases.length).toBeGreaterThan(0);
    for (const q of report.qa) {
      expect(q.runs.length).toBeGreaterThan(0);
      expect(q.failed).toBe(0);
    }
  });

  test("9. GATES — all seven, each by an authorized hat outside the delivery line", async () => {
    report = await runOrgRuntime(deps());
    expect(report.gateRuns).toHaveLength(2);
    const taskIdOf = (r: (typeof report.gateRuns)[number]["run"]): string =>
      report.gateRuns.find((g) => g.run === r)?.taskId ?? "";
    for (const { run } of report.gateRuns) {
      expect(run.merged).toBe(true);
      // EACH ITEM'S OWN CHAIN. Asserting fourteen here pinned the model where one implementer
      // walked every gate — the defect the redistribution removed.
      const node = report.cascade.nodes.find((n) => n.workId === taskIdOf(run));
      expect(run.evaluations.length).toBe(chainFor(node?.workType ?? WorkType.Task).length);
      for (const e of run.evaluations) expect(mayEvaluate(chart, e.byHatId, e.gate)).toBe(true);
    }
    const departments = new Set(
      report.gateEvaluations.map((e) => chart.byId.get(e.byHatId)?.departmentId),
    );
    expect(departments.size).toBeGreaterThan(1);
  });

  test("DELIVERY ROLLED UP — nobody marked the goal done", async () => {
    report = await runOrgRuntime(deps());
    expect(nodeById(report.cascade, report.goalWorkId!)?.state).toBe(WorkState.Open);
    expect(isDelivered(report.cascade, report.goalWorkId!)).toBe(true);
  });

  test("succession is planned for every hat that was worn", async () => {
    report = await runOrgRuntime(deps());
    expect(report.succession).toHaveLength(2);
    // The seed's policy is `appoint`, so no successor is invented — an authority decides.
    for (const p of report.succession) expect(p.nextWearerAgentId).toBeUndefined();
  });

  test("NO WALL-CLOCK INSTANT reaches the log of an all-simulated run", async () => {
    // The failure this pins was intermittent and therefore nearly invisible: `meterCall` read an
    // ambient `Date.now()`, so every `metered_call` fact carried a wall-clock `startedMs` and two
    // identical runs differed only when the millisecond happened to tick between them. The test
    // below caught it roughly one run in fifty.
    //
    // This one cannot be lucky: with simulated ports every recorded instant must equal the run's
    // own logical instant, so a wall clock anywhere in the fold fails it every time.
    const report = await runOrgRuntime(deps());
    expect(report.fidelity.replayable).toBe(true);
    const meters = report.trace
      .map((e) => e.fact)
      .filter((f) => f?.kind === "metered_call")
      .map((f) => (f as Extract<NonNullable<typeof f>, { kind: "metered_call" }>).meter);
    expect(meters.length).toBeGreaterThan(0);
    // The PROPERTY is that the instant is logical, not that it equals a particular number — it is
    // the run's warmed instant, and hard-coding that would be testing the fixture's arithmetic.
    // Two things make it logical and neither can be true of a wall clock: every meter shares one
    // instant, and every duration is zero because no real time passed.
    const instants = new Set(meters.map((m) => m.startedMs));
    expect(instants.size).toBe(1);
    for (const m of meters) expect(m.durationMs).toBe(0);
    // Small enough to be the run's own clock rather than a date. A wall clock is ~1.7e12.
    expect([...instants][0]).toBeLessThan(1_000_000_000);
    // And the duration is in the DECISION LINE too, which is what `a.events` compares — the exact
    // path the intermittent failure travelled.
    for (const line of report.events.filter((e) => e.includes("metered"))) {
      expect(line).toContain("0ms");
    }
  });

  test("the runtime is a FUNCTION OF ITS INPUTS", async () => {
    const a = await runOrgRuntime(deps());
    const b = await runOrgRuntime(deps());
    expect(a.events).toEqual(b.events);
    expect(a.cascade).toEqual(b.cascade);
    expect(a.queue).toEqual(b.queue);
    expect(a.bindings).toEqual(b.bindings);
    expect(a.delivered).toBe(b.delivered);
  });
});

describe("the pipeline refuses at every door it should", () => {
  test("a DUPLICATE report is de-duplicated, not ingested twice", async () => {
    const report = await runOrgRuntime(deps({ externalEvents: [GOOD, { ...GOOD, title: "again" }] }));
    expect(report.intakeAccepted).toHaveLength(1);
    expect(report.intakeRefused.map((r) => r.reason)).toEqual(["duplicate"]);
  });

  test("a defect with NO reproduction never reaches the backlog", async () => {
    const bare: ExternalEvent = { source: "portal", externalId: "T-9", kind: IntakeKind.Defect, title: "broken" };
    const report = await runOrgRuntime(deps({ externalEvents: [bare] }));
    expect(report.intakeAccepted).toHaveLength(0);
    expect(report.intakeRefused[0]?.reason).toBe("missing_reproduction");
    // …and with nothing workable, no goal is invented.
    expect(report.goalWorkId).toBeUndefined();
    expect(report.delivered).toBe(false);
  });

  test("nothing workable means no cascade at all", async () => {
    const report = await runOrgRuntime(deps({ externalEvents: [] }));
    expect(report.cascade.nodes).toHaveLength(0);
    expect(report.refusals.some((r) => r.includes("nothing workable"))).toBe(true);
  });

  test("QA FAILING blocks the gate, and nothing is delivered", async () => {
    // The whole point of wiring QA into runtime validation: the gate reads evidence, so a failing
    // suite cannot be approved by choosing to approve it.
    const report = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    for (const q of report.qa) expect(q.failed).toBeGreaterThan(0);
    expect(report.gateBlocked.length).toBeGreaterThan(0);
    for (const b of report.gateBlocked) expect(b.gate).toBe(GateKind.RuntimeValidation);
    expect(report.delivered).toBe(false);
    // The tasks stay open — the cascade agrees with the gate.
    for (const n of report.cascade.nodes) expect(n.state).toBe(WorkState.Open);
  });

  test("repeated QA failure becomes CHURN and a manager escalates", async () => {
    const report = await runOrgRuntime(
      deps({ qaFallback: RunOutcome.Failed, churnThreshold: 2, maxGateAttempts: 5 }),
    );
    expect(report.escalations.length).toBeGreaterThan(0);
    for (const e of report.escalations) {
      expect(chart.byId.get(e.byHatId)?.level).toBe("manager");
      expect(["changes_the_input", "halts_the_loop"]).toContain(e.effect);
    }
    // The loop STOPPED rather than running to the attempt bound.
    for (const taskId of new Set(report.gateRuns.map((g) => g.taskId))) {
      expect(report.gateRuns.filter((g) => g.taskId === taskId).length).toBe(2);
    }
  });

  test("a goal accepted below the C-suite is refused, and the pipeline stops", async () => {
    const report = await runOrgRuntime(deps({ acceptingHatId: "engineering_manager" }));
    expect(report.refusals.some((r) => r.includes("accepted at the top"))).toBe(true);
    expect(report.cascade.nodes).toHaveLength(0);
    expect(report.delivered).toBe(false);
  });

  test("a LEAD cannot set priority, so nothing becomes workable", async () => {
    const report = await runOrgRuntime(deps({ priorityDeciderHatId: "tech_lead" }));
    expect(report.priorities).toHaveLength(0);
    expect(report.refusals.some((r) => r.includes("raise a signal"))).toBe(true);
    expect(report.delivered).toBe(false);
  });

  test("with NO agents nothing can be staffed, and the refusals name why", async () => {
    const report = await runOrgRuntime(deps({ agents: [] }));
    expect(report.bindings).toHaveLength(0);
    expect(report.refusals.some((r) => r.includes("no eligible candidate"))).toBe(true);
    expect(report.delivered).toBe(false);
  });

  test("a gate nobody owns blocks delivery rather than waving it through", async () => {
    const stripped = buildOrgChart(
      SEED_HATS.map((h) =>
        h.approvalScopes === undefined
          ? h
          : { ...h, approvalScopes: h.approvalScopes.filter((s) => s !== GateKind.ReleaseReadiness) },
      ),
    );
    expect(stripped.ok).toBe(true);
    if (!stripped.ok) return;
    const report = await runOrgRuntime(deps({ chart: stripped.chart }));
    expect(report.delivered).toBe(false);
    expect(report.refusals.some((r) => r.includes("no hat holds the approval scope"))).toBe(true);
  });
});

describe("reputation actually steers the staffing", () => {
  test("an agent with a better record on the hat is chosen over one with a worse one", async () => {
    const hatId = "backend_implementer";
    const observations = [
      ...Array.from({ length: 10 }, () => ({
        agentId: "good",
        hatId,
        outcomeClass: "quality" as const,
        success: true,
        atMs: 0,
      })),
      ...Array.from({ length: 10 }, () => ({
        agentId: "bad",
        hatId,
        outcomeClass: "quality" as const,
        success: false,
        atMs: 0,
      })),
    ];
    const report = await runOrgRuntime(
      deps({
        agents: [
          { agentId: "bad", hatId: "backend_implementer" },
          { agentId: "good", hatId: "backend_implementer" },
        ],
        observations,
      }),
    );
    const wearer = report.bindings.find((b) => b.hatId === hatId)?.wearerAgentId;
    expect(wearer).toBe("good");
  });
});

describe("the readouts the RMO reads", () => {
  test("gate staffing lists a real owner for every gate", () => {
    const staffing = gateStaffing(chart);
    for (const gate of ORDERED_GATES) {
      expect(staffing[gate]?.length).toBeGreaterThan(0);
      for (const hatId of staffing[gate]!) expect(mayEvaluate(chart, hatId, gate)).toBe(true);
    }
  });

  test("staffing readout names every exclusion", () => {
    const r = staffingReadout(chart, "backend_implementer", agentsFromChart(chart), [], 0);
    expect(r).toBeDefined();
    expect(r!.eligible.length).toBeGreaterThan(0);
    expect(staffingReadout(chart, "ghost", [], [], 0)).toBeUndefined();
  });
});

describe("the gate consults QA rather than choosing", () => {
  test("FAILING TESTS CANNOT BE APPROVED — there is no caller override left to do it with", async () => {
    // This test used to assert the opposite. It was called "a caller-supplied gate chooser still
    // cannot approve a failing QA run by itself" and then asserted `delivered === true`, with the
    // consolation that the QA report still recorded the failure somewhere. That is the shape this
    // register spent three passes removing — a verdict computed rather than earned — preserved as a
    // documented feature.
    //
    // `deps.gateChooser` is gone. Runtime validation reads the evidence, the other six gates read
    // the review port, and neither answers to a caller who would rather ship.
    const report = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    expect(report.delivered).toBe(false);

    // The failure is recorded, AND it is the thing that stopped delivery — not a note beside a
    // green. Both halves matter: the old test had the first without the second.
    for (const q of report.qa) expect(q.failed).toBeGreaterThan(0);
    const runtime = report.gateEvaluations.filter((g) => g.gate === GateKind.RuntimeValidation);
    expect(runtime.length).toBeGreaterThan(0);
    for (const g of runtime) expect(g.outcome).not.toBe(GateOutcome.Approved);
  });

  test("...and a PASSING run still delivers, so the guarantee above is not just a blanket refusal", async () => {
    // Without this, the test above would pass equally well against a runtime that never delivers
    // anything — the vacuity class wearing a safety guarantee.
    const report = await runOrgRuntime(deps());
    expect(report.delivered).toBe(true);
  });
});

describe("three properties the happy path cannot show", () => {
  test("PAUSED work is not cascaded — the priority decision actually gates the pipeline", async () => {
    // Nothing in the default run is ever paused, so `workable` and the raw order agree and the
    // filter is untested. Pausing the only item is what separates them.
    const report = await runOrgRuntime(
      deps({
        priorityChooser: (legal) => ({
          index: legal.indexOf(PriorityClass.Paused),
          reason: "stopped for now",
        }),
      }),
    );
    expect(report.priorities[0]?.priorityClass).toBe(PriorityClass.Paused);
    expect(report.goalWorkId).toBeUndefined();
    expect(report.cascade.nodes).toHaveLength(0);
    expect(report.refusals.some((r) => r.includes("nothing workable"))).toBe(true);
  });

  test("THE AGENT THAT PICKED THE WORK IS THE ONE THAT CLAIMS IT", async () => {
    // With one agent wearing both hats, "the agent that picked it" and "the first wearer" are the
    // same and the market/loop link is invisible. Two distinct agents make them differ.
    const report = await runOrgRuntime(
      deps({
        agents: [
          { agentId: "alice", hatId: "backend_implementer" },
          { agentId: "bob", hatId: "frontend_implementer" },
          { agentId: "carol", hatId: "qa_engineer" },
        ],
        observations: [
          // Steer each agent to its own hat, so the two hats land on two different wearers.
          ...Array.from({ length: 6 }, () => ({
            agentId: "alice", hatId: "backend_implementer", outcomeClass: "quality" as const, success: true, atMs: 0,
          })),
          ...Array.from({ length: 6 }, () => ({
            agentId: "bob", hatId: "frontend_implementer", outcomeClass: "quality" as const, success: true, atMs: 0,
          })),
        ],
      }),
    );

    const wearers = new Set(report.bindings.map((b) => b.wearerAgentId));
    expect(wearers.size).toBe(2);

    // Each loop tick picked a distinct task…
    const picks = new Map(report.loopTicks.map((t) => [t.pickedWorkId, t.agentId]));
    expect(picks.size).toBe(2);

    // …and each shard was claimed by the agent whose tick picked that work.
    for (const shard of report.queue.shards) {
      const claim = report.queue.claims.find((c) => c.shardId === shard.shardId);
      expect(claim?.ownerAgentId).toBe(picks.get(shard.workId));
    }
  });

  test("A STAFFING HOLE stops after ONE attempt and never escalates", async () => {
    // Retrying cannot fill a gate nobody owns, and escalating on it would report a broken loop
    // where the loop never ran.
    const stripped = buildOrgChart(
      SEED_HATS.map((h) =>
        h.approvalScopes === undefined
          ? h
          : { ...h, approvalScopes: h.approvalScopes.filter((s) => s !== GateKind.ReleaseReadiness) },
      ),
    );
    expect(stripped.ok).toBe(true);
    if (!stripped.ok) return;

    const report = await runOrgRuntime(
      deps({ chart: stripped.chart, churnThreshold: 1, maxGateAttempts: 5 }),
    );
    expect(report.escalations).toEqual([]);
    for (const taskId of new Set(report.gateRuns.map((g) => g.taskId))) {
      expect(report.gateRuns.filter((g) => g.taskId === taskId).length).toBe(1);
    }
    expect(report.delivered).toBe(false);
  });
});

describe("the runtime projects its work onto a real CHANGE", () => {
  test("delivered work reaches Merged, and the records do not disagree", async () => {
    const report = await runOrgRuntime(deps());
    // ONE change, not two. The run's leaves are a defect and a `review`; only the defect writes
    // code, so only it becomes a change. A verification task has no branch — projecting one for it
    // produced an empty change that the real git port then refused to merge.
    expect(report.changes).toHaveLength(1);
    for (const c of report.changes) {
      expect(c.projection.state.tag).toBe("Merged");
      expect(c.disagreements).toEqual([]);
      expect(c.projection.refused).toEqual([]);
    }
    // A disagreement is a REFUSAL, not a log line.
    expect(report.refusals.filter((r) => r.includes("change control"))).toEqual([]);
  });

  test("rejected work does NOT reach Merged", async () => {
    const report = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    for (const c of report.changes) {
      expect(c.projection.state.tag).not.toBe("Merged");
      expect(c.projection.terminal).toBe(false);
      expect(c.disagreements).toEqual([]);
    }
  });

  test("unstaffed work never leaves Backlog", async () => {
    const report = await runOrgRuntime(deps({ agents: [] }));
    for (const c of report.changes) expect(c.projection.state.tag).toBe("Backlog");
  });
});

/** A producer that writes one named reference. Shared: two suites need the same fixture. */
const stubProducer = (ref: string): ProducerPort => ({
  meta: { port: Port.WorkExecution, name: "stub", fidelity: Fidelity.Real, describes: `writes ${ref}` },
  produce: async () => ({ ok: true, value: { refs: [ref], summary: ref }, evidence: [{ kind: "document", ref }] }),
});

describe("A CALLER MAY GIVE A PRE-CODE GATE SOMETHING TO JUDGE", () => {
  test("the produced artifact becomes the GATE'S OWN EVIDENCE, not a note beside it", async () => {
    // Without this the reviewer at brd_approval is shown nothing and its approval means nothing.
    const report = await runOrgRuntime(deps({
      artifactProducers: new Map([[GateKind.BrdApproval, stubProducer("docs/brd.md")]]),
    }));
    const brd = report.gateEvaluations.filter((e) => e.gate === GateKind.BrdApproval);
    expect(brd.length).toBeGreaterThan(0);
    expect(brd.some((e) => e.evidenceRefs.includes("docs/brd.md"))).toBe(true);
  });

  test("a caller CANNOT unhook work execution by claiming its gate", async () => {
    // The runtime's own producers are not a caller's to remove. If this merge went the other way, a
    // caller could silently replace the thing that does the work with one that writes a document,
    // and the run would still report every gate crossed.
    const report = await runOrgRuntime(deps({
      artifactProducers: new Map([
        [GateKind.ImplementationReview, stubProducer("docs/not-the-work.md")],
        [GateKind.RuntimeValidation, stubProducer("docs/not-the-tests.md")],
      ]),
    }));
    expect(report.delivered).toBe(true);
    const impl = report.gateEvaluations.filter((e) => e.gate === GateKind.ImplementationReview);
    expect(impl.some((e) => e.evidenceRefs.includes("docs/not-the-work.md"))).toBe(false);
  });
});

describe("STOPPING FOR A PERSON IS A PAUSE, NEVER A ROLLBACK", () => {
  // The defect this pins was shipped and then found by looking at a real store: the wait broke out
  // of the attempt loop BEFORE the recording step, so a task that had passed two gates and then
  // stopped for a person recorded neither of them. The dashboard read `0/14` beside work that was
  // two gates in, and a resumed run would have re-crossed gates it had already crossed — paying for
  // the same reviews twice and, worse, giving a second answer where one already existed.

  test("with a checkpoint and nobody to answer, the run reports what it is waiting for", async () => {
    const report = await runOrgRuntime(deps({ checkpoints: ["grooming"] }));
    expect(report.awaitingHuman.length).toBeGreaterThan(0);
    expect(report.awaitingHuman.every((w) => String(w.gate) === "brd_approval")).toBe(true);
  });

  test("WAITING IS NOT FAILING — it is reported apart from a blocked gate", async () => {
    const report = await runOrgRuntime(deps({ checkpoints: ["grooming"] }));
    // Folding the two together would make an organization waiting politely for its operator
    // indistinguishable from one that kept failing its own reviews, and the second reads as broken.
    expect(report.gateBlocked).toEqual([]);
  });

  test("THE GATES ALREADY PASSED ARE KEPT, not discarded with the pause", async () => {
    const report = await runOrgRuntime(deps({ checkpoints: ["grooming"] }));
    const kept = report.gateEvaluations.filter((e) => e.gate === "business_context_grooming");
    expect(kept.length).toBeGreaterThan(0);
    // And nothing past the checkpoint was crossed — the pause is real in the other direction too.
    expect(report.gateEvaluations.some((e) => e.gate === "brd_approval")).toBe(false);
  });

  test("...and they reach the LOG, so a resumed run does not redo them", async () => {
    const events: OrgEvent[] = [];
    await runOrgRuntime(deps({ checkpoints: ["grooming"], onEvent: (e) => events.push(e) }));
    const recorded = events
      .filter((e) => e.fact?.kind === "gates_evaluated")
      .flatMap((e) => (e.fact?.kind === "gates_evaluated" ? e.fact.evaluations : []));
    expect(recorded.some((e) => e.gate === "business_context_grooming")).toBe(true);
  });

  test("A PERSON'S APPROVAL RELEASES IT and the run delivers", async () => {
    const report = await runOrgRuntime(
      deps({
        checkpoints: ["grooming"],
        humanDecisionFor: () => ({ outcome: GateOutcome.Approved, actionRef: "human-action/ha-1" }),
      }),
    );
    expect(report.awaitingHuman).toEqual([]);
    expect(report.delivered).toBe(true);
  });

  test("A CHECKPOINT MAY NAME A GATE: a defect stops for a person at release_readiness, its QA already done", async () => {
    // The two NAMED checkpoints stop at brd_approval and architecture_approval, and a defect owes
    // neither — so no person could ever sign a defect off. MEASURED on the Agentic Team's first run.
    const report = await runOrgRuntime(deps({ checkpoints: ["release_readiness"] }));
    const waits = report.awaitingHuman.filter((w) => String(w.gate) === "release_readiness");
    expect(waits.length).toBeGreaterThan(0);
    // It stops AFTER the evidence a person would sign on, not before it.
    const leaf = waits[0]?.taskId;
    expect(report.gateEvaluations.some((e) => e.workId === leaf && e.gate === "qa_uat")).toBe(true);
    expect(report.gateEvaluations.some((e) => e.workId === leaf && e.gate === "release_readiness")).toBe(false);
    expect(report.delivered).toBe(false);
  });

  test("WITH NO CHECKPOINTS NOTHING WAITS — the default is unchanged", async () => {
    const report = await runOrgRuntime(deps());
    expect(report.awaitingHuman).toEqual([]);
  });

  test("a completed task's own log line names the REAL number of gates", async () => {
    // It said "passed all 7 gates" while the chain held fourteen — a literal written beside a list
    // that grew. Nothing read it, so nothing caught it; the only reader is a person, and a log that
    // lies to a person about how much was checked is the worst place for a stale constant.
    const events: OrgEvent[] = [];
    const report = await runOrgRuntime(deps({ onEvent: (e) => events.push(e) }));
    const done = events.filter((e) => e.decision?.includes("passed all"));
    expect(done.length).toBeGreaterThan(0);
    // The line now names the item's OWN chain — "passed all 4 gate(s) this defect owes (...)" —
    // because "all 14" was false for every item once each type walked its own gates, and a
    // decision line that misreports what was satisfied is a record nobody can audit against.
    for (const e of done) {
      const node = report.cascade.nodes.find((n: { workId: string }) => n.workId === e.subjectId);
      const owed = chainFor(node?.workType ?? WorkType.Task);
      expect(e.decision).toContain(`all ${String(owed.length)} gate(s) this ${String(node?.workType)} owes`);
      for (const g of owed) expect(e.decision).toContain(String(g));
    }
  });
});

describe("WHAT A PHASE MADE REACHES THE LOG — a writer with no reader is not a feature", () => {
  // The gap this closes: `runPipeline` produced an artifact for every phase, the report carried it,
  // and NONE of it was written to the log — so it died with the process. An observer could report
  // that `brd_approval` was approved and could not show the BRD, or say whether one existed. A
  // person asked to sign that gate was being asked to sign a gate NAME.

  test("a producer's output is written as a fact, with the reference it produced", async () => {
    const events: OrgEvent[] = [];
    await runOrgRuntime(
      deps({
        artifactProducers: new Map([[GateKind.BrdApproval, stubProducer("docs/brd.md")]]),
        onEvent: (e) => events.push(e),
      }),
    );
    const outputs = events.filter((e) => e.fact?.kind === "phase_output");
    expect(outputs.length).toBeGreaterThan(0);
    const brd = outputs.find((e) => e.fact?.kind === "phase_output" && e.fact.gate === GateKind.BrdApproval);
    expect(brd).toBeDefined();
    if (brd?.fact?.kind === "phase_output") {
      expect(brd.fact.refs).toContain("docs/brd.md");
      expect(brd.fact.workId.length).toBeGreaterThan(0);
    }
  });

  test("...and the reference travels on the EVENT too, so a trace reader sees it", async () => {
    const events: OrgEvent[] = [];
    await runOrgRuntime(
      deps({
        artifactProducers: new Map([[GateKind.BrdApproval, stubProducer("docs/brd.md")]]),
        onEvent: (e) => events.push(e),
      }),
    );
    const brd = events.find((e) => e.fact?.kind === "phase_output");
    expect(brd?.evidenceRefs).toContain("docs/brd.md");
  });

  test("A GATE WITH NO PRODUCER WRITES NO OUTPUT — absence is the honest record", async () => {
    // Not an empty artifact per gate. An empty output would let a page render "here is what was
    // made" over nothing, which is worse than saying nothing was made — and it is exactly what
    // turns an Approve button into a rubber stamp.
    const events: OrgEvent[] = [];
    await runOrgRuntime(deps({ onEvent: (e) => events.push(e) }));
    const gates = events
      .filter((e) => e.fact?.kind === "phase_output")
      .map((e) => (e.fact?.kind === "phase_output" ? e.fact.gate : ""));
    expect(gates).not.toContain(String(GateKind.BrdApproval));
    expect(gates).not.toContain(String(GateKind.ArchitectureDesign));
  });

  test("...while the runtime's OWN producers do write theirs", async () => {
    // The other half of the same property. If this were empty too, the writer would be dead and the
    // three tests above would be asserting over a channel nothing uses.
    const events: OrgEvent[] = [];
    await runOrgRuntime(deps({ onEvent: (e) => events.push(e) }));
    const gates = events
      .filter((e) => e.fact?.kind === "phase_output")
      .map((e) => (e.fact?.kind === "phase_output" ? e.fact.gate : ""));
    expect(gates).toContain(String(GateKind.RuntimeValidation));
  });

  test("A SIMULATED PHASE SAYS SO IN ITS OWN SUMMARY, and that reaches the page", async () => {
    // `implementation_review` under a simulated work executor produces an artifact whose summary is
    // "assumed complete — no work was performed". That sentence is the most useful thing on an
    // approval card, and until this fact existed it never left the process.
    const events: OrgEvent[] = [];
    await runOrgRuntime(deps({ onEvent: (e) => events.push(e) }));
    const impl = events.find(
      (e) => e.fact?.kind === "phase_output" && e.fact.gate === String(GateKind.ImplementationReview),
    );
    expect(impl?.fact?.kind === "phase_output" ? impl.fact.summary : "").toContain("no work was performed");
  });
});

describe("WHAT ASKED FOR THE WORK SURVIVES THE RUN", () => {
  // Intake mints a collision-proof key and, until the cascade carried it, dropped it one function
  // later — so the organization produced a goal and seven descendants and could not answer "what did
  // we do about this request" from its own work, in any run, ever.

  test("the goal records the request it answers", async () => {
    const report = await runOrgRuntime(deps());
    const goal = report.cascade.nodes.find((n) => n.parentWorkId === undefined);
    expect(goal?.requestRef).toBeDefined();
    expect(parseRequestRef(goal!.requestRef!)?.source).toBe(GOOD.source);
    expect(parseRequestRef(goal!.requestRef!)?.externalId).toBe(GOOD.externalId);
  });

  test("EVERY RUNG INHERITS IT, including the tasks somebody actually does", async () => {
    // A goal that knows and a task that does not is a label on a tree, not a spine — and the page
    // that matters reads the leaves.
    const report = await runOrgRuntime(deps());
    expect(report.cascade.nodes.length).toBeGreaterThan(3);
    expect(report.cascade.nodes.every((n) => n.requestRef !== undefined)).toBe(true);
  });

  test("...and it reaches the LOG, so a resumed organization still knows", async () => {
    const events: OrgEvent[] = [];
    await runOrgRuntime(deps({ onEvent: (e) => events.push(e) }));
    const created = events.filter((e) => e.fact?.kind === "work_created");
    expect(created.length).toBeGreaterThan(3);
    expect(
      created.every((e) => e.fact?.kind === "work_created" && e.fact.requestRef !== undefined),
    ).toBe(true);
  });

  test("an accepted request is a FACT, not only a sentence", async () => {
    const events: OrgEvent[] = [];
    await runOrgRuntime(deps({ onEvent: (e) => events.push(e) }));
    const accepted = events.find((e) => e.fact?.kind === "intake_accepted");
    expect(accepted).toBeDefined();
    if (accepted?.fact?.kind === "intake_accepted") {
      expect(accepted.fact.item.externalRef).toBe(externalRefOf(GOOD.source, GOOD.externalId));
    }
  });

  test("A DECLINED REQUEST IS ALSO A FACT — somebody filed it and is owed the answer", async () => {
    // Intake refuses duplicates and defects with no reproduction steps, and both were prose in a
    // run's refusal list. The person who filed one is waiting and, until this fact existed, there
    // was nowhere the answer could be shown.
    const events: OrgEvent[] = [];
    // A defect with no reproduction steps — exactly what `triage` declines at the door.
    const noRepro: ExternalEvent = {
      source: "portal",
      externalId: "T-99",
      kind: IntakeKind.Defect,
      title: "portal is slow sometimes",
      severity: Severity.Low,
    };
    await runOrgRuntime(deps({ externalEvents: [GOOD, noRepro], onEvent: (e) => events.push(e) }));
    const refused = events.filter((e) => e.fact?.kind === "intake_refused");
    expect(refused.length).toBeGreaterThan(0);
    for (const e of refused) {
      if (e.fact?.kind !== "intake_refused") continue;
      expect(e.fact.reason.length).toBeGreaterThan(0);
      expect(e.fact.message.length).toBeGreaterThan(0);
      // Keyed from the raw event, because a refusal has no minted key of its own — and the filer
      // knows the request by its upstream id regardless of whether this organization took it.
      expect(parseRequestRef(e.fact.externalRef ?? "")).toBeDefined();
    }
  });
});

describe("EVERY RUNG RECALLS, NOT ONLY THE LEAVES", () => {
  // THE DEFECT: `recallFor` was called from the LEAF walk only. So the goal, the initiative and the
  // project — the rungs whose entire job is institutional judgement — worked with no memory at all,
  // while the implementer was handed everything the organization had ever learned. That is the
  // governance-walk hole for the fourth time: a facility built once and wired to one of the two
  // walks that need it.
  test("the upper rungs are offered what their hat already knows", async () => {
    const asked: { workId: string; hatId: string }[] = [];
    const report = await runOrgRuntime(
      deps({
        recallFor: (workId: string, hatId: string) => {
          asked.push({ workId, hatId });
          return { text: "", injectedIds: [] };
        },
      }),
    );

    // Non-leaf rungs exist in this run at all — otherwise the assertion below would pass vacuously
    // on an organization that decomposed nothing.
    const upper = report.cascade.nodes.filter((n) => !isLeafType(n.workType));
    expect(upper.length).toBeGreaterThan(0);

    // And each of them was offered recall, under the hat that OWNS the rung. Asking under the
    // wrong hat would return another role's memory, which is worse than returning none.
    for (const node of upper) {
      const forNode = asked.filter((a) => a.workId === node.workId);
      expect(forNode.length).toBeGreaterThan(0);
      expect(forNode.some((a) => a.hatId === node.ownerHatId)).toBe(true);
    }
  });
});

describe("THE PROCESS DECIDES WHERE WORK BRANCHES — through the runtime, not beside it", () => {
  // -- WHY THIS TEST EXISTS ---------------------------------------------------
  // `branch-topology.test.ts` proves the derivation and `practice.test.ts` proves the settings
  // resolve. Neither proves the RUNTIME hands one to the other, and two mutations deleting exactly
  // that pass-through survived the whole suite. That is the shape `Method` shipped in — a resolver
  // with full coverage and nothing calling it — so the assertion here is on what the change-control
  // port was actually asked for.

  /** A change port that records the (branch, base) it was asked to open, and refuses nothing. */
  function recordingChange(): {
    readonly port: OrgRuntimeDeps["providers"] extends undefined ? never : unknown;
    readonly opened: { branch: string; base?: string }[];
  } {
    const opened: { branch: string; base?: string }[] = [];
    const port = {
      meta: { port: Port.ChangeControl, name: "recording", fidelity: Fidelity.Simulated, describes: "records what it is asked to open" },
      open: async (_node: unknown, ctx: { readonly branch: string; readonly base?: string }) => {
        opened.push({ branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }) });
        return {
          ok: true as const,
          value: { changeId: `${ctx.branch}@c`, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }) },
          evidence: [],
        };
      },
      merge: async (handle: { readonly branch: string }) => ({ ok: true as const, value: { changeId: "m", branch: handle.branch }, evidence: [] }),
    };
    return { port: port as never, opened };
  }

  /** Run the pipeline with a recording change port and the given settings. */
  async function basesFor(settings: readonly SettingBinding[]): Promise<{ branch: string; base?: string }[]> {
    const rec = recordingChange();
    const base = deps();
    // THE DEFAULT SET, with only `change` replaced. `deps()` supplies no providers at all — the
    // runtime builds them — so spreading `base.providers` gave an object with one member and the
    // recorder wrapper threw on the missing intake port.
    await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), change: rec.port },
      ...(settings.length === 0 ? {} : { settings }),
    } as OrgRuntimeDeps);
    return rec.opened;
  }

  test("with nothing set, the shape decides and the runtime asks for no base", async () => {
    // The fixture decomposes one request into ONE code item, so nothing collects and every change is
    // cut from the adapter's own trunk — which the runtime expresses by saying nothing.
    const opened = await basesFor([]);
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.every((o) => o.base === undefined)).toBe(true);
  }, 60_000);

  test("A `collect` SETTING REACHES THE PORT as a base", async () => {
    // `collect` on the fixture's project forces a branch the shape rule would not give — so a base
    // appears in what the port was asked for, and it could only have come through the runtime.
    const opened = await basesFor([
      {
        setting: ProcessSetting.IntegrationBranch,
        value: "collect",
        scope: "T-1",
        why: "this epic will grow and we want one MR for it from the start",
        // SCOPED BY TICKET, which also proves ticket-matching survives the trip: the fixture mints
        // its own work ids and an operator has never seen them.
      },
    ]);
    expect(opened.length).toBeGreaterThan(0);
    const withBase = opened.filter((o) => o.base !== undefined);
    expect(withBase.length).toBeGreaterThan(0);
    // Named after the collection, not after an internal id.
    expect(withBase[0]?.base).toContain("feature/");
  }, 60_000);

  test("...and a `direct` SETTING takes it away again — with its own control", async () => {
    // THE CONTROL IS IN THE TEST, because "no base appeared" is also what an unconfigured run
    // produces. Without the first half this would pass on a runtime that ignored settings entirely.
    const everything: SettingBinding[] = [
      { setting: ProcessSetting.IntegrationBranch, value: "collect", why: "this team works on feature branches" },
    ];
    const withBranches = await basesFor(everything);
    expect(withBranches.some((o) => o.base !== undefined)).toBe(true);

    // …and one ticket pulled back out of it.
    const pulledOut = await basesFor([
      ...everything,
      { setting: ProcessSetting.IntegrationBranch, value: "direct", scope: "T-1", why: "this one ships on its own" },
    ]);
    expect(pulledOut.every((o) => o.base === undefined)).toBe(true);
  }, 60_000);

  // -- WHAT THIS BLOCK DOES NOT PROVE, stated rather than implied --------------
  // Mutation-checked: 16 of 17 mutations go red. The survivor is deleting the `settings` pass-through
  // on the COLLECTION-LANDING call, one line below the branching one proven above.
  //
  // It is unreachable from this harness. Landing a collection needs the collection itself Done with
  // every code item under it Done, and a change port of REAL fidelity; this fixture's project is
  // still `open` after a cycle, and seeding a fully-Done `priorCascade` did not reach it either. The
  // rule itself is covered in `branch-topology.test.ts` — `collectionsReadyToLand` with and without a
  // `direct` setting — so what is unproven is narrowly that the RUNTIME hands its settings to it.
  //
  // Recorded because an unfalsifiable line is worth knowing about, and because the honest place to
  // close it is an end-to-end run over real git where a feature branch actually lands.
});


describe("THE ORGANIZATION'S OWN ANSWER TO AN UNREPRODUCED DEFECT reaches the work", () => {
  // Intake can admit a defect with its reproduction OWED — but that is worth nothing unless the
  // runtime passes the setting to triage AND the agent is told the reproduction is its first job.
  const unreproduced: ExternalEvent = {
    source: "jira",
    externalId: "AIAGENT-1658",
    kind: IntakeKind.Defect,
    title: "archiving a non-latest session closes the latest instead",
    body: "When you have multiple sessions and you archive one that isn't the most recent, it closes the last one.",
    parentExternalId: "AIAGENT-796",
    parentTitle: "Dev Portal catch-all",
    severity: Severity.Medium,
    evidenceRefs: ["https://example.atlassian.net/browse/AIAGENT-1658"],
  };
  const reproduceFirst: SettingBinding = {
    setting: ProcessSetting.UnreproducedDefects,
    value: "reproduce_first",
    why: "our defect practice starts by reproducing — we do not bounce the ticket back",
  };

  test("unset, it is refused — and the refusal is a fact", async () => {
    const events: OrgEvent[] = [];
    const report = await runOrgRuntime(deps({ externalEvents: [unreproduced], onEvent: (e) => events.push(e) }));
    expect(report.cascade.nodes.length).toBe(0);
    expect(events.some((e) => e.fact?.kind === "intake_refused")).toBe(true);
  }, 60_000);

  test("with `reproduce_first`, it is admitted, and EVERY RUNG is told what the requester wrote", async () => {
    const report = await runOrgRuntime(deps({ externalEvents: [unreproduced], settings: [reproduceFirst] }));
    expect(report.cascade.nodes.length).toBeGreaterThan(0);
    for (const n of report.cascade.nodes) {
      expect(n.brief).toContain("closes the last one");
      // The parent the ticket was filed under — what branching settings key on.
      expect(n.brief).toContain("AIAGENT-796");
      // The FACT that no steps came with it — but not an instruction to reproduce. That obligation is
      // the defect's own `reproduction` step; copied onto every rung it made a reviewer reject the
      // goal's grooming for not reproducing the bug (measured on the rehearsal run).
      expect(n.brief).toContain("No reproduction steps were supplied");
      expect(n.brief).not.toContain("is the first step");
    }
    const defect = report.cascade.nodes.find((n) => n.workType === WorkType.Defect);
    expect(chainOf(defect ?? WorkType.Defect)[0]).toBe(GateKind.Reproduction);
  }, 60_000);

  test("a defect that CAME with a reproduction is not told it owes one", async () => {
    const withSteps: ExternalEvent = { ...unreproduced, externalId: "AIAGENT-1", reproduction: "1. archive session 2 of 3" };
    const report = await runOrgRuntime(deps({ externalEvents: [withSteps], settings: [reproduceFirst] }));
    expect(report.cascade.nodes.length).toBeGreaterThan(0);
    expect(report.cascade.nodes.every((n) => !(n.brief ?? "").includes("No reproduction steps were supplied"))).toBe(true);
  }, 60_000);
});

describe("A DEFECT IS REPRODUCED BEFORE IT IS FIXED — as a gate, not a sentence", () => {
  // User direction 2026-09-10: a defect with no steps is reproduced by QA (read the code; if the
  // cause is not plain, run the program) and the steps and a failing test exist BEFORE the fix.
  // Before this the only trace of that obligation was a line in the brief.

  /** Records every step, in order, and what the fixer was handed. */
  function recorder() {
    const order: string[] = [];
    const handed: (readonly { gate: string; refs: readonly string[] }[] | undefined)[] = [];
    const reproduce: ProducerPort = {
      meta: { port: Port.WorkExecution, name: "qa-repro", fidelity: Fidelity.Real, describes: "reproduces" },
      produce: async (node) => {
        order.push(`reproduce:${node.workId}`);
        return { ok: true, value: { refs: ["tests/repro.test.ts"], summary: "fails on the unfixed code" }, evidence: [] };
      },
    };
    const work = {
      meta: { port: Port.WorkExecution, name: "fixer", fidelity: Fidelity.Real, describes: "fixes" },
      execute: async (node: { workId: string }, ctx: { readonly priorPhases?: readonly { gate: string; refs: readonly string[] }[] }) => {
        order.push(`fix:${node.workId}`);
        handed.push(ctx.priorPhases);
        return { ok: true as const, value: { workId: node.workId, succeeded: true, artifacts: ["src/fix.ts"], summary: "fixed" }, evidence: [] };
      },
    };
    return { order, handed, reproduce, work };
  }

  test("the defect's chain owes reproduction, first, and a task's does not", () => {
    expect(chainFor(WorkType.Defect)[0]).toBe(GateKind.Reproduction);
    expect(chainFor(WorkType.Defect).indexOf(GateKind.Reproduction)).toBeLessThan(
      chainFor(WorkType.Defect).indexOf(GateKind.ImplementationReview),
    );
    expect(chainFor(WorkType.Task)).not.toContain(GateKind.Reproduction);
    // An incident may not repeat on demand — the register already says so at intake.
    expect(chainFor(WorkType.Incident)).not.toContain(GateKind.Reproduction);
  });

  test("QA may evaluate it; somebody owns it, so it cannot block delivery by being orphaned", () => {
    expect(mayEvaluate(chart, "qa_engineer", GateKind.Reproduction)).toBe(true);
    expect(mayEvaluate(chart, "reproducibility_analyst", GateKind.Reproduction)).toBe(true);
  });

  test("REPRODUCTION RUNS BEFORE THE FIX, and the fixer is HANDED the reproduction", async () => {
    const rec = recorder();
    const base = deps();
    const report = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), work: rec.work as never },
      artifactProducers: new Map([[GateKind.Reproduction, rec.reproduce]]),
    } as OrgRuntimeDeps);
    const r = rec.order.findIndex((s) => s.startsWith("reproduce:"));
    const f = rec.order.findIndex((s) => s.startsWith("fix:"));
    expect(r).toBeGreaterThanOrEqual(0);
    expect(f).toBeGreaterThan(r);
    // What the reproduction wrote reaches the agent that writes the fix.
    const first = rec.handed[0] ?? [];
    expect(first.some((p) => p.gate === GateKind.Reproduction && p.refs.includes("tests/repro.test.ts"))).toBe(true);
    // …and it is the gate's own evidence, so a reviewer of the reproduction sees the test.
    expect(
      report.gateEvaluations.some((e) => e.gate === GateKind.Reproduction && e.evidenceRefs.includes("tests/repro.test.ts")),
    ).toBe(true);
  }, 60_000);

  test("A REPRODUCTION THAT DOES NOT HOLD STOPS THE WORK — nothing is fixed", async () => {
    const rec = recorder();
    const base = deps();
    const rejectsReproduction = {
      meta: { port: Port.Review, name: "strict", fidelity: Fidelity.Real, describes: "rejects reproduction" },
      review: async (req: { gate: GateKind }) => ({
        ok: true as const,
        value:
          req.gate === GateKind.Reproduction
            ? { outcome: GateOutcome.Rejected, reason: "could not make it happen: behaviour matches the spec" }
            : { outcome: GateOutcome.Approved, reason: "ok" },
        evidence: [],
      }),
    };
    const report = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), work: rec.work as never, review: rejectsReproduction as never },
      artifactProducers: new Map([[GateKind.Reproduction, rec.reproduce]]),
    } as OrgRuntimeDeps);
    expect(rec.order.some((s) => s.startsWith("reproduce:"))).toBe(true);
    expect(rec.order.some((s) => s.startsWith("fix:"))).toBe(false);
    expect(report.delivered).toBe(false);
    // …and NOTHING VERIFIES the change that was never implemented (measured on the rehearsal: a
    // verify leaf reviewed a branch with no commits).
    const verify = report.cascade.nodes.find((n) => n.workType === WorkType.Review);
    expect(report.gateEvaluations.some((e) => e.workId === verify?.workId)).toBe(false);
    expect(report.refusals.some((r) => r.includes("nothing in it yet to verify"))).toBe(true);
  }, 60_000);
});

describe("A DEFECT'S RUNGS MAY OWE ONLY THE WORK'S OWN GATES — a setting, recorded on the node", () => {
  // MEASURED: one defect cost 18 gate evaluations under the full ladder — a BRD, a cost ruling and
  // four architecture gates to fix one bug. `defect_governance=leaf_only` keeps the rungs (somebody
  // is accountable) and drops their document gates; the decision is made once and RECORDED.
  const { upperRungChainFor } = require("./org-runtime") as typeof import("./org-runtime");
  const leafOnly: SettingBinding = { setting: ProcessSetting.DefectRungGates, value: "none", why: "defects follow the defect practice" };
  const item = (over: Record<string, unknown> = {}) =>
    ({ externalRef: externalRefOf("jira", "AIAGENT-1659"), workType: WorkType.Defect, parentExternalId: "AIAGENT-791", ...over }) as never;

  test("it applies to a defect, only when set, and a nearer scope wins", () => {
    expect(upperRungChainFor(item(), [leafOnly])?.owesAt(WorkType.Initiative)).toEqual([]);
    expect(upperRungChainFor(item(), [])).toBeUndefined();
    expect(upperRungChainFor(item({ workType: WorkType.Task }), [leafOnly])).toBeUndefined();
    // A programme keeps the full ladder for its defects — scoped by the EPIC the ticket was filed under.
    const keepFor791: SettingBinding = { setting: ProcessSetting.DefectRungGates, value: "full", scope: "AIAGENT-791", why: "regulated programme" };
    expect(upperRungChainFor(item(), [leafOnly, keepFor791])).toBeUndefined();
  });

  test("under leaf_only the rungs EXIST and are owned, but owe and cross nothing; the defect still does", async () => {
    const events: OrgEvent[] = [];
    const report = await runOrgRuntime(deps({ settings: [leafOnly], onEvent: (e) => events.push(e) }));
    const upper = report.cascade.nodes.filter((n) => !isLeafType(n.workType));
    expect(upper.map((n) => n.workType).sort()).toEqual([WorkType.Goal, WorkType.Initiative, WorkType.Project].sort());
    for (const n of upper) {
      expect(n.owes).toEqual([]);
      expect(report.gateEvaluations.some((e) => e.workId === n.workId)).toBe(false);
    }
    const defect = report.cascade.nodes.find((n) => n.workType === WorkType.Defect);
    expect(report.gateEvaluations.some((e) => e.workId === defect?.workId && e.gate === GateKind.Reproduction)).toBe(true);
    expect(report.delivered).toBe(true);
    // SAID, with the reason, on the record.
    expect(events.some((e) => e.decision.includes("defect_rung_gates=none") && e.decision.includes("defects follow the defect practice"))).toBe(true);
    // …and on the FACT, so the fold agrees with the run.
    const created = events.filter((e) => e.fact?.kind === "work_created" && e.fact.workType !== WorkType.Defect && e.fact.workType !== WorkType.Review);
    expect(created.length).toBe(3);
    expect(created.every((e) => e.fact?.kind === "work_created" && Array.isArray(e.fact.owes) && e.fact.owes.length === 0)).toBe(true);
  }, 60_000);

  test("unset, the full ladder is unchanged — the control", async () => {
    const report = await runOrgRuntime(deps());
    const initiative = report.cascade.nodes.find((n) => n.workType === WorkType.Initiative);
    expect(initiative?.owes).toBeUndefined();
    expect(report.gateEvaluations.some((e) => e.workId === initiative?.workId && e.gate === GateKind.BrdApproval)).toBe(true);
  }, 60_000);
});

describe("THE EXISTING SYSTEM IS UNDERSTOOD BEFORE ANYTHING IS REQUIRED OF IT", () => {
  // User direction 2026-09-10: for any work — feature or defect — the design and business around the
  // affected site are understood first; that is what a BRD and a design are drafted against, and for
  // a defect it is where the upper rungs stop.
  const understandOnly: SettingBinding = {
    setting: ProcessSetting.DefectRungGates,
    value: "business_context_grooming,system_context",
    why: "understand the system around the defect; no BRD or new design for a bug",
  };

  test("every goal owes system_context, right after grooming and before any requirement", () => {
    const goal = chainFor(WorkType.Goal);
    expect(goal.indexOf(GateKind.SystemContext)).toBe(goal.indexOf(GateKind.BusinessContextGrooming) + 1);
    expect(ORDERED_GATES.indexOf(GateKind.SystemContext)).toBeLessThan(ORDERED_GATES.indexOf(GateKind.BrdApproval));
    expect(mayEvaluate(chart, "solution_architect", GateKind.SystemContext)).toBe(true);
  });

  test("a defect under a gate LIST owes exactly those — on the rung that carries each — and still delivers", async () => {
    const report = await runOrgRuntime(deps({ settings: [understandOnly] }));
    const goal = report.cascade.nodes.find((n) => n.workType === WorkType.Goal);
    const initiative = report.cascade.nodes.find((n) => n.workType === WorkType.Initiative);
    const project = report.cascade.nodes.find((n) => n.workType === WorkType.Project);
    expect(goal?.owes).toEqual([GateKind.BusinessContextGrooming, GateKind.SystemContext]);
    expect(initiative?.owes).toEqual([]);
    expect(project?.owes).toEqual([]);
    const onGoal = report.gateEvaluations.filter((e) => e.workId === goal?.workId).map((e) => e.gate);
    expect(new Set(onGoal)).toEqual(new Set([GateKind.BusinessContextGrooming, GateKind.SystemContext]));
    expect(report.gateEvaluations.some((e) => e.gate === GateKind.BrdApproval || e.gate === GateKind.ArchitectureDesign)).toBe(false);
    expect(report.delivered).toBe(true);
  }, 60_000);
});

describe("WHAT A PHASE MADE IS ON THE RECORD BEFORE ANYBODY IS ASKED TO JUDGE IT", () => {
  // MEASURED on the rehearsal run: a reviewer judging from `observe` found "0 attachments — no work
  // has been produced" and rejected the goal twice. Outputs reached the log only after the whole walk,
  // and a governance rung's documents never at all.
  test("at the moment each reviewer is asked, the log already holds the phase output and its document", async () => {
    const events: OrgEvent[] = [];
    const sawAtReview: { gate: string; output: boolean; document: boolean }[] = [];
    const base = deps();
    const watching = {
      meta: { port: Port.Review, name: "watching", fidelity: Fidelity.Real, describes: "checks the record when asked" },
      review: async (req: { gate: GateKind; workId: string }) => {
        const has = (kind: string) =>
          events.some((e) => e.fact?.kind === kind && (e.fact as { workId?: string; gate?: string }).workId === req.workId && (e.fact as { gate?: string }).gate === String(req.gate));
        if (req.gate === GateKind.BusinessContextGrooming || req.gate === GateKind.Reproduction) {
          sawAtReview.push({ gate: String(req.gate), output: has("phase_output"), document: has("document_written") });
        }
        return { ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] };
      },
    };
    await runOrgRuntime({
      ...base,
      onEvent: (e: OrgEvent) => events.push(e),
      providers: { ...defaultProviderSet(base), review: watching as never },
      artifactProducers: new Map([
        [GateKind.BusinessContextGrooming, stubProducer("docs/grooming.md")],
        [GateKind.Reproduction, stubProducer("docs/repro.md")],
      ]),
      documentAt: (ref: string) => (ref.startsWith("docs/") ? { path: ref, bytes: 10 } : undefined),
    } as OrgRuntimeDeps);
    expect(sawAtReview.map((s) => s.gate).sort()).toEqual([GateKind.BusinessContextGrooming, GateKind.Reproduction].sort());
    for (const s of sawAtReview) {
      expect(s.output).toBe(true);
      expect(s.document).toBe(true);
    }
    // …and recorded ONCE, not again after the walk.
    const outputs = events.filter((e) => e.fact?.kind === "phase_output" && (e.fact as { gate: string }).gate === GateKind.Reproduction);
    expect(outputs.length).toBe(1);
  }, 60_000);
});

describe("A STEP THAT PASSED IS NOT WALKED AGAIN — verdicts carry across cycles", () => {
  // MEASURED on AIAGENT-1659 overnight: grooming approved, system_context rejected, and the next cycle
  // produced and reviewed grooming AGAIN — whose second reviewer rejected it.
  test("with system_context turned back once, grooming is produced and reviewed exactly ONCE", async () => {
    const { runUntilSettled } = require("./autonomy") as typeof import("./autonomy");
    const understandOnly: SettingBinding = {
      setting: ProcessSetting.DefectRungGates,
      value: "business_context_grooming,system_context",
      why: "understand, then fix",
    };
    let systemContextAsks = 0;
    let groomingProduced = 0;
    const review = {
      meta: { port: Port.Review, name: "once-strict", fidelity: Fidelity.Real, describes: "turns system_context back once" },
      review: async (req: { gate: GateKind }) => ({
        ok: true as const,
        value:
          req.gate === GateKind.SystemContext && ++systemContextAsks === 1
            ? { outcome: GateOutcome.Rejected, reason: "a cited line does not say what the document claims" }
            : { outcome: GateOutcome.Approved, reason: "ok" },
        evidence: [],
      }),
    };
    const grooming: ProducerPort = {
      meta: { port: Port.WorkExecution, name: "groomer", fidelity: Fidelity.Real, describes: "grooms" },
      produce: async () => {
        groomingProduced += 1;
        return { ok: true, value: { refs: ["docs/grooming.md"], summary: "groomed" }, evidence: [] };
      },
    };
    const base = deps({ settings: [understandOnly] });
    const result = await runUntilSettled(
      {
        ...base,
        providers: { ...defaultProviderSet(base), review: review as never },
        artifactProducers: new Map([[GateKind.BusinessContextGrooming, grooming]]),
      } as OrgRuntimeDeps,
      { maxCycles: 4, nextNowMs: (_c: number, prev: number) => prev + 1 },
      runOrgRuntime,
    );
    const all = result.reports.flatMap((r) => r.gateEvaluations);
    const groomingVerdicts = all.filter((e) => e.gate === GateKind.BusinessContextGrooming);
    expect(systemContextAsks).toBeGreaterThanOrEqual(2); // it WAS turned back and re-walked
    expect(groomingVerdicts.length).toBe(1);
    expect(groomingProduced).toBe(1);
    // …and the work still finishes — prior verdicts count toward "done".
    expect(result.last.delivered).toBe(true);
  }, 120_000);
});

describe("A LEAF'S RETRY RESUMES AT THE STEP THAT WAS TURNED BACK", () => {
  test("implementation turned back once: the reproduction is produced and reviewed exactly ONCE", async () => {
    let reproductions = 0;
    let implAsks = 0;
    const reproduce: ProducerPort = {
      meta: { port: Port.WorkExecution, name: "qa", fidelity: Fidelity.Real, describes: "reproduces" },
      produce: async () => {
        reproductions += 1;
        return { ok: true, value: { refs: ["tests/repro.test.ts"], summary: "fails on the unfixed code" }, evidence: [] };
      },
    };
    const review = {
      meta: { port: Port.Review, name: "impl-once", fidelity: Fidelity.Real, describes: "turns implementation back once" },
      review: async (req: { gate: GateKind }) => ({
        ok: true as const,
        value:
          req.gate === GateKind.ImplementationReview && ++implAsks === 1
            ? { outcome: GateOutcome.Rejected, reason: "the test passes without the fix" }
            : { outcome: GateOutcome.Approved, reason: "ok" },
        evidence: [],
      }),
    };
    const base = deps();
    const report = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), review: review as never },
      artifactProducers: new Map([[GateKind.Reproduction, reproduce]]),
    } as OrgRuntimeDeps);
    expect(implAsks).toBe(2);
    expect(reproductions).toBe(1);
    expect(report.gateEvaluations.filter((e) => e.gate === GateKind.Reproduction).length).toBe(1);
    expect(report.delivered).toBe(true);
  }, 60_000);
});

describe("A CHANGE IS JUDGED ON EVERY VERDICT ITS WORK HAS, NOT THIS CYCLE'S", () => {
  // MEASURED on AIAGENT-1661: reproduction and implementation review passed in one run, QA and
  // release in the next - and the change, projected from the second run's verdicts alone, stopped
  // at InReview. Done in the cascade, every step approved, never merged.
  test("a leaf whose early steps passed before still reaches Merged when the rest pass now", async () => {
    const first = await runOrgRuntime(deps());
    const leaf = first.changes[0]?.workId;
    expect(leaf).toBeDefined();
    const carried = first.gateEvaluations.filter(
      (e) => e.workId === leaf && (e.gate === GateKind.Reproduction || e.gate === GateKind.ImplementationReview),
    );
    expect(carried.length).toBeGreaterThanOrEqual(2);

    const resumed = await runOrgRuntime(deps({ priorGateEvaluations: carried }));
    // The early steps were not walked again...
    expect(resumed.gateEvaluations.some((e) => e.workId === leaf && e.gate === GateKind.ImplementationReview)).toBe(false);
    // ...and the change still reached Merged, because it was judged on all of them.
    expect(resumed.changes.find((c) => c.workId === leaf)?.projection.state.tag).toBe("Merged");
  }, 60_000);

  test("work that already landed is neither walked nor merged again", async () => {
    const first = await runOrgRuntime(deps());
    const leaf = first.changes[0]?.workId ?? "";
    const again = await runOrgRuntime(deps({ alreadyLanded: new Set([leaf]) }));
    expect(again.gateEvaluations.some((e) => e.workId === leaf)).toBe(false);
    expect(again.changesLanded).not.toContain(leaf);
  }, 60_000);
});

describe("A VERDICT IS IN THE RECORD THE MOMENT IT IS MADE", () => {
  // MEASURED on AIAGENT-1661: verdicts reached the log only when the whole walk returned, so the
  // release-readiness author, opening the item through observe mid-walk, was shown QA "rejected"
  // from the attempt before - the approval that let it start was not in the record yet.
  test("when a later step's author runs, the earlier step's verdict is already in the log", async () => {
    const events: OrgEvent[] = [];
    let seenAtAuthoring: string[] | undefined;
    const release: ProducerPort = {
      meta: { port: Port.WorkExecution, name: "rr", fidelity: Fidelity.Real, describes: "release readiness" },
      produce: async (node) => {
        seenAtAuthoring = events
          .filter((e) => e.fact?.kind === "gates_evaluated")
          .flatMap((e) => (e.fact?.kind === "gates_evaluated" ? e.fact.evaluations : []))
          .filter((v) => v.workId === node.workId)
          .map((v) => String(v.gate));
        return { ok: true, value: { refs: ["docs/rr.md"], summary: "ready" }, evidence: [] };
      },
    };
    const base = deps();
    await runOrgRuntime({
      ...base,
      artifactProducers: new Map([[GateKind.ReleaseReadiness, release]]),
      onEvent: (e: OrgEvent) => events.push(e),
    } as OrgRuntimeDeps);
    expect(seenAtAuthoring).toBeDefined();
    expect(seenAtAuthoring).toContain("qa_uat");
    expect(seenAtAuthoring).toContain("runtime_validation");
  }, 60_000);
});

describe("A STEP THAT STOPS WITHOUT A VERDICT SAYS WHY, ON THE ITEM", () => {
  // MEASURED on AIAGENT-1662: the implementation step was turned back with no verdict. The reason
  // lived in the process's `refusals` until it exited, so the log, observe, and the next attempt's
  // author all saw "turned back" and nothing else.
  test("an author that fails leaves its reason in the log against the item it was working", async () => {
    const reproduce: ProducerPort = {
      meta: { port: Port.WorkExecution, name: "qa", fidelity: Fidelity.Real, describes: "reproduces" },
      produce: async () => ({ ok: false, reason: "the agent ran out of turns before writing a test" }),
    };
    const events: OrgEvent[] = [];
    const base = deps();
    await runOrgRuntime({
      ...base,
      artifactProducers: new Map([[GateKind.Reproduction, reproduce]]),
      onEvent: (e: OrgEvent) => events.push(e),
    } as OrgRuntimeDeps);
    const said = events.filter((e) => e.kind === OrgEventKind.Refusal && e.decision.includes("ran out of turns"));
    expect(said.length).toBeGreaterThan(0);
    // Against the leaf, so observe can show it as that item's comment.
    const leafIds = new Set(foldOrganization(events).cascade.nodes.filter((n) => isLeafType(n.workType)).map((n) => n.workId));
    expect(said.every((e) => leafIds.has(e.subjectId))).toBe(true);
    expect(said[0]?.decision).toContain("stopped at reproduction");
  }, 60_000);
});

describe("A HAT CARRIES AS MANY OPEN TASKS AS WEARERS ARE AUTHORIZED FOR IT", () => {
  // MEASURED on the first real run: three tickets, two contributor hats under the lead who owns every
  // leaf — one ticket took both, waited on a person, and the other two were never started.
  const two: ExternalEvent[] = [
    { ...GOOD, externalId: "T-1", title: "checkout double-charges" },
    { ...GOOD, externalId: "T-2", title: "refund posts twice" },
  ];
  const unstaffed = (r: { refusals: readonly string[] }) => r.refusals.filter((x) => x.includes("no free individual-contributor hat")).length;

  test("at the default supply of 1, two requests cannot both be staffed — the control", async () => {
    const report = await runOrgRuntime(deps({ externalEvents: two }));
    expect(unstaffed(report)).toBeGreaterThan(0);
  }, 60_000);

  test("with supply 2, both requests' work is staffed", async () => {
    const report = await runOrgRuntime(deps({ externalEvents: two, supplyTarget: 2 }));
    expect(unstaffed(report)).toBe(0);
    const leaves = report.cascade.nodes.filter((n) => isLeafType(n.workType));
    expect(leaves.length).toBe(4);
    expect(leaves.every((n) => n.assigneeHatId !== undefined)).toBe(true);
  }, 60_000);
});

describe("TWO UNRELATED TICKETS' GATE WALKS OVERLAP WHEN `maxParallel` SAYS SO", () => {
  // MEASURED this session: six FlowDent tickets with no dependency between them ran their entire
  // gate chains one at a time, real multi-minute Claude calls included, because the runtime's own
  // staffed-task loop `await`ed each task's walk before starting the next — regardless of whether
  // anything actually required that order. `ferry` at its default dop is byte-identical to that
  // loop; this proves the OTHER half — that raising it genuinely lets independent tickets' calls
  // run at the same time, not just that the flag is accepted and silently ignored.
  //
  // A review port that RECORDS ITS OWN START AND END, not one that returns instantly, because a
  // sequential and a concurrent run look identical if nothing in the fake port takes measurable
  // time — the exact way a bug here could hide behind a test that finishes either way.
  const two: ExternalEvent[] = [
    { ...GOOD, externalId: "T-1", title: "checkout double-charges" },
    { ...GOOD, externalId: "T-2", title: "refund posts twice" },
  ];

  // OCCUPANCY, NOT ELAPSED TIME. The property under test is "were two reviews inside at the
  // same time", and the first version of this reached for it through an 80ms `setTimeout` plus
  // `performance.now()` timestamps. That made a wall clock the arbiter of a verdict about
  // CONCURRENCY -- a stand-in for the observable rather than the observable itself, which is
  // what `audit-ambient-time-in-tests` refuses (it failed here on the unallowlisted timer).
  //
  // Counting occupancy answers the question DIRECTLY and deterministically: a reviewer bumps a
  // counter on entry, yields a fixed number of event-loop TURNS, and drops it on exit. If the
  // ferry runs them sequentially the counter can never exceed 1, however slow or fast the
  // machine is; if it runs them together the peak rises. The yield is a LITERAL-zero
  // `setTimeout`, which is deterministic in turns and is the one form the detector permits.
  //
  // This is also strictly stronger than the timestamp version: it cannot pass by accident on a
  // loaded runner where two sequential calls happen to straddle the same millisecond, and it
  // cannot fail on one where a concurrent pair is scheduled too far apart to overlap.
  const YIELD_TURNS = 8;

  function occupancyReviewer() {
    const calls: { readonly gate: string; readonly workId: string }[] = [];
    let inside = 0;
    let peak = 0;
    const review = {
      meta: { port: Port.Review, name: "occupancy", fidelity: Fidelity.Real, describes: "records overlap" },
      review: async (req: { readonly gate: GateKind; readonly workId: string }) => {
        inside += 1;
        peak = Math.max(peak, inside);
        // Hold the call open across several turns so a genuinely concurrent sibling has somewhere
        // to interleave. A reviewer that returned instantly would make sequential and concurrent
        // runs indistinguishable -- the same trap the 80ms sleep was there to avoid.
        for (let turn = 0; turn < YIELD_TURNS; turn++) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        inside -= 1;
        calls.push({ gate: String(req.gate), workId: req.workId });
        return { ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] };
      },
    };
    return { calls, review, peak: () => peak };
  }

  test("at the default (sequential), two tickets' reviews are never inside at once — the control", async () => {
    const rec = occupancyReviewer();
    const base = deps({ externalEvents: two, supplyTarget: 2 });
    await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: rec.review as never } } as OrgRuntimeDeps);
    // Peak occupancy of 1 means no two review calls anywhere in the run were ever open together.
    expect(rec.peak()).toBe(1);
    // Without this the control passes vacuously when no review ever runs.
    expect(rec.calls.length).toBeGreaterThan(0);
  }, 60_000);

  test("with maxParallel 2, two reviews are genuinely inside at the same time", async () => {
    const rec = occupancyReviewer();
    const base = deps({ externalEvents: two, supplyTarget: 2, maxParallel: 2 });
    await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: rec.review as never } } as OrgRuntimeDeps);
    expect(rec.peak()).toBeGreaterThanOrEqual(2);
  }, 60_000);
});

describe("A MILESTONE THE ORGANIZATION PASSED IS TOLD TO ITS TICKET, ONCE", () => {
  const reports = { milestones: [GateKind.ImplementationReview], why: "people watch the ticket" };

  /** A run, then the work item it created that carries a ticket - the only kind that can be reported. */
  async function withTicket(): Promise<{ readonly workId: string; readonly ticket: string; readonly source: string; readonly cascade: unknown }> {
    const first = await runOrgRuntime(deps());
    const node = first.cascade.nodes.find((n) => n.requestRef !== undefined);
    if (node === undefined) throw new Error("the run produced no work carrying a request");
    const ref = parseRequestRef(node.requestRef as string);
    if (ref === undefined) throw new Error("the request ref did not parse");
    return { workId: node.workId, ticket: ref.externalId, source: ref.source, cascade: first.cascade };
  }

  test("it composes, posts, and records - and the SECOND run says nothing, because it is not news twice", async () => {
    const { workId, ticket, source, cascade } = await withTicket();
    const posted: { ticket: string; tracker: string; body: string; gate: string }[] = [];
    const events: OrgEvent[] = [];
    const wiring = {
      priorCascade: cascade as never,

      ticketReports: reports,
      gateVerdicts: [{ workId, gate: GateKind.ImplementationReview, outcome: GateOutcome.Approved, atMs: 10, byHatId: "reviewer", reason: "the fix is the narrow one" }],
      composeTicketUpdate: async () => ({ ok: true as const, value: { done: ["wrote the fix"], willDo: ["run QA"], status: "in review" }, evidence: [] }),
      postTicketComment: async (r: { ticket: string; tracker: string; body: string; gate: string }) => {
        posted.push(r);
        return { ok: true as const, value: { commentId: "c-1" }, evidence: [] };
      },
      onEvent: (e: OrgEvent) => events.push(e),
    };
    await runOrgRuntime(deps({ ...wiring, ticketsReported: new Map() } as never));
    expect(posted.length).toBe(1);
    expect(posted[0]?.ticket).toBe(ticket);
    // The tracker comes from where the work CAME FROM, with nothing configured - and this harness
    // intakes from a source that is not Jira, so a hardcoded tracker would fail here.
    expect(posted[0]?.tracker).toBe(source);
    expect(posted[0]?.body).toContain("- wrote the fix");
    expect(posted[0]?.body).toContain("Status: in review");
    const told = events.filter((e) => e.fact?.kind === "ticket_reported");
    expect(told.length).toBe(1);

    // Told once. A later run reading that fact says nothing more.
    posted.length = 0;
    await runOrgRuntime(deps({ ...wiring, ticketsReported: foldTicketReports(events) } as never));
    expect(posted.length).toBe(0);
  }, 60_000);

  test("an organization that says where to report overrides the source it read from", async () => {
    const { workId, cascade } = await withTicket();
    const posted: { tracker: string }[] = [];
    await runOrgRuntime(deps({
      priorCascade: cascade as never,
      ticketReports: { ...reports, tracker: "linear" },
      ticketsReported: new Map(),
      gateVerdicts: [{ workId, gate: GateKind.ImplementationReview, outcome: GateOutcome.Approved, atMs: 10 }],
      composeTicketUpdate: async () => ({ ok: true as const, value: { done: ["d"], willDo: [], status: "s" }, evidence: [] }),
      postTicketComment: async (r: { tracker: string }) => { posted.push(r); return { ok: true as const, value: {}, evidence: [] }; },
    } as never));
    expect(posted[0]?.tracker).toBe("linear");
  }, 60_000);

  test("a tracker that would not take it is a REFUSAL, and nothing is recorded - so the next run tries again", async () => {
    const { workId, cascade } = await withTicket();
    const events: OrgEvent[] = [];
    const report = await runOrgRuntime(deps({
      priorCascade: cascade as never,

      ticketReports: reports,
      ticketsReported: new Map(),
      gateVerdicts: [{ workId, gate: GateKind.ImplementationReview, outcome: GateOutcome.Approved, atMs: 10 }],
      composeTicketUpdate: async () => ({ ok: true as const, value: { done: ["d"], willDo: [], status: "s" }, evidence: [] }),
      postTicketComment: async () => ({ ok: false as const, reason: "jira said 403" }),
      onEvent: (e: OrgEvent) => events.push(e),
    } as never));
    expect(report.refusals.some((r) => r.includes("403"))).toBe(true);
    expect(events.filter((e) => e.fact?.kind === "ticket_reported").length).toBe(0);
  }, 60_000);

  test("a gate that was TURNED BACK reaches no ticket - the loop iterates, and only the clean result is news", async () => {
    const { workId, cascade } = await withTicket();
    const posted: unknown[] = [];
    await runOrgRuntime(deps({
      priorCascade: cascade as never,

      ticketReports: reports,
      ticketsReported: new Map(),
      gateVerdicts: [{ workId, gate: GateKind.ImplementationReview, outcome: GateOutcome.ChangesRequested, atMs: 10 }],
      composeTicketUpdate: async () => ({ ok: true as const, value: { done: ["d"], willDo: [], status: "s" }, evidence: [] }),
      postTicketComment: async (r: unknown) => { posted.push(r); return { ok: true as const, value: {}, evidence: [] }; },
    } as never));
    expect(posted.length).toBe(0);
  }, 60_000);

  test("configured milestones with nothing to write or post them is a REFUSAL, never a quiet skip", async () => {
    const { workId, cascade } = await withTicket();
    const report = await runOrgRuntime(deps({
      priorCascade: cascade as never,

      ticketReports: reports,
      ticketsReported: new Map(),
      gateVerdicts: [{ workId, gate: GateKind.ImplementationReview, outcome: GateOutcome.Approved, atMs: 10 }],
    } as never));
    expect(report.refusals.some((r) => r.includes("nothing is configured to write or post"))).toBe(true);
  }, 60_000);
});

describe("A MERGE CONFLICT IS REWORK, NOT A STALL", () => {
  // MEASURED on the Waypoint run, 2026-09-20: a story conflicted with `main` on one line, the
  // landing was refused, the refusal went into the run's `refusals` list and nowhere else — and
  // the next cycle tried the same merge again, and the next. Nobody was told, because the item
  // was DONE: every gate had passed, so no performer was ever sent back to it. An organization
  // that integrates its own changes has to hand a conflict to somebody, and the somebody is the
  // implementer, at the gate whose phase writes code.
  const { MERGE_CONFLICT } = require("./adapters") as typeof import("./adapters");

  test("a landing refused for a conflict turns the change's leaf back at implementation_review, naming the files", async () => {
    const opened: string[] = [];
    const conflicting = {
      meta: { port: Port.ChangeControl, name: "conflicting", fidelity: Fidelity.Real, describes: "every merge conflicts" },
      open: async (node: { readonly workId: string }, ctx: { readonly branch: string; readonly base?: string }) => {
        opened.push(node.workId);
        return { ok: true as const, value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }), workdir: "/nowhere" }, evidence: [] };
      },
      merge: async () => ({
        ok: false as const,
        reason: `${MERGE_CONFLICT} main in: package.json, CLAUDE.md — the merge is left in progress in /nowhere; resolve, git add, git commit`,
      }),
    };
    // A FIRST REJECTION, so the eventual approval sits at `warmedAt + 1` — the ordering that hid the
    // steward's verdict on task-5535.
    const rejectedOnce = new Set<string>();
    const strictThenKind = {
      meta: { port: Port.Review, name: "strict-then-kind", fidelity: Fidelity.Real, describes: "rejects each implementation once" },
      review: async (req: { gate: GateKind; workId: string }) => {
        const key = `${req.workId}:${String(req.gate)}`;
        if (req.gate === GateKind.ImplementationReview && !rejectedOnce.has(key)) {
          rejectedOnce.add(key);
          return { ok: true as const, value: { outcome: GateOutcome.Rejected, reason: "first pass: missing a test" }, evidence: [] };
        }
        return { ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] };
      },
    };
    const base = deps();
    const report = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: conflicting as never, review: strictThenKind as never }, settings: [{ setting: ProcessSetting.Delivery, value: "merge", why: "the organization integrates its own changes" }] } as OrgRuntimeDeps);
    expect(opened.length).toBeGreaterThan(0);
    const turnedBack = report.gateEvaluations.filter(
      (e) => String(e.gate) === String(GateKind.ImplementationReview) && e.outcome === GateOutcome.Rejected && e.reason.includes("package.json"),
    );
    expect(turnedBack.length).toBeGreaterThan(0);
    // By the hat whose job it is, on an item that opened a change — not by a person, not by nobody.
    expect(turnedBack.every((e) => e.byHatId === "merge_steward")).toBe(true);
    expect(turnedBack.every((e) => opened.includes(e.workId))).toBe(true);
    // And it is written where `latestGateRejections` reads: the trace carries it as a verdict.
    expect(report.trace.some((ev) => ev.kind === OrgEventKind.QualityGateEvaluation && ev.actorHatId === "merge_steward")).toBe(true);
    // AND IT IS THE LATEST WORD. MEASURED on Waypoint task-5535, 2026-09-20: the walk's approvals
    // carried `warmedAt + attempt - 1`, the steward's rejection carried `warmedAt`, so "latest verdict
    // at implementation_review" stayed approved, the item read done, and every landing re-conflicted
    // with nobody sent back. A verdict that must turn work back must be later than what it overturns.
    const { missingGates } = require("./gate-demand") as typeof import("./gate-demand");
    for (const leafId of new Set(turnedBack.map((e) => e.workId))) {
      const leaf = report.cascade.nodes.find((n) => n.workId === leafId);
      if (leaf === undefined) throw new Error("leaf missing");
      expect(missingGates(leaf, leafId, report.gateEvaluations)).toContain(GateKind.ImplementationReview);
    }
  }, 60_000);
});

describe("A VERIFY LEAF'S qa_uat HAS SOMETHING TO JUDGE", () => {
  // MEASURED on the Waypoint run, 2026-09-20, task-031 ("verify <goal>"): the leaf produces no
  // code, so nothing is attached to its `qa_uat`; the reviewer opened the item, found "ATTACHMENTS
  // (0) none, COMMENTS (0) none", refused to approve an empty gate — correctly — and did so again
  // every attempt, thirty seconds and thirty cents each, while the story it verifies could never
  // land because the collection waits for it. "Does it work, judged by somebody who did not build
  // it" is answered by RUNNING it: the test producer, which already runs for `runtime_validation`
  // in the dependency's checkout, runs for `qa_uat` too — on the leaves that write no code.
  test("the test producer runs at qa_uat for a review leaf, so the gate carries a real run", async () => {
    const base = deps();
    const report = await runOrgRuntime({ ...base, providers: defaultProviderSet(base) } as OrgRuntimeDeps);
    const verify = report.cascade.nodes.find((n) => n.workType === WorkType.Review);
    expect(verify).toBeDefined();
    const qa = report.gateEvaluations.filter((e) => e.workId === verify?.workId && e.gate === GateKind.QaUat);
    expect(qa.length).toBeGreaterThan(0);
    // A test run was RECORDED for the verify leaf at qa_uat, over and above the one runtime_validation owes.
    const runs = report.trace.filter((ev) => ev.kind === OrgEventKind.TestRunRecorded && ev.subjectId === verify?.workId);
    expect(runs.length).toBe(2);
    // And a code leaf runs it at qa_uat too: MEASURED on Waypoint task-021, the same empty-gate refusal
    // arrived at a code leaf whose reviewer would not approve a step nothing was attached to.
    const code = report.cascade.nodes.find((n) => n.workType === WorkType.Task || n.workType === WorkType.Defect);
    const codeQa = report.trace.filter((ev) => ev.kind === OrgEventKind.TestRunRecorded && ev.subjectId === code?.workId);
    expect(codeQa.length).toBe(2);
  }, 60_000);
});

describe("A VERIFY LEAF ON A RESUMED RUN STILL TESTS THE CHANGE IT VERIFIES", () => {
  // MEASURED on the Waypoint run, 2026-09-20, task-031: its dependency task-029 was done in an
  // earlier run, so no change was opened for it THIS run, `openedChanges` had nothing for it, and
  // the verify leaf's suite ran in the BASE tree — where a stale test on the trunk fails. The gate
  // then carried `exit:1` plus a log that never mentioned the feature, and the reviewer rejected,
  // correctly, a run of the wrong tree. The dependency's checkout still exists; change control
  // can rejoin it. It has to be asked.
  function recordingPorts() {
    const opened: string[] = [];
    const testedIn: (string | undefined)[] = [];
    const change = {
      meta: { port: Port.ChangeControl, name: "recording", fidelity: Fidelity.Real, describes: "records opens" },
      open: async (node: { readonly workId: string }, ctx: { readonly branch: string; readonly base?: string }) => {
        opened.push(node.workId);
        return { ok: true as const, value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }), workdir: `/checkouts/${ctx.branch}` }, evidence: [] };
      },
      merge: async (handle: { readonly branch: string }) => ({ ok: true as const, value: { changeId: "m", branch: handle.branch }, evidence: [] }),
    };
    const tests = {
      meta: { port: Port.TestExecution, name: "recording", fidelity: Fidelity.Real, describes: "records where it ran" },
      run: async (_tc: unknown, ctx: { readonly workdir?: string }) => {
        testedIn.push(ctx.workdir);
        return { ok: true as const, value: { outcome: RunOutcome.Passed }, evidence: [{ kind: "trace" as const, ref: `ran-in:${ctx.workdir ?? "<base>"}` }] };
      },
    };
    return { change, tests, opened, testedIn };
  }

  test("the dependency's change is rejoined for its checkout, and the verify leaf's tests run there", async () => {
    const first = recordingPorts();
    const base = deps();
    const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "the organization integrates its own changes" }];
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: first.change as never, tests: first.tests as never }, settings } as OrgRuntimeDeps);
    const verify = run1.cascade.nodes.find((n) => n.workType === WorkType.Review);
    const code = run1.cascade.nodes.find((n) => n.workId === (verify?.dependsOn ?? [])[0]);
    if (verify === undefined || code === undefined) throw new Error("fixture has no verify leaf with a dependency");
    expect(code.state).toBe(WorkState.Done);

    // RESUME with the code leaf done and the verify leaf still owed: its verdicts are forgotten and
    // it is reopened, exactly as a run that stopped between the two would leave it.
    // A DONE LEAF HOLDS NO SEAT (its assignee was released), so nothing walks it and nothing opens its change.
    const prior = { ...run1.cascade, nodes: run1.cascade.nodes.map((n) => (n.workId === verify.workId ? { ...n, state: WorkState.Open } : n.workId === code.workId ? { ...n, assigneeHatId: undefined } : n)) };
    const second = recordingPorts();
    const run2 = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), change: second.change as never, tests: second.tests as never },
      settings,
      priorCascade: prior as never,
      priorGateEvaluations: run1.gateEvaluations.filter((e) => e.workId !== verify.workId),
      alreadyLanded: new Set<string>(),
      // WALKED IN PARALLEL, as the real run is: the verify leaf may start before its dependency's open lands.
      maxParallel: 3,
    } as OrgRuntimeDeps);
    // The verify leaf was walked and tested…
    expect(run2.gateEvaluations.some((e) => e.workId === verify.workId)).toBe(true);
    expect(second.testedIn.length).toBeGreaterThan(0);
    // …IN THE DEPENDENCY'S CHECKOUT, obtained by rejoining its change — never the base tree.
    expect(second.opened).toContain(code.workId);
    expect(second.testedIn.every((w) => w !== undefined && w.startsWith("/checkouts/"))).toBe(true);
  }, 60_000);
});

describe("DONE IS JUDGED AGAINST THE GATES THIS RUN WALKS — the chain under the pipeline", () => {
  // MEASURED on the Waypoint run, 2026-09-20, under `--pipeline diagnosed_design`: every gate the
  // pipeline owes was approved on all six leaves, two stories were merged to main, and the run
  // stopped NO_PROGRESS: the three verify leaves were "not done: no passing verdict on the record
  // for peer_review". `diagnosed_design` never walks `peer_review`, so no verdict could ever exist —
  // the walk asked one question (chain ∩ pipeline) and the done-check asked another (the whole
  // chain). An item that has passed everything it was ever going to be asked is done.
  const { NAMED_PIPELINES } = require("./run-org") as typeof import("./run-org");
  test("a review leaf whose pipeline never walks peer_review is done once qa_uat and runtime_validation pass", async () => {
    const base = deps();
    const pipeline = (NAMED_PIPELINES["diagnosed_design"] as readonly GateKind[]).map((gate) => ({ gate }));
    const report = await runOrgRuntime({ ...base, providers: defaultProviderSet(base), pipeline, settings: [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }] } as OrgRuntimeDeps);
    const verify = report.cascade.nodes.find((n) => n.workType === WorkType.Review);
    expect(verify).toBeDefined();
    // The gates the pipeline owes it were judged…
    expect(report.gateEvaluations.some((e) => e.workId === verify?.workId && e.gate === GateKind.QaUat && e.outcome === GateOutcome.Approved)).toBe(true);
    expect(report.gateEvaluations.some((e) => e.workId === verify?.workId && e.gate === GateKind.RuntimeValidation && e.outcome === GateOutcome.Approved)).toBe(true);
    // …and it is DONE, not held for a gate nothing will ever walk.
    expect(verify?.state).toBe(WorkState.Done);
    expect(report.refusals.some((r) => r.includes("no passing verdict on the record for peer_review"))).toBe(false);
  }, 60_000);
});

describe("A REJECTED ACCEPTANCE GATE BECOMES WORK, NOT A WEEKLY RE-REVIEW", () => {
  // MEASURED on the Waypoint run, 2026-09-20, proj-027: every leaf merged, and the Opus architect
  // rejected `final_architecture_review` with three real findings (SQL casts no test reaches). The
  // next cycle walked the same gate against the same tree — "nothing has moved since this step was
  // last rejected" — and would have, every cycle, at architect prices, forever: the leaves were done,
  // so nobody was ever sent back to the code. An objection at the gate that asks "was the built
  // thing right?" is a defect against the built thing, and the organization's answer to a defect is
  // a leaf that fixes it. The gate then waits for that leaf, as it waits for every other child.
  test("the rung gets a follow-up leaf carrying the objection, and the gate is not re-asked until it delivers", async () => {
    let finalAsked = 0;
    const strictArchitect = {
      meta: { port: Port.Review, name: "strict-architect", fidelity: Fidelity.Real, describes: "rejects the final architecture review once" },
      review: async (req: { gate: GateKind; workId: string }) => {
        if (req.gate === GateKind.FinalArchitectureReview) finalAsked += 1;
        return {
          ok: true as const,
          value:
            req.gate === GateKind.FinalArchitectureReview && finalAsked === 1
              ? { outcome: GateOutcome.Rejected, reason: "console.read.ts:65 casts an unvalidated string to timestamptz; one bad row 500s the whole overview" }
              : { outcome: GateOutcome.Approved, reason: "ok" },
          evidence: [],
        };
      },
    };
    const base = deps();
    const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }];
    const run0 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: strictArchitect as never }, settings } as OrgRuntimeDeps);
    const project = run0.cascade.nodes.find((n) => n.workType === WorkType.Project);
    if (project === undefined) throw new Error("fixture has no project");
    // The acceptance gate waits for the trunk: nothing landed within the cycle, so it is not asked yet.
    expect(finalAsked).toBe(0);
    // The cycle after the landing asks it — and it is rejected.
    const landed = new Set(childrenOf(run0.cascade, project.workId).filter((n) => isLeafType(n.workType)).map((n) => n.workId));
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: strictArchitect as never }, settings, priorCascade: run0.cascade as never, priorGateEvaluations: run0.gateEvaluations, alreadyLanded: landed } as OrgRuntimeDeps);
    expect(finalAsked).toBe(1);
    // A NEW LEAF under the project, open, briefed with the objection.
    const followUps = childrenOf(run1.cascade, project.workId).filter((c) => isLeafType(c.workType) && c.state !== WorkState.Done && (c.brief ?? "").includes("timestamptz"));
    expect(followUps.length).toBeGreaterThan(0);
    // IDEMPOTENT across cycles: resumed with the follow-up still open, the gate is NOT asked again
    // and no second follow-up is minted.
    const run2 = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), review: strictArchitect as never },
      settings,
      priorCascade: run1.cascade as never,
      priorGateEvaluations: run1.gateEvaluations,
      alreadyLanded: landed,
    } as OrgRuntimeDeps);
    const again = childrenOf(run2.cascade, project.workId).filter((c) => isLeafType(c.workType) && (c.brief ?? "").includes("timestamptz"));
    expect(again.length).toBe(followUps.length);
  }, 90_000);
});

describe("A VERIFY LEAF TURNED BACK AFTER ITS SUBJECT LANDED MINTS THE FIX IT NEEDS", () => {
  // MEASURED on the Waypoint run, 2026-09-20, task-5529: the chart-structure story landed on main
  // and its verify leaf's qa_uat found 7 real failures there — a test computed its fixture path with
  // `new URL(".", import.meta.url).pathname`, fine in a worktree with no space in its path, `%20` on
  // the trunk. Correct rejection; nobody to send back. The subject leaf was done and merged, so the
  // verify leaf would have been re-asked the same question every cycle. An objection from the check
  // of a landed change is a defect against that change: mint the fix under the same rung, briefed
  // with the verdict, and make the verify leaf wait on it — exactly as it waited on the original.
  test("the rung gets a defect leaf carrying the verdict, and the verify leaf depends on it", async () => {
    let qaAsked = 0;
    const strictQa = {
      meta: { port: Port.Review, name: "strict-qa", fidelity: Fidelity.Real, describes: "rejects a verify leaf's qa_uat once" },
      review: async () => ({ ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] }),
    };
    const base = deps();
    const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }];
    // Run 1: everything lands.
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: strictQa as never }, settings } as OrgRuntimeDeps);
    const verify = run1.cascade.nodes.find((n) => n.workType === WorkType.Review);
    const code = run1.cascade.nodes.find((n) => n.workId === (verify?.dependsOn ?? [])[0]);
    if (verify === undefined || code === undefined) throw new Error("fixture has no verify leaf with a dependency");
    // Run 2: resumed with the code leaf landed and the verify leaf owed again; QA now finds a defect on the trunk.
    const rejectingQa = {
      ...strictQa,
      review: async (req: { gate: GateKind; workId: string }) => {
        if (req.workId === verify.workId && req.gate === GateKind.QaUat && qaAsked++ === 0) {
          return { ok: true as const, value: { outcome: GateOutcome.Rejected, reason: "label-fixtures.test.ts:60 builds the fixture path from a URL pathname; `%20` in the trunk's path → 7 failures" }, evidence: [] };
        }
        return { ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] };
      },
    };
    const prior = { ...run1.cascade, nodes: run1.cascade.nodes.map((n) => (n.workId === verify.workId ? { ...n, state: WorkState.Open } : n)) };
    const run2 = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), review: rejectingQa as never },
      settings,
      priorCascade: prior as never,
      priorGateEvaluations: run1.gateEvaluations.filter((e) => e.workId !== verify.workId),
      alreadyLanded: new Set([code.workId]),
    } as OrgRuntimeDeps);
    const parentId = verify.parentWorkId as string;
    const fix = childrenOf(run2.cascade, parentId).find((c) => c.workType === WorkType.Defect && (c.brief ?? "").includes("%20"));
    expect(fix).toBeDefined();
    // The verify leaf now waits on the fix, so it is not re-asked until the fix delivers.
    const verifyNow = run2.cascade.nodes.find((n) => n.workId === verify.workId);
    expect((verifyNow?.dependsOn ?? []).includes(fix?.workId ?? "")).toBe(true);
    // IDEMPOTENT: a third run with the fix still open mints nothing more.
    const run3 = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), review: rejectingQa as never },
      settings,
      priorCascade: run2.cascade as never,
      priorGateEvaluations: run2.gateEvaluations,
      alreadyLanded: new Set([code.workId]),
    } as OrgRuntimeDeps);
    expect(childrenOf(run3.cascade, parentId).filter((c) => c.workType === WorkType.Defect && (c.brief ?? "").includes("%20")).length).toBe(1);
  }, 90_000);
});

describe("DECOMPOSITION COUNTS SEATS THE WAY STAFFING DOES — wearers per hat, not one", () => {
  // MEASURED on the Waypoint run, 2026-09-20: `--supply-target 3` let three tasks run at once on
  // two contributor hats, and then a fix leaf minted mid-run for a landed defect was refused by
  // `decompose`: "no individual_contributor reports up to 'tech_lead', so this task cannot be
  // staffed". Staffing counted seats × supply; decomposition counted hats with nothing on them.
  // Two answers to "is anyone free" is one answer too many.
  const { freeSeatsUnder } = require("./org-runtime") as typeof import("./org-runtime");
  test("a hat carrying one open task still has seats while supply allows it", () => {
    const built = buildOrgChart(SEED_HATS);
    if (!built.ok) throw new Error("chart");
    const chart = built.chart;
    const carried = (n: number): import("./goal-cascade").Cascade => ({
      nodes: Array.from({ length: n }, (_, i) => ({
        workId: `t-${String(i)}`, workType: WorkType.Task, title: "t", state: WorkState.InProgress, ownerHatId: "tech_lead",
        assigneeHatId: i % 2 === 0 ? "backend_implementer" : "frontend_implementer",
      })) as never,
    });
    // Two hats, nothing carried: two seats at supply 1, six at supply 3.
    expect(freeSeatsUnder(chart, carried(0), "tech_lead", 1)).toBe(2);
    expect(freeSeatsUnder(chart, carried(0), "tech_lead", 3)).toBe(6);
    // Each hat carrying one task: none free at supply 1 — and FOUR at supply 3.
    expect(freeSeatsUnder(chart, carried(2), "tech_lead", 1)).toBe(0);
    expect(freeSeatsUnder(chart, carried(2), "tech_lead", 3)).toBe(4);
    // Finished work holds no seat.
    const done: import("./goal-cascade").Cascade = { nodes: carried(2).nodes.map((n) => ({ ...n, state: WorkState.Done })) };
    expect(freeSeatsUnder(chart, done, "tech_lead", 1)).toBe(2);
  });
});

describe("A REJECTION AFTER THE CODE WAS WRITTEN SENDS THE CODE LEAF BACK TO ITS PERFORMER", () => {
  // MEASURED on the Waypoint run, 2026-09-20, task-6560: qa_uat rejected five times with one reason
  // (three of four defect tests skip without DATABASE_URL, so the recorded run proves nothing for
  // them). Each attempt re-walked only the gates not yet passed this cycle — qa_uat — so the test
  // producer ran, the reviewer read the same run, and said the same thing; the performer, who is
  // the only actor that can change what the run proves, was never asked again and never told. The
  // named recovery path for qa_uat is "validation process improvement"; in an organization whose
  // validation process is the checkout's own tests, that improvement IS engineering.
  test("qa_uat rejected once → the work runs again → the walk passes", async () => {
    let qaAsked = 0;
    let performed = 0;
    const work = {
      meta: { port: Port.WorkExecution, name: "counting", fidelity: Fidelity.Real, describes: "counts performances" },
      execute: async (node: { workId: string }) => {
        performed += 1;
        return { ok: true as const, value: { workId: node.workId, succeeded: true, artifacts: [], summary: `pass ${String(performed)}` }, evidence: [] };
      },
    };
    const review = {
      meta: { port: Port.Review, name: "qa-once", fidelity: Fidelity.Real, describes: "rejects the first qa_uat on a code leaf" },
      review: async (req: { gate: GateKind; workId: string }) => ({
        ok: true as const,
        value:
          req.gate === GateKind.QaUat && qaAsked++ === 0
            ? { outcome: GateOutcome.Rejected, reason: "three of four defect tests skip without DATABASE_URL; the run proves nothing for them" }
            : { outcome: GateOutcome.Approved, reason: "ok" },
        evidence: [],
      }),
    };
    const base = deps();
    const report = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), work: work as never, review: review as never }, settings: [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }] } as OrgRuntimeDeps);
    const code = report.cascade.nodes.find((n) => n.workType === WorkType.Task || n.workType === WorkType.Defect);
    expect(code?.state).toBe(WorkState.Done);
    // The performer ran AGAIN after the rejection — not merely the test producer.
    expect(performed).toBeGreaterThanOrEqual(2);
    // And the record shows implementation_review re-judged after qa_uat's objection.
    const impl = report.gateEvaluations.filter((e) => e.workId === code?.workId && e.gate === GateKind.ImplementationReview);
    expect(impl.length).toBeGreaterThanOrEqual(2);
  }, 60_000);

  test("…and on a RESUMED item whose implementation passed in an earlier run", async () => {
    // The real case: task-6560's implementation_review had passed the run before; the resumed walk
    // owed only qa_uat onward and, filtered by "passed before", could never reach the performer.
    let performed = 0;
    const work = {
      meta: { port: Port.WorkExecution, name: "counting", fidelity: Fidelity.Real, describes: "counts performances" },
      execute: async (node: { workId: string }) => {
        performed += 1;
        return { ok: true as const, value: { workId: node.workId, succeeded: true, artifacts: [], summary: `pass ${String(performed)}` }, evidence: [] };
      },
    };
    const approve = { meta: { port: Port.Review, name: "ok", fidelity: Fidelity.Real, describes: "approves" }, review: async () => ({ ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] }) };
    const base = deps();
    const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }];
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), work: work as never, review: approve as never }, settings } as OrgRuntimeDeps);
    const code = run1.cascade.nodes.find((n) => n.workType === WorkType.Task || n.workType === WorkType.Defect);
    if (code === undefined) throw new Error("no code leaf");
    const performedInRun1 = performed;
    // Resume: the code leaf is open again and owes qa_uat onward (implementation_review passed before).
    let qaAsked = 0;
    const qaOnce = { ...approve, review: async (req: { gate: GateKind; workId: string }) => (req.workId === code.workId && req.gate === GateKind.QaUat && qaAsked++ === 0 ? { ok: true as const, value: { outcome: GateOutcome.Rejected, reason: "the run proves nothing: the tests skip" }, evidence: [] } : { ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] }) };
    const prior = { ...run1.cascade, nodes: run1.cascade.nodes.map((n) => (n.workId === code.workId ? { ...n, state: WorkState.Open } : n)) };
    const run2 = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), work: work as never, review: qaOnce as never },
      settings,
      priorCascade: prior as never,
      priorGateEvaluations: run1.gateEvaluations.filter((e) => !(e.workId === code.workId && e.gate !== GateKind.ImplementationReview)),
    } as OrgRuntimeDeps);
    expect(run2.cascade.nodes.find((n) => n.workId === code.workId)?.state).toBe(WorkState.Done);
    // The performer ran in run 2 — after qa_uat's objection — although implementation had passed before.
    expect(performed).toBeGreaterThan(performedInRun1);
  }, 60_000);
});

describe("DONE IS NOT LANDED — the acceptance gate waits for the trunk, and one objection mints one follow-up", () => {
  // MEASURED on Waypoint proj-027, 2026-09-20: its follow-up defect passed every gate at 20:16 and
  // the acceptance gate was re-asked at 20:40 — before the cycle's landing loop had merged the fix —
  // so the architect re-read an unchanged main, rejected again with a rephrased verdict, and a
  // SECOND follow-up was minted beside the first. Two rules close it: the acceptance gate of a rung
  // is asked only once every code child has LANDED, not merely finished its walk; and an open
  // follow-up for the same gate is the same follow-up, whatever the verdict's wording this time.
  test("no re-review and no second follow-up while the first fix is done but unlanded", async () => {
    let finalAsked = 0;
    const architect = {
      meta: { port: Port.Review, name: "architect", fidelity: Fidelity.Real, describes: "rejects final review, rephrased each time" },
      review: async (req: { gate: GateKind }) => {
        if (req.gate !== GateKind.FinalArchitectureReview) return { ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] };
        finalAsked += 1;
        return { ok: true as const, value: { outcome: GateOutcome.Rejected, reason: `objection, phrasing #${String(finalAsked)}: console.read.ts casts` }, evidence: [] };
      },
    };
    // Change control that opens and merges nothing — every change stays unlanded, as within a cycle.
    const unlanding = {
      meta: { port: Port.ChangeControl, name: "unlanding", fidelity: Fidelity.Real, describes: "never lands" },
      open: async (node: { workId: string }, ctx: { branch: string; base?: string }) => ({ ok: true as const, value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }), workdir: "/nowhere" }, evidence: [] }),
      merge: async () => ({ ok: false as const, reason: "not now" }),
    };
    const base = deps();
    const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }];
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: architect as never, change: unlanding as never }, settings } as OrgRuntimeDeps);
    const project = run1.cascade.nodes.find((n) => n.workType === WorkType.Project);
    if (project === undefined) throw new Error("no project");
    const followUps = (c: import("./goal-cascade").Cascade) => childrenOf(c, project.workId).filter((n) => isLeafType(n.workType) && n.title.startsWith("address final_architecture_review"));
    // Leaves finished their walks but nothing landed: the gate must NOT have been asked at all.
    expect(finalAsked).toBe(0);
    expect(followUps(run1.cascade).length).toBe(0);
    // Resume with the leaves LANDED: now the gate is asked, rejected, and ONE follow-up is minted.
    const leaves = childrenOf(run1.cascade, project.workId).filter((n) => isLeafType(n.workType)).map((n) => n.workId);
    const run2 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: architect as never, change: unlanding as never }, settings, priorCascade: run1.cascade as never, priorGateEvaluations: run1.gateEvaluations, alreadyLanded: new Set(leaves) } as OrgRuntimeDeps);
    expect(finalAsked).toBe(1);
    expect(followUps(run2.cascade).length).toBe(1);
    // Resume again: the follow-up is done-but-unlanded, the gate is not re-asked, nothing is re-minted.
    const run3 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: architect as never, change: unlanding as never }, settings, priorCascade: run2.cascade as never, priorGateEvaluations: run2.gateEvaluations, alreadyLanded: new Set(leaves) } as OrgRuntimeDeps);
    expect(finalAsked).toBe(1);
    expect(followUps(run3.cascade).length).toBe(1);
  }, 120_000);
});

describe("CANCELLED WORK IS NOT WALKED", () => {
  // MEASURED on Waypoint, 2026-09-20: five duplicate fix leaves were cancelled by the operator
  // (`work_state: canceled`), and the next run reviewed and re-performed them anyway — the walk
  // took every node with an assignee. A cancelled item is one the organization has decided not to
  // do; spending a reviewer and an implementer on it is the decision made and then ignored.
  test("a cancelled, staffed leaf gets no review, no work, no verdict", async () => {
    const seen: string[] = [];
    const review = { meta: { port: Port.Review, name: "seen", fidelity: Fidelity.Real, describes: "records" }, review: async (req: { workId: string }) => { seen.push(req.workId); return { ok: true as const, value: { outcome: GateOutcome.Approved, reason: "ok" }, evidence: [] }; } };
    const base = deps();
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: review as never } } as OrgRuntimeDeps);
    const leaf = run1.cascade.nodes.find((n) => isLeafType(n.workType) && n.assigneeHatId !== undefined);
    if (leaf === undefined) throw new Error("no staffed leaf");
    seen.length = 0;
    const prior = { ...run1.cascade, nodes: run1.cascade.nodes.map((n) => (n.workId === leaf.workId ? { ...n, state: WorkState.Canceled } : n)) };
    const run2 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), review: review as never }, priorCascade: prior as never, priorGateEvaluations: run1.gateEvaluations.filter((e) => e.workId !== leaf.workId) } as OrgRuntimeDeps);
    expect(seen).not.toContain(leaf.workId);
    expect(run2.gateEvaluations.some((e) => e.workId === leaf.workId)).toBe(false);
    expect(run2.cascade.nodes.find((n) => n.workId === leaf.workId)?.state).toBe(WorkState.Canceled);
  }, 60_000);
});

describe("WORK UNDER A COLLECTION IS JUDGED IN THE COLLECTION'S BRANCH UNTIL THAT BRANCH LANDS", () => {
  // MEASURED on the Waypoint run, 2026-09-20. Three follow-up leaves (task-7657, task-8094,
  // task-10459) each merged into their project's `feature/…` branch, which lands on the trunk only
  // once the project's acceptance gate passes. Then: the verify leaf of each ran its suite on the
  // TRUNK (the dependency was `alreadyLanded`, so no checkout was rejoined and the runner fell to
  // its base directory) and failed for a defect the branch had already fixed; and the project's
  // `final_architecture_review` itself was judged on the trunk, where it found the same defect,
  // rejected, and minted a fourth follow-up. A branch nobody looks at cannot pass the gate that
  // would land it. The checkout for anything judged under a collection is that collection's
  // branch while it is unlanded; once landed, the trunk — and work minted after that goes to the
  // trunk directly, because a landed collection's branch is never merged again.
  const { branchNameIn } = require("./branch-topology") as typeof import("./branch-topology");
  function recordingPorts() {
    const opened: { workId: string; branch: string; base?: string }[] = [];
    const testedIn: (string | undefined)[] = [];
    const reviewedIn: { gate: GateKind; workId: string; workdir?: string }[] = [];
    const change = {
      meta: { port: Port.ChangeControl, name: "recording", fidelity: Fidelity.Real, describes: "records opens" },
      open: async (node: { readonly workId: string }, ctx: { readonly branch: string; readonly base?: string }) => {
        opened.push({ workId: node.workId, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }) });
        return { ok: true as const, value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }), workdir: `/checkouts/${ctx.branch}` }, evidence: [] };
      },
      merge: async (handle: { readonly branch: string }) => ({ ok: true as const, value: { changeId: "m", branch: handle.branch }, evidence: [] }),
    };
    const tests = {
      meta: { port: Port.TestExecution, name: "recording", fidelity: Fidelity.Real, describes: "records where it ran" },
      run: async (_tc: unknown, ctx: { readonly workdir?: string }) => {
        testedIn.push(ctx.workdir);
        return { ok: true as const, value: { outcome: RunOutcome.Passed }, evidence: [] };
      },
    };
    const review = (verdictFor: (req: { gate: GateKind; workId: string }) => { outcome: GateOutcome; reason: string }) => ({
      meta: { port: Port.Review, name: "recording", fidelity: Fidelity.Real, describes: "records where it judged" },
      review: async (req: { gate: GateKind; workId: string; workdir?: string }) => {
        reviewedIn.push({ gate: req.gate, workId: req.workId, ...(req.workdir === undefined ? {} : { workdir: req.workdir }) });
        return { ok: true as const, value: verdictFor(req), evidence: [] };
      },
    });
    return { change, tests, review, opened, testedIn, reviewedIn };
  }
  const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "the organization integrates its own changes" }];
  // The fixture's one code leaf goes to the trunk by shape; stated org-wide, the project collects it.
  const collecting = [...settings, { setting: ProcessSetting.IntegrationBranch, value: "collect", why: "every rung integrates on a branch" }];

  test("a verify leaf whose dependency landed in an unlanded collection's branch tests THAT branch, not the trunk", async () => {
    const first = recordingPorts();
    const base = deps();
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: first.change as never, tests: first.tests as never }, settings: collecting } as OrgRuntimeDeps);
    const verify = run1.cascade.nodes.find((n) => n.workType === WorkType.Review);
    const code = run1.cascade.nodes.find((n) => n.workId === (verify?.dependsOn ?? [])[0]);
    if (verify === undefined || code === undefined) throw new Error("fixture has no verify leaf with a dependency");
    const under = first.opened.find((o) => o.workId === code.workId)?.base;
    if (under === undefined) throw new Error("fixture's code leaf does not integrate under a collection");
    const collection = run1.cascade.nodes.find((n) => !isLeafType(n.workType) && branchNameIn(run1.cascade, n) === under);
    if (collection === undefined) throw new Error(`no collection owns ${under}`);

    // RESUME: the code leaf has landed — into the collection's branch — the collection has not, and
    // the verify leaf is owed again.
    const prior = { ...run1.cascade, nodes: run1.cascade.nodes.map((n) => (n.workId === verify.workId ? { ...n, state: WorkState.Open } : n.workId === code.workId ? { ...n, assigneeHatId: undefined } : n)) };
    const second = recordingPorts();
    const run2 = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), change: second.change as never, tests: second.tests as never },
      settings: collecting,
      priorCascade: prior as never,
      priorGateEvaluations: run1.gateEvaluations.filter((e) => e.workId !== verify.workId),
      alreadyLanded: new Set([code.workId]),
      maxParallel: 3,
    } as OrgRuntimeDeps);
    expect(run2.gateEvaluations.some((e) => e.workId === verify.workId)).toBe(true);
    expect(second.testedIn.length).toBeGreaterThan(0);
    // The COLLECTION's checkout was rejoined, and every run of the verify leaf happened in it.
    expect(second.opened.some((o) => o.workId === collection.workId && o.branch === under)).toBe(true);
    expect(second.testedIn.every((w) => w === `/checkouts/${under}`)).toBe(true);
  }, 60_000);

  test("a collection's acceptance gate is judged in the collection's checkout while its branch is unlanded", async () => {
    const ports = recordingPorts();
    const base = deps();
    const run0 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: ports.change as never, tests: ports.tests as never, review: ports.review(() => ({ outcome: GateOutcome.Approved, reason: "ok" })) as never }, settings: collecting } as OrgRuntimeDeps);
    const project = run0.cascade.nodes.find((n) => n.workType === WorkType.Project);
    if (project === undefined) throw new Error("fixture has no project");
    const branch = branchNameIn(run0.cascade, project);
    // The cycle after the leaves landed asks the acceptance gate. The project itself has NOT landed.
    const leaves = new Set(childrenOf(run0.cascade, project.workId).filter((n) => isLeafType(n.workType)).map((n) => n.workId));
    const again = recordingPorts();
    await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: again.change as never, tests: again.tests as never, review: again.review(() => ({ outcome: GateOutcome.Approved, reason: "ok" })) as never }, settings: collecting, priorCascade: run0.cascade as never, priorGateEvaluations: run0.gateEvaluations, alreadyLanded: leaves } as OrgRuntimeDeps);
    const asked = again.reviewedIn.filter((r) => r.workId === project.workId && r.gate === GateKind.FinalArchitectureReview);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((r) => r.workdir === `/checkouts/${branch}`)).toBe(true);
    expect(again.opened.some((o) => o.workId === project.workId && o.branch === branch)).toBe(true);
  }, 90_000);

  test("an ACCEPTED collection lands its branch on the trunk — judged by the chain under the pipeline, not by a state nobody sets", async () => {
    // MEASURED on the Waypoint run, 2026-09-21, proj-5525 under `diagnosed_design`: every leaf landed
    // into feature/…, the Opus architect approved final_architecture_review in that checkout, and the
    // run then said "cannot be accepted yet: still owes peer_review, adversarial_review" — two gates
    // that pipeline never walks on a project — and `collectionsReadyToLand` waited for a project
    // state of Done that the cascade refuses to set on anything with children. The feature branch
    // held three fixes and could never reach main. Three stalled runs, autopilot out.
    const { NAMED_PIPELINES } = require("./run-org") as typeof import("./run-org");
    const pipeline = (NAMED_PIPELINES["diagnosed_design"] as readonly GateKind[]).map((gate) => ({ gate }));
    const merged: string[] = [];
    const ports = recordingPorts();
    const change = { ...ports.change, merge: async (handle: { readonly branch: string }) => { merged.push(handle.branch); return { ok: true as const, value: { changeId: "m", branch: handle.branch }, evidence: [] }; } };
    const base = deps();
    const approve = () => ({ outcome: GateOutcome.Approved, reason: "ok" });
    const run0 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: change as never, tests: ports.tests as never, review: ports.review(approve) as never }, settings: collecting, pipeline } as OrgRuntimeDeps);
    const project = run0.cascade.nodes.find((n) => n.workType === WorkType.Project);
    if (project === undefined) throw new Error("fixture has no project");
    const branch = branchNameIn(run0.cascade, project);
    const leaves = new Set(childrenOf(run0.cascade, project.workId).filter((n) => isLeafType(n.workType)).map((n) => n.workId));
    expect(merged).not.toContain(branch);
    // The cycle after the leaves landed: acceptance is asked in the feature checkout, approved, and the branch lands.
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: change as never, tests: ports.tests as never, review: ports.review(approve) as never }, settings: collecting, pipeline, priorCascade: run0.cascade as never, priorGateEvaluations: run0.gateEvaluations, alreadyLanded: leaves } as OrgRuntimeDeps);
    expect(run1.gateEvaluations.some((e) => e.workId === project.workId && e.gate === GateKind.FinalArchitectureReview && e.outcome === GateOutcome.Approved)).toBe(true);
    expect(run1.refusals.some((r) => r.includes(project.workId) && r.includes("cannot be accepted yet"))).toBe(false);
    expect(merged).toContain(branch);
  }, 90_000);

  test("a follow-up minted under a LANDED collection is cut from the trunk, and its acceptance is judged there", async () => {
    let finalAsked = 0;
    const strict = (req: { gate: GateKind }) =>
      req.gate === GateKind.FinalArchitectureReview && ++finalAsked === 1
        ? { outcome: GateOutcome.Rejected, reason: "console.read.ts:65 casts an unvalidated string to timestamptz" }
        : { outcome: GateOutcome.Approved, reason: "ok" };
    const base = deps();
    const ports = recordingPorts();
    const run0 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: ports.change as never, tests: ports.tests as never, review: ports.review(strict) as never }, settings } as OrgRuntimeDeps);
    const project = run0.cascade.nodes.find((n) => n.workType === WorkType.Project);
    if (project === undefined) throw new Error("fixture has no project");
    // Everything under the project AND the project's own branch have landed on the trunk.
    const landed = new Set([project.workId, ...childrenOf(run0.cascade, project.workId).filter((n) => isLeafType(n.workType)).map((n) => n.workId)]);
    const again = recordingPorts();
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: again.change as never, tests: again.tests as never, review: again.review(strict) as never }, settings, priorCascade: run0.cascade as never, priorGateEvaluations: run0.gateEvaluations, alreadyLanded: landed } as OrgRuntimeDeps);
    expect(finalAsked).toBe(1);
    // Judged on the trunk: a landed collection's branch is history.
    expect(again.reviewedIn.filter((r) => r.workId === project.workId && r.gate === GateKind.FinalArchitectureReview).every((r) => r.workdir === undefined)).toBe(true);
    const followUp = childrenOf(run1.cascade, project.workId).find((c) => isLeafType(c.workType) && (c.brief ?? "").includes("timestamptz") && c.workType !== WorkType.Review);
    if (followUp === undefined) throw new Error("no follow-up was minted");
    // The follow-up's change is cut from the TRUNK — no base — because the collection's branch will never be merged again.
    const third = recordingPorts();
    await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: third.change as never, tests: third.tests as never, review: third.review(strict) as never }, settings, priorCascade: run1.cascade as never, priorGateEvaluations: run1.gateEvaluations, alreadyLanded: landed } as OrgRuntimeDeps);
    const opened = third.opened.find((o) => o.workId === followUp.workId);
    expect(opened).toBeDefined();
    expect(opened?.base).toBeUndefined();
  }, 90_000);
});

describe("A VERIFY LEAF WHOSE EVERY DEPENDENCY WAS CANCELLED VERIFIES NOTHING — it is cancelled, not walked", () => {
  // MEASURED on the Waypoint run, 2026-09-20, task-12592: the follow-up it verified (task-12590)
  // was cancelled by the operator as a duplicate. `dependenciesOf` drops cancelled dependencies, so
  // the verify leaf read as having none, was walked as a free-standing item, ran the organization's
  // suite on the TRUNK, and its reviewer rejected a run of a tree that held none of the work — at
  // $0.90 a cycle, forever. A check whose subject is gone has no subject; the honest record is the
  // same state its subject reached.
  test("the leaf is cancelled with a recorded reason, and no test run happens", async () => {
    const testedIn: (string | undefined)[] = [];
    const tests = {
      meta: { port: Port.TestExecution, name: "recording", fidelity: Fidelity.Real, describes: "records where it ran" },
      run: async (_tc: unknown, ctx: { readonly workdir?: string }) => {
        testedIn.push(ctx.workdir);
        return { ok: true as const, value: { outcome: RunOutcome.Passed }, evidence: [] };
      },
    };
    const base = deps();
    const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }];
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), tests: tests as never }, settings } as OrgRuntimeDeps);
    const verify = run1.cascade.nodes.find((n) => n.workType === WorkType.Review);
    const code = run1.cascade.nodes.find((n) => n.workId === (verify?.dependsOn ?? [])[0]);
    if (verify === undefined || code === undefined) throw new Error("fixture has no verify leaf with a dependency");
    // RESUME: the code leaf was cancelled, the verify leaf is owed again.
    testedIn.length = 0;
    const prior = { ...run1.cascade, nodes: run1.cascade.nodes.map((n) => (n.workId === verify.workId ? { ...n, state: WorkState.Open } : n.workId === code.workId ? { ...n, state: WorkState.Canceled, assigneeHatId: undefined } : n)) };
    const run2 = await runOrgRuntime({
      ...base,
      providers: { ...defaultProviderSet(base), tests: tests as never },
      settings,
      priorCascade: prior as never,
      priorGateEvaluations: run1.gateEvaluations.filter((e) => e.workId !== verify.workId),
      alreadyLanded: new Set<string>(),
    } as OrgRuntimeDeps);
    expect(testedIn.length).toBe(0);
    expect(run2.gateEvaluations.some((e) => e.workId === verify.workId)).toBe(false);
    expect(nodeById(run2.cascade, verify.workId)?.state).toBe(WorkState.Canceled);
    // On the record, with the reason, so the next run and a reader both know why.
    const recorded = run2.trace.find((ev) => ev.subjectId === verify.workId && ev.kind === OrgEventKind.WorkItemTransition && (ev.fact as { state?: string } | undefined)?.state === WorkState.Canceled);
    expect(recorded).toBeDefined();
    expect(String(recorded?.decision)).toContain(code.workId);
  }, 60_000);
});

describe("A LEAF THAT LEFT NOTHING COMMITTED IS CLOSED, NOT REFUSED FOREVER", () => {
  // MEASURED on the Waypoint run, 2026-09-21, task-6560 / task-6572 / task-12086: three leaves
  // walked every gate to approval having committed nothing — their objection was already fixed on
  // the feature branch by a sibling — and "has no commits: … a merge that moves nothing is not a
  // merge" then repeated every cycle, holding three projects off the trunk with nobody to act.
  const { NOTHING_TO_MERGE, UNCOMMITTED } = require("./adapters") as typeof import("./adapters");
  function refusingChange(reason: (branch: string) => string) {
    return {
      meta: { port: Port.ChangeControl, name: "refusing", fidelity: Fidelity.Real, describes: "refuses every merge" },
      open: async (node: { readonly workId: string }, ctx: { readonly branch: string; readonly base?: string }) => ({ ok: true as const, value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }), workdir: `/checkouts/${ctx.branch}` }, evidence: [] }),
      merge: async (handle: { readonly branch: string }) => ({ ok: false as const, reason: reason(handle.branch) }),
    };
  }
  const settings = [{ setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" }];

  test("a CLEAN empty change closes its leaf as cancelled, on the record, and the verify leaf that depended on it follows", async () => {
    const base = deps();
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: refusingChange((b) => `${b} ${NOTHING_TO_MERGE}`) as never }, settings, alreadyLanded: new Set<string>() } as OrgRuntimeDeps);
    const code = run1.cascade.nodes.find((n) => producesCode(n.workType) && isLeafType(n.workType));
    const verify = run1.cascade.nodes.find((n) => n.workType === WorkType.Review);
    if (code === undefined || verify === undefined) throw new Error("fixture has no code leaf / verify leaf");
    expect(nodeById(run1.cascade, code.workId)?.state).toBe(WorkState.Canceled);
    const recorded = run1.trace.find((ev) => ev.subjectId === code.workId && ev.kind === OrgEventKind.WorkItemTransition && (ev.fact as { state?: string } | undefined)?.state === WorkState.Canceled);
    expect(recorded).toBeDefined();
    expect(String(recorded?.decision)).toContain("nothing committed");
    // The next run does not walk, project or refuse it again.
    const run2 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: refusingChange((b) => `${b} ${NOTHING_TO_MERGE}`) as never }, settings, priorCascade: run1.cascade as never, priorGateEvaluations: run1.gateEvaluations, alreadyLanded: new Set<string>() } as OrgRuntimeDeps);
    expect(run2.refusals.some((r) => r.includes(code.workId))).toBe(false);
    expect(nodeById(run2.cascade, verify.workId)?.state).toBe(WorkState.Canceled);
  }, 60_000);

  test("a DIRTY empty change is sent back to its performer, naming the uncommitted files", async () => {
    const base = deps();
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: refusingChange((b) => `${b} ${NOTHING_TO_MERGE} — ${UNCOMMITTED} src/forgot.ts, test/forgot.test.ts`) as never }, settings, alreadyLanded: new Set<string>() } as OrgRuntimeDeps);
    const code = run1.cascade.nodes.find((n) => producesCode(n.workType) && isLeafType(n.workType));
    if (code === undefined) throw new Error("fixture has no code leaf");
    expect(nodeById(run1.cascade, code.workId)?.state).not.toBe(WorkState.Canceled);
    const sentBack = run1.gateEvaluations.filter((e) => e.workId === code.workId && e.gate === GateKind.ImplementationReview && e.byHatId === "merge_steward");
    expect(sentBack.length).toBe(1);
    expect(sentBack[0]?.outcome).toBe(GateOutcome.Rejected);
    expect(sentBack[0]?.reason).toContain("src/forgot.ts");
  }, 60_000);
});

describe("A COLLECTION WHOSE LANDING CONFLICTS GETS A LEAF TO RECONCILE IT", () => {
  // MEASURED on the Waypoint run, 2026-09-21, proj-027: accepted in its checkout, every leaf under
  // it done, and its feature branch refused at the trunk for a modify/delete conflict on two
  // generated files. The leaves that built the branch were all done — none was open to be turned
  // back — so the refusal was noted and nothing else happened, every cycle. A conflict is judgement
  // for a performer: mint the leaf that will do it, under the collection, cut from its branch,
  // briefed with the files; the collection then lands once that leaf has.
  const { MERGE_CONFLICT } = require("./adapters") as typeof import("./adapters");
  const { branchNameIn } = require("./branch-topology") as typeof import("./branch-topology");
  const settings = [
    { setting: ProcessSetting.Delivery, value: "merge", why: "autonomous" },
    { setting: ProcessSetting.IntegrationBranch, value: "collect", why: "every rung integrates on a branch" },
  ];
  function ports() {
    const merged: string[] = [];
    const change = {
      meta: { port: Port.ChangeControl, name: "conflicting-trunk", fidelity: Fidelity.Real, describes: "refuses the collection at the trunk" },
      open: async (node: { readonly workId: string }, ctx: { readonly branch: string; readonly base?: string }) => ({ ok: true as const, value: { changeId: `${ctx.branch}@${node.workId}`, branch: ctx.branch, ...(ctx.base === undefined ? {} : { base: ctx.base }), workdir: `/checkouts/${ctx.branch}` }, evidence: [] }),
      merge: async (handle: { readonly branch: string; readonly base?: string }) => {
        if (handle.base === undefined && handle.branch.startsWith("feature/")) {
          return { ok: false as const, reason: `${MERGE_CONFLICT} main in: packages/contracts/dist/index.d.ts, packages/contracts/dist/index.js — the merge is left in progress in /checkouts/${handle.branch}; resolve, git add, git commit` };
        }
        merged.push(handle.branch);
        return { ok: true as const, value: { changeId: "m", branch: handle.branch }, evidence: [] };
      },
    };
    return { change, merged };
  }
  test("a defect leaf is minted under the collection, briefed with the files, once", async () => {
    const base = deps();
    const p = ports();
    const run0 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: p.change as never }, settings } as OrgRuntimeDeps);
    const project = run0.cascade.nodes.find((n) => n.workType === WorkType.Project);
    if (project === undefined) throw new Error("fixture has no project");
    const branch = branchNameIn(run0.cascade, project);
    const leaves = new Set(childrenOf(run0.cascade, project.workId).filter((n) => isLeafType(n.workType)).map((n) => n.workId));
    // The cycle after the leaves landed: accepted, then refused at the trunk.
    const run1 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: p.change as never }, settings, priorCascade: run0.cascade as never, priorGateEvaluations: run0.gateEvaluations, alreadyLanded: leaves } as OrgRuntimeDeps);
    expect(run1.refusals.some((r) => r.includes(branch) && r.includes(MERGE_CONFLICT))).toBe(true);
    const minted = childrenOf(run1.cascade, project.workId).filter((c) => c.workType === WorkType.Defect && (c.brief ?? "").includes("packages/contracts/dist/index.d.ts"));
    expect(minted.length).toBe(1);
    expect(minted[0]?.state).not.toBe(WorkState.Done);
    // Idempotent: the next cycle, with the leaf still open, mints no second one.
    const run2 = await runOrgRuntime({ ...base, providers: { ...defaultProviderSet(base), change: p.change as never }, settings, priorCascade: run1.cascade as never, priorGateEvaluations: run1.gateEvaluations, alreadyLanded: leaves } as OrgRuntimeDeps);
    expect(childrenOf(run2.cascade, project.workId).filter((c) => c.workType === WorkType.Defect && (c.brief ?? "").includes("packages/contracts/dist/index.d.ts")).length).toBe(1);
  }, 90_000);
});
