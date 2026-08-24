// Falsifiers for the NON-EQUALITY half of the check-arity audit.
//
// Both directions matter and both are asserted here. A rule that only ever fires is a nuisance
// that gets suppressed; a rule that never fires is decoration. The controls that assert a shape
// is NOT flagged are the ones that keep bucket 2 from being rounded up to bucket 1 -- the refusal
// that made the first sweep credible, and the one this file has to keep mechanical.

import { describe, expect, test } from "bun:test";
import {
  type Site,
  auditSources,
  findAbsenceUnderClaim,
  findTautologies,
  isAbsenceAssertion,
  MIN_SCANNED_FILES,
  NONEQ_CENSUS_PATH,
  scanNonEquality,
  SCAN_DIRS,
  SELF_EXCLUDED,
} from "./audit-check-arity-nonequality.ts";

const ts = (body: string): string => `test("some property", () => {\n  ${body}\n});\n`;
const fs = (name: string, body: string): string => `[<Fact>]\nlet \`\`${name}\`\` () =\n    ${body}\n`;

const taut = (path: string, src: string): number => findTautologies(scanNonEquality(path, src)).length;

describe("R4 -- provably-unfalsifiable comparisons ARE flagged", () => {
  test("F#: Set.count x >= 0 -- the live instance this rule was written for", () => {
    const t = findTautologies(
      scanNonEquality("t.fs", fs("DDRG-9 carries outcome", "Assert.True(Set.count caps >= 0)")),
    );
    expect(t).toHaveLength(1);
    expect(t[0]!.why).toContain("non-negative by construction");
  });

  test("F#: List.length / Array.length / .Length / .Count are all non-negative", () => {
    expect(taut("t.fs", fs("a", "Assert.True(List.length xs >= 0)"))).toBe(1);
    expect(taut("t.fs", fs("a", "Assert.True(Array.length xs >= 0)"))).toBe(1);
    expect(taut("t.fs", fs("a", "Assert.True(xs.Length >= 0)"))).toBe(1);
    expect(taut("t.fs", fs("a", "Assert.True(xs.Count >= 0)"))).toBe(1);
  });

  test("F#: a reflexive comparison is flagged", () => {
    expect(taut("t.fs", fs("a", "Assert.True(score >= score)"))).toBe(1);
  });

  test("TS: a JS length/size >= 0 is flagged", () => {
    expect(taut("t.test.ts", ts("expect(xs.length).toBeGreaterThanOrEqual(0);"))).toBe(1);
    expect(taut("t.test.ts", ts("expect(m.size).toBeGreaterThanOrEqual(0);"))).toBe(1);
  });

  test("TS: subject compared against itself is flagged", () => {
    expect(taut("t.test.ts", ts("expect(total).toBeGreaterThanOrEqual(total);"))).toBe(1);
  });
});

describe("R4 -- shapes that CAN fail are NOT flagged (the false-positive floor)", () => {
  test("findIndex/indexOf >= 0 asserts WAS FOUND -- it returns -1 when absent", () => {
    expect(taut("t.test.ts", ts("expect(arr.findIndex(f)).toBeGreaterThanOrEqual(0);"))).toBe(0);
    expect(taut("t.test.ts", ts("expect(s.indexOf(x)).toBeGreaterThanOrEqual(0);"))).toBe(0);
  });

  test("a bound other than 0 is a real claim", () => {
    expect(taut("t.test.ts", ts("expect(xs.length).toBeGreaterThanOrEqual(1);"))).toBe(0);
    expect(taut("t.fs", fs("a", "Assert.True(Set.count caps >= 1)"))).toBe(0);
  });

  test("a value that is not length-like can be negative -- a probability, an MI estimate", () => {
    expect(taut("t.test.ts", ts("expect(p).toBeGreaterThanOrEqual(0);"))).toBe(0);
    expect(taut("t.test.ts", ts("expect(pairingMI(pairs)).toBeGreaterThanOrEqual(0);"))).toBe(0);
  });

  test("Assert.True(true) is deliberately NOT flagged: measured, every live instance is the success leg of a discriminating match", () => {
    // `| ResolvedYes _ -> Assert.True(true) | _ -> Assert.True(false, "...")` -- the ENCLOSING
    // check can fail, so its arity matches its claim. Flagging the line would round a correct
    // check up to vacuous, which is the error this whole class exists to avoid, in reverse.
    expect(taut("t.fs", fs("AE-1 local consensus ignores irrelevant alternatives", "Assert.True(true)"))).toBe(0);
  });

  test("the FIXED form of the live instance is clean", () => {
    const fixed = fs("DDRG-9 carries outcome", 'Assert.Equal<Set<string>>(Set.singleton "trade", caps)');
    expect(taut("t.fs", fixed)).toBe(0);
  });
});

