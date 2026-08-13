/**
 * udp-bdp-link.ts - a BANDWIDTH-DELAY-PRODUCT link model for `udp-lossy-transport.ts`, and the
 * measurements a congestion controller has to pass.
 *
 * ## Why this exists (and what `udp-lossy-transport.chaos.ts` does NOT measure)
 *
 * The Gilbert-Elliott chaos harness (#10417) measures DELIVERY RATIO and GOODPUT against an
 * injected loss process. That is a CHANNEL-QUALITY measurement, and it is the right instrument
 * for the erasure-code question it was built for. It models no capacity, no queue and no
 * propagation delay - a packet is dropped or it is not, and every survivor arrives instantly.
 * A model with no queue cannot produce congestion, so it cannot answer either half of
 * "is our backoff tested, and can we saturate a network channel?":
 *
 *   - **saturation** needs a link with a finite capacity `C` to saturate;
 *   - **backoff** needs a feedback loop long enough (`D`) and a buffer deep enough (`B`) for a
 *     control decision to be wrong.
 *
 * So this module adds the missing physics: a single bottleneck link with capacity `C`
 * (packets/second), a drop-tail buffer of `B` packets, and a one-way propagation delay `D`
 * milliseconds. Loss then has **two structurally distinct causes**, and they are counted
 * separately everywhere in this file:
 *
 *   - **congestion loss** - the drop-tail buffer was full. Backing off relieves it.
 *   - **corruption loss** - the channel corrupted the frame (the Gilbert-Elliott process,
 *     reused from the chaos harness). Backing off relieves NOTHING.
 *
 * Keeping those separable is the entire point of the module.
 *
 * ## The wiring fact this model exposes first - CHECKED
 *
 * `LossyUdpChannel.flushBlock` broadcasts all 8 packets of a block in a tight `for` loop and
 * calls `onSend` after each. **It never reads `gapMs`.** A repo-wide grep finds `gapMs` written
 * in `updateAimd` and read only by `updateAimd` itself and one unit-test assertion; no send path
 * anywhere consults it. The AIMD controller is therefore an **open-loop estimator whose output
 * is discarded** - there is no rate control in the shipped transport at all.
 *
 * That is why this module has TWO pacing arms over ONE code path, differing in a single knob:
 *
 *   - `open-loop` - the SHIPPED behaviour. The source paces itself; the estimator still runs
 *     and still computes a gap, and we record the gap it computes and throws away.
 *   - `aimd` - the controller as DESIGNED-BUT-UNWIRED: the same live `AimdState` functions,
 *     with `gapMs` actually pacing the sender.
 *
 * The delta between the two arms is the measurement of what wiring the controller up would buy
 * (or cost). Neither arm modifies the transport; `makeAimdState` / `onSend` / `onNack` are
 * imported and driven, never reimplemented.
 *
 * ## The framing under test - the decisive experiment
 *
 * **AIMD conflates erasure loss with congestion loss, and on the target links of this repo that
 * is backwards.** Multiplicative decrease is the correct response when loss means a full queue.
 * On an 802.11 mesh or a LoRa link most loss is channel corruption, so backing off neither
 * relieves anything nor is warranted - it only surrenders throughput. Known since Balakrishnan,
 * Padmanabhan, Seshan and Katz, "A Comparison of Mechanisms for Improving TCP Performance over
 * Wireless Links" (SIGCOMM 96 / IEEE-ACM ToN 5(6) 1997) - CITED, not page-checked; and it is
 * the explicit thesis of BBR (Cardwell, Cheng, Gunn, Yeganeh and Jacobson, ACM Queue 14(5),
 * 2016 - CITED, not page-checked) that loss is not a congestion signal.
 *
 * The decisive experiment `corruptionVsCongestion` runs is: **hold congestion at zero, raise
 * corruption loss, and plot throughput.** A controller that responds only to congestion is flat.
 * If ours falls, that is the defect, quantified - and the fix is "separate the signals", not
 * "tune the thresholds".
 *
 * ## Anchors (Beacon)
 *
 * - D.-M. Chiu and R. Jain, "Analysis of the Increase and Decrease Algorithms for Congestion
 *   Avoidance in Computer Networks", Computer Networks and ISDN Systems 17(1), 1989 - CITED,
 *   not page-checked. AIMD converges to efficiency and fairness UNDER ITS ASSUMPTIONS; the
 *   assumptions are what the convergence and fairness reports check.
 * - V. Jacobson, "Congestion Avoidance and Control", SIGCOMM 88 - CITED, not page-checked.
 *   The origin of loss-as-congestion-signal, and of the self-clocking this transport lacks.
 * - R. Jain, D.-M. Chiu and W. Hawe, "A Quantitative Measure of Fairness and Discrimination",
 *   DEC-TR-301, 1984 - CITED, not page-checked. The fairness index computed in `jainFairness`.
 * - J. Gettys and K. Nichols, "Bufferbloat: Dark Buffers in the Internet", ACM Queue 9(11),
 *   2011 - CITED, not page-checked. The standing-queue experiment.
 * - Gilbert (BSTJ 1960) / Elliott (BSTJ 1963) for the corruption process - reused from
 *   `udp-lossy-transport.chaos.ts` rather than re-declared.
 * - Kleinrock, "Queueing Systems Vol. 1" (1975) - CITED, not page-checked. The D/D/1/B
 *   deterministic-service queue this link is.
 *
 * ## Discipline conformance
 *
 * - **Sec.7 DST** - one deterministic event loop. Entropy enters only through `drawUnit(seed,
 *   stream, index)` (the declared door of the chaos harness, byte-locked SplitMix64). No
 *   `Math.random`. The one `Date.now()` reachable from here is the `windowStart` of
 *   `makeAimdState`, which is written and read nowhere (CHECKED by grep) and so cannot perturb
 *   a run; `UBL-1` pins byte-identical replay to make that concrete rather than argued.
 * - **Sec.13 noninterference** - corruption and jitter draw on streams disjoint from those of
 *   the chaos harness, so raising jitter provably cannot perturb the corruption trace (`UBL-2`).
 * - **local-time-never-enters-the-shared-fold** - simulated time steers only local actions
 *   (pacing, queue service, NACK emission). Event ties break on a monotone insertion counter,
 *   never on a wall clock, so the event order is a pure function of the config.
 * - **async-all-the-way** - a single simulation is one cooperative loop (DoP=1 by construction,
 *   the FoundationDB shape). Sweep-level concurrency goes through `runFerry` from the chaos
 *   harness with its DoP knob; `UBL-4` pins that DoP does not change a digit of the output.
 * - **no binary in the proof lineage** - every table renders as fixed-width text.
 */

