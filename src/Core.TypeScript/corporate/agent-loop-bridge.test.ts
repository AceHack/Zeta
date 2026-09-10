/**
 * agent-loop-bridge.test.ts — an organization driving the canonical agent loop.
 *
 * The unit tests below pin the derivations, but the ones that matter run a REAL org run through the
 * loop: the surface was previously a pair of types with no producer, so the only way to know it
 * composes is to compose it.
 */

import { describe, expect, test } from "bun:test";
import {
  candidatesFrom,
  classificationsFor,
  contextFor,
  incidentWindowsFrom,
  contributionOf,
  perHatRatios,
  runAgentCycle,
  statusSurfaceFrom,
  trajectoryHeat,
  uncertaintyOf,
  type SurfaceInput,
} from "./agent-loop-bridge";
import { isFullyMeasured } from "./dora";
import { WorkState, type Cascade } from "./goal-cascade";
import { PriorityClass, type PriorityDecision } from "./prioritization";
import { GateKind, GateOutcome, type GateEvaluation } from "./quality-gate";
import { emptyQueue } from "./work-market";
import { agentsFromChart, runOrgRuntime, type OrgRuntimeDeps } from "./org-runtime";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { RunOutcome } from "./qa";
import { preferWhere } from "./org-decision";
import type { AgentState, MenuOption } from "../protocol/agent-loop-contract";
import type { OrgEvent } from "./org-event";
import { isNonCoercive } from "../workflow-engine/agent-loop/menu-generator";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const cascade: Cascade = {
  nodes: [
    { workId: "g1", workType: "goal", title: "g", state: WorkState.Open, ownerHatId: "cto" },
    { workId: "p1", workType: "project", title: "p", state: WorkState.InProgress, ownerHatId: "engineering_manager", parentWorkId: "g1" },
    { workId: "t1", workType: "task", title: "a", state: WorkState.Done, ownerHatId: "tech_lead", parentWorkId: "p1" },
    { workId: "t2", workType: "task", title: "b", state: WorkState.Open, ownerHatId: "tech_lead", parentWorkId: "p1" },
  ],
};

const priority = (workId: string, priorityClass: PriorityClass): PriorityDecision => ({
  workId,
  priorityClass,
  decidedByHatId: "cto",
  reason: "r",
  recommended: PriorityClass.Normal,
  reasonCodes: [],
});

const gate = (workId: string, outcome: GateOutcome): GateEvaluation => ({
  workId,
  gate: GateKind.ImplementationReview,
  outcome,
  byHatId: "tech_lead",
  reason: "r",
  atMs: 0, evidenceRefs: [],
});

const surfaceInput = (over: Partial<SurfaceInput> = {}): SurfaceInput => ({
  cascade,
  priorities: [],
  queue: emptyQueue("q1", "engineering_manager"),
  gateEvaluations: [],
  qa: [],
  snapshotIso: "2026-09-03T00:00:00.000Z",
  ...over,
});

describe("candidates are LIVE LEAVES only", () => {
  test("no parents, no finished work", () => {
    const ids = candidatesFrom(surfaceInput()).map((c) => c.id);
    expect(ids).toEqual(["t2"]);
  });

  test("a cancelled leaf is not offered", () => {
    const withCancel: Cascade = {
      nodes: cascade.nodes.map((n) => (n.workId === "t2" ? { ...n, state: WorkState.Canceled } : n)),
    };
    expect(candidatesFrom(surfaceInput({ cascade: withCancel }))).toEqual([]);
  });

  test("the phase follows the work's own state", () => {
    const open = candidatesFrom(surfaceInput())[0];
    expect(open?.trajectoryPhase).toBe("setup");
    const started: Cascade = {
      nodes: cascade.nodes.map((n) => (n.workId === "t2" ? { ...n, state: WorkState.InProgress } : n)),
    };
    expect(candidatesFrom(surfaceInput({ cascade: started }))[0]?.trajectoryPhase).toBe("execution");
  });

  test("lane and interest come from the CALLER, and default to neither/neutral", () => {
    const plain = candidatesFrom(surfaceInput())[0];
    expect(plain?.lane).toBe("mixed");
    expect(plain?.agentInterest).toBe(0.5);

    const supplied = candidatesFrom(
      surfaceInput({ laneFor: () => "substrate-cascade", interestFor: () => 0.9 }),
    )[0];
    expect(supplied?.lane).toBe("substrate-cascade");
    expect(supplied?.agentInterest).toBeCloseTo(0.9, 6);
  });

  test("a nonsense interest is clamped, not trusted", () => {
    expect(candidatesFrom(surfaceInput({ interestFor: () => 42 }))[0]?.agentInterest).toBe(1);
    expect(candidatesFrom(surfaceInput({ interestFor: () => Number.NaN }))[0]?.agentInterest).toBe(0.5);
  });
});

