#!/usr/bin/env bun
// audit-review-archive-capture-window.ts — WHY did the PR-review archive miss a thread?
//
// WHY THIS FILE EXISTS (and why it is not audit-review-archive-thread-capture.ts)
// ------------------------------------------------------------------------------
// The sibling audit answers "does the recorded count match the live count?" — the neutral
// fact. It cannot answer *why* a count disagrees, and it explicitly says so. Work item
// 081M08MVPR9087G0R000NCF8PV then inferred the cause by comparing thread-comment times
// against `merged_at`. That inference is sound in direction but blunt in instrument:
// `merged_at` is when the EVENT fired, not when the archiver LOOKED. The archiver looks
// ~40 s later, and everything in between is exactly the window the inference cannot see.
//
// The archiver already records when it looked: `fetched_at`, in the PR shard at
// `docs/github/prs/shards/<NNN>/<zetaid>.json`. Comparing a thread's first-comment
// `createdAt` against `fetched_at` splits the discrepancies into two populations that
// demand DIFFERENT fixes:
//
//   * POST-FETCH  — the thread did not exist when the archiver looked. No fetch could have
//                   caught it. This is the merge-time race; the fix is to look later.
//   * PRE-FETCH   — the thread existed when the archiver looked, and the archiver did not
//                   record it. A race cannot explain this. Pagination, an API cap, a
//                   permission gap, replica lag, or a parse bug must.
//
// Conflating them is how you ship a correct fix for the wrong mechanism.
//
// TWO RATES, BOTH REPORTED, BECAUSE THEY ARE NOT THE SAME NUMBER
// --------------------------------------------------------------
// "21 out of 100" has been read as a capture rate. It is not: it is the fraction of
// recorded-ZERO DOCS that are wrong. Those differ by orders of magnitude, so both are
// printed with their denominators spelled out:
//
//   doc-level under-report rate = docs where recorded < live      / docs fetched
//   thread-level capture rate   = SUM(recorded) / SUM(live threads)
//   fetchable capture rate      = SUM(recorded) / SUM(threads that existed at fetch time)
//
// The third is the one that indicts the ARCHIVER. The first two also count threads that
// had not been written yet, which no archiver could have captured.
//
// A FAILED FETCH IS NEVER AGREEMENT — same property the sibling audit holds. An errored
// probe is FETCH-FAILED and leaves both numerator and denominator untouched.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_ARCHIVE_DIR = "docs/history/pr-reviews";
const DEFAULT_SHARD_DIR = "docs/github/prs/shards";
const OWNER = "Lucent-Financial-Group";
const REPO = "Zeta";

/** `| Total threads | 12 |` — the archive's own recorded count. */
const RECORDED_RE = /^\|\s*Total threads\s*\|\s*(\d+)\s*\|\s*$/m;
const FILENAME_RE = /^PR-(\d+)-/;

interface ArchiveDoc {
  readonly file: string;
  readonly prNumber: number;
  readonly recordedThreads: number;
  /** ISO-8601 from the shard. null when no shard exists for this PR. */
  readonly fetchedAt: string | null;
  readonly mergedAt: string | null;
}

type Verdict =
  | "AGREE"
  | "RACE" // every missing thread post-dates fetched_at
  | "LOSS" // at least one thread existed at fetched_at and was not recorded
  | "OVER-REPORT"
  | "NO-SHARD" // cannot classify: no fetched_at to compare against
  | "FETCH-FAILED";

interface LiveThread {
  readonly firstCommentAt: string | null;
  readonly author: string | null;
}

interface Row {
  readonly doc: ArchiveDoc;
  readonly live: readonly LiveThread[] | null;
  readonly preFetch: number;
  readonly postFetch: number;
  readonly verdict: Verdict;
  readonly error: string | null;
}

// --- archive + shard side ---------------------------------------------------

interface Shard {
  pr_number?: number;
  fetched_at?: string;
  merged_at?: string;
}