import { burstParams, drawUnit, runFerry, type GilbertElliottParams } from "./udp-lossy-transport.chaos";
import { makeAimdState, onNack, onSend, type AimdState } from "./udp-lossy-transport";

// -- Declared entropy streams (Sec.13) ----------------------------------------------------
//
// Disjoint from STREAM = { loss:1, reorder:2, duplicate:3, payload:4 } in
// `udp-lossy-transport.chaos.ts`. A collision would silently correlate two "independent" fault
// processes, which is the failure that makes a sweep a walk instead of an experiment.
export const LINK_STREAM = {
  /** Gilbert-Elliott corruption on the wire, indexed by TRANSMISSION order. */
  corrupt: 11,
  /** Per-packet delivery jitter - the physical cause of reordering on a retrying mesh link. */
  jitter: 12,
  /** Sender phase noise - breaks the deterministic phase lock Floyd and Jacobson 1992 describe. */
  sendPhase: 13,
} as const;

// -- Link ---------------------------------------------------------------------------------

export interface LinkParams {
  /** C - link capacity in packets per second. Service is deterministic: 1000/C ms per packet. */
  readonly capacityPktPerSec: number;
  /** D - one-way propagation delay in ms. Minimum RTT is 2D; the feedback loop is one D long. */
  readonly owdMs: number;
  /** B - drop-tail buffer depth in packets, counting the packet in service. */
  readonly bufferPackets: number;
  /** Channel corruption. Structurally distinct from queue overflow and counted separately. */
  readonly corruption: GilbertElliottParams;
  /**
   * Per-packet extra delivery delay drawn uniformly from [0, jitterMs). This is how reordering
   * arises physically (per-hop retry on a mesh), and it is the input that drives the reorder
   * defect 081KZYN3D53087G0R0036XZSYM without dropping a single packet.
   */
  readonly jitterMs: number;
}

/** Bandwidth-delay product in packets: capacity x round-trip time. The natural unit for `B`. */
export function bdpPackets(link: Pick<LinkParams, "capacityPktPerSec" | "owdMs">): number {
  return (link.capacityPktPerSec * (2 * link.owdMs)) / 1000;
}

export function defaultLink(overrides: Partial<LinkParams> = {}): LinkParams {
  const base = { capacityPktPerSec: 1000, owdMs: 20 };
  return {
    ...base,
    bufferPackets: Math.max(1, Math.round(bdpPackets(base))),
    corruption: burstParams(0, 1),
    jitterMs: 0,
    ...overrides,
  };
}

// -- Sender arms --------------------------------------------------------------------------

export type Pacing =
  /**
   * The SHIPPED path: `flushBlock` transmits as fast as the application supplies blocks and
   * never consults `gapMs`. `offeredPktPerSec` is the offered load of the application. Set it
   * above `C` for a greedy source - that is the "can we saturate the channel" configuration.
   */
  | { readonly kind: "open-loop"; readonly offeredPktPerSec: number }
  /** The controller as DESIGNED: a greedy source paced at `1 / gapMs` packets per ms. */
  | { readonly kind: "aimd"; readonly initialGapMs: number };

export interface SimConfig {
  readonly link: LinkParams;
  readonly pacing: Pacing;
  readonly durationMs: number;
  readonly seed: bigint;
  /** 1 for utilisation/convergence; 2 for the Chiu-Jain fairness experiment. */
  readonly flowCount: number;
  /** Per-flow start time in ms. Staggering is what makes a fairness trajectory legible. */
  readonly flowStartMs: readonly number[];
  /** Sampling interval for the gap / throughput trajectories. */
  readonly sampleMs: number;
  /**
   * Uniform [0, sendPhaseJitterMs) noise added to each next-send instant.
   *
   * Deterministic pacing into a drop-tail queue is exactly the condition Floyd and Jacobson,
   * "On Traffic Phase Effects in Packet-Switched Gateways" (Internetworking 1(1), 1992 - CITED,
   * not page-checked) identify as producing phase-lock artifacts, where one flow is
   * systematically shut out for reasons of arrival phase rather than of control law. Any
   * fairness claim measured at 0 has to be repeated with this above 0, or it is an artifact
   * report rather than a fairness report. `UBL-8` runs both.
   */
  readonly sendPhaseJitterMs: number;
}

export function defaultSim(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    link: defaultLink(),
    pacing: { kind: "aimd", initialGapMs: 10 },
    durationMs: 10000,
    seed: 0x5eedn,
    flowCount: 1,
    flowStartMs: [0],
    sampleMs: 100,
    sendPhaseJitterMs: 0,
    ...overrides,
  };
}

// -- Event loop ---------------------------------------------------------------------------

type EventKind = "send" | "deliver" | "nack";

interface SimEvent {
  readonly time: number;
  /** Monotone insertion counter. The ONLY tie-break - never a wall clock. */
  readonly ord: number;
  readonly kind: EventKind;
  readonly flow: number;
  readonly seq: number;
  /** For `nack`: how many sequence numbers the receiver reported missing. */
  readonly missing: number;
  /** For `deliver`: the one-way delay this packet experienced, carried so it stays exact. */
  readonly owd: number;
}

/** Binary min-heap on (time, ord). Deterministic for any insertion sequence. */
class EventHeap {
  private readonly a: SimEvent[] = [];
  get size(): number {
    return this.a.length;
  }
  push(e: SimEvent): void {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (EventHeap.before(a[i]!, a[p]!)) {
        const t = a[i]!;
        a[i] = a[p]!;
        a[p] = t;
        i = p;
      } else break;
    }
  }
  pop(): SimEvent | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && EventHeap.before(a[l]!, a[m]!)) m = l;
        if (r < a.length && EventHeap.before(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        const t = a[i]!;
        a[i] = a[m]!;
        a[m] = t;
        i = m;
      }
    }
    return top;
  }
  private static before(x: SimEvent, y: SimEvent): boolean {
    return x.time !== y.time ? x.time < y.time : x.ord < y.ord;
  }
}

