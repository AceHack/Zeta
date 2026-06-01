// registry-publish.ts -- Ace slice 6.1: pure producer-side index assembly + signing.
// Inverts the consumer: build the signed IndexSignableContent a slice-6 consumer accepts.
// No I/O — the caller (ace.ts) reads the package files + sequence + pem and writes the output.
import type { AcePackage, RegistryEntry } from "./store.ts";
import { packageHash } from "./resolve.ts";
import type { IndexSignableContent } from "./signing.ts";
import { signIndex } from "./signing.ts";
import type { IndexDoc } from "./registry-remote.ts";

/** Join a base url + filename with exactly one separator (trailing slashes normalized). */
export function joinUrl(base: string, file: string): string {
  return base.replace(/\/+$/, "") + "/" + file;
}

/** Monotonic next sequence: bump the prior index's sequence, or start at 1. */
export function nextSequence(prev: IndexDoc | null): number {
  return prev ? prev.sequence + 1 : 1;
}


/** Package names/versions that would mutate Object prototypes; rejected at ingest. */
const RESERVED_IDENTITY_KEYS = new Set(["__proto__", "constructor", "prototype"]);
/** Assemble + sign an index doc from already-read packages. Duplicate name@version → error. */
export function buildIndexDoc(args: {
  packages: ReadonlyArray<{ pkg: AcePackage; url?: string }>; baseUrl: string; sequence: number; issuedAt: string; privatePem: string;
}): IndexDoc | { error: string } {
  // Null-prototype map: a package name like "__proto__" cannot pollute via bracket-assign.
  const packages: Record<string, Record<string, RegistryEntry>> = Object.create(null);
  const sorted = [...args.packages].sort((a, b) =>
    a.pkg.manifest.name.localeCompare(b.pkg.manifest.name) || a.pkg.manifest.version.localeCompare(b.pkg.manifest.version));
  for (const entry of sorted) {
    const pkg = entry.pkg;
    const name = pkg.manifest.name;
    const version = pkg.manifest.version;
    const versions = packages[name] ?? (Object.create(null) as Record<string, RegistryEntry>);
    if (RESERVED_IDENTITY_KEYS.has(name) || RESERVED_IDENTITY_KEYS.has(version)) {
      return { error: `reserved package identity not allowed: ${name}@${version}` };
    }
    if (versions[version] !== undefined) return { error: `duplicate package ${name}@${version}` };
    const url = entry.url ?? joinUrl(args.baseUrl, `${name}-${version}.json`);
    versions[version] = { url, package_hash: packageHash(pkg) };
    packages[name] = versions;
  }
  const content: IndexSignableContent = { format_version: 1, sequence: args.sequence, issued_at: args.issuedAt, packages };
  const signature = signIndex(content, args.privatePem);
  return { ...content, signature };
}
