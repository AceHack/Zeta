/**
 * x402.ts — HTTP 402 Payment Required, with the agent signing LOCALLY.
 *
 * The distinction the whole file exists to enforce:
 *
 *   ┌─ CUSTODY ────────────────────────────────────────────────────────────────┐
 *   │ Holding the key. Producing a signature. Deciding to spend.               │
 *   │ NEVER leaves the payer's own `Signer`.                                   │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *   ┌─ SETTLEMENT / VERIFICATION ──────────────────────────────────────────────┐
 *   │ Checking a signature. Relaying it. Broadcasting it.                      │
 *   │ Requires NO key and NO trust. Anyone may do it, including a facilitator  │
 *   │ nobody trusts — and including nobody at all.                             │
 *   └──────────────────────────────────────────────────────────────────────────┘
 *
 * A facilitator that holds the key is a custodian, and a custodian is an
 * appointed hub with your money in it. So the design constraint is structural
 * rather than procedural: **the verification function takes no signer**, and
 * `PaymentAuthorization` has no field that could carry private material. You can
 * check that by reading the two signatures below; it does not depend on anyone
 * behaving well.
 *
 * ── FACILITATOR-OPTIONAL, AND WHY IT IS TESTED THAT WAY ──────────────────────
 * `PaymentChallenge.facilitator` is optional, and the resource server calls the
 * SAME `verifyPaymentAuthorization` whether one is present, absent, or lying. A
 * facilitator's verdict is ADVISORY — it can speed things up and it cannot
 * decide anything. Tests pin all three: absent, present-and-honest, and
 * present-and-lying, with the resource server reaching the correct verdict in
 * every case. If a facilitator's presence could change the outcome, it would be
 * a hub, because you would have to route through it to be paid.
 *
 * ── PAIRWISE, NOT GLOBAL ─────────────────────────────────────────────────────
 * A payment needs the PAYER and the RESOURCE SERVER each to accept the other's
 * trust domain. It does not need society-wide agreement, and a third node that
 * rejects the payer is legal, retained (`verdict-vault.ts`), and simply not
 * party to this transaction.
 *
 * ── REGISTER: `toy`, AND THE SCOPE OF THAT WORD ──────────────────────────────
 * `zeta-local-sig-v0` is a scheme invented in this file. It is NOT the x402
 * protocol as specified by anyone, NOT interoperable with any deployed
 * facilitator, and it moves NO money: there is no chain, no testnet, no
 * settlement layer, and no code path that contacts a network. What is genuinely
 * exercised is the *shape* — challenge, locally-signed authorization,
 * keyless verification — and the custody property, which holds structurally.
 * Nothing here has been run against a real payment network and nothing should be.
 */

import { createHash } from "node:crypto";

import {
  canonicalBytes,
  canonicalJson,
  type Decision,
  type Phase,
  type Result,
  type SignatureVerifier,
  type Signer,
  err,
  ok,
} from "./ports.ts";
import { type AcceptedBundles } from "./trust-bundle.ts";
import { validatePeerSvid, type SignedSvid } from "./local-issuer.ts";

/** The body a resource server returns with HTTP 402. Public; carries no secret. */
export const X402_SCHEME = "zeta-local-sig-v0";

export interface PaymentChallenge {
  /**
   * `string`, NOT the literal `"zeta-local-sig-v0"`, and the difference is a bug
   * class rather than a style choice.
   *
   * Typed as the literal, `challenge.scheme !== X402_SCHEME` is provably false
   * and the guard below is DEAD CODE — a scheme check no input can trip, which
   * reads as validation and performs none. ESLint's `no-unnecessary-condition`
   * caught exactly that here. Same defect as `WitnessStake.voluntary: true` in
   * `src/Core.TypeScript/key-custody/key-custody.ts`: a wrong value must be
   * REPRESENTABLE in order to be REFUSABLE.
   */
  readonly scheme: string;
  readonly resource: string;
  /**
   * Decimal string, culture-invariant. NOT a JS number: binary floating point
   * cannot represent most decimal money exactly, and a rounding difference
   * between payer and verifier is a signature mismatch at best and a silent
   * underpayment at worst.
   */
  readonly amount: string;
  readonly asset: string;
  readonly payTo: string;
  /** Fresh per challenge. The replay defence. */
  readonly nonce: string;
  readonly expiresAtPhase: Phase;
  /** OPTIONAL. Absent must work identically — that is the point. */
  readonly facilitator?: string;
}

