/**
 * raise-to-human.test.ts — the grammar's one verb that addresses somebody outside the chart.
 *
 * `observe.ts` drives every tool and every AI interaction here, so a capability the grammar does
 * not have is one the organization does not have. Until this verb existed an agent that could not
 * get an answer from anyone in the chart had exactly two moves: choose plausibly, or go quiet. Both
 * surface later — at a gate, or in a merge request — as somebody else's problem.
 *
 * What is pinned here is the SHAPE of the exit: that it exists, that it outranks asking the
 * organization again, that it is never gated, that it does not fire while somebody in the chart
 * could still answer, and that having taken it the agent stops taking it.
 */

import { describe, expect, test } from "bun:test";

import { buildMenu, observe, simulate, type HumanBlocker, type World } from "../observe/observe";
import { rowFor } from "../observe/action-reconciliation";
import { effectOf, orgSurfaceFor, unresolvableFor, type OrgView } from "./org-observe-bridge";
import { BlockerKind } from "./blocker-taxonomy";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { EMPTY_BOARD } from "./discussion-anchor";
import { openArtifact, type ArtifactHistory } from "./artifact-deliberation";

const chart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

function artifact(id = "task-1"): ArtifactHistory {
  const r = openArtifact({ artifactId: id, byHatId: "tech_lead", atMs: 1, content: "v1", note: "n" });
  if (!r.ok) throw new Error(r.reason);
  return r.history;
}

function view(over: Partial<OrgView> = {}): OrgView {
  return { chart, board: EMPTY_BOARD, signals: [], cascade: [], artifacts: new Map([["task-1", artifact()]]), ...over };
}

const forPerson: HumanBlocker = {
  blockerId: "hb-1",
  about: "whether we may retain archived sessions past 90 days",
  blocking: "task-011",
  exhaustion: { kind: "outside_org_authority", what: "the customer's retention policy" },
  unblocks: "the archival job's retention window can be set",
};

describe("THE EXIT EXISTS, and it outranks asking the organization again", () => {
  test("with a blocker that has run out of organization, that is the recommendation", () => {
    const next = observe({ backlog: [], unresolvable: [forPerson] });
    expect(next.kind).toBe("raise_to_human");
  });

  test("IT BEATS `request_information` when both are on the table", () => {
    // The ordering is the whole verb. Something in `unresolvable` has ALREADY run out of
    // organization; asking the organization again is the loop it is trying to leave, and an agent
    // that preferred the ask would spin there forever while a person waits to be told.
    const next = observe({
      backlog: [],
      unresolvable: [forPerson],
      missing: [{ about: "which store the port writes to", blocking: "task-2" }],
    });
    expect(next.kind).toBe("raise_to_human");
  });

  test("it does not outrank the operator — a person already talking is not interrupted", () => {
    const next = observe({
      backlog: [],
      unresolvable: [forPerson],
      operator: { pendingMessage: true, pendingFerry: false },
    });
    expect(next.kind).toBe("respond_to_operator");
  });

  test("it does not cancel a chosen free mode — being stuck does not revoke the agent's freedom", () => {
    const next = observe({ backlog: [], unresolvable: [forPerson], mode: "free_time" });
    expect(next.kind).toBe("free_time");
  });

  test("with nothing unresolvable it is not recommended, and not on the menu", () => {
    const world: World = { backlog: [], missing: [{ about: "x", blocking: "task-2" }] };
    expect(observe(world).kind).toBe("request_information");
    expect(buildMenu(world).some((a) => a.kind === "raise_to_human")).toBe(false);
  });

  test("the reason carries WHY it left, so a person is told why their attention is being spent", () => {
    const next = observe({ backlog: [], unresolvable: [forPerson] });
    if (next.kind !== "raise_to_human") throw new Error(`expected a raise, got ${next.kind}`);
    expect(next.reason).toContain("not this organization's to decide");
  });
});

describe("NEVER GATED — a gate on this verb has nobody left to open it", () => {
  test("the reconciliation row says so", () => {
    // The situation this verb is for is the one where the organization has run out of answers.
    // A gate on it would be a gate whose opener is exactly the person who cannot be reached.
    expect(rowFor("raise_to_human").gate).toBe("never_gated");
  });

  test("it is on the menu alongside the free modes, not instead of them", () => {
    const menu = buildMenu({ backlog: [], unresolvable: [forPerson] });
    expect(menu.some((a) => a.kind === "raise_to_human")).toBe(true);
    expect(menu.some((a) => a.kind === "free_time")).toBe(true);
  });
});

