/**
 * udp-lossy-transport.chaos.ts — a SEEDED, DST-replayable chaos harness for `udp-lossy-transport.ts`.
 *
 * ## Why this exists (and why the existing 16 tests do not cover it)
 *
 * `udp-lossy-transport.test.ts` ULT-1..ULT-16 are unit tests of the ALGEBRA and the STATE
 * MACHINE: parity XOR, single-erasure recovery, a negative control at 2 erasures, AIMD
 * arithmetic, codec round-trip. They are good tests at the wrong layer for the question
 * "is this reliable on a lossy channel?" — nothing in that file runs a LOSS PROCESS.
 *
 * The [8,4,4] block recovers a bounded number of erasures per block of 8. Real networks lose
 * in BURSTS, not uniformly (Gilbert 1960; Elliott 1963), so the failure mode of an
 * erasure-coded transport is a CORRELATED-FAILURE CLIFF: at a fixed mean loss rate,
 * concentrating the losses inside blocks destroys delivery while spreading them out does not.
 * A uniform-random (Bernoulli) loss injector would be the easy thing to build and would
 * produce a FALSE GREEN precisely because it never concentrates loss. So the loss model here
 * is a 2-state Markov chain, with Bernoulli available as a named point on it — kept
 * deliberately so the harness can DEMONSTRATE the false green rather than assert it.
 *
 * ## The instrument was itself defective until 2026-08-14 — read this before trusting a number
 *
 * That Bernoulli point used to be `burstParams(rate, 1)`, and it was not Bernoulli. With `r = 1`
 * the chain leaves BAD after exactly one packet, always, so the channel FORBIDS consecutive
 * losses: `P(drop | previous drop) = 0.00000` measured over 400,000 packets. A mean loss-run
 * length of exactly 1 is unattainable for any i.i.d. channel (Bernoulli sits at `1/(1−ρ)`), so
 * `L = 1` is the maximally ANTI-correlated extremum rather than the uncorrelated case
 * (081KZYY6SVJ087G0R0035SW945).
 *
 * Two consequences, and the second is why this mattered enough to fix:
 *
 * 1. Every "uniform loss" row the harness ever produced was measured on a channel that spaces
 *    its losses out. Per block of 8 at ρ = 0.1 it understated `k = 4` by 4.6x against
 *    `Binomial(8, 0.1)` and made `k >= 5` IMPOSSIBLE — and the tail is the only part an erasure
 *    code cares about. The 99% delivery cliff moves from 20% to **12%** once the channel is
 *    what it claimed to be (`UCH-22`).
 * 2. It was silently disarming MUTATION TESTS. A model that cannot produce a fault class cannot
 *    kill a mutant in that class, so a bound can be deleted and the suite stays green — which
 *    is exactly what happened to `min(pendingCorruptFrames, missing.length)` in #10541. See
 *    `UCH-24`, which measures that story and finds the stated cause was the wrong one.
 *
 * The correction is `bernoulliParams` (independence DERIVED, not asserted), `gilbertElliottParams`
 * (all four parameters reachable — the harness was running Gilbert's channel, not Elliott's),
 * `CALIBRATION.wifi2022` (a cited fit instead of round numbers), and `lomaxBurstTrace` (the
 * heavy tail a geometric burst length cannot represent). `UCH-5b` is the falsifier the harness
 * lacked: it FAILS if consecutive losses are impossible.
 *
 * `burstParams(ρ, 1)` is KEPT and still used — an anti-correlated bound is a legitimate thing to
 * measure against. It is simply no longer called uniform.
 *
 * ## Discipline conformance
 *
 * - §7 DST — the entire fault process is a pure function of (seed, stream, index). There is no
 *   `Math.random()` anywhere in this file, and no `Date.now()`. Any failing point replays
 *   exactly from its `seed`.
 * - §13 noninterference — entropy enters through ONE declared channel: `drawUnit(seed, stream,
 *   index)`, built on the repo's byte-locked SplitMix64 finaliser (`../splitmix64/splitmix64`).
 *   Faults are drawn on DISJOINT streams (loss / reorder / duplicate / payload), so changing
 *   the reorder rate cannot perturb the loss trace. That stream independence is what makes a
 *   parameter sweep a controlled experiment instead of a walk.
 * - §12 idempotency — duplication is a first-class injectable fault, and `UCH-9` pins
 *   apply-N == apply-once on the delivered set.
 * - `async-all-the-way-truthful-signatures` — the receive path drains a bounded queue through
 *   `runFerry` with a degree-of-parallelism knob. DoP=1 is a single cooperative loop; DoP=N
 *   uses N ferries on the same queue. NO un-knobbed spawn. `UCH-8` pins that DoP does not
 *   change the result, which is only true because of the next point.
 * - `local-time-never-enters-the-shared-fold` — the ferry's COMPLETION order is local receive
 *   order and steers nothing. Per-packet work is pure; the stateful block assembly folds in
 *   canonical WIRE order. That is why DoP is a throughput knob and not a semantics knob.
 *
 * ## Counter-based PRNG, not a stateful stream
 *
 * `drawUnit` is counter-based (Salmon, Moraes, Dror & Shaw, "Parallel Random Numbers: As Easy
 * as 1, 2, 3", SC'11 — CITED, not page-checked): the value at index i is computed directly
 * from (seed, stream, i) with no sequential state. This is stronger than a stateful PRNG for
 * DST: any point of the trace is addressable without replaying the prefix, so a fault at
 * packet 91,847 is reproducible in O(1).
 *
 * ## Anchors (Beacon)
 *
 * - E. N. Gilbert, "Capacity of a Burst-Noise Channel", Bell System Technical Journal 39(5),
 *   1960. — CITED, not page-checked.
 * - E. O. Elliott, "Estimates of Error Rates for Codes on Burst-Noise Channels", BSTJ 42(5),
 *   1963. — CITED, not page-checked. (Elliott generalises Gilbert's channel to a nonzero error
 *   probability in the GOOD state. This harness's TYPE always had `lossInGood`/`lossInBad` free;
 *   until 2026-08-14 no CALL SITE did, so what actually ran was Gilbert's channel throughout.
 *   `gilbertElliottParams` closes that gap — a free field with no caller is not a capability.)
 * - I. da Silva & J. Pedroso, "Packet Loss Characterization Using Cross Layer Information and
 *   HMM for Wi-Fi Networks", Sensors 22(2), 2022 (PMC9696961) — the calibration in
 *   `CALIBRATION.wifi2022`. **CITED, not page-checked** by this pass; the numbers are carried
 *   from the audit in 081KZYP23HG087G0R000117H0K, which reports reading them from the paper.
 *   The same paper concludes a 2-state GE model cannot capture the real system, which is
 *   recorded here as a LIMIT of this instrument rather than argued away.
 * - Lomax, "Business Failures: Another Example of the Analysis of Failure Data", JASA 49(268),
 *   1954 — the Pareto Type II distribution `lomaxBurstTrace` samples. CITED, not page-checked.
 * - Vigna, SplitMix64 (arXiv 1410.0530 §3) — the mixer, already byte-locked in this repo
 *   against the F#/C#/Rust oracles at `src/Core.TypeScript/splitmix64/golden-vectors.json`.
 * - Zhou et al., "FoundationDB: A Distributed Unbundled Transactional Key Value Store", SIGMOD
 *   2021; Will Wilson, "Testing Distributed Systems w/ Deterministic Simulation", Strange Loop
 *   2014 — the DST reference standard this harness follows in METHOD and departs from in FAULT
 *   CLASS. See the accompanying research doc for why.
 */