describe("contribution comes from the priority the organization DECIDED", () => {
  test("expedite is the top of the range and paused the bottom", () => {
    expect(contributionOf("t2", [priority("t2", PriorityClass.Expedite)])).toBe(1);
    expect(contributionOf("t2", [priority("t2", PriorityClass.Paused)])).toBe(0);
    expect(contributionOf("t2", [priority("t2", PriorityClass.Normal)])).toBeCloseTo(0.5, 6);
  });

  test("the DECISION is read, never the recommendation", () => {
    // A human overriding the scorer is the organization saying the scorer was wrong about this
    // item; reading `recommended` would quietly discard that.
    const overridden: PriorityDecision = {
      ...priority("t2", PriorityClass.Expedite),
      recommended: PriorityClass.Defer,
    };
    expect(contributionOf("t2", [overridden])).toBe(1);
  });

  test("unprioritized work is UNKNOWN, not worthless", () => {
    expect(contributionOf("t2", [])).toBe(0.5);
  });
});

describe("uncertainty rises with unresolved trouble", () => {
  test("rejections and QA failures both count, and it saturates at 1", () => {
    expect(uncertaintyOf("t2", [], [])).toBe(0);
    expect(uncertaintyOf("t2", [gate("t2", GateOutcome.Rejected)], [])).toBeCloseTo(1 / 3, 6);
    expect(uncertaintyOf("t2", Array.from({ length: 9 }, () => gate("t2", GateOutcome.Rejected)), [])).toBe(1);
  });

  test("an APPROVED gate adds nothing, and another item's trouble is not ours", () => {
    expect(uncertaintyOf("t2", [gate("t2", GateOutcome.Approved)], [])).toBe(0);
    expect(uncertaintyOf("t2", [gate("other", GateOutcome.Rejected)], [])).toBe(0);
  });
});

describe("trajectory heat is DERIVED, never read off a parent's stored state", () => {
  test("a trajectory with live leaves is hot; one whose leaves are all done is cooling", () => {
    const hot = trajectoryHeat(cascade);
    expect(hot.hot).toContain("p1");

    // Completion is derived from the leaves and never written back onto the parent, so `p1` still
    // reads `in_progress` here. Reading that stored state would report this trajectory hot forever.
    const finished: Cascade = {
      nodes: cascade.nodes.map((n) => (n.workId === "t2" ? { ...n, state: WorkState.Done } : n)),
    };
    const cool = trajectoryHeat(finished);
    expect(cool.cooling).toContain("p1");
    expect(cool.hot).not.toContain("p1");
    expect(finished.nodes.find((n) => n.workId === "p1")?.state).toBe(WorkState.InProgress);
  });

  test("a leaf is neither hot nor cooling — it is not a trajectory", () => {
    const heat = trajectoryHeat(cascade);
    expect([...heat.hot, ...heat.cooling]).not.toContain("t2");
  });
});

