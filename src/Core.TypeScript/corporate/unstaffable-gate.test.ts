/**
 * unstaffable-gate.test.ts — falsifiers for the raise `blockerEvent` never had.
 *
 * The defect this module closes was not a wrong answer, it was NO CALLER: `blockerEvent` existed,
 * was complete, and nothing in the organization ever invoked it. So the properties that matter are
 * the ones that make a raise trustworthy rather than free —
 *
 *   - a raise is DERIVED from the chart, so it cannot be asserted by an agent that wants out
 *   - a healthy organization raises NOTHING, so the mechanism can be wrong in the safe direction
 *   - a gate somebody owns internally ESCALATES rather than spending a person's attention
 *   - the same unstaffable step raises ONE blocker however many times it is checked
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { gateDemand, type GateDemand, type GateStep } from "./gate-demand";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import { GateKind, HumanCheckpoint } from "./quality-gate";
import { acceptBlocker, exhaustionHolds } from "./human-blocker";
import { foldBlockers } from "./org-fold";
import { blockerEvent } from "./human-blocker";
import { humanGatesFor } from "./quality-gate";
import {
  checkpointStops,
  staffabilityOf,
  unstaffableRaises,
  UNSTAFFABLE_KIND,
} from "./unstaffable-gate";

function chartOf(): OrgChart {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  return built.chart;
}
const CHART = chartOf();

function node(over: Partial<CascadeNode> & Pick<CascadeNode, "workId" | "workType">): CascadeNode {
  return { title: `title of ${over.workId}`, state: WorkState.Open, ownerHatId: "cto", ...over } as CascadeNode;
}

const TASK: Cascade = { nodes: [node({ workId: "T-1", workType: WorkType.Task })] };
const DEMAND: GateDemand = gateDemand({ cascade: TASK, evaluations: [] });

function step(over: Partial<GateStep> = {}): GateStep {
  return {
    workId: "T-1", workType: WorkType.Task, gate: GateKind.QaUat, title: "a task",
    ownerHatId: "cto", attempt: 1, rework: false, why: "not judged", ...over,
  };
}

describe("a healthy organization raises NOTHING", () => {
  test("the seed chart can staff every gate it owes, so no blocker leaves", () => {
    // The safe direction. A mechanism that raised on a well-formed org would fill a person's queue
    // with questions about an organization that is fine, which is how the queue stops being read.
    const out = unstaffableRaises({ chart: CHART, demand: DEMAND, byHatId: "cto", atMs: 1_000 });
    expect(out.raises).toEqual([]);
  });

  test("but it CHECKED — an empty raise list is not an empty check", () => {
    const out = unstaffableRaises({ chart: CHART, demand: DEMAND, byHatId: "cto", atMs: 1_000 });
    expect(out.checked.length).toBe(DEMAND.ready.length);
    expect(out.checked.every((c) => c.performable)).toBe(true);
  });

  test("staffability names who could author and who could approve", () => {
    const verdict = staffabilityOf(CHART, step({ gate: GateKind.ArchitectureDesign }));
    expect(verdict.performable).toBe(true);
    expect(verdict.canAuthor.length + verdict.canApprove.length).toBeGreaterThan(0);
    expect(verdict.because).toContain("could author");
  });
});

describe("an organization that genuinely cannot perform a gate raises", () => {
  /** A chart with hats but no approval scopes and no departments — nobody can do anything. */
  function bareChart(): OrgChart {
    const built = buildOrgChart([
      { id: "boss", name: "Boss", level: "c_suite" },
      { id: "worker", name: "Worker", level: "ic", reportsTo: "boss" },
    ] as unknown as typeof SEED_HATS);
    if (!built.ok) throw new Error(built.reason);
    return built.chart;
  }

  test("A GATE NOBODY CAN AUTHOR OR APPROVE PRODUCES A BLOCKER", () => {
    const out = unstaffableRaises({
      chart: bareChart(), demand: DEMAND, byHatId: "boss", atMs: 5_000,
    });
    expect(out.raises.length).toBeGreaterThan(0);
    expect(out.raises[0]?.blocking).toBe("T-1");
  });

  test("the raise says what it unblocks, so the person knows what their answer buys", () => {
    const out = unstaffableRaises({ chart: bareChart(), demand: DEMAND, byHatId: "boss", atMs: 5_000 });
    expect(out.raises[0]?.unblocks.length).toBeGreaterThan(10);
    expect(out.raises[0]?.why.length).toBeGreaterThan(10);
  });

  test("THE RAISE SURVIVES ITS OWN DOOR — shape AND the chart-checked claim", () => {
    // The real check, and it is two checks because `human-blocker` splits them: `acceptBlocker`
    // validates the shape, `exhaustionHolds` disproves the CLAIM against the chart. A derived
    // raise that its own door would reject would be a mechanism producing junk.
    const chart = bareChart();
    const out = unstaffableRaises({ chart, demand: DEMAND, byHatId: "boss", atMs: 5_000 });
    expect(out.raises.length).toBeGreaterThan(0);
    for (const raise of out.raises) {
      expect(acceptBlocker(raise).ok).toBe(true);
      const held = exhaustionHolds(chart, raise.exhaustion);
      expect(held.holds).toBe(true);
    }
  });

  test("AND THE SEED CHART DISPROVES THE SAME CLAIM — the check can fail", () => {
    // Without this the test above is vacuous: a claim nothing can refute is not a checked claim.
    // The seed org owns missing capabilities, so `no_owner_in_org` is false there.
    const out = unstaffableRaises({ chart: bareChart(), demand: DEMAND, byHatId: "boss", atMs: 5_000 });
    const raise = out.raises[0];
    if (raise === undefined) throw new Error("expected a raise");
    expect(exhaustionHolds(CHART, raise.exhaustion).holds).toBe(false);
  });

  test("the id is STABLE, so checking twice is one blocker and not two", () => {
    const chart = bareChart();
    const a = unstaffableRaises({ chart, demand: DEMAND, byHatId: "boss", atMs: 5_000 });
    const b = unstaffableRaises({ chart, demand: DEMAND, byHatId: "boss", atMs: 9_999 });
    expect(a.raises.map((r) => r.blockerId)).toEqual(b.raises.map((r) => r.blockerId));
  });

  test("the exhaustion is the one form that needs no prior attempt", () => {
    // An org with no hat for a gate cannot ask that hat first, and demanding evidence of an
    // impossible attempt would trap exactly the blocker that most needs a person.
    const out = unstaffableRaises({ chart: bareChart(), demand: DEMAND, byHatId: "boss", atMs: 5_000 });
    expect(out.raises[0]?.exhaustion.kind).toBe("no_owner_in_org");
    expect(out.raises[0]?.kind).toBe(UNSTAFFABLE_KIND);
  });
});

