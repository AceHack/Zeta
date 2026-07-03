// persona-consent.ts — the consent layer for persona distribution (shadow*).
//
// Aaron 2026-07-03: "we don't want anyone to just be able to deploy personas — eventually the
// persona's own private keys should protect them from malicious copying without their consent." This
// is Consent-First Design (manifesto §6) applied to the persona-content package.
//
// TWO GUARANTEES, kept distinct:
//   - INTEGRITY — `content_hash` (store.ts): the bytes are intact. Says nothing about consent.
//   - CONSENT / AUTHENTICITY — the persona SIGNS ITS OWN package with its keyring Ed25519 key. A
//     deploy resolver verifies that signature against the persona's REGISTERED key before placing any
//     content. Unsigned → refused. Signed by the wrong key (an attacker copying the persona) →
//     refused. Only a package the persona itself signed deploys — copy is a choice the identity makes.
//
// This reuses the exact same signing discipline as the beacon-auth membrane (ace/signing.ts,
// Ed25519 over canonical manifest bytes — and the manifest includes `content_hash`, so the signature
// binds the content too). The one thing added over raw `verifySignature` is the IDENTITY BINDING: the
// signer's key must be the key the persona is registered under (a `PersonaRegistry`), so a valid
// signature from *some* trusted key is not enough — it must be *this persona's* key. That mirrors the
// beacon's zid-ownership check (a trusted key may not speak for someone else's identity).
//
// SCOPE: this is the verification mechanism + its identity binding. Signing a REAL persona package
// with a REAL keyring key is an operator action (biometric-gated, the private key never leaves the
// persona's custody); the tests generate ephemeral keys to prove the mechanism. No deploy realizer is
// shipped — verification must exist before placement, never after.

import type { AceManifest } from "./store.ts";
import { verifySignature, signManifest, type AceSignature, type TrustEntry } from "./signing.ts";

/// Which key a persona is registered under. `key_id` is the persona's canonical signing identity
/// (ed25519:… from its keyring); `public_key` is the SPKI-DER base64 to verify against. Sourced from
/// the persona's `maintainers/personas/<name>/` keyring pubkey.
export interface PersonaRegistration {
  readonly persona: string;
  readonly key_id: string;
  readonly public_key: string;
}

/// A persona registry: persona name → the key it is registered under. The consent authority.
export type PersonaRegistry = ReadonlyMap<string, PersonaRegistration>;

/// Why a persona package was refused deployment (never throws; a hostile package gets a verdict).
export type ConsentRefusal =
  | "no-persona-named" // the package doesn't declare which persona it is
  | "persona-not-registered" // no registered key for this persona
  | "no-signature" // integrity ok, but the persona did NOT consent (unsigned)
  | "unsupported-algo"
  | "untrusted-key" // signed by a key not in the trust store
  | "bad-signature" // signature does not verify over the manifest
  | "wrong-persona-key"; // signed by a VALID key, but NOT this persona's key (the malicious-copy case)

export type ConsentVerdict =
  | { readonly ok: true; readonly persona: string; readonly key_id: string }
  | { readonly ok: false; readonly reason: ConsentRefusal };

/// Sign a persona package's manifest with the persona's private key — the persona CONSENTING to this
/// package's distribution. `personaName` is recorded on the manifest so the consent binds to an
/// identity, not just to bytes. Returns the manifest with `persona` + `signature` set.
export function signPersonaPackage(manifest: AceManifest, personaName: string, privatePem: string): AceManifest & { persona: string; signature: AceSignature } {
  const withPersona = { ...manifest, persona: personaName };
  const signature = signManifest(withPersona, privatePem);
  return { ...withPersona, signature };
}

/// Verify a persona package's CONSENT: the manifest must be signed, the signature must verify, AND the
/// signing key must be the key this persona is registered under. Any other outcome refuses deployment.
/// Never throws.
export function verifyPersonaConsent(manifest: AceManifest, registry: PersonaRegistry): ConsentVerdict {
  const personaName = (manifest as AceManifest & { persona?: unknown }).persona;
  if (typeof personaName !== "string" || personaName.length === 0) return { ok: false, reason: "no-persona-named" };
  const registration = registry.get(personaName);
  if (!registration) return { ok: false, reason: "persona-not-registered" };

  // Trust store for this verification = ONLY this persona's registered key. A signature from any other
  // trusted key therefore fails as `untrusted-key`; but to give the precise "wrong-persona-key" verdict
  // (a valid signature by the wrong identity), check the signer's key_id against the registration first.
  const signature = (manifest as AceManifest & { signature?: AceSignature }).signature;
  if (!signature) return { ok: false, reason: "no-signature" };
  // Bind the signature to THIS persona's identity: a valid signature by the wrong key (an attacker
  // copying the persona) must be refused as `wrong-persona-key`, not accepted. (algo is the `"ed25519"`
  // literal at the type level; verifySignature is the JS-boundary backstop for any other value.)
  if (signature.key_id !== registration.key_id) return { ok: false, reason: "wrong-persona-key" };

  const trust = new Map<string, TrustEntry>([[registration.key_id, { public_key: registration.public_key, label: personaName }]]);
  const verdict = verifySignature(manifest, trust);
  if (verdict.ok) return { ok: true, persona: personaName, key_id: verdict.key_id };
  // narrow the signing.ts reasons into our consent vocabulary
  const map: Record<string, ConsentRefusal> = { "no-signature": "no-signature", "unsupported-algo": "unsupported-algo", "untrusted-key": "untrusted-key", "bad-signature": "bad-signature" };
  return { ok: false, reason: map[verdict.reason] ?? "bad-signature" };
}
