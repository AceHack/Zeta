// beacon-auth — the signed discovery wire (shadow*). Fix for the BUGS.md P1
// "Discovery-beacon wire is unsigned — spoof / poison / forged-evict".
//
// Aaron 2026-07-03: *"look at how new keys are generated for a new human so we can always
// rotate, i made this nation state resistant auth for humans, ais should just do
// similar/same."* So this module INVENTS NOTHING — it reuses the human auth stack:
//
//   - keys      — the persona keyring (`tools/setup/persona-keys/`, "each traveler —
//                 persona OR human maintainer"): one BIP-39 seed, type-separated paths.
//   - signing   — Ed25519 over the canonical key-sorted byte form (`ace/signing.ts`
//                 `keyId` + `ace/canonical.ts` `canonicalBytes`) — the Ace discipline.
//   - rotation  — the dual-key overlap-window ADR (2026-06-15): a zid may hold TWO
//                 trust entries during rotation (old + new key_id, same zid); readers
//                 accept both, the old key is dropped only after all writers migrated.
//
// The pure core (`discovery-beacon.ts` `observe`) is untouched — this module is the
// authenticity membrane in FRONT of the fold: decode → verify → only then observe.
// Verification rules:
//   - every message must arrive in a signed envelope from a key in the trust store;
//   - `hello`/`probeMatch` — the signer's trust entry must OWN the claimed `zid`
//     (a key cannot announce someone else's identity);
//   - `bye` — must be SELF-SIGNED by the peer leaving (signer's zid == the zid the
//     table holds for that endpoint). An unauthenticated bye is a forged Z-set
//     retraction — revoke-without-authority — and is refused;
//   - `probe` — any trusted traveler may probe (queries don't mutate the table).
//
// Known residual (named, not hidden): a captured envelope can be REPLAYED within a
// peer's TTL window (freshness is not yet bound into the signature). The follow-on is
// a signed-seq/timestamp freshness check; it needs per-peer seq state in the table and
// is out of this slice's scope. Replay cannot forge NEW state — only re-assert state
// the key's owner really signed.
//
// Disciplines: pure functions, injected trust (noninterference §13 — the trust store is
// the ONE authority door); TEXT wire (JSON, no binary in the proof lineage); DST-
// replayable (same envelopes + times + trust → same table). Anchors (Beacon): Ed25519
// (Bernstein et al. 2011); WS-Discovery (OASIS) for the message model; NIST SP 800-57
// key-rotation overlap; self-certifying identifiers (Mazières SFS lineage — the zid).

import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import { canonicalBytes } from "../ace/canonical.ts";
import { keyId } from "../ace/signing.ts";
import { decode as decodeInner, encode as encodeInner, endpointKey, observe } from "./discovery-beacon.ts";
import type { DiscoveryMessage, EndpointRef, PeerTable } from "./discovery-beacon.ts";

const SIGNED_SCHEMA = "zeta.discovery-signed.v1";

/// A trust-store entry: this Ed25519 public key (SPKI-DER base64) speaks FOR this zid.
/// Dual-key rotation = two entries with the same `zid` (old + new key) during the
/// overlap window; revoke = delete the entry (the trust store is the caller's fold).
export interface BeaconTrustEntry {
  readonly public_key: string;
  readonly zid: string;
  readonly label?: string;
}

/// key_id ("ed25519:" + first 16 hex of sha256(SPKI-DER)) → who that key speaks for.
export type BeaconTrust = ReadonlyMap<string, BeaconTrustEntry>;

/// The signed envelope on the wire — the inner message is the UNCHANGED discovery
/// vocabulary; the signature covers the canonical bytes of { schema, msg } so the
/// envelope cannot be re-purposed across protocols.
interface SignedEnvelope {
  readonly schema: typeof SIGNED_SCHEMA;
  readonly msg: DiscoveryMessage;
  readonly key_id: string;
  readonly sig: string;
}

function signedBytes(msg: DiscoveryMessage): Uint8Array {
  return canonicalBytes({ schema: SIGNED_SCHEMA, msg });
}

