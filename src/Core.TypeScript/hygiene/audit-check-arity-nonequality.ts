#!/usr/bin/env bun
// audit-check-arity-nonequality.ts -- the NON-EQUALITY half of the check-arity class.
//
// WHY THIS FILE EXISTS
// --------------------
// `audit-check-arity.ts` inspects EQUALITY only: `=`, `Assert.Equal`, `expect().toBe/toEqual`,
// `assert.equal`. Its own PR (#14587) named the gap and declined to size it:
//
//     "Non-equality checks are entirely outside the detector. A 2-safety claim discharged with
//      `Assert.True`, `Assert.Contains`, or a bespoke predicate is invisible -- and sabotage 1
//      shows exactly that: the taint-style check 'the minted card content carries no clock data'
//      PASSED under a live clock leak, because the leak carried the phase as a bare integer.
//      Largest unsearched region, unsized."
//
// It is now sized: 24,859 non-equality assertion sites across 1,943 test files (6,078 F#,
// 18,781 TypeScript). The distribution is in the workitem. Most are CORRECT; this file gates
// only what can be gated soundly and counts the rest.
//
// THE DEFECT IS NOT "USES A NON-EQUALITY ASSERTION"
// ------------------------------------------------
// It is the same class as before -- A CHECK WHOSE ARITY IS LOWER THAN THE PROPERTY IT CLAIMS --
// wearing a subtler form than `X = X`. Two shapes were hunted:
//
//   SHAPE A  an ABSENCE assertion (`not (x.Contains "phase")`) standing in for a TAINT claim.
//            It passes whenever the leak takes a form the predicate does not recognise. This is
//            a 2-safety property discharged by a ONE-RUN STRING SEARCH. Live instance found and
//            fixed in `tools/setup/persona-keys/machine.test.ts`: the claim was "the registry
//            holds ONLY the public key -- no private bytes anywhere in it", the check was
//            `not.toContain("PRIVATE")` plus a PEM-armor regex, and publishing the COMPLETE
//            private key base64-encoded passed all of it (27 tests / 128 expect() calls, green).
//
//   SHAPE B  an assertion that CANNOT FAIL ON ITS INPUT -- `Assert.True(xs.Length >= 0)`.
//            Live instance found and fixed in `DurableDiplomacyRankGate.Tests.fs`, where it was
//            worse than vacuous: the `match` arm holding it was never reached, so it was arity ZERO.
//
// WHAT IS GATED, AND WHY ONLY THIS MUCH
// -------------------------------------
//   R4 (GATE) -- provably-unfalsifiable comparisons. Every pattern here is a THEOREM about the
//     expression's type, not an inference about the program: a .NET `Set.count`/`List.length` and
//     a JS `.length` are non-negative for every value, so `>= 0` cannot fail; and `X >= X` is
//     reflexivity. Rice does not bite because nothing semantic is being decided -- these are
//     recognised syntactically and are true by the type's own contract.
//
//     DELIBERATELY NOT GATED: `Assert.True(true)`. All 8 live instances are the success leg of a
//     discriminating `match` whose OTHER leg is `Assert.True(false, "...")`. The enclosing check
//     can fail, so the property's arity matches its claim and flagging the line would be a false
//     positive -- the same "do not round bucket 2 up to bucket 1" refusal that made the first
//     sweep credible, applied in the direction that costs us a finding.
//
//   R5 (CENSUS, NOT A GATE) -- absence-by-search discharging a taint or 2-safety claim.
//     This is the shape that produced the live bug, and it still may not be a gate: of the 10
//     sites where an absence assertion sits under a name that `declaresTwoSafety`, SIX are
//     correct -- they are backed by an exact-equality pin on the whole output, or by a positive
//     capability assertion. A gate at 60% false positives is not a gate, it is a nuisance that
//     gets suppressed. So the population is COUNTED and ratcheted in both directions, exactly as
//     R2 counts self-comparisons without judging them.
//
// WHAT IS STILL NOT DECIDABLE, AND MUST NOT BE FAKED
// --------------------------------------------------
// Whether a given absence predicate is COMPLETE for the leak it denies is undecidable (Rice
// 1953) -- it asks whether two programs agree on all inputs. Arity therefore stays DECLARED,
// never inferred, and the declaration channel remains the test's NAME. Runtime read-set tracing
// is still specifically NOT the answer: an observed read-set on one input is neither an upper
// nor a lower bound on dependence across all inputs, so it is unsound in both directions.
//
// ANCHORS
//   Clarkson & Schneider, Hyperproperties, CSF 2008 / JCS 18(6):1157 (2010) -- k-safety.
//   Goguen & Meseguer, Security Policies and Security Models, IEEE S&P 1982 -- noninterference.
//   Rice, Classes of recursively enumerable sets and their decision problems, TAMS 74 (1953).
//   Denning & Denning, Certification of programs for secure information flow, CACM 20(7) 1977
//     -- taint as an information-flow lattice; a string search is not a lattice join.

