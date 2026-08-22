// conservation-ledger — "nobody can spend what they do not own", made checkable.
//
// ============================================================================
// WHAT THIS IS FOR
// ============================================================================
//
// The symmetric custody model (tools/setup/persona-keys/frost-custody-contract.ts)
// gave up an asymmetric safety property -- "the agent structurally cannot amend
// its own capability", which was permanent human authority over agents and
// therefore capture under manifesto §3 -- and replaced it with conservation:
//
//     NOBODY CAN SPEND WHAT THEY DO NOT OWN.
//
// Ordinary, enforced by a ledger, identically for every participant. That module
// says in its own header that the ledger is not in it. This is the ledger.
//
// It is deliberately NOT in tools/setup/persona-keys/: custody answers "who may
// exercise a key", conservation answers "what may that key move", and those are
// different questions with different change rates (DV2.0 §8). The ledger never
// imports the custody contract and the custody contract never imports the ledger.
//
// ============================================================================
// SYMMETRIC BY CONSTRUCTION -- THERE IS NO PARTICIPANT TYPE IN THIS FILE
// ============================================================================
//
// A wallet id IS an ed25519 public key, hex-encoded. Not a key plus a registry
// row that says what sort of thing owns it -- the key alone. There is no
// holderKind, no human/agent/traveler union, and no branch anywhere below that
// asks what kind of entity a wallet belongs to, because there is nowhere for
// that question to be stored.
//
// That is stronger than a rule against writing such a branch. A registry mapping
// wallet -> species is the thing that would have to exist first, and making the
// id the key means it cannot exist without being a second, redundant structure
// that nothing here reads. NO HIDDEN WALLETS follows from the same choice: a
// wallet that is not a public key cannot be addressed, and a balance that is not
// the fold of publicly-signed events cannot be produced.
//
// ============================================================================
// SUPPLY IS FIXED AT GENESIS -- THERE IS NO MINT, AND THAT IS THE POINT
// ============================================================================
//
// Every unit that will ever exist is allocated in the genesis document. After
// that the only operation is TRANSFER. There is deliberately no runtime issuance
// operation, because any such operation needs a key that is allowed to create
// value, and a key that can create value is precisely the privileged wallet the
// design is not allowed to have. Naming it rather than building it:
//
//     A MINT WOULD BE A DISQUALIFIER. It is not implemented and must not be.
//     "Top up the agent's budget" is a TRANSFER from a wallet that already holds
//     the units, which is what Aaron's model already says it is -- money moved
//     from one wallet to another. If the funding wallet is empty, the top-up
//     genuinely cannot happen, and a ledger that said otherwise would be lying
//     about a real constraint.
//
// This makes total supply a CONSTANT the auditor can check balances against
// without re-running the fold that produced them, which is what stops the
// conservation check from degenerating into `x == x`.
//
// ============================================================================
// TRANSFER MOVES AUTHORITY COMPLETELY
// ============================================================================
//
// After A -> B the sender retains NOTHING: no amendment right, no clawback, no
// veto, no residual. There is no operation on this ledger that lets a prior
// owner affect units it has sent. Reversing a transfer is a NEW transfer, which
// B must sign -- so a refund requires the recipient's consent by construction
// rather than by policy. This reads identically for human->agent, agent->agent,
// agent->human and traveler->anyone, because none of those words appear.
//
// ============================================================================
// WHAT ORDER IS ACTUALLY REQUIRED (the interesting part)
// ============================================================================
//
// Conservation of TOTAL SUPPLY is a structural tautology of double-entry: if the
// fold credits exactly what it debits then the sum is invariant under any order,
// for any event set whatsoever. A "conservation check" that only verifies that
// is checking its own arithmetic and cannot fail. THE REAL CONTENT OF THE
// INVARIANT IS NON-NEGATIVITY -- no wallet's balance ever goes below zero -- and
// non-negativity is NOT order-independent.
//
// Two transfers out of a wallet holding 100, each for 60, are individually valid
// against the balance each was signed against. As an unordered set they fold to
// -20. That is the double-spend, and it is why a G-Set of signed transfers plus
// a sum is NOT sufficient and this module does not claim it is.
//
// ORDERING IS REQUIRED, BUT ONLY PER SENDER. A wallet's balance can only be
// driven negative by its OWN outgoing transfers; incoming credits only ever
// help. The only party who can author an outgoing transfer is the wallet's own
// key, so the only party whose operations need sequencing is the wallet itself,
// and it can sequence them alone. Each transfer therefore carries a `seq`, and a
// sender's transfers form a gap-free chain from 0 that any observer can replay.
//
// This is exactly Guerraoui, Kuznetsov, Monti, Pavlovic & Seredinschi, "The
// Consensus Number of a Cryptocurrency" (PODC 2019): asset transfer has consensus
// number 1 when each account has a single owner -- it needs a source-ordered
// broadcast, NOT consensus. We implement the sequencing half. See the honest
// limit at EQUIVOCATION below for the half we do not.
//
// SO: BALANCES CONVERGE WITHOUT COORDINATION. The event set is a G-Set (union of
// content-addressed transfers: idempotent, commutative, associative --
// src/Core.TypeScript/g-set/), and `fold` is a pure function of that set, so any
// two replicas holding the same set compute the same balances regardless of
// arrival order, duplication, or how the set was partitioned on the way in.
//
// ============================================================================
// WHERE CONSERVATION REFUSES, AND WHAT AN OFFLINE SIGNER CAN DO
// ============================================================================
//
// Two enforcement points answering two different threats. Both exist; neither
// alone is the answer.
//
//   ADMISSION TIME (`admit`) -- a wallet asks its own view of the ledger for the
//   next transfer it may sign. If the balance will not cover it, no transfer
//   object is produced. This stops HONEST overdraft, and it is advisory in the
//   strict sense: it runs on the sender's own machine and a sender who does not
//   call it is not stopped by it.
//
//   FOLD TIME (`fold`) -- every observer replaying the set. This is the one that
//   actually holds. A transfer whose sender cannot cover it AT ITS POSITION IN
//   THE SENDER'S OWN CHAIN is not applied: it credits nobody and debits nobody.
//
// THEREFORE: an offline signer CAN produce an overspending transfer. It cannot
// make one COUNT. The signature is real, the document is well-formed, and every
// honest replica folds it to nothing, so the recipient's balance never rises and
// the units never become spendable onward. "Cannot overspend at all" would
// require the signer to be unable to emit the bytes, which no ledger can promise
// about a machine it does not control. What a ledger can promise is that the
// bytes buy nothing, and that is what this promises.
//
// UNDERFUNDED IS DEFERRED, NOT REJECTED, and that distinction is load-bearing
// for convergence. A transfer that is unfunded in the events seen SO FAR may be
// funded by a credit that has not arrived yet, and a replica that rejected it
// permanently would disagree forever with a replica that saw the credit first.
// So the fold computes a LEAST FIXPOINT: apply whatever is fundable, repeat
// until no further progress. Applying a transfer only ever raises a recipient's
// balance, so the operator is monotone and the least fixpoint is unique
// (Knaster-Tarski) -- which is why the fold does not depend on the order senders
// are visited in. Order-independence is asserted empirically over permutations
// in the test, not merely argued here.
//
// ============================================================================
// EQUIVOCATION -- THE HONEST LIMIT
// ============================================================================
//
// A byzantine wallet can sign TWO DIFFERENT transfers at the SAME seq and send
// one to each of two recipients. Sequencing does not prevent this; it makes it
// DETECTABLE, which is a weaker and different thing.
//
// The fold's response is to FREEZE the sender's chain at the lowest seq at which
// it equivocated: that transfer and every later one from that wallet are
// refused, permanently, by every replica that has seen both halves. Neither
// branch is chosen, because choosing between them IS consensus and the whole
// point of the per-sender-order result is that we do not need consensus for the
// honest case. Freezing is deterministic and self-inflicted, so equivocation
// costs the equivocator everything it had not already spent.
//
// The freeze point is a MIN over observed equivocations, and min is idempotent,
// commutative and associative -- a meet-semilattice -- so replicas converge on
// it without coordination, exactly as they converge on the event set.
//
// THE RESIDUAL RISK, STATED PLAINLY: between one replica seeing branch A and the
// other seeing branch B, the two disagree, and a recipient who releases goods on
// the strength of a balance it has not yet reconciled can be defrauded. Closing
// that window needs source-ordered RELIABLE BROADCAST (Collins et al., "Online
// Payments by Merely Broadcasting Messages", DSN 2020) so that no two honest
// replicas can accept different transfers at one seq. THAT IS NOT IMPLEMENTED
// HERE. This module converges once both halves are seen; it does not bound how
// long that takes. A reader who assumes otherwise is unprotected.
//
// Acceptance is consequently NOT monotone in the event set: learning about an
// equivocation retracts transfers that were previously applied. That is
// unavoidable -- a correction, in the Z-set sense, rather than a duplicate --
// and convergence survives it because the freeze point is a lattice.
//
// ============================================================================
// DISCIPLINES
// ============================================================================
//
// §12 IDEMPOTENCY: THE NATURAL KEY IS (sender, seq).
//
// Only one transfer can occupy a position in a sender's chain, so a replayed
// transfer collapses onto the slot it already holds and cannot be counted twice.
// Per the DV2.0 rule, a Z-set retraction is a CORRECTION and not a duplicate
// guard; this is the duplicate guard.
//
// AN EARLIER DRAFT OF THIS COMMENT CREDITED THE CONTENT ADDRESS INSTEAD, and
// ablation showed that claim was untestable. `fold` also collapses on transfer
// id, but removing that map changes no observable behaviour and no test can make
// it change any: two byte-identical transfers necessarily share a (sender, seq),
// so the chain-position map subsumes it on every possible input. The id-keyed
// map is kept because iterating a set is the honest shape for the input, NOT
// because it is a second line of defence -- it is not, and a refactor that
// removes it loses nothing while a refactor that removes (sender, seq) loses
// everything.
//
// The content address earns its place doing a different and genuinely
// falsifiable job: TAMPER-EVIDENCE. `transferProblem` rejects any transfer whose
// id is not the hash of its own signed bytes, so no field can be edited in
// flight without the document ceasing to be well-formed.
//
// §13 NONINTERFERENCE / §7 DST: no clock, no randomness, no IO, no ambient
// state. `fold` is a pure function of (genesis, events). The same set replays to
// the same balances on any machine, which is what makes the golden-vector and
// permutation tests meaningful.
//
// AMOUNTS ARE bigint. Sums over a long-lived ledger exceed 2^53 and a conserva-
// tion invariant that silently stops holding at Number.MAX_SAFE_INTEGER is worse
// than none. Amounts cross the wire as decimal strings so the signed bytes stay
// exact.
//
// Anchors (Beacon): Guerraoui, Kuznetsov, Monti, Pavlovic & Seredinschi, "The
// Consensus Number of a Cryptocurrency" (PODC 2019) -- asset transfer is
// consensus-free for singly-owned accounts. Collins, Guerraoui, Komatovic et
// al., "Online Payments by Merely Broadcasting Messages" (DSN 2020) -- the
// broadcast this module does not implement. Shapiro, Preguica, Baquero & Zawirski,
// "Conflict-free Replicated Data Types" (SSS 2011) -- the G-Set and the min
// lattice. Lamport (1978) -- per-source sequencing. Pacioli (1494) -- double
// entry, the reason credit and debit are one operation and not two.

