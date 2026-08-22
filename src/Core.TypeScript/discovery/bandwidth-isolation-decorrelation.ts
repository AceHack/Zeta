/**
 * bandwidth-isolation-decorrelation.ts — does bandwidth isolation actually decorrelate two flows?
 *
 * ## The claim under test (Aaron, 2026-08-14)
 *
 * > "bandwidth isolation leads to true decorrelation over time."
 *
 * Stated so it can fail: two flows that are **independent by construction** (disjoint entropy
 * streams, no shared state in their own control laws) nevertheless show a **nonzero correlation
 * between their delivered-throughput time series** when they share one bottleneck queue — because
 * one flow's backlog is the other flow's delay and the other flow's drop. Give each flow its own
 * capacity and its own queue and that correlation should return to the independence baseline.
 *
 * This module measures it on `udp-bdp-link.ts` — the D/D/1/B bandwidth-delay-product link that
 * already exists — and reports a number rather than an intuition.
 *
 * ## Why this experiment is controlled, and where it could still lie
 *
 * The three arms differ in ONE structural fact and nothing else:
 *
 *   - `shared`         — one link of capacity C, buffer B, both flows on it.
 *   - `isolated-split` — TWO links of capacity C/2, buffer B/2, one flow each. Capacity is
 *                        CONSERVED: this is the bulkhead, paid for at the usual price.
 *   - `isolated-full`  — TWO links of capacity C, buffer B, one flow each. Capacity is NOT
 *                        conserved. This arm exists to separate "isolation" from "more headroom":
 *                        if `isolated-split` decorrelates, over-provisioning was not the cause.
 *
 * The per-flow entropy is **identical across arms by construction**, and that is the load-bearing
 * detail. `udp-bdp-link` indexes its jitter / send-phase / corrupt-delivery draws by
 * `flow * 1000003 + seq`, so flow 1 draws the same numbers whether it is sharing a link or alone
 * on one. An isolated arm is therefore not a different experiment — it is the SAME experiment with
 * the coupling removed. That is what makes it usable as the null (below).
 *
 * The isolated arms are produced by running a two-flow config with one flow's start time pushed
 * past `durationMs`, which `runLink` honours by never scheduling its first `send`. The silenced
 * flow costs nothing and, crucially, does not shift any other flow's draw indices.
 *
 * ## The null, and why the textbook one would have been wrong here
 *
 * The i.i.d. null for a Pearson r over n samples is sigma ~ 1/sqrt(n-1). **It does not apply to
 * this data.** A queue's occupancy is autocorrelated, so the delivered-throughput series is
 * autocorrelated, and an i.i.d. null over-convicts on autocorrelated streams — the exact defect
 * `docs/research/2026-08-04-decorrelation-instrument-arc-capstone-*` had to fix with a block
 * permutation null (Kuensch 1989) after a plain permutation null convicted 42 of 160 strata.
 *
 * So this module does not use the textbook null. **The `isolated-split` arm IS the null**: same
 * generator, same seeds, same per-flow entropy, same control law, same autocorrelation structure,
 * coupling removed. `nullSigmaIid` is still reported — labelled — precisely so a reader can see
 * how far the two disagree, which is the measurement of the artifact.
 *
 * ## How this instrument fails — THREE MODES, ALL MEASURED, ALL NAMED
 *
 * Every one of these was observed on this link, not imagined. Each produces a large, stable,
 * plausible-looking r while measuring nothing about coupling — the "correlated coincidence"
 * shape: a number that varies beautifully and measures the wrong quantity.
 *
 * **F1 — the CONSERVATION IDENTITY (shared arm, saturated).** When the shared link is saturated
 * it delivers exactly `C * sampleMs / 1000` packets per bucket, so `d1[i] = TOTAL - d0[i]` as
 * arithmetic. Measured at offered 900 pkt/s/flow on a 1000 pkt/s link: every bucket summed to
 * exactly 100, and r = **-0.9996**. That is a restatement of "the link has a capacity", not a
 * measurement of coupling — and it points in the direction that would FLATTER the claim under
 * test. Guarded by `saturation`, reported on every point.
 *
 * **F2 — ONE-SAMPLE LEVERAGE (isolated arm, saturated).** Two isolated sub-links of equal
 * capacity, each saturated, deliver an identical constant trajectory. A constant series makes r
 * undefined — and would have — except that the final bucket is partial. Measured: the 190-bucket
 * series took exactly TWO distinct values, 50 (189 buckets) and 51 (one bucket), and r =
 * **+1.000 exactly**, off that single sample. Maximal correlation reported for two systems that
 * are independent by construction, from one bucket in 190. Guarded by `leverage` — the share of
 * the covariance supplied by its single largest term — which reads 1.0 here.
 *
 * **F3 — the SHARED ATTRACTOR (no channel at all).** Two ISOLATED flows running the same control
 * law, both driven to the same boundary, produce correlated trajectories with zero interaction.
 * Measured in the `aimd` arm where the controller collapses toward `MAX_GAP_MS` (the known
 * unwired-controller defect, `UBL-12`): isolated-split gap correlation **+0.71**, HIGHER than the
 * shared arm's +0.26. This one has NO guard and cannot have one, because it is not an artifact —
 * it is Reichenbach's common cause (1956) with the channel removed and the shared design left in.
 * **Correlation between two agents does not imply a channel between them.** It is the standing
 * limit on what bandwidth isolation can buy, and it is stated rather than fixed.
 *
 * And the ordinary ones:
 *
 *  4. **A constant series has no correlation with anything — UNDEFINED, not zero.** `pearson`
 *     returns `null`; `meanR` skips nulls and reports `defined/attempted` beside every mean, so a
 *     degenerate run shows up as a shrinking count and never as a decorrelation result.
 *  5. **Warm-up transient.** Buckets before both flows have started are structurally zero and
 *     correlate perfectly. `warmupBuckets` drops them; setting it to 0 manufactures correlation
 *     out of a shared start time.
 *  6. **Lag search inflates |r|.** `bestLag` maximises over `2*maxLag+1` candidates, so its
 *     magnitude is biased upward under any null. Lag 0 is the primary statistic; the lagged one is
 *     only interpretable against the same search run on the null arm. Both arms get it.
 *  7. **Pearson sees linear coupling only.** Two flows coupled through a threshold (a buffer IS a
 *     threshold) can share information at r ~ 0. A near-zero r here is "no LINEAR coupling
 *     detected at this sample size", never "independent". Mutual information is the finer lens
 *     (the same upgrade `DecorrelationExcess` needed after Jaccard) and is not built here.
 *  8. **One model.** D/D/1/B drop-tail, FIFO, single bottleneck. A fair queue, an AQM, or a
 *     multi-hop path would each give different numbers. This measures the coupling of THIS link.
 *
 * ## Discipline conformance
 *
 * - **Sec.7 DST** — pure functions of `(config, seed)`. No clock, no `Math.random`; all entropy
 *   enters through `udp-bdp-link`'s already-declared `drawUnit` doors.
 * - **Sec.13 noninterference** — no new entropy stream is opened. Every draw is one `runLink`
 *   already makes.
 * - **local-time-never-enters-the-shared-fold** — simulated time only; the arms are compared on
 *   bucket INDEX, never on any wall clock.
 * - **no binary in the proof lineage** — `formatIsolationReport` renders fixed-width text.
 * - **Sec.1 scale-free** — one seed and a K-seed sweep run the same code path.
 *
 * ## Anchors (Beacon)
 *
 * - K. Pearson, "Notes on regression and inheritance in the case of two parents", Proc. R. Soc.
 *   London 58, 1895 — CITED, not page-checked. The correlation coefficient itself.
 * - H. Kuensch, "The jackknife and the bootstrap for general stationary observations", Annals of
 *   Statistics 17(3), 1989 — CITED, not page-checked. Why an i.i.d. null is wrong on an
 *   autocorrelated series; the reason this module uses an arm as its null instead.
 * - S. Floyd and V. Jacobson, "On Traffic Phase Effects in Packet-Switched Gateways",
 *   Internetworking 1(1), 1992 — CITED, not page-checked. Deterministic pacing into a drop-tail
 *   queue phase-locks; `sendPhaseJitterMs` is the knob that breaks it, and a correlation measured
 *   at 0 phase noise is a phase artifact, not a coupling measurement. Both are run.
 * - R. Jain, D.-M. Chiu, W. Hawe, DEC-TR-301, 1984 — CITED, not page-checked. The fairness index
 *   reported beside r, because "equal shares" and "uncorrelated" are different properties and a
 *   bulkhead buys one of them outright.
 * - L. Kleinrock, "Queueing Systems Vol. 1", 1975 — CITED, not page-checked. The D/D/1/B queue.
 */

