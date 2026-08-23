#!/usr/bin/env bun
// query.ts — query the git-native inverted index, and REFUSE rather than answer
// from a corpus that has moved.
// 081M0QTXTR3087G0R002R439FH
//
//   bun src/Core.TypeScript/search/inverted/query.ts <term> [term...] [flags]
//
// Exit codes, deliberately the same four as `../search.ts`:
//   0  matches
//   1  no matches            <- a real, checked, empty answer
//   2  usage error
//   3  REFUSED               <- "I cannot answer this", never confused with 1
//
// THE WHOLE POINT IS THE DIFFERENCE BETWEEN 1 AND 3.
//
// On 2026-08-22 a search for "landauer" reported 0 files. The truth was 52, one
// of them a rule mentioning it 32 times. Nothing was broken: `grep -r` searched
// a working tree 336 commits behind origin/main and answered correctly about
// the corpus it was given. The defect was that a stale answer and a true answer
// are indistinguishable at the call site.
//
// An index makes this WORSE unless it is guarded, because an index is stale by
// construction between rebuilds. So this CLI never treats the index as the
// truth. The index NARROWS; git is the corpus. Concretely:
//
//   index rev == target rev            -> answer from the index
//   index rev is an ancestor of target -> the answer is exact only for files
//                                         that did not change in between, so
//                                         the changed set is re-read FROM GIT
//                                         at the target rev and merged in. The
//                                         changed set is bounded (one cadence
//                                         tick), so this is cheap and the
//                                         result is exact rather than merely
//                                         caveated.
//   changed set too large to verify    -> REFUSED (3)
//   index rev not an ancestor          -> REFUSED (3)
//   index rev not in the object store  -> REFUSED (3)
//
// `--no-verify` switches off the merge. It is kept because it is the fast path
// and sometimes what you want — but with it, a zero-hit result over a moved
// corpus is REFUSED (3) rather than reported as 1. That asymmetry is
// deliberate: a non-empty answer from a stale index is at worst incomplete and
// you can see what you got; an EMPTY one is a confident claim of absence, which
// is the exact shape of the original bug.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { analyzeQueryTerm } from "./tokenize.ts";
import {
  INDEX_DIR,
  MANIFEST_FILE,
  FILES_FILE,
  HIGH_DF_FILE,
  isIndexablePath,
  MAX_BLOB_BYTES,
  shardOf,
  shardFile,
  parseTermRow,
  parseHighDfRow,
  parseFileRow,
  type DocId,
  type Manifest,
} from "./format.ts";
import { hasCommit, isAncestor, resolveRev, changedPaths, commitsBetween, blobSizesAt } from "./git-corpus.ts";

/**
 * How many changed files the verifier will re-read from git before refusing.
 *
 * Sized from the measurement that set the cadence: 110 commits landed on main
 * in the 6 hours before rev 6426eacf, touching well under a thousand indexable
 * files. 5,000 leaves an order of magnitude of headroom for a quiet weekend
 * catching up, and still refuses rather than turning into the unbounded scan
 * the sibling `../search.ts` exists to prevent.
 */
export const VERIFY_FILE_BUDGET = 5000;

export interface Hit {
  readonly path: string;
  readonly count: number;
  /** true when the count came from git at the target rev rather than the index */
  readonly verified: boolean;
}

export type Freshness =
  | { readonly kind: "fresh" }
  | {
      readonly kind: "behind";
      readonly commits: number;
      /** every changed path the index could have covered — the RETRACTION set */
      readonly changed: string[];
      /** the subset the builder would actually read at the target rev — the VERIFY set */
      readonly verifiable: string[];
    }
  | { readonly kind: "divergent" }
  | { readonly kind: "unknown-rev" };

