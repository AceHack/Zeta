/**
 * observation-sources.test.ts — nine vocabularies, one question, and no third copy of the answer.
 *
 * The adapters are only worth having if they are DERIVED. An adapter that lists the twelve lag
 * conditions by hand is a second roster that drifts from the first, and the drift is silent in the
 * one direction that matters: a thirteenth condition would be invisible.
 *
 * So the tests are mostly about derivation — change the source module's own output, and the
 * observations change with it — plus the one thing the unification is FOR: a global blind-spot
 * count that nobody has to assemble by knowing all nine modules exist.
 */

import { describe, expect, test } from "bun:test";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { buildContextPack, ContextItemKind, OmissionKind } from "./context-pack";
import { buildHandoffBrief, HandoffTrigger } from "./handoff-brief";
import { detectLag, LagKind, LAG_CONDITION_COUNT } from "./lag-detection";
import { projectGraph, UNDERIVED_EDGE_KINDS, EdgeKind } from "./org-graph";
import { Fidelity, Port } from "./providers";
import { DisagreementKind, Party, reconcile } from "./reconciliation";
import { WorkState, WorkType } from "./goal-cascade";
import { Domain, DomainMatch, type DomainRouting } from "./domain-ontology";
import {
  blindSpots,
  foldObservations,
  fullyObserved,
  missingDetectors,
  ObservationState,
  type Observation,
} from "./observation-ledger";
import {
  fromContextPack,
  fromHandoffBrief,
  fromLagReport,
  fromOrgGraph,
  fromDomainRouting,
  fromPortFidelity,
  fromReconciliation,
} from "./observation-sources";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const NOW = 1_000_000;

function fold(entries: readonly Observation[]) {
  const r = foldObservations(entries);
  if (!r.ok) throw new Error(r.reason);
  return r.ledger;
}

describe("LAG — twelve conditions, derived from the detector table", () => {
  test("AN UNWIRED SWEEP CONTRIBUTES TWELVE BLIND SPOTS, each with a reason", () => {
    const obs = fromLagReport(detectLag(chart, { nowMs: NOW }));
    expect(obs).toHaveLength(LAG_CONDITION_COUNT);
    expect(obs.every((o) => o.state === ObservationState.NotRun)).toBe(true);
    // Every one says what was missing. A blind spot with no reason is the defect this replaces.
    expect(obs.every((o) => (o.why ?? "").trim() !== "")).toBe(true);
    // AND THE REASON IS SPECIFIC. "not run" as a blanket string satisfies non-empty and tells
    // nobody which input to supply, which is a blind spot you cannot act on.
    expect(obs.find((o) => o.question === LagKind.QueueSaturated)?.why).toContain("queue depths");
    expect(obs.find((o) => o.question === LagKind.UnboundRun)?.why).toContain("runs");
    expect(new Set(obs.map((o) => o.why)).size).toBeGreaterThan(6);
  });

  test("SUPPLYING AN INPUT MOVES A QUESTION FROM not_run TO observed", () => {
    const before = fromLagReport(detectLag(chart, { nowMs: NOW }));
    const after = fromLagReport(detectLag(chart, { nowMs: NOW, reviews: [{ workId: "task-1" }] }));
    const q = (obs: readonly Observation[]) => obs.find((o) => o.question === LagKind.ReviewerMissing);
    expect(q(before)?.state).toBe(ObservationState.NotRun);
    expect(q(after)?.state).toBe(ObservationState.Observed);
    expect(q(after)?.findings).toBe(1);
  });

  test("AN OBSERVED CONDITION WITH NOTHING WRONG REPORTS ZERO — and that means clean", () => {
    const obs = fromLagReport(detectLag(chart, { nowMs: NOW, reviews: [] }));
    const q = obs.find((o) => o.question === LagKind.ReviewerMissing);
    expect(q?.state).toBe(ObservationState.Observed);
    expect(q?.findings).toBe(0);
  });

  test("THE COUNT COMES FROM THE SOURCE, not from a list held here", () => {
    // A hand-written roster in the adapter would be a second thing to keep in step, and a
    // thirteenth condition would be invisible in exactly the report that exists to see gaps.
    expect(fromLagReport(detectLag(chart, { nowMs: NOW }))).toHaveLength(LAG_CONDITION_COUNT);
  });
});

