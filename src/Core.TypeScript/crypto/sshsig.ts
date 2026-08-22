// sshsig.ts — pure-TypeScript verification of OpenSSH SSHSIG signatures (ed25519 only).
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
// The repo already commits the public half of the identities that matter, as
// plain text, in the form OpenSSH writes: `maintainers/<who>/ssh-pubkeys.txt`
// and `maintainers/zeta/ssh-ca.pub`. Those are the anchors an attestation
// should stand on — the same keys git commit-signing and the SSH CA use.
//
// What was missing is the *reading* half. `ssh-keygen -Y sign` can produce a
// detached signature with a key that never leaves an agent (1Password, a
// hardware key, `ssh-agent`), which is the only custody story that survives
// contact with how these keys are actually held here. But verification via
// `ssh-keygen -Y verify` needs the `ssh-keygen` binary and an `allowed_signers`
// file on disk — so a browser tab or a peer with only a clone cannot check a
// claim. This module verifies the same bytes in-process with `node:crypto`
// ed25519 and nothing else, so the verifier runs anywhere the rest of the
// TypeScript does.
//
// ---------------------------------------------------------------------------
// WHAT A VALID SIGNATURE HERE PROVES — AND WHAT IT DOES NOT
// ---------------------------------------------------------------------------
// PROVES: the holder of the private key matching the embedded public key
// signed *these exact message bytes* under *this exact namespace*. Nothing
// weaker, and it is bound to both — a signature made for another namespace
// does not verify here (that is the point of the namespace field).
//
// DOES NOT PROVE: who the key belongs to (that is the roster's job — see
// `findRosterEntry`), that the key was not stolen, when it was signed (SSHSIG
// carries no timestamp), or that any statement inside the message is TRUE. A
// signature transfers a claim to a key; it never makes the claim correct.
//
// ---------------------------------------------------------------------------
// FORMAT (PROTOCOL.sshsig, OpenSSH 8.0+) — implemented exactly as specified
// ---------------------------------------------------------------------------
//   byte[6]  MAGIC          "SSHSIG"
//   uint32   SIG_VERSION    1
//   string   publickey      (SSH wire-format public key)
//   string   namespace      non-empty; domain separation
//   string   reserved       (must be empty)
//   string   hash_algorithm "sha256" | "sha512"
//   string   signature      (SSH wire: string alg, string raw-sig)
//
// The bytes actually signed are a SECOND blob, never the raw message:
//   MAGIC ‖ string namespace ‖ string reserved ‖ string hash_algorithm ‖ string H(message)
//
// That indirection is load-bearing: it is why a signature over a build receipt
// cannot be replayed as a git commit signature (namespace `git`) even though
// both are ed25519 over SSH keys.
//
// Wire `string` = uint32 big-endian length ‖ bytes. All integers big-endian.
//
// Anchors (Beacon): Ylonen & Lonvick, RFC 4251 §5 (SSH wire data types) and
// RFC 8709 (ed25519 for SSH); Bernstein, Duif, Lange, Schwabe & Yang,
// "High-speed high-security signatures" (2012) — Ed25519; OpenSSH
// `PROTOCOL.sshsig`. The golden vector in the test is produced by real
// `ssh-keygen -Y sign` output, so the anchor is CHECKED, not cited.

import { createHash, createPublicKey, verify as nodeVerify } from "node:crypto";

/** SSH ed25519 public keys are 32 raw bytes; anything else is not this algorithm. */
export const ED25519_RAW_PUBLIC_KEY_LENGTH = 32;
/** Ed25519 signatures are 64 raw bytes (R ‖ S). */
export const ED25519_SIGNATURE_LENGTH = 64;
/** The only key algorithm this module verifies. */
export const SSH_ED25519 = "ssh-ed25519";

const MAGIC = "SSHSIG";
const SIG_VERSION = 1;
const ARMOR_BEGIN = "-----BEGIN SSH SIGNATURE-----";
const ARMOR_END = "-----END SSH SIGNATURE-----";

