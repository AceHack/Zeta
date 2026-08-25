#!/usr/bin/env bun
// privacy-budget.ts — the privacy-budget ledger: budget is EARNED, spent to frost, never taken.
//
// WHY THIS EXISTS. `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` is
// always-loaded and says budget is "CREDITED only by others' value attestations (never
// self-minted)", and that of its three operations — spend / stake / confiscate — the third may
// NEVER happen. Audited 2026-08-25 (PR #15407): earning, spending and withholding all existed and
// **no call edge joined any two of them**. `db/ledgers/` held only a README, so no agent had a
// balance, and every `frosted: true` in the repository was a literal in a test or a demo.
//
// This is the TypeScript half of the fix — the half that runs on a real machine and writes a real
// book. The F# half is `src/Core/PrivacyLedger.fs`; the two carry the SAME refusal names on
// purpose, so the four-oracle parity discipline has something to check.
//
// WHAT IT REFUSES (each refusal is a falsifier; a ledger that cannot refuse is a text file):
//   • an attestation whose subject IS its attestor  → self-minted, the rule's core prohibition
//   • a non-positive credit or debit                → privacy is never free
//   • an unwitnessed attestation                    → an unwitnessed credit is unmetered
//   • a spend exceeding the balance                 → you cannot spend what you did not earn
//
// THE FROST RECEIPT IS UNFORGEABLE AT COMPILE TIME. `FrostReceipt` carries a property whose key
// is a module-private `unique symbol`. Code outside this file cannot name that key, so it cannot
// build a `FrostReceipt` object literal at all — `spend()` is the only function in the program
// that can produce one, and `spend()` only returns one after it has written the debit to the book.
// That is what upgrades `SourceMind.personal.frosted: boolean` — a free, self-asserted flag — into
// a value that can only exist downstream of a recorded spend. It is the same move as
// `BroadcastMind` having no field that can hold frosted content: the type is the guarantee.
//
// TEXT ONLY (no-binary-in-proof-lineage.md): the book is JSONL — append-only, so a git diff of it
// is always pure additions, and every entry is human-readable.
//
// EPHEMERAL BY DESIGN. The on-disk book under `db/ledgers/privacy/` is per-machine RUNTIME state
// and is gitignored. It is expected to be wiped repeatedly. Nothing that is needed elsewhere is
// stored in it, no test reads it (tests use temp dirs), and `privacy-frost-demo.ts` rebuilds it
// from scratch in one command. Deleting it cannot fail the build or corrupt the repo.
//
// COOPERATIVE, NOT CRYPTOGRAPHIC — the honest boundary, stated so it is not blurred later. An
// attestation here is a RECORDED claim, not a SIGNED one: nothing verifies that the named attestor
// authored the entry, and any process that can write the file can write entries in any name. What
// this buys is frost that is EARNED, PRICED and OWNER-ONLY — real properties, mechanically enforced
// against honest and buggy callers. What it does NOT buy is unconfiscatability against a hostile
// holder of the file. That needs signatures rooted in hardware the fleet does not have: one
// YubiHSM is in hand, the SmartCard-HSM has not arrived, and the YubiHSM's measured mechanism list
// contains no FROST-capable primitive (PR #15407). Do not describe the first as the second.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** A principal: the identity that can own, earn and spend privacy budget. */
export type Principal = string;

/** The default location of the book, relative to the repo root. Gitignored runtime state. */
export const DEFAULT_LEDGER_PATH = join("db", "ledgers", "privacy", "entries.jsonl");

/**
 * The body of an append-only entry. TWO cases, and the missing third is load-bearing: credit
 * arrives only as another principal's attestation, debit only as the owner's own spend, and
 * confiscation is not expressible in the type.
 */
export type Entry =
  | {
      readonly kind: "attestation";
      readonly id: string;
      readonly subject: Principal;
      readonly attestor: Principal;
      readonly amount: number;
      readonly witness: string;
    }
  | {
      readonly kind: "spend";
      readonly id: string;
      readonly owner: Principal;
      readonly amount: number;
      readonly region: string;
    };

