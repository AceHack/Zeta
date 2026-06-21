/**
 * tools/crypto/better-git-crypt/crypto.test.ts
 *
 * 081KSNY2Z0008QG0R002JKH50A v1 Phase 2 — WIRING + tamper-detection tests.
 *
 * SCOPE (do not overstate): these exercise the actual @noble post-quantum
 * primitives end-to-end and prove the API COMPOSES — encrypt→decrypt round
 * trips, multi-recipient, empty/large payloads — and that every typed failure
 * mode surfaces as Result feedback (tamper, wrong key, bad CBOR, version, etc).
 * They do NOT prove cryptographic CORRECTNESS: no Known-Answer-Tests against
 * Noble's published vectors, no formal verification of the envelope/key-handling
 * design, no security-ops review. Those are still REQUIRED before this holds
 * anything real — the crypto-don't-rush gate (README "Phase 2 operator
 * decisions"). A green wiring suite is necessary, not sufficient.
 *
 * Run via: bun test tools/crypto/better-git-crypt/crypto.test.ts
 */

import { describe, expect, it } from "bun:test";
import {
  generateRecipientKeyPair,
  encrypt,
  decrypt,
  encodeEnvelope,
  decodeEnvelope,
  type GeneratedKeyPair,
} from "./crypto";
import type { EncryptionContext } from "./types";
import { encode as cborEncode } from "cborg";

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const str = (b: Uint8Array): string => new TextDecoder().decode(b);

/** Build an EncryptionContext from generated keypairs. */
function ctxFor(plaintext: Uint8Array, sender: GeneratedKeyPair, recipients: GeneratedKeyPair[]): EncryptionContext {
  return {
    plaintext,
    recipients: recipients.map((r) => r.publicKey),
    sender: sender.publicKey,
    seedSource: "random-bytes",
  };
}

describe("081KSNY2Z0008QG0R002JKH50A v1 Phase 2 — keygen", () => {
  it("generates XWing + ML-DSA-65 keypair with expected public-key sizes", () => {
    const kp = generateRecipientKeyPair("sender@zeta");
    expect(kp.publicKey.identity).toBe("sender@zeta");
    expect(kp.publicKey.kemAlgId).toBe("ML-KEM-768+X25519");
    expect(kp.publicKey.sigAlgId).toBe("ML-DSA-65");
    expect(kp.publicKey.publicKemKey.length).toBe(1216); // XWing public key
    expect(kp.publicKey.publicSigKey.length).toBeGreaterThan(0); // ML-DSA-65 public key
    expect(kp.secretKeys.identity).toBe("sender@zeta");
    expect(kp.secretKeys.kemSecretKey.length).toBeGreaterThan(0);
    expect(kp.secretKeys.sigSecretKey.length).toBeGreaterThan(0);
  });

  it("two keypairs differ (fresh randomness)", () => {
    const a = generateRecipientKeyPair("a@zeta");
    const b = generateRecipientKeyPair("b@zeta");
    expect(Buffer.from(a.publicKey.publicKemKey).equals(Buffer.from(b.publicKey.publicKemKey))).toBe(false);
  });

  it("seed source is type-narrowed: an unsupported source is a COMPILE error, not a runtime throw", () => {
    // v1 narrows the param to the literal "random-bytes", so the unsupported
    // case is unrepresentable at compile time (Result-boundary by construction)
    // rather than a runtime exception. (Copilot P1 on PR #6217 — an exported
    // surface must not throw on a user-selectable option.) The @ts-expect-error
    // IS the assertion: if the param is ever widened, this line stops erroring
    // and the test fails, forcing a Result-shaped return at that point.
    // @ts-expect-error "adinkra-derived" is not assignable to "random-bytes"
    const kp = generateRecipientKeyPair("x@zeta", "adinkra-derived");
    expect(kp.publicKey.identity).toBe("x@zeta"); // no throw — keygen just proceeds
  });
});

