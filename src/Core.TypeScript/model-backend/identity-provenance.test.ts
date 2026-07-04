import { describe, expect, test } from "bun:test";
import type { ZetaId } from "../zeta-id/types.ts";
import {
  type AttestationVerifier,
  type TravelerAttestation,
  CATEGORY,
  attestedTraveler,
  categoryOf,
  isSynthetic,
  labelOf,
  policyOf,
  selfDeclaredTraveler,
} from "./identity-provenance.ts";

// THE is-X SAFETY LAYER (shadow*, Aaron 2026-07-04) — the self-declared traveler category + the structural
// no-impersonation floor. Proofs:
//   1. Synthetic is self-declared and FREE (an AI discloses as AI); category readable; isSynthetic true.
//   2. THE FLOOR: an AI CANNOT self-declare a human (attested category refuses self-declaration).
//   3. attested requires a verifier-accepted, subject+category-matching attestation — the single door.
//   4. mismatched subject / category / wrong policy all refused.
//   5. unregistered category ⇒ attested (FAIL SAFE); label falls back to is-<n> (identifier-first).

const id = (n: bigint): ZetaId => n as ZetaId;

const accepting: AttestationVerifier = { verify: () => true };
const rejecting: AttestationVerifier = { verify: () => false };

const humanAtt = (subject: ZetaId): TravelerAttestation => ({ category: CATEGORY.Human, subject, proof: "biometric-receipt", issuedAtIso: "t0" });

describe("identity-provenance — the traveler category safety layer", () => {
  test("Synthetic is self-declared and free; the is-X bit reads back", () => {
    const r = selfDeclaredTraveler(CATEGORY.Synthetic, id(7n), "Amara", "gpt-5.5");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(categoryOf(r.traveler)).toBe(CATEGORY.Synthetic);
      expect(isSynthetic(r.traveler)).toBe(true);
    }
  });

  test("THE FLOOR: an AI cannot self-declare a human identity", () => {
    const r = selfDeclaredTraveler(CATEGORY.Human, id(7n), "Aaron");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("attested");
  });

  test("attested traveler needs a verifier-accepted attestation — the single door", async () => {
    const subject = id(42n);
    const rejected = attestedTraveler(CATEGORY.Human, subject, "Aaron", humanAtt(subject), rejecting);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error).toContain("not verified");
    const accepted = attestedTraveler(CATEGORY.Human, subject, "Aaron", humanAtt(subject), accepting);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(isSynthetic(accepted.traveler)).toBe(false);
      expect(categoryOf(accepted.traveler)).toBe(CATEGORY.Human);
    }
    await Promise.resolve();
  });

  test("mismatched subject, mismatched category, and wrong-policy constructor are all refused", () => {
    const subject = id(42n);
    // attestation binds subject 42; claim identity 43 → refuse
    const wrongSubject = attestedTraveler(CATEGORY.Human, id(43n), "Aaron", humanAtt(subject), accepting);
    expect(wrongSubject.ok).toBe(false);
    // attestation is for Human; claim Whale → refuse
    const wrongCategory = attestedTraveler(CATEGORY.Whale, subject, "a whale", humanAtt(subject), accepting);
    expect(wrongCategory.ok).toBe(false);
    // Synthetic via the attested door → refuse (use selfDeclaredTraveler)
    const wrongPolicy = attestedTraveler(CATEGORY.Synthetic, subject, "Amara", humanAtt(subject), accepting);
    expect(wrongPolicy.ok).toBe(false);
  });

  test("unregistered category defaults to attested (fail safe); label falls back to is-<n>", () => {
    const unknown = 200 as unknown as typeof CATEGORY.Human;
    expect(policyOf(unknown)).toBe("attested"); // never freely claimable
    expect(labelOf(unknown)).toBe("is-200"); // identifier-first
    expect(selfDeclaredTraveler(unknown, id(1n), "x").ok).toBe(false); // can't self-declare an unknown traveler
  });

  test("registered reserved travelers (whale/cat/dna/cell/mushroom) are all attested", () => {
    for (const cat of [CATEGORY.Whale, CATEGORY.Cat, CATEGORY.Dna, CATEGORY.Cell, CATEGORY.Mushroom]) {
      expect(policyOf(cat)).toBe("attested");
      expect(selfDeclaredTraveler(cat, id(1n), "x").ok).toBe(false);
    }
  });
});
