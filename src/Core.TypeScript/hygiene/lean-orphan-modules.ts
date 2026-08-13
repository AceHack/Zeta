#!/usr/bin/env bun
/**
 * lean-orphan-modules — no Lean module may sit outside `lake build` SILENTLY.
 *
 * THE CLASS THIS EXISTS TO CLOSE. A `.lean` file that no `defaultTargets` root reaches
 * transitively is never compiled. It can hold a hard compile error, or a `sorry` on a false
 * theorem, and nothing reports it — while the file's own header cheerfully claims it is verified.
 * That has now happened three times in this repo:
 *
 *   1. `ImaginaryStack` — declared as a `lean_lib` with no root module and not a default target,
 *      so `lake build` never reached it. Wired in 2026-08-10; it held a hard compile error AND a
 *      `sorry` on a false theorem. Recorded in `lakefile.toml`.
 *   2. `Lean4/MenoBraidedRMatrix.lean` — a Yang-Baxter certificate verified only on the author's
 *      machine, because the root module never imported it (2026-08-13).
 *   3. `Lean4/GenSelfApplication.lean` — did not compile at all
 *      (`Unknown identifier 'selfCode'`) for ~2 months, while its own footer read
 *      "SORRY-FREE ... Expected: NO warnings, NO errors = oracle passes". It had never been run.
 *      Work-item 081KZY5BADC087G0R00309CMXY.
 *
 * A proof that nothing checks is not a proof, and a file that asserts its own verification while
 * escaping the build is worse than no file — it is a check that did not run wearing the name of
 * one that did.
 *
 * WHAT THIS DOES NOT DO. It does not forbid exclusion. Some modules are legitimately standalone
 * (diagnostic scripts run by hand). It forbids exclusion being *invisible*: an orphan must be
 * listed in `ORPHANS.json` with a non-empty reason. One JSON line is the whole cost of a
 * deliberate omission; the cost of an accidental one is a red build.
 *
 * The allow-list lives beside the Lean tree rather than in CI config so the reason travels with
 * the code it excuses.
 *
 * Three failure modes, all fatal:
 *   - an orphan absent from the allow-list        (the silent-omission case)
 *   - a listed entry with an empty/missing reason (the "" escape hatch)
 *   - a listed module that is no longer an orphan (so the list cannot rot into noise)
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/lean-orphan-modules.ts [--repo-root <path>]
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const LEAN_DIR = join("src", "Core.Lean4");
export const ALLOW_LIST = "ORPHANS.json";

export interface OrphanEntry {
  readonly module: string;
  readonly reason: string;
  readonly workitem?: string;
}

/** Every `.lean` file under the Lean tree, excluding the package cache. */
export function leanFiles(leanRoot: string): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      // `.lake/` is downloaded dependencies (Mathlib et al), not ours.
      if (e.name === ".lake" || e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".lean")) out.push(p);
    }
  };
  walk(leanRoot);
  return out.sort();
}

/** `Lean4/Foo/Bar.lean` -> `Lean4.Foo.Bar` (path IS the module name in Lake). */
export function moduleOf(leanRoot: string, file: string): string {
  return relative(leanRoot, file).replace(/\.lean$/, "").split(sep).join(".");
}

/**
 * `defaultTargets = ["Lean4", "ImaginaryStack"]` -> the roots to walk from.
 *
 * A missing or unparseable lakefile THROWS rather than yielding an empty root set: with no roots
 * every module reads as an orphan, which would look like a catastrophic finding instead of a
 * broken script. Loud beats plausible.
 */
export function defaultTargets(lakefileText: string): readonly string[] {
  const m = /defaultTargets\s*=\s*\[([^\]]*)\]/.exec(lakefileText);
  if (m?.[1] === undefined) {
    throw new Error("lean-orphan-modules: no `defaultTargets` in lakefile.toml — refusing to guess");
  }
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1] ?? "").filter((x) => x !== "");
}

/** Direct `import Foo.Bar` edges out of one file. */
export function importsOf(text: string): readonly string[] {
  return [...text.matchAll(/^\s*import\s+([A-Za-z0-9_.]+)/gm)].map((m) => m[1] ?? "");
}

/** Modules reachable from the roots by transitive import. */
export function reachable(
  roots: readonly string[],
  moduleToFile: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const mod = stack.pop();
    if (mod === undefined || seen.has(mod)) continue;
    seen.add(mod);
    const file = moduleToFile.get(mod);
    if (file === undefined) continue; // Mathlib/Std imports — outside our tree, not our problem
    for (const next of importsOf(readFileSync(file, "utf8"))) stack.push(next);
  }
  return seen;
}

export function loadAllowList(leanRoot: string): readonly OrphanEntry[] {
  const p = join(leanRoot, ALLOW_LIST);
  if (!existsSync(p)) return [];
  const parsed: unknown = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`lean-orphan-modules: ${ALLOW_LIST} must be a JSON array`);
  }
  return parsed as readonly OrphanEntry[];
}

export interface Verdict {
  readonly undeclared: readonly string[];
  readonly reasonless: readonly string[];
  readonly stale: readonly string[];
}

export function check(orphans: readonly string[], allow: readonly OrphanEntry[]): Verdict {
  const listed = new Map(allow.map((e) => [e.module, e]));
  const orphanSet = new Set(orphans);
  return {
    undeclared: orphans.filter((m) => !listed.has(m)),
    reasonless: allow.filter((e) => (e.reason ?? "").trim() === "").map((e) => e.module),
    // A module that is no longer an orphan must leave the list, or the list becomes folklore.
    stale: allow.map((e) => e.module).filter((m) => !orphanSet.has(m)),
  };
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /lean-orphan-modules\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const i = process.argv.indexOf("--repo-root");
  const root = i >= 0 ? (process.argv[i + 1] ?? process.cwd()) : process.cwd();
  const leanRoot = join(root, LEAN_DIR);

  const files = leanFiles(leanRoot);
  const moduleToFile = new Map(files.map((f) => [moduleOf(leanRoot, f), f]));
  const roots = defaultTargets(readFileSync(join(leanRoot, "lakefile.toml"), "utf8"));
  const seen = reachable(roots, moduleToFile);
  const orphans = [...moduleToFile.keys()].filter((m) => !seen.has(m)).sort();

  const { undeclared, reasonless, stale } = check(orphans, loadAllowList(leanRoot));

  // Count only OUR modules as reachable — `seen` also holds Mathlib/Std imports, so an unfiltered
  // count reports more modules reachable than exist.
  const reachableOurs = [...moduleToFile.keys()].filter((m) => seen.has(m)).length;
  console.log(
    `[lean-orphan-modules] ${String(moduleToFile.size)} modules, ` +
      `${String(reachableOurs)} reachable from [${roots.join(", ")}], ` +
      `${String(orphans.length)} orphaned`,
  );

  let failed = false;
  for (const m of undeclared) {
    console.error(`  ORPHAN NOT DECLARED: ${m} — unreachable from every default target.`);
    console.error(`    Fix: import it from a root, or add it to ${LEAN_DIR}/${ALLOW_LIST} with a reason.`);
    failed = true;
  }
  for (const m of reasonless) {
    console.error(`  EMPTY REASON: ${m} — an allow-list entry must say WHY, or it is just a mute.`);
    failed = true;
  }
  for (const m of stale) {
    console.error(`  STALE ENTRY: ${m} — listed as an orphan but now reachable. Remove it.`);
    failed = true;
  }

  if (failed) process.exit(1);
  console.log("[lean-orphan-modules] every module is reachable or deliberately declared.");
}
