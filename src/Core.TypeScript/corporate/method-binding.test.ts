/**
 * method-binding.test.ts — the surface answers HOW, and answers it as an offer.
 *
 * ── WHAT THIS SEAM IS FOR ────────────────────────────────────────────────────
 * `observe` already answered two questions: what may I do (the verbs) and what am I looking at (the
 * openings, the context pack). It answered a third badly — HOW to do any of it. Before this,
 * `grep -i skill` against `observe.ts` returned nothing, and method reached an agent only as an
 * environment variable on the command adapter, resolved per GATE. An agent choosing to ask a
 * question was told it may ask and never told what a good question looks like, so it asked one
 * shallow one, got a shallow answer, and proceeded on it.
 *
 * ── THE TWO PROPERTIES ───────────────────────────────────────────────────────
 * 1. THE CORE NEVER RESOLVES A METHOD. `skillId` is opaque, exactly as `MissingInformation.kind`
 *    is opaque — whether a method exists and what it says is not a fact this grammar contains. An
 *    enum here would be the core deciding what good practice is, which is the hardcoding the seam
 *    exists to avoid.
 * 2. ABSENT IS THE NORMAL CASE. No method means the verb is taken the way it always was. A
 *    standalone agent with no organization behind it must see exactly the surface it always saw.
 */

import { describe, expect, test } from "bun:test";
import { methodFor, type Method, type World } from "../observe/observe";
import { ACTION_KINDS, ACTION_RECONCILIATION } from "../observe/action-reconciliation";

const GRILL: Method = {
  kind: "request_information",
  skillId: "requirement-grilling",
  why: "a single shallow question gets a shallow answer and the work proceeds on it",
};

describe("A METHOD IS AN OFFER ATTACHED TO A VERB", () => {
  test("the method for a verb comes back", () => {
    expect(methodFor([GRILL], "request_information")?.skillId).toBe("requirement-grilling");
  });

  test("a verb with no method gets undefined, not a default", () => {
    // A default method would be the core having an opinion about how to do something, which is
    // precisely what this seam refuses to hold.
    expect(methodFor([GRILL], "raise_to_human")).toBeUndefined();
  });

  test("no methods at all is undefined for everything", () => {
    expect(methodFor(undefined, "request_information")).toBeUndefined();
    expect(methodFor([], "request_information")).toBeUndefined();
  });

  test("FIRST MATCH WINS, and the order is the register's", () => {
    // Two methods for one verb is a configuration somebody should see, not a merge this function
    // performs quietly — a silently merged pair would produce guidance nobody wrote.
    const second: Method = { ...GRILL, skillId: "something-else" };
    expect(methodFor([GRILL, second], "request_information")?.skillId).toBe("requirement-grilling");
  });

  test("the id is OPAQUE — nothing here validates or resolves it", () => {
    // The core must be able to carry a method it has never heard of, or a register cannot ship one
    // without changing the grammar.
    const invented: Method = { kind: "review_artifact", skillId: "a-skill-that-does-not-exist", why: "because" };
    expect(methodFor([invented], "review_artifact")?.skillId).toBe("a-skill-that-does-not-exist");
  });
});

describe("A METHOD ON A VERB THAT DOES NOT EXIST IS OFFERED TO NOBODY", () => {
  test("every kind the CLI accepts is a real action kind", () => {
    // The roster is DERIVED from the reconciliation table rather than written beside it. A second
    // hand-kept list drifts, and the way it shows up is a verb that exists and cannot be
    // configured — or a configuration accepted for a verb that does not.
    expect(ACTION_KINDS.length).toBe(Object.keys(ACTION_RECONCILIATION).length);
    expect(ACTION_KINDS).toContain("request_information");
    expect(ACTION_KINDS).toContain("raise_to_human");
    expect(ACTION_KINDS).not.toContain("reqest_information");
  });

  test("the roster is not empty — an empty one would accept nothing and report nothing", () => {
    expect(ACTION_KINDS.length).toBeGreaterThan(20);
  });
});

describe("THE SURFACE CARRIES IT WITHOUT CHANGING WHAT A VERB IS", () => {
  const world = (over: Partial<World> = {}): World => ({ backlog: [], ...over }) as World;

  test("a world with methods still has its ordinary shape", () => {
    const w = world({ methods: [GRILL] });
    expect(w.methods).toHaveLength(1);
    expect(w.backlog).toEqual([]);
  });

  test("a world with NO methods is the shape every existing caller already passes", () => {
    // The regression this guards: making `methods` required would make every standalone agent's
    // world invalid, which is how an optional seam becomes a new obligation.
    const w = world();
    expect(w.methods).toBeUndefined();
    expect(methodFor(w.methods, "request_information")).toBeUndefined();
  });
});
