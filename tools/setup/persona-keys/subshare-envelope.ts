// subshare-envelope.ts — the ABOVE-THE-PORT security layer. One implementation
// of everything subshare-transport-port.ts says a carrier cannot supply.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// ============================================================================
// WHY THIS IS NOT INSIDE AN ADAPTER
// ============================================================================
//
// P1 confidentiality, P2 holder authenticity, P3 replay resistance and P4
// forward secrecy are all marked `providedBy: "above-port"` in the contract.
// That is a placement decision, not a taste: a WireGuard adapter that carried
// replay protection would force a DHT adapter to reimplement it, and the second
// implementation would differ subtly. Above the port, every adapter inherits
// this file unchanged -- including the sneakernet "adapter" that is a person
// carrying a USB stick, which cannot run adapter code at all.
//
// The consequence, stated so it is not mistaken for modesty: the ceremony's
// security rests ENTIRELY on this file. WireGuard, tailscale and headscale
// contribute metadata concealment and coarse admission. If the mesh is fully
// compromised -- control plane, keys, every relay -- no property below breaks.
// That is the intended result, and it is what lets the answer to "should share
// custody depend on the control plane" be "no."
//
// ============================================================================
// CONSTRUCTION
// ============================================================================
//
// Phase 1 (recipient, asynchronous): mintRecipientPreKey generates an X-Wing KEM
//   keypair valid for THIS ceremony only, signs the public half with the
//   recipient's pinned long-term ed25519 key, and returns an opaque handle over
//   the secret half. The signature is what stops a man-in-the-middle from
//   substituting its own pre-key; the freshness is what makes P4 achievable
//   without a live handshake (X3DH's published-prekey trick, minus the sessions).
//
// Phase 2 (holder, asynchronous): seal verifies the pre-key against the roster,
//   encapsulates to it, derives an AEAD key by HKDF, and encrypts the 32-byte
//   scalar under an AAD that binds schema, ceremony, group key, fromX, toX,
//   sender identity key and pre-key digest. Then signs the whole body with the
//   holder's long-term key.
//
// Phase 3 (recipient, asynchronous): open re-derives every routing field from
//   the authenticated interior, rejects on any exterior disagreement, checks the
//   roster, the signature, the replay guard, then decapsulates and decrypts.
//
// Phase 4 (recipient, after reshareCombine): handle.destroy(). This is the step
//   that makes P4 true rather than claimed. Everything recorded on the wire
//   becomes dead bytes at that instant, and no later compromise of any long-term
//   key recovers it.
//
// ============================================================================
// WHY THE KEM IS POST-QUANTUM AND THE SIGNATURE IS NOT
// ============================================================================
//
// The asymmetry is deliberate and it is not an oversight.
//
//   KEM (X-Wing = ML-KEM-768 + X25519): a subshare is secret-equivalent in
//   transit and the share it builds stays live for years, so a recording made
//   today is worth a break made at any later date. Harvest-now-decrypt-later is
//   the literal threat, so the confidentiality primitive must be PQ.
//
//   Signature (ed25519): a forged subshare must be forged DURING the ceremony,
//   because the ceremony ends in verifyResharePreservesGroupKey and the artifacts
//   are then archived. A quantum forgery produced in 2040 against a 2026 ceremony
//   convinces nobody -- there is no verifier left to fool. Retrospective breaks
//   do not threaten authenticity the way they threaten confidentiality.
//
// This costs ~1.2KB per datagram instead of ~5KB, which matters for the LoRa /
// Reticulum case where the MTU is small enough to care.
//
// ============================================================================
// LIMITS -- READ BEFORE TRUSTING IT
// ============================================================================
//
// 1. THE SCALAR IS IN HOST RAM at seal time and at open time, exactly as
//    frost-reshare.ts caveat 1 says of the reshare arithmetic itself. This file
//    changes nothing about tier: it is L1. It never logs, prints, or persists the
//    scalar in the clear, which is a different and weaker claim than "the scalar
//    never exists in the clear."
//
// 2. FORWARD SECRECY IS AN OPERATIONAL PROPERTY HERE. It holds if and only if
//    destroy() is actually called and the process memory does not outlive it in a
//    swap file or a core dump. The test suite falsifies the cryptographic half
//    (a destroyed handle cannot open) and CANNOT falsify the operational half.
//    Do not read the passing test as proof that the secret left the machine.
//
// 3. TRAFFIC ANALYSIS IS NOT ADDRESSED. Datagram sizes are uniform and the
//    exterior routing fields are cleartext by design, so an observer of the
//    carrier learns who is resharing with whom and when. That is the one thing a
//    WireGuard or tailscale carrier genuinely adds, and it is the honest reason
//    to run one even though no property depends on it.
//
// 4. THE ROSTER IS NOT DISTRIBUTED BY THIS FILE. Pinning holder keys is the whole
//    control-plane answer, and a roster fetched from the mesh would hand the
//    control plane the authority the pin exists to deny it. Roster transport is
//    deliberately out of scope and belongs out of band.
//
// Anchors (Beacon): Barbosa et al. / Connolly, Schwabe, Westerbaan, "X-Wing: The
// Hybrid KEM" (2024). Bernstein et al., ed25519 (2011). Nir & Langley, RFC 8439
// (ChaCha20-Poly1305). Krawczyk & Eronen, RFC 5869 (HKDF). Marlinspike & Perrin,
// X3DH (2016) -- signed published prekeys. Herzberg, Jarecki, Krawczyk & Yung,
// CRYPTO '95 -- the proactive-refresh independence that P3 protects.

