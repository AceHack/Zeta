/**
 * signed-stamp.ts — slice 3: signatures close the theft gap.
 *
 * Trajectory: `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md`, slice 3.
 *
 * ## The gap this closes, stated exactly
 *
 * Anchors cannot be **minted**: you can only hold one by having participated in the
 * history that produced it. That is where PGP's sybil-resistance fails — keypairs are
 * free, so identities are free, and the web of trust has to bolt scarcity on socially.
 *
 * But anchors can be **acquired**. The phase chain is verifiable and **not secret**, so
 * anyone holding an anchor can compute valid continuations from it. Slices 1–2 therefore
 * give *consistency*, not *identity*: they detect divergence and corruption, never
 * impersonation.
 *
 * A signature closes precisely that gap by **moving the secret**. The anchor is public and
 * stealable; a signing key is neither. What a signed stamp proves is not "this chain is
 * consistent" but "the holder of this key asserted it".
 *
 * ## What it does NOT close — do not read this as authentication solved
 *
 * - **Key theft.** This relocates the secret; it does not make secrets unstealable. An
 *   attacker with the key is indistinguishable from the signer, by construction.
 * - **Breadth is bounded, depth is not.** Per-agreement mutual anchors mean a stolen
 *   anchor or key unlocks *its own agreement* and nothing else, so a compromise cannot
 *   spread laterally. Someone compromised *within* one agreement still has full standing
 *   inside it. Containing breadth is structural and designable; containing depth is
 *   behavioural and has to be earned.
 * - **Nothing here holds key material.** Verification only. Key custody, rotation, and
 *   revocation are deliberately elsewhere.
 *
 * ## Cross-language byte-lock
 *
 * The canonical encoding mirrors `src/Core/MultiSignatureVerification.fs` **byte for
 * byte** — UTF-8, 4-byte **big-endian** unsigned length prefixes, written out explicitly
 * rather than via any platform-endian helper. Two oracles that disagree about bytes
 * disagree about signatures, silently, and only for some inputs. The golden vector in the
 * tests is hex-in-source per `.claude/rules/no-binary-in-proof-lineage.md`, so a drift in
 * either language shows up as a readable diff rather than a mysterious verification
 * failure.
 */

import type { PhaseState } from "./phase-clock";
import type { SubjectId } from "./local-trust-view";

/**
 * Domain separation. DELIBERATELY different from `zeta.multisig.v1`.
 *
 * Without a distinct domain, a signature collected for one protocol could be replayed as a
 * phase-stamp assertion. Domain separation is what makes a signature mean one thing.
 */
export const PHASE_STAMP_DOMAIN = "zeta.phase-stamp.v1";

/** 4-byte big-endian, written explicitly so it cannot drift with the platform. */
export function u32be(n: number): Uint8Array {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) {
    throw new RangeError(`u32be: ${n} is not a u32`);
  }
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * `domain ‖ u32be(len(scope)) ‖ scope ‖ u32be(len(payload)) ‖ payload`
 *
 * Length prefixing makes the encoding **injective**: no two distinct `(scope, payload)`
 * pairs share signed bytes, so a signature cannot be moved between requests by
 * re-splitting the boundary. Mirrors `MultiSignatureVerification.signingBytes`.
 */
export function canonicalBytes(domain: string, scope: string, payload: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const d = enc.encode(domain);
  const s = enc.encode(scope);
  return concat([d, u32be(s.length), s, u32be(payload.length), payload]);
}

/** The bytes a signer signs to assert "this stamp is mine". */
export function stampSigningBytes(subject: SubjectId, stamp: PhaseState): Uint8Array {
  if (!Number.isSafeInteger(stamp.phase) || stamp.phase < 0 || stamp.phase > 0xffffffff) {
    throw new RangeError(`stampSigningBytes: phase ${stamp.phase} out of range`);
  }
  const seed = stamp.seed >>> 0; // stamps carry unsigned 32-bit seeds
  return canonicalBytes(PHASE_STAMP_DOMAIN, subject, concat([u32be(stamp.phase), u32be(seed)]));
}

/**
 * A verification port — hexagonal on purpose.
 *
 * The scheme is swappable so a bad cryptographic assumption is a config change rather than
 * a rewrite, and so post-quantum schemes can be adopted without touching this module.
 * Verification only: no signing, no key material.
 */
export interface SignatureScheme {
  readonly id: string;
  verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean;
}

/** One signer this verifier trusts, under one scheme. */
export interface RosterEntry {
  readonly signer: string;
  readonly scheme: string;
  readonly publicKey: Uint8Array;
}

export interface SignedStamp {
  readonly subject: SubjectId;
  readonly stamp: PhaseState;
  readonly signer: string;
  readonly scheme: string;
  readonly signature: Uint8Array;
}

/** A domain-separated assertion verified by the same local roster as phase stamps. */
export interface SignedAssertion {
  readonly domain: string;
  readonly scope: string;
  readonly payload: Uint8Array;
  readonly signer: string;
  readonly scheme: string;
  readonly signature: Uint8Array;
}

/**
 * Neutral facts again — never `Authentic` / `Forged`. The mechanism reports what it
 * checked; reunion, impersonation and misconfiguration are readings the caller's oracle
 * attaches.
 */
export type StampAuthVerdict =
  | { readonly kind: "signature-verified"; readonly signer: string; readonly scheme: string }
  | { readonly kind: "signature-invalid"; readonly signer: string; readonly scheme: string }
  | { readonly kind: "signer-not-on-roster"; readonly signer: string }
  | { readonly kind: "scheme-not-accepted"; readonly scheme: string };

/** Verify arbitrary canonical bytes against this verifier's local scheme and roster view. */
export function verifySignedAssertion(
  schemes: readonly SignatureScheme[],
  roster: readonly RosterEntry[],
  signed: SignedAssertion,
): StampAuthVerdict {
  const scheme = schemes.find((candidate) => candidate.id === signed.scheme);
  if (!scheme) return { kind: "scheme-not-accepted", scheme: signed.scheme };
  const entry = roster.find((candidate) => candidate.signer === signed.signer && candidate.scheme === signed.scheme);
  if (!entry) return { kind: "signer-not-on-roster", signer: signed.signer };
  const message = canonicalBytes(signed.domain, signed.scope, signed.payload);
  return scheme.verify(entry.publicKey, message, signed.signature)
    ? { kind: "signature-verified", signer: signed.signer, scheme: signed.scheme }
    : { kind: "signature-invalid", signer: signed.signer, scheme: signed.scheme };
}

/**
 * Verify a signed stamp against **this verifier's own roster**.
 *
 * There is deliberately no global roster. Each verifier holds its own, exactly as
 * `Consent/KskAuthorization.fs` does — two verifiers may reach different verdicts on the
 * identical stamp and **both are correct**, because trust is local. A single mandatory
 * roster would be the hub this whole trajectory exists to avoid.
 *
 * Pure: no I/O, no fetch, no ambient reads.
 */
export function verifySignedStamp(
  schemes: readonly SignatureScheme[],
  roster: readonly RosterEntry[],
  signed: SignedStamp,
): StampAuthVerdict {
  const payload = concat([u32be(signed.stamp.phase), u32be(signed.stamp.seed >>> 0)]);
  return verifySignedAssertion(schemes, roster, {
    domain: PHASE_STAMP_DOMAIN,
    scope: signed.subject,
    payload,
    signer: signed.signer,
    scheme: signed.scheme,
    signature: signed.signature,
  });
}
