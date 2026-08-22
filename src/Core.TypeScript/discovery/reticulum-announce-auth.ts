// reticulum-announce-auth — the signed announce wire (shadow*). Fix for the BUGS.md P1
// "Reticulum announce wire is unsigned AND `dest` is unbound to `zid`".
//
// The TWIN of beacon-auth.ts, on the wire that never got the membrane. `beacon-auth`
// hardened the discovery-beacon wire; the Reticulum announce / path-table wire is a
// second, parallel wire carrying the same class of claim ("I am this identity, route
// to me here") with no authenticity layer at all. This module INVENTS NOTHING — it is
// beacon-auth's construction applied to `Announce`:
//
//   - keys      — the persona keyring (`tools/setup/persona-keys/`), same as beacon-auth.
//   - signing   — Ed25519 over canonical key-sorted bytes (`ace/signing.ts` `keyId` +
//                 `ace/canonical.ts` `canonicalBytes`) — the Ace discipline.
//   - trust     — the SAME trust-entry shape as `BeaconTrustEntry` (key_id → who it
//                 speaks for), so ONE trust store serves both wires and the dual-key
//                 overlap-window rotation ADR (2026-06-15) applies unchanged.
//
// WHY A SIGNATURE IS REQUIRED AND THE HASH PAIR-CHECK IS NOT ENOUGH — the measurement
// that motivated this module. `dest = destinationHash(zid)` is a hash of a PUBLIC
// identifier, so ANY party can compute a pair-consistent announce for any zid it has
// ever seen. Verified against the live code before this fix: an attacker announce
// `{dest: destinationHash(victimZid), zid: victimZid, hops: 0}` passes the pair check
// and captures the victim's route. The pair check is a necessary integrity check on
// the ADDRESS; it is not, and can never be, an authenticity check on the IDENTITY.
// Hashing a public identifier is self-DESCRIBING, not self-CERTIFYING. Only a
// signature by a key the trust store says speaks for that zid closes it.
//
// WHAT THE SIGNATURE COVERS, AND WHAT IT DELIBERATELY DOES NOT:
//
//   signed:   (dest, zid) — the identity claim. Immutable end-to-end.
//   UNSIGNED: `hops` and `id` — TRANSPORT-MUTABLE by design. Every relay bumps `hops`
//             (`createReticulumTransport`: `hops: frame.announce.hops + 1`), which is
//             how the mesh measures distance. A signature covering `hops` would be
//             invalidated by the first honest relay, so signing it would not be
//             "more secure" — it would make relaying impossible and force the check
//             to be disabled. This is the RNS property, not a shortcut: an announce's
//             hop count is asserted by the path, never by the origin.
//
// KNOWN RESIDUAL, NAMED NOT HIDDEN (the same class beacon-auth names for its wire):
// because `hops` is outside the signature, a captured GENUINE announce can be
// REPLAYED with a lowered hop count to draw a victim's traffic (blackhole / traffic
// analysis; the payload crypto is unaffected). What this module removes is the ability
// to announce an identity you do not hold — the Eclipse primitive, where an attacker
// populates a victim's path table with identities it controls. What it does not yet
// remove is hop-count lying by a party that already holds a valid announce.
// The DESIGN that closes it was chosen 2026-08-22 and the "or" this paragraph used to
// carry was wrong: it read "per-link authentication OR a signed monotonic sequence",
// and a sequence number alone does NOT close it — the attacker replays the CURRENT
// epoch, so the replay carries the same seq as the genuine announce and there is
// nothing for the sequence to discriminate. The chosen mechanism is a one-way hash
// chain (SEAD) for deflation WITHIN an epoch, PLUS the signed monotone seq for
// rollback ACROSS epochs; the two are halves, not alternatives. One SHA-256 per relay.
// See `announce-metric-chain.ts` (metered, not yet on this wire) and
// `docs/research/2026-08-22-hop-count-is-not-a-claim-mutation-entitlement-decides-the-mechanism.md`
// for the cost table, the declined per-hop-signature alternative, and what the wire
// migration costs (`claimBytes` gains `seq`/`anchor`/`maxHops`, so every existing
// signature is invalidated — a schema bump plus a dual-accept window).
// Still NOT a wall-clock freshness window: see
// `.claude/rules/local-time-never-enters-the-shared-fold.md`. Two nodes with different
// receive-times would fold different evidence sets and diverge, so the local clock
// must never filter what enters this fold. `nowMs` stays what it already is here — a
// liveness stamp WRITTEN onto an accepted path, never a predicate that decides
// acceptance. (The epoch floor is not a clock either, and the design says why
// mechanically: seq is the ORIGIN's counter inside the signed bytes, and the fold is a
// max-join, so every permutation of one evidence set reaches the same floor.)
//
// Disciplines: pure functions, injected trust (noninterference §13 — the trust store is
// the ONE authority door; no ambient keystore, no ambient clock, no network at verify
// time); Result-over-exception (a hostile wire gets a verdict, never a throw); TEXT wire
// (JSON, no binary in the proof lineage); DST-replayable (same envelopes + trust → same
// table). Dual-use (§): the verdicts name the FACT (`signature-invalid`,
// `identity-mismatch`), never the intent (no `forger-caught`) — the caller's policy
// attaches the meaning. Anchors (Beacon): Ed25519 (Bernstein, Duif, Lange, Schwabe,
// Yang 2011); self-certifying identifiers (Mazières et al., SFS, SOSP 1999); Reticulum
// (Mark Qvist) for the announce/path model; NIST SP 800-57 key-rotation overlap;
// Eclipse attacks on overlay networks (Singh et al. 2006; Heilman et al. 2015).

