import { describe, expect, test } from "bun:test";
import { resolve, type FetchPackage } from "./resolve.ts";
import { packageHash } from "./package-hash.ts";
import type { AcePackage, AceDependency } from "./store.ts";
import { contentHash } from "./store.ts";
import type { RegistryEntry } from "./store.ts";

const mk = (name: string): AcePackage => ({
  manifest: { format_version: 1, name, version: "1.0.0", content_hash: "blake3:aaa" },
  files: { "a.txt": "x" },
});

describe("packageHash", () => {
  test("stable under key reordering (canonical)", () => {
    const a: AcePackage = { manifest: { format_version: 1, name: "n", version: "1", content_hash: "h" }, files: { a: "1", b: "2" } };
    const b: AcePackage = { manifest: { content_hash: "h", version: "1", name: "n", format_version: 1 }, files: { b: "2", a: "1" } } as AcePackage;
    expect(packageHash(a)).toBe(packageHash(b));
  });
  test("differs when manifest differs even if files identical", () => {
    expect(packageHash(mk("A"))).not.toBe(packageHash(mk("B")));
  });
  test("differs when files differ", () => {
    const base = mk("A");
    const other: AcePackage = { manifest: base.manifest, files: { "a.txt": "DIFFERENT" } };
    expect(packageHash(base)).not.toBe(packageHash(other));
  });
});

// --- slice-4 resolve test helpers ---
// Build a package; children are already-built {pkg, url} whose edges this package will declare.
function pkgOf(name: string, files: Record<string, string>, children: { pkg: AcePackage; url: string }[] = []): AcePackage {
  return {
    manifest: {
      format_version: 1, name, version: "1.0.0",
      content_hash: contentHash(new TextEncoder().encode(JSON.stringify(files))),
      dependencies: children.map((c) => ({
        kind: "inline" as const,
        name: c.pkg.manifest.name, version: c.pkg.manifest.version, url: c.url, package_hash: packageHash(c.pkg),
      })),
    },
    files,
  };
}
// Injected fetch over a {url: package} map.
function fetchOf(map: Record<string, AcePackage>): FetchPackage {
  return async (url: string) => { const p = map[url]; if (!p) throw new Error("404 " + url); return JSON.stringify(p); };
}
const NO_TRUST = new Map(); // empty trust store; basic tests pass allowNoSignature:true

describe("resolve — basic", () => {
  test("leaf package (no deps) resolves to [root]", async () => {
    const root = pkgOf("root", { "r.txt": "x" });
    const r = await resolve(root, fetchOf({}), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name)).toEqual(["root"]);
  });
  test("linear chain root->A->B installs leaves-first [B, A, root]", async () => {
    const B = pkgOf("B", { "b.txt": "b" });
    const A = pkgOf("A", { "a.txt": "a" }, [{ pkg: B, url: "http://e/B" }]);
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name)).toEqual(["B", "A", "root"]);
  });
});

describe("resolve — dedup", () => {
  test("diamond (root->A->D, root->B->D, same D) installs D once", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const A = pkgOf("A", { "a.txt": "a" }, [{ pkg: D, url: "http://e/D" }]);
    const B = pkgOf("B", { "b.txt": "b" }, [{ pkg: D, url: "http://e/D" }]);
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }, { pkg: B, url: "http://e/B" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B, "http://e/D": D }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.filter((p) => p.manifest.name === "D").length).toBe(1);
  });
  test("distinct packages with identical files (different names) both resolve", async () => {
    const files = { "same.txt": "identical" };
    const X = pkgOf("X", files);
    const Y = pkgOf("Y", files); // same files, different name => different package_hash
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: X, url: "http://e/X" }, { pkg: Y, url: "http://e/Y" }]);
    const r = await resolve(root, fetchOf({ "http://e/X": X, "http://e/Y": Y }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name).sort()).toEqual(["X", "Y", "root"]);
  });
});

