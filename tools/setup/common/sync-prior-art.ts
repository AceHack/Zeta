#!/usr/bin/env bun
/**
 * tools/setup/common/sync-prior-art.ts — clone / refresh the prior-art
 * reference mirrors declared in `references/reference-sources.json` into the
 * gitignored tree at `references/prior-art/<name>/`.
 *
 * The TypeScript retirement of `tools/setup/common/sync-prior-art.sh`
 * (081M00VNHB3087G0R001WHTKTH, the shell-deprecation umbrella; row 26 of
 * `docs/SHELL-DEPRECATION-SEQUENCE.md`, and the DEBT.md entry that said "port
 * sync-prior-art to that runtime" is discharged by this file).
 *
 * ═══ THIS COMMAND IS OPTIONAL AND ON-DEMAND. IT IS NOT A BOOTSTRAP STEP. ═══
 *
 * Aaron 2026-08-25, asked directly whether a `bun`-executed replacement could
 * break a cold clone: *"no it can run after bun is installed, this is optional
 * anyways when working on parts of the system that need to look at
 * [prior-art] references."*
 *
 * That ambiguity was real enough to need a human to settle it, so it is closed
 * here rather than left for the next reader to re-derive:
 *
 *   - NOTHING invokes this automatically. Measured on main 2026-08-25:
 *     `git grep -n sync-prior-art` finds zero call sites in
 *     `tools/setup/`, `.github/workflows/`, `flake.nix`, any devcontainer
 *     config, or any Makefile/justfile. Every hit is prose in a doc, the
 *     bash-retirement inventory, or a generated index. It is run BY HAND, by
 *     whoever is about to read a reference repo.
 *     (`references/prior-art/README.md` used to claim `tools/setup/install.sh`
 *     invoked it. That claim was false and was corrected in PR #15210.)
 *
 *   - Therefore `.claude/rules/clone-at-tag-stays-sufficient.md` is NOT
 *     threatened. A `git clone` at a tag with no package manager present still
 *     builds and checks: this command is not on that path, and the tree it
 *     populates is gitignored, disposable, and regenerable. If this file ever
 *     acquires a caller inside `tools/setup/install.sh` or a bootstrap
 *     workflow, THAT is the change that needs re-litigating — not this one.
 *
 *   - `bun` is guaranteed present at the only moment this runs, because the
 *     only moment it runs is when a human types the command.
 *
 * ═══ NAMING: "PRIOR ART", NEVER "UPSTREAM" ════════════════════════════════
 *
 * The `.sh` called these "upstreams" (`UPSTREAMS_DIR`, "=== Zeta upstream
 * sync ===", "One-upstream sync"). That word claims a lineage we do not have
 * and must not imply: Zeta is not a fork of sqlite, duckdb, or feldera, and
 * `.claude/rules/cleanroom-two-team-separation.md` is the reason the
 * distinction is load-bearing rather than cosmetic. These are third-party
 * repositories we MIRROR IN ORDER TO READ. The nine sense-[A] occurrences the
 * `.sh` still carried are renamed here, carrying forward the intent of
 * PR #15210 (which deliberately reverted its own edits to the `.sh` so this
 * port would not hit a modify/delete conflict).
 *
 * GOVERNANCE.md §23's "contribute back upstream" is a DIFFERENT sense — a
 * direction of contribution, not a claim of descent — and is untouched.
 *
 * ═══ WHAT THIS PORT MAKES TRUE BY CONSTRUCTION ════════════════════════════
 *
 * The `.sh` trusted the manifest's `.path` verbatim and wrote
 * `$REPO_ROOT/$rel_path`. All 103 rows happen to resolve under
 * `references/prior-art/`, which two independent `.gitignore` rules cover, so
 * the tree is clean TODAY — by inspection, which is to say by luck. A row
 * carrying `path: "src/foo"`, `path: "../../etc"`, or an absolute path would
 * have written OUTSIDE the ignored tree and made multi-gigabyte third-party
 * checkouts COMMITTABLE. Nothing would have complained.
 *
 * `resolveDestination` refuses that: every destination must resolve strictly
 * inside `references/prior-art/`, and the prior-art root itself is refused too
 * (a row pointing at the root would make `--prune` delete every mirror). This
 * is a CONFIGURATION error (exit 2), not a per-source failure — a manifest
 * that can address the working tree is not a manifest with one bad row in it.
 *
 * ═══ HONEST PARTIAL FAILURE ═══════════════════════════════════════════════
 *
 * 103 network operations will not all succeed forever. The refusal this file
 * is built around is that ONE UNREACHABLE SOURCE MUST NOT LOOK LIKE A CLEAN
 * SYNC. So every source lands in exactly one bucket, the buckets are printed
 * with counts and with the failing names spelled out, and any failure exits 1.
 *
 * Three states that the `.sh` printed identically and this file does not:
 *
 *   - "0 sources synced because the manifest is empty"        → distinct
 *   - "0 sources synced because --name matched nothing"       → EXIT 2, see below
 *   - "0 sources synced because all of them failed"           → EXIT 1
 *
 * DELIBERATE DIVERGENCE FROM THE `.sh`, stated out loud: `--name typo` used to
 * filter every entry out, report "Attempted: 0", and exit 0. A typo that
 * reports success is the vacuity class — a check that did not run wearing the
 * uniform of one that passed. An unknown name is now a usage error (exit 2)
 * that prints the names it did not recognise.
 *
 * ═══ CONCURRENCY ══════════════════════════════════════════════════════════
 *
 * Per `.claude/rules/async-all-the-way-truthful-signatures.md`: work goes
 * through a degree-of-parallelism knob, never un-knobbed spawn. `--jobs`
 * defaults to 1 — byte-identical to the `.sh`'s serial behaviour — and DoP is
 * a THROUGHPUT dial, not a semantics dial: outcomes are written back by input
 * index, so the final report and exit code are identical at any DoP. That is
 * pinned by a test, not asserted here.
 *
 * ═══ DEPENDENCY REMOVED ═══════════════════════════════════════════════════
 *
 * The `.sh` hard-required `jq` and exited 2-ish (`exit 1`) without it. Bun
 * parses JSON natively, so `jq` is no longer a prerequisite for reading prior
 * art. `git` still is, and is still checked.
 *
 * Usage:
 *   bun tools/setup/common/sync-prior-art.ts                  # refresh all
 *   bun tools/setup/common/sync-prior-art.ts --name foo,bar   # subset
 *   bun tools/setup/common/sync-prior-art.ts --prune          # drop orphans
 *   bun tools/setup/common/sync-prior-art.ts --dry-run        # plan only
 *   bun tools/setup/common/sync-prior-art.ts --jobs 4         # DoP knob
 *
 * Exit codes: 0 success · 1 at least one source failed · 2 configuration error.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

// ---------------------------------------------------------------------------
// Exit codes — 0 success, 1 a real failure, 2 a configuration error.
// ---------------------------------------------------------------------------

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_CONFIG = 2;

/** The one tree this command is allowed to write into, repo-relative. */
export const PRIOR_ART_DIR = "references/prior-art";

