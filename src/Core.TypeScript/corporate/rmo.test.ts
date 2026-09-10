/**
 * rmo.test.ts — how many wearers a hat is authorized.
 *
 * The load-bearing assertions are the REFUSALS and the one distinction that looks like a
 * distinction without a difference: `no_quorum` is not `hold`. Nothing changes under either, and
 * they are opposite facts — one is the supervisors deciding the level is right, the other is them
 * not having decided.
 */

import { describe, expect, test } from "bun:test";
import {
  decideSupply,
  DEFAULT_LOAD_PER_WEARER,
  eligibleVoters,
  endorseRecommendation,
  MIN_VOTER_LEVEL,
  priorityWeight,
  quorumFor,
  requiredSupply,
  tallySupply,
  type SupplyVote,
} from "./rmo";
import { buildOrgChart, LEVEL_RANK } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { WorkState, WorkType, type Cascade } from "./goal-cascade";
import { PriorityClass, type PriorityDecision } from "./prioritization";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const HAT = "backend_implementer";

const leaf = (workId: string, over: Partial<Cascade["nodes"][number]> = {}) => ({
  workId,
  workType: WorkType.Task,
  title: workId,
  state: WorkState.Open,
  ownerHatId: "tech_lead",
  parentWorkId: "p1",
  assigneeHatId: HAT,
  ...over,
});

const cascade = (...nodes: Cascade["nodes"][number][]): Cascade => ({
  nodes: [
    { workId: "p1", workType: WorkType.Project, title: "p", state: WorkState.InProgress, ownerHatId: "engineering_manager" },
    ...nodes,
  ],
});

const priority = (workId: string, priorityClass: PriorityClass): PriorityDecision => ({
  workId,
  priorityClass,
  decidedByHatId: "cto",
  reason: "r",
  recommended: PriorityClass.Normal,
  reasonCodes: [],
});

const vote = (voterHatId: string, target: number): SupplyVote => ({ voterHatId, target, reason: "r" });

describe("supply is computed from PRIORITY-WEIGHTED workload", () => {
  test("expedite counts fully, paused counts for nothing", () => {
    expect(priorityWeight(priority("w", PriorityClass.Expedite))).toBe(1);
    expect(priorityWeight(priority("w", PriorityClass.Paused))).toBe(0);
    // Unprioritized is UNKNOWN, not weightless — staffing zero for work nobody has ranked yet
    // would let an unranked backlog silently justify an empty team.
    expect(priorityWeight(undefined)).toBe(0.5);
  });

  test("more high-priority work implies more wearers", () => {
    const four = cascade(leaf("t1"), leaf("t2"), leaf("t3"), leaf("t4"));
    const ps = ["t1", "t2", "t3", "t4"].map((id) => priority(id, PriorityClass.Expedite));
    expect(requiredSupply(HAT, { cascade: four, priorities: ps })).toBe(2); // 4 / 2 per wearer
    expect(requiredSupply(HAT, { cascade: four, priorities: ps, loadPerWearer: 4 })).toBe(1);
  });

  test("PAUSED work needs nobody — staffing for work nobody will do is how you end up late", () => {
    const c = cascade(leaf("t1"), leaf("t2"));
    const paused = ["t1", "t2"].map((id) => priority(id, PriorityClass.Paused));
    expect(requiredSupply(HAT, { cascade: c, priorities: paused })).toBe(0);
  });

  test("UPCOMING work counts too — the office staffs for the queue, not just the desk", () => {
    // Without this, supply is read off ASSIGNED work only, so a hat can never be authorized to grow
    // until the backlog has already been forced onto the wearers it has. The RMO ends up one cycle
    // behind demand permanently: staffing for the queue it just absorbed instead of the one coming.
    const assignedOnly = cascade(leaf("t1"), leaf("t2"));
    const ps = ["t1", "t2", "u1", "u2"].map((id) => priority(id, PriorityClass.Expedite));

    // Two assigned items, two per wearer -> one wearer.
    expect(requiredSupply(HAT, { cascade: assignedOnly, priorities: ps })).toBe(1);

    // The same two, plus two unstaffed items that WILL route to this hat -> two wearers.
    const upcoming = [
      { node: leaf("u1"), hatId: HAT },
      { node: leaf("u2"), hatId: HAT },
    ];
    expect(requiredSupply(HAT, { cascade: assignedOnly, priorities: ps, upcoming })).toBe(2);
  });

  test("upcoming work for ANOTHER hat does not inflate this one", () => {
    // The routing is the caller's, and it is honoured. Counting every unstaffed item toward every
    // hat would authorize the whole organization to grow off one queue.
    // The counts are chosen so the ROUTING changes the answer. An earlier version of this test used
    // one assigned item, where ceil(1/2) and ceil(2/2) are both 1 — the ceiling absorbed the
    // difference, the assertion held whether the filter existed or not, and a mutant that counted
    // every queued item toward every hat survived it.
    const c = cascade(leaf("t1"), leaf("t2"));
    const ps = ["t1", "t2", "u1", "u2"].map((id) => priority(id, PriorityClass.Expedite));
    const elsewhere = [
      { node: leaf("u1"), hatId: "some_other_hat" },
      { node: leaf("u2"), hatId: "some_other_hat" },
    ];
    expect(requiredSupply(HAT, { cascade: c, priorities: ps })).toBe(1);
    expect(requiredSupply(HAT, { cascade: c, priorities: ps, upcoming: elsewhere })).toBe(1);
    // ...and the same queue routed HERE does move it, which is what proves the filter is the reason.
    const here = elsewhere.map((e) => ({ node: e.node, hatId: HAT }));
    expect(requiredSupply(HAT, { cascade: c, priorities: ps, upcoming: here })).toBe(2);
  });

  test("upcoming work that is DONE or CANCELLED needs nobody, same as assigned work", () => {
    const c = cascade();
    const upcoming = [
      { node: leaf("u1", { state: WorkState.Done }), hatId: HAT },
      { node: leaf("u2", { state: WorkState.Canceled }), hatId: HAT },
    ];
    expect(requiredSupply(HAT, { cascade: c, priorities: [], upcoming })).toBe(0);
  });

  test("finished and cancelled work needs nobody", () => {
    const c = cascade(leaf("t1", { state: WorkState.Done }), leaf("t2", { state: WorkState.Canceled }));
    expect(requiredSupply(HAT, { cascade: c, priorities: [] })).toBe(0);
  });

  test("another hat's work is not ours, and parents are not workable", () => {
    const c = cascade(leaf("t1", { assigneeHatId: "frontend_implementer" }));
    expect(requiredSupply(HAT, { cascade: c, priorities: [] })).toBe(0);
    // The project node is assigned to nobody and has a child; it must not count as workload.
    expect(requiredSupply("engineering_manager", { cascade: c, priorities: [] })).toBe(0);

    // And a node that HAS CHILDREN does not count even when its own type is a leaf type and it is
    // assigned to the hat. A `Project` would already be excluded by the leaf-type check, so only a
    // leaf-typed node with children exercises the children check — the malformed shape the guard
    // exists for. Counting it would charge the hat for the parent AND each of its children.
    const leafWithChildren: Cascade = {
      nodes: [
        leaf("t-parent", { parentWorkId: "p1" }),
        leaf("t-child", { parentWorkId: "t-parent", assigneeHatId: "frontend_implementer" }),
      ],
    };
    expect(requiredSupply(HAT, { cascade: leafWithChildren, priorities: [] })).toBe(0);
  });

  test("no open work implies NO wearers — a real answer, not a floor", () => {
    expect(requiredSupply(HAT, { cascade: cascade(), priorities: [] })).toBe(0);
    expect(DEFAULT_LOAD_PER_WEARER).toBe(2);
  });
});

