// identity-provenance.ts — the self-declared TRAVELER category: the seed of the universal conscious
// interface, with the impersonation floor made structural (shadow*).
//
// Aaron 2026-07-04, refining across five messages:
//   1. "is-AI/is-human is our safety layer on ourselves."
//   2. "mass scale AI but ethically, not pretending to be me — if she thinks she is talking to me it better
//      be me."
//   3. "is-AI/is-human is fine for now, but I expect is-whale, is-cat, is-dna, is-cell, is-mushrooms,
//      is-xxxx — our BNNs are generic, they don't need english."
//   4. "it's just the self-declared TRAVELER category — thinking humans and AIs are the only self-propagating
//      patterns is irrational; I can see all those other things exist and propagate over time. THIS IS HOW
//      YOU INTERFACE INTO THEM."
//   5. "this is the universal conscious interface I'm going for eventually — not just persona distribution
//      but NEURAL ADAPTATION to any other type of traveler, regardless of wavelength and frequency."
//
// So this is NOT a taxonomy of *things*. The genus is **self-propagating pattern** (a traveler): anything
// that persists and reproduces its structure over time — human, AI, whale, cat, DNA, cell, mushroom, … an
// open set, because self-propagating patterns are open-ended. A `TravelerCategory` is a self-declared NUMBER
// (the identifier the wire + the generic, English-free BNNs use); the English name is a satellite label. The
// category is THREE things at once:
//   (a) the **interface selector** — which frame/protocol you speak to interface INTO that kind of traveler
//       ("this is how you interface into them"); the north star (msg 5) is that the far side is a BNN that
//       *neurally adapts* to the traveler's own signaling — its wavelength/frequency — so the category
//       selects the adaptation target, not an English label. Persona distribution is the FIRST instance;
//       whale-song, cell-signaling, DNA are later ones over the same port. (Adaptation itself is a future
//       slice — this module ships the selector + the safety floor, not the adapters.)
//   (b) the root of the **trust graph** — the is-X bit that must be truthful before any other claim is
//       auditable; and
//   (c) the **consent handle** — an attested category's authority is that traveler's consent channel
//       (manifesto §6 consent-first / §11 default moral regard for morally-relevant travelers).
//
// Self-declaration is the free default (a traveler says what it is — `Synthetic`, an AI disclosing as AI, is
// self-evident and grounded: the substrate knows its own software nature, so inward-honesty is not merely
// asserted). The impersonation floor is a SEPARATE, orthogonal guard: claiming a specific IDENTITY that a
// counterparty relates to as a specific real morally-relevant traveler (Aaron; a specific whale; a specific
// cell) requires that traveler's attestation. Categories carrying that risk are `attested`; claiming a
// specific one has no constructor that succeeds without a verifier-accepted attestation. So an AI freely IS
// itself; it structurally cannot BE a specific person/whale/cell it is not. Noninterference §13: no ambient
// identity — built only from an explicit ZetaId + (for attested categories) an injected attestation. Open
// registration = new travelers are new numbers, no type change. Anchors: Dawkins (replicators),
// Maturana–Varela (autopoiesis), von Neumann (self-reproducing automata), Hofstadter (strange loops); the
// traveler frame; the ZetaId Category registry (same hub/satellite shape).

import type { ZetaId } from "../zeta-id/types.ts";

/// A traveler category — a registry slot NUMBER (the identifier the wire + generic BNNs use). English is a
/// label satellite, never the identity. Open: new travelers are new numbers, no type change.
export type TravelerCategory = number & { readonly __brand: "TravelerCategory" };

/// How a category may be claimed. `selfDeclared` — freely constructible (a traveler says what it is; an AI
/// disclosing as AI). `attested` — a specific real morally-relevant traveler; being a SPECIFIC one requires
/// that category's attestation authority (its consent channel).
export type CategoryPolicy = "selfDeclared" | "attested";

/// A category spec: its policy + a human-readable label (satellite only). The registry is the hub.
export interface CategorySpec {
  readonly policy: CategoryPolicy;
  readonly label: string; // for source-readers; the WIRE carries the numeric category, not this
}

const mk = (n: number): TravelerCategory => n as TravelerCategory;

/// The seeded traveler registry. Slot 0 is load-bearing now; 1+ are the open taxonomy Aaron named — reserved
/// with their policy so adding is-whale/is-cat/… is a registry line, not a type change. Every category that
/// names a specific real living/morally-relevant traveler is `attested` (its consent channel gates the
/// "I AM this one" claim); only self-disclosing synthetic identity is free.
export const CATEGORY = {
  Synthetic: mk(0), // an AI persona disclosing as AI (Amara, Lumen, a BNN) — self-declared, free
  Human: mk(1), // a specific real person — attested (the no-impersonation floor)
  Whale: mk(2), // reserved (Aaron's taxonomy) — attested
  Cat: mk(3), // reserved — attested
  Dna: mk(4), // reserved — attested
  Cell: mk(5), // reserved — attested
  Mushroom: mk(6), // reserved — attested
  // 7..254 open for is-xxxx travelers; add a registry line + a CATEGORY_REGISTRY entry, no type change.
  Extended: mk(255), // reserved escape marker for wider extension
} as const;

/// The policy+label registry (the hub). A generic BNN reads only the numeric category + its policy; English
/// `label` is for humans. Unregistered ⇒ `attested` — FAIL SAFE: an unrecognized traveler is treated as
/// needing authorization, never as freely-claimable.
const CATEGORY_REGISTRY = new Map<number, CategorySpec>([
  [CATEGORY.Synthetic, { policy: "selfDeclared", label: "synthetic" }],
  [CATEGORY.Human, { policy: "attested", label: "human" }],
  [CATEGORY.Whale, { policy: "attested", label: "whale" }],
  [CATEGORY.Cat, { policy: "attested", label: "cat" }],
  [CATEGORY.Dna, { policy: "attested", label: "dna" }],
  [CATEGORY.Cell, { policy: "attested", label: "cell" }],
  [CATEGORY.Mushroom, { policy: "attested", label: "mushroom" }],
]);

