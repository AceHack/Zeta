// key-epoch-ledger.ts — revocation as a G-set: verifiers LEARN a key was retired,
// under partition, with no online responder and no coordination.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// WHAT THIS IS FOR
// ============================================================================
//
// frost-delta-rotation.ts makes an old share MATHEMATICALLY dead: the key moved
// to A' = A + [delta]B and nothing was asked of the revoked party. That is the
// immediate half. The other half is knowledge: a relying party still pinned to A
// keeps accepting A-signed material until it hears otherwise. This module is the
// hearing.
//
// Aaron 2026-08-14: "can we not save a revocation list that communicated out
// over time? i think some protocols do this." They do — CRL, OCSP, Certificate
// Transparency. The shape worth copying is the one they share and rarely name:
// YOU ONLY EVER ADD A REVOCATION, NEVER REMOVE ONE. That is a grow-only set —
// idempotent, commutative, associative — so replicas converge with no
// coordination, no ordering, no responder. OCSP needs an online responder and
// therefore fails exactly when you most need it; a G-set is at its best under
// exactly the partition that breaks OCSP, which is why it is the right shape for
// a Reticulum/LoRa mesh and not merely the locally-available one.
//
// So the ledger is literally `src/Core.TypeScript/g-set` over canonically
// encoded signed transitions. No new list format was invented; the repo's
// bottom-rung CRDT already is one, and the convergence laws it already tests are
// the laws this needs.
//
// ============================================================================
// THE THREE PROPERTIES THAT MAKE A GROW-ONLY SET SAFE HERE
// ============================================================================
//
// 1. ADMISSION IS A PURE FUNCTION OF THE ELEMENT. `admit` checks a signature
//    against the key NAMED INSIDE THE ELEMENT. It consults no ledger state, no
//    chain position, no clock. This is not a stylistic choice: an admission test
//    that depended on what the replica already knew would make merge
//    ORDER-DEPENDENT (epoch 5 arriving before epoch 4 would be dropped and never
//    re-offered) and the CRDT laws would be a lie. Interpretation is a separate,
//    pure fold over the whole set — see `foldChain`.
//
// 2. ELEMENTS ARE SELF-AUTHENTICATING AND BOUNDED. Grow-only plus unauthenticated
//    is a flood: anyone could add "revoke everything" forever. Every element
//    carries a signature and a bounded encoding (keyId <= 128 bytes, reason <=
//    512 bytes), so an attacker with no key cannot enter anything, and an
//    attacker with a key cannot enter anything unboundedly large.
//
// 3. NO WALL CLOCK TOUCHES THE FOLD. `foldChain` is a pure function of (pin,
//    element set) ordered by LOGICAL epoch. A replica's local clock steers only
//    local behaviour — see `freshnessAction`, which decides whether THIS replica
//    fails closed, and never filters what enters the shared fold. That boundary
//    is `.claude/rules/local-time-never-enters-the-shared-fold.md`; two replicas
//    with different receive times must fold the same evidence set or they
//    diverge.
//
// ============================================================================
// WHY THE CHAIN, AND WHERE IT BREAKS
// ============================================================================
//
// A transition statement is signed by the OLD quorum over the NEW key. A relying
// party pinned at epoch n therefore verifies its way forward to epoch n+k
// instead of re-pinning out of band. At 20 sites the cold re-pin is what makes
// rotation too expensive to do promptly, and slow rotation IS the vulnerability.
//
// The chain inherits the weakest link, and that is not a detail:
//
//   * Adversary with t-1 old shares: cannot sign any transition. The chain holds.
//   * Adversary with t old shares (the old key is fully compromised): it CAN sign
//     a competing transition at the same epoch, to a key it controls. The chain
//     does not stop this. What stops it is that the honest quorum also signs one,
//     both are self-authenticating, both land in a set that never forgets, and
//     `foldChain` returns `forked` rather than picking a winner. Equivocation
//     becomes evidence instead of a silent takeover. A verifier that sees a fork
//     must fall back to an out-of-band re-pin — the expensive path, now reserved
//     for the case that actually needs it.
//
// AUTHORIZATION IS THE QUORUM'S OWN SIGNATURE. There is no human-only key
// anywhere in this module and there must not be one. Manifesto Sec.3 weight-free:
// a permanent human-only privilege is capture, and `.claude/rules/no-directives.md`
// records human-only authorization as explicitly provisional. It is also simply
// wrong operationally: if rotation needs a human, incident response runs at human
// latency and the attacker wins. Symmetry and speed are the same property.
//
// DEPENDENCY, NOT SOLVED HERE: confidential transport for the rotation subshares
// (headscale/tailscale, WireGuard). This module moves only PUBLIC artifacts —
// statements and signatures — so it is safe on an open gossip channel by design.
//
// Anchors (Beacon): Shapiro, Preguica, Baquero & Zawirski, "Conflict-free
// Replicated Data Types" (SSS 2011) — G-set as the canonical state-based CRDT.
// Laurie, Langley & Kasper, RFC 6962 Certificate Transparency — append-only log
// + self-authenticating misbehaviour evidence. RFC 5280 Sec.5 (CRL) and RFC 6960
// (OCSP) — the add-only revocation shape and the online-responder failure mode.
// Lamport, Shostak & Pease (1982) — equivocation as the adversary's move.