describe("081KSNY2Z0008QG0R002JKH50A v1 Phase 2 — encrypt/decrypt round-trip", () => {
  it("single recipient (sender == recipient) round-trips", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const pt = utf8("the secret is in the wavefunction");
    const enc = encrypt(ctxFor(pt, sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decrypt(enc.envelope, sender.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(str(dec.plaintext)).toBe("the secret is in the wavefunction");
  });

  it("multi-recipient: every recipient (and the sender) can decrypt", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const recipientA = generateRecipientKeyPair("recipient-a@zeta");
    const recipientB = generateRecipientKeyPair("recipient-b@zeta");
    const pt = utf8("three-party shared secret");
    // sender (sender) must be in the recipient set for round-trip recovery
    const enc = encrypt(ctxFor(pt, sender, [sender, recipientA, recipientB]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(enc.envelope.recipients.length).toBe(3);

    for (const who of [sender, recipientA, recipientB]) {
      const dec = decrypt(enc.envelope, who.secretKeys, sender.publicKey.publicSigKey);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(str(dec.plaintext)).toBe("three-party shared secret");
    }
  });

  it("empty plaintext round-trips", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(new Uint8Array(0), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decrypt(enc.envelope, sender.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(true);
    if (dec.ok) expect(dec.plaintext.length).toBe(0);
  });

  it("larger binary payload round-trips byte-for-byte", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const pt = new Uint8Array(8192);
    for (let i = 0; i < pt.length; i++) pt[i] = (i * 37 + 11) & 0xff;
    const enc = encrypt(ctxFor(pt, sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decrypt(enc.envelope, sender.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(true);
    if (dec.ok) expect(Buffer.from(dec.plaintext).equals(Buffer.from(pt))).toBe(true);
  });
});

describe("081KSNY2Z0008QG0R002JKH50A v1 Phase 2 — encrypt failure modes (authored TFeedback)", () => {
  it("EmptyRecipientSet", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("x"), sender, []), sender.secretKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) expect(enc.feedback.kind).toBe("EmptyRecipientSet");
  });

  it("SenderNotInRecipientSet", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const recipientA = generateRecipientKeyPair("recipient-a@zeta");
    const enc = encrypt(ctxFor(utf8("x"), sender, [recipientA]), sender.secretKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) expect(enc.feedback.kind).toBe("SenderNotInRecipientSet");
  });

  it("RecipientKeyInvalid when sender secret-key identity mismatches", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const imposter = generateRecipientKeyPair("imposter@zeta");
    // context sender = sender, but pass imposter's secret keys
    const enc = encrypt(ctxFor(utf8("x"), sender, [sender]), imposter.secretKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) expect(enc.feedback.kind).toBe("RecipientKeyInvalid");
  });

  it("SeedSourceNotAvailable for non-random-bytes", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt({ ...ctxFor(utf8("x"), sender, [sender]), seedSource: "hsm-derived" }, sender.secretKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) expect(enc.feedback.kind).toBe("SeedSourceNotAvailable");
  });

  it("AlgUnsupported: rejects a non-ML-DSA-65 signature alg (no lying metadata)", () => {
    // SLH-DSA is deferred-alternate in the registry (not ships-v1), so the
    // planner rejects it; even if it weren't, crypto.ts only dispatches ml_dsa65,
    // so encrypt must reject rather than write an envelope whose algSig label
    // disagrees with the actual signature bytes. (Codex P2 finding on PR #6217.)
    const base = generateRecipientKeyPair("sender@zeta");
    const slhSender = { ...base.publicKey, sigAlgId: "SLH-DSA" };
    const ctx: EncryptionContext = {
      plaintext: utf8("x"),
      recipients: [slhSender],
      sender: slhSender,
      seedSource: "random-bytes",
    };
    const enc = encrypt(ctx, base.secretKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) {
      expect(enc.feedback.kind).toBe("AlgUnsupported");
      if (enc.feedback.kind === "AlgUnsupported") expect(enc.feedback.algId).toBe("SLH-DSA");
    }
  });

  it("RecipientKeyInvalid: sender secret key doesn't match declared public sig key", () => {
    // Right identity, WRONG sig key — encrypt self-verifies after signing and
    // must catch this at encrypt time rather than mint an undecryptable envelope.
    // (Copilot P1 finding on PR #6217.)
    const sender = generateRecipientKeyPair("sender@zeta");
    const other = generateRecipientKeyPair("other@zeta");
    const wrongKeys = {
      identity: sender.publicKey.identity, // same identity as the declared sender
      kemSecretKey: sender.secretKeys.kemSecretKey,
      sigSecretKey: other.secretKeys.sigSecretKey, // but a sig key that doesn't match sender's public sig key
    };
    const enc = encrypt(ctxFor(utf8("x"), sender, [sender]), wrongKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) expect(enc.feedback.kind).toBe("RecipientKeyInvalid");
  });

  it("RecipientKeyInvalid (not a throw) on a malformed sender publicSigKey", () => {
    // Noble's verify decoder throws on a truncated key — encrypt's self-verify
    // must catch it and return a Result, not throw. (Codex P2 on PR #6217.)
    const sender = generateRecipientKeyPair("sender@zeta");
    const malformedSender = { ...sender.publicKey, publicSigKey: new Uint8Array([1, 2, 3]) };
    const ctx: EncryptionContext = {
      plaintext: utf8("x"),
      recipients: [malformedSender],
      sender: malformedSender,
      seedSource: "random-bytes",
    };
    let threw = false;
    let result: ReturnType<typeof encrypt> | undefined;
    try {
      result = encrypt(ctx, sender.secretKeys);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result?.ok).toBe(false);
    if (result && !result.ok) expect(result.feedback.kind).toBe("RecipientKeyInvalid");
  });

  it("RecipientKeyInvalid: rejects duplicate recipient identities", () => {
    // Two slots for one identity would make decrypt's first-match resolution
    // skip a valid later slot -> spurious KemFailure. (Codex P2 on PR #6217.)
    const sender = generateRecipientKeyPair("sender@zeta");
    const dupeStale = { ...generateRecipientKeyPair("sender@zeta").publicKey }; // same identity, different keys
    const ctx: EncryptionContext = {
      plaintext: utf8("x"),
      recipients: [sender.publicKey, dupeStale],
      sender: sender.publicKey,
      seedSource: "random-bytes",
    };
    const enc = encrypt(ctx, sender.secretKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) expect(enc.feedback.kind).toBe("RecipientKeyInvalid");
  });

  it("RecipientKeyInvalid: rejects empty sender/recipient identity", () => {
    // generateRecipientKeyPair("") yields identity:"". Encrypting with it would
    // mint an envelope whose signerIdentity/slot id is "" — decrypt can't
    // resolve it later, so the artifact is undecryptable. Reject up front.
    // (Codex P2 on PR #6217.)
    const empty = generateRecipientKeyPair("");
    const ctx: EncryptionContext = {
      plaintext: utf8("x"),
      recipients: [empty.publicKey],
      sender: empty.publicKey,
      seedSource: "random-bytes",
    };
    const enc = encrypt(ctx, empty.secretKeys);
    expect(enc.ok).toBe(false);
    if (!enc.ok) {
      expect(enc.feedback.kind).toBe("RecipientKeyInvalid");
      if (enc.feedback.kind === "RecipientKeyInvalid") {
        expect(enc.feedback.reason).toBe("empty recipient identity");
      }
    }
  });

  it("RecipientKeyInvalid: rejects a sender KEM secret that can't unwrap its own slot", () => {
    // Right sender identity + right public keys + right SIG secret, but a
    // stale/mismatched KEM SECRET. Signature self-verify passes; without the
    // KEM-side self-check encrypt would mint an envelope the sender (a required
    // self-recipient) can't decrypt. (Codex P2 on PR #6217.)
    const sender = generateRecipientKeyPair("sender@zeta");
    const other = generateRecipientKeyPair("sender@zeta"); // different keys, same identity
    const mismatchedSecrets = { ...sender.secretKeys, kemSecretKey: other.secretKeys.kemSecretKey };
    const ctx: EncryptionContext = {
      plaintext: utf8("x"),
      recipients: [sender.publicKey],
      sender: sender.publicKey,
      seedSource: "random-bytes",
    };
    const enc = encrypt(ctx, mismatchedSecrets);
    expect(enc.ok).toBe(false);
    if (!enc.ok) {
      expect(enc.feedback.kind).toBe("RecipientKeyInvalid");
      if (enc.feedback.kind === "RecipientKeyInvalid") {
        expect(enc.feedback.reason).toContain("KEM secret");
      }
    }
  });
});

