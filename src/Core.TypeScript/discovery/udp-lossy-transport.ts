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
 *       loss (uniform)      0%      5%     10%     20%     30%     40%
 *       [8,4,4]           0.500   0.500   0.500   0.497   0.479   0.388
 *       XOR-7/8           0.875   0.833   0.722   0.409   0.125   0.010
 *
 *   The reason is rate, not capability: at low loss goodput → rate, and 7/8 > 4/8 by
 *   construction, so no decoder can close that gap. Erasure capability only starts paying once
 *   loss is high enough to break the 7/8 code often. Measured crossover (seeded harness):
 *   ~18% uniform loss, ~31% at mean burst length 4. Below it prefer XOR-7/8 REGARDLESS of
 *   bandwidth; above it [8,4,4] wins decisively (at 40% uniform: 0.388 vs 0.010).
 *   Numbers: `udp-lossy-transport.chaos.test.ts` UCH-13 / UCH-13b.
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
 *   - Erasure decoding assumes packets arrive intact or not at all (UDP checksums drop corrupt
 *     datagrams). A corrupt-but-delivered symbol is decoded as if it were correct; the spare
 *     check equation that could detect it is not tested. Named, not handled.
 *   - For higher erasure rates, use a larger code (e.g. [16,8,4] or [32,16,4]).
 *   - The NACK mechanism assumes the NACK channel itself is reliable (e.g. TCP for NACKs,
 *     UDP for data). If NACKs are also lossy, the loss estimate is noisy but still useful.
 *   - The data path is UNAUTHENTICATED: `envelope.zid` is echo suppression, not identity.
 *     Bounding the NACK caps the amplification, it does not remove it — an in-window gap still
 *     costs a broadcast, measured at 33.6x the inbound packet at the bound. Reducing that
 *     further needs a unicast reply to the peer that revealed the gap, which this transport
 *     interface cannot express (it exposes `broadcast` only). Named, not silently accepted.
 *   - Losing more than `MAX_NACK_GAP` consecutive packets produces NO congestion signal. The
 *     single `expectedSeq` is shared across every peer on a broadcast transport, so a wide gap
 *     is not attributable to a sender in the first place; per-peer sequence state is the fix.
 *   - **This transport cannot perceive congestion or corruption, and says so in the type.**
 *     `LossSignal`'s `congestion` and `corruption` cases require evidence values that nothing can
 *     mint here: an integrity check (081KZYP1X3B087G0R001EZ37PQ — there is none) and a queue or
 *     delay signal (there is none). Measured under the BDP harness: reordering is 99.6%
 *     attributable, corruption and congestion are 0%. So separating the signals closes the
 *     reorder door (paced throughput under jitter 20.9 -> 466.2 pkt/s) and does NOT close the
 *     corruption door, which stays exactly where it was until an integrity check exists.
 *     Unattributed loss keeps the classical backoff, which is the conservative direction: not
 *     backing off on it would be ASSUMING corruption, and that error ends in congestion collapse.
 *
 * ## Connection to the Adinkra physics
 *   - The [8,4,4] code is the concrete Adinkra code from AdinkraCode.fs.
 *   - The generator matrix rows are the 4 SUSY generators of the N=4 Adinkra graph.
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
 *  derivation that points at a literal is two magic numbers agreeing by luck. */
const RECV_BLOCK_WINDOW = 8;

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

// ── Packet framing ────────────────────────────────────────────────────────────────────────

export interface LossyPacketHeader {
  readonly seq: number; // global sequence number (monotone)
  readonly blockSeq: number; // block sequence number (seq / BLOCK_TOTAL)
  readonly blockPos: number; // position within block (0..7)
  readonly isData: boolean; // true = data packet (pos 0..3), false = parity (pos 4..7)
  readonly payloadLen: number;
}

/** Encode a packet header + payload into a single Buffer. */
export function encodePacket(header: LossyPacketHeader, payload: Uint8Array): Buffer {
  const hdr = Buffer.alloc(16);
  hdr.writeUInt32BE(header.seq, 0);
  hdr.writeUInt32BE(header.blockSeq, 4);
  hdr.writeUInt8(header.blockPos, 8);
  hdr.writeUInt8(header.isData ? 1 : 0, 9);
  hdr.writeUInt32BE(header.payloadLen, 10);
  // 2 bytes padding for alignment
  return Buffer.concat([hdr, Buffer.from(payload)]);
}

