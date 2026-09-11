/**
 * requirement-maturity.test.ts — a ladder that stops nothing is a status field.
 *
 * The doc asks for two things and only one of them is visible in a state enum: track maturity
 * separately, AND let it gate the work item state. So the tests that matter are the gate's — an
 * ambiguous item refused `ready`, an ordinary internal one NOT stalled by a rule the doc never
 * asked for, and a waiver that has to be signed by somebody who could have done the work it skips.
 *
 * The failure this is shaped against is a boolean `skipDiscovery` set by whoever was in a hurry.
 */

import { describe, expect, test } from "bun:test";
import { BlockerKind, ownersFor } from "./blocker-taxonomy";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import {
  advanceMaturity,
  AmbiguityFactor,
  ambiguityScore,
  AMBIGUITY_THRESHOLD,
  isAmbiguous,
  isMaturity,
  MATURITY_ORDER,
  MaturityRefusal,
  maturityRank,
  ReadinessRefusal,
  readinessOf,
  type RequirementProfile,
  requiredStates,
  type Waiver,
  waiverApprovers,
  WaiverKind,
} from "./requirement-maturity";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

/** Internal, unambiguous — the ordinary task. */
function plain(over: Partial<RequirementProfile> = {}): RequirementProfile {
  return { requirementId: "req-1", customerFacing: false, factors: [], ...over };
}

const AMBIGUOUS = plain({
  factors: [AmbiguityFactor.UnclearBehavior, AmbiguityFactor.MultipleInterpretations],
});

const CUSTOMER = plain({ customerFacing: true });

describe("the chain is the doc's, and it is a total order", () => {
  test("fourteen states, each distinct", () => {
    expect(MATURITY_ORDER).toHaveLength(14);
    expect(new Set(MATURITY_ORDER).size).toBe(14);
  });

  test("rank follows the doc's order", () => {
    expect(maturityRank("raw_intake")).toBe(0);
    expect(maturityRank("implementation_ready")).toBe(13);
    expect(maturityRank("brd_review")).toBeLessThan(maturityRank("product_signoff"));
  });

  test("an unknown string is caught, not coerced", () => {
    expect(isMaturity("brd_review")).toBe(true);
    expect(isMaturity("nearly_done")).toBe(false);
  });
});

describe("THE SCORE IS A COUNT OF THINGS OBSERVED, not a number somebody chose", () => {
  test("it counts distinct factors", () => {
    expect(ambiguityScore(plain())).toBe(0);
    expect(ambiguityScore(plain({ factors: [AmbiguityFactor.UnclearCustomer] }))).toBe(1);
  });

  test("A REPEATED FACTOR IS STILL ONE FACTOR", () => {
    // Otherwise anything can be pushed over the threshold by saying it twice, and the score stops
    // measuring the request and starts measuring who filled the form in.
    const twice = plain({ factors: [AmbiguityFactor.UnclearCustomer, AmbiguityFactor.UnclearCustomer] });
    expect(ambiguityScore(twice)).toBe(1);
    expect(isAmbiguous(twice)).toBe(false);
  });

  test("THE THRESHOLD IS TWO, and one short is not ambiguous", () => {
    // Almost every real request is missing something. A threshold of one routes the whole backlog
    // through discovery, which discriminates exactly as poorly as routing none of it.
    expect(AMBIGUITY_THRESHOLD).toBe(2);
    expect(isAmbiguous(plain({ factors: [AmbiguityFactor.UnknownSuccessMetric] }))).toBe(false);
    expect(isAmbiguous(AMBIGUOUS)).toBe(true);
  });

  test("the doc's ten factors are all here", () => {
    expect(Object.values(AmbiguityFactor)).toHaveLength(10);
  });
});