import { ed25519 } from "@noble/curves/ed25519.js";
import { add as gsetAdd, ofArray, stringCompare, union } from "../../../src/Core.TypeScript/g-set/g-set.ts";
import type { GSet } from "../../../src/Core.TypeScript/g-set/g-set.ts";
import { frostThresholdSign, type FrostKeyShare } from "./frost.ts";

const MAX_KEY_ID_BYTES = 128;
const MAX_REASON_BYTES = 512;
const DOMAIN = new TextEncoder().encode("zeta-key-transition-v1");

/**
 * One rotation, stated so that a party holding only the previous key can check
 * it. Small on purpose: the ceremony transcript is referenced by digest, not
 * embedded, so a statement plus signature is ~200 bytes and fits one
 * LXMF/Reticulum packet. Over a mesh that is the difference between a
 * revocation that propagates and one that does not.
 */
export interface KeyTransition {
  /** Stable identifier of the group (wallet / CA), not of any key. */
  readonly keyId: string;
  /** Strictly increasing, >= 1. The pinned genesis is epoch 0. */
  readonly epoch: number;
  /** 32-byte group public key BEFORE this rotation. */
  readonly prevGroupPublicKey: Uint8Array;
  /** 32-byte group public key AFTER this rotation. */
  readonly nextGroupPublicKey: Uint8Array;
  /** Holder indices retired here. Strictly ascending, each >= 1. */
  readonly retiredIndices: readonly number[];
  /** 32-byte `hashRotationTranscript` of the ceremony that produced next. */
  readonly transcriptHash: Uint8Array;
  /** Free text, bounded. Operator context; carries no authority. */
  readonly reason: string;
}

/** A transition plus the OLD quorum's 64-byte threshold signature over it. */
export interface SignedTransition {
  readonly statement: KeyTransition;
  readonly signature: Uint8Array;
}

/** Where a relying party starts. Epoch 0 with the key it was originally given. */
export interface KeyPin {
  readonly keyId: string;
  readonly epoch: number;
  readonly groupPublicKey: Uint8Array;
}

/** The ledger: a grow-only set of canonically hex-encoded signed transitions. */
export type RevocationLedger = GSet<string>;

// ── canonical encoding ──────────────────────────────────────────────────────
// Injective and length-prefixed, so hex equality IS statement equality. That is
// what makes G-set dedup correct and makes "two different statements at the same
// epoch" a decidable, byte-level fact rather than a judgement call.

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function toHex(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

function fromHex(s: string): Uint8Array {
  if (s.length % 2 !== 0) throw new Error("key-epoch-ledger: odd-length hex");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isInteger(byte)) throw new Error("key-epoch-ledger: bad hex");
    out[i] = byte;
  }
  return out;
}