/** Decode a packet from a Buffer. Returns null if the buffer is too short. */
export function decodePacket(buf: Buffer): { header: LossyPacketHeader; payload: Uint8Array } | null {
  if (buf.length < 16) return null;
  const seq = buf.readUInt32BE(0);
  const blockSeq = buf.readUInt32BE(4);
  const blockPos = buf.readUInt8(8);
  const isData = buf.readUInt8(9) === 1;
  const payloadLen = buf.readUInt32BE(10);
  if (buf.length < 16 + payloadLen) return null;
  const payload = new Uint8Array(buf.buffer, buf.byteOffset + 16, payloadLen);
  return { header: { seq, blockSeq, blockPos, isData, payloadLen }, payload };
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
declare const CORRUPTION_EVIDENCE: unique symbol;

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
 * Evidence that a frame was corrupted: a checksum or MAC that rejected it.
 *
 * **NOT CONSTRUCTIBLE TODAY** for the same reason and by the same mechanism -
 * 081KZYP1X3B087G0R001EZ37PQ: this transport has no integrity check at all. Erase one packet,
 * flip one bit of parity, and `recoverAdinkraBlock` returns non-null WRONG bytes silently. Until
 * that work-item lands, corruption is not something this receiver can perceive, and the honest
 * consequence is that corruption loss arrives here as `unknown`.
 */
export interface CorruptionEvidence {
  readonly [CORRUPTION_EVIDENCE]: true;
  readonly source: string;
}

/**
 * A loss report, with its cause attached — the typed replacement for a bare rate.
 *
 * What can be attributed HONESTLY, and by what:
 *
 *   - `reorder`   — a sequence number the receiver REPORTED missing that then ARRIVED. The
 *                   receiver observes this directly; it is the one attribution this transport can
 *                   make today, and it is the one RFC 4653 is about.
 *   - `corruption` — needs an integrity check (`CorruptionEvidence`). Not available.
 *   - `congestion` — needs a queue or delay signal (`CongestionEvidence`). Not available.
 *   - `unknown`   — an erasure whose cause the receiver cannot see. **A first-class case, not a
 *                   dumping ground:** it is the honest name for the union {congestion,
 *                   corruption} that this transport cannot split. Under the BDP harness it is
 *                   where essentially all real loss lands, and saying that plainly is worth more
 *                   than a taxonomy that pretends.
 *
 * SECURITY, named because it is a new lever on an existing hole: the data path is
 * UNAUTHENTICATED (see "Honest boundary"), so a peer can claim `reorder` and suppress a sender's
 * backoff. It could already fabricate NACKs to *cause* backoff; this is the same hole with the
 * opposite sign, and it is not closed by this change. Authenticating the control channel is what
 * closes it.
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
 * Retract a loss that turned out to be a reordered packet: the receiver reported these sequence
 * numbers missing and then watched them arrive.
 *
 * Two effects, and the second is the one that matters. The counts move from `unknown` to
 * `reorder` — a Z-set correction, +1 then −1, not a duplicate guard. And if the decrease those
 * sequence numbers caused would NOT have fired without them, the gap is restored. The decision is
 * RECOMPUTED, never merely inverted, so a decrease that was justified by other losses stands.
 *
 * §12 idempotency: retracting the same sequence twice is a no-op, because the retracted numbers
 * leave `suspectSeqs` on the first call and the record is cleared once it is reversed.
 */
export function retractLoss(state: AimdState, seqs: readonly number[]): AimdState {
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
  // only `removed` can be subtracted from `unknown` — but both are genuinely reorder, and the
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
    reorder: state.lossByCause.reorder + attributed,
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
export function scheduleGossipRebroadcast(
  fn: () => void,
  jitterMinMs = JITTER_MIN_MS,
  jitterMaxMs = JITTER_MAX_MS,
): () => void {
  const delay = jitterMinMs + Math.random() * (jitterMaxMs - jitterMinMs);
  const handle = setTimeout(fn, delay);
  return () => clearTimeout(handle);
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
  private dataHandlers: Array<(payload: Uint8Array) => void> = [];
  private lossHandlers: Array<(rates: readonly LossRate[]) => void> = [];
  private envelopeHandlers: Array<(envelope: ErrorEnvelope) => void> = [];
  private desyncHandlers: Array<(event: DesyncEvent) => void> = [];
  private reorderHandlers: Array<(seqs: readonly number[]) => void> = [];
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
      if (claimed === "reorder") {
        this.aimd = retractLoss(this.aimd, seqs);
      } else {
        // `corruption` and `congestion` are unreachable here by construction — neither evidence
        // type can be minted (see `CongestionEvidence`) — so every non-retraction report is
        // `unknown`. When 081KZYP1X3B lands, this is where the integrity verdict arrives.
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
    if (!decoded) return;

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

    // Add to receiver block
    let block = this.recvBlocks.get(header.blockSeq);
    if (!block) {
      block = makeReceiverBlock(header.blockSeq);
      this.recvBlocks.set(header.blockSeq, block);
    }
    const recovered = addToBlock(block, header.blockPos, new Uint8Array(payload));
    if (recovered) {
      // Deliver data packets to handlers
      for (const dp of recovered) {
        if (dp.length > 0) {
          for (const h of this.dataHandlers) h(dp);
        }
      }
      // Clean up old blocks (keep last RECV_BLOCK_WINDOW). This retention window is what
      // MAX_NACK_GAP is derived from — the two must not drift apart, hence the shared constant.
      const keys = [...this.recvBlocks.keys()].sort((a, b) => a - b);
      for (const k of keys.slice(0, Math.max(0, keys.length - RECV_BLOCK_WINDOW))) {
        this.recvBlocks.delete(k);
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
