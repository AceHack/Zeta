import { describe, expect, test } from "bun:test";
import { joinUrl, nextSequence, buildIndexDoc } from "./registry-publish.js";
import { generateKeypair, publicKeyInfoFromPrivatePem } from "./signing.js";
import { verifyIndexSignature } from "./index-signature.js";
import { parseIndex } from "./registry-remote.js";
import { packageHash } from "./package-hash.js";
import { contentHash } from "./store.js";
// helper: a minimal well-formed AcePackage with a correct content_hash
function pkg(name, version, files = { "a.txt": "x" }) {
    const content_hash = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    return { manifest: { format_version: 1, name, version, content_hash }, files };
}
describe("joinUrl", () => {
    test("single separator regardless of trailing slash", () => {
        expect(joinUrl("https://pkgs", "leaf-1.0.0.json")).toBe("https://pkgs/leaf-1.0.0.json");
        expect(joinUrl("https://pkgs/", "leaf-1.0.0.json")).toBe("https://pkgs/leaf-1.0.0.json");
        expect(joinUrl("https://pkgs///", "leaf-1.0.0.json")).toBe("https://pkgs/leaf-1.0.0.json");
    });
});
describe("nextSequence", () => {
    test("null → 1", () => { expect(nextSequence(null)).toBe(1); });
    test("prev → prev+1", () => {
        const prev = { format_version: 1, sequence: 6, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } };
        expect(nextSequence(prev)).toBe(7);
    });
});
describe("buildIndexDoc", () => {
    const kp = generateKeypair();
    const issuedAt = "2026-06-01T12:00:00Z";
    test("assembles url + package_hash per package, signs, self-verifies", () => {
        const p = pkg("leaf", "1.0.0");
        const doc = buildIndexDoc({ packages: [{ pkg: p }], baseUrl: "https://pkgs", sequence: 3, issuedAt, privatePem: kp.privatePem });
        expect("error" in doc).toBe(false);
        if ("error" in doc)
            return;
        expect(doc.sequence).toBe(3);
        expect(doc.issued_at).toBe(issuedAt);
        expect(doc.packages.leaf["1.0.0"].url).toBe("https://pkgs/leaf-1.0.0.json");
        expect(doc.packages.leaf["1.0.0"].package_hash).toBe(packageHash(p));
        const reparsed = parseIndex(JSON.stringify(doc));
        expect("error" in reparsed).toBe(false);
        const info = publicKeyInfoFromPrivatePem(kp.privatePem);
        const { signature, ...content } = doc;
        expect(verifyIndexSignature(content, signature, new Map([[info.keyId, { public_key: info.public_key }]])).ok).toBe(true);
    });
    test.each(["__proto__", "constructor", "prototype"])("rejects reserved package name %s", (bad) => {
        const doc = buildIndexDoc({ packages: [{ pkg: pkg(bad, "1.0.0") }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
        expect("error" in doc).toBe(true);
    });
    test("rejects reserved package version", () => {
        const doc = buildIndexDoc({ packages: [{ pkg: pkg("ok", "__proto__") }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
        expect("error" in doc).toBe(true);
    });
    test("duplicate name@version → error", () => {
        const doc = buildIndexDoc({ packages: [{ pkg: pkg("leaf", "1.0.0") }, { pkg: pkg("leaf", "1.0.0") }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
        expect("error" in doc).toBe(true);
    });
    test("packages sorted by name then version regardless of input order", () => {
        const doc = buildIndexDoc({ packages: [{ pkg: pkg("zeta", "1.0.0") }, { pkg: pkg("alpha", "1.0.0") }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
        expect("error" in doc).toBe(false);
        if ("error" in doc)
            return;
        expect(Object.keys(doc.packages)).toEqual(["alpha", "zeta"]);
    });
    test("per-package url override is used; absent falls back to base-url", () => {
        const a = pkg("alpha", "1.0.0");
        const b = pkg("beta", "1.0.0");
        const doc = buildIndexDoc({
            packages: [{ pkg: a, url: "https://cdn.example/alpha-v1.json" }, { pkg: b }],
            baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem,
        });
        expect("error" in doc).toBe(false);
        if ("error" in doc)
            return;
        expect(doc.packages.alpha["1.0.0"].url).toBe("https://cdn.example/alpha-v1.json");
        expect(doc.packages.beta["1.0.0"].url).toBe("https://pkgs/beta-1.0.0.json");
    });
    test("url override does not change package_hash", () => {
        const a = pkg("alpha", "1.0.0");
        const withUrl = buildIndexDoc({ packages: [{ pkg: a, url: "https://cdn/x.json" }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
        const without = buildIndexDoc({ packages: [{ pkg: a }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
        if ("error" in withUrl || "error" in without)
            throw new Error("unexpected");
        expect(withUrl.packages.alpha["1.0.0"].package_hash).toBe(without.packages.alpha["1.0.0"].package_hash);
    });
});
describe("buildIndexDoc with revoked/quarantined marks", () => {
    const kp2 = generateKeypair();
    const issuedAt2 = "2026-06-01T12:00:00Z";
    const leafPkg = pkg("leaf", "1.0.0");
    test("passing revoked yields v2 doc with marks", () => {
        const revoked = Object.create(null);
        revoked["leaf"] = Object.create(null);
        revoked["leaf"]["1.0.0"] = { at: "2026-06-01T00:00:00Z" };
        const doc = buildIndexDoc({
            packages: [{ pkg: leafPkg }],
            baseUrl: "https://pkgs", sequence: 1, issuedAt: issuedAt2, privatePem: kp2.privatePem,
            revoked,
        });
        expect("error" in doc).toBe(false);
        if ("error" in doc)
            return;
        expect(doc.format_version).toBe(2);
        expect(doc.revoked?.["leaf"]?.["1.0.0"]?.at).toBe("2026-06-01T00:00:00Z");
        expect(doc.quarantined).toBeUndefined();
    });
    test("passing quarantined yields v2 doc with marks", () => {
        const quarantined = Object.create(null);
        quarantined["leaf"] = Object.create(null);
        quarantined["leaf"]["1.0.0"] = { reason: "suspicious", at: "2026-06-01T00:00:00Z" };
        const doc = buildIndexDoc({
            packages: [{ pkg: leafPkg }],
            baseUrl: "https://pkgs", sequence: 1, issuedAt: issuedAt2, privatePem: kp2.privatePem,
            quarantined,
        });
        expect("error" in doc).toBe(false);
        if ("error" in doc)
            return;
        expect(doc.format_version).toBe(2);
        expect(doc.quarantined?.["leaf"]?.["1.0.0"]?.reason).toBe("suspicious");
        expect(doc.revoked).toBeUndefined();
    });
    test("omitting marks yields v1 doc (regression)", () => {
        const doc = buildIndexDoc({
            packages: [{ pkg: leafPkg }],
            baseUrl: "https://pkgs", sequence: 1, issuedAt: issuedAt2, privatePem: kp2.privatePem,
        });
        expect("error" in doc).toBe(false);
        if ("error" in doc)
            return;
        expect(doc.format_version).toBe(1);
        expect(doc.revoked).toBeUndefined();
        expect(doc.quarantined).toBeUndefined();
    });
    test("empty revoked/quarantined maps yield v1", () => {
        const doc = buildIndexDoc({
            packages: [{ pkg: leafPkg }],
            baseUrl: "https://pkgs", sequence: 1, issuedAt: issuedAt2, privatePem: kp2.privatePem,
            revoked: Object.create(null),
            quarantined: Object.create(null),
        });
        expect("error" in doc).toBe(false);
        if ("error" in doc)
            return;
        expect(doc.format_version).toBe(1);
    });
});
