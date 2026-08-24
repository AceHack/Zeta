// Zeta SSH CERTIFICATE CENSUS — the EVIDENCE half of the CA trust-set closing bound.
//
// WHY THIS EXISTS. `rotate.ts` keeps a retiring CA's PUBLIC key in `TrustedUserCAKeys` so certs it
// already signed keep verifying (the overlap window). Union-forever would make that safe and turn
// every retired CA into a PERMANENT trust root — the opposite defect. A closing bound therefore
// needs a checkable fact, not a timer: *does any UNEXPIRED certificate still name this CA as its
// signer?* That fact is written in the certificates themselves, so this module reads it out of them.
//
// PURE, NO SUBPROCESS. `ssh-keygen -L` would answer the same question by shelling out and parsing
// English. This parses the OpenSSH certificate wire format directly, so the census is a pure
// function of (cert text, now) — deterministic, DST-replayable, and injectable in tests. The parse
// is CHECKED rather than asserted: `ssh-cert-census.test.ts` runs it against certificates signed by
// a real `ssh-keygen -s` and requires it to agree with `ssh-keygen -L` field for field. A parser
// nobody differentially tested is a guess with a type.
//
// FAIL-CLOSED IS THE WHOLE POINT. Every uncertainty widens the retained set, never narrows it:
//   * a certificate whose key type this module does not know       -> `ok:false`, census INCOMPLETE
//   * a certificate that does not parse                            -> `ok:false`, census INCOMPLETE
//   * an INCOMPLETE census                                          -> NOTHING may be dropped
//   * a certificate with no expiry (`valid forever`)               -> counted as UNEXPIRED forever
// The asymmetry is deliberate: retaining a CA too long costs trust-root surface, dropping one too
// early costs a fleet its access during the incident that motivated the rotation.
//
// NO SECRET MATERIAL CROSSES THIS BOUNDARY. Certificates and public keys are public by
// construction; nothing here opens a private key path, and nothing here prints key bytes — a CA is
// named by its SHA256 fingerprint, which is exactly what `sshd` compares and what `ssh-keygen -l`
// prints.
//
// Anchors (Beacon): OpenSSH `PROTOCOL.certkeys` (the certificate wire format and the field order
// parsed below); RFC 4251 §5 (the SSH `string` / `uint32` / `uint64` wire encodings); `ssh-keygen(1)`
// `-l` (SHA256 fingerprints, base64 with padding stripped) and `-L`; `sshd(8)` `TrustedUserCAKeys`
// (the set a certificate's signing CA must appear in). NIST SP 800-57 Part 1 §5.3.6 — a key's
// retention is bounded by the lifetime of what it protected, which is the rule implemented here.
import { createHash } from "node:crypto";

/** The certificate key types whose subject-key fields this module knows how to SKIP. The value is
 *  the number of length-prefixed blobs that sit between the `nonce` and the `serial` — every one of
 *  them is wire-encoded as an SSH `string`, so skipping is uniform once the count is known.
 *  A type absent from this table is REFUSED (fail-closed), never guessed at. */
const SUBJECT_FIELD_COUNTS: ReadonlyMap<string, number> = new Map([
  ["ssh-ed25519-cert-v01@openssh.com", 1], // pk
  ["sk-ssh-ed25519-cert-v01@openssh.com", 2], // pk, application
  ["ssh-rsa-cert-v01@openssh.com", 2], // e, n
  ["ssh-dss-cert-v01@openssh.com", 4], // p, q, g, y
  ["ecdsa-sha2-nistp256-cert-v01@openssh.com", 2], // curve, public_key
  ["ecdsa-sha2-nistp384-cert-v01@openssh.com", 2],
  ["ecdsa-sha2-nistp521-cert-v01@openssh.com", 2],
  ["sk-ecdsa-sha2-nistp256-cert-v01@openssh.com", 3], // curve, public_key, application
]);

/** OpenSSH's "no expiry" sentinel for `valid before` (0xFFFFFFFFFFFFFFFF). */
const FOREVER = 0xffffffffffffffffn;

/** The public facts a census needs out of a certificate. PUBLIC ONLY — a certificate is a public
 *  artifact and a fingerprint is a hash of a public key. */