import { mix } from "../splitmix64/splitmix64";
import {
  computeAdinkraParity,
  buildSenderBlock,
  addToBlock,
  decodePacket,
  encodePacket,
  makeReceiverBlock,
  PACKET_CHECKSUM_BYTES,
  PACKET_HEADER_BYTES,
  xorParityBlock,
  xorRecoverErasure,
  MAX_NACK_GAP,
} from "./udp-lossy-transport";

const MASK64 = (1n << 64n) - 1n;
/** 2^53 — the number of distinct doubles in [0,1) we can address exactly. */
const TWO53 = 9007199254740992;

export const BLOCK_TOTAL = 8;
export const BLOCK_DATA = 4;

/**
 * Burst lengths the chaos sweeps walk.
 *
 * The top of the grid is derived from `maxNackGap` so a silent stop below the
 * receiver's desync threshold cannot recur (081KZZYETRX). Powers of two through
 * the NACK window, then one point past it. The past-desync point is what
 * actually exercises the receiver's desync branch; everything below the window
 * is NACK territory.
 *
 * Cost-aware: the grid is short (log of the window, plus one). A cliff
 * characterisation (`UCH-12`) may sample a subset; a caller that claims to
 * have swept the desync branch must walk the whole thing, including the
 * past-desync point. `UCH-28` is the falsifier: it fails if the exported grid
 * no longer exceeds `MAX_NACK_GAP`.
 */
export function deriveSweepBurstLengths(maxNackGap: number): readonly number[] {
  if (!Number.isInteger(maxNackGap) || maxNackGap < 2) {
    throw new Error(`maxNackGap must be an integer >= 2, got ${String(maxNackGap)}`);
  }
  const below: number[] = [];
  for (let L = 1; L < maxNackGap; L *= 2) below.push(L);
  const mid = Math.floor(maxNackGap / 2);
  if (!below.includes(mid)) below.push(mid);
  below.sort((a, b) => a - b);
  return [...below, maxNackGap + mid];
}

/** The live sweep grid. Recomputed from {@link MAX_NACK_GAP}, never a remembered list. */
export const SWEEP_BURST_LENGTHS: readonly number[] = deriveSweepBurstLengths(MAX_NACK_GAP);

// ── Declared entropy channel (§13) ────────────────────────────────────────────────────────

/** Stream identifiers. Disjoint streams keep faults independent under a parameter sweep. */
export const STREAM = {
  loss: 1,
  reorder: 2,
  duplicate: 3,
  payload: 4,
  /** Which SURVIVING frame gets a bit flipped, and which bit. Disjoint from `loss` on purpose:
   *  a CORRUPTED frame is one that ARRIVED, so the corruption process must not be able to
   *  perturb the drop trace, or the two fault classes stop being separable and the sweep stops
   *  being an experiment (081KZYP1X3B087G0R001EZ37PQ). */
  corrupt: 5,
  corruptBit: 6,
} as const;

/**
 * Counter-based 64-bit draw. Pure function of (seed, stream, index) — no sequential state.
 * This is the ONLY door entropy enters this harness through.
 */
export function drawU64(seed: bigint, stream: number, index: number): bigint {
  const key = mix((seed ^ (BigInt(stream) * 0x9e3779b97f4a7c15n)) & MASK64);
  return mix((key ^ BigInt(index)) & MASK64);
}

/** Counter-based uniform draw in [0, 1). 53 significant bits. */
export function drawUnit(seed: bigint, stream: number, index: number): number {
  return Number(drawU64(seed, stream, index) >> 11n) / TWO53;
}

// ── Gilbert–Elliott burst-loss channel ────────────────────────────────────────────────────

export interface GilbertElliottParams {
  /** p — probability of GOOD → BAD per packet. Controls how often a burst starts. */
  readonly pGoodToBad: number;
  /** r — probability of BAD → GOOD per packet. Mean burst length in BAD is 1/r. */
  readonly pBadToGood: number;
  /** 1−k — loss probability while in GOOD. Usually 0 (Gilbert's original) or small. */
  readonly lossInGood: number;
  /** 1−h — loss probability while in BAD. Usually 1 (a total outage) or high. */
  readonly lossInBad: number;
}

export type ChannelState = "good" | "bad";

/**
 * Build Gilbert–Elliott parameters from the two quantities an operator actually reasons about:
 * the OVERALL loss rate and the MEAN BURST LENGTH.
 *
 * With lossInGood=0 and lossInBad=1 the steady-state loss rate is exactly the stationary
 * probability of BAD, π_B = p/(p+r). Fixing r = 1/meanBurstLength and solving:
 *
 *     p = r · π_B / (1 − π_B)
 *
 * ## `meanBurstLength = 1` is NOT i.i.d. Bernoulli — corrected 2026-08-14
 *
 * This docstring used to claim "meanBurstLength = 1 reduces to i.i.d. Bernoulli loss — the
 * degenerate case". That is false, and it was false in the direction that flatters the code
 * (081KZYY6SVJ087G0R0035SW945).
 *
 * With `r = 1` the chain leaves BAD after EXACTLY one packet, always, so
 * `P(drop | previous drop) = 0` — measured at 0.00000 over 400,000 packets. An i.i.d.
 * Bernoulli(ρ) channel has `P(drop | previous drop) = ρ`, and therefore a mean loss-run length
 * of `1/(1−ρ) > 1`. **A mean burst length of exactly 1 is unattainable for any i.i.d. channel
 * with nonzero loss.** `L = 1` is not the uncorrelated case — it is the maximally
 * ANTI-correlated extremum, a channel that actively spaces its losses out.
 *
 * `L = 1` is kept, because an anti-correlated extremum is a legitimate and useful bound. It is
 * simply no longer named Bernoulli. For genuine i.i.d. loss use {@link bernoulliParams}, where
 * `L = 1/(1−ρ)` FALLS OUT of the chain rather than being asserted of it.
 */
export function burstParams(overallLossRate: number, meanBurstLength: number): GilbertElliottParams {
  if (overallLossRate < 0 || overallLossRate >= 1) throw new Error("overallLossRate must be in [0,1)");
  if (meanBurstLength < 1) throw new Error("meanBurstLength must be >= 1");
  const r = 1 / meanBurstLength;
  const p = (r * overallLossRate) / (1 - overallLossRate);
  return { pGoodToBad: Math.min(1, p), pBadToGood: r, lossInGood: 0, lossInBad: 1 };
}

/**
 * Genuine i.i.d. Bernoulli(ρ) loss, expressed as the Gilbert–Elliott point where the chain is
 * MEMORYLESS.
 *
 * The construction is forced, not chosen. A two-state chain is memoryless exactly when the
 * probability of being BAD next is the same from either state:
 *
 *     P(bad next | good) = p          P(bad next | bad) = 1 − r
 *     memoryless  ⟺  p = 1 − r  ⟺  r = 1 − p
 *
 * Setting `p = ρ` then gives `r = 1 − ρ`, `π_B = p/(p+r) = ρ`, and with a total outage in BAD
 * the drop indicator is i.i.d. Bernoulli(ρ) exactly.
 *
 * The mean loss-run length is then **derived, not asserted**: the expected sojourn in BAD is
 * `1/r = 1/(1−ρ)`. Nothing here sets a burst length; it is a consequence of demanding
 * independence. That is the whole difference from `burstParams(ρ, 1)`, which asserts `L = 1`
 * and thereby forbids the consecutive losses independence requires.
 *
 * `UCH-5b` is the falsifier: it FAILS if consecutive losses are impossible.
 */
