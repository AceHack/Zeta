#!/usr/bin/env bun
/**
 * Drop ONE CodeQL rule's results, on exactly the files where the TypeScript
 * compiler already proves the same property.
 *
 * WHY. `js/call-to-non-callable` asks "is this callee possibly not a function?"
 * CodeQL's JavaScript extractor cannot follow imports written with an explicit
 * `.ts` extension (this repo's convention), so it types every such imported
 * function as `undefined` and flags the call. Measured: `stripRemotePrefix`
 * (2026-09-17) and `isFullGitCommitSha` x5 (PR #17541, 2026-09-23) -- all real
 * exports, all called correctly, every one flagged. Because the quality pack now
 * runs on every PR, each such finding opens bot review threads, and `main`
 * requires conversation resolution, so a correct PR is BLOCKED until someone
 * resolves them by hand.
 *
 * WHY THIS IS NOT A SUPPRESSION. Under `strict`, `tsc` refuses a call whose
 * callee is not callable (TS2349 / TS2722 / TS18048...), and `tsc` gates every
 * PR. So on a file tsc checks, the property this rule looks for is ALREADY
 * enforced, by a checker that resolves the imports this one cannot. The rule
 * adds only false positives there.
 *
 * WHY IT IS SCOPED THIS NARROWLY. The premise holds ONLY for files tsc checks.
 * `tsconfig.json` includes `**\/*.ts` with no `allowJs`, and excludes whole trees
 * (e.g. `src/wasm-dla`, AssemblyScript checked by `asc`). The ~51 plain JS files
 * are checked by nothing but CodeQL, so this rule must keep firing on them.
 * The file set is therefore NOT re-derived here from include/exclude globs --
 * that would be a transcription that drifts -- it is read from
 * `tsc --listFilesOnly`, the compiler's own answer.
 *
 * Every other rule, and this rule on every other file, passes through untouched.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

export const DOMINATED_RULE = "js/call-to-non-callable";

interface SarifResult {
  readonly ruleId?: string;
  readonly rule?: { readonly id?: string };
  readonly locations?: readonly {
    readonly physicalLocation?: { readonly artifactLocation?: { readonly uri?: string } };
  }[];
}
interface SarifRun {
  readonly results?: readonly SarifResult[];
  readonly [k: string]: unknown;
}
export interface Sarif {
  readonly runs?: readonly SarifRun[];
  readonly [k: string]: unknown;
}

function ruleOf(r: SarifResult): string | undefined {
  return r.ruleId ?? r.rule?.id;
}

/** Repo-relative, forward-slash, percent-decoded path of a result, or undefined. */
function uriOf(r: SarifResult): string | undefined {
  const uri = r.locations?.[0]?.physicalLocation?.artifactLocation?.uri;
  if (uri === undefined) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    return undefined; // an undecodable uri is not a file we can vouch for: keep the result
  }
  return decoded.replace(/^file:\/\//, "").replace(/^\.\//, "");
}

export interface FilterOutcome {
  readonly sarif: Sarif;
  readonly dropped: readonly string[];
}

/**
 * Remove `DOMINATED_RULE` results located in a tsc-checked file.
 * `tscChecked` holds repo-relative forward-slash paths.
 */
export function dropTscDominated(sarif: Sarif, tscChecked: ReadonlySet<string>): FilterOutcome {
  const dropped: string[] = [];
  const runs = (sarif.runs ?? []).map((run) => ({
    ...run,
    results: (run.results ?? []).filter((r) => {
      if (ruleOf(r) !== DOMINATED_RULE) return true;
      const path = uriOf(r);
      // No location, or a file tsc does not check: the premise does not hold, keep it.
      if (path === undefined || !tscChecked.has(path)) return true;
      dropped.push(path);
      return false;
    }),
  }));
  return { sarif: { ...sarif, runs }, dropped };
}

/** Parse `tsc --listFilesOnly` output into repo-relative paths inside `repoRoot`. */
export function parseTscFileList(text: string, repoRoot: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const abs = isAbsolute(line) ? line : resolve(repoRoot, line);
    const rel = relative(repoRoot, abs).split("\\").join("/");
    if (rel.startsWith("..") || rel.includes("node_modules/")) continue;
    out.add(rel);
  }
  return out;
}

/**
 * `path` as a list of SARIF files: its `.sarif` entries if it is a directory,
 * itself if it is a file.
 *
 * ONE SYSCALL, ONE ANSWER. Not `statSync(path).isFile()` followed by a read --
 * between the check and the use the path can change, and the answer the check
 * returned is already stale (CWE-367; `lint-check-then-use-file-races.ts` is the
 * standing guard, and it caught the first version of this function). The
 * directory read either succeeds or fails with ENOTDIR, and that failure IS the
 * "it is a file" answer.
 */
function sarifFilesIn(path: string): string[] {
  try {
    return readdirSync(path).filter((f) => f.endsWith(".sarif")).map((f) => join(path, f));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOTDIR") return [path];
    throw e;
  }
}

function main(argv: readonly string[]): number {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sarifPath = arg("--sarif");
  const listPath = arg("--tsc-files");
  const repoRoot = arg("--repo-root") ?? process.cwd();
  if (sarifPath === undefined || listPath === undefined) {
    console.error("usage: codeql-drop-tsc-dominated.ts --sarif <file|dir> --tsc-files <listFilesOnly output> [--repo-root DIR]");
    return 2;
  }
  const checked = parseTscFileList(readFileSync(listPath, "utf8"), repoRoot);
  // An empty set drops nothing, which is SAFE -- but it means tsc's listing
  // failed, and a filter that silently does nothing is the thing to say out loud.
  if (checked.size === 0) {
    console.error("::error::tsc --listFilesOnly produced no repo files; refusing to pretend the filter ran");
    return 2;
  }
  let total = 0;
  for (const file of sarifFilesIn(sarifPath)) {
    const { sarif, dropped } = dropTscDominated(JSON.parse(readFileSync(file, "utf8")) as Sarif, checked);
    writeFileSync(file, JSON.stringify(sarif));
    total += dropped.length;
    for (const d of dropped) console.log(`dropped ${DOMINATED_RULE} on tsc-checked ${d}`);
  }
  console.log(`[codeql-drop-tsc-dominated] ${String(total)} result(s) dropped; ${String(checked.size)} tsc-checked files; every other rule and every non-tsc file untouched`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