import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";

// ============================================================================
// Types
// ============================================================================

/**
 * A wallet id is an ed25519 public key, lowercase hex, 64 chars. Nothing else.
 *
 * Kept as a named alias despite being structurally `string`: every id in this
 * module is a public key, and a signature reading `(from: string, to: string)`
 * invites callers to pass a label or a persona name, which is precisely the
 * species-registry this design refuses to have.
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- see above; the name is the documentation
export type WalletId = string;

/**
 * ORDINAL (codepoint) comparison. Never `localeCompare`, which is
 * culture-SENSITIVE: two nodes in different locales would sort wallet ids
 * differently and fold the same event set into different results. See
 * .claude/rules/culture-invariant-by-default.md — this is the canonical
 * collation the four-oracle byte-lock and DST replay both require.
 */
function ordinalCompare(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Canonical order over transfers: by sender, then chain position, then id. */
function compareTransfers(a: Transfer, b: Transfer): number {
  const bySender = ordinalCompare(a.from, b.from);
  if (bySender !== 0) return bySender;
  if (a.seq !== b.seq) return a.seq - b.seq;
  return ordinalCompare(a.id, b.id);
}

export const TRANSFER_SCHEMA = "zeta-conservation-transfer-v1" as const;
export const GENESIS_SCHEMA = "zeta-conservation-genesis-v1" as const;

/**
 * The opening allocation. Every unit that will ever exist is here.
 *
 * `ledgerId` is inside every transfer's signed bytes, so a transfer signed for
 * one ledger cannot be replayed into another (cross-ledger replay).
 */
export interface Genesis {
  readonly schema: typeof GENESIS_SCHEMA;
  readonly ledgerId: string;
  /** wallet -> opening balance, as a decimal string. Non-negative. */
  readonly allocations: ReadonlyMap<WalletId, string>;
}

/**
 * One transfer. `id` is the content address of the signed bytes -- it is derived,
 * never chosen, which is what makes replay a set no-op rather than a second event.
 */
export interface Transfer {
  readonly schema: typeof TRANSFER_SCHEMA;
  readonly ledgerId: string;
  /** sha256 hex of `transferSignable`. Derived; `parseTransfer` recomputes it. */
  readonly id: string;
  readonly from: WalletId;
  readonly to: WalletId;
  /** Decimal string, strictly positive integer. */
  readonly amount: string;
  /** Position in the SENDER's own chain. Gap-free from 0. */
  readonly seq: number;
  /** ed25519 signature by `from` over `transferSignable`. Hex. */
  readonly signatureHex: string;
}

/** Why a transfer present in the input did not take effect. */
export type WithheldReason =
  | "malformed"
  | "bad-signature"
  | "wrong-ledger"
  | "underfunded"
  /** No transfer exists at the sender's next expected seq, so the chain stops here. */
  | "chain-gap"
  /** Well-formed, but an EARLIER seq of the same sender is stuck, so this cannot be reached. */
  | "blocked-behind"
  | "frozen-by-equivocation";

export interface Withheld {
  readonly id: string;
  readonly from: WalletId;
  readonly seq: number;
  readonly reason: WithheldReason;
  readonly detail: string;
}

/**
 * The fold's output. The AUDITED ARTIFACT: `auditConservation` checks these
 * fields against the genesis and the input events WITHOUT re-running the fold,
 * which is the whole reason `applied` is reported alongside `balances` instead
 * of the balances being trusted on their own.
 */
export interface LedgerState {
  readonly ledgerId: string;
  readonly balances: ReadonlyMap<WalletId, bigint>;
  /** Transfers that took effect, in the order the fold applied them. */
  readonly applied: readonly Transfer[];
  readonly withheld: readonly Withheld[];
  /** wallet -> lowest seq at which it equivocated. A min-lattice; monotone-down. */
  readonly frozenAt: ReadonlyMap<WalletId, number>;
  /** Sum of applied amounts. Non-vacuity: a corpus with 0n here proves nothing. */
  readonly totalTransferred: bigint;
}

// ============================================================================
// Canonical bytes
// ============================================================================

const FIELD_SEP = "\u001f"; // ASCII US — escaped, never a raw control byte in source

const HEX64 = /^[\da-f]{64}$/;
const DECIMAL = /^(?:0|[1-9]\d*)$/;

/**
 * The bytes a sender signs. Fixed field order, explicit separator, never
 * JSON.stringify -- whose key order is insertion-dependent, so two encoders
 * could disagree about what was signed.
 *
 * `id` and `signatureHex` are excluded because both are derived FROM this.
 * Every other field is inside: a field outside the signature is a field an
 * unauthorized party can change while the signature still verifies. In
 * particular `ledgerId` is inside, so a transfer cannot be lifted into another
 * ledger, and `seq` is inside, so a transfer cannot be moved to a cheaper
 * position in the sender's chain.
 */
export function transferSignable(t: Omit<Transfer, "id" | "signatureHex">): Uint8Array {
  const parts: readonly string[] = [
    t.schema,
    t.ledgerId,
    t.from,
    t.to,
    t.amount,
    String(t.seq),
  ];
  for (const p of parts) {
    if (p.includes(FIELD_SEP)) throw new Error("transfer field must not contain the field separator");
  }
  // Joined on FIELD_SEP, never on "": the empty join is not injective across
  // fields, so two different transfers could otherwise share one signature.
  return new TextEncoder().encode(parts.join(FIELD_SEP));
}

/** The content address of a transfer: sha256 of exactly the bytes that were signed. */
export function transferId(t: Omit<Transfer, "id" | "signatureHex">): string {
  return createHash("sha256").update(transferSignable(t)).digest("hex");
}

// ed25519 SPKI DER is a fixed 12-byte prefix followed by the 32-byte raw key.
// Kept explicit so a raw wallet id can become a verifiable key with no dependency
// beyond node builtins (the pr-manifest-integrity lane runs without `bun install`).
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function publicKeyFromWalletId(w: WalletId): ReturnType<typeof createPublicKey> | undefined {
  if (!HEX64.test(w)) return undefined;
  try {
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(w, "hex")]),
      format: "der",
      type: "spki",
    });
  } catch {
    return undefined;
  }
}

