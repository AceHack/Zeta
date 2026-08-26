// Falsifiers for the Tier 0 export-surface diff and its routing join.
//
// The fixtures under `testdata/` are REAL published surfaces, captured from
// registry.npmjs.org by `capture-package-surface.ts`, each carrying the tarball
// integrity string it was read from. They are text (JSON), diffable, and
// replayable — `.claude/rules/no-binary-in-proof-lineage.md`. Nothing here
// fetches anything: every test below is a pure function applied to committed
// text, so it runs offline and deterministically.
//
// Each falsifier states the MUTATION that must break it. A test whose mutation
// is not nameable is decoration, and a test that passes because an earlier guard
// fired is worse than no test at all — so the ones that could pass vacuously
// carry an explicit control assertion showing the negative case really is
// negative.

import { test, expect } from "bun:test";
import {
  extractDeclaredSurface,
  diffSurface,
  classifyConsumer,
  routeUpdate,
  type PackageSurface,
  type SurfaceFact,
  type ConsumerFact,
} from "./toy-surface.ts";

import { packumentUrl } from "./capture-package-surface.ts";

import rrp3 from "./testdata/surface-react-resizable-panels-3.0.6.json" with { type: "json" };
import rrp4 from "./testdata/surface-react-resizable-panels-4.12.3.json" with { type: "json" };
import npq6 from "./testdata/surface-noble-post-quantum-0.6.1.json" with { type: "json" };
import npq7 from "./testdata/surface-noble-post-quantum-0.7.0.json" with { type: "json" };

const RRP_3 = rrp3 as PackageSurface;
const RRP_4 = rrp4 as PackageSurface;
const NPQ_6 = npq6 as PackageSurface;
const NPQ_7 = npq7 as PackageSurface;

const removedNames = (facts: readonly SurfaceFact[]): readonly string[] =>
  facts.filter((f) => f.t === "ExportRemoved").map((f) => f.name);

const addedNames = (facts: readonly SurfaceFact[]): readonly string[] =>
  facts.filter((f) => f.t === "ExportAdded").map((f) => f.name);

// ── FALSIFIER 1: THE REAL BREAK, FROM THE REAL BYTES ─────────────────────────
//
// PRs #14579 and #14583 bumped `react-resizable-panels` 3.0.6 -> 4.12.3 and both
// needed a hand-written source migration. #14583 had ZERO CI failures across all
// three of its commits and still needed the migration.
//
// Mutation that must break this: delete either direction of the set difference
// in `diffSurface`, or flatten the entry-point map back into one union.

test("FALSIFIER 1: the rrp 3->4 diff names PanelGroup and PanelResizeHandle as removed", () => {
  const facts = diffSurface(RRP_3, RRP_4);
  const removed = removedNames(facts);

  expect(removed).toContain("PanelGroup");
  expect(removed).toContain("PanelResizeHandle");

  // The replacements are named too — a rename is a removal AND an addition, and
  // the pair is what a migration author needs.
  expect(addedNames(facts)).toContain("Group");
  expect(addedNames(facts)).toContain("Separator");

  // CONTROL. Without this the test could pass because EVERYTHING is reported as
  // removed. `Panel` survived the major bump under its own name, so it must not
  // appear on either side.
  expect(removed).not.toContain("Panel");
  expect(addedNames(facts)).not.toContain("Panel");
});

test("FALSIFIER 1 (control): a surface diffed against itself produces no facts", () => {
  // The vacuity guard for every diff test above and below. If `diffSurface`
  // returned rows unconditionally, every other assertion in this file would pass
  // for the wrong reason.
  expect(diffSurface(RRP_3, RRP_3)).toEqual([]);
  expect(diffSurface(RRP_4, RRP_4)).toEqual([]);
  expect(diffSurface(NPQ_7, NPQ_7)).toEqual([]);
});