describe("resolve — conflicts", () => {
  test("version-skew (A->D@1.0, B->D@2.0) refuses", async () => {
    const D1 = pkgOf("D", { "d.txt": "d1" });
    const D2: AcePackage = { manifest: { ...D1.manifest, version: "2.0.0" }, files: { "d.txt": "d2" } };
    const A = pkgOf("A", { "a.txt": "a" }, [{ pkg: D1, url: "http://e/D1" }]);
    const B: AcePackage = { manifest: { ...pkgOf("B", { "b.txt": "b" }).manifest, dependencies: [{ kind: "inline" as const, name: "D", version: "2.0.0", url: "http://e/D2", package_hash: packageHash(D2) }] }, files: { "b.txt": "b" } };
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }, { pkg: B, url: "http://e/B" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B, "http://e/D1": D1, "http://e/D2": D2 }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("version-skew");
  });
  test("root-involving skew (root@1 -> A -> root@2) refuses (root seeded)", async () => {
    const root2: AcePackage = { manifest: { format_version: 1, name: "root", version: "2.0.0", content_hash: "blake3:zzz" }, files: { "r.txt": "two" } };
    const A: AcePackage = { manifest: { ...pkgOf("A", { "a.txt": "a" }).manifest, dependencies: [{ kind: "inline" as const, name: "root", version: "2.0.0", url: "http://e/root2", package_hash: packageHash(root2) }] }, files: { "a.txt": "a" } };
    const root = pkgOf("root", { "r.txt": "one" }, [{ pkg: A, url: "http://e/A" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/root2": root2 }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["version-skew", "cycle"]).toContain(r.reason);
  });
  test("root cycle (root@1 -> A -> root@1) refuses as cycle", async () => {
    const root1Files = { "r.txt": "one" };
    const rootPlaceholder = pkgOf("root", root1Files);
    const A: AcePackage = { manifest: { ...pkgOf("A", { "a.txt": "a" }).manifest, dependencies: [{ kind: "inline" as const, name: "root", version: "1.0.0", url: "http://e/root", package_hash: packageHash(rootPlaceholder) }] }, files: { "a.txt": "a" } };
    const root = pkgOf("root", root1Files, [{ pkg: A, url: "http://e/A" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/root": root }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
  });
  test("cycle A->B->A refuses with the loop in path", async () => {
    const aFiles = { "a.txt": "a" }, bFiles = { "b.txt": "b" };
    const aPlaceholder = pkgOf("A", aFiles);
    const B: AcePackage = { manifest: { ...pkgOf("B", bFiles).manifest, dependencies: [{ kind: "inline" as const, name: "A", version: "1.0.0", url: "http://e/A", package_hash: packageHash(aPlaceholder) }] }, files: bFiles };
    const A: AcePackage = { manifest: { ...pkgOf("A", aFiles).manifest, dependencies: [{ kind: "inline" as const, name: "B", version: "1.0.0", url: "http://e/B", package_hash: packageHash(B) }] }, files: aFiles };
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: A, url: "http://e/A" }]);
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/B": B }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe("cycle"); expect(r.path).toContain("A"); }
  });
});

describe("resolve — verification", () => {
  test("bad-content-hash (files don't hash to manifest.content_hash) refuses", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const tampered: AcePackage = { manifest: D.manifest, files: { "d.txt": "TAMPERED" } };
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]); // edge pins original D
    const r = await resolve(root, fetchOf({ "http://e/D": tampered }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-content-hash");
  });
  test("pin-mismatch (edge package_hash != fetched) refuses", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]);
    (root.manifest.dependencies as any)[0] = { kind: "inline" as const, ...root.manifest.dependencies![0], package_hash: "blake3:wrongwrong" };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("pin-mismatch");
  });
  test("declared-identity mismatch (edge name != fetched manifest name) refuses pin-mismatch", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]);
    (root.manifest.dependencies as any)[0] = { kind: "inline" as const, ...root.manifest.dependencies![0], name: "NOT_D" };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("pin-mismatch");
  });
  test("unsigned node refuses without allowNoSignature, resolves with it", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]);
    const strict = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, new Map(), new Map(), { allowNoSignature: false });
    expect(strict.ok).toBe(false);
    if (!strict.ok) expect(strict.reason).toBe("no-signature");
    const lax = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(lax.ok).toBe(true);
  });
  test("untrusted/bad signature refuses even with allowNoSignature:true", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const signed: AcePackage = { manifest: { ...D.manifest, signature: { algo: "ed25519", key_id: "ed25519:unknownkey", sig: "AAAA" } }, files: D.files };
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: signed, url: "http://e/D" }]);
    const r = await resolve(root, fetchOf({ "http://e/D": signed }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["untrusted-key", "bad-signature"]).toContain(r.reason);
  });
});

describe("resolve — invalid package", () => {
  test("dep JSON that is parseable but not an AcePackage refuses invalid-package (no throw)", async () => {
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: pkgOf("D", { "d.txt": "d" }), url: "http://e/D" }]);
    const badFetch: FetchPackage = async () => JSON.stringify({ foo: 1 }); // valid JSON, not an AcePackage
    const r = await resolve(root, badFetch, NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-package");
  });
  test("dep with non-array dependencies refuses invalid-package (no throw)", async () => {
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: pkgOf("D", { "d.txt": "d" }), url: "http://e/D" }]);
    const D = pkgOf("D", { "d.txt": "d" });
    const badDep: any = { manifest: { ...D.manifest, dependencies: {} }, files: D.files }; // dependencies present but not an array
    // point the root edge's package_hash at badDep so it passes the pin check and reaches the dependencies access
    (root.manifest.dependencies as any)[0] = { kind: "inline" as const, name: "D", version: "1.0.0", url: "http://e/D", package_hash: packageHash(badDep) };
    const r = await resolve(root, fetchOf({ "http://e/D": badDep }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-package");
  });
  test("dep with a non-safe-integer manifest field refuses invalid-package (no throw)", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    // Inject a float into the manifest: packageHash's shared canonicalBytes uses
    // Number.isSafeInteger and throws on it. resolve must surface that as a clean
    // invalid-package refusal, not an unhandled exception (slice 8.1).
    const floatDep: any = { manifest: { ...D.manifest, bogus: 1.5 }, files: D.files };
    const root = pkgOf("root", { "r.txt": "r" }, [{ pkg: D, url: "http://e/D" }]);
    const r = await resolve(root, fetchOf({ "http://e/D": floatDep }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-package");
  });
});