describe("R5 -- absence assertions under a taint / 2-safety claim are RECOGNISED", () => {
  const sitesOf = (path: string, src: string): Site[] => findAbsenceUnderClaim(scanNonEquality(path, src));

  test("the live shape: a secret searched for by one literal rendering", () => {
    const src = ts('expect(published).not.toContain("PRIVATE");');
    expect(sitesOf("t.test.ts", src)).toHaveLength(1);
  });

  test("an absence assertion under a name that declares independence is recognised", () => {
    const src = `test("label is user-independent", () => {\n  expect(label).not.toContain(USER);\n});\n`;
    expect(sitesOf("t.test.ts", src)).toHaveLength(1);
  });

  test("an ordinary absence assertion, with no taint or 2-safety claim, is NOT counted", () => {
    const src = ts('expect(rendered).not.toContain("placeholder");');
    expect(sitesOf("t.test.ts", src)).toHaveLength(0);
  });

  test("a POSITIVE assertion is never an absence assertion", () => {
    const s = scanNonEquality("t.test.ts", ts('expect(published).toContain("ssh-ed25519");'));
    expect(s.every((x) => !isAbsenceAssertion(x))).toBe(true);
  });
});

describe("R5 ratchets in BOTH directions", () => {
  const src = ts('expect(published).not.toContain("PRIVATE");');
  const sources = [{ path: "a.test.ts", text: src }];

  test("a NEW absence-under-taint site fails the audit (count rose)", () => {
    const r = auditSources(sources, { counts: {} });
    expect(r.censusRose).toHaveLength(1);
    expect(r.censusRose[0]!.was).toBe(0);
    expect(r.censusRose[0]!.now).toBe(1);
  });

  test("a REMOVED site equally fails the audit (count fell) -- a stale row constrains nothing", () => {
    const r = auditSources([{ path: "a.test.ts", text: ts("expect(x).toBe(1);") }], { counts: { "a.test.ts": 1 } });
    expect(r.censusFell).toHaveLength(1);
    expect(r.censusFell[0]!.was).toBe(1);
    expect(r.censusFell[0]!.now).toBe(0);
  });

  test("an unchanged count is silent", () => {
    const r = auditSources(sources, { counts: { "a.test.ts": 1 } });
    expect(r.censusRose).toHaveLength(0);
    expect(r.censusFell).toHaveLength(0);
  });
});

describe("the scanner does not narrow silently", () => {
  test("equality verbs stay OUT of scope -- audit-check-arity.ts owns them", () => {
    const s = scanNonEquality("t.test.ts", ts("expect(a).toBe(b);"));
    expect(s).toHaveLength(0);
    const f = scanNonEquality("t.fs", fs("a", "Assert.Equal(1, x)"));
    expect(f).toHaveLength(0);
  });

  test("`.not.toBe` IS in scope: negation makes it a different assertion", () => {
    expect(scanNonEquality("t.test.ts", ts("expect(a).not.toBe(b);"))).toHaveLength(1);
  });

  test("a commented-out assertion is not a check", () => {
    expect(scanNonEquality("t.test.ts", ts("// expect(xs.length).toBeGreaterThanOrEqual(0);"))).toHaveLength(0);
    expect(taut("t.fs", "// Assert.True(Set.count caps >= 0)\n")).toBe(0);
  });

  test("SCAN_DIRS reaches OUTSIDE tests/ -- 97% of *.test.ts live there, including both fixed instances", () => {
    expect(SCAN_DIRS).toContain("src");
    expect(SCAN_DIRS).toContain("tools");
    expect(SCAN_DIRS).toContain("tests");
  });

  test("a file floor exists so a walk that stops descending is loud, not quietly green", () => {
    expect(MIN_SCANNED_FILES).toBeGreaterThan(1000);
  });

  test("the self-exclusion is exactly two files -- the audit and this suite, and nothing else", () => {
    // A carve-out with no scope is a licence. Both entries exist because they state the flagged
    // patterns as LITERALS: the audit in its documentation, this file in its fixtures. If a third
    // path ever appears here it is a suppression, not a self-exclusion, and this fails.
    expect([...SELF_EXCLUDED].sort()).toEqual([
      "src/Core.TypeScript/hygiene/audit-check-arity-nonequality.test.ts",
      "src/Core.TypeScript/hygiene/audit-check-arity-nonequality.ts",
    ]);
  });

  test("the census path is the byte-locked artefact the ratchet reads", () => {
    expect(NONEQ_CENSUS_PATH).toBe("registry/check-arity-nonequality-census.json");
  });
});
