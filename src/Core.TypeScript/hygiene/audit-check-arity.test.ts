// audit-check-arity.test.ts -- the detector's own falsifier.
//
// A lint that has never been shown to go red is itself a check that cannot fail, which is the exact
// class this file's subject exists to catch. So every rule is fed a deliberately-broken fixture and
// required to fire, AND a correct fixture and required to stay silent. R2 is exercised in BOTH
// ratchet directions, because a ratchet that only fires upward lets a stale row stop constraining.

import { describe, expect, it } from "bun:test";
import {
  AUDIT_PATH,
  auditSources,
  CENSUS_ACCEPT_COMMAND,
  CENSUS_FIX_COMMAND,
  CENSUS_PATH,
  isCorpusPath,
  OWN_PATHS,
  declaresTwoSafety,
  findOrphanTestSources,
  norm,
  scanFsharp,
  scanTypeScript,
  substitute,
} from "./audit-check-arity";

const EMPTY_CENSUS = { counts: {} as Record<string, number> };

describe("normalization and substitution", () => {
  it("norm strips whitespace and one layer of wrapping parens", () => {
    expect(norm(" ( f  a ) ")).toBe("fa");
  });

  it("substitute inlines a binding transitively", () => {
    const b = new Map([
      ["a", "g x"],
      ["y", "h a"],
    ]);
    expect(norm(substitute("y", b))).toBe(norm("(h (g x))"));
  });
});

describe("R0 -- the detector finds all three forms of the class", () => {
  it("SYNTACTIC: f x = f x", () => {
    const src = ["[<Property>]", "let ``p`` (x: int) =", "    f x = f x"].join("\n");
    const hits = scanFsharp("t.fs", src);
    expect(hits.length).toBe(1);
    expect(hits[0]!.form).toBe("syntactic");
  });

  it("NAME-BOUND: two names bound to the same expression -- the form a `X = X` grep MISSES", () => {
    // This is the shape that survived the 2026-08-18 pass and lived on main until 2026-08-23.
    const src = [
      "[<Property>]",
      "let ``p`` (xs: int list) =",
      "    let delta = ZSet.ofSeq xs",
      "    let localResult = delta",
      "    let centralResult = delta",
      "    localResult = centralResult",
    ].join("\n");
    const hits = scanFsharp("t.fs", src);
    expect(hits.length).toBe(1);
    expect(hits[0]!.form).toBe("name-bound");
    // and the falsifier for the falsifier: a plain grep for the visible form finds nothing here.
    expect(/(\S+)\s*=\s*\1\s*$/m.test(src)).toBe(false);
  });

  it("HELPER-MEDIATED: one helper invoked twice with the same input, through Assert.Equal", () => {
    const src = [
      "[<Fact>]",
      "let ``p`` () =",
      "    let a = render (mk 1)",
      "    let b = render (mk 1)",
      "    Assert.Equal<string>(a, b)",
    ].join("\n");
    const hits = scanFsharp("t.fs", src);
    expect(hits.length).toBe(1);
    expect(hits[0]!.form).toBe("name-bound");
  });

  it("finds an equality buried in a boolean conjunct", () => {
    const src = [
      "[<Property>]",
      "let ``p`` (p: int) =",
      "    let c1 = color p",
      "    let c2 = color p",
      "    c1 = c2 && c1 >= 0",
    ].join("\n");
    expect(scanFsharp("t.fs", src).length).toBe(1);
  });

  it("does NOT fire on a record literal: `Payload = Payload` is field syntax, not a comparison", () => {
    const src = [
      "let private request subs =",
      "    { Scope = Scope",
      "      Payload = Payload",
      "      Submissions = subs }",
    ].join("\n");
    expect(scanFsharp("t.fs", src).length).toBe(0);
  });

  it("does NOT fire on two genuinely different arguments", () => {
    const src = ["[<Property>]", "let ``p`` (x: int) =", "    f x = f (x + 1)"].join("\n");
    expect(scanFsharp("t.fs", src).length).toBe(0);
  });

  it("TypeScript: expect(a).toBe(b) with a and b bound to the same call", () => {
    const src = [
      'it("re-generating produces identical output", () => {',
      "  const gen1 = generate(meta);",
      "  const gen2 = generate(meta);",
      "  expect(gen1).toBe(gen2);",
      "});",
    ].join("\n");
    expect(scanTypeScript("t.test.ts", src).length).toBe(1);
  });

  it("TypeScript: `.not.` is a different defect and is NOT counted here", () => {
    const src = ['it("distinct", () => {', "  const a = f(1);", "  expect(a).not.toEqual(a);", "});"].join("\n");
    expect(scanTypeScript("t.test.ts", src).length).toBe(0);
  });
});

