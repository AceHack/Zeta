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
  orderedListPrefixDetector,
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

// ─── orderedListPrefixDetector (081M0QZF4QY087G0R000WKDYFZ) ─────────────────
//
// The detector's whole value is that it agrees with the parser markdownlint
// actually runs (micromark / CommonMark 0.31.2), because a detector that
// over-reports would see the finding on the INPUT too and closure would be
// satisfied vacuously again — the same defect wearing the opposite sign.
// Every expectation below was checked against markdownlint-cli2 0.22.1
// (markdownlint 0.40.0) with this repository's config before being written.
describe("orderedListPrefixDetector — MD029-shaped, CommonMark-faithful", () => {
  const detect = (md: string): readonly string[] =>
    orderedListPrefixDetector.detect(tree({ "docs/d.md": md })).map((f) => f.detail);

  test("a hard-wrapped numeral inside a paragraph is PROSE — no finding", () => {
    expect(detect("shipping since\n2016. The finding that matters:\n")).toEqual([]);
    expect(detect("The number of windows in my house is\n14.  The number of doors is 6.\n")).toEqual([]);
  });

  test("a SECOND wrapped numeral in the same paragraph is still prose", () => {
    // The paragraph does not close just because one of its lines began with a
    // numeral. Getting this wrong makes the detector report on untouched
    // authored text — a false positive on the INPUT, which would also let
    // minting hide inside it.
    expect(detect("prose wrapping to\n2007. and wrapping again to\n2016. and still going\n")).toEqual([]);
  });

  test("the same numeral with a blank line above IS a list — one finding", () => {
    expect(detect("shipping since\n\n2016. The finding that matters:\n")).toHaveLength(1);
  });

  test("0 and 1 starts are accepted; anything else is not", () => {
    expect(detect("# H\n\n0. zero\n1. one\n")).toEqual([]);
    expect(detect("# H\n\n1. one\n2. two\n")).toEqual([]);
    expect(detect("# H\n\n2. two\n3. three\n")).toHaveLength(1);
  });

  test("`)` is a marker too, and an empty item cannot interrupt a paragraph", () => {
    expect(detect("# H\n\n2007) item\n")).toHaveLength(1);
    expect(detect("prose wrapping to\n1.\nand on it goes\n")).toEqual([]);
  });

  test("a numeral line inside a fenced block is not a list", () => {
    expect(detect("# H\n\n```text\n2007. not a list\n```\n")).toEqual([]);
  });

  test("a heading closes the paragraph, so a numeral under one really is a list", () => {
    expect(detect("## Head\n\n2007. item\n")).toHaveLength(1);
  });

  test("DISCRIMINATION at the corpus level: the re-splitter now mints ol-prefix", () => {
    const numeralFixture = {
      name: "hard-wrapped-numeral",
      tree: tree({ "docs/p.md": "chosen as the headline property of an installer in\n2007. It rhymes with:\n" }),
    };
    const bad = certify(resplitterHealer, REFERENCE_DETECTORS, [numeralFixture]);
    expect(bad.pass).toBe(false);
    expect(bad.violations.some((v) => v.law === "closure" && v.detail.includes("ol-prefix"))).toBe(true);

    // …and the detector is not simply always-on: the lawful healer is clean on
    // the same fixture, so the failure above is the healer's, not the fixture's.
    expect(certify(trailingSpaceHealer, REFERENCE_DETECTORS, [numeralFixture]).pass).toBe(true);
  });
});
