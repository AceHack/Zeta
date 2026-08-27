/**
 * The one entry point the scheduled lane runs.
 *
 *     bun src/Core.TypeScript/pr-categorization/cli.ts --write
 *
 * extract -> study -> render, and it writes exactly three artifacts:
 *
 *   data/pr-categorization/statistics.json   the statistics file
 *   data/pr-categorization/index.html        the dashboard
 *   docs/PR-AREA-STATISTICS.md               the digest
 *
 * ALL THREE MUST BE FLUSHED TOGETHER. A past incident on the drift-dashboard
 * lane left two of its four artifacts silently unflushed, so the page rendered
 * numbers its own JSON no longer contained. The `ARTIFACTS` array below is
 * exported for exactly that reason: the workflow's `--paths` list is checked
 * against it by `pr-categorization.test.ts` rather than maintained by hand.
 *
 * The 6.7MB intermediate feature matrix is deliberately NOT an artifact. It is
 * a pure function of the manifest and the git history, so committing it would
 * add megabytes of churn per tick to reproduce something any checkout can
 * regenerate. `--features-cache` exists only to make local iteration fast.
 *
 * Register: `unmetered`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildFeatures, readFeatureFile, writeFeatureFile } from './extract.ts';
import { renderHtml, renderMarkdown } from './render.ts';
import { runStudy } from './study.ts';

/** Repo-relative paths this CLI writes. The flush list must equal this set. */
export const ARTIFACTS = [
  'data/pr-categorization/statistics.json',
  'data/pr-categorization/index.html',
  'docs/PR-AREA-STATISTICS.md',
] as const;

export interface CliOptions {
  readonly repoRoot: string;
  readonly write: boolean;
  readonly split: 'temporal' | 'random';
  readonly featuresCache: string | null;
  readonly nowIso?: string;
}

export function parseArgv(argv: readonly string[]): CliOptions | { error: string } {
  const a = [...argv];
  const val = (n: string): string | null => {
    const i = a.indexOf(n);
    return i >= 0 && i + 1 < a.length ? a[i + 1]! : null;
  };
  const split = (val('--split') ?? 'temporal') as 'temporal' | 'random';
  if (split !== 'temporal' && split !== 'random') {
    return { error: `--split must be 'temporal' or 'random', got '${split}'` };
  }
  return {
    repoRoot: val('--repo') ?? process.cwd(),
    write: a.includes('--write'),
    split,
    featuresCache: val('--features-cache'),
    ...(val('--now') ? { nowIso: val('--now')! } : {}),
  };
}

export function run(opts: CliOptions): { status: number; report: string } {
  const t0 = Date.now();
  const cache = opts.featuresCache ? readFeatureFile(opts.featuresCache) : undefined;
  const built = buildFeatures({ repoRoot: opts.repoRoot, ...(cache ? { existing: cache } : {}) });
  if (built.rows.length < 50) {
    return {
      status: 3,
      report:
        `only ${built.rows.length} scorable PRs found — expected thousands.\n` +
        'This usually means a shallow clone: the PR->files join needs full history ' +
        '(actions/checkout with fetch-depth: 0).\n',
    };
  }
  if (opts.featuresCache) writeFeatureFile(opts.featuresCache, built.rows);

  const study = runStudy({
    rows: built.rows,
    splitKind: opts.split,
    ...(opts.nowIso ? { nowIso: opts.nowIso } : {}),
  });

  const outputs: Array<[string, string]> = [
    [ARTIFACTS[0], JSON.stringify(study, null, 2) + '\n'],
    [ARTIFACTS[1], renderHtml(study)],
    [ARTIFACTS[2], renderMarkdown(study)],
  ];

  if (opts.write) {
    for (const [rel, body] of outputs) {
      const abs = path.join(opts.repoRoot, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    }
  }

  const base = study.models.find((m) => m.name.startsWith('closed-form'))!;
  const lines = [
    `pr-categorization: ${built.rows.length} scorable PRs of ${built.stats.merged} merged ` +
      `(${built.stats.archivesRead} archives read, ${built.stats.reusedFromCache} cached)`,
    `split=${opts.split} train=${study.corpus.trainN} test=${study.corpus.testN}`,
    ...study.models.map(
      (m) =>
        `  ${m.name.padEnd(46)} acc=${(m.accuracy * 100).toFixed(1)}%` +
        `  ${m.name === base.name ? '   —  ' : `${m.deltaVsBaseline >= 0 ? '+' : ''}${m.deltaVsBaseline.toFixed(1)}pp`}` +
        `  abstain-zone=${(m.accuracyWhereBaselineAbstains * 100).toFixed(1)}%`,
    ),
    ...study.nulls.map((m) => `  ${m.name.padEnd(46)} acc=${(m.accuracy * 100).toFixed(1)}%`),
    `  null floor (majority class) = ${(study.baseline.majorityClassAccuracy * 100).toFixed(1)}%`,
    ...study.pairwise.map(
      (p) =>
        `  McNemar ${p.modelA.slice(0, 24).padEnd(25)} vs ${p.modelB.slice(0, 22).padEnd(23)}` +
        ` b=${String(p.b).padStart(4)} c=${String(p.c).padStart(4)} p=${p.pValue.toExponential(2)} favours=${p.favours}`,
    ),
    `  kmeans ARI=${study.clustering.adjustedRandIndex.toFixed(3)} (null ${study.clustering.nullAdjustedRandIndex.toFixed(3)})`,
    `  disagreements: ${study.disagreement.n} (${(study.disagreement.rate * 100).toFixed(1)}% of parseable)`,
    opts.write ? `wrote ${outputs.length} artifacts in ${((Date.now() - t0) / 1000).toFixed(1)}s` : '(dry run — pass --write to emit)',
  ];

  // A leaking pipeline invalidates everything else, so it is a FAILING exit,
  // not a warning printed under a green check.
  const nullMax = Math.max(...study.nulls.map((n) => n.accuracy));
  if (nullMax > study.baseline.majorityClassAccuracy + 0.05) {
    lines.push(
      `::error title=PR-categorization label-shuffle null leaked::` +
        `null accuracy ${(nullMax * 100).toFixed(1)}% exceeds the majority-class floor ` +
        `${(study.baseline.majorityClassAccuracy * 100).toFixed(1)}% by more than 5pp — ` +
        `the feature pipeline is leaking the label and every reported number is void`,
    );
    return { status: 4, report: lines.join('\n') + '\n' };
  }
  return { status: 0, report: lines.join('\n') + '\n' };
}

if (import.meta.main) {
  const parsed = parseArgv(process.argv.slice(2));
  if ('error' in parsed) {
    process.stderr.write(`pr-categorization: ${parsed.error}\n`);
    process.exit(2);
  }
  const { status, report } = run(parsed);
  process.stdout.write(report);
  process.exit(status);
}
