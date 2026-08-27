// oscillation-registry.test.ts — the falsifiers.
//
// The registry's whole value is that it DISTINGUISHES four relations. A binary
// overlap/no-overlap check would pass most of the assertions below while collapsing the two cases
// that matter — `commutes` (overlap that is fine) and `override` (disagreement that is legal once
// declared). So every relation gets a synthetic pair constructed to sit in exactly that class, and
// each test names the implementation it would falsify.
//
// The synthetic healers are deliberately tiny and total. Using the real Tier-0 healers here would
// test them rather than the registry, and they are all `disjoint` today — which is precisely the
// corpus that proves nothing.

import { describe, expect, test } from "bun:test";
import type { FileTree, Healer } from "./healer-harness.ts";
import {
  buildRegistry,
  canonical,
  classifyPair,
  dagHeight,
  isClean,
  renderReport,
  writeSet,
  type DeclaredEdge,
} from "./oscillation-registry.ts";

const tree = (o: Record<string, string>): FileTree => new Map(Object.entries(o));
const corpusOf = (o: Record<string, string>) => [{ name: "c", tree: tree(o) }];

/** Rewrites one path by a string replacement. */
const rewriter = (name: string, path: string, from: string, to: string): Healer => ({
  name,
  heal: (t) => {
    const v = t.get(path);
    if (v === undefined || !v.includes(from)) return t;
    return new Map([...t, [path, v.replaceAll(from, to)]]);
  },
});

describe("disjoint — commutes for a structural reason", () => {
  test("healers touching different files are `disjoint`, not merely `commutes`", () => {
    // The distinction a binary overlap check erases. `disjoint` is the stronger guarantee: the
    // pair CANNOT interact, whatever either does.
    const v = classifyPair(
      rewriter("a", "x.md", "foo", "FOO"),
      rewriter("b", "y.md", "bar", "BAR"),
      corpusOf({ "x.md": "foo", "y.md": "bar" }),
    );
    expect(v.relation).toBe("disjoint");
    expect(v.sharedPaths).toEqual([]);
    expect(v.firedOn).toEqual(["c"]);
  });
});

describe("commutes — overlap that is NOT a defect", () => {
  test("two healers writing the SAME file that agree are `commutes`, not `override`", () => {
    // The case a disjointness assertion would wrongly refuse — and the case a templated rule
    // family produces by construction, since all five *-parity rules would share a write-set.
    const v = classifyPair(
      rewriter("a", "x.md", "foo", "FOO"),
      rewriter("b", "x.md", "bar", "BAR"),
      corpusOf({ "x.md": "foo bar" }),
    );
    expect(v.relation).toBe("commutes");
    expect(v.sharedPaths).toEqual(["x.md"]);
  });
});

describe("override — order is load-bearing but the pair settles", () => {
  const upper = rewriter("upper", "x.md", "a", "A");
  // Runs after `upper` would see no "a"; runs first it consumes the same token differently.
  const wrap = rewriter("wrap", "x.md", "a", "(a)");

  test("a pair whose orders disagree but both settle is `override`", () => {
    const v = classifyPair(upper, wrap, corpusOf({ "x.md": "a" }));
    expect(v.relation).toBe("override");
    expect(v.sharedPaths).toEqual(["x.md"]);
  });

  test("an UNDECLARED override is refused — the invariant would live in a fold", () => {
    const r = buildRegistry([upper, wrap], corpusOf({ "x.md": "a" }));
    expect(r.undeclaredOverrides).toHaveLength(1);
    expect(isClean(r)).toBe(false);
    expect(renderReport(r)).toMatch(/UNDECLARED OVERRIDE/);
  });

  test("a DECLARED override passes — overlap is legal once documented", () => {
    // The reason this is a registry and not an assertion. Refusing all overrides would block the
    // rule-template collapse outright.
    const declared: DeclaredEdge[] = [{ before: "upper", after: "wrap", why: "upper normalises before wrapping" }];
    const r = buildRegistry([upper, wrap], corpusOf({ "x.md": "a" }), declared);
    expect(r.undeclaredOverrides).toHaveLength(0);
    expect(isClean(r)).toBe(true);
  });

  test("a declaration for a pair that COMMUTES is reported stale, and does not fail", () => {
    // Documentation rot, not a defect: the edge describes an ordering that no longer exists.
    const declared: DeclaredEdge[] = [{ before: "a", after: "b", why: "historic" }];
    const r = buildRegistry(
      [rewriter("a", "x.md", "foo", "FOO"), rewriter("b", "y.md", "bar", "BAR")],
      corpusOf({ "x.md": "foo", "y.md": "bar" }),
      declared,
    );
    expect(r.staleDeclarations).toHaveLength(1);
    expect(isClean(r)).toBe(true);
    expect(renderReport(r)).toMatch(/STALE DECLARATION/);
  });
});

