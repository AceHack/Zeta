/**
 * udp-lossy-transport.ts — Lossy UDP bidirectional transport with Adinkra [8,4,4] erasure coding.
 *
 * ## Design
 *
 * The core insight (from ferry-25 and the echolocation analogy):
 *   - Your outbound signal is noise to your own inbound channel.
 *   - ECC lets you recover dropped packets without retransmitting (no extra noise).
 *   - The Adinkra [8,4,4] extended Hamming code is the right ECC: doubly-even, self-dual,
 *     minimum distance 4, corrects any 3 erasures per block of 8 packets.
 *   - The same code that generates the E8 lattice (via Construction A) is the transport layer.
 *     That is the homoiconic property: the code IS the algebra IS the transport.
 *
 * ## Protocol
 *
 * ### Erasure coding (Adinkra [8,4,4])
 *   - Every 4 data packets → 4 parity packets (8 total per block).
 *   - Generator matrix G = [I₄ | A] in systematic form (same as AdinkraCode.fs).
 *   - ANY 3 erasures in a block of 8 are recoverable from the remaining 5 — d−1 = 3, and 4
 *     independent symbols determine the block. 56 of the 70 four-erasure patterns recover too;
 *     the 14 that do not are exactly the weight-4 codeword supports (see `recoverAdinkraBlock`).
 *   - Rate: 4/8 = 0.5 (50% overhead).
 *
 * ### Which code to use — MEASURED, and NOT what this header used to say
 *   This file used to offer [8,4,4] as the choice for high-bandwidth UDP and the XOR-only
 *   fallback (rate 7/8) as a low-bandwidth compromise for LoRa/BLE. On GOODPUT — delivered data
 *   packets per WIRE packet, the only fair comparison between codes of different rate — that
 *   guidance is inverted across the entire ordinary operating range, and fixing the decoder
 *   (081KZYN3B79087G0R0014ZKE3C) did not change the ranking, only the crossover point:
 *
 *   RE-MEASURED 2026-08-14 on a corrected instrument (081KZYY6SVJ087G0R0035SW945). The row
 *   below was labelled "uniform" and was not: it ran the harness's `meanBurstLength = 1`
 *   channel, which FORBIDS consecutive loss and is the maximally ANTI-CORRELATED extremum, not
 *   i.i.d. Bernoulli. Both rows are given, because the ranking is the same and the MARGIN is not.
 *
 *   Both rows re-measured together at blocks=3000, seed 0x5eed, so they are comparable to each
 *   other; the anti-correlated row therefore differs from the previously published one in the
 *   third decimal (0.479 -> 0.480, 0.722 -> 0.725, 0.409 -> 0.413) purely on sample size.
 *
 *       loss                0%      5%     10%     20%     30%     40%
 *       [8,4,4]  anti-corr 0.500   0.500   0.500   0.497   0.480   0.388
 *       [8,4,4]  i.i.d.    0.500   0.500   0.499   0.492   0.457   0.387
 *       XOR-7/8  anti-corr 0.875   0.834   0.725   0.413   0.126   0.010
 *       XOR-7/8  i.i.d.    0.875   0.825   0.714   0.445   0.229   0.092
 *
 *   The reason is rate, not capability: at low loss goodput → rate, and 7/8 > 4/8 by
 *   construction, so no decoder can close that gap. Erasure capability only starts paying once
 *   loss is high enough to break the 7/8 code often. Measured crossover (seeded harness):
 *   ~18% anti-correlated / ~19% i.i.d., and ~31% at mean burst length 4. Below it prefer
 *   XOR-7/8 REGARDLESS of bandwidth; above it [8,4,4] wins.
 *
 *   The old "at 40% uniform: 0.388 vs 0.010" is withdrawn. On an i.i.d. channel it is
 *   0.387 vs 0.092 — the XOR code is 9x less dead than the anti-correlated model reported,
 *   because anti-correlation suppresses VARIANCE and a rate-7/8 code lives on the lucky blocks
 *   that variance supplies. The model error is a distortion, not a bias with a fixed sign.
 *   Numbers: `udp-lossy-transport.chaos.test.ts` UCH-13 / UCH-13b / UCH-23.
 *
 * ### Adaptive backoff (AIMD — Additive Increase, Multiplicative Decrease)
 *   - Measure loss BY ATTRIBUTED CAUSE — congestion / corruption / reorder / unknown — never as
 *     one rate. This paragraph read "NACK count / send count over a sliding window" until
 *     2026-08-13; that single number is what made the controller back off on channel corruption
 *     it could not relieve (081KZYQ8KNB087G0R000G8QPRE: 7.1x throughput at 2% corruption, 90x at
 *     10%, with congestion held at zero by construction).
 *   - Only the CONGESTION-SUSPECT share steers the gap (`congestionSuspectRate`). Attributed
 *     reorder and attributed corruption are counted, reported, and never move it.
 *   - If that share > HIGH_LOSS_THRESHOLD: double the gap (multiplicative decrease).
 *   - If it is < LOW_LOSS_THRESHOLD: subtract GAP_STEP from the gap (additive increase).
 *   - A report the receiver later withdraws (`retractLoss` — the sequence number arrived after
 *     all) causes the decision to be RECOMPUTED without it, and reversed if it no longer holds.
 *   - The echolocation analogy still applies, with the correction this defect was about: go quiet
 *     when the channel is SATURATED, not merely when it is noisy. A bat does not stop calling
 *     because the air is turbulent.
 *
 * ### Debounce on gossip re-broadcast
 *   - Anti-entropy re-broadcasts use a random jitter window (50–200ms) to prevent
 *     broadcast storms on WiFi mesh. Same principle as the bat's duty cycle.
 *
 * ### Sequence numbers + NACK
 *   - Each packet has a sequence number. The receiver sends a NACK for any gap it can still
 *     speak to — that is, a gap of at most `MAX_NACK_GAP` (= the receiver's retention window).
 *   - A WIDER gap is reported as a local `DesyncEvent` and nothing is sent. The sequence field
 *     is peer-controlled and unauthenticated, and the NACK is broadcast, so an unbounded
 *     response is a mesh amplification vector (measured at 3,333,337x before this bound).
 *     Beyond the retention window the receiver also has no state to base a claim on.
 *   - NACKs update the loss estimate (not for immediate retransmit — ECC handles that).
 *   - The sender uses NACKs to adjust the inter-packet gap via AIMD.
 *   - A sequence number the receiver reported missing that then ARRIVES is RETRACTED: a second
 *     report with `cause: "reorder"`, carrying the belief being withdrawn. This is the only loss
 *     attribution the transport can make today, and it costs a second broadcast per reordered
 *     packet — the NACK-amplification bound is now 2 messages per in-window gap, not 1 (UCH-16).
 *
 * ## Honest boundary
 *   - The [8,4,4] code corrects any 3 erasures per block, and 56 of the 70 four-erasure
 *     patterns. At 5+ erasures, or on one of the 14 weight-4 codeword supports, the block is
 *     unrecoverable BY ANY DECODER and the receiver marks it lost and moves on.
 *     (This paragraph read "corrects 1 erasure per block; 2+ is unrecoverable" until
 *     2026-08-13. That was the decoder's limit stated as the code's — the defect itself,
 *     documented as a property. Workitem 081KZYN3B79087G0R0014ZKE3C.)
 *   - Erasure decoding still assumes packets arrive intact or not at all, and that assumption is
 *     now ENFORCED rather than merely stated: every frame carries a CRC-32C trailer and a frame
 *     that fails it is discarded before block assembly, so corruption degrades to erasure — the
 *     fault class the code handles. This paragraph read "a corrupt-but-delivered symbol is decoded
 *     as if it were correct … named, not handled" until 2026-08-14; it is handled now
 *     (081KZYP1X3B087G0R001EZ37PQ). The spare check equation inside the decoder is still not
 *     tested, and no longer needs to be for this fault: a corrupt symbol does not reach it.
 *   - The check is a CHECKSUM, NOT a MAC. It detects accidental corruption and nothing an
 *     adversary does. See `encodePacket` for why a MAC is not the increment shipped here, and for
 *     the wire-compatibility direction (new→old works, old→new is rejected as `truncated`).
 *   - It attributes only the corruption that REACHES this receiver. Corruption a lower layer
 *     already discarded (802.11 FCS, LoRa CRC, UDP checksum) still arrives as an absent sequence
 *     number and still lands in `unknown`. The 7.1x/90x throughput loss is recovered exactly in
 *     proportion to how much corruption is delivered rather than destroyed on the wire; that is a
 *     property of the link, and `udp-bdp-link.ts` `deliveredCorruptFraction` is the knob that
 *     makes it a curve instead of a claim.
 *   - For higher erasure rates, use a larger code (e.g. [16,8,4] or [32,16,4]).
 *   - The NACK mechanism assumes the NACK channel itself is reliable (e.g. TCP for NACKs,
 *     UDP for data). If NACKs are also lossy, the loss estimate is noisy but still useful.
 *   - The data path is UNAUTHENTICATED: `envelope.zid` is echo suppression, not identity.
 *     Bounding the NACK caps the amplification, it does not remove it — an in-window gap still
 *     costs a broadcast, measured at 33.6x the inbound packet at the bound. Reducing that
 *     further needs a unicast reply to the peer that revealed the gap, which this transport
 *     interface cannot express (it exposes `broadcast` only). Named, not silently accepted.
 *   - The receiver holds at most `RECV_BLOCK_WINDOW` partially-received blocks, evicting the
 *     least-recently-used. Measured cost: none through a reorder depth of 32 packets (identical
 *     delivery to the unbounded map at 0/10/20/30% loss); real past it (at depth 128, 540 payloads
 *     of 1600 vs 1408); and TOTAL — zero delivery — on a uniform round-robin across 9 blocks, which
 *     is LRU's classical cyclic worst case. That regime is already outside what this receiver
 *     claims: `MAX_NACK_GAP` = 64 packets is the widest gap it will speak about at all. Until
 *     2026-08-14 eviction ran only inside the recovered branch, so blocks that never became
 *     recoverable were retained forever: 200,000 packets retained 200,000 blocks and ~260 MB of
 *     RSS, zero evicted, growing linearly with no ceiling (081KZYQJPNG087G0R002B9E9S1). Unbounded
 *     retention is not a gentler tradeoff than a short window; it is a remote memory exhaustion
 *     any peer can drive at ~3x its own bandwidth.
 *   - The delivered-once guard (§12) OUTLIVES the block it belongs to. `ReceiverBlock.recovered`
 *     lives on the block object, so evicting an already-delivered block used to throw the guard
 *     away and a straggler could re-create the block and deliver the same four payloads again —
 *     measured at 112 duplicate payloads across 28 blocks of 400 at reorder depth 64
 *     (081KZZZGYBR087G0R00302Z2J6, pre-existing at depth 128, reachable at half that depth once the
 *     window was bounded). The receiver now also remembers `DELIVERED_BLOCK_CAP` recent DELIVERIES
 *     as bare identifiers, which is a bound on a different and much cheaper thing than a block.
 *     What is still true: the guard is a WINDOW, not a promise. A duplicate separated from its
 *     original by more than `DELIVERED_BLOCK_CAP` further deliveries is delivered twice, and no
 *     bounded receiver can say otherwise — §12 holds here over the receiver's declared memory,
 *     which is the only span it ever held over.
 *   - Losing more than `MAX_NACK_GAP` consecutive packets produces NO congestion signal. The
 *     single `expectedSeq` is shared across every peer on a broadcast transport, so a wide gap
 *     is not attributable to a sender in the first place; per-peer sequence state is the fix.
 *   - **This transport cannot perceive CONGESTION, and says so in the type.** `LossSignal`'s
 *     `congestion` case requires a `CongestionEvidence` value that nothing can mint here: there is
 *     no timestamp, no ECN bit and no receiver-side queue estimate. The `corruption` case WAS in
 *     the same position and no longer is — `CorruptionEvidence` is minted at the CRC-32C
 *     verification failure in `decodePacket`, and nowhere else. The asymmetry is the honest
 *     summary of this change: one of the two blind causes got an instrument, the other did not.
 *     Unattributed loss keeps the classical backoff, which is the conservative direction: not
 *     backing off on it would be ASSUMING corruption, and that error ends in congestion collapse.
 *
 * ## Connection to the Adinkra physics
 *   - The [8,4,4] code is the concrete Adinkra code from AdinkraCode.fs.
 *   - **N = 8, not 4** (label corrected 2026-08-15). This line previously read "the generator
 *     matrix rows are the 4 SUSY generators of the N=4 Adinkra graph" — two errors in one clause.
 *     N is the code LENGTH (8), not its dimension; and the generator ROWS are a GF(2) basis of the
 *     code, not supercharges. The supercharges are the 8 COORDINATES: the adinkra is `GF(2)^8`
 *     quotiented by this code, giving 16 nodes each of valence 8, one edge colour per `Q_I`, and
 *     `C(8,2) = 28` anticommuting pairs. See `AdinkraCode.supercharges` / `.anticommutingPairs`.
 *   - Nothing in this transport changes: it uses the matrix as a rate-1/2 erasure code over
 *     4 data + 4 parity packets, which is a `k`-side fact and was always correct.
 *   - The parity packets are the "shadow" of the data packets — the joint parity bit
 *     that lives in the pair, not in either half (ferry-25 repair).
 *   - Using this code for UDP means the transport layer and the physics layer share
 *     the same generator. The code IS the algebra IS the transport.
 */