describe("R1 -- a 2-safety NAME over a 1-arity body", () => {
  it("the name vocabulary recognises the declaration", () => {
    expect(declaresTwoSafety("renderCard is a pure function of the link — no clock input")).not.toBeNull();
    expect(declaresTwoSafety("navigate trajectory is identical regardless of world state")).not.toBeNull();
    expect(declaresTwoSafety("noninterference: the clock changes only the clock line")).not.toBeNull();
    expect(declaresTwoSafety("Merkle root is deterministic (same leaves -> same root)")).toBeNull();
  });

  it("SABOTAGE: fires on the workitem's own instance", () => {
    const src = [
      "[<Property>]",
      "let ``renderCard (the minted content) is a pure function of the link — no clock input`` (a: int) =",
      "    let l = mintedLink a",
      "    MP.renderCard l = MP.renderCard l",
    ].join("\n");
    const r = auditSources([{ path: "t.fs", text: src }], { counts: { "t.fs": 1 } });
    expect(r.twoSafetyViolations.length).toBe(1);
    expect(r.twoSafetyViolations[0]!.claim).toContain("ambient channel");
  });

  it("CONTROL: silent once the pair varies the quantified variable", () => {
    const src = [
      "[<Property>]",
      "let ``the minted card content is invariant under the render clock — the ARITY-2 form`` (a: int) =",
      "    let card = MP.renderCard l",
      "    gridOf (MP.renderPage c1 [ l ]) = card && gridOf (MP.renderPage c2 [ l ]) = card",
    ].join("\n");
    const r = auditSources([{ path: "t.fs", text: src }], EMPTY_CENSUS);
    expect(r.twoSafetyViolations.length).toBe(0);
  });

  it("CONTROL: an honestly-named determinism check is NOT an R1 violation", () => {
    // `f x = f x` evaluated twice IS two executions, so its arity matches its claim. Rounding these
    // up to "vacuous" is the same error in the opposite direction and this test pins the refusal.
    const src = [
      "[<Property>]",
      "let ``run is deterministic (same seed,n => same timeline)`` (s: int) =",
      "    Scheduler.run s = Scheduler.run s",
    ].join("\n");
    const r = auditSources([{ path: "t.fs", text: src }], { counts: { "t.fs": 1 } });
    expect(r.comparisons.length).toBe(1);
    expect(r.twoSafetyViolations.length).toBe(0);
  });
});

describe("R2 -- the census ratchet fires in BOTH directions", () => {
  const src = ["[<Property>]", "let ``p`` (x: int) =", "    f x = f x"].join("\n");

  it("UP: a new self-comparison hiding behind adjudicated ones", () => {
    const r = auditSources([{ path: "t.fs", text: src }], { counts: { "t.fs": 0 } });
    expect(r.censusRose.length).toBe(1);
    expect(r.censusRose[0]).toEqual({ path: "t.fs", was: 0, now: 1 });
  });

  it("DOWN: a stale row that has stopped constraining anything", () => {
    const r = auditSources([{ path: "t.fs", text: src }], { counts: { "t.fs": 2 } });
    expect(r.censusFell.length).toBe(1);
  });

  it("EXACT: silent when the count matches", () => {
    const r = auditSources([{ path: "t.fs", text: src }], { counts: { "t.fs": 1 } });
    expect(r.censusRose.length).toBe(0);
    expect(r.censusFell.length).toBe(0);
  });
});