export function bernoulliParams(lossRate: number): GilbertElliottParams {
  if (lossRate < 0 || lossRate >= 1) throw new Error("lossRate must be in [0,1)");
  return { pGoodToBad: lossRate, pBadToGood: 1 - lossRate, lossInGood: 0, lossInBad: 1 };
}

/**
 * The full four-parameter Gilbert–Elliott channel, every parameter reachable.
 *
 * `burstParams` and `bernoulliParams` both hardcode `lossInGood = 0, lossInBad = 1` — which in
 * the classical notation is `k = 1, h = 0`, i.e. **Gilbert's** 1960 channel with a total outage
 * in the bad state, not **Elliott's** 1963 generalisation the harness is named for. Two of the
 * four parameters were unreachable through any call site until this constructor existed
 * (081KZYP23HG087G0R000117H0K).
 *
 * `p` and `r` are the transition probabilities; `lossInGood`/`lossInBad` are `1−k` and `1−h`.
 */
export function gilbertElliottParams(
  pGoodToBad: number,
  pBadToGood: number,
  lossInGood: number,
  lossInBad: number,
): GilbertElliottParams {
  for (const [name, v] of [
    ["pGoodToBad", pGoodToBad],
    ["pBadToGood", pBadToGood],
    ["lossInGood", lossInGood],
    ["lossInBad", lossInBad],
  ] as const) {
    if (!(v >= 0 && v <= 1)) throw new Error(`${name} must be in [0,1]`);
  }
  if (pGoodToBad === 0 && pBadToGood === 0) throw new Error("p and r cannot both be 0 — the chain never mixes");
  return { pGoodToBad, pBadToGood, lossInGood, lossInBad };
}

/**
 * Named, CITED operating points. A calibrated point beats a large uncalibrated grid — which is
 * the entire lesson of 081KZYP23HG087G0R000117H0K, whose sweep values
 * (`[0.005 … 0.3] × [1,2,4,8]`) are round numbers with no trace behind them.
 *
 * `wifi2022` — da Silva & Pedroso, "Packet Loss Characterization Using Cross Layer Information
 * and HMM for Wi-Fi Networks", Sensors 22(2), 2022 (PMC9696961). 410 hours of indoor 802.11 UDP
 * traces. **CITED, not page-checked** — the numbers below are as recorded in the audit
 * (081KZYP23HG087G0R000117H0K), which reports having read them from the paper.
 *
 * Two of these four numbers are the point of the whole exercise:
 *   - `lossInBad = 0.6097`, not 1. A bad state that drops ~61% of packets leaves ~3 of 8 gone
 *     per block — sitting exactly ON the [8,4,4] correction boundary, which is precisely where a
 *     full decoder and a partial one differ most. `lossInBad = 1` is not merely harsher, it is
 *     MIS-SHAPED: it tests the region where every decoder fails alike.
 *   - `lossInGood = 0.0055`, not 0. The good state is not clean, so a block can fail without any
 *     burst at all.
 *
 * **Named honestly:** the same paper concludes a 2-state GE model "cannot capture the behavior
 * of the real system" and uses a 4-state HMM instead — see {@link lomaxBurstTrace} and the
 * follow-up item. This constant is the best 2-state point available, not a sufficient one.
 *
 * LoRa and LEO-satellite fits were searched for and **NOT FOUND**. They are deliberately absent
 * rather than extrapolated from the Wi-Fi fit.
 */
export const CALIBRATION = {
  wifi2022: {
    pGoodToBad: 0.0393,
    pBadToGood: 0.1862,
    lossInGood: 0.0055,
    lossInBad: 0.6097,
  } as GilbertElliottParams,
} as const;

/** Closed-form stationary probability of the BAD state. The falsifier for `gilbertElliottTrace`. */
export function stationaryBadFraction(p: GilbertElliottParams): number {
  const denom = p.pGoodToBad + p.pBadToGood;
  return denom === 0 ? 0 : p.pGoodToBad / denom;
}

/** Closed-form steady-state loss rate. The second falsifier. */
export function analyticLossRate(p: GilbertElliottParams): number {
  const piB = stationaryBadFraction(p);
  return (1 - piB) * p.lossInGood + piB * p.lossInBad;
}

/**
 * Closed-form mean length of a run of CONSECUTIVE DROPS. The third falsifier, and the one the
 * harness was missing.
 *
 * `1/r` is the mean sojourn in the BAD state, and the harness treated the two as the same
 * number. They are equal only when `lossInBad = 1` and `lossInGood = 0`. Under the measured
 * 802.11 fit (`lossInBad = 0.6097`) a bad-state sojourn is punctuated by packets that get
 * through, so the DROP runs are far shorter than the STATE sojourns — and the drop run is what
 * an erasure code actually experiences.
 *
 *     E[run] = P(drop) / P(drop_i ∧ ¬drop_{i−1})
 *
 * both taken in the stationary distribution. For `burstParams(ρ, L)` this returns exactly `L`;
 * for `bernoulliParams(ρ)` it returns exactly `1/(1−ρ)`; for `burstParams(ρ, 1)` it returns
 * exactly 1, which is the anti-correlation stated as a number.
 */
export function analyticLossRunLength(p: GilbertElliottParams): number {
  const piB = stationaryBadFraction(p);
  const pi = { good: 1 - piB, bad: piB };
  const e = { good: p.lossInGood, bad: p.lossInBad };
  // T[s][t] — probability of moving s → t in one packet.
  const T = {
    good: { good: 1 - p.pGoodToBad, bad: p.pGoodToBad },
    bad: { good: p.pBadToGood, bad: 1 - p.pBadToGood },
  } as const;
  const pDrop = pi.good * e.good + pi.bad * e.bad;
  let pRunStart = 0;
  for (const s of ["good", "bad"] as const)
    for (const t of ["good", "bad"] as const) pRunStart += pi[s] * (1 - e[s]) * T[s][t] * e[t];
  return pRunStart === 0 ? 0 : pDrop / pRunStart;
}

/** Measured `P(drop | previous drop)`. 0 means the channel FORBIDS consecutive loss. */
export function conditionalRepeatLossRate(trace: LossTrace): number {
  let prevDrops = 0;
  let bothDrop = 0;
  for (let i = 1; i < trace.dropped.length; i++) {
    if (!trace.dropped[i - 1]) continue;
    prevDrops++;
    if (trace.dropped[i]) bothDrop++;
  }
  return prevDrops === 0 ? 0 : bothDrop / prevDrops;
}

/**
 * Per-block-of-8 erasure-count histogram: `k → fraction of blocks with exactly k drops`.
 *
 * This is the distribution the [8,4,4] code is decided by, so it is the distribution the
 * instrument has to get right. Under `burstParams(ρ, 1)` the k≥4 tail is understated ~4.6× and
 * k≥5 is IMPOSSIBLE; under `bernoulliParams(ρ)` it matches `Binomial(8, ρ)`.
 */