/** The manifest, repo-relative. */
export const MANIFEST_PATH = "references/reference-sources.json";

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export interface ReferenceSource {
  readonly name: string;
  readonly url: string;
  readonly branch: string;
  readonly path: string;
}

export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Parse + validate the manifest text.
 *
 * Validation is not decoration. A row missing `branch` would have made the
 * `.sh` run `git clone --depth 1 --branch "" <url>`, which fails per-source and
 * reads as a network problem. A duplicate `name` would make `--name` ambiguous
 * and `--prune` retain a directory for the wrong reason. Both are manifest
 * defects, so both are configuration errors, reported by row index.
 */
export function parseManifest(text: string): Parsed<readonly ReferenceSource[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return { ok: false, error: `manifest is not valid JSON: ${(cause as Error).message}` };
  }
  if (!Array.isArray(raw)) return { ok: false, error: "manifest must be a JSON array of source rows" };

  const entries: ReferenceSource[] = [];
  const seenNames = new Set<string>();
  const seenPaths = new Set<string>();

  for (const [index, row] of raw.entries()) {
    if (typeof row !== "object" || row === null) {
      return { ok: false, error: `manifest row ${String(index)} is not an object` };
    }
    const candidate = row as { name?: unknown; url?: unknown; branch?: unknown; path?: unknown };
    for (const field of ["name", "url", "branch", "path"] as const) {
      if (!nonEmptyString(candidate[field])) {
        return { ok: false, error: `manifest row ${String(index)} has a missing or empty "${field}"` };
      }
    }
    const entry: ReferenceSource = {
      name: (candidate.name as string).trim(),
      url: (candidate.url as string).trim(),
      branch: (candidate.branch as string).trim(),
      path: (candidate.path as string).trim(),
    };
    if (seenNames.has(entry.name)) {
      return { ok: false, error: `manifest row ${String(index)} repeats the name "${entry.name}"` };
    }
    if (seenPaths.has(entry.path)) {
      return { ok: false, error: `manifest row ${String(index)} repeats the path "${entry.path}"` };
    }
    seenNames.add(entry.name);
    seenPaths.add(entry.path);
    entries.push(entry);
  }
  return { ok: true, value: entries };
}

