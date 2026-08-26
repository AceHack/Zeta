// TOY MODEL — the Tier 0 export-surface diff, as a pure decision.
//
// `toy` per `.claude/rules/toy-is-free-metered-must-be-earned.md`. What is
// unmetered here is the ROUTING POLICY, not the diff: the set difference between
// two published export lists is a fact, and the falsifiers below check it against
// real captured registry surfaces. What has no falsifier yet is the claim that
// routing `ExportRemoved + tests-green` to a cheap model is worth the runner-second
// it costs. That needs observed escalation outcomes, and there are none.
//
// ── WHAT THIS ADDS TO `toy-classify.ts`, AND WHY IT IS A SEPARATE SIGNAL ──────
//
// `toyClassify` reads two signals about the PUBLISHER: did their past semver
// claims hold, and is the artifact what it says it is. Both are properties of
// the other end of the wire. Neither can see the only question a consumer
// actually has:
//
//     Does the new version still export the names OUR tree calls?
//
// That is a set difference between two published `.d.ts` files. It needs no
// model, no history, and no trust in anybody — and it is exactly the class that
// broke this repo's Dependabot lane on 2026-08-26. It is therefore a THIRD
// signal, joined the same way the other two are: by taking the maximum severity,
// never by arithmetic. A publisher with a spotless adherence record who removes
// an export we call has still removed an export we call.
//
// ── THE ROUTING RULE, AND THE INVERSION IN IT ────────────────────────────────
//
// The obvious rule is "only updates that break things get routed for more
// intelligence." The obvious rule is incomplete, and the case that shows it is
// on file:
//
//   `react-resizable-panels` 3 -> 4 renamed `PanelGroup` -> `Group` (loud, a type
//   error) AND changed the DOM contract from `data-panel-group-direction` to
//   `data-group`/`data-panel`/`data-separator` with no direction attribute at all
//   (silent). Every `data-[panel-group-direction=vertical]:*` Tailwind utility
//   became a selector that can never match. `tsc` passed. The tests passed. The
//   styling was gone.
//
// It broke nothing observable because the components involved have no consumers,
// so nothing COULD fail. Which is the point:
//
//     A FAILING test tells you where to look.
//     A PASSING test after a surface change tells you the tests do not cover it.
//
// So this module escalates on **break OR unexplained surface change**, and it
// treats `TestsNotRun` as strictly worse than `TestsPassed` — a check that did
// not run contributes no evidence, and reading it as green is the vacuity class.
//
// ── WHAT TIER 0 CANNOT SEE. STATED HERE BECAUSE IT IS LOAD-BEARING. ──────────
//
// A dead CSS selector is not in any type system. `data-[panel-group-direction=
// vertical]:flex-col` is a well-formed Tailwind class that compiles, ships, and
// matches nothing. No export list contains it, no `tsc` run reads it, and no
// amount of mechanical checking finds it — the fact that would have to be
// compared is "which DOM attributes does the rendered output carry", which is a
// RUNTIME observation of a component nobody renders.
//
// This module therefore does not claim to catch that half. It catches the loud
// half of the same update, names the symbol, and — where the removed name still
// appears in text no compiler reads — says so as `RemovedExportOnlyInNonCodeText`.
// That is the closest mechanical proxy for the silent half, and it is a proxy,
// not the thing.
//
// Every row below names a FACT, never an intent
// (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`). There is no
// `Breaking`, no `Unsafe`, no `BadRelease`.

// ── Facts about the published surface ────────────────────────────────────────

/// Neutral rows about the set difference between two versions' export lists.
///
/// EVERY ROW CARRIES A `subpath`, and that is not bookkeeping. A package's export
/// surface is a MAP from entry point to names, not one flat list, and flattening
/// it produces false negatives on real packages. `@noble/post-quantum` is the
/// case that forced this file to be written twice: its root `index.d.ts` is
/// literally `export {};` and the entire surface lives under subpaths
/// (`./hybrid.js`, `./ml-kem.js`, ...). The first version of this module read the
/// root only, found nothing, and reported a clean read of an empty surface —
/// which is a check that cannot fail wearing the costume of a check that passed.
/// A union over all entry points fixes that case and introduces another: a name
/// that MOVES between two subpaths is in both unions, so the union reports no
/// change while every consumer importing it from the old subpath breaks.
export type SurfaceFact =
  /// A name exported at this entry point by the old version is absent from it in
  /// the new one. Includes the case where the name moved to another subpath.
  | { readonly t: "ExportRemoved"; readonly subpath: string; readonly name: string }
  /// A name present at this entry point in the new version and not the old.
  /// Recorded because a rename is a removal AND an addition, and the pair is what
  /// a migration author needs. Additions never escalate on their own.
  | { readonly t: "ExportAdded"; readonly subpath: string; readonly name: string }
  /// An entry point the old version published is gone. Distinct from removing
  /// every name from it: the import specifier itself no longer resolves.
  | { readonly t: "EntryPointRemoved"; readonly subpath: string }
  /// An entry point the new version publishes and the old did not.
  | { readonly t: "EntryPointAdded"; readonly subpath: string }
  /// The surface could not be determined. THIS IS NOT "no change" — it is the
  /// absence of a reading, and it must never be reported as a clean diff.
  /// Two ordinary causes: `export * from "./x"` whose target was not resolved,
  /// and an entry point that resolved to no declaration file at all.
  | { readonly t: "SurfaceUnreadable"; readonly subpath: string; readonly reason: string };