describe("HAVING RAISED IT, THE AGENT STOPS RAISING IT", () => {
  test("simulate drops the raised blocker so the next tick is free", () => {
    // Leaving it in place makes the deterministic controller pick the same blocker every tick
    // forever. The agent has nothing left to do with it but wait, and waiting is not a turn.
    const after = simulate({ backlog: [], unresolvable: [forPerson] }, observe({ backlog: [], unresolvable: [forPerson] }));
    expect(after.unresolvable).toEqual([]);
  });

  test("...and only that one", () => {
    const second: HumanBlocker = { ...forPerson, blockerId: "hb-2", blocking: "task-013" };
    const world: World = { backlog: [], unresolvable: [forPerson, second] };
    const after = simulate(world, observe(world));
    expect(after.unresolvable?.map((b) => b.blockerId)).toEqual(["hb-2"]);
  });
});

describe("A BLOCKER LEAVES ONLY WHEN THE ORGANIZATION IS ACTUALLY OUT", () => {
  const secured = view({
    blockers: new Map([
      [
        "backend_implementer",
        [{ about: "which Okta scope the job may request", blocking: "task-1", kind: BlockerKind.SecurityBlocked }],
      ],
    ]),
  });

  test("a credential question does NOT leave a company that has a security engineer", () => {
    // The guard in the other direction, and the one that decides whether this stays useful. If a
    // blocker can leave while somebody in the chart owns it, the org degrades into a queue of
    // questions with a person at the end.
    expect(unresolvableFor(secured, "backend_implementer")).toEqual([]);
  });

  test("...and it is still offered INSIDE, as an ordinary ask", () => {
    expect(orgSurfaceFor(secured, "backend_implementer").missing?.length).toBe(1);
  });

  test("a decision the agent says is nobody's here DOES leave, whatever the taxonomy says", () => {
    // `needsHuman` is the agent's own claim, and it wins over the kind's owner: that owner could
    // take the ask and still not be allowed to answer it.
    const v = view({
      blockers: new Map([
        [
          "backend_implementer",
          [
            {
              about: "the retention window",
              blocking: "task-1",
              kind: BlockerKind.SecurityBlocked,
              needsHuman: "the customer's retention policy",
            },
          ],
        ],
      ]),
    });
    const out = unresolvableFor(v, "backend_implementer");
    expect(out.length).toBe(1);
    expect(out[0]!.exhaustion.kind).toBe("outside_org_authority");
  });

  test("AN ALREADY-RAISED BLOCKER IS NOT OFFERED AGAIN", () => {
    const first = unresolvableFor(view({ blockers: new Map([["backend_implementer", [{ about: "the retention window", blocking: "task-1", needsHuman: "the customer's policy" }]]]) }), "backend_implementer");
    expect(first.length).toBe(1);
    const raised = effectOf(view(), "backend_implementer", { ...first[0]!, kind: "raise_to_human", reason: "r" }, { signalId: "s", anchorId: "a" }, 10, "rmo_office");
    expect(raised.ok).toBe(true);
    if (!raised.ok || raised.effect.kind !== "raise_blocker") throw new Error("expected a raise");
    const again = unresolvableFor(
      view({
        blockers: new Map([["backend_implementer", [{ about: "the retention window", blocking: "task-1", needsHuman: "the customer's policy" }]]]),
        raisedBlockers: [raised.effect.blocker],
      }),
      "backend_implementer",
    );
    // The ids must agree between what the surface offers and what the raise records, or the hat
    // would raise the same thing on every tick for the rest of the run.
    expect(again).toEqual([]);
  });
});

describe("THE ORGANIZATION CHECKS THE CLAIM BEFORE IT SPENDS A PERSON'S ATTENTION", () => {
  test("a raise past a hat that could have answered is REFUSED, and names that hat", () => {
    const r = effectOf(
      view(),
      "backend_implementer",
      {
        kind: "raise_to_human",
        blockerId: "hb-9",
        about: "which Okta scope",
        blocking: "task-1",
        exhaustion: { kind: "no_owner_in_org", forBlockerKind: BlockerKind.SecurityBlocked },
        unblocks: "the job can be wired",
        reason: "r",
      },
      { signalId: "s", anchorId: "a" },
      10,
      "rmo_office",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("security_engineer");
  });

  test("a raise the chart cannot answer becomes an effect addressed OUTSIDE the chart", () => {
    const r = effectOf(
      view(),
      "backend_implementer",
      {
        kind: "raise_to_human",
        blockerId: "hb-9",
        about: "the retention window",
        blocking: "task-1",
        exhaustion: { kind: "outside_org_authority", what: "the customer's retention policy" },
        unblocks: "the retention window can be set",
        reason: "r",
      },
      { signalId: "s", anchorId: "a" },
      10,
      "rmo_office",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // NOT a signal. A signal lands on another hat's surface, which is precisely the thing that has
    // run out — routing this one inward would put it back in the loop it is leaving.
    expect(r.effect.kind).toBe("raise_blocker");
    if (r.effect.kind === "raise_blocker") expect(r.effect.blocker.byHatId).toBe("backend_implementer");
  });
});