/** Refusal codes. Deliberately the same names as `PrivacyLedger.Refusal` in the F# oracle. */
export type RefusalCode =
  | "self-minted"
  | "non-positive-amount"
  | "unwitnessed-attestation"
  | "insufficient-budget"
  | "empty-principal"
  | "empty-region"
  | "not-the-owner";

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: RefusalCode; readonly reason: string };

const refuse = (code: RefusalCode, reason: string): { ok: false; code: RefusalCode; reason: string } => ({
  ok: false,
  code,
  reason,
});

/** The book: an ordered list of entries. Balance is an order-independent fold over it. */
export type Ledger = readonly Entry[];

export const EMPTY: Ledger = [];

/** A principal's balance: credits from OTHERS' attestations, less its own spends. */
export function balanceOf(principal: Principal, ledger: Ledger): number {
  let total = 0;
  for (const entry of ledger) {
    if (entry.kind === "attestation" && entry.subject === principal) total += entry.amount;
    else if (entry.kind === "spend" && entry.owner === principal) total -= entry.amount;
  }
  return total;
}

/** Has `owner` recorded a spend against `region`? The question that makes frost DERIVED. */
export function hasSpendFor(owner: Principal, region: string, ledger: Ledger): boolean {
  return ledger.some((e) => e.kind === "spend" && e.owner === owner && e.region === region);
}

function validate(ledger: Ledger, entry: Entry): Result<null> {
  if (entry.amount <= 0 || !Number.isInteger(entry.amount)) {
    return refuse("non-positive-amount", `amount must be a positive integer, got ${entry.amount}`);
  }
  if (entry.kind === "attestation") {
    if (!entry.subject.trim() || !entry.attestor.trim()) {
      return refuse("empty-principal", "a principal must be named");
    }
    if (entry.subject === entry.attestor) {
      // The rule's core prohibition, mechanised.
      return refuse(
        "self-minted",
        `privacy budget is earned by OTHERS: ${entry.subject} cannot attest to its own value`,
      );
    }
    if (!entry.witness.trim()) {
      return refuse(
        "unwitnessed-attestation",
        `attestation from ${entry.attestor} carries no witness: an unwitnessed credit is unmetered`,
      );
    }
    return { ok: true, value: null };
  }
  if (!entry.owner.trim()) return refuse("empty-principal", "a principal must be named");
  if (!entry.region.trim()) return refuse("empty-region", "a spend must name the region it frosts");
  const balance = balanceOf(entry.owner, ledger);
  if (balance < entry.amount) {
    return refuse(
      "insufficient-budget",
      `${entry.owner} holds ${balance} but tried to spend ${entry.amount}: you cannot spend what you did not earn`,
    );
  }
  return { ok: true, value: null };
}

/**
 * Post one entry. Idempotent by `id`: re-posting a known id returns the ledger unchanged rather
 * than double-counting, so retry and replay are safe (discipline #6).
 */
export function post(entry: Entry, ledger: Ledger): Result<Ledger> {
  if (ledger.some((e) => e.id === entry.id)) return { ok: true, value: ledger };
  const checked = validate(ledger, entry);
  if (!checked.ok) return checked;
  return { ok: true, value: [...ledger, entry] };
}

/** Credit `subject` because `attestor` says they added value. Refused if they are the same. */
export function attest(
  id: string,
  subject: Principal,
  attestor: Principal,
  amount: number,
  witness: string,
  ledger: Ledger,
): Result<Ledger> {
  return post({ kind: "attestation", id, subject, attestor, amount, witness }, ledger);
}

// ── The frost receipt: the only evidence that a spend happened ──────────────────────────────

/**
 * A module-private brand. Because this symbol is never exported, no code outside this file can
 * name the property key, and therefore no code outside this file can construct a `FrostReceipt`.
 * Try it and `tsc` refuses — see `privacy-budget.forge-control.ts`, which exists precisely to
 * prove this check can fail.
 */
declare const FROST_RECEIPT_BRAND: unique symbol;

/**
 * Proof that a spend was RECORDED. Obtainable only from `spend()`, which returns one only after
 * the debit is in the book. This is what a frosted region carries instead of a boolean.
 */
export interface FrostReceipt {
  readonly [FROST_RECEIPT_BRAND]: true;
  readonly entryId: string;
  readonly owner: Principal;
  readonly cost: number;
  readonly region: string;
  /** The balance remaining after the debit — the price of this frost, on the record. */
  readonly balanceAfter: number;
}