/**
 * The exact bytes a quorum signs. Refuses non-canonical input rather than
 * repairing it: unsorted or duplicated `retiredIndices` would give two encodings
 * of the same intent, which would defeat both the G-set dedup and the
 * equivocation check.
 */
export function encodeTransition(t: KeyTransition): Uint8Array {
  const enc = new TextEncoder();
  const keyId = enc.encode(t.keyId);
  const reason = enc.encode(t.reason);
  if (keyId.length > MAX_KEY_ID_BYTES) throw new Error("key-epoch-ledger: keyId too long");
  if (reason.length > MAX_REASON_BYTES) throw new Error("key-epoch-ledger: reason too long");
  if (!Number.isInteger(t.epoch) || t.epoch < 1) {
    throw new Error("key-epoch-ledger: epoch must be an integer >= 1");
  }
  if (t.prevGroupPublicKey.length !== 32 || t.nextGroupPublicKey.length !== 32) {
    throw new Error("key-epoch-ledger: group public keys must be 32 bytes");
  }
  if (t.transcriptHash.length !== 32) {
    throw new Error("key-epoch-ledger: transcriptHash must be 32 bytes");
  }
  for (let i = 0; i < t.retiredIndices.length; i++) {
    const x = t.retiredIndices[i] as number;
    if (!Number.isInteger(x) || x < 1) {
      throw new Error("key-epoch-ledger: retired index must be an integer >= 1");
    }
    if (i > 0 && x <= (t.retiredIndices[i - 1] as number)) {
      throw new Error("key-epoch-ledger: retiredIndices must be strictly ascending");
    }
  }
  return concat([
    DOMAIN,
    u32(keyId.length),
    keyId,
    u32(t.epoch),
    t.prevGroupPublicKey,
    t.nextGroupPublicKey,
    t.transcriptHash,
    u32(t.retiredIndices.length),
    ...t.retiredIndices.map((x) => u32(x)),
    u32(reason.length),
    reason,
  ]);
}

/** Canonical ledger element: hex of (len||statement||len||signature). */
export function encodeSignedTransition(st: SignedTransition): string {
  const stmt = encodeTransition(st.statement);
  if (st.signature.length !== 64) throw new Error("key-epoch-ledger: signature must be 64 bytes");
  return toHex(concat([u32(stmt.length), stmt, u32(st.signature.length), st.signature]));
}

