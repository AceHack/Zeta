/**
 * observation-ledger.test.ts — the report of a healthy system and of an unobserved one are the
 * same document.
 *
 * That sentence is what this ledger exists to make false. So the load-bearing test is the pair:
 * a full sweep that found nothing, and a sweep that looked at nothing — identical in findings,
 * and they must never be identical here.
 *
 * The second load-bearing test is the refusal. A ledger that accepted "we did not look" with no
 * reason would be the tenth silent thing rather than the end of them.
 */

import { describe, expect, test } from "bun:test";
import {
  blindSpots,
  foldObservations,
  fullyObserved,
  missingDetectors,
  ObservationState,
  type Observation,
} from "./observation-ledger";

function seen(question: string, findings = 0): Observation {
  return { subject: "s", question, state: ObservationState.Observed, findings };
}

function notRun(question: string): Observation {
  return { subject: "s", question, state: ObservationState.NotRun, findings: 0, why: "no input was supplied" };
}

function noDetector(question: string): Observation {
  return { subject: "s", question, state: ObservationState.NoDetector, findings: 0, why: "nothing computes this" };
}

function fold(entries: readonly Observation[]) {
  const r = foldObservations(entries);
  if (!r.ok) throw new Error(r.reason);
  return r.ledger;
}

describe("THE TWO REPORTS THAT USED TO BE THE SAME DOCUMENT", () => {
  test("A CLEAN SWEEP AND AN EMPTY ONE HAVE THE SAME FINDINGS AND DIFFERENT LEDGERS", () => {
    // The whole module in one test. Both report zero problems; only one of them is a statement
    // about the organization.
    const clean = fold([seen("a"), seen("b"), seen("c")]);
    const blind = fold([notRun("a"), notRun("b"), notRun("c")]);

    expect(clean.findings).toBe(blind.findings);
    expect(clean.findings).toBe(0);

    expect(fullyObserved(clean)).toBe(true);
    expect(fullyObserved(blind)).toBe(false);
    expect(clean.completeness).toBe(1);
    expect(blind.completeness).toBe(0);
  });

  test("FULLY OBSERVED IS NOT 'NO FINDINGS' — a report of problems is still trustworthy", () => {
    // A ledger with findings and no blind spots is a good report. A ledger with no findings and
    // eleven blind spots is not a report at all. Conflating them would make the healthy-looking
    // one the safer-looking one, which is exactly backwards.
    const found = fold([seen("a", 4), seen("b", 1)]);
    expect(found.findings).toBe(5);
    expect(fullyObserved(found)).toBe(true);
  });

  test("AN EMPTY LEDGER IS NOT FULLY OBSERVED — nothing asked is not everything answered", () => {
    const nothing = fold([]);
    expect(nothing.completeness).toBe(0);
    expect(fullyObserved(nothing)).toBe(false);
  });

  test("blind spots are the list a reader must see before believing a clean report", () => {
    const mixed = fold([seen("a"), notRun("b"), noDetector("c")]);
    expect(blindSpots(mixed).map((e) => e.question)).toEqual(["b", "c"]);
  });
});

describe("THE THIRD STATE — a gap in the SYSTEM, not in the run", () => {
  test("not_run and no_detector are counted apart, because the remedies differ", () => {
    // `not_run` is fixed by wiring an input; `no_detector` by building something that does not
    // exist. A backlog that mixes them cannot be prioritised.
    const l = fold([seen("a"), notRun("b"), noDetector("c"), noDetector("d")]);
    expect(l.observed).toBe(1);
    expect(l.notRun).toBe(1);
    expect(l.noDetector).toBe(2);
    expect(missingDetectors(l).map((e) => e.question)).toEqual(["c", "d"]);
  });

  test("a missing detector is NOT counted as a run that found nothing", () => {
    expect(fold([noDetector("c")]).completeness).toBe(0);
  });
});

describe("THE REFUSALS — this must not become the tenth silent thing", () => {
  test("A SILENT STATE WITH NO REASON IS REFUSED", () => {
    // "We did not look" with no why is the original defect wearing this module's clothes.
    const r = foldObservations([{ subject: "s", question: "a", state: ObservationState.NotRun, findings: 0 }]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("no stated reason");
  });

  test("whitespace is not a reason", () => {
    expect(
      foldObservations([{ subject: "s", question: "a", state: ObservationState.NoDetector, findings: 0, why: "   " }]).ok,
    ).toBe(false);
  });

  test("AN OBSERVED ENTRY NEEDS NO REASON — the explanation is the finding", () => {
    expect(foldObservations([seen("a", 3)]).ok).toBe(true);
  });

  test("A DETECTOR THAT DID NOT RUN CANNOT HAVE FOUND ANYTHING", () => {
    // A number there would be read as a measurement, and it would be a measurement of nothing.
    const r = foldObservations([
      { subject: "s", question: "a", state: ObservationState.NotRun, findings: 2, why: "no input" },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("found nothing");
  });

  test("a negative or fractional finding count is refused rather than rounded", () => {
    expect(foldObservations([seen("a", -1)]).ok).toBe(false);
    expect(foldObservations([seen("a", 1.5)]).ok).toBe(false);
  });
});

describe("COMPLETENESS IS DERIVED", () => {
  test("it is the fraction ANSWERED, and no caller supplies it", () => {
    expect(fold([seen("a"), notRun("b")]).completeness).toBe(0.5);
    expect(fold([seen("a"), seen("b"), seen("c"), notRun("d")]).completeness).toBe(0.75);
  });

  test("findings sum only over what ran", () => {
    expect(fold([seen("a", 2), seen("b", 3), notRun("c")]).findings).toBe(5);
  });

  test("the summary says all three counts, so a glance cannot miss the silence", () => {
    const s = fold([seen("a"), notRun("b"), noDetector("c")]).summary;
    expect(s).toContain("1 of 3");
    expect(s).toContain("1 not run");
    expect(s).toContain("1 with no detector");
  });
});

describe("ordering", () => {
  test("entries are ORDINAL by subject then question, so two runs compare line for line", () => {
    const l = fold([
      { subject: "z", question: "b", state: ObservationState.Observed, findings: 0 },
      { subject: "a", question: "z", state: ObservationState.Observed, findings: 0 },
      { subject: "a", question: "a", state: ObservationState.Observed, findings: 0 },
    ]);
    expect(l.entries.map((e) => `${e.subject}/${e.question}`)).toEqual(["a/a", "a/z", "z/b"]);
  });
});