// -- Results ------------------------------------------------------------------------------

export interface FlowResult {
  readonly flowId: number;
  readonly sent: number;
  readonly delivered: number;
  /** Dropped because the drop-tail buffer was full. The ONLY congestion signal. */
  readonly congestionDrops: number;
  /** Dropped by the Gilbert-Elliott channel process. NOT a congestion signal. */
  readonly corruptionDrops: number;
  /** NACK messages the receiver emitted (one per detected sequence gap). */
  readonly nacksEmitted: number;
  /** Sequence numbers reported missing across all NACKs - what `onNack` is fed. */
  readonly seqsReportedMissing: number;
  /**
   * NACKed sequence numbers that were NOT actually lost - they arrived later, out of order.
   * This is defect 081KZYN3D53087G0R0036XZSYM measured on a link with real delay and jitter.
   */
  readonly spuriousMissingSeqs: number;
  readonly throughputPktPerSec: number;
  readonly meanOwdMs: number;
  readonly p95OwdMs: number;
  /**
   * The inter-packet gap of the controller at the end of the run. In the `open-loop` arm this
   * is the value the shipped code computes and DISCARDS.
   */
  readonly finalGapMs: number;
  readonly minGapMs: number;
  readonly maxGapMs: number;
  /** gapMs sampled every `sampleMs` - the convergence trajectory. */
  readonly gapTrajectory: readonly number[];
  /** Packets delivered in each `sampleMs` bucket - the throughput trajectory. */
  readonly deliveredTrajectory: readonly number[];
}

export interface SimResult {
  readonly config: SimConfig;
  readonly flows: readonly FlowResult[];
  readonly durationMs: number;
  /** Fraction of wall time the link spent transmitting (including doomed corrupt frames). */
  readonly linkUtilisation: number;
  /** Delivered packets / (C x duration). The literal "can we saturate the channel" number. */
  readonly deliveredUtilisation: number;
  /** Time-averaged queue occupancy in packets. Bufferbloat shows up here. */
  readonly meanQueuePackets: number;
  readonly maxQueuePackets: number;
  readonly totalCongestionDrops: number;
  readonly totalCorruptionDrops: number;
  /** The Jain fairness index over per-flow throughput. 1.0 is a perfectly equal share. */
  readonly jainFairness: number;
}

/** Jain, Chiu and Hawe 1984: (sum x)^2 / (n * sum x^2). 1/n for total unfairness, 1 for equal. */
export function jainFairness(x: readonly number[]): number {
  if (x.length === 0) return 0;
  let s = 0;
  let s2 = 0;
  for (const v of x) {
    s += v;
    s2 += v * v;
  }
  return s2 === 0 ? 1 : (s * s) / (x.length * s2);
}

// -- The simulation -----------------------------------------------------------------------

interface FlowState {
  aimd: AimdState;
  nextSeq: number;
  sent: number;
  delivered: number;
  congestionDrops: number;
  corruptionDrops: number;
  nacksEmitted: number;
  seqsReportedMissing: number;
  spuriousMissingSeqs: number;
  expectedSeq: number;
  owdSamples: number[];
  gapTrajectory: number[];
  deliveredTrajectory: number[];
  /** Sequence numbers the channel truly destroyed. Lets a NACK be classified spurious or not. */
  trulyLost: Set<number>;
  minGapMs: number;
  maxGapMs: number;
}

/**
 * Run one scenario over the bandwidth-delay-product link.
 *
 * The queue is D/D/1/B: deterministic service `1000/C` ms, FIFO, drop-tail at `B` packets.
 * Backlog is tracked as the busy-until instant `nextFree` of the link, which makes occupancy
 * exact (`ceil((nextFree - t) / serviceMs)`) instead of sampled, and makes the time-averaged
 * queue an exact integral of a piecewise-linear function rather than an event-sampled estimate.
 *
 * Corruption is applied AFTER queue admission: a corrupt frame still consumes capacity, which
 * is physically right on a radio and is what keeps `linkUtilisation` honest.
 */
