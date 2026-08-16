/**
 * competence-attribution.test.ts — falsifiers for the competence event source.
 *
 * These are mechanics falsifiers, not evidence about any agent. Each is written to go RED
 * under a specific mutation, and the mutation is named on the test:
 *
 *   F1  posterior stops updating          → fold becomes identity
 *   F2  an outcome is dropped             → one observation skipped
 *   F3  independence (a) violated         → a review-derived kind admitted to a folded series
 *   F4  independence (b) violated         → a self-labeled outcome updates its own labeler
 *   F5  unattributable silently ignored   → no-update reads as a clean record
 *   F6  idempotency lost                  → the same address folded twice
 *   F7  canonical order dropped           → receive order changes the posterior
 *   F8  agreement prior unbounded / self-weighting allowed
 *   F9  scoping used to disappear evidence
 *   F10 review-vote folded
 *   F11 stance ignored                    → a warner scored like an approver
 */

import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AUTHOR_ONLY,
  EVIDENCE_INDEPENDENCE,
  FOLDED_SERIES,
  MAX_AGREEMENT_PRIOR_MU,
  MIN_PERSUASIVE_WEIGHT,
  SERIES_ADMITS,
  STANCE_BEARING,
  TREATMENT_STANCE,
  admitOutcome,
  agreementPriorAdmissibleFor,
  appendEdge,
  appendOutcome,
  attribute,
  canonicalOrder,
  foldSeriesToLedger,
  independenceViolations,
  jurisdictionDistance,
  makeAgreementPrior,
  makeEdge,
  mechanismCoverage,
  persuasiveWeight,
  readCompetence,
  readEdges,
  readOutcomes,
  stanceAgrees,
  temperedUpdate,
  type OutcomeRecord,
  type TreatmentEdge,
} from "./competence-attribution";
import {
  attributeReporter,
  currentVerdict,
  makeDetermination,
  makeLabel,
  makeReport,
  readReporterCompetence,
} from "./competence-report-layers";
import { freshBelief, updateBelief } from "./traveler-rank-ledger";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — fixed timestamps, no wall clock anywhere
// ─────────────────────────────────────────────────────────────────────────────

const J = "oracle/typescript";
const T = (n: number): string => `2026-08-16T00:00:0${String(n)}.000Z`;

function edge(
  subjectRef: string,
  agentId: string,
  treatment: TreatmentEdge["treatment"],
  at: string,
  hatDomain = "review",
): TreatmentEdge {
  const made = makeEdge({ subjectRef, agentId, hatDomain, treatment, at });
  if (!made.ok) throw new Error(made.reason);
  return made.value;
}

