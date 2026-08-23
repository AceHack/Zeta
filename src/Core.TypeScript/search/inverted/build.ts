#!/usr/bin/env bun
// build.ts — build the git-native inverted index from an EXPLICIT git rev.
// 081M0QTXTR3087G0R002R439FH
//
//   bun src/Core.TypeScript/search/inverted/build.ts [--rev <rev>] [--out <dir>]
//
// Default rev is `origin/main`, NOT `HEAD` and never the working tree. The bug
// this exists to prevent was a search of a checkout 336 commits behind
// origin/main; defaulting to the working tree would reproduce it in the index.
//
// The output is a pure function of the rev: no timestamps, no hostname, no
// ordering that depends on filesystem enumeration. Building twice at the same
// rev must produce byte-identical files, and `idempotency.test.ts` fails if it
// does not.

import { mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

import { tokenize, TOKENIZER_VERSION, MIN_TOKEN_LENGTH, MAX_TOKEN_LENGTH, STOP_WORDS } from "./tokenize.ts";
import {
  INDEX_SCHEMA,
  INDEX_DIR,
  MANIFEST_FILE,
  FILES_FILE,
  HIGH_DF_FILE,
  MAX_BLOB_BYTES,
  documentFrequencyCap,
  DOC_ID_HEX,
  INDEXED_EXTENSIONS,
  INDEXED_BASENAMES,
  EXCLUDED_TREES,
  isIndexablePath,
  shardOf,
  shardFile,
  compareTerms,
  renderTermRow,
  renderHighDfRow,
  renderFileRow,
  type DocId,
  type Manifest,
  type ShardMeta,
  type TermRow,
} from "./format.ts";
import { listBlobs, readBlobs, resolveRev, treeOf, looksBinary } from "./git-corpus.ts";

export interface BuildOptions {
  readonly repoRoot: string;
  readonly rev: string;
  readonly outDir: string;
  readonly quiet?: boolean;
  /** override the df cap; measurement hook, defaults to MAX_DOCUMENT_FREQUENCY */
  readonly maxDf?: number | undefined;
}

export interface BuildResult {
  readonly manifest: Manifest;
  readonly elapsedMs: number;
  readonly totalBytes: number;
}

/**
 * Build and write the index. Returns the manifest it wrote.
 *
 * Memory shape, stated because it is the scaling limit: the whole posting map
 * is held in RAM (a Map<term, Map<fileId, tf>>) and written once at the end.
 * At the 2026-08-23 corpus that peaks around 2 GB of heap. Beyond roughly 4x
 * this corpus the answer is Lucene's — build per-shard segments and merge —
 * and the shard layout is already compatible with that. Named rather than
 * discovered.
 */
export function buildIndex(opts: BuildOptions): BuildResult {
  const started = Date.now();
  const rev = resolveRev(opts.repoRoot, opts.rev);
  const tree = treeOf(opts.repoRoot, rev);

  const blobs = listBlobs(opts.repoRoot, rev);

  let skippedNotIndexable = 0;
  let skippedOversize = 0;
  const selected: { path: string; sha: string }[] = [];
  for (const b of blobs) {
    if (!isIndexablePath(b.path)) {
      skippedNotIndexable++;
      continue;
    }
    if (b.size > MAX_BLOB_BYTES) {
      skippedOversize++;
      continue;
    }
    selected.push({ path: b.path, sha: b.sha });
  }

  // files.txt is ordered by path in UTF-8 byte order so that adding a file
  // inserts exactly one line and moves nothing else.
  selected.sort((a, b) => compareTerms(a.path, b.path));
  const maxDf = opts.maxDf ?? documentFrequencyCap(selected.length);

  // Doc ids are derived from the PATH, so they survive across rebuilds.
  const docIdOf = new Map<string, DocId>();
  const pathOfDocId = new Map<DocId, string>();
  for (const f of selected) {
    const id = createHash("sha256").update(f.path, "utf8").digest("hex").slice(0, DOC_ID_HEX);
    const clash = pathOfDocId.get(id);
    if (clash !== undefined && clash !== f.path) {
      // Loud, never silent: two paths under one id would merge their postings
      // and make the index answer confidently and wrongly.
      throw new Error(
        `doc-id collision at ${DOC_ID_HEX} hex chars: "${clash}" and "${f.path}" both hash to ${id}. Widen DOC_ID_HEX in format.ts.`,
      );
    }
    pathOfDocId.set(id, f.path);
    docIdOf.set(f.path, id);
  }

  // One sha may appear at several paths (identical content). cat-file --batch
  // returns one record per REQUESTED sha, so request per sha and fan the result
  // out to every path that carries it.
  const postings = new Map<string, Map<DocId, number>>();
  const shaToIds = new Map<string, DocId[]>();
  for (const f of selected) {
    const id = docIdOf.get(f.path)!;
    const cur = shaToIds.get(f.sha);
    if (cur) cur.push(id);
    else shaToIds.set(f.sha, [id]);
  }

  const uniqueShas = [...shaToIds.keys()];
  let skippedBinary = 0;

  // Chunked so the batch stdout buffer stays bounded.
  const CHUNK = 2000;
  for (let i = 0; i < uniqueShas.length; i += CHUNK) {
    const chunk = uniqueShas.slice(i, i + CHUNK);
    readBlobs(opts.repoRoot, chunk, (sha, content) => {
      const ids = shaToIds.get(sha);
      if (!ids) return;
      if (looksBinary(content)) {
        skippedBinary += ids.length;
        return;
      }
      const terms = tokenize(content.toString("utf8"));
      // Count term frequency once for this content, then attribute it to every
      // path that carries the content.
      const tf = new Map<string, number>();
      for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const [term, n] of tf) {
        let plist = postings.get(term);
        if (!plist) {
          plist = new Map<DocId, number>();
          postings.set(term, plist);
        }
        for (const id of ids) plist.set(id, n);
      }
    });
    if (!opts.quiet) {
      process.stderr.write(
        `\r[build] blobs ${Math.min(i + CHUNK, uniqueShas.length)}/${uniqueShas.length}  terms ${postings.size}   `,
      );
    }
  }
  if (!opts.quiet) process.stderr.write("\n");

  const outDir = opts.outDir;
  mkdirSync(outDir, { recursive: true });

  // Remove stale shard files so a term class that disappeared does not linger.
  // Idempotency is about the whole directory, not one file at a time.
  //
  // No `existsSync` guard: `mkdirSync` above already created it, and a
  // check-then-use pair is a race (CWE-367) even when the window looks
  // impossible — `lint-check-then-use-file-races.ts` is right to refuse it.
  // Act, and treat "not there" as the outcome it is.
  let existing: string[];
  try {
    existing = readdirSync(outDir);
  } catch {
    existing = [];
  }
  for (const name of existing) {
    if (name.startsWith("terms-") && name.endsWith(".jsonl")) {
      rmSync(join(outDir, name), { force: true });
    }
  }

  writeFileSync(
    join(outDir, FILES_FILE),
    selected.map((f) => renderFileRow(docIdOf.get(f.path)!, f.path)).join("\n") + "\n",
    "utf8",
  );

  const byShard = new Map<string, string[]>();
  const sortedTerms = [...postings.keys()].sort(compareTerms);
  const highDf: string[] = [];
  let postingCount = 0;
  let indexedTermCount = 0;
  for (const term of sortedTerms) {
    const plist = postings.get(term)!;
    // The df cap: postings suppressed, the COUNT kept. See MAX_DOCUMENT_FREQUENCY.
    if (plist.size > maxDf) {
      highDf.push(renderHighDfRow({ t: term, df: plist.size }));
      continue;
    }
    // Postings ordered by docId in the collation treaty's order, so the line is
    // a function of the SET of postings and not of insertion order.
    const ids = [...plist.keys()].sort(compareTerms);
    const row: TermRow = { t: term, p: ids.map((id) => [id, plist.get(id)!] as const) };
    postingCount += ids.length;
    indexedTermCount++;
    const shard = shardOf(term);
    let lines = byShard.get(shard);
    if (!lines) {
      lines = [];
      byShard.set(shard, lines);
    }
    lines.push(renderTermRow(row));
  }

  const highDfBody = highDf.length > 0 ? highDf.join("\n") + "\n" : "";
  writeFileSync(join(outDir, HIGH_DF_FILE), highDfBody, "utf8");

  const shards: ShardMeta[] = [];
  let totalBytes = Buffer.byteLength(highDfBody, "utf8");
  for (const shard of [...byShard.keys()].sort(compareTerms)) {
    const lines = byShard.get(shard)!;
    const body = lines.join("\n") + "\n";
    const file = shardFile(shard);
    writeFileSync(join(outDir, file), body, "utf8");
    const bytes = Buffer.byteLength(body, "utf8");
    totalBytes += bytes;
    shards.push({
      shard,
      file,
      terms: lines.length,
      bytes,
      sha256: createHash("sha256").update(body, "utf8").digest("hex"),
    });
  }

  const manifest: Manifest = {
    schema: INDEX_SCHEMA,
    rev,
    tree,
    tokenizer: {
      version: TOKENIZER_VERSION,
      caseFold: "ascii-lower",
      minTokenLength: MIN_TOKEN_LENGTH,
      maxTokenLength: MAX_TOKEN_LENGTH,
      stopWords: STOP_WORDS,
    },
    corpus: {
      extensions: INDEXED_EXTENSIONS,
      basenames: INDEXED_BASENAMES,
      excludedTrees: EXCLUDED_TREES,
      maxBlobBytes: MAX_BLOB_BYTES,
      skippedOversize,
      skippedNotIndexable: skippedNotIndexable + skippedBinary,
      maxDocumentFrequency: maxDf,
      docIdHexChars: DOC_ID_HEX,
    },
    fileCount: selected.length,
    termCount: indexedTermCount,
    postingCount,
    highDfTermCount: highDf.length,
    shards,
  };

  writeFileSync(join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  totalBytes += Buffer.byteLength(JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return { manifest, elapsedMs: Date.now() - started, totalBytes };
}

export function parseArgs(argv: readonly string[]): {
  rev: string;
  out?: string | undefined;
  quiet: boolean;
  maxDf?: number | undefined;
} {
  let rev = "origin/main";
  let out: string | undefined;
  let quiet = false;
  let maxDf: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--rev") rev = argv[++i] ?? rev;
    else if (a === "--out") out = argv[++i];
    else if (a === "--quiet") quiet = true;
    else if (a === "--max-df") maxDf = Number.parseInt(argv[++i] ?? "", 10);
    else if (a === "--help" || a === "-h") {
      throw new Error("usage: build.ts [--rev <rev>] [--out <dir>] [--quiet]");
    } else throw new Error(`unknown argument: ${a}`);
  }
  return { rev, out, quiet, maxDf };
}

export function main(argv: readonly string[]): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }
  const repoRoot = resolve(import.meta.dir, "../../../..");
  const outDir = args.out ? resolve(args.out) : join(repoRoot, INDEX_DIR);
  const r = buildIndex({ repoRoot, rev: args.rev, outDir, quiet: args.quiet, maxDf: args.maxDf });
  const m = r.manifest;
  process.stdout.write(
    `[build] rev=${m.rev.slice(0, 12)} tree=${m.tree.slice(0, 12)}\n` +
      `[build] files=${m.fileCount} terms=${m.termCount} postings=${m.postingCount} high-df-capped=${m.highDfTermCount}\n` +
      `[build] bytes=${(r.totalBytes / 1048576).toFixed(2)} MiB shards=${m.shards.length} elapsed=${(r.elapsedMs / 1000).toFixed(1)}s\n` +
      `[build] skipped: ${m.corpus.skippedNotIndexable} not-indexable, ${m.corpus.skippedOversize} oversize (>${MAX_BLOB_BYTES}B)\n`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