import { defaultLink, defaultSim, runLink, type SimConfig, type SimResult } from "./udp-bdp-link";

// -- Correlation ---------------------------------------------------------------------------

/**
 * Pearson r, or `null` when either series is constant.
 *
 * The `null` is the point. A constant series has zero variance, so the correlation is 0/0 —
 * undefined. Returning 0 would report "no coupling" for a run that measured nothing, which is
 * exactly the class of blind instrument this repo has now found eleven of.
 */
export function pearson(x: readonly number[], y: readonly number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]!;
    sy += y[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return null; // constant series — undefined, not zero
  return sxy / Math.sqrt(sxx * syy);
}

/** Shift `y` by `lag` against `x` and correlate the overlap. Positive lag = y lags x. */
function pearsonAtLag(x: readonly number[], y: readonly number[], lag: number): number | null {
  const n = Math.min(x.length, y.length);
  const lo = Math.max(0, -lag);
  const hi = Math.min(n, n - lag);
  if (hi - lo < 2) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = lo; i < hi; i++) {
    xs.push(x[i]!);
    ys.push(y[i + lag]!);
  }
  return pearson(xs, ys);
}

/**
 * The share of |covariance| supplied by its single largest term — the F2 guard.
 *
 * `1.0` means one sample pair produced the entire correlation, which is what a near-constant
 * series does and what read `r = +1.000` off one bucket in 190. This is not a p-value and not a
 * threshold: it is the leverage itself, reported so the caller can see a one-sample result
 * instead of averaging it in. `null` when r is undefined anyway.
 */