export function classifyFreshness(repoRoot: string, indexRev: string, targetRev: string): Freshness {
  if (!hasCommit(repoRoot, indexRev)) return { kind: "unknown-rev" };
  if (indexRev === targetRev) return { kind: "fresh" };
  if (!isAncestor(repoRoot, indexRev, targetRev)) return { kind: "divergent" };
  const changed = changedPaths(repoRoot, indexRev, targetRev).filter(isIndexablePath);
  if (changed.length === 0) return { kind: "fresh" };

  // TWO SETS, AND CONFLATING THEM WAS A REAL BUG (caught 2026-08-23 on the first
  // post-merge query on main).
  //
  // `isIndexablePath` answers from the PATH alone, but the builder also applies a
  // blob-size cap, which needs the size at the rev. So the changed set admitted
  // files the index would never contain — and the verifier then git-grepped them
  // and returned hits a FRESH index does not have. The same query gave different
  // answers depending on how stale the index was, which is the one thing this CLI
  // exists to prevent.
  //
  // `changed`     — everything to WITHDRAW from the index's claims. Wider on
  //                 purpose: a file that became oversize, or was deleted, must
  //                 lose its hit, and a fresh index would not list it either.
  // `verifiable`  — what to actually READ, matching the builder's corpus exactly.
  const sizes = blobSizesAt(repoRoot, targetRev, changed);
  const verifiable = changed.filter((p) => {
    const size = sizes.get(p);
    return size !== undefined && size <= MAX_BLOB_BYTES;
  });
  return { kind: "behind", commits: commitsBetween(repoRoot, indexRev, targetRev), changed, verifiable };
}

export interface LoadedIndex {
  readonly manifest: Manifest;
  readonly pathOf: Map<DocId, string>;
  readonly dir: string;
}

export function loadIndex(dir: string): LoadedIndex {
  const manifest = JSON.parse(readFileSync(join(dir, MANIFEST_FILE), "utf8")) as Manifest;
  const pathOf = new Map<DocId, string>();
  const files = readFileSync(join(dir, FILES_FILE), "utf8");
  for (const line of files.split("\n")) {
    if (line.length === 0) continue;
    const r = parseFileRow(line);
    pathOf.set(r.docId, r.path);
  }
  return { manifest, pathOf, dir };
}

/**
 * Read a file, treating absence as a value rather than an exception.
 *
 * Deliberately NOT `if (existsSync(f)) readFileSync(f)`: that is a check-then-use
 * race (CWE-367, `lint-check-then-use-file-races.ts`). A shard can vanish between
 * the two calls — during a rebuild, which for THIS artifact happens every 6 hours
 * — and the failure mode is the one this whole CLI exists to prevent: a shard
 * that disappeared mid-query would surface as "term not found" rather than as an
 * error. Absence is answered once, atomically, by the read itself.
 */
function readIfPresent(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Postings for one term, or `null` when the term is absent from its shard. */
export function postingsFor(idx: LoadedIndex, term: string): Map<DocId, number> | null {
  const file = join(idx.dir, shardFile(shardOf(term)));
  const needle = `{"t":${JSON.stringify(term)},`;
  const body = readIfPresent(file);
  if (body === null) return null;
  // Shards are sorted, so a binary search over line offsets is the O(log n)
  // read. At the measured shard sizes (largest 2.0 MiB) a scan is already
  // ~10 ms and the simpler code is the one that is obviously correct; the
  // sorted layout is what makes the upgrade available without a reformat.
  let at = body.startsWith(needle) ? 0 : body.indexOf("\n" + needle);
  if (at < 0) return null;
  if (at > 0) at += 1;
  const end = body.indexOf("\n", at);
  const row = parseTermRow(body.slice(at, end < 0 ? undefined : end));
  const m = new Map<DocId, number>();
  for (const [id, tf] of row.p) m.set(id, tf);
  return m;
}

/** Document frequency of a term suppressed by the df cap, or null if not capped. */
export function highDfOf(idx: LoadedIndex, term: string): number | null {
  const file = join(idx.dir, HIGH_DF_FILE);
  const needle = `{"t":${JSON.stringify(term)},`;
  const body = readIfPresent(file);
  if (body === null) return null;
  let at = body.startsWith(needle) ? 0 : body.indexOf("\n" + needle);
  if (at < 0) return null;
  if (at > 0) at += 1;
  const end = body.indexOf("\n", at);
  return parseHighDfRow(body.slice(at, end < 0 ? undefined : end)).df;
}

/**
 * Count whole-word occurrences of every term in the given paths, at a git rev,
 * reading from the object store rather than the working tree.
 *
 * `-w` is what keeps this consistent with the index: the tokenizer's word class
 * is `[A-Za-z0-9_]` plus everything >= U+0080, and git's `-w` boundary is
 * `[A-Za-z0-9_]`. They agree on ASCII, which is where they need to.
 */
export function verifyAtRev(
  repoRoot: string,
  rev: string,
  terms: readonly string[],
  paths: readonly string[],
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const term of terms) out.set(term, new Map());
  if (paths.length === 0) return out;
  const CHUNK = 400; // keep the argv well under the platform limit
  for (const term of terms) {
    const counts = out.get(term)!;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const slice = paths.slice(i, i + CHUNK);
      const r = spawnSync(
        "git",
        ["-C", repoRoot, "grep", "-I", "-F", "-i", "-w", "-c", "-e", term, rev, "--", ...slice],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );
      if (r.error) throw r.error;
      // 0 = matches, 1 = none. Anything else is a real error and must not be
      // read as "no matches" — that would be the vacuity class again.
      if (r.status !== 0 && r.status !== 1) {
        throw new Error(`git grep failed with status ${r.status}: ${(r.stderr ?? "").trim()}`);
      }
      for (const line of (r.stdout ?? "").split("\n")) {
        if (line.length === 0) continue;
        // "<rev>:<path>:<count>"
        const first = line.indexOf(":");
        const last = line.lastIndexOf(":");
        if (first < 0 || last <= first) continue;
        const path = line.slice(first + 1, last);
        const n = Number.parseInt(line.slice(last + 1), 10);
        if (Number.isFinite(n) && n > 0) counts.set(path, n);
      }
    }
  }
  return out;
}