describe("oscillate — the only relation that is always a defect", () => {
  // A GENUINE cycle, and getting this fixture right corrected my own model. The obvious
  // wrapper/unwrapper pair ("bare"<->"wrapped") does NOT oscillate: `unwrapper(wrapper("bare"))`
  // is "bare", a fixed point on the first step. Order changes the RESULT, which makes it an
  // `override`. For the composite itself to cycle you need at least three states — so `advance`
  // walks x->y->z and `reset` sends z back to x, and the composite alternates x,y,x,y forever
  // with no fixed point.
  const advance: Healer = {
    name: "advance",
    heal: (t) => {
      const v = t.get("x.md");
      if (v === "x") return new Map([...t, ["x.md", "y"]]);
      if (v === "y") return new Map([...t, ["x.md", "z"]]);
      return t;
    },
  };
  const reset: Healer = {
    name: "reset",
    heal: (t) => (t.get("x.md") === "z" ? new Map([...t, ["x.md", "x"]]) : t),
  };

  test("a pair whose composite never reaches a fixed point is `oscillate`", () => {
    const v = classifyPair(advance, reset, corpusOf({ "x.md": "x" }));
    expect(v.relation).toBe("oscillate");
  });

  test("oscillation FAILS the registry even if someone declared an edge", () => {
    // An override can be legitimised by declaring it; an oscillation cannot. If a declaration
    // could silence this, the registry would launder its only hard defect.
    const declared: DeclaredEdge[] = [{ before: "advance", after: "reset", why: "we prefer x" }];
    const r = buildRegistry([advance, reset], corpusOf({ "x.md": "x" }), declared);
    expect(r.oscillating).toHaveLength(1);
    expect(isClean(r)).toBe(false);
    expect(renderReport(r)).toMatch(/OSCILLATE/);
  });

  test("oscillation on ANY corpus entry wins over agreement on others", () => {
    // Otherwise a large benign corpus masks one genuinely broken input.
    const r = buildRegistry([advance, reset], [
      { name: "quiet", tree: tree({ "other.md": "untouched" }) },
      { name: "loud", tree: tree({ "x.md": "x" }) },
    ]);
    expect(r.oscillating).toHaveLength(1);
  });

  test("the order-dependent-but-settling pair is `override`, NOT `oscillate`", () => {
    // The distinction the fixture above exists to protect. wrapper/unwrapper reaches a fixed
    // point in each order and merely disagrees about which one — legal once declared.
    const wrapper: Healer = {
      name: "wrapper",
      heal: (t) => (t.get("x.md") === "bare" ? new Map([...t, ["x.md", "wrapped"]]) : t),
    };
    const unwrapper: Healer = {
      name: "unwrapper",
      heal: (t) => (t.get("x.md") === "wrapped" ? new Map([...t, ["x.md", "bare"]]) : t),
    };
    expect(classifyPair(wrapper, unwrapper, corpusOf({ "x.md": "bare" })).relation).toBe("override");
  });
});

describe("a vacuous corpus is reported, never read as success", () => {
  test("a pair that fires on NOTHING is flagged", () => {
    // Measured live: the three built-in harness fixtures fire none of the Tier-0 healers, so a
    // registry built from them alone would report `disjoint` for every pair and mean nothing.
    const r = buildRegistry(
      [rewriter("a", "x.md", "foo", "FOO"), rewriter("b", "y.md", "bar", "BAR")],
      corpusOf({ "unrelated.md": "nothing to do" }),
    );
    expect(r.vacuousPairs).toHaveLength(1);
    expect(renderReport(r)).toMatch(/fired on NOTHING/);
    // ...and it is NOT a failure. It is missing evidence, which is a different thing.
    expect(isClean(r)).toBe(true);
  });
});

describe("composability is a number", () => {
  test("no override edges means height 1 — an antichain, a SET not a sequence", () => {
    const r = buildRegistry(
      [rewriter("a", "x.md", "foo", "FOO"), rewriter("b", "y.md", "bar", "BAR")],
      corpusOf({ "x.md": "foo", "y.md": "bar" }),
    );
    expect(r.dagHeight).toBe(1);
  });

  test("a chain of declared edges raises the height", () => {
    expect(dagHeight(["a", "b", "c"], [
      { before: "a", after: "b", why: "x" },
      { before: "b", after: "c", why: "y" },
    ])).toBe(3);
  });

  test("an empty roster has height 0, not 1", () => {
    expect(dagHeight([], [])).toBe(0);
  });
});

describe("mechanics that would silently corrupt the verdicts", () => {
  test("comparison is ordinal-canonical, so Map insertion order cannot change a verdict", () => {
    // Without canonicalisation this compares iteration order and every pair looks like `override`.
    expect(canonical(tree({ b: "2", a: "1" }))).toBe(canonical(tree({ a: "1", b: "2" })));
  });

  test("writeSet catches additions and removals, not just edits", () => {
    const adder: Healer = { name: "add", heal: (t) => new Map([...t, ["new.md", "x"]]) };
    const remover: Healer = {
      name: "rm",
      heal: (t) => new Map([...t].filter(([k]) => k !== "gone.md")),
    };
    expect([...writeSet(adder, tree({ a: "1" }))]).toEqual(["new.md"]);
    expect([...writeSet(remover, tree({ "gone.md": "1" }))]).toEqual(["gone.md"]);
  });

  test("a THROWING healer is not reported as oscillating — that is a different defect", () => {
    const boom: Healer = { name: "boom", heal: () => { throw new Error("nope"); } };
    const v = classifyPair(boom, rewriter("b", "x.md", "foo", "FOO"), corpusOf({ "x.md": "foo" }));
    expect(v.relation).not.toBe("oscillate");
  });
});