import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import { canonicalBytes } from "../ace/canonical.ts";
import { keyId } from "../ace/signing.ts";
import { destinationHash, observeAnnounce } from "./reticulum-transport.ts";
import type { Announce, AnnounceSig, PathTable } from "./reticulum-transport.ts";

export type { AnnounceSig };

const SIGNED_SCHEMA = "zeta.reticulum-announce-signed.v1";

/// A trust-store entry: this Ed25519 public key (SPKI-DER base64) speaks FOR this zid.
/// Structurally identical to `BeaconTrustEntry` on purpose — one trust store, both wires.
/// Dual-key rotation = two entries with the same `zid` (old + new key) during the overlap
/// window; revoke = delete the entry (the trust store is the caller's fold).
export interface AnnounceTrustEntry {
  readonly public_key: string;
  readonly zid: string;
  readonly label?: string;
}

/// key_id ("ed25519:" + first 16 hex of sha256(SPKI-DER)) → who that key speaks for.
export type AnnounceTrust = ReadonlyMap<string, AnnounceTrustEntry>;

/// The signed envelope on the wire — the inner announce is the UNCHANGED Reticulum
/// vocabulary; the signature covers the canonical bytes of the IDENTITY CLAIM only
/// (schema + dest + zid), so an honest relay may bump `hops` without breaking it, and
/// so the envelope cannot be re-purposed across protocols (the schema tag is inside
/// the signed bytes).
export interface SignedAnnounce {
  readonly schema: typeof SIGNED_SCHEMA;
  readonly announce: Announce;
  readonly key_id: string;
  readonly sig: string;
}

// `AnnounceSig` (the DETACHED claim signature) is defined beside the frame that carries it, in
// `reticulum-transport.ts`, and re-exported above. Detached is the form the wire uses: the frame
// already carries the announce, so wrapping it again would put the same record on the wire twice
// and create a second copy that could disagree with itself. The envelope form (`SignedAnnounce`)
// is the detached signature PLUS the announce, for standalone / stored use.

/// The bytes a signature covers: the identity claim, and nothing transport-mutable.
function claimBytes(dest: string, zid: string): Uint8Array {
  return canonicalBytes({ schema: SIGNED_SCHEMA, dest, zid });
}

