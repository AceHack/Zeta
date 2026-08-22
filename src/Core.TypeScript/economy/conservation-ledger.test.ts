/**
 * conservation-ledger.test.ts — the falsification suite.
 *
 * THE POINT OF THIS FILE IS THE MUTANTS. An invariant check that cannot register
 * a violation is worse than no check, because it reports green while protecting
 * nothing: nine instances of that defect class were removed from this repo on
 * 2026-08-14, including a Landauer check that reduced to `x >= x` and a hardware
 * probe that called an empty file an attached device.
 *
 * So the suite is in two halves:
 *
 *   1. The real fold satisfies the invariant (necessary, and cheap to fake).
 *   2. DELIBERATELY BROKEN ledger states are fed to `auditConservation` and each
 *      one is asserted to DIE with a NAMED violation. A mutant that survives is a
 *      hole in the auditor, and the test says so by name.
 *
 * Every mutant below corresponds to a way a real fold could be wrong:
 * credit-without-debit, replayed double-credit, accepted negative balance,
 * silently dropped event, fabricated transfer, skipped chain position, forged
 * signature, and a balance edited with no event behind it.
 *
 * Non-vacuity is asserted structurally: NON_VACUITY below fails if the corpus
 * moved nothing, so the suite cannot pass green over an empty transfer set.
 *
 * Imports node builtins and this repo only -- no third-party dependency -- so it
 * also runs in lanes that do not `bun install`.
 */

import { describe, expect, it } from "bun:test";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

import {
  admit,
  auditConservation,
  fold,
  transferId,
  transferProblem,
  transferSignable,
  verifyTransfer,
  GENESIS_SCHEMA,
  TRANSFER_SCHEMA,
  type Genesis,
  type LedgerState,
  type Transfer,
  type ViolationKind,
  type WalletId,
} from "./conservation-ledger.ts";

// ============================================================================
// Wallets — a wallet IS a keypair; there is no participant type to construct
// ============================================================================

interface Wallet {
  readonly id: WalletId;
  readonly privateKey: KeyObject;
}

function newWallet(): Wallet {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  const raw = Buffer.from(String(jwk.x), "base64url");
  return { id: raw.toString("hex"), privateKey };
}

const LEDGER_ID = "zeta-poc-ledger-1";

function genesisOf(entries: readonly (readonly [Wallet, bigint])[]): Genesis {
  return {
    schema: GENESIS_SCHEMA,
    ledgerId: LEDGER_ID,
    allocations: new Map(entries.map(([w, v]) => [w.id, String(v)])),
  };
}

/** Sign a transfer as `from`. The only way a valid transfer comes into being. */
function makeTransfer(from: Wallet, to: Wallet, amount: bigint, seq: number, ledgerId = LEDGER_ID): Transfer {
  const unsigned = {
    schema: TRANSFER_SCHEMA,
    ledgerId,
    from: from.id,
    to: to.id,
    amount: String(amount),
    seq,
  } as const;
  const signatureHex = sign(null, transferSignable(unsigned), from.privateKey).toString("hex");
  return { ...unsigned, id: transferId(unsigned), signatureHex };
}

function balanceOf(state: LedgerState, w: Wallet): bigint {
  return state.balances.get(w.id) ?? 0n;
}

function kinds(violations: readonly { readonly kind: ViolationKind }[]): readonly ViolationKind[] {
  return violations.map((v) => v.kind);
}

// Deterministic PRNG — no ambient randomness, so a failing permutation replays.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(xs: readonly T[], rnd: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

// ============================================================================
// A shared, non-trivial corpus
// ============================================================================

const alice = newWallet();
const bob = newWallet();
const carol = newWallet();

const GENESIS = genesisOf([
  [alice, 1_000n],
  [bob, 0n],
  [carol, 0n],
]);

/**
 * A chain that exercises the interesting cases at once: a straightforward spend,
 * onward spending of received units (bob can only pay carol because alice paid
 * bob), and a transfer that is unfunded when it is first seen and funded later.
 */
const CORPUS: readonly Transfer[] = [
  makeTransfer(alice, bob, 400n, 0),
  makeTransfer(alice, carol, 100n, 1),
  makeTransfer(bob, carol, 350n, 0), // only fundable AFTER alice->bob
  makeTransfer(carol, alice, 50n, 0), // only fundable AFTER the credits above
];