describe("081KSNY2Z0008QG0R002JKH50A v1 Phase 2 — decrypt failure modes (tamper detection)", () => {
  it("wrong recipient (not in envelope) -> RecipientNotInEnvelope", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const stranger = generateRecipientKeyPair("stranger@zeta");
    const enc = encrypt(ctxFor(utf8("secret"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decrypt(enc.envelope, stranger.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(false);
    if (!dec.ok) expect(dec.feedback.kind).toBe("RecipientNotInEnvelope");
  });

  it("tampered ciphertext -> SignatureInvalid (signature covers content)", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("secret"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const tampered = new Uint8Array(enc.envelope.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const dec = decrypt({ ...enc.envelope, ciphertext: tampered }, sender.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(false);
    if (!dec.ok) expect(dec.feedback.kind).toBe("SignatureInvalid");
  });

  it("tampered signature -> SignatureInvalid", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("secret"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const sig = new Uint8Array(enc.envelope.signature);
    sig[0] = (sig[0] ?? 0) ^ 0xff;
    const dec = decrypt({ ...enc.envelope, signature: sig }, sender.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(false);
    if (!dec.ok) expect(dec.feedback.kind).toBe("SignatureInvalid");
  });

  it("wrong sender public sig key -> SignatureInvalid", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const other = generateRecipientKeyPair("other@zeta");
    const enc = encrypt(ctxFor(utf8("secret"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decrypt(enc.envelope, sender.secretKeys, other.publicKey.publicSigKey);
    expect(dec.ok).toBe(false);
    if (!dec.ok) expect(dec.feedback.kind).toBe("SignatureInvalid");
  });

  it("recipient present but holding wrong KEM secret key -> KemFailure", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const recipientA = generateRecipientKeyPair("recipient-a@zeta");
    const enc = encrypt(ctxFor(utf8("secret"), sender, [sender, recipientA]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    // recipientA's slot exists, but supply a mismatched KEM secret key (sender's)
    const wrongKeys = {
      identity: "recipient-a@zeta",
      kemSecretKey: sender.secretKeys.kemSecretKey,
      sigSecretKey: recipientA.secretKeys.sigSecretKey,
    };
    const dec = decrypt(enc.envelope, wrongKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(false);
    if (!dec.ok) expect(dec.feedback.kind).toBe("KemFailure");
  });

  it("context mismatch -> ContextMismatch", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("secret"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    // decrypt checks context BEFORE structural validation + signature verify,
    // so a wrong context must surface the precise ContextMismatch feedback.
    const dec = decrypt({ ...enc.envelope, context: "wrong.ctx.v1" }, sender.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(false);
    if (!dec.ok) expect(dec.feedback.kind).toBe("ContextMismatch");
  });
});

describe("081KSNY2Z0008QG0R002JKH50A v1 Phase 2 — on-disk envelope CBOR codec", () => {
  it("encode/decode round-trips and the decoded envelope still decrypts", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const recipientA = generateRecipientKeyPair("recipient-a@zeta");
    const enc = encrypt(ctxFor(utf8("persisted to git, read later"), sender, [sender, recipientA]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const bytes = encodeEnvelope(enc.envelope);
    expect(bytes.length).toBeGreaterThan(0);

    const decoded = decodeEnvelope(bytes);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    // Field-level fidelity
    expect(decoded.envelope.context).toBe("zeta.git-crypt.file.v1");
    expect(decoded.envelope.recipients.length).toBe(2);
    expect(decoded.envelope.contentNonce.length).toBe(12);

    // The decoded envelope must still decrypt (proves the persist->observe bridge)
    const dec = decrypt(decoded.envelope, recipientA.secretKeys, sender.publicKey.publicSigKey);
    expect(dec.ok).toBe(true);
    if (dec.ok) expect(str(dec.plaintext)).toBe("persisted to git, read later");
  });

  it("decodeEnvelope rejects garbage bytes with EnvelopeMalformed", () => {
    const decoded = decodeEnvelope(new Uint8Array([0xff, 0x00, 0x13, 0x37]));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.feedback.kind).toBe("EnvelopeMalformed");
  });

  it("decodeEnvelope rejects a wrong-length contentNonce with EnvelopeMalformed", () => {
    // A signed-but-malformed nonce must fail structurally at decode, not later
    // as a content decrypt error. (Copilot finding on PR #6217.)
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("x"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const bytes = encodeEnvelope({ ...enc.envelope, contentNonce: new Uint8Array(8) }); // wrong length
    const decoded = decodeEnvelope(bytes);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.feedback.kind).toBe("EnvelopeMalformed");
  });

  it("decodeEnvelope rejects unknown top-level fields (canonical-bytes enforcement)", () => {
    // Extra unauthenticated fields would otherwise ride along in a valid envelope.
    // The canonical re-encode-and-compare check fails closed. (Codex P2 + Copilot P1.)
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("x"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(decodeEnvelope(encodeEnvelope(enc.envelope)).ok).toBe(true); // canonical round-trips
    const withRogue = cborEncode({ ...enc.envelope, rogue: new Uint8Array([1, 2, 3]) });
    const decoded = decodeEnvelope(withRogue);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.feedback.kind).toBe("EnvelopeMalformed");
  });

  it("decodeEnvelope reports VersionUnsupported for a well-formed future version", () => {
    // A well-formed envelope of an unsupported version must get the precise
    // VersionUnsupported feedback, not generic EnvelopeMalformed. (Copilot P1.)
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("x"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const bytes = encodeEnvelope({ ...enc.envelope, version: 2 as unknown as 1 });
    const decoded = decodeEnvelope(bytes);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.feedback.kind).toBe("VersionUnsupported");
      if (decoded.feedback.kind === "VersionUnsupported") expect(decoded.feedback.version).toBe(2);
    }
  });

  it("encodeEnvelope is deterministic (same envelope -> same bytes)", () => {
    const sender = generateRecipientKeyPair("sender@zeta");
    const enc = encrypt(ctxFor(utf8("determinism"), sender, [sender]), sender.secretKeys);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const a = encodeEnvelope(enc.envelope);
    const b = encodeEnvelope(enc.envelope);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