/** Verify a transfer's signature is by the wallet it claims to spend from. */
export function verifyTransfer(t: Transfer): boolean {
  const key = publicKeyFromWalletId(t.from);
  if (key === undefined) return false;
  let sig: Buffer;
  try {
    sig = Buffer.from(t.signatureHex, "hex");
  } catch {
    return false;
  }
  if (sig.length !== 64 || t.signatureHex.length !== 128) return false;
  try {
    return verifySignature(null, transferSignable(t), key, sig);
  } catch {
    return false;
  }
}

// ============================================================================
// Structural validity
// ============================================================================

/**
 * Shape rules, checked before anything arithmetic. Returns a reason or undefined.
 *
 * A zero-amount transfer is refused rather than allowed as a no-op: it consumes a
 * seq and carries a signature, so permitting it adds a chain position that moves
 * nothing, which is only ever useful for confusing an auditor.
 */
export function transferProblem(t: Transfer): string | undefined {
  // Compared as a plain string on purpose. TypeScript narrows `t.schema` to the
  // literal type and calls this branch dead, but a Transfer reaching this
  // function has usually come off a wire or a disk, where the type is a claim
  // rather than a fact. Deleting the check because the compiler cannot see a way
  // to reach it would remove the only thing standing between a hostile document
  // and the fold.
  if ((t.schema as string) !== TRANSFER_SCHEMA) return "unsupported schema";
  if (!HEX64.test(t.from)) return "from is not a 32-byte hex wallet id";
  if (!HEX64.test(t.to)) return "to is not a 32-byte hex wallet id";
  if (t.from === t.to) return "self-transfer: from and to are the same wallet";
  if (!DECIMAL.test(t.amount)) return "amount is not a canonical non-negative decimal integer";
  if (BigInt(t.amount) <= 0n) return "amount must be strictly positive";
  if (!Number.isInteger(t.seq) || t.seq < 0) return "seq must be a non-negative integer";
  if (t.id !== transferId(t)) return "id is not the content address of the signed bytes";
  return undefined;
}