describe("who may vote is DERIVED from the chart", () => {
  test("the hat's supervisors at manager level or above — never the hat itself", () => {
    const voters = eligibleVoters(chart, HAT);
    expect(voters.length).toBeGreaterThan(0);
    expect(voters).not.toContain(HAT);
    for (const v of voters) {
      const level = chart.byId.get(v)?.level;
      // Lower rank is MORE senior, so a voter must be at or above the minimum level.
      expect(LEVEL_RANK[level!]).toBeLessThanOrEqual(LEVEL_RANK[MIN_VOTER_LEVEL]);
    }
  });

  test("A LEAD CANNOT AUTHORIZE ITS OWN HEADCOUNT", () => {
    // `tech_lead` supervises this hat but is below the minimum voting level: the person who wants
    // the resource is the worst judge of how much of it exists.
    expect(eligibleVoters(chart, HAT)).not.toContain("tech_lead");
  });

  test("A HAT SENIOR ENOUGH TO VOTE STILL CANNOT VOTE ON ITSELF", () => {
    // The level filter alone does not cover this: a manager IS senior enough, so only the explicit
    // self-exclusion keeps it from authorizing its own headcount.
    const voters = eligibleVoters(chart, "engineering_manager");
    expect(voters.length).toBeGreaterThan(0);
    expect(voters).not.toContain("engineering_manager");
  });

  test("an unknown hat has no voters, so no decision can be taken about it", () => {
    expect(eligibleVoters(chart, "ghost")).toEqual([]);
  });
});

