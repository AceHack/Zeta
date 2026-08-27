/**
 * The model comparison, and the statistics file the dashboard renders.
 *
 * THE SHAPE OF THE STUDY, and why it is shaped this way:
 *
 *  1. The label is the MEASURED area (from the diff). The features are the
 *     DECLARED side (title prose, branch, author, timing). Different sources,
 *     so predicting one from the other is a real task.
 *
 *  2. The closed-form parse is the baseline and every model is reported as a
 *     DELTA against it. A model's absolute accuracy is not a result here; the
 *     question is only ever "does it beat parsing the title".
 *
 *  3. The baseline ABSTAINS on ~26% of PRs. That split is preserved through
 *     every evaluation, because a model's value is concentrated exactly where
 *     the closed form has nothing to say, and an overall average hides it.
 *
 *  4. A LABEL-SHUFFLE NULL runs the identical pipeline on permuted labels. If
 *     it scores above chance, the pipeline leaks and every other number in the
 *     file is void. It is not a formality — it is the check that licenses the
 *     rest.
 *
 *  5. The split is TEMPORAL by default (train on older PRs, predict newer).
 *     A random split would let a model see PRs from the same hour, same branch
 *     and same burst as its test cases; for a dashboard that scores tomorrow's
 *     PRs, that would be an optimistic number for a task nobody has.
 *
 * Register: `unmetered`. The numbers are measurements of this corpus under
 * this taxonomy; they are not a claim that any of these models is good.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AREAS } from './areas.ts';
import { readFeatureFile, type FeatureRow } from './extract.ts';
import {
  buildSpace, vectorizeAll, DEFAULT_CONFIG, DECLARED_SIDE_GROUPS,
  type FeatureConfig, type FeatureGroup,
} from './features.ts';
import { trainForest, forestPredict, forestPredictProba, DEFAULT_FOREST, argmax } from './forest.ts';
import { kmeans, majorityMap, DEFAULT_KMEANS } from './kmeans.ts';
import { trainBnn, bnnPredict, DEFAULT_BNN } from './bnn.ts';
import {
  classificationReport, adjustedRandIndex, normalizedMutualInfo, wilsonInterval,
  mcnemar, type McNemarResult,
} from './metrics.ts';
import { stringCompare } from '../collation/collation.ts';
import { mulberry32, shuffle } from './rng.ts';

export interface ModelScore {
  readonly name: string;
  readonly accuracy: number;
  readonly accuracyCi95: readonly [number, number];
  readonly macroF1: number;
  /** Accuracy restricted to PRs the closed form DID label. */
  readonly accuracyWhereBaselineSpeaks: number;
  /** Accuracy restricted to PRs the closed form ABSTAINED on. */
  readonly accuracyWhereBaselineAbstains: number;
  /** Percentage points of accuracy above the baseline, on the same test set. */
  readonly deltaVsBaseline: number;
  readonly notes?: string;
}

