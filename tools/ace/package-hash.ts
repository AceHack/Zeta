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
import { createHash } from "node:crypto";
import { canonicalBytes } from "./canonical.ts";
import type { AcePackage } from "./store.ts";

/**
 * Content identity: `sha256:<hex>` of canonicalBytes({ manifest − signature, files }).
 * The parent's pin / identity for a dependency — two edges sharing a packageHash have
 * byte-identical CONTENT regardless of signature. Throws (via canonicalBytes / toTagged)
 * on a non-safe-integer or lone-surrogate field; resolve maps that to invalid-package.
 */
export function packageHash(pkg: AcePackage): string {
  const { signature, ...rest } = pkg.manifest; // exclude signature from the identity
  void signature;
  return "sha256:" + createHash("sha256").update(canonicalBytes({ manifest: rest, files: pkg.files })).digest("hex");
}