describe("WHAT A REQUIREMENT MUST PASS THROUGH IS DERIVED FROM WHAT IT IS", () => {
  test("an ordinary internal task needs neither discovery nor a BRD", () => {
    const required = requiredStates(plain());
    expect(required).not.toContain("interview_planned");
    expect(required).not.toContain("brd_review");
    // ...but the unconditional half stays. Ambiguity does not excuse writing acceptance criteria.
    expect(required).toContain("acceptance_criteria_drafted");
    expect(required).toContain("architecture_ready");
  });

  test("an AMBIGUOUS one needs discovery", () => {
    expect(requiredStates(AMBIGUOUS)).toContain("interview_in_progress");
    expect(requiredStates(AMBIGUOUS)).not.toContain("brd_review");
  });

  test("a CUSTOMER-FACING one needs business signoff", () => {
    expect(requiredStates(CUSTOMER)).toContain("product_signoff");
    expect(requiredStates(CUSTOMER)).not.toContain("interview_planned");
  });

  test("both at once needs all fourteen", () => {
    expect(requiredStates({ ...AMBIGUOUS, customerFacing: true })).toEqual(MATURITY_ORDER);
  });
});

describe("advancing: skipping is permitted, SILENTLY skipping is not", () => {
  test("a plain task may jump the discovery states, and the jump is REPORTED", () => {
    const r = advanceMaturity("ambiguity_scored", "requirements_drafted", plain());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    // The skipped list is what makes it a decision somebody can see rather than a gap in a history.
    expect(r.skipped).toEqual(["discovery_required", "interview_planned", "interview_in_progress", "source_evidence_captured"]);
  });

  test("AN AMBIGUOUS ONE MAY NOT make the same jump", () => {
    const r = advanceMaturity("ambiguity_scored", "requirements_drafted", AMBIGUOUS);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(MaturityRefusal.SkippedRequiredState);
    expect(r.reason).toContain("interview_planned");
  });

  test("MATURITY DOES NOT GO BACKWARDS", () => {
    // A requirement that got less understood is a new requirement, not an old one reversing. Letting
    // it slide back would let an item bounce off a gate and re-approach it as if for the first time.
    const r = advanceMaturity("product_signoff", "brd_review", CUSTOMER);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(MaturityRefusal.Backward);
  });

  test("standing still is not advancing", () => {
    const r = advanceMaturity("brd_review", "brd_review", CUSTOMER);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(MaturityRefusal.NoMovement);
  });

  test("the ordinary one-step move skips nothing", () => {
    const r = advanceMaturity("raw_intake", "classified", plain());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.skipped).toEqual([]);
  });
});

describe("THE GATE — this is the part that is not a status field", () => {
  test("AN AMBIGUOUS ITEM IS REFUSED READY at raw intake", () => {
    const r = readinessOf(chart, AMBIGUOUS, "raw_intake");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(ReadinessRefusal.Immature);
  });

  test("a customer-facing item is refused until signoff is behind it", () => {
    expect(readinessOf(chart, CUSTOMER, "acceptance_criteria_drafted").ok).toBe(false);
    expect(readinessOf(chart, CUSTOMER, "implementation_ready").ok).toBe(true);
  });

  test("AN ORDINARY INTERNAL TASK IS NOT STALLED BY A RULE THE DOC NEVER ASKED FOR", () => {
    // The doc conditions the gate on ambiguous OR customer-facing. Inventing a stricter version
    // would stall exactly the work the organization exists to get through, and it would look like
    // rigour while doing it.
    const r = readinessOf(chart, plain(), "raw_intake");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    // AND IT SAYS WHY. Without the early return it still passes — vacuously, through the
    // no-uncovered-causes path — so `ok` alone cannot tell "the gate does not apply" from "the gate
    // applied and found nothing", and only the second would be a real judgement.
    expect(r.via).toBe("not_gated");
  });

  test("reaching implementation_ready is the plain way through", () => {
    const r = readinessOf(chart, { ...AMBIGUOUS, customerFacing: true }, "implementation_ready");
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.via).toBe("implementation_ready");
  });
});