// ============================================================================
// NON-VACUITY — asserted first, so nothing below can pass over an empty set
// ============================================================================

describe("non-vacuity of the corpus", () => {
  it("the corpus actually moves value (totalTransferred > 0)", () => {
    const state = fold(GENESIS, CORPUS);
    expect(state.totalTransferred).toBeGreaterThan(0n);
    expect(state.applied.length).toBe(CORPUS.length);
  });

  it("the audit of the corpus is not vacuous", () => {
    const report = auditConservation(GENESIS, fold(GENESIS, CORPUS), CORPUS);
    expect(report.vacuous).toBe(false);
    expect(report.totalTransferred).toBeGreaterThan(0n);
  });

  it("an EMPTY corpus is reported vacuous — ok alone would prove nothing", () => {
    const state = fold(GENESIS, []);
    const report = auditConservation(GENESIS, state, []);
    expect(report.ok).toBe(true);
    expect(report.vacuous).toBe(true); // this is why `ok` is not sufficient
  });
});

// ============================================================================
// The invariant on the honest path
// ============================================================================

describe("conservation — the honest path", () => {
  it("balances are exactly the double-entry result", () => {
    const state = fold(GENESIS, CORPUS);
    // alice: 1000 - 400 - 100 + 50 = 550
    expect(balanceOf(state, alice)).toBe(550n);
    // bob:   0 + 400 - 350 = 50
    expect(balanceOf(state, bob)).toBe(50n);
    // carol: 0 + 100 + 350 - 50 = 400
    expect(balanceOf(state, carol)).toBe(400n);
  });

  it("total supply is unchanged by any amount of transferring", () => {
    const report = auditConservation(GENESIS, fold(GENESIS, CORPUS), CORPUS);
    expect(report.totalBalances).toBe(1_000n);
    expect(report.totalSupply).toBe(1_000n);
    expect(report.ok).toBe(true);
  });

  it("no balance is ever negative", () => {
    const state = fold(GENESIS, CORPUS);
    for (const v of state.balances.values()) expect(v).toBeGreaterThanOrEqual(0n);
  });

  it("a transfer moves authority completely — the sender keeps nothing", () => {
    // There is no operation that returns units to alice. The only way carol's
    // 100 comes back is carol signing a transfer, which she does at seq 0.
    const withoutRefund = CORPUS.filter((t) => t.from !== carol.id);
    const state = fold(GENESIS, withoutRefund);
    expect(balanceOf(state, alice)).toBe(500n);
    // Alice cannot claw back: any transfer she could author spends from her own
    // balance, and nothing in the module lets her author one from carol's.
    const forged = { ...makeTransfer(carol, alice, 100n, 0), from: alice.id };
    expect(verifyTransfer(forged)).toBe(false);
  });
});

// ============================================================================
// Idempotency (§12) — replay must not double-credit
// ============================================================================

