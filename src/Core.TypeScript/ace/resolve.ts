import type { RevocationMap } from "./signing.ts";
import { safePackageHash } from "./package-hash.ts";
import { contentHash, type AcePackage, type LoadedTrustEntry, type Registry } from "./store.ts";
import { verifySignature } from "./signing.ts";
import { parseRange, satisfies } from "./semver.ts";

/** Deterministic JSON for LOCKFILE serialization only (lockfile.ts `serializeLockfile`):
 *  object keys recursively sorted; arrays preserve order. This is a readable-file-format
 *  concern, NOT a trust-core hashing site — the trust core (packageHash below, signing.ts)
 *  uses the shared `canonicalBytes` (canonical.ts). Kept local + exported for lockfile.ts. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

export type FetchPackage = (urlOrPath: string) => Promise<string>;

export type ResolveReason =
  | "version-skew" | "tamper" | "pin-mismatch" | "bad-content-hash"
  | "bad-signature" | "untrusted-key" | "unsupported-algo" | "no-signature"
  | "cycle" | "fetch-failed" | "invalid-package" | "registry-miss"
  | "unsatisfiable" | "bad-range" | "revoked" | "quarantined";

export type ResolveResult =
  | { ok: true; order: AcePackage[] }
  | { ok: false; reason: ResolveReason; detail: string; path: string[] };

export async function resolve(
  root: AcePackage,
  fetchPackage: FetchPackage,
  trustStore: Map<string, LoadedTrustEntry>,
  registry: Registry,
  solved: Map<string, string>,
  opts: { allowNoSignature: boolean; allowQuarantined?: boolean; revoked?: RevocationMap; quarantined?: RevocationMap },
): Promise<ResolveResult> {
  const byName = new Map<string, { version: string; pkgHash: string; path: string[] }>();
  const visiting = new Set<string>();
  const order: AcePackage[] = [];

  // The root is untrusted input: a non-safe-integer / lone-surrogate manifest field makes
  // packageHash throw (via canonicalBytes → toTagged). safePackageHash maps that to a clean
  // invalid-package refusal rather than letting it escape resolve() to the ace: fatal: catch-all.
  const rootHash = safePackageHash(root);
  if (!rootHash.ok) {
    return { ok: false, reason: "invalid-package", detail: `root: ${rootHash.reason}`, path: ["root"] };
  }
  byName.set(root.manifest.name, { version: root.manifest.version, pkgHash: rootHash.hash, path: ["root"] });
  visiting.add(root.manifest.name);

  const walk = async (node: AcePackage, path: string[]): Promise<ResolveResult | null> => {
    for (const edge of (Array.isArray(node.manifest.dependencies) ? node.manifest.dependencies : [])) {
      const here = [...path, edge.name];

      // Edge-shape guard: dependency edges are untrusted JSON. kind omitted == inline (pre-DU
      // back-compat); reject an unknown kind + an inline edge missing url/package_hash here with a
      // precise invalid-package refusal rather than letting it surface later as fetch-failed.
      const ek = (edge as { readonly kind?: unknown }).kind;
      if (ek !== undefined && ek !== "inline" && ek !== "registry") {
        return { ok: false, reason: "invalid-package", detail: `${edge.name}: unknown dependency kind ${JSON.stringify(ek)}`, path: here };
      }

      // Resolve url + package_hash from the edge kind
      let url: string;
      let package_hash: string;
      // For registry edges: look up the solver's output (concrete version), apply the
      // satisfies defense-in-depth check, then look up the registry entry by concrete version.
      // For inline edges: url and package_hash come directly from the edge.
      let effectiveVersion: string;
      if (edge.kind === "registry") {
        const concrete = solved.get(edge.name);
        if (concrete === undefined) {
          return { ok: false, reason: "unsatisfiable", detail: `${edge.name}: no solved version`, path: here };
        }
        // Defense-in-depth: edge.version is untrusted JSON. resolve() must not assume solve() ran,
        // so parse the declared range here (non-string OR malformed → bad-range) before confirming
        // the solved concrete version satisfies it.
        if (typeof edge.version !== "string") {
          return { ok: false, reason: "bad-range", detail: `${edge.name}: registry edge version must be a string`, path: here };
        }
        const range = parseRange(edge.version);
        if ("error" in range) {
          return { ok: false, reason: "bad-range", detail: `${edge.name}: ${range.error}`, path: here };
        }
        if (!satisfies(concrete, range)) {
          return { ok: false, reason: "unsatisfiable", detail: `${edge.name}: solved ${concrete} violates ${edge.version}`, path: here };
        }
        const entry = registry.get(edge.name)?.get(concrete);
        if (entry === undefined) {
          return { ok: false, reason: "registry-miss", detail: `${edge.name}@${concrete} not in registry`, path: here };
        }
        url = entry.url; package_hash = entry.package_hash;
        if (opts.revoked && opts.revoked[edge.name]?.[concrete] !== undefined) {
          const r = opts.revoked[edge.name]![concrete]!;
          return { ok: false, reason: "revoked", detail: `${edge.name}@${concrete} is revoked${r.reason ? ": " + r.reason : ""}`, path: here };
        }
        if (!opts.allowQuarantined && opts.quarantined && opts.quarantined[edge.name]?.[concrete] !== undefined) {
          const q = opts.quarantined[edge.name]![concrete]!;
          return { ok: false, reason: "quarantined", detail: `${edge.name}@${concrete} is quarantined${q.reason ? ": " + q.reason : ""} (use --allow-quarantined)`, path: here };
        }
        effectiveVersion = concrete;
      } else {
        if (typeof edge.url !== "string" || typeof edge.package_hash !== "string" || typeof edge.version !== "string") {
          return { ok: false, reason: "invalid-package", detail: `${edge.name}: inline edge missing/invalid url/package_hash/version`, path: here };
        }
        url = edge.url; package_hash = edge.package_hash;
        effectiveVersion = edge.version;
      }

      // NB: the root is seeded into `visiting`, so a root-involving skew (root@1 -> A -> root@2)
      // trips this cycle check before the version-skew check below — both refuse + install nothing.
      if (visiting.has(edge.name)) {
        return { ok: false, reason: "cycle", detail: here.join(" → "), path: here };
      }
      const seen = byName.get(edge.name);
      if (seen) {
        if (seen.version !== effectiveVersion) {
          return { ok: false, reason: "version-skew", detail: `${edge.name} required at ${seen.version} (via ${seen.path.join(" → ")}) and ${effectiveVersion} (via ${here.join(" → ")})`, path: here };
        }
        if (seen.pkgHash !== package_hash) {
          return { ok: false, reason: "tamper", detail: `${edge.name}@${effectiveVersion} has two different package hashes`, path: here };
        }
        continue; // diamond dedup: same name+version+package_hash, already resolved
      }
      let dep: AcePackage;
      try { dep = JSON.parse(await fetchPackage(url)) as AcePackage; }
      catch (e) { return { ok: false, reason: "fetch-failed", detail: `${url}: ${(e as Error).message}`, path: here }; }
      // Shape guard: verify the parsed JSON is a well-formed AcePackage before any field access.
      // Also reject non-array dependencies: a dependencies field that is present but not an array
      // is malformed and would throw in the for-of loop, so we refuse it here as invalid-package.
      const m = (dep as { manifest?: { dependencies?: unknown }; files?: unknown });
      if (typeof dep !== "object" || dep === null || typeof m.manifest !== "object" || m.manifest === null || typeof m.files !== "object" || m.files === null
          || (m.manifest.dependencies !== undefined && !Array.isArray(m.manifest.dependencies))) {
        return { ok: false, reason: "invalid-package", detail: `${url}: not a well-formed AcePackage`, path: here };
      }
      // slice-2 self-check
      const filesHash = contentHash(new TextEncoder().encode(JSON.stringify(dep.files)));
      if (filesHash !== dep.manifest.content_hash) {
        return { ok: false, reason: "bad-content-hash", detail: `${edge.name}: files hash ${filesHash} != manifest ${dep.manifest.content_hash}`, path: here };
      }
      // pin check (whole-package identity). packageHash canonicalizes via the shared
      // canonicalBytes, which throws on a non-safe-integer (e.g. a float) or a lone-surrogate
      // field in an untrusted manifest; safePackageHash maps that to a clean invalid-package
      // refusal rather than letting it escape resolve() as an unhandled exception (slice 8.1).
      const hashed = safePackageHash(dep);
      if (!hashed.ok) {
        return { ok: false, reason: "invalid-package", detail: `${edge.name}: ${hashed.reason}`, path: here };
      }
      const got = hashed.hash;
      if (got !== package_hash) {
        return { ok: false, reason: "pin-mismatch", detail: `${edge.name}: expected package_hash ${package_hash} but fetched ${got}`, path: here };
      }
      // declared-identity check: fetched package name/version must match edge name + effectiveVersion
      if (dep.manifest.name !== edge.name || dep.manifest.version !== effectiveVersion) {
        return { ok: false, reason: "pin-mismatch", detail: `${edge.name}@${effectiveVersion}: edge identity != fetched ${dep.manifest.name}@${dep.manifest.version}`, path: here };
      }
      // slice-3 signature gate
      const v = verifySignature(dep.manifest, trustStore);
      if (!v.ok) {
        if (v.reason === "no-signature") {
          if (!opts.allowNoSignature) return { ok: false, reason: "no-signature", detail: `${edge.name}: unsigned (use --allow-no-signature)`, path: here };
        } else {
          return { ok: false, reason: v.reason, detail: `${edge.name}: ${v.reason}`, path: here };
        }
      }
      byName.set(edge.name, { version: effectiveVersion, pkgHash: package_hash, path: here });
      visiting.add(edge.name);
      const sub = await walk(dep, here);
      if (sub) return sub;
      visiting.delete(edge.name);
      order.push(dep);
    }
    return null;
  };

  const failure = await walk(root, ["root"]);
  if (failure) return failure;
  order.push(root);
  return { ok: true, order };
}