// ── Teaching error integration ────────────────────────────────────────────────────────────
// Imports are conditional: if the error-envelope module is available, we use it.
// If not (e.g. in a browser environment), we fall back to bare NACKs.
// This keeps the transport usable in all environments while rewarding teaching-capable peers.
import type { ErrorEnvelope } from "../protocol/error-envelope";
import type { DimensionalBnn } from "../planning/error-bnn-bridge";
import { crc32c } from "../crc32c/crc32c";

// ── [8,4,4] Adinkra generator matrix (same as AdinkraCode.fs) ─────────────────────────────
// Generator matrix G = [I₄ | A] in systematic form, over GF(2).
// Four rows (data packets), eight columns (data + parity positions).
// Each row is a weight-4 codeword. The concrete Adinkra generator.
const ADINKRA_G: readonly (readonly number[])[] = [
  [1, 0, 0, 0, 0, 1, 1, 1],
  [0, 1, 0, 0, 1, 0, 1, 1],
  [0, 0, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 1, 1, 1, 0],
] as const;

// Block size: 4 data + 4 parity = 8 packets per block
const BLOCK_DATA = 4;
const BLOCK_TOTAL = 8;

/** Block address implied by `seq`. Honest senders already set
 *  `blockSeq = floor(seq/8)` and `blockPos = seq%8`; the receiver must
 *  DERIVE those rather than trust the independent wire fields
 *  (081KZZZH24H087G0R002TXQA15). */
export function blockAddressOf(seq: number): { readonly blockSeq: number; readonly blockPos: number } {
  return { blockSeq: Math.floor(seq / BLOCK_TOTAL), blockPos: seq % BLOCK_TOTAL };
}

// AIMD parameters
const HIGH_LOSS_THRESHOLD = 0.05; // 5% loss → back off
const LOW_LOSS_THRESHOLD = 0.01; // 1% loss → speed up
const GAP_STEP_MS = 2; // additive increase step (ms)
const MIN_GAP_MS = 1; // minimum inter-packet gap (ms)
const MAX_GAP_MS = 500; // maximum inter-packet gap (ms, ~2 pkt/s floor)
const LOSS_WINDOW = 64; // sliding window for loss estimation (packets)

// Gossip debounce jitter window (ms)
const JITTER_MIN_MS = 50;
const JITTER_MAX_MS = 200;

// ── Receiver retention window, and the NACK gap bound derived from it ─────────────────────
/** How many blocks the receiver retains before evicting (see `handleIncoming` cleanup).
 *  Was a bare `8` inline; named here because MAX_NACK_GAP is derived from it, and a
 *  derivation that points at a literal is two magic numbers agreeing by luck.
 *
 *  EXPORTED (2026-08-14) because it is now a hard cap on `recvBlocks.size`
 *  (081KZYQJPNG087G0R002B9E9S1) rather than a best-effort cleanup, and a test that pinned that cap
 *  against a literal `8` would be a third copy of the same number free to drift from both. */
export const RECV_BLOCK_WINDOW = 8;

/** The widest sequence gap the receiver can still say anything true about.
 *
 *  DERIVATION (not a chosen constant): the receiver holds `RECV_BLOCK_WINDOW` blocks of
 *  `BLOCK_TOTAL` packets. A packet older than that has been evicted, so it can neither be
 *  recovered by the [8,4,4] code nor placed in a retained block — the receiver has no state
 *  about it and nothing it reports about it is a measurement. `LOSS_WINDOW` arrives at the
 *  same 64 independently: the AIMD estimator divides NACKs by at most `LOSS_WINDOW` sends,
 *  so a single gap wider than that yields `lossRate > 1`, which is not a rate.
 *
 *  Both derivations are of the *receiver's own memory*, which is the only thing that bounds
 *  what it may honestly claim. If either constant moves, this moves with it. */
export const MAX_NACK_GAP = RECV_BLOCK_WINDOW * BLOCK_TOTAL;

/** How many DELIVERED block identifiers the receiver remembers after the blocks themselves are gone.
 *
 *  DERIVATION (not a chosen constant), and the factor of 2 is the whole point: a retained block is
 *  eight payload references, a delivered-block identifier is one integer, so the two bounds answer
 *  different questions and must not be the same number. The precedent is already in this file —
 *  `SUSPECT_SEQ_CAP = 2 * MAX_NACK_GAP` keeps a WIDER window of the cheaper item (a sequence
 *  number) than the state it refers to. This is that construction one level up:
 *
 *      RECV_BLOCK_WINDOW          blocks retained          (8 payloads each)
 *      2 * RECV_BLOCK_WINDOW      deliveries remembered    (1 integer each)
 *
 *  Equivalently `2 * MAX_NACK_GAP / BLOCK_TOTAL` — the same width `SUSPECT_SEQ_CAP` uses, counted
 *  in blocks instead of packets, because that is the unit a delivery happens in. If
 *  `RECV_BLOCK_WINDOW` moves, both move with it.
 *
 *  WHY 2 AND NOT 1 — measured, and it is the smallest multiple that holds. Over 144 seeded
 *  configurations (8 seeds x depths {32,64,96,128,192,256} x loss {0, 5%, 15%}, 200 blocks each,
 *  `udp-lossy-transport.reorder-sweep.ts`):
 *
 *      1 * RECV_BLOCK_WINDOW  (8)    156 duplicate payloads   <- the guard dies with its own block
 *      2 * RECV_BLOCK_WINDOW  (16)     0
 *      3 * RECV_BLOCK_WINDOW  (24)     0
 *
 *  At the width of the block window itself the guard is evicted at roughly the moment the block it
 *  guards for is, so it buys almost nothing: the surviving duplicates are concentrated at reorder
 *  depths (96, 128) where a straggler outlives eight further deliveries. 3x buys nothing over 2x,
 *  so 2x is not a safety margin picked upward — it is where the measurement flattens. */
export const DELIVERED_BLOCK_CAP = 2 * RECV_BLOCK_WINDOW;

// ── GF(2) arithmetic ──────────────────────────────────────────────────────────────────────

/** XOR two equal-length byte arrays in-place (a ⊕= b). */
function xorBytes(a: Uint8Array, b: Uint8Array): void {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) a[i] = a[i]! ^ b[i]!;
}

/** Compute the 4 parity packets for a block of 4 data packets using the Adinkra generator.
 *  Each parity packet p_j = XOR of data packets d_i where G[i][4+j] = 1.
 *  The parity column indices are columns 4,5,6,7 of the generator matrix.
 */
export function computeAdinkraParity(data: readonly Uint8Array[]): Uint8Array[] {
  const len = data[0]!.length;
  const parity: Uint8Array[] = Array.from({ length: BLOCK_DATA }, () => new Uint8Array(len));
  for (let i = 0; i < BLOCK_DATA; i++) {
    for (let j = 0; j < BLOCK_DATA; j++) {
      if (ADINKRA_G[i]![4 + j] === 1) {
        xorBytes(parity[j]!, data[i]!);
      }
    }
  }
  return parity;
}

// ── [8,4,4] parity-check matrix, DERIVED from the generator ───────────────────────────────
/**
 * `H = [Aᵀ | I₄]`, the parity-check matrix of the systematic code `G = [I₄ | A]`.
 *
 * `ADINKRA_H[j][i] === 1` iff codeword position `i` takes part in parity check `j`:
 *
 *     check j:   XOR{ d_i : G[i][4+j] = 1 }   XOR   p_j   =   0
 *
 * It is COMPUTED from `ADINKRA_G` rather than written out a second time. A literal copy is
 * free to drift from the generator on any edit; a derivation cannot.
 *
 * UNOBSERVABLE MUTANT, recorded rather than chased: transposing this construction
 * (`ADINKRA_G[j][4+i]` instead of `ADINKRA_G[i][4+j]`) leaves the whole suite green, because
 * `A` is symmetric for THIS code so `Aᵀ = A`. No test can distinguish the two, and none should
 * be contrived to — the transpose is what the algebra calls for, the symmetry is a property of
 * the Adinkra generator, and if that generator is ever replaced by an asymmetric one the
 * distinction becomes observable and every erasure test starts failing at once.
 */
const ADINKRA_H: readonly (readonly number[])[] = Array.from({ length: BLOCK_DATA }, (_, j) => {
  const row = new Array<number>(BLOCK_TOTAL).fill(0);
  for (let i = 0; i < BLOCK_DATA; i++) row[i] = ADINKRA_G[i]![BLOCK_DATA + j]!;
  row[BLOCK_DATA + j] = 1;
  return row;
});

/**
 * Erasure-decode one block of 8, recovering EVERY erased position at once.
 *
 * ## What the code can actually do
 *
 * A linear code of minimum distance `d` corrects **any `d−1` erasures**: two distinct
 * codewords agreeing on the `n−(d−1)` surviving positions would differ in at most `d−1 < d`
 * positions, contradicting the minimum distance. `[8,4,4]` has `d = 4`, so **any 3 erasures
 * per block are recoverable**, plus every 4-erasure pattern whose erased set is not the
 * support of a nonzero codeword (56 of the 70 four-subsets; the other 14 are the weight-4
 * codewords and are genuinely undecodable by any decoder).
 *
 * ## How
 *
 * Erasure decoding is a linear solve, not a special case per position. Let `E` be the erased
 * positions and `K` the received ones. Each check `j` gives
 *
 *     XOR{ c_e : e ∈ E, H[j][e] = 1 }  =  XOR{ c_i : i ∈ K, H[j][i] = 1 }  =:  s_j
 *
 * — a system of 4 equations over GF(2) in `|E|` unknowns whose right-hand sides are byte
 * vectors (GF(2) acts on bytes as XOR, so the same elimination runs on whole packets).
 * Gauss–Jordan on that system returns the unique solution when the erased columns of `H` are
 * linearly independent, and `null` when they are not — and "not independent" is exactly
 * "the erased set contains the support of a nonzero codeword", i.e. the code's own limit
 * rather than the decoder's.
 *
 * Returns the 8 codeword positions with the erasures filled in, or `null` if the pattern is
 * undecodable (or if nothing was received). Deterministic: fixed column order, fixed pivot
 * search, no allocation keyed on anything but block length (§7 DST).
 *
 * NOT attempted here, and named so it is not mistaken for a guarantee: with fewer than 4
 * erasures the system is over-determined, so a leftover check equation could DETECT symbol
 * corruption. This decoder assumes the erasure channel (UDP checksums drop corrupt datagrams
 * rather than delivering them) and does not test that residual. Adding it would reject blocks
 * this one accepts, which is a separate behaviour change.
 */
export function recoverAdinkraBlock(block: readonly (Uint8Array | null)[]): Uint8Array[] | null {
  if (block.length !== BLOCK_TOTAL) return null;

  const erased: number[] = [];
  let len = 0;
  for (let i = 0; i < BLOCK_TOTAL; i++) {
    const sym = block[i];
    if (sym === null || sym === undefined) erased.push(i);
    else if (sym.length > len) len = sym.length;
  }
  if (erased.length === 0) return block.slice() as Uint8Array[];

  // Left-hand side: the erased columns of H. Right-hand side: the syndrome of what arrived.
  const coef: number[][] = [];
  const rhs: Uint8Array[] = [];
  for (let j = 0; j < BLOCK_DATA; j++) {
    const s = new Uint8Array(len);
    for (let i = 0; i < BLOCK_TOTAL; i++) {
      if (ADINKRA_H[j]![i] === 1) {
        const sym = block[i];
        if (sym) xorBytes(s, sym);
      }
    }
    coef.push(erased.map((e) => ADINKRA_H[j]![e]!));
    rhs.push(s);
  }

  // Gauss–Jordan over GF(2). Row ops are XOR on both the coefficient row and its byte-vector
  // right-hand side, so the packets ride along with the elimination.
  //
  // Column `c`'s pivot lands on ROW `c`: a column without a pivot returns immediately, so no
  // column is ever skipped and the rank equals the column index throughout. A separate `rank`
  // counter and a `pivotRow` lookup were carried here at first and mutation testing found both
  // unobservable — `pivotRow[c] === c` on every path — so they are gone. That also removes the
  // need for a "more erasures than checks" pre-check: with 5+ unknowns some column finds no
  // pivot among the 4 rows and the same return fires. One rejection path, not three.
  for (let c = 0; c < erased.length; c++) {
    let pivot = -1;
    for (let j = c; j < BLOCK_DATA; j++) {
      if (coef[j]![c] === 1) {
        pivot = j;
        break;
      }
    }
    // No pivot ⇒ the erased columns of H are dependent ⇒ several codewords fit the survivors.
    // Undecodable by ANY decoder, not a limit of this one.
    if (pivot === -1) return null;
    if (pivot !== c) {
      const tmpCoef = coef[pivot]!;
      coef[pivot] = coef[c]!;
      coef[c] = tmpCoef;
      const tmpRhs = rhs[pivot]!;
      rhs[pivot] = rhs[c]!;
      rhs[c] = tmpRhs;
    }
    for (let j = 0; j < BLOCK_DATA; j++) {
      if (j !== c && coef[j]![c] === 1) {
        for (let cc = 0; cc < erased.length; cc++) coef[j]![cc] = coef[j]![cc]! ^ coef[c]![cc]!;
        xorBytes(rhs[j]!, rhs[c]!);
      }
    }
  }

  const out = block.slice() as (Uint8Array | null)[];
  for (let c = 0; c < erased.length; c++) out[erased[c]!] = rhs[c]!;
  return out as Uint8Array[];
}