describe("LANES COME FROM THE CLASSIFIER, and they make the balance term live", () => {
  const paths: Record<string, readonly string[]> = {
    t2: ["src/Core.TypeScript/hygiene/audit.ts"],
  };
  const withPaths = (over: Partial<SurfaceInput> = {}) =>
    surfaceInput({ pathsFor: (n) => paths[n.workId] ?? [], ...over });

  test("a path-bearing item gets the classifier's lane, not `mixed`", () => {
    expect(candidatesFrom(surfaceInput())[0]?.lane).toBe("mixed");
    expect(candidatesFrom(withPaths())[0]?.lane).toBe("tooling-or-ci");
  });

  test("an explicit laneFor OVERRIDES the paths — the caller's answer wins", () => {
    expect(candidatesFrom(withPaths({ laneFor: () => "operational" }))[0]?.lane).toBe("operational");
  });

  test("an item with no paths stays `mixed` even when a pathsFor exists", () => {
    const noPaths = candidatesFrom(surfaceInput({ pathsFor: () => [] }))[0];
    expect(noPaths?.lane).toBe("mixed");
  });

  test("PER-HAT RATIOS ARE COMPUTED — the balance term was dead before this", () => {
    // With no paths the map is empty and the menu's balance term sits at neutral forever, which is
    // a scoring term that can never vary — the vacuity class inside the scorer.
    expect(perHatRatios(surfaceInput())).toEqual({});

    const assigned: Cascade = {
      nodes: cascade.nodes.map((n) => (n.workId === "t2" ? { ...n, assigneeHatId: "backend_implementer" } : n)),
    };
    const ratios = perHatRatios(
      withPaths({
        cascade: assigned,
        pathsFor: (n) => (n.workId === "t2" ? ["src/Core.TypeScript/hygiene/audit.ts"] : []),
      }),
    );
    // The hat did one tooling item and no operational work, so its operational ratio is 0.
    expect(ratios["backend_implementer"]).toBe(0);
  });

  test("the ratio really tracks the WORK — operational paths move it to 1", () => {
    const assigned: Cascade = {
      nodes: cascade.nodes.map((n) => (n.workId === "t2" ? { ...n, assigneeHatId: "backend_implementer" } : n)),
    };
    const ratios = perHatRatios(
      withPaths({ cascade: assigned, pathsFor: () => ["src/Core/Runtime.fs"] }),
    );
    // `src/Core/**` is the operational lane in the classifier's own rules.
    expect(ratios["backend_implementer"]).toBe(1);
  });

  test("only LIVE LEAVES are classified — parents and cancelled work are not", () => {
    // A parent classified alongside its children double-counts the same work, and a cancelled item
    // counts work nobody did. Both would silently skew the ratio the menu balances on.
    const everything: Cascade = {
      nodes: cascade.nodes.map((n) =>
        n.workId === "t1" ? { ...n, state: WorkState.Canceled, assigneeHatId: "backend_implementer" } : { ...n, assigneeHatId: "backend_implementer" },
      ),
    };
    // Every node gets an operational path EXCEPT the cancelled one and the parents, which get a
    // substrate path — so if either were included the ratio would fall below 1.
    const classifications = classificationsFor(
      surfaceInput({
        cascade: everything,
        pathsFor: (n) =>
          n.workId === "t2" ? ["src/Core/Runtime.fs"] : ["docs/notes.md"],
      }),
    );
    expect(classifications.map((c) => c.sha)).toEqual(["t2"]);
    const ratios = perHatRatios(
      surfaceInput({
        cascade: everything,
        pathsFor: (n) => (n.workId === "t2" ? ["src/Core/Runtime.fs"] : ["docs/notes.md"]),
      }),
    );
    expect(ratios["backend_implementer"]).toBe(1);
  });

  test("the ratio is attributed to the ASSIGNEE, not the owner", () => {
    const assigned: Cascade = {
      nodes: cascade.nodes.map((n) => (n.workId === "t2" ? { ...n, assigneeHatId: "backend_implementer" } : n)),
    };
    // Paths ONLY for t2, so exactly one item is classified and the attribution is unambiguous.
    const ratios = perHatRatios(
      withPaths({
        cascade: assigned,
        pathsFor: (n) => (n.workId === "t2" ? ["src/Core/Runtime.fs"] : []),
      }),
    );
    // `t2` is OWNED by tech_lead and ASSIGNED to backend_implementer. The ratio belongs to whoever
    // did the work.
    expect(Object.keys(ratios)).toEqual(["backend_implementer"]);
    expect(ratios["tech_lead"]).toBeUndefined();
  });

  test("ONE classification feeds both readings — the DORA ratio and the per-hat ratios agree", () => {
    // Classifying twice would let the substrate ratio and the balance term disagree about the same
    // work, which is the two-records-of-one-fact failure this register is built to avoid.
    const surface = statusSurfaceFrom(
      withPaths({ pathsFor: (n) => (n.workId === "t2" ? ["docs/notes.md"] : []) }),
    );
    expect(isFullyMeasured(surface.dora)).toBe(false);
    // substrateRatio is now MEASURED (only MTTR remains), and it agrees with the lanes above.
    expect(surface.dora.unmeasured.map((u) => u.field)).toEqual(["mttrMedianSeconds"]);
    expect(surface.dora.metrics.substrateRatio).toBe(1);
  });

  test("the computed ratio reaches the snapshot the menu actually reads", () => {
    const assigned: Cascade = {
      nodes: cascade.nodes.map((n) => (n.workId === "t2" ? { ...n, assigneeHatId: "backend_implementer" } : n)),
    };
    const surface = statusSurfaceFrom(
      withPaths({ cascade: assigned, pathsFor: () => ["src/Core/Runtime.fs"] }),
    );
    expect(surface.snapshot.perAgentRatios["backend_implementer"]).toBe(1);
  });
});