export interface SshCertificateFacts {
  /** The certificate key type (`ssh-ed25519-cert-v01@openssh.com`). */
  readonly certType: string;
  /** The `-I` key id. In Zeta's N+M model this is the MACHINE id alone (never `user@machine`). */
  readonly keyId: string;
  /** The `-n` principals (the authorized users). */
  readonly principals: readonly string[];
  /** `valid after`, unix seconds. */
  readonly validAfter: number;
  /** `valid before`, unix seconds; `Number.POSITIVE_INFINITY` for OpenSSH's "forever" sentinel. */
  readonly validBefore: number;
  /** SHA256 fingerprint of the CA public key that signed this certificate — the value `sshd`
   *  looks for in `TrustedUserCAKeys`, and the join key of the whole census. */
  readonly signingCaFingerprint: string;
}

export type SshCertificateParse =
  | { readonly ok: true; readonly facts: SshCertificateFacts }
  | { readonly ok: false; readonly reason: string };

// ── SSH wire reader (RFC 4251 §5) ────────────────────────────────────────────────────────────────

class WireReader {
  private offset = 0;
  private readonly buf: Uint8Array;
  // Explicit field assignment rather than a parameter property: `erasableSyntaxOnly` is on.
  constructor(buf: Uint8Array) {
    this.buf = buf;
  }
  get exhausted(): boolean {
    return this.offset >= this.buf.length;
  }
  uint32(): number {
    if (this.offset + 4 > this.buf.length) throw new Error("truncated uint32");
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.offset, 4);
    this.offset += 4;
    return view.getUint32(0, false);
  }
  uint64(): bigint {
    if (this.offset + 8 > this.buf.length) throw new Error("truncated uint64");
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.offset, 8);
    this.offset += 8;
    return view.getBigUint64(0, false);
  }
  /** An SSH `string`: a uint32 length followed by that many raw bytes. */
  bytes(): Uint8Array {
    const len = this.uint32();
    if (this.offset + len > this.buf.length) throw new Error("truncated string");
    const out = this.buf.subarray(this.offset, this.offset + len);
    this.offset += len;
    return out;
  }
  text(): string {
    return new TextDecoder().decode(this.bytes());
  }
  skipStrings(n: number): void {
    for (let i = 0; i < n; i++) this.bytes();
  }
}

/** OpenSSH's SHA256 fingerprint of a raw public-key blob: `SHA256:` + unpadded base64 of the digest.
 *  This is byte-identical to what `ssh-keygen -l` prints, which the test suite checks differentially. */
function fingerprintOfBlob(blob: Uint8Array): string {
  const digest = createHash("sha256").update(blob).digest("base64");
  return "SHA256:" + digest.replace(/=+$/, "");
}

/**
 * The SHA256 fingerprint of an SSH PUBLIC KEY LINE (`ssh-ed25519 AAAAC3... comment`) or of a bare
 * base64 blob. Pure: no subprocess, no filesystem. Throws on input that is not decodable as a key
 * blob — a caller in the trust path must not silently fingerprint junk into a set.
 */
export function sshPublicKeyFingerprint(pubLineOrBlob: string): string {
  const fields = pubLineOrBlob.trim().split(/\s+/);
  const b64 = (fields.length >= 2 ? fields[1] : fields[0]) ?? "";
  if (b64.length === 0) throw new Error("sshPublicKeyFingerprint: empty input");
  const blob = Uint8Array.from(Buffer.from(b64, "base64"));
  if (blob.length === 0) throw new Error("sshPublicKeyFingerprint: input is not base64 key material");
  // Sanity: the blob must self-describe its type in its first SSH string, or it is not a key.
  try {
    const declared = new WireReader(blob).text();
    if (declared.length === 0) throw new Error("empty type");
  } catch {
    throw new Error("sshPublicKeyFingerprint: input is not an SSH key blob");
  }
  return fingerprintOfBlob(blob);
}

/**
 * Parse an OpenSSH certificate (`<type> <base64> [comment]`) into the public facts a trust-set
 * census needs. PURE. Never throws — an unparseable or unknown-type certificate returns
 * `ok:false` so the caller can treat it as evidence it does not have (fail-closed), rather than as
 * evidence of absence.
 */