describe("RECONCILIATION — a party never consulted is not a party that agreed", () => {
  test("an unconsulted tracker is a blind spot, not a clean bill", () => {
    const report = reconcile({ cascade: [], changesLanded: [], changesUnlanded: [], gateEvaluations: [], delivered: false });
    const obs = fromReconciliation(report);
    const tracker = obs.find((o) => o.question === Party.Tracker);
    expect(tracker?.state).toBe(ObservationState.NotRun);
    expect(tracker?.why).toContain("unknown rather than confirmed");
  });

  test("disagreements are attributed BY KIND, through the source module's own mapping", () => {
    // The adapter holds no copy of which kind belongs to which party — `reconciliation.partyOf`
    // does, so adding a kind cannot leave this attribution silently stale.
    const report = reconcile({
      cascade: [
        { workId: "task-1", workType: WorkType.Task, title: "t", state: WorkState.Open, ownerHatId: "tech_lead" },
      ],
      changesLanded: ["task-1"],
      changesUnlanded: [],
      gateEvaluations: [],
      delivered: false,
    });
    // `landed_but_not_done` is a disagreement with the REPOSITORY and with nobody else. Counting it
    // against every consulted party would inflate two clean parties into two dirty ones.
    expect(report.disagreements.map((d) => d.kind)).toContain(DisagreementKind.LandedButNotDone);
    const obs = fromReconciliation(report);
    expect(obs.find((o) => o.question === Party.Repository)?.findings).toBe(1);
    expect(obs.find((o) => o.question === Party.Gates)?.findings).toBe(0);
  });
});

describe("CONTEXT PACK — an unwired builder is a SYSTEM gap, not a run gap", () => {
  test("no builder wired contributes no_detector; a reachability gap contributes not_run", () => {
    const unwired = buildContextPack(chart, { hatId: "tech_lead", resourceAuthorityHatId: "rmo_office" });
    if (!unwired.ok) throw new Error(unwired.reason);
    const obs = fromContextPack(unwired.pack);
    expect(obs.some((o) => o.state === ObservationState.NoDetector)).toBe(true);
    // AND the retrieval question itself is not_run. Reporting the omission while calling the
    // retrieval "observed" would put the blind spot and a clean bill in the same ledger.
    expect(obs.find((o) => o.question.startsWith("retrieval:"))?.state).toBe(ObservationState.NotRun);

    const denied = buildContextPack(chart, {
      hatId: "tech_lead",
      resourceAuthorityHatId: "rmo_office",
      items: [],
      omissions: [{ kind: OmissionKind.AccessDenied, about: "budget", why: "an IC does not see finance" }],
    });
    if (!denied.ok) throw new Error(denied.reason);
    expect(fromContextPack(denied.pack).every((o) => o.state !== ObservationState.NoDetector)).toBe(true);
  });

  test("a complete pack is observed, and its items are the finding count", () => {
    const built = buildContextPack(chart, {
      hatId: "tech_lead",
      resourceAuthorityHatId: "rmo_office",
      items: [{ kind: ContextItemKind.WorkItem, id: "task-1", summary: "t", source: { kind: "document", ref: "a" } }],
    });
    if (!built.ok) throw new Error(built.reason);
    const obs = fromContextPack(built.pack);
    expect(obs).toHaveLength(1);
    expect(obs[0]?.state).toBe(ObservationState.Observed);
    expect(obs[0]?.findings).toBe(1);
  });
});

describe("ORG GRAPH — the register's clearest missing detectors", () => {
  test("every underived edge kind becomes a no_detector, with the reason it already carried", () => {
    const obs = fromOrgGraph(projectGraph({ chart }));
    const missing = obs.filter((o) => o.state === ObservationState.NoDetector);
    expect(missing).toHaveLength(Object.keys(UNDERIVED_EDGE_KINDS).length);
    expect(missing.every((o) => (o.why ?? "").trim() !== "")).toBe(true);
  });

  test("every derived kind is observed, with its edge count", () => {
    const obs = fromOrgGraph(projectGraph({ chart }));
    const belongs = obs.find((o) => o.question === EdgeKind.BelongsTo);
    expect(belongs?.state).toBe(ObservationState.Observed);
    expect(belongs?.findings).toBeGreaterThan(0);
  });
});

describe("PORT FIDELITY — absence is the third state, and it lives here", () => {
  test("an unrecorded fidelity is not_run, because unresolved is neither real nor simulated", () => {
    const obs = fromPortFidelity(new Map(), [Port.ChangeControl]);
    expect(obs[0]?.state).toBe(ObservationState.NotRun);
  });

  test("a SIMULATED port is observed AND a finding — a fact about the run, not a gap in looking", () => {
    const obs = fromPortFidelity(new Map([[Port.ChangeControl, Fidelity.Simulated]]), [Port.ChangeControl]);
    expect(obs[0]?.state).toBe(ObservationState.Observed);
    expect(obs[0]?.findings).toBe(1);
  });

  test("a real port is observed and clean", () => {
    const obs = fromPortFidelity(new Map([[Port.ChangeControl, Fidelity.Real]]), [Port.ChangeControl]);
    expect(obs[0]?.findings).toBe(0);
  });
});