/** Why a parse or a verification was refused. Data, never a printed message. */
export type SshSigFailure =
  | "malformed-base64"
  | "bad-magic"
  | "unsupported-version"
  | "truncated"
  | "trailing-bytes"
  | "reserved-not-empty"
  | "empty-namespace"
  | "unsupported-key-algorithm"
  | "unsupported-signature-algorithm"
  | "unsupported-hash-algorithm"
  | "bad-key-length"
  | "bad-signature-length"
  | "namespace-mismatch"
  | "bad-signature";

export interface SshSigParsed {
  /** SSH wire-format public key blob — what the fingerprint is computed over. */
  readonly publicKeyBlob: Uint8Array;
  /** Raw 32-byte ed25519 public key. */
  readonly rawPublicKey: Uint8Array;
  readonly namespace: string;
  readonly hashAlgorithm: "sha256" | "sha512";
  /** Raw 64-byte ed25519 signature. */
  readonly signature: Uint8Array;
  /** `SHA256:<unpadded-base64>` — the fingerprint OpenSSH prints for this key. */
  readonly fingerprint: string;
}

export type SshSigParseResult =
  | { readonly ok: true; readonly sig: SshSigParsed }
  | { readonly ok: false; readonly reason: SshSigFailure };

export type SshSigVerifyResult =
  | { readonly ok: true; readonly fingerprint: string; readonly namespace: string }
  | { readonly ok: false; readonly reason: SshSigFailure };

// ── wire primitives ─────────────────────────────────────────────────────────