/** Recover the FIRST erased packet in a block of 8.
 *
 *  A thin projection of `recoverAdinkraBlock`: decode the whole block, hand back the symbol at
 *  the lowest erased index. Returns null when there is no erasure, or when the pattern is
 *  undecodable (5+ erasures, or one of the 14 weight-4 codeword supports).
 *
 *  Callers that need more than one erased packet should call `recoverAdinkraBlock` directly —
 *  this signature can only express one, which is what previously made the decoder look like
 *  a 1-erasure code (081KZYN3B79087G0R0014ZKE3C).
 */
export function recoverAdinkraErasure(
  block: (Uint8Array | null)[], // length 8, nulls = erased
): Uint8Array | null {
  if (block.length !== BLOCK_TOTAL) return null;
  const erasedIdx = block.findIndex((p) => p === null);
  if (erasedIdx === -1) return null; // no erasure
  const full = recoverAdinkraBlock(block);
  return full === null ? null : full[erasedIdx]!;
}

// ── Packet framing, and the integrity check ───────────────────────────────────────────────
//
// CHECKSUM, NOT A MAC — and the label is the load-bearing part (081KZYP1X3B087G0R001EZ37PQ).
//
// A CRC detects ACCIDENTAL corruption. It detects nothing an adversary does, because an
// adversary recomputes it: the polynomial is public, the frame is unauthenticated, and there is
// no key anywhere in this transport. Every use of the word "integrity" in this module means
// "the bytes are self-consistent", never "the bytes came from who they claim".
//
// WHY NOT A MAC, stated so the omission is a decision rather than a gap. A MAC needs a shared
// secret and this is a BROADCAST transport with no session, no key agreement and no group key:
// `myZid` is a self-asserted string used for echo suppression. The repo's existing authenticity
// membrane (`beacon-auth.ts`) is Ed25519 SIGNATURES over an injected trust store — 64 bytes and
// an asymmetric verify per message, which is right for the low-rate discovery vocabulary and
// wrong for every packet of an 8-packet ECC block on a LoRa-class link. Authentication also
// belongs on the CONTROL channel, where the actual lever is (a peer can fabricate NACKs), and a
// per-packet data-path CRC does not move that lever one inch. So: CRC now, labelled; the MAC is
// a separate membrane in front of the NACK path, and it is not this work-item.
//
// Anchors (Beacon): Castagnoli, Bräuer & Herrmann, "Optimization of Cyclic Redundancy-Check
// Codes with 24 and 32 Parity Bits" (IEEE Trans. Comm. 41(6), 1993 — CITED, not page-checked)
// for CRC-32C itself; Koopman, "32-Bit Cyclic Redundancy Codes for Internet Applications"
// (DSN 2002 — CITED) for why polynomial choice is a Hamming-distance argument and not taste;
// Stone & Partridge, "When the CRC and TCP Checksum Disagree" (SIGCOMM 2000 — CITED) for why an
// end-to-end check is worth its bytes even under a link layer that already has one: their
// measured residual-error rate is dominated by hardware and software faults between the link
// checks, which no link check can see.
//
// The implementation is NOT a second CRC. It is `src/Core.TypeScript/crc32c/crc32c.ts` — the
// existing 4-oracle byte-locked primitive (C#/F#/Rust/TS agree on `golden-vectors.json`), so
// this transport joins the existing proof lineage instead of minting a rival checksum that is
// free to drift from it.

/** Fixed header bytes preceding the payload. */
export const PACKET_HEADER_BYTES = 16;
/** CRC-32C trailer bytes following the payload. See `encodePacket` for why it is a TRAILER. */
export const PACKET_CHECKSUM_BYTES = 4;

export interface LossyPacketHeader {
  readonly seq: number; // global sequence number (monotone)
  readonly blockSeq: number; // block sequence number (seq / BLOCK_TOTAL)
  readonly blockPos: number; // position within block (0..7)
  readonly isData: boolean; // true = data packet (pos 0..3), false = parity (pos 4..7)
  readonly payloadLen: number;
}

/**
 * Encode a packet header + payload + CRC-32C trailer into a single Buffer.
 *
 * WIRE-FORMAT CHANGE, and the compatibility is ONE-WAY — stated plainly because a wire change
 * that only says "added a field" has not said the part that matters:
 *
 *   - **new sender → OLD receiver: WORKS.** The old `decodePacket` reads `payloadLen` from the
 *     header and slices `[16, 16+payloadLen)`; it checked `buf.length < 16 + payloadLen`, which
 *     TOLERATES trailing bytes. The 4-byte trailer lands past the payload and is ignored. An old
 *     peer therefore keeps decoding new frames correctly and unaware — it simply gets no check.
 *   - **old sender → NEW receiver: REJECTED, loudly, as `truncated`.** An old frame is exactly
 *     `16 + payloadLen` bytes, so the trailer is missing and the length test fails. It is
 *     reported as a FRAMING failure and explicitly NOT as corruption: a version skew that
 *     masqueraded as channel corruption would suppress a peer's backoff for the entire duration
 *     of a rollout, which is the worst possible way to learn that two peers disagree about a
 *     wire format.
 *
 * The trailer position is what buys the working direction. A checksum placed INSIDE the header
 * (there are 2 spare padding bytes at offset 14) or appended to a grown 20-byte header would
 * make an old receiver mis-slice the payload and deliver silently-wrong bytes — trading a loud
 * failure for exactly the silent one this work-item exists to remove. There is no fully
 * backward-compatible option, because the format carries no version field; the choice available
 * was WHICH direction fails and HOW, and it was made for fail-closed and loud.
 *
 * The CRC covers the header as well as the payload. That is deliberate: a corrupted `blockPos`
 * writes a good symbol into the wrong slot of the erasure block, and a corrupted `payloadLen`
 * mis-frames everything after it — both are corruptions the decoder would happily consume.
 */
export function encodePacket(header: LossyPacketHeader, payload: Uint8Array): Buffer {
  const framed = Buffer.alloc(PACKET_HEADER_BYTES + payload.length + PACKET_CHECKSUM_BYTES);
  framed.writeUInt32BE(header.seq, 0);
  framed.writeUInt32BE(header.blockSeq, 4);
  framed.writeUInt8(header.blockPos, 8);
  framed.writeUInt8(header.isData ? 1 : 0, 9);
  framed.writeUInt32BE(header.payloadLen, 10);
  // bytes 14..16 are reserved and MUST stay zero — they are inside the checksummed region.
  framed.set(payload, PACKET_HEADER_BYTES);
  const end = PACKET_HEADER_BYTES + payload.length;
  framed.writeUInt32BE(crc32c(framed.subarray(0, end)), end);
  return framed;
}

/**
 * Why a frame was refused. The three cases are kept apart because they license different
 * conclusions, and collapsing them is how a rollout skew becomes a fake corruption measurement.
 *
 *   - `short` / `truncated` — FRAMING. The buffer cannot hold what its own header says it holds.
 *     Says nothing about the channel: an old peer, a truncating relay and a mangled frame all
 *     land here. Never attributed to corruption.
 *   - `checksum` — the frame is complete and its bytes disagree with its own CRC-32C. THIS is
 *     the corruption observation, and it is the only one that carries evidence.
 */
export type PacketRejectReason = "short" | "truncated" | "checksum";

export type PacketDecode =
  | { readonly ok: true; readonly header: LossyPacketHeader; readonly payload: Uint8Array }
  | { readonly ok: false; readonly reason: "short" | "truncated" }
  | { readonly ok: false; readonly reason: "checksum"; readonly evidence: CorruptionEvidence };

/**
 * Decode and VERIFY a packet. A frame whose CRC-32C does not match its bytes is refused — it
 * never reaches `addToBlock`, so corruption degrades to erasure, which is the fault class the
 * [8,4,4] code actually handles.
 *
 * That degradation is the whole defect being closed. Before this check, one flipped bit in a
 * PARITY packet — a packet the application never sees and would not have missed — plus one
 * ordinary erasure made `recoverAdinkraBlock` return non-null WRONG bytes in a DATA packet, with
 * no error signal anywhere. Erasure recovery moved corruption out of redundancy the application
 * never sees and into payload it does.
 *
 * Note the check is per-FRAME, not per-block: it rejects a frame whose own bytes are internally
 * inconsistent, and it never inspects the block. So it cannot refuse a block the decoder could
 * legitimately solve (#10496, all 3 erasures via Gauss–Jordan) — a refused frame is simply one
 * more erasure, and the solve is attempted from the 4th arrival exactly as before.
 *
 * Aliasing note, unchanged and pre-existing: `payload` is a VIEW into `buf`. The CRC was verified
 * over `buf` at this instant, so a caller that mutates `buf` afterwards invalidates a check that
 * has already passed. `handleIncoming` copies before storing.
 */
export function decodePacket(buf: Buffer): PacketDecode {
  if (buf.length < PACKET_HEADER_BYTES + PACKET_CHECKSUM_BYTES) return { ok: false, reason: "short" };
  const payloadLen = buf.readUInt32BE(10);
  const end = PACKET_HEADER_BYTES + payloadLen;
  if (buf.length < end + PACKET_CHECKSUM_BYTES) return { ok: false, reason: "truncated" };
  const claimed = buf.readUInt32BE(end);
  const actual = crc32c(buf.subarray(0, end));
  if (claimed !== actual) {
    return {
      ok: false,
      reason: "checksum",
      evidence: mintCorruptionEvidence(`crc32c mismatch: claimed ${claimed}, computed ${actual}, ${end} bytes`),
    };
  }
  return {
    ok: true,
    header: {
      seq: buf.readUInt32BE(0),
      blockSeq: buf.readUInt32BE(4),
      blockPos: buf.readUInt8(8),
      isData: buf.readUInt8(9) === 1,
      payloadLen,
    },
    payload: new Uint8Array(buf.buffer, buf.byteOffset + PACKET_HEADER_BYTES, payloadLen),
  };
}

// ── The loss signal: a cause that travels with the loss ───────────────────────────────────
//
// WHY THIS IS A TYPE AND NOT A FLOAT (081KZYQ8KNB087G0R000G8QPRE, P1).
//
// This module used to fold every reported-missing packet into one `nackCount`, divide it by
// `sentCount`, and threshold the quotient. Measured consequence, with congestion held at ZERO
// **by construction** (`udp-bdp-link.ts` `corruptionVsCongestion`, `UBL-10`): at 2% channel
// corruption the paced controller delivered **7.1x less** than a sender that ignored the loss,
// and at 10% it delivered **90x less**. The same defect through a second door (`UBL-11`): 5ms of
// delivery jitter, ZERO packets lost, paced throughput 838.9 -> 70.6 pkt/s.
//
// No threshold repairs that, and the reason is worth stating exactly: 5% corruption and 5%
// congestion produce the SAME value of `nackCount / sentCount`. RFC 4653, "Improving the
// Robustness of TCP to Non-Congestion Events" (Bhandarkar, Sadry, Reddy, Vaidya, 2006 - CITED,
// not page-checked) names the class and states the identity outright: a delayed segment and a
// dropped segment "play out in precisely the same manner". A bare scalar is where that
// distinction goes to die, so the fix is to REMOVE the aggregate rather than annotate it -
// `nackCount` and `lossRate` are gone from this module, not deprecated beside a replacement.
//
// Same rung-1 move as `BoundJustification` (#10461): a magnitude that cannot say why it is
// believed does not get to exist.