export interface QueryOptions {
  readonly repoRoot: string;
  readonly indexDir: string;
  readonly terms: readonly string[];
  readonly targetRev: string;
  readonly verify: boolean;
  readonly limit: number;
  readonly filesOnly: boolean;
}

export type QueryOutcome =
  | { readonly kind: "ok"; readonly hits: Hit[]; readonly freshness: Freshness; readonly verifiedFiles: number }
  | { readonly kind: "refused"; readonly reason: string; readonly detail: string };

export function runQuery(opts: QueryOptions): QueryOutcome {
  const idx = loadIndex(opts.indexDir);
  const indexRev = idx.manifest.rev;
  const freshness = classifyFreshness(opts.repoRoot, indexRev, opts.targetRev);

  if (freshness.kind === "unknown-rev") {
    return {
      kind: "refused",
      reason: "index rev is not in this object store",
      detail:
        `The index says it was built at ${indexRev}, which this clone does not have (a shallow clone, or an index from a fork).\n` +
        `Nothing here can establish what that index covers, so answering from it would be a guess wearing a result's clothes.\n` +
        `FIX: git fetch --prune, or rebuild:  bun src/Core.TypeScript/search/inverted/build.ts --rev ${opts.targetRev}`,
    };
  }
  if (freshness.kind === "divergent") {
    return {
      kind: "refused",
      reason: "index rev is not an ancestor of the queried rev",
      detail:
        `index rev ${indexRev.slice(0, 12)} is not an ancestor of ${opts.targetRev.slice(0, 12)}.\n` +
        `The two histories have diverged, so the set of files that differ is not a bounded "what changed since" — it is\n` +
        `both directions at once, and the index cannot be repaired into an answer about this rev.\n` +
        `FIX: rebuild:  bun src/Core.TypeScript/search/inverted/build.ts --rev ${opts.targetRev}`,
    };
  }

  const analyzed: string[] = [];
  for (const raw of opts.terms) {
    const a = analyzeQueryTerm(raw);
    if ("rejected" in a) {
      return { kind: "refused", reason: "term is not indexable", detail: a.rejected };
    }
    analyzed.push(a.term);
  }

  for (const term of analyzed) {
    const df = highDfOf(idx, term);
    if (df !== null) {
      return {
        kind: "refused",
        reason: "term is above the document-frequency cap",
        detail:
          `"${term}" occurs in ${df} of ${idx.manifest.fileCount} indexed files, above the postings cap of ${idx.manifest.corpus.maxDocumentFrequency}.\n` +
          `The index records the COUNT but not the file list for such terms — see MAX_DOCUMENT_FREQUENCY in format.ts for the measurement.\n` +
          `This is a refusal, not an empty result: the term is everywhere, not nowhere.\n` +
          `FIX: add a rarer term to narrow the query, or scan directly:  git grep -l -w -i -e ${term} ${opts.targetRev}`,
      };
    }
  }

  // Intersect postings across terms (AND semantics).
  let acc: Map<DocId, number> | null = null;
  for (const term of analyzed) {
    const p = postingsFor(idx, term);
    if (p === null) {
      acc = new Map();
      break;
    }
    if (acc === null) {
      acc = p;
      continue;
    }
    const next = new Map<DocId, number>();
    for (const [id, n] of acc) {
      const m = p.get(id);
      if (m !== undefined) next.set(id, Math.min(n, m));
    }
    acc = next;
  }
  const fromIndex = acc ?? new Map<DocId, number>();

  const hits = new Map<string, Hit>();
  for (const [id, n] of fromIndex) {
    const path = idx.pathOf.get(id);
    if (path === undefined) continue;
    hits.set(path, { path, count: n, verified: freshness.kind === "fresh" });
  }

  let verifiedFiles = 0;
  if (freshness.kind === "behind") {
    if (!opts.verify) {
      if (hits.size === 0) {
        return {
          kind: "refused",
          reason: "empty result from an index whose corpus has moved",
          detail:
            `${freshness.verifiable.length} indexable file(s) changed across the ${freshness.commits} commit(s) between the index rev\n` +
            `${indexRev.slice(0, 12)} and ${opts.targetRev.slice(0, 12)}, and --no-verify was passed, so those files were never read.\n` +
            `"Not found" would be a claim about a corpus this run did not look at. That is the 2026-08-22 landauer failure exactly,\n` +
            `and it is refused rather than printed.\n` +
            `FIX: drop --no-verify (the changed set is bounded and cheap to read), or rebuild the index.`,
        };
      }
      return { kind: "ok", hits: rank(hits, opts.limit), freshness, verifiedFiles: 0 };
    }
    if (freshness.verifiable.length > VERIFY_FILE_BUDGET) {
      return {
        kind: "refused",
        reason: "too far behind to verify",
        detail:
          `${freshness.verifiable.length} indexable files changed since the index rev (budget ${VERIFY_FILE_BUDGET}).\n` +
          `Reading them all would be the unconstrained scan this repo's tooling exists to refuse, and NOT reading them would\n` +
          `make the answer a guess. Neither is acceptable, so this is a refusal.\n` +
          `FIX: rebuild:  bun src/Core.TypeScript/search/inverted/build.ts --rev ${opts.targetRev}`,
      };
    }
    // The index's claims about changed files are superseded, in BOTH directions:
    // a file that no longer contains the term must lose its hit, not just gain one.
    for (const p of freshness.changed) hits.delete(p);
    const counts = verifyAtRev(opts.repoRoot, opts.targetRev, analyzed, freshness.verifiable);
    verifiedFiles = freshness.verifiable.length;
    let intersected: Map<string, number> | null = null;
    for (const term of analyzed) {
      const c = counts.get(term)!;
      if (intersected === null) {
        intersected = new Map(c);
        continue;
      }
      const next = new Map<string, number>();
      for (const [path, n] of intersected) {
        const m = c.get(path);
        if (m !== undefined) next.set(path, Math.min(n, m));
      }
      intersected = next;
    }
    for (const [path, n] of intersected ?? new Map<string, number>()) {
      hits.set(path, { path, count: n, verified: true });
    }
  }

  return { kind: "ok", hits: rank(hits, opts.limit), freshness, verifiedFiles };
}

