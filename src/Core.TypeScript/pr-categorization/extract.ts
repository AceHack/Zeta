/**
 * Feature extraction for PR categorisation.
 *
 * Joins three substrates that already exist — nothing here scrapes GitHub:
 *
 *   1. `docs/github/prs/manifest.jsonl`     — PR number, title, head_ref, state, merged_at
 *   2. `git log --name-only`                — the file paths each squash-merge actually touched
 *   3. `docs/history/pr-reviews/PR-*.md`    — author, bot flag, +/- lines, review-thread counts
 *
 * (2) is what makes the study honest: the label comes from the DIFF, and the
 * features a model is allowed to see come from the TITLE side. See areas.ts.
 *
 * Idempotency (discipline #6): the output is a pure function of the inputs,
 * sorted by PR number, one JSON object per line. Re-running over an unchanged
 * repo rewrites byte-identical content; re-running over a grown repo upserts
 * by `pr` and never appends a duplicate. Incremental mode reuses rows already
 * present and only reads archives for PRs it has not seen.
 *
 * Register: `unmetered`. The extractor is exercised by extract.test.ts, but
 * "these features predict something useful" is a claim the study makes, not
 * this file.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { declaredArea, measuredArea, type Area, type DeclaredSource } from './areas.ts';

export interface ManifestRow {
  readonly pr_number: number;
  readonly title: string;
  readonly head_ref: string;
  readonly state: string;
  readonly merged_at: string | null;
  readonly archive_path?: string;
}

export interface ArchiveMeta {
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly createdAt: string | null;
  readonly baseRef: string | null;
  readonly changedFiles: number | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly totalThreads: number | null;
  readonly unresolvedThreads: number | null;
  readonly descriptionChars: number | null;
}

export interface FeatureRow extends ArchiveMeta {
  readonly pr: number;
  readonly title: string;
  readonly headRef: string;
  readonly mergedAt: string | null;
  /** Ground truth, from the diff. */
  readonly measured: Area;
  readonly purity: number;
  readonly areaCount: number;
  readonly areaCounts: Readonly<Record<string, number>>;
  readonly nFiles: number;
  /** Closed-form baseline, from the title/branch. `null` == abstained. */
  readonly declared: Area | null;
  readonly declaredSource: DeclaredSource;
}

/** Squash-merge subjects end in `(#NNNN)`; that is the PR->commit join key. */
const PR_IN_SUBJECT = /\(#(\d+)\)\s*$/;

/**
 * PR number -> changed paths, from one `git log` pass.
 *
 * Only the FIRST commit seen for a PR number is kept. `git log` walks
 * newest-first, and a PR number can legitimately reappear in an older
 * revert/cherry-pick subject; taking the newest is the deterministic choice
 * and is stated here because it is a real (if rare) ambiguity.
 */
export function parseGitLog(raw: string): Map<number, string[]> {
  const out = new Map<number, string[]>();
  let cur: number | null = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('__C__')) {
      const tab = line.indexOf('\t');
      const subject = tab >= 0 ? line.slice(tab + 1) : '';
      const m = PR_IN_SUBJECT.exec(subject);
      cur = m ? Number(m[1]) : null;
      if (cur !== null && !out.has(cur)) out.set(cur, []);
      else if (cur !== null) cur = null; // already have a newer commit for this PR
    } else if (line.length > 0 && cur !== null) {
      out.get(cur)!.push(line);
    }
  }
  return out;
}

export function readGitLog(repoRoot: string): Map<number, string[]> {
  const res = spawnSync(
    'git',
    ['-C', repoRoot, 'log', '--format=__C__%H\t%s', '--name-only', 'HEAD'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 },
  );
  if (res.status !== 0) {
    throw new Error(
      `git log failed (status ${res.status}): ${res.stderr?.slice(0, 500) ?? '(no stderr)'}`,
    );
  }
  return parseGitLog(res.stdout);
}

/**
 * Read a file, or `null` when it does not exist.
 *
 * NOT `existsSync` then `readFileSync`. That pair is a check-then-use race
 * (TOCTOU, CWE-367): the path can be created, deleted, or replaced between the
 * two calls, so the answer the check returned is already stale by the time the
 * read runs — the guard reads as defensive and prevents nothing. Doing the read
 * and interpreting ENOENT is one syscall with one answer and no window.
 *
 * Only ENOENT is swallowed. A permission error, a directory where a file was
 * expected, or an I/O fault is a real failure and rethrows: "absent" and
 * "unreadable" are different facts, and collapsing them would let a broken
 * checkout report as an empty corpus.
 */