/** The cause of a missing packet. Four cases, and `unknown` is first-class - see `LossSignal`. */
export type LossCause = "congestion" | "corruption" | "reorder" | "unknown";

/** Every cause, in a fixed order. Iteration order is part of the DST contract, so it is declared
 *  once here rather than taken from `Object.keys`, which is insertion-ordered and easy to perturb. */
export const LOSS_CAUSES: readonly LossCause[] = ["congestion", "corruption", "reorder", "unknown"] as const;

declare const CONGESTION_EVIDENCE: unique symbol;

/** The corruption brand, now a REAL runtime symbol rather than a `declare const`.
 *
 *  It is not exported, so `CorruptionEvidence` remains unforgeable outside this module — but it
 *  now EXISTS, which is the difference an integrity check makes. `mintCorruptionEvidence` below
 *  is the only thing that can name it, and it is not exported either. */
const CORRUPTION_EVIDENCE: unique symbol = Symbol("zeta.transport.corruption-evidence");

/**
 * Evidence that a loss was a full queue: an explicit congestion notification, a standing-queue
 * estimate, or a delay signal of the kind Vegas and BBR are built on.
 *
 * **NOT CONSTRUCTIBLE TODAY, and that is the finding rather than an oversight.** The brand key is
 * an unexported `unique symbol`, so no module - including this one, without a deliberate cast -
 * can mint one. This transport carries no timestamp, no ECN bit and no receiver-side queue
 * estimate, so a queue drop and a wire corruption reach the receiver as *the same event*: an
 * absent sequence number. Whoever adds that signal adds the minting function beside it, and the
 * `congestion` case of `LossSignal` becomes reachable at that moment and not before.
 */
export interface CongestionEvidence {
  readonly [CONGESTION_EVIDENCE]: true;
  readonly source: string;
}

/**
 * Evidence that a frame was corrupted: a checksum that rejected it.
 *
 * **CONSTRUCTIBLE SINCE 081KZYP1X3B087G0R001EZ37PQ, and only one way.** The sole minting
 * function is `mintCorruptionEvidence`, its sole caller is the CRC-32C verification failure in
 * `decodePacket`, and neither is exported. So a value of this type is not an assertion that
 * corruption occurred — it is a record that THIS receiver ran a check on bytes it held and the
 * check failed. That is the strongest claim available and it is deliberately narrow:
 *
 *   - it is LOCAL. It says nothing about a peer's claim that its loss was corruption; see
 *     `retractLoss`, where a wire-borne corruption report is handled as a RE-ATTRIBUTION of the
 *     reporter's own earlier report and needs no evidence value at all, precisely because the
 *     sender verified nothing.
 *   - it is ACCIDENTAL-corruption evidence. A CRC an adversary recomputed matches. `source`
 *     records what the check saw, never who sent it.
 *
 * `CongestionEvidence` is deliberately NOT promoted alongside it, and the asymmetry is the
 * finding: this change gave the receiver an instrument for one of the two blind causes and not
 * the other. There is still no timestamp, no ECN bit and no queue estimate here.
 */
export interface CorruptionEvidence {
  readonly [CORRUPTION_EVIDENCE]: true;
  readonly source: string;
}

/** The ONLY constructor of `CorruptionEvidence`. Not exported; its only caller is the
 *  checksum-verification failure branch of `decodePacket`. Adding a second caller is the moment
 *  this type stops meaning "a check ran and failed here", so `ULT-31` pins the caller count. */
function mintCorruptionEvidence(source: string): CorruptionEvidence {
  return { [CORRUPTION_EVIDENCE]: true, source };
}

/**
 * A loss report, with its cause attached — the typed replacement for a bare rate.
 *
 * What can be attributed HONESTLY, and by what:
 *
 *   - `reorder`   — a sequence number the receiver REPORTED missing that then ARRIVED. The
 *                   receiver observes this directly, and it is the one RFC 4653 is about.
 *   - `corruption` — a frame ARRIVED and failed its CRC-32C (`CorruptionEvidence`, minted only at
 *                   that verification failure). Available since 081KZYP1X3B087G0R001EZ37PQ, and
 *                   available ONLY for corruption that reaches the receiver — see the honest
 *                   boundary below, which is the difference between closing this door and
 *                   claiming to have closed it.
 *   - `congestion` — needs a queue or delay signal (`CongestionEvidence`). Still not available.
 *   - `unknown`   — an erasure whose cause the receiver cannot see. **A first-class case, not a
 *                   dumping ground:** it is the honest name for what is left of {congestion,
 *                   corruption} after the integrity check has taken the share it can see.
 *
 * HONEST BOUNDARY ON THE CORRUPTION CASE, because the obvious overclaim is one sentence away.
 * An application-layer check attributes exactly the corruption that SURVIVES TO THE APPLICATION.
 * Corruption a lower layer already discarded — an 802.11 FCS, a LoRa CRC, a UDP checksum — never
 * reaches this code and arrives as an absent sequence number, indistinguishable from a queue
 * drop, exactly as before. So this change splits the corruption class in two and closes one half:
 *
 *   delivered-corrupt  → detected, discarded, attributed, and no longer amplified.  CLOSED.
 *   dropped-on-the-wire → still an erasure, still `unknown`, still backs off.        OPEN.
 *
 * Which half dominates is a property of the LINK, not of this code, so the honest report is a
 * curve over that split rather than a single number: `udp-bdp-link.ts` `deliveredCorruptFraction`
 * is the knob, `UBL-13` is the measurement.
 *
 * SECURITY. The data path is UNAUTHENTICATED (see "Honest boundary"), so a peer can claim
 * `reorder` — and now `corruption` — and suppress a sender's backoff. That is the same hole and
 * NOT a new one, for a reason worth stating exactly: a receiver that wants to suppress a sender's
 * backoff can simply STAY SILENT and emit no NACK at all, which is cheaper and strictly more
 * effective than any claim. Believing an attribution therefore grants an adversary nothing
 * withholding did not already grant. The asymmetric direction — FABRICATING NACKs to *cause*
 * backoff — is the real hole, it is untouched here, and authenticating the control channel is
 * what closes it. A per-packet CRC is not that; see `encodePacket`.
 */
export type LossSignal =
  | { readonly cause: "unknown"; readonly seqs: readonly number[] }
  | { readonly cause: "reorder"; readonly seqs: readonly number[] }
  | { readonly cause: "corruption"; readonly seqs: readonly number[]; readonly evidence: CorruptionEvidence }
  | { readonly cause: "congestion"; readonly seqs: readonly number[]; readonly evidence: CongestionEvidence };

/** One cause's share of the current estimation window. The plural of this IS the fix: `lossRates`
 *  returns one row per cause where `lossRate` returned a single number that had forgotten. */
export interface LossRate {
  readonly cause: LossCause;
  /** Packets attributed to this cause in the current window. */
  readonly missing: number;
  /** Packets sent in the current window — the denominator, carried so the rate is checkable. */
  readonly windowPackets: number;
  /** `missing / windowPackets`, or 0 for an empty window. */
  readonly rate: number;
}

// ── NACK message ─────────────────────────────────────────────────────────────────────────

/**
 * A teaching NACK — not a bare failure code.
 *
 * Protocol discipline (errors-teach-both-sides):
 *   - `what`: the missing sequence numbers (machine-parseable)
 *   - `why`: the inferred cause (congestion, corruption, timeout)
 *   - `howToFix`: a suggested generator function (new behavior to try)
 *   - `retractableBeliefId`: the belief to retract ("seq=N was received")
 *
 * A bare NACK(seq=42) is nearly worthless — it tells the sender a packet was lost
 * but not why or how to adapt. A teaching NACK gives the sender a new generator.
 */
export interface NackMessage {
  readonly type: "nack";
  readonly missingSeqs: readonly number[];
  /**
   * The ATTRIBUTED cause — what the receiver can evidence, never what it can guess.
   *
   * This field used to be filled by `lr > 0.1 ? "congestion" : lr > 0.02 ? "timeout" : "unknown"`,
   * i.e. by thresholding the very loss rate the controller was trying to explain. That is
   * circular: the estimate produced the cause, and the cause fed the estimate. It is now the
   * cause the receiver observed, and `unknown` when it observed nothing that attributes.
   */
  readonly cause: LossCause;
  /** Human-readable explanation (Beacon register). */
  readonly why: string;
  /** Suggested generator: what the sender should try next. */
  readonly howToFix: string;
  /** The belief to retract: "seq=N was received" (content-addressed id). */
  readonly retractableBeliefId?: string;
}

function isNackMessage(value: unknown): value is NackMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NackMessage>;
  const validCause = LOSS_CAUSES.includes(candidate.cause as LossCause);
  return (
    candidate.type === "nack" &&
    Array.isArray(candidate.missingSeqs) &&
    candidate.missingSeqs.every((seq) => Number.isSafeInteger(seq) && seq >= 0) &&
    validCause &&
    typeof candidate.why === "string" &&
    typeof candidate.howToFix === "string" &&
    (candidate.retractableBeliefId === undefined || typeof candidate.retractableBeliefId === "string")
  );
}

/**
 * A sequence gap too wide to be loss the receiver can speak to — reported LOCALLY, never sent.
 *
 * Emitted when `observedSeq - expectedSeq > MAX_NACK_GAP`. It is deliberately NOT a wire
 * message: every byte this module emits in response to an unauthenticated packet is an
 * amplification factor, and a reflector that answers "you are desynchronised" is still a
 * reflector. The observation is real, so it is surfaced — to the local operator, via
 * `onDesync`, where it costs the mesh nothing.
 */
export interface DesyncEvent {
  /** The next sequence number the receiver was expecting. */
  readonly expectedSeq: number;
  /** The sequence number the packet claimed. Peer-controlled — treat as a claim, not a fact. */
  readonly observedSeq: number;
  /** `observedSeq - expectedSeq`. Not a loss count: see `DesyncEvent`'s doc on why. */
  readonly gap: number;
  /** The bound that was exceeded, so a consumer can see the threshold that produced this. */
  readonly maxNackGap: number;
}

/** The part of a NACK the compact binary codec carries: the sequence numbers AND the cause.
 *
 *  The cause is in the codec deliberately. A wire format that carried only `missingSeqs` would
 *  be a second place the distinction dies — the encoder would compile, the decoder would return
 *  a cause-free NACK, and every reader downstream would be back to inferring. One byte. */
export type DecodedNackMessage = Pick<NackMessage, "type" | "missingSeqs" | "cause">;

export function encodeNack(nack: NackMessage): Buffer {
  const buf = Buffer.alloc(5 + nack.missingSeqs.length * 4);
  buf.writeUInt32BE(nack.missingSeqs.length, 0);
  buf.writeUInt8(LOSS_CAUSES.indexOf(nack.cause), 4);
  for (let i = 0; i < nack.missingSeqs.length; i++) {
    buf.writeUInt32BE(nack.missingSeqs[i]!, 5 + i * 4);
  }
  return buf;
}

export function decodeNack(buf: Buffer): DecodedNackMessage | null {
  if (buf.length < 5) return null;
  const count = buf.readUInt32BE(0);
  // The cause byte is peer-controlled. An index outside the declared set is not decoded as some
  // default cause — the whole message is refused, because a NACK whose cause we invented is the
  // circular inference this change removed, re-entering through the parser.
  const cause = LOSS_CAUSES[buf.readUInt8(4)];
  if (cause === undefined) return null;
  if (buf.length < 5 + count * 4) return null;
  const missingSeqs: number[] = [];
  for (let i = 0; i < count; i++) missingSeqs.push(buf.readUInt32BE(5 + i * 4));
  return { type: "nack", missingSeqs, cause };
}

// ── AIMD congestion controller ────────────────────────────────────────────────────────────

/** The most recent multiplicative decrease, kept so a RETRACTED loss can undo exactly the
 *  decrease it caused rather than waiting out the additive-increase walk (measured at 67 minutes
 *  from MAX_GAP_MS, `UBL-12`). This is a Z-set retraction, not a heuristic re-increase: the
 *  decision is recomputed without the retracted evidence and only reversed if it would not have
 *  fired. */
interface DecreaseRecord {
  readonly gapBefore: number;
  readonly gapAfter: number;
  /** The window the decision was taken over. */
  readonly windowPackets: number;
  /** The sequence numbers that made up the suspect count, so a retraction can be matched exactly. */
  readonly suspectSeqs: readonly number[];
  /** The suspect count itself, which may exceed `suspectSeqs.length` if the list was truncated. */
  readonly suspectCount: number;
}