function rank(hits: Map<string, Hit>, limit: number): Hit[] {
  const all = [...hits.values()].sort((a, b) => b.count - a.count || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return limit > 0 ? all.slice(0, limit) : all;
}

export interface ParsedArgs {
  readonly terms: string[];
  readonly rev: string;
  readonly verify: boolean;
  readonly limit: number;
  readonly filesOnly: boolean;
  readonly indexDir?: string | undefined;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const terms: string[] = [];
  let rev = "";
  let verify = true;
  let limit = 50;
  let filesOnly = false;
  let indexDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--rev") rev = argv[++i] ?? "";
    else if (a === "--no-verify") verify = false;
    else if (a === "--files") filesOnly = true;
    else if (a === "--limit") limit = Number.parseInt(argv[++i] ?? "50", 10);
    else if (a === "--index-dir") indexDir = argv[++i];
    else if (a === "--help" || a === "-h") throw new Error(USAGE);
    else if (a.startsWith("-")) throw new Error(`unknown flag: ${a}\n\n${USAGE}`);
    else terms.push(a);
  }
  if (terms.length === 0) throw new Error(USAGE);
  return { terms, rev, verify, limit, filesOnly, indexDir };
}

export const USAGE = `usage: bun src/Core.TypeScript/search/inverted/query.ts <term> [term...] [flags]

  <term>...      one or more terms; multiple terms are ANDed
  --rev <rev>    rev to answer about (default: origin/main, else HEAD)
  --no-verify    do not re-read files changed since the index rev (fast, and
                 REFUSES on an empty result rather than claiming absence)
  --files        print paths only
  --limit <n>    max hits to print (default 50; 0 = all)
  --index-dir <d>  read the index from <d> instead of ${INDEX_DIR}

exit: 0 matches | 1 no matches | 2 usage | 3 REFUSED (cannot answer)`;

