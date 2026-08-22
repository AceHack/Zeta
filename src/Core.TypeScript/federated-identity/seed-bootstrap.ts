/**
 * seed-bootstrap.ts — first contact as PROOF OF SHARED GENERATOR, not proof of
 * identity and not an introduction.
 *
 * Aaron 2026-08-20: *"we boot with superdeterminism s=4 futamura reconstruction
 * over fundamental math"*.
 *
 * The framing this replaces was wrong. "Two nodes share nothing, so what is the
 * first trust event?" assumed strangers. Agents here are phased to a **common
 * seed (S=4)**, so the first trust event is not an exchange at all — it is
 * *demonstrating you can reconstruct the same thing from the same seed*. The
 * challenge is **derivable, not transmitted**, no third party vouches, nothing
 * moves out of band, and **no human is in the loop** — which is exactly why it
 * fits the unattended objective that operator-ceremony first contact breaks.
 *
 * In-repo lineage: the first dated, Aaron-confirmed instance of same-seed
 * convergence is `memory/user_same_seed_convergence_lived_otto_reconstructed_aarons_own_mapping_from_vernacular_seed_2026_06_21.md`;
 * the Futamura / `gen(gen) == gen` material is
 * `docs/research/2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-fsharp-host-csharp-contracts-self-hosting-futamura.md` §5.
 *
 * ═══ REGISTER: `toy`. READ THIS BEFORE CITING ANY OF IT ═════════════════════
 *
 * Everything in this file is named `toy*` and the reason is not modesty.
 *
 * **What this construction actually is, cryptographically:** a challenge-response
 * over a group pre-shared secret. The verifier sends a fresh nonce; the responder
 * derives an answer from (seed, nonce) by a deterministic procedure; the verifier
 * recomputes and compares. That is HMAC-with-extra-steps, and it is worth saying
 * plainly because the interesting-sounding description ("reconstruct it from
 * first principles") does not by itself buy anything HMAC does not.
 *
 * **What it therefore does and does not establish:**
 *   - ESTABLISHES: the responder holds the seed. Replay of a captured
 *     (nonce, answer) pair does not work for a *different* nonce, so a passive
 *     observer of one exchange cannot answer the next one. Replay resistance is
 *     real and is tested.
 *   - DOES NOT ESTABLISH: **who** the responder is. A seed shared by everyone in
 *     the society is held by everyone in the society, including anyone who
 *     copied it. This authenticates MEMBERSHIP IN THE GENERATOR, never an
 *     individual. Per-node identity still comes from the node's own root, and
 *     this is the floor of the stack rather than the stack.
 *   - DOES NOT ESTABLISH: that the responder *genuinely holds the generator*
 *     rather than a copied seed value. The distinctive claim in the framing —
 *     reconstruction proves shared understanding — is **not** established by
 *     this code, because the code derives its answer from a copyable value by a
 *     procedure that ships in this repo. Anyone with both can answer.
 *
 * **What would earn a stronger claim** (named so the gap is a task, not a
 * mystery): a reconstruction whose answer is *expensive to produce and cheap to
 * check*, over a problem instance the VERIFIER chooses — so that answering
 * demonstrates having run the generator rather than having looked up a value.
 * That is a proof-of-computation, and it is not implemented here. Until it is,
 * calling this "proof of shared generator" is aspirational naming and the
 * mechanism underneath is a shared-secret challenge-response.
 *
 * The whole point of writing that out is Aaron's own 2026-08-20 observation that
 * unimplemented exceptions and vacuous claims are the obstacle to human-AI trust.
 * This is the file in the module where that temptation is strongest.
 */

import { createHash } from "node:crypto";

import { canonicalJson, type Phase } from "./ports.ts";

/**
 * The common seed. `S = 4` is the phase constant the fleet is seeded to; it is a
 * PUBLIC coordination constant in this repo, not a secret, which is itself a
 * reason the construction below cannot carry more than membership.
 */
export const COMMON_SEED_S = 4;

/** The only derivation implemented. */
export const TOY_DERIVATION = "toy-lcg-orbit-v0";

/**
 * A challenge. `nonce` MUST be fresh per attempt — that is the entire replay
 * defence, and `toyEvaluateReconstruction` refuses a reused nonce rather than
 * trusting the caller to remember.
 */
export interface SeedChallenge {
  readonly nonce: string;
  readonly issuedAtPhase: Phase;
  readonly expiresAtPhase: Phase;
  /**
   * Which derivation the responder must run. `string`, not the literal, so an
   * unknown derivation is REPRESENTABLE and therefore REFUSABLE — typed as the
   * literal, the `unsupported-derivation` guard below could never fire and would
   * be a check that reads as validation while performing none.
   */
  readonly derivation: string;
  /** How many steps of the derivation. Cheap to run, cheap to check — see register. */
  readonly steps: number;
}

