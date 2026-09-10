/**
 * human-blocker.test.ts — the way out, and the lock on it.
 *
 * Two failures are possible here and they pull in opposite directions, so both are pinned:
 *
 *   - THE HATCH IS WELDED SHUT. An agent that genuinely cannot get an answer from anyone in the
 *     organization has to guess or go quiet, and the guess arrives at a gate as somebody else's
 *     problem. Half of this file is about the raise actually leaving.
 *   - THE HATCH IS FREE. Asking a person is cheaper than exhausting the organization, so an
 *     unchecked claim of "nobody here can help" eventually carries everything and the org becomes a
 *     queue with a human at the end. The other half is about the claim being checked.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path/posix";

import {
  acceptBlocker,
  acceptExhaustion,
  answerFor,
  answeredBlockers,
  blockerEvent,
  exhaustionHolds,
  openBlockers,
  type RaisedBlocker,
} from "./human-blocker";
import { BlockerKind } from "./blocker-taxonomy";
import { acceptAction, HumanActionKind, type HumanAction } from "./human-action";
import { buildOrgChart, type OrgHat } from "./org-chart";
import { Department, SEED_HATS } from "./org-seed";

const fullChart = (() => {
  const r = buildOrgChart(SEED_HATS);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

/** A three-hat company: it can write code and it has nobody for a credential question. */
const smallChart = (() => {
  const hats: OrgHat[] = [
    { id: "ceo", name: "CEO", level: "c_suite", departmentId: Department.ExecutiveBoardAndGovernance },
    {
      id: "engineering_manager",
      name: "Engineering Manager",
      level: "manager",
      departmentId: Department.Engineering,
      reportsTo: "ceo",
    },
    {
      id: "backend_implementer",
      name: "Backend Implementer",
      level: "individual_contributor",
      departmentId: Department.Engineering,
      reportsTo: "engineering_manager",
    },
  ];
  const r = buildOrgChart(hats);
  if (!r.ok) throw new Error(r.reason);
  return r.chart;
})();

const goodRaise = {
  about: "which Okta scope the archival job may request",
  blocking: "task-011",
  kind: BlockerKind.SecurityBlocked,
  exhaustion: { kind: "no_owner_in_org", forBlockerKind: BlockerKind.SecurityBlocked },
  unblocks: "the archival job can be wired and the gate chain can run",
  byHatId: "backend_implementer",
  atMs: 1000,
};

const take = (raw: unknown): RaisedBlocker => {
  const r = acceptBlocker(raw);
  if (!r.ok) throw new Error(`expected accepted: ${r.reason}`);
  return r.blocker;
};

const answer = (blockerId: string, atMs: number, text: string): HumanAction => {
  const r = acceptAction({
    kind: HumanActionKind.AnswerBlocker,
    byHuman: "max",
    subjectId: blockerId,
    reason: "I own the Okta tenant",
    atMs,
    detail: { answer: text },
  });
  if (!r.ok) throw new Error(r.reason);
  return r.action;
};

