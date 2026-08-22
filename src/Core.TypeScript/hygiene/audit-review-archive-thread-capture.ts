#!/usr/bin/env bun
// audit-review-archive-thread-capture.ts — does the PR-review archive's
// `| Total threads | N |` agree with the review threads GitHub actually holds?
//
// WHY THIS FILE EXISTS
// --------------------
// `docs/history/pr-reviews/PR-NNNN-*.md` is the git-canonical mirror of a PR's review
// threads. 6,097 of the 8,076 archived docs on main report `| Total threads | 0 |`.
//
// That 75% is NOT evidence of anything on its own — most PRs here are agent-generated and
// auto-merged, so genuinely having no review threads is the expected case. What makes the
// number worth testing is the SHAPE: in the artifact, a zero meaning "we did not capture"
// is indistinguishable from a zero meaning "there were none". That is the vacuity class —
// a check that did not run looking like one that passed.
//
// This audit is the discriminator. It re-fetches the live `reviewThreads` count for a
// sampled PR and compares it with what the archive recorded.
//
// WHAT A DISCREPANCY DOES AND DOES NOT MEAN
// -----------------------------------------
// A live fetch is a SUPERSET IN TIME of what any past fetch could have seen. So
// `recorded=0, fetched=1` is not automatically an archiver defect: the thread may have been
// opened after the archive ran (this repo's reviewers comment post-merge, and the archive
// fires on `pull_request: closed`). The audit therefore reports the earliest thread-comment
// timestamp so the caller can compare it against when the archive doc was actually written.
// Classifying that is a separate, second step — this tool reports the neutral fact.
//
// THE ONE PROPERTY THAT MATTERS MOST
// ----------------------------------
// A FAILED FETCH IS NEVER AGREEMENT. GitHub's API 503s; `gh` can be rate-limited. If the
// fetch does not return a parseable count, the row is `FETCH-FAILED` and is excluded from
// both numerator and denominator. Silently counting an errored fetch as "0 threads, agrees"
// would reproduce, inside the checker, exactly the defect the checker exists to find.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_ARCHIVE_DIR = "docs/history/pr-reviews";
const OWNER = "Lucent-Financial-Group";
const REPO = "Zeta";

interface ArchiveDoc {
  readonly file: string;
  readonly prNumber: number;
  readonly recordedThreads: number;
}

type Verdict = "AGREE" | "UNDER-REPORT" | "OVER-REPORT" | "FETCH-FAILED";

interface Row {
  readonly doc: ArchiveDoc;
  readonly fetchedThreads: number | null;
  readonly firstCommentAt: string | null;
  readonly verdict: Verdict;
  readonly error: string | null;
}

// --- archive side -----------------------------------------------------------

/** `| Total threads | 12 |` — the archive's own recorded count. */
const RECORDED_RE = /^\|\s*Total threads\s*\|\s*(\d+)\s*\|\s*$/m;
const FILENAME_RE = /^PR-(\d+)-/;

function readArchive(dir: string): ArchiveDoc[] {
  const out: ArchiveDoc[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const m = FILENAME_RE.exec(name);
    if (m === null) continue;
    const text = readFileSync(join(dir, name), "utf8");
    const rec = RECORDED_RE.exec(text);
    if (rec === null) continue; // no Outcome table -> not a comparable doc
    out.push({
      file: name,
      prNumber: Number.parseInt(m[1]!, 10),
      recordedThreads: Number.parseInt(rec[1]!, 10),
    });
  }
  // Ordinal, not localeCompare: numeric key, total order, culture-invariant.
  out.sort((a, b) => (a.prNumber < b.prNumber ? -1 : a.prNumber > b.prNumber ? 1 : 0));
  return out;
}

// --- sampling ---------------------------------------------------------------