export function runLink(cfg: SimConfig): SimResult {
  const { link } = cfg;
  const serviceMs = 1000 / link.capacityPktPerSec;
  const heap = new EventHeap();
  let ord = 0;
  const push = (time: number, kind: EventKind, flow: number, seq: number, missing = 0, owd = 0): void => {
    heap.push({ time, ord: ord++, kind, flow, seq, missing, owd });
  };

  const flows: FlowState[] = Array.from({ length: cfg.flowCount }, () => ({
    aimd: makeAimdState(cfg.pacing.kind === "aimd" ? cfg.pacing.initialGapMs : 10),
    nextSeq: 0,
    sent: 0,
    delivered: 0,
    congestionDrops: 0,
    corruptionDrops: 0,
    nacksEmitted: 0,
    seqsReportedMissing: 0,
    spuriousMissingSeqs: 0,
    expectedSeq: 0,
    owdSamples: [] as number[],
    gapTrajectory: [] as number[],
    deliveredTrajectory: [] as number[],
    trulyLost: new Set<number>(),
    minGapMs: Number.POSITIVE_INFINITY,
    maxGapMs: 0,
  }));

  for (let f = 0; f < cfg.flowCount; f++) {
    const start = cfg.flowStartMs[f] ?? 0;
    if (start < cfg.durationMs) push(start, "send", f, 0);
  }

  // Link state.
  let nextFree = 0; // the link is busy transmitting until this instant
  let linkBusyMs = 0;
  let maxQueuePackets = 0;
  let backlogIntegralMs2 = 0; // integral of backlog(t) dt, backlog measured in ms of work
  let lastEventTime = 0;

  // Gilbert-Elliott corruption chain, advanced per TRANSMISSION (not per send attempt: a packet
  // dropped by the buffer never reaches the wire and must not consume a channel step).
  let geState: "good" | "bad" = "good";
  let txIndex = 0;
  const GE_WARMUP = 512;
  for (let i = 0; i < GE_WARMUP; i++) {
    const u = drawUnit(cfg.seed, LINK_STREAM.corrupt, 2 * i);
    geState =
      geState === "good"
        ? u < link.corruption.pGoodToBad
          ? "bad"
          : "good"
        : u < link.corruption.pBadToGood
          ? "good"
          : "bad";
  }

  const advanceBacklogIntegral = (to: number): void => {
    const t0 = lastEventTime;
    if (to <= t0) return;
    const f0 = Math.max(0, nextFree - t0);
    const f1 = Math.max(0, nextFree - to);
    // backlog(t) = max(0, nextFree - t) is linear with slope -1 until it reaches 0.
    backlogIntegralMs2 += 0.5 * (f0 * f0 - f1 * f1);
    lastEventTime = to;
  };

  // Trajectory sampling.
  const buckets = Math.max(1, Math.ceil(cfg.durationMs / cfg.sampleMs));
  for (const fl of flows) {
    fl.gapTrajectory = new Array<number>(buckets).fill(0);
    fl.deliveredTrajectory = new Array<number>(buckets).fill(0);
  }
  let nextSampleAt = cfg.sampleMs;
  let sampleIdx = 0;
  const sampleUpTo = (t: number): void => {
    while (sampleIdx < buckets && t >= nextSampleAt) {
      for (const fl of flows) fl.gapTrajectory[sampleIdx] = fl.aimd.gapMs;
      sampleIdx++;
      nextSampleAt += cfg.sampleMs;
    }
  };

  for (;;) {
    const ev = heap.pop();
    if (!ev) break;
    if (ev.time > cfg.durationMs) break;
    advanceBacklogIntegral(ev.time);
    sampleUpTo(ev.time);
    const fl = flows[ev.flow]!;

    if (ev.kind === "send") {
      const seq = fl.nextSeq++;
      fl.sent++;

      const backlogMs = Math.max(0, nextFree - ev.time);
      const occupancy = Math.ceil(backlogMs / serviceMs);
      if (occupancy > maxQueuePackets) maxQueuePackets = occupancy;

      if (occupancy >= link.bufferPackets) {
        // CONGESTION drop - the buffer was full. The only loss backing off can relieve.
        fl.congestionDrops++;
        fl.trulyLost.add(seq);
      } else {
        const startService = Math.max(ev.time, nextFree);
        nextFree = startService + serviceMs;
        // Count only the part of the transmission that falls INSIDE the measurement window.
        // A deep buffer admits work near the horizon that is still on the wire when the run
        // ends; charging it in full reports a link utilisation above 1.0, which is a model
        // artifact and not a measurement.
        linkBusyMs += Math.max(0, Math.min(nextFree, cfg.durationMs) - Math.min(startService, cfg.durationMs));

        // Advance the channel chain once per transmitted frame.
        const uT = drawUnit(cfg.seed, LINK_STREAM.corrupt, 2 * (GE_WARMUP + txIndex));
        geState =
          geState === "good"
            ? uT < link.corruption.pGoodToBad
              ? "bad"
              : "good"
            : uT < link.corruption.pBadToGood
              ? "good"
              : "bad";
        const uL = drawUnit(cfg.seed, LINK_STREAM.corrupt, 2 * (GE_WARMUP + txIndex) + 1);
        const corrupted = uL < (geState === "bad" ? link.corruption.lossInBad : link.corruption.lossInGood);
        txIndex++;

        if (corrupted) {
          // CORRUPTION drop - the frame consumed capacity and died on the wire. Backing off
          // relieves nothing here; that asymmetry is the whole subject of this module.
          fl.corruptionDrops++;
          fl.trulyLost.add(seq);
        } else {
          const jitter =
            link.jitterMs > 0 ? drawUnit(cfg.seed, LINK_STREAM.jitter, ev.flow * 1000003 + seq) * link.jitterMs : 0;
          const arriveAt = nextFree + link.owdMs + jitter;
          push(arriveAt, "deliver", ev.flow, seq, 0, arriveAt - ev.time);
        }
      }

      // The estimator runs in BOTH arms - the shipped code calls onSend unconditionally.
      fl.aimd = onSend(fl.aimd);
      if (fl.aimd.gapMs < fl.minGapMs) fl.minGapMs = fl.aimd.gapMs;
      if (fl.aimd.gapMs > fl.maxGapMs) fl.maxGapMs = fl.aimd.gapMs;

      const nextGap = cfg.pacing.kind === "aimd" ? fl.aimd.gapMs : 1000 / cfg.pacing.offeredPktPerSec;
      const phase =
        cfg.sendPhaseJitterMs > 0
          ? drawUnit(cfg.seed, LINK_STREAM.sendPhase, ev.flow * 1000003 + seq) * cfg.sendPhaseJitterMs
          : 0;
      const at = ev.time + nextGap + phase;
      if (at <= cfg.durationMs) push(at, "send", ev.flow, 0);
    } else if (ev.kind === "deliver") {
      fl.delivered++;
      fl.owdSamples.push(ev.owd);
      const bucket = Math.min(buckets - 1, Math.floor(ev.time / cfg.sampleMs));
      fl.deliveredTrajectory[bucket] = (fl.deliveredTrajectory[bucket] ?? 0) + 1;

      // Receiver gap detection, reproduced from `LossyUdpChannel.handleIncoming` (lines 576-606):
      // any seq above `expectedSeq` is declared a gap and every sequence number in it is NACKed.
      // There is no reorder hold-down, which is exactly defect 081KZYN3D53087G0R0036XZSYM.
      if (ev.seq > fl.expectedSeq) {
        const missing = ev.seq - fl.expectedSeq;
        let spurious = 0;
        for (let s = fl.expectedSeq; s < ev.seq; s++) if (!fl.trulyLost.has(s)) spurious++;
        fl.nacksEmitted++;
        fl.seqsReportedMissing += missing;
        fl.spuriousMissingSeqs += spurious;
        // The module states the NACK channel is assumed reliable; it travels back in one D.
        push(ev.time + link.owdMs, "nack", ev.flow, ev.seq, missing);
      }
      fl.expectedSeq = Math.max(fl.expectedSeq, ev.seq + 1);
    } else {
      // The estimator absorbs NACKs in BOTH arms - again, as the shipped code does.
      fl.aimd = onNack(fl.aimd, ev.missing);
      if (fl.aimd.gapMs < fl.minGapMs) fl.minGapMs = fl.aimd.gapMs;
      if (fl.aimd.gapMs > fl.maxGapMs) fl.maxGapMs = fl.aimd.gapMs;
    }
  }

  advanceBacklogIntegral(cfg.durationMs);
  sampleUpTo(cfg.durationMs + cfg.sampleMs);

  const results: FlowResult[] = flows.map((fl, i) => {
    const sorted = fl.owdSamples.slice().sort((a, b) => a - b);
    const mean = sorted.length === 0 ? 0 : sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95 = sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))]!;
    return {
      flowId: i,
      sent: fl.sent,
      delivered: fl.delivered,
      congestionDrops: fl.congestionDrops,
      corruptionDrops: fl.corruptionDrops,
      nacksEmitted: fl.nacksEmitted,
      seqsReportedMissing: fl.seqsReportedMissing,
      spuriousMissingSeqs: fl.spuriousMissingSeqs,
      throughputPktPerSec: (fl.delivered * 1000) / cfg.durationMs,
      meanOwdMs: mean,
      p95OwdMs: p95,
      finalGapMs: fl.aimd.gapMs,
      minGapMs: Number.isFinite(fl.minGapMs) ? fl.minGapMs : fl.aimd.gapMs,
      maxGapMs: fl.maxGapMs,
      gapTrajectory: fl.gapTrajectory,
      deliveredTrajectory: fl.deliveredTrajectory,
    };
  });

  const totalDelivered = results.reduce((a, r) => a + r.delivered, 0);
  const capacityPackets = (link.capacityPktPerSec * cfg.durationMs) / 1000;
  const meanBacklogMs = backlogIntegralMs2 / cfg.durationMs;

  return {
    config: cfg,
    flows: results,
    durationMs: cfg.durationMs,
    linkUtilisation: linkBusyMs / cfg.durationMs,
    deliveredUtilisation: capacityPackets === 0 ? 0 : totalDelivered / capacityPackets,
    meanQueuePackets: meanBacklogMs / serviceMs,
    maxQueuePackets,
    totalCongestionDrops: results.reduce((a, r) => a + r.congestionDrops, 0),
    totalCorruptionDrops: results.reduce((a, r) => a + r.corruptionDrops, 0),
    jainFairness: jainFairness(results.map((r) => r.throughputPktPerSec)),
  };
}