// ============================================================================
// The fold
// ============================================================================

function genesisTotal(g: Genesis): bigint {
  let total = 0n;
  for (const v of g.allocations.values()) total += BigInt(v);
  return total;
}

/** Chain-position key. The natural key of the whole design — see §12 in the header. */
function slotKey(from: WalletId, seq: number): string {
  return `${from}:${String(seq)}`;
}

function withhold(t: Transfer, reason: WithheldReason, detail: string): Withheld {
  return { id: t.id, from: t.from, seq: t.seq, reason, detail };
}

/**
 * PHASE 1 — shape, ledger binding, signature.
 *
 * Every rejection is RECORDED. A fold that drops an event without saying so is
 * indistinguishable from one that lost it, which is the `event-unaccounted`
 * defect the auditor exists to catch.
 */
function screenEvents(
  genesis: Genesis,
  events: Iterable<Transfer>,
): { readonly valid: readonly Transfer[]; readonly withheld: readonly Withheld[] } {
  const unique = new Map<string, Transfer>();
  for (const t of events) if (!unique.has(t.id)) unique.set(t.id, t);

  const valid: Transfer[] = [];
  const withheld: Withheld[] = [];
  for (const t of unique.values()) {
    const problem = transferProblem(t);
    if (problem !== undefined) {
      withheld.push(withhold(t, "malformed", problem));
    } else if (t.ledgerId !== genesis.ledgerId) {
      withheld.push(withhold(t, "wrong-ledger",
        `signed for ledger ${JSON.stringify(t.ledgerId)}, folded into ${JSON.stringify(genesis.ledgerId)}`));
    } else if (!verifyTransfer(t)) {
      withheld.push(withhold(t, "bad-signature", "signature is not by the wallet this transfer spends from"));
    } else {
      valid.push(t);
    }
  }
  return { valid, withheld };
}