export function covarianceLeverage(x: readonly number[], y: readonly number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]!;
    sy += y[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let total = 0;
  let largest = 0;
  for (let i = 0; i < n; i++) {
    const t = Math.abs((x[i]! - mx) * (y[i]! - my));
    total += t;
    if (t > largest) largest = t;
  }
  return total <= 0 ? null : largest / total;
}

/** Why a correlation reading is or is not usable. `ok` is the only one a mean should absorb. */
export type CorrelationVerdict = "ok" | "undefined-constant" | "one-sample-leverage";

export interface CorrelationResult {
  /** Pearson r at lag 0 — the PRIMARY statistic. `null` when undefined (see `pearson`). */
  readonly r: number | null;
  /** Number of samples the lag-0 statistic was taken over. */
  readonly n: number;
  /** Distinct values in each series. `<= 2` is the near-constant regime that produces F2. */
  readonly distinct: readonly [number, number];
  /** Share of |covariance| from its single largest term. See `covarianceLeverage`. */
  readonly leverage: number | null;
  /** `ok` only when r is defined AND no single sample dominates. Means must filter on this. */
  readonly verdict: CorrelationVerdict;
  /**
   * The i.i.d. null sigma, 1/sqrt(n-1). **LABELLED AS INAPPLICABLE** to this data (the series is
   * autocorrelated). Carried only so a reader can see how far it disagrees with the empirical
   * null the isolated arm supplies.
   */
  readonly nullSigmaIid: number;
  /** The lag in `[-maxLag, maxLag]` maximising |r|. Biased by the search — see the header. */
  readonly bestLag: number;
  /** |r| at `bestLag`, signed. Interpretable only against the same search on the null arm. */
  readonly rAtBestLag: number | null;
}

