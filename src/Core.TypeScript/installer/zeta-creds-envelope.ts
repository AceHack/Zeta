// zeta-creds-envelope.ts — wire-format serializer for 081KSKBP80008QG0R003AX2A69 cred-persistence blob.
//
// 081KSKBP80008QG0R003AX2A69 sub-row .2a (envelope serialization layer). Pure functions; no I/O.
// Composes with:
//   - tools/installer/zeta-creds-crypto.ts (081KSKBP80008QG0R003AX2A69.1; produces/consumes Envelope)
//   - tools/installer/zeta-creds-manifest.ts (081KSKBP80008QG0R003AX2A69.5; per-cred entries)
//   - tools/installer/zeta-cred-handlers.ts (081KSKBP80008QG0R003AX2A69.10; per-cred value handlers)
//   - tools/installer/zeta-creds-persist.ts (081KSKBP80008QG0R003AX2A69.2b; writes to ESP)
//   - tools/installer/zeta-creds-restore.ts (081KSKBP80008QG0R003AX2A69.2b; reads from ESP)
//
// Wire format (binary; little-endian; v1):
//
//   Header (8 bytes):
//     magic        : 4 bytes  "ZCV1"  (zeta-creds v1; magic-number sanity check)
//     reserved     : 4 bytes  zero    (future flags / version bumps)
//
//   Envelope (variable; from 081KSKBP80008QG0R003AX2A69.1 crypto):
//     salt_len     : 2 bytes  uint16le  (always 32; explicit for forward-compat)
//     salt         : <salt_len> bytes
//     iv_len       : 2 bytes  uint16le  (always 12)
//     iv           : <iv_len> bytes
//     tag_len      : 2 bytes  uint16le  (always 16)
//     tag          : <tag_len> bytes
//     ciphertext_len : 4 bytes  uint32le
//     ciphertext   : <ciphertext_len> bytes
//
// Inner plaintext (after decryption) is a separate concern (CredBundle); this
// module only handles the on-disk envelope frame.
//
// Why explicit length-prefixed framing rather than JSON serialization:
//   - Binary blob can't accidentally leak via cat/grep on the ESP
//   - Length-prefixed format is forward-compat (future fields prepend without
//     breaking older readers that ignore unknown trailing bytes — though v1
//     readers reject extra bytes; v2 will need explicit version field bump)
//   - 8-byte header gives clear file-type identification for forensics

import type { Envelope } from "./zeta-creds-crypto";

/** Magic 4-byte header identifying a Zeta Creds v1 blob. */
export const MAGIC = Buffer.from("ZCV1", "ascii");

/** Header length: magic (4) + reserved (4) = 8 bytes. */
export const HEADER_LEN = 8;

/**
 * Total minimum blob size (header + 4 length prefixes + 0-byte ciphertext).
 * AES-GCM permits empty plaintext/ciphertext, so the minimum includes a
 * 0-length ciphertext per Copilot review on PR #5422.
 */
export const MIN_BLOB_LEN = HEADER_LEN + 2 + 32 + 2 + 12 + 2 + 16 + 4;

/**
 * Serialize an Envelope to the on-disk wire format.
 *
 * @param env - the encryption envelope from 081KSKBP80008QG0R003AX2A69.1 encrypt()
 * @returns Buffer ready to write to /esp/zeta-creds.enc
 */
export function serializeEnvelope(env: Envelope): Buffer {
  const buffers: Buffer[] = [];

  // Header
  buffers.push(MAGIC);
  const reserved = Buffer.alloc(4);
  buffers.push(reserved); // zero-filled

  // Salt
  const saltLen = Buffer.alloc(2);
  saltLen.writeUInt16LE(env.salt.length, 0);
  buffers.push(saltLen);
  buffers.push(Buffer.from(env.salt));

  // IV
  const ivLen = Buffer.alloc(2);
  ivLen.writeUInt16LE(env.iv.length, 0);
  buffers.push(ivLen);
  buffers.push(Buffer.from(env.iv));

  // Tag
  const tagLen = Buffer.alloc(2);
  tagLen.writeUInt16LE(env.tag.length, 0);
  buffers.push(tagLen);
  buffers.push(Buffer.from(env.tag));

  // Ciphertext
  const ctLen = Buffer.alloc(4);
  ctLen.writeUInt32LE(env.ciphertext.length, 0);
  buffers.push(ctLen);
  buffers.push(Buffer.from(env.ciphertext));

  return Buffer.concat(buffers);
}

/**
 * Parse a wire-format blob back into an Envelope. Returns structured error
 * on any framing issue (substrate-honest: failure IS a value).
 */
