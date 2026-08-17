// derive-pq.test.ts — 081KVNYZXQ608QG0R002G35565.
//
// The central test in this file is "EXHAUSTIVE: every declared type either returns
// the algorithm it was asked for, or throws". That is the anti-silent-degradation
// property: a caller asking for a PQ type must never receive a classical key.
//
// ON TEST VECTORS — stated plainly so nothing here is over-claimed:
//   • The length assertions are checked against the PUBLISHED parameter sizes in
//     NIST FIPS 203 (ML-KEM-768: ek 1184, dk 2400, ct 1088) and FIPS 204 (ML-DSA-65:
//     pk 1952, sk 4032, sig 3309). Those are published constants, not KATs.
//   • The byte-lock vectors below are SELF-GENERATED. They prove determinism and
//     catch regression in OUR derivation (path, HKDF label, expansion length). They
//     prove NOTHING about the correctness of ML-DSA / ML-KEM themselves — that is
//     @noble/post-quantum's ACVP conformance, upstream, and is not re-litigated here.
//   • No KAT from FIPS 203/204 is reproduced in this file. Do not read these vectors
//     as standards conformance.
import { test, expect } from "bun:test";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  derivePqKey,
  declaredKeyTypes,
  implementedKeyTypes,
  statusOf,
  pqPath,
  KEY_TYPE_REGISTRY,
} from "./derive-pq.ts";
import { deriveKeyring } from "./derive.ts";

// Standard published BIP-39 test mnemonic (all-zero entropy, 24 words). A test seed
// by construction — never a live key.
const M =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon " +
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

const hex = (u: Uint8Array) => Buffer.from(u).toString("hex");

// ── THE CARDINAL REFUSAL ─────────────────────────────────────────────────────

test("EXHAUSTIVE: every declared type either returns the algorithm requested, or throws — never a substitute", () => {
  // The whole point. If any declared type returned a key of a DIFFERENT algorithm,
  // a caller would hold protection it does not have. Walk all of them.
  let returned = 0;
  let refused = 0;
  for (const id of declaredKeyTypes()) {
    let key: ReturnType<typeof derivePqKey> | undefined;
    try {
      key = derivePqKey(M, id);
    } catch {
      refused++;
      continue;
    }
    returned++;
    expect(key.algorithm).toBe(id); // produced == requested, always
    // The label alone is NOT sufficient: a silent fallback that keeps the requested
    // name would pass the line above. So assert the MATERIAL is PQ-scale and matches
    // the registry's verified lengths. A 32-byte classical key cannot survive this.
    const entry = KEY_TYPE_REGISTRY.find((e) => e.id === id);
    expect(entry?.keygen).toBeDefined(); // only implemented types may return at all
    expect(key.secretKey.length).toBeGreaterThan(32);
    if (entry?.lengths !== undefined) {
      expect(key.publicKey.length).toBe(entry.lengths.publicKey);
      expect(key.secretKey.length).toBe(entry.lengths.secretKey);
    }
  }
  expect(returned).toBe(implementedKeyTypes().length);
  expect(returned + refused).toBe(declaredKeyTypes().length);
  expect(refused).toBeGreaterThan(0); // the refusal path is actually exercised
});

test("an UNKNOWN key type is REFUSED — no classical fallback, no undefined", () => {
  expect(() => derivePqKey(M, "ml-dsa-9000")).toThrow(/unknown key type/);
  expect(() => derivePqKey(M, "ed25519")).toThrow(/unknown key type/);
  expect(() => derivePqKey(M, "")).toThrow(/unknown key type/);
  // The refusal must name the alternatives rather than silently picking one.
  expect(() => derivePqKey(M, "nope")).toThrow(/NOT derived/);
});

test("a DECLARED-BUT-UNIMPLEMENTED type is REFUSED, not silently downgraded", () => {
  // x-wing is a hybrid the registry knows about and cannot produce. Asking for a
  // hybrid and receiving anything at all would be the dangerous case.
  expect(() => derivePqKey(M, "x-wing")).toThrow(/declared but NOT implemented/);
  expect(() => derivePqKey(M, "slh-dsa")).toThrow(/declared but NOT implemented/);
});

test("an EXPERIMENTAL type is REFUSED even though it is in the registry", () => {
  expect(() => derivePqKey(M, "adinkra-experimental")).toThrow(/experimental-unproven/);
  expect(() => derivePqKey(M, "adinkra-experimental")).toThrow(/never be sole protection/i);
});

test("no PQ derivation ever returns classical keyring bytes (the degradation it must not do)", () => {
  const classical = deriveKeyring(M, "zeta").full;
  const classicalMaterial = new Set(
    [classical.eth.privkey.replace(/^0x/, ""), classical.btc.priv_hex, classical.nostr.pub_hex].map((s) =>
      s.toLowerCase(),
    ),
  );
  for (const id of implementedKeyTypes()) {
    const k = derivePqKey(M, id);
    expect(classicalMaterial.has(hex(k.publicKey))).toBe(false);
    expect(classicalMaterial.has(hex(k.secretKey))).toBe(false);
    // A classical secp256k1/ed25519 key is 32 bytes; every implemented PQ key is far larger.
    expect(k.secretKey.length).toBeGreaterThan(32);
  }
});