describe("a raise is recoverable from the log", () => {
  test("A BLOCKER ROUND-TRIPS THROUGH THE EVENT LOG", () => {
    // The other half of the defect: the event used to carry a sentence and an id, so a reader saw
    // THAT somebody was stuck and never WHAT — which left the raise unanswerable.
    const chart = (() => {
      const built = buildOrgChart([
        { id: "boss", name: "Boss", level: "c_suite" },
        { id: "worker", name: "Worker", level: "ic", reportsTo: "boss" },
      ] as unknown as typeof SEED_HATS);
      if (!built.ok) throw new Error(built.reason);
      return built.chart;
    })();
    const out = unstaffableRaises({ chart, demand: DEMAND, byHatId: "boss", atMs: 5_000 });
    expect(out.raises.length).toBeGreaterThan(0);

    const events = out.raises.map((r, i) => blockerEvent(r, `evt-${String(i)}`));
    const read = foldBlockers(events);
    expect(read.map((b) => b.blockerId)).toEqual(out.raises.map((r) => r.blockerId));
    expect(read[0]?.about).toBe(out.raises[0]?.about ?? "");
    expect(read[0]?.unblocks).toBe(out.raises[0]?.unblocks ?? "");
  });

  test("the same raise appended twice folds to ONE blocker", () => {
    const chart = (() => {
      const built = buildOrgChart([
        { id: "boss", name: "Boss", level: "c_suite" },
        { id: "worker", name: "Worker", level: "ic", reportsTo: "boss" },
      ] as unknown as typeof SEED_HATS);
      if (!built.ok) throw new Error(built.reason);
      return built.chart;
    })();
    const raise = unstaffableRaises({ chart, demand: DEMAND, byHatId: "boss", atMs: 5_000 }).raises[0];
    if (raise === undefined) throw new Error("expected a raise");
    expect(foldBlockers([blockerEvent(raise, "e1"), blockerEvent(raise, "e2")])).toHaveLength(1);
  });

  test("a log with no raises folds to no blockers", () => {
    expect(foldBlockers([])).toEqual([]);
  });
});

describe("checkpoints are CONFIGURED, never inferred", () => {
  test("no checkpoints means nothing stops for a person", () => {
    // The property the broken inbox could not produce: it listed every ready step, so it was
    // incapable of saying an agentic organization is not waiting on anyone.
    expect(checkpointStops(DEMAND, humanGatesFor([]))).toEqual([]);
  });

  test("a configured checkpoint stops exactly its own gate", () => {
    const cascade: Cascade = { nodes: [node({ workId: "I-1", workType: WorkType.Initiative })] };
    const demand = gateDemand({ cascade, evaluations: [] });
    const stops = checkpointStops(demand, humanGatesFor([HumanCheckpoint.Grooming]));
    expect(stops.map((s) => s.gate)).toEqual([GateKind.BrdApproval]);
  });

  test("a checkpoint on a gate nothing currently owes stops nothing", () => {
    // Configuration alone must not manufacture a queue entry — the gate has to actually be ready.
    expect(checkpointStops(DEMAND, humanGatesFor([HumanCheckpoint.Grooming]))).toEqual([]);
  });
});
