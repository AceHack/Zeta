/**
 * Feature map: a PR row -> a fixed-length numeric vector.
 *
 * THE LEAKAGE BOUNDARY IS THE POINT OF THIS FILE.
 *
 * The label (`measured`) is derived from the PR's changed FILE PATHS. So any
 * feature also derived from the diff is a channel from the label back into the
 * input, and a model fed one is partly reading its own answer. Features are
 * therefore split into explicit groups and the default study uses only the
 * declared-side ones:
 *
 *   - `title`   — hashed word + char n-grams of the PR title       (declared side)
 *   - `branch`  — hashed tokens + prefix one-hots of head_ref       (declared side)
 *   - `meta`    — author/bot, base branch, hour, weekday            (declared side)
 *   - `size`    — nFiles, additions, deletions                      (DIFF-DERIVED)
 *
 * `size` is off by default and reported only as a labelled ablation. It is not
 * dishonest to use it — file count is known at PR time and is not the label —
 * but it shares a source with the label, so it must never be folded silently
 * into a headline number.
 *
 * Register: `unmetered`.
 */

import type { FeatureRow } from './extract.ts';

export type FeatureGroup = 'title' | 'branch' | 'meta' | 'size';

export const DECLARED_SIDE_GROUPS: readonly FeatureGroup[] = ['title', 'branch', 'meta'];

export interface FeatureConfig {
  readonly groups: readonly FeatureGroup[];
  /** Hashing-trick width for title tokens. */
  readonly titleDim: number;
  /** Hashing-trick width for branch tokens. */
  readonly branchDim: number;
}

export const DEFAULT_CONFIG: FeatureConfig = {
  groups: DECLARED_SIDE_GROUPS,
  titleDim: 256,
  branchDim: 64,
};

/**
 * FNV-1a, 32-bit. Chosen because it is a handful of lines, has no dependency,
 * and — the property that actually matters here — is byte-identical across
 * runs and machines, so the feature matrix is DST-replayable.
 */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Lowercase, split on non-alphanumerics, drop empties. */
export function tokenize(s: string): string[] {
  return (s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * The conventional-commit prefix is stripped before title tokens are hashed.
 *
 * Without this the model would be handed the baseline's own answer as a
 * feature and "beating the baseline" would be uninterpretable. Removing it
 * makes the comparison honest: the model must find area signal in the PROSE,
 * which is information the closed form provably cannot use.
 */
export function stripScopePrefix(title: string): string {
  return (title ?? '').replace(/^\s*(?:\[[^\]]*\]\s*)*[a-zA-Z0-9_.\-]+(?:\([^)]*\))?\s*!?:\s*/, '');
}

export interface FeatureSpace {
  readonly dim: number;
  readonly names: readonly string[];
  readonly config: FeatureConfig;
}

const BRANCH_PREFIXES = [
  'dependabot', 'heartbeat', 'shadow', 'claim', 'fix', 'feat', 'docs', 'research',
  'metrics', 'drift', 'archive', 'memory', 'backlog', 'society', 'hygiene', 'round',
  'chore', 'tick', 'book', 'observe', 'shard', 'workitem',
] as const;

export function buildSpace(config: FeatureConfig = DEFAULT_CONFIG): FeatureSpace {
  const names: string[] = [];
  const g = new Set(config.groups);
  if (g.has('title')) for (let i = 0; i < config.titleDim; i++) names.push(`title_h${i}`);
  if (g.has('branch')) {
    for (let i = 0; i < config.branchDim; i++) names.push(`branch_h${i}`);
    for (const p of BRANCH_PREFIXES) names.push(`branch_is_${p}`);
    names.push('branch_depth', 'branch_len');
  }
  if (g.has('meta')) {
    names.push(
      'author_is_bot', 'base_is_main', 'hour_sin', 'hour_cos',
      'dow_sin', 'dow_cos', 'title_len', 'title_ntokens',
      'desc_chars_log', 'threads_log', 'unresolved_log',
    );
  }
  if (g.has('size')) names.push('n_files_log', 'additions_log', 'deletions_log');
  return { dim: names.length, names, config };
}

const log1p = (x: number | null | undefined): number => Math.log1p(Math.max(0, x ?? 0));

/** Row -> dense vector over `space`. Deterministic; no clock, no randomness. */
export function vectorize(row: FeatureRow, space: FeatureSpace): Float64Array {
  const cfg = space.config;
  const g = new Set(cfg.groups);
  const v = new Float64Array(space.dim);
  let off = 0;

  if (g.has('title')) {
    const prose = stripScopePrefix(row.title);
    const toks = tokenize(prose);
    for (const t of toks) v[off + (fnv1a(t) % cfg.titleDim)]! += 1;
    // Char 4-grams recover signal from tokens seen too rarely to help alone.
    const flat = prose.toLowerCase();
    for (let i = 0; i + 4 <= flat.length; i++) {
      v[off + (fnv1a(flat.slice(i, i + 4)) % cfg.titleDim)]! += 0.5;
    }
    // L2-normalise the block so long titles do not dominate purely by length.
    let n = 0;
    for (let i = 0; i < cfg.titleDim; i++) n += v[off + i]! * v[off + i]!;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < cfg.titleDim; i++) v[off + i]! /= n;
    off += cfg.titleDim;
  }

  if (g.has('branch')) {
    const br = (row.headRef ?? '').toLowerCase();
    for (const t of tokenize(br)) v[off + (fnv1a(t) % cfg.branchDim)]! += 1;
    let n = 0;
    for (let i = 0; i < cfg.branchDim; i++) n += v[off + i]! * v[off + i]!;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < cfg.branchDim; i++) v[off + i]! /= n;
    off += cfg.branchDim;
    for (const p of BRANCH_PREFIXES) v[off++] = br.startsWith(p + '/') || br === p ? 1 : 0;
    v[off++] = (br.match(/\//g) ?? []).length;
    v[off++] = Math.min(br.length, 120) / 120;
  }

  if (g.has('meta')) {
    v[off++] = row.authorIsBot ? 1 : 0;
    v[off++] = row.baseRef === 'main' ? 1 : 0;
    const d = row.mergedAt ? new Date(row.mergedAt) : null;
    const hr = d && !Number.isNaN(d.getTime()) ? d.getUTCHours() : 0;
    const dw = d && !Number.isNaN(d.getTime()) ? d.getUTCDay() : 0;
    v[off++] = Math.sin((2 * Math.PI * hr) / 24);
    v[off++] = Math.cos((2 * Math.PI * hr) / 24);
    v[off++] = Math.sin((2 * Math.PI * dw) / 7);
    v[off++] = Math.cos((2 * Math.PI * dw) / 7);
    v[off++] = Math.min((row.title ?? '').length, 200) / 200;
    v[off++] = Math.min(tokenize(row.title).length, 40) / 40;
    v[off++] = log1p(row.descriptionChars) / 10;
    v[off++] = log1p(row.totalThreads);
    v[off++] = log1p(row.unresolvedThreads);
  }

  if (g.has('size')) {
    v[off++] = log1p(row.nFiles) / 10;
    v[off++] = log1p(row.additions) / 15;
    v[off++] = log1p(row.deletions) / 15;
  }

  return v;
}

export function vectorizeAll(
  rows: readonly FeatureRow[],
  space: FeatureSpace,
): Float64Array[] {
  return rows.map((r) => vectorize(r, space));
}