function regOf(src: Record<string, Record<string, RegistryEntry>>): Map<string, Map<string, RegistryEntry>> {
  const m = new Map<string, Map<string, RegistryEntry>>();
  for (const [n, vs] of Object.entries(src)) { const vm = new Map<string, RegistryEntry>(); for (const [v, e] of Object.entries(vs)) vm.set(v, e); m.set(n, vm); }
  return m;
}
function regEdge(name: string, version: string) { return { kind: "registry" as const, name, version }; }

describe("resolve — registry deps", () => {
  test("a registry dep resolves via lookup + full verify", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [regEdge("D", "1.0.0")] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name)).toEqual(["D", "root"]);
  });
  test("registry-miss (name/version absent) refuses", async () => {
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [regEdge("D", "9.9.9")] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: "blake3:x" } } });
    // solved has D->9.9.9 (satisfies the edge range "9.9.9" exactly), but 9.9.9 is absent from the registry
    const r = await resolve(root, fetchOf({}), NO_TRUST, reg, new Map([["D", "9.9.9"]]), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("registry-miss");
  });
  test("mixed inline + registry edges both resolve", async () => {
    const A = pkgOf("A", { "a.txt": "a" });
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [
      { kind: "inline" as const, name: "A", version: "1.0.0", url: "http://e/A", package_hash: packageHash(A) },
      regEdge("D", "1.0.0"),
    ] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const r = await resolve(root, fetchOf({ "http://e/A": A, "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name).sort()).toEqual(["A", "D", "root"]);
  });
  test("registry dep whose registry package_hash mismatches the fetched pkg -> pin-mismatch", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [regEdge("D", "1.0.0")] }, files: { "r.txt": "r" } };
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: "blake3:wrong" } } });
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("pin-mismatch");
  });
  test("an unknown dependency kind refuses with invalid-package (not silently treated as inline)", async () => {
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "frobnicate", name: "X", version: "1.0.0" }] as unknown as AceDependency[] }, files: { "r.txt": "r" } };
    const r = await resolve(root, fetchOf({}), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-package");
  });
  test("an inline edge missing url/package_hash refuses with invalid-package", async () => {
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "inline", name: "X", version: "1.0.0" }] as unknown as AceDependency[] }, files: { "r.txt": "r" } };
    const r = await resolve(root, fetchOf({}), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-package");
  });
});

describe("resolve — solved-map registry edges", () => {
  test("a registry range edge resolves via the solved concrete version + verifies", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "registry" as const, name: "D", version: "^1.0.0" }] }, files: { "r.txt": "r" } };
    const reg = new Map([["D", new Map([["1.0.0", { url: "http://e/D", package_hash: packageHash(D) }]])]]);
    const solved = new Map([["D", "1.0.0"]]);
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, solved, { allowNoSignature: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.order.map((p) => p.manifest.name).sort()).toEqual(["D", "root"]);
  });
  test("registry name absent from solved map → unsatisfiable", async () => {
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "registry" as const, name: "D", version: "^1.0.0" }] }, files: { "r.txt": "r" } };
    const reg = new Map([["D", new Map([["1.0.0", { url: "http://e/D", package_hash: "blake3:x" }]])]]);
    const r = await resolve(root, fetchOf({}), NO_TRUST, reg, new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsatisfiable");
  });
  test("solved version that violates the edge range → unsatisfiable (defense-in-depth)", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "registry" as const, name: "D", version: "^2.0.0" }] }, files: { "r.txt": "r" } };
    const reg = new Map([["D", new Map([["1.0.0", { url: "http://e/D", package_hash: packageHash(D) }]])]]);
    const solved = new Map([["D", "1.0.0"]]); // 1.0.0 does NOT satisfy ^2.0.0
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, solved, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsatisfiable");
  });
});