/// Whether OUR tree names a removed export, and through what kind of surface.
/// The distinction between the last two rows is the whole reason this type
/// exists: a name a compiler reads and a name only a string reads fail in
/// completely different ways, and only the first one fails loudly.
export type ConsumerFact =
  /// The removed name appears in source a compiler or bundler resolves.
  | {
      readonly t: "RemovedExportReferencedInCode";
      readonly name: string;
      readonly sites: readonly string[];
    }
  /// The removed name appears ONLY in text no compiler reads — a CSS selector,
  /// a template literal, a config string, a docs example. The mechanical proxy
  /// for the silent half described above.
  | {
      readonly t: "RemovedExportOnlyInNonCodeText";
      readonly name: string;
      readonly sites: readonly string[];
    }
  /// The removed name appears nowhere in our tree. Neutral, and NOT a clean
  /// bill: see the routing rule.
  | { readonly t: "RemovedExportUnreferenced"; readonly name: string };

/// What the free runner's own build actually did. `TestsNotRun` is a distinct
/// value on purpose — a required check that never ran contributes zero evidence,
/// and collapsing it into `TestsPassed` is how a check that did not run comes to
/// look like one that passed.
export type BuildOutcome = "TestsPassed" | "TestsFailed" | "TestsNotRun";

// ── The ladder ───────────────────────────────────────────────────────────────

/// Where a proposal is routed. Named by what the tier COSTS, because that is the
/// property the routing is trading.
export type Tier =
  /// Terminates on the free runner with no model involved.
  | "Tier0Terminal"
  /// A cheap model on the free runner: triage a failure, or look at a surface
  /// change nothing noticed. Free, so the bar for sending work here is low.
  | "Tier1Triage"
  /// Off the free runners: write a migration, judge a semantic change. This is
  /// the only tier that costs money, so the routing must justify reaching it.
  | "Tier2Semantic";

export const TIER_RANK = {
  Tier0Terminal: 0,
  Tier1Triage: 1,
  Tier2Semantic: 2,
} as const;

export interface Routing {
  readonly tier: Tier;
  readonly outcome: BuildOutcome;
  readonly surfaceFacts: readonly SurfaceFact[];
  readonly consumerFacts: readonly ConsumerFact[];
}

// ── Reading a surface out of a declaration file ──────────────────────────────

/// What one `.d.ts` file declares, plus what it DEFERS to another file.
///
/// The second field is the honesty: a declaration file that says
/// `export * from "./core.js"` has an export surface this function cannot see.
/// Returning the unresolved specifiers rather than silently returning a short
/// list is what stops a partial read from being reported as a complete one.
export interface DeclaredSurface {
  readonly names: readonly string[];
  readonly unresolvedStarReexports: readonly string[];
}

// NOTE `[ \t]` RATHER THAN `\s` THROUGHOUT. Two reasons, and the second is a
// correctness bug the first would have hidden: (a) `\s` matches a newline, so
// `^\s*export\s+declare` could span lines and read a declaration that is not
// there, and (b) adjacent `\s`-quantifiers over a shared alphabet backtrack
// super-linearly on adversarial input — a published `.d.ts` is attacker-supplied
// text from this check's point of view, so that matters.
const WS = "[ \\t]";
const IDENT = "([A-Za-z_$][\\w$]*)";
const DECLARERS = "(?:function|const|let|var|class|enum|namespace)";