/** pr_number -> {fetched_at, merged_at}. Built by walking every shard bucket. */
function readShards(dir: string): Map<number, { fetchedAt: string; mergedAt: string | null }> {
  const out = new Map<number, { fetchedAt: string; mergedAt: string | null }>();
  if (!existsSync(dir)) return out;
  for (const bucket of readdirSync(dir)) {
    const bucketPath = join(dir, bucket);
    let entries: string[];
    try {
      entries = readdirSync(bucketPath);
    } catch {
      continue; // a file, not a bucket dir
    }
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      let parsed: Shard;
      try {
        parsed = JSON.parse(readFileSync(join(bucketPath, name), "utf8")) as Shard;
      } catch {
        continue;
      }
      if (typeof parsed.pr_number !== "number" || typeof parsed.fetched_at !== "string") continue;
      const prior = out.get(parsed.pr_number);
      // Several shards can exist for one PR across re-archives; the LATEST fetch is the
      // one whose blind spot we are measuring, because it is the one that wrote the doc.
      if (prior === undefined || prior.fetchedAt < parsed.fetched_at) {
        out.set(parsed.pr_number, {
          fetchedAt: parsed.fetched_at,
          mergedAt: typeof parsed.merged_at === "string" ? parsed.merged_at : null,
        });
      }
    }
  }
  return out;
}

function readArchive(dir: string, shardDir: string): ArchiveDoc[] {
  const shards = readShards(shardDir);
  const out: ArchiveDoc[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const m = FILENAME_RE.exec(name);
    if (m === null) continue;
    const rec = RECORDED_RE.exec(readFileSync(join(dir, name), "utf8"));
    if (rec === null) continue; // no Outcome table -> not a comparable doc
    const prNumber = Number.parseInt(m[1]!, 10);
    const shard = shards.get(prNumber);
    out.push({
      file: name,
      prNumber,
      recordedThreads: Number.parseInt(rec[1]!, 10),
      fetchedAt: shard?.fetchedAt ?? null,
      mergedAt: shard?.mergedAt ?? null,
    });
  }
  out.sort((a, b) => (a.prNumber < b.prNumber ? -1 : a.prNumber > b.prNumber ? 1 : 0));
  return out;
}

// --- sampling (identical construction to the sibling audit, so draws replay) ---

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

// PAGINATED DELIBERATELY. A single `first:100` page is the 250-commit-cap shape: it
// returns success while dropping data. `--paginate` + pageInfo means a 300-thread PR
// is measured, not silently truncated to 100.
const QUERY =
  "query($o:String!,$r:String!,$n:Int!,$endCursor:String){repository(owner:$o,name:$r)" +
  "{pullRequest(number:$n){reviewThreads(first:100,after:$endCursor)" +
  "{pageInfo{hasNextPage endCursor}nodes{comments(first:1){nodes{createdAt author{login}}}}}}}}";

interface ProbeShape {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          nodes?: Array<{
            comments?: { nodes?: Array<{ createdAt?: string; author?: { login?: string } | null }> };
          }>;
        };
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