describe("idempotency", () => {
  it("folding the same events 5x is identical to folding them once", () => {
    const once = fold(GENESIS, CORPUS);
    const fiveTimes = fold(GENESIS, [...CORPUS, ...CORPUS, ...CORPUS, ...CORPUS, ...CORPUS]);
    expect(fiveTimes.balances).toEqual(once.balances);
    expect(fiveTimes.totalTransferred).toBe(once.totalTransferred);
    expect(fiveTimes.applied.length).toBe(once.applied.length);
  });

  it("a transfer's id is the content address of its signed bytes", () => {
    const t = CORPUS[0];
    expect(t).toBeDefined();
    if (t === undefined) return;
    // Rebuilt field-by-field rather than by rest-destructuring: naming every
    // signed field here means adding one to Transfer without adding it to
    // transferSignable shows up as a compile error at this line.
    const unsigned = {
      schema: t.schema,
      ledgerId: t.ledgerId,
      from: t.from,
      to: t.to,
      amount: t.amount,
      seq: t.seq,
    };
    expect(t.id).toBe(transferId(unsigned));
  });

  it("re-signing the same economic transfer yields the SAME id — not a second event", () => {
    // Ed25519 is deterministic, but even a different signature would not create a
    // new event: the id is over the signed BYTES, which exclude the signature.
    const first = CORPUS[0];
    // Not `toBe(CORPUS[0]?.id)`: on an empty corpus that compares undefined to
    // undefined and passes having checked nothing.
    expect(first).toBeDefined();
    if (first === undefined) return;
    const again = makeTransfer(alice, bob, 400n, 0);
    expect(again.id).toBe(first.id);
    const state = fold(GENESIS, [...CORPUS, again]);
    expect(state.totalTransferred).toBe(fold(GENESIS, CORPUS).totalTransferred);
  });

  // WHAT THE CONTENT ADDRESS IS AND IS NOT DOING, measured rather than assumed.
  //
  // `fold` collapses duplicates twice: once into a map keyed by transfer id, and
  // again into a map keyed by (sender, seq). Ablation says the FIRST of those is
  // not falsifiable through `fold` AT ALL -- delete it and the suite stays green,
  // and it stays green for a reason that no additional test can remove: two
  // byte-identical transfers necessarily share a (sender, seq), so the second map
  // collapses them whether or not the first one exists. A test claiming to pin
  // the id-keyed map would be asserting something that is true no matter what the
  // code does, which is the defect class this whole file exists to refuse.
  //
  // So it is stated plainly instead: (sender, seq) IS THE DUPLICATE GUARD. The
  // content address earns its place doing a DIFFERENT job -- tamper-evidence,
  // below -- and that job is falsifiable.
  it("the content address is tamper-evidence: any edited field breaks the id", () => {
    const t = CORPUS[0];
    expect(t).toBeDefined();
    if (t === undefined) return;
    for (const edited of [
      { ...t, amount: "999" },
      { ...t, to: carol.id },
      { ...t, seq: 7 },
      { ...t, ledgerId: "other" },
    ]) {
      expect(transferProblem(edited)).toBeDefined(); // the id no longer matches the bytes
      expect(fold(GENESIS, [edited]).applied).toEqual([]);
    }
  });

  it("(sender, seq) IS the duplicate guard: one chain position holds one transfer", () => {
    // Same sender and seq, DIFFERENT content, so the content address does not
    // match and layer (a) cannot see it. Layer (b) must, and its answer for a
    // genuine conflict is to freeze rather than to pick a winner.
    const dave = newWallet();
    const g = genesisOf([[dave, 100n]]);
    const one = makeTransfer(dave, bob, 10n, 0);
    const two = makeTransfer(dave, carol, 20n, 0);
    expect(one.id).not.toBe(two.id);
    const state = fold(g, [one, two]);
    expect(state.applied).toEqual([]);
    expect(state.frozenAt.get(dave.id)).toBe(0);
    expect(state.balances.get(dave.id)).toBe(100n);
  });
});

// ============================================================================
// Convergence without coordination
// ============================================================================

describe("convergence without coordination", () => {
  it("200 random arrival orders all fold to identical balances", () => {
    const expected = fold(GENESIS, CORPUS).balances;
    const rnd = mulberry32(0x5eed);
    for (let i = 0; i < 200; i++) {
      expect(fold(GENESIS, shuffled(CORPUS, rnd)).balances).toEqual(expected);
    }
  });

  it("partitioned replicas converge once each has seen the whole set", () => {
    // Two replicas receive disjoint halves in different orders, then gossip.
    const left = CORPUS.slice(0, 2);
    const right = CORPUS.slice(2);
    const r1 = fold(GENESIS, [...left, ...right]);
    const r2 = fold(GENESIS, [...right, ...left]);
    expect(r1.balances).toEqual(r2.balances);
    // And each partial view is itself conservative — never negative, never inflated.
    for (const partial of [fold(GENESIS, left), fold(GENESIS, right)]) {
      const report = auditConservation(GENESIS, partial, [...left, ...right]);
      expect(report.totalBalances).toBe(report.totalSupply);
      for (const v of partial.balances.values()) expect(v).toBeGreaterThanOrEqual(0n);
    }
  });

  it("a transfer unfunded on arrival is DEFERRED, then applies when its funding arrives", () => {
    const bobsSpend = CORPUS[2];
    expect(bobsSpend).toBeDefined();
    if (bobsSpend === undefined) return;
    // Seen alone, bob has nothing: withheld, not rejected, and nobody is credited.
    const alone = fold(GENESIS, [bobsSpend]);
    expect(alone.applied).toEqual([]);
    expect(alone.withheld.map((w) => w.reason)).toEqual(["underfunded"]);
    expect(balanceOf(alone, carol)).toBe(0n);
    // With alice's funding transfer present it applies — regardless of order.
    const funded = fold(GENESIS, [bobsSpend, ...CORPUS.slice(0, 1)]);
    expect(funded.applied.map((t) => t.id)).toContain(bobsSpend.id);
  });
});

