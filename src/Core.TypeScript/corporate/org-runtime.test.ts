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

import { chainFor } from "./gate-demand";
import { describe, expect, test } from "bun:test";
import { agentsFromChart, gateStaffing, runOrgRuntime, staffingReadout, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart, reportsUpTo } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, externalRefOf, type ExternalEvent } from "./intake";
import { parseRequestRef } from "./request";
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
import type { OrgEvent } from "./org-event";

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
    expect(offDiscipline.every((r) => r.includes("runtime_validation"))).toBe(true);
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
    expect(report.qa).toHaveLength(2);
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
      // …and the obligation, so the agent reproduces before it fixes.
      expect(n.brief).toContain("No reproduction was supplied");
    }
  }, 60_000);

  test("a defect that CAME with a reproduction is not told it owes one", async () => {
    const withSteps: ExternalEvent = { ...unreproduced, externalId: "AIAGENT-1", reproduction: "1. archive session 2 of 3" };
    const report = await runOrgRuntime(deps({ externalEvents: [withSteps], settings: [reproduceFirst] }));
    expect(report.cascade.nodes.length).toBeGreaterThan(0);
    expect(report.cascade.nodes.every((n) => !(n.brief ?? "").includes("No reproduction was supplied"))).toBe(true);
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
  }, 60_000);
});