/**
 * PHASE 2 — one transfer per chain position, and freeze on conflict.
 *
 * Two DISTINCT transfers at one (sender, seq) is equivocation. The freeze point
 * is the MIN over observed conflicts, and min is idempotent, commutative and
 * associative, so replicas converge on it with no coordination.
 */
function claimSlots(sortedValid: readonly Transfer[]): {
  readonly bySlot: ReadonlyMap<string, Transfer>;
  readonly frozenAt: ReadonlyMap<WalletId, number>;
} {
  const bySlot = new Map<string, Transfer>();
  const frozenAt = new Map<WalletId, number>();
  for (const t of sortedValid) {
    const key = slotKey(t.from, t.seq);
    const prior = bySlot.get(key);
    if (prior !== undefined && prior.id !== t.id) {
      const current = frozenAt.get(t.from);
      if (current === undefined || t.seq < current) frozenAt.set(t.from, t.seq);
    } else {
      bySlot.set(key, t);
    }
  }
  return { bySlot, frozenAt };
}

/**
 * PHASE 3 — the least fixpoint. Apply whatever is fundable at each sender's next
 * expected seq; repeat until a full pass makes no progress.
 *
 * Applying a transfer only ever RAISES a recipient's balance, and a sender's own
 * prior debits are fixed by its chain prefix, so the operator is monotone and its
 * least fixpoint is unique (Knaster-Tarski). That is why the sender visit order
 * cannot change the outcome — asserted over permutations in the test, not merely
 * argued here.
 */
function applyToFixpoint(
  balances: Map<WalletId, bigint>,
  pending: ReadonlyMap<string, Transfer>,
  senders: readonly WalletId[],
): { readonly applied: readonly Transfer[]; readonly nextSeq: ReadonlyMap<WalletId, number>; readonly total: bigint } {
  const nextSeq = new Map<WalletId, number>();
  const applied: Transfer[] = [];
  let total = 0n;

  /** Walk ONE sender's chain as far as its balance allows. Returns units moved. */
  const drainSender = (sender: WalletId): bigint => {
    let moved = 0n;
    for (;;) {
      const seq = nextSeq.get(sender) ?? 0;
      const t = pending.get(slotKey(sender, seq));
      if (t === undefined) break; // gap, freeze point, or end of chain
      const amount = BigInt(t.amount);
      const available = balances.get(sender) ?? 0n;
      if (available < amount) break; // underfunded FOR NOW; a later credit may fund it
      // The single point at which value moves. Credit and debit are ONE statement
      // so that no future edit can perform one without the other.
      balances.set(sender, available - amount);
      balances.set(t.to, (balances.get(t.to) ?? 0n) + amount);
      applied.push(t);
      moved += amount;
      nextSeq.set(sender, seq + 1);
    }
    return moved;
  };

  for (;;) {
    let progressed = false;
    for (const sender of senders) {
      const before = applied.length;
      total += drainSender(sender);
      if (applied.length !== before) progressed = true;
    }
    if (!progressed) break;
  }
  return { applied, nextSeq, total };
}