/**
 * The leverage above which a reading is refused as a one-sample artifact.
 *
 * A KNOB, and named as one. `0.5` says "one sample supplied more than half the covariance". The
 * observed F2 case reads 1.0, so it is refused by any threshold below 1; the value is set at 0.5
 * because a single sample carrying the majority of a 190-sample statistic is already not a
 * measurement. Nothing in the findings turns on 0.5 versus 0.3 or 0.8 — `leverage` is reported
 * raw on every point precisely so that is checkable.
 */
export const LEVERAGE_REFUSAL = 0.5;

export function correlate(x: readonly number[], y: readonly number[], maxLag: number): CorrelationResult {
  const n = Math.min(x.length, y.length);
  const r = pearson(x, y);
  const leverage = covarianceLeverage(x, y);
  const distinct: [number, number] = [new Set(x.slice(0, n)).size, new Set(y.slice(0, n)).size];
  let bestLag = 0;
  let best: number | null = r;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const c = pearsonAtLag(x, y, lag);
    if (c === null) continue;
    if (best === null || Math.abs(c) > Math.abs(best)) {
      best = c;
      bestLag = lag;
    }
  }
  const verdict: CorrelationVerdict =
    r === null ? "undefined-constant" : leverage !== null && leverage > LEVERAGE_REFUSAL ? "one-sample-leverage" : "ok";
  return {
    r,
    n,
    distinct,
    leverage,
    verdict,
    nullSigmaIid: n > 1 ? 1 / Math.sqrt(n - 1) : Number.POSITIVE_INFINITY,
    bestLag,
    rAtBestLag: best,
  };
}

// -- Arms ----------------------------------------------------------------------------------

export type IsolationArm = "shared" | "isolated-split" | "isolated-full";

export const ISOLATION_ARMS: readonly IsolationArm[] = ["shared", "isolated-split", "isolated-full"] as const;

export interface IsolationConfig {
  /** The two-flow scenario. `flowCount` is forced to 2; `flowStartMs` is supplied per arm. */
  readonly base: SimConfig;
  /** Buckets to drop from the head of each trajectory — the start-up transient. */
  readonly warmupBuckets: number;
  /** Lag search half-width, in buckets. Identical across arms by construction. */
  readonly maxLag: number;
}

export function defaultIsolation(overrides: Partial<IsolationConfig> = {}): IsolationConfig {
  return {
    base: defaultSim({
      // Zero corruption: the ONLY coupling in the primary experiment is the queue. A shared
      // Gilbert-Elliott chain is a second, physically real coupling (one radio medium, one burst
      // hits both) and it is measured separately by `sharedMediumPoint`, never mixed in here.
      link: defaultLink({ capacityPktPerSec: 1000, owdMs: 20, bufferPackets: 40 }),
      // Open-loop is the SHIPPED sender (`gapMs` is computed and discarded — see udp-bdp-link's
      // header). Each flow offers 0.6C, so the pair offers 1.2C and the shared queue must drop.
      pacing: { kind: "open-loop", offeredPktPerSec: 600 },
      durationMs: 20000,
      sampleMs: 100,
      flowCount: 2,
      flowStartMs: [0, 0],
      // Floyd-Jacobson: deterministic pacing into a drop-tail queue phase-locks. A correlation
      // measured at 0 is a phase artifact. This is the primary configuration; `0` is run too.
      sendPhaseJitterMs: 1,
      seed: 0x5eedn,
    }),
    warmupBuckets: 10,
    maxLag: 5,
    ...overrides,
  };
}

/** The per-arm link + start-time rewriting. One flow silenced = its start pushed past the horizon. */
function armConfigs(arm: IsolationArm, base: SimConfig): readonly SimConfig[] {
  const silent = base.durationMs + 1;
  if (arm === "shared") {
    return [{ ...base, flowCount: 2, flowStartMs: [0, 0] }];
  }
  const link =
    arm === "isolated-split"
      ? {
          ...base.link,
          capacityPktPerSec: base.link.capacityPktPerSec / 2,
          bufferPackets: Math.max(1, Math.floor(base.link.bufferPackets / 2)),
        }
      : base.link;
  return [
    { ...base, link, flowCount: 2, flowStartMs: [0, silent] },
    { ...base, link, flowCount: 2, flowStartMs: [silent, 0] },
  ];
}

