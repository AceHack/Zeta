/**
 * tools/crypto/better-git-crypt/files.test.ts
 *
 * 081KSNY2Z0008QG0R002JKH50A v1 — file-level layer tests (serialization round-trip + encrypt/decrypt
 * bytes round-trip + tamper-detection + multi-recipient + wrong-key fail-closed).
 * The crypto primitives themselves are covered by crypto.test.ts; this verifies
 * the files.ts wiring (base64 (de)serialization + self-recipient handling +
 * envelope-bytes path) is correct end to end.
 */

import { describe, expect, test } from "bun:test";
import {
  generateKeyPairJSON,
  serializeRecipient,
  deserializeRecipient,
  serializeSecretBundle,
  deserializeSecretBundle,
  looksLikeSecretBundle,
  encryptBytes,
  decryptBytes,
  type SelfKeys,
} from "./files";
import { generateRecipientKeyPair } from "./crypto";

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const fromUtf8 = (u: Uint8Array): string => new TextDecoder().decode(u);

function selfFrom(identity: string): SelfKeys {
  return deserializeSecretBundle(generateKeyPairJSON(identity).secret);
}

describe("better-git-crypt files.ts — key serialization", () => {
  test("recipient public key survives JSON round-trip byte-for-byte", () => {
    const kp = generateRecipientKeyPair("alice@zeta", "random-bytes");
    const back = deserializeRecipient(serializeRecipient(kp.publicKey));
    expect(back.identity).toBe(kp.publicKey.identity);
    expect(back.kemAlgId).toBe(kp.publicKey.kemAlgId);
    expect(back.sigAlgId).toBe(kp.publicKey.sigAlgId);
    expect(Buffer.from(back.publicKemKey)).toEqual(Buffer.from(kp.publicKey.publicKemKey));
    expect(Buffer.from(back.publicSigKey)).toEqual(Buffer.from(kp.publicKey.publicSigKey));
  });

  test("secret bundle survives JSON round-trip byte-for-byte (public + secret halves)", () => {
    const kp = generateRecipientKeyPair("bob@zeta", "random-bytes");
    const back = deserializeSecretBundle(serializeSecretBundle(kp));
    expect(back.pub.identity).toBe("bob@zeta");
    expect(Buffer.from(back.pub.publicKemKey)).toEqual(Buffer.from(kp.publicKey.publicKemKey));
    expect(Buffer.from(back.pub.publicSigKey)).toEqual(Buffer.from(kp.publicKey.publicSigKey));
    expect(Buffer.from(back.sec.kemSecretKey)).toEqual(Buffer.from(kp.secretKeys.kemSecretKey));
    expect(Buffer.from(back.sec.sigSecretKey)).toEqual(Buffer.from(kp.secretKeys.sigSecretKey));
  });

  test("secret bundle JSON carries the DO-NOT-COMMIT warning + no plaintext keys are exposed as raw arrays", () => {
    const { secret } = generateKeyPairJSON("carol@zeta");
    expect(secret.warning).toContain("DO-NOT-COMMIT");
    // secret material is base64 strings, not raw byte arrays leaking through JSON
    expect(typeof secret.secretKemKey).toBe("string");
    expect(typeof secret.secretSigKey).toBe("string");
  });
});

describe("better-git-crypt files.ts — self-encryption round-trip", () => {
  test("self-encrypt then self-decrypt recovers the plaintext exactly", () => {
    const self = selfFrom("aaron@zeta");
    const message = "μένω — what remains is the seed. 4×4 = the knot = the treaty.";
    const enc = encryptBytes(utf8(message), self);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    // self is the sole recipient
    expect(enc.recipientIdentities).toEqual(["aaron@zeta"]);
    const dec = decryptBytes(enc.envelopeBytes, self);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(fromUtf8(dec.plaintext)).toBe(message);
  });

  test("empty plaintext round-trips", () => {
    const self = selfFrom("empty@zeta");
    const enc = encryptBytes(new Uint8Array(0), self);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decryptBytes(enc.envelopeBytes, self);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.plaintext.length).toBe(0);
  });

  test("binary plaintext (non-utf8 bytes) round-trips byte-for-byte", () => {
    const self = selfFrom("bin@zeta");
    const blob = new Uint8Array([0, 1, 2, 255, 254, 0, 128, 7]);
    const enc = encryptBytes(blob, self);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decryptBytes(enc.envelopeBytes, self);
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(Buffer.from(dec.plaintext)).toEqual(Buffer.from(blob));
  });
});