describe("incident windows are read off the RUN'S OWN TRACE", () => {
  const incidentCascade: Cascade = {
    nodes: [
      { workId: "p1", workType: "project", title: "p", state: WorkState.InProgress, ownerHatId: "engineering_manager" },
      { workId: "inc1", workType: "incident", title: "outage", state: WorkState.Done, ownerHatId: "tech_lead", parentWorkId: "p1", assigneeHatId: "sre" },
      { workId: "t1", workType: "task", title: "t", state: WorkState.Open, ownerHatId: "tech_lead", parentWorkId: "p1" },
    ],
  };
  const ev = (subjectId: string, atMs: number, toState?: string) =>
    ({ id: `e-${subjectId}-${atMs}`, kind: "work_item_transition", atMs, subjectId, decision: "d", supervisorChain: [], evidenceRefs: [], ...(toState === undefined ? {} : { toState }) }) as unknown as OrgEvent;

  test("detection is the EARLIEST event and restoration the FIRST move to done", () => {
    // Two done transitions on purpose: an incident reopened and closed again is restored at the
    // first restoration, not the last. Taking the last would measure the whole saga as one outage.
    const windows = incidentWindowsFrom(incidentCascade, [
      ev("inc1", 1_000),
      ev("inc1", 5_000),
      ev("inc1", 9_000, WorkState.Done),
      ev("inc1", 50_000, WorkState.Done),
      ev("t1", 0, WorkState.Done),
    ]);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.workId).toBe("inc1");
    expect(windows[0]?.detectedAtMs).toBe(1_000);
    expect(windows[0]?.restoredAtMs).toBe(9_000);
  });

  test("ONLY incidents — a task that finished is not an incident that was restored", () => {
    const windows = incidentWindowsFrom(incidentCascade, [ev("t1", 0, WorkState.Done)]);
    expect(windows).toEqual([]);
  });

  test("an incident with no done transition has NO restoration time", () => {
    const windows = incidentWindowsFrom(incidentCascade, [ev("inc1", 1_000), ev("inc1", 4_000)]);
    expect(windows[0]?.restoredAtMs).toBeUndefined();
  });

  test("the surface carries them through, and MTTR becomes a measurement", () => {
    const surface = statusSurfaceFrom(
      surfaceInput({
        cascade: incidentCascade,
        trace: [ev("inc1", 0), ev("inc1", 30_000, WorkState.Done)],
      }),
    );
    expect(surface.dora.unmeasured.map((u) => u.field)).not.toContain("mttrMedianSeconds");
    expect(surface.dora.metrics.mttrMedianSeconds).toBe(30);
  });

  test("without a trace MTTR stays unmeasured — no trace, no restoration times", () => {
    const surface = statusSurfaceFrom(surfaceInput({ cascade: incidentCascade }));
    expect(surface.dora.unmeasured.map((u) => u.field)).toContain("mttrMedianSeconds");
  });
});