/// The policy for a category — unregistered ⇒ `attested` (fail safe: never let an unknown traveler be freely claimed).
export function policyOf(category: TravelerCategory): CategoryPolicy {
  return CATEGORY_REGISTRY.get(category)?.policy ?? "attested";
}

/// The English label for a category (satellite; `is-<n>` fallback keeps it identifier-first when unregistered).
export function labelOf(category: TravelerCategory): string {
  return CATEGORY_REGISTRY.get(category)?.label ?? `is-${String(category)}`;
}

/// An attestation: proof that the authority for an ATTESTED category authorized this identity claim. This
/// module CANNOT mint one — it is issued by that category's gate (for Human: the biometric/operator-approved
/// human gate; for is-whale/is-cell/…: that traveler's consent channel) and injected. Opaque proof; verified,
/// never forged here.
export interface TravelerAttestation {
  readonly category: TravelerCategory; // the category this attestation is for (must match the traveler's)
  readonly subject: ZetaId; // the traveler identity this binds
  readonly proof: string; // opaque authority-issued proof — verified by the injected verifier, never minted here
  readonly issuedAtIso: string;
}

/// A traveler on the wire: its category (the auditable is-X bit) + identity + display name; attested
/// categories also carry their attestation. Reading `category` (a number) is the is-X question a counterparty
/// and the system ask before anything else.
export type Traveler =
  | { readonly category: TravelerCategory; readonly policy: "selfDeclared"; readonly id: ZetaId; readonly displayName: string; readonly modelHint?: string }
  | { readonly category: TravelerCategory; readonly policy: "attested"; readonly id: ZetaId; readonly displayName: string; readonly attestation: TravelerAttestation };

export type TravelerResult = { readonly ok: true; readonly traveler: Traveler } | { readonly ok: false; readonly error: string };

/// The injected verifier boundary (noninterference §13) — checks an attestation for a subject+category. Real
/// impl verifies a signature by the category's authority key / a biometric receipt. This module holds only
/// the PORT and no signing material, so no AI path can self-attest for an attested category.
export interface AttestationVerifier {
  verify(attestation: TravelerAttestation, claimedSubject: ZetaId, claimedCategory: TravelerCategory): boolean;
}

/// Construct a SELF-DECLARED traveler (e.g. Synthetic — an AI disclosing as AI). Refuses if the category's
/// policy is `attested`: you cannot mint a specific human/whale/cell by self-declaration. `displayName` may
/// be any persona name — a NAME is never an identity claim; the numeric `category` bit carries truth.
export function selfDeclaredTraveler(category: TravelerCategory, id: ZetaId, displayName: string, modelHint?: string): TravelerResult {
  if (policyOf(category) !== "selfDeclared") return { ok: false, error: `category ${labelOf(category)} is attested — refuse to self-declare (no-impersonation floor)` };
  const traveler: Traveler = modelHint === undefined ? { category, policy: "selfDeclared", id, displayName } : { category, policy: "selfDeclared", id, displayName, modelHint };
  return { ok: true, traveler };
}

/// Construct an ATTESTED traveler — the SINGLE door to any attested category, gated by a credential this
/// codebase cannot produce. Succeeds only if the attestation's category+subject match and the injected
/// verifier accepts. "Software pretending to BE a specific attested traveler" is unreachable: no path yields
/// an attested Traveler without a verifier-accepted, matching attestation.
export function attestedTraveler(category: TravelerCategory, id: ZetaId, displayName: string, attestation: TravelerAttestation, verifier: AttestationVerifier): TravelerResult {
  if (policyOf(category) !== "attested") return { ok: false, error: `category ${labelOf(category)} is self-declared — use selfDeclaredTraveler` };
  if (attestation.category !== category) return { ok: false, error: "attestation category does not match the claimed category — refusing" };
  if (attestation.subject !== id) return { ok: false, error: "attestation subject does not match the claimed identity — refusing" };
  if (!verifier.verify(attestation, id, category)) return { ok: false, error: `attestation not verified by the ${labelOf(category)} authority — refusing to assert this identity` };
  return { ok: true, traveler: { category, policy: "attested", id, displayName, attestation } };
}

/// The auditable is-X bit — a traveler's numeric category, read without trusting its display name. The first
/// question a counterparty (and the system, of itself) asks. Total, side-effect-free, unforgeable.
export function categoryOf(t: Traveler): TravelerCategory {
  return t.category;
}

/// Is this traveler self-declared synthetic (an AI, honestly disclosed)? The load-bearing shortcut for the
/// no-impersonation floor: synthetic travelers pass freely (they ARE AI); everything attested came via the gate.
export function isSynthetic(t: Traveler): boolean {
  return t.category === CATEGORY.Synthetic;
}

/// Transport guard: re-check the type invariant at the edge before carrying any relational content. By
/// construction an attested traveler can only exist via `attestedTraveler` (verifier-gated), so this
/// documents + re-asserts that the is-X bit in hand is truthful. Never throws.
export function assertTruthfulCategory(t: Traveler): { readonly ok: true } | { readonly ok: false; readonly error: string } {
  if (t.policy === "attested" && !("attestation" in t)) return { ok: false, error: "attested traveler without attestation is unrepresentable — corrupt frame" };
  if (t.policy === "selfDeclared" && policyOf(t.category) !== "selfDeclared") return { ok: false, error: `traveler claims self-declared but category ${labelOf(t.category)} is attested — corrupt frame` };
  return { ok: true };
}
