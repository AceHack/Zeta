// format.ts — the on-disk shape of the git-native inverted index, and the
// corpus-selection policy that decides what is in it.
// 081M0QTXTR3087G0R002R439FH
//
// TEXT, NOT BINARY. `.claude/rules/no-binary-in-proof-lineage.md` governs
// verification artifacts and this index is derived data rather than a proof, so
// the rule does not strictly bind — but its REASONS do, and they are the reason
// for JSONL here: a binary index is unreviewable in a diff, unmergeable, and
// hides a byte-swap where no diff shows it. Measured cost of the choice is in
// the README; it is a decision, not a default.
//
// NO TIMESTAMP APPEARS IN ANY ARTIFACT. A `generated:` field would make the
// byte-identical-rebuild property false by construction, and that property is
// what makes the index DST-replayable and its diffs meaningful. The artifact is
// a pure function of the git rev. That is the whole design.
//
// WHERE THIS DIVERGES FROM LUCENE, AND WHY. Lucene (Doug Cutting, 1999-; the
// engine under Solr and Elasticsearch) writes immutable binary segments and
// merges them in tiers, marks deletions with tombstones rather than editing in
// place, and keeps the term dictionary separate from the postings. Three of
// those four we keep:
//   - term dictionary separate from postings:  YES, `files.txt` + per-shard
//     JSONL, so a query reads one shard rather than the whole index.
//   - immutable shards, stable placement:      YES, a term's shard is a pure
//     function of the term, so a document change perturbs only the shards of
//     the terms it touched — which is what keeps a 6-hourly diff reviewable.
//   - tombstones over in-place edit:           NOT NEEDED. Git already gives us
//     that: a rebuild is a new commit, and the previous index is not destroyed,
//     it is the parent. The Z-set retraction shape Lucene implements internally
//     is the substrate we are already standing on.
//   - binary segments + tiered merge:          NO, and this is the real
//     divergence. Lucene optimises for update latency and disk footprint on a
//     corpus that changes continuously. We optimise for reviewability,
//     byte-identical rebuild, and no daemon, on a corpus that changes on a
//     6-hour cadence. Full rebuild at a rev is cheap at this corpus size and is
//     the only thing that makes idempotency checkable. If the corpus grows past
//     what a full rebuild can carry, tiered merge is the known answer and the
//     shard layout here is deliberately compatible with adding it.

import { stringCompare } from "../../collation/collation";

/** Schema id. Bump on any change that alters how a reader must parse the files. */
export const INDEX_SCHEMA = "zeta.search.inverted/v1";

/** Where the committed index lives. DV2.0: the corpus is the hub, this is a satellite. */
export const INDEX_DIR = "db/search-index/inverted";

export const MANIFEST_FILE = "manifest.json";
export const FILES_FILE = "files.txt";
export const HIGH_DF_FILE = "high-df.jsonl";