export function blockErasureHistogram(trace: LossTrace, blockSize = BLOCK_TOTAL): number[] {
  const counts = new Array<number>(blockSize + 1).fill(0);
  const blocks = Math.floor(trace.dropped.length / blockSize);
  for (let b = 0; b < blocks; b++) {
    let k = 0;
    for (let i = 0; i < blockSize; i++) if (trace.dropped[b * blockSize + i]) k++;
    counts[k] = counts[k]! + 1;
  }
  return blocks === 0 ? counts : counts.map((c) => c / blocks);
}

/** `Binomial(n, p)` pmf — the closed form `blockErasureHistogram` is checked against. */
export function binomialPmf(n: number, p: number): number[] {
  const out = new Array<number>(n + 1).fill(0);
  let choose = 1;
  for (let k = 0; k <= n; k++) {
    out[k] = choose * Math.pow(p, k) * Math.pow(1 - p, n - k);
    choose = (choose * (n - k)) / (k + 1);
  }
  return out;
}

export interface LossTrace {
  readonly dropped: readonly boolean[];
  readonly states: readonly ChannelState[];
  readonly dropCount: number;
  /** run length → count, over maximal runs of consecutive drops. */
  readonly burstHistogram: ReadonlyMap<number, number>;
  readonly meanBurstLength: number;
}

/**
 * Generate a deterministic Gilbert–Elliott drop trace.
 *
 * The chain is burned in for `warmup` steps that are NOT recorded, so the trace is sampled
 * from (approximately) the stationary distribution rather than from the arbitrary GOOD start.
 * Without that, short traces are biased low and the cliff appears further out than it is.
 */
export function gilbertElliottTrace(
  count: number,
  params: GilbertElliottParams,
  seed: bigint,
  stream: number = STREAM.loss,
  warmup = 512,
): LossTrace {
  const dropped: boolean[] = new Array(count);
  const states: ChannelState[] = new Array(count);
  let state: ChannelState = "good";

  for (let i = -warmup; i < count; i++) {
    // Two independent draws per packet on the same stream at even/odd offsets: one for the
    // state transition, one for the loss decision. Sharing a draw between them would correlate
    // "burst started" with "packet lost" and quietly change the model.
    const idx = i + warmup;
    const uT = drawUnit(seed, stream, 2 * idx);
    state = state === "good" ? (uT < params.pGoodToBad ? "bad" : "good") : uT < params.pBadToGood ? "good" : "bad";
    const uL = drawUnit(seed, stream, 2 * idx + 1);
    const lose = uL < (state === "bad" ? params.lossInBad : params.lossInGood);
    if (i >= 0) {
      states[i] = state;
      dropped[i] = lose;
    }
  }

  let dropCount = 0;
  const burstHistogram = new Map<number, number>();
  let run = 0;
  for (let i = 0; i < count; i++) {
    if (dropped[i]) {
      dropCount++;
      run++;
    } else if (run > 0) {
      burstHistogram.set(run, (burstHistogram.get(run) ?? 0) + 1);
      run = 0;
    }
  }
  if (run > 0) burstHistogram.set(run, (burstHistogram.get(run) ?? 0) + 1);

  let bursts = 0;
  let burstPackets = 0;
  for (const [len, n] of burstHistogram) {
    bursts += n;
    burstPackets += len * n;
  }

  return {
    dropped,
    states,
    dropCount,
    burstHistogram,
    meanBurstLength: bursts === 0 ? 0 : burstPackets / bursts,
  };
}

// ── Heavy-tailed (Pareto Type II / Lomax) burst channel ───────────────────────────────────
//
// Gilbert–Elliott burst lengths are GEOMETRIC by construction — the sojourn in BAD is a
// coin-flip repeated. The da Silva & Pedroso traces are not: burst length mean 5.37, sd 31.68,
// **max 8,853**, fitted with a Pareto Type II tail. A block code's failure probability is
// dominated by that tail, and a geometric model cannot represent it at any parameter setting —
// which is why the paper concludes a 2-state GE "cannot capture the behavior of the real
// system" and moves to a 4-state HMM.
//
// So this is a RENEWAL process, not a Markov chain: alternating good runs (geometric) and loss
// bursts (Lomax). It is a strictly richer instrument than GE, and still strictly weaker than
// the paper's model. Named as such.

export interface LomaxBurstParams {
  /** Pareto Type II shape α. Tail index — the mean is finite for α>1, the variance for α>2. */
  readonly alpha: number;
  /** Pareto Type II scale λ. */
  readonly lambda: number;
  /** Mean length of a clean run between bursts (geometric). Sets the overall loss rate. */
  readonly meanGoodRun: number;
  /** Hard cap on a single burst, in packets. The traces' observed max is 8,853. */
  readonly maxBurst: number;
}

/**
 * Lomax parameters MOMENT-MATCHED to the reported 802.11 burst-length moments.
 *
 * **Register: DERIVED, not the paper's fit.** da Silva & Pedroso report burst mean 5.37 and sd
 * 31.68 and state the fit is Pareto Type II; they do not report α and λ in the audit note this
 * repo holds, so these two numbers are solved from the moments rather than read off:
 *
 *     Var/mean² = α/(α−2)  ⇒  1003.62/28.84 = 34.80  ⇒  α ≈ 2.0592
 *     mean = λ/(α−1)       ⇒  λ ≈ 5.37 × 1.0592 ≈ 5.688
 *
 * **Honest limit, stated because α is barely above 2:** at α ≈ 2.06 the variance exists but is
 * enormous and slowly-converging, so the sd match is fragile and a finite run will not reproduce
 * 31.68 reliably. The mean is robust; the sd is not. Use this to see whether the tail CHANGES A
 * CONCLUSION, not to quote a second-decimal figure.
 *
 * `meanGoodRun = 43` puts the overall loss rate at 5.37/(5.37+43) ≈ 11.1%, matching the overall
 * rate implied by `CALIBRATION.wifi2022`, so the two channels are comparable at equal mean loss
 * — which is the only way to attribute a delta to SHAPE rather than to rate.
 */
export const LOMAX_WIFI2022_DERIVED: LomaxBurstParams = {
  alpha: 2.0592,
  lambda: 5.688,
  meanGoodRun: 43,
  maxBurst: 8853,
};

/**
 * Generate a deterministic heavy-tailed drop trace by renewal: geometric good run, Lomax burst,
 * repeat. Total outage within a burst.
 *
 * Inverse-CDF sampling on the declared entropy channel keeps it DST-replayable and O(1)-seekable
 * per RENEWAL (not per packet — the renewal index is the counter, so the trace is still a pure
 * function of the seed).
 */