export function parseSshCertificate(certText: string): SshCertificateParse {
  const fields = certText.trim().split(/\s+/);
  if (fields.length < 2) return { ok: false, reason: "not a certificate line (need '<type> <base64>')" };
  const declaredType = fields[0]!;
  const subjectFields = SUBJECT_FIELD_COUNTS.get(declaredType);
  if (subjectFields === undefined) {
    return { ok: false, reason: `unknown certificate key type '${declaredType}' — refusing to guess its field layout` };
  }
  let blob: Uint8Array;
  try {
    blob = Uint8Array.from(Buffer.from(fields[1]!, "base64"));
  } catch {
    return { ok: false, reason: "certificate body is not base64" };
  }
  try {
    const r = new WireReader(blob);
    const embeddedType = r.text();
    if (embeddedType !== declaredType) {
      return { ok: false, reason: `type mismatch: line says '${declaredType}', blob says '${embeddedType}'` };
    }
    r.bytes(); // nonce
    r.skipStrings(subjectFields); // the certified subject key's fields
    r.uint64(); // serial
    r.uint32(); // type (1=user, 2=host)
    const keyId = r.text();
    const principals = readNameList(r.bytes());
    const validAfter = r.uint64();
    const validBefore = r.uint64();
    r.bytes(); // critical options
    r.bytes(); // extensions
    r.bytes(); // reserved
    const signatureKey = r.bytes(); // THE CA PUBLIC KEY — the census join key
    if (signatureKey.length === 0) return { ok: false, reason: "certificate carries no signature key" };
    return {
      ok: true,
      facts: {
        certType: declaredType,
        keyId,
        principals,
        validAfter: Number(validAfter),
        validBefore: validBefore === FOREVER ? Number.POSITIVE_INFINITY : Number(validBefore),
        signingCaFingerprint: fingerprintOfBlob(signatureKey),
      },
    };
  } catch (e: unknown) {
    return { ok: false, reason: `malformed certificate: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** An SSH name-list nested inside a `string`: a sequence of length-prefixed strings. */
function readNameList(blob: Uint8Array): readonly string[] {
  const r = new WireReader(blob);
  const out: string[] = [];
  while (!r.exhausted) out.push(r.text());
  return out;
}

// ── The census ───────────────────────────────────────────────────────────────────────────────────

/** One certificate's contribution to the census. `parsed:false` is the fail-closed case. */
export interface CensusEntry {
  readonly path: string;
  readonly parsed: boolean;
  /** Present iff `parsed`. */
  readonly signingCaFingerprint?: string;
  /** Present iff `parsed`. `Infinity` means the certificate never expires. */
  readonly validBefore?: number;
  /** Present iff `parsed`. */
  readonly unexpired?: boolean;
  /** Present iff NOT `parsed` — why this certificate could not be counted. */
  readonly reason?: string;
}

/** The evidence a closing-bound decision is allowed to stand on. */
export interface CertificateCensus {
  /** The instant the expiry comparison was made against (injected — never an ambient clock). */
  readonly nowEpochSeconds: number;
  readonly entries: readonly CensusEntry[];
  /** True iff EVERY certificate found was parsed. False ⇒ NOTHING may be dropped. */
  readonly complete: boolean;
  /** How many certificate files were found at all. Zero is NOT evidence of absence — a mistyped
   *  `--repo-root` and an estate with no certificates are indistinguishable from here. */
  readonly certificatesFound: number;
  /** CA fingerprints that at least one UNEXPIRED certificate still names as its signer. */
  readonly unexpiredSigners: readonly string[];
}

/**
 * Build the census from certificate TEXTS. Pure: the caller supplies the texts (through its own
 * effects door) and the instant to compare against (`local-time-never-enters-the-shared-fold` —
 * a node's wall clock may steer a LOCAL action such as "is this certificate stale to me", and this
 * is exactly that; no shared fold consumes it).
 */
export function censusOfCertificates(
  certs: readonly { readonly path: string; readonly text: string }[],
  nowEpochSeconds: number,
): CertificateCensus {
  const entries: CensusEntry[] = [];
  const unexpired = new Set<string>();
  for (const c of certs) {
    const parsed = parseSshCertificate(c.text);
    if (!parsed.ok) {
      entries.push({ path: c.path, parsed: false, reason: parsed.reason });
      continue;
    }
    const isUnexpired = parsed.facts.validBefore > nowEpochSeconds;
    entries.push({
      path: c.path,
      parsed: true,
      signingCaFingerprint: parsed.facts.signingCaFingerprint,
      validBefore: parsed.facts.validBefore,
      unexpired: isUnexpired,
    });
    if (isUnexpired) unexpired.add(parsed.facts.signingCaFingerprint);
  }
  return {
    nowEpochSeconds,
    entries,
    complete: entries.every((e) => e.parsed),
    certificatesFound: entries.length,
    unexpiredSigners: [...unexpired].sort(),
  };
}