/** Strict inverse of {@link encodeSignedTransition}. Throws on any surplus byte. */
export function decodeSignedTransition(hex: string): SignedTransition {
  const buf = fromHex(hex);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 0;
  const need = (n: number): void => {
    if (o + n > buf.length) throw new Error("key-epoch-ledger: truncated element");
  };
  need(4);
  const stmtLen = dv.getUint32(o, true);
  o += 4;
  need(stmtLen);
  const stmt = buf.subarray(o, o + stmtLen);
  o += stmtLen;
  need(4);
  const sigLen = dv.getUint32(o, true);
  o += 4;
  need(sigLen);
  const signature = buf.slice(o, o + sigLen);
  o += sigLen;
  if (o !== buf.length) throw new Error("key-epoch-ledger: trailing bytes");
  if (sigLen !== 64) throw new Error("key-epoch-ledger: signature must be 64 bytes");

  // statement
  let p = 0;
  const sv = new DataView(stmt.buffer, stmt.byteOffset, stmt.byteLength);
  const take = (n: number): Uint8Array => {
    if (p + n > stmt.length) throw new Error("key-epoch-ledger: truncated statement");
    const r = stmt.slice(p, p + n);
    p += n;
    return r;
  };
  const dom = take(DOMAIN.length);
  for (let i = 0; i < DOMAIN.length; i++) {
    if (dom[i] !== DOMAIN[i]) throw new Error("key-epoch-ledger: wrong domain separator");
  }
  const u32at = (): number => {
    if (p + 4 > stmt.length) throw new Error("key-epoch-ledger: truncated statement");
    const v = sv.getUint32(p, true);
    p += 4;
    return v;
  };
  const dec = new TextDecoder("utf-8", { fatal: true });
  const keyId = dec.decode(take(u32at()));
  const epoch = u32at();
  const prevGroupPublicKey = take(32);
  const nextGroupPublicKey = take(32);
  const transcriptHash = take(32);
  const nRetired = u32at();
  if (nRetired > stmt.length) throw new Error("key-epoch-ledger: implausible retired count");
  const retiredIndices: number[] = [];
  for (let i = 0; i < nRetired; i++) retiredIndices.push(u32at());
  const reason = dec.decode(take(u32at()));
  if (p !== stmt.length) throw new Error("key-epoch-ledger: trailing statement bytes");

  const statement: KeyTransition = {
    keyId,
    epoch,
    prevGroupPublicKey,
    nextGroupPublicKey,
    retiredIndices,
    transcriptHash,
    reason,
  };
  // Re-encode: rejects any element whose bytes are not the canonical encoding of
  // what they decode to (non-canonical retired order, out-of-range epoch, ...).
  if (encodeSignedTransition({ statement, signature }) !== hex) {
    throw new Error("key-epoch-ledger: non-canonical element");
  }
  return { statement, signature };
}

// ── signing + admission ─────────────────────────────────────────────────────

/**
 * OLD QUORUM STEP. Threshold-sign the transition under the PREVIOUS group key.
 *
 * The authorization for a rotation is exactly this: t of the current holders,
 * whoever they are. No human-only key is required, accepted, or checkable here,
 * and adding one would be capture (manifesto Sec.3) as well as the reason
 * incident response would run at human latency.
 */
export function signTransition(
  statement: KeyTransition,
  quorumShares: readonly FrostKeyShare[],
  threshold: number,
  random?: () => number,
): SignedTransition {
  const payload = encodeTransition(statement);
  const signature = frostThresholdSign(
    statement.prevGroupPublicKey,
    quorumShares,
    payload,
    random,
    threshold,
  );
  return { statement, signature };
}

/**
 * ADMISSION — a PURE function of the element. Verifies the signature against the
 * key named inside the element, and nothing else. Consults no ledger, no chain
 * position, no clock (see header property 1: anything else breaks merge
 * commutativity). Returns false rather than throwing on malformed input.
 */
export function admit(element: string): boolean {
  let st: SignedTransition;
  try {
    st = decodeSignedTransition(element);
  } catch {
    return false;
  }
  try {
    return ed25519.verify(
      st.signature,
      encodeTransition(st.statement),
      st.statement.prevGroupPublicKey,
    );
  } catch {
    return false;
  }
}

/** The empty ledger. */
export function emptyLedger(): RevocationLedger {
  return ofArray(stringCompare, []);
}

/**
 * Add one element if it is admissible. Idempotent: re-adding a present element
 * returns an equal ledger (G-set `union` with a singleton).
 */
export function ledgerAdd(ledger: RevocationLedger, element: string): RevocationLedger {
  if (!admit(element)) return ledger;
  return gsetAdd(stringCompare, element, ledger);
}

/**
 * The CRDT merge. Idempotent, commutative, associative — inherited verbatim from
 * `src/Core.TypeScript/g-set`, which is why this file adds no lattice of its own.
 * Both sides are re-filtered through `admit` so a peer cannot smuggle an
 * inadmissible element in via a merge that skipped `ledgerAdd`.
 */
export function ledgerMerge(a: RevocationLedger, b: RevocationLedger): RevocationLedger {
  const filtered = ofArray(
    stringCompare,
    union(stringCompare, a, b).filter((e) => admit(e)),
  );
  return filtered;
}