/// Sign the identity claim, detached. Throws ONLY on a non-ed25519 key (a setup-time
/// programmer error on the SEND path; the receive path is total).
export function signAnnounceDetached(a: Announce, privatePem: string): AnnounceSig {
  const priv = createPrivateKey(privatePem);
  if (priv.asymmetricKeyType !== "ed25519") {
    throw new Error(`signAnnounceDetached: expected an ed25519 key, got ${priv.asymmetricKeyType ?? "unknown"}`);
  }
  const spkiB64 = (createPublicKey(priv).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  const sig = (nodeSign(null, claimBytes(a.dest, a.zid), priv) as Buffer).toString("base64");
  return { key_id: keyId(spkiB64), sig };
}

/// Verify a detached announce signature. Pure, total, never throws — the ONE verification
/// core; the envelope form delegates here so both wire shapes cannot drift apart.
///
/// Noninterference §13: `trust` is a declared input. This opens no keystore, reads no clock,
/// and touches no socket — the verdict is a function of (announce, sig, trust) alone, which
/// is also what makes it DST-replayable.
export function verifyAnnounceDetached(a: Announce, asig: AnnounceSig | undefined, trust: AnnounceTrust): AnnounceVerdict {
  if (!asig || typeof asig.key_id !== "string" || typeof asig.sig !== "string") {
    return { ok: false, reason: "not-signed-envelope" };
  }
  if (!wellFormed(a)) return { ok: false, reason: "malformed-announce" };

  const entry = trust.get(asig.key_id);
  if (!entry) return { ok: false, reason: "untrusted-key" };

  let verified: boolean;
  try {
    const pub = createPublicKey({ key: Buffer.from(entry.public_key, "base64"), format: "der", type: "spki" });
    verified = nodeVerify(null, claimBytes(a.dest, a.zid), pub, Buffer.from(asig.sig, "base64"));
  } catch {
    verified = false; // malformed key/sig bytes → signature-invalid, never throw
  }
  if (!verified) return { ok: false, reason: "signature-invalid" };

  // The key must speak for the identity the announce claims. Without this, ANY trusted key
  // could announce ANY identity — the Eclipse primitive with extra steps.
  if (a.zid !== entry.zid) return { ok: false, reason: "identity-mismatch" };

  // The address must commit to the identity. Unconditional — no length escape hatch.
  if (a.dest !== destinationHash(a.zid)) return { ok: false, reason: "dest-not-bound" };

  return { ok: true, key_id: asig.key_id, zid: entry.zid };
}

/// Sign an announce with the persona's Ed25519 private key (PEM, keyring-derived) and
/// encode it for the wire. Throws ONLY on a non-ed25519 key — a setup-time programmer
/// error on the SEND path, never on the hot receive path (which is total: see
/// `verifyAnnounce`). Mirrors `beacon-auth.signMessage`.
export function signAnnounce(a: Announce, privatePem: string): string {
  const { key_id, sig } = signAnnounceDetached(a, privatePem);
  const envelope: SignedAnnounce = { schema: SIGNED_SCHEMA, announce: a, key_id, sig };
  return JSON.stringify(envelope);
}

/// An opaque signer: turns an announce into its signed wire text. This is the ONLY signing
/// authority a node needs — it never sees raw key material, so the key can live behind a
/// biometric prompt / Keychain / Secure Enclave / HSM (Aaron: "nothing operator-run, only
/// operator-approved"). The trivial default is `(a) => signAnnounce(a, privatePem)`.
export type AnnounceSigner = (a: Announce) => string;

/// Why an announce was refused. Each names the NEUTRAL FACT, never an intent — a refusal
/// is a measurement, not a verdict about the sender (dual-use §; the caller's policy
/// decides whether this is an attack, a stale key, or a rotation that has not landed).
export type AnnounceRefuseReason =
  | "not-signed-envelope" // garbage / wrong schema / missing fields
  | "malformed-announce" // envelope shape ok but the inner announce isn't the vocabulary
  | "untrusted-key" // key_id not in the trust store (or revoked = deleted)
  | "signature-invalid" // signature does not verify over the canonical claim bytes
  | "identity-mismatch" // the announce claims a zid the signing key does not speak for
  | "dest-not-bound"; // dest !== destinationHash(zid) — the address does not commit to the identity

export type AnnounceVerdict =
  | { readonly ok: true; readonly key_id: string; readonly zid: string }
  | { readonly ok: false; readonly reason: AnnounceRefuseReason };

/// Guarded envelope decode — foreign / malformed / UNSIGNED input yields null, never throws.
/// An unsigned bare `Announce` (the pre-fix wire format) does not parse here: that is the
/// point, and it is what makes the membrane non-bypassable rather than advisory.
function decodeEnvelope(text: string): SignedAnnounce | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const e = parsed as { schema?: unknown; announce?: unknown; key_id?: unknown; sig?: unknown };
  if (e.schema !== SIGNED_SCHEMA || typeof e.key_id !== "string" || typeof e.sig !== "string") return null;
  if (typeof e.announce !== "object" || e.announce === null) return null;
  return parsed as SignedAnnounce;
}