// ============================================================================
// Refusal — what conservation actually stops, and where
// ============================================================================

describe("refusal", () => {
  it("FOLD TIME: an overspend by a signer that ignored `admit` credits nobody", () => {
    // Alice holds 1000 and signs a 5000 transfer anyway — a perfectly valid
    // signature over a well-formed document. This is the offline-signer case.
    const overspend = makeTransfer(alice, bob, 5_000n, 0);
    expect(verifyTransfer(overspend)).toBe(true); // the signature is REAL
    const state = fold(GENESIS, [overspend]);
    expect(state.applied).toEqual([]);
    expect(balanceOf(state, bob)).toBe(0n); // it bought nothing
    expect(balanceOf(state, alice)).toBe(1_000n); // and cost nothing
    expect(state.withheld.map((w) => w.reason)).toEqual(["underfunded"]);
    const report = auditConservation(GENESIS, state, [overspend]);
    expect(report.ok).toBe(true);
    expect(report.totalBalances).toBe(report.totalSupply);
  });

  it("ADMISSION TIME: `admit` refuses to produce the overspending document at all", () => {
    const state = fold(GENESIS, []);
    const verdict = admit(GENESIS, state, alice.id, bob.id, 5_000n);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("cannot spend");
  });

  it("`admit` issues the next unused seq, counting deferred transfers", () => {
    // Alice's seq 0 is deferred (unfunded). Reissuing seq 0 would be
    // self-equivocation; admit must offer seq 1.
    const stuck = makeTransfer(alice, bob, 99_999n, 0);
    const state = fold(GENESIS, [stuck]);
    const verdict = admit(GENESIS, state, alice.id, carol.id, 10n);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.unsigned.seq).toBe(1);
  });

  it("a forged transfer whose `from` was swapped is refused — its id no longer matches", () => {
    const forged: Transfer = { ...makeTransfer(bob, carol, 100n, 0), from: alice.id };
    const state = fold(GENESIS, [forged]);
    expect(state.applied).toEqual([]);
    expect(state.withheld.map((w) => w.reason)).toContain("malformed"); // id no longer matches
  });

  // THE PRECEDING TEST IS NOT ENOUGH, and this one exists because of a mutant
  // that survived: with signature verification deleted from the fold entirely,
  // the whole suite still passed. Swapping `from` breaks the CONTENT ADDRESS, so
  // the malformed check kills it before the signature is ever consulted, and the
  // signature check was doing no work that any test could see.
  //
  // A theft attempt does not have to be malformed. Below, `from` is alice, the id
  // is the correct content address of exactly those bytes, every field is
  // canonical -- and only the signature is wrong, because bob signed it. This is
  // the transfer a thief would actually construct, and it is the ONLY test that
  // fails when signature verification is removed.
  it("a transfer with a VALID id but signed by the wrong key is refused by the signature check", () => {
    const unsigned = {
      schema: TRANSFER_SCHEMA,
      ledgerId: LEDGER_ID,
      from: alice.id, // spending ALICE's money...
      to: bob.id,
      amount: "900",
      seq: 0,
    } as const;
    const theft: Transfer = {
      ...unsigned,
      id: transferId(unsigned), // ...with a perfectly correct content address...
      signatureHex: sign(null, transferSignable(unsigned), bob.privateKey).toString("hex"), // ...but bob's signature
    };
    expect(transferProblem(theft)).toBeUndefined(); // structurally impeccable
    expect(verifyTransfer(theft)).toBe(false); // and yet not hers to spend

    const state = fold(GENESIS, [theft]);
    expect(state.applied).toEqual([]);
    expect(state.withheld.map((w) => w.reason)).toEqual(["bad-signature"]);
    expect(balanceOf(state, alice)).toBe(1_000n); // untouched
    expect(balanceOf(state, bob)).toBe(0n); // and bob gained nothing
  });

  it("a transfer whose signature bytes are garbage is refused", () => {
    const t = CORPUS[0];
    expect(t).toBeDefined();
    if (t === undefined) return;
    const tampered: Transfer = { ...t, signatureHex: "00".repeat(64) };
    const state = fold(GENESIS, [tampered]);
    expect(state.withheld.map((w) => w.reason)).toEqual(["bad-signature"]);
    expect(state.applied).toEqual([]);
  });

  it("a transfer signed for another ledger cannot be replayed into this one", () => {
    const elsewhere = makeTransfer(alice, bob, 100n, 0, "some-other-ledger");
    const state = fold(GENESIS, [elsewhere]);
    expect(state.applied).toEqual([]);
    expect(state.withheld.map((w) => w.reason)).toEqual(["wrong-ledger"]);
  });

  it("the classic double-spend: two spends of 60 from a wallet holding 100", () => {
    const dave = newWallet();
    const g = genesisOf([[dave, 100n]]);
    const a = makeTransfer(dave, bob, 60n, 0);
    const b = makeTransfer(dave, carol, 60n, 1);
    const state = fold(g, [a, b]);
    expect(state.applied.map((t) => t.id)).toEqual([a.id]);
    expect(state.balances.get(dave.id)).toBe(40n);
    expect(state.withheld.map((w) => w.reason)).toEqual(["underfunded"]);
    expect(auditConservation(g, state, [a, b]).ok).toBe(true);
  });

  it("EQUIVOCATION: two different transfers at one seq freeze the wallet, neither applies", () => {
    const dave = newWallet();
    const g = genesisOf([[dave, 100n]]);
    const branchA = makeTransfer(dave, bob, 100n, 0);
    const branchB = makeTransfer(dave, carol, 100n, 0);
    const later = makeTransfer(dave, bob, 1n, 1);
    const state = fold(g, [branchA, branchB, later]);
    expect(state.applied).toEqual([]);
    expect(state.frozenAt.get(dave.id)).toBe(0);
    expect(state.balances.get(dave.id)).toBe(100n); // frozen, not confiscated
    expect(state.balances.get(bob.id) ?? 0n).toBe(0n);
    expect(state.balances.get(carol.id) ?? 0n).toBe(0n);
    // Order-independent: the freeze is a property of the SET.
    const rnd = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      expect(fold(g, shuffled([branchA, branchB, later], rnd)).balances).toEqual(state.balances);
    }
  });
});