describe("R3 -- an F# test source no project compiles", () => {
  const proj = {
    path: "tests/T/T.fsproj",
    text: '<Project><ItemGroup><Compile Include="Properties/PolicyRelocation.Tests.fs" /></ItemGroup></Project>',
  };

  it("SABOTAGE: the orphan is found", () => {
    const orphans = findOrphanTestSources(
      ["tests/T/Properties/PolicyRelocation.Tests.fs", "tests/T/Properties/Policy.Relocation.Tests.fs"],
      [proj],
    );
    expect(orphans).toEqual(["tests/T/Properties/Policy.Relocation.Tests.fs"]);
  });

  it("CONTROL: a compiled file is not reported", () => {
    expect(findOrphanTestSources(["tests/T/Properties/PolicyRelocation.Tests.fs"], [proj])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The coupling guard (2026-08-26). This half of the class red-lined `main` twice on 2026-08-25/27,
// and the second episode was still open when these were written. Prose rots; a fix command that
// drifts from the code path it names sends a reader to a command that does not clear the check.
// ---------------------------------------------------------------------------

describe("the failure names a fix that is the same code path as the check", () => {
  it("the cheap fix command is exact and runnable as printed", () => {
    expect(CENSUS_FIX_COMMAND).toBe("bun src/Core.TypeScript/hygiene/audit-check-arity.ts --write");
  });

  it("ACCEPTING a raise is a SEPARATE, deliberately-spelled command", () => {
    // The whole guard: if these were one string, the cheap fix would silence findings, and the
    // measured history of this census -- ten edits, ten raises, zero lowerings -- says which way
    // that pressure runs.
    expect(CENSUS_ACCEPT_COMMAND).toBe(`${CENSUS_FIX_COMMAND} --accept-raises`);
    expect(CENSUS_ACCEPT_COMMAND).not.toBe(CENSUS_FIX_COMMAND);
  });

  it("the fix command names THIS audit, not its non-equality sibling", () => {
    expect(CENSUS_FIX_COMMAND).toContain(AUDIT_PATH);
    expect(AUDIT_PATH).toBe("src/Core.TypeScript/hygiene/audit-check-arity.ts");
    expect(CENSUS_FIX_COMMAND).not.toContain("nonequality");
  });
});

describe("drift-check scoping is the SAME predicate the walk uses", () => {
  it("SCAN_ROOTS is tests/ only, so only tests/ paths are corpus", () => {
    expect(isCorpusPath("tests/Tests.FSharp/ZetaFsDualFold.Tests.fs")).toBe(true);
    expect(isCorpusPath("tests/Tests.TypeScript/a.test.ts")).toBe(true);
    // 97% of the tree's *.test.ts live outside tests/ and are the SIBLING audit's corpus, not this
    // one's. Widening this predicate without widening SCAN_ROOTS would make the guard skip changes
    // the check then fails on -- two notions of scope disagreeing, which is what it exists to avoid.
    expect(isCorpusPath("src/Core.TypeScript/zflash/lib.test.ts")).toBe(false);
  });

  it("a non-test file under tests/ is not corpus", () => {
    expect(isCorpusPath("tests/Tests.FSharp/Tests.FSharp.fsproj")).toBe(false);
    expect(isCorpusPath("README.md")).toBe(false);
  });

  it("the census and the audit are OWN_PATHS: editing the deriver must re-check, not skip", () => {
    expect([...OWN_PATHS].sort()).toEqual([CENSUS_PATH, AUDIT_PATH].sort());
  });
});