describe("THE WAIVER IS WHERE THE GATE WOULD BE DEFEATED QUIETLY", () => {
  const discovery: Waiver = {
    kind: WaiverKind.NoDiscovery,
    approvedByHatId: "product_manager",
    reason: "the behaviour is specified in the existing runbook",
  };
  const brd: Waiver = {
    kind: WaiverKind.NoBrd,
    approvedByHatId: "product_director",
    reason: "no external commitment is made by this change",
  };

  test("the approvers are the hats that would have DONE the work being skipped", () => {
    expect(waiverApprovers(chart, WaiverKind.NoDiscovery)).toContain("product_manager");
    expect(waiverApprovers(chart, WaiverKind.NoBrd)).toContain("product_director");
  });

  test("EACH KIND READS ITS OWN ROW of the blocker roster", () => {
    // HONEST LIMIT: in the seed chart the two rows hold the same two hats in opposite order, so a
    // mutant collapsing both kinds onto one row changes no ACCEPTANCE decision — `includes` does not
    // read order. This asserts the mapping structurally instead of pretending a behavioural
    // difference exists, and it starts mattering the moment the two rows differ in membership.
    expect(waiverApprovers(chart, WaiverKind.NoDiscovery)).toEqual(
      ownersFor(chart, BlockerKind.RequirementsUnclear).map((h) => h.id),
    );
    expect(waiverApprovers(chart, WaiverKind.NoBrd)).toEqual(
      ownersFor(chart, BlockerKind.MissingBrdSignoff).map((h) => h.id),
    );
    expect(waiverApprovers(chart, WaiverKind.NoDiscovery)).not.toEqual(waiverApprovers(chart, WaiverKind.NoBrd));
  });

  test("a signed, explained waiver from the right hat gets an ambiguous item through", () => {
    const r = readinessOf(chart, AMBIGUOUS, "ambiguity_scored", [discovery]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.via).toBe("waiver");
  });

  test("A HAT THAT CANNOT SIGN ONE IS REFUSED", () => {
    const r = readinessOf(chart, AMBIGUOUS, "ambiguity_scored", [{ ...discovery, approvedByHatId: "backend_implementer" }]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(ReadinessRefusal.WaiverUnauthorized);
  });

  test("A WAIVER WITH NO REASON IS A CHECKBOX, and is refused as one", () => {
    const r = readinessOf(chart, AMBIGUOUS, "ambiguity_scored", [{ ...discovery, reason: "   " }]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(ReadinessRefusal.WaiverUnexplained);
  });

  test("ONE WAIVER DOES NOT COVER A SECOND CAUSE", () => {
    // A no-discovery waiver on a customer-facing item still leaves the BRD decision unmade.
    // Accepting one approval for both is how a signature comes to stand for a decision nobody took.
    const both = { ...AMBIGUOUS, customerFacing: true };
    const r = readinessOf(chart, both, "ambiguity_scored", [discovery]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(ReadinessRefusal.WaiverDoesNotCover);
    expect(r.reason).toContain("customer-facing");
  });

  test("...and both together do", () => {
    const both = { ...AMBIGUOUS, customerFacing: true };
    const r = readinessOf(chart, both, "ambiguity_scored", [discovery, brd]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.via).toBe("waiver");
  });

  test("A WAIVER REMOVES THE CAUSE, IT DOES NOT ADVANCE THE REQUIREMENT", () => {
    // The two axes stay separate. Waiving discovery says the ambiguity is answered; it does not
    // claim the requirement reached a state it did not reach, and `advanceMaturity` still refuses
    // the states its profile requires — which after the waiver are fewer, because the profile is
    // what makes them required.
    const r = readinessOf(chart, AMBIGUOUS, "raw_intake", [discovery]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.via).toBe("waiver");
    expect(advanceMaturity("raw_intake", "requirements_drafted", AMBIGUOUS).ok).toBe(false);
  });

  test("THE WRONG WAIVER HELPS NOBODY — a discovery waiver on an unambiguous customer item", () => {
    const r = readinessOf(chart, CUSTOMER, "raw_intake", [discovery]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(ReadinessRefusal.WaiverDoesNotCover);
  });

  test("A MALFORMED WAIVER IS CAUGHT EVEN WHEN IT COVERS NOTHING HERE", () => {
    // The same signature passes unexamined until the day it matters otherwise.
    const r = readinessOf(chart, AMBIGUOUS, "raw_intake", [discovery, { ...brd, reason: "" }]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.refusal).toBe(ReadinessRefusal.WaiverUnexplained);
  });
});