describe("better-git-crypt files.ts — fail-closed", () => {
  test("a tampered envelope byte makes decrypt fail (not silently wrong)", () => {
    const self = selfFrom("tamper@zeta");
    const enc = encryptBytes(utf8("secret"), self);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const tampered = Uint8Array.from(enc.envelopeBytes);
    const i = Math.floor(tampered.length / 2);
    tampered[i] = (tampered[i] ?? 0) ^ 0xff;
    const dec = decryptBytes(tampered, self);
    expect(dec.ok).toBe(false);
  });

  test("a different key cannot decrypt (wrong recipient fails closed)", () => {
    const owner = selfFrom("owner@zeta");
    const stranger = selfFrom("stranger@zeta");
    const enc = encryptBytes(utf8("for owner only"), owner);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    // stranger tries to decrypt owner's self-encrypted file
    const dec = decryptBytes(enc.envelopeBytes, stranger, owner.pub.publicSigKey);
    expect(dec.ok).toBe(false);
  });

  test("garbage bytes decode-fail rather than throw", () => {
    const self = selfFrom("garbage@zeta");
    const dec = decryptBytes(new Uint8Array([1, 2, 3, 4, 5]), self);
    expect(dec.ok).toBe(false);
  });
});

describe("better-git-crypt files.ts — multi-recipient", () => {
  test("sender + extra recipient: both can decrypt; the file is signed by the sender", () => {
    const sender = selfFrom("aaron@zeta");
    const otherKp = generateRecipientKeyPair("addison@zeta", "random-bytes");
    const other = deserializeSecretBundle(serializeSecretBundle(otherKp));
    const enc = encryptBytes(utf8("shared note"), sender, [other.pub]);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(enc.recipientIdentities.sort()).toEqual(["aaron@zeta", "addison@zeta"]);

    // sender decrypts (self-recipient)
    const decSender = decryptBytes(enc.envelopeBytes, sender);
    expect(decSender.ok).toBe(true);
    if (!decSender.ok) return;
    expect(fromUtf8(decSender.plaintext)).toBe("shared note");

    // the other recipient decrypts, verifying the SENDER's signature
    const decOther = decryptBytes(enc.envelopeBytes, other, sender.pub.publicSigKey);
    expect(decOther.ok).toBe(true);
    if (!decOther.ok) return;
    expect(fromUtf8(decOther.plaintext)).toBe("shared note");
  });

  test("duplicate recipient (extra == self) is deduped to a single slot", () => {
    const self = selfFrom("dup@zeta");
    const enc = encryptBytes(utf8("x"), self, [self.pub]);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(enc.recipientIdentities).toEqual(["dup@zeta"]);
  });
});

describe("better-git-crypt files.ts — looksLikeSecretBundle (P1 footgun guard)", () => {
  test("a secret bundle is detected (so the CLI can refuse it as a recipient)", () => {
    const { secret } = generateKeyPairJSON("sec@zeta");
    expect(looksLikeSecretBundle(secret)).toBe(true);
  });

  test("a public recipient is NOT flagged (it is a valid recipient)", () => {
    const { recipient } = generateKeyPairJSON("pub@zeta");
    expect(looksLikeSecretBundle(recipient)).toBe(false);
  });

  test("partial secret material (only one secret field) is still detected", () => {
    expect(looksLikeSecretBundle({ identity: "x", secretKemKey: "..." })).toBe(true);
    expect(looksLikeSecretBundle({ identity: "x", secretSigKey: "..." })).toBe(true);
  });

  test("non-objects do not trip the guard", () => {
    expect(looksLikeSecretBundle(null)).toBe(false);
    expect(looksLikeSecretBundle("string")).toBe(false);
    expect(looksLikeSecretBundle(42)).toBe(false);
  });
});

describe("better-git-crypt files.ts — decryptBytes identity binding", () => {
  test("expectedSignerIdentity mismatch fails on the identityMismatch channel (fail-closed)", () => {
    const sender = selfFrom("alice@zeta");
    const recipient = selfFrom("bob@zeta");
    const enc = encryptBytes(utf8("for bob, signed by alice"), sender, [recipient.pub]);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    // bob verifies alice's key but BINDS the wrong identity (carol) → identityMismatch
    const bad = decryptBytes(enc.envelopeBytes, recipient, sender.pub.publicSigKey, "carol@zeta");
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect("identityMismatch" in bad).toBe(true);
    if (!("identityMismatch" in bad)) return;
    expect(bad.identityMismatch).toEqual({ expected: "carol@zeta", actual: "alice@zeta" });
  });

  test("the matching expectedSignerIdentity decrypts cleanly", () => {
    const sender = selfFrom("alice@zeta");
    const recipient = selfFrom("bob@zeta");
    const enc = encryptBytes(utf8("bound"), sender, [recipient.pub]);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const ok = decryptBytes(enc.envelopeBytes, recipient, sender.pub.publicSigKey, "alice@zeta");
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(fromUtf8(ok.plaintext)).toBe("bound");
  });

  test("omitting expectedSignerIdentity keeps the prior (unbound) behavior", () => {
    const self = selfFrom("solo@zeta");
    const enc = encryptBytes(utf8("self"), self);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    const dec = decryptBytes(enc.envelopeBytes, self); // no identity arg
    expect(dec.ok).toBe(true);
  });
});