export function lomaxBurstTrace(
  count: number,
  params: LomaxBurstParams,
  seed: bigint,
  stream: number = STREAM.loss,
): LossTrace {
  if (params.alpha <= 0 || params.lambda <= 0) throw new Error("alpha and lambda must be > 0");
  if (params.meanGoodRun <= 0) throw new Error("meanGoodRun must be > 0");
  const dropped = new Array<boolean>(count).fill(false);
  const states = new Array<ChannelState>(count).fill("good");

  // Geometric with mean m has success probability 1/m; inverse-CDF gives ceil(ln(u)/ln(1−1/m)).
  const qGood = 1 - 1 / params.meanGoodRun;
  let i = 0;
  let renewal = 0;
  while (i < count) {
    const uG = drawUnit(seed, stream, 4 * renewal);
    const good = qGood <= 0 ? 1 : Math.max(1, Math.ceil(Math.log(1 - uG) / Math.log(qGood)));
    i += good;
    if (i >= count) break;
    const uB = drawUnit(seed, stream, 4 * renewal + 1);
    // Lomax inverse CDF: X = λ((1−u)^(−1/α) − 1). Rounded up so a burst is at least 1 packet.
    const raw = params.lambda * (Math.pow(1 - uB, -1 / params.alpha) - 1);
    const burst = Math.min(params.maxBurst, Math.max(1, Math.ceil(raw)));
    for (let b = 0; b < burst && i < count; b++, i++) {
      dropped[i] = true;
      states[i] = "bad";
    }
    renewal++;
  }

  let dropCount = 0;
  const burstHistogram = new Map<number, number>();
  let run = 0;
  for (let k = 0; k < count; k++) {
    if (dropped[k]) {
      dropCount++;
      run++;
    } else if (run > 0) {
      burstHistogram.set(run, (burstHistogram.get(run) ?? 0) + 1);
      run = 0;
    }
  }
  if (run > 0) burstHistogram.set(run, (burstHistogram.get(run) ?? 0) + 1);
  let bursts = 0;
  let burstPackets = 0;
  for (const [len, n] of burstHistogram) {
    bursts += n;
    burstPackets += len * n;
  }
  return { dropped, states, dropCount, burstHistogram, meanBurstLength: bursts === 0 ? 0 : burstPackets / bursts };
}

// ── GF(2) maximum-likelihood erasure decoder ──────────────────────────────────────────────
//
// The live module's `recoverAdinkraErasure` handles exactly ONE erasure per block. The [8,4,4]
// extended Hamming code has minimum distance d=4, and a linear code with minimum distance d
// corrects ANY d−1 erasures (two codewords agreeing on the n−(d−1) surviving positions would
// differ in at most d−1 < d positions — contradiction). So the code can correct any 3 erasures,
// and some 4-erasure patterns besides. This decoder measures that ceiling so the gap between
// the code's capability and the implementation's is a NUMBER rather than an assertion.
//
// This is a MEASUREMENT INSTRUMENT, not a proposed replacement landing in the transport. See
// the research doc; the transport upgrade is filed separately and marked PROPOSED.

/**
 * Recover the generator matrix FROM the live module rather than re-declaring it.
 *
 * Feeding the standard basis {e_i} through `computeAdinkraParity` makes parity[j][i] equal
 * G[i][4+j]. So the harness's matrix IS the module's matrix by construction, and the two
 * cannot drift apart — a re-declared copy would silently diverge on any edit to the module.
 */
export function generatorFromModule(): number[][] {
  const basis = Array.from({ length: BLOCK_DATA }, (_, i) => {
    const a = new Uint8Array(BLOCK_DATA);
    a[i] = 1;
    return a;
  });
  const parity = computeAdinkraParity(basis);
  const G: number[][] = [];
  for (let i = 0; i < BLOCK_DATA; i++) {
    const row = new Array<number>(BLOCK_TOTAL).fill(0);
    row[i] = 1;
    for (let j = 0; j < BLOCK_DATA; j++) row[BLOCK_DATA + j] = parity[j]![i]! & 1;
    G.push(row);
  }
  return G;
}

/** Invert a 4×4 matrix over GF(2) by Gauss–Jordan on [M | I]. Returns null if singular. */
export function invertGf2(m: readonly (readonly number[])[]): number[][] | null {
  const n = m.length;
  const aug = m.map((row, i) => {
    const r = new Array<number>(2 * n).fill(0);
    for (let c = 0; c < n; c++) r[c] = row[c]! & 1;
    r[n + i] = 1;
    return r;
  });
  for (let col = 0; col < n; col++) {
    let pivot = -1;
    for (let row = col; row < n; row++) {
      if (aug[row]![col] === 1) {
        pivot = row;
        break;
      }
    }
    if (pivot === -1) return null;
    if (pivot !== col) {
      const tmp = aug[col]!;
      aug[col] = aug[pivot]!;
      aug[pivot] = tmp;
    }
    const pivotRow = aug[col]!;
    for (let row = 0; row < n; row++) {
      const target = aug[row]!;
      if (row !== col && target[col] === 1) {
        for (let c = 0; c < 2 * n; c++) target[c] = target[c]! ^ pivotRow[c]!;
      }
    }
  }
  return aug.map((r) => r.slice(n));
}

/** All 4-subsets of `positions`, in lexicographic order — deterministic pivot selection. */
function* fourSubsets(positions: readonly number[]): Generator<number[]> {
  const n = positions.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) yield [positions[a]!, positions[b]!, positions[c]!, positions[d]!];
}

/**
 * Maximum-likelihood erasure decode of one [8,4,4] block.
 *
 * `received[i]` is the symbol at codeword position i, or null if erased. Returns the 4 data
 * symbols, or null when the surviving columns do not span GF(2)^4 (i.e. the erasure pattern
 * contains the support of a nonzero codeword — genuinely unrecoverable, not a decoder limit).
 */
export function mlDecodeBlock(
  received: readonly (Uint8Array | null)[],
  G: readonly (readonly number[])[],
): Uint8Array[] | null {
  if (received.length !== BLOCK_TOTAL) return null;
  const present: number[] = [];
  for (let i = 0; i < BLOCK_TOTAL; i++) if (received[i] !== null) present.push(i);
  if (present.length < BLOCK_DATA) return null;

  const sample = received.find((s) => s !== null);
  if (!sample) return null;
  const len = sample.length;

  for (const S of fourSubsets(present)) {
    // M[i][k] = G[i][S[k]] — the 4×4 submatrix on the chosen surviving columns.
    const M = Array.from({ length: BLOCK_DATA }, (_, i) => S.map((pos) => G[i]![pos]! & 1));
    const Minv = invertGf2(M);
    if (!Minv) continue;
    // c_S = m · M  ⟹  m = c_S · M⁻¹  ⟹  m_i = XOR_k [ Minv[k][i] · c_{S[k]} ]
    const data: Uint8Array[] = [];
    for (let i = 0; i < BLOCK_DATA; i++) {
      const out = new Uint8Array(len);
      for (let k = 0; k < BLOCK_DATA; k++) {
        if (Minv[k]![i] === 1) {
          const sym = received[S[k]!]!;
          const n = Math.min(out.length, sym.length);
          for (let b = 0; b < n; b++) out[b] = out[b]! ^ sym[b]!;
        }
      }
      data.push(out);
    }
    return data;
  }
  return null;
}

// ── DoP-knobbed ferry (async-all-the-way) ─────────────────────────────────────────────────

/**
 * Drain `items` through `processor` with a degree-of-parallelism knob.
 *
 * DoP=1 is a single cooperative loop — deterministic interleaving, the FoundationDB-style
 * replayable mode. DoP=N is N ferries pulling from one shared cursor. Results are written back
 * by INPUT INDEX, never by completion order, so the returned array is byte-identical for every
 * DoP. That is the property `UCH-8` pins, and it is why the DoP knob is a throughput dial and
 * not a semantics dial.
 *
 * No un-knobbed spawn: there is no path here that starts work you cannot dial down to one.
 */