describe("resolve — untrusted registry edge version (regression / bad-range)", () => {
  test("non-string registry version → bad-range (no satisfies crash)", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "registry", name: "D", version: 123 } as unknown as AceDependency] }, files: { "r.txt": "r" } };
    const reg = new Map([["D", new Map([["1.0.0", { url: "http://e/D", package_hash: packageHash(D) }]])]]);
    const solved = new Map([["D", "1.0.0"]]);
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, solved, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-range");
  });
  test("malformed registry range string → bad-range (defense-in-depth; resolve does not assume solve ran)", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "registry" as const, name: "D", version: "@@@" }] }, files: { "r.txt": "r" } };
    const reg = new Map([["D", new Map([["1.0.0", { url: "http://e/D", package_hash: packageHash(D) }]])]]);
    const solved = new Map([["D", "1.0.0"]]);
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, solved, { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-range");
  });
  test("inline edge with non-string version → invalid-package", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root: AcePackage = { manifest: { ...pkgOf("root", { "r.txt": "r" }).manifest, dependencies: [{ kind: "inline", name: "D", version: 123, url: "http://e/D", package_hash: packageHash(D) } as unknown as AceDependency] }, files: { "r.txt": "r" } };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-package");
  });
});

// ─── Task B: revoked / quarantined gates ─────────────────────────────────────

import type { RevocationMap as RM } from "./signing.ts";

describe("resolve — revoked / quarantined gates (Task B)", () => {
  function mkRegRoot(): AcePackage {
    return {
      manifest: {
        ...pkgOf("root", { "r.txt": "r" }).manifest,
        dependencies: [{ kind: "registry" as const, name: "D", version: "1.0.0" }],
      },
      files: { "r.txt": "r" },
    };
  }

  test("revoked concrete version → ok:false reason:revoked", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = mkRegRoot();
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const revokedMap: RM = { D: { "1.0.0": { at: "2026-05-01T00:00:00Z", reason: "CVE-test" } } };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), {
      allowNoSignature: true,
      revoked: revokedMap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("revoked");
      expect(r.detail).toContain("CVE-test");
    }
  });

  test("quarantined version refuses without allowQuarantined", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = mkRegRoot();
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const quarantinedMap: RM = { D: { "1.0.0": { at: "2026-05-01T00:00:00Z", reason: "suspect" } } };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), {
      allowNoSignature: true,
      quarantined: quarantinedMap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("quarantined");
      expect(r.detail).toContain("suspect");
      expect(r.detail).toContain("--allow-quarantined");
    }
  });

  test("quarantined version resolves with allowQuarantined:true", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = mkRegRoot();
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const quarantinedMap: RM = { D: { "1.0.0": { at: "2026-05-01T00:00:00Z" } } };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), {
      allowNoSignature: true,
      quarantined: quarantinedMap,
      allowQuarantined: true,
    });
    expect(r.ok).toBe(true);
  });

  test("revoked with no reason in detail still refuses cleanly", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = mkRegRoot();
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const revokedMap: RM = { D: { "1.0.0": { at: "2026-05-01T00:00:00Z" } } };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), {
      allowNoSignature: true,
      revoked: revokedMap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("revoked");
  });

  test("non-revoked/quarantined version resolves normally (no false positive)", async () => {
    const D = pkgOf("D", { "d.txt": "d" });
    const root = mkRegRoot();
    const reg = regOf({ D: { "1.0.0": { url: "http://e/D", package_hash: packageHash(D) } } });
    const revokedMap: RM = { D: { "9.9.9": { at: "2026-05-01T00:00:00Z" } } };
    const quarantinedMap: RM = { OTHER: { "1.0.0": { at: "2026-05-01T00:00:00Z" } } };
    const r = await resolve(root, fetchOf({ "http://e/D": D }), NO_TRUST, reg, new Map([["D", "1.0.0"]]), {
      allowNoSignature: true,
      revoked: revokedMap,
      quarantined: quarantinedMap,
    });
    expect(r.ok).toBe(true);
  });
});

describe("resolve — malformed root refuses cleanly (no escaped throw)", () => {
  test("float manifest field on root -> invalid-package at path [root]", async () => {
    const badRoot = {
      manifest: { format_version: 1, name: "root", version: "1.0.0", content_hash: "blake3:aaa", bogus: 1.5 },
      files: { "a.txt": "x" },
    } as unknown as AcePackage;
    const r = await resolve(badRoot, fetchOf({}), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid-package");
      expect(r.path).toEqual(["root"]);
    }
  });
  test("lone-surrogate manifest field on root -> invalid-package", async () => {
    const badRoot = {
      manifest: { format_version: 1, name: "root", version: "1.0.0", content_hash: "blake3:aaa", bogus: "\uD800" },
      files: { "a.txt": "x" },
    } as unknown as AcePackage;
    const r = await resolve(badRoot, fetchOf({}), NO_TRUST, new Map(), new Map(), { allowNoSignature: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-package");
  });
});