/**
 * Postings are not written for a term appearing in more than this FRACTION of
 * the indexed corpus, floored at {@link MIN_DOCUMENT_FREQUENCY_CAP}.
 *
 * A statistical stop list, the classical companion to the hand-written one in
 * `tokenize.ts` (MRS 2008 §2.2.2 builds stop lists exactly this way, by
 * collection frequency). The hand list catches English function words; this
 * catches whatever THIS corpus says constantly — `zeta`, `import`, `2026`.
 *
 * WHY A FRACTION AND NOT A CONSTANT — a caught error, recorded because the
 * number that was wrong looked entirely reasonable. v0 of this file used a flat
 * cap of 100, chosen from the byte table below. It was measured, defensible,
 * and it REFUSED THE QUERY THIS WORK-ITEM EXISTS TO ANSWER: `landauer` occurs
 * in 447 of 32,936 files at rev 6426eacf, so a cap of 100 turned the motivating
 * search into "term is too common". A cap tuned only against the size column
 * will do that every time, because the size column has no opinion about which
 * terms anyone searches for. 2% leaves `landauer` a 32% margin.
 *
 * MEASURED at rev 6426eacf (32,936 indexed files, 286,164 terms, 7,734,841
 * postings). Raw JSONL bytes, and the git-pack cost, which is the number that
 * actually decides whether a 6-hourly artifact is affordable:
 *
 * |    cap | indexed terms | postings  | raw MiB | packed MiB |
 * |-------:|--------------:|----------:|--------:|-----------:|
 * |    100 |       278,528 | 1,122,518 |   26.45 |          - |
 * |    500 |       283,449 | 2,238,728 |   44.57 |          - |
 * |  * 659 |       284,019 | 2,566,355 |   49.89 |      17.74 |
 * |   1000 |       284,709 | 3,120,880 |   58.89 |          - |
 * |   2000 |       285,485 | 4,224,678 |   76.82 |          - |
 * | (none) |       286,164 | 7,734,841 |  ~80.89 |          - |
 *
 * `* 659` is 2% of this corpus — the shipped setting. The distribution behind
 * it is Zipf and the split is stark: terms in <=100 files are 97.3% of the
 * vocabulary and 14.5% of the postings, so the cap buys most of the size back
 * while keeping every rare term, which is the entire class the 2026-08-22
 * failure was about.
 *
 * THE CAPPED TERMS ARE NOT DISCARDED. Their document frequency is written to
 * `high-df.jsonl`, and a query for one is REFUSED with that count and the exact
 * `git grep` that answers it — never answered with zero, and never with a
 * partial list presented as complete. A cap that turned into a silent empty
 * result would be this work-item's own bug, moved one layer in.
 */
export const DOCUMENT_FREQUENCY_CAP_FRACTION = 0.02;

/** Floor for the df cap, so a small corpus is not capped into uselessness. */
export const MIN_DOCUMENT_FREQUENCY_CAP = 250;

export function documentFrequencyCap(fileCount: number): number {
  return Math.max(MIN_DOCUMENT_FREQUENCY_CAP, Math.ceil(fileCount * DOCUMENT_FREQUENCY_CAP_FRACTION));
}

/**
 * Blobs larger than this are skipped. Big blobs in this repo are generated
 * (bundles, golden vectors, transcripts) and they dominate the postings without
 * ever being the thing anyone searches for. Recorded in the manifest so a
 * reader can see the corpus was bounded rather than complete.
 */
export const MAX_BLOB_BYTES = 512 * 1024;

/**
 * Extensions that get indexed. An allowlist, not a denylist: a denylist over a
 * repo with 42,911 tracked files silently admits every new binary format
 * anyone adds.
 */
export const INDEXED_EXTENSIONS: readonly string[] = Object.freeze([
  "bicep",
  "c",
  "cfg",
  "cjs",
  "conf",
  "cpp",
  "cs",
  "css",
  "csproj",
  "csx",
  "editorconfig",
  "env",
  "fs",
  "fsi",
  "fsproj",
  "fsx",
  "go",
  "gradle",
  "graphql",
  "h",
  "hpp",
  "hs",
  "html",
  "ini",
  "java",
  "js",
  "json",
  "jsonc",
  "jsonl",
  "kt",
  "lean",
  "lock",
  "md",
  "mjs",
  "nix",
  "php",
  "props",
  "proto",
  "ps1",
  "py",
  "rb",
  "rs",
  "scala",
  "sh",
  "sql",
  "svg",
  "swift",
  "targets",
  "tf",
  "tla",
  "toml",
  "ts",
  "tsx",
  "txt",
  "vue",
  "wat",
  "xml",
  "yaml",
  "yml",
  "zig",
]);

/** Extensionless files worth indexing, matched on basename. */
export const INDEXED_BASENAMES: readonly string[] = Object.freeze([
  "AGENTS.md",
  "CLAUDE.md",
  "Dockerfile",
  "GOVERNANCE.md",
  "Makefile",
  "README",
]);

/**
 * Trees excluded from the corpus, each with the measurement that justifies it.
 *
 * The measurement is mandatory and a test enforces it, following the precedent
 * `../exclusions.ts` set: the 2026-08-22 prose named `references/prior-art` as
 * the heavy tree and it was 8.0K. An exclusion without a number is folklore.
 *
 * EXCLUSION IS NOT SILENT. Every exclusion is written into the manifest and
 * printed by the query CLI on stderr, because a search that skipped a tree and
 * said "no matches" is the exact failure this whole work-item exists to make
 * impossible.
 */