/**
 * The payer's locally-produced authorization.
 *
 * Every field is public. There is deliberately no `privateKey`, no `keyMaterial`,
 * no `seed`, and no `mnemonic` — and the reason to say so explicitly is that a
 * type with such a field is how custody leaks by accident.
 */
export interface PaymentAuthorization {
  readonly challengeDigest: string;
  readonly payerSpiffeId: string;
  readonly payerKeyId: string;
  readonly amount: string;
  readonly asset: string;
  readonly payTo: string;
  readonly nonce: string;
  readonly signedAtPhase: Phase;
  readonly signature: string;
}

/** A ceiling a human set. The agent spends inside it and cannot raise it. */
export interface StandingBudget {
  readonly asset: string;
  /** Decimal string. */
  readonly perPaymentMax: string;
  readonly totalMax: string;
  readonly spentSoFar: string;
}

export type PaymentRefusal =
  | { readonly kind: "unsupported-scheme"; readonly scheme: string }
  | { readonly kind: "challenge-expired"; readonly expiresAtPhase: Phase; readonly currentPhase: Phase }
  | { readonly kind: "asset-mismatch"; readonly budgetAsset: string; readonly challengeAsset: string }
  | { readonly kind: "malformed-amount"; readonly amount: string }
  | {
      /** Over budget ⇒ this is the gated class. The agent proposes; a human decides. */
      readonly kind: "exceeds-standing-budget";
      readonly amount: string;
      readonly limit: string;
      readonly limitKind: "per-payment" | "total";
      readonly ceremony: "x402-authorize-exceeding-standing-budget";
    }
  | { readonly kind: "signer-refused"; readonly detail: string };

export function challengeDigest(challenge: PaymentChallenge): string {
  return createHash("sha256").update(canonicalJson(challenge), "utf8").digest("hex");
}

export function authorizationSigningBytes(auth: Omit<PaymentAuthorization, "signature">): Uint8Array {
  return canonicalBytes({ purpose: "zeta-x402-authorization-v0", auth });
}

/**
 * Parse a decimal money string into integer minor units.
 *
 * Integer arithmetic, never floats. `0.1 + 0.2 !== 0.3` is the canonical
 * example and it is a real defect class in payment code, not a curiosity.
 * Returns `null` for anything that is not a plain non-negative decimal with at
 * most `scale` fraction digits — refusing rather than coercing, because a
 * silently-truncated amount is a payment for the wrong sum.
 */
