// zeta-creds-crypto.test.ts — 081KSKBP80008QG0R003AX2A69.1 acceptance tests.
//
// Validates the threat-model claims in zeta-creds-crypto.ts:
//   - Round-trip: plaintext survives encrypt → decrypt with same (UUID, passphrase)
//   - Wrong passphrase: decrypt returns error (not garbled plaintext)
//   - Wrong UUID (copy-to-different-USB attack): decrypt returns error
//   - Tampered ciphertext: GCM auth tag rejects
//   - Tampered tag: GCM auth tag rejects
//   - Tampered salt: key derives differently → auth tag rejects
//   - HKDF determinism: same inputs → same key
//   - Salt + IV freshness: encrypt is non-deterministic per call

import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  IV_LEN, KEY_LEN, SALT_LEN, TAG_LEN,
  decrypt, deriveKey, deriveKeyFromBindingMaterial, encrypt,
  type Envelope,
} from "./zeta-creds-crypto";

const UUID = "9e8d7c6b-5a49-3827-1605-fedcba987654";
const ALT_UUID = "00000000-0000-0000-0000-000000000000";
const PASS = "correct horse battery staple";
const WRONG_PASS = "Tr0ub4dor&3";
// Test fixture uses non-token-prefix strings so secret-scanners don't fire
// false-positive alerts (no "ghp_" / "gho_" / "ghu_" / "sk-" etc. prefixes).
const PT = Buffer.from(
  JSON.stringify({
    gh: { token: "TEST-FIXTURE-NOT-A-REAL-TOKEN-deadbeef-cafebabe" },
    claude: { credentials: "TEST-FIXTURE-NOT-REAL" },
    persona: "otto",
  }),
);

describe("deriveKey", () => {
  it("returns 32-byte AES-256 key", () => {
    const salt = randomBytes(SALT_LEN);
    const key = deriveKey(UUID, PASS, salt);
    expect(key.length).toBe(KEY_LEN);
  });

  it("is deterministic for fixed inputs", () => {
    const salt = randomBytes(SALT_LEN);
    const a = deriveKey(UUID, PASS, salt);
    const b = deriveKey(UUID, PASS, salt);
    expect(a.equals(b)).toBe(true);
  });

  it("differs when UUID differs (binds to USB)", () => {
    const salt = randomBytes(SALT_LEN);
    const a = deriveKey(UUID, PASS, salt);
    const b = deriveKey(ALT_UUID, PASS, salt);
    expect(a.equals(b)).toBe(false);
  });

  it("differs when passphrase differs", () => {
    const salt = randomBytes(SALT_LEN);
    const a = deriveKey(UUID, PASS, salt);
    const b = deriveKey(UUID, WRONG_PASS, salt);
    expect(a.equals(b)).toBe(false);
  });

  it("differs when salt differs", () => {
    const s1 = randomBytes(SALT_LEN);
    const s2 = randomBytes(SALT_LEN);
    const a = deriveKey(UUID, PASS, s1);
    const b = deriveKey(UUID, PASS, s2);
    expect(a.equals(b)).toBe(false);
  });

  it("rejects wrong-length salt", () => {
    expect(() => deriveKey(UUID, PASS, randomBytes(16))).toThrow();
  });
});

describe("encrypt", () => {
  it("returns envelope with correct field sizes", () => {
    const env = encrypt(PT, UUID, PASS);
    expect(env.salt.length).toBe(SALT_LEN);
    expect(env.iv.length).toBe(IV_LEN);
    expect(env.tag.length).toBe(TAG_LEN);
    expect(env.ciphertext.length).toBe(PT.length); // GCM is stream cipher mode → same length
  });

  it("is non-deterministic across calls (fresh salt + IV per call)", () => {
    const a = encrypt(PT, UUID, PASS);
    const b = encrypt(PT, UUID, PASS);
    expect(Buffer.from(a.salt).equals(Buffer.from(b.salt))).toBe(false);
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });
});

describe("decrypt — happy path", () => {
  it("round-trips plaintext with correct UUID + passphrase", () => {
    const env = encrypt(PT, UUID, PASS);
    const result = decrypt(env, UUID, PASS);
    if ("error" in result) throw new Error(`unexpected error: ${result.error}`);
    expect(result.equals(PT)).toBe(true);
  });

  it("handles empty plaintext", () => {
    const env = encrypt(Buffer.alloc(0), UUID, PASS);
    const result = decrypt(env, UUID, PASS);
    if ("error" in result) throw new Error(`unexpected error: ${result.error}`);
    expect(result.length).toBe(0);
  });

  it("handles large plaintext (1 MiB)", () => {
    const big = randomBytes(1024 * 1024);
    const env = encrypt(big, UUID, PASS);
    const result = decrypt(env, UUID, PASS);
    if ("error" in result) throw new Error(`unexpected error: ${result.error}`);
    expect(result.equals(big)).toBe(true);
  });
});