// ---------------------------------------------------------------------------
// Path containment — the defect this port closes by construction
// ---------------------------------------------------------------------------

/**
 * Resolve a manifest row's destination, refusing anything that escapes
 * `references/prior-art/`.
 *
 * A prefix match on the raw string is NOT sufficient and is not what this
 * does: `references/prior-art/../../etc` has the right prefix and the wrong
 * destination. The check is done on the RESOLVED absolute path, which
 * normalises `..` away, and it additionally refuses absolute manifest paths
 * (which `join` would silently honour on some inputs) and the prior-art root
 * itself (a row addressing the root turns `--prune` into `rm -rf` of the whole
 * mirror tree).
 */
export function resolveDestination(repoRoot: string, entryPath: string): Parsed<string> {
  if (isAbsolute(entryPath)) {
    return { ok: false, error: `path "${entryPath}" is absolute; manifest paths must be repo-relative` };
  }
  const root = resolve(repoRoot);
  const priorArtRoot = resolve(root, PRIOR_ART_DIR);
  const destination = resolve(root, entryPath);

  if (destination === priorArtRoot) {
    return { ok: false, error: `path "${entryPath}" resolves to the prior-art root itself` };
  }
  if (!destination.startsWith(priorArtRoot + sep)) {
    return { ok: false, error: `path "${entryPath}" resolves outside ${PRIOR_ART_DIR}/ (to "${destination}")` };
  }
  return { ok: true, value: destination };
}

/** Resolve every row, collecting ALL containment errors rather than the first. */
export function resolveAll(
  repoRoot: string,
  entries: readonly ReferenceSource[],
): Parsed<readonly { readonly entry: ReferenceSource; readonly destination: string }[]> {
  const resolved: { entry: ReferenceSource; destination: string }[] = [];
  const errors: string[] = [];
  for (const entry of entries) {
    const outcome = resolveDestination(repoRoot, entry.path);
    if (outcome.ok) resolved.push({ entry, destination: outcome.value });
    else errors.push(`  ${entry.name}: ${outcome.error}`);
  }
  if (errors.length > 0) {
    return { ok: false, error: `${String(errors.length)} manifest row(s) address a path outside ${PRIOR_ART_DIR}/:\n${errors.join("\n")}` };
  }
  return { ok: true, value: resolved };
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export interface Options {
  readonly names: readonly string[];
  readonly prune: boolean;
  readonly dryRun: boolean;
  readonly jobs: number;
  readonly help: boolean;
}

export const DEFAULT_OPTIONS: Options = { names: [], prune: false, dryRun: false, jobs: 1, help: false };

export function parseArgs(argv: readonly string[]): Parsed<Options> {
  let names: readonly string[] = [];
  let prune = false;
  let dryRun = false;
  let jobs = 1;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") return { ok: true, value: { ...DEFAULT_OPTIONS, help: true } };
    if (arg === "--name" || arg === "--names") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("-")) return { ok: false, error: `${arg} requires a comma-separated value` };
      names = value
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n !== "");
      if (names.length === 0) return { ok: false, error: `${arg} was given no usable names` };
      i += 1;
      continue;
    }
    if (arg === "--prune") {
      prune = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--jobs") {
      const value = argv[i + 1];
      if (value === undefined) return { ok: false, error: "--jobs requires a positive integer" };
      if (!/^[1-9]\d*$/.test(value)) return { ok: false, error: `--jobs must be a positive integer, got "${value}"` };
      jobs = Number.parseInt(value, 10);
      i += 1;
      continue;
    }
    return { ok: false, error: `unknown arg: ${arg}` };
  }
  return { ok: true, value: { names, prune, dryRun, jobs, help: false } };
}

