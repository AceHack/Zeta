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

  // A null model that beats the floor is a FAILING exit, not a warning printed under a green
  // check. What it MEANS, though, depends on how many nulls beat it — and the earlier version of
  // this guard collapsed that distinction, which made its own error message false.
  //
  // MEASURED 2026-08-27, the run that motivated this: NULL random forest 5.3%, NULL BNN 22.9%,
  // floor 3.9%. The guard took `max` over the nulls, saw 22.9%, and reported "the feature
  // pipeline is leaking the label and every reported number is void".
  //
  // Both nulls are trained on the SAME `Xtrain`/`Xtest` and the SAME shuffled labels. A feature
  // that carried the label would be visible to both. The forest sat at the floor. So the features
  // were exonerated by the guard's own output, and the message accused them anyway — while
  // voiding the forest's 74.5%, which no evidence implicated.
  //
  // The distinction this now draws:
  //
  //   EVERY null leaks  -> the FEATURES carry the label. Shared cause, and every number is void.
  //   SOME nulls leak   -> that MODEL's inductive bias, not the pipeline. The clean null is
  //                        positive evidence for the features; the affected model's numbers are
  //                        void and the others are not.
  //
  // Both still exit non-zero: an unexplained null above the floor blocks publication either way.
  // What changes is that the message names what the evidence supports, and a reader is not sent
  // to audit a feature pipeline that a clean null has already cleared.
  const FLOOR = study.baseline.majorityClassAccuracy;
  const MARGIN = 0.05;
  const leaked = study.nulls.filter((n) => n.accuracy > FLOOR + MARGIN);
  if (leaked.length > 0) {
    const all = leaked.length === study.nulls.length;
    const names = leaked.map((n) => `${n.name} ${(n.accuracy * 100).toFixed(1)}%`).join(', ');
    const clean = study.nulls
      .filter((n) => n.accuracy <= FLOOR + MARGIN)
      .map((n) => `${n.name} ${(n.accuracy * 100).toFixed(1)}%`)
      .join(', ');
    lines.push(
      all
        ? `::error title=PR-categorization: EVERY label-shuffle null beat the floor::` +
            `${names} vs majority-class floor ${(FLOOR * 100).toFixed(1)}% (+${(MARGIN * 100).toFixed(0)}pp allowed) — ` +
            `every null sees the same features and every one of them leaked, so the FEATURE PIPELINE ` +
            `is carrying the label and every reported number is void`
        : `::error title=PR-categorization: one label-shuffle null beat the floor::` +
            `${names} vs majority-class floor ${(FLOOR * 100).toFixed(1)}% (+${(MARGIN * 100).toFixed(0)}pp allowed), ` +
            `while ${clean} stayed at the floor on the SAME features and the SAME shuffled labels. ` +
            `That exonerates the feature pipeline and implicates the affected model: its numbers are ` +
            `void, the others are not. Under the temporal split the test-majority oracle is ` +
            `${(study.baseline.testMajorityOracleAccuracy * 100).toFixed(1)}% ` +
            `(area '${study.baseline.testMajorityArea}'), so a model whose shuffled-label predictions ` +
            `collapse onto one frequent class will score near that without any leak`,
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