// ── FALSIFIER 2: THE SUBPATH CASE — A UNION WOULD MISS IT ────────────────────
//
// `@noble/post-quantum` 0.6.1 -> 0.7.0 dropped the `XWing` alias, which took down
// PR #14567 and its re-roll #15301 with
// `SyntaxError: Export named 'XWing' not found in @noble/post-quantum@0.7.0/hybrid.js`.
//
// This package's ROOT declaration file is literally `export {};` — the entire
// surface lives under subpaths. A reader that only looks at the root sees an
// empty surface and reports a clean diff, which is a check that cannot fail.
//
// Mutation that must break this: make `declaredEntryPoints` filter for paths
// ending in `.d.ts` (dropping the `.js -> .d.ts` sibling mapping), or key
// `diffSurface` on names alone instead of (subpath, name).

test("FALSIFIER 2: the noble 0.6.1->0.7.0 diff names XWing as removed FROM './hybrid.js'", () => {
  const facts = diffSurface(NPQ_6, NPQ_7);

  const xwing = facts.find((f) => f.t === "ExportRemoved" && f.name === "XWing");
  expect(xwing).toBeDefined();
  expect(xwing).toEqual({ t: "ExportRemoved", subpath: "./hybrid.js", name: "XWing" });

  // CONTROL 1: the root entry point really is empty in both versions, which is
  // exactly why a root-only reader would have reported nothing.
  const root6 = NPQ_6.entryPoints.find((e) => e.subpath === ".");
  const root7 = NPQ_7.entryPoints.find((e) => e.subpath === ".");
  expect(root6?.names).toEqual([]);
  expect(root7?.names).toEqual([]);

  // CONTROL 2: the surface was genuinely READ, not merely absent. If the capture
  // had failed we would also see no names — so assert the declaration file
  // resolved and that other subpaths carry names.
  expect(root6?.declarationFile).not.toBeNull();
  const hybrid6 = NPQ_6.entryPoints.find((e) => e.subpath === "./hybrid.js");
  expect(hybrid6?.names.length).toBeGreaterThan(0);
  expect(hybrid6?.names).toContain("XWing");

  // CONTROL 3: not everything was dropped. `ml-kem.js` kept its names.
  const stillThere = NPQ_7.entryPoints.find((e) => e.subpath === "./ml-kem.js");
  expect(stillThere?.names.length).toBeGreaterThan(0);
});

test("FALSIFIER 2b: a name that MOVES between subpaths is reported as removed from the old one", () => {
  // SYNTHETIC, and labelled as such because the honesty matters. Neither
  // captured fixture contains a moved name — `XWing` was genuinely deleted, not
  // relocated — so the real data cannot distinguish per-subpath keying from a
  // flat union over all entry points. A mutation run proved exactly that: keying
  // the diff on names alone survived every other test in this file.
  //
  // The distinction is not academic. A package that relocates `Foo` from
  // `./a.js` to `./b.js` breaks every consumer importing it from `./a.js`, and a
  // flat union sees `Foo` on both sides and reports nothing at all.
  const before: PackageSurface = {
    package: "p",
    version: "1.0.0",
    tarballIntegrity: null,
    entryPoints: [
      { subpath: "./a.js", declarationFile: "a.d.ts", names: ["Foo"], unresolvedStarReexports: [] },
      { subpath: "./b.js", declarationFile: "b.d.ts", names: [], unresolvedStarReexports: [] },
    ],
  };
  const after: PackageSurface = {
    package: "p",
    version: "2.0.0",
    tarballIntegrity: null,
    entryPoints: [
      { subpath: "./a.js", declarationFile: "a.d.ts", names: [], unresolvedStarReexports: [] },
      { subpath: "./b.js", declarationFile: "b.d.ts", names: ["Foo"], unresolvedStarReexports: [] },
    ],
  };

  const facts = diffSurface(before, after);
  expect(facts).toContainEqual({ t: "ExportRemoved", subpath: "./a.js", name: "Foo" });
  expect(facts).toContainEqual({ t: "ExportAdded", subpath: "./b.js", name: "Foo" });

  // And it escalates: a consumer importing `Foo` from `./a.js` is now broken.
  expect(routeUpdate("TestsPassed", facts, [classifyConsumer("Foo", ["x.ts"], [])]).tier).toBe("Tier2Semantic");
});

