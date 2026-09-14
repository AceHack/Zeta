#!/usr/bin/env bun
// audit-pr-mutation-coverage.ts — do THIS PR's tests constrain THIS PR's changes?
//
// DRIFT TIER. This never blocks a merge and always exits 0 on a clean run. It exists to report a
// number nobody currently has, not to add a gate nobody agreed to.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE QUESTION, AND WHY A PASSING SUITE DOES NOT ANSWER IT
//
// `Human-Review: none` is already permitted end to end -- the enforcement job short-circuits a
// `none` claim without a forge lookup. So nothing mechanical requires a person on a PR. What a
// person was still SUPPLYING is the judgement that a green suite means something, and two PRs
// measured on 2026-09-13 show the system cannot make that judgement today:
//
//   #17402 (premise checkers)   32 new tests   every mutant died          genuinely self-verifying
//   the exclusive-lock fix       4 new tests   ALL survive the defect     needed a reviewer
//
// Restoring the lock defect leaves that file at 21 pass / 0 fail. Both PRs reached CI looking
// identical -- green, with new tests -- and only one of them had tests that could fail. A reviewer
// spots the difference immediately. No check does. That gap is the last structural dependency on a
// human, which is what this audit measures.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY DIFF-SCOPED AND NOT TIME-SCOPED
//
// `mutation-runner.ts` already mutates recently-changed files, selected by `git log --since=<when>`.
// That answers "is the codebase covered" over a window. The per-PR question is narrower and is the
// one review actually asks: mutate a line THIS PR WROTE, and see whether THIS PR's tests notice.
// A file-scoped mutant can land on a line the PR never touched and report on coverage the author
// neither added nor owes.
//
// The baseline-first protocol, the three-valued outcome and the always-restore are NOT
// reimplemented here -- `runVariant` in mutation-runner.ts is called directly, so the two selectors
// cannot drift apart in their honesty about what a run established.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE FAILURE THIS TOOL MUST NOT HAVE, TAKEN FROM ITS OWN SIBLING
//
// `mutation-runner.ts` shipped with `--since=24h`, which is not valid git approxidate: git matches
// zero commits and does not error. It would have reported "nothing to do" on every tick forever
// while looking healthy -- a check that ran on nothing, reporting success. A per-PR mutation audit
// has exactly the same shape available to it, and more ways in: an unresolvable base ref, a diff
// that returns nothing, a PR of pure documentation.
//
// So EVERY empty outcome here is classified and named, and none of them is spelled "clean":
//   NO-MERGE-BASE   the base ref did not resolve            -> cannot see
//   NO-CHANGED-FILES the diff produced nothing              -> cannot see
//   NO-TARGETS      changes exist, none is a .ts with a paired .test.ts -> nothing to ask
//   NO-SITES        targets exist, no mutation applies to a changed line -> nothing to ask
// "Nothing to ask" and "nothing wrong" are different findings and are printed differently.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES NOT MEASURE — RUN AGAINST ITS OWN MOTIVATING CASE, AND IT PASSED IT
//
// The defect that motivated this tool is `exclusive-lock`'s `claimGeneration`: it created the
// lock with `open(path,"wx")` and wrote the owner one syscall later, leaving a zero-byte
// generation that a concurrent scanner treats as corrupt and supersedes. Its four accompanying
// tests do NOT catch it -- restoring the defect leaves that file at 21 pass / 0 fail.
//
// This audit was pointed at that exact commit's diff. It reported:
//
//     KILLED  src/Core.TypeScript/io/exclusive-lock.ts  [eq-to-neq]
//     VERDICT: every mutant on a changed line was killed
//
// A CLEAN BILL ON THE PR THAT PROVES THE GAP. The reason is structural, not a bug here: the
// catalogue is eight OPERATOR swaps, `claimGeneration` contains exactly two operator sites (both
// errno comparisons), and the real defect is an ORDERING change -- create-then-write versus
// stage-then-link. No operator swap can express it.
//
// So this measures a LOWER BOUND on coverage and nothing more: it finds changed lines whose
// operators and branches no test constrains at all. It cannot see a missing `await`, a wrong call
// order, an unchecked return, an atomicity gap, or any defect that is not a local operator flip.
// Reading a green run as "these tests are sufficient" is exactly the rounding-up this repo refuses
// -- which is the first reason it ships at drift tier and not as a gate.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-pr-mutation-coverage.ts [--base <ref>] [--max <n>] [--json <file>]

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  MUTATIONS,
  isCommentLine,
  pairWithTests,
  runVariant,
  type Finding,
  type Mutation,
  type Target,
} from "./mutation-runner.ts";