export interface StudyResult {
  readonly generatedAtIso: string;
  readonly corpus: {
    readonly prsTotal: number;
    readonly prsScored: number;
    readonly trainN: number;
    readonly testN: number;
    readonly splitKind: string;
    readonly splitAtIso: string | null;
    readonly areas: readonly string[];
    readonly areaCounts: Readonly<Record<string, number>>;
  };
  readonly baseline: {
    readonly coverage: number;
    readonly unlabellable: number;
    readonly accuracyOnCovered: number;
    readonly accuracyOverall: number;
    readonly majorityClassAccuracy: number;
    /**
     * Accuracy of predicting the test set's OWN most common area for
     * everything. Not achievable without seeing the test labels, hence
     * "oracle" — but under a temporal split with heavy distribution shift it
     * is far above the train-majority floor, and quoting a model's margin
     * over the train floor alone would flatter it.
     */
    readonly testMajorityOracleAccuracy: number;
    readonly testMajorityArea: string;
    readonly sourceCounts: Readonly<Record<string, number>>;
  };
  readonly models: readonly ModelScore[];
  readonly nulls: readonly ModelScore[];
  /**
   * Paired comparisons on the shared test set; `modelA`/`modelB` index into
   * `models`. Deliberately NOT named `a`/`b`: `McNemarResult` already carries
   * `b` and `c` as discordant COUNTS, and spreading it into a `{a, b}` object
   * silently overwrote the model name with a number.
   */
  readonly pairwise: ReadonlyArray<{ modelA: string; modelB: string } & McNemarResult>;
  readonly clustering: {
    readonly k: number;
    readonly adjustedRandIndex: number;
    readonly normalizedMutualInfo: number;
    readonly majorityMapAccuracy: number;
    readonly nullAdjustedRandIndex: number;
    readonly inertia: number;
  };
  readonly disagreement: {
    readonly n: number;
    readonly rate: number;
    readonly topPairs: ReadonlyArray<{ declared: string; measured: string; n: number }>;
    readonly examples: ReadonlyArray<{
      readonly pr: number;
      readonly title: string;
      readonly headRef: string;
      readonly declared: string;
      readonly measured: string;
      readonly modelAgreesWithMeasured: boolean;
      readonly confidence: number;
      readonly areaCounts: Readonly<Record<string, number>>;
    }>;
  };
  readonly unlabellableTrend: ReadonlyArray<{ month: string; total: number; unlabellable: number; rate: number }>;
  readonly areaTrend: ReadonlyArray<{ month: string; counts: Readonly<Record<string, number>> }>;
  readonly config: {
    readonly featureGroups: readonly string[];
    readonly featureDim: number;
    readonly forest: typeof DEFAULT_FOREST;
    readonly bnn: typeof DEFAULT_BNN;
    readonly kmeans: typeof DEFAULT_KMEANS;
  };
}

const monthOf = (iso: string | null): string => (iso ?? '').slice(0, 7) || 'unknown';

export interface StudyOptions {
  readonly rows: readonly FeatureRow[];
  readonly featureConfig?: FeatureConfig;
  readonly testFraction?: number;
  readonly splitKind?: 'temporal' | 'random';
  readonly seed?: number;
  readonly maxExamples?: number;
  /** Fixed timestamp; supplied by the caller so a test can pin it. */
  readonly nowIso?: string;
}

