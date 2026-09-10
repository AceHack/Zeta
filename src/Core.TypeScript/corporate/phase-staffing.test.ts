/**
 * phase-staffing.test.ts — falsifiers for who authors a phase.
 *
 * The defect these pin was found by reading a real document: a Customer & RFP Review attributed to
 * the Backend Implementer, because every phase was credited to the task's assignee. The property
 * that matters is not "somebody is picked" — it is that the pick comes from the DISCIPLINE the
 * chart says owns the phase, and that the function refuses rather than falling back when it cannot.
 */

import { stringCompare } from "../collation/collation.ts";
import { describe, expect, test } from "bun:test";
import { buildOrgChart, type OrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { GateKind, gateOwners } from "./quality-gate";
import { authorFor, candidatesFor } from "./phase-staffing";

function chartOf(): OrgChart {
  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) throw new Error(built.reason);
  return built.chart;
}
const CHART = chartOf();

describe("the DISCIPLINE is read off the chart, not from a table", () => {
  test("a business phase draws business hats — not whoever holds the task", () => {
    // The reported defect, stated as a property: `customer_rfp_review` is approved by the product
    // line, so it belongs to product discovery, and an implementer must not be a candidate.
    const staffing = candidatesFor(CHART, GateKind.CustomerRfpReview);
    const ids = staffing.candidates.map((c) => c.hatId);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain("requirement_clarifier");
    expect(ids).not.toContain("backend_implementer");
    expect(ids).not.toContain("frontend_implementer");
  });

  test("an architecture phase draws architects", () => {
    const ids = candidatesFor(CHART, GateKind.ArchitectureDesign).candidates.map((c) => c.hatId);
    expect(ids).toContain("architect");
    expect(ids).not.toContain("backend_implementer");
  });

  test("EVERY candidate really is in the owning department", () => {
    // The derivation itself, checked against the chart rather than against a list of examples —
    // a table would pass a spot-check and drift the moment a hat moved department.
    for (const gate of Object.values(GateKind)) {
      const staffing = candidatesFor(CHART, gate);
      for (const candidate of staffing.candidates) {
        expect(staffing.departmentIds).toContain(candidate.departmentId);
      }
    }
  });

  test("NO CANDIDATE ALSO APPROVES ITS OWN PHASE, for any gate in the chart", () => {
    // `evaluate` refuses a gate whose only holder is the hat that did the work, so an author drawn
    // from the approvers is guaranteed to fail the gate it was picked for.
    for (const gate of Object.values(GateKind)) {
      const approvers = new Set(gateOwners(CHART, gate).map((h) => h.id));
      for (const candidate of candidatesFor(CHART, gate).candidates) {
        expect(approvers.has(candidate.hatId)).toBe(false);
      }
    }
  });

  test("the candidate list is stable, so the RMO's ranking is replayable", () => {
    const a = candidatesFor(CHART, GateKind.BusinessContextGrooming).candidates.map((c) => c.hatId);
    const b = candidatesFor(CHART, GateKind.BusinessContextGrooming).candidates.map((c) => c.hatId);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => stringCompare(x, y))).toEqual(a);
  });
});

describe("an empty answer says WHY", () => {
  test("a gate nobody holds names that, rather than returning a bare empty list", () => {
    const staffing = candidatesFor(CHART, "no_such_gate" as GateKind);
    expect(staffing.candidates).toEqual([]);
    expect(staffing.because).toContain("no hat in this chart holds");
  });

  test("a chart with no departments cannot derive a discipline, and says so", () => {
    const flat = buildOrgChart([
      { id: "boss", name: "Boss", level: "c_suite", approvalScopes: [GateKind.CustomerRfpReview] },
      { id: "worker", name: "Worker", level: "ic", reportsTo: "boss" },
    ] as unknown as typeof SEED_HATS);
    if (!flat.ok) throw new Error(flat.reason);
    const staffing = candidatesFor(flat.chart, GateKind.CustomerRfpReview);
    expect(staffing.candidates).toEqual([]);
    expect(staffing.because).toContain("no department");
  });

  test("a department whose every hat approves the gate has nobody left to author it", () => {
    const all = buildOrgChart([
      { id: "boss", name: "Boss", level: "c_suite", departmentId: "d", approvalScopes: [GateKind.CustomerRfpReview] },
      { id: "peer", name: "Peer", level: "ic", departmentId: "d", reportsTo: "boss", approvalScopes: [GateKind.CustomerRfpReview] },
    ] as unknown as typeof SEED_HATS);
    if (!all.ok) throw new Error(all.reason);
    const staffing = candidatesFor(all.chart, GateKind.CustomerRfpReview);
    expect(staffing.candidates).toEqual([]);
    expect(staffing.because).toContain("without reviewing their own work");
  });
});

describe("the RMO picks; this only says who is qualified", () => {
  const staffing = candidatesFor(CHART, GateKind.CustomerRfpReview);

  test("the highest-ranked QUALIFIED hat wins, not the highest-ranked hat", () => {
    // The RMO's order leads with an implementer. It is not qualified for this phase, so it loses
    // to the business hat below it — which is the entire point of computing a qualified set.
    const preferred = ["backend_implementer", "requirement_clarifier", "acceptance_criteria_owner"];
    expect(authorFor(staffing, preferred)?.hatId).toBe("requirement_clarifier");
  });

  test("rank is reported, so a low-ranked pick is visible rather than silent", () => {
    const preferred = ["backend_implementer", "frontend_implementer", "requirement_clarifier"];
    expect(authorFor(staffing, preferred)?.rank).toBe(2);
  });

  test("AN RMO THAT OFFERS NOBODY QUALIFIED GETS NOBODY — never a fallback", () => {
    // The defect, in its purest form. Falling back to the task's assignee is how the Backend
    // Implementer came to write a customer RFP review, and it would make this whole module
    // decorative: it would compute a qualified set and then not matter.
    expect(authorFor(staffing, ["backend_implementer", "frontend_implementer"])).toBeUndefined();
    expect(authorFor(staffing, [])).toBeUndefined();
  });

  test("a gate with no candidates staffs nobody, whatever the RMO offers", () => {
    const none = candidatesFor(CHART, "no_such_gate" as GateKind);
    expect(authorFor(none, ["requirement_clarifier", "backend_implementer"])).toBeUndefined();
  });
});