export interface ExcludedTree {
  readonly prefix: string;
  readonly measurement: string;
}

export const EXCLUDED_TREES: readonly ExcludedTree[] = Object.freeze([
  {
    prefix: "docs/github/prs/",
    measurement:
      "9,652 files / 10.53 MiB at 6426eacf (2026-08-23) — machine-generated PR-mirror JSON shards. Indexing them roughly doubles the postings for content nobody searches by term; the PR mirror has its own manifest.jsonl lookup.",
  },
  {
    prefix: "references/",
    measurement:
      "13 tracked files / 1.84 MiB at 6426eacf, but the directory is the mount point for the gitignored multi-gigabyte prior-art mirror (CLAUDE.md: 'a naive grep -r . is a 2-hour runaway'). Excluded so a checkout that HAS the mirror indexes the same corpus as one that does not — otherwise the artifact stops being a function of the rev.",
  },
  {
    prefix: "db/search-index/",
    measurement:
      "the index's OWN OUTPUT — 54.96 MiB / 40 files at 01050c8b. Caught 2026-08-23 by reading the first post-merge query on main: 7 of its own files sit UNDER the 512 KiB blob cap (high-df.jsonl 57,366 B, manifest.json 10,165 B, and terms-{j,q,x,y,z}.jsonl at 173-339 KB), so the next rebuild would have indexed the previous rebuild. That is a feedback loop, not a corpus: every term in the index becomes a term IN the index, every path in files.txt becomes a hit for itself, and the artifact grows each cycle for no retrieval value. The large shards were excluded only by the size cap, which is luck rather than design.",
  },
  {
    prefix: "node_modules/",
    measurement:
      "not tracked in git at 6426eacf, so this excludes nothing today. Kept because a vendored dependency tree is the classic way an index silently triples, and the cost of the guard is one string comparison.",
  },
]);

export function isExcluded(path: string): boolean {
  for (const t of EXCLUDED_TREES) {
    if (path.startsWith(t.prefix)) return true;
    if (path.includes("/" + t.prefix)) return true;
  }
  return false;
}

export function extensionOf(path: string): string {
  const slash = path.lastIndexOf("/");
  const base = slash < 0 ? path : path.slice(slash + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1);
}

export function basenameOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? path : path.slice(slash + 1);
}

const EXT_SET = new Set(INDEXED_EXTENSIONS);
const BASENAME_SET = new Set(INDEXED_BASENAMES);

/** The corpus predicate, on path alone. Size is checked separately by the builder. */
export function isIndexablePath(path: string): boolean {
  if (isExcluded(path)) return false;
  if (BASENAME_SET.has(basenameOf(path))) return true;
  return EXT_SET.has(extensionOf(path));
}

/**
 * Shard key for a term. First character when it is ASCII alphanumeric, `_`
 * otherwise — 37 shards.
 *
 * Chosen over hashing on purpose: a human looking for why `landauer` is missing
 * can open `terms-l.jsonl` and look. A hash shard is marginally more balanced
 * and completely unreviewable, and reviewability is the property this artifact
 * is being paid for. Skew is measured in the README rather than assumed away.
 */
export function shardOf(term: string): string {
  const c = term.charCodeAt(0);
  const alnum = (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x7a);
  return alnum ? term[0]! : "_";
}

export function shardFile(shard: string): string {
  return `terms-${shard}.jsonl`;
}

/**
 * Document id: the first {@link DOC_ID_HEX} hex characters of SHA-256 of the
 * file's PATH. Content-derived, therefore STABLE across rebuilds.
 *
 * WHY NOT A LINE NUMBER, MEASURED. v0 of this file used the file's index in the
 * sorted path list. It is smaller and it is wrong: adding one file shifts every
 * subsequent id, so every posting after it is rewritten. Measured on two real
 * builds one cadence tick apart (rev 7b55df9f -> 6426eacf, 110 commits, ~6h):
 *
 *   positional ids:  40 files changed, 281,464 insertions(+), 278,978 deletions(-)
 *                    5,088 KiB added to the git pack for ONE tick
 *
 * At 4 ticks a day that is ~7 GiB of pack growth a year for a 19 MiB artifact,
 * and — worse — a diff nobody can read, which forfeits the entire reason the
 * index is text rather than binary. A stable id costs ~6 characters per posting
 * and buys a diff that contains only what actually changed.
 *
 * This is the same problem Lucene solves with per-segment immutable docIds, and
 * the same answer this repo reaches for elsewhere: content-address it
 * (`dv2-data-split-discipline-activated.md` #6 — "content-address" is listed as
 * an idempotent operation for exactly this reason).
 */
