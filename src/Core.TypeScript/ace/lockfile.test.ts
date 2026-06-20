import { describe, expect, test } from "bun:test";
import { buildLockfile } from "./lockfile.ts";
import { packageHash } from "./package-hash.ts";
import { contentHash } from "./store.ts";
import type { AcePackage, AceDependency, RegistryEntry, Registry } from "./store.ts";

function pkgAt(name: string, version: string, deps: AceDependency[] = []): AcePackage {
  const files = { "f.txt": `${name}@${version}` };
  return { manifest: { format_version: 1, name, version, content_hash: contentHash(new TextEncoder().encode(JSON.stringify(files))), dependencies: deps }, files };
}
const regEdge = (name: string, range: string): AceDependency => ({ kind: "registry", name, version: range });
const inlineEdge = (pkg: AcePackage, url: string): AceDependency => ({ kind: "inline", name: pkg.manifest.name, version: pkg.manifest.version, url, package_hash: packageHash(pkg) });
function reg(entries: { name: string; version: string; url: string; pkg: AcePackage }[]): Registry {
  const r: Registry = new Map();
  for (const e of entries) {
    if (!r.has(e.name)) r.set(e.name, new Map<string, RegistryEntry>());
    r.get(e.name)!.set(e.version, { url: e.url, package_hash: packageHash(e.pkg) });
  }
  return r;
}

describe("buildLockfile", () => {
  test("records registry node url from the registry + excludes root", () => {
    const A = pkgAt("A", "1.2.0");
    const root = pkgAt("root", "1.0.0", [regEdge("A", "^1.0.0")]);
    const registry = reg([{ name: "A", version: "1.2.0", url: "u/A/1.2.0", pkg: A }]);
    const order: AcePackage[] = [A, root]; // resolve order: deps-first, root last
    const lf = buildLockfile(root, order, registry);
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.format_version).toBe(1);
      expect(lf.root).toEqual({ name: "root", version: "1.0.0", package_hash: packageHash(root) });
      expect(lf.nodes).toEqual([{ name: "A", version: "1.2.0", url: "u/A/1.2.0", package_hash: packageHash(A) }]);
    }
  });
  test("records inline node url from the inline edge (inline precedence)", () => {
    const B = pkgAt("B", "2.0.0");
    const root = pkgAt("root", "1.0.0", [inlineEdge(B, "http://e/B")]);
    const order: AcePackage[] = [B, root];
    const lf = buildLockfile(root, order, new Map());
    expect("error" in lf).toBe(false);
    if (!("error" in lf)) {
      expect(lf.nodes).toEqual([{ name: "B", version: "2.0.0", url: "http://e/B", package_hash: packageHash(B) }]);
    }
  });
  test("records a kind-OMITTED inline edge's url (pre-DU back-compat parity with resolve())", () => {
    const C = pkgAt("C", "3.0.0");
    // kind omitted entirely — represents pre-DU back-compat shape that resolve()/solver treat as
    // inline. Not representable in the AceDependency DU, so build it via a cast.
    const kindlessEdge = { name: "C", version: "3.0.0", url: "http://e/C", package_hash: packageHash(C) } as unknown as AceDependency;
    const root = pkgAt("root", "1.0.0", [kindlessEdge]);
    const order: AcePackage[] = [C, root];
    const lf = buildLockfile(root, order, new Map());
    expect("error" in lf).toBe(false); // must NOT fail with "cannot resolve url"
    if (!("error" in lf)) {
      expect(lf.nodes).toEqual([{ name: "C", version: "3.0.0", url: "http://e/C", package_hash: packageHash(C) }]);
    }
  });
});

import { serializeLockfile, parseLockfile, type Lockfile } from "./lockfile.ts";

describe("serializeLockfile / parseLockfile", () => {
  const lf: Lockfile = {
    format_version: 1,
    root: { name: "root", version: "1.0.0", package_hash: "blake3:r" },
    nodes: [{ name: "A", version: "1.2.0", url: "u/A", package_hash: "blake3:a" }],
  };
  test("round-trips", () => {
    const parsed = parseLockfile(serializeLockfile(lf));
    expect(parsed).toEqual(lf);
  });
  test("serialization is canonical (object keys sorted) + ends in newline", () => {
    const s = serializeLockfile(lf);
    expect(s.endsWith("\n")).toBe(true);
    // canonical: every object's keys are emitted in sorted order
    expect(s).toContain('"format_version":1');
    expect(s.indexOf('"name"')).toBeLessThan(s.indexOf('"package_hash"')); // n < p within root
  });
  test("parse rejects malformed input with {error} (no throw)", () => {
    expect("error" in parseLockfile("not json {")).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({}))).toBe(true); // absent format_version
    expect("error" in parseLockfile(JSON.stringify({ ...lf, format_version: 2 }))).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({ ...lf, nodes: "x" }))).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({ ...lf, nodes: [{ name: 1, version: "1", url: "u", package_hash: "h" }] }))).toBe(true);
    expect("error" in parseLockfile(JSON.stringify({ ...lf, root: { name: "r" } }))).toBe(true);
  });
});

import { verifyRootMatchesLock } from "./lockfile.ts";

describe("verifyRootMatchesLock", () => {
  test("true when root packageHash matches, false on any root change", () => {
    const root = pkgAt("root", "1.0.0", [regEdge("A", "^1.0.0")]);
    const lf = { format_version: 1 as const, root: { name: "root", version: "1.0.0", package_hash: packageHash(root) }, nodes: [] };
    expect(verifyRootMatchesLock(root, lf)).toBe(true);
    const changed = pkgAt("root", "1.0.0", [regEdge("A", "^2.0.0")]); // changed range → different packageHash
    expect(verifyRootMatchesLock(changed, lf)).toBe(false);
  });
});

import { lockfilesEqual, buildLeafLockfile } from "./lockfile.ts";

describe("lockfilesEqual", () => {
  const base: Lockfile = {
    format_version: 1,
    root: { name: "root", version: "1.0.0", package_hash: "blake3:r" },
    nodes: [{ name: "A", version: "1.2.0", url: "u/A", package_hash: "blake3:a" }],
  };
  test("true for identical (incl. key-order-insensitive via canonical)", () => {
    const clone: Lockfile = JSON.parse(JSON.stringify(base));
    expect(lockfilesEqual(base, clone)).toBe(true);
  });
  test("false when a node version differs", () => {
    const diff: Lockfile = { ...base, nodes: [{ ...base.nodes[0]!, version: "1.3.0" }] };
    expect(lockfilesEqual(base, diff)).toBe(false);
  });
  test("false when root differs", () => {
    const diff: Lockfile = { ...base, root: { ...base.root, package_hash: "blake3:other" } };
    expect(lockfilesEqual(base, diff)).toBe(false);
  });
});

describe("buildLeafLockfile", () => {
  test("produces {format_version:1, root, nodes:[]} with the root package_hash", () => {
    const files = { "f.txt": "leaf@1.0.0" };
    const root = { manifest: { format_version: 1, name: "leaf", version: "1.0.0", content_hash: contentHash(new TextEncoder().encode(JSON.stringify(files))) }, files };
    const lf = buildLeafLockfile(root);
    expect(lf.format_version).toBe(1);
    expect(lf.nodes).toEqual([]);
    expect(lf.root).toEqual({ name: "leaf", version: "1.0.0", package_hash: packageHash(root) });
  });
});