import { ed25519 } from "@noble/curves/ed25519.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
// `@noble/post-quantum` 0.7.0 dropped the legacy `XWing` alias; `ml_kem768_x25519`
// is the canonical export and, in 0.6.1, was the very object the alias pointed at.
// The preset definition is byte-identical across the two releases, so this rename
// changes no bytes on the wire. The local name stays `XWing` — it is the name in
// the X-Wing draft cited in this file's Beacon anchors above.
import { ml_kem768_x25519 as XWing } from "@noble/post-quantum/hybrid.js";
import { randomBytes as nodeRandomBytes } from "node:crypto";

import {
  SUBSHARE_DATAGRAM_SCHEMA,
  ordinalCompare,
  replayKey,
  type CeremonyPreKey,
  type CeremonyRoster,
  type MintedPreKey,
  type OpenContext,
  type OpenOutcome,
  type OpenRejection,
  type RecipientKeyHandle,
  type RosterEntry,
  type SealRequest,
  type SealedDatagram,
  type SubshareSecurityLayer,
} from "./subshare-transport-port.ts";

const Fn = ed25519.Point.Fn;

/** Domain separation. Both strings are inside signed/authenticated bytes. */
const SIG_CONTEXT = "zeta.frost.subshare-datagram.v1/body";
const PREKEY_CONTEXT = "zeta.frost.subshare-prekey.v1";
const HKDF_CONTEXT = "zeta.frost.subshare-datagram.v1/aead";

/**
 * Fixed zero AEAD nonce, and the invariant that makes it safe.
 *
 * The AEAD key is HKDF(sharedSecret, info=<ceremony|from|to>) where sharedSecret
 * comes from a FRESH XWing.encapsulate on every seal. A given key therefore
 * encrypts exactly one plaintext, ever, which is the only condition
 * ChaCha20-Poly1305 nonce-uniqueness asks for. Same argument as
 * better-git-crypt's CEK wrap. If a caller ever reuses an encapsulation, this
 * invariant breaks -- which is why encapsulation is not a parameter.
 */
const ZERO_NONCE = new Uint8Array(12);

/** The scalar's wire width. ed25519 scalars are < 2^253; 32 bytes big-endian. */
const SCALAR_BYTES = 32;

// ---------------------------------------------------------------------------
// canonical text encoding -- no binary in the proof lineage
// ---------------------------------------------------------------------------

type Json = string | number | boolean | null | readonly Json[] | { readonly [k: string]: Json };

/**
 * Deterministic JSON: keys sorted with ORDINAL comparison (culture-invariant by
 * default -- localeCompare would sort differently per machine and the signature
 * would verify on one host and fail on another).
 */