// -- Experiment 1: utilisation ------------------------------------------------------------
//
// "Can we saturate a network channel?" is a TABLE, not a verdict. The deliverable is
// deliveredUtilisation over a grid of (C, D, B) for both arms, and the answer is whatever the
// numbers say at each point.

export type ArmName = "open-loop" | "aimd";

export interface GridPoint {
  readonly capacityPktPerSec: number;
  readonly owdMs: number;
  /** Buffer expressed as a multiple of the bandwidth-delay product. */
  readonly bufferBdpMultiple: number;
}

export interface UtilisationPoint {
  readonly arm: ArmName;
  readonly capacityPktPerSec: number;
  readonly owdMs: number;
  readonly bufferPackets: number;
  readonly bdp: number;
  readonly deliveredUtilisation: number;
  readonly linkUtilisation: number;
  readonly congestionDrops: number;
  readonly corruptionDrops: number;
  readonly meanQueuePackets: number;
  readonly meanOwdMs: number;
  readonly finalGapMs: number;
  readonly nacksEmitted: number;
}

/**
 * Build the config for one grid point. The open-loop arm offers 2x capacity - a greedy
 * application, which is the only honest way to ask whether the link can be filled. The AIMD arm
 * is greedy by construction (it always has data and paces at 1/gapMs).
 */
export function gridConfig(
  arm: ArmName,
  g: GridPoint,
  base: Partial<SimConfig> = {},
  corruption: GilbertElliottParams = burstParams(0, 1),
): SimConfig {
  const bdp = bdpPackets({ capacityPktPerSec: g.capacityPktPerSec, owdMs: g.owdMs });
  const link = defaultLink({
    capacityPktPerSec: g.capacityPktPerSec,
    owdMs: g.owdMs,
    bufferPackets: Math.max(1, Math.round(bdp * g.bufferBdpMultiple)),
    corruption,
  });
  return defaultSim({
    link,
    pacing:
      arm === "open-loop"
        ? { kind: "open-loop", offeredPktPerSec: 2 * g.capacityPktPerSec }
        : { kind: "aimd", initialGapMs: 10 },
    ...base,
  });
}

/**
 * Sweep a (C, D, B) grid for both arms.
 *
 * Concurrency goes through the DoP-knobbed ferry, never through un-knobbed spawn. Each point is
 * a pure function of its config, so DoP is a throughput dial and not a semantics dial - `UBL-4`
 * pins that.
 */
export async function utilisationTable(
  grid: readonly GridPoint[],
  arms: readonly ArmName[] = ["open-loop", "aimd"],
  base: Partial<SimConfig> = {},
  degreeOfParallelism = 1,
  corruption: GilbertElliottParams = burstParams(0, 1),
): Promise<UtilisationPoint[]> {
  const jobs: Array<{ arm: ArmName; g: GridPoint }> = [];
  for (const arm of arms) for (const g of grid) jobs.push({ arm, g });
  return runFerry(jobs, degreeOfParallelism, async (job) => {
    const cfg = gridConfig(job.arm, job.g, base, corruption);
    const res = runLink(cfg);
    const f = res.flows[0]!;
    return {
      arm: job.arm,
      capacityPktPerSec: job.g.capacityPktPerSec,
      owdMs: job.g.owdMs,
      bufferPackets: cfg.link.bufferPackets,
      bdp: bdpPackets(cfg.link),
      deliveredUtilisation: res.deliveredUtilisation,
      linkUtilisation: res.linkUtilisation,
      congestionDrops: res.totalCongestionDrops,
      corruptionDrops: res.totalCorruptionDrops,
      meanQueuePackets: res.meanQueuePackets,
      meanOwdMs: f.meanOwdMs,
      finalGapMs: f.finalGapMs,
      nacksEmitted: f.nacksEmitted,
    };
  });
}