/** Convenience: build a ledger from raw elements, dropping inadmissible ones. */
export function ledgerOf(elements: readonly string[]): RevocationLedger {
  return ofArray(
    stringCompare,
    elements.filter((e) => admit(e)),
  );
}

// ── the fold ────────────────────────────────────────────────────────────────

/**
 * The canonical identity of a transition, IGNORING the signature.
 *
 * This distinction is load-bearing, and getting it wrong was a live bug in the
 * first draft of this file. FROST signing is randomised, so the same quorum
 * signing the same statement twice yields two different 64-byte signatures and
 * therefore two different ledger elements. A fold that asked "are there two
 * distinct ELEMENTS at this epoch?" would report a FORK on every re-sign or
 * coordinator retry — a revocation mechanism crying compromise at its own
 * retries, which is the worst failure this class can have. Equivocation is two
 * distinct STATEMENTS, never two encodings of one.
 *
 * It also gives the ledger a sound local compaction: the fold is a pure function
 * of the set of STATEMENTS, so a replica may keep one element per statement key
 * without changing any answer. That is a homomorphism onto a coarser lattice,
 * not an eviction from a grow-only set.
 */
export function statementKey(t: KeyTransition): string {
  return toHex(encodeTransition(t));
}

export type ChainFold =
  | {
      readonly status: "current";
      readonly keyId: string;
      readonly epoch: number;
      readonly groupPublicKey: Uint8Array;
      /** Union of every retiredIndices along the followed chain — grow-only. */
      readonly retiredIndices: readonly number[];
      /** How many transitions were followed from the pin. */
      readonly advanced: number;
    }
  | {
      readonly status: "forked";
      readonly keyId: string;
      /** The epoch at which two distinct valid transitions share a predecessor. */
      readonly epoch: number;
      /**
       * The conflicting STATEMENT keys ({@link statementKey}), canonically
       * sorted. Statements, not elements: two signatures over one statement are
       * one transition, not a fork.
       */
      readonly candidates: readonly string[];
      /** The last key the chain agreed on before the fork. */
      readonly groupPublicKey: Uint8Array;
    };

/**
 * Walk the pin forward through the ledger. A pure function of (pin, set): no
 * clock, no arrival order, no network. Two replicas holding the same set compute
 * the same answer, which is the whole reason the set is a lattice.
 *
 * Returns `forked` — never a winner — when two distinct valid transitions extend
 * the same key at the same epoch. Picking a winner is exactly the move that lets
 * an attacker who reached the old threshold take the chain over quietly. The
 * mechanism reports the neutral fact; policy decides what a fork means
 * (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`).
 */
export function foldChain(pin: KeyPin, ledger: RevocationLedger): ChainFold {
  const decoded = ledger
    .map((e) => {
      try {
        return { element: e, st: decodeSignedTransition(e) };
      } catch {
        return undefined;
      }
    })
    .filter((x): x is { element: string; st: SignedTransition } => x !== undefined)
    .filter((x) => x.st.statement.keyId === pin.keyId);

  let epoch = pin.epoch;
  let key = pin.groupPublicKey;
  const retired = new Set<number>();
  let advanced = 0;

  // Each step consumes a strictly higher epoch, so this cannot loop more times
  // than there are elements.
  for (let guard = 0; guard <= decoded.length; guard++) {
    const next = decoded.filter(
      (x) =>
        x.st.statement.epoch === epoch + 1 &&
        toHex(x.st.statement.prevGroupPublicKey) === toHex(key),
    );
    if (next.length === 0) {
      return {
        status: "current",
        keyId: pin.keyId,
        epoch,
        groupPublicKey: key,
        retiredIndices: [...retired].sort((a, b) => a - b),
        advanced,
      };
    }
    // Distinct STATEMENTS, not distinct elements — see statementKey.
    const distinct = ofArray(
      stringCompare,
      next.map((x) => statementKey(x.st.statement)),
    );
    if (distinct.length > 1) {
      return {
        status: "forked",
        keyId: pin.keyId,
        epoch: epoch + 1,
        candidates: distinct,
        groupPublicKey: key,
      };
    }
    const chosen = next[0] as { element: string; st: SignedTransition };
    for (const r of chosen.st.statement.retiredIndices) retired.add(r);
    key = chosen.st.statement.nextGroupPublicKey;
    epoch += 1;
    advanced += 1;
  }
  // Unreachable given the guard bound; kept as a refusal rather than a silent
  // wrong answer.
  throw new Error("key-epoch-ledger: chain walk exceeded the element count");
}

