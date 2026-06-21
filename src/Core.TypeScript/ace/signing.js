// signing.ts -- Ace slice 3: pure Ed25519 authenticity primitives (zero-dep, node:crypto).
// Pure: no fs, no process. The signature covers the WHOLE manifest minus its own
// `signature` field, via recursive key-sorted canonical JSON (§3 of the design) — so
// every present + future manifest field is bound. content_hash (over `files`) is a
// SEPARATE slice-2 concern handled by store.ts/ace.ts, NOT here.
import { createHash, generateKeyPairSync, createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify, } from "node:crypto";
import { canonicalBytes } from "./canonical.js";
/** key_id = "ed25519:" + first 16 hex of sha256(SPKI-DER). */
export function keyId(spkiB64) {
    const der = Buffer.from(spkiB64, "base64");
    return "ed25519:" + createHash("sha256").update(der).digest("hex").slice(0, 16);
}
export function generateKeypair() {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const publicSpkiB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    return { privatePem, publicSpkiB64, keyId: keyId(publicSpkiB64) };
}
/** Whole manifest minus `signature`, via the shared canonical byte form (§8.1). */
export function canonicalManifestBytes(manifest) {
    const { signature, ...rest } = manifest;
    void signature; // excluded from canonical bytes — only `rest` is serialized
    return canonicalBytes(rest);
}
export function signManifest(manifest, privatePem) {
    const bytes = canonicalManifestBytes(manifest);
    const priv = createPrivateKey(privatePem);
    const sig = nodeSign(null, bytes, priv).toString("base64");
    const spkiB64 = createPublicKey(priv).export({ type: "spki", format: "der" }).toString("base64");
    return { algo: "ed25519", key_id: keyId(spkiB64), sig };
}
export function verifySignature(manifest, trustStore) {
    const signature = manifest.signature;
    if (!signature)
        return { ok: false, reason: "no-signature" };
    if (signature.algo !== "ed25519")
        return { ok: false, reason: "unsupported-algo" };
    const entry = trustStore.get(signature.key_id);
    if (!entry)
        return { ok: false, reason: "untrusted-key" };
    let verified = false;
    try {
        const pub = createPublicKey({ key: Buffer.from(entry.public_key, "base64"), format: "der", type: "spki" });
        verified = nodeVerify(null, canonicalManifestBytes(manifest), pub, Buffer.from(signature.sig, "base64"));
    }
    catch {
        verified = false; // malformed key/sig bytes -> treat as bad-signature, never throw
    }
    if (!verified)
        return { ok: false, reason: "bad-signature" };
    const result = { ok: true, key_id: signature.key_id };
    if (entry.label !== undefined)
        result.label = entry.label;
    return result;
}
/** Derive the SPKI-DER base64 public key + its keyId from a private PEM (for a self-verify
 *  trust store). Sibling of signIndex's internal signer-id derivation. */
export function publicKeyInfoFromPrivatePem(privatePem) {
    const priv = createPrivateKey(privatePem);
    if (priv.asymmetricKeyType !== "ed25519") {
        throw new Error(`publicKeyInfoFromPrivatePem: expected an ed25519 key, got ${priv.asymmetricKeyType ?? "unknown"}`);
    }
    const public_key = createPublicKey(priv).export({ type: "spki", format: "der" }).toString("base64");
    return { keyId: keyId(public_key), public_key };
}
