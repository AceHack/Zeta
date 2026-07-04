// OpenSSH PROTOCOL.certkeys encoder — Ed25519 user certificates (081KWPHRNE).
// Pure wire format: builds the cert blob, exposes the signable prefix, attaches a
// signature (from frostThresholdSign or any Ed25519 signer). No private keys here.
//
// Anchors: OpenSSH PROTOCOL.certkeys; RFC4251 string/uint encodings; RFC8032 Ed25519.
// Monorepo tools-over-trunks: persona-keys beside frost.ts / ca.ts.

export const SSH_ED25519_CERT_TYPE = "ssh-ed25519-cert-v01@openssh.com";
export const SSH_CERT_TYPE_USER = 1;
export const SSH_CERT_TYPE_HOST = 2;

/** Default user-cert extensions matching `ssh-keygen -s` defaults. */
export const DEFAULT_USER_EXTENSIONS: readonly string[] = [
  "permit-X11-forwarding",
  "permit-agent-forwarding",
  "permit-port-forwarding",
  "permit-pty",
  "permit-user-rc",
];

export interface OpenSshEd25519CertRequest {
  /** 32-byte device public key (raw RFC8032). */
  readonly devicePublicKey: Uint8Array;
  /** 32-byte CA group public key (raw RFC8032). */
  readonly caPublicKey: Uint8Array;
  /** Cert Key ID (`-I`), machine-only for N+M. */
  readonly keyId: string;
  /** Principals (`-n`), e.g. ["aaron"]. */
  readonly principals: readonly string[];
  /** Unix seconds; default now. */
  readonly validAfter?: number;
  /** Unix seconds; default validAfter + 52 weeks. */
  readonly validBefore?: number;
  readonly serial?: bigint;
  /** 16–32 random bytes; generated if omitted. */
  readonly nonce?: Uint8Array;
  readonly extensions?: readonly string[];
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function encodeUint32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

function encodeUint64(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  const v = new DataView(b.buffer);
  v.setUint32(0, Number((n >> 32n) & 0xffffffffn), false);
  v.setUint32(4, Number(n & 0xffffffffn), false);
  return b;
}

/** RFC4251 string: uint32 BE length + bytes. */
export function encodeSshString(data: Uint8Array | string): Uint8Array {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return concatBytes(encodeUint32(bytes.length), bytes);
}

/** Encode a list of strings as a single SSH string (used for principals). */
export function encodeSshNameList(names: readonly string[]): Uint8Array {
  const parts = names.map((n) => encodeSshString(n));
  return encodeSshString(concatBytes(...parts));
}

/** Encode critical-options / extensions name list (empty data per name). */
export function encodeSshOptions(names: readonly string[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const name of names) {
    parts.push(encodeSshString(name));
    parts.push(encodeSshString(new Uint8Array(0)));
  }
  return encodeSshString(concatBytes(...parts));
}

/** OpenSSH public key blob for an Ed25519 key (not the authorized_keys line). */
export function encodeSshEd25519PublicKeyBlob(pk32: Uint8Array): Uint8Array {
  if (pk32.length !== 32) throw new Error("openssh-cert: Ed25519 public key must be 32 bytes");
  return concatBytes(encodeSshString("ssh-ed25519"), encodeSshString(pk32));
}

/** authorized_keys / TrustedUserCAKeys line for an Ed25519 public key. */
export function formatSshEd25519PublicKeyLine(pk32: Uint8Array, comment = ""): string {
  const blob = encodeSshEd25519PublicKeyBlob(pk32);
  const b64 = Buffer.from(blob).toString("base64");
  return comment.length > 0 ? `ssh-ed25519 ${b64} ${comment}\n` : `ssh-ed25519 ${b64}\n`;
}

/** SSH signature blob for Ed25519 (string "ssh-ed25519" + string 64-byte sig). */
export function encodeSshEd25519Signature(sig64: Uint8Array): Uint8Array {
  if (sig64.length !== 64) throw new Error("openssh-cert: Ed25519 signature must be 64 bytes");
  return concatBytes(encodeSshString("ssh-ed25519"), encodeSshString(sig64));
}

/**
 * Build the signable cert prefix (all fields through signature key, exclusive of signature).
 * Caller signs this with the CA (frostThresholdSign) and passes the 64-byte sig to finalize.
 */
export function buildEd25519UserCertSignable(req: OpenSshEd25519CertRequest): {
  readonly signable: Uint8Array;
  readonly nonce: Uint8Array;
} {
  if (req.devicePublicKey.length !== 32) {
    throw new Error("openssh-cert: device public key must be 32 bytes");
  }
  if (req.caPublicKey.length !== 32) {
    throw new Error("openssh-cert: CA public key must be 32 bytes");
  }
  if (req.principals.length === 0) {
    throw new Error("openssh-cert: principals must be non-empty");
  }

  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(req.validAfter ?? now);
  const validBefore = BigInt(req.validBefore ?? now + 52 * 7 * 24 * 3600);
  const serial = req.serial ?? 0n;
  const nonce = req.nonce ?? cryptoGetRandom(32);
  const extensions = req.extensions ?? DEFAULT_USER_EXTENSIONS;

  const signable = concatBytes(
    encodeSshString(SSH_ED25519_CERT_TYPE),
    encodeSshString(nonce),
    encodeSshString(req.devicePublicKey),
    encodeUint64(serial),
    encodeUint32(SSH_CERT_TYPE_USER),
    encodeSshString(req.keyId),
    encodeSshNameList(req.principals),
    encodeUint64(validAfter),
    encodeUint64(validBefore),
    encodeSshOptions([]), // critical options
    encodeSshOptions(extensions),
    encodeSshString(new Uint8Array(0)), // reserved
    encodeSshString(encodeSshEd25519PublicKeyBlob(req.caPublicKey)),
  );
  return { signable, nonce };
}

/** Attach a 64-byte Ed25519 signature to a signable prefix → full cert wire blob. */
export function finalizeEd25519UserCert(signable: Uint8Array, signature64: Uint8Array): Uint8Array {
  return concatBytes(signable, encodeSshString(encodeSshEd25519Signature(signature64)));
}

/** authorized_keys-style cert line. */
export function formatSshEd25519CertLine(certBlob: Uint8Array, comment = ""): string {
  const b64 = Buffer.from(certBlob).toString("base64");
  return comment.length > 0
    ? `${SSH_ED25519_CERT_TYPE} ${b64} ${comment}\n`
    : `${SSH_ED25519_CERT_TYPE} ${b64}\n`;
}

/** Parse `ssh-ed25519 AAAA... [comment]` → 32-byte public key. */
export function parseSshEd25519PublicKeyLine(line: string): Uint8Array {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2 || parts[0] !== "ssh-ed25519") {
    throw new Error("openssh-cert: expected ssh-ed25519 public key line");
  }
  const blob = Buffer.from(parts[1]!, "base64");
  // blob = string "ssh-ed25519" + string pk32
  let o = 0;
  const readString = (): Uint8Array => {
    if (o + 4 > blob.length) throw new Error("openssh-cert: truncated public key blob");
    const len = blob.readUInt32BE(o);
    o += 4;
    const s = blob.subarray(o, o + len);
    o += len;
    return new Uint8Array(s);
  };
  const type = new TextDecoder().decode(readString());
  if (type !== "ssh-ed25519") throw new Error(`openssh-cert: unexpected key type ${type}`);
  const pk = readString();
  if (pk.length !== 32) throw new Error("openssh-cert: pk length not 32");
  return pk;
}

/** Parse OpenSSH `-V` style validity into [after, before] unix seconds (relative to now). */
export function parseValidityWindow(spec: string, nowSec = Math.floor(Date.now() / 1000)): {
  readonly validAfter: number;
  readonly validBefore: number;
} {
  // Support "+52w", "+1d", "+12h", "+30m" (ssh-keygen relative form).
  const m = /^\+(\d+)([wdhm])$/.exec(spec.trim());
  if (!m) {
    throw new Error(`openssh-cert: unsupported validity ${JSON.stringify(spec)} (want +N[wdhm])`);
  }
  const n = Number(m[1]);
  const unit = m[2]!;
  const mult =
    unit === "w" ? 7 * 24 * 3600 : unit === "d" ? 24 * 3600 : unit === "h" ? 3600 : 60;
  return { validAfter: nowSec, validBefore: nowSec + n * mult };
}

function cryptoGetRandom(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}
