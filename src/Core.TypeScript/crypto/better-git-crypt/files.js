/**
 * tools/crypto/better-git-crypt/files.ts
 *
 * B-0883 v1 — file-level operations: keypair (de)serialization + file
 * encrypt/decrypt wrappers around `crypto.ts`. This is the layer that makes the
 * post-quantum substrate usable for "encrypt files in-repo" (the git-crypt
 * REPLACEMENT workflow — git-crypt itself was rejected long ago) WITHOUT a
 * transparent clean/smudge filter: the committed artifact is the canonical CBOR
 * envelope (the `.zc` ciphertext); plaintext never enters git. (A clean/smudge
 * or `textconv` filter is the separate, still-deferred integration; this file
 * is the manual-but-complete encrypt/decrypt path.)
 *
 * Key-ownership model (load-bearing security invariant): `encrypt` SIGNS with
 * the sender's secret key AND the sender is a self-recipient (decryption-
 * capable, per crypto.ts). So *self-encryption* (sender = sole recipient = you)
 * means ONLY the holder of the secret bundle can read the output. The secret
 * bundle (`SecretBundleJSON`) MUST NOT be committed; the owner holds it. The
 * public recipient (`RecipientKeyJSON`) is shareable/committable.
 *
 * Per asymmetric-authorship + monad-propagation: the file-level crypto ops
 * (`encryptBytes` / `decryptBytes`) are Result<_, feedback> — the crypto layer
 * AUTHORS its feedback channel; this layer propagates it. The (de)serialization
 * helpers (`serialize*` / `deserialize*`) are plain functions that THROW on a
 * STRUCTURALLY-malformed bundle (e.g. a missing field → `undefined` → `Buffer.from`
 * throws); they are NOT Result-shaped and NOT strict validators — note that
 * malformed base64 *content* decodes leniently to garbage bytes rather than
 * throwing (a wrong-key/garbage decrypt then fails fail-closed downstream).
 * Callers (the CLI) wrap them in try/catch and report the failure.
 */
import { generateRecipientKeyPair, encrypt, decrypt, encodeEnvelope, decodeEnvelope, } from "./crypto";
// --- base64 codec (Bun/Node Buffer; keys + ciphertext are bytes-in-JSON) ---
const b64 = (u) => Buffer.from(u).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const SECRET_WARNING = "DO-NOT-COMMIT — secret key material; the holder is the only party who can decrypt";
export function serializeRecipient(pub) {
    return {
        identity: pub.identity,
        kemAlgId: pub.kemAlgId,
        sigAlgId: pub.sigAlgId,
        publicKemKey: b64(pub.publicKemKey),
        publicSigKey: b64(pub.publicSigKey),
        seedSource: pub.seedSource,
        composesWith: pub.composesWith,
    };
}
export function deserializeRecipient(j) {
    return {
        identity: j.identity,
        kemAlgId: j.kemAlgId,
        sigAlgId: j.sigAlgId,
        publicKemKey: unb64(j.publicKemKey),
        publicSigKey: unb64(j.publicSigKey),
        seedSource: j.seedSource,
        composesWith: j.composesWith,
    };
}
/**
 * True if `obj` carries SECRET key material (a `SecretBundleJSON`, or any object
 * with `secretKemKey` / `secretSigKey`). The CLI uses this to REFUSE a secret
 * bundle where a PUBLIC recipient is expected (`--recipient` / `--sender-sig`):
 * a `.secret.json` there would silently treat private key material as a public
 * recipient and invites accidental sharing/committing of the secret keys.
 */
export function looksLikeSecretBundle(obj) {
    return (typeof obj === "object" &&
        obj !== null &&
        ("secretKemKey" in obj || "secretSigKey" in obj));
}
export function serializeSecretBundle(kp) {
    return {
        warning: SECRET_WARNING,
        identity: kp.publicKey.identity,
        kemAlgId: kp.publicKey.kemAlgId,
        sigAlgId: kp.publicKey.sigAlgId,
        seedSource: kp.publicKey.seedSource,
        publicKemKey: b64(kp.publicKey.publicKemKey),
        publicSigKey: b64(kp.publicKey.publicSigKey),
        secretKemKey: b64(kp.secretKeys.kemSecretKey),
        secretSigKey: b64(kp.secretKeys.sigSecretKey),
        composesWith: kp.publicKey.composesWith,
    };
}
export function deserializeSecretBundle(j) {
    return {
        pub: {
            identity: j.identity,
            kemAlgId: j.kemAlgId,
            sigAlgId: j.sigAlgId,
            publicKemKey: unb64(j.publicKemKey),
            publicSigKey: unb64(j.publicSigKey),
            seedSource: j.seedSource,
            composesWith: j.composesWith,
        },
        sec: {
            identity: j.identity,
            kemSecretKey: unb64(j.secretKemKey),
            sigSecretKey: unb64(j.secretSigKey),
        },
    };
}
/** Generate a fresh v1 keypair + its serializable public + secret JSON forms. */
export function generateKeyPairJSON(identity) {
    const kp = generateRecipientKeyPair(identity, "random-bytes");
    return { recipient: serializeRecipient(kp.publicKey), secret: serializeSecretBundle(kp) };
}
/**
 * Encrypt `plaintext` with `self` as sender (signs) AND self-recipient, plus any
 * `extraRecipients`. Returns the canonical CBOR envelope bytes (the `.zc` form).
 *
 * `self` is ALWAYS a recipient (sender must be a self-recipient per crypto.ts);
 * `extraRecipients` are deduped against self by identity. With no extras this is
 * pure self-encryption: only the holder of `self`'s secret bundle can decrypt.
 */
export function encryptBytes(plaintext, self, extraRecipients = []) {
    const recipients = [
        self.pub,
        ...extraRecipients.filter((r) => r.identity !== self.pub.identity),
    ];
    const res = encrypt({ plaintext, recipients, sender: self.pub, seedSource: "random-bytes" }, self.sec);
    if (!res.ok)
        return { ok: false, feedback: res.feedback };
    return { ok: true, envelopeBytes: encodeEnvelope(res.envelope), recipientIdentities: recipients.map((r) => r.identity) };
}
/**
 * Decrypt envelope bytes with `self`'s secret bundle. `senderPublicSigKey`
 * defaults to `self`'s public sig key (the self-encrypted case — sender = self);
 * pass another party's public sig key for files they signed. Decode is fail-
 * closed (canonical-bytes check) and verify is signature-first, both in crypto.ts.
 *
 * `expectedSignerIdentity` (RECOMMENDED whenever verifying a foreign sender) BINDS
 * the claimed identity: `signerIdentity` is signed but self-declared, so verifying
 * with a key alone lets an envelope claim identity X while signed by key-for-Y.
 * When given, the envelope's `signerIdentity` must equal it — else `identityMismatch`
 * (fail-closed, before the signature is trusted). Pass it together with the matching
 * `senderPublicSigKey` (e.g. both from the sender's public `RecipientKey`).
 */
export function decryptBytes(envelopeBytes, self, senderPublicSigKey, expectedSignerIdentity) {
    const dec = decodeEnvelope(envelopeBytes);
    if (!dec.ok)
        return { ok: false, feedback: dec.feedback };
    if (expectedSignerIdentity !== undefined && dec.envelope.signerIdentity !== expectedSignerIdentity) {
        return { ok: false, identityMismatch: { expected: expectedSignerIdentity, actual: dec.envelope.signerIdentity } };
    }
    return decrypt(dec.envelope, self.sec, senderPublicSigKey ?? self.pub.publicSigKey);
}