/** PHASE 4 — say why each surviving transfer did not take effect. */
function explainWithheld(
  ctx: {
    readonly bySlot: ReadonlyMap<string, Transfer>;
    readonly sortedValid: readonly Transfer[];
    readonly frozenAt: ReadonlyMap<WalletId, number>;
    readonly pending: ReadonlyMap<string, Transfer>;
    readonly nextSeq: ReadonlyMap<WalletId, number>;
    readonly balances: ReadonlyMap<WalletId, bigint>;
    readonly appliedIds: ReadonlySet<string>;
  },
): readonly Withheld[] {
  const out: Withheld[] = [];
  for (const t of ctx.bySlot.values()) {
    if (ctx.appliedIds.has(t.id)) continue;
    const freeze = ctx.frozenAt.get(t.from);
    if (freeze !== undefined && t.seq >= freeze) {
      out.push(withhold(t, "frozen-by-equivocation",
        `wallet signed two different transfers at seq ${String(freeze)}; its chain is frozen from there`));
      continue;
    }
    // `reached` is where this sender's chain stopped advancing. A transfer AT that
    // position stopped it; one BEYOND it is a consequence, not a cause, and saying
    // so keeps the report diagnostic rather than merely true.
    const reached = ctx.nextSeq.get(t.from) ?? 0;
    if (t.seq === reached) {
      out.push(withhold(t, "underfunded",
        `wallet holds ${String(ctx.balances.get(t.from) ?? 0n)}, transfer needs ${t.amount}`));
    } else if (ctx.pending.has(slotKey(t.from, reached))) {
      out.push(withhold(t, "blocked-behind",
        `an earlier transfer of this sender (seq ${String(reached)}) is stuck, so seq ${String(t.seq)} cannot be reached`));
    } else {
      out.push(withhold(t, "chain-gap",
        `no transfer exists at the sender's next expected seq ${String(reached)}, so seq ${String(t.seq)} is unreachable`));
    }
  }
  // The losing branches of an equivocation never claimed a slot, so account here.
  for (const t of ctx.sortedValid) {
    if (ctx.bySlot.get(slotKey(t.from, t.seq))?.id === t.id) continue;
    out.push(withhold(t, "frozen-by-equivocation",
      `losing branch of an equivocation at seq ${String(t.seq)}; NEITHER branch is applied`));
  }
  return out;
}

/**
 * Fold a SET of transfers into balances. Pure: no clock, no randomness, no IO,
 * so the same set replays to the same balances on any machine (§7 DST, §13).
 *
 * Four phases, each named above: screen, claim slots, apply to fixpoint, explain.
 * The duplicate guard is the chain position (sender, seq) — see §12 in the header
 * for why the content-address map beside it is NOT a second line of defence.
 */
export function fold(genesis: Genesis, events: Iterable<Transfer>): LedgerState {
  const balances = new Map<WalletId, bigint>();
  for (const [w, v] of genesis.allocations) balances.set(w, BigInt(v));

  const screened = screenEvents(genesis, events);
  // Sorted canonically (ordinal, never locale) so nothing below depends on the
  // order events happened to arrive in.
  const sortedValid = [...screened.valid].sort(compareTransfers);
  const { bySlot, frozenAt } = claimSlots(sortedValid);

  const pending = new Map<string, Transfer>();
  for (const [key, t] of bySlot) {
    const freeze = frozenAt.get(t.from);
    if (freeze === undefined || t.seq < freeze) pending.set(key, t);
  }

  const senders = [...new Set(sortedValid.map((t) => t.from))].sort(ordinalCompare);
  const { applied, nextSeq, total } = applyToFixpoint(balances, pending, senders);
  const appliedIds = new Set(applied.map((t) => t.id));

  const withheld = [
    ...screened.withheld,
    ...explainWithheld({ bySlot, sortedValid, frozenAt, pending, nextSeq, balances, appliedIds }),
  ];
  const totalTransferred = total;

  return {
    ledgerId: genesis.ledgerId,
    balances,
    applied,
    withheld,
    frozenAt,
    totalTransferred,
  };
}

// ============================================================================
// Admission -- the sender-side refusal
// ============================================================================

export type Admission =
  | { readonly ok: true; readonly unsigned: Omit<Transfer, "id" | "signatureHex"> }
  | { readonly ok: false; readonly reason: string };

/**
 * The next transfer a wallet may sign, or a refusal. ADVISORY BY NATURE: this
 * runs on the sender's own machine, so a sender that does not call it is not
 * stopped by it. `fold` is the enforcement point; this is the one that gives an
 * honest sender a usable error instead of an event that silently never applies.
 */
