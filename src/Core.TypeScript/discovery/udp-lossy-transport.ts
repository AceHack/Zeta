/**
 * udp-lossy-transport.ts — Lossy UDP bidirectional transport with Adinkra [8,4,4] erasure coding.
 *
 * ## Design
 *
 * The core insight (from ferry-25 and the echolocation analogy):
 *   - Your outbound signal is noise to your own inbound channel.
 *   - ECC lets you recover dropped packets without retransmitting (no extra noise).
 *   - The Adinkra [8,4,4] extended Hamming code is the right ECC: doubly-even, self-dual,
 *     minimum distance 4, corrects 1 erasure per block of 8 packets.
 *   - The same code that generates the E8 lattice (via Construction A) is the transport layer.
 *     That is the homoiconic property: the code IS the algebra IS the transport.
 *
 * ## Protocol
 *
 * ### Erasure coding (Adinkra [8,4,4])
 *   - Every 4 data packets → 4 parity packets (8 total per block).
 *   - Generator matrix G = [I₄ | A] in systematic form (same as AdinkraCode.fs).
 *   - Any 1 erasure in a block of 8 is recoverable from the remaining 7.
 *   - Rate: 4/8 = 0.5 (50% overhead). For high-bandwidth UDP this is acceptable;
 *     for low-bandwidth LoRa/BLE, use the XOR-only fallback (rate 7/8).
 *
 * ### Adaptive backoff (AIMD — Additive Increase, Multiplicative Decrease)
 *   - Measure packet loss rate: NACK count / send count over a sliding window.
 *   - If loss > HIGH_LOSS_THRESHOLD: double the inter-packet gap (multiplicative decrease).
 *   - If loss < LOW_LOSS_THRESHOLD: subtract GAP_STEP from the gap (additive increase).
 *   - This is the same algorithm as TCP congestion control, but for UDP.
 *   - The echolocation analogy: back off when the channel is saturated (your signal drowns
 *     out your return echo). Increase when the channel is clear.
 *
 * ### Debounce on gossip re-broadcast
 *   - Anti-entropy re-broadcasts use a random jitter window (50–200ms) to prevent
 *     broadcast storms on WiFi mesh. Same principle as the bat's duty cycle.
 *
 * ### Sequence numbers + NACK
 *   - Each packet has a sequence number. The receiver sends a NACK for any gap.
 *   - NACKs update the loss estimate (not for immediate retransmit — ECC handles that).
 *   - The sender uses NACKs to adjust the inter-packet gap via AIMD.
 *
 * ## Honest boundary
 *   - The [8,4,4] code corrects 1 erasure per block. If 2+ packets drop in the same
 *     block of 8, the block is unrecoverable (the receiver marks it as lost and moves on).
 *   - For higher erasure rates, use a larger code (e.g. [16,8,4] or [32,16,4]).
 *   - The NACK mechanism assumes the NACK channel itself is reliable (e.g. TCP for NACKs,
 *     UDP for data). If NACKs are also lossy, the loss estimate is noisy but still useful.
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

/** Recover a single erased packet from the remaining 7 in a block of 8.
 *  Returns the recovered packet, or null if more than 1 erasure.
 *
 *  The [8,4,4] code has minimum distance 4, so it can correct 1 erasure.
 *  Recovery: find the unique codeword consistent with the 7 received packets.
 *  For a systematic code [I₄|A], recovery is:
 *    - If the erased position is a data position i: recover d_i from the parity equations.
 *    - If the erased position is a parity position j: recompute p_j from the data.
 */