export type DocId = string;

/** A postings entry: [docId, termFrequency]. */
export type Posting = readonly [DocId, number];

/**
 * Hex characters of the path digest used as a doc id. 10 hex = 40 bits.
 *
 * At 32,936 files the birthday collision probability is n^2/2/2^40 ~= 5e-7. A
 * collision is not tolerated silently: the builder THROWS, because merging two
 * files' postings under one id would make the index answer confidently and
 * wrongly, which is the one failure this whole work-item exists to remove. If
 * it ever fires, widen this constant; the manifest records it so a reader knows
 * which width produced the artifact.
 */
export const DOC_ID_HEX = 10;

export interface TermRow {
  /** the term */
  readonly t: string;
  /** postings, ascending by fileId. Document frequency IS `p.length`. */
  readonly p: readonly Posting[];
}

/** A term whose postings were suppressed by the df cap. Counted, never dropped. */
export interface HighDfRow {
  readonly t: string;
  readonly df: number;
}

export interface ShardMeta {
  readonly shard: string;
  readonly file: string;
  readonly terms: number;
  readonly bytes: number;
  readonly sha256: string;
}

/** `files.txt` line: `<docId> TAB <path>`, sorted by path in UTF-8 byte order. */
export function renderFileRow(docId: DocId, path: string): string {
  return `${docId}\t${path}`;
}

export function parseFileRow(line: string): { docId: DocId; path: string } {
  const tab = line.indexOf("\t");
  if (tab < 0) throw new Error(`malformed files.txt line: ${line}`);
  return { docId: line.slice(0, tab), path: line.slice(tab + 1) };
}

export interface Manifest {
  readonly schema: string;
  /** the git rev this index was built from. THE load-bearing field. */
  readonly rev: string;
  /** the tree object of that rev — two revs with the same tree yield the same index */
  readonly tree: string;
  readonly tokenizer: {
    readonly version: number;
    readonly caseFold: string;
    readonly minTokenLength: number;
    readonly maxTokenLength: number;
    readonly stopWords: readonly string[];
  };
  readonly corpus: {
    readonly extensions: readonly string[];
    readonly basenames: readonly string[];
    readonly excludedTrees: readonly ExcludedTree[];
    readonly maxBlobBytes: number;
    readonly skippedOversize: number;
    readonly skippedNotIndexable: number;
    readonly maxDocumentFrequency: number;
    readonly docIdHexChars: number;
  };
  readonly fileCount: number;
  readonly termCount: number;
  readonly postingCount: number;
  /** terms whose postings were suppressed by the df cap; their df is in high-df.jsonl */
  readonly highDfTermCount: number;
  readonly shards: readonly ShardMeta[];
}

/** Canonical term order: the repo's collation treaty. Never localeCompare. */
export function compareTerms(a: string, b: string): number {
  return stringCompare(a, b);
}

/**
 * Canonical JSON for one term row. Hand-rendered rather than `JSON.stringify`
 * on an object literal, so key order is pinned by this function instead of by
 * V8's property-insertion order — the artifact must not depend on how an object
 * happened to be constructed.
 */
export function renderTermRow(row: TermRow): string {
  const postings = row.p.map((p) => `["${p[0]}",${p[1]}]`).join(",");
  return `{"t":${JSON.stringify(row.t)},"p":[${postings}]}`;
}

export function parseTermRow(line: string): TermRow {
  const raw = JSON.parse(line) as { t: string; p: [DocId, number][] };
  return { t: raw.t, p: raw.p };
}

export function renderHighDfRow(row: HighDfRow): string {
  return `{"t":${JSON.stringify(row.t)},"df":${row.df}}`;
}

export function parseHighDfRow(line: string): HighDfRow {
  return JSON.parse(line) as HighDfRow;
}