export interface IsolationPoint {
  readonly arm: IsolationArm;
  readonly seed: bigint;
  /** Correlation of the two flows' delivered-throughput trajectories. The headline. */
  readonly delivered: CorrelationResult;
  /** Correlation of the two flows' controller-gap trajectories. `null` in the open-loop arm when
   *  the estimator never moves — which is itself a finding and not a failure. */
  readonly gap: CorrelationResult;
  readonly throughputPktPerSec: readonly [number, number];
  readonly congestionDrops: readonly [number, number];
  readonly totalThroughputPktPerSec: number;
  /** Jain index over the two flows. A bulkhead buys this outright; it is NOT decorrelation. */
  readonly jain: number;
  /**
   * Delivered throughput as a fraction of the capacity available to the pair — the F1 guard.
   *
   * Near 1.0 the shared arm's two series sum to a constant by arithmetic and r collapses to -1
   * for reasons that have nothing to do with coupling. This number is what says whether the
   * headline is a measurement or a restatement of the capacity.
   */
  readonly saturation: number;
}

/** Run one arm at one seed. Pure in `(cfg, arm, seed)`. */
export function isolationPoint(cfg: IsolationConfig, arm: IsolationArm, seed: bigint): IsolationPoint {
  const base = { ...cfg.base, seed };
  const configs = armConfigs(arm, base);
  const runs: SimResult[] = configs.map((c) => runLink(c));
  const f0 = runs[0]!.flows[0]!;
  const f1 = (runs[1] ?? runs[0]!).flows[1]!;

  const drop = <T>(a: readonly T[]): readonly T[] => a.slice(cfg.warmupBuckets);
  const d0 = drop(f0.deliveredTrajectory);
  const d1 = drop(f1.deliveredTrajectory);
  const g0 = drop(f0.gapTrajectory);
  const g1 = drop(f1.gapTrajectory);

  const t0 = f0.throughputPktPerSec;
  const t1 = f1.throughputPktPerSec;
  const s = t0 + t1;
  const s2 = t0 * t0 + t1 * t1;
  // Capacity available to the PAIR: one link in `shared`, two sub-links otherwise. Written from
  // the arm configs actually run, so a change to `armConfigs` cannot silently desynchronise it.
  const pairCapacity = configs.reduce((acc, c) => acc + c.link.capacityPktPerSec, 0);

  return {
    arm,
    seed,
    delivered: correlate(d0, d1, cfg.maxLag),
    gap: correlate(g0, g1, cfg.maxLag),
    throughputPktPerSec: [t0, t1],
    congestionDrops: [f0.congestionDrops, f1.congestionDrops],
    totalThroughputPktPerSec: s,
    jain: s2 === 0 ? 1 : (s * s) / (2 * s2),
    saturation: pairCapacity === 0 ? 0 : s / pairCapacity,
  };
}

// -- Sweep ---------------------------------------------------------------------------------

export interface ArmSummary {
  readonly arm: IsolationArm;
  /** Seeds whose lag-0 r passed BOTH guards (`verdict === "ok"`). Only these enter the means. */
  readonly usable: number;
  readonly attempted: number;
  /** Seeds refused, by reason. A nonzero count here is the instrument saying so out loud. */
  readonly refusedConstant: number;
  readonly refusedLeverage: number;
  readonly meanR: number | null;
  readonly meanAbsR: number | null;
  readonly sdR: number | null;
  readonly minR: number | null;
  readonly maxR: number | null;
  /**
   * How many usable r are negative. Under the null this is Binomial(usable, 1/2), so `usable/usable`
   * is a sign test at p = 2^-usable — the statistic that does NOT assume the series is i.i.d.
   * (Arbuthnot 1710; Dixon and Mood 1946.) This is the honest significance number here.
   */
  readonly negative: number;
  readonly meanAbsRBestLag: number | null;
  readonly meanTotalThroughputPktPerSec: number;
  readonly meanJain: number;
  readonly meanSaturation: number;
  readonly rs: readonly (number | null)[];
  readonly verdicts: readonly CorrelationVerdict[];
}

const mean = (a: readonly number[]): number | null => (a.length === 0 ? null : a.reduce((x, y) => x + y, 0) / a.length);