const DEFAULT_BASE = "origin/main";
/** Each target costs two suite runs (baseline + mutant), so a wide PR is capped -- and the cap is
 *  REPORTED, never applied silently. A truncated measurement that prints like a complete one is
 *  the same defect as a paginated list read as a short one. */
const DEFAULT_MAX_TARGETS = 12;

export type Scope =
  | { readonly kind: "targets"; readonly targets: readonly Target[]; readonly changed: ReadonlyMap<string, ReadonlySet<number>>; readonly skipped: number }
  | { readonly kind: "cannot-see"; readonly code: "NO-MERGE-BASE" | "NO-CHANGED-FILES"; readonly why: string }
  | { readonly kind: "nothing-to-ask"; readonly code: "NO-TARGETS"; readonly why: string };

/** Parse `git diff -U0` hunk headers into the set of lines present in the NEW file. */
export function changedLinesFromDiff(diff: string): ReadonlyMap<string, ReadonlySet<number>> {
  const out = new Map<string, Set<number>>();
  let file: string | null = null;
  for (const line of diff.split("\n")) {
    const plus = /^\+\+\+ b\/(.+)$/u.exec(line);
    if (plus !== null) {
      const name = plus[1];
      file = name === undefined || name === "/dev/null" ? null : name;
      continue;
    }
    if (file === null) continue;
    // @@ -old,len +new,len @@ — a missing length means 1, and a length of 0 is a pure deletion
    // with no new line to mutate.
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u.exec(line);
    if (hunk === null) continue;
    const start = Number(hunk[1]);
    const len = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (len === 0) continue;
    const set = out.get(file) ?? new Set<number>();
    for (let n = start; n < start + len; n++) set.add(n);
    out.set(file, set);
  }
  return out;
}

/** Mutate the first behavioural occurrence that sits ON A LINE THIS PR CHANGED. Unchanged source
 *  back means there was no such site — the caller must report that, never a verdict. */
export function applyMutationOnChangedLines(
  source: string,
  m: Mutation,
  changed: ReadonlySet<number>,
): string {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!changed.has(i + 1)) continue; // git line numbers are 1-based
    const line = lines[i];
    if (line === undefined || isCommentLine(line) || !line.includes(m.find)) continue;
    const idx = line.indexOf(m.find);
    const comment = line.indexOf("//");
    if (comment >= 0 && comment < idx) continue;
    lines[i] = line.replace(m.find, m.replace);
    return lines.join("\n");
  }
  return source;
}

export function mutationsOnChangedLines(
  source: string,
  changed: ReadonlySet<number>,
): readonly Mutation[] {
  return MUTATIONS.filter((m) => applyMutationOnChangedLines(source, m, changed) !== source);
}

function git(root: string, args: readonly string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", [...args], { cwd: root, encoding: "utf8", timeout: 60_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}` };
}

/** What this run is entitled to look at — or the named reason it is entitled to look at nothing. */
export function scopeOf(root: string, base: string, max: number): Scope {
  const mb = git(root, ["merge-base", base, "HEAD"]);
  const mergeBase = mb.out.trim();
  if (!mb.ok || mergeBase === "") {
    return {
      kind: "cannot-see",
      code: "NO-MERGE-BASE",
      why: `could not resolve a merge-base against '${base}'. Refusing to report coverage over a diff that may not exist.`,
    };
  }
  const diff = git(root, ["diff", "-U0", `${mergeBase}...HEAD`]);
  const changed = changedLinesFromDiff(diff.out);
  if (!diff.ok || changed.size === 0) {
    return {
      kind: "cannot-see",
      code: "NO-CHANGED-FILES",
      why: `git diff -U0 ${mergeBase.slice(0, 8)}...HEAD produced no changed files. On a real PR that is a tooling failure, not a quiet branch.`,
    };
  }
  const all = pairWithTests([...changed.keys()], root);
  if (all.length === 0) {
    return {
      kind: "nothing-to-ask",
      code: "NO-TARGETS",
      why: `${String(changed.size)} file(s) changed, none of them a .ts with a paired .test.ts. A docs-only or test-only PR has no production line to mutate — that is not a coverage finding.`,
    };
  }
  return { kind: "targets", targets: all.slice(0, max), changed, skipped: Math.max(0, all.length - max) };
}

