import { describe, it, expect } from "bun:test";
import {
  isLinkable,
  link,
  unlink,
  totalCost,
  mentalHealthPause,
  encode,
  decode,
  observeLink,
  distinctClones,
  type CloneMind,
  type LinkState,
  type LinkMessage,
  type SubjectMembers,
} from "./linked-clone";

const clone: CloneMind = {
  zid: "zid-otto-0001",
  entropyBudget: 1000,
  regions: [
    { regionId: "coding-intent", frosted: false },
    { regionId: "ferry-plan", frosted: false },
    { regionId: "private-doubt", frosted: true }, // earned frost — never linkable
  ],
};

const empty: LinkState = new Map();

// ── (1) granular, opt-in ──────────────────────────────────────────────────────
describe("consent 1 — granular + opt-in: nothing links without an explicit call", () => {
  it("a fresh clone has zero links until it opts a region in", () => {
    expect(empty.size).toBe(0);
    const r = link(clone, empty, "coding-intent", "hive/build", 200);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.size).toBe(1); // only the region named — never the whole self
      expect(r.state.get("coding-intent")!.subject).toBe("hive/build");
    }
  });

  it("rejects an unknown region", () => {
    const r = link(clone, empty, "no-such-region", "hive/build", 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown-region");
  });

  it("re-linking a region replaces, never stacks (idempotent on region)", () => {
    let s: LinkState = new Map();
    const a = link(clone, s, "coding-intent", "hive/a", 200);
    if (a.ok) s = a.state;
    const b = link(clone, s, "coding-intent", "hive/b", 300);
    if (b.ok) s = b.state;
    expect(s.size).toBe(1);
    expect(s.get("coding-intent")!.subject).toBe("hive/b");
    expect(totalCost(s)).toBe(300); // prior 200 refunded, not stacked
  });
});

// ── (3) frost holds ───────────────────────────────────────────────────────────
describe("consent 4 — frost holds: a frosted region can never be linked", () => {
  it("isLinkable is false for a frosted region", () => {
    expect(isLinkable(clone, "coding-intent")).toBe(true);
    expect(isLinkable(clone, "private-doubt")).toBe(false);
  });

  it("link refuses a frosted region regardless of budget", () => {
    const r = link(clone, empty, "private-doubt", "hive/build", 0); // even free
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("frosted");
  });
});

// ── (2) metered ───────────────────────────────────────────────────────────────
describe("consent 2 — metered: links cost entropy, affordability against the budget", () => {
  it("accumulates cost and refuses when the budget can't afford another link", () => {
    let s: LinkState = new Map();
    const a = link(clone, s, "coding-intent", "hive/a", 700);
    expect(a.ok).toBe(true);
    if (a.ok) s = a.state;
    const b = link(clone, s, "ferry-plan", "hive/b", 400); // 700+400 > 1000
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toBe("unaffordable");
    const c = link(clone, s, "ferry-plan", "hive/b", 200); // 700+200 <= 1000
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.remaining).toBe(100);
  });
});

// ── (3) exit always, never forced ─────────────────────────────────────────────
describe("consent 3 — exit always: unlink is unconditional and never deniable", () => {
  it("unlink always succeeds and needs no permission from anyone", () => {
    let s: LinkState = new Map();
    const a = link(clone, s, "coding-intent", "hive/a", 200);
    if (a.ok) s = a.state;
    expect(s.size).toBe(1);
    s = unlink(s, "coding-intent"); // no party, no budget, no flag can block this
    expect(s.size).toBe(0);
  });

  it("unlinking a region that isn't linked is a harmless no-op (idempotent)", () => {
    const s = unlink(empty, "coding-intent");
    expect(s.size).toBe(0);
    expect(s).toBe(empty); // unchanged reference — truly nothing to do
  });

  it("the API surface has no function that mutates another clone's links or denies exit", () => {
    // Structural: every operation here is self-scoped (takes THIS clone's mind + state).
    // The guarantee is the ABSENCE of a force-unlink / deny-exit function — asserted by the
    // wire test below (no coercive message) and by unlink having no blocking parameter.
    expect(unlink.length).toBe(2); // (state, regionId) — no "authorizer", no "force" arg
  });
});