describe("the status surface", () => {
  test("carries the DORA caveats through rather than just the numbers", () => {
    const surface = statusSurfaceFrom(surfaceInput());
    expect(isFullyMeasured(surface.dora)).toBe(false);
    expect(surface.snapshot.currentDora).toEqual(surface.dora.metrics);
  });

  test("exploration candidates are the work with something unknown standing against it", () => {
    const clean = statusSurfaceFrom(surfaceInput());
    expect(clean.snapshot.explorationCandidates).toEqual([]);
    const troubled = statusSurfaceFrom(surfaceInput({ gateEvaluations: [gate("t2", GateOutcome.Rejected)] }));
    expect(troubled.snapshot.explorationCandidates).toEqual(["t2"]);
  });

  test("per-agent ratios are left EMPTY when nothing supplies paths, never invented", () => {
    // A fabricated ratio would silently steer the menu's balance term toward a portfolio nobody
    // measured. Empty leaves it neutral, which is the absence of a claim.
    expect(statusSurfaceFrom(surfaceInput()).snapshot.perAgentRatios).toEqual({});
  });

  test("the snapshot's time is the one PASSED IN", () => {
    expect(statusSurfaceFrom(surfaceInput()).snapshot.snapshotIso).toBe("2026-09-03T00:00:00.000Z");
  });
});

describe("one turn of the loop", () => {
  const surface = statusSurfaceFrom(surfaceInput({ priorities: [priority("t2", PriorityClass.Expedite)] }));
  const idle: AgentState = { tag: "Idle", context: contextFor("alexa", 1, "2026-09-03T00:00:00.000Z") };

  test("the menu is checked for coercion rather than assumed clean", () => {
    const cycle = runAgentCycle({ state: idle, surface });
    expect(cycle.nonCoercive).toBe(true);
    expect(isNonCoercive(cycle.menu)).toBe(true);
    expect(cycle.refusals).toEqual([]);
  });

  test("the default chooser takes the best-scoring work and the agent starts executing", () => {
    const cycle = runAgentCycle({ state: idle, surface });
    expect(cycle.chosen?.tag).toBe("PickWork");
    expect(cycle.state.tag).toBe("ExecutingWork");
  });

  test("a result closes the cycle back to Idle — the loop actually goes round", () => {
    const cycle = runAgentCycle({
      state: idle,
      surface,
      resultFor: (o) =>
        o.tag === "PickWork"
          ? { workId: o.work.id, lane: o.work.lane, success: true, doraContribution: 0.5 }
          : undefined,
    });
    expect(cycle.state.tag).toBe("Idle");
    expect(cycle.state.context.cycle).toBe(1);
  });

  test("A CHOOSER CAN TAKE A FREE MODE — the menu is an offer, not a queue", () => {
    const rest = preferWhere<MenuOption>((o) => o.tag === "EnterFreeTime", "rest");
    const cycle = runAgentCycle({ state: idle, surface, chooser: rest });
    expect(cycle.chosen?.tag).toBe("EnterFreeTime");
    // Chosen rest CLOSES the cycle back to Idle — that is the canonical `cycleClose`, and it is
    // what makes free time a mode rather than a trap.
    expect(cycle.state.tag).toBe("Idle");
  });

  test("OPEN-ENDED EXPLORATION STAYS — the one free mode the cycle does not close", () => {
    // The canonical `cycleClose` keeps an open-ended exploration alive and closes ordinary free
    // time. Both are free modes; only one is meant to survive the cycle boundary.
    const explore = preferWhere<MenuOption>((o) => o.tag === "EnterOpenEndedExploration", "explore");
    const cycle = runAgentCycle({ state: idle, surface, chooser: explore });
    expect(cycle.chosen?.tag).toBe("EnterOpenEndedExploration");
    expect(cycle.state.tag).toBe("FreeTime");
  });

  test("a chooser that THROWS falls back to a legal option instead of taking the loop down", () => {
    const cycle = runAgentCycle({
      state: idle,
      surface,
      chooser: () => {
        throw new Error("chooser exploded");
      },
    });
    expect(cycle.chosen).toBeDefined();
    expect(cycle.refusals.some((r) => r.includes("chooser exploded"))).toBe(true);
  });

  test("an out-of-range index is clamped and RECORDED", () => {
    const cycle = runAgentCycle({ state: idle, surface, chooser: () => ({ index: 9999, reason: "nonsense" }) });
    expect(cycle.chosen).toBeDefined();
    expect(cycle.refusals.some((r) => r.includes("clamped"))).toBe(true);
  });

  test("A REGISTER THAT NARROWS THE MENU INTO A CAGE IS CAUGHT", () => {
    // The seam a register uses to narrow the core's menu is the only place coercion can enter, so
    // it is the only place the check can earn its keep. A policy that strips a free mode is exactly
    // the failure `.claude/rules` calls the non-coercion invariant, and it must not pass silently.
    const cage = runAgentCycle({
      state: idle,
      surface,
      menuPolicy: (m) => m.filter((o) => o.tag !== "EnterFreeTime"),
    });
    expect(cage.nonCoercive).toBe(false);
    expect(cage.refusals.some((r) => r.includes("coercive"))).toBe(true);
    // It still returns a usable cycle — reporting the violation, not throwing.
    expect(cage.chosen).toBeDefined();
  });

  test("a policy that narrows WORK but leaves the free modes is not coercive", () => {
    // The legitimate case: a calendar may say what work is in scope. It may not say an agent must
    // work, and this is the difference.
    const inMeeting = runAgentCycle({
      state: idle,
      surface,
      menuPolicy: (m) => m.filter((o) => o.tag !== "PickWork"),
    });
    expect(inMeeting.nonCoercive).toBe(true);
    expect(inMeeting.refusals).toEqual([]);
    expect(inMeeting.menu.some((o) => o.tag === "PickWork")).toBe(false);
  });

  test("a named dependency reaches the menu; without one no wait is offered", () => {
    const withDep = runAgentCycle({ state: idle, surface, namedDeps: [{ namedDep: "vendor SDK" }] });
    expect(withDep.menu.some((o) => o.tag === "EnterNamedBoundedWait")).toBe(true);
    const without = runAgentCycle({ state: idle, surface });
    expect(without.menu.some((o) => o.tag === "EnterNamedBoundedWait")).toBe(false);
  });
});