export function formatUtilisationTable(points: readonly UtilisationPoint[]): string {
  const lines: string[] = [];
  lines.push(
    "  arm         C(pkt/s)  D(ms)   B(pkt)   BDP   util   linkBusy   congDrop  corrDrop   meanQ  meanOWD  gapMs",
  );
  for (const p of points) {
    lines.push(
      [
        "  " + p.arm.padEnd(11),
        String(p.capacityPktPerSec).padStart(7),
        String(p.owdMs).padStart(6),
        String(p.bufferPackets).padStart(8),
        p.bdp.toFixed(0).padStart(6),
        p.deliveredUtilisation.toFixed(3).padStart(7),
        p.linkUtilisation.toFixed(3).padStart(10),
        String(p.congestionDrops).padStart(10),
        String(p.corruptionDrops).padStart(9),
        p.meanQueuePackets.toFixed(1).padStart(7),
        p.meanOwdMs.toFixed(1).padStart(8),
        p.finalGapMs.toFixed(0).padStart(6),
      ].join(""),
    );
  }
  return lines.join("\n");
}

// -- Experiment 2: convergence ------------------------------------------------------------
//
// Chiu and Jain 1989 prove AIMD converges to efficiency and fairness UNDER ITS ASSUMPTIONS.
// Two of those assumptions are worth naming here, because this controller meets neither:
//
//   (a) the control variable is the SHARED RESOURCE (a rate or window), and increase is
//       ADDITIVE IN THAT VARIABLE. Here the control variable is a GAP, and rate = 1/gap. A
//       constant -2ms step in gap is NOT a constant +delta step in rate: at gap 500ms it adds
//       0.4% of rate, at gap 10ms it adds 25%. The increase is additive in the wrong space.
//   (b) the feedback is a binary congestion signal. Here the feedback is a NACK, which this
//       transport also emits for corruption loss and for reordering.
//
// So the verdict is a MEASUREMENT of what the gap trajectory does, not a pass/fail against a
// theorem whose preconditions do not hold.

export type GapVerdict = "settled" | "oscillating" | "pinned-max" | "pinned-min" | "drifting";

export interface ConvergenceReport {
  readonly arm: ArmName;
  readonly verdict: GapVerdict;
  readonly finalGapMs: number;
  readonly minGapMs: number;
  readonly maxGapMs: number;
  readonly distinctGapValues: number;
  readonly fractionAtMaxGap: number;
  readonly fractionAtMinGap: number;
  /** Sign changes in the gap trajectory per sample. High means oscillation, not convergence. */
  readonly directionChangesPerSample: number;
  /** Coefficient of variation of the gap over the last quarter of the run. */
  readonly tailCoefficientOfVariation: number;
  readonly deliveredUtilisation: number;
  readonly nacksEmitted: number;
  readonly spuriousMissingSeqs: number;
  readonly gapTrajectory: readonly number[];
}

/** MAX_GAP_MS and MIN_GAP_MS are module-private in the transport; recovered here by observation. */
export const OBSERVED_MAX_GAP_MS = 500;
export const OBSERVED_MIN_GAP_MS = 1;

export function convergenceReport(cfg: SimConfig): ConvergenceReport {
  const res = runLink(cfg);
  const f = res.flows[0]!;
  const traj = f.gapTrajectory;
  const n = traj.length;
  const atMax = traj.filter((g) => g >= OBSERVED_MAX_GAP_MS).length / Math.max(1, n);
  const atMin = traj.filter((g) => g <= OBSERVED_MIN_GAP_MS).length / Math.max(1, n);

  let changes = 0;
  let prevDir = 0;
  for (let i = 1; i < n; i++) {
    const d = Math.sign(traj[i]! - traj[i - 1]!);
    if (d !== 0) {
      if (prevDir !== 0 && d !== prevDir) changes++;
      prevDir = d;
    }
  }
  const tail = traj.slice(Math.floor(0.75 * n));
  const tailMean = tail.length === 0 ? 0 : tail.reduce((a, b) => a + b, 0) / tail.length;
  const tailVar = tail.length === 0 ? 0 : tail.reduce((a, b) => a + (b - tailMean) * (b - tailMean), 0) / tail.length;
  const cv = tailMean === 0 ? 0 : Math.sqrt(tailVar) / tailMean;
  const changesPerSample = changes / Math.max(1, n - 1);

  // The classification rule, stated so it can be argued with rather than trusted.
  const verdict: GapVerdict =
    atMax >= 0.9
      ? "pinned-max"
      : atMin >= 0.9
        ? "pinned-min"
        : changesPerSample >= 0.1
          ? "oscillating"
          : cv <= 0.05
            ? "settled"
            : "drifting";

  return {
    arm: cfg.pacing.kind,
    verdict,
    finalGapMs: f.finalGapMs,
    minGapMs: f.minGapMs,
    maxGapMs: f.maxGapMs,
    distinctGapValues: new Set(traj).size,
    fractionAtMaxGap: atMax,
    fractionAtMinGap: atMin,
    directionChangesPerSample: changesPerSample,
    tailCoefficientOfVariation: cv,
    deliveredUtilisation: res.deliveredUtilisation,
    nacksEmitted: f.nacksEmitted,
    spuriousMissingSeqs: f.spuriousMissingSeqs,
    gapTrajectory: traj,
  };
}

// -- Experiment 3: fairness (the Chiu-Jain phase plot) ------------------------------------

export interface FairnessReport {
  readonly throughputs: readonly number[];
  readonly jainIndex: number;
  readonly equalShareEach: number;
  readonly totalDeliveredUtilisation: number;
  /** (x1, x2) sampled per interval - the Chiu-Jain phase-plot trajectory, as data. */
  readonly phaseTrajectory: ReadonlyArray<readonly [number, number]>;
  readonly congestionDrops: number;
  readonly corruptionDrops: number;
}

/**
 * Two greedy flows on one bottleneck. Chiu and Jain argue AIMD drives the (x1, x2) trajectory
 * onto the fairness line x1 = x2; the phase trajectory returned here is that plot as numbers.
 */
export function fairnessReport(cfg: SimConfig): FairnessReport {
  if (cfg.flowCount < 2) throw new Error("fairnessReport needs flowCount >= 2");
  const res = runLink(cfg);
  const throughputs = res.flows.map((f) => f.throughputPktPerSec);
  const buckets = res.flows[0]!.deliveredTrajectory.length;
  const phase: Array<readonly [number, number]> = [];
  for (let i = 0; i < buckets; i++) {
    const a = (res.flows[0]!.deliveredTrajectory[i] ?? 0) * (1000 / cfg.sampleMs);
    const b = (res.flows[1]!.deliveredTrajectory[i] ?? 0) * (1000 / cfg.sampleMs);
    phase.push([a, b] as const);
  }
  return {
    throughputs,
    jainIndex: res.jainFairness,
    equalShareEach: cfg.link.capacityPktPerSec / cfg.flowCount,
    totalDeliveredUtilisation: res.deliveredUtilisation,
    phaseTrajectory: phase,
    congestionDrops: res.totalCongestionDrops,
    corruptionDrops: res.totalCorruptionDrops,
  };
}