import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { argsOf, balanced, declaresTwoSafety, norm, stripComments } from "./audit-check-arity.ts";

export const NONEQ_CENSUS_PATH = "registry/check-arity-nonequality-census.json";

/**
 * Excluded from the corpus.
 *
 * This file states every flagged pattern as a literal (`Set.count caps >= 0`, `PRIVATE`, the
 * length forms) and its falsifier suite states them again as deliberately-broken FIXTURES inside
 * template strings. Scanning either would make the audit report its own documentation as findings
 * -- and, worse, would let a fixture satisfy the census, so the rule could be "passed" by text
 * that never runs. Same reason and same shape as `audit-scan-floor-routes.ts`'s SELF_EXCLUDED.
 *
 * Kept as an ENUMERABLE list rather than a regex so a reader can see the entire carve-out at
 * once, and so the test file can quote it and fail if it ever grows silently.
 */
export const SELF_EXCLUDED: readonly string[] = [
  "src/Core.TypeScript/hygiene/audit-check-arity-nonequality.ts",
  "src/Core.TypeScript/hygiene/audit-check-arity-nonequality.test.ts",
];

export const RULE_ANCHORS = [
  ".claude/rules/dv2-data-split-discipline-activated.md #7 (noninterference)",
  ".claude/rules/manifesto-13-specifications.md s13",
  ".claude/rules/toy-is-free-metered-must-be-earned.md",
];

// ---------------------------------------------------------------------------
// site model
// ---------------------------------------------------------------------------

export interface Site {
  readonly path: string;
  readonly line: number;
  readonly unit: string;
  /** `Assert.True`, `not.toContain`, ... */
  readonly verb: string;
  /** F#: the whole argument list. TS: the `expect(...)` argument. */
  readonly subject: string;
  /** TS only: the MATCHER argument. `>= 0` and `>= 1` are different claims. */
  readonly matcherArg: string;
}

/** Equality-family verbs -- already inspected by `audit-check-arity.ts`, skipped here. */
const FS_EQUALITY = new Set(["Equal", "StrictEqual", "Same"]);
const TS_EQUALITY = new Set(["toBe", "toEqual", "toStrictEqual"]);