export interface AimdState {
  gapMs: number; // current inter-packet gap (ms)
  sentCount: number; // packets sent in the current window
  /** Reported-missing packets in the current window, BY ATTRIBUTED CAUSE.
   *
   *  There is deliberately no aggregate `nackCount` here. Keeping one beside this map would be
   *  "add a field beside it" — the aggregate is what discarded the distinction, so it is gone,
   *  and every reader now has to say which cause it means. */
  lossByCause: Readonly<Record<LossCause, number>>;
  /** Sequence numbers behind the *congestion-suspect* part of the current window (see
   *  `congestionSuspectRate`). Bounded by `SUSPECT_SEQ_CAP`; past that the list stops growing and
   *  a retraction can no longer reverse a decision exactly, which is a degradation this state
   *  records rather than hides. */
  suspectSeqs: readonly number[];
  lastDecrease: DecreaseRecord | null;
  /** The window the last evaluation was taken over, retained because the live window is reset by
   *  every evaluation (081KZYN37T4087G0R00181THA4, deliberately not fixed here) — so a reader who
   *  samples after a decision sees all zeros and would conclude nothing happened. This is what
   *  `evaluatedLossRates` reports and what the channel hands to `onLossRates`. */
  lastWindow: { readonly lossByCause: Readonly<Record<LossCause, number>>; readonly windowPackets: number };
}

/** The retention cap on `AimdState.suspectSeqs`. Two full NACK reports at the widest gap the
 *  receiver may report (`MAX_NACK_GAP`) — derived, not chosen, for the same reason
 *  `MAX_NACK_GAP` is: the numbers must move together or one of them is a coincidence. */
const SUSPECT_SEQ_CAP = 2 * MAX_NACK_GAP;

const NO_LOSS: Readonly<Record<LossCause, number>> = { congestion: 0, corruption: 0, reorder: 0, unknown: 0 };

export function makeAimdState(initialGapMs = 10): AimdState {
  return {
    gapMs: initialGapMs,
    sentCount: 0,
    lossByCause: NO_LOSS,
    suspectSeqs: [],
    lastDecrease: null,
    lastWindow: { lossByCause: NO_LOSS, windowPackets: 0 },
  };
}

/**
 * The share of the window that MIGHT be congestion — and the name is the honest part.
 *
 * `congestion` counts losses attributed to a queue by evidence. `unknown` counts erasures whose
 * cause the receiver could not see, which is the union {congestion, corruption}. Summing them is
 * a conflation, and it is deliberate, named, and confined to this one function, where before it
 * was the only thing the estimator could express.
 *
 * WHY THE CONSERVATIVE DIRECTION. Refusing to back off on `unknown` would not be neutrality — it
 * would be *assuming corruption*, which is the same error as the one being fixed with the sign
 * flipped, and its failure mode is congestion collapse (Jacobson, SIGCOMM 88 - CITED, not
 * page-checked) rather than lost throughput. So unattributed loss keeps the classical response,
 * and the way to earn the throughput back is to make corruption *perceivable*
 * (081KZYP1X3B087G0R001EZ37PQ), not to reinterpret silence.
 *
 * `reorder` and `corruption` are excluded outright: backing off relieves neither, and RFC 4653 /
 * BBR are the anchors for saying so.
 */
export function congestionSuspectRate(state: AimdState): number {
  if (state.sentCount === 0) return 0;
  return (state.lossByCause.congestion + state.lossByCause.unknown) / state.sentCount;
}

function rowsFrom(lossByCause: Readonly<Record<LossCause, number>>, windowPackets: number): readonly LossRate[] {
  return LOSS_CAUSES.map((cause) => ({
    cause,
    missing: lossByCause[cause],
    windowPackets,
    rate: windowPackets > 0 ? lossByCause[cause] / windowPackets : 0,
  }));
}

/** One row per cause for the window still accumulating. Replaces `lossRate(state): number` — the
 *  operation that discarded the distinction — and the plural is the entire point.
 *
 *  Reads all-zero immediately after any evaluation, because `updateAimd` resets the window every
 *  time it runs (081KZYN37T4087G0R00181THA4). That is the estimator defect, next in the ordering
 *  and deliberately untouched here; `ULT-10b` pins it. Use `evaluatedLossRates` to see the window
 *  a decision was actually taken over. */
export function lossRates(state: AimdState): readonly LossRate[] {
  return rowsFrom(state.lossByCause, state.sentCount);
}

/** One row per cause for the window the last evaluation was taken over. This is the honest
 *  observation point for a reader sampling after a decision. */
export function evaluatedLossRates(state: AimdState): readonly LossRate[] {
  return rowsFrom(state.lastWindow.lossByCause, state.lastWindow.windowPackets);
}

/** Absorb one attributed loss report. The caller must name a cause; there is no arity that lets
 *  it hand over a bare count. */
export function onLoss(state: AimdState, signal: LossSignal): AimdState {
  const n = signal.seqs.length;
  if (n === 0) return state;
  const lossByCause = { ...state.lossByCause, [signal.cause]: state.lossByCause[signal.cause] + n };
  const suspect =
    signal.cause === "congestion" || signal.cause === "unknown"
      ? [...state.suspectSeqs, ...signal.seqs].slice(0, SUSPECT_SEQ_CAP)
      : state.suspectSeqs;
  return updateAimd({ ...state, lossByCause, suspectSeqs: suspect });
}

/**
 * Retract a congestion-suspect loss, re-attributing it to a cause that backing off cannot relieve.
 *
 * Two effects, and the second is the one that matters. The counts move from `unknown` to `to` — a
 * Z-set correction, +1 then −1, not a duplicate guard. And if the decrease those sequence numbers
 * caused would NOT have fired without them, the gap is restored. The decision is RECOMPUTED, never
 * merely inverted, so a decrease that was justified by other losses stands.
 *
 * WHY `to` EXISTS AND WHY IT TAKES NO EVIDENCE (081KZYP1X3B087G0R001EZ37PQ). Two reports arrive
 * over the wire that mean "do not back off on this":
 *
 *   - `reorder`    — the receiver reported these missing and then watched them arrive.
 *   - `corruption` — the receiver reported these missing and then matched them against frames it
 *                    had itself REJECTED on a failed CRC-32C.
 *
 * Both are the reporter WITHDRAWING its own earlier congestion-suspect claim, so both are handled
 * here, and neither carries a `CorruptionEvidence` value — deliberately. The sender verified
 * nothing; minting evidence on its behalf would be exactly the circular inference this module
 * removed, re-entering through a helpful-looking constructor. `LossSignal`'s `corruption` case
 * stays reachable only from LOCAL verification, and this path stays a re-attribution.
 *
 * §12 idempotency: retracting the same sequence twice is a no-op, because the retracted numbers
 * leave `suspectSeqs` on the first call and the record is cleared once it is reversed.
 */
export function retractLoss(
  state: AimdState,
  seqs: readonly number[],
  to: "reorder" | "corruption" = "reorder",
): AimdState {
  if (seqs.length === 0) return state;
  const retracted = new Set(seqs);
  const stillSuspect = state.suspectSeqs.filter((s) => !retracted.has(s));
  const removed = state.suspectSeqs.length - stillSuspect.length;

  // `removed` is what leaves the CURRENT window. A retraction usually arrives after the window
  // that counted it was already evaluated and reset (081KZYN37T4087G0R00181THA4 resets on every
  // evaluation), so the current window is often empty and the reversal below is the only effect —
  // which is exactly why this must not return early on `removed === 0`.
  const rec = state.lastDecrease;
  let gapMs = state.gapMs;
  let lastDecrease = rec;
  let dropped = 0;
  if (rec !== null && rec.windowPackets > 0) {
    const stillInRecord = rec.suspectSeqs.filter((s) => !retracted.has(s));
    dropped = rec.suspectSeqs.length - stillInRecord.length;
    if (dropped > 0) {
      const recomputed = (rec.suspectCount - dropped) / rec.windowPackets;
      // `gapMs === rec.gapAfter` is load-bearing: if the gap has moved since the decision (another
      // decrease, an additive increase), restoring `gapBefore` would not be an undo — it would be
      // a write of a stale value. In that case the retraction still re-attributes the count and
      // leaves the gap alone.
      if (recomputed <= HIGH_LOSS_THRESHOLD && state.gapMs === rec.gapAfter) {
        // The decision does not survive its own evidence being withdrawn. Undo it exactly.
        gapMs = rec.gapBefore;
        lastDecrease = null;
      } else {
        lastDecrease = { ...rec, suspectSeqs: stillInRecord, suspectCount: rec.suspectCount - dropped };
      }
    }
  }

  // Re-attribution. `removed` left the CURRENT window; `dropped` was counted in a window that has
  // already been evaluated and reset (081KZYN37T4087G0R00181THA4 resets on every evaluation), so
  // only `removed` can be subtracted from `unknown` — but both are genuinely `to`, and the
  // attribution report is the reason to say so. The two sets are disjoint by construction:
  // `updateAimd` empties `suspectSeqs` at the instant it builds a record from them.
  const attributed = removed + dropped;
  // §12: a retraction naming nothing this estimator counted is literally a no-op — the SAME
  // state object, not an equal copy. That matters beyond tidiness: `LossyUdpChannel` decides
  // whether to notify `onLossRates` by identity, so an equal-but-new object would announce a
  // change that did not happen.
  if (attributed === 0) return state;
  const lossByCause = {
    ...state.lossByCause,
    unknown: Math.max(0, state.lossByCause.unknown - removed),
    [to]: state.lossByCause[to] + attributed,
  };
  return { ...state, gapMs, lossByCause, suspectSeqs: stillSuspect, lastDecrease };
}

/** Update the AIMD state after sending a packet. Returns the new state. */
export function onSend(state: AimdState): AimdState {
  const s = { ...state, sentCount: state.sentCount + 1 };
  // Reset window every LOSS_WINDOW packets
  if (s.sentCount >= LOSS_WINDOW) return updateAimd(s);
  return s;
}

function updateAimd(state: AimdState): AimdState {
  if (state.sentCount === 0) return state;
  // NOT `total loss / sent`. Only the congestion-suspect share steers the gap; reorder and
  // corruption are counted, reported, and never move it. That is the whole defect.
  const suspectRate = congestionSuspectRate(state);
  const suspectCount = state.lossByCause.congestion + state.lossByCause.unknown;
  let gapMs = state.gapMs;
  let lastDecrease = state.lastDecrease;
  if (suspectRate > HIGH_LOSS_THRESHOLD) {
    // Multiplicative decrease: double the gap (back off like a bat going quiet)
    gapMs = Math.min(MAX_GAP_MS, gapMs * 2);
    lastDecrease = {
      gapBefore: state.gapMs,
      gapAfter: gapMs,
      windowPackets: state.sentCount,
      suspectSeqs: state.suspectSeqs,
      suspectCount,
    };
  } else if (suspectRate < LOW_LOSS_THRESHOLD) {
    // Additive increase: reduce the gap by GAP_STEP_MS
    gapMs = Math.max(MIN_GAP_MS, gapMs - GAP_STEP_MS);
    lastDecrease = null; // the gap has moved since; a retraction can no longer reverse it exactly
  }
  // NOTE: the window is reset on EVERY evaluation, which is 081KZYN37T4087G0R00181THA4 and is
  // deliberately NOT fixed here. It is left intact so the ordering is checkable: this change
  // supplies the distinction, the estimator window is next, and the pacing wiring is last.
  return {
    ...state,
    gapMs,
    sentCount: 0,
    lossByCause: NO_LOSS,
    suspectSeqs: [],
    lastDecrease,
    lastWindow: { lossByCause: state.lossByCause, windowPackets: state.sentCount },
  };
}

// ── Receiver block buffer ─────────────────────────────────────────────────────────────────

export interface ReceiverBlock {
  readonly blockSeq: number;
  readonly packets: (Uint8Array | null)[]; // length 8
  receivedCount: number;
  recovered: boolean;
}

export function makeReceiverBlock(blockSeq: number): ReceiverBlock {
  return { blockSeq, packets: Array(BLOCK_TOTAL).fill(null), receivedCount: 0, recovered: false };
}

/** Add a received packet to the block buffer. Returns the recovered data packets if
 *  the block is now complete (or recoverable), or null if more packets are needed.
 *
 *  Recovery is attempted on EVERY arrival from the 4th onwards, not only at 7-of-8. Four
 *  independent symbols are enough to solve for the block, and which four they are is not
 *  something the receiver gets to choose — waiting for a 7th packet that a burst already ate
 *  is how a decodable block was being discarded. */