/// Shape-check the inner announce so an envelope cannot smuggle a malformed record past
/// the fold (the analogue of beacon-auth re-running its inner message through `decodeInner`).
function wellFormed(a: Announce): boolean {
  return (
    typeof a.dest === "string" &&
    typeof a.zid === "string" &&
    typeof a.hops === "number" &&
    Number.isSafeInteger(a.hops) &&
    a.hops >= 0 &&
    typeof a.id === "string"
  );
}

/// Verify a signed announce against the trust store. Pure, total, and never throws:
/// trusted key + valid signature + the signer SPEAKS FOR the claimed identity + the
/// address COMMITS to that identity. All four, in that order.
///
/// Noninterference §13: `trust` is a declared input. This function opens no keystore,
/// reads no clock, and touches no socket — verification is a function of (text, trust)
/// alone, which is also what makes it DST-replayable.
export function verifyAnnounce(text: string, trust: AnnounceTrust): AnnounceVerdict {
  const env = decodeEnvelope(text);
  if (!env) return { ok: false, reason: "not-signed-envelope" };
  return verifyAnnounceDetached(env.announce, { key_id: env.key_id, sig: env.sig }, trust);
}

/// The result of an authenticated fold. `accepted` is the verified announce — present ONLY
/// when `verdict.ok` — so a caller can act on it (e.g. relay it) without re-decoding or
/// trusting an unverified record.
export interface SignedAnnounceObservation {
  readonly table: PathTable;
  readonly verdict: AnnounceVerdict;
  readonly accepted?: Announce;
}

/// The authenticated announce step: decode the signed envelope, verify it, THEN fold via
/// the untouched pure core (`observeAnnounce`). A refused announce leaves the table
/// BYTE-IDENTICAL (the same object reference is returned) and reports why.
///
/// `nowMs` is injected and is only ever WRITTEN onto an accepted path as a liveness stamp;
/// it never decides whether an announce is accepted. Local time therefore cannot filter
/// what enters this fold, so two nodes with different receive-times fold the same evidence
/// set — `.claude/rules/local-time-never-enters-the-shared-fold.md`.
export function observeAnnounceSigned(
  table: PathTable,
  text: string,
  nowMs: number,
  trust: AnnounceTrust,
): SignedAnnounceObservation {
  const verdict = verifyAnnounce(text, trust);
  if (!verdict.ok) return { table, verdict };
  const env = decodeEnvelope(text) as SignedAnnounce; // verified above; re-decode is total
  return { table: observeAnnounce(table, env.announce, nowMs), verdict, accepted: env.announce };
}

/// Re-encode a verified announce with a bumped hop count, preserving the ORIGINAL signature.
/// This is what makes relaying possible under authentication: the identity claim the
/// signature covers is unchanged, so the next hop verifies it against the ORIGIN's key —
/// not the relay's. A relay therefore cannot launder an identity it does not hold.
export function relaySignedAnnounce(text: string, bumpTo: number): string | null {
  const env = decodeEnvelope(text);
  if (!env || !wellFormed(env.announce) || !Number.isSafeInteger(bumpTo) || bumpTo < 0) return null;
  const relayed: SignedAnnounce = { ...env, announce: { ...env.announce, hops: bumpTo } };
  return JSON.stringify(relayed);
}
