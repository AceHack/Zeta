import { describe, expect, test } from "bun:test";
import { solve } from "./solver.js";
import { packageHash } from "./package-hash.js";
import { contentHash } from "./store.js";
function pkgAt(name, version, deps = []) {
    const files = { "f.txt": `${name}@${version}` };
    return { manifest: { format_version: 1, name, version, content_hash: contentHash(new TextEncoder().encode(JSON.stringify(files))), dependencies: deps }, files };
}
const regEdge = (name, range) => ({ kind: "registry", name, version: range });
const inlineEdge = (pkg, url) => ({ kind: "inline", name: pkg.manifest.name, version: pkg.manifest.version, url, package_hash: packageHash(pkg) });
function fetchOf(map) {
    return async (url) => { const p = map[url]; if (!p)
        throw new Error("404 " + url); return JSON.stringify(p); };
}
// Build registry + fetch map from {pkg,url} list. Registry: name -> version -> {url, package_hash}.
function world(entries) {
    const registry = new Map();
    const fetchMap = {};
    for (const { pkg, url } of entries) {
        const n = pkg.manifest.name, v = pkg.manifest.version;
        if (!registry.has(n))
            registry.set(n, new Map());
        registry.get(n).set(v, { url, package_hash: packageHash(pkg) });
        fetchMap[url] = pkg;
    }
    return { registry, fetch: fetchOf(fetchMap) };
}
describe("solve — inline back-compat", () => {
    test("inline-only graph with empty registry solves (no registry-miss)", async () => {
        const A = pkgAt("A", "1.0.0");
        const root = pkgAt("root", "1.0.0", [inlineEdge(A, "http://e/A")]);
        const r = await solve(root, fetchOf({ "http://e/A": A }), new Map());
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(r.versions.get("A")).toBe("1.0.0");
    });
});
describe("solve — registry ranges", () => {
    test("^1.0.0 resolves to newest available", async () => {
        const A1 = pkgAt("A", "1.0.0"), A5 = pkgAt("A", "1.5.0"), A9 = pkgAt("A", "1.9.0");
        const { registry, fetch } = world([{ pkg: A1, url: "u/A/1" }, { pkg: A5, url: "u/A/5" }, { pkg: A9, url: "u/A/9" }]);
        const root = pkgAt("root", "1.0.0", [regEdge("A", "^1.0.0")]);
        const r = await solve(root, fetch, registry);
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(r.versions.get("A")).toBe("1.9.0");
    });
    test("transitive constraint forces backtrack below newest (re-validation)", async () => {
        const A1 = pkgAt("A", "1.0.0"), A5 = pkgAt("A", "1.5.0"), A9 = pkgAt("A", "1.9.0");
        const B = pkgAt("B", "1.0.0", [regEdge("A", "<1.6.0")]);
        const { registry, fetch } = world([
            { pkg: A1, url: "u/A/1" }, { pkg: A5, url: "u/A/5" }, { pkg: A9, url: "u/A/9" }, { pkg: B, url: "u/B/1" },
        ]);
        const root = pkgAt("root", "1.0.0", [regEdge("A", ">=1.0.0"), regEdge("B", "*")]);
        const r = await solve(root, fetch, registry);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.versions.get("A")).toBe("1.5.0");
            expect(r.versions.get("B")).toBe("1.0.0");
        }
    });
    test("unsatisfiable range refuses", async () => {
        const A1 = pkgAt("A", "1.0.0"), A5 = pkgAt("A", "1.5.0");
        const { registry, fetch } = world([{ pkg: A1, url: "u/A/1" }, { pkg: A5, url: "u/A/5" }]);
        const root = pkgAt("root", "1.0.0", [regEdge("A", ">=2.0.0")]);
        const r = await solve(root, fetch, registry);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("unsatisfiable");
    });
    test("bad range refuses with bad-range", async () => {
        const root = pkgAt("root", "1.0.0", [regEdge("A", "@@@")]);
        const r = await solve(root, fetchOf({}), new Map());
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("bad-range");
    });
    test("registry-sourced name absent from registry → registry-miss", async () => {
        const root = pkgAt("root", "1.0.0", [regEdge("MISSING", "^1.0.0")]);
        const r = await solve(root, fetchOf({}), new Map());
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("registry-miss");
    });
});
describe("solve — mixed inline + registry for one name (inline authoritative)", () => {
    test("inline pin satisfies a registry range elsewhere → ok at inline version", async () => {
        const Ainline = pkgAt("A", "1.0.0");
        const B = pkgAt("B", "1.0.0", [regEdge("A", "^1.0.0")]);
        const { registry, fetch: regFetch } = world([{ pkg: B, url: "u/B/1" }]);
        // also need to fetch the inline A:
        const fetch = async (url) => (url === "http://e/A" ? JSON.stringify(Ainline) : regFetch(url));
        const root = pkgAt("root", "1.0.0", [inlineEdge(Ainline, "http://e/A"), regEdge("B", "*")]);
        const r = await solve(root, fetch, registry);
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(r.versions.get("A")).toBe("1.0.0");
    });
    test("inline pin violating a registry range → unsatisfiable", async () => {
        const Ainline = pkgAt("A", "1.0.0");
        const B = pkgAt("B", "1.0.0", [regEdge("A", "^2.0.0")]);
        const { registry, fetch: regFetch } = world([{ pkg: B, url: "u/B/1" }]);
        const fetch = async (url) => (url === "http://e/A" ? JSON.stringify(Ainline) : regFetch(url));
        const root = pkgAt("root", "1.0.0", [inlineEdge(Ainline, "http://e/A"), regEdge("B", "*")]);
        const r = await solve(root, fetch, registry);
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("unsatisfiable");
    });
});
describe("solve — determinism", () => {
    test("same (root, registry) yields identical map", async () => {
        const A1 = pkgAt("A", "1.0.0"), A9 = pkgAt("A", "1.9.0");
        const { registry, fetch } = world([{ pkg: A1, url: "u/A/1" }, { pkg: A9, url: "u/A/9" }]);
        const root = pkgAt("root", "1.0.0", [regEdge("A", "^1.0.0")]);
        const r1 = await solve(root, fetch, registry);
        const r2 = await solve(root, fetch, registry);
        expect(r1.ok && r2.ok).toBe(true);
        if (r1.ok && r2.ok)
            expect([...r1.versions].sort()).toEqual([...r2.versions].sort());
    });
});
describe("solve — constraint retraction on backtrack (P1 regression)", () => {
    test("stale constraint from an abandoned version is retracted (registry-availability variant)", async () => {
        const A1 = pkgAt("A", "1.0.0"); // no deps
        const A2 = pkgAt("A", "2.0.0", [regEdge("C", ">=2.0.0")]); // version-dependent dep
        const B1 = pkgAt("B", "1.0.0", [regEdge("A", "<2.0.0")]);
        const C1 = pkgAt("C", "1.0.0");
        const { registry, fetch } = world([
            { pkg: A1, url: "u/A/1" }, { pkg: A2, url: "u/A/2" }, { pkg: B1, url: "u/B/1" }, { pkg: C1, url: "u/C/1" },
        ]);
        const root = pkgAt("root", "1.0.0", [regEdge("A", "*"), regEdge("B", "*"), regEdge("C", "*")]);
        const r = await solve(root, fetch, registry);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.versions.get("A")).toBe("1.0.0");
            expect(r.versions.get("B")).toBe("1.0.0");
            expect(r.versions.get("C")).toBe("1.0.0");
        }
    });
    test("stale constraint from an abandoned version is retracted (peer-conflict variant)", async () => {
        const A1 = pkgAt("A", "1.0.0");
        const A2 = pkgAt("A", "2.0.0", [regEdge("C", ">=2.0.0")]);
        const B1 = pkgAt("B", "1.0.0", [regEdge("A", "<2.0.0"), regEdge("C", "<2.0.0")]);
        const C1 = pkgAt("C", "1.0.0");
        const C2 = pkgAt("C", "2.0.0");
        const { registry, fetch } = world([
            { pkg: A1, url: "u/A/1" }, { pkg: A2, url: "u/A/2" }, { pkg: B1, url: "u/B/1" }, { pkg: C1, url: "u/C/1" }, { pkg: C2, url: "u/C/2" },
        ]);
        const root = pkgAt("root", "1.0.0", [regEdge("A", "*"), regEdge("B", "*"), regEdge("C", "*")]);
        const r = await solve(root, fetch, registry);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.versions.get("A")).toBe("1.0.0");
            expect(r.versions.get("C")).toBe("1.0.0");
        }
    });
});
describe("solve — untrusted edge shape (regression)", () => {
    test("registry edge with non-string version → invalid-package (no parseRange crash)", async () => {
        const bad = { kind: "registry", name: "A", version: 123 };
        const root = pkgAt("root", "1.0.0", [bad]);
        const r = await solve(root, fetchOf({}), new Map());
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("invalid-package");
    });
    test("inline edge with non-string version → invalid-package (no satisfies/pin crash)", async () => {
        const A = pkgAt("A", "1.0.0");
        const bad = { kind: "inline", name: "A", version: 123, url: "http://e/A", package_hash: packageHash(A) };
        const root = pkgAt("root", "1.0.0", [bad]);
        const r = await solve(root, fetchOf({ "http://e/A": A }), new Map());
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toBe("invalid-package");
    });
});
describe("solve — malformed edge name path fidelity (regression)", () => {
    test("non-string name → invalid-package, path preserves the stringified bad name", async () => {
        const bad = { kind: "registry", name: 99, version: "^1.0.0" };
        const root = pkgAt("root", "1.0.0", [bad]);
        const r = await solve(root, fetchOf({}), new Map());
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.reason).toBe("invalid-package");
            expect(r.path).toEqual(["root", "99"]);
        }
    });
});