export async function runFerry<T, R>(
  items: readonly T[],
  degreeOfParallelism: number,
  processor: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (degreeOfParallelism < 1) throw new Error("degreeOfParallelism must be >= 1");
  const results = new Array<R>(items.length);
  let cursor = 0;
  const ferry = async (): Promise<void> => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await processor(items[i]!, i);
    }
  };
  const ferries = Array.from({ length: Math.min(degreeOfParallelism, Math.max(1, items.length)) }, () => ferry());
  await Promise.all(ferries);
  return results;
}

// ── Wire model ────────────────────────────────────────────────────────────────────────────

export interface WirePacket {
  readonly seq: number;
  readonly blockSeq: number;
  readonly blockPos: number;
  readonly payload: Uint8Array;
  /** The ENCODED frame — header + payload + CRC-32C trailer, built by the live `encodePacket`.
   *
   *  Corruption is injected HERE and nowhere else, because a bit flip on the wire hits a frame,
   *  not a decoded payload: flipping inside `payload` alone could never exercise a corrupted
   *  `blockPos` or a corrupted length, which are the two corruptions with the largest blast
   *  radius (a good symbol written into the wrong slot; a mis-framed remainder). */
  readonly frame: Buffer;
}

export type CodeKind = "adinkra844" | "xor7of8";

export interface ChaosConfig {
  readonly blocks: number;
  readonly payloadBytes: number;
  readonly loss: GilbertElliottParams;
  /**
   * When present, the loss process is the heavy-tailed RENEWAL channel instead of the
   * Gilbert–Elliott chain, and `loss` is ignored. Absent by default, so every existing number is
   * reproduced rather than re-baselined.
   */
  readonly heavyTailLoss?: LomaxBurstParams;
  /** Per-packet probability that a packet is delayed behind the next `reorderDepth` packets. */
  readonly reorderProbability: number;
  readonly reorderDepth: number;
  /** Per-packet probability that a surviving packet is delivered twice. */
  readonly duplicateProbability: number;
  /**
   * Per-packet probability that a SURVIVING frame arrives with one bit flipped.
   *
   * The fourth fault class, and the one the harness could not express until
   * 081KZYP1X3B087G0R001EZ37PQ: erasure, duplication and reordering all preserve bytes, so every
   * number this harness ever produced described a channel that never lied. Applied to survivors
   * only — a dropped frame cannot also be corrupted — and drawn on its own stream.
   */
  readonly corruptProbability: number;
  /**
   * Whether the receiver VERIFIES the CRC-32C trailer. `true` is the shipped path.
   *
   * `false` is the NEGATIVE CONTROL, and it is the whole reason this knob exists rather than a
   * hardcoded `true`: it reproduces the pre-2026-08-14 receiver, which read the frame without
   * checking it. A test that only ever runs the checked path cannot tell a working check from a
   * check that never fires — `UCH-19` runs both arms and the difference between them IS the
   * measurement of what the check buys.
   */
  readonly verifyChecksum: boolean;
  readonly seed: bigint;
}

export function defaultConfig(overrides: Partial<ChaosConfig> = {}): ChaosConfig {
  return {
    blocks: 1000,
    payloadBytes: 8,
    loss: burstParams(0, 1),
    reorderProbability: 0,
    reorderDepth: 3,
    duplicateProbability: 0,
    corruptProbability: 0,
    verifyChecksum: true,
    seed: 0x5eedn,
    ...overrides,
  };
}

/** Deterministic payload for (blockSeq, dataIdx) — a pure function of the seed. */
export function makePayload(seed: bigint, blockSeq: number, dataIdx: number, bytes: number): Uint8Array {
  const out = new Uint8Array(bytes);
  for (let b = 0; b < bytes; b++) {
    out[b] = Number(drawU64(seed, STREAM.payload, (blockSeq * 64 + dataIdx) * 64 + b) & 0xffn);
  }
  return out;
}

/**
 * Build the sender's wire packets for one code.
 *
 * `adinkra844` uses the LIVE module's `buildSenderBlock` (4 data + 4 Adinkra parity).
 * `xor7of8`  is 7 data + 1 XOR parity, via the live module's `xorParityBlock`.
 * Both emit exactly 8 packets per block, so the same drop trace applies to both — apples to
 * apples on the wire, which is the only fair way to compare their cliffs.
 */
export function buildWire(cfg: ChaosConfig, code: CodeKind): WirePacket[] {
  const out: WirePacket[] = [];
  const dataPerBlock = code === "adinkra844" ? BLOCK_DATA : 7;
  for (let blockSeq = 0; blockSeq < cfg.blocks; blockSeq++) {
    const data = Array.from({ length: dataPerBlock }, (_, i) => makePayload(cfg.seed, blockSeq, i, cfg.payloadBytes));
    const all: Uint8Array[] =
      code === "adinkra844"
        ? (() => {
            const b = buildSenderBlock(blockSeq, data);
            return [...b.dataPackets, ...b.parityPackets];
          })()
        : [...data, xorParityBlock(data)];
    for (let pos = 0; pos < BLOCK_TOTAL; pos++) {
      const seq = blockSeq * BLOCK_TOTAL + pos;
      const payload = all[pos]!;
      out.push({
        seq,
        blockSeq,
        blockPos: pos,
        payload,
        // The LIVE encoder, not a re-implementation: the harness must measure the checksum the
        // transport actually writes, or it measures a checksum of its own invention.
        frame: encodePacket(
          { seq, blockSeq, blockPos: pos, isData: pos < dataPerBlock, payloadLen: payload.length },
          payload,
        ),
      });
    }
  }
  return out;
}

/** Flip one bit of a frame, chosen by a pure draw. Returns a COPY — the sender's frame is
 *  evidence and must survive the channel unmodified, or the corruption check has no truth to
 *  compare against. The bit is drawn over the WHOLE frame (header, payload and CRC trailer
 *  alike), because a real flip does not respect field boundaries: a flip in `blockPos` writes a
 *  good symbol into the wrong slot, and a flip in the trailer is a frame whose data is fine and
 *  whose checksum is not. Both must be rejected, and only a whole-frame draw exercises both. */
function flipOneBit(frame: Buffer, seed: bigint, index: number): Buffer {
  const copy = Buffer.from(frame);
  const bit = Number(drawU64(seed, STREAM.corruptBit, index) % BigInt(frame.length * 8));
  copy[bit >> 3] = copy[bit >> 3]! ^ (1 << (bit & 7));
  return copy;
}

/**
 * Apply the four faults, in wire order, from the seed. Returns the packets the receiver
 * actually sees, in the order it sees them.
 *
 * Order of application matters and is fixed: LOSS, then CORRUPTION, then DUPLICATION, then
 * REORDERING. Loss first because the channel drops before anything downstream can copy it;
 * corruption next because only a SURVIVING frame can be corrupted — a frame the channel
 * destroyed is an erasure, and conflating the two is the exact distinction this fault class
 * exists to keep; duplication before reordering because a duplicate is itself a packet that can
 * then be reordered.
 *
 * MODELLING CHOICE, named: corruption is drawn per WIRE index and applied before duplication, so
 * a duplicated corrupt frame carries the SAME flip in both copies rather than two independent
 * ones. The corruption sweeps run with `duplicateProbability = 0`, so the two never interact in
 * any measured number here; a run that sets both should read this line first.
 */