// -- Experiment 4: standing queue / bufferbloat -------------------------------------------
//
// Gettys and Nichols 2011: an oversized drop-tail buffer lets a loss-driven sender fill it, so
// latency inflates while throughput does not improve. The signature is a flat throughput column
// beside a rising delay column.

export interface BufferbloatPoint {
  readonly arm: ArmName;
  readonly bufferBdpMultiple: number;
  readonly bufferPackets: number;
  readonly deliveredUtilisation: number;
  readonly meanOwdMs: number;
  readonly p95OwdMs: number;
  readonly minPossibleOwdMs: number;
  /** meanOwd / minPossibleOwd - the latency tax paid for the buffer. */
  readonly delayInflation: number;
  readonly meanQueuePackets: number;
  readonly congestionDrops: number;
}

export async function bufferbloatSweep(
  arms: readonly ArmName[],
  multiples: readonly number[],
  g: Omit<GridPoint, "bufferBdpMultiple">,
  base: Partial<SimConfig> = {},
  degreeOfParallelism = 1,
): Promise<BufferbloatPoint[]> {
  const jobs: Array<{ arm: ArmName; m: number }> = [];
  for (const arm of arms) for (const m of multiples) jobs.push({ arm, m });
  return runFerry(jobs, degreeOfParallelism, async (job) => {
    const cfg = gridConfig(job.arm, { ...g, bufferBdpMultiple: job.m }, base);
    const res = runLink(cfg);
    const f = res.flows[0]!;
    const minOwd = cfg.link.owdMs + 1000 / cfg.link.capacityPktPerSec;
    return {
      arm: job.arm,
      bufferBdpMultiple: job.m,
      bufferPackets: cfg.link.bufferPackets,
      deliveredUtilisation: res.deliveredUtilisation,
      meanOwdMs: f.meanOwdMs,
      p95OwdMs: f.p95OwdMs,
      minPossibleOwdMs: minOwd,
      delayInflation: minOwd === 0 ? 0 : f.meanOwdMs / minOwd,
      meanQueuePackets: res.meanQueuePackets,
      congestionDrops: res.totalCongestionDrops,
    };
  });
}

export function formatBufferbloat(points: readonly BufferbloatPoint[]): string {
  const lines: string[] = [];
  lines.push("  arm          B/BDP   B(pkt)    util   meanOWD    p95OWD   inflation   meanQ");
  for (const p of points) {
    lines.push(
      [
        "  " + p.arm.padEnd(12),
        p.bufferBdpMultiple.toFixed(2).padStart(6),
        String(p.bufferPackets).padStart(8),
        p.deliveredUtilisation.toFixed(3).padStart(8),
        p.meanOwdMs.toFixed(1).padStart(10),
        p.p95OwdMs.toFixed(1).padStart(10),
        p.delayInflation.toFixed(2).padStart(12),
        p.meanQueuePackets.toFixed(1).padStart(8),
      ].join(""),
    );
  }
  return lines.join("\n");
}

// -- Experiment 5: the decisive one -------------------------------------------------------
//
// Hold CONGESTION AT ZERO and raise CORRUPTION. A controller that responds only to congestion
// is flat across this sweep by definition, because nothing it can do changes the corruption
// rate. Any fall is the controller responding to a signal that is not congestion - the
// Balakrishnan et al. 1997 / BBR 2016 objection, measured on this code.
//
// Zero congestion is arranged structurally, not hoped for: capacity is set above the fastest
// rate the controller can ever produce (1 packet per MIN_GAP_MS = 1000 pkt/s) and the buffer is
// generous, so `congestionDrops` MUST be 0. The caller asserts that rather than assuming it.

export interface CorruptionPoint {
  readonly arm: ArmName;
  readonly targetCorruptionRate: number;
  readonly meanBurstLength: number;
  readonly observedCorruptionRate: number;
  readonly congestionDrops: number;
  readonly throughputPktPerSec: number;
  /** Throughput relative to the same arm at zero corruption. 1.0 means "did not back off". */
  readonly throughputRelativeToClean: number;
  /**
   * The throughput a controller that IGNORED corruption would get: it would keep sending at the
   * clean rate and simply lose that fraction. This is the honest upper reference line.
   */
  readonly idealNonBackoffThroughput: number;
  readonly finalGapMs: number;
  readonly nacksEmitted: number;
  readonly seqsReportedMissing: number;
}

export async function corruptionVsCongestion(
  arms: readonly ArmName[],
  rates: readonly number[],
  meanBurstLength = 1,
  base: Partial<SimConfig> = {},
  degreeOfParallelism = 1,
): Promise<CorruptionPoint[]> {
  // The two arms are matched so that ONLY the pacing rule differs:
  //   C = 4000 pkt/s, B = 4 x BDP, offered = 1000 pkt/s in the open-loop arm - which is exactly
  //   the fastest rate the AIMD arm can ever pace at (MIN_GAP_MS = 1ms).
  // At a quarter of capacity with a 4x-BDP buffer the queue cannot overflow in either arm, so
  // `congestionDrops` is 0 by construction and not by hope. `UBL-9` asserts it.
  const capacity = 4000;
  const owdMs = 20;
  const bufferPackets = Math.max(1, Math.round(4 * bdpPackets({ capacityPktPerSec: capacity, owdMs })));
  const mk = (arm: ArmName, corruption: GilbertElliottParams): SimConfig =>
    defaultSim({
      link: defaultLink({ capacityPktPerSec: capacity, owdMs, bufferPackets, corruption }),
      pacing: arm === "open-loop" ? { kind: "open-loop", offeredPktPerSec: 1000 } : { kind: "aimd", initialGapMs: 1 },
      ...base,
    });

  const clean = new Map<ArmName, number>();
  for (const arm of arms) clean.set(arm, runLink(mk(arm, burstParams(0, 1))).flows[0]!.throughputPktPerSec);

  const jobs: Array<{ arm: ArmName; rate: number }> = [];
  for (const arm of arms) for (const rate of rates) jobs.push({ arm, rate });
  return runFerry(jobs, degreeOfParallelism, async (job) => {
    const res = runLink(mk(job.arm, burstParams(job.rate, meanBurstLength)));
    const f = res.flows[0]!;
    const transmitted = f.sent - f.congestionDrops;
    const cleanRate = clean.get(job.arm) ?? 0;
    return {
      arm: job.arm,
      targetCorruptionRate: job.rate,
      meanBurstLength,
      observedCorruptionRate: transmitted === 0 ? 0 : f.corruptionDrops / transmitted,
      congestionDrops: f.congestionDrops,
      throughputPktPerSec: f.throughputPktPerSec,
      throughputRelativeToClean: cleanRate === 0 ? 0 : f.throughputPktPerSec / cleanRate,
      idealNonBackoffThroughput: cleanRate * (1 - job.rate),
      finalGapMs: f.finalGapMs,
      nacksEmitted: f.nacksEmitted,
      seqsReportedMissing: f.seqsReportedMissing,
    };
  });
}