const DECLARATION_FORMS = [
  // `export declare function foo(...)`, `export declare const x: T`, `export declare abstract class C`.
  new RegExp(
    `^${WS}*export${WS}+declare${WS}+(?:async${WS}+)?(?:abstract${WS}+)?(?:${DECLARERS}|class)${WS}+${IDENT}`,
    "gm",
  ),
  // `export function foo(...)` / `export const x` — emitted by some generators.
  new RegExp(`^${WS}*export${WS}+(?:async${WS}+)?(?:abstract${WS}+)?(?:${DECLARERS}|class)${WS}+${IDENT}`, "gm"),
  // `export interface Foo` / `export declare interface Foo`
  new RegExp(`^${WS}*export${WS}+(?:declare${WS}+)?interface${WS}+${IDENT}`, "gm"),
  // `export type Foo = ...` / `export declare type Foo = ...`
  new RegExp(`^${WS}*export${WS}+(?:declare${WS}+)?type${WS}+${IDENT}`, "gm"),
];

/// `export { A, B as C, default as D }` — the exported name is the one AFTER
/// `as` where an alias is present, which is the whole reason this is parsed
/// rather than grepped.
const EXPORT_LIST = new RegExp(`^${WS}*export${WS}*\\{([^}]*)\\}`, "gm");

const STAR_REEXPORT = new RegExp(
  `^${WS}*export${WS}*\\*${WS}*(?:as${WS}+${IDENT}${WS}+)?from${WS}*['"]([^'"]+)['"]`,
  "gm",
);

const DEFAULT_EXPORT = new RegExp(`^${WS}*export${WS}+default${WS}`, "m");

/// Ordinal (code-unit) comparison, never `localeCompare` — the sorted name lists
/// are compared byte-for-byte across runs and across the four oracles, and a
/// culture-sensitive collation would order them differently per machine.
/// `.claude/rules/culture-invariant-by-default.md`.
export function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/// Strip comments so a name inside a doc comment or an example is not read as a
/// declaration. Block comments first, then line comments.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/// Extract the top-level named export surface of a single `.d.ts` source.
///
/// Pure and total: string in, sorted names out. No filesystem, no network, no
/// clock. It is deliberately a text reader rather than a TypeScript-compiler
/// call — the check must run on a free runner in seconds against arbitrary
/// published packages, and the compiler cannot type-check a package it cannot
/// resolve the dependencies of.
///
/// The cost of that choice is stated rather than hidden: this reads the FORMS
/// listed above and nothing else, and it cannot follow a re-export. Anything it
/// cannot follow comes back in `unresolvedStarReexports`, and the diff turns
/// that into `SurfaceUnreadable` rather than into silence.
const BARE_IDENT = /^[A-Za-z_$][\w$]*$/;
// Anchored at the END and capturing only what follows `as`. The earlier form
// `^(.+?)[ \t]+as[ \t]+…$` paired a lazy `.+?` with `[ \t]+`, which backtracks
// super-linearly; the local name before `as` is never used, so there is nothing
// to capture there.
const ALIAS_CLAUSE = /[ \t]as[ \t]+([A-Za-z_$][\w$]*)$/;

/// The exported name of one clause inside `export { ... }`, or `null` when the
/// clause is not a plain identifier. `B as C` exports `C`, which is the whole
/// reason this is parsed rather than grepped.
function exportedNameOfClause(rawClause: string): string | null {
  const clause = rawClause.trim();
  if (clause.length === 0) return null;
  // `type` modifier inside an export list: `export { type Foo }`.
  const withoutModifier = clause.replace(/^type[ \t]+/, "").trim();
  const asMatch = ALIAS_CLAUSE.exec(withoutModifier);
  const exported = asMatch === null ? withoutModifier : asMatch[1];
  if (exported === undefined) return null;
  return BARE_IDENT.test(exported) ? exported : null;
}

function collectDeclaredNames(source: string, into: Set<string>): void {
  for (const form of DECLARATION_FORMS) {
    form.lastIndex = 0;
    for (const m of source.matchAll(form)) {
      if (m[1] !== undefined) into.add(m[1]);
    }
  }
}

function collectExportListNames(source: string, into: Set<string>): void {
  EXPORT_LIST.lastIndex = 0;
  for (const m of source.matchAll(EXPORT_LIST)) {
    for (const rawClause of (m[1] ?? "").split(",")) {
      const exported = exportedNameOfClause(rawClause);
      if (exported !== null) into.add(exported);
    }
  }
}

/// `export * as ns from "./x"` names `ns` HERE; a bare `export * from "./x"`
/// names nothing here and is returned as unresolved.
function collectStarReexports(source: string, into: Set<string>): string[] {
  const unresolved: string[] = [];
  STAR_REEXPORT.lastIndex = 0;
  for (const m of source.matchAll(STAR_REEXPORT)) {
    const alias = m[1];
    if (alias === undefined) unresolved.push(m[2] ?? "");
    else into.add(alias);
  }
  return unresolved;
}