export function applyFaults(
  wire: readonly WirePacket[],
  cfg: ChaosConfig,
): { delivered: WirePacket[]; trace: LossTrace; corrupted: number } {
  const trace = cfg.heavyTailLoss
    ? lomaxBurstTrace(wire.length, cfg.heavyTailLoss, cfg.seed, STREAM.loss)
    : gilbertElliottTrace(wire.length, cfg.loss, cfg.seed, STREAM.loss);

  const survived: WirePacket[] = [];
  let corrupted = 0;
  for (let i = 0; i < wire.length; i++) {
    if (trace.dropped[i]) continue;
    let pkt = wire[i]!;
    if (cfg.corruptProbability > 0 && drawUnit(cfg.seed, STREAM.corrupt, i) < cfg.corruptProbability) {
      pkt = { ...pkt, frame: flipOneBit(pkt.frame, cfg.seed, i) };
      corrupted++;
    }
    survived.push(pkt);
    if (cfg.duplicateProbability > 0 && drawUnit(cfg.seed, STREAM.duplicate, i) < cfg.duplicateProbability) {
      survived.push(pkt);
    }
  }

  if (cfg.reorderProbability <= 0 || cfg.reorderDepth <= 0) return { delivered: survived, trace, corrupted };

  // Reordering: a selected packet is held back and re-inserted `reorderDepth` slots later.
  // Deterministic: selection is a pure draw on the reorder stream, keyed by position.
  const delayed: Array<{ pkt: WirePacket; releaseAt: number }> = [];
  const outOrder: WirePacket[] = [];
  for (let i = 0; i < survived.length; i++) {
    for (let d = delayed.length - 1; d >= 0; d--) {
      if (delayed[d]!.releaseAt <= i) {
        outOrder.push(delayed[d]!.pkt);
        delayed.splice(d, 1);
      }
    }
    if (drawUnit(cfg.seed, STREAM.reorder, i) < cfg.reorderProbability) {
      delayed.push({ pkt: survived[i]!, releaseAt: i + cfg.reorderDepth });
    } else {
      outOrder.push(survived[i]!);
    }
  }
  for (const d of delayed) outOrder.push(d.pkt);
  return { delivered: outOrder, trace, corrupted };
}

// ── Receivers ─────────────────────────────────────────────────────────────────────────────

export type DecoderKind =
  /** The LIVE module path: `makeReceiverBlock` + `addToBlock` (1 erasure per block). */
  | "impl-adinkra"
  /** The code's true ceiling: GF(2) ML erasure decode of the same [8,4,4] block. */
  | "ml-adinkra"
  /** The low-bandwidth fallback named in the module header: 7 data + 1 XOR parity. */
  | "xor7of8";

export interface RunResult {
  readonly decoder: DecoderKind;
  readonly wirePacketsSent: number;
  readonly dataPacketsSent: number;
  readonly dataPacketsDelivered: number;
  /** Delivered payloads that did NOT match the sender's bytes. Must be 0 whenever
   *  `verifyChecksum` is true — that is the property 081KZYP1X3B087G0R001EZ37PQ bought, and with
   *  `verifyChecksum: false` this counter is what shows the defect it bought it from. */
  readonly corruptDeliveries: number;
  /** Frames the channel corrupted (one bit flipped in a SURVIVING frame). */
  readonly framesCorrupted: number;
  /** Frames the CRC-32C refused. Under `verifyChecksum: true` these are exactly the corrupted
   *  frames, so `framesRejected === framesCorrupted` is the check's detection rate stated as an
   *  identity — CRC-32C misses no single-bit error by construction (any CRC has Hamming distance
   *  at least 2), so a shortfall here is a bug and not a probability. */
  readonly framesRejected: number;
  /** Blocks that produced no delivery at all. */
  readonly blocksLost: number;
  /** dataPacketsDelivered / dataPacketsSent. */
  readonly deliveryRatio: number;
  /** dataPacketsDelivered / wirePacketsSent — the honest cross-code comparison. */
  readonly goodput: number;
  readonly observedLossRate: number;
  readonly observedMeanBurstLength: number;
}

/**
 * Run one chaos scenario end to end and measure delivery.
 *
 * The receive path is deliberately split in two, and the split IS the discipline:
 *   1. per-packet decode work runs through the DoP-knobbed ferry — pure, order-free;
 *   2. block assembly folds the ferry's output in canonical WIRE order.
 * The ferry's completion order (local receive order) therefore never reaches the fold.
 */
