/**
 * spend-decision.test.ts — the refusal that makes the rest of it mean anything.
 *
 * The load-bearing test in this file is the one where nobody looked for a free alternative and the
 * CFO REFUSES TO RULE. Everything else is a decision procedure, and a decision procedure over
 * inputs nobody gathered is the register's oldest defect wearing a spreadsheet: a proposal where
 * somebody searched hard and found nothing arrives identical to one where nobody opened a browser.
 *
 * The second-most load-bearing is the pair that proves the free way wins BEFORE affordability and
 * BEFORE urgency — money is the fallback, not the default, and an order that checked the budget
 * first would approve every cheap thing that happened to be affordable.
 */

import { describe, expect, test } from "bun:test";
import {
  Adequacy,
  decideSpend,
  EffortClass,
  EFFORT_ORDER,
  effortRank,
  costGateOutcome,
  financeAuthorities,
  SpendVerdict,
  WorkStanding,
  type FreeAlternative,
  type SpendInput,
  type SpendProposal,
} from "./spend-decision";
import { openBudget, remainingOf } from "./budget";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { PriorityClass } from "./prioritization";
import {
  gateOwners,
  GateKind,
  GateOutcome,
  isPassing,
  ORDERED_GATES,
  recoveryPathFor,
  RecoveryPath,
} from "./quality-gate";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const BUDGET = openBudget({
  budgetId: "fy",
  allowance: 10_000,
  unit: "usd",
  windowStartMs: 0,
  windowEndMs: 1_000_000,
});

function proposal(over: Partial<SpendProposal> = {}): SpendProposal {
  return {
    proposalId: "sp-1",
    workId: "task-1",
    what: "a hosted vector database",
    cost: 1_200,
    proposedByHatId: "tech_lead",
    search: { kind: "searched", found: [] },
    ...over,
  };
}

function input(over: Partial<SpendInput> = {}): SpendInput {
  return {
    chart,
    proposal: proposal(),
    byHatId: "cfo",
    budget: BUDGET,
    nowMs: 1_000,
    priority: PriorityClass.Normal,
    effortTolerance: EffortClass.Moderate,
    standing: WorkStanding.Live,
    ...over,
  };
}

const free = (over: Partial<FreeAlternative> = {}): FreeAlternative => ({
  what: "pgvector on the database we already run",
  adequacy: Adequacy.Adequate,
  effort: EffortClass.Small,
  ...over,
});

describe("YOU MAY NOT BUY WHAT YOU HAVE NOT TRIED TO GET FREE", () => {
  test("an unsearched proposal is RETURNED to whoever asked — with what is missing", () => {
    // The forcing function, and the only rule here that changes behaviour rather than recording it.
    //
    // It was a REFUSAL first, and that was wrong twice. As a pure function "I was not given what I
    // need" is not a decision — but at the level of an organization, handing it back IS one, and it
    // reaches somebody who can act. As a refusal it also left its own opening standing, so the CFO
    // was offered the same unsearched proposal every round forever and, because the menu is ordinal,
    // never reached the well-formed proposals sorted behind it.
    const r = decideSpend(input({ proposal: proposal({ search: { kind: "not_searched", why: "in a hurry" } }) }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.Returned);
      expect(r.ruling.reason).toContain("no free alternative was looked for");
      expect(r.ruling.reason).toContain("in a hurry");
      expect(r.ruling.charged).toBe(0);
    }
  });

  test("SEARCHED-AND-FOUND-NOTHING IS A REAL ANSWER, and it approves", () => {
    // The three states, and the difference between the first two is the entire value of asking.
    // Somebody looked, there is no free way, and the ruling says so.
    const r = decideSpend(input());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.Approved);
      expect(r.ruling.reason).toContain("no free way was found");
      expect(r.ruling.charged).toBe(1_200);
    }
  });

  test("an alternative that is not adequate must SAY WHAT IT MISSES", () => {
    // The ruling below is about to hold the shortfall against it. "Partly adequate" with no account
    // of what is missing is an opinion, and the record would not survive being asked why.
    const r = decideSpend(
      input({
        proposal: proposal({
          search: { kind: "searched", found: [free({ adequacy: Adequacy.Partial })] },
        }),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.Returned);
      expect(r.ruling.reason).toContain("does not say what it fails to cover");
    }
  });
});