/** mulberry32 — small, well-known, seeded PRNG. The seed is printed so the draw replays. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Partial Fisher–Yates: uniform sample without replacement, deterministic in `seed`. */
function sampleWithoutReplacement<T>(items: readonly T[], n: number, seed: number): T[] {
  const rnd = mulberry32(seed);
  const idx = items.map((_, i) => i);
  const take = Math.min(n, idx.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rnd() * (idx.length - i));
    const tmp = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = tmp;
  }
  return idx.slice(0, take).map((i) => items[i]!);
}

// --- GitHub side ------------------------------------------------------------

interface ThreadsProbe {
  readonly totalCount: number;
  readonly firstCommentAt: string | null;
}

const QUERY =
  "query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n)" +
  "{reviewThreads(first:100){totalCount nodes{comments(first:1){nodes{createdAt}}}}}}}";

interface ProbeShape {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          totalCount?: number;
          nodes?: Array<{ comments?: { nodes?: Array<{ createdAt?: string }> } }>;
        };
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

function probeOnce(pr: number): { ok: true; probe: ThreadsProbe } | { ok: false; error: string } {
  const proc = Bun.spawnSync([
    "gh",
    "api",
    "graphql",
    "-f",
    `query=${QUERY}`,
    "-F",
    `o=${OWNER}`,
    "-F",
    `r=${REPO}`,
    "-F",
    `n=${pr}`,
  ]);
  const stdout = proc.stdout.toString();
  const stderr = proc.stderr.toString();
  if (proc.exitCode !== 0) {
    return { ok: false, error: `gh exit ${proc.exitCode}: ${stderr.trim().slice(0, 200)}` };
  }
  let parsed: ProbeShape;
  try {
    parsed = JSON.parse(stdout) as ProbeShape;
  } catch {
    return { ok: false, error: `unparseable response: ${stdout.slice(0, 120)}` };
  }
  if (parsed.errors !== undefined && parsed.errors.length > 0) {
    return { ok: false, error: `graphql errors: ${JSON.stringify(parsed.errors).slice(0, 200)}` };
  }
  const threads = parsed.data?.repository?.pullRequest?.reviewThreads;
  if (threads === undefined || threads === null || typeof threads.totalCount !== "number") {
    // Deleted PR / missing field. NOT zero — unknown.
    return { ok: false, error: "no reviewThreads.totalCount in response" };
  }
  let earliest: string | null = null;
  for (const node of threads.nodes ?? []) {
    const at = node.comments?.nodes?.[0]?.createdAt;
    if (at === undefined) continue;
    if (earliest === null || at < earliest) earliest = at; // ISO-8601 UTC: ordinal compare is chronological
  }
  return { ok: true, probe: { totalCount: threads.totalCount, firstCommentAt: earliest } };
}

function probeWithRetry(pr: number, attempts: number): { probe: ThreadsProbe | null; error: string | null } {
  let lastError = "";
  for (let i = 0; i < attempts; i++) {
    const r = probeOnce(pr);
    if (r.ok) return { probe: r.probe, error: null };
    lastError = r.error;
    // Bounded linear backoff. Deliberately small: a long retry loop turns a
    // 503-degraded run into a slow one that LOOKS complete.
    if (i < attempts - 1) Bun.sleepSync(750 * (i + 1));
  }
  return { probe: null, error: lastError };
}

// --- main -------------------------------------------------------------------

type Population = "zero" | "nonzero" | "all";

function parseArgs(argv: readonly string[]): {
  dir: string;
  sample: number;
  seed: number;
  prs: number[] | null;
  attempts: number;
  population: Population;
} {
  let dir = DEFAULT_ARCHIVE_DIR;
  let sample = 0;
  let seed = 0;
  let prs: number[] | null = null;
  let attempts = 3;
  let population: Population = "zero";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--archive-dir") dir = argv[++i] ?? dir;
    else if (a === "--sample") sample = Number.parseInt(argv[++i] ?? "0", 10);
    else if (a === "--seed") seed = Number.parseInt(argv[++i] ?? "0", 10);
    else if (a === "--attempts") attempts = Number.parseInt(argv[++i] ?? "3", 10);
    else if (a === "--population") {
      const p = argv[++i] ?? "zero";
      population = p === "nonzero" ? "nonzero" : p === "all" ? "all" : "zero";
    } else if (a === "--prs") {
      prs = (argv[++i] ?? "")
        .split(",")
        .filter((s) => s.trim().length > 0)
        .map((s) => Number.parseInt(s, 10));
    }
  }
  return { dir, sample, seed, prs, attempts, population };
}

