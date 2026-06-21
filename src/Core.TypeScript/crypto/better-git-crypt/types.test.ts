/**
 * tools/crypto/better-git-crypt/types.test.ts
 *
 * 081KSNY2Z0008QG0R002JKH50A v1 PoC — invariant tests for declarative type substrate.
 *
 * Run via: bun test tools/crypto/better-git-crypt/
 */

import { describe, expect, it } from "bun:test";
import {
  ALG_REGISTRY,
  determineEncryptionPath,
  findAlg,
  validateAlgRegistry,
  validateEnvelopeStructure,
  validateEncryptionContext,
  type FileEnvelope,
  type EncryptionContext,
  type RecipientKey,
} from "./types";

describe("081KSNY2Z0008QG0R002JKH50A v1 alg registry invariants", () => {
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

  it("multi-cipher hedge alternates present (081KSNY2Z0008QG0R002ZAVMEK deferred)", () => {
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

describe("081KSNY2Z0008QG0R002JKH50A v1 envelope structure invariants", () => {
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
    contentNonce: new Uint8Array(12),
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

describe("081KSNY2Z0008QG0R002JKH50A v1 encryption context validation", () => {
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

describe("081KSNY2Z0008QG0R002JKH50A determineEncryptionPath discriminator", () => {
  // Substantive workflow-engine-parallel substrate-engineering work per
  // Aaron 3-lane substrate-check (Amara ferry §33.2 PR #5757) + standing
  // PoC permission. Structurally parallel to PR #5758 determineReviewLevel
  // at encryption-substrate scope.
  const makeKey = (identity: string): RecipientKey => ({
    identity,
    kemAlgId: "ML-KEM-768+X25519",
    sigAlgId: "ML-DSA-65",
    publicKemKey: new Uint8Array([1, 2, 3]),
    publicSigKey: new Uint8Array([4, 5, 6]),
    seedSource: "random-bytes",
    composesWith: [],
  });

  it("plans v1 path for single-recipient self-encrypt scenario", () => {
    const key = makeKey("solo@zeta");
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array([0, 1, 2]),
      recipients: [key],
      sender: key,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path.algKem).toBe("ML-KEM-768+X25519");
      expect(result.path.algSig).toBe("ML-DSA-65");
      expect(result.path.algKdf).toBe("HKDF-SHA256");
      expect(result.path.algWrap).toBe("ChaCha20-Poly1305-AEAD");
      expect(result.path.algContent).toBe("ChaCha20-Poly1305-AEAD");
      expect(result.path.recipientCount).toBe(1);
      expect(result.path.senderIdentity).toBe("solo@zeta");
    }
  });

  it("plans v1 path for multi-recipient with sender included", () => {
    const sender = makeKey("sender@zeta");
    const r2 = makeKey("recipient2@zeta");
    const r3 = makeKey("recipient3@zeta");
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array([1, 2, 3, 4]),
      recipients: [sender, r2, r3],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path.recipientCount).toBe(3);
    }
  });

  it("returns EmptyRecipientSet for empty recipients", () => {
    const sender = makeKey("sender@zeta");
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback.kind).toBe("EmptyRecipientSet");
    }
  });

  it("returns SenderNotInRecipientSet when sender absent from recipients", () => {
    const sender = makeKey("absent@zeta");
    const other = makeKey("other@zeta");
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [other],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback.kind).toBe("SenderNotInRecipientSet");
      if (result.feedback.kind === "SenderNotInRecipientSet") {
        expect(result.feedback.senderIdentity).toBe("absent@zeta");
      }
    }
  });

  it("returns RecipientKeyInvalid when KEM algs differ across recipients (v1 single-KEM constraint)", () => {
    const sender = makeKey("sender@zeta");
    const mixedKem: RecipientKey = {
      ...makeKey("mixed@zeta"),
      kemAlgId: "Saber", // different from the sender's ML-KEM-768+X25519
    };
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [sender, mixedKem],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback.kind).toBe("RecipientKeyInvalid");
      if (result.feedback.kind === "RecipientKeyInvalid") {
        expect(result.feedback.identity).toBe("mixed@zeta");
        expect(result.feedback.reason).toMatch(/v1 requires single KEM/);
      }
    }
  });

  it("returns AlgUnsupported for deferred-alternate KEM (e.g. Saber)", () => {
    const sender = { ...makeKey("sender@zeta"), kemAlgId: "Saber" };
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [sender],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback.kind).toBe("AlgUnsupported");
      if (result.feedback.kind === "AlgUnsupported") {
        expect(result.feedback.algId).toBe("Saber");
      }
    }
  });

  it("returns AlgUnsupported for unknown KEM alg id", () => {
    const sender = { ...makeKey("sender@zeta"), kemAlgId: "NONEXISTENT-KEM" };
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [sender],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback.kind).toBe("AlgUnsupported");
    }
  });

  it("returns AlgUnsupported for unknown signature alg id", () => {
    const sender = { ...makeKey("sender@zeta"), sigAlgId: "NONEXISTENT-SIG" };
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [sender],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.feedback.kind).toBe("AlgUnsupported");
      if (result.feedback.kind === "AlgUnsupported") {
        expect(result.feedback.algId).toBe("NONEXISTENT-SIG");
      }
    }
  });

  it("planned path composesWith 081KSNY2Z0008QG0R003WFDCJ9 (structurally parallel substrate-engineering)", () => {
    const sender = makeKey("sender@zeta");
    const ctx: EncryptionContext = {
      plaintext: new Uint8Array(0),
      recipients: [sender],
      sender,
      seedSource: "random-bytes",
    };
    const result = determineEncryptionPath(ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path.composesWith).toContain("081KSNY2Z0008QG0R003WFDCJ9");
      expect(result.path.composesWith).toContain("081KSNY2Z0008QG0R002JKH50A");
    }
  });
});