export function usage(): readonly string[] {
  return [
    "sync-prior-art.ts — mirror the prior-art reference repositories declared in",
    `  ${MANIFEST_PATH} into the gitignored tree at ${PRIOR_ART_DIR}/<name>/.`,
    "",
    "OPTIONAL AND ON-DEMAND. Nothing invokes this automatically — it is not a",
    "bootstrap step and no install path depends on it. Run it by hand when you are",
    "about to read a reference repository. `bun` is required, which is fine because",
    "the only thing that runs this is a human who already has bun.",
    "",
    "These are PRIOR-ART REFERENCES. Zeta is not a fork or descendant of any of",
    "them, and the mirrors are read-only, disposable, and never hand-edited.",
    "",
    "usage: bun tools/setup/common/sync-prior-art.ts [options]",
    "",
    "  --name, --names <a,b>  only sync these sources (unknown name = exit 2)",
    "  --prune                delete mirror dirs no longer named in the manifest",
    "  --dry-run              report the plan; perform no clone, fetch, or delete",
    "  --jobs <n>             degree of parallelism (default 1, serial like the .sh)",
    "  -h, --help             this text",
    "",
    "exit: 0 success · 1 at least one source failed · 2 configuration error",
  ];
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export interface Selection {
  readonly selected: readonly ReferenceSource[];
  readonly skippedByFilter: number;
  readonly unknownNames: readonly string[];
}

/**
 * Apply `--name`. An unknown name is reported rather than silently matching
 * nothing — see the DELIBERATE DIVERGENCE note in the file header.
 */
export function selectEntries(entries: readonly ReferenceSource[], names: readonly string[]): Selection {
  if (names.length === 0) return { selected: entries, skippedByFilter: 0, unknownNames: [] };
  const wanted = new Set(names);
  const known = new Set(entries.map((e) => e.name));
  const selected = entries.filter((e) => wanted.has(e.name));
  return {
    selected,
    skippedByFilter: entries.length - selected.length,
    unknownNames: names.filter((n) => !known.has(n)),
  };
}

/**
 * Mirror directories present on disk that the manifest no longer names.
 *
 * Sorted by ORDINAL (codepoint) order, never `localeCompare` — per
 * `.claude/rules/culture-invariant-by-default.md`, a locale-sensitive comparison would make the
 * prune order, and therefore this command's output, differ per machine locale. `--prune` names
 * what it deletes, so that output is a record; a record that reorders itself by host locale is
 * not reproducible. (Caught by `hygiene:no-culture-sensitive-collation` — I wrote
 * `localeCompare` first and CI was right.)
 */
export function planPrune(existingDirNames: readonly string[], manifestNames: readonly string[]): readonly string[] {
  const kept = new Set(manifestNames);
  return existingDirNames
    .filter((d) => !kept.has(d))
    .slice()
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Effects — the one declared door for entropy (noninterference, §13)
// ---------------------------------------------------------------------------

export interface GitResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

export interface SyncEffects {
  git(args: readonly string[], cwd?: string): Promise<GitResult>;
  exists(absPath: string): boolean;
  isDirectory(absPath: string): boolean;
  mkdirp(absPath: string): void;
  remove(absPath: string): void;
  listDirNames(absPath: string): readonly string[];
  out(line: string): void;
  err(line: string): void;
}

// ---------------------------------------------------------------------------
// Per-source sync
// ---------------------------------------------------------------------------

/**
 * Every source lands in exactly one of these. `failed` is the only one that
 * reddens the exit code; `would-*` are dry-run only and never touch the disk.
 */
export type OutcomeStatus = "cloned" | "refreshed" | "already-current" | "failed" | "would-clone" | "would-refresh";

export interface Outcome {
  readonly name: string;
  readonly status: OutcomeStatus;
  readonly detail: string;
}

/**
 * Is the local mirror already exactly `origin/<branch>`?
 *
 * Preserved from the `.sh` verbatim in intent, including WHY it uses
 * `ls-remote` rather than a local `rev-parse origin/<branch>`: `ls-remote`
 * needs no local history, so it works on a shallow clone and sidesteps the
 * `fetch --depth=1` history-drift class that produced spurious "refresh
 * failed" noise on second runs. Three conditions, all required: the checked-out
 * branch matches, HEAD matches the remote tip, and the worktree is pristine
 * (including ignored files — a mirror with build output in it is not current).
 */
async function mirrorIsCurrent(fx: SyncEffects, target: string, branch: string): Promise<boolean> {
  const currentBranch = await fx.git(["branch", "--show-current"], target);
  if (!currentBranch.ok || currentBranch.stdout.trim() !== branch) return false;

  const localHead = await fx.git(["rev-parse", "HEAD"], target);
  if (!localHead.ok) return false;

  const remote = await fx.git(["ls-remote", "--exit-code", "--heads", "origin", branch], target);
  if (!remote.ok) return false;
  const remoteHead = remote.stdout.split("\n")[0]?.split(/\s+/)[0]?.trim() ?? "";
  if (remoteHead === "" || remoteHead !== localHead.stdout.trim()) return false;

  const state = await fx.git(["status", "--porcelain=v1", "--untracked-files=all", "--ignored"], target);
  return state.ok && state.stdout.trim() === "";
}

async function shortHead(fx: SyncEffects, target: string): Promise<string> {
  const head = await fx.git(["rev-parse", "--short", "HEAD"], target);
  return head.ok ? head.stdout.trim() : "unknown";
}

/**
 * Sync one source. Clone if absent; otherwise check currency and skip; else
 * destructively refresh so the worktree matches `origin/<branch>` byte for
 * byte regardless of prior state.
 *
 * Deterministic per the bash profile's rule the `.sh` cited: exactly one sync
 * attempt per source, no retry loop. A network flake is reported as a failure,
 * not papered over — re-running the command is the retry, and re-running is
 * safe because every path here converges to the same state (idempotency, §12).
 */
export async function syncOne(
  fx: SyncEffects,
  entry: ReferenceSource,
  destination: string,
  dryRun: boolean,
): Promise<Outcome> {
  const { name, url, branch } = entry;

  if (!fx.exists(join(destination, ".git"))) {
    if (dryRun) return { name, status: "would-clone", detail: `${url} (${branch}) -> ${destination}` };
    if (fx.exists(destination)) fx.remove(destination);
    fx.mkdirp(dirname(destination));
    fx.out(`↓ cloning ${name} from ${url} (${branch})`);
    const cloned = await fx.git(["clone", "--depth", "1", "--branch", branch, url, destination]);
    if (!cloned.ok) return { name, status: "failed", detail: `clone failed: ${firstLine(cloned.stderr)}` };
    return { name, status: "cloned", detail: `at ${await shortHead(fx, destination)}` };
  }

  // Repoint `origin` if the manifest URL moved. A mirror pointing at the old
  // URL is not "current" no matter what its HEAD says, so this forces a refresh.
  let mustRefresh = false;
  const originUrl = await fx.git(["remote", "get-url", "origin"], destination);
  if (originUrl.ok) {
    if (originUrl.stdout.trim() !== url) {
      if (dryRun) return { name, status: "would-refresh", detail: `origin would be repointed to ${url}` };
      fx.out(`↻ repointing ${name} origin to ${url}`);
      const repointed = await fx.git(["remote", "set-url", "origin", url], destination);
      if (!repointed.ok) return { name, status: "failed", detail: `remote set-url failed: ${firstLine(repointed.stderr)}` };
      mustRefresh = true;
    }
  } else {
    if (dryRun) return { name, status: "would-refresh", detail: `origin would be added as ${url}` };
    const added = await fx.git(["remote", "add", "origin", url], destination);
    if (!added.ok) return { name, status: "failed", detail: `remote add failed: ${firstLine(added.stderr)}` };
    mustRefresh = true;
  }

  // A dry run deliberately stops here rather than calling `ls-remote`: the
  // plan must be inspectable with no network at all, so it reports what it
  // would ATTEMPT, never what the remote would have said.
  if (dryRun) return { name, status: "would-refresh", detail: `would check ${url} (${branch}) and refresh if behind` };

  if (!mustRefresh && (await mirrorIsCurrent(fx, destination, branch))) {
    return { name, status: "already-current", detail: `at origin/${branch}` };
  }

  fx.out(`↻ refreshing ${name} (${branch})`);
  const steps: readonly (readonly string[])[] = [
    ["fetch", "--depth", "1", "origin", branch],
    ["reset", "--hard"],
    ["clean", "-fdx"],
    ["checkout", "-B", branch, `origin/${branch}`],
    ["reset", "--hard", `origin/${branch}`],
    ["clean", "-fdx"],
  ];
  for (const step of steps) {
    const result = await fx.git(step, destination);
    if (!result.ok) {
      return { name, status: "failed", detail: `git ${step[0]!} failed: ${firstLine(result.stderr)}` };
    }
  }
  return { name, status: "refreshed", detail: `at ${await shortHead(fx, destination)}` };
}

function firstLine(text: string): string {
  const line = text.trim().split("\n")[0]?.trim() ?? "";
  return line === "" ? "(no stderr)" : line;
}

// ---------------------------------------------------------------------------
// DoP-knobbed ferry (async-all-the-way)
// ---------------------------------------------------------------------------

/**
 * Drain `items` through `processor` with a degree-of-parallelism knob.
 *
 * DoP=1 is a single cooperative loop — the deterministic, replayable mode, and
 * the default here because it is byte-identical to the `.sh` this replaces.
 * DoP=N is N ferries pulling from one shared cursor. Results are written back
 * by INPUT INDEX, never by completion order, so the returned array — and
 * therefore the report and the exit code — is identical at every DoP.
 *
 * There is no path here that starts work you cannot dial down to one.
 *
 * (The same shape exists as `runFerry` in
 * `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts`. It is not
 * imported: that module is a UDP chaos-test harness, and making a setup command
 * depend on it would be a far worse coupling than twenty lines of queue.)
 */
export async function runFerry<T, R>(
  items: readonly T[],
  degreeOfParallelism: number,
  processor: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (degreeOfParallelism < 1) throw new Error("degreeOfParallelism must be >= 1");
  const results = new Array<R>(items.length);
  let cursor = 0;
  const ferry = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await processor(items[index]!, index);
    }
  };
  const width = Math.min(degreeOfParallelism, Math.max(1, items.length));
  await Promise.all(Array.from({ length: width }, () => ferry()));
  return results;
}

