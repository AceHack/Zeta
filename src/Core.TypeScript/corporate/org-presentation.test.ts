/**
 * org-presentation.test.ts — the names a person reads.
 *
 * This layer looks cosmetic and is not. A dashboard that prints `qa_manager` at somebody running the
 * company is asking them to translate their own organization on the way in, and the thing they are
 * translating it FOR is a decision — so the cost lands on the decision, not on the label.
 *
 * What is pinned: the acronyms (the one piece that cannot be derived), the fallbacks (an unknown key
 * must still read), and the gate questions (what somebody is actually being asked when they approve).
 */

import { describe, expect, test } from "bun:test";

import {
  blockerBecause,
  departmentOf,
  departmentRank,
  expectedOutputLabel,
  GATE_LABELS,
  gateLabel,
  gateQuestion,
  hatName,
  humanise,
  levelLabel,
  stateLabel,
  workTypeLabel,
} from "./org-presentation";
import { ORDERED_GATES } from "./quality-gate";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

describe("ACRONYMS ARE NOT WORDS, and title-casing them is worse than not trying", () => {
  test("qa_uat is QA & UAT, not Qa Uat", () => {
    // "Qa Uat" is the failure that reads as carelessness: it is visibly an attempt that did not
    // know what it was looking at.
    expect(humanise("qa_uat")).toBe("QA UAT");
    expect(gateLabel("qa_uat")).toBe("QA & UAT");
  });

  test("a department reads like the sign on the door", () => {
    expect(humanise("qa_and_verification")).toBe("QA & Verification");
    expect(humanise("executive_board_and_governance")).toBe("Executive Board & Governance");
    expect(humanise("operations_and_infrastructure")).toBe("Operations & Infrastructure");
  });

  test("a word nobody listed is title-cased — the honest default", () => {
    expect(humanise("foo_engineer")).toBe("Foo Engineer");
    expect(humanise("sre_lead")).toBe("SRE Lead");
  });

  test("minor words stay small unless they lead", () => {
    expect(humanise("head_of_delivery")).toBe("Head of Delivery");
    expect(humanise("of_counsel")).toBe("Of Counsel");
  });

  test("an empty or unsplittable key comes back unchanged rather than blank", () => {
    // A label that renders as nothing is worse than a raw key: the row looks broken instead of ugly.
    expect(humanise("")).toBe("");
    expect(humanise("___")).toBe("___");
  });
});

describe("EVERY GATE HAS A NAME AND A QUESTION", () => {
  test("all fourteen are named — no gate falls through to its key", () => {
    // A gate that reached a person as `final_business_validation` would be the one place the raw key
    // shows up, and it would be on the card asking them to approve it.
    for (const gate of ORDERED_GATES) {
      expect(GATE_LABELS[String(gate)]).toBeDefined();
    }
  });

  test("...and every one of them asks something a person can answer", () => {
    for (const gate of ORDERED_GATES) {
      const asks = gateQuestion(String(gate));
      expect(asks.length).toBeGreaterThan(20);
      // A QUESTION, not a restatement of the gate's name. "Approve architecture_approval?" tells the
      // reader nothing they did not already know, and it is the shape a derived label would produce.
      expect(asks).toContain("?");
      expect(asks).not.toContain(String(gate));
    }
  });

  test("an unlisted gate still renders, as a question rather than a crash", () => {
    expect(gateLabel("some_new_gate")).toBe("Some New Gate");
    expect(gateQuestion("some_new_gate")).toContain("Some New Gate");
  });
});

describe("names come from the chart, and a missing hat does not blank the row", () => {
  test("a hat reads as its name", () => {
    expect(hatName(chart, "qa_manager")).toBe("QA Manager");
    expect(hatName(chart, "backend_implementer")).toBe("Backend Implementer");
    expect(hatName(chart, "cfo")).toBe("CFO");
  });

  test("a hat the chart no longer has still reads", () => {
    // A log can name a hat a later chart dropped. Refusing to render it would hide history rather
    // than fix it, and the history is the thing the page exists to show.
    expect(hatName(chart, "retired_hat")).toBe("Retired Hat");
    expect(departmentOf(chart, "retired_hat")).toBeUndefined();
  });

  test("a hat's department reads as a department", () => {
    expect(departmentOf(chart, "qa_manager")).toBe("QA & Verification");
  });
});

describe("states and types are said plainly", () => {
  test("work states are what somebody scanning a board would say", () => {
    expect(stateLabel("in_progress")).toBe("In progress");
    expect(stateLabel("done")).toBe("Delivered");
    expect(stateLabel("canceled")).toBe("Cancelled");
  });

  test("levels and types read as roles and things", () => {
    expect(levelLabel("individual_contributor")).toBe("Individual Contributor");
    expect(levelLabel("c_suite")).toBe("Executive");
    expect(workTypeLabel("capability_request")).toBe("Capability Request");
  });

  test("what a room owes sits after the word 'Owes'", () => {
    expect(expectedOutputLabel("gate_result")).toBe("a gate verdict");
    expect(expectedOutputLabel("decision")).toBe("a decision");
  });
});

describe("a blocker's reason does not repeat the question above it", () => {
  test("each way of running out says something different", () => {
    expect(blockerBecause({ kind: "no_owner_in_org", forBlockerKind: "security_blocked" })).toContain(
      "Nobody in this company holds",
    );
    expect(
      blockerBecause({ kind: "owners_could_not_resolve", askedHatIds: ["security_engineer"] }),
    ).toContain("Security Engineer");
    expect(blockerBecause({ kind: "outside_org_authority", what: "the retention policy" })).toContain(
      "the retention policy",
    );
  });

  test("an exhaustion this build does not know still renders a reason", () => {
    // A card with a headline and nothing under it looks broken; a card with a rough reason is
    // merely unpolished, and the reader still learns something.
    expect(blockerBecause({ kind: "some_future_kind" })).toBe("Some Future Kind");
  });
});

describe("the wall chart has an order, and it is not alphabetical", () => {
  test("the executive board comes before engineering", () => {
    // Alphabetical would open on Architecture and bury the board in the middle, which is not how
    // anybody reads their own company.
    expect(departmentRank("executive_board_and_governance")).toBeLessThan(departmentRank("engineering"));
  });

  test("a department nobody listed sorts last rather than vanishing", () => {
    expect(departmentRank("a_new_department")).toBeGreaterThan(departmentRank("capability_and_automation_expansion"));
  });
});