/** 4-byte big-endian length prefix, written explicitly so it cannot drift with the platform. */
export function u32be(n: number): Uint8Array {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError(`u32be: ${n} is not a u32`);
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** SSH wire `string`: uint32be length ‖ bytes. */
export function sshString(value: string | Uint8Array): Uint8Array {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return concat([u32be(bytes.length), bytes]);
}

/** A cursor over a wire blob that refuses to read past the end rather than returning short reads. */
class Reader {
  private at = 0;
  private readonly buf: Uint8Array;
  // Written out rather than as a parameter property: `erasableSyntaxOnly` is on,
  // and a parameter property is TypeScript that emits runtime code.
  constructor(buf: Uint8Array) {
    this.buf = buf;
  }
  get remaining(): number {
    return this.buf.length - this.at;
  }
  take(n: number): Uint8Array | null {
    if (n < 0 || this.at + n > this.buf.length) return null;
    const out = this.buf.subarray(this.at, this.at + n);
    this.at += n;
    return out;
  }
  u32(): number | null {
    const b = this.take(4);
    if (b === null) return null;
    return ((b[0] ?? 0) * 0x1000000 + ((b[1] ?? 0) << 16) + ((b[2] ?? 0) << 8) + (b[3] ?? 0)) >>> 0;
  }
  string(): Uint8Array | null {
    const len = this.u32();
    if (len === null) return null;
    return this.take(len);
  }
}

const utf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

// ── public key handling ─────────────────────────────────────────────────────

/**
 * Parse one `authorized_keys`-style line into its wire blob.
 *
 * Accepts the exact shape committed under `maintainers/`: `ssh-ed25519 <base64> [comment...]`,
 * with or without a trailing comment. Returns `null` for anything else — including
 * other algorithms, which is a refusal and not an oversight: this module verifies
 * ed25519 and says so rather than half-supporting RSA.
 */
export function parseSshPublicKeyLine(line: string): { blob: Uint8Array; comment: string } | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return null;
  const parts = trimmed.split(/\s+/);
  const [algo, b64] = parts;
  if (algo !== SSH_ED25519 || b64 === undefined) return null;
  let blob: Uint8Array;
  try {
    blob = new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
  // The base64 must decode to a well-formed `ssh-ed25519` blob; a truncated or
  // mistyped key must not become a roster entry that can never match anything.
  const r = new Reader(blob);
  const declared = r.string();
  const key = r.string();
  if (declared === null || key === null || r.remaining !== 0) return null;
  if (utf8(declared) !== SSH_ED25519 || key.length !== ED25519_RAW_PUBLIC_KEY_LENGTH) return null;
  return { blob, comment: parts.slice(2).join(" ") };
}

/** `SHA256:<unpadded base64 of sha256(wire blob)>` — byte-identical to `ssh-keygen -lf`. */
export function sshFingerprint(publicKeyBlob: Uint8Array): string {
  const digest = createHash("sha256").update(publicKeyBlob).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
}

/** Wrap a raw 32-byte ed25519 key in SPKI DER so `node:crypto` will take it. */
function ed25519PublicKeyFromRaw(raw: Uint8Array): ReturnType<typeof createPublicKey> {
  // SPKI prefix for id-Ed25519 (RFC 8410 §4): SEQUENCE(SEQUENCE(OID 1.3.101.112), BIT STRING).
  const prefix = Uint8Array.from([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
  return createPublicKey({ key: Buffer.from(concat([prefix, raw])), format: "der", type: "spki" });
}

// ── signature parsing ───────────────────────────────────────────────────────

/**
 * Strip PEM-style armor from `ssh-keygen -Y sign` output, yielding single-line base64.
 *
 * Git trailers are line-oriented, so a receipt carries the unarmored single line.
 * Input that is already a single line passes through unchanged, so callers need not
 * know which form they hold.
 */
export function unarmor(text: string): string {
  const t = text.trim();
  if (!t.startsWith(ARMOR_BEGIN)) return t.replace(/\s+/g, "");
  const start = t.indexOf(ARMOR_BEGIN) + ARMOR_BEGIN.length;
  const end = t.indexOf(ARMOR_END);
  const body = end < 0 ? t.slice(start) : t.slice(start, end);
  return body.replace(/\s+/g, "");
}

/** Re-apply PEM armor at OpenSSH's 70-column wrap, so output round-trips through `ssh-keygen -Y verify`. */
export function armor(base64Blob: string): string {
  const wrapped = (base64Blob.match(/.{1,70}/g) ?? []).join("\n");
  return `${ARMOR_BEGIN}\n${wrapped}\n${ARMOR_END}\n`;
}

/** Parse an SSHSIG blob (armored or single-line base64). Structure only — no cryptography. */
export function parseSshSig(text: string): SshSigParseResult {
  const b64 = unarmor(text);
  let blob: Uint8Array;
  try {
    blob = new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return { ok: false, reason: "malformed-base64" };
  }
  // Buffer.from is lenient: it drops invalid characters instead of throwing. Re-encoding
  // and comparing is what actually catches a corrupted blob, so do that rather than
  // trusting the decode to have failed.
  if (Buffer.from(blob).toString("base64").replace(/=+$/, "") !== b64.replace(/=+$/, "")) {
    return { ok: false, reason: "malformed-base64" };
  }

  const r = new Reader(blob);
  const magic = r.take(MAGIC.length);
  if (magic === null) return { ok: false, reason: "truncated" };
  if (utf8(magic) !== MAGIC) return { ok: false, reason: "bad-magic" };

  const version = r.u32();
  if (version === null) return { ok: false, reason: "truncated" };
  if (version !== SIG_VERSION) return { ok: false, reason: "unsupported-version" };

  const publicKeyBlob = r.string();
  const namespaceBytes = r.string();
  const reserved = r.string();
  const hashAlgBytes = r.string();
  const signatureBlob = r.string();
  if (
    publicKeyBlob === null ||
    namespaceBytes === null ||
    reserved === null ||
    hashAlgBytes === null ||
    signatureBlob === null
  ) {
    return { ok: false, reason: "truncated" };
  }
  if (r.remaining !== 0) return { ok: false, reason: "trailing-bytes" };
  if (reserved.length !== 0) return { ok: false, reason: "reserved-not-empty" };

  const namespace = utf8(namespaceBytes);
  if (namespace.length === 0) return { ok: false, reason: "empty-namespace" };

  const hashAlgorithm = utf8(hashAlgBytes);
  if (hashAlgorithm !== "sha256" && hashAlgorithm !== "sha512") {
    return { ok: false, reason: "unsupported-hash-algorithm" };
  }

  const kr = new Reader(publicKeyBlob);
  const keyAlgo = kr.string();
  const rawPublicKey = kr.string();
  if (keyAlgo === null || rawPublicKey === null || kr.remaining !== 0) return { ok: false, reason: "truncated" };
  if (utf8(keyAlgo) !== SSH_ED25519) return { ok: false, reason: "unsupported-key-algorithm" };
  if (rawPublicKey.length !== ED25519_RAW_PUBLIC_KEY_LENGTH) return { ok: false, reason: "bad-key-length" };

  const sr = new Reader(signatureBlob);
  const sigAlgo = sr.string();
  const signature = sr.string();
  if (sigAlgo === null || signature === null || sr.remaining !== 0) return { ok: false, reason: "truncated" };
  if (utf8(sigAlgo) !== SSH_ED25519) return { ok: false, reason: "unsupported-signature-algorithm" };
  if (signature.length !== ED25519_SIGNATURE_LENGTH) return { ok: false, reason: "bad-signature-length" };

  return {
    ok: true,
    sig: {
      publicKeyBlob: new Uint8Array(publicKeyBlob),
      rawPublicKey: new Uint8Array(rawPublicKey),
      namespace,
      hashAlgorithm,
      signature: new Uint8Array(signature),
      fingerprint: sshFingerprint(publicKeyBlob),
    },
  };
}

/** The blob SSHSIG actually signs: `MAGIC ‖ namespace ‖ reserved ‖ hash_algorithm ‖ H(message)`. */
export function sshSigSignedBlob(namespace: string, hashAlgorithm: "sha256" | "sha512", message: Uint8Array): Uint8Array {
  const digest = new Uint8Array(createHash(hashAlgorithm).update(Buffer.from(message)).digest());
  return concat([
    new TextEncoder().encode(MAGIC),
    sshString(namespace),
    sshString(new Uint8Array(0)),
    sshString(hashAlgorithm),
    sshString(digest),
  ]);
}

/**
 * Verify an SSHSIG over `message` under `expectedNamespace`.
 *
 * The namespace is a REQUIRED argument on purpose: a verifier that accepted whatever
 * namespace the signature carried would let a signature made for `git` (commit signing)
 * count as an attestation, which is exactly the cross-protocol replay SSHSIG's namespace
 * field exists to stop. Refusing on mismatch is what makes the field mean something.
 *
 * Identity is NOT decided here — the caller must still match `result.fingerprint`
 * against a roster. A valid signature by an unknown key is a valid signature by an
 * unknown key.
 */
export function verifySshSig(text: string, message: Uint8Array, expectedNamespace: string): SshSigVerifyResult {
  const parsed = parseSshSig(text);
  if (!parsed.ok) return parsed;
  const sig = parsed.sig;
  if (sig.namespace !== expectedNamespace) return { ok: false, reason: "namespace-mismatch" };
  const blob = sshSigSignedBlob(sig.namespace, sig.hashAlgorithm, message);
  let verified = false;
  try {
    verified = nodeVerify(null, Buffer.from(blob), ed25519PublicKeyFromRaw(sig.rawPublicKey), Buffer.from(sig.signature));
  } catch {
    verified = false; // malformed key/sig bytes are a refusal, never a throw
  }
  if (!verified) return { ok: false, reason: "bad-signature" };
  return { ok: true, fingerprint: sig.fingerprint, namespace: sig.namespace };
}

// ── roster ──────────────────────────────────────────────────────────────────

export interface RosterEntry {
  readonly fingerprint: string;
  readonly comment: string;
  /** Where this key was read from — so a verdict can name its own evidence. */
  readonly source: string;
}

/** Parse an `authorized_keys` / `ssh-pubkeys.txt` file body into roster entries. */
export function parseRoster(body: string, source: string): readonly RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const line of body.split("\n")) {
    const parsed = parseSshPublicKeyLine(line);
    if (parsed === null) continue;
    out.push({ fingerprint: sshFingerprint(parsed.blob), comment: parsed.comment, source });
  }
  return out;
}

/** The roster entry for a fingerprint, or `null`. Exact match only — no prefix matching. */
export function findRosterEntry(roster: readonly RosterEntry[], fingerprint: string): RosterEntry | null {
  return roster.find((e) => e.fingerprint === fingerprint) ?? null;
}