describe("the tally", () => {
  const voters = eligibleVoters(chart, HAT);

  test("quorum is a majority — one voter is its own majority, zero can never reach it", () => {
    expect(quorumFor(1)).toBe(1);
    expect(quorumFor(2)).toBe(2);
    expect(quorumFor(3)).toBe(2);
    expect(quorumFor(0)).toBe(1);
  });

  test("NO QUORUM IS NOT `hold` — it is the absence of a decision", () => {
    // They look alike: nothing changes either way. Collapsing them would let an unstaffed
    // organization report that its staffing was reviewed and approved.
    const r = tallySupply({ chart, hatId: HAT, votes: [], currentWearers: 1, recommended: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no quorum");
  });

  test("a quorum yields expand / release / hold against the CURRENT wearers", () => {
    const all = voters.map((v) => vote(v, 3));
    const expand = tallySupply({ chart, hatId: HAT, votes: all, currentWearers: 1, recommended: 3 });
    expect(expand.ok).toBe(true);
    if (expand.ok) {
      expect(expand.decision.action).toBe("expand");
      expect(expand.decision.target).toBe(3);
    }
    const release = tallySupply({ chart, hatId: HAT, votes: all, currentWearers: 9, recommended: 3 });
    if (release.ok) expect(release.decision.action).toBe("release");
    const hold = tallySupply({ chart, hatId: HAT, votes: all, currentWearers: 3, recommended: 3 });
    if (hold.ok) expect(hold.decision.action).toBe("hold");
  });

  test("THE TARGET IS THE MEDIAN — one supervisor asking for twelve does not move it", () => {
    if (voters.length < 3) return;
    const skewed = [vote(voters[0]!, 2), vote(voters[1]!, 2), vote(voters[2]!, 12)];
    const r = tallySupply({ chart, hatId: HAT, votes: skewed, currentWearers: 1, recommended: 2 });
    expect(r.ok).toBe(true);
    // Median 2; the mean would be 5.33 — a number nobody voted for, picked by one outlier.
    if (r.ok) expect(r.decision.target).toBe(2);
  });

  test("an even split rounds toward RESTRAINT — the lower middle", () => {
    // Enough voters that the tally REACHES QUORUM. An under-quorum tally is refused, and the
    // assertion below would then be skipped and pass for the wrong reason.
    const even = voters.length % 2 === 0 ? voters : voters.slice(0, voters.length - 1);
    if (even.length < 2) return;
    const half = even.length / 2;
    const split = even.map((v, i) => vote(v, i < half ? 2 : 6));
    const r = tallySupply({ chart, hatId: HAT, votes: split, currentWearers: 1, recommended: 2 });
    expect(r.ok).toBe(true);
    // An authorized headcount must be a number somebody actually voted for; the average is not.
    if (r.ok) expect(r.decision.target).toBe(2);
  });

  test("A VOTER OUTSIDE THE LINE IS REFUSED", () => {
    const r = tallySupply({
      chart,
      hatId: HAT,
      votes: [...voters.map((v) => vote(v, 2)), vote("data_manager", 9)],
      currentWearers: 1,
      recommended: 2,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("does not supervise");
  });

  test("voting twice is refused — one supervisor must not outvote the rest by repeating", () => {
    const r = tallySupply({
      chart,
      hatId: HAT,
      votes: [vote(voters[0]!, 2), vote(voters[0]!, 9)],
      currentWearers: 1,
      recommended: 2,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("voted twice");
  });

  test("a target that is not a headcount is refused", () => {
    for (const bad of [-1, 1.5, Number.NaN]) {
      // A FULL slate, so the refusal is about the value and not about missing quorum — a single
      // vote would be refused either way and the test would prove nothing.
      const votes = voters.map((v, i) => vote(v, i === 0 ? bad : 2));
      const r = tallySupply({ chart, hatId: HAT, votes, currentWearers: 1, recommended: 2 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("not a headcount");
    }
  });

  test("a hat nobody supervises cannot have its supply decided", () => {
    const r = tallySupply({ chart, hatId: "ghost", votes: [], currentWearers: 0, recommended: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("supervises");
  });

  test("the RECOMMENDATION is carried beside the decision", () => {
    // So a decision that departs from the workload is visible AS a departure rather than looking
    // like the computation.
    const r = tallySupply({ chart, hatId: HAT, votes: voters.map((v) => vote(v, 5)), currentWearers: 1, recommended: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decision.recommended).toBe(2);
      expect(r.decision.target).toBe(5);
    }
  });
});

describe("the whole office in one call", () => {
  test("supervisors endorsing the workload authorize exactly it", () => {
    const four = cascade(leaf("t1"), leaf("t2"), leaf("t3"), leaf("t4"));
    const ps = ["t1", "t2", "t3", "t4"].map((id) => priority(id, PriorityClass.Expedite));
    const r = decideSupply({
      chart,
      hatId: HAT,
      currentWearers: 1,
      supply: { cascade: four, priorities: ps },
      voteBy: endorseRecommendation(),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decision.recommended).toBe(2);
      expect(r.decision.target).toBe(2);
      expect(r.decision.action).toBe("expand");
    }
  });

  test("ABSTENTION IS A REAL POSITION — enough of it leaves no quorum", () => {
    const r = decideSupply({
      chart,
      hatId: HAT,
      currentWearers: 1,
      supply: { cascade: cascade(leaf("t1")), priorities: [] },
      voteBy: () => undefined,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("no quorum");
  });

  test("only ELIGIBLE supervisors are asked", () => {
    const asked: string[] = [];
    decideSupply({
      chart,
      hatId: HAT,
      currentWearers: 1,
      supply: { cascade: cascade(leaf("t1")), priorities: [] },
      voteBy: (voter, recommended) => {
        asked.push(voter);
        return { voterHatId: voter, target: recommended, reason: "r" };
      },
    });
    expect(asked).toEqual([...eligibleVoters(chart, HAT)]);
    expect(asked).not.toContain("tech_lead");
  });
});