test("statusOf is DERIVED from the registry, so a status string cannot lie", () => {
  for (const e of KEY_TYPE_REGISTRY) {
    const s = statusOf(e);
    if (s === "implemented") expect(e.keygen).toBeDefined();
    if (s === "declared-not-implemented") expect(e.keygen).toBeUndefined();
    // experimental wins regardless of keygen presence
    if (e.neverSoleProtection === true) expect(s).toBe("experimental-unproven");
  }
  expect(implementedKeyTypes()).toEqual(["ml-dsa-65", "ml-kem-768"]);
});

// ── WHAT IS ACTUALLY IMPLEMENTED ─────────────────────────────────────────────

test("ML-DSA-65 derives at published FIPS 204 sizes and is deterministic", () => {
  const a = derivePqKey(M, "ml-dsa-65");
  const b = derivePqKey(M, "ml-dsa-65");
  expect(a.publicKey.length).toBe(1952); // FIPS 204 published pk size
  expect(a.secretKey.length).toBe(4032); // FIPS 204 published sk size
  expect(a.family).toBe("signature");
  expect(a.path).toBe(pqPath(1120));
  expect(hex(a.publicKey)).toBe(hex(b.publicKey));
  expect(hex(a.secretKey)).toBe(hex(b.secretKey));
});

test("ML-KEM-768 derives at published FIPS 203 sizes and is deterministic", () => {
  const a = derivePqKey(M, "ml-kem-768");
  const b = derivePqKey(M, "ml-kem-768");
  expect(a.publicKey.length).toBe(1184); // FIPS 203 published ek size
  expect(a.secretKey.length).toBe(2400); // FIPS 203 published dk size
  expect(a.family).toBe("kem");
  expect(hex(a.publicKey)).toBe(hex(b.publicKey));
});

test("derived ML-DSA-65 material actually signs and verifies (a seed-expansion bug would break this)", () => {
  const k = derivePqKey(M, "ml-dsa-65");
  const msg = new TextEncoder().encode("zeta pq keychain");
  const sig = ml_dsa65.sign(msg, k.secretKey);
  expect(sig.length).toBe(3309); // FIPS 204 published signature size
  expect(ml_dsa65.verify(sig, msg, k.publicKey)).toBe(true);
  expect(ml_dsa65.verify(sig, new TextEncoder().encode("tampered"), k.publicKey)).toBe(false);
});

test("derived ML-KEM-768 material actually encapsulates and decapsulates to the same secret", () => {
  const k = derivePqKey(M, "ml-kem-768");
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(k.publicKey);
  expect(cipherText.length).toBe(1088); // FIPS 203 published ciphertext size
  expect(hex(ml_kem768.decapsulate(cipherText, k.secretKey))).toBe(hex(sharedSecret));
});

test("key types are path- and label-separated: no bleed between types", () => {
  const sig = derivePqKey(M, "ml-dsa-65");
  const kem = derivePqKey(M, "ml-kem-768");
  expect(sig.path).not.toBe(kem.path);
  expect(hex(sig.publicKey)).not.toBe(hex(kem.publicKey));
  const coins = KEY_TYPE_REGISTRY.map((e) => e.coin);
  expect(new Set(coins).size).toBe(coins.length); // no duplicate coin indices
});

test("a different mnemonic yields different PQ keys (the seed is actually the input)", () => {
  const other =
    "legal winner thank year wave sausage worth useful legal winner thank year wave sausage " +
    "worth useful legal winner thank year wave sausage worth title";
  expect(hex(derivePqKey(M, "ml-dsa-65").publicKey)).not.toBe(hex(derivePqKey(other, "ml-dsa-65").publicKey));
});

test("an invalid mnemonic is refused before any key is derived", () => {
  expect(() => derivePqKey("not a mnemonic", "ml-dsa-65")).toThrow(/invalid\/empty mnemonic/);
  expect(() => derivePqKey("", "ml-dsa-65")).toThrow(/invalid\/empty mnemonic/);
});

// ── SELF-GENERATED BYTE-LOCK (regression only — NOT standards conformance) ────

// SELF-GENERATED, produced by this code against the published BIP-39 all-zero-entropy
// test mnemonic. NOT NIST KATs. They lock OUR derivation choices (path, HKDF label
// `zeta/pq/<id>/v1`, expansion length) — changing any of those silently re-keys every
// derived PQ identity, so it should fail loudly right here.
const SELF_GENERATED_ML_DSA_65_PK_SHA256 =
  "054a5ca81bc8ea59ae4ffd542aacca876fe7120f3d46ad889dc681385ceb39fd";
const SELF_GENERATED_ML_KEM_768_PK_SHA256 =
  "6f7d0f11aa1742b1ddb008f97218e1c4086e24f6852687ab2ffb0ff3a6aaee74";

test("SELF-GENERATED byte-lock: derivation is stable across runs", () => {
  const sha = (u: Uint8Array) => hex(sha256(u));
  expect(sha(derivePqKey(M, "ml-dsa-65").publicKey)).toBe(SELF_GENERATED_ML_DSA_65_PK_SHA256);
  expect(sha(derivePqKey(M, "ml-kem-768").publicKey)).toBe(SELF_GENERATED_ML_KEM_768_PK_SHA256);
});

test("the classical keyring is UNCHANGED by this work (golden-vector regression guard)", () => {
  // derive.ts is byte-locked by golden-vectors-keyring.json and compared as an exact
  // JSON string. PQ derivation is additive and opt-in precisely so that lock holds.
  const pub = deriveKeyring(M, "zeta").pub;
  expect(Object.keys(pub).sort()).toEqual(["btc", "eth", "nostr", "pgp", "sol", "ssh", "user"]);
});
