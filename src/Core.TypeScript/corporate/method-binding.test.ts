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
import { methodFor, renderAction, type Method, type NextAction, type World } from "../observe/observe";
import { tick, type DriveDeps, type DriveState } from "./org-drive";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { DEFAULT_METHODS, methodsFor } from "./method-defaults";
import { EMPTY_BOARD } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
import { ACTION_KINDS, ACTION_RECONCILIATION } from "../observe/action-reconciliation";

const built = buildOrgChart(SEED_HATS);
if (!built.ok) throw new Error(built.reason);
const CHART = built.chart;

/**
 * The smallest drive state `tick` accepts — the same shape `org-drive.test.ts` builds.
 *
 * Hand-rolling a narrower one omitted `signals` and `board`, and the failure was a TypeError inside
 * the bridge rather than a wrong answer: a fixture that cannot reach the code is not a lighter
 * fixture, it is a test that proves nothing about it.
 */
const driveState = (): DriveState =>
  ({
    view: { chart: CHART, board: EMPTY_BOARD, signals: [], cascade: [], artifacts: new Map() },
    cascade: { nodes: [] },
    calendar: EMPTY_CALENDAR,
  }) as unknown as DriveState;

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

describe("AND THE AGENT ACTUALLY SEES IT — the chain, end to end", () => {
  // ── WHY THIS DESCRIBE EXISTS ───────────────────────────────────────────────
  // The seam was built and left UNCONNECTED: `org method bind` wrote the record, the type carried
  // it, `orgSurfaceFor` would pass it through — and the only production caller never passed it,
  // and nothing read `methodFor` at all. Every unit test above passed the whole time. These are
  // the joins, and each one is the thing a unit test cannot see.

  test("renderAction SAYS the method beside the verb it applies to", () => {
    // The one function that turns a verb into text an agent reads. A method the rendering never
    // mentions is a method no agent ever sees — the surface would know how and never say so.
    const action = { kind: "request_information", about: "the expiry policy", blocking: "task-1" } as unknown as NextAction;
    const line = renderAction(action, [GRILL]);
    expect(line).toContain("requirement-grilling");
    expect(line).toContain("how:");
  });

  test("...and says nothing extra when no method applies", () => {
    const action = { kind: "request_information", about: "x", blocking: "y" } as unknown as NextAction;
    expect(renderAction(action, [])).toBe(renderAction(action));
    expect(renderAction(action)).not.toContain("how:");
  });

  test("a method for ANOTHER verb does not leak onto this one", () => {
    const action = { kind: "raise_to_human", reason: "legal" } as unknown as NextAction;
    expect(renderAction(action, [GRILL])).not.toContain("requirement-grilling");
  });

  test("the DRIVE hands the methods to the chooser", () => {
    // A model-backed chooser builds its own prompt; if the drive does not hand it the methods, the
    // model never learns them however well the rendering behaves.
    const seen: (readonly Method[] | undefined)[] = [];
    const deps = {
      chart: CHART,
      nowMs: 0,
      createId: (p: string) => `${p}-1`,
      resourceAuthorityHatId: "rmo_office",
      methods: [GRILL],
      choose: (menu: readonly NextAction[], _hatId: string, methods?: readonly Method[]) => {
        seen.push(methods);
        return menu[0];
      },
    } as unknown as DriveDeps;

    tick(driveState(), "backend_implementer", deps);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual([GRILL]);
  });

  test("a drive that says nothing gets the REGISTER'S DEFAULTS, not silence", () => {
    // This test asserted the opposite an hour ago, and the opposite was wrong. Making an operator
    // bind the basics before their organization asks a decent question is a cost paid by everyone
    // who did not know the knob existed, for a flexibility almost none of them wanted. Saying
    // nothing now means "use the register's judgement".
    const seen: (readonly Method[] | undefined)[] = [];
    const deps = {
      chart: CHART,
      nowMs: 0,
      createId: (p: string) => `${p}-1`,
      resourceAuthorityHatId: "rmo_office",
      choose: (menu: readonly NextAction[], _hatId: string, methods?: readonly Method[]) => {
        seen.push(methods);
        return menu[0];
      },
    } as unknown as DriveDeps;

    tick(driveState(), "backend_implementer", deps);
    expect(seen[0]).toEqual(DEFAULT_METHODS);
    expect(seen[0]?.some((m) => m.kind === "request_information")).toBe(true);
  });

  test("...and an EXPLICIT empty list is how you say none", () => {
    // A default that cannot be turned off is a mandate. Passing `[]` is the difference between "I
    // have not thought about it" and "I have, and the answer is no method here".
    const seen: (readonly Method[] | undefined)[] = [];
    const deps = {
      chart: CHART,
      nowMs: 0,
      createId: (p: string) => `${p}-1`,
      resourceAuthorityHatId: "rmo_office",
      methods: [],
      choose: (menu: readonly NextAction[], _hatId: string, methods?: readonly Method[]) => {
        seen.push(methods);
        return menu[0];
      },
    } as unknown as DriveDeps;

    tick(driveState(), "backend_implementer", deps);
    expect(seen[0] ?? []).toEqual([]);
  });
});

describe("THE DEFAULTS ARE THE POINT — you should not have to bind the basics", () => {
  test("an organization that configured NOTHING still interviews requirements", () => {
    const inForce = methodsFor({});
    expect(inForce.some((m) => m.kind === "request_information" && m.skillId === "requirement-grilling")).toBe(true);
  });

  test("a binding REPLACES the default for that verb and leaves the others", () => {
    const inForce = methodsFor({ methods: [{ kind: "request_information", skillId: "our-own-way", why: "house style" }] });
    expect(inForce.find((m) => m.kind === "request_information")?.skillId).toBe("our-own-way");
    expect(inForce.find((m) => m.kind === "draft_business_doc")?.skillId).toBe("requirement-grilling");
  });

  test("binding an EMPTY skill removes the default — a default that cannot be turned off is a mandate", () => {
    const inForce = methodsFor({ methods: [{ kind: "request_information", skillId: "", why: "our BAs run this differently" }] });
    expect(inForce.some((m) => m.kind === "request_information")).toBe(false);
    // …and only that one. Declining one method is not declining all of them.
    expect(inForce.some((m) => m.kind === "draft_business_doc")).toBe(true);
  });

  test("a method for a verb the register has no opinion about is kept", () => {
    const inForce = methodsFor({ methods: [{ kind: "review_artifact", skillId: "house-review", why: "ours" }] });
    expect(inForce.some((m) => m.kind === "review_artifact" && m.skillId === "house-review")).toBe(true);
    expect(inForce.length).toBe(DEFAULT_METHODS.length + 1);
  });

  test("the defaults are NARROW — the register only defaults what it has an earned method for", () => {
    // A default on every verb would be a second hardcoded pipeline wearing a configuration's
    // clothes. Restraint here is what keeps this a default rather than a policy.
    expect(DEFAULT_METHODS.length).toBeGreaterThan(0);
    expect(DEFAULT_METHODS.length).toBeLessThan(5);
    for (const m of DEFAULT_METHODS) expect(m.why.trim()).not.toBe("");
  });
});