export function canonicalJson(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v as Json)).join(",")}]`;
  const obj = value as Readonly<Record<string, Json>>;
  const pairs = Object.keys(obj)
    .sort(ordinalCompare)
    .map((k) => {
      const encodedKey = JSON.stringify(k);
      const encodedValue = canonicalJson(obj[k] as Json);
      return `${encodedKey}:${encodedValue}`;
    });
  return `{${pairs.join(",")}}`;
}

function scalarToBytes(s: bigint): Uint8Array {
  const out = new Uint8Array(SCALAR_BYTES);
  let v = Fn.create(s);
  for (let i = SCALAR_BYTES - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function bytesToScalar(b: Uint8Array): bigint {
  let v = 0n;
  for (const byte of b) v = (v << 8n) + BigInt(byte);
  return Fn.create(v);
}

/** DST hook: with no `random` this is the OS CSPRNG, same default as frost.ts. */
function drawBytes(n: number, random?: () => number): Uint8Array {
  if (random === undefined) return new Uint8Array(nodeRandomBytes(n));
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(random() * 256);
  return out;
}

// ---------------------------------------------------------------------------
// the datagram body
// ---------------------------------------------------------------------------

/**
 * The authenticated interior. Every routing decision is made from these fields,
 * never from SealedDatagram's exterior copies.
 */
export interface SubshareBody {
  readonly schema: string;
  readonly ceremonyId: string;
  readonly groupPublicKey: string;
  readonly fromX: number;
  readonly toX: number;
  readonly senderIdentityKey: string;
  readonly preKeyDigest: string;
  readonly kemCiphertext: string;
  readonly ciphertext: string;
  readonly signature: string;
}

type SignedView = Omit<SubshareBody, "signature">;

function signedBytes(view: SignedView): Uint8Array {
  return utf8ToBytes(`${SIG_CONTEXT}\n${canonicalJson(view)}`);
}

/**
 * The coordinates a datagram is bound to. Deliberately excludes the ciphertext
 * and the KEM ciphertext, so the AAD can be built BEFORE encryption exists (a
 * ciphertext cannot authenticate itself) and so both sides derive it from
 * fields each holds independently.
 */
interface DatagramCoordinates {
  readonly schema: string;
  readonly ceremonyId: string;
  readonly groupPublicKey: string;
  readonly fromX: number;
  readonly toX: number;
  readonly senderIdentityKey: string;
  readonly preKeyDigest: string;
}

/** AAD binds the datagram to its coordinates. Re-addressing breaks decryption. */
function aadBytes(c: DatagramCoordinates): Uint8Array {
  return utf8ToBytes(canonicalJson(c as unknown as Json));
}

function coordinatesOf(view: SignedView): DatagramCoordinates {
  return {
    schema: view.schema,
    ceremonyId: view.ceremonyId,
    groupPublicKey: view.groupPublicKey,
    fromX: view.fromX,
    toX: view.toX,
    senderIdentityKey: view.senderIdentityKey,
    preKeyDigest: view.preKeyDigest,
  };
}

function aeadKey(sharedSecret: Uint8Array, ceremonyId: string, fromX: number, toX: number): Uint8Array {
  return hkdf(
    sha256,
    sharedSecret,
    undefined,
    utf8ToBytes(`${HKDF_CONTEXT}|${ceremonyId}|${String(fromX)}|${String(toX)}`),
    32,
  );
}

/**
 * The exact bytes a participant signs when publishing a pre-key. Exported so an
 * out-of-band publication path (or a conformance mutant) can produce a pre-key
 * without re-deriving the domain separation by hand and getting it subtly wrong.
 */
export function preKeySignedBytes(ceremonyId: string, toX: number, kemPublicKeyHex: string): Uint8Array {
  return utf8ToBytes(`${PREKEY_CONTEXT}\n${canonicalJson({ ceremonyId, toX, kemPublicKey: kemPublicKeyHex })}`);
}

function findEntry(entries: readonly RosterEntry[], x: number): RosterEntry | undefined {
  return entries.find((e) => e.x === x);
}

/** Content address of a datagram body -- the replay guard's value half. */
export function datagramDigest(body: string): string {
  return bytesToHex(sha256(utf8ToBytes(body)));
}

// ---------------------------------------------------------------------------
// phase 1 -- recipient mints a per-ceremony pre-key
// ---------------------------------------------------------------------------

/**
 * Fresh KEM keypair for ONE ceremony, signed by the recipient's pinned key.
 *
 * The handle is a closure over the secret (no class, no field, nothing to
 * serialise -- interfaces-free-classes-earned / §3 weight-free). destroy()
 * drops the only reference this process has and zeroes the buffer.
 */
export function mintRecipientPreKey(
  roster: CeremonyRoster,
  toX: number,
  participantIdentitySecret: Uint8Array,
  random?: () => number,
): MintedPreKey {
  const entry = findEntry(roster.participants, toX);
  if (entry === undefined) {
    throw new Error(`subshare-envelope: participant ${String(toX)} is not on the roster`);
  }
  const derived = bytesToHex(ed25519.getPublicKey(participantIdentitySecret));
  if (derived !== entry.identityPublicKey) {
    // Refuse to sign a pre-key with a key the roster does not pin to this seat.
    throw new Error(`subshare-envelope: identity secret does not match roster seat ${String(toX)}`);
  }

  const kp = XWing.keygen(drawBytes(32, random));
  let secret: Uint8Array | undefined = kp.secretKey;
  const kemPublicKey = bytesToHex(kp.publicKey);
  const signature = bytesToHex(
    ed25519.sign(preKeySignedBytes(roster.ceremonyId, toX, kemPublicKey), participantIdentitySecret),
  );

  const handle: RecipientKeyHandle = {
    ceremonyId: roster.ceremonyId,
    toX,
    isDestroyed: () => secret === undefined,
    destroy: () => {
      if (secret !== undefined) secret.fill(0);
      secret = undefined;
    },
  };
  // The decapsulation capability is reachable only through this module-private
  // map, keyed by the handle object. A caller holding the handle can decrypt;
  // a caller holding the handle cannot read the secret out of it.
  DECAPSULATORS.set(handle, (ct: Uint8Array) => {
    if (secret === undefined) return undefined;
    return XWing.decapsulate(ct, secret);
  });

  return {
    preKey: { ceremonyId: roster.ceremonyId, toX, kemPublicKey, signature },
    handle,
  };
}

const DECAPSULATORS = new WeakMap<RecipientKeyHandle, (ct: Uint8Array) => Uint8Array | undefined>();

/** True when the pre-key is signed by the key the roster pins to seat `toX`. */
export function verifyPreKey(roster: CeremonyRoster, preKey: CeremonyPreKey): boolean {
  if (preKey.ceremonyId !== roster.ceremonyId) return false;
  const entry = findEntry(roster.participants, preKey.toX);
  if (entry === undefined) return false;
  try {
    return ed25519.verify(
      hexToBytes(preKey.signature),
      preKeySignedBytes(preKey.ceremonyId, preKey.toX, preKey.kemPublicKey),
      hexToBytes(entry.identityPublicKey),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// phase 2 -- holder seals
// ---------------------------------------------------------------------------

export function seal(request: SealRequest): SealedDatagram {
  const { roster, preKey, subshare, holderIdentitySecret, random } = request;

  const holder = findEntry(roster.holders, subshare.fromX);
  if (holder === undefined) {
    throw new Error(`subshare-envelope: holder ${String(subshare.fromX)} is not on the roster`);
  }
  const senderIdentityKey = bytesToHex(ed25519.getPublicKey(holderIdentitySecret));
  if (senderIdentityKey !== holder.identityPublicKey) {
    throw new Error(`subshare-envelope: identity secret does not match roster seat ${String(subshare.fromX)}`);
  }
  if (preKey.toX !== subshare.toX) {
    throw new Error("subshare-envelope: pre-key addresses a different participant than the subshare");
  }
  // The MITM gate. A holder that seals to an unverified pre-key has handed P1 to
  // whoever supplied the key, and no later check recovers it.
  if (!verifyPreKey(roster, preKey)) {
    throw new Error(`subshare-envelope: pre-key for participant ${String(preKey.toX)} failed roster verification`);
  }

  const coordinates: DatagramCoordinates = {
    schema: SUBSHARE_DATAGRAM_SCHEMA,
    ceremonyId: roster.ceremonyId,
    groupPublicKey: roster.groupPublicKey,
    fromX: subshare.fromX,
    toX: subshare.toX,
    senderIdentityKey,
    preKeyDigest: bytesToHex(sha256(hexToBytes(preKey.kemPublicKey))),
  };

  const enc = XWing.encapsulate(hexToBytes(preKey.kemPublicKey), drawBytes(64, random));
  const key = aeadKey(enc.sharedSecret, roster.ceremonyId, subshare.fromX, subshare.toX);
  const ciphertext = chacha20poly1305(key, ZERO_NONCE, aadBytes(coordinates)).encrypt(scalarToBytes(subshare.scalar));

  const view: SignedView = {
    ...coordinates,
    kemCiphertext: bytesToHex(enc.cipherText),
    ciphertext: bytesToHex(ciphertext),
  };

  const body: SubshareBody = {
    ...view,
    signature: bytesToHex(ed25519.sign(signedBytes(view), holderIdentitySecret)),
  };

  return {
    schema: SUBSHARE_DATAGRAM_SCHEMA,
    ceremonyId: roster.ceremonyId,
    fromX: subshare.fromX,
    toX: subshare.toX,
    body: canonicalJson(body as unknown as Json),
  };
}

// ---------------------------------------------------------------------------
// phase 3 -- recipient opens
// ---------------------------------------------------------------------------

function parseBody(text: string): SubshareBody | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof raw !== "object" || raw === null) return undefined;
  const b = raw as Record<string, unknown>;
  const strings = [
    "schema",
    "ceremonyId",
    "groupPublicKey",
    "senderIdentityKey",
    "preKeyDigest",
    "kemCiphertext",
    "ciphertext",
    "signature",
  ] as const;
  for (const k of strings) if (typeof b[k] !== "string") return undefined;
  if (typeof b.fromX !== "number" || typeof b.toX !== "number") return undefined;
  return b as unknown as SubshareBody;
}

/**
 * Everything that must hold BEFORE any secret key is touched: schema, the
 * routing exterior agreeing with the signed interior, the roster, the signature.
 *
 * Split out of `open` deliberately -- these are the checks that must run in this
 * order and short-circuit, and reading them as one list is how a reviewer
 * verifies that nothing reaches the KEM until the sender is known.
 */
function admit(
  datagram: SealedDatagram,
  context: OpenContext,
): { readonly body: SubshareBody } | { readonly reason: OpenRejection } {
  const { roster, handle } = context;

  if (datagram.schema !== SUBSHARE_DATAGRAM_SCHEMA) return { reason: "schema" };
  const body = parseBody(datagram.body);
  if (body === undefined) return { reason: "malformed" };
  if (body.schema !== SUBSHARE_DATAGRAM_SCHEMA) return { reason: "schema" };

  // Routing address is not identity: the UNAUTHENTICATED exterior must agree
  // with the authenticated interior, and when they differ the datagram dies.
  // A carrier that rewrites a routing hint cannot silently re-address a subshare.
  const exteriorAgrees =
    datagram.ceremonyId === body.ceremonyId && datagram.fromX === body.fromX && datagram.toX === body.toX;
  if (!exteriorAgrees) return { reason: "routing-mismatch" };
  if (body.toX !== handle.toX) return { reason: "routing-mismatch" };

  if (body.ceremonyId !== roster.ceremonyId) return { reason: "wrong-ceremony" };
  if (body.groupPublicKey !== roster.groupPublicKey) return { reason: "wrong-group-key" };

  const holder = findEntry(roster.holders, body.fromX);
  if (holder === undefined) return { reason: "unknown-sender" };
  // Seat and key must agree. A rostered holder cannot speak for another seat.
  if (holder.identityPublicKey !== body.senderIdentityKey) return { reason: "unknown-sender" };

  const { signature, ...view } = body;
  try {
    if (!ed25519.verify(hexToBytes(signature), signedBytes(view), hexToBytes(body.senderIdentityKey))) {
      return { reason: "bad-signature" };
    }
  } catch {
    return { reason: "bad-signature" };
  }
  return { body };
}

export function open(datagram: SealedDatagram, context: OpenContext): OpenOutcome {
  const { handle, guard } = context;

  const admitted = admit(datagram, context);
  if (!("body" in admitted)) return { ok: false, reason: admitted.reason };
  const { body } = admitted;

  // Replay: same coordinate, same bytes -> idempotent. Same coordinate, other
  // bytes -> a second subshare from one holder, which is an attack or a bug and
  // never a redelivery.
  const rkey = replayKey(body.ceremonyId, body.fromX, body.toX);
  const digest = datagramDigest(datagram.body);
  const prior = guard.seen(rkey);
  if (prior !== undefined && prior !== digest) return { ok: false, reason: "conflicting-replay" };

  if (handle.isDestroyed()) return { ok: false, reason: "key-destroyed" };
  const decapsulate = DECAPSULATORS.get(handle);
  if (decapsulate === undefined) return { ok: false, reason: "key-destroyed" };

  let plaintext: Uint8Array;
  try {
    const sharedSecret = decapsulate(hexToBytes(body.kemCiphertext));
    if (sharedSecret === undefined) return { ok: false, reason: "key-destroyed" };
    const key = aeadKey(sharedSecret, body.ceremonyId, body.fromX, body.toX);
    plaintext = chacha20poly1305(key, ZERO_NONCE, aadBytes(coordinatesOf(body))).decrypt(hexToBytes(body.ciphertext));
  } catch {
    return { ok: false, reason: "undecryptable" };
  }
  if (plaintext.length !== SCALAR_BYTES) return { ok: false, reason: "undecryptable" };

  guard.record(rkey, digest);
  return {
    ok: true,
    duplicate: prior !== undefined,
    subshare: { fromX: body.fromX, toX: body.toX, scalar: bytesToScalar(plaintext) },
  };
}

/** The shipped implementation of the port's security-layer interface. */
export const envelopeSecurityLayer: SubshareSecurityLayer = {
  name: "xwing-ed25519-chachapoly-v1",
  mintRecipientPreKey,
  seal,
  open,
};