export function extractDeclaredSurface(dtsSource: string): DeclaredSurface {
  const source = stripComments(dtsSource);
  const names = new Set<string>();

  collectDeclaredNames(source, names);
  collectExportListNames(source, names);
  if (DEFAULT_EXPORT.test(source)) names.add("default");
  const unresolved = collectStarReexports(source, names);

  return {
    names: [...names].toSorted(compareOrdinal),
    unresolvedStarReexports: unresolved.toSorted(compareOrdinal),
  };
}

// ── The diff ─────────────────────────────────────────────────────────────────

/// One published entry point and what it declares.
export interface EntryPointSurface {
  /// The specifier a consumer writes, e.g. `.` or `./hybrid.js`.
  readonly subpath: string;
  /// The declaration file this entry point resolved to, or `null` when none
  /// could be found. `null` is a reading failure, not an empty surface, and the
  /// diff keeps the two apart.
  readonly declarationFile: string | null;
  readonly names: readonly string[];
  readonly unresolvedStarReexports: readonly string[];
}

/// A whole package version's surface: the map, plus the integrity string of the
/// exact tarball it was read from, so a later reader can check rather than trust.
export interface PackageSurface {
  readonly package: string;
  readonly version: string;
  readonly tarballIntegrity: string | null;
  readonly entryPoints: readonly EntryPointSurface[];
}

/// Every reason this entry point's surface was not fully read, as rows.
/// Reported and NOT suppressing the name diff: a partial diff is worth having as
/// long as nobody mistakes it for a total one.
function unreadableRows(subpath: string, side: "old" | "new", e: EntryPointSurface): SurfaceFact[] {
  const rows: SurfaceFact[] = [];
  if (e.declarationFile === null) {
    rows.push({
      t: "SurfaceUnreadable",
      subpath,
      reason: `${side} version resolved no declaration file for '${subpath}'`,
    });
  }
  for (const specifier of e.unresolvedStarReexports) {
    rows.push({
      t: "SurfaceUnreadable",
      subpath,
      reason: `${side} version re-exports '${specifier}' and its names were not read`,
    });
  }
  return rows;
}

/// The set difference in both directions at one entry point.
function nameRows(subpath: string, beforeNames: readonly string[], afterNames: readonly string[]): SurfaceFact[] {
  const rows: SurfaceFact[] = [];
  const afterSet = new Set(afterNames);
  const beforeSet = new Set(beforeNames);
  for (const name of beforeNames) {
    if (!afterSet.has(name)) rows.push({ t: "ExportRemoved", subpath, name });
  }
  for (const name of afterNames) {
    if (!beforeSet.has(name)) rows.push({ t: "ExportAdded", subpath, name });
  }
  return rows;
}

/// Set difference between two package surfaces, entry point by entry point, as
/// neutral rows.
///
/// A rename shows up as a removal AND an addition, and both are emitted: the
/// pair is what a migration author needs, and collapsing them into an inferred
/// "renamed X to Y" would be attaching a conclusion the set difference cannot
/// support (`PanelGroup` -> `Group` is obvious to a reader and is not derivable
/// from the sets).
///
/// Pure and total. Two `PackageSurface` values in, sorted rows out.
export function diffSurface(before: PackageSurface, after: PackageSurface): readonly SurfaceFact[] {
  const facts: SurfaceFact[] = [];
  const beforeByPath = new Map(before.entryPoints.map((e) => [e.subpath, e]));
  const afterByPath = new Map(after.entryPoints.map((e) => [e.subpath, e]));

  const allSubpaths = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])].toSorted(compareOrdinal);

  for (const subpath of allSubpaths) {
    const b = beforeByPath.get(subpath);
    const a = afterByPath.get(subpath);

    if (b === undefined) {
      facts.push({ t: "EntryPointAdded", subpath });
    } else if (a === undefined) {
      // Every name that entry point carried is unreachable at that specifier now.
      facts.push({ t: "EntryPointRemoved", subpath });
      for (const name of b.names) facts.push({ t: "ExportRemoved", subpath, name });
    } else {
      facts.push(...unreadableRows(subpath, "old", b), ...unreadableRows(subpath, "new", a));
      facts.push(...nameRows(subpath, b.names, a.names));
    }
  }

  return facts;
}

// ── Reading our own tree ─────────────────────────────────────────────────────