function outcome(
  subjectRef: string,
  hit: boolean,
  at: string,
  labeler = "aaron",
  jurisdiction = J,
  series: OutcomeRecord["series"] = "use-defect",
  evidence: OutcomeRecord["evidence"] = "defect-in-use",
): OutcomeRecord {
  const made = admitOutcome({ subjectRef, series, evidence, hit, labeler, jurisdiction, at });
  if (!made.ok) throw new Error(made.reason);
  return made.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// F1 — the posterior is LIVE. Mutation: make the fold an identity.
// ─────────────────────────────────────────────────────────────────────────────

describe("F1: the posterior actually updates", () => {
  it("five attributed outcomes move mu to the golden value", () => {
    // H H M H H, all authored by `otto`, all labeled by `aaron`, all binding.
    const edges = [edge("s1", "otto", "authored", T(1))];
    const outcomes = [
      outcome("s1", true, T(1)),
      outcome("s1", true, T(2)),
      outcome("s1", false, T(3)),
      outcome("s1", true, T(4)),
      outcome("s1", true, T(5)),
    ];
    const reading = readCompetence(outcomes, edges, "otto", "review", "use-defect", J);
    expect(reading.kind).toBe("observed");
    if (reading.kind !== "observed") return;
    expect(reading.obsCount).toBe(5);
    expect(reading.mu).toBeCloseTo(0.6656332276, 8);
    expect(reading.sigma2).toBeCloseTo(0.2859767871, 8);
    expect(reading.trustBand).toBeCloseTo(0.7213892609, 8);
    // priorShare must fall as evidence accrues — a number resting on the prior stays legible.
    expect(reading.priorShare).toBeCloseTo(0.2859767871, 8);
  });

  it("an empty log is prior-only, never a measurement", () => {
    const reading = readCompetence([], [], "otto", "review", "use-defect", J);
    expect(reading.kind).toBe("prior-only");
    expect(reading.obsCount).toBe(0);
    expect(reading.priorShare).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F2 — no outcome is dropped. Mutation: skip one observation in the fold.
// ─────────────────────────────────────────────────────────────────────────────

describe("F2: dropping an outcome is detectable", () => {
  it("four of the same five outcomes give a different mu", () => {
    const edges = [edge("s1", "otto", "authored", T(1))];
    const five = [
      outcome("s1", true, T(1)),
      outcome("s1", true, T(2)),
      outcome("s1", false, T(3)),
      outcome("s1", true, T(4)),
      outcome("s1", true, T(5)),
    ];
    const four = five.slice(0, 4);
    const r5 = readCompetence(five, edges, "otto", "review", "use-defect", J);
    const r4 = readCompetence(four, edges, "otto", "review", "use-defect", J);
    expect(r5.kind === "observed" && r5.obsCount).toBe(5);
    expect(r4.kind === "observed" && r4.obsCount).toBe(4);
    if (r4.kind !== "observed") return;
    expect(r4.mu).toBeCloseTo(0.5119836232, 8);
    expect(r4.mu).not.toBeCloseTo(0.6656332276, 8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F3 — independence (a): the board's own verdict cannot become ground truth.
// ─────────────────────────────────────────────────────────────────────────────

describe("F3: no folded series admits review-derived evidence", () => {
  it("the invariant function reports no violations", () => {
    expect(independenceViolations()).toEqual([]);
  });

  it("a direct scan of the table agrees (so mutating the function alone is caught)", () => {
    for (const series of FOLDED_SERIES) {
      for (const evidence of SERIES_ADMITS[series]) {
        expect(EVIDENCE_INDEPENDENCE[evidence]).not.toBe("review-derived");
      }
    }
  });

  it("admitOutcome refuses a review verdict into the determinator series", () => {
    const refused = admitOutcome({
      subjectRef: "s1",
      series: "use-defect",
      evidence: "reviewer-quorum-agreement",
      hit: false,
      labeler: "board",
      jurisdiction: J,
      at: T(1),
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toContain("review-derived");
  });

  it("review-derived evidence is still recordable — in the series that is never folded", () => {
    const kept = admitOutcome({
      subjectRef: "s1",
      series: "review-vote",
      evidence: "reviewer-quorum-agreement",
      hit: false,
      labeler: "board",
      jurisdiction: J,
      at: T(1),
    });
    expect(kept.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F4 — independence (b): a labeler cannot certify itself.
// ─────────────────────────────────────────────────────────────────────────────

describe("F4: the labeler must not be the agent the label updates", () => {
  it("a self-labeled outcome updates nobody and is reported as such", () => {
    const edges = [edge("s1", "otto", "authored", T(1))];
    const outcomes = [outcome("s1", true, T(2), "otto")]; // otto labels its own work
    const result = attribute(outcomes, edges, "use-defect", J);
    expect(result.observations).toEqual([]);
    expect(result.noUpdate.map((n) => n.reason)).toEqual(["self-labeled"]);
    expect(result.noUpdate[0]?.agentId).toBe("otto");
  });

  it("the same outcome labeled by someone else does update", () => {
    const edges = [edge("s1", "otto", "authored", T(1))];
    const result = attribute([outcome("s1", true, T(2), "aaron")], edges, "use-defect", J);
    expect(result.observations).toHaveLength(1);
    expect(result.noUpdate).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F5 — unattributable ⇒ no update, and it must not read as a clean record.
// ─────────────────────────────────────────────────────────────────────────────

describe("F5: an unattributable failure moves no posterior and surfaces as mechanism coverage", () => {
  it("an outcome with no covering treatment produces no observation", () => {
    const result = attribute([outcome("orphan", false, T(1))], [], "use-defect", J);
    expect(result.observations).toEqual([]);
    expect(result.noUpdate.map((n) => n.reason)).toEqual(["unattributable"]);
  });

  it("mechanismCoverage banks it against the system, with an improvement trigger", () => {
    const cov = mechanismCoverage(attribute([outcome("orphan", false, T(1))], [], "use-defect", J));
    expect(cov.outcomesSeen).toBe(1);
    expect(cov.updatesApplied).toBe(0);
    expect(cov.unattributable).toBe(1);
    expect(cov.noUpdateRate).toBe(1);
    expect(cov.triggers.join(" ")).toContain("treatment vocabulary");
  });

  it("the reading says prior-only AND reports what it could not use", () => {
    const reading = readCompetence([outcome("orphan", false, T(1))], [], "otto", "review", "use-defect", J);
    expect(reading.kind).toBe("prior-only");
    expect(reading.mechanismSeen).toBe(1); // not a clean record — we learned nothing
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F6 — idempotency on the store. Mutation: append unconditionally.
// ─────────────────────────────────────────────────────────────────────────────

describe("F6: appending the same record twice is a no-op", () => {
  it("outcomes and edges dedupe by content address, on disk and on read", () => {
    const root = mkdtempSync(join(tmpdir(), "competence-"));
    const e = edge("s1", "otto", "authored", T(1));
    const o = outcome("s1", true, T(2));
    expect(appendEdge(root, "shadow", e)).toBe(true);
    expect(appendEdge(root, "shadow", e)).toBe(false);
    expect(appendOutcome(root, "shadow", o)).toBe(true);
    expect(appendOutcome(root, "shadow", o)).toBe(false);

    const lines = readFileSync(join(root, "db/competence-outcomes/outcomes/shadow.jsonl"), "utf8")
      .split("\n")
      .filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(readEdges(root)).toHaveLength(1);
    expect(readOutcomes(root)).toHaveLength(1);
  });

  it("a recorded outcome round-trips through the store into the same reading", () => {
    const root = mkdtempSync(join(tmpdir(), "competence-"));
    appendEdge(root, "shadow", edge("s1", "otto", "authored", T(1)));
    appendOutcome(root, "shadow", outcome("s1", false, T(2)));
    const reading = readCompetence(readOutcomes(root), readEdges(root), "otto", "review", "use-defect", J);
    expect(reading.kind).toBe("observed");
    if (reading.kind !== "observed") return;
    expect(reading.obsCount).toBe(1);
    expect(reading.mu).toBeLessThan(0); // authored a change that failed in use
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F7 — canonical order. Mutation: fold in receive order.
// ─────────────────────────────────────────────────────────────────────────────

describe("F7: the fold is canonically ordered, because ADF is order-dependent", () => {
  it("ADF genuinely depends on order — so the canonicalisation is load-bearing, not cosmetic", () => {
    const fold = (s: boolean[]): number => s.reduce((b, h) => updateBelief(h, b), freshBelief).mu;
    // Same multiset {3 hits, 2 misses}, two orders, two posteriors.
    expect(fold([true, false, false, true, true])).not.toBeCloseTo(fold([true, true, true, false, false]), 6);
  });

  it("shuffled input folds identically once canonically ordered", () => {
    const edges = [edge("s1", "otto", "authored", T(1))];
    // Deliberately NOT a palindrome: [H, H, M] reversed is [M, H, H], which ADF folds to a
    // different posterior — so a fold that skipped canonicalisation would be caught here.
    const outcomes = [
      outcome("s1", true, T(1)),
      outcome("s1", true, T(2)),
      outcome("s1", false, T(3)),
    ];
    const forward = readCompetence(outcomes, edges, "otto", "review", "use-defect", J);
    const reversed = readCompetence([...outcomes].reverse(), edges, "otto", "review", "use-defect", J);
    expect(forward.kind === "observed" && forward.mu).toEqual(reversed.kind === "observed" && reversed.mu);
  });

  it("canonicalOrder sorts by (at, address) under codepoint ordinal collation", () => {
    const ordered = canonicalOrder([outcome("s1", true, T(3)), outcome("s1", true, T(1))]);
    expect(ordered.map((o) => o.at)).toEqual([T(1), T(3)]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F8 — agreement is the prior: bounded, washes out, and never weights its source.
// ─────────────────────────────────────────────────────────────────────────────

describe("F8: agreement prior", () => {
  it("is clamped to +/- MAX_AGREEMENT_PRIOR_MU", () => {
    const p = makeAgreementPrior({ sourceAggregatorId: "board-a", agentId: "otto", hatDomain: "review", mu: 9 });
    expect(p.mu).toBe(MAX_AGREEMENT_PRIOR_MU);
  });

  it("washes out: two contrary use-observations flip a maximal prior negative", () => {
    const edges = [edge("s1", "otto", "authored", T(1))];
    const outcomes = [outcome("s1", false, T(1)), outcome("s1", false, T(2))];
    const prior = { sourceAggregatorId: "board-a", agentId: "otto", hatDomain: "review", mu: 1.0 };
    const reading = readCompetence(outcomes, edges, "otto", "review", "use-defect", J, STANCE_BEARING, prior);
    expect(reading.kind).toBe("observed");
    if (reading.kind !== "observed") return;
    expect(reading.mu).toBeCloseTo(-0.324819, 5);
    expect(reading.mu).toBeLessThan(0);
  });

  it("may not weight the aggregator that produced it", () => {
    const prior = makeAgreementPrior({
      sourceAggregatorId: "review-board",
      agentId: "otto",
      hatDomain: "review",
      mu: 0.5,
    });
    expect(agreementPriorAdmissibleFor(prior, "review-board")).toBe(false);
    expect(agreementPriorAdmissibleFor(prior, "some-other-aggregator")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F9 — jurisdiction: binding vs persuasive, and scoping cannot hide evidence.
// ─────────────────────────────────────────────────────────────────────────────

describe("F9: jurisdictional scope", () => {
  it("same scope is binding (weight 1); a sibling scope is persuasive (< 1)", () => {
    expect(jurisdictionDistance(J, J)).toBe(0);
    expect(persuasiveWeight(J, J)).toBe(1);
    expect(persuasiveWeight("oracle/fsharp", J)).toBeLessThan(1);
    expect(persuasiveWeight("oracle/fsharp", J)).toBeGreaterThan(0);
  });

  it("persuasive evidence moves the posterior LESS than binding evidence", () => {
    const edges = [edge("s1", "otto", "authored", T(1))];
    const binding = readCompetence([outcome("s1", true, T(1))], edges, "otto", "review", "use-defect", J);
    const persuasive = readCompetence(
      [outcome("s1", true, T(1), "aaron", "oracle/fsharp")],
      edges,
      "otto",
      "review",
      "use-defect",
      J,
    );
    // `oracle/fsharp` vs `oracle/typescript` is distance 2 (one segment differs on each
    // side), so the persuasive weight is 1/3 and the same observation moves mu less.
    expect(persuasiveWeight("oracle/fsharp", J)).toBeCloseTo(1 / 3, 10);
    expect(binding.kind === "observed" && binding.mu).toBeCloseTo(0.5641895830, 8);
    expect(persuasive.kind === "observed" && persuasive.mu).toBeCloseTo(0.2387214618, 8);
    expect(binding.kind === "observed" && binding.bindingCount).toBe(1);
    expect(persuasive.kind === "observed" && persuasive.bindingCount).toBe(0);
  });

  it("a tempered update at w=1 is exactly the ADF step, and at w=0 moves nothing", () => {
    expect(temperedUpdate(true, freshBelief, 1)).toEqual(updateBelief(true, freshBelief));
    expect(temperedUpdate(true, freshBelief, 0)).toEqual(freshBelief);
  });

  it("evidence scoped too far away is reported, never silently discarded", () => {
    const edges = [edge("s1", "otto", "authored", T(1))];
    const far = outcome("s1", false, T(1), "aaron", "a/b/c/d/e/f/g/h/i/j/k/l");
    expect(persuasiveWeight(far.jurisdiction, J)).toBeLessThan(MIN_PERSUASIVE_WEIGHT);
    const result = attribute([far], edges, "use-defect", J);
    expect(result.observations).toEqual([]);
    expect(result.noUpdate.map((n) => n.reason)).toEqual(["scoped-out"]);
    expect(mechanismCoverage(result).scopedOut).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F10 — the never-folded series stays never-folded.
// ─────────────────────────────────────────────────────────────────────────────

describe("F10: review-vote is recorded, never folded", () => {
  it("foldSeriesToLedger refuses it", () => {
    expect(() => foldSeriesToLedger([], [], "review-vote", J)).toThrow(/never folded/);
  });

  it("the folded set does not contain it", () => {
    expect(FOLDED_SERIES).not.toContain("review-vote");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F11 — stance scoring: the overruled warner is the case the whole design exists for.
// ─────────────────────────────────────────────────────────────────────────────

describe("F11: a claim is settled by reality, not by the crowd", () => {
  it("when a change fails in use, the warner is right and the approvers are wrong", () => {
    const edges = [
      edge("s1", "author", "authored", T(1)),
      edge("s1", "approver-1", "approved", T(2)),
      edge("s1", "approver-2", "approved", T(3)),
      edge("s1", "lone-warner", "warned-overruled", T(4)),
    ];
    const result = attribute([outcome("s1", false, T(5))], edges, "use-defect", J);
    const byAgent = new Map(result.observations.map((o) => [o.agentId, o.hit]));
    expect(byAgent.get("lone-warner")).toBe(true);
    expect(byAgent.get("approver-1")).toBe(false);
    expect(byAgent.get("approver-2")).toBe(false);
    expect(byAgent.get("author")).toBe(false);
  });

  it("and when it holds up, the signs invert", () => {
    const edges = [edge("s1", "lone-warner", "warned", T(1)), edge("s1", "author", "authored", T(2))];
    const result = attribute([outcome("s1", true, T(3))], edges, "use-defect", J);
    const byAgent = new Map(result.observations.map((o) => [o.agentId, o.hit]));
    expect(byAgent.get("lone-warner")).toBe(false);
    expect(byAgent.get("author")).toBe(true);
  });

  it("stanceAgrees is the whole rule, and every treatment has a sign", () => {
    expect(stanceAgrees(1, true)).toBe(true);
    expect(stanceAgrees(1, false)).toBe(false);
    expect(stanceAgrees(-1, false)).toBe(true);
    expect(stanceAgrees(-1, true)).toBe(false);
    expect(TREATMENT_STANCE.authored).toBe(1);
    expect(TREATMENT_STANCE.warned).toBe(-1);
    expect(TREATMENT_STANCE.repaired).toBe(0); // takes no position on the subject
  });

  it("a position-free treatment is never folded", () => {
    const result = attribute([outcome("s1", false, T(2))], [edge("s1", "fixer", "repaired", T(1))], "use-defect", J);
    expect(result.observations).toEqual([]);
    expect(result.noUpdate.map((n) => n.reason)).toEqual(["unattributable"]);
  });

  it("AUTHOR_ONLY is the conservative re-query of the same graph — attribution is revisable", () => {
    const edges = [edge("s1", "author", "authored", T(1)), edge("s1", "approver", "approved", T(2))];
    const outcomes = [outcome("s1", false, T(3))];
    expect(attribute(outcomes, edges, "use-defect", J, STANCE_BEARING).observations).toHaveLength(2);
    expect(attribute(outcomes, edges, "use-defect", J, AUTHOR_ONLY).observations).toHaveLength(1);
    expect(attribute(outcomes, edges, "use-defect", J, AUTHOR_ONLY).ruleId).toBe("author-only@v1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Report → label → determination layers
// ─────────────────────────────────────────────────────────────────────────────

describe("report layers: the observation survives disagreement about the label", () => {
  const report = (() => {
    const made = makeReport({
      reportId: "r1",
      reporter: "user-1",
      intent: "export a ledger to CSV",
      observed: "the export produced an empty file",
      jurisdiction: J,
      at: T(1),
    });
    if (!made.ok) throw new Error(made.reason);
    return made.value;
  })();

  const determination = (verdict: "bug" | "expected-behaviour" | "undetermined", at: string, determiner = "aaron") => {
    const made = makeDetermination({ reportId: "r1", determiner, verdict, jurisdiction: J, at });
    if (!made.ok) throw new Error(made.reason);
    return made.value;
  };

  it("refuses a report with no intent — that is a label, not an observation", () => {
    const made = makeReport({
      reportId: "r2",
      reporter: "user-1",
      intent: "",
      observed: "broken",
      jurisdiction: J,
      at: T(1),
    });
    expect(made.ok).toBe(false);
  });

  it("refuses an unattributed label", () => {
    const made = makeLabel({ reportId: "r1", labeler: "", claim: "bug", jurisdiction: J, at: T(2) });
    expect(made.ok).toBe(false);
  });

  it("re-determination ADDS a layer; the latest wins and the earlier one survives", () => {
    const first = determination("expected-behaviour", T(2));
    const layers = [first, determination("bug", T(3))];
    expect(currentVerdict("r1", layers)?.verdict).toBe("bug");
    expect(currentVerdict("r1", [first])?.verdict).toBe("expected-behaviour");
    expect(layers).toHaveLength(2); // nothing was overwritten
  });

  it("a reporter's competence is settled by a DIFFERENT party's determination", () => {
    const reading = readReporterCompetence([report], [determination("bug", T(2))], "user-1", J);
    expect(reading.kind).toBe("observed");
    if (reading.kind !== "observed") return;
    expect(reading.obsCount).toBe(1);
    expect(reading.mu).toBeGreaterThan(0);
    expect(reading.ruleId).toBe("reporter-upheld@v1");
  });

  it("self-determination settles nothing — and says so", () => {
    const result = attributeReporter([report], [determination("bug", T(2), "user-1")], "user-1", J);
    expect(result.observations).toEqual([]);
    expect(result.noUpdate.map((n) => n.reason)).toEqual(["self-determined"]);
  });

  it("an undetermined report is ignorance, not a bad reporter", () => {
    const reading = readReporterCompetence([report], [], "user-1", J);
    expect(reading.kind).toBe("prior-only");
    expect(reading.mechanismSeen).toBe(1);
  });

  it("a not-a-bug determination scores the reporter down, without rejecting the report", () => {
    const reading = readReporterCompetence([report], [determination("expected-behaviour", T(2))], "user-1", J);
    expect(reading.kind).toBe("observed");
    if (reading.kind !== "observed") return;
    expect(reading.mu).toBeLessThan(0);
    expect(report.observed).toBe("the export produced an empty file"); // the original is untouched
  });
});
