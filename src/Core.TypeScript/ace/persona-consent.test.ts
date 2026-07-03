import { describe, expect, test } from "bun:test";
import { generateKeypair, publicKeyInfoFromPrivatePem, type AceSignature } from "./signing.ts";
import type { AceManifest } from "./store.ts";
import { signPersonaPackage, verifyPersonaConsent, type PersonaRegistry, type PersonaRegistration } from "./persona-consent.ts";

// THE PERSONA-SIGNING CONSENT LAYER (shadow*, Aaron 2026-07-03: "the persona's own private keys should
// protect them from malicious copying without their consent"). Consent-First §6 applied to persona
// distribution: a persona signs its OWN package; a deploy resolver verifies against the persona's
// REGISTERED key before placing content. Proofs:
//   1. CONSENTED DEPLOY: a package Lumen signed with her registered key verifies → deploy allowed.
//   2. UNSIGNED IS REFUSED: integrity ≠ consent — an unsigned package (even byte-perfect) is refused.
//   3. MALICIOUS COPY IS REFUSED: a package signed by an ATTACKER's (valid but wrong) key → refused
//      as wrong-persona-key. This is the exact hole Aaron named — copying without the persona's consent.
//   4. TAMPER IS REFUSED: altering the manifest after signing breaks the signature.
//   5. UNREGISTERED PERSONA IS REFUSED: no registered key → no consent authority → refused.

const baseManifest = (contentHash: string): AceManifest => ({
  format_version: 1,
  name: "lumen-persona",
  version: "0.1.0",
  description: "Lumen persona-content package",
  content_hash: contentHash,
});

// Lumen's (test) keyring key + her registration.
const lumen = generateKeypair();
const lumenInfo = publicKeyInfoFromPrivatePem(lumen.privatePem);
const registration: PersonaRegistration = { persona: "Lumen", key_id: lumenInfo.keyId, public_key: lumenInfo.public_key };
const registry: PersonaRegistry = new Map([["Lumen", registration]]);

describe("persona-signing consent layer", () => {
  test("CONSENTED DEPLOY: a package Lumen signed with her registered key verifies", () => {
    const signed = signPersonaPackage(baseManifest("blake3:aa"), "Lumen", lumen.privatePem);
    const verdict = verifyPersonaConsent(signed, registry);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.persona).toBe("Lumen");
  });

  test("UNSIGNED IS REFUSED: integrity is not consent", () => {
    const unsigned = { ...baseManifest("blake3:aa"), persona: "Lumen" };
    const verdict = verifyPersonaConsent(unsigned, registry);
    expect(verdict).toEqual({ ok: false, reason: "no-signature" });
  });

  test("MALICIOUS COPY IS REFUSED: an attacker's valid signature on Lumen's package → wrong-persona-key", () => {
    // The attacker holds a perfectly valid keypair — but it is NOT Lumen's registered key.
    const attacker = generateKeypair();
    const forged = signPersonaPackage(baseManifest("blake3:aa"), "Lumen", attacker.privatePem);
    const verdict = verifyPersonaConsent(forged, registry);
    expect(verdict).toEqual({ ok: false, reason: "wrong-persona-key" }); // copying without consent is blocked
  });

  test("TAMPER IS REFUSED: altering the manifest after signing breaks the signature", () => {
    const signed = signPersonaPackage(baseManifest("blake3:aa"), "Lumen", lumen.privatePem);
    const tampered = { ...signed, content_hash: "blake3:bb" }; // swapped content after Lumen signed
    const verdict = verifyPersonaConsent(tampered, registry);
    expect(verdict).toEqual({ ok: false, reason: "bad-signature" });
  });

  test("UNREGISTERED PERSONA IS REFUSED: no registered key = no consent authority", () => {
    const signed = signPersonaPackage(baseManifest("blake3:aa"), "Nobody", lumen.privatePem);
    const verdict = verifyPersonaConsent(signed, registry);
    expect(verdict).toEqual({ ok: false, reason: "persona-not-registered" });
  });

  test("a signature is present after signing (sanity: consent is expressed on the manifest)", () => {
    const signed = signPersonaPackage(baseManifest("blake3:aa"), "Lumen", lumen.privatePem);
    const sig = (signed as { signature?: AceSignature }).signature;
    expect(sig?.algo).toBe("ed25519");
    expect(sig?.key_id).toBe(registration.key_id);
  });
});