// ─── END TO END: a real org run drives the loop ─────────────────────────────

const GOOD: ExternalEvent = {
  source: "portal",
  externalId: "T-1",
  kind: IntakeKind.Defect,
  severity: Severity.High,
  title: "checkout double-charges",
  reproduction: "twice",
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
      executivePriority: 0.5, customerImpact: 1, severity: 1, releaseRisk: 0.2,
      blockedDownstreamCount: 2, dependencyFanOut: 1, queueAgeMs: 0, hatScarcity: 0,
      budgetBurn: 0, estimatedEffort: 0.2,
    }),
    ...over,
  };
}

describe("END TO END — a real organization run drives the canonical loop", () => {
  test("a DELIVERED run leaves no work to pick, and the agent still has a full menu", async () => {
    const report = await runOrgRuntime(deps());
    const surface = statusSurfaceFrom({ ...report, snapshotIso: "2026-09-03T00:00:00.000Z" });

    expect(report.delivered).toBe(true);
    expect(surface.candidates).toEqual([]);
    // Everything shipped, so every trajectory is cooling and none is hot.
    expect(surface.snapshot.hotTrajectories).toEqual([]);
    expect(surface.snapshot.coolingTrajectories.length).toBeGreaterThan(0);
    // Deployments really were measured from the run.
    expect(surface.dora.metrics.deploymentCount).toBeGreaterThan(0);
    expect(surface.dora.metrics.changeFailureRate).toBe(0);

    const idle: AgentState = { tag: "Idle", context: contextFor("alexa", 1, "2026-09-03T00:00:00.000Z") };
    const cycle = runAgentCycle({ state: idle, surface });
    // NO WORK IS NOT A CAGE. The free modes are still there.
    expect(cycle.nonCoercive).toBe(true);
    expect(cycle.menu.some((o) => o.tag === "PickWork")).toBe(false);
  });

  test("a FAILING run produces work, marks it uncertain, and the agent picks it up", async () => {
    const report = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    const surface = statusSurfaceFrom({ ...report, snapshotIso: "2026-09-03T00:00:00.000Z" });

    expect(surface.candidates.length).toBeGreaterThan(0);
    // The trouble the run recorded shows up as uncertainty, and uncertainty is upside.
    for (const c of surface.candidates) expect(c.uncertainty).toBeGreaterThan(0);
    expect(surface.snapshot.explorationCandidates.length).toBeGreaterThan(0);
    expect(surface.snapshot.hotTrajectories.length).toBeGreaterThan(0);
    expect(surface.dora.metrics.changeFailureRate).toBeGreaterThan(0);

    const idle: AgentState = { tag: "Idle", context: contextFor("alexa", 1, "2026-09-03T00:00:00.000Z") };
    const cycle = runAgentCycle({
      state: idle,
      surface,
      resultFor: (o) =>
        o.tag === "PickWork"
          ? { workId: o.work.id, lane: o.work.lane, success: true, doraContribution: 0.5 }
          : undefined,
    });
    expect(cycle.chosen?.tag).toBe("PickWork");
    expect(cycle.state.tag).toBe("Idle");
    expect(cycle.nonCoercive).toBe(true);
  });

  test("the two runs give DIFFERENT surfaces — the derivation reads the run, not a constant", async () => {
    const ok = statusSurfaceFrom({
      ...(await runOrgRuntime(deps())),
      snapshotIso: "2026-09-03T00:00:00.000Z",
    });
    const bad = statusSurfaceFrom({
      ...(await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }))),
      snapshotIso: "2026-09-03T00:00:00.000Z",
    });
    expect(ok.candidates.length).not.toBe(bad.candidates.length);
    expect(ok.snapshot.hotTrajectories.length).not.toBe(bad.snapshot.hotTrajectories.length);
    expect(ok.dora.metrics.changeFailureRate).not.toBe(bad.dora.metrics.changeFailureRate);
  });

  test("the loop can run several cycles without spinning on the same item", async () => {
    const report = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    const surface = statusSurfaceFrom({ ...report, snapshotIso: "2026-09-03T00:00:00.000Z" });
    let state: AgentState = { tag: "Idle", context: contextFor("alexa", 1, "2026-09-03T00:00:00.000Z") };
    const picked: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const cycle = runAgentCycle({ state, surface });
      if (cycle.chosen?.tag === "PickWork") picked.push(cycle.chosen.work.id);
      state = cycle.state;
      expect(cycle.nonCoercive).toBe(true);
    }
    // The in-flight item is never re-picked, so the loop never spins on ONE item...
    for (let i = 1; i < picked.length; i += 1) expect(picked[i]).not.toBe(picked[i - 1]);
  });

  test("SWITCHING AWAY FROM LIVE WORK IS REPORTED — the churn is not silent", async () => {
    // The canonical `transition` replaces `ExecutingWork`'s item and keeps no note of the one it
    // dropped, so an agent can alternate between two items forever and finish neither while every
    // cycle looks productive. The bridge does not change that transition; it names what happened.
    const report = await runOrgRuntime(deps({ qaFallback: RunOutcome.Failed }));
    const surface = statusSurfaceFrom({ ...report, snapshotIso: "2026-09-03T00:00:00.000Z" });
    let state: AgentState = { tag: "Idle", context: contextFor("alexa", 1, "2026-09-03T00:00:00.000Z") };

    const first = runAgentCycle({ state, surface });
    expect(first.abandonedWorkId).toBeUndefined(); // nothing was in flight yet
    state = first.state;

    const second = runAgentCycle({ state, surface });
    expect(second.chosen?.tag).toBe("PickWork");
    expect(second.abandonedWorkId).toBe((first.chosen as { work: { id: string } }).work.id);

    // And recording a result means nothing was abandoned — the report distinguishes the two.
    const withResult = runAgentCycle({
      state,
      surface,
      resultFor: (o) =>
        o.tag === "PickWork"
          ? { workId: o.work.id, lane: o.work.lane, success: true, doraContribution: 0.5 }
          : undefined,
    });
    expect(withResult.abandonedWorkId).toBeUndefined();
  });
});