// ---------------------------------------------------------------------------
// Reporting — an empty result and a failed result are different values
// ---------------------------------------------------------------------------

export interface RunReport {
  readonly outcomes: readonly Outcome[];
  readonly pruned: readonly string[];
  readonly skippedByFilter: number;
  readonly manifestSize: number;
  readonly dryRun: boolean;
}

export function countByStatus(outcomes: readonly Outcome[]): Readonly<Record<OutcomeStatus, number>> {
  const counts: Record<OutcomeStatus, number> = {
    cloned: 0,
    refreshed: 0,
    "already-current": 0,
    failed: 0,
    "would-clone": 0,
    "would-refresh": 0,
  };
  for (const outcome of outcomes) counts[outcome.status] += 1;
  return counts;
}

export function failedNames(outcomes: readonly Outcome[]): readonly string[] {
  return outcomes.filter((o) => o.status === "failed").map((o) => o.name);
}

/**
 * Render the summary. Pure over an ORDERED outcome list, which is what makes
 * the output DoP-independent.
 *
 * The three zero-source states are rendered distinctly and on purpose — see the
 * HONEST PARTIAL FAILURE note in the file header. A run that attempted nothing
 * says so in those words; it never borrows the vocabulary of a run that
 * attempted 103 things and succeeded.
 */