function summarise(arm: IsolationArm, points: readonly IsolationPoint[]): ArmSummary {
  const rs = points.map((p) => p.delivered.r);
  const verdicts = points.map((p) => p.delivered.verdict);
  const usable = points.filter((p) => p.delivered.verdict === "ok").map((p) => p.delivered.r!);
  const lagged = points
    .filter((p) => p.delivered.verdict === "ok")
    .map((p) => p.delivered.rAtBestLag)
    .filter((r): r is number => r !== null);
  const m = mean(usable);
  const sd =
    m === null || usable.length < 2
      ? null
      : Math.sqrt(usable.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (usable.length - 1));
  return {
    arm,
    usable: usable.length,
    attempted: rs.length,
    refusedConstant: verdicts.filter((v) => v === "undefined-constant").length,
    refusedLeverage: verdicts.filter((v) => v === "one-sample-leverage").length,
    meanR: m,
    meanAbsR: mean(usable.map(Math.abs)),
    sdR: sd,
    minR: usable.length === 0 ? null : Math.min(...usable),
    maxR: usable.length === 0 ? null : Math.max(...usable),
    negative: usable.filter((r) => r < 0).length,
    meanAbsRBestLag: mean(lagged.map(Math.abs)),
    meanTotalThroughputPktPerSec: mean(points.map((p) => p.totalThroughputPktPerSec)) ?? 0,
    meanJain: mean(points.map((p) => p.jain)) ?? 0,
    meanSaturation: mean(points.map((p) => p.saturation)) ?? 0,
    rs,
    verdicts,
  };
}

/** Deterministic seed ladder — no clock, no rng, so a sweep replays byte-identically. */
export function seedLadder(count: number, base = 0x5eedn): readonly bigint[] {
  const out: bigint[] = [];
  for (let i = 0; i < count; i++) out.push(base + BigInt(i) * 0x9e3779b97f4a7c15n);
  return out;
}

export interface IsolationSweep {
  readonly config: IsolationConfig;
  readonly seeds: readonly bigint[];
  readonly points: readonly IsolationPoint[];
  readonly summaries: readonly ArmSummary[];
}

export function sweepIsolation(cfg: IsolationConfig, seeds: readonly bigint[]): IsolationSweep {
  const points: IsolationPoint[] = [];
  for (const arm of ISOLATION_ARMS) for (const seed of seeds) points.push(isolationPoint(cfg, arm, seed));
  return {
    config: cfg,
    seeds,
    points,
    summaries: ISOLATION_ARMS.map((arm) =>
      summarise(
        arm,
        points.filter((p) => p.arm === arm),
      ),
    ),
  };
}

// -- Rendering (text only) -----------------------------------------------------------------

const f3 = (v: number | null): string => (v === null ? "  undef" : v.toFixed(3).padStart(7));

export function formatIsolationReport(sweep: IsolationSweep): string {
  const lines: string[] = [];
  const n = sweep.seeds.length;
  lines.push(`bandwidth isolation -> decorrelation  (${n} seeds, delivered-throughput trajectories)`);
  lines.push("");
  lines.push("arm             ok/n  refused   meanR     sdR    minR    maxR  neg  sat   jain");
  lines.push("-------------- ------ -------- ------- ------- ------- ------- ---- ----- -----");
  for (const s of sweep.summaries) {
    lines.push(
      [
        s.arm.padEnd(14),
        `${String(s.usable).padStart(3)}/${String(s.attempted).padEnd(2)}`,
        `c${s.refusedConstant} l${s.refusedLeverage}`.padStart(8),
        f3(s.meanR),
        f3(s.sdR),
        f3(s.minR),
        f3(s.maxR),
        `${s.negative}`.padStart(4),
        s.meanSaturation.toFixed(2).padStart(5),
        s.meanJain.toFixed(2).padStart(5),
      ].join(" "),
    );
  }
  lines.push("");
  lines.push("`isolated-split` IS the empirical null: same seeds, same per-flow entropy, capacity");
  lines.push("conserved, coupling removed. The i.i.d. null (1/sqrt(n-1)) does NOT apply to an");
  lines.push("autocorrelated queue series and is reported per-point only as a labelled artifact.");
  lines.push("`refused` = c:constant (F4) l:one-sample-leverage (F2). `sat` >~0.95 means the");
  lines.push("shared arm's r is the conservation identity (F1), not a coupling measurement.");
  return lines.join("\n");
}

