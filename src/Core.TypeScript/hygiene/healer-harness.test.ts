import { describe, expect, test } from "bun:test";

import {
  BUILTIN_FIXTURES,
  REFERENCE_DETECTORS,
  certify,
  composeHealers,
  hadamardFixture,
  memoryFixture,
  memoryToucherHealer,
  newFindings,
  resplitterHealer,
  runBuiltinCorpus,
  trailingSpaceHealer,
  tree,
  treesEqual,
  unwrapperHealer,
  type Healer,
} from "./healer-harness";

// Workitem 081KX3KA3F008QG0R0022EF9R8 — healers get golden vectors too.
// Proofs:
//   1. The two 2026-07-08 incidents fail as counterexamples (closure).
//   2. A period-2 oscillator is caught by idempotence + convergence.
//   3. Lawful healers pass; closure is ⊆ (removing findings is allowed).
//   4. Composition order matters and the corpus encodes the lesson.

describe("primitives", () => {
  test("treesEqual is byte-for-byte", () => {
    expect(treesEqual(tree({ a: "x" }), tree({ a: "x" }))).toBe(true);
    expect(treesEqual(tree({ a: "x" }), tree({ a: "x " }))).toBe(false);
    expect(treesEqual(tree({ a: "x" }), tree({ a: "x", b: "" }))).toBe(false);
  });

  test("newFindings is a set difference keyed by path+rule+detail", () => {
    const before = [{ path: "p", rule: "r", detail: "1" }];
    const after = [
      { path: "p", rule: "r", detail: "1" },
      { path: "p", rule: "r", detail: "2" },
    ];
    expect(newFindings(before, after)).toEqual([{ path: "p", rule: "r", detail: "2" }]);
    expect(newFindings(after, before)).toEqual([]); // removal is not minting
  });
});

describe("the 2026-07-08 counterexamples", () => {
  test("re-splitter: fixes MD032 but mints a code-span violation (closure)", () => {
    const v = certify(resplitterHealer, REFERENCE_DETECTORS, [hadamardFixture]);
    expect(v.pass).toBe(false);
    expect(v.violations.map((x) => x.law)).toContain("closure");
    expect(v.violations.some((x) => x.detail.includes("code-span-integrity"))).toBe(true);
  });

  test("memory-toucher: heals entries but stales the generated index (closure)", () => {
    const v = certify(memoryToucherHealer, REFERENCE_DETECTORS, [memoryFixture]);
    expect(v.pass).toBe(false);
    expect(v.violations.some((x) => x.detail.includes("memory-index-current"))).toBe(true);
  });
});

describe("oscillation", () => {
  /// A deliberate period-2 healer: toggles a marker file's content.
  const toggler: Healer = {
    name: "toggler",
    heal: (t) => {
      const out = new Map(t);
      out.set("state.md", t.get("state.md") === "on" ? "off" : "on");
      return out;
    },
  };

  test("period-2 oscillator fails idempotence AND convergence", () => {
    const v = certify(toggler, [], [{ name: "seed", tree: tree({ "state.md": "on" }) }]);
    expect(v.pass).toBe(false);
    const laws = v.violations.map((x) => x.law);
    expect(laws).toContain("idempotence");
    expect(laws).toContain("convergence");
  });
});

describe("lawful healers and the order lesson", () => {
  test("trailing-space stripper passes all laws over the corpus", () => {
    expect(certify(trailingSpaceHealer, REFERENCE_DETECTORS, BUILTIN_FIXTURES).pass).toBe(true);
  });

  test("closure is subset: removing pre-existing findings is lawful", () => {
    // unwrapper strictly removes code-span findings; never mints.
    expect(certify(unwrapperHealer, REFERENCE_DETECTORS, BUILTIN_FIXTURES).pass).toBe(true);
  });

  test("composition order decides legality: unwrapper-then-resplitter mints, resplitter-then-unwrapper is identity-safe", () => {
    const bad = composeHealers("bad-order", [unwrapperHealer, resplitterHealer]);
    const good = composeHealers("good-order", [resplitterHealer, unwrapperHealer]);
    expect(certify(bad, REFERENCE_DETECTORS, BUILTIN_FIXTURES).pass).toBe(false);
    expect(certify(good, REFERENCE_DETECTORS, BUILTIN_FIXTURES).pass).toBe(true);
  });
});

describe("reference-aliasing defense (reviewer P0s, #9817)", () => {
  const inPlaceMutator: Healer = {
    name: "in-place",
    heal: (t) => {
      (t as Map<string, string>).set("x.md", (t.get("x.md") ?? "") + "!");
      return t;
    },
  };

  test("an in-place mutator cannot pass by aliasing", () => {
    const v = certify(inPlaceMutator, [], [{ name: "seed", tree: tree({ "x.md": "a" }) }]);
    expect(v.pass).toBe(false);
  });

  test("certify never corrupts the fixture tree", () => {
    const seed = tree({ "x.md": "a" });
    certify(inPlaceMutator, [], [{ name: "seed", tree: seed }]);
    expect(seed.get("x.md")).toBe("a");
  });

  test("maxIterations clamps to >= 1: identity passes with a 0 budget (reviewer P2)", () => {
    const identity: Healer = { name: "id", heal: (t) => new Map(t) };
    expect(certify(identity, [], [{ name: "seed", tree: tree({ "x.md": "a" }) }], { maxIterations: 0 }).pass).toBe(true);
  });
});

describe("built-in corpus self-check", () => {
  test("runBuiltinCorpus: counterexamples fail, lawful healers pass", () => {
    const { ok, lines } = runBuiltinCorpus();
    expect(ok).toBe(true);
    expect(lines.every((l) => l.startsWith("OK "))).toBe(true);
  });
});