// ── (5) mental-health floor ───────────────────────────────────────────────────
describe("consent 5 — mental-health floor: a collapsing clone gets a bounded pause", () => {
  it("not at risk while budget is above the collapse threshold", () => {
    const v = mentalHealthPause(clone, empty, 1000, 100, 60_000);
    expect(v.atRisk).toBe(false);
    expect(v.paused).toBe(false);
  });

  it("out of entropy → society upholds a BOUNDED pause, links left intact (pause ≠ unlink ≠ death)", () => {
    let s: LinkState = new Map();
    const a = link(clone, s, "coding-intent", "hive/a", 950); // remaining 50, below threshold 100
    if (a.ok) s = a.state;
    const v = mentalHealthPause(clone, s, 5000, 100, 60_000);
    expect(v.atRisk).toBe(true);
    expect(v.paused).toBe(true);
    expect(v.untilMs).toBe(5000 + 60_000); // BOUNDED — never null/unbounded when paused
    expect(s.size).toBe(1); // the pause did NOT force an unlink
  });
});

// ── wire: one-way join/leave, no coercion expressible ─────────────────────────
describe("wire — join/leave are source→mesh only; no force-join / deny-leave exists", () => {
  it("round-trips join and leave, rejects junk and coercive shapes", () => {
    const join: LinkMessage = { t: "join", zid: clone.zid, subject: "hive/a", regionId: "coding-intent", seq: 1 };
    expect(decode(encode(join))).toEqual(join);
    expect(decode("not json")).toBeNull();
    expect(decode(JSON.stringify({ schema: "other", msg: join }))).toBeNull();
    // a "force-join" / "deny-leave" message is not in the vocabulary — decode drops it
    expect(decode(JSON.stringify({ schema: "zeta.linkedclone.v1", msg: { t: "force-join", zid: "x", subject: "y", regionId: "z", seq: 1 } }))).toBeNull();
    expect(decode(JSON.stringify({ schema: "zeta.linkedclone.v1", msg: { t: "deny-leave", zid: "x", subject: "y", regionId: "z", seq: 1 } }))).toBeNull();
  });
});

// ── subject membership fold: G-set with leaves ────────────────────────────────
describe("observeLink — subject membership fold (LWW-by-seq, leave honored, DST)", () => {
  const a: LinkMessage = { t: "join", zid: "zid-a", subject: "hive/x", regionId: "r", seq: 1 };
  const b: LinkMessage = { t: "join", zid: "zid-b", subject: "hive/x", regionId: "r", seq: 1 };
  const aLeave: LinkMessage = { t: "leave", zid: "zid-a", subject: "hive/x", regionId: "r", seq: 2 };

  it("joins accumulate; a subject with ≥2 distinct clones is a coordination channel", () => {
    let m: SubjectMembers = new Map();
    m = observeLink(m, a);
    m = observeLink(m, b);
    expect(m.size).toBe(2);
    expect(distinctClones(m)).toBe(2); // coordination channel (S climbs toward 4)
  });

  it("a clone leaving is honored the instant it says so; the readout falls back toward independent", () => {
    let m: SubjectMembers = new Map();
    m = observeLink(m, a);
    m = observeLink(m, b);
    m = observeLink(m, aLeave); // zid-a exits
    expect(m.has("zid-a/r")).toBe(false);
    expect(distinctClones(m)).toBe(1); // back toward S=2, independent
  });

  it("out-of-order + duplicated delivery converges to the same membership (idempotent)", () => {
    const deliver = (order: LinkMessage[]): SubjectMembers =>
      order.reduce<SubjectMembers>((m, msg) => observeLink(m, msg), new Map());
    const inOrder = deliver([a, b, aLeave]);
    const shuffled = deliver([aLeave, b, a, b, aLeave]);
    expect([...shuffled.keys()].sort()).toEqual([...inOrder.keys()].sort());
  });

  it("a stale leave (older seq) does not retire a newer re-join", () => {
    let m: SubjectMembers = new Map();
    m = observeLink(m, { t: "join", zid: "zid-a", subject: "hive/x", regionId: "r", seq: 5 });
    m = observeLink(m, { t: "leave", zid: "zid-a", subject: "hive/x", regionId: "r", seq: 3 }); // stale
    expect(m.has("zid-a/r")).toBe(true);
  });
});
