/**
 * tools/crypto/better-git-crypt/types.test.ts
 *
 * B-0883 v1 PoC — invariant tests for declarative type substrate.
 *
 * Run via: bun test tools/crypto/better-git-crypt/
 */

import { describe, expect, it } from "bun:test";
import {
  ALG_REGISTRY,
  findAlg,
  validateAlgRegistry,
  validateEnvelopeStructure,
  validateEncryptionContext,
  type FileEnvelope,
  type EncryptionContext,
  type RecipientKey,
} from "./types";

describe("B-0883 v1 alg registry invariants", () => {
  it("registry has unique alg ids", () => {
    const ids = new Set(ALG_REGISTRY.map((a) => a.id));
    expect(ids.size).toBe(ALG_REGISTRY.length);
  });

  it("validateAlgRegistry passes on seed registry", () => {
    expect(() => validateAlgRegistry(ALG_REGISTRY)).not.toThrow();
  });

  it("XWing KEM ships v1", () => {
    const alg = findAlg("ML-KEM-768+X25519");
    expect(alg).toBeDefined();
    expect(alg?.status).toBe("ships-v1");
    expect(alg?.class).toBe("kem");
  });

  it("ML-DSA-65 signature ships v1", () => {
    const alg = findAlg("ML-DSA-65");
    expect(alg).toBeDefined();
    expect(alg?.status).toBe("ships-v1");
    expect(alg?.class).toBe("signature");
  });

  it("HKDF-SHA256 KDF ships v1", () => {
    const alg = findAlg("HKDF-SHA256");
    expect(alg).toBeDefined();
    expect(alg?.status).toBe("ships-v1");
    expect(alg?.class).toBe("kdf");
  });

  it("ChaCha20-Poly1305 AEAD ships v1", () => {
    const alg = findAlg("ChaCha20-Poly1305");
    expect(alg).toBeDefined();
    expect(alg?.status).toBe("ships-v1");
    expect(alg?.class).toBe("aead");
  });

  it("multi-cipher hedge alternates present (B-0883.2 deferred)", () => {
    expect(findAlg("Saber")?.status).toBe("deferred-alternate");
    expect(findAlg("NTRU-Prime")?.status).toBe("deferred-alternate");
    expect(findAlg("FrodoKEM")?.status).toBe("deferred-alternate");
  });

  it("validateAlgRegistry catches duplicate id", () => {
    const first = ALG_REGISTRY[0];
    if (!first) throw new Error("ALG_REGISTRY unexpectedly empty");
    const dup = [...ALG_REGISTRY, { ...first }];
    expect(() => validateAlgRegistry(dup)).toThrow(/duplicate algorithm id/);
  });

  it("validateAlgRegistry catches missing ships-v1 KEM", () => {
    const noKem = ALG_REGISTRY.filter((a) => !(a.class === "kem" && a.status === "ships-v1"));
    expect(() => validateAlgRegistry(noKem)).toThrow(/no ships-v1 algorithm of class kem/);
  });

  it("findAlg returns undefined for unknown id", () => {
    expect(findAlg("NONEXISTENT-ALG")).toBeUndefined();
  });
});

describe("B-0883 v1 envelope structure invariants", () => {
  const makeValidEnvelope = (): FileEnvelope => ({
    version: 1,
    context: "zeta.git-crypt.file.v1",
    algKem: "ML-KEM-768+X25519",
    algKdf: "HKDF-SHA256",
    algWrap: "ChaCha20-Poly1305-AEAD",
    algContent: "ChaCha20-Poly1305",
    algSig: "ML-DSA-65",
    recipients: [
      {
        identity: "test@zeta",
        kemCt: new Uint8Array(0),
        wrappedCek: new Uint8Array(0),
        kdfInfo: new Uint8Array(0),
      },
    ],
    ciphertext: new Uint8Array(0),
    signerIdentity: "test@zeta",
    signature: new Uint8Array(0),
  });

  it("validateEnvelopeStructure passes on valid envelope", () => {
    expect(() => validateEnvelopeStructure(makeValidEnvelope())).not.toThrow();
  });

  it("catches wrong version", () => {
    const env = { ...makeValidEnvelope(), version: 99 as unknown as 1 };
    expect(() => validateEnvelopeStructure(env)).toThrow(/unsupported envelope version/);
  });

  it("catches context mismatch", () => {
    const env = { ...makeValidEnvelope(), context: "wrong.context" };
    expect(() => validateEnvelopeStructure(env)).toThrow(/context mismatch/);
  });

  it("catches unknown KEM alg", () => {
    const env = { ...makeValidEnvelope(), algKem: "NONEXISTENT" };
    expect(() => validateEnvelopeStructure(env)).toThrow(/unknown algorithm/);
  });

  it("catches wrong-class algorithm reference", () => {
    const env = { ...makeValidEnvelope(), algKem: "ML-DSA-65" }; // signature in KEM slot
    expect(() => validateEnvelopeStructure(env)).toThrow(/class.*mismatch/);
  });

  it("catches empty recipient set", () => {
    const env = { ...makeValidEnvelope(), recipients: [] };
    expect(() => validateEnvelopeStructure(env)).toThrow(/empty recipient set/);
  });

  it("catches empty signerIdentity", () => {
    const env = { ...makeValidEnvelope(), signerIdentity: "" };
    expect(() => validateEnvelopeStructure(env)).toThrow(/empty signerIdentity/);
  });
});

describe("B-0883 v1 encryption context validation", () => {
  const makeKey = (identity: string): RecipientKey => ({
    identity,
    kemAlgId: "ML-KEM-768+X25519",
    sigAlgId: "ML-DSA-65",
    publicKemKey: new Uint8Array([1, 2, 3]),
    publicSigKey: new Uint8Array([4, 5, 6]),
    seedSource: "random-bytes",
    composesWith: [],
  });

  it("passes on valid context", () => {
    const key = makeKey("sender@zeta");
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array([0, 1, 2]),
      recipients: [key],
      sender: key,
      seedSource: "random-bytes",
    };
    expect(validateEncryptionContext(ctx, ALG_REGISTRY)).toBeUndefined();
  });

  it("catches empty recipient set", () => {
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [],
      sender: makeKey("s@zeta"),
      seedSource: "random-bytes",
    };
    const fb = validateEncryptionContext(ctx, ALG_REGISTRY);
    expect(fb?.kind).toBe("EmptyRecipientSet");
  });

  it("catches sender not in recipient set", () => {
    const sender = makeKey("sender@zeta");
    const other = makeKey("other@zeta");
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [other],
      sender,
      seedSource: "random-bytes",
    };
    const fb = validateEncryptionContext(ctx, ALG_REGISTRY);
    expect(fb?.kind).toBe("SenderNotInRecipientSet");
  });

  it("catches recipient with unsupported KEM alg", () => {
    const bad = { ...makeKey("bad@zeta"), kemAlgId: "NONEXISTENT" };
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [bad],
      sender: bad,
      seedSource: "random-bytes",
    };
    const fb = validateEncryptionContext(ctx, ALG_REGISTRY);
    expect(fb?.kind).toBe("AlgUnsupported");
  });

  it("catches recipient with empty publicKemKey", () => {
    const bad = { ...makeKey("bad@zeta"), publicKemKey: new Uint8Array(0) };
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [bad],
      sender: bad,
      seedSource: "random-bytes",
    };
    const fb = validateEncryptionContext(ctx, ALG_REGISTRY);
    expect(fb?.kind).toBe("RecipientKeyInvalid");
  });
});