export function formatCorruptionPlot(points: readonly CorruptionPoint[]): string {
  const lines: string[] = [];
  lines.push("  arm          corrupt  observed  congDrop   thru(pkt/s)   rel   ideal-rel   gapMs   NACKs");
  for (const p of points) {
    const idealRel = p.idealNonBackoffThroughput === 0 ? 0 : 1 - p.targetCorruptionRate;
    lines.push(
      [
        "  " + p.arm.padEnd(12),
        (p.targetCorruptionRate * 100).toFixed(1).padStart(6) + "%",
        (p.observedCorruptionRate * 100).toFixed(1).padStart(8) + "%",
        String(p.congestionDrops).padStart(9),
        p.throughputPktPerSec.toFixed(1).padStart(13),
        p.throughputRelativeToClean.toFixed(3).padStart(7),
        idealRel.toFixed(3).padStart(11),
        p.finalGapMs.toFixed(0).padStart(8),
        String(p.nacksEmitted).padStart(8),
      ].join(""),
    );
  }
  return lines.join("\n");
}

/**
 * The control experiment for the one above: produce the SAME loss rate by CONGESTION instead of
 * corruption, so the two causes can be compared at equal loss. If the controller is a congestion
 * controller, these two columns should look nothing alike.
 */
export function congestionOnly(arm: ArmName, offeredMultiple: number, base: Partial<SimConfig> = {}): SimResult {
  const link = defaultLink({
    capacityPktPerSec: 1000,
    owdMs: 20,
    bufferPackets: Math.max(1, Math.round(bdpPackets({ capacityPktPerSec: 1000, owdMs: 20 }))),
    corruption: burstParams(0, 1),
  });
  return runLink(
    defaultSim({
      link,
      pacing:
        arm === "open-loop"
          ? { kind: "open-loop", offeredPktPerSec: offeredMultiple * 1000 }
          : { kind: "aimd", initialGapMs: 10 },
      ...base,
    }),
  );
}

// -- Experiment 6: recovery from one spurious backoff --------------------------------------
//
// This is the "additive increase in the wrong space" objection made into a number.
//
// The control variable is a GAP, and additive increase subtracts GAP_STEP_MS = 2ms per window
// of LOSS_WINDOW = 64 packets. But each window takes 64 x gap milliseconds to complete, so the
// windows themselves get slower as the gap grows. Starting from MAX_GAP_MS = 500ms on a
// perfectly clean link, the time to walk back to a 1ms gap is
//
//     sum over k of 64 * (500 - 2k) ms, for k = 0 .. 249
//
// which is 64 * 62750 ms - about 67 minutes. That is the cost of ONE spurious multiplicative
// decrease, and a spurious decrease is exactly what a corruption loss or a reordered packet
// produces. `recoveryReport` measures it in the simulator rather than only deriving it.

export interface RecoveryReport {
  readonly startGapMs: number;
  /** Simulated ms until the gap first reaches 10ms. Null if it never did within the run. */
  readonly msToGap10: number | null;
  /** Simulated ms until the gap first reaches MIN_GAP_MS. Null if it never did. */
  readonly msToGapMin: number | null;
  readonly finalGapMs: number;
  readonly packetsSent: number;
  /** The closed form above, for comparison with the measured value. */
  readonly analyticMsToGapMin: number;
}

export function recoveryReport(startGapMs = OBSERVED_MAX_GAP_MS, durationMs?: number): RecoveryReport {
  // The closed form below bounds the run, so the simulation stops shortly after the walk ends
  // instead of spending millions of events pacing at the floor with nothing left to measure.
  const LOSS_WINDOW = 64;
  const GAP_STEP_MS = 2;
  let analytic = 0;
  for (let g = startGapMs; g > OBSERVED_MIN_GAP_MS; g -= GAP_STEP_MS) analytic += LOSS_WINDOW * g;
  const horizonMs = durationMs ?? Math.ceil(analytic * 1.05) + 10000;
  // A clean, fast, deep link: nothing can produce a NACK, so the only dynamics are the additive
  // increase walking the gap back down.
  const link = defaultLink({
    capacityPktPerSec: 4000,
    owdMs: 20,
    bufferPackets: 1000,
    corruption: burstParams(0, 1),
  });
  const cfg = defaultSim({
    link,
    durationMs: horizonMs,
    sampleMs: 1000,
    pacing: { kind: "aimd", initialGapMs: startGapMs },
  });
  const res = runLink(cfg);
  const f = res.flows[0]!;
  let msToGap10: number | null = null;
  let msToGapMin: number | null = null;
  for (let i = 0; i < f.gapTrajectory.length; i++) {
    const g = f.gapTrajectory[i]!;
    if (msToGap10 === null && g <= 10) msToGap10 = (i + 1) * cfg.sampleMs;
    if (msToGapMin === null && g <= OBSERVED_MIN_GAP_MS) msToGapMin = (i + 1) * cfg.sampleMs;
  }
  return {
    startGapMs,
    msToGap10,
    msToGapMin,
    finalGapMs: f.finalGapMs,
    packetsSent: f.sent,
    analyticMsToGapMin: analytic,
  };
}
