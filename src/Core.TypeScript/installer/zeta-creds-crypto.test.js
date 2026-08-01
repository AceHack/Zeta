import { describe, expect, it } from "bun:test";
import { randomBytes } from "node:crypto";
import { IV_LEN, KEY_LEN, SALT_LEN, TAG_LEN, decrypt, deriveKey, encrypt } from "./zeta-creds-crypto";
const UUID = "9e8d7c6b-5a49-3827-1605-fedcba987654", ALT_UUID = "00000000-0000-0000-0000-000000000000", PASS = "correct horse battery staple", WRONG_PASS = "Tr0ub4dor&3", PT = Buffer.from(JSON.stringify({
  gh: { token: "TEST-FIXTURE-NOT-A-REAL-TOKEN-deadbeef-cafebabe" },
  claude: { credentials: "TEST-FIXTURE-NOT-REAL" },
  persona: "otto"
}));
describe("deriveKey", () => {
  it("returns 32-byte AES-256 key", () => {
    const salt = randomBytes(SALT_LEN), key = deriveKey(UUID, PASS, salt);
    expect(key.length).toBe(KEY_LEN);
  });
  it("is deterministic for fixed inputs", () => {
    const salt = randomBytes(SALT_LEN), a = deriveKey(UUID, PASS, salt), b = deriveKey(UUID, PASS, salt);
    expect(a.equals(b)).toBe(!0);
  });
  it("differs when UUID differs (binds to USB)", () => {
    const salt = randomBytes(SALT_LEN), a = deriveKey(UUID, PASS, salt), b = deriveKey(ALT_UUID, PASS, salt);
    expect(a.equals(b)).toBe(!1);
  });
  it("differs when passphrase differs", () => {
    const salt = randomBytes(SALT_LEN), a = deriveKey(UUID, PASS, salt), b = deriveKey(UUID, WRONG_PASS, salt);
    expect(a.equals(b)).toBe(!1);
  });
  it("differs when salt differs", () => {
    const s1 = randomBytes(SALT_LEN), s2 = randomBytes(SALT_LEN), a = deriveKey(UUID, PASS, s1), b = deriveKey(UUID, PASS, s2);
    expect(a.equals(b)).toBe(!1);
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
    expect(env.ciphertext.length).toBe(PT.length);
  });
  it("is non-deterministic across calls (fresh salt + IV per call)", () => {
    const a = encrypt(PT, UUID, PASS), b = encrypt(PT, UUID, PASS);
    expect(Buffer.from(a.salt).equals(Buffer.from(b.salt))).toBe(!1);
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(!1);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(!1);
  });
});
describe("decrypt \u2014 happy path", () => {
  it("round-trips plaintext with correct UUID + passphrase", () => {
    const env = encrypt(PT, UUID, PASS), result = decrypt(env, UUID, PASS);
    if ("error" in result)
      throw Error(`unexpected error: ${result.error}`);
    expect(result.equals(PT)).toBe(!0);
  });
  it("handles empty plaintext", () => {
    const env = encrypt(Buffer.alloc(0), UUID, PASS), result = decrypt(env, UUID, PASS);
    if ("error" in result)
      throw Error(`unexpected error: ${result.error}`);
    expect(result.length).toBe(0);
  });
  it("handles large plaintext (1 MiB)", () => {
    const big = randomBytes(1048576), env = encrypt(big, UUID, PASS), result = decrypt(env, UUID, PASS);
    if ("error" in result)
      throw Error(`unexpected error: ${result.error}`);
    expect(result.equals(big)).toBe(!0);
  });
});
describe("decrypt \u2014 security rejections", () => {
  it("rejects wrong passphrase (returns error; not garbled plaintext)", () => {
    const env = encrypt(PT, UUID, PASS), result = decrypt(env, UUID, WRONG_PASS);
    expect("error" in result).toBe(!0);
  });
  it("rejects wrong UUID \u2014 defeats copy-to-different-USB attack", () => {
    const env = encrypt(PT, UUID, PASS), result = decrypt(env, ALT_UUID, PASS);
    expect("error" in result).toBe(!0);
  });
  it("rejects tampered ciphertext (single byte flip)", () => {
    const env = encrypt(PT, UUID, PASS), tampered = {
      salt: env.salt,
      iv: env.iv,
      tag: env.tag,
      ciphertext: flipByte(env.ciphertext, 0)
    }, result = decrypt(tampered, UUID, PASS);
    expect("error" in result).toBe(!0);
  });
  it("rejects tampered tag", () => {
    const env = encrypt(PT, UUID, PASS), tampered = {
      salt: env.salt,
      iv: env.iv,
      tag: flipByte(env.tag, 0),
      ciphertext: env.ciphertext
    }, result = decrypt(tampered, UUID, PASS);
    expect("error" in result).toBe(!0);
  });
  it("rejects tampered salt (key derives differently)", () => {
    const env = encrypt(PT, UUID, PASS), tampered = {
      salt: flipByte(env.salt, 0),
      iv: env.iv,
      tag: env.tag,
      ciphertext: env.ciphertext
    }, result = decrypt(tampered, UUID, PASS);
    expect("error" in result).toBe(!0);
  });
  it("rejects wrong IV length", () => {
    const env = encrypt(PT, UUID, PASS), malformed = {
      salt: env.salt,
      iv: randomBytes(8),
      tag: env.tag,
      ciphertext: env.ciphertext
    }, result = decrypt(malformed, UUID, PASS);
    expect("error" in result).toBe(!0);
  });
  it("rejects wrong tag length", () => {
    const env = encrypt(PT, UUID, PASS), malformed = {
      salt: env.salt,
      iv: env.iv,
      tag: randomBytes(8),
      ciphertext: env.ciphertext
    }, result = decrypt(malformed, UUID, PASS);
    expect("error" in result).toBe(!0);
  });
  it("rejects wrong salt length (returns error; not throws)", () => {
    const env = encrypt(PT, UUID, PASS), malformed = {
      salt: randomBytes(16),
      iv: env.iv,
      tag: env.tag,
      ciphertext: env.ciphertext
    }, result = decrypt(malformed, UUID, PASS);
    expect("error" in result).toBe(!0);
  });
});
function flipByte(buf, index) {
  const copy = Buffer.from(buf);
  copy[index] = copy[index] ^ 1;
  return copy;
}