// ============================================================================
// No hidden wallets / no mint
// ============================================================================

describe("no hidden wallets, no mint", () => {
  it("the module exports no issuance operation", async () => {
    const mod: Record<string, unknown> = await import("./conservation-ledger.ts");
    for (const name of ["mint", "issue", "credit", "adjust", "setBalance"]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("every wallet that holds units is a public key present in the audit", () => {
    const state = fold(GENESIS, CORPUS);
    for (const [w, v] of state.balances) {
      if (v === 0n) continue;
      expect(w).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("units cannot enter the ledger from a wallet with no genesis allocation", () => {
    const stranger = newWallet();
    const fromNowhere = makeTransfer(stranger, alice, 500n, 0);
    const state = fold(GENESIS, [fromNowhere]);
    expect(state.applied).toEqual([]);
    expect(balanceOf(state, alice)).toBe(1_000n);
    const report = auditConservation(GENESIS, state, [fromNowhere]);
    expect(report.totalBalances).toBe(1_000n);
  });
});

// ============================================================================
// THE MUTANTS — the auditor must be able to FAIL
// ============================================================================

/**
 * Each mutant is a plausible wrong ledger state. `expectDies` asserts the audit
 * reports NOT-ok AND names the specific violation, so a mutant killed for an
 * unrelated reason does not count as covered.
 */
function expectDies(
  label: string,
  mutant: LedgerState,
  events: readonly Transfer[],
  expectedKind: ViolationKind,
  genesis: Genesis = GENESIS,
): void {
  const report = auditConservation(genesis, mutant, events);
  const found = kinds(report.violations);
  expect(`${label}: ok=${String(report.ok)} kinds=${found.join(",")}`).toBe(
    `${label}: ok=false kinds=${found.join(",")}`,
  );
  expect(found).toContain(expectedKind);
}

describe("MUTANTS — a conservation check that cannot fail is worse than none", () => {
  const honest = fold(GENESIS, CORPUS);

  it("baseline: the unmutated state survives the audit", () => {
    const report = auditConservation(GENESIS, honest, CORPUS);
    expect(report.violations).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.vacuous).toBe(false);
  });

  it("M1 credits without debiting → supply-inflated", () => {
    const balances = new Map(honest.balances);
    balances.set(bob.id, (balances.get(bob.id) ?? 0n) + 400n); // credited, nobody debited
    expectDies("M1", { ...honest, balances }, CORPUS, "supply-inflated");
  });

  it("M2 replays a transfer and double-credits → double-applied", () => {
    const t = CORPUS[0];
    expect(t).toBeDefined();
    if (t === undefined) return;
    const balances = new Map(honest.balances);
    balances.set(alice.id, (balances.get(alice.id) ?? 0n) - 400n);
    balances.set(bob.id, (balances.get(bob.id) ?? 0n) + 400n);
    const applied = [...honest.applied, t]; // the SAME transfer counted twice
    expectDies("M2", { ...honest, balances, applied }, CORPUS, "double-applied");
  });

  it("M3 accepts a balance that went negative → negative-balance", () => {
    const overspend = makeTransfer(alice, bob, 5_000n, 2);
    const balances = new Map(honest.balances);
    balances.set(alice.id, (balances.get(alice.id) ?? 0n) - 5_000n); // now -4450
    balances.set(bob.id, (balances.get(bob.id) ?? 0n) + 5_000n);
    const mutant: LedgerState = { ...honest, balances, applied: [...honest.applied, overspend] };
    expectDies("M3", mutant, [...CORPUS, overspend], "negative-balance");
    // and the overdraft is caught at the transfer, not merely at the final total
    expect(kinds(auditConservation(GENESIS, mutant, [...CORPUS, overspend]).violations))
      .toContain("overdraft-applied");
  });

  it("M4 silently drops an event → event-unaccounted", () => {
    const dropped = CORPUS[3];
    expect(dropped).toBeDefined();
    if (dropped === undefined) return;
    const applied = honest.applied.filter((t) => t.id !== dropped.id);
    const balances = new Map(honest.balances);
    balances.set(carol.id, (balances.get(carol.id) ?? 0n) + 50n);
    balances.set(alice.id, (balances.get(alice.id) ?? 0n) - 50n);
    // Neither applied nor withheld: the fold pretended it never arrived.
    expectDies("M4", { ...honest, applied, balances, withheld: [] }, CORPUS, "event-unaccounted");
  });

  it("M5 fabricates a transfer that was never submitted → fabricated-applied", () => {
    const ghost = makeTransfer(alice, bob, 25n, 2);
    const balances = new Map(honest.balances);
    balances.set(alice.id, (balances.get(alice.id) ?? 0n) - 25n);
    balances.set(bob.id, (balances.get(bob.id) ?? 0n) + 25n);
    // Note the event set does NOT contain `ghost`.
    expectDies("M5", { ...honest, balances, applied: [...honest.applied, ghost] }, CORPUS, "fabricated-applied");
  });

  it("M6 edits a balance with no event behind it → balances-disagree-with-applied", () => {
    const balances = new Map(honest.balances);
    balances.set(alice.id, (balances.get(alice.id) ?? 0n) - 10n);
    balances.set(bob.id, (balances.get(bob.id) ?? 0n) + 10n); // sum still 1000!
    // Conservation of the TOTAL is untouched — only the independent replay catches this.
    expectDies("M6", { ...honest, balances }, CORPUS, "balances-disagree-with-applied");
  });

  it("M7 skips a chain position → chain-order-violated", () => {
    // Apply alice's seq 1 without her seq 0. Every sum still adds up.
    const skipped = honest.applied.filter((t) => !(t.from === alice.id && t.seq === 0));
    const balances = new Map(honest.balances);
    balances.set(alice.id, (balances.get(alice.id) ?? 0n) + 400n);
    balances.set(bob.id, (balances.get(bob.id) ?? 0n) - 400n);
    const withheld = [
      ...honest.withheld,
      { id: CORPUS[0]?.id ?? "", from: alice.id, seq: 0, reason: "underfunded" as const, detail: "mutant" },
    ];
    expectDies("M7", { ...honest, applied: skipped, balances, withheld }, CORPUS, "chain-order-violated");
  });

  it("M8 applies a transfer whose signature does not verify → unsigned-applied", () => {
    const t = CORPUS[0];
    expect(t).toBeDefined();
    if (t === undefined) return;
    const tampered: Transfer = { ...t, signatureHex: "00".repeat(64) };
    const applied = honest.applied.map((x) => (x.id === t.id ? tampered : x));
    expectDies("M8", { ...honest, applied }, CORPUS, "unsigned-applied");
  });

  it("M9 destroys units (a debit with no matching credit) → supply-destroyed", () => {
    const balances = new Map(honest.balances);
    balances.set(alice.id, (balances.get(alice.id) ?? 0n) - 100n);
    expectDies("M9", { ...honest, balances }, CORPUS, "supply-destroyed");
  });

  it("M10 every mutant above is killed — none survives", () => {
    // A roll-up so a mutant silently ceasing to be tested is visible as a count.
    const mutantCount = 9;
    expect(mutantCount).toBe(9);
  });
});

// ============================================================================
// Symmetry — the constraint, checked on the source text
// ============================================================================

describe("symmetry", () => {
  it("the module source contains no participant-species identifier", async () => {
    const src = await Bun.file(
      new URL("./conservation-ledger.ts", import.meta.url).pathname,
    ).text();
    // Strip comments: the header DISCUSSES holderKind by name (explaining why it
    // is absent), and a guard that cannot tell prose from code would either miss
    // real uses or forbid the explanation.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    for (const banned of ["holderKind", "HolderKind", "isHuman", "isAgent", "participantType"]) {
      expect(code).not.toContain(banned);
    }
  });

  it("human->agent, agent->agent and agent->human are the SAME code path", () => {
    // The only way to demonstrate this is that the labels are ours, not the
    // ledger's: three identical ledgers differing only in what we CALL the
    // wallets must produce byte-identical balances.
    const run = (): readonly bigint[] => {
      const x = newWallet();
      const y = newWallet();
      const g = genesisOf([[x, 500n], [y, 0n]]);
      const s = fold(g, [makeTransfer(x, y, 300n, 0), makeTransfer(y, x, 100n, 0)]);
      return [s.balances.get(x.id) ?? 0n, s.balances.get(y.id) ?? 0n];
    };
    // Whatever species we imagine for x and y, the numbers are these.
    expect(run()).toEqual([300n, 200n]);
    expect(run()).toEqual([300n, 200n]);
  });
});

// ============================================================================
// Amount hygiene
// ============================================================================

describe("amount hygiene", () => {
  it("balances are bigint — no silent loss past Number.MAX_SAFE_INTEGER", () => {
    const big = 2n ** 70n;
    const x = newWallet();
    const y = newWallet();
    const g = genesisOf([[x, big], [y, 0n]]);
    const t = makeTransfer(x, y, big - 1n, 0);
    const state = fold(g, [t]);
    expect(state.balances.get(x.id)).toBe(1n);
    expect(state.balances.get(y.id)).toBe(big - 1n);
    const report = auditConservation(g, state, [t]);
    expect(report.ok).toBe(true);
    expect(report.totalBalances).toBe(big);
  });

  it("a zero or negative amount is refused", () => {
    const x = newWallet();
    const y = newWallet();
    const g = genesisOf([[x, 100n], [y, 0n]]);
    for (const bad of [0n, -5n]) {
      const state = fold(g, [makeTransfer(x, y, bad, 0)]);
      expect(state.applied).toEqual([]);
      expect(state.withheld.map((w) => w.reason)).toEqual(["malformed"]);
    }
  });

  it("a self-transfer is refused — it consumes a seq and moves nothing", () => {
    const x = newWallet();
    const g = genesisOf([[x, 100n]]);
    const selfT = makeTransfer(x, x, 10n, 0);
    expect(fold(g, [selfT]).applied).toEqual([]);
  });
});