export function renderSummary(report: RunReport): readonly string[] {
  const counts = countByStatus(report.outcomes);
  const lines: string[] = [];

  lines.push("");
  lines.push(report.dryRun ? "=== Summary (DRY RUN — nothing was written) ===" : "=== Summary ===");
  lines.push(`Manifest entries: ${String(report.manifestSize)}`);
  lines.push(`Attempted:        ${String(report.outcomes.length)}`);

  if (report.outcomes.length === 0) {
    lines.push(
      report.manifestSize === 0
        ? "  (the manifest declares no sources — nothing to sync, and nothing failed)"
        : "  (every manifest entry was filtered out by --name — nothing was attempted)",
    );
  }

  if (report.dryRun) {
    lines.push(`  would clone:    ${String(counts["would-clone"])}`);
    lines.push(`  would refresh:  ${String(counts["would-refresh"])}`);
  } else {
    lines.push(`  cloned:         ${String(counts.cloned)}`);
    lines.push(`  refreshed:      ${String(counts.refreshed)}`);
    lines.push(`  already current:${String(counts["already-current"])}`);
  }
  lines.push(`  failed:         ${String(counts.failed)}`);
  lines.push(`Skipped (filter): ${String(report.skippedByFilter)}`);
  if (report.pruned.length > 0) {
    lines.push(`Pruned orphans:   ${String(report.pruned.length)} (${report.pruned.join(", ")})`);
  }

  const failures = failedNames(report.outcomes);
  if (failures.length > 0) {
    lines.push("");
    lines.push(`FAILED — ${String(failures.length)} source(s) did NOT sync:`);
    for (const outcome of report.outcomes) {
      if (outcome.status === "failed") lines.push(`  - ${outcome.name}: ${outcome.detail}`);
    }
    lines.push("");
    lines.push("This run did NOT produce a complete mirror tree. Re-run to retry;");
    lines.push("every path in this command converges, so a re-run is safe.");
  }
  return lines;
}

