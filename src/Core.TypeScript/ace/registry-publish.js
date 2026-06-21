import { packageHash } from "./package-hash.js";
import { signIndex } from "./index-signature.js";
/** Join a base url + filename with exactly one separator (trailing slashes normalized). */
export function joinUrl(base, file) {
    return base.replace(/\/+$/, "") + "/" + file;
}
/** Monotonic next sequence: bump the prior index's sequence, or start at 1. */
export function nextSequence(prev) {
    return prev ? prev.sequence + 1 : 1;
}
/** Package names/versions that would mutate Object prototypes; rejected at ingest. */
const RESERVED_IDENTITY_KEYS = new Set(["__proto__", "constructor", "prototype"]);
/** Assemble + sign an index doc from already-read packages. Duplicate name@version → error. */
export function buildIndexDoc(args) {
    // Null-prototype map: a package name like "__proto__" cannot pollute via bracket-assign.
    const packages = Object.create(null);
    const sorted = [...args.packages].sort((a, b) => a.pkg.manifest.name.localeCompare(b.pkg.manifest.name) || a.pkg.manifest.version.localeCompare(b.pkg.manifest.version));
    for (const entry of sorted) {
        const pkg = entry.pkg;
        const name = pkg.manifest.name;
        const version = pkg.manifest.version;
        const versions = packages[name] ?? Object.create(null);
        if (RESERVED_IDENTITY_KEYS.has(name) || RESERVED_IDENTITY_KEYS.has(version)) {
            return { error: `reserved package identity not allowed: ${name}@${version}` };
        }
        if (versions[version] !== undefined)
            return { error: `duplicate package ${name}@${version}` };
        const url = entry.url ?? joinUrl(args.baseUrl, `${name}-${version}.json`);
        versions[version] = { url, package_hash: packageHash(pkg) };
        packages[name] = versions;
    }
    const hasMarks = (m) => !!m && Object.keys(m).length > 0;
    const fmt = (hasMarks(args.revoked) || hasMarks(args.quarantined)) ? 2 : 1;
    const content = { format_version: fmt, sequence: args.sequence, issued_at: args.issuedAt, packages };
    if (hasMarks(args.revoked))
        content.revoked = args.revoked;
    if (hasMarks(args.quarantined))
        content.quarantined = args.quarantined;
    const signature = signIndex(content, args.privatePem);
    return { ...content, signature };
}