// -- The contention dose-response (the actual result) ---------------------------------------

export interface ContentionPoint {
  readonly capacityPktPerSec: number;
  readonly saturation: number;
  readonly shared: ArmSummary;
  readonly isolatedSplit: ArmSummary;
}

/**
 * Hold the offered load fixed and RAISE the capacity — the control that separates "the queue
 * coupled them" from "being in one simulation coupled them".
 *
 * If the coupling is the shared queue, the shared arm's correlation must fall to the isolated
 * arm's null as the queue stops forming, monotonically, without any threshold being moved. If it
 * does not, the shared-arm number was an artifact of the arm and the whole study is void. This is
 * the falsifier, and it is the reason the headline is a curve and not a single r.
 */
export function contentionSweep(
  cfg: IsolationConfig,
  seeds: readonly bigint[],
  capacities: readonly number[],
): readonly ContentionPoint[] {
  return capacities.map((C) => {
    const link = {
      ...cfg.base.link,
      capacityPktPerSec: C,
      // Buffer held at one BDP so the queue's DEPTH scales with the link and the only thing
      // changing across the row is contention. A fixed buffer would confound the two.
      bufferPackets: Math.max(1, Math.round((C * 2 * cfg.base.link.owdMs) / 1000)),
    };
    const sw = sweepIsolation({ ...cfg, base: { ...cfg.base, link } }, seeds);
    const byArm = (a: IsolationArm): ArmSummary => sw.summaries.find((s) => s.arm === a)!;
    const shared = byArm("shared");
    return {
      capacityPktPerSec: C,
      saturation: shared.meanSaturation,
      shared,
      isolatedSplit: byArm("isolated-split"),
    };
  });
}

export function formatContention(points: readonly ContentionPoint[]): string {
  const lines: string[] = [];
  lines.push("contention dose-response: offered load FIXED, capacity RAISED");
  lines.push("");
  lines.push("capacity   sat    shared_r   sd   neg/ok   isolated_r   sd   neg/ok");
  lines.push("--------- ----- --------- ------ -------- ---------- ------ --------");
  for (const p of points) {
    lines.push(
      [
        String(p.capacityPktPerSec).padStart(9),
        p.saturation.toFixed(2).padStart(5),
        f3(p.shared.meanR).padStart(9),
        f3(p.shared.sdR).padStart(6),
        `${p.shared.negative}/${p.shared.usable}`.padStart(8),
        f3(p.isolatedSplit.meanR).padStart(10),
        f3(p.isolatedSplit.sdR).padStart(6),
        `${p.isolatedSplit.negative}/${p.isolatedSplit.usable}`.padStart(8),
      ].join(" "),
    );
  }
  return lines.join("\n");
}

// -- The shared-medium arm (a SECOND coupling, measured apart) ------------------------------

/**
 * The other physically real coupling in this model: one radio medium. `udp-bdp-link` advances a
 * SINGLE Gilbert-Elliott chain per transmitted frame regardless of which flow sent it, so on a
 * shared link a burst hits whoever is transmitting during it — while two isolated links each run
 * their own chain.
 *
 * That is a modelling decision (one medium, one chain), and it is stated rather than folded into
 * the primary number: with corruption at 0 the chain has no effect at all, which is why the
 * primary experiment sets it there. Raise it here and the shared arm acquires a coupling the
 * queue never supplied.
 */
export function sharedMediumSweep(
  cfg: IsolationConfig,
  seeds: readonly bigint[],
  overallLossRate: number,
  meanBurstLength: number,
  burst: (lossRate: number, meanBurst: number) => SimConfig["link"]["corruption"],
): IsolationSweep {
  const link = { ...cfg.base.link, corruption: burst(overallLossRate, meanBurstLength) };
  return sweepIsolation({ ...cfg, base: { ...cfg.base, link } }, seeds);
}