/// Which of our files mention a removed name, split by whether a compiler reads
/// the file. Pure: the caller does the scanning and hands the two site lists in,
/// so the classification itself is replayable from a fixture.
///
/// THE CALLER MUST SCOPE THE SITES THROUGH IMPORTS, and this is not a style note.
/// Measured on the `react-resizable-panels` case at the pre-migration tree
/// (611251197f, 172 code files): a naive word-boundary grep for the 30 removed
/// names returns 3 hits, one of which — `intersects` — is the word inside the
/// comment "curve self-intersects", in a file that never imports the package.
/// Scoping to names actually imported from the package returns exactly 2, which
/// are exactly the two symbols the migration had to change.
///
/// Run against the POST-migration tree the naive scan is worse: all three hits
/// are comments, one of them the migration note that spells `PanelGroup` while
/// describing its removal. A grep-derived site list therefore reports a symbol as
/// live because someone documented that it is dead.
///
/// This function cannot enforce that, which is precisely why it takes the lists
/// rather than computing them — an unscoped caller gets a wrong answer loudly
/// rather than a scanner that silently over-reports.
export function classifyConsumer(
  name: string,
  codeSites: readonly string[],
  nonCodeSites: readonly string[],
): ConsumerFact {
  if (codeSites.length > 0) return { t: "RemovedExportReferencedInCode", name, sites: [...codeSites] };
  if (nonCodeSites.length > 0) return { t: "RemovedExportOnlyInNonCodeText", name, sites: [...nonCodeSites] };
  return { t: "RemovedExportUnreferenced", name };
}

// ── The routing join ─────────────────────────────────────────────────────────

function raise(current: Tier, candidate: Tier): Tier {
  return TIER_RANK[candidate] > TIER_RANK[current] ? candidate : current;
}

/// Route one proposal. Pure and total.
///
/// The combinator is a JOIN — the maximum of the tier each input argues for —
/// exactly as `toyClassify` joins its two signals. Nothing is added, averaged, or
/// weighted, so a green test run can never buy down a surface change. That is the
/// inversion this module exists for: under any weighted scheme, "tests passed"
/// would reduce the score, and the case where it must not is precisely the case
/// where the tests do not cover the thing that changed.
export function routeUpdate(
  outcome: BuildOutcome,
  surfaceFacts: readonly SurfaceFact[],
  consumerFacts: readonly ConsumerFact[],
): Routing {
  let tier: Tier = "Tier0Terminal";

  // 1. The build's own verdict. Two DIFFERENT conditions with one destination:
  //
  //   TestsFailed — something is red and Tier 0 does not know why. Naming the
  //     flake-vs-real split and the failing file is a cheap model's job.
  //   TestsNotRun — a check that did not run is not a check that passed. It
  //     carries no evidence in either direction, so it cannot terminate anything.
  //
  // Only `TestsPassed` leaves the tier where it is, and that is the whole
  // content of this step.
  if (outcome !== "TestsPassed") {
    tier = raise(tier, "Tier1Triage");
  }

  // 2. A surface we could not read is not a surface that did not change.
  for (const f of surfaceFacts) {
    if (f.t === "SurfaceUnreadable") tier = raise(tier, "Tier1Triage");
  }

  // 3. The removals, by how our tree reaches them.
  for (const f of consumerFacts) {
    switch (f.t) {
      // Both of these reach Tier 2, for DIFFERENT reasons that happen to share a
      // destination — kept as one arm because a duplicated body is a duplicated
      // body, and the reasons live in the comments rather than in dead code.
      //
      //   ReferencedInCode  — Tier 0 has already answered "which symbol, which
      //     file", the question Tier 1 exists to answer. So this SKIPS Tier 1:
      //     what remains is writing the migration, a semantic job.
      //   OnlyInNonCodeText — the name survives only in text no compiler reads.
      //     Nothing will fail, and something is almost certainly wrong. The
      //     dangerous class.
      case "RemovedExportReferencedInCode":
      case "RemovedExportOnlyInNonCodeText":
        tier = raise(tier, "Tier2Semantic");
        break;
      case "RemovedExportUnreferenced":
        // The inversion, stated as code. The API surface shrank and every test
        // stayed green — which is either genuinely unused, or used through a
        // surface the tests do not cover. Tier 0 cannot tell those apart, and
        // Tier 1 is free, so it goes to Tier 1 rather than terminating.
        tier = raise(tier, "Tier1Triage");
        break;
    }
  }

  return { tier, outcome, surfaceFacts: [...surfaceFacts], consumerFacts: [...consumerFacts] };
}