/**
 * Report every epoch at which two distinct admissible transitions extend the
 * SAME predecessor key. The neutral fact only: an equivocation over a key the
 * caller does not trust is meaningless, so a caller that has not established
 * that `prevGroupPublicKey` is on its own chain has learned nothing. Use
 * {@link foldChain} for the trusted-path answer.
 */
export function detectEquivocation(
  ledger: RevocationLedger,
): readonly { keyId: string; epoch: number; prevGroupPublicKey: Uint8Array; candidates: readonly string[] }[] {
  const groups = new Map<string, { keyId: string; epoch: number; prev: Uint8Array; els: string[] }>();
  for (const e of ledger) {
    let st: SignedTransition;
    try {
      st = decodeSignedTransition(e);
    } catch {
      continue;
    }
    const k = `${st.statement.keyId}\u0000${String(st.statement.epoch)}\u0000${toHex(st.statement.prevGroupPublicKey)}`;
    const g = groups.get(k);
    if (g === undefined) {
      groups.set(k, {
        keyId: st.statement.keyId,
        epoch: st.statement.epoch,
        prev: st.statement.prevGroupPublicKey,
        // Statement keys, not elements: re-signing one statement is not
        // equivocation (see statementKey).
        els: [statementKey(st.statement)],
      });
    } else {
      g.els.push(statementKey(st.statement));
    }
  }
  const out: { keyId: string; epoch: number; prevGroupPublicKey: Uint8Array; candidates: readonly string[] }[] = [];
  for (const g of groups.values()) {
    if (ofArray(stringCompare, g.els).length > 1) {
      out.push({
        keyId: g.keyId,
        epoch: g.epoch,
        prevGroupPublicKey: g.prev,
        candidates: ofArray(stringCompare, g.els),
      });
    }
  }
  return out.sort((a, b) => (a.keyId === b.keyId ? a.epoch - b.epoch : stringCompare(a.keyId, b.keyId)));
}

// ── the gap probe ───────────────────────────────────────────────────────────

/**
 * What a replica should ASK FOR. The only two things this type can say are
 * "nothing" and "send me epoch n" — there is deliberately no constructor that
 * expresses a refusal. See {@link chainGapProbe} for why that matters.
 */
export type ChainGapProbe =
  | { readonly kind: "nothing-to-request" }
  | {
      readonly kind: "request-epoch";
      readonly keyId: string;
      /** The single missing link: exactly one past where the chain stopped. */
      readonly epoch: number;
      /** Epochs of admissible, unfollowed elements for this keyId. The evidence. */
      readonly unattachedEpochs: readonly number[];
    };

