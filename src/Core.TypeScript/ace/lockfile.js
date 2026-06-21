import { canonicalJson } from "./resolve.js";
import { packageHash } from "./package-hash.js";
/** Build the lockfile from a successful resolve. `order` is resolve()'s output (deps-first,
 *  root LAST); root is excluded from `nodes`. Each node's url is taken inline-edge-first
 *  (inline pins are authoritative — the solver never registry-solves an inline-fixed name),
 *  then registry. package_hash is the hash of the actually-installed package. */
export function buildLockfile(root, order, registry) {
    // Prescan every inline edge in the graph → name@version -> url. kind omitted == inline
    // (pre-DU back-compat — resolve()/solver treat a missing kind as inline), so capture those too.
    // A kind-omitted edge is untrusted-shaped (not in the AceDependency DU); read url defensively.
    const inlineUrls = new Map();
    for (const p of order) {
        for (const edge of (p.manifest.dependencies ?? [])) {
            if (edge.kind === "inline" || edge.kind === undefined) {
                const url = edge.url;
                if (typeof url === "string")
                    inlineUrls.set(`${edge.name}@${edge.version}`, url);
            }
        }
    }
    // root is the input, not a locked dependency. Contract: root is LAST in order (resolve()'s
    // deps-first, root-last output); slice when that holds, else fall back to identity-filter.
    const last = order[order.length - 1];
    const deps = last === root ? order.slice(0, -1) : order.filter((p) => p !== root);
    const nodes = [];
    for (const dep of deps) {
        const name = dep.manifest.name;
        const version = dep.manifest.version;
        const url = inlineUrls.get(`${name}@${version}`) ?? registry.get(name)?.get(version)?.url;
        if (url === undefined)
            return { error: `cannot resolve url for ${name}@${version}` };
        nodes.push({ name, version, url, package_hash: packageHash(dep) });
    }
    return {
        format_version: 1,
        root: { name: root.manifest.name, version: root.manifest.version, package_hash: packageHash(root) },
        nodes,
    };
}
export function serializeLockfile(lf) {
    return canonicalJson(lf) + "\n";
}
/** Parse + shape-guard an untrusted lockfile string. Never throws — malformed input → {error}. */
export function parseLockfile(json) {
    let v;
    try {
        v = JSON.parse(json);
    }
    catch (e) {
        return { error: `not valid JSON: ${e.message}` };
    }
    if (typeof v !== "object" || v === null)
        return { error: "lockfile is not an object" };
    const o = v;
    if (o.format_version !== 1)
        return { error: `unsupported format_version: ${JSON.stringify(o.format_version)}` };
    const root = o.root;
    if (typeof root !== "object" || root === null
        || typeof root.name !== "string" || typeof root.version !== "string" || typeof root.package_hash !== "string") {
        return { error: "malformed lockfile root" };
    }
    if (!Array.isArray(o.nodes))
        return { error: "lockfile nodes is not an array" };
    const nodes = [];
    for (const n of o.nodes) {
        const e = n;
        if (typeof e !== "object" || e === null
            || typeof e.name !== "string" || typeof e.version !== "string"
            || typeof e.url !== "string" || typeof e.package_hash !== "string") {
            return { error: "malformed lockfile node" };
        }
        nodes.push({ name: e.name, version: e.version, url: e.url, package_hash: e.package_hash });
    }
    return { format_version: 1, root: { name: root.name, version: root.version, package_hash: root.package_hash }, nodes };
}
/** Drift gate for --frozen: the provided root must be byte-identical to the locked root. */
export function verifyRootMatchesLock(root, lf) {
    return packageHash(root) === lf.root.package_hash;
}
/** True iff two lockfiles serialize identically. Canonical JSON normalizes object key order, but node array order IS significant — the same nodes in a different order are NOT equal. */
export function lockfilesEqual(a, b) {
    return serializeLockfile(a) === serializeLockfile(b);
}
/** Lockfile for a no-dependency (leaf) root: the root identity + empty nodes. */
export function buildLeafLockfile(root) {
    return {
        format_version: 1,
        root: { name: root.manifest.name, version: root.manifest.version, package_hash: packageHash(root) },
        nodes: [],
    };
}