export function admit(
  genesis: Genesis,
  state: LedgerState,
  from: WalletId,
  to: WalletId,
  amount: bigint,
): Admission {
  if (state.ledgerId !== genesis.ledgerId) return { ok: false, reason: "state is not this ledger's" };
  if (!HEX64.test(from) || !HEX64.test(to)) return { ok: false, reason: "wallet ids must be 32-byte hex" };
  if (from === to) return { ok: false, reason: "self-transfer moves nothing" };
  if (amount <= 0n) return { ok: false, reason: "amount must be strictly positive" };
  if (state.frozenAt.has(from)) return { ok: false, reason: "wallet is frozen by its own equivocation" };
  const available = state.balances.get(from) ?? 0n;
  if (available < amount) {
    return { ok: false, reason: `wallet holds ${String(available)}, cannot spend ${String(amount)}` };
  }
  // The next seq is one past the HIGHEST this wallet has already issued, counting
  // withheld transfers too. Counting only APPLIED ones would reissue the seq of a
  // transfer that is merely deferred, which is self-equivocation: the wallet would
  // freeze itself for doing exactly what the ledger told it to do.
  let highest = -1;
  for (const t of state.applied) if (t.from === from && t.seq > highest) highest = t.seq;
  for (const w of state.withheld) if (w.from === from && w.seq > highest) highest = w.seq;
  return {
    ok: true,
    unsigned: {
      schema: TRANSFER_SCHEMA, ledgerId: genesis.ledgerId, from, to,
      amount: String(amount), seq: highest + 1,
    },
  };
}

// ============================================================================
// The audit -- INDEPENDENT of the fold, on purpose
// ============================================================================

export type ViolationKind =
  | "supply-inflated"
  | "supply-destroyed"
  | "negative-balance"
  | "double-applied"
  | "overdraft-applied"
  | "unsigned-applied"
  | "fabricated-applied"
  | "balances-disagree-with-applied"
  | "chain-order-violated"
  | "event-unaccounted";

export interface Violation {
  readonly kind: ViolationKind;
  readonly detail: string;
}

export interface ConservationReport {
  readonly ok: boolean;
  readonly violations: readonly Violation[];
  /** Sum of the audited balances. */
  readonly totalBalances: bigint;
  /** Sum of the genesis allocations -- the constant the ledger must always equal. */
  readonly totalSupply: bigint;
  readonly totalTransferred: bigint;
  /**
   * True when the audited state moved nothing. The report can then be `ok`
   * without having exercised anything, so a caller asserting only `ok` on such a
   * corpus has asserted nothing. Callers MUST check this.
   */
  readonly vacuous: boolean;
}

/**
 * Audit a LedgerState against the genesis and the events it was folded from.
 *
 * THIS DOES NOT RE-RUN `fold`, and that is the entire design of it. An auditor
 * that recomputed the fold and compared would be checking the fold against
 * itself -- true by construction, incapable of registering a violation, the
 * `x >= x` shape. Instead it takes the state's OWN claims (`balances`,
 * `applied`) and checks them against two things the fold does not get to choose:
 * the genesis total, and the signed input set.
 *
 *   supply-inflated / -destroyed    sum of balances != genesis total. Catches a
 *                                   fold that credits without debiting, or that
 *                                   drops an applied event's effect.
 *   balances-disagree-with-applied  replaying `applied` from genesis does not
 *                                   reproduce `balances`. Catches a fold that
 *                                   edits a balance without an event.
 *   double-applied                  an id appears twice in `applied`. Catches a
 *                                   replayed transfer that double-credited.
 *   overdraft-applied               replaying `applied` in order takes some
 *                                   wallet below zero at some intermediate step.
 *                                   THE INVARIANT PROPER.
 *   negative-balance                a final balance below zero.
 *   unsigned-applied                an applied transfer whose signature does not
 *                                   verify, or is malformed, or is for another
 *                                   ledger.
 *   fabricated-applied              an applied transfer that was not in the input
 *                                   set at all.
 *   event-unaccounted               an input transfer that is neither applied nor
 *                                   withheld. Catches a fold that silently
 *                                   dropped an event.
 */
/** Is this applied transfer a document that could legitimately have moved value? */
function auditAppliedDocument(
  genesis: Genesis,
  t: Transfer,
  inputById: ReadonlyMap<string, Transfer>,
): readonly Violation[] {
  const out: Violation[] = [];
  const tag = t.id.slice(0, 16);
  if (!inputById.has(t.id)) {
    out.push({ kind: "fabricated-applied", detail: `applied transfer ${tag} was not in the input event set` });
  }
  const problem = transferProblem(t);
  if (problem !== undefined) {
    out.push({ kind: "unsigned-applied", detail: `applied transfer ${tag}: ${problem}` });
  } else if (t.ledgerId !== genesis.ledgerId) {
    out.push({ kind: "unsigned-applied", detail: `applied transfer ${tag} is signed for a different ledger` });
  } else if (!verifyTransfer(t)) {
    out.push({ kind: "unsigned-applied", detail: `applied transfer ${tag} has no valid signature by its sender` });
  }
  return out;
}

/**
 * Replay the state's OWN `applied` list from genesis, independently of the fold.
 *
 * `applied` is read as a CERTIFICATE: an order in which the state is reachable
 * without any wallet going below zero. Verifying the certificate is what makes
 * the audit independent — it never calls `fold`, so it can disagree with it.
 */