function main(): void {
  const args = parseArgs(Bun.argv.slice(2));
  const all = readArchive(args.dir);
  const zeros = all.filter((d) => d.recordedThreads === 0);

  let population: ArchiveDoc[];
  if (args.prs !== null) {
    const wanted = new Set(args.prs);
    population = all.filter((d) => wanted.has(d.prNumber));
  } else if (args.population === "nonzero") {
    population = all.filter((d) => d.recordedThreads > 0);
  } else if (args.population === "all") {
    population = all;
  } else {
    population = zeros;
  }

  const chosen =
    args.prs !== null || args.sample <= 0
      ? population
      : sampleWithoutReplacement(population, args.sample, args.seed);

  console.log(`archive-dir       : ${args.dir}`);
  console.log(`docs parsed       : ${all.length}`);
  console.log(`recorded-zero docs: ${zeros.length}`);
  console.log(`population        : ${args.prs !== null ? "explicit --prs" : args.population} (${population.length} docs)`);
  console.log(`sample size       : ${chosen.length}   seed: ${args.seed}   attempts/PR: ${args.attempts}`);
  console.log("");
  console.log("PR\trecorded\tfetched\tverdict\tfirst_thread_comment_at\tnote");

  const rows: Row[] = [];
  for (const doc of chosen) {
    const { probe, error } = probeWithRetry(doc.prNumber, args.attempts);
    let verdict: Verdict;
    if (probe === null) verdict = "FETCH-FAILED";
    else if (probe.totalCount === doc.recordedThreads) verdict = "AGREE";
    else if (probe.totalCount > doc.recordedThreads) verdict = "UNDER-REPORT";
    else verdict = "OVER-REPORT";
    const row: Row = {
      doc,
      fetchedThreads: probe?.totalCount ?? null,
      firstCommentAt: probe?.firstCommentAt ?? null,
      verdict,
      error,
    };
    rows.push(row);
    console.log(
      [
        doc.prNumber,
        doc.recordedThreads,
        probe?.totalCount ?? "-",
        verdict,
        probe?.firstCommentAt ?? "-",
        error ?? "",
      ].join("\t"),
    );
  }

  const agree = rows.filter((r) => r.verdict === "AGREE").length;
  const under = rows.filter((r) => r.verdict === "UNDER-REPORT").length;
  const over = rows.filter((r) => r.verdict === "OVER-REPORT").length;
  const failed = rows.filter((r) => r.verdict === "FETCH-FAILED").length;
  const completed = rows.length - failed;

  console.log("");
  console.log(`completed fetches : ${completed} of ${rows.length}   (FETCH-FAILED excluded from rates)`);
  console.log(`AGREE             : ${agree}`);
  console.log(`UNDER-REPORT      : ${under}`);
  console.log(`OVER-REPORT       : ${over}`);
  console.log(`FETCH-FAILED      : ${failed}`);
  if (completed > 0) {
    const rate = (under + over) / completed;
    console.log(`discrepancy rate  : ${under + over}/${completed} = ${(rate * 100).toFixed(1)}%`);
  } else {
    console.log("discrepancy rate  : UNDEFINED — no fetch completed. This is not a pass.");
  }

  // A run that inspected nothing must never read as success.
  if (rows.length === 0) {
    console.log("REFUSED: sampled 0 documents.");
    process.exit(2);
  }
  process.exit(under + over > 0 ? 1 : 0);
}

main();