export interface Report {
  readonly findings: readonly Finding[];
  readonly noSites: readonly string[];
  readonly skipped: number;
}

export function runScope(root: string, scope: Extract<Scope, { kind: "targets" }>): Report {
  const findings: Finding[] = [];
  const noSites: string[] = [];
  for (const t of scope.targets) {
    const changed = scope.changed.get(t.source);
    if (changed === undefined) continue;
    const src = git(root, ["show", `HEAD:${t.source}`]).out;
    const applicable = mutationsOnChangedLines(src, changed);
    if (applicable.length === 0) {
      noSites.push(t.source);
      continue;
    }
    const m = applicable[0]!;
    findings.push(runVariant(root, t, m.name, (s) => applyMutationOnChangedLines(s, m, changed)));
  }
  return { findings, noSites, skipped: scope.skipped };
}

function main(): number {
  const argv = process.argv;
  const val = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = val("--repo-root") ?? process.cwd();
  const base = val("--base") ?? DEFAULT_BASE;
  const max = Number(val("--max") ?? DEFAULT_MAX_TARGETS);

  const scope = scopeOf(root, base, max);
  if (scope.kind !== "targets") {
    // NEITHER of these prints as a pass. One says the tool could not see; the other says there was
    // nothing to ask. A caller that wants a number gets an explicit absence instead of a zero.
    console.log(`[pr-mutation] ${scope.code}: ${scope.why}`);
    console.log(`[pr-mutation] VERDICT: NOT MEASURED — no mutation was run, so nothing is claimed.`);
    return 0;
  }

  const { findings, noSites, skipped } = runScope(root, scope);
  const distinguished = findings.filter((f) => f.distinguishability.kind === "distinguished-by-suite");
  const indistinguishable = findings.filter((f) => f.distinguishability.kind === "indistinguishable-under-suite");
  const unresolved = findings.filter((f) => f.distinguishability.kind === "unresolved");

  console.log(`[pr-mutation] base=${base} targets=${String(scope.targets.length)} mutated=${String(findings.length)}`);
  for (const f of findings) {
    const d = f.distinguishability;
    const tag = d.kind === "distinguished-by-suite" ? "KILLED  " : d.kind === "indistinguishable-under-suite" ? "SURVIVED" : "UNRESOLVED";
    console.log(`  ${tag}  ${f.source}  [${f.mutation}]${d.kind === "unresolved" ? ` — ${d.why}` : ""}`);
  }
  for (const s of noSites) console.log(`  NO-SITES  ${s} — no catalogued mutation applies to a line this PR changed`);
  if (skipped > 0) console.log(`  NOTE: ${String(skipped)} further target(s) not measured (--max ${String(max)}). The cap is reported, not silent.`);

  console.log(
    `[pr-mutation] killed=${String(distinguished.length)} survived=${String(indistinguishable.length)} unresolved=${String(unresolved.length)}`,
  );
  if (findings.length === 0) {
    console.log(`[pr-mutation] VERDICT: NOT MEASURED — targets existed but no mutation had a site on a changed line.`);
  } else if (indistinguishable.length > 0) {
    console.log(
      `[pr-mutation] VERDICT: ${String(indistinguishable.length)} mutant(s) SURVIVED. The suite could not tell the variant from the original.\n` +
        `  This is the NEUTRAL FACT, not a verdict: an indistinguishable mutant is a coverage gap OR a declared\n` +
        `  freedom, and which one is undecidable in general (Budd & Angluin 1982). Drift tier — nothing is blocked.`,
    );
  } else {
    console.log(
      `[pr-mutation] VERDICT: every CATALOGUED OPERATOR mutant on a changed line was killed.\n` +
        `  This is a LOWER BOUND, not a clean bill. The catalogue is ${String(MUTATIONS.length)} operator swaps; it cannot\n` +
        `  express a wrong call order, a missing await, an unchecked return or an atomicity gap. Run against\n` +
        `  the exclusive-lock fix -- whose own tests demonstrably miss its defect -- this reported all-killed.`,
    );
  }

  const jsonPath = val("--json");
  if (jsonPath !== undefined) {
    writeFileSync(jsonPath, `${JSON.stringify({ base, findings, noSites, skipped }, null, 2)}\n`);
  }
  return 0; // DRIFT TIER: reports, never blocks.
}

if (import.meta.main) process.exit(main());
