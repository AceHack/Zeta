/**
 * Which Application directories exist, and which of them one lane may apply.
 *
 * ONE MODULE, IMPORTED BY BOTH SIDES, on purpose. What a CI cluster APPLIES
 * (the app-of-apps root's exclude glob) and what the harness ASSERTS (the
 * expected-application set) must be the same set. If they drift, a lane either
 * waits the full timeout on an Application nobody deployed -- the k3d bring-up
 * already names that failure: "asserted-but-unapplied, which hangs for the full
 * timeout and blames the Application" -- or, worse, reports green while never
 * looking at something it did deploy.
 *
 * DEPTH 2, matching what ArgoCD applies. The root Application runs with
 * `recurse: true` and include `{*\/Application.yaml,Application.yaml}`, and that
 * glob is not path-segment bounded (established against a live cluster in
 * `app-of-apps-discovery.ts`), so `game-hosting/gmod/Application.yaml` IS
 * applied. The harness used to walk depth 1 only, so gmod was deployed in CI and
 * never asserted: the partition roster held 49 Applications and the harness
 * asserted against 48. The exclusion auditor had already been widened to depth 2
 * for the same reason; discovery had not.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stringCompare } from "../collation/collation.ts";

export const APPLICATIONS_DIR = "full-ai-cluster/k8s/applications";

/** Repo-relative-to-APPLICATIONS_DIR directories holding an Application.yaml, depth <= 2, sorted. */
export function listApplicationDirs(repoRoot: string): readonly string[] {
  const root = join(repoRoot, APPLICATIONS_DIR);
  const out: string[] = [];
  for (const top of readdirSync(root, { withFileTypes: true })) {
    if (!top.isDirectory()) continue;
    if (existsSync(join(root, top.name, "Application.yaml"))) out.push(top.name);
    for (const sub of readdirSync(join(root, top.name), { withFileTypes: true })) {
      if (sub.isDirectory() && existsSync(join(root, top.name, sub.name, "Application.yaml"))) {
        out.push(`${top.name}/${sub.name}`);
      }
    }
  }
  return out.sort(stringCompare);
}

/** Split a `{a/**,b/**}` exclude glob into its directory entries. */
function globEntries(glob: string): readonly string[] {
  return glob
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

/**
 * The substrate's exclude glob, narrowed to one lane.
 *
 * `laneDirs === null` means "no lane": the base glob is returned VERBATIM, so
 * every existing caller behaves exactly as before. Otherwise every Application
 * directory NOT in the lane is added to the exclude. The base entries are always
 * kept: a deferral is not lane-scoped, and a lane that happens to contain a
 * deferred chart must not quietly re-admit it.
 *
 * A lane naming a directory that does not exist THROWS. A typo would otherwise
 * exclude the real chart and assert nothing about it -- a lane that is green
 * because it tested less than it claims.
 */
export function laneScopedExcludeGlob(
  baseGlob: string,
  laneDirs: readonly string[] | null,
  allDirs: readonly string[],
): string {
  if (laneDirs === null) return baseGlob;
  const known = new Set(allDirs);
  const unknown = laneDirs.filter((d) => !known.has(d));
  if (unknown.length > 0) {
    throw new Error(`lane names Application directories that do not exist: ${unknown.join(", ")}`);
  }
  const inLane = new Set(laneDirs);
  const entries = new Set(globEntries(baseGlob));
  for (const d of allDirs) if (!inLane.has(d)) entries.add(`${d}/**`);
  return `{${[...entries].sort(stringCompare).join(",")}}`;
}

/** Parse a comma-separated `--lane-dirs` value; empty or absent means no lane. */
export function parseLaneDirs(value: string | undefined): readonly string[] | null {
  if (value === undefined) return null;
  const dirs = value.split(",").map((d) => d.trim()).filter((d) => d.length > 0);
  if (dirs.length === 0) throw new Error("--lane-dirs was given but names no directories");
  return [...new Set(dirs)].sort(stringCompare);
}