/** 1 if anything failed, else 0. A failure never exits 0. */
export function exitCodeFor(outcomes: readonly Outcome[]): number {
  return outcomes.some((o) => o.status === "failed") ? EXIT_FAILED : EXIT_OK;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface RunInput {
  readonly repoRoot: string;
  readonly manifestText: string;
  readonly options: Options;
}

/**
 * The whole command, minus process/filesystem discovery. Exported so the tests
 * can drive every branch with a fake `SyncEffects` and NO NETWORK.
 */
export async function run(fx: SyncEffects, input: RunInput): Promise<number> {
  const { repoRoot, options } = input;

  const manifest = parseManifest(input.manifestText);
  if (!manifest.ok) {
    fx.err(`error: ${manifest.error}`);
    return EXIT_CONFIG;
  }

  // Containment is checked over the WHOLE manifest, not merely the filtered
  // subset: a row that can address `src/` is a defect whether or not this
  // particular invocation would have written it.
  const resolved = resolveAll(repoRoot, manifest.value);
  if (!resolved.ok) {
    fx.err(`error: ${resolved.error}`);
    return EXIT_CONFIG;
  }

  const selection = selectEntries(manifest.value, options.names);
  if (selection.unknownNames.length > 0) {
    fx.err(`error: --name listed ${String(selection.unknownNames.length)} unknown source(s): ${selection.unknownNames.join(", ")}`);
    fx.err(`  (nothing was synced; a filter that matches nothing must not report success)`);
    return EXIT_CONFIG;
  }

  const destinations = new Map(resolved.value.map((r) => [r.entry.name, r.destination]));

  fx.out("=== Zeta prior-art reference sync ===");
  fx.out(`Manifest:       ${join(repoRoot, MANIFEST_PATH)}`);
  fx.out(`Prior-art dir:  ${join(repoRoot, PRIOR_ART_DIR)}`);
  fx.out(`Sources:        ${String(selection.selected.length)} of ${String(manifest.value.length)}`);
  fx.out(`Parallelism:    ${String(options.jobs)}`);
  if (options.dryRun) fx.out("Mode:           DRY RUN — no clone, fetch, or delete will be performed");
  fx.out("");

  if (!options.dryRun) fx.mkdirp(join(repoRoot, PRIOR_ART_DIR));

  const outcomes = await runFerry(selection.selected, options.jobs, async (entry) =>
    syncOne(fx, entry, destinations.get(entry.name)!, options.dryRun),
  );

  for (const outcome of outcomes) {
    const mark = outcome.status === "failed" ? "✗" : "✓";
    fx.out(`${mark} ${outcome.name} — ${outcome.status}: ${outcome.detail}`);
  }

  let pruned: readonly string[] = [];
  if (options.prune) {
    const priorArtRoot = join(repoRoot, PRIOR_ART_DIR);
    const present = fx.exists(priorArtRoot)
      ? fx.listDirNames(priorArtRoot).filter((d) => fx.isDirectory(join(priorArtRoot, d)))
      : [];
    pruned = planPrune(present, manifest.value.map((e) => e.name));
    fx.out("");
    fx.out(options.dryRun ? "=== Prune pass (DRY RUN) ===" : "=== Prune pass ===");
    if (pruned.length === 0) fx.out("  no orphan mirrors");
    for (const orphan of pruned) {
      fx.out(`  ⚠ orphan: ${orphan}${options.dryRun ? " — would remove" : " — removing"}`);
      if (!options.dryRun) fx.remove(join(priorArtRoot, orphan));
    }
  }

  for (const line of renderSummary({
    outcomes,
    pruned,
    skippedByFilter: selection.skippedByFilter,
    manifestSize: manifest.value.length,
    dryRun: options.dryRun,
  })) {
    fx.out(line);
  }

  return exitCodeFor(outcomes);
}

// ---------------------------------------------------------------------------
// Real effects
// ---------------------------------------------------------------------------

export function realEffects(): SyncEffects {
  return {
    git: (args, cwd) =>
      new Promise<GitResult>((resolvePromise) => {
        // git is repo-pinned via .mise.toml; args are always an explicit array,
        // never a shell string, so no manifest value is ever interpreted by a shell.
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        const child = spawn("git", [...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
        child.on("error", (cause) => {
          resolvePromise({ ok: false, stdout, stderr: cause.message });
        });
        child.on("close", (code) => {
          resolvePromise({ ok: code === 0, stdout, stderr });
        });
      }),
    exists: (absPath) => existsSync(absPath),
    isDirectory: (absPath) => {
      try {
        return statSync(absPath).isDirectory();
      } catch {
        return false;
      }
    },
    mkdirp: (absPath) => {
      mkdirSync(absPath, { recursive: true });
    },
    remove: (absPath) => {
      rmSync(absPath, { recursive: true, force: true });
    },
    listDirNames: (absPath) => readdirSync(absPath),
    out: (line) => {
      process.stdout.write(line + "\n");
    },
    err: (line) => {
      process.stderr.write(line + "\n");
    },
  };
}

async function repoRootFromGit(fx: SyncEffects): Promise<string | undefined> {
  const result = await fx.git(["rev-parse", "--show-toplevel"]);
  if (!result.ok) return undefined;
  const root = result.stdout.trim();
  return root === "" ? undefined : root;
}

export async function main(argv: readonly string[], fx: SyncEffects): Promise<number> {
  const options = parseArgs(argv);
  if (!options.ok) {
    fx.err(`error: ${options.error}`);
    for (const line of usage()) fx.err(line);
    return EXIT_CONFIG;
  }
  if (options.value.help) {
    for (const line of usage()) fx.out(line);
    return EXIT_OK;
  }

  // `git` is the one hard prerequisite left. The `.sh` also required `jq`;
  // Bun parses JSON natively, so that dependency is gone.
  const repoRoot = await repoRootFromGit(fx);
  if (repoRoot === undefined) {
    fx.err("error: `git` is required and did not resolve a repository root here");
    return EXIT_CONFIG;
  }

  const manifestPath = join(repoRoot, MANIFEST_PATH);
  if (!fx.exists(manifestPath)) {
    fx.err(`error: manifest not found at ${manifestPath}`);
    return EXIT_CONFIG;
  }

  const manifestText = await Bun.file(manifestPath).text();
  return run(fx, { repoRoot, manifestText, options: options.value });
}

if (import.meta.main) process.exit(await main(process.argv.slice(2), realEffects()));