export function parseEnvelope(blob: Buffer): Envelope | { readonly error: string } {
  if (blob.length < MIN_BLOB_LEN) {
    return { error: `blob too small: ${blob.length} bytes < ${MIN_BLOB_LEN} minimum` };
  }

  // Validate magic
  if (!blob.subarray(0, 4).equals(MAGIC)) {
    return {
      error: `invalid magic header; expected "ZCV1", got bytes ${Array.from(blob.subarray(0, 4))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`,
    };
  }

  let offset = HEADER_LEN;

  // Helper: read length-prefixed bytes
  function readLenPrefixed(prefixSize: 2 | 4, what: string): Buffer | { error: string } {
    if (offset + prefixSize > blob.length) {
      return { error: `blob truncated reading ${what} length prefix at offset ${offset}` };
    }
    const len = prefixSize === 2 ? blob.readUInt16LE(offset) : blob.readUInt32LE(offset);
    offset += prefixSize;
    if (offset + len > blob.length) {
      return { error: `blob truncated reading ${what} payload (${len} bytes) at offset ${offset}` };
    }
    const data = blob.subarray(offset, offset + len);
    offset += len;
    return Buffer.from(data);
  }

  const salt = readLenPrefixed(2, "salt");
  if ("error" in salt) return salt;

  const iv = readLenPrefixed(2, "iv");
  if ("error" in iv) return iv;

  const tag = readLenPrefixed(2, "tag");
  if ("error" in tag) return tag;

  const ciphertext = readLenPrefixed(4, "ciphertext");
  if ("error" in ciphertext) return ciphertext;

  // v1: extra trailing bytes are an error (future versions may relax)
  if (offset !== blob.length) {
    return { error: `unexpected trailing bytes after envelope: ${blob.length - offset} bytes` };
  }

  return { salt, iv, tag, ciphertext };
}

/**
 * Inner plaintext shape (post-decryption): a map of cred-id → bytes, with
 * persona-scoped credentials nested under each persona's section.
 *
 * Serialized as JSON for the plaintext layer (envelope wraps + encrypts this).
 *
 * Schema:
 *   {
 *     schemaVersion: 1,
 *     globalCreds: { "<id>": <base64-bytes>, ... },
 *     personaCreds: { "<persona>": { "<id>": <base64-bytes>, ... }, ... }
 *   }
 *
 * Per 081KSKBP80008QG0R003AX2A69.5 manifest: personaScoped=false entries go in globalCreds;
 * personaScoped=true entries go in personaCreds[<persona>][<id>].
 */
export interface CredBundle {
  readonly schemaVersion: 1;
  readonly globalCreds: Readonly<Record<string, Buffer>>;
  readonly personaCreds: Readonly<Record<string, Readonly<Record<string, Buffer>>>>;
}

/** JSON-serializable form of CredBundle (bytes base64-encoded). */
interface CredBundleJson {
  readonly schemaVersion: 1;
  readonly globalCreds: Readonly<Record<string, string>>;
  readonly personaCreds: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** Encode CredBundle → utf8 JSON bytes (the plaintext that gets encrypted). */
export function encodeBundle(bundle: CredBundle): Buffer {
  const jsonForm: CredBundleJson = {
    schemaVersion: 1,
    globalCreds: Object.fromEntries(Object.entries(bundle.globalCreds).map(([k, v]) => [k, v.toString("base64")])),
    personaCreds: Object.fromEntries(
      Object.entries(bundle.personaCreds).map(([persona, creds]) => [
        persona,
        Object.fromEntries(Object.entries(creds).map(([k, v]) => [k, v.toString("base64")])),
      ]),
    ),
  };
  return Buffer.from(JSON.stringify(jsonForm), "utf8");
}

/** Decode utf8 JSON bytes → CredBundle. Returns structured error on parse failure. */
export function decodeBundle(plaintext: Buffer): CredBundle | { readonly error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext.toString("utf8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `cred bundle JSON parse failed: ${msg}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "cred bundle must be a JSON object" };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.schemaVersion !== 1) {
    return { error: `cred bundle schemaVersion must be 1; got ${JSON.stringify(obj.schemaVersion)}` };
  }
  if (!isStringMap(obj.globalCreds)) {
    return { error: "cred bundle globalCreds must be { string: string } map" };
  }
  if (!isPersonaCredsMap(obj.personaCreds)) {
    return { error: "cred bundle personaCreds must be { string: { string: string } } map" };
  }

  const globalCreds: Record<string, Buffer> = {};
  for (const [k, v] of Object.entries(obj.globalCreds)) {
    globalCreds[k] = Buffer.from(v, "base64");
  }
  const personaCreds: Record<string, Record<string, Buffer>> = {};
  for (const [persona, creds] of Object.entries(obj.personaCreds)) {
    const personaSection: Record<string, Buffer> = {};
    for (const [k, v] of Object.entries(creds)) {
      personaSection[k] = Buffer.from(v, "base64");
    }
    personaCreds[persona] = personaSection;
  }

  return { schemaVersion: 1, globalCreds, personaCreds };
}

function isStringMap(v: unknown): v is Record<string, string> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (typeof val !== "string") return false;
  }
  return true;
}

function isPersonaCredsMap(v: unknown): v is Record<string, Record<string, string>> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (!isStringMap(val)) return false;
  }
  return true;
}