describe("THE FREE WAY IS WEIGHED FIRST — money is the fallback, not the default", () => {
  test("an adequate free option within tolerance beats paying", () => {
    const r = decideSpend(input({ proposal: proposal({ search: { kind: "searched", found: [free()] } }) }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.UseFreeAlternative);
      expect(r.ruling.instead?.what).toBe("pgvector on the database we already run");
      expect(r.ruling.charged).toBe(0);
    }
  });

  test("...EVEN WHEN THE MONEY IS THERE AND THE WORK IS URGENT", () => {
    // The ordering stated as a test. Checking affordability first would approve every cheap thing
    // that happened to fit the budget, which is the policy this module was built to invert.
    const r = decideSpend(
      input({
        priority: PriorityClass.Expedite,
        proposal: proposal({ cost: 1, search: { kind: "searched", found: [free()] } }),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ruling.verdict).toBe(SpendVerdict.UseFreeAlternative);
  });

  test("TOO MUCH EFFORT AND IT LOSES — and the record says by how much", () => {
    const r = decideSpend(
      input({
        effortTolerance: EffortClass.Small,
        proposal: proposal({ search: { kind: "searched", found: [free({ effort: EffortClass.Large })] } }),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.Approved);
      expect(r.ruling.considered).toHaveLength(1);
      expect(r.ruling.considered[0]?.lostBecause).toContain("large effort");
      expect(r.ruling.considered[0]?.lostBecause).toContain("accepts up to small");
    }
  });

  test("A PARTIAL OPTION NEVER WINS, and its shortfall is what the record keeps", () => {
    const r = decideSpend(
      input({
        proposal: proposal({
          search: {
            kind: "searched",
            found: [free({ adequacy: Adequacy.Partial, shortfall: "no filtered search" })],
          },
        }),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.Approved);
      expect(r.ruling.considered[0]?.lostBecause).toContain("no filtered search");
    }
  });

  test("LEAST EFFORT WINS AMONG THE ADEQUATE, then ORDINALLY — never the order they were typed in", () => {
    const r = decideSpend(
      input({
        proposal: proposal({
          search: {
            kind: "searched",
            found: [
              free({ what: "zzz option", effort: EffortClass.Small }),
              free({ what: "aaa option", effort: EffortClass.Small }),
              free({ what: "the easiest one", effort: EffortClass.Trivial }),
            ],
          },
        }),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ruling.instead?.what).toBe("the easiest one");
  });

  test("...and an ordinal tie is broken by name, not by position", () => {
    const r = decideSpend(
      input({
        proposal: proposal({
          search: {
            kind: "searched",
            found: [free({ what: "zzz" }), free({ what: "aaa" })],
          },
        }),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ruling.instead?.what).toBe("aaa");
  });

  test("EVERY OPTION IS RECORDED, including when one won", () => {
    // "Approved" alone reads the same whether or not anybody looked. So does "use the free one".
    const r = decideSpend(
      input({
        proposal: proposal({
          search: {
            kind: "searched",
            found: [free(), free({ what: "a worse one", adequacy: Adequacy.Inadequate, shortfall: "no vectors" })],
          },
        }),
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.UseFreeAlternative);
      expect(r.ruling.considered.map((c) => c.alternative.what)).toEqual(["a worse one"]);
    }
  });
});

describe("IS IT WORTH IT — weighed against what the organization already said", () => {
  test("work the organization has SET ASIDE gets no money", () => {
    for (const priority of [PriorityClass.Defer, PriorityClass.Paused]) {
      const r = decideSpend(input({ priority }));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.ruling.verdict).toBe(SpendVerdict.NotWorthIt);
        expect(r.ruling.reason).toContain(priority);
        expect(r.ruling.charged).toBe(0);
      }
    }
  });

  test("UNPRICED LIVE WORK COMES BACK — worth cannot be weighed against a blank", () => {
    // Which makes `decide_priority` a precondition of buying anything: the organization must say
    // the work matters before it pays for it.
    //
    // The MENU does not offer this case at all — it waits for the price rather than handing the
    // proposal back over a gap that closes a round later. This is the direct-call guard, and it is
    // reachable by anyone who calls `decideSpend` without going through a surface.
    const r = decideSpend(input({ priority: undefined }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.Returned);
      expect(r.ruling.reason).toContain("no decided priority");
    }
  });

  test("more than the budget holds is NOT WORTH IT, with the budget's own reason", () => {
    const r = decideSpend(input({ proposal: proposal({ cost: 99_999 }) }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.NotWorthIt);
      expect(r.ruling.reason).toContain("has 10000 usd left");
    }
  });

  test("AN UNDECLARED BUDGET IS REFUSED, never treated as permission", () => {
    // `budget.ts` made `Unbudgeted` its own answer precisely so nobody would read it as either of
    // the others. Approving on it would make the limit decorative.
    const r = decideSpend(input({ budget: undefined }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no budget was declared");
  });

  test("a budget outside its window refuses too — and it is a verdict, not a crash", () => {
    const r = decideSpend(input({ nowMs: 9_000_000 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ruling.verdict).toBe(SpendVerdict.NotWorthIt);
  });
});

describe("WHO MAY RULE ON MONEY — derived, never declared twice", () => {
  test("the finance authorities come from the blocker taxonomy", () => {
    // `budget_exceeded` already named them, most specific first. A second list here could disagree
    // with the routing every blocker of that kind already takes.
    expect(financeAuthorities(chart).map((h) => h.id)).toEqual(["cfo", "program_director", "executive_board_member"]);
  });

  test("AND THE COST GATE'S OWNERS ARE THE SAME HATS — two answers to one question, pinned together", () => {
    // The gate reads a hat's own `approvalScopes`; the menu reads the blocker taxonomy. Both answer
    // "who rules on money", and there is no third place to derive one from the other — so they are
    // held together by this test instead, the same way `deliveredSet` is pinned to `isDelivered`.
    //
    // It also exists because of a real failure: the gate shipped with ONE owner, and a falsifier
    // that needs an evaluator other than the author had nobody to pick. A control a single hat owns
    // blocks entirely whenever that hat is the author.
    expect(new Set(gateOwners(chart, GateKind.CostApproval).map((h) => h.id))).toEqual(
      new Set(financeAuthorities(chart).map((h) => h.id)),
    );
  });

  test("a hat outside that set may not rule, however senior", () => {
    // The CTO runs half the company and does not hold the money.
    const r = decideSpend(input({ byHatId: "cto" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("does not hold the money");
  });

  test("SEPARATION OF DUTIES — the proposer may not approve its own purchase", () => {
    // The same rule the quality gates apply to reviews. A hat approving its own spend is a proposal
    // with a rubber stamp attached, and the record would not show the difference.
    const r = decideSpend(input({ proposal: proposal({ proposedByHatId: "cfo" }) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("cannot also rule on it");
  });

  test("an unknown hat is refused", () => {
    expect(decideSpend(input({ byHatId: "ghost" })).ok).toBe(false);
  });
});

describe("the shape of a cost", () => {
  test("nothing and negatives are not spend decisions", () => {
    for (const cost of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = decideSpend(input({ proposal: proposal({ cost }) }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("not a spend decision");
    }
  });

  test("an approval charges EXACTLY the proposed cost, and nothing else charges at all", () => {
    // What `budget.spend` will be handed. A ruling that committed a different number from the one
    // it recorded would put the reasoning and the money out of step.
    const approved = decideSpend(input());
    expect(approved.ok && approved.ruling.charged).toBe(1_200);
    const declined = decideSpend(input({ priority: PriorityClass.Paused }));
    expect(declined.ok && declined.ruling.charged).toBe(0);
    // And the budget itself is untouched by ruling — charging is the drive's act, not this one.
    expect(remainingOf(BUDGET)).toBe(10_000);
  });

  test("effort is ORDINAL, and the order is the single source of it", () => {
    expect(EFFORT_ORDER.map(effortRank)).toEqual([0, 1, 2, 3]);
    expect(effortRank(EffortClass.Trivial)).toBeLessThan(effortRank(EffortClass.Large));
  });
});

describe("WHERE THE WORK STANDS — waiting, answered by events, or pointing at nothing", () => {
  test("FINISHED WORK IS NOT WORTH BUYING FOR — a verdict, not a wait", () => {
    // Measured: a memory-tooling proposal sat through three simulated days while its goal was
    // decomposed, delivered and superseded twice. It was waiting for a price that would never be
    // set, because pricing is only ever offered on work that is still live. Events answered it.
    const r = decideSpend(input({ standing: WorkStanding.Finished }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.NotWorthIt);
      expect(r.ruling.reason).toContain("nothing left to buy for");
      expect(r.ruling.charged).toBe(0);
    }
  });

  test("...and it is decided BEFORE the free-alternative weighing, because there is nothing to weigh", () => {
    // An adequate free option would otherwise win and record a recommendation for work nobody is
    // doing — an answer that reads as advice and is really an artefact of ordering.
    const r = decideSpend(input({ standing: WorkStanding.Finished, proposal: proposal({ search: { kind: "searched", found: [free()] } }) }));
    expect(r.ok && r.ruling.verdict).toBe(SpendVerdict.NotWorthIt);
  });

  test("WORK THIS ORGANIZATION DOES NOT HOLD comes back to the proposer", () => {
    const r = decideSpend(input({ standing: WorkStanding.Unknown }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ruling.verdict).toBe(SpendVerdict.Returned);
      expect(r.ruling.reason).toContain("not work this organization holds");
    }
  });

  test("an unsearched proposal is RETURNED even before standing is considered", () => {
    // The forcing function outranks everything: whatever else is wrong, the first thing the CFO
    // says is that nobody looked for a free way.
    const r = decideSpend(
      input({ standing: WorkStanding.Unknown, proposal: proposal({ search: { kind: "not_searched", why: "rushed" } }) }),
    );
    expect(r.ok && r.ruling.reason).toContain("no free alternative was looked for");
  });
});

describe("THE COST GATE — every architecture past the hat that holds the money", () => {
  const NONE = new Map<string, SpendVerdict>();
  const p1 = proposal({ proposalId: "sp-1", workId: "w-1", what: "a hosted thing" });
  const p2 = proposal({ proposalId: "sp-2", workId: "w-1", what: "a second thing" });

  test("it sits immediately after the architecture is approved — the last cheap moment", () => {
    // An architecture approved on its merits and found unaffordable six gates later has already
    // been built.
    const i = ORDERED_GATES.indexOf(GateKind.CostApproval);
    expect(ORDERED_GATES[i - 1]).toBe(GateKind.ArchitectureApproval);
  });

  test("NO COST IMPLIED IS A WAIVER, NOT AN APPROVAL — and it passes", () => {
    // The user's "bypass / no-op", made visible. `Waived` means the control does not apply here;
    // `Approved` would mean the spending was signed off. Both let work through, and an audit must
    // be able to tell them apart — which is this register's oldest defect in its cheapest form.
    const r = costGateOutcome("w-nothing", [p1], NONE);
    expect(r.outcome).toBe(GateOutcome.Waived);
    expect(isPassing(r.outcome)).toBe(true);
    expect(r.reason).toContain("implies no cost");
  });

  test("a proposal NOBODY HAS RULED ON blocks — the CFO has not been asked yet", () => {
    const r = costGateOutcome("w-1", [p1], NONE);
    expect(r.outcome).toBe(GateOutcome.ChangesRequested);
    expect(r.reason).toContain("has not been ruled on");
  });

  test("work sent back to its proposer blocks, and says who owes what", () => {
    const r = costGateOutcome("w-1", [p1], new Map([["sp-1", SpendVerdict.Returned]]));
    expect(r.outcome).toBe(GateOutcome.ChangesRequested);
    expect(r.reason).toContain("sent back to 'tech_lead'");
  });

  test("UNFUNDED MEANS DESIGN IT ANOTHER WAY — changes requested, not rejected", () => {
    // The difference is what the author should do next. The design is not wrong; the way it spends
    // money is, and there may well be another way.
    const r = costGateOutcome("w-1", [p1], new Map([["sp-1", SpendVerdict.NotWorthIt]]));
    expect(r.outcome).toBe(GateOutcome.ChangesRequested);
    expect(r.reason).toContain("design it another way");
  });

  test("...and it sends the work BACK TO THE ARCHITECTURE, not to engineering", () => {
    // A cost the organization will not fund is a fact about the DESIGN. Routing it to a change
    // request would make the money somebody else's to negotiate away, which is how a cost control
    // becomes a queue.
    expect(recoveryPathFor(GateKind.CostApproval)).toBe(RecoveryPath.ReopenArchitecture);
  });

  test("approved and free-alternative rulings both PASS, and the record says how many of each", () => {
    const r = costGateOutcome(
      "w-1",
      [p1, p2],
      new Map([
        ["sp-1", SpendVerdict.Approved],
        ["sp-2", SpendVerdict.UseFreeAlternative],
      ]),
    );
    expect(r.outcome).toBe(GateOutcome.Approved);
    expect(r.reason).toContain("1 purchase(s) approved");
    expect(r.reason).toContain("1 replaced by a free alternative");
  });

  test("ONE UNRULED PROPOSAL BLOCKS THE WHOLE GATE, however many others passed", () => {
    const r = costGateOutcome("w-1", [p1, p2], new Map([["sp-1", SpendVerdict.Approved]]));
    expect(r.outcome).toBe(GateOutcome.ChangesRequested);
    expect(r.reason).toContain("sp-2");
  });

  test("the blocker reported is ORDINAL, not whichever was listed first", () => {
    // Otherwise a run reports a different blocker each time the proposals are reordered, and two
    // organizations in the same state disagree about what is holding them up.
    const r = costGateOutcome("w-1", [p2, p1], NONE);
    expect(r.reason).toContain("sp-1");
  });

  test("another work item's proposals are not this gate's business", () => {
    expect(costGateOutcome("w-2", [p1], NONE).outcome).toBe(GateOutcome.Waived);
  });
});

describe("WHO EVALUATES THE COST GATE — nearest hat holding the money, not first in the file", () => {
  test("the CFO comes first, the board last", () => {
    // `gateOwners` filters `chart.hats`, so without a ranking the order is the order the seed
    // declares hats in — and `runGateChain` takes the first owner as its default evaluator. The
    // seed declares the Executive Board first because it is the ROOT of the chart, so the board
    // evaluated every cost gate in the organization.
    //
    // Measured as two failing end-to-end tests reporting `executive_board` where no board hat had
    // any business being. The fifth appearance of "whichever was listed first" in this register.
    expect(gateOwners(chart, GateKind.CostApproval).map((h) => h.id)).toEqual([
      "cfo",
      "program_director",
      "executive_board_member",
    ]);
  });

  test("THE ORDER IS THE TAXONOMY'S, not a second list — money routing already had an answer", () => {
    expect(gateOwners(chart, GateKind.CostApproval).map((h) => h.id)).toEqual(
      financeAuthorities(chart).map((h) => h.id),
    );
  });

  test("A GATE WITH NO DECLARED RANKING KEEPS CHART ORDER — nothing is invented", () => {
    // Inventing a ranking for gates nobody has ranked would be worse than admitting there is none.
    const owners = gateOwners(chart, GateKind.ArchitectureApproval).map((h) => h.id);
    const inChartOrder = chart.hats
      .filter((h) => h.approvalScopes?.includes(GateKind.ArchitectureApproval) === true)
      .map((h) => h.id);
    expect(owners).toEqual(inChartOrder);
  });
});