test("FALSIFIER 2c: an entry point that disappears is reported, with every name it carried", () => {
  const before: PackageSurface = {
    package: "p",
    version: "1.0.0",
    tarballIntegrity: null,
    entryPoints: [
      { subpath: ".", declarationFile: "index.d.ts", names: ["Root"], unresolvedStarReexports: [] },
      { subpath: "./legacy.js", declarationFile: "legacy.d.ts", names: ["Old"], unresolvedStarReexports: [] },
    ],
  };
  const after: PackageSurface = {
    package: "p",
    version: "2.0.0",
    tarballIntegrity: null,
    entryPoints: [{ subpath: ".", declarationFile: "index.d.ts", names: ["Root"], unresolvedStarReexports: [] }],
  };

  const facts = diffSurface(before, after);
  expect(facts).toContainEqual({ t: "EntryPointRemoved", subpath: "./legacy.js" });
  expect(facts).toContainEqual({ t: "ExportRemoved", subpath: "./legacy.js", name: "Old" });
  // CONTROL: the surviving entry point produced nothing.
  expect(facts.filter((f) => f.t !== "EntryPointRemoved" && f.subpath === ".")).toEqual([]);
});

// ── FALSIFIER 3: THE INVERSION — GREEN TESTS DO NOT TERMINATE A SURFACE CHANGE ─
//
// This is the routing rule the brief asked to be designed for, stated as a test:
//
//     "Tests pass AND the API surface changed" is more suspicious than "tests fail."
//
// Mutation that must break this: give `routeUpdate` an early return for
// `outcome === "TestsPassed"`, or drop the `RemovedExportUnreferenced` arm of the
// consumer switch, or replace the join with anything that lets a green run lower
// the tier.

test("FALSIFIER 3: a green build with an unreferenced removed export does NOT terminate at Tier 0", () => {
  const facts: readonly ConsumerFact[] = [classifyConsumer("PanelGroup", [], [])];
  const routed = routeUpdate("TestsPassed", diffSurface(RRP_3, RRP_4), facts);

  expect(routed.tier).toBe("Tier1Triage");

  // CONTROL: Tier 0 termination is REACHABLE, so the assertion above is not
  // passing because nothing ever terminates.
  expect(routeUpdate("TestsPassed", [], []).tier).toBe("Tier0Terminal");
});

test("FALSIFIER 3: a green build with a removed export our CODE names goes past Tier 1", () => {
  // The rrp case as it actually was: `PanelGroup` referenced in two vendored
  // components. Tier 0 has already answered "which symbol, which file", so the
  // only remaining work is writing the migration — a Tier 2 job.
  const facts: readonly ConsumerFact[] = [
    classifyConsumer(
      "PanelGroup",
      [
        "src/Renderers/website/client/src/components/ui/resizable.tsx",
        "demo/identity-dla-site/src/components/ui/resizable.tsx",
      ],
      [],
    ),
  ];
  const routed = routeUpdate("TestsPassed", diffSurface(RRP_3, RRP_4), facts);
  expect(routed.tier).toBe("Tier2Semantic");
});

test("FALSIFIER 3: a name surviving only in text no compiler reads reaches Tier 2", () => {
  // The mechanical proxy for the silent half of the rrp break — a name that
  // lives on in a CSS selector or a template string, where nothing will fail.
  const facts: readonly ConsumerFact[] = [
    classifyConsumer("PanelGroup", [], ["src/Renderers/website/client/src/styles/panels.css"]),
  ];
  expect(routeUpdate("TestsPassed", [], facts).tier).toBe("Tier2Semantic");
});

test("FALSIFIER 3: TestsNotRun is strictly worse than TestsPassed", () => {
  // A required check that never ran contributes zero evidence in either
  // direction. Collapsing it into "passed" is how a check that did not run comes
  // to look like one that passed.
  expect(routeUpdate("TestsNotRun", [], []).tier).toBe("Tier1Triage");
  expect(routeUpdate("TestsPassed", [], []).tier).toBe("Tier0Terminal");
});

// ── FALSIFIER 4: THE JOIN HAS NO EXCHANGE RATE ───────────────────────────────
//
// Same discipline as `toy-classify.ts`: the combinator is a maximum, never a
// sum. A green test run must never be able to buy down a surface fact.
//
// Mutation that must break this: change `raise` to compare with `<`, or make
// `routeUpdate` average anything.