function replayApplied(
  genesis: Genesis,
  state: LedgerState,
  inputById: ReadonlyMap<string, Transfer>,
): { readonly balances: ReadonlyMap<WalletId, bigint>; readonly violations: readonly Violation[]; readonly transferred: bigint } {
  const violations: Violation[] = [];
  const replay = new Map<WalletId, bigint>();
  for (const [w, v] of genesis.allocations) replay.set(w, BigInt(v));

  const seenIds = new Set<string>();
  /** Highest seq of each sender's chain the applied list has walked to so far. */
  const chainPos = new Map<WalletId, number>();
  let transferred = 0n;

  for (const t of state.applied) {
    const tag = t.id.slice(0, 16);
    if (seenIds.has(t.id)) {
      violations.push({
        kind: "double-applied",
        detail: `transfer ${tag} appears more than once in the applied list — a replay was counted twice`,
      });
      continue;
    }
    seenIds.add(t.id);

    // The sender's chain must be walked whole, in order, from 0. Without this a
    // fold could apply seq 5 while 0..4 never happened — every balance would
    // still add up, because the arithmetic of a skipped debit is self-consistent.
    // Conservation of the total does NOT catch a skipped chain position; this does.
    const expected = (chainPos.get(t.from) ?? -1) + 1;
    if (t.seq !== expected) {
      violations.push({
        kind: "chain-order-violated",
        detail:
          `applied transfer ${tag} sits at seq ${String(t.seq)} but its sender's chain was only ` +
          `walked to seq ${String(expected - 1)} — a chain position was skipped or replayed`,
      });
    }
    chainPos.set(t.from, Math.max(t.seq, expected - 1));

    violations.push(...auditAppliedDocument(genesis, t, inputById));

    const amount = DECIMAL.test(t.amount) ? BigInt(t.amount) : 0n;
    const before = replay.get(t.from) ?? 0n;
    if (before < amount) {
      violations.push({
        kind: "overdraft-applied",
        detail:
          `applied transfer ${tag} spends ${t.amount} from a wallet holding ${String(before)} ` +
          `at that point in its own chain — it spent what it did not own`,
      });
    }
    replay.set(t.from, before - amount);
    replay.set(t.to, (replay.get(t.to) ?? 0n) + amount);
    transferred += amount;
  }
  return { balances: replay, violations, transferred };
}

/** The claimed balances must equal the independent replay, and none may be negative. */
function auditBalances(
  state: LedgerState,
  replay: ReadonlyMap<WalletId, bigint>,
): readonly Violation[] {
  const out: Violation[] = [];
  const wallets = new Set<WalletId>([...replay.keys(), ...state.balances.keys()]);
  for (const w of [...wallets].sort(ordinalCompare)) {
    const claimed = state.balances.get(w) ?? 0n;
    const derived = replay.get(w) ?? 0n;
    if (claimed !== derived) {
      out.push({
        kind: "balances-disagree-with-applied",
        detail:
          `wallet ${w.slice(0, 16)} is reported as ${String(claimed)} but replaying the applied ` +
          `transfers from genesis yields ${String(derived)}`,
      });
    }
    if (claimed < 0n) {
      out.push({
        kind: "negative-balance",
        detail: `wallet ${w.slice(0, 16)} holds ${String(claimed)} — a wallet spent what it did not own`,
      });
    }
  }
  return out;
}

export function auditConservation(
  genesis: Genesis,
  state: LedgerState,
  events: Iterable<Transfer>,
): ConservationReport {
  const inputById = new Map<string, Transfer>();
  for (const t of events) if (!inputById.has(t.id)) inputById.set(t.id, t);

  const totalSupply = genesisTotal(genesis);
  const replayed = replayApplied(genesis, state, inputById);
  const violations: Violation[] = [...replayed.violations, ...auditBalances(state, replayed.balances)];
  const transferred = replayed.transferred;

  // -- Supply is a constant chosen at genesis, not by the fold. --
  let totalBalances = 0n;
  for (const v of state.balances.values()) totalBalances += v;
  if (totalBalances > totalSupply) {
    violations.push({
      kind: "supply-inflated",
      detail: `balances sum to ${String(totalBalances)} against a genesis supply of ${String(totalSupply)} — ` +
        `${String(totalBalances - totalSupply)} units were created out of nothing`,
    });
  } else if (totalBalances < totalSupply) {
    violations.push({
      kind: "supply-destroyed",
      detail: `balances sum to ${String(totalBalances)} against a genesis supply of ${String(totalSupply)} — ` +
        `${String(totalSupply - totalBalances)} units vanished`,
    });
  }

  // -- Every input event is either applied or explained. --
  const accounted = new Set<string>(state.applied.map((t) => t.id));
  for (const w of state.withheld) accounted.add(w.id);
  for (const id of inputById.keys()) {
    if (!accounted.has(id)) {
      violations.push({
        kind: "event-unaccounted",
        detail: `input transfer ${id.slice(0, 16)} is neither applied nor withheld — the fold dropped it silently`,
      });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    totalBalances,
    totalSupply,
    totalTransferred: transferred,
    vacuous: state.applied.length === 0,
  };
}