describe("decrypt — security rejections", () => {
  it("rejects wrong passphrase (returns error; not garbled plaintext)", () => {
    const env = encrypt(PT, UUID, PASS);
    const result = decrypt(env, UUID, WRONG_PASS);
    expect("error" in result).toBe(true);
  });

  it("rejects wrong UUID — defeats copy-to-different-USB attack", () => {
    const env = encrypt(PT, UUID, PASS);
    const result = decrypt(env, ALT_UUID, PASS);
    expect("error" in result).toBe(true);
  });

  it("rejects tampered ciphertext (single byte flip)", () => {
    const env = encrypt(PT, UUID, PASS);
    const tampered: Envelope = {
      salt: env.salt,
      iv: env.iv,
      tag: env.tag,
      ciphertext: flipByte(env.ciphertext, 0),
    };
    const result = decrypt(tampered, UUID, PASS);
    expect("error" in result).toBe(true);
  });

  it("rejects tampered tag", () => {
    const env = encrypt(PT, UUID, PASS);
    const tampered: Envelope = {
      salt: env.salt,
      iv: env.iv,
      tag: flipByte(env.tag, 0),
      ciphertext: env.ciphertext,
    };
    const result = decrypt(tampered, UUID, PASS);
    expect("error" in result).toBe(true);
  });

  it("rejects tampered salt (key derives differently)", () => {
    const env = encrypt(PT, UUID, PASS);
    const tampered: Envelope = {
      salt: flipByte(env.salt, 0),
      iv: env.iv,
      tag: env.tag,
      ciphertext: env.ciphertext,
    };
    const result = decrypt(tampered, UUID, PASS);
    expect("error" in result).toBe(true);
  });

  it("rejects wrong IV length", () => {
    const env = encrypt(PT, UUID, PASS);
    const malformed: Envelope = {
      salt: env.salt,
      iv: randomBytes(8), // wrong size
      tag: env.tag,
      ciphertext: env.ciphertext,
    };
    const result = decrypt(malformed, UUID, PASS);
    expect("error" in result).toBe(true);
  });

  it("rejects wrong tag length", () => {
    const env = encrypt(PT, UUID, PASS);
    const malformed: Envelope = {
      salt: env.salt,
      iv: env.iv,
      tag: randomBytes(8), // wrong size
      ciphertext: env.ciphertext,
    };
    const result = decrypt(malformed, UUID, PASS);
    expect("error" in result).toBe(true);
  });

  it("rejects wrong salt length (returns error; not throws)", () => {
    const env = encrypt(PT, UUID, PASS);
    const malformed: Envelope = {
      salt: randomBytes(16), // wrong size — deriveKey would throw if called
      iv: env.iv,
      tag: env.tag,
      ciphertext: env.ciphertext,
    };
    const result = decrypt(malformed, UUID, PASS);
    // Must return structured error (locks in the no-throw contract for callers).
    expect("error" in result).toBe(true);
  });
});

/**
 * THE DEGENERATE-BINDING-MATERIAL GUARD.
 *
 * Found 2026-08-01 by mutation sweep, not by reading: flipping `bindingMaterial.length === 0`
 * to `=== 1` in zeta-creds-crypto.ts left the whole installer suite green. The guard was
 * unreachable by any test, which means it was load-bearing and unproven at the same time.
 *
 * Why it is load-bearing. The USB claim is "keys are USB- and machine-specific, useless on
 * other devices." That property comes from ONE place: binding material entering the HKDF ikm
 * as `bindingMaterial | stretched`. With empty binding material the ikm degenerates to
 * `"" | stretched` — a key derived from the passphrase ALONE, identical on every machine on
 * earth. The device binding silently disappears while every round-trip test still passes,
 * because a passphrase-only key encrypts and decrypts perfectly well. It just does it
 * everywhere.
 *
 * So this guard is the difference between "device-bound" and "portable", and the failure it
 * prevents is invisible to every test that only checks round-tripping. Both directions are
 * pinned below: the guard REFUSES empty material, and non-empty material genuinely changes
 * the key (otherwise refusing empty input would be theatre).
 */
describe("binding material is load-bearing, not decorative", () => {
  it("REFUSES empty binding material rather than deriving a passphrase-only key", () => {
    const salt = randomBytes(SALT_LEN);
    expect(() => deriveKeyFromBindingMaterial("", PASS, salt)).toThrow(/non-empty/);
  });

  it("binding material actually enters the key — one differing char changes it", () => {
    // If this failed, the guard above would be guarding nothing: material would be accepted
    // and then ignored, which is the same portable-key outcome by a different route.
    const salt = randomBytes(SALT_LEN);
    const a = deriveKeyFromBindingMaterial(UUID, PASS, salt);
    const b = deriveKeyFromBindingMaterial(ALT_UUID, PASS, salt);
    expect(a.equals(b)).toBe(false);
  });

  it("a one-character binding material is accepted — the guard is length-0, not length-1", () => {
    // Pins the boundary the surviving mutant moved. `=== 1` would reject "x" and, worse,
    // ACCEPT "" — exactly backwards.
    const salt = randomBytes(SALT_LEN);
    expect(() => deriveKeyFromBindingMaterial("x", PASS, salt)).not.toThrow();
  });

  it("still enforces salt length on the binding-material entrypoint", () => {
    expect(() => deriveKeyFromBindingMaterial(UUID, PASS, randomBytes(16))).toThrow();
  });
});

function flipByte(buf: Uint8Array, index: number): Buffer {
  const copy = Buffer.from(buf);
  copy[index] = copy[index]! ^ 0x01;
  return copy;
}