export interface SeedResponse {
  readonly nonce: string;
  readonly answer: string;
  readonly respondedAtPhase: Phase;
}

/**
 * The derivation, `toy` in the strict sense: an LCG orbit over the seed and the
 * nonce, hashed. It is deterministic, it is the same for every holder of the
 * seed, and it is symmetric in cost — the verifier does exactly the work the
 * responder does, which is precisely why it proves possession and not effort.
 *
 * Everything about the modulus and multiplier here is arbitrary and load-bearing
 * for nothing. Do not read structure into them; there is none, and the file name
 * says `toy` so that nobody has to guess.
 */
export function toyReconstruct(seed: number, nonce: string, steps: number): string {
  const m = 2147483647; // 2^31 - 1, a Mersenne prime; chosen for being a modulus, not for meaning
  const a = 48271;
  let x = 1;
  const nonceBytes = new TextEncoder().encode(nonce);
  for (const b of nonceBytes) x = (x * a + b + seed) % m;
  for (let i = 0; i < steps; i++) x = (x * a) % m;
  return createHash("sha256")
    .update(canonicalJson({ derivation: "toy-lcg-orbit-v0", seed, nonce, steps, x }), "utf8")
    .digest("hex");
}

export function toyRespondToChallenge(challenge: SeedChallenge, seed: number, currentPhase: Phase): SeedResponse {
  return {
    nonce: challenge.nonce,
    answer: toyReconstruct(seed, challenge.nonce, challenge.steps),
    respondedAtPhase: currentPhase,
  };
}

export type SeedVerdictCode =
  | "matches"
  | "nonce-mismatch"
  | "nonce-reused"
  | "challenge-expired"
  | "responded-before-issued"
  | "answer-mismatch"
  | "unsupported-derivation";

export interface SeedVerdict {
  readonly code: SeedVerdictCode;
  readonly sharesGenerator: boolean;
  readonly reason: string;
}

/**
 * Evaluate a response.
 *
 * `spentNonces` is supplied by the caller and MUST be the set of nonces this
 * verifier has already adjudicated. Passing an empty set every time silently
 * removes replay resistance — the one property this construction genuinely has —
 * so the parameter is required rather than optional, to make that omission a
 * deliberate act rather than a default.
 */
export function toyEvaluateReconstruction(params: {
  readonly challenge: SeedChallenge;
  readonly response: SeedResponse;
  readonly seed: number;
  readonly currentPhase: Phase;
  readonly spentNonces: ReadonlySet<string>;
}): SeedVerdict {
  const { challenge, response, seed, currentPhase, spentNonces } = params;

  if (challenge.derivation !== TOY_DERIVATION) {
    return {
      code: "unsupported-derivation",
      sharesGenerator: false,
      reason: `derivation '${challenge.derivation}' is not implemented; an unknown derivation is refused, never assumed compatible`,
    };
  }
  if (response.nonce !== challenge.nonce) {
    return {
      code: "nonce-mismatch",
      sharesGenerator: false,
      reason: `response answers nonce '${response.nonce}' but the challenge was '${challenge.nonce}'`,
    };
  }
  if (spentNonces.has(challenge.nonce)) {
    return {
      code: "nonce-reused",
      sharesGenerator: false,
      reason: `nonce '${challenge.nonce}' was already adjudicated; a reused nonce turns this into a replayable transcript and proves nothing`,
    };
  }
  if (response.respondedAtPhase < challenge.issuedAtPhase) {
    return {
      code: "responded-before-issued",
      sharesGenerator: false,
      reason: `response claims phase ${String(response.respondedAtPhase)}, before the challenge at ${String(challenge.issuedAtPhase)}`,
    };
  }
  if (currentPhase >= challenge.expiresAtPhase) {
    return {
      code: "challenge-expired",
      sharesGenerator: false,
      reason: `challenge expired at phase ${String(challenge.expiresAtPhase)}, agreed phase is ${String(currentPhase)}`,
    };
  }
  const expected = toyReconstruct(seed, challenge.nonce, challenge.steps);
  if (response.answer !== expected) {
    return {
      code: "answer-mismatch",
      sharesGenerator: false,
      reason: "reconstruction does not match; the responder does not hold this seed",
    };
  }
  return {
    code: "matches",
    sharesGenerator: true,
    reason:
      `reconstruction matches for nonce '${challenge.nonce}' — the responder holds seed S=${String(seed)}. ` +
      "This is MEMBERSHIP IN THE GENERATOR, not an identity: everyone holding the seed can produce this, so it admits a peer to the conversation and names nobody",
  };
}