export function recoverAdinkraErasure(
  block: (Uint8Array | null)[], // length 8, one null = erased
): Uint8Array | null {
  if (block.length !== BLOCK_TOTAL) return null;
  const erasedIdx = block.findIndex((p) => p === null);
  if (erasedIdx === -1) return null; // no erasure
  const erasedCount = block.filter((p) => p === null).length;
  if (erasedCount > 1) return null; // too many erasures for [8,4,4]

  const sample = block.find((p) => p !== null);
  if (!sample) return null;
  const len = sample.length;
  const recovered = new Uint8Array(len);

  if (erasedIdx < BLOCK_DATA) {
    // Erased data packet: recover from parity equations.
    // For data position i: d_i = XOR of parity packets p_j where G[i][4+j] = 1,
    //                            XOR of data packets d_k where G[k][4+j] = 1 and k ≠ i.
    // Simplified: use the first parity equation that involves d_i.
    const i = erasedIdx;
    for (let j = 0; j < BLOCK_DATA; j++) {
      if (ADINKRA_G[i]![4 + j] === 1) {
        // p_j = XOR of d_k where G[k][4+j] = 1
        // d_i = p_j XOR (XOR of d_k for k ≠ i where G[k][4+j] = 1)
        const pj = block[4 + j];
        if (!pj) continue; // this parity is also erased, try next
        recovered.set(pj);
        for (let k = 0; k < BLOCK_DATA; k++) {
          if (k !== i && ADINKRA_G[k]![4 + j] === 1) {
            const dk = block[k];
            if (dk) xorBytes(recovered, dk);
          }
        }
        return recovered;
      }
    }
    return null; // shouldn't happen for [8,4,4]
  } else {
    // Erased parity packet: recompute from data.
    const j = erasedIdx - BLOCK_DATA;
    for (let i = 0; i < BLOCK_DATA; i++) {
      if (ADINKRA_G[i]![4 + j] === 1) {
        const di = block[i];
        if (di) xorBytes(recovered, di);
      }
    }
    return recovered;
  }
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

// ── NACK message ─────────────────────────────────────────────────────────────────────────

/** Inferred cause of packet loss — feeds the DimensionalBnn transport factor. */
export type LossCause = "congestion" | "corruption" | "timeout" | "unknown";

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
  /** Inferred cause of the loss — feeds the DimensionalBnn transport factor. */
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
  const validCause =
    candidate.cause === "congestion" ||
    candidate.cause === "corruption" ||
    candidate.cause === "timeout" ||
    candidate.cause === "unknown";
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

/** Sequence-only NACK represented by the compact binary codec. */
export type DecodedNackMessage = Pick<NackMessage, "type" | "missingSeqs">;

export function encodeNack(nack: NackMessage): Buffer {
  const buf = Buffer.alloc(4 + nack.missingSeqs.length * 4);
  buf.writeUInt32BE(nack.missingSeqs.length, 0);
  for (let i = 0; i < nack.missingSeqs.length; i++) {
    buf.writeUInt32BE(nack.missingSeqs[i]!, 4 + i * 4);
  }
  return buf;
}

export function decodeNack(buf: Buffer): DecodedNackMessage | null {
  if (buf.length < 4) return null;
  const count = buf.readUInt32BE(0);
  if (buf.length < 4 + count * 4) return null;
  const missingSeqs: number[] = [];
  for (let i = 0; i < count; i++) missingSeqs.push(buf.readUInt32BE(4 + i * 4));
  return { type: "nack", missingSeqs };
}

// ── AIMD congestion controller ────────────────────────────────────────────────────────────

export interface AimdState {
  gapMs: number; // current inter-packet gap (ms)
  sentCount: number; // packets sent in the current window
  nackCount: number; // NACKs received in the current window
  windowStart: number; // timestamp of window start
}

export function makeAimdState(initialGapMs = 10): AimdState {
  return { gapMs: initialGapMs, sentCount: 0, nackCount: 0, windowStart: Date.now() };
}

/** Update the AIMD state after receiving a NACK. Returns the new state. */
export function onNack(state: AimdState, nackCount: number): AimdState {
  const s = { ...state, nackCount: state.nackCount + nackCount };
  return updateAimd(s);
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
  const lossRate = state.nackCount / state.sentCount;
  let gapMs = state.gapMs;
  if (lossRate > HIGH_LOSS_THRESHOLD) {
    // Multiplicative decrease: double the gap (back off like a bat going quiet)
    gapMs = Math.min(MAX_GAP_MS, gapMs * 2);
  } else if (lossRate < LOW_LOSS_THRESHOLD) {
    // Additive increase: reduce the gap by GAP_STEP_MS
    gapMs = Math.max(MIN_GAP_MS, gapMs - GAP_STEP_MS);
  }
  return { gapMs, sentCount: 0, nackCount: 0, windowStart: Date.now() };
}

/** The current loss rate estimate (0..1). */
export function lossRate(state: AimdState): number {
  return state.sentCount > 0 ? state.nackCount / state.sentCount : 0;
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
 *  the block is now complete (or recoverable), or null if more packets are needed. */
export function addToBlock(block: ReceiverBlock, pos: number, payload: Uint8Array): Uint8Array[] | null {
  if (block.packets[pos] !== null) return null; // duplicate
  block.packets[pos] = payload;
  block.receivedCount++;

  // Check if we have all 4 data packets (no erasure needed)
  const dataComplete = block.packets.slice(0, BLOCK_DATA).every((p) => p !== null);
  if (dataComplete && !block.recovered) {
    block.recovered = true;
    return block.packets.slice(0, BLOCK_DATA) as Uint8Array[];
  }

  // Check if we have 7 of 8 packets (1 erasure, recoverable by [8,4,4])
  if (block.receivedCount === BLOCK_TOTAL - 1 && !block.recovered) {
    const erasedIdx = block.packets.findIndex((p) => p === null);
    const recovered = recoverAdinkraErasure(block.packets);
    if (recovered !== null) {
      block.packets[erasedIdx] = recovered;
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
 *    ch.onLossRate(rate => { ... });            // called after each AIMD window
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
  private dataHandlers: Array<(payload: Uint8Array) => void> = [];
  private lossHandlers: Array<(rate: number) => void> = [];
  private envelopeHandlers: Array<(envelope: ErrorEnvelope) => void> = [];
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
  onLossRate(h: (rate: number) => void): void {
    this.lossHandlers.push(h);
  }
  /** Called when a teaching NACK envelope is emitted (for logging / UI). */
  onEnvelope(h: (envelope: ErrorEnvelope) => void): void {
    this.envelopeHandlers.push(h);
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
      // Teaching NACK received: update AIMD loss estimate + absorb into BNN
      const prevRate = lossRate(this.aimd);
      this.aimd = onNack(this.aimd, envelope.nack.length);
      const newRate = lossRate(this.aimd);
      if (newRate !== prevRate) {
        for (const h of this.lossHandlers) h(newRate);
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
    // Check for sequence gaps → send NACK
    if (header.seq > this.expectedSeq) {
      const missing: number[] = [];
      for (let s = this.expectedSeq; s < header.seq; s++) missing.push(s);
      if (missing.length > 0) {
        // Infer cause from AIMD state: high loss rate → congestion, else unknown
        const lr = lossRate(this.aimd);
        const cause: LossCause = lr > 0.1 ? "congestion" : lr > 0.02 ? "timeout" : "unknown";
        const howToFix =
          cause === "congestion"
            ? "reduce send rate: increase inter-packet gap by 2x"
            : cause === "timeout"
              ? "increase block size timeout: wait 50ms before declaring erasure"
              : "retry with smaller block size (2 data + 2 parity)";
        const teachingNack: NackMessage = {
          type: "nack",
          missingSeqs: missing,
          cause,
          why: `${missing.length} packet(s) missing in sequence [${missing[0]}..${missing[missing.length - 1]}]; inferred cause: ${cause}`,
          howToFix,
          retractableBeliefId: missing.map((s) => `received:seq=${s}:zid=${this.myZid}`).join(","),
        };
        const nackEnv = JSON.stringify({
          type: "lossy-udp-nack",
          zid: this.myZid,
          nack: missing,
          teaching: teachingNack,
        });
        this.transport.broadcast(nackEnv);
      }
    }
    this.expectedSeq = Math.max(this.expectedSeq, header.seq + 1);

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
      // Clean up old blocks (keep last 8)
      const keys = [...this.recvBlocks.keys()].sort((a, b) => a - b);
      for (const k of keys.slice(0, Math.max(0, keys.length - 8))) {
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