export async function runScenario(cfg: ChaosConfig, decoder: DecoderKind, degreeOfParallelism = 1): Promise<RunResult> {
  const code: CodeKind = decoder === "xor7of8" ? "xor7of8" : "adinkra844";
  const dataPerBlock = code === "adinkra844" ? BLOCK_DATA : 7;
  const wire = buildWire(cfg, code);
  const { delivered, trace, corrupted } = applyFaults(wire, cfg);

  // Stage 1 — the ferry. Pure per-packet work; results keyed by input index.
  //
  // The frame is DECODED here, by the live `decodePacket`, which is also where the CRC-32C is
  // verified. That placement is not incidental: rejection is per-frame and stateless, so it is
  // pure ferry work, and a rejected frame simply never reaches the order-sensitive fold — it
  // becomes an erasure, which is precisely the degradation the check is for.
  const arrivals = await runFerry(delivered, degreeOfParallelism, async (pkt) => {
    const d = decodePacket(pkt.frame);
    if (d.ok) return { blockSeq: d.header.blockSeq, blockPos: d.header.blockPos, payload: d.payload };
    if (cfg.verifyChecksum) return null;
    // NEGATIVE CONTROL — the pre-2026-08-14 receiver, reconstructed deliberately rather than
    // kept alive in the module: read the header fields and hand the bytes on WITHOUT checking
    // them. This is what made one flipped parity bit into a silently wrong data packet.
    return {
      blockSeq: pkt.frame.readUInt32BE(4),
      blockPos: pkt.frame.readUInt8(8),
      payload: new Uint8Array(pkt.frame.subarray(PACKET_HEADER_BYTES, pkt.frame.length - PACKET_CHECKSUM_BYTES)),
    };
  });
  const decodedArrivals = arrivals.filter((a): a is NonNullable<typeof a> => a !== null);
  const framesRejected = arrivals.length - decodedArrivals.length;

  // Stage 2 — the fold, in canonical wire order.
  const G = generatorFromModule();
  let dataPacketsDelivered = 0;
  let corruptDeliveries = 0;
  let blocksLost = 0;

  if (decoder === "impl-adinkra") {
    // Drive the LIVE receiver state machine, one `ReceiverBlock` per blockSeq.
    const blocks = new Map<number, ReturnType<typeof makeReceiverBlock>>();
    const deliveredByBlock = new Map<number, Uint8Array[]>();
    for (const a of decodedArrivals) {
      let blk = blocks.get(a.blockSeq);
      if (!blk) {
        blk = makeReceiverBlock(a.blockSeq);
        blocks.set(a.blockSeq, blk);
      }
      const got = addToBlock(blk, a.blockPos, a.payload);
      // Idempotency (§12): first delivery wins; a redelivery is an upsert on the same key,
      // never a second credit. Without this keying, duplication would inflate the score.
      if (got && !deliveredByBlock.has(a.blockSeq)) deliveredByBlock.set(a.blockSeq, got);
    }
    for (let b = 0; b < cfg.blocks; b++) {
      const got = deliveredByBlock.get(b);
      if (!got) {
        blocksLost++;
        continue;
      }
      for (let i = 0; i < BLOCK_DATA; i++) {
        const expected = makePayload(cfg.seed, b, i, cfg.payloadBytes);
        if (bytesEqual(got[i]!, expected)) dataPacketsDelivered++;
        else corruptDeliveries++;
      }
    }
  } else {
    // Collect the arrival SET per block (position → payload), then decode once.
    const seen = new Map<number, (Uint8Array | null)[]>();
    for (const a of decodedArrivals) {
      let arr = seen.get(a.blockSeq);
      if (!arr) {
        arr = new Array<Uint8Array | null>(BLOCK_TOTAL).fill(null);
        seen.set(a.blockSeq, arr);
      }
      // Idempotent: a duplicate writes the same value at the same key. The range guard matters
      // only in the `verifyChecksum: false` arm, where a corrupted `blockPos` is a `uint8` a
      // flipped bit may set anywhere in 0..255 — the same protection `addToBlock` already gives
      // the live path, applied here so the negative control measures WRONG BYTES rather than an
      // out-of-range array write.
      if (a.blockPos < BLOCK_TOTAL) arr[a.blockPos] = a.payload;
    }
    for (let b = 0; b < cfg.blocks; b++) {
      const arr = seen.get(b) ?? new Array<Uint8Array | null>(BLOCK_TOTAL).fill(null);
      const got = decoder === "ml-adinkra" ? mlDecodeBlock(arr, G) : xorDecodeBlock(arr, cfg.payloadBytes);
      if (!got) {
        blocksLost++;
        continue;
      }
      for (let i = 0; i < dataPerBlock; i++) {
        const expected = makePayload(cfg.seed, b, i, cfg.payloadBytes);
        if (bytesEqual(got[i]!, expected)) dataPacketsDelivered++;
        else corruptDeliveries++;
      }
    }
  }

  const dataPacketsSent = cfg.blocks * dataPerBlock;
  return {
    decoder,
    wirePacketsSent: wire.length,
    dataPacketsSent,
    dataPacketsDelivered,
    corruptDeliveries,
    framesCorrupted: corrupted,
    framesRejected,
    blocksLost,
    deliveryRatio: dataPacketsSent === 0 ? 0 : dataPacketsDelivered / dataPacketsSent,
    goodput: wire.length === 0 ? 0 : dataPacketsDelivered / wire.length,
    observedLossRate: wire.length === 0 ? 0 : trace.dropCount / wire.length,
    observedMeanBurstLength: trace.meanBurstLength,
  };
}

/** 7 data + 1 XOR parity: recover the 7 data symbols, or null if 2+ of the 8 are missing. */
function xorDecodeBlock(arr: readonly (Uint8Array | null)[], payloadBytes: number): Uint8Array[] | null {
  const data = arr.slice(0, 7);
  const parity = arr[7];
  const missingData = data.filter((d) => d === null).length;
  if (missingData === 0) return data as Uint8Array[];
  if (missingData > 1 || !parity) return null;
  const recovered = xorRecoverErasure(data, parity);
  if (!recovered) return null;
  const idx = data.findIndex((d) => d === null);
  const out = data.slice() as (Uint8Array | null)[];
  out[idx] = recovered.subarray(0, payloadBytes);
  return out as Uint8Array[];
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length < b.length) return false;
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ── Cliff characterisation ────────────────────────────────────────────────────────────────

export interface SweepPoint {
  readonly meanBurstLength: number;
  readonly targetLossRate: number;
  readonly observedLossRate: number;
  readonly observedMeanBurstLength: number;
  readonly deliveryRatio: number;
  readonly goodput: number;
}

export interface CliffReport {
  readonly decoder: DecoderKind;
  readonly threshold: number;
  readonly points: readonly SweepPoint[];
  /**
   * meanBurstLength → the LAST swept loss rate at which deliveryRatio ≥ threshold.
   * `null` means the decoder was already below threshold at the lowest swept loss rate.
   * This is the number the harness exists to produce.
   */
  readonly cliffByBurstLength: ReadonlyMap<number, number | null>;
}

/**
 * Sweep (mean burst length × overall loss rate) and report where delivery falls off.
 *
 * The deliverable is a NUMBER, not a pass/fail: "degrades gracefully to X% loss at mean burst
 * length Y, and falls off beyond that". A pass/fail here would encode today's tuning as a
 * requirement, which is exactly the false-green failure the harness is built to avoid.
 */
export async function characteriseCliff(
  decoder: DecoderKind,
  lossRates: readonly number[],
  burstLengths: readonly number[],
  base: Partial<ChaosConfig> = {},
  threshold = 0.99,
  degreeOfParallelism = 1,
  /**
   * The channel family the sweep runs on. Defaults to `burstParams` so every previously
   * published sweep reproduces exactly. Pass `(rate) => bernoulliParams(rate)` to sweep genuine
   * i.i.d. loss — which is what the `L = 1` row was believed to be and was not.
   */
  channelFor: (rate: number, meanBurstLength: number) => GilbertElliottParams = burstParams,
): Promise<CliffReport> {
  const points: SweepPoint[] = [];
  const cliffByBurstLength = new Map<number, number | null>();
  for (const L of burstLengths) {
    let cliff: number | null = null;
    for (const rate of lossRates) {
      const cfg = defaultConfig({ ...base, loss: channelFor(rate, L) });
      const res = await runScenario(cfg, decoder, degreeOfParallelism);
      points.push({
        meanBurstLength: L,
        targetLossRate: rate,
        observedLossRate: res.observedLossRate,
        observedMeanBurstLength: res.observedMeanBurstLength,
        deliveryRatio: res.deliveryRatio,
        goodput: res.goodput,
      });
      if (res.deliveryRatio >= threshold) cliff = rate;
      else break; // delivery is monotone in loss; the first miss is the cliff
    }
    cliffByBurstLength.set(L, cliff);
  }
  return { decoder, threshold, points, cliffByBurstLength };
}

/** Render a sweep as a fixed-width table — text, diffable, no binary in the proof lineage. */
export function formatCliffReport(report: CliffReport): string {
  const lines: string[] = [];
  lines.push(`decoder=${report.decoder} threshold=${report.threshold}`);
  lines.push("  L    target   observed   burstObs   delivery   goodput");
  for (const p of report.points) {
    lines.push(
      `  ${String(p.meanBurstLength).padStart(2)}   ${p.targetLossRate.toFixed(4)}   ${p.observedLossRate.toFixed(4)}     ${p.observedMeanBurstLength.toFixed(2).padStart(5)}    ${p.deliveryRatio.toFixed(4)}    ${p.goodput.toFixed(4)}`,
    );
  }
  for (const [L, cliff] of report.cliffByBurstLength) {
    lines.push(`  cliff L=${L}: ${cliff === null ? "below threshold at the lowest swept rate" : cliff.toFixed(4)}`);
  }
  return lines.join("\n");
}
