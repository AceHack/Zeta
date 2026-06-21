// index-signature.ts -- Ace slice 8.4: signed-registry-index authenticity primitive.
// Extracted from signing.ts (8.4) into a named trust-core module — sibling of canonical.ts (8.1)
// and package-hash.ts (8.2). Composes the shared ed25519 + key_id primitives (signing.ts) and the
// 8.1 canonical byte form (canonical.ts) over the registry index content (the "manifest of the
// registry": format_version, sequence, issued_at, packages, + optional revoked/quarantined). The
// dependency is ONE-WAY (index-signature.ts -> signing.ts); signing.ts keeps manifest sign/verify
// + the shared AceSignature/VerifyResult/TrustEntry/keyId/RevocationMap and gains no dependency on
// this module, so there is no import cycle.
import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import { keyId } from "./signing.js";
import { canonicalBytes } from "./canonical.js";
/** Index content (no `signature`), via the shared canonical byte form (§8.1). Sibling of canonicalManifestBytes. */
export function canonicalIndexBytes(content) {
    return canonicalBytes(content);
}
export function signIndex(content, privatePem) {
    const bytes = canonicalIndexBytes(content);
    const priv = createPrivateKey(privatePem);
    const sig = nodeSign(null, bytes, priv).toString("base64");
    const spkiB64 = createPublicKey(priv).export({ type: "spki", format: "der" }).toString("base64");
    return { algo: "ed25519", key_id: keyId(spkiB64), sig };
}
export function verifyIndexSignature(content, signature, trustStore) {
    if (signature.algo !== "ed25519")
        return { ok: false, reason: "unsupported-algo" };
    const entry = trustStore.get(signature.key_id);
    if (!entry)
        return { ok: false, reason: "untrusted-key" };
    let verified = false;
    try {
        const pub = createPublicKey({ key: Buffer.from(entry.public_key, "base64"), format: "der", type: "spki" });
        verified = nodeVerify(null, canonicalIndexBytes(content), pub, Buffer.from(signature.sig, "base64"));
    }
    catch {
        verified = false;
    }
    if (!verified)
        return { ok: false, reason: "bad-signature" };
    const result = { ok: true, key_id: signature.key_id };
    if (entry.label !== undefined)
        result.label = entry.label;
    return result;
}
