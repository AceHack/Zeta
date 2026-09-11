/**
 * branch-topology.test.ts — what a change is called, and what it branches from.
 *
 * The property worth defending hardest is the NEGATIVE one: a single defect must not acquire an
 * integration branch. Every inbound request is decomposed into a full `goal -> initiative ->
 * project -> leaf` chain, so a rule keyed on the work TYPE would give a one-line fix a feature
 * branch, a merge into it, and a merge out of it, to carry one commit. The rule is keyed on how
 * much code actually sits under a rung, and these tests are mostly about that distinction.
 */

import { describe, expect, test } from "bun:test";
import { externalRefOf } from "./intake";
import { WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import {
  ancestorsOf,
  branchNameFor,
  branchNameIn,
  changeContextFor,
  branchPlanFor,
  codeProducingUnder,
  collects,
  descendantsOf,
  isBranchPlan,
  prefixFor,
  slugOf,
  ticketOf,
  DEFAULT_BRANCH_PREFIXES,
} from "./branch-topology";

function node(
  workId: string,
  workType: WorkType,
  parentWorkId?: string,
  extra: Partial<CascadeNode> = {},
): CascadeNode {
  return {
    workId,
    workType,
    title: `do ${workId}`,
    state: WorkState.Open,
    ownerHatId: "tech_lead",
    ...(parentWorkId === undefined ? {} : { parentWorkId }),
    ...extra,
  };
}

/** goal -> initiative -> project -> <leaves>. The shape every inbound request is decomposed into. */
function chain(leaves: readonly WorkType[], extra: Partial<CascadeNode> = {}): Cascade {
  return {
    nodes: [
      node("goal-1", WorkType.Goal, undefined, extra),
      node("init-1", WorkType.Initiative, "goal-1", extra),
      node("proj-1", WorkType.Project, "init-1", extra),
      ...leaves.map((t, i) => node(`leaf-${String(i + 1)}`, t, "proj-1", extra)),
    ],
  };
}

describe("ticketOf reads the LENGTHS, not the separators", () => {
  test("an ordinary key yields its external id", () => {
    expect(ticketOf(externalRefOf("jira", "AIAGENT-1595"))).toBe("AIAGENT-1595");
  });

  test("A SOURCE CONTAINING THE SEPARATORS still parses", () => {
    // This is the entire reason `externalRefOf` length-prefixes. A parser that split on `|` or `:`
    // would work on every key anybody has yet written and fail on the first system with a colon in
    // its name — and it would fail by returning a plausible WRONG id, not by refusing.
    expect(ticketOf(externalRefOf("jira|prod:eu", "ABC-1"))).toBe("ABC-1");
    expect(ticketOf(externalRefOf("a:b", "X|Y-2"))).toBe("X|Y-2");
  });

  test("nothing, and malformed keys, yield UNDEFINED rather than a guess", () => {
    expect(ticketOf(undefined)).toBeUndefined();
    expect(ticketOf("")).toBeUndefined();
    expect(ticketOf("not-a-key")).toBeUndefined();
    // A length that does not match what follows it: no partial credit, because a half-read key
    // produces a branch named after the wrong ticket, which is worse than one named after none.
    expect(ticketOf("4:jira|20:AIAGENT-1595")).toBeUndefined();
    expect(ticketOf("4:jira|4:AIAGENT-1595")).toBeUndefined();
    // The separator has to be exactly where the source length says it is.
    expect(ticketOf("9:jira|12:AIAGENT-1595")).toBeUndefined();
    // An empty id is not an id.
    expect(ticketOf("4:jira|0:")).toBeUndefined();
  });
});

describe("slugOf produces something git will accept", () => {
  test("spaces and punctuation collapse to single dashes", () => {
    expect(slugOf("checkout double-charges when a coupon is applied twice"))
      .toBe("checkout-double-charges-when-a-coupon-is-applied");
    expect(slugOf("a  b   c")).toBe("a-b-c");
  });

  test("REFS GIT REFUSES ARE NOT PRODUCED", () => {
    // `..` anywhere, a leading or trailing dot/slash/dash, and a `.lock` suffix are all refused by
    // `git check-ref-format`. Asserted rather than assumed: a branch name that git rejects turns
    // into a failed `open` at run time, on a real repository, after the work was scheduled.
    expect(slugOf("a..b")).toBe("a.b");
    expect(slugOf("...leading")).toBe("leading");
    expect(slugOf("trailing...")).toBe("trailing");
    expect(slugOf("-dashes-")).toBe("dashes");
    expect(slugOf("release.lock")).toBe("release");
    expect(slugOf("feat: ~thing^[2]")).toBe("feat-thing-2");
    for (const bad of ["a..b", "...x", "y...", " sp ace ", "tilde~", "caret^", "colon:", "star*"]) {
      expect(slugOf(bad)).not.toMatch(/[~^:?*[\\ ]|\.\.|^[-._]|[-._]$/);
    }
  });

  test("it is bounded, and the cut never lands on a trailing dash", () => {
    const long = slugOf("x".repeat(200));
    expect(long.length).toBe(48);
    // A cut that lands mid-dash would leave `...-`, which is illegal.
    expect(slugOf(`${"a".repeat(47)} tail`)).not.toMatch(/[-._]$/);
  });

  test("a title with nothing usable in it yields an empty slug rather than junk", () => {
    expect(slugOf("!!!")).toBe("");
    expect(slugOf("")).toBe("");
  });
});

describe("a branch is named after the TICKET when there is one", () => {
  test("the ticket wins over the title", () => {
    const n = node("leaf-1", WorkType.Defect, "proj-1", {
      title: "checkout double-charges",
      requestRef: externalRefOf("jira", "AIAGENT-1637"),
    });
    expect(branchNameFor(n)).toBe("defect/AIAGENT-1637");
  });

  test("...and the title is the fallback for work the organization raised itself", () => {
    const n = node("leaf-1", WorkType.Task, "proj-1", { title: "Add retry to the clone step" });
    expect(branchNameFor(n)).toBe("story/Add-retry-to-the-clone-step");
  });

  test("...and the workId is the fallback under THAT", () => {
    // A node whose title is punctuation would otherwise produce `story/`, which is not a ref at
    // all. This function has to always return something usable: the alternative is a run that
    // schedules work and then cannot open a branch for it.
    const n = node("leaf-9", WorkType.Task, "proj-1", { title: "!!!" });
    expect(branchNameFor(n)).toBe("story/leaf-9");
  });

  test("a MALFORMED request ref falls back rather than naming the wrong ticket", () => {
    const n = node("leaf-1", WorkType.Defect, "proj-1", { title: "a real title", requestRef: "garbage" });
    expect(branchNameFor(n)).toBe("defect/a-real-title");
  });

  test("each rung gets its own namespace, and a collecting project reads as a FEATURE", () => {
    // `project/...` would make this organization's history unreadable to the people reviewing it.
    // The rest of the world calls a collecting project a feature branch.
    expect(prefixFor(WorkType.Project)).toBe("feature");
    expect(prefixFor(WorkType.Defect)).toBe("defect");
    expect(prefixFor(WorkType.Incident)).toBe("hotfix");
    // A type absent from the table is named after itself — never silently sharing another's.
    expect(prefixFor(WorkType.Task, {})).toBe("task");
    expect(new Set(Object.values(DEFAULT_BRANCH_PREFIXES)).size).toBeGreaterThan(1);
  });
});

describe("AN INHERITED TICKET MUST NOT NAME TWO BRANCHES THE SAME", () => {
  // `requestRef` is inherited by children on purpose, so in a real decomposition every rung carries
  // one ticket. Measured on the folded cascade of an actual end-to-end run, before this was handled:
  //
  //     goal-009 epic/T-1   init-011 epic/T-1   proj-013 feature/T-1
  //     task-015 defect/T-1 task-017 review/T-1
  //
  // Two nodes, one name. The differing prefixes hid the worse case: two TASKS under one project --
  // the feature case this module exists for -- would both be `story/T-1`, and the second would be
  // refused by the change port as an attempt to reuse the first's branch. Safe, and entirely stuck.

  /** One ticket, inherited all the way down, two stories under one project. */
  const inherited: Cascade = (() => {
    const ref = externalRefOf("jira", "T-1");
    return {
      nodes: [
        node("goal-1", WorkType.Goal, undefined, { requestRef: ref, title: "the outcome" }),
        node("init-1", WorkType.Initiative, "goal-1", { requestRef: ref, title: "the epic" }),
        node("proj-1", WorkType.Project, "init-1", { requestRef: ref, title: "the feature" }),
        node("leaf-1", WorkType.Task, "proj-1", { requestRef: ref, title: "story one" }),
        node("leaf-2", WorkType.Task, "proj-1", { requestRef: ref, title: "story two" }),
      ],
    };
  })();

  test("EVERY branch in a cascade is distinct", () => {
    // The property, asserted as a property. A per-case expectation would pass while some other pair
    // collided, and any collision at all is the failure.
    const names = inherited.nodes.map((n) => branchNameIn(inherited, n));
    expect(new Set(names).size).toBe(names.length);
  });

  test("two stories sharing one ticket are named by their DESCRIPTIONS", () => {
    const one = inherited.nodes.find((n) => n.workId === "leaf-1") as CascadeNode;
    const two = inherited.nodes.find((n) => n.workId === "leaf-2") as CascadeNode;
    expect(branchNameIn(inherited, one)).toBe("story/story-one");
    expect(branchNameIn(inherited, two)).toBe("story/story-two");
    // …and they still share ONE feature branch, which is the point of the collection.
    expect(changeContextFor({ cascade: inherited, workId: "leaf-1" })?.base).toBe(
      changeContextFor({ cascade: inherited, workId: "leaf-2" })?.base,
    );
  });

  test("...AND A LONE ITEM KEEPS ITS TICKET — the case an inheritance test got wrong", () => {
    // The correction that produced the current rule. Keying on "is this ref my own or my parent's"
    // is a true statement about inheritance and the wrong rule: a request that becomes ONE code item
    // has an inherited ref and no collision, and demoting it to `defect/do-leaf-1` throws away the
    // most useful thing a branch name carries for no gain at all.
    const lone: Cascade = {
      nodes: [
        node("goal-1", WorkType.Goal, undefined, { requestRef: externalRefOf("jira", "AIAGENT-1637"), title: "the outcome" }),
        node("proj-1", WorkType.Project, "goal-1", { requestRef: externalRefOf("jira", "AIAGENT-1637"), title: "the fix" }),
        node("leaf-1", WorkType.Defect, "proj-1", { requestRef: externalRefOf("jira", "AIAGENT-1637"), title: "double charge" }),
      ],
    };
    expect(branchNameIn(lone, lone.nodes[2] as CascadeNode)).toBe("defect/AIAGENT-1637");
  });

  test("identically-titled siblings fall back to the work id rather than colliding", () => {
    // The last resort, and it always works because the id is unique by construction. Deliberately
    // ugly: a branch that reaches this has two siblings nobody gave distinct titles.
    const twins: Cascade = {
      nodes: [
        node("proj-1", WorkType.Project, undefined, { title: "the feature" }),
        node("leaf-1", WorkType.Task, "proj-1", { title: "same" }),
        node("leaf-2", WorkType.Task, "proj-1", { title: "same" }),
      ],
    };
    const names = [1, 2].map((i) => branchNameIn(twins, twins.nodes[i] as CascadeNode));
    expect(new Set(names).size).toBe(2);
    expect(names).toContain("story/leaf-1");
  });
});

describe("COLLECTING IS MEASURED, not declared", () => {
  test("code-producing descendants are counted through intermediate rungs", () => {
    const c = chain([WorkType.Task, WorkType.Defect]);
    expect(codeProducingUnder(c, "proj-1")).toBe(2);
    // Counted over DESCENDANTS: the initiative's only child is a project, which produces no code
    // itself, yet two commits sit under it.
    expect(codeProducingUnder(c, "init-1")).toBe(2);
    expect(codeProducingUnder(c, "leaf-1")).toBe(0);
  });

  test("items that produce NO code do not count toward collecting", () => {
    // A review and an incident owe no implementation gate, so nothing ever commits to a branch for
    // them. Counting them would give an integration branch to a collection with one commit in it.
    const c = chain([WorkType.Task, WorkType.Review, WorkType.Incident]);
    expect(codeProducingUnder(c, "proj-1")).toBe(1);
    expect(collects(c, c.nodes.find((n) => n.workId === "proj-1") as CascadeNode)).toBe(false);
  });

  test("one code item does not collect; two do", () => {
    const one = chain([WorkType.Defect]);
    const two = chain([WorkType.Defect, WorkType.Task]);
    const proj = (c: Cascade) => c.nodes.find((n) => n.workId === "proj-1") as CascadeNode;
    expect(collects(one, proj(one))).toBe(false);
    expect(collects(two, proj(two))).toBe(true);
  });

  test("descendantsOf and ancestorsOf survive a cycle in folded data", () => {
    // A cascade folded from an append-only log is DATA. A parent edge that cycles must fail the
    // question, never hang the run.
    const cyclic: Cascade = {
      nodes: [node("a", WorkType.Project, "b"), node("b", WorkType.Project, "a")],
    };
    expect(descendantsOf(cyclic, "a").map((n) => n.workId)).toEqual(["b"]);
    expect(ancestorsOf(cyclic, "a").map((n) => n.workId)).toEqual(["b"]);
  });
});

describe("THE TWO CASES THAT MATTER", () => {
  test("A LONE DEFECT GOES STRAIGHT TO THE TRUNK — no feature branch, no ceremony", () => {
    // The case the whole module is shaped around. The defect owns a project, an initiative and a
    // goal, because that is what decomposition does to every request — and none of them collect
    // anything, so none of them earns a branch.
    const c = chain([WorkType.Defect], { requestRef: externalRefOf("jira", "AIAGENT-1637") });
    const plan = branchPlanFor({ cascade: c, workId: "leaf-1", trunk: "main" });
    if (!isBranchPlan(plan)) throw new Error(plan.reason);

    expect(plan.branch).toBe("defect/AIAGENT-1637");
    expect(plan.base).toBe("main");
    expect(plan.integration).toBeUndefined();
  });

  test("A FEATURE'S STORIES MERGE INTO THE FEATURE, and the feature into the trunk", () => {
    const c: Cascade = {
      nodes: [
        node("goal-1", WorkType.Goal),
        node("init-1", WorkType.Initiative, "goal-1"),
        node("proj-1", WorkType.Project, "init-1", { requestRef: externalRefOf("jira", "AIAGENT-1519") }),
        node("leaf-1", WorkType.Task, "proj-1", { requestRef: externalRefOf("jira", "AIAGENT-1520") }),
        node("leaf-2", WorkType.Task, "proj-1", { requestRef: externalRefOf("jira", "AIAGENT-1521") }),
      ],
    };

    const story = branchPlanFor({ cascade: c, workId: "leaf-1", trunk: "main" });
    if (!isBranchPlan(story)) throw new Error(story.reason);
    expect(story.branch).toBe("story/AIAGENT-1520");
    // …based on the FEATURE, not on the trunk.
    expect(story.base).toBe("feature/AIAGENT-1519");
    expect(story.integration).toEqual({ workId: "proj-1", branch: "feature/AIAGENT-1519", base: "main" });

    // And asking about the collection itself answers the other half: the feature merges to trunk.
    const feature = branchPlanFor({ cascade: c, workId: "proj-1", trunk: "main" });
    if (!isBranchPlan(feature)) throw new Error(feature.reason);
    expect(feature.branch).toBe("feature/AIAGENT-1519");
    expect(feature.base).toBe("main");
    // The feature IS the integration branch, so it has none of its own.
    expect(feature.integration).toBeUndefined();
  });

  test("A ONE-STORY PROJECT SHARES THE EPIC'S BRANCH — the nesting case, one rule", () => {
    // Two projects under one epic. `proj-1` holds two stories and earns a feature branch;
    // `proj-2` holds one and earns nothing, so its story hangs off the nearest ancestor that DOES
    // collect — the epic. Same single rule, both answers.
    const c: Cascade = {
      nodes: [
        node("goal-1", WorkType.Goal),
        node("init-1", WorkType.Initiative, "goal-1", { requestRef: externalRefOf("jira", "EPIC-1") }),
        node("proj-1", WorkType.Project, "init-1", { requestRef: externalRefOf("jira", "FEAT-1") }),
        node("proj-2", WorkType.Project, "init-1", { requestRef: externalRefOf("jira", "FEAT-2") }),
        node("leaf-1", WorkType.Task, "proj-1", { requestRef: externalRefOf("jira", "S-1") }),
        node("leaf-2", WorkType.Task, "proj-1", { requestRef: externalRefOf("jira", "S-2") }),
        node("leaf-3", WorkType.Task, "proj-2", { requestRef: externalRefOf("jira", "S-3") }),
      ],
    };

    const inFeature = branchPlanFor({ cascade: c, workId: "leaf-1", trunk: "main" });
    if (!isBranchPlan(inFeature)) throw new Error(inFeature.reason);
    expect(inFeature.branch).toBe("story/S-1");
    expect(inFeature.base).toBe("feature/FEAT-1");
    expect(inFeature.integration).toEqual({ workId: "proj-1", branch: "feature/FEAT-1", base: "main" });

    const orphan = branchPlanFor({ cascade: c, workId: "leaf-3", trunk: "main" });
    if (!isBranchPlan(orphan)) throw new Error(orphan.reason);
    expect(orphan.base).toBe("epic/EPIC-1");
    expect(orphan.integration).toEqual({ workId: "init-1", branch: "epic/EPIC-1", base: "main" });
  });

  test("A REQUEST NEVER GETS MORE THAN ONE INTEGRATION BRANCH", () => {
    // THE REGRESSION THIS PINS, and it is the mistake the first cut actually made. Decomposition
    // gives every request a goal, an initiative AND a project. With three stories all three
    // ancestors hold three code items, so a rule that took every collecting ancestor produced
    // THREE integration branches and six extra merges to deliver three commits.
    //
    // Asserted over every leaf rather than one, because "the nearest" has to be nearest for each.
    const c: Cascade = {
      nodes: [
        node("goal-1", WorkType.Goal),
        node("init-1", WorkType.Initiative, "goal-1"),
        node("proj-1", WorkType.Project, "init-1"),
        node("leaf-1", WorkType.Task, "proj-1"),
        node("leaf-2", WorkType.Task, "proj-1"),
        node("leaf-3", WorkType.Task, "proj-1"),
      ],
    };

    // Every ancestor genuinely collects — this is the condition that produced the stack.
    for (const id of ["goal-1", "init-1", "proj-1"]) {
      expect(codeProducingUnder(c, id)).toBe(3);
    }

    const branches = new Set<string>();
    for (const id of ["leaf-1", "leaf-2", "leaf-3"]) {
      const plan = branchPlanFor({ cascade: c, workId: id, trunk: "main" });
      if (!isBranchPlan(plan)) throw new Error(plan.reason);
      // …and yet each story names exactly one, the nearest.
      expect(plan.integration?.workId).toBe("proj-1");
      expect(plan.integration?.base).toBe("main");
      expect(plan.base).toBe(plan.integration?.branch as string);
      branches.add(plan.integration?.branch as string);
    }
    expect(branches.size).toBe(1);
  });

  test("the integration branch is cut from the TRUNK, and the change from it", () => {
    // The contract a caller relies on: create `integration` from `integration.base`, then the
    // change from `plan.base`. A gap between those two would mean branching from something absent.
    const c: Cascade = {
      nodes: [
        node("goal-1", WorkType.Goal),
        node("init-1", WorkType.Initiative, "goal-1"),
        node("proj-1", WorkType.Project, "init-1"),
        node("leaf-1", WorkType.Task, "proj-1"),
        node("leaf-2", WorkType.Task, "proj-1"),
      ],
    };
    const plan = branchPlanFor({ cascade: c, workId: "leaf-1", trunk: "trunk" });
    if (!isBranchPlan(plan)) throw new Error(plan.reason);
    expect(plan.integration?.base).toBe("trunk");
    expect(plan.base).toBe(plan.integration?.branch as string);
    // …and the change's own branch is not the integration branch, or the merge would be a no-op.
    expect(plan.branch).not.toBe(plan.base);
  });
});

describe("the refusals", () => {
  test("an unknown work item is refused, not defaulted onto the trunk", () => {
    const plan = branchPlanFor({ cascade: chain([WorkType.Task]), workId: "nope", trunk: "main" });
    expect(isBranchPlan(plan)).toBe(false);
    expect((plan as { reason: string }).reason).toContain("nope");
  });

  test("NO TRUNK IS A REFUSAL — an empty string would branch from nothing", () => {
    const plan = branchPlanFor({ cascade: chain([WorkType.Task]), workId: "leaf-1", trunk: "  " });
    expect(isBranchPlan(plan)).toBe(false);
  });
});