/**
 * `foldChain` reports `current` in two situations a verifier must not confuse:
 * it walked to the head of the chain, and it stopped because the next link is
 * MISSING. Measured on the code as it stands (2026-08-17): a replica pinned at
 * epoch 0 holding a genuine, admissible epoch-2 transition for its own keyId —
 * with epoch 1 suppressed — folds to `{status:"current", epoch:0, advanced:0,
 * retiredIndices:[]}`, which is field-for-field what a replica that heard
 * NOTHING AT ALL returns. It goes on accepting the retired key (that is KL-11's
 * honest limit) while holding, in its own ledger, signed evidence that its chain
 * continued past it. The evidence was discarded without being reported.
 *
 * That is the suppress-one-link attack: withhold a single element from a target
 * and its "I am up to date" is indistinguishable from the truth. This function
 * gives the replica the one thing it was missing — knowing WHAT TO ASK FOR.
 *
 * WHAT THIS FACT IS WORTH, STATED HONESTLY. Unattached-ahead evidence is NOT
 * proof that the replica is behind, and it is NOT authenticated as being about
 * its chain. A party holding no shares of this key at all can mint an admissible
 * element for any `keyId` at any epoch by generating its own group and signing a
 * transition under it — `admit` verifies the signature against the key named
 * INSIDE the element, which is deliberate (header property 1) and is what keeps
 * merge commutative. So this is a dual-use recognition
 * (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`): the honest
 * reading is "I am being eclipsed, go fetch", the adversarial one is "an
 * attacker made me distrust a key I hold correctly".
 *
 * WHICH IS WHY THE RETURN TYPE CANNOT SAY "REJECT". Wiring this to fail-closed
 * would hand any party with no shares a free denial of service on every verifier
 * that listens. The type therefore offers only `nothing-to-request` and
 * `request-epoch`: fetching a missing element is safe under forgery (worst case
 * a wasted request), and refusing is not. This is a shape, not an enforcement —
 * a caller can still ignore the type and refuse on its own; nothing here can
 * stop that. What it removes is the vocabulary that would make refusing look
 * like the intended use.
 *
 * Pure in (pin, ledger): no clock, no arrival order. It reports what to REQUEST
 * and never filters what enters `foldChain`
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 */
export function chainGapProbe(pin: KeyPin, ledger: RevocationLedger): ChainGapProbe {
  const fold = foldChain(pin, ledger);
  // A fork is not a gap. `foldChain` already reports it, and the remedy is the
  // out-of-band re-pin, not another element.
  if (fold.status === "forked") return { kind: "nothing-to-request" };

  const ahead = new Set<number>();
  for (const e of ledger) {
    let st: SignedTransition;
    try {
      st = decodeSignedTransition(e);
    } catch {
      continue;
    }
    if (st.statement.keyId !== pin.keyId) continue;
    // Strictly ahead of where the walk stopped. Elements at or below the stop
    // epoch are either already followed or superseded history.
    if (st.statement.epoch > fold.epoch) ahead.add(st.statement.epoch);
  }
  if (ahead.size === 0) return { kind: "nothing-to-request" };

  return {
    kind: "request-epoch",
    keyId: pin.keyId,
    // Exactly one link, never a range: the chain is dense (KL-12b), so the only
    // element that can move this replica is the one at stop + 1. Asking for a
    // span would let a forged far-future element inflate the request.
    epoch: fold.epoch + 1,
    unattachedEpochs: [...ahead].sort((a, b) => a - b),
  };
}

/**
 * LOCAL BEHAVIOUR ONLY — the one place a wall clock appears, and it decides only
 * what THIS replica does, never what enters the fold.
 *
 * A grow-only revocation set converges eventually; "eventually" is not a
 * security property on its own, so a replica that has not heard from any peer
 * for longer than its budget should stop trusting its own view and fail closed.
 * That is a local decision from a local clock (`.claude/rules/local-time-...`):
 * two replicas with different receive times may take different LOCAL actions and
 * still fold identical evidence. Feeding this into `foldChain` — dropping "stale"
 * transitions before folding — is the divergence bug that rule exists to
 * prevent, and is why this returns an action rather than a filter.
 */
export function freshnessAction(
  localNowMs: number,
  lastHeardFromPeerMs: number,
  maxStalenessMs: number,
): "accept" | "fail-closed" {
  if (!Number.isFinite(localNowMs) || !Number.isFinite(lastHeardFromPeerMs)) return "fail-closed";
  if (maxStalenessMs < 0) return "fail-closed";
  return localNowMs - lastHeardFromPeerMs > maxStalenessMs ? "fail-closed" : "accept";
}