test("FALSIFIER 4: routing is monotone — adding a fact never lowers the tier", () => {
  const surface = diffSurface(RRP_3, RRP_4);
  const outcomes = ["TestsPassed", "TestsFailed", "TestsNotRun"] as const;
  const consumerSets: readonly (readonly ConsumerFact[])[] = [
    [],
    [classifyConsumer("PanelGroup", [], [])],
    [classifyConsumer("PanelGroup", [], ["a.css"])],
    [classifyConsumer("PanelGroup", ["a.tsx"], [])],
  ];

  for (const outcome of outcomes) {
    for (const consumers of consumerSets) {
      const withoutSurface = routeUpdate(outcome, [], consumers);
      const withSurface = routeUpdate(outcome, surface, consumers);
      // Adding surface facts can only raise or hold.
      const rank = { Tier0Terminal: 0, Tier1Triage: 1, Tier2Semantic: 2 } as const;
      expect(rank[withSurface.tier]).toBeGreaterThanOrEqual(rank[withoutSurface.tier]);
    }
  }

  // CONTROL: the tier is not constant across these inputs — otherwise monotonicity
  // holds vacuously.
  const tiers = new Set(outcomes.flatMap((o) => consumerSets.map((c) => routeUpdate(o, surface, c).tier)));
  expect(tiers.size).toBeGreaterThan(1);
});

// ── FALSIFIER 5: AN UNREADABLE SURFACE IS NOT AN UNCHANGED SURFACE ───────────
//
// The vacuity guard on the reader itself. `export * from "./x"` that was not
// resolved must come back as `SurfaceUnreadable`, and that must escalate — a
// partial read reported as a clean diff is the failure this whole module is
// built to avoid.
//
// Mutation that must break this: drop `unresolvedStarReexports` from
// `extractDeclaredSurface`, or delete the `SurfaceUnreadable` arm of `routeUpdate`.

test("FALSIFIER 5: an unresolved re-export is reported and escalates", () => {
  const surface = extractDeclaredSurface(`export * from "./core.js";\nexport declare const a: number;`);
  expect(surface.unresolvedStarReexports).toEqual(["./core.js"]);
  expect(surface.names).toEqual(["a"]);

  const before: PackageSurface = {
    package: "p",
    version: "1.0.0",
    tarballIntegrity: null,
    entryPoints: [{ subpath: ".", declarationFile: "index.d.ts", ...surface }],
  };
  const facts = diffSurface(before, before);
  expect(facts.some((f) => f.t === "SurfaceUnreadable")).toBe(true);

  // It escalates even though the two surfaces are IDENTICAL and the build is green.
  expect(routeUpdate("TestsPassed", facts, []).tier).toBe("Tier1Triage");
});

test("FALSIFIER 5: an entry point with no declaration file reads as unreadable, not as empty", () => {
  const missing: PackageSurface = {
    package: "p",
    version: "2.0.0",
    tarballIntegrity: null,
    entryPoints: [{ subpath: ".", declarationFile: null, names: [], unresolvedStarReexports: [] }],
  };
  const present: PackageSurface = {
    package: "p",
    version: "1.0.0",
    tarballIntegrity: null,
    entryPoints: [{ subpath: ".", declarationFile: "index.d.ts", names: [], unresolvedStarReexports: [] }],
  };

  expect(diffSurface(present, missing).some((f) => f.t === "SurfaceUnreadable")).toBe(true);
  // CONTROL: two READ empty surfaces produce nothing. So the row above comes
  // from the null declaration file, not from emptiness.
  expect(diffSurface(present, present)).toEqual([]);
});

// ── FALSIFIER 6: THE READER PARSES THE FORMS IT CLAIMS TO ────────────────────

test("FALSIFIER 6: export lists, aliases, type modifiers and default are all read", () => {
  const s = extractDeclaredSurface(`
    declare const internal: number;
    export { internal as Public, type Shape };
    export declare function go(): void;
    export interface Shape { a: number }
    export type Alias = Shape;
    export declare class Thing {}
    export default go;
    export * as ns from "./other.js";
  `);
  expect(s.names).toEqual(["Alias", "Public", "Shape", "Thing", "default", "go", "ns"]);
  // `export * as ns` names one thing at this level, so it is NOT unresolved.
  expect(s.unresolvedStarReexports).toEqual([]);
});

