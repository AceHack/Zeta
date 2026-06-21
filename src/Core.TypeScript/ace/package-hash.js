// package-hash.ts -- Ace slice 8.2: package_hash as CONTENT IDENTITY.
// Composes the two trust-core primitives — canonical-JSON (8.1, via canonicalBytes) and
// SHA-256 — over the package CONTENT: the manifest MINUS its signature, plus files. The
// signature is excluded so identity (what the package is) is separate from authenticity
// (who vouches for it — verified separately by signing.ts). Same EXCLUSION as signing.ts's
// canonicalManifestBytes (which also strips the signature) but a different SCOPE: signing
// covers the manifest alone; package identity covers { manifest, files }. The hash is stable
// across re-signing.
// Runtime hasher is node:crypto SHA-256 (native; byte-identical to the slice-8 SHA-256
// oracle, which exists for cross-language verification, not as the runtime hasher).
import { ContentHash256 } from "../blake3/blake3.js";
import { canonicalBytes } from "./canonical.js";
/**
 * Content identity: `blake3:<hex>` of canonicalBytes({ manifest − signature, files }).
 * The parent's pin / identity for a dependency — two edges sharing a packageHash have
 * byte-identical CONTENT regardless of signature. Throws (via canonicalBytes / toTagged)
 * on a non-safe-integer or lone-surrogate field; resolve maps that to invalid-package.
 */
export function packageHash(pkg) {
    const { signature, ...rest } = pkg.manifest; // exclude signature from the identity
    void signature;
    const bytes = canonicalBytes({ manifest: rest, files: pkg.files });
    return "blake3:" + ContentHash256.ofBytes(bytes).toHex();
}
/**
 * Throw-safe `packageHash` for UNTRUSTED input. `packageHash` throws (via
 * canonicalBytes → toTagged) on a malformed field — a non-safe-integer (e.g. a float)
 * or a lone UTF-16 surrogate. This wrapper maps that throw to `{ ok: false, reason }`
 * so a caller can refuse cleanly (e.g. `invalid-package`) instead of letting it escape
 * to the generic `ace: fatal:` catch-all (which is for genuinely-unexpected internal
 * faults). Trusted / own-built packages may keep calling `packageHash` directly.
 */
export function safePackageHash(pkg) {
    try {
        return { ok: true, hash: packageHash(pkg) };
    }
    catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
}