/** Debit `owner` to frost `region`. On success returns the ledger AND the receipt. */
export function spend(
  id: string,
  owner: Principal,
  amount: number,
  region: string,
  ledger: Ledger,
): Result<{ readonly ledger: Ledger; readonly receipt: FrostReceipt }> {
  const entry: Entry = { kind: "spend", id, owner, amount, region };
  const posted = post(entry, ledger);
  if (!posted.ok) return posted;
  const receipt = {
    entryId: id,
    owner,
    cost: amount,
    region,
    balanceAfter: balanceOf(owner, posted.value),
  } as unknown as FrostReceipt;
  return { ok: true, value: { ledger: posted.value, receipt } };
}

/** One peer attests, then the owner spends — the whole honest path in one call. */
export function earnThenFrost(spec: {
  readonly owner: Principal;
  readonly attestor: Principal;
  readonly earn: number;
  readonly cost: number;
  readonly region: string;
  readonly witness: string;
  readonly ledger?: Ledger;
}): Result<{ readonly ledger: Ledger; readonly receipt: FrostReceipt }> {
  const credited = attest(
    `att:${spec.owner}:${spec.region}`,
    spec.owner,
    spec.attestor,
    spec.earn,
    spec.witness,
    spec.ledger ?? EMPTY,
  );
  if (!credited.ok) return credited;
  return spend(`spend:${spec.owner}:${spec.region}`, spec.owner, spec.cost, spec.region, credited.value);
}

/**
 * `earnThenFrost` for demos and test fixtures, converting a refusal into a throw.
 *
 * This is NOT a backdoor around the economy: it runs exactly the same attestation and exactly the
 * same debit, and it still cannot yield a receipt unless both succeed. It only spares callers who
 * consider a refusal a bug from unwrapping the Result five times over. A fixture that wants frost
 * must now genuinely earn it — which is the point of the change.
 */
export function earnThenFrostOrThrow(spec: Parameters<typeof earnThenFrost>[0]): FrostReceipt {
  const result = earnThenFrost(spec);
  if (!result.ok) throw new Error(`frost refused (${result.code}): ${result.reason}`);
  return result.value.receipt;
}

/**
 * Defrost a region — OWNER-ONLY, and refusable.
 *
 * Mirrors `GlassHalo.clear` / `RoomBoundary.clear` in the F# oracle, which used to take no
 * principal at all and could not fail. A defrost another party can force is CONFISCATION, the one
 * operation of the rule's three (spend / stake / confiscate) that may never happen.
 *
 * Cooperative, not cryptographic: `requester` is a claimed name, not a verified one. This refuses
 * an honest or buggy non-owner; it does not withstand a caller that lies about who it is.
 */
export function defrost(requester: Principal, receipt: FrostReceipt): Result<null> {
  if (requester !== receipt.owner) {
    return refuse("not-the-owner", `only the owner may defrost: ${requester} is not ${receipt.owner}`);
  }
  return { ok: true, value: null };
}

/**
 * Re-check a receipt against a book. The brand makes a receipt unforgeable in TYPE; this makes it
 * checkable in FACT — e.g. after the book has been reloaded from disk in another process.
 */
export function receiptIsRecorded(receipt: FrostReceipt, ledger: Ledger): boolean {
  return ledger.some(
    (e) => e.kind === "spend" && e.id === receipt.entryId && e.owner === receipt.owner && e.region === receipt.region,
  );
}

// ── Persistence: append-only JSONL, gitignored, wipeable ────────────────────────────────────

/**
 * Read the book from disk. A missing file is an EMPTY book, not an error: a reset is normal here,
 * not exceptional.
 *
 * One syscall, not two: an `existsSync` guard before the read would be a check-then-use race —
 * the book can be wiped between the check and the read, which on THIS module is a routine event
 * rather than a hypothetical. So the read is attempted and its own failure interpreted.
 */
export function load(path: string): Ledger {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return EMPTY;
    throw e;
  }
  const out: Entry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) out.push(JSON.parse(trimmed) as Entry);
  }
  return out;
}

/** Append one entry to the book on disk. Append-only: nothing is ever rewritten in place. */
export function append(path: string, entry: Entry): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
}