const FS_ATTR = /^\s*\[<\s*(?:Fact|Property|Theory)/;
const TS_UNIT = /^\s*(?:it|test)(?:\.\w+)?\s*\(\s*["'`](.+?)["'`]/;

export function scanNonEquality(path: string, text: string): Site[] {
  const lang: "fs" | "ts" = /\.fsx?$/.test(path) ? "fs" : "ts";
  const lines = text.split("\n");
  const sites: Site[] = [];
  let unit = "<module>";

  for (let i = 0; i < lines.length; i++) {
    const stripped = stripComments(lines[i]!, lang);
    if (!stripped.trim()) continue;
    if (lang === "fs" && FS_ATTR.test(lines[i]!)) {
      unit = "<pending>";
      continue;
    }
    if (lang === "ts") {
      const um = stripped.match(TS_UNIT);
      if (um) {
        unit = um[1]!;
        continue;
      }
    }

    let joined = stripped;
    let j = i;
    while (!balanced(joined) && j + 1 < lines.length && j - i < 25) {
      j++;
      if (lang === "ts" && TS_UNIT.test(lines[j]!)) break;
      joined += " " + stripComments(lines[j]!, lang);
    }
    const trimmed = joined.trim();

    if (lang === "fs") {
      const nm = trimmed.match(/^(?:let|and)\s+(?:rec\s+)?(?:private\s+)?(``[^`]+``|[A-Za-z_][A-Za-z0-9_']*)/);
      if (nm && unit === "<pending>") unit = nm[1]!.replace(/`/g, "");
      const re = /Assert\.([A-Za-z]+)(?:<[^()]*>)?\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(trimmed)) !== null) {
        const verb = m[1]!;
        if (FS_EQUALITY.has(verb)) continue;
        const a = argsOf(trimmed.slice(m.index + m[0]!.length - 1));
        sites.push({ path, line: i + 1, unit, verb: "Assert." + verb, subject: (a ?? []).join(" , "), matcherArg: "" });
      }
    } else {
      const re = /expect\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(trimmed)) !== null) {
        const call = trimmed.slice(m.index + "expect".length);
        const a = argsOf(call);
        if (!a || a.length !== 1) continue;
        const after = call.slice(call.indexOf(a[0]!) + a[0]!.length);
        const mm = after.match(/^\)\s*(?:\.\s*(?:resolves|rejects)\s*)*(\.\s*not)?\s*\.\s*([A-Za-z]+)\s*(\()?/);
        if (!mm) continue;
        const negated = mm[1] !== undefined;
        const verb = mm[2]!;
        if (!negated && TS_EQUALITY.has(verb)) continue;
        let matcherArg = "";
        if (mm[3] !== undefined) {
          const ma = argsOf(after.slice(mm[0]!.length - 1));
          if (ma) matcherArg = ma.join(" , ");
        }
        sites.push({
          path,
          line: i + 1,
          unit,
          verb: (negated ? "not." : "") + verb,
          subject: a[0]!,
          matcherArg,
        });
      }
    }
  }
  return sites;
}

// ---------------------------------------------------------------------------
// R4 -- provably-unfalsifiable comparisons (GATE)
// ---------------------------------------------------------------------------

/**
 * A .NET `Set.count` / `List.length` / `.Length` / `.Count` and a JS `.length` / `.size` are
 * NON-NEGATIVE for every value of their argument. `>= 0` on one of them is therefore a theorem,
 * not a test. `indexOf` / `findIndex` are DELIBERATELY absent: they return -1 when not found,
 * so `>= 0` on them asserts "was found" and is a real check (measured: 10 such sites).
 */
const NONNEG_FS =
  /(?:Set\.count|List\.length|Array\.length|Seq\.length|Map\.count|String\.length)\s+[A-Za-z_][\w.']*|\.Length|\.Count\b/;
const NONNEG_TS = /(?:\.length|\.size|\.count)\s*$/;

export interface Tautology {
  readonly site: Site;
  readonly why: string;
}

export function findTautologies(sites: readonly Site[]): Tautology[] {
  const out: Tautology[] = [];
  for (const s of sites) {
    // F#: Assert.True(<non-negative expr> >= 0)
    if (s.verb === "Assert.True" || s.verb === "Assert.False") {
      const body = s.subject.split(/\s*,\s*"/)[0] ?? s.subject;
      const ge = body.match(/^(.*?)\s*>=\s*0(?:\.0)?\s*$/);
      if (ge !== null && s.verb === "Assert.True" && NONNEG_FS.test(ge[1]!)) {
        out.push({
          site: s,
          why: `\`${ge[1]!.trim()}\` is non-negative by construction, so \`>= 0\` holds for every input`,
        });
        continue;
      }
      // reflexive comparison: X >= X / X <= X
      const refl = body.match(/^(.+?)\s*(?:>=|<=)\s*(.+?)\s*$/);
      if (refl !== null && s.verb === "Assert.True" && norm(refl[1]!) === norm(refl[2]!) && norm(refl[1]!).length > 0) {
        out.push({ site: s, why: "both sides normalize to one expression, so the comparison is reflexivity" });
        continue;
      }
    }
    // TS: expect(<length-like>).toBeGreaterThanOrEqual(0)
    if (s.verb === "toBeGreaterThanOrEqual" && /^\s*0\s*$/.test(s.matcherArg) && NONNEG_TS.test(s.subject.trim())) {
      out.push({ site: s, why: "a JS length/size is non-negative for every value, so `>= 0` holds for every input" });
      continue;
    }
    // TS: expect(X).toBeGreaterThanOrEqual(X) / toBeLessThanOrEqual(X)
    if (
      (s.verb === "toBeGreaterThanOrEqual" || s.verb === "toBeLessThanOrEqual") &&
      norm(s.subject) === norm(s.matcherArg) &&
      norm(s.subject).length > 0
    ) {
      out.push({ site: s, why: "subject and bound normalize to one expression, so the comparison is reflexivity" });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// R5 -- absence-by-search under a taint / 2-safety claim (CENSUS)
// ---------------------------------------------------------------------------

const ABSENCE_VERBS = new Set([
  "not.toContain",
  "not.toMatch",
  "not.toContainEqual",
  "not.toHaveProperty",
  "Assert.DoesNotContain",
]);
/** F# `Assert.False(x.Contains "...")` is the same shape spelled differently. */
const FS_ABSENCE_BODY =
  /\.Contains|\.contains|Seq\.exists|List\.exists|Regex\.IsMatch|\.IsMatch|\.StartsWith|\.EndsWith/;
/** A matcher argument naming secret material -- the population the live bug came from. */
const SECRET =
  /PRIVATE|SECRET|PASSWORD|PASSPHRASE|BEGIN [A-Z ]*KEY|token|apiKey|api_key|credential|mnemonic|privKey|privateKey/i;

export function isAbsenceAssertion(s: Site): boolean {
  if (ABSENCE_VERBS.has(s.verb)) return true;
  if (s.verb === "Assert.False" || s.verb === "Assert.Empty") return FS_ABSENCE_BODY.test(s.subject);
  return false;
}

/** An absence assertion that is EITHER under a 2-safety name OR searching for secret material. */
export function findAbsenceUnderClaim(sites: readonly Site[]): Site[] {
  return sites.filter(
    (s) =>
      isAbsenceAssertion(s) &&
      (declaresTwoSafety(s.unit) !== null || SECRET.test(s.matcherArg) || SECRET.test(s.subject)),
  );
}

// ---------------------------------------------------------------------------
// audit
// ---------------------------------------------------------------------------

export interface Census {
  readonly note?: string;
  readonly counts: Record<string, number>;
}

export interface AuditResult {
  readonly scannedFiles: number;
  readonly sites: readonly Site[];
  readonly tautologies: readonly Tautology[];
  readonly censusRose: readonly { readonly path: string; readonly was: number; readonly now: number }[];
  readonly censusFell: readonly { readonly path: string; readonly was: number; readonly now: number }[];
}

const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function auditSources(
  sources: readonly { readonly path: string; readonly text: string }[],
  census: Census,
): AuditResult {
  const sites: Site[] = [];
  for (const s of sources) sites.push(...scanNonEquality(s.path, s.text));

  const tautologies = findTautologies(sites);

  const now = new Map<string, number>();
  for (const s of findAbsenceUnderClaim(sites)) now.set(s.path, (now.get(s.path) ?? 0) + 1);

  const censusRose: { path: string; was: number; now: number }[] = [];
  const censusFell: { path: string; was: number; now: number }[] = [];
  for (const p of new Set([...Object.keys(census.counts), ...now.keys()])) {
    const was = census.counts[p] ?? 0;
    const isNow = now.get(p) ?? 0;
    if (isNow > was) censusRose.push({ path: p, was, now: isNow });
    else if (isNow < was) censusFell.push({ path: p, was, now: isNow });
  }
  // ORDINAL, deliberately not `localeCompare`: the census is a diffable, byte-locked artefact and
  // a locale-dependent order makes the same tree emit different files on different machines.
  // `.claude/rules/culture-invariant-by-default.md`; live failure 081KT07NV0008QG0R001YDB73K.
  censusRose.sort(byPath);
  censusFell.sort(byPath);

  return { scannedFiles: sources.length, sites, tautologies, censusRose, censusFell };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw e;
  }
  for (const d of entries) {
    if (d.name === "node_modules" || d.name === ".git" || d.name === "bin" || d.name === "obj") continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * REPO-WIDE, unlike `audit-check-arity.ts` whose `SCAN_ROOTS = ["tests"]`.
 *
 * That difference is itself a finding of this pass and is deliberate: 1,194 of the tree's 1,230
 * `*.test.ts` files -- 97% -- live OUTSIDE `tests/` (858 under `src/`, 220 under
 * `agentic-organization/`, 65 under `tools/`). Both live bugs fixed alongside this file were in
 * that region, so scanning `tests/` only would have missed the very instances that motivated it.
 */
export const SCAN_DIRS = ["tests", "src", "tools", "agentic-organization", "full-ai-cluster", "demo", "infra"] as const;

/**
 * A floor, because a scanner with no floor cannot report its own narrowing. Measured 1,943
 * scannable files on 2026-08-24. If a future walk change silently stops descending, the census
 * goes quiet and every rule passes by seeing nothing -- which is this file's own subject.
 */
export const MIN_SCANNED_FILES = 1700;

function collect(repoRoot: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const root of SCAN_DIRS) {
    for (const f of walk(join(repoRoot, root))) {
      const rel = relative(repoRoot, f).split(sep).join("/");
      if (seen.has(rel)) continue;
      const isFs = /\.fsx?$/.test(rel) && rel.startsWith("tests/");
      const isTs = /\.(?:test|spec)\.(?:ts|tsx|mts)$/.test(rel);
      if (!isFs && !isTs) continue;
      if (SELF_EXCLUDED.includes(rel)) continue;
      seen.add(rel);
      out.push({ path: rel, text: readFileSync(f, "utf8") });
    }
  }
  return out;
}

export function main(argv: readonly string[]): number {
  const repoRoot = process.cwd();
  const sources = collect(repoRoot);

  if (argv.includes("--emit-census")) {
    const sites: Site[] = [];
    for (const s of sources) sites.push(...scanNonEquality(s.path, s.text));
    const counts: Record<string, number> = {};
    for (const s of findAbsenceUnderClaim(sites)) counts[s.path] = (counts[s.path] ?? 0) + 1;
    const ordered: Record<string, number> = {};
    // Default Array.sort compares by UTF-16 code unit, i.e. ordinal -- what the census needs.
    for (const k of Object.keys(counts).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) ordered[k] = counts[k]!;
    console.log(
      JSON.stringify({ note: "generated by audit-check-arity-nonequality.ts --emit-census", counts: ordered }, null, 2),
    );
    return 0;
  }

  if (argv.includes("--report")) {
    const sites: Site[] = [];
    for (const s of sources) sites.push(...scanNonEquality(s.path, s.text));
    const byVerb = new Map<string, number>();
    for (const s of sites) byVerb.set(s.verb, (byVerb.get(s.verb) ?? 0) + 1);
    console.log(`non-equality assertion sites: ${sites.length} across ${sources.length} files`);
    for (const [v, c] of [...byVerb.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) {
      console.log(`  ${String(c).padStart(6)} ${v}`);
    }
    return 0;
  }

  let census: Census;
  try {
    census = JSON.parse(readFileSync(join(repoRoot, NONEQ_CENSUS_PATH), "utf8")) as Census;
  } catch (e) {
    console.error(`FAIL: cannot read ${NONEQ_CENSUS_PATH}: ${String(e)}`);
    return 1;
  }

  if (sources.length < MIN_SCANNED_FILES) {
    console.error(
      `FAIL: scanned only ${sources.length} test file(s), below the ${MIN_SCANNED_FILES} floor.\n` +
        `    A scanner that quietly stops descending reports a clean census by seeing nothing, which is\n` +
        `    this file's own subject: a check that cannot fail. Fix the walk or move the floor deliberately.`,
    );
    return 1;
  }

  const r = auditSources(sources, census);
  const problems: string[] = [];

  for (const t of r.tautologies) {
    problems.push(
      `${t.site.path}:${t.site.line}: R4 -- this assertion cannot fail on its input.\n` +
        `    test : ${t.site.unit}\n` +
        `    check: ${t.site.verb}(${t.site.subject.slice(0, 160)}${t.site.matcherArg ? ") -> (" + t.site.matcherArg.slice(0, 60) : ""})\n` +
        `    why  : ${t.why}\n` +
        `    Assert the property the surrounding comment claims, or delete the line. A check that\n` +
        `    cannot fail is not a weak check, it is the absence of one wearing coverage.`,
    );
  }
  for (const d of r.censusRose) {
    problems.push(
      `${d.path}: R5 -- absence-under-a-taint-claim count rose ${d.was} -> ${d.now}.\n` +
        `    An absence assertion discharging a taint / 2-safety claim witnesses ONE RENDERING of a\n` +
        `    leak, never its absence. Adjudicate it (vacuous / near-vacuous / correct); if correct --\n` +
        `    typically because an exact-equality pin or a positive assertion carries the claim beside\n` +
        `    it -- raise the count in ${NONEQ_CENSUS_PATH} in the SAME commit.`,
    );
  }
  for (const d of r.censusFell) {
    problems.push(
      `${d.path}: R5 -- absence-under-a-taint-claim count fell ${d.was} -> ${d.now}.\n` +
        `    Good news that must be recorded: lower the count in ${NONEQ_CENSUS_PATH} so the row keeps\n` +
        `    constraining.`,
    );
  }

  if (problems.length > 0) {
    console.error(`FAIL: ${problems.length} problem(s) across ${r.scannedFiles} scanned test files.\n`);
    for (const p of problems) console.error(p + "\n");
    console.error(`Rule anchors: ${RULE_ANCHORS.join(" | ")}`);
    return 1;
  }

  console.log(
    `OK: ${r.scannedFiles} test files scanned; ${r.sites.length} non-equality assertion site(s); ` +
      `0 that cannot fail on their input (R4); ` +
      `${findAbsenceUnderClaim(r.sites).length} absence-under-a-taint-claim counted in ${NONEQ_CENSUS_PATH} (R5).`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