export function runStudy(opts: StudyOptions): StudyResult {
  const rows = [...opts.rows];
  if (rows.length < 50) throw new Error(`runStudy: need >= 50 rows, got ${rows.length}`);
  const cfg = opts.featureConfig ?? DEFAULT_CONFIG;
  const testFraction = opts.testFraction ?? 0.25;
  const splitKind = opts.splitKind ?? 'temporal';
  const seed = opts.seed ?? 20260827;

  const labels = AREAS as readonly string[];
  const labelIndex = new Map(labels.map((l, i) => [l, i]));

  // --- split -------------------------------------------------------------
  let train: FeatureRow[];
  let test: FeatureRow[];
  let splitAtIso: string | null = null;
  if (splitKind === 'temporal') {
    // `stringCompare` (code point = UTF-8 byte order), NOT `localeCompare`.
    // Linguistic ordering is ICU- and locale-dependent, so two machines can
    // order the same timestamps differently — which would silently give them
    // DIFFERENT train/test splits and therefore different accuracies from the
    // same corpus. See .claude/rules/culture-invariant-by-default.md.
    const sorted = [...rows].sort((a, b) => stringCompare(a.mergedAt ?? '', b.mergedAt ?? ''));
    const cut = Math.floor(sorted.length * (1 - testFraction));
    train = sorted.slice(0, cut);
    test = sorted.slice(cut);
    splitAtIso = test.length > 0 ? test[0]!.mergedAt : null;
  } else {
    const shuffled = shuffle([...rows], mulberry32(seed));
    const cut = Math.floor(shuffled.length * (1 - testFraction));
    train = shuffled.slice(0, cut);
    test = shuffled.slice(cut);
  }

  const space = buildSpace(cfg);
  const Xtrain = vectorizeAll(train, space);
  const Xtest = vectorizeAll(test, space);
  const yTrain = train.map((r) => labelIndex.get(r.measured)!);
  const yTest = test.map((r) => labelIndex.get(r.measured)!);
  const yTestNames = test.map((r) => r.measured as string);

  const speaks = test.map((r) => r.declared !== null);

  const scoreSubset = (pred: readonly string[], want: boolean): number => {
    let hit = 0;
    let n = 0;
    for (let i = 0; i < pred.length; i++) {
      if (speaks[i] !== want) continue;
      n++;
      if (pred[i] === yTestNames[i]) hit++;
    }
    return n === 0 ? 0 : hit / n;
  };

  // --- baseline ----------------------------------------------------------
  // On abstention the closed form is scored as WRONG rather than skipped.
  // Scoring only where it speaks would compare a selective predictor against
  // non-selective ones on different subsets, which is not a comparison.
  const baselinePred = test.map((r) => (r.declared ?? '<abstain>') as string);
  const baselineRep = classificationReport(yTestNames, baselinePred, labels);
  const baselineAcc = baselineRep.accuracy;

  const areaCountsAll: Record<string, number> = {};
  for (const r of rows) areaCountsAll[r.measured] = (areaCountsAll[r.measured] ?? 0) + 1;
  const majorityAcc = (() => {
    const counts: Record<string, number> = {};
    for (const r of train) counts[r.measured] = (counts[r.measured] ?? 0) + 1;
    let top = labels[0]!;
    for (const l of labels) if ((counts[l] ?? 0) > (counts[top] ?? 0)) top = l;
    return yTestNames.filter((t) => t === top).length / yTestNames.length;
  })();

  const mk = (name: string, pred: readonly string[], notes?: string): ModelScore => {
    const rep = classificationReport(yTestNames, pred, labels);
    const hits = Math.round(rep.accuracy * rep.n);
    return {
      name,
      accuracy: rep.accuracy,
      accuracyCi95: wilsonInterval(hits, rep.n),
      macroF1: rep.macroF1,
      accuracyWhereBaselineSpeaks: scoreSubset(pred, true),
      accuracyWhereBaselineAbstains: scoreSubset(pred, false),
      deltaVsBaseline: (rep.accuracy - baselineAcc) * 100,
      ...(notes ? { notes } : {}),
    };
  };

  // --- models ------------------------------------------------------------
  const forest = trainForest(Xtrain, yTrain, labels.length, DEFAULT_FOREST);
  const forestPredIdx = forestPredict(forest, Xtest);
  const forestPred = forestPredIdx.map((i) => labels[i]!);

  const bnn = trainBnn(Xtrain, yTrain, labels.length, DEFAULT_BNN);
  const bnnPredIdx = bnnPredict(bnn, Xtest);
  const bnnPred = bnnPredIdx.map((i) => labels[i]!);

  // Hybrid: trust the closed form where it speaks, ask the forest where it
  // abstains. This is the shape an operator would actually deploy, and it is
  // included so the study reports the best available option, not just the
  // most interesting one.
  const hybridPred = test.map((r, i) => (r.declared !== null ? (r.declared as string) : forestPred[i]!));

  const models: ModelScore[] = [
    mk('closed-form baseline', baselinePred, 'title scope -> paren scope -> branch prefix; abstains on 1 PR in 4'),
    mk('majority class', yTestNames.map(() => {
      const counts: Record<string, number> = {};
      for (const r of train) counts[r.measured] = (counts[r.measured] ?? 0) + 1;
      let top = labels[0]!;
      for (const l of labels) if ((counts[l] ?? 0) > (counts[top] ?? 0)) top = l;
      return top;
    }), 'floor: predicts the most common area for everything'),
    mk('random forest', forestPred, `${DEFAULT_FOREST.nTrees} trees, gini, quantile-binned splits`),
    mk('BNN (ADF probit, one-vs-rest)', bnnPred, 'diagonal Gaussian weight posterior; single ADF pass'),
    mk('hybrid: baseline where it speaks, forest elsewhere', hybridPred, 'the deployable option'),
  ];

  // --- label-shuffle null ------------------------------------------------
  // Same features, same hyperparameters, same split; only the TRAINING labels
  // are permuted. Anything meaningfully above the majority-class floor here is
  // a leak, not a result.
  const nullRng = mulberry32(seed + 999983);
  const yTrainShuffled = shuffle([...yTrain], nullRng);
  const nullForest = trainForest(Xtrain, yTrainShuffled, labels.length, DEFAULT_FOREST);
  const nullForestPred = forestPredict(nullForest, Xtest).map((i) => labels[i]!);
  const nullBnn = trainBnn(Xtrain, yTrainShuffled, labels.length, DEFAULT_BNN);
  const nullBnnPred = bnnPredict(nullBnn, Xtest).map((i) => labels[i]!);
  const nulls: ModelScore[] = [
    mk('NULL random forest (labels shuffled)', nullForestPred, 'must not beat the majority-class floor'),
    mk('NULL BNN (labels shuffled)', nullBnnPred, 'must not beat the majority-class floor'),
  ];

  // --- paired comparisons ------------------------------------------------
  const named: Record<string, readonly string[]> = {
    'closed-form baseline': baselinePred,
    'random forest': forestPred,
    'BNN (ADF probit, one-vs-rest)': bnnPred,
    'hybrid: baseline where it speaks, forest elsewhere': hybridPred,
  };
  const pairs: Array<[string, string]> = [
    ['random forest', 'closed-form baseline'],
    ['BNN (ADF probit, one-vs-rest)', 'closed-form baseline'],
    ['BNN (ADF probit, one-vs-rest)', 'random forest'],
    ['hybrid: baseline where it speaks, forest elsewhere', 'random forest'],
  ];
  const pairwise = pairs.map(([a, b]) => ({
    modelA: a,
    modelB: b,
    ...mcnemar(yTestNames, named[a]!, named[b]!),
  }));

  // --- clustering --------------------------------------------------------
  const km = kmeans(Xtest, { ...DEFAULT_KMEANS, k: Math.min(DEFAULT_KMEANS.k, Xtest.length) });
  const mm = majorityMap(km.assignments, yTest, km.options.k, labels.length);
  const shuffledTruth = shuffle([...yTestNames], mulberry32(seed + 31337));
  const clustering = {
    k: km.options.k,
    adjustedRandIndex: adjustedRandIndex(km.assignments, yTestNames),
    normalizedMutualInfo: normalizedMutualInfo(km.assignments, yTestNames),
    majorityMapAccuracy: mm.accuracy,
    // Same partition against permuted labels: ARI's own null, so a reader can
    // see the chance level rather than take "~0" on trust.
    nullAdjustedRandIndex: adjustedRandIndex(km.assignments, shuffledTruth),
    inertia: km.inertia,
  };

  // --- disagreement set: the product ------------------------------------
  // Ranked by the forest's confidence in a measured area that contradicts the
  // declared one, so the top of the list is where the evidence is strongest.
  const disagreements = test
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.declared !== null && r.declared !== r.measured)
    .map(({ r, i }) => {
      const proba = forestPredictProba(forest, Xtest[i]!);
      const top = argmax(proba);
      return {
        pr: r.pr,
        title: r.title,
        headRef: r.headRef,
        declared: r.declared as string,
        measured: r.measured as string,
        modelAgreesWithMeasured: labels[top] === r.measured,
        confidence: proba[labelIndex.get(r.measured)!]!,
        areaCounts: r.areaCounts,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const pairCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.declared !== null && r.declared !== r.measured) {
      // NUL-joined, and written as the escape `\u0000` rather than a raw
      // byte — a literal NUL would make git treat this source file as binary.
      const k = `${r.declared}\u0000${r.measured}`;
      pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
    }
  }
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, n]) => {
      const [declared, measured] = k.split('\u0000');
      return { declared: declared!, measured: measured!, n };
    });
  const totalDeclared = rows.filter((r) => r.declared !== null).length;
  const totalDisagree = rows.filter((r) => r.declared !== null && r.declared !== r.measured).length;

  // --- trends ------------------------------------------------------------
  const byMonth = new Map<string, FeatureRow[]>();
  for (const r of rows) {
    const m = monthOf(r.mergedAt);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(r);
  }
  const months = [...byMonth.keys()].sort();
  const unlabellableTrend = months.map((m) => {
    const rs = byMonth.get(m)!;
    const un = rs.filter((r) => r.declared === null).length;
    return { month: m, total: rs.length, unlabellable: un, rate: un / rs.length };
  });
  const areaTrend = months.map((m) => {
    const counts: Record<string, number> = {};
    for (const r of byMonth.get(m)!) counts[r.measured] = (counts[r.measured] ?? 0) + 1;
    return { month: m, counts };
  });

  const srcCounts: Record<string, number> = {};
  for (const r of rows) srcCounts[r.declaredSource] = (srcCounts[r.declaredSource] ?? 0) + 1;

  return {
    generatedAtIso: opts.nowIso ?? new Date().toISOString(),
    corpus: {
      prsTotal: rows.length,
      prsScored: test.length,
      trainN: train.length,
      testN: test.length,
      splitKind,
      splitAtIso,
      areas: labels,
      areaCounts: areaCountsAll,
    },
    baseline: {
      coverage: totalDeclared / rows.length,
      unlabellable: (rows.length - totalDeclared) / rows.length,
      accuracyOnCovered: (totalDeclared - totalDisagree) / totalDeclared,
      accuracyOverall: (totalDeclared - totalDisagree) / rows.length,
      majorityClassAccuracy: majorityAcc,
      testMajorityOracleAccuracy: (() => {
        const c: Record<string, number> = {};
        for (const t of yTestNames) c[t] = (c[t] ?? 0) + 1;
        return Math.max(...Object.values(c)) / yTestNames.length;
      })(),
      testMajorityArea: (() => {
        const c: Record<string, number> = {};
        for (const t of yTestNames) c[t] = (c[t] ?? 0) + 1;
        return Object.entries(c).sort((x, y) => y[1] - x[1])[0]![0];
      })(),
      sourceCounts: srcCounts,
    },
    models,
    nulls,
    pairwise,
    clustering,
    disagreement: {
      n: totalDisagree,
      rate: totalDisagree / totalDeclared,
      topPairs,
      examples: disagreements.slice(0, opts.maxExamples ?? 40),
    },
    unlabellableTrend,
    areaTrend,
    config: {
      featureGroups: cfg.groups as readonly string[],
      featureDim: space.dim,
      forest: DEFAULT_FOREST,
      bnn: DEFAULT_BNN,
      kmeans: DEFAULT_KMEANS,
    },
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (n: string, d: string): string => {
    const i = argv.indexOf(n);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1]! : d;
  };
  const repoRoot = arg('--repo', process.cwd());
  const featPath = arg('--features', path.join(repoRoot, 'data/pr-categorization/features.jsonl'));
  const outPath = arg('--out', path.join(repoRoot, 'data/pr-categorization/statistics.json'));
  const split = arg('--split', 'temporal') as 'temporal' | 'random';
  const groups = arg('--groups', DECLARED_SIDE_GROUPS.join(',')).split(',') as FeatureGroup[];

  const rows = [...readFeatureFile(featPath).values()].sort((a, b) => a.pr - b.pr);
  if (rows.length === 0) {
    process.stderr.write(`no feature rows at ${featPath} — run extract.ts first\n`);
    process.exit(2);
  }
  const res = runStudy({ rows, splitKind: split, featureConfig: { ...DEFAULT_CONFIG, groups } });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2) + '\n');
  process.stdout.write(
    `pr-categorization/study: n=${res.corpus.prsTotal} test=${res.corpus.testN} split=${split}\n` +
      res.models.map((m) => `  ${m.name.padEnd(46)} acc=${(m.accuracy * 100).toFixed(1)}%  d=${m.deltaVsBaseline >= 0 ? '+' : ''}${m.deltaVsBaseline.toFixed(1)}pp  abstain-zone=${(m.accuracyWhereBaselineAbstains * 100).toFixed(1)}%`).join('\n') +
      '\n' +
      res.nulls.map((m) => `  ${m.name.padEnd(46)} acc=${(m.accuracy * 100).toFixed(1)}%`).join('\n') +
      `\n  oracle floor (always "${res.baseline.testMajorityArea}") = ${(res.baseline.testMajorityOracleAccuracy * 100).toFixed(1)}%\n` +
      res.pairwise
        .map(
          (p) =>
            `  McNemar ${p.modelA.slice(0, 24).padEnd(25)} vs ${p.modelB.slice(0, 22).padEnd(23)}` +
            ` b=${String(p.b).padStart(4)} c=${String(p.c).padStart(4)} p=${p.pValue.toExponential(2)} favours=${p.favours}`,
        )
        .join('\n') +
      `\n  kmeans ARI=${res.clustering.adjustedRandIndex.toFixed(3)} (null ${res.clustering.nullAdjustedRandIndex.toFixed(3)}) NMI=${res.clustering.normalizedMutualInfo.toFixed(3)}\n` +
      `wrote ${outPath}\n`,
  );
}