export function addToBlock(block: ReceiverBlock, pos: number, payload: Uint8Array): Uint8Array[] | null {
  // Rejects duplicates AND out-of-range positions, and the second half is load-bearing: `pos`
  // is `header.blockPos`, a `uint8` off an unauthenticated packet, so 8..255 are values a peer
  // may choose. `packets[9]` reads `undefined`, and `undefined !== null` is true, so the write
  // never happens. That protection rests entirely on the STRICT `!==`; relaxing it to `!=`
  // (or to `?? null`) would let a peer write past the 8-slot array with one packet, after
  // which `recoverAdinkraBlock`'s length check refuses the block forever. ULT-24 is the
  // falsifier — an explicit range test was tried here and mutation testing showed it could not
  // be observed, because this line already does the job.
  if (block.packets[pos] !== null) return null;
  block.packets[pos] = payload;
  block.receivedCount++;
  if (block.recovered) return null; // §12: already delivered; a late arrival is not a second credit

  // All 4 data packets present — no decode needed.
  if (block.packets.slice(0, BLOCK_DATA).every((p) => p !== null)) {
    block.recovered = true;
    return block.packets.slice(0, BLOCK_DATA) as Uint8Array[];
  }

  // Otherwise solve, as soon as there are enough symbols for the solve to be possible at all.
  if (block.receivedCount >= BLOCK_DATA) {
    const full = recoverAdinkraBlock(block.packets);
    if (full !== null) {
      for (let i = 0; i < BLOCK_TOTAL; i++) block.packets[i] = full[i]!;
      block.recovered = true;
      return block.packets.slice(0, BLOCK_DATA) as Uint8Array[];
    }
  }

  return null;
}

// ── Sender block builder ──────────────────────────────────────────────────────────────────

export interface SenderBlock {
  readonly blockSeq: number;
  readonly dataPackets: Uint8Array[]; // length 4
  readonly parityPackets: Uint8Array[]; // length 4
}

/** Build a sender block: 4 data packets → 4 parity packets via Adinkra [8,4,4]. */
export function buildSenderBlock(blockSeq: number, data: readonly Uint8Array[]): SenderBlock {
  if (data.length !== BLOCK_DATA)
    throw new Error(`buildSenderBlock: expected ${BLOCK_DATA} data packets, got ${data.length}`);
  const maxLen = Math.max(...data.map((d) => d.length));
  // Pad all data packets to the same length
  const padded = data.map((d) => {
    if (d.length === maxLen) return d;
    const p = new Uint8Array(maxLen);
    p.set(d);
    return p;
  });
  return {
    blockSeq,
    dataPackets: padded as Uint8Array[],
    parityPackets: computeAdinkraParity(padded),
  };
}

// ── Gossip debounce ───────────────────────────────────────────────────────────────────────

/** Schedule a gossip re-broadcast with random jitter to prevent broadcast storms.
 *  Returns a cancel function. */
/** The two ambient sources this function reaches for, named so a caller can supply them.
 *
 *  Both default to the real thing, so every existing call site is unchanged. The point is not
 *  configurability -- nothing in production passes these -- it is that the jitter WINDOW becomes
 *  observable. A test given only the global timer can assert "it fired eventually" and nothing
 *  more; with the timer injected it can assert the delay actually landed inside
 *  [jitterMin, jitterMax), which is what this function claims and what its test could not check.
 *  `.claude/rules/dv2-data-split-discipline-activated.md` #7: entropy through declared channels. */
export interface GossipJitterSources {
  /** Defaults to the global `setTimeout`. */
  readonly setTimeout?: (fn: () => void, ms: number) => unknown;
  /** Defaults to the global `clearTimeout`. */
  readonly clearTimeout?: (handle: unknown) => void;
  /** Defaults to `Math.random`; must return a value in [0, 1). */
  readonly random?: () => number;
}

export function scheduleGossipRebroadcast(
  fn: () => void,
  jitterMinMs = JITTER_MIN_MS,
  jitterMaxMs = JITTER_MAX_MS,
  sources: GossipJitterSources = {},
): () => void {
  const random = sources.random ?? Math.random;
  const setT = sources.setTimeout ?? ((f: () => void, ms: number): unknown => setTimeout(f, ms));
  const clearT = sources.clearTimeout ?? ((h: unknown): void => { clearTimeout(h as ReturnType<typeof setTimeout>); });
  const delay = jitterMinMs + random() * (jitterMaxMs - jitterMinMs);
  const handle = setT(fn, delay);
  return () => clearT(handle);
}

// ── High-level LossyUdpChannel ────────────────────────────────────────────────────────────

/** A bidirectional lossy UDP channel with Adinkra [8,4,4] erasure coding and AIMD backoff.
 *
 *  Usage:
 *    const ch = new LossyUdpChannel(transport, myZid);
 *    ch.send(payload);                          // sends 4 data + 4 parity packets
 *    ch.onData(payload => { ... });             // called when a block is recovered
 *    ch.onLossRates(rows => { ... });           // one row PER CAUSE, never a single number
 */
export class LossyUdpChannel {
  private readonly transport: {
    broadcast(text: string): void;
    onMessage(h: (text: string, from: string) => void): void;
  };
  private readonly myZid: string;
  private aimd: AimdState = makeAimdState(10);
  private sendBlockSeq = 0;
  private sendQueue: Uint8Array[] = []; // accumulate 4 data packets before sending a block
  private recvBlocks = new Map<number, ReceiverBlock>();
  private expectedSeq = 0;
  /** Sequence numbers this receiver has REPORTED missing and not yet seen arrive.
   *
   *  This is the whole reorder attribution: a number that leaves this set by ARRIVING was never
   *  lost, and the receiver is the only party that can observe that. Bounded to
   *  `2 * MAX_NACK_GAP` by eviction below `expectedSeq - MAX_NACK_GAP`, because unbounded state
   *  keyed on an unauthenticated peer's sequence field is how the 3,333,337x amplification worked. */
  private reportedMissing = new Set<number>();
  /** Frames this receiver REJECTED on a failed CRC-32C and has not yet matched to a gap.
   *
   *  A rejected frame's header is inside the checksummed region, so its `seq` is exactly as
   *  untrustworthy as the rest of it — the receiver knows THAT a frame was destroyed, never WHICH
   *  sequence number it was. So corruption is carried as a COUNT and spent against the next gap:
   *  `min(pending, gapSize)` of the missing numbers are attributed to corruption and the rest stay
   *  `unknown`. Sound as a count (each rejection is one real destroyed transmission), arbitrary in
   *  which numbers get the label — and the arbitrariness costs nothing downstream, because
   *  corruption never enters `suspectSeqs` and so is never matched by sequence again.
   *
   *  The `min` is also the bound on the one lever this opens: an attacker spraying deliberately
   *  bad frames can RE-LABEL losses the receiver independently observed, never manufacture them.
   *  Capped at `MAX_NACK_GAP` for the same reason `reportedMissing` is — unbounded state keyed on
   *  a peer-controlled stream is how the 3,333,337x amplification worked. */
  private pendingCorruptFrames = 0;
  /** Block identifiers this receiver has already DELIVERED — the §12 guard that outlives the block.
   *
   *  `ReceiverBlock.recovered` is the in-window half of the same guard and is still the fast path;
   *  this is the half that survives eviction. Bounded to `DELIVERED_BLOCK_CAP`, evicted
   *  least-recently-used, and keyed on the block index DERIVED FROM `seq` — see the eviction site
   *  in `handleIncoming` for all three reasons. */
  private deliveredBlocks = new Set<number>();
  private dataHandlers: Array<(payload: Uint8Array) => void> = [];
  private lossHandlers: Array<(rates: readonly LossRate[]) => void> = [];
  private envelopeHandlers: Array<(envelope: ErrorEnvelope) => void> = [];
  private desyncHandlers: Array<(event: DesyncEvent) => void> = [];
  private reorderHandlers: Array<(seqs: readonly number[]) => void> = [];
  private corruptionHandlers: Array<(evidence: CorruptionEvidence) => void> = [];
  /** Optional DimensionalBnn — absorbs teaching NACKs as EP observations. */
  private bnn: DimensionalBnn | null = null;

  constructor(
    transport: {
      broadcast(text: string): void;
      onMessage(h: (text: string, from: string) => void): void;
    },
    myZid: string,
    /** Optional DimensionalBnn for absorbing teaching NACKs. */
    bnn?: DimensionalBnn,
  ) {
    this.transport = transport;
    this.myZid = myZid;
    if (bnn) this.bnn = bnn;
    transport.onMessage((text, _from) => void this.handleIncoming(text));
  }

  /** Queue a payload for sending. When 4 payloads are queued, sends a full Adinkra block. */
  send(payload: Uint8Array): void {
    this.sendQueue.push(payload);
    if (this.sendQueue.length >= BLOCK_DATA) {
      this.flushBlock();
    }
  }

  /** Force-flush the current queue (padding with empty packets if needed). */
  flush(): void {
    while (this.sendQueue.length > 0 && this.sendQueue.length < BLOCK_DATA) {
      this.sendQueue.push(new Uint8Array(0));
    }
    if (this.sendQueue.length >= BLOCK_DATA) this.flushBlock();
  }

  /** How many partially-received blocks the receiver is holding right now.
   *
   *  An OBSERVATION POINT, not a knob — there is no setter and nothing in the module reads it. It
   *  exists because the retention bound below is otherwise unobservable from outside: the defect it
   *  guards (081KZYQJPNG087G0R002B9E9S1) was invisible to every test in this suite precisely because
   *  `recvBlocks` is private and unbounded growth changes no delivered output. A bound that cannot
   *  be measured is a comment. */
  get retainedBlockCount(): number {
    return this.recvBlocks.size;
  }

  /** How many DELIVERED block identifiers the §12 guard is holding right now.
   *
   *  The same kind of observation point as `retainedBlockCount`, added for the same reason: this
   *  bound is on state no delivered output reveals, and #10552 is the precedent for what happens
   *  to an unobservable bound — it was a comment for as long as nothing could see it. */
  get deliveredGuardCount(): number {
    return this.deliveredBlocks.size;
  }

  onData(h: (payload: Uint8Array) => void): void {
    this.dataHandlers.push(h);
  }
  /** One row per cause. There is no single-number variant, and removing it is the fix: a caller
   *  handed `0.05` cannot ask whether backing off would relieve anything. */
  onLossRates(h: (rates: readonly LossRate[]) => void): void {
    this.lossHandlers.push(h);
  }
  /** Called when a sequence number this receiver reported missing ARRIVES — the one loss
   *  attribution this transport can make today. Local; the wire retraction is separate. */
  onReorder(h: (seqs: readonly number[]) => void): void {
    this.reorderHandlers.push(h);
  }
  /** Called when a frame ARRIVED and failed its CRC-32C. The evidence is LOCAL — this receiver
   *  ran the check — and is accidental-corruption evidence only; see `encodePacket`. */
  onCorruption(h: (evidence: CorruptionEvidence) => void): void {
    this.corruptionHandlers.push(h);
  }
  /** Called when a teaching NACK envelope is emitted (for logging / UI). */
  onEnvelope(h: (envelope: ErrorEnvelope) => void): void {
    this.envelopeHandlers.push(h);
  }
  /** Called when a sequence gap exceeds `MAX_NACK_GAP` — local only, nothing is sent. */
  onDesync(h: (event: DesyncEvent) => void): void {
    this.desyncHandlers.push(h);
  }

  private flushBlock(): void {
    const data = this.sendQueue.splice(0, BLOCK_DATA);
    const block = buildSenderBlock(this.sendBlockSeq++, data);
    const allPackets = [...block.dataPackets, ...block.parityPackets];
    for (let pos = 0; pos < BLOCK_TOTAL; pos++) {
      const seq = block.blockSeq * BLOCK_TOTAL + pos;
      const header: LossyPacketHeader = {
        seq,
        blockSeq: block.blockSeq,
        blockPos: pos,
        isData: pos < BLOCK_DATA,
        payloadLen: allPackets[pos]!.length,
      };
      const pkt = encodePacket(header, allPackets[pos]!);
      // Wrap in a JSON envelope so the transport can distinguish data from control
      const envelope = JSON.stringify({
        type: "lossy-udp",
        zid: this.myZid,
        pkt: pkt.toString("base64"),
      });
      this.transport.broadcast(envelope);
      this.aimd = onSend(this.aimd);
    }
  }