/** Split `{...}{...}` page concatenation from `gh api graphql --paginate`. */
function splitConcatenatedJson(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(raw.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

function probeOnce(pr: number): { ok: true; threads: LiveThread[] } | { ok: false; error: string } {
  const proc = Bun.spawnSync([
    "gh",
    "api",
    "graphql",
    "--paginate",
    "-f",
    `query=${QUERY}`,
    "-F",
    `o=${OWNER}`,
    "-F",
    `r=${REPO}`,
    "-F",
    `n=${pr}`,
  ]);
  if (proc.exitCode !== 0) {
    return { ok: false, error: `gh exit ${proc.exitCode}: ${proc.stderr.toString().trim().slice(0, 200)}` };
  }
  const pages = splitConcatenatedJson(proc.stdout.toString());
  if (pages.length === 0) return { ok: false, error: "empty response" };
  const threads: LiveThread[] = [];
  let sawThreadsField = false;
  for (const page of pages) {
    let parsed: ProbeShape;
    try {
      parsed = JSON.parse(page) as ProbeShape;
    } catch {
      return { ok: false, error: `unparseable page: ${page.slice(0, 120)}` };
    }
    if (parsed.errors !== undefined && parsed.errors.length > 0) {
      return { ok: false, error: `graphql errors: ${JSON.stringify(parsed.errors).slice(0, 200)}` };
    }
    const rt = parsed.data?.repository?.pullRequest?.reviewThreads;
    if (rt === undefined || rt === null) continue;
    sawThreadsField = true;
    for (const node of rt.nodes ?? []) {
      const c = node.comments?.nodes?.[0];
      threads.push({ firstCommentAt: c?.createdAt ?? null, author: c?.author?.login ?? null });
    }
  }
  // Deleted PR / missing field is UNKNOWN, never zero.
  if (!sawThreadsField) return { ok: false, error: "no reviewThreads field in response" };
  return { ok: true, threads };
}

function probeWithRetry(pr: number, attempts: number): { threads: LiveThread[] | null; error: string | null } {
  let lastError = "";
  for (let i = 0; i < attempts; i++) {
    const r = probeOnce(pr);
    if (r.ok) return { threads: r.threads, error: null };
    lastError = r.error;
    if (i < attempts - 1) Bun.sleepSync(750 * (i + 1));
  }
  return { threads: null, error: lastError };
}

// --- main -------------------------------------------------------------------

type Population = "zero" | "nonzero" | "all";

function parseArgs(argv: readonly string[]): {
  dir: string;
  shardDir: string;
  sample: number;
  seed: number;
  prs: number[] | null;
  attempts: number;
  population: Population;
} {
  let dir = DEFAULT_ARCHIVE_DIR;
  let shardDir = DEFAULT_SHARD_DIR;
  let sample = 0;
  let seed = 0;
  let prs: number[] | null = null;
  let attempts = 3;
  let population: Population = "all";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--archive-dir") dir = argv[++i] ?? dir;
    else if (a === "--shard-dir") shardDir = argv[++i] ?? shardDir;
    else if (a === "--sample") sample = Number.parseInt(argv[++i] ?? "0", 10);
    else if (a === "--seed") seed = Number.parseInt(argv[++i] ?? "0", 10);
    else if (a === "--attempts") attempts = Number.parseInt(argv[++i] ?? "3", 10);
    else if (a === "--population") {
      const p = argv[++i] ?? "all";
      population = p === "nonzero" ? "nonzero" : p === "zero" ? "zero" : "all";
    } else if (a === "--prs") {
      prs = (argv[++i] ?? "")
        .split(",")
        .filter((s) => s.trim().length > 0)
        .map((s) => Number.parseInt(s, 10));
    }
  }
  return { dir, shardDir, sample, seed, prs, attempts, population };
}

function main(): void {
  const args = parseArgs(Bun.argv.slice(2));
  const all = readArchive(args.dir, args.shardDir);

  let population: ArchiveDoc[];
  if (args.prs !== null) {
    const wanted = new Set(args.prs);
    population = all.filter((d) => wanted.has(d.prNumber));
  } else if (args.population === "nonzero") population = all.filter((d) => d.recordedThreads > 0);
  else if (args.population === "zero") population = all.filter((d) => d.recordedThreads === 0);
  else population = all;

  const chosen =
    args.prs !== null || args.sample <= 0
      ? population
      : sampleWithoutReplacement(population, args.sample, args.seed);

  console.log(`archive-dir       : ${args.dir}`);
  console.log(`docs parsed       : ${all.length}   (with shard fetched_at: ${all.filter((d) => d.fetchedAt !== null).length})`);
  console.log(`population        : ${args.prs !== null ? "explicit --prs" : args.population} (${population.length} docs)`);
  console.log(`sample size       : ${chosen.length}   seed: ${args.seed}   attempts/PR: ${args.attempts}`);
  console.log("");
  console.log("PR\trecorded\tlive\tpre_fetch\tpost_fetch\tverdict\tmerged_at\tfetched_at\tearliest_missed_at\tnote");

  const rows: Row[] = [];
  for (const doc of chosen) {
    const { threads, error } = probeWithRetry(doc.prNumber, args.attempts);
    let verdict: Verdict;
    let preFetch = 0;
    let postFetch = 0;
    let earliestMissed = "-";
    if (threads === null) verdict = "FETCH-FAILED";
    else if (doc.fetchedAt === null) verdict = "NO-SHARD";
    else {
      const fetchedAt = doc.fetchedAt;
      for (const t of threads) {
        // ISO-8601 UTC: ordinal compare is chronological. A thread with no timestamp is
        // counted as PRE-fetch — the conservative side, since it accuses the archiver.
        if (t.firstCommentAt === null || t.firstCommentAt <= fetchedAt) preFetch++;
        else postFetch++;
      }
      if (threads.length === doc.recordedThreads) verdict = "AGREE";
      else if (threads.length < doc.recordedThreads) verdict = "OVER-REPORT";
      else if (preFetch > doc.recordedThreads) verdict = "LOSS";
      else verdict = "RACE";
      const missedTimes = threads
        .map((t) => t.firstCommentAt)
        .filter((s): s is string => s !== null)
        .sort();
      // Print the earliest timestamp among threads beyond what was recorded — the
      // sharpest single number for eyeballing whether it beat the fetch.
      earliestMissed = missedTimes[doc.recordedThreads] ?? "-";
    }
    rows.push({ doc, live: threads, preFetch, postFetch, verdict, error });
    console.log(
      [
        doc.prNumber,
        doc.recordedThreads,
        threads?.length ?? "-",
        threads === null ? "-" : preFetch,
        threads === null ? "-" : postFetch,
        verdict,
        doc.mergedAt ?? "-",
        doc.fetchedAt ?? "-",
        earliestMissed,
        error ?? "",
      ].join("\t"),
    );
  }

  const by = (v: Verdict): number => rows.filter((r) => r.verdict === v).length;
  const classified = rows.filter((r) => r.verdict !== "FETCH-FAILED" && r.verdict !== "NO-SHARD");
  const sum = (f: (r: Row) => number): number => classified.reduce((acc, r) => acc + f(r), 0);
  const recordedTotal = sum((r) => r.doc.recordedThreads);
  const liveTotal = sum((r) => r.live?.length ?? 0);
  const preFetchTotal = sum((r) => r.preFetch);

  console.log("");
  console.log(`classified docs   : ${classified.length} of ${rows.length}  (FETCH-FAILED ${by("FETCH-FAILED")}, NO-SHARD ${by("NO-SHARD")} excluded)`);
  console.log(`AGREE             : ${by("AGREE")}`);
  console.log(`RACE              : ${by("RACE")}   (missing threads all post-date fetched_at)`);
  console.log(`LOSS              : ${by("LOSS")}   (thread existed AT fetch time and was not recorded)`);
  console.log(`OVER-REPORT       : ${by("OVER-REPORT")}`);
  console.log("");
  if (classified.length > 0) {
    const under = by("RACE") + by("LOSS");
    console.log(`doc-level under-report rate : ${under}/${classified.length} = ${((under / classified.length) * 100).toFixed(1)}%`);
  }
  if (liveTotal > 0) {
    console.log(`thread-level capture rate   : ${recordedTotal}/${liveTotal} = ${((recordedTotal / liveTotal) * 100).toFixed(1)}%   (vs ALL threads that now exist)`);
  }
  if (preFetchTotal > 0) {
    console.log(`fetchable capture rate      : ${recordedTotal}/${preFetchTotal} = ${((Math.min(recordedTotal, preFetchTotal) / preFetchTotal) * 100).toFixed(1)}%   (vs threads that existed when the archiver looked)`);
  }
  console.log(`threads recorded / live / pre-fetch : ${recordedTotal} / ${liveTotal} / ${preFetchTotal}`);

  if (rows.length === 0) {
    console.log("REFUSED: sampled 0 documents.");
    process.exit(2);
  }
  process.exit(by("RACE") + by("LOSS") + by("OVER-REPORT") > 0 ? 1 : 0);
}

main();