describe("HANDOFF — not_recorded is not_run; none_attempted is observed", () => {
  const pack = (() => {
    const r = buildContextPack(chart, { hatId: "backend_implementer", resourceAuthorityHatId: "rmo_office", items: [] });
    if (!r.ok) throw new Error(r.reason);
    return r.pack;
  })();

  function brief(attemptsTracked?: boolean) {
    const r = buildHandoffBrief({
      workId: "task-1",
      trigger: HandoffTrigger.Reassigned,
      lastActorHatId: "backend_implementer",
      goal: "g",
      currentState: "s",
      pack,
      requiredNextActions: ["do the thing"],
      ...(attemptsTracked === undefined ? {} : { attemptsTracked }),
    });
    if (!r.ok) throw new Error(r.reason);
    return r.brief;
  }

  test("untracked attempts are a blind spot", () => {
    const obs = fromHandoffBrief(brief());
    expect(obs.find((o) => o.question.startsWith("attempted-paths"))?.state).toBe(ObservationState.NotRun);
  });

  test("TRACKED-AND-NONE IS OBSERVED — somebody looked and there was nothing", () => {
    const obs = fromHandoffBrief(brief(true));
    expect(obs.find((o) => o.question.startsWith("attempted-paths"))?.state).toBe(ObservationState.Observed);
  });
});

describe("THE POINT OF ALL OF IT — one place to ask how much of this is silence", () => {
  test("A REGISTER-WIDE LEDGER COUNTS BLIND SPOTS ACROSS EVERY MODULE AT ONCE", () => {
    // The thing nobody could do before: ask the global question without already knowing that nine
    // modules each spell it differently.
    const ledger = fold([
      ...fromLagReport(detectLag(chart, { nowMs: NOW })),
      ...fromOrgGraph(projectGraph({ chart })),
      ...fromPortFidelity(new Map(), [Port.ChangeControl, Port.Review]),
    ]);

    expect(fullyObserved(ledger)).toBe(false);
    // Twelve unswept conditions plus two unresolved ports.
    expect(ledger.notRun).toBe(LAG_CONDITION_COUNT + 2);
    // ...and the graph's underived kinds are counted apart, because they need building not wiring.
    expect(ledger.noDetector).toBe(Object.keys(UNDERIVED_EDGE_KINDS).length);
    expect(missingDetectors(ledger).every((o) => o.subject === "org-graph")).toBe(true);
    expect(blindSpots(ledger)).toHaveLength(ledger.notRun + ledger.noDetector);
  });

  test("...and a fully-supplied run reports completeness of one", () => {
    const ledger = fold([
      ...fromLagReport(
        detectLag(chart, {
          nowMs: NOW,
          cascade: [],
          assignments: [],
          silenceSlaMs: 1,
          expectedDurationMs: 1,
          runs: [],
          reservedSupply: [],
          reservationSlaMs: 1,
          reviews: [],
          qaReady: [],
          releaseCandidates: [],
          blocked: [],
          queues: [],
          reassignments: new Map(),
        }),
      ),
      ...fromPortFidelity(new Map([[Port.ChangeControl, Fidelity.Real]]), [Port.ChangeControl]),
    ]);
    expect(ledger.completeness).toBe(1);
    expect(fullyObserved(ledger)).toBe(true);
    expect(ledger.findings).toBe(0);
  });
});

describe("fromDomainRouting — routing that nobody stated is SILENCE, not success", () => {
  const rows: readonly DomainRouting[] = [
    { workId: "a", ownerHatId: "engineering_director", ownerDepartmentId: "engineering", domain: Domain.Implementation, match: DomainMatch.InDomain },
    { workId: "b", ownerHatId: "cto", ownerDepartmentId: "engineering", domain: Domain.ProductDiscovery, match: DomainMatch.OutOfDomain },
    { workId: "c", ownerHatId: "ceo", ownerDepartmentId: "executive_board_and_governance", match: DomainMatch.Unstated },
  ];

  test("in-domain is observed and clean; out-of-domain is observed and a FINDING", () => {
    const obs = fromDomainRouting(rows);
    expect(obs[0]).toMatchObject({ state: ObservationState.Observed, findings: 0 });
    expect(obs[1]).toMatchObject({ state: ObservationState.Observed, findings: 1 });
  });

  test("UNSTATED IS not_run WITH A WHY — never a zero-findings pass", () => {
    // Zero findings under `observed` means CLEAN. Recording an unrouted work item that way would
    // reproduce, inside the ledger built to end it, the exact defect the ledger exists for.
    const obs = fromDomainRouting(rows);
    expect(obs[2]?.state).toBe(ObservationState.NotRun);
    expect(obs[2]?.why).toContain("does not say what it is about");
  });

  test("...so a cascade with no domains at all is NOT fully observed", () => {
    const none = fromDomainRouting(rows.map((r) => ({ ...r, match: DomainMatch.Unstated })));
    const ledger = foldObservations(none);
    if (!ledger.ok) throw new Error(ledger.reason);
    expect(fullyObserved(ledger.ledger)).toBe(false);
    expect(blindSpots(ledger.ledger)).toHaveLength(3);
  });

  test("an all-matched cascade IS fully observed and finds nothing", () => {
    const all = fromDomainRouting(rows.map((r) => ({ ...r, match: DomainMatch.InDomain })));
    const ledger = foldObservations(all);
    if (!ledger.ok) throw new Error(ledger.reason);
    expect(fullyObserved(ledger.ledger)).toBe(true);
    expect(ledger.ledger.entries.every((e) => e.findings === 0)).toBe(true);
  });
});