  private async handleIncoming(text: string): Promise<void> {
    let envelope: {
      type?: string;
      zid?: string;
      pkt?: string;
      nack?: number[];
      teaching?: unknown;
    };
    try {
      envelope = JSON.parse(text);
    } catch {
      return;
    }
    if (envelope.type === "lossy-udp-nack" && Array.isArray(envelope.nack)) {
      // Teaching NACK received: update the per-cause loss estimate + absorb into BNN.
      //
      // The cause is READ off the report; it is no longer synthesised from the loss rate the
      // controller is trying to explain. `reorder` is a RETRACTION — the receiver reported these
      // sequence numbers missing and then watched them arrive — so it withdraws evidence rather
      // than adding it. An absent or unrecognised cause is `unknown`, which is the conservative
      // direction: it keeps the classical backoff rather than silently suppressing it.
      const seqs = envelope.nack.filter((s): s is number => Number.isSafeInteger(s) && s >= 0);
      const claimed = (envelope.teaching as Partial<NackMessage> | undefined)?.cause;
      const before = this.aimd;
      if (claimed === "reorder" || claimed === "corruption") {
        // Both are RE-ATTRIBUTIONS: the reporter is withdrawing its own earlier congestion-suspect
        // claim, having since watched the packet arrive (`reorder`) or matched it to a frame it
        // rejected on a failed CRC-32C (`corruption`). Neither mints evidence here, and that is
        // the honest part — this sender verified nothing; it is being told. See `retractLoss`.
        //
        // Believing it grants an adversary nothing: a receiver that wants to suppress this
        // sender's backoff can simply emit no NACK, which is cheaper and strictly more effective.
        this.aimd = retractLoss(this.aimd, seqs, claimed);
      } else {
        // `congestion` remains unreachable here by construction — `CongestionEvidence` still
        // cannot be minted anywhere, because this transport still has no queue or delay signal.
        // So every non-retraction report is `unknown`, and unattributed loss keeps the classical
        // backoff.
        this.aimd = onLoss(this.aimd, { cause: "unknown", seqs });
      }
      if (this.aimd !== before) {
        // The EVALUATED window, not the live one: `updateAimd` empties the live window every time
        // it runs, so reporting that here would hand every observer a row of zeros.
        const rows = evaluatedLossRates(this.aimd);
        for (const h of this.lossHandlers) h(rows);
      }
      // Absorb teaching error into DimensionalBnn if available
      if (this.bnn && isNackMessage(envelope.teaching)) {
        const teaching = envelope.teaching;

        // NARROWED 2026-08-11. This was one `try { ...everything... } catch { }` with an EMPTY
        // body, justified by the comment as "browser env without dynamic import" — but it caught
        // ALL failures, not the one it named. The consequence was found by the mutation runner:
        // with `isNackMessage` mutated to accept a non-object, the code entered the try, threw on
        // `teaching.missingSeqs.join(...)`, and the bare catch swallowed it — so accepting garbage
        // and rejecting it produced IDENTICAL observable behaviour, and no test could tell them
        // apart. A guard whose failure is invisible is not a guard.
        //
        // Now only the DYNAMIC IMPORT is guarded, which is the failure the comment actually meant.
        // Everything after it runs unguarded: a malformed teaching payload that slips past the type
        // guard now surfaces instead of being absorbed into silence.
        let absorb: typeof import("../planning/error-bnn-bridge").absorbError;
        let mkEnv: typeof import("../protocol/error-envelope").teachingError;
        try {
          ({ absorbError: absorb } = await import("../planning/error-bnn-bridge"));
          ({ teachingError: mkEnv } = await import("../protocol/error-envelope"));
        } catch {
          /* browser env without dynamic import — the ONLY failure this catch is for */
          return;
        }

        const corrId = `nack:${this.myZid}:${Date.now()}`;
        const retractable =
          teaching.retractableBeliefId === undefined ? {} : { retractableBeliefId: teaching.retractableBeliefId };
        const errEnv = mkEnv(
          corrId,
          {
            what: `missing seqs: ${teaching.missingSeqs.join(",")}`,
            why: teaching.why,
            howToFix: teaching.howToFix,
            dimension: "transport",
            severity: envelope.nack.length > 3 ? "error" : "warn",
            ...retractable,
          },
          new Date().toISOString(),
        );
        absorb(this.bnn, errEnv);
        for (const h of this.envelopeHandlers) h(errEnv);
      }
      return;
    }
    if (envelope.type !== "lossy-udp" || !envelope.pkt) return;
    if (envelope.zid === this.myZid) return; // echo suppression

    const buf = Buffer.from(envelope.pkt, "base64");
    const decoded = decodePacket(buf);
    if (!decoded.ok) {
      if (decoded.reason === "checksum") {
        // A frame arrived and its own bytes disagree with its own CRC-32C. It is DISCARDED here,
        // which is the point: corruption degrades to erasure, and erasure is the fault class the
        // [8,4,4] code handles. Nothing corrupt reaches `addToBlock`, so nothing corrupt can be
        // laundered into a data packet by the erasure solve.
        this.pendingCorruptFrames = Math.min(MAX_NACK_GAP, this.pendingCorruptFrames + 1);
        for (const h of this.corruptionHandlers) h(decoded.evidence);
      }
      // `short` / `truncated` are FRAMING failures and are deliberately NOT counted as
      // corruption — an old peer that has not taken the trailer lands here on every frame, and a
      // rollout skew reported as channel corruption would suppress backoff for its duration.
      return;
    }

    const { header, payload } = decoded;
    // Check for sequence gaps → send NACK.
    //
    // SECURITY (fixed 2026-08-13, workitem 081KZYP1S96087G0R002G8XQZP, docs/BUGS.md P0):
    // `header.seq` is `readUInt32BE` of an unauthenticated packet — the `zid` check above is
    // echo suppression, not identity. This loop used to run to `header.seq` unbounded, and the
    // resulting NACK was BROADCAST. Measured on the unfixed code, one 74-byte packet claiming
    // `seq = 5e6` produced a 246,666,953-byte broadcast (3,333,337x amplification, 537 ms of
    // blocking single-threaded work); the u32 field permits 859x more.
    //
    // The bound is MAX_NACK_GAP, derived from the receiver's own retention window (see its
    // definition). A gap wider than that is NOT reported as loss — see the desync branch.
    const gap = header.seq - this.expectedSeq;
    if (gap > MAX_NACK_GAP) {
      // DESYNC, not loss. Beyond its retention window the receiver cannot distinguish "the
      // sender emitted these and they were lost" from "the sender was quiet", "another peer's
      // stream interleaved" (one global `expectedSeq` counts every peer), or "this packet is
      // lying". Emitting `gap` missing sequence numbers would therefore MANUFACTURE a
      // measurement, which is the same defect as truncating the list and calling it complete —
      // so the honest report is that synchronisation was lost, and it is made LOCALLY.
      //
      // Named cost: a genuine burst that loses more than MAX_NACK_GAP consecutive packets no
      // longer signals the sender at all. That is a real regression in the heavy-loss case,
      // and it is not fixable here: with one `expectedSeq` shared across all peers on a
      // broadcast transport, the wide-gap case is not measurable in the first place. The fix is
      // per-peer sequence state — filed separately, not bundled into a security patch.
      // A gap this wide is not a region the receiver can evidence (see the
      // paragraph above). The same argument applies to a corruption COUNT
      // accumulated BEFORE this boundary: those rejected frames lived in a
      // different region of sequence space, and spending them against the
      // next narrow gap would re-label losses the receiver never checked
      // (081KZZYESKA087G0R0008WFKFG). Clear, do not carry.
      this.pendingCorruptFrames = 0;
      const event: DesyncEvent = {
        expectedSeq: this.expectedSeq,
        observedSeq: header.seq,
        gap,
        maxNackGap: MAX_NACK_GAP,
      };
      for (const h of this.desyncHandlers) h(event);
    } else if (gap > 0) {
      const missing: number[] = [];
      for (let s = this.expectedSeq; s < header.seq; s++) missing.push(s);
      if (missing.length > 0) {
        // The cause is what the receiver can EVIDENCE, and at this instant it can evidence
        // nothing: the packet is absent, and an absent packet looks identical whether a queue
        // dropped it, the channel corrupted it, or it is merely late (RFC 4653). The previous
        // code answered this question by thresholding its own loss estimate — the estimate
        // produced the cause, the cause fed the estimate — which is why `unknown` is reported
        // here and re-attributed later if one of these numbers turns up.
        const teachingNack: NackMessage = {
          type: "nack",
          missingSeqs: missing,
          cause: "unknown",
          why: `${missing.length} packet(s) missing in sequence [${missing[0]}..${missing[missing.length - 1]}]; cause NOT attributable: this transport has no integrity check (081KZYP1X3B087G0R001EZ37PQ) and no queue or delay signal, so a queue drop, a corrupted frame and a late packet are the same observation here`,
          howToFix:
            "treat as possible congestion (the conservative direction); to attribute it, add an integrity check so corruption is perceivable",
          retractableBeliefId: missing.map((s) => `received:seq=${s}:zid=${this.myZid}`).join(","),
        };
        for (const s of missing) this.reportedMissing.add(s);
        const nackEnv = JSON.stringify({
          type: "lossy-udp-nack",
          zid: this.myZid,
          nack: missing,
          teaching: teachingNack,
        });
        this.transport.broadcast(nackEnv);

        // ATTRIBUTION, second of the two this transport can now make. Frames this receiver
        // REJECTED on a failed CRC-32C are spent against this gap, up to its size. The report
        // above went out as `unknown` first and this WITHDRAWS part of it — the same shape as the
        // reorder retraction below, for the same reason: the sender cannot verify a checksum it
        // never held, so the honest wire form is the reporter taking back its own claim rather
        // than the sender minting evidence on the reporter's word.
        //
        // Named cost, on the same ledger as the reorder retraction: one extra broadcast, emitted
        // only when a corrupt frame was actually observed, bounded by the same MAX_NACK_GAP.
        const attributable = Math.min(this.pendingCorruptFrames, missing.length);
        if (attributable > 0) {
          this.pendingCorruptFrames -= attributable;
          const corruptSeqs = missing.slice(0, attributable);
          const reattribution: NackMessage = {
            type: "nack",
            missingSeqs: corruptSeqs,
            cause: "corruption",
            why: `${attributable} frame(s) arrived and failed CRC-32C since the last gap; that many of [${missing[0]}..${missing[missing.length - 1]}] were destroyed by the channel, not by a queue. WHICH of them is arbitrary — the rejected frame's header is inside the checksummed region, so only the COUNT is a measurement`,
            howToFix: "do not back off: backing off does not make a noisy channel quieter (RFC 4653)",
            retractableBeliefId: corruptSeqs.map((s) => `missing:seq=${s}:cause=unknown:zid=${this.myZid}`).join(","),
          };
          this.transport.broadcast(
            JSON.stringify({
              type: "lossy-udp-nack",
              zid: this.myZid,
              nack: corruptSeqs,
              teaching: reattribution,
            }),
          );
        }
      }
    } else if (this.reportedMissing.delete(header.seq)) {
      // ATTRIBUTION, and the only one available today: a sequence number this receiver reported
      // missing has ARRIVED. It was never lost — it was reordered — so the earlier report is
      // withdrawn rather than left standing. `retractableBeliefId` was always the field for this;
      // nothing retracted through it until now.
      //
      // Named cost, because every byte emitted in response to an unauthenticated packet is an
      // amplification factor: this is a second broadcast per reordered packet, so it at most
      // DOUBLES the NACK volume the module already bounds. It is self-limiting — a retraction is
      // only emitted for a sequence number this receiver itself reported — so it adds no new
      // peer-controlled lever, only more traffic on an existing one.
      //
      // §12: `Set.delete` returns true at most once per sequence number, so a duplicated packet
      // cannot retract the same belief twice.
      const retraction: NackMessage = {
        type: "nack",
        missingSeqs: [header.seq],
        cause: "reorder",
        why: `seq=${header.seq} was reported missing and then arrived; it was reordered, not lost`,
        howToFix: "do not back off: reordering carries no capacity information",
        retractableBeliefId: `received:seq=${header.seq}:zid=${this.myZid}`,
      };
      this.transport.broadcast(
        JSON.stringify({ type: "lossy-udp-nack", zid: this.myZid, nack: [header.seq], teaching: retraction }),
      );
      for (const h of this.reorderHandlers) h([header.seq]);
    }
    this.expectedSeq = Math.max(this.expectedSeq, header.seq + 1);
    // Evict sequence numbers the receiver can no longer speak to, on the SAME bound the NACK is
    // derived from. Without this the set grows without limit under a peer-chosen sequence field.
    if (this.reportedMissing.size > 0) {
      const floor = this.expectedSeq - MAX_NACK_GAP;
      for (const s of this.reportedMissing) if (s < floor) this.reportedMissing.delete(s);
    }

    // ── Add to the receiver block, and EVICT ON INSERTION ────────────────────────────────────
    //
    // MEMORY (fixed 2026-08-14, workitem 081KZYQJPNG087G0R002B9E9S1, P1). Eviction used to live
    // inside `if (recovered)` below, which is the one branch a leaking stream never reaches: a
    // block that never becomes recoverable never triggers its own cleanup. That is not an exotic
    // input — it is the ORDINARY case on a lossy link, which is what this transport is for.
    // Measured on the unfixed code, 200,000 packets at 256-byte payloads (82.8 MB in) retained
    // 200,000 blocks and 259,833,856 bytes of RSS, zero evicted. Read the SLOPE rather than that
    // total — a Bun heap that expanded for transient garbage keeps ~100 MB of high-water mark
    // whatever the receiver does, so the total flatters the fix. Over the second half of the run:
    // 119,848,960 bytes before, 901,120 after. Linear versus flat, which is the whole claim.
    // `blockSeq` is `readUInt32BE` of an unauthenticated packet and is a SEPARATE field from `seq`,
    // so a peer holds `seq` monotone — provoking no NACK at all — while spending 4.29e9 distinct
    // keys. Reproduce with `udp-lossy-transport.retention-measure.ts`.
    //
    // The bound is RECV_BLOCK_WINDOW blocks — the SAME constant `MAX_NACK_GAP` is derived from,
    // not a fresh number. That is the point of the shared constant: the receiver's memory is one
    // quantity, and everything it may honestly claim is derived from it. Retaining more than the
    // recovery window buys nothing anyway — the [8,4,4] decoder acts on a block, never across
    // blocks, so a 9th block is state no decode can consume.
    //
    // VICTIM: the LEAST-RECENTLY-USED block (`Map` iteration is insertion order, and a hit moves
    // its entry to the tail). This was chosen by MEASUREMENT over three alternatives, because the
    // memory bound is the easy half — every candidate below caps the map at 8 — and the eviction
    // ORDER is where the real behaviour is. Delivered payloads out of 1600, 400 blocks, seeded
    // reorder jitter of `depth` packet positions, 0% channel loss (`reorder-sweep`, and the whole
    // table is in the PR):
    //
    //     depth        0      8     16     32     64    128    256   |  parked?
    //     unbounded  1600   1600   1600   1600   1600   1408    724  |  n/a — the defect
    //     lowest key 1600   1600   1600   1600   1600   1284    488  |  YES, 8 packets, forever
    //     LRU        1600   1600   1600   1600   1632    540     96  |  no
    //     FIFO       1600   1600   1600   1600   1712    284     48  |  no
    //     fewest-sym 1600   1272    444    104     48     32     32  |  no
    //
    // LOWEST-KEY is disqualified on the last column, not the first. It tracks the unbounded map
    // almost exactly — and it lets any peer PARK: 8 packets claiming the top of the u32 range
    // occupy all 8 slots permanently, because every honest block that arrives afterwards sorts
    // below them and is evicted the instant it is created. Measured, that took honest delivery from
    // 20/20 payloads to 0/20 and it never recovers. Trading an unauthenticated memory drain for an
    // unauthenticated permanent shutdown is not a fix. LRU has no such fixed point: nothing a peer
    // can put in a header makes its entry preferred, so displacing honest traffic costs it one
    // packet per eviction, continuously, forever.
    //
    // LRU over FIFO: strictly better past the window (540 vs 284, 96 vs 48) because a block being
    // actively assembled keeps refreshing itself, so the victim is genuinely idle rather than
    // merely early. FEWEST-SYMBOLS was the appealing idea and it is the worst: a block that has
    // just started IS the least-progressed one, so the policy evicts exactly the traffic it should
    // be accumulating (444/1600 at a reorder depth of 16). Recorded so it is not re-proposed.
    // Anchor: Belady 1966 / Mattson et al. 1970 — LRU as the standard stack algorithm.
    // ULT-34 is the falsifier for the parking column; ULT-32/33 for the bound.
    //
    // WHAT IS GIVEN UP, stated rather than waved past. Inside the transport's DECLARED envelope
    // this costs exactly nothing — through a reorder depth of 32 packets LRU is identical to the
    // unbounded map at every loss rate measured. Past it there is real loss: at depth 128 the
    // unbounded map delivered 1408 and LRU delivers 540. That regime is already outside what this
    // receiver claims to handle (`MAX_NACK_GAP` = 64 packets is the width it will speak about at
    // all, and a wider gap is reported as DESYNC precisely because there is no state behind it) —
    // but "outside the declared envelope" is a reason to name a cost, not a reason to omit it, so
    // it is filed as 081KZZZH7H4087G0R001HV0W40 rather than buried, with the real repair named
    // there (per-peer block state — the same fix the shared `expectedSeq` already needs). What is
    // NOT the reason: "the NACK already refused to speak for that block". NACKs here update the
    // loss estimate and never trigger retransmission (see the header), so no NACK bound can be what
    // makes an old block unrecoverable — that argument was checked and does not hold.
    //
    // CLOSED: recvBlocks is now keyed on floor(seq/8) and addToBlock uses seq%8
    // (081KZZZH24H087G0R002TXQA15 / ULT-36). The wire still carries the fields;
    // they are no longer an independent address.
    // ── §12: the delivered-once guard, which must OUTLIVE the block ─────────────────────────
    //
    // `ReceiverBlock.recovered` is the duplicate guard, and it lives on the block object — so
    // evicting a block that had already been delivered threw the guard away with it. A straggler
    // then created a FRESH block with `recovered = false`, and if enough of its symbols were still
    // in flight the decoder solved it a second time and `onData` fired again for the same four
    // payloads. Measured on the code before this guard, seeded reorder sweep, 400 blocks / 1600
    // payloads, 0% channel loss: at reorder depth 64, 1672 delivered against 1560 distinct — 112
    // duplicate payloads across 28 blocks; 12 more at depth 128. Zero at depth ≤ 32.
    // (081KZZZGYBR087G0R00302Z2J6. Pre-existing — the unbounded map hit it at depth 128 too — and
    // reachable at half the depth after 081KZYQJPNG087G0R002B9E9S1 bounded the map, because a
    // bounded map necessarily evicts blocks the unbounded one remembered forever. That is the same
    // cost moving from memory onto the guard, and this is where it stops.)
    //
    // WHY A SEPARATE STRUCTURE, rather than retaining the block. A retained block is eight payload
    // references; the fact that a block was delivered is one integer. Widening
    // `RECV_BLOCK_WINDOW` to keep the guard alive would pay for the guard in payload memory, which
    // is the resource 081KZYQJPNG087G0R002B9E9S1 exists to bound — and it would only move the depth
    // at which the guard starts dying, never stop it dying with the object. The bounds answer
    // different questions, so they are different numbers: see `DELIVERED_BLOCK_CAP`.
    //
    // WHY NOT AN EXISTING STRUCTURE. Both bounded receiver-side structures were checked before this
    // one was added, and neither carries the fact:
    //   - `reportedMissing` holds sequence numbers the receiver reported MISSING and has not seen
    //     arrive. It is the complement of what is wanted, and it is emptied by arrival — the exact
    //     event that precedes a delivery.
    //   - `expectedSeq` alone can say a packet is OLDER than the retention window
    //     (`seq < expectedSeq - MAX_NACK_GAP`). That zero-new-state alternative was IMPLEMENTED and
    //     MEASURED rather than argued away, and it does not work: on the same sweep it left the
    //     depth-64 column completely unchanged — 1672 delivered, 1560 distinct, 112 duplicates,
    //     exactly the unfixed numbers. The reason is structural, not a tuning miss: the duplicates
    //     at that depth are produced by stragglers that are still INSIDE `MAX_NACK_GAP`, so an
    //     age test never fires on them. Age and delivery are different predicates, and only one of
    //     them is what §12 is about. (The age test did raise DISTINCT delivery at depth 128/256 —
    //     496 -> 824, 44 -> 280 — by keeping stale traffic out of the LRU window. That is an
    //     eviction-policy observation for 081KZZZH7H4087G0R001HV0W40, not a duplicate guard.)
    //
    // WHY THE KEY IS DERIVED FROM `seq`. `blockSeq` is redundant with `seq` — the encoder sets
    // `seq = blockSeq * BLOCK_TOTAL + pos` — yet the receiver trusts the two fields independently,
    // which is what let 081KZYQJPNG087G0R002B9E9S1 be driven with `seq` monotone and a fresh
    // `blockSeq` per packet, provoking no NACK at all (081KZZZH24H087G0R002TXQA15, filed, open). A
    // guard keyed on `blockSeq` would inherit that key space — 4.29e9 peer-chosen values, none of
    // them bounded by anything the receiver already tracks. Keyed on `seq >> 3` it lives in the key
    // space `expectedSeq`, `reportedMissing` and `MAX_NACK_GAP` are all already built on. The
    // honest consequence of the difference: a peer that DECOUPLES the two fields can make one guard
    // entry cover two blocks it labelled differently, and suppress the second delivery. That is not
    // a new lever — `recvBlocks` is one map shared across all peers with no per-peer state, so a
    // peer can already claim another's `blockSeq` and have `addToBlock` refuse the real one on
    // `packets[pos] !== null`. Same magnitude, and the real repair is per-peer state (named twice
    // above, filed as 081KZZZH7H4087G0R001HV0W40).
    //
    // VICTIM: LEAST-RECENTLY-USED, and for the reason ULT-34 pins for the block map rather than by
    // analogy. Evicting the lowest key here would let a peer PARK the guard — `DELIVERED_BLOCK_CAP`
    // deliveries at the top of the u32 range would hold every slot permanently, and every honest
    // guard entry would be evicted the instant it was created, restoring the defect for anyone but
    // the attacker. Under LRU nothing a peer puts in a header makes its entry preferred, and a
    // straggler for a recently-delivered block REFRESHES that block's guard — which is exactly the
    // traffic pattern the guard exists for, so recency is the right order on the ordinary path too.
    const deliveredKey = Math.floor(header.seq / BLOCK_TOTAL);
    if (this.deliveredBlocks.has(deliveredKey)) {
      // Already delivered, block long gone. Refresh recency — while stragglers keep arriving for
      // this block, the guard it needs stays alive — and drop the packet. Dropping rather than
      // re-creating the block also keeps a dead block out of the recovery window.
      this.deliveredBlocks.delete(deliveredKey);
      this.deliveredBlocks.add(deliveredKey);
      return;
    }

    const { blockSeq, blockPos } = blockAddressOf(header.seq);
    let block = this.recvBlocks.get(blockSeq);
    if (!block) {
      block = makeReceiverBlock(blockSeq);
      this.recvBlocks.set(blockSeq, block);
      // `if`, not `while`: the map grows only here, by one, and this runs on every growth — so it
      // can never be more than one over. A `while` would be a loop whose second iteration no input
      // can reach, i.e. unfalsifiable code standing in for a bound the insertion point already gives.
      if (this.recvBlocks.size > RECV_BLOCK_WINDOW) {
        const lru = this.recvBlocks.keys().next();
        if (lru.done !== true) this.recvBlocks.delete(lru.value);
      }
    } else {
      // Touch: re-insert so this block moves to the tail of the iteration order. Without it the
      // policy is FIFO on creation age, which the table above prices at roughly half the goodput
      // past the window — a block still receiving symbols would age out while genuinely active.
      this.recvBlocks.delete(blockSeq);
      this.recvBlocks.set(blockSeq, block);
    }
    const recovered = addToBlock(block, blockPos, new Uint8Array(payload));
    if (recovered) {
      // Recorded BEFORE the handlers run, so both halves of the guard are set at the same instant.
      // Stated honestly: this ordering is NOT independently observable today — a handler that
      // re-enters this channel with the same block hits `block.recovered` on the still-retained
      // block and is refused there. So no test pins it, and it is written this way because the
      // alternative would depend on the in-window half staying reachable, not because a falsifier
      // demanded it. Noted rather than tested.
      this.deliveredBlocks.add(deliveredKey);
      // Same shape as the block window: `if`, not `while`. The set grows only here, by one, and
      // this runs on every growth, so it can never be more than one over.
      if (this.deliveredBlocks.size > DELIVERED_BLOCK_CAP) {
        const lru = this.deliveredBlocks.values().next();
        if (lru.done !== true) this.deliveredBlocks.delete(lru.value);
      }
      // Deliver data packets to handlers
      for (const dp of recovered) {
        if (dp.length > 0) {
          for (const h of this.dataHandlers) h(dp);
        }
      }
    }
  }
}

// ── XOR-only fallback (for low-bandwidth LoRa/BLE) ───────────────────────────────────────

/** Simple XOR parity block: N data packets → 1 parity packet. Rate: N/(N+1).
 *  Use when bandwidth is very limited (LoRa, BLE) and the [8,4,4] overhead is too high.
 *  Corrects exactly 1 erasure per block of N+1 packets. */
export function xorParityBlock(data: readonly Uint8Array[]): Uint8Array {
  const len = Math.max(...data.map((d) => d.length));
  const parity = new Uint8Array(len);
  for (const d of data) xorBytes(parity, d);
  return parity;
}

export function xorRecoverErasure(data: readonly (Uint8Array | null)[], parity: Uint8Array): Uint8Array | null {
  const erasedCount = data.filter((d) => d === null).length;
  if (erasedCount !== 1) return null;
  const recovered = new Uint8Array(parity);
  for (const d of data) {
    if (d !== null) xorBytes(recovered, d);
  }
  return recovered;
}