/// Sign a discovery message with the persona's Ed25519 private key (PEM, keyring-derived)
/// and encode it for the wire. Throws on a non-ed25519 key — a signing identity must be
/// the keyring's, not an arbitrary key type.
export function signMessage(msg: DiscoveryMessage, privatePem: string): string {
  const priv = createPrivateKey(privatePem);
  if (priv.asymmetricKeyType !== "ed25519") {
    throw new Error(`signMessage: expected an ed25519 key, got ${priv.asymmetricKeyType ?? "unknown"}`);
  }
  const spkiB64 = (createPublicKey(priv).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  const sig = (nodeSign(null, signedBytes(msg), priv) as Buffer).toString("base64");
  const envelope: SignedEnvelope = { schema: SIGNED_SCHEMA, msg, key_id: keyId(spkiB64), sig };
  return JSON.stringify(envelope);
}

/// An opaque signer: turns a discovery message into its signed wire text. This is the ONLY
/// signing authority a node needs — it never sees raw key material, so the key can live behind a
/// biometric prompt / Keychain / Secure Enclave / HSM (Aaron: "nothing operator-run, only
/// operator-approved"). The trivial default is `(msg) => signMessage(msg, privatePem)`.
export type BeaconSigner = (msg: DiscoveryMessage) => string;

/// Why a signed observation was refused. `refused` never throws and never mutates —
/// a hostile wire gets a verdict, not a crash and not a table write.
export type RefuseReason =
  | "not-signed-envelope" // garbage / wrong schema / missing fields
  | "bad-inner-message" // envelope shape ok but the inner msg isn't discovery vocabulary
  | "untrusted-key" // key_id not in the trust store (or revoked = deleted)
  | "bad-signature" // signature does not verify over the canonical bytes
  | "zid-mismatch" // hello/probeMatch claims a zid the signing key does not own
  | "bye-unknown-peer" // bye for an endpoint the table doesn't hold (nothing to verify against)
  | "bye-not-self-signed"; // bye signed by a key that is not the leaving peer's

export type BeaconVerdict =
  | { readonly ok: true; readonly key_id: string; readonly zid: string }
  | { readonly ok: false; readonly reason: RefuseReason };

/// Guarded envelope decode — foreign / malformed / unsigned input yields null, never throws.
function decodeEnvelope(text: string): SignedEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const e = parsed as { schema?: unknown; msg?: unknown; key_id?: unknown; sig?: unknown };
  if (e.schema !== SIGNED_SCHEMA || typeof e.key_id !== "string" || typeof e.sig !== "string") return null;
  if (typeof e.msg !== "object" || e.msg === null) return null;
  return parsed as SignedEnvelope;
}

/// Verify an envelope against the trust store: trusted key + valid signature + the
/// signer OWNS the identity the message asserts. Pure; never throws.
function verifyEnvelope(env: SignedEnvelope, trust: BeaconTrust): BeaconVerdict {
  const entry = trust.get(env.key_id);
  if (!entry) return { ok: false, reason: "untrusted-key" };
  let verified: boolean;
  try {
    const pub = createPublicKey({ key: Buffer.from(entry.public_key, "base64"), format: "der", type: "spki" });
    verified = nodeVerify(null, signedBytes(env.msg), pub, Buffer.from(env.sig, "base64"));
  } catch {
    verified = false; // malformed key/sig bytes → bad-signature, never throw
  }
  if (!verified) return { ok: false, reason: "bad-signature" };
  const m = env.msg;
  if ((m.t === "hello" || m.t === "probeMatch") && m.zid !== entry.zid) {
    return { ok: false, reason: "zid-mismatch" };
  }
  return { ok: true, key_id: env.key_id, zid: entry.zid };
}

/// The result of an authenticated fold. `accepted` is the verified inner message — present
/// ONLY when `verdict.ok` — so a caller can act on it (e.g. answer a verified `probe`) without
/// re-decoding or trusting an unverified message.
export interface SignedObservation {
  readonly table: PeerTable;
  readonly replies: readonly DiscoveryMessage[];
  readonly verdict: BeaconVerdict;
  readonly accepted?: DiscoveryMessage;
}

/// The authenticated discovery step: decode the signed envelope, verify it, THEN fold
/// via the untouched pure core. A refused message leaves the table byte-identical and
/// reports why. `bye` additionally requires self-signature: the signer's zid must be
/// the zid the table currently holds for the departing endpoint.
export function observeSigned(
  self: EndpointRef,
  table: PeerTable,
  text: string,
  nowMs: number,
  trust: BeaconTrust,
): SignedObservation {
  const refuse = (reason: RefuseReason): SignedObservation => ({ table, replies: [], verdict: { ok: false as const, reason } });
  const env = decodeEnvelope(text);
  if (!env) return refuse("not-signed-envelope");
  // Re-run the inner message through the beacon's own guarded decode so only the
  // established vocabulary passes (an envelope cannot smuggle an unknown message type).
  const inner = decodeInner(encodeInner(env.msg));
  if (!inner) return refuse("bad-inner-message");
  const verdict = verifyEnvelope({ ...env, msg: inner }, trust);
  if (!verdict.ok) return { table, replies: [], verdict };
  if (inner.t === "bye") {
    const peer = table.get(endpointKey(inner.ep));
    if (!peer) return refuse("bye-unknown-peer");
    if (peer.zid !== verdict.zid) return refuse("bye-not-self-signed");
  }
  const r = observe(self, table, inner, nowMs);
  return { table: r.table, replies: r.replies, verdict, accepted: inner };
}