export function parseDecimalMinor(value: string, scale = 6): number | null {
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  if (frac.length > scale) return null;
  const padded = frac.padEnd(scale, "0");
  const n = Number(`${String(whole)}${padded}`);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Sign a payment authorization LOCALLY.
 *
 * The `Signer` is the payer's own. Note what this function does NOT take: a
 * facilitator, a network client, a custodian, or anything resembling a remote
 * signing service. There is no path by which the key leaves.
 */
export function authorizePaymentLocally(params: {
  readonly challenge: PaymentChallenge;
  readonly payerSpiffeId: string;
  readonly signer: Signer;
  readonly budget: StandingBudget;
  readonly currentPhase: Phase;
}): Result<PaymentAuthorization, PaymentRefusal> {
  const { challenge, payerSpiffeId, signer, budget, currentPhase } = params;

  if (challenge.scheme !== X402_SCHEME) {
    return err({ kind: "unsupported-scheme", scheme: challenge.scheme });
  }
  if (currentPhase >= challenge.expiresAtPhase) {
    return err({ kind: "challenge-expired", expiresAtPhase: challenge.expiresAtPhase, currentPhase });
  }
  if (challenge.asset !== budget.asset) {
    return err({ kind: "asset-mismatch", budgetAsset: budget.asset, challengeAsset: challenge.asset });
  }

  const amount = parseDecimalMinor(challenge.amount);
  const perMax = parseDecimalMinor(budget.perPaymentMax);
  const totalMax = parseDecimalMinor(budget.totalMax);
  const spent = parseDecimalMinor(budget.spentSoFar);
  if (amount === null || perMax === null || totalMax === null || spent === null) {
    return err({ kind: "malformed-amount", amount: challenge.amount });
  }
  if (amount > perMax) {
    return err({
      kind: "exceeds-standing-budget",
      amount: challenge.amount,
      limit: budget.perPaymentMax,
      limitKind: "per-payment",
      ceremony: "x402-authorize-exceeding-standing-budget",
    });
  }
  if (spent + amount > totalMax) {
    return err({
      kind: "exceeds-standing-budget",
      amount: challenge.amount,
      limit: budget.totalMax,
      limitKind: "total",
      ceremony: "x402-authorize-exceeding-standing-budget",
    });
  }

  const unsigned: Omit<PaymentAuthorization, "signature"> = {
    challengeDigest: challengeDigest(challenge),
    payerSpiffeId,
    payerKeyId: signer.keyId,
    amount: challenge.amount,
    asset: challenge.asset,
    payTo: challenge.payTo,
    nonce: challenge.nonce,
    signedAtPhase: currentPhase,
  };
  const signature = signer.sign(authorizationSigningBytes(unsigned));
  if (!signature.ok) return err({ kind: "signer-refused", detail: JSON.stringify(signature.error) });
  return ok({ ...unsigned, signature: signature.value });
}

/**
 * Every member of this union is EMITTED by `verifyPaymentAuthorization` and is
 * proven reachable by `x402.test.ts` §"every payment rejection is reachable",
 * which enumerates the union rather than a hand-picked subset.
 *
 * That test earned its keep immediately: the first draft of this union also
 * declared `"payer-key-not-bound-to-svid"` and `"signed-before-issue"`, and
 * NEITHER was ever returned by any code path. They read as two extra checks the
 * verifier performs. It performs neither — the first is subsumed by verifying
 * the signature under the SVID-bound public key (which is the check that
 * actually binds payer to key), and the second by the expiry comparison. Two
 * declared-but-unimplemented guarantees, caught by enumeration and deleted
 * rather than left to look like protection.
 */
export type PaymentRejection =
  | "challenge-digest-mismatch"
  | "nonce-mismatch"
  | "terms-mismatch"
  | "nonce-already-spent"
  | "challenge-expired"
  | "payer-svid-not-accepted"
  | "signature-invalid";

export interface PaymentVerdict extends Decision {
  readonly rejection?: PaymentRejection;
}

/**
 * Verify a payment authorization.
 *
 * ── THE CUSTODY ARGUMENT, VISIBLE IN THIS SIGNATURE ──────────────────────────
 * There is no `Signer` parameter and there never can be one: verification needs
 * the payer's PUBLIC key (carried in the payer's SVID, itself verified against
 * bundles the verifier locally accepts) and nothing else. So:
 *   - the resource server can run this alone (facilitator absent),
 *   - a facilitator can run it and its answer is advisory,
 *   - a bystander can run it,
 * and none of them can produce a payment. That asymmetry is what keeps
 * settlement from becoming custody.
 *
 * `spentNonces` is required, not optional. Replay protection that a caller can
 * omit by leaving out an argument is replay protection that is off by default,
 * and the default is the thing that ships.
 */
export function verifyPaymentAuthorization(params: {
  readonly authorization: PaymentAuthorization;
  readonly challenge: PaymentChallenge;
  readonly payerSvid: SignedSvid;
  readonly accepted: AcceptedBundles;
  readonly verifier: SignatureVerifier;
  readonly currentPhase: Phase;
  readonly spentNonces: ReadonlySet<string>;
}): PaymentVerdict {
  const { authorization: a, challenge, payerSvid, accepted, verifier, currentPhase, spentNonces } = params;

  if (a.challengeDigest !== challengeDigest(challenge)) {
    return {
      allowed: false,
      rejection: "challenge-digest-mismatch",
      reason: "authorization is bound to a different challenge; an authorization for one invoice must not pay another",
    };
  }
  if (a.nonce !== challenge.nonce) {
    return {
      allowed: false,
      rejection: "nonce-mismatch",
      reason: `authorization nonce '${a.nonce}' does not match challenge nonce '${challenge.nonce}'`,
    };
  }
  if (a.amount !== challenge.amount || a.asset !== challenge.asset || a.payTo !== challenge.payTo) {
    return {
      allowed: false,
      rejection: "terms-mismatch",
      reason: `authorization terms (${a.amount} ${a.asset} → ${a.payTo}) do not match the challenge (${challenge.amount} ${challenge.asset} → ${challenge.payTo})`,
    };
  }
  if (spentNonces.has(a.nonce)) {
    return {
      allowed: false,
      rejection: "nonce-already-spent",
      reason: `nonce '${a.nonce}' has already been settled; replaying it would charge twice for one authorization`,
    };
  }
  if (currentPhase >= challenge.expiresAtPhase) {
    return {
      allowed: false,
      rejection: "challenge-expired",
      reason: `challenge expired at phase ${String(challenge.expiresAtPhase)}, agreed phase is ${String(currentPhase)}`,
    };
  }
  if (a.signedAtPhase >= challenge.expiresAtPhase) {
    return {
      allowed: false,
      rejection: "challenge-expired",
      reason: `authorization was signed at phase ${String(a.signedAtPhase)}, at or after the challenge expiry ${String(challenge.expiresAtPhase)}`,
    };
  }

  // The payer's identity is checked against bundles THIS verifier accepts —
  // pairwise. No global registry is consulted and none exists.
  const idVerdict = validatePeerSvid({ accepted, signed: payerSvid, currentPhase, verifier });
  if (!idVerdict.allowed) {
    return {
      allowed: false,
      rejection: "payer-svid-not-accepted",
      reason: `payer identity not accepted by this verifier: ${idVerdict.reason}`,
    };
  }
  if (payerSvid.claim.spiffeId !== a.payerSpiffeId) {
    return {
      allowed: false,
      rejection: "payer-svid-not-accepted",
      reason: `authorization claims payer '${a.payerSpiffeId}' but the presented SVID is for '${payerSvid.claim.spiffeId}'`,
    };
  }

  // The signature must be by the key the SVID BINDS, not by whatever key the
  // authorization names. Trusting `payerKeyId` would let anyone name a key.
  const { signature, ...unsigned } = a;
  if (!verifier.verify(payerSvid.claim.subjectPublicKey, authorizationSigningBytes(unsigned), signature)) {
    return {
      allowed: false,
      rejection: "signature-invalid",
      reason: "authorization signature does not verify under the public key bound by the payer's SVID",
    };
  }

  return {
    allowed: true,
    reason:
      `payment of ${a.amount} ${a.asset} to ${a.payTo} authorized by '${a.payerSpiffeId}' and verified locally` +
      (challenge.facilitator
        ? ` (facilitator '${challenge.facilitator}' was named; its opinion was not consulted)`
        : " (no facilitator involved)"),
  };
}

/**
 * A facilitator's opinion. Structurally advisory: it is a verdict-shaped value
 * that no verification path reads.
 *
 * It exists so the untrusted-facilitator case is TESTABLE — a test can hand the
 * resource server a facilitator claiming `allowed: true` for a forged
 * authorization and assert the resource server still refuses. Without a type for
 * the lie, that test cannot be written, and "the facilitator is untrusted" stays
 * an assertion rather than a check.
 */
export interface FacilitatorOpinion {
  readonly facilitator: string;
  readonly claimsValid: boolean;
  readonly note: string;
}

/**
 * The resource server's decision, showing that the facilitator's opinion is
 * discarded.
 *
 * The returned `agreedWithFacilitator` field is REPORTING, not input: it is
 * computed after the verdict and never feeds into it. A facilitator that
 * disagrees with the truth is information about the facilitator, which is
 * exactly the neutral fact the caller's own oracle should get to read.
 */
export function resourceServerDecision(params: {
  readonly verdict: PaymentVerdict;
  readonly facilitatorOpinion?: FacilitatorOpinion;
}): { readonly settle: boolean; readonly reason: string; readonly agreedWithFacilitator?: boolean } {
  const { verdict, facilitatorOpinion } = params;
  if (facilitatorOpinion === undefined) {
    return { settle: verdict.allowed, reason: `decided locally with no facilitator: ${verdict.reason}` };
  }
  const agreed = facilitatorOpinion.claimsValid === verdict.allowed;
  return {
    settle: verdict.allowed,
    agreedWithFacilitator: agreed,
    reason: agreed
      ? `decided locally (facilitator '${facilitatorOpinion.facilitator}' agreed, which changed nothing): ${verdict.reason}`
      : `decided locally, OVERRIDING facilitator '${facilitatorOpinion.facilitator}' which claimed ${String(facilitatorOpinion.claimsValid)}: ${verdict.reason}`,
  };
}