function defaultTargetRev(repoRoot: string): string {
  for (const cand of ["origin/main", "HEAD"]) {
    try {
      return resolveRev(repoRoot, cand);
    } catch {
      /* try the next one */
    }
  }
  throw new Error("no resolvable rev: neither origin/main nor HEAD");
}

export function main(argv: readonly string[]): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }
  const repoRoot = resolve(import.meta.dir, "../../../..");
  const indexDir = args.indexDir ? resolve(args.indexDir) : join(repoRoot, INDEX_DIR);
  if (readIfPresent(join(indexDir, MANIFEST_FILE)) === null) {
    process.stderr.write(
      `REFUSED: no index at ${indexDir}\n` +
        `  An absent index must not read as an empty corpus.\n` +
        `  FIX: bun src/Core.TypeScript/search/inverted/build.ts\n`,
    );
    return 3;
  }

  let targetRev: string;
  try {
    targetRev = args.rev ? resolveRev(repoRoot, args.rev) : defaultTargetRev(repoRoot);
  } catch (e) {
    process.stderr.write(`REFUSED: ${(e as Error).message}\n`);
    return 3;
  }

  const started = performance.now();
  let outcome: QueryOutcome;
  try {
    outcome = runQuery({
      repoRoot,
      indexDir,
      terms: args.terms,
      targetRev,
      verify: args.verify,
      limit: args.limit,
      filesOnly: args.filesOnly,
    });
  } catch (e) {
    process.stderr.write(`REFUSED: ${(e as Error).message}\n`);
    return 3;
  }
  const elapsed = performance.now() - started;

  if (outcome.kind === "refused") {
    process.stderr.write(`REFUSED: ${outcome.reason}\n${outcome.detail}\n`);
    return 3;
  }

  const idx = loadIndex(indexDir);
  // The corpus scope is printed on EVERY answer, not only on a suspicious one.
  // `../search.ts`: "Never narrow silently" — a bounded corpus that only
  // announces itself when the caller already suspects something is not a guard.
  process.stderr.write(
    `[index] rev=${idx.manifest.rev.slice(0, 12)} target=${targetRev.slice(0, 12)} ` +
      `files=${idx.manifest.fileCount} terms=${idx.manifest.termCount}\n` +
      `[index] corpus excludes: ${idx.manifest.corpus.excludedTrees.map((t) => t.prefix).join(", ")} ` +
      `| blobs >${idx.manifest.corpus.maxBlobBytes}B | terms in >${idx.manifest.corpus.maxDocumentFrequency} files\n`,
  );
  if (outcome.freshness.kind === "behind") {
    process.stderr.write(
      `[index] STALE by ${outcome.freshness.commits} commit(s); ` +
        (outcome.verifiedFiles > 0
          ? `${outcome.verifiedFiles} changed file(s) re-read from git at the target rev, so this answer is exact.\n`
          : `${outcome.freshness.changed.length} changed file(s) NOT read (--no-verify): this answer may be incomplete.\n`),
    );
  }

  if (outcome.hits.length === 0) {
    process.stderr.write(`[index] 0 matches in ${elapsed.toFixed(1)}ms\n`);
    return 1;
  }
  for (const h of outcome.hits) {
    process.stdout.write(args.filesOnly ? `${h.path}\n` : `${h.count}\t${h.path}\n`);
  }
  process.stderr.write(`[index] ${outcome.hits.length} file(s) in ${elapsed.toFixed(1)}ms\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