describe("THE LOCK — a claim of exhaustion that cannot be checked is refused", () => {
  test("'they could not help' naming NOBODY is refused", () => {
    // The whole hatch turns on this one. An exhaustion that names no hat costs nothing to assert
    // and cannot be checked by anyone, which is a check that cannot fail wearing the shape of
    // diligence. If this ever passes, every blocker can reach a person for free.
    const r = acceptExhaustion({ kind: "owners_could_not_resolve", askedHatIds: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("askedHatIds");
  });

  test("...and the same claim naming somebody is accepted — the refusal is not blanket", () => {
    const r = acceptExhaustion({ kind: "owners_could_not_resolve", askedHatIds: ["security_engineer"] });
    expect(r.ok).toBe(true);
  });

  test("blank strings do not count as names", () => {
    const r = acceptExhaustion({ kind: "owners_could_not_resolve", askedHatIds: ["", "   "] });
    expect(r.ok).toBe(false);
  });

  test("an unknown way of running out is refused rather than coerced to one of the three", () => {
    const r = acceptExhaustion({ kind: "i_would_rather_ask_a_person" });
    expect(r.ok).toBe(false);
  });

  test("each of the three needs its own field", () => {
    expect(acceptExhaustion({ kind: "no_owner_in_org" }).ok).toBe(false);
    expect(acceptExhaustion({ kind: "outside_org_authority" }).ok).toBe(false);
  });
});

describe("A BLOCKER A PERSON CANNOT ACT ON IS REFUSED AT THE DOOR", () => {
  test("the well-formed one is accepted", () => {
    const b = take(goodRaise);
    expect(b.byHatId).toBe("backend_implementer");
    expect(b.blocking).toBe("task-011");
  });

  test("blocking nothing is an opinion, not a blocker", () => {
    const r = acceptBlocker({ ...goodRaise, blocking: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("blocking");
  });

  test("no `unblocks` is refused — an ask with no stated payoff cannot be prioritised", () => {
    const r = acceptBlocker({ ...goodRaise, unblocks: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("unblocks");
  });

  test("no `byHatId` is refused — a person answering has to know who is stuck", () => {
    expect(acceptBlocker({ ...goodRaise, byHatId: "" }).ok).toBe(false);
  });

  test("the exhaustion's refusal travels out verbatim, so the agent is told what is wrong", () => {
    const r = acceptBlocker({ ...goodRaise, exhaustion: { kind: "owners_could_not_resolve", askedHatIds: [] } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("askedHatIds");
  });

  test("THE SAME STOPPAGE IS ONE BLOCKER, not one per tick", () => {
    // A stuck agent stays stuck, so it raises this every tick until somebody answers. The derived
    // id is what turns that into one entry in a person's queue.
    expect(take(goodRaise).blockerId).toBe(take({ ...goodRaise, atMs: 99999 }).blockerId);
    expect(take(goodRaise).blockerId).not.toBe(take({ ...goodRaise, blocking: "task-013" }).blockerId);
  });

  test("the id cannot climb out of the outbox directory", () => {
    // CONTAINMENT, not the absence of dots. `..` with no separator either side is an ordinary
    // filename fragment and traverses nothing — asserting on the dots would fail on safe code,
    // which is a test that fails for a reason unrelated to the property it is protecting.
    const b = take({ ...goodRaise, blocking: "../../etc/passwd" });
    expect(b.blockerId).not.toContain("/");
    expect(b.blockerId).not.toContain("\\");
    expect(join("/outbox", `${b.blockerId}.json`).startsWith("/outbox")).toBe(true);
  });

  test("the reason a person reads is rendered at raise time, from the exhaustion", () => {
    expect(take(goodRaise).why).toContain("nobody here holds");
    expect(
      take({ ...goodRaise, exhaustion: { kind: "owners_could_not_resolve", askedHatIds: ["security_engineer"] } }).why,
    ).toContain("security_engineer");
    expect(
      take({ ...goodRaise, exhaustion: { kind: "outside_org_authority", what: "the customer's retention policy" } })
        .why,
    ).toContain("not this organization's to decide");
  });
});

describe("THE CHART IS CONSULTED — you may not leave past somebody who could have answered", () => {
  test("'nobody here holds security' is REFUSED by a chart that holds security", () => {
    const held = exhaustionHolds(fullChart, {
      kind: "no_owner_in_org",
      forBlockerKind: BlockerKind.SecurityBlocked,
    });
    expect(held.holds).toBe(false);
    // AND IT NAMES THE HAT. A refusal that leaves the agent nowhere to go is a locked door, not a
    // guard — the agent has to come out of this knowing who to ask.
    if (!held.holds) expect(held.reason).toContain("security_engineer");
  });

  test("...and is ACCEPTED, checked, by a chart that genuinely has nobody", () => {
    const held = exhaustionHolds(smallChart, {
      kind: "no_owner_in_org",
      forBlockerKind: BlockerKind.SecurityBlocked,
    });
    expect(held.holds).toBe(true);
    if (held.holds) expect(held.checked).toBe(true);
  });

  test("claiming you asked a hat that does not exist is refused", () => {
    const held = exhaustionHolds(smallChart, {
      kind: "owners_could_not_resolve",
      askedHatIds: ["security_engineer"],
    });
    expect(held.holds).toBe(false);
  });

  test("naming hats that DO exist holds, and is checked", () => {
    const held = exhaustionHolds(smallChart, {
      kind: "owners_could_not_resolve",
      askedHatIds: ["engineering_manager"],
    });
    expect(held.holds).toBe(true);
    if (held.holds) expect(held.checked).toBe(true);
  });

  test("AN UNCHECKED BRANCH SAYS SO rather than passing quietly", () => {
    // Whether a decision belongs to this organization is not a fact its own chart contains, so a
    // check that returned `checked: true` here would be a check that cannot fail. The honest answer
    // is that it went through unverified, and the caller is told.
    const held = exhaustionHolds(fullChart, { kind: "outside_org_authority", what: "the customer's budget" });
    expect(held.holds).toBe(true);
    if (held.holds) expect(held.checked).toBe(false);
  });

  test("an unclassifiable kind is unverifiable, not false", () => {
    // Refusing here would push agents toward the unchecked branch to get through, which is the
    // wrong incentive: it would make the honest classification the expensive one.
    const held = exhaustionHolds(fullChart, { kind: "no_owner_in_org", forBlockerKind: "vibes" });
    expect(held.holds).toBe(true);
    if (held.holds) expect(held.checked).toBe(false);
  });
});

describe("A RAISE WITH NO REPLY PATH IS WORSE THAN NOT ASKING", () => {
  const raised = [take(goodRaise), take({ ...goodRaise, blocking: "task-013", atMs: 1100 })];

  test("with nobody answering, both are open", () => {
    expect(openBlockers(raised, []).length).toBe(2);
  });

  test("an answer closes ITS OWN blocker and no other", () => {
    const open = openBlockers(raised, [answer(raised[0]!.blockerId, 2000, "request read-only, not read-write")]);
    expect(open.map((b) => b.blocking)).toEqual(["task-013"]);
  });

  test("the answer travels WITH the blocker, so the agent gets the text and not just a release", () => {
    const done = answeredBlockers(raised, [answer(raised[0]!.blockerId, 2000, "request read-only, not read-write")]);
    expect(done.length).toBe(1);
    expect(done[0]!.answer.detail?.["answer"]).toBe("request read-only, not read-write");
  });

  test("LAST WORD WINS — a person who answers twice has changed their mind", () => {
    const found = answerFor(raised[0]!.blockerId, [
      answer(raised[0]!.blockerId, 3000, "second thoughts: read-write"),
      answer(raised[0]!.blockerId, 2000, "read-only"),
    ]);
    // Ordered by the action's own clock, never by the order the queue happened to be read in.
    expect(found?.detail?.["answer"]).toBe("second thoughts: read-write");
  });

  test("an answer with no answer in it is refused, so nobody is released on an empty string", () => {
    const r = acceptAction({
      kind: HumanActionKind.AnswerBlocker,
      byHuman: "max",
      subjectId: "hb-1",
      reason: "looked at it",
      atMs: 1,
      detail: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("detail.answer");
  });

  test("an unrelated action does not release a blocker", () => {
    const other = acceptAction({
      kind: HumanActionKind.ApproveGate,
      byHuman: "max",
      subjectId: raised[0]!.blockerId,
      reason: "looks fine",
      atMs: 2000,
      detail: { gate: "brd_approval" },
    });
    if (!other.ok) throw new Error(other.reason);
    expect(openBlockers(raised, [other.action]).length).toBe(2);
  });
});

describe("the raise lands in the one log everything else lands in", () => {
  test("it names the stopped work as its subject and carries the blocker as evidence", () => {
    const e = blockerEvent(take(goodRaise), "e-1");
    expect(e.subjectId).toBe("task-011");
    expect(e.evidenceRefs.some((r) => r.startsWith("human-blocker/"))).toBe(true);
    expect(e.decision).toContain("raised to a person");
  });
});