test("FALSIFIER 6: a name that appears only inside a comment is not read as an export", () => {
  // The mutation this catches: dropping `stripComments`. Every published `.d.ts`
  // carries doc comments containing example code, and reading those as
  // declarations would manufacture exports that do not exist — producing
  // `ExportRemoved` rows for names the package never had.
  //
  // NOTE THE INDENTATION, because the first version of this test was VACUOUS and
  // a mutation run caught it. Written with the commented code indented under a
  // leading `*` or `//`, the test passes with `stripComments` deleted — the
  // declaration regexes are anchored at `^\s*export`, so a line beginning with
  // `*` or `/` never matched in the first place. Only a comment whose inner lines
  // begin with `export` at the start of the line actually exercises the stripper.
  const s = extractDeclaredSurface(
    [
      "/*",
      "export declare function ghost(): void;",
      "*/",
      "//",
      "// eslint-disable-next-line",
      "export declare const real: number;",
    ].join("\n"),
  );
  expect(s.names).toEqual(["real"]);

  // The other half: a single-line comment whose content starts at column 0.
  const s2 = extractDeclaredSurface(
    ["//export declare const alsoGhost: number;", "export declare const kept: number;"].join("\n"),
  );
  expect(s2.names).toEqual(["kept"]);
});

// ── FALSIFIER 7: THE CONSUMER SPLIT IS THE POINT ─────────────────────────────
//
// Code sites and non-code sites fail in completely different ways, and only the
// first fails loudly. Mutation that must break this: collapse the two arms of
// `classifyConsumer`.

test("FALSIFIER 7: code sites win over non-code sites, and absence is its own row", () => {
  expect(classifyConsumer("X", ["a.ts"], ["b.css"])).toEqual({
    t: "RemovedExportReferencedInCode",
    name: "X",
    sites: ["a.ts"],
  });
  expect(classifyConsumer("X", [], ["b.css"])).toEqual({
    t: "RemovedExportOnlyInNonCodeText",
    name: "X",
    sites: ["b.css"],
  });
  expect(classifyConsumer("X", [], [])).toEqual({ t: "RemovedExportUnreferenced", name: "X" });
});

// ── FALSIFIER 8: NO ROW NAMES AN INTENT ──────────────────────────────────────
//
// `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`. A mechanism
// that recognises something reports the FACT; the reading is the caller's.
// Mutation that must break this: add a `Breaking` / `Unsafe` / `Malicious` row.

test("FALSIFIER 8: every emitted fact tag names an observation, never a verdict", () => {
  const permitted = new Set([
    "ExportRemoved",
    "ExportAdded",
    "EntryPointRemoved",
    "EntryPointAdded",
    "SurfaceUnreadable",
  ]);
  const emitted = new Set(diffSurface(RRP_3, RRP_4).map((f) => f.t));
  for (const t of emitted) expect(permitted.has(t)).toBe(true);

  // CONTROL: the diff really did emit something, so the loop is not empty.
  expect(emitted.size).toBeGreaterThan(0);
});

// ── FALSIFIER 9: THE URL BUILDER ESCAPES EVERY SEPARATOR ─────────────────────
//
// CodeQL found this one in review, not a human: `pkg.replace("/", "%2f")`
// replaces only the FIRST occurrence. Today an npm name carries at most one `/`,
// so it was correct by accident. This test makes it correct by construction.
//
// Mutation that must break it: `replaceAll` back to `replace`.

test("FALSIFIER 9: every separator in a package name is escaped, not just the first", () => {
  expect(packumentUrl("https://r", "@noble/post-quantum", "0.7.0")).toBe("https://r/@noble%2fpost-quantum/0.7.0");
  // The forcing case: two separators. `replace` leaves the second raw, which
  // would silently address a DIFFERENT registry path.
  expect(packumentUrl("https://r", "@a/b/c", "1.0.0")).toBe("https://r/@a%2fb%2fc/1.0.0");
  // CONTROL: an unscoped name is untouched, so the assertions above are not
  // passing because everything is escaped.
  expect(packumentUrl("https://r", "semver", "7.8.5")).toBe("https://r/semver/7.8.5");
});