function readFileIfPresent(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

const MD_ROW = (label: string) =>
  new RegExp(`^\\|\\s*${label}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`, 'm');

/**
 * A row's value, or `null` when the row is absent OR PRESENT-BUT-EMPTY.
 *
 * The empty case is the one that bites. This used to `return m ? m[1]! : null`,
 * which handled a missing ROW and silently let a blank CELL through as `''` —
 * and `Number('') === 0` is finite, so `| Changed files |  |` parsed as a hard
 * zero. That collapses "unmeasured" into "genuinely zero", which is exactly what
 * the docstring below forbids, and it cannot be undone downstream: every mean
 * built on that column is dragged toward zero by rows that never had a value.
 *
 * The corpus happens to contain no blank cells today (52,876 metadata cells
 * checked, none empty), so this was latent rather than active. It is fixed
 * anyway: the archive schema has already changed once over the corpus's life,
 * and a defect that depends on upstream never emitting a blank is not a
 * property of this parser.
 */
function mdCell(body: string, label: string): string | null {
  const m = MD_ROW(label).exec(body);
  if (m === null) return null;
  const v = m[1]!.trim();
  return v.length === 0 ? null : v;
}

function mdInt(body: string, label: string): number | null {
  const c = mdCell(body, label);
  if (c === null) return null;
  const n = Number(c.replace(/[`,]/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Pull the metadata table out of one archived review file. Every field is
 * optional: the archive schema has changed over the corpus's life and a
 * missing cell must read as "unknown", never as zero.
 */
export function parseArchive(body: string): ArchiveMeta {
  const authorCell = mdCell(body, 'Author');
  let author: string | null = null;
  let authorIsBot = false;
  if (authorCell) {
    const m = /`([^`]+)`\s*\((bot|human)\)/.exec(authorCell);
    if (m) {
      author = m[1]!;
      authorIsBot = m[2] === 'bot';
    } else {
      author = authorCell.replace(/`/g, '').trim() || null;
    }
  }
  const addDel = mdCell(body, 'Additions / deletions');
  let additions: number | null = null;
  let deletions: number | null = null;
  if (addDel) {
    const m = /\+(\d+)\s*\/\s*-(\d+)/.exec(addDel);
    if (m) {
      additions = Number(m[1]);
      deletions = Number(m[2]);
    }
  }
  const desc = /\n## Description\n([\s\S]*?)(?=\n## |\s*$)/.exec(body);
  return {
    author,
    authorIsBot,
    createdAt: mdCell(body, 'Created at'),
    baseRef: mdCell(body, 'Base branch')?.replace(/`/g, '') ?? null,
    changedFiles: mdInt(body, 'Changed files'),
    additions,
    deletions,
    totalThreads: mdInt(body, 'Total threads'),
    unresolvedThreads: mdInt(body, 'Unresolved threads'),
    descriptionChars: desc ? desc[1]!.trim().length : null,
  };
}

const EMPTY_META: ArchiveMeta = {
  author: null, authorIsBot: false, createdAt: null, baseRef: null,
  changedFiles: null, additions: null, deletions: null,
  totalThreads: null, unresolvedThreads: null, descriptionChars: null,
};

export interface BuildOptions {
  readonly repoRoot: string;
  /** Rows already extracted, keyed by PR — reused instead of re-reading archives. */
  readonly existing?: ReadonlyMap<number, FeatureRow>;
  /** Skip archive parsing entirely (title/branch/diff features only). */
  readonly skipArchives?: boolean;
}

export interface BuildResult {
  readonly rows: FeatureRow[];
  readonly stats: {
    readonly manifestRows: number;
    readonly merged: number;
    readonly withDiff: number;
    readonly reusedFromCache: number;
    readonly archivesRead: number;
  };
}

export function buildFeatures(opts: BuildOptions): BuildResult {
  const { repoRoot } = opts;
  const manifestPath = path.join(repoRoot, 'docs/github/prs/manifest.jsonl');
  const manifest = fs
    .readFileSync(manifestPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as ManifestRow);

  const pr2files = readGitLog(repoRoot);
  const rows: FeatureRow[] = [];
  let merged = 0;
  let reused = 0;
  let archivesRead = 0;

  for (const r of manifest) {
    if (r.state !== 'MERGED') continue;
    merged++;
    const files = pr2files.get(r.pr_number);
    if (!files || files.length === 0) continue;
    const ma = measuredArea(files);
    if (ma === null) continue;

    const cached = opts.existing?.get(r.pr_number);
    let meta: ArchiveMeta;
    if (cached) {
      meta = cached;
      reused++;
    } else if (opts.skipArchives || !r.archive_path) {
      meta = EMPTY_META;
    } else {
      const body = readFileIfPresent(path.join(repoRoot, r.archive_path));
      if (body !== null) {
        meta = parseArchive(body);
        archivesRead++;
      } else {
        meta = EMPTY_META;
      }
    }

    const da = declaredArea(r.title, r.head_ref);
    rows.push({
      ...meta,
      pr: r.pr_number,
      title: r.title,
      headRef: r.head_ref,
      mergedAt: r.merged_at,
      measured: ma.area,
      purity: ma.purity,
      areaCount: ma.areaCount,
      areaCounts: ma.counts,
      nFiles: files.length,
      declared: da.area,
      declaredSource: da.source,
    });
  }

  // Sorted by key => the file is a deterministic function of the inputs.
  rows.sort((a, b) => a.pr - b.pr);
  return {
    rows,
    stats: {
      manifestRows: manifest.length,
      merged,
      withDiff: rows.length,
      reusedFromCache: reused,
      archivesRead,
    },
  };
}

export function readFeatureFile(p: string): Map<number, FeatureRow> {
  const out = new Map<number, FeatureRow>();
  const body = readFileIfPresent(p);
  if (body === null) return out;
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as FeatureRow;
    out.set(r.pr, r); // upsert by key: a repeated pr overwrites, never duplicates
  }
  return out;
}

export function writeFeatureFile(p: string, rows: readonly FeatureRow[]): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (n: string, d: string): string => {
    const i = argv.indexOf(n);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : d;
  };
  const repoRoot = arg('--repo', process.cwd());
  const out = arg('--out', path.join(repoRoot, 'data/pr-categorization/features.jsonl'));
  const incremental = argv.includes('--incremental');
  const existing = incremental ? readFeatureFile(out) : undefined;
  const res = buildFeatures({ repoRoot, ...(existing ? { existing } : {}) });
  writeFeatureFile(out, res.rows);
  process.stdout.write(
    `pr-categorization/extract: ${JSON.stringify(res.stats)}\nwrote ${res.rows.length} rows -> ${out}\n`,
  );
}
