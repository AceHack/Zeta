import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { parseIndex } from "./registry-remote.js";
import { generateKeypair } from "./signing.js";
import { signIndex } from "./index-signature.js";
import { verifyIndex } from "./registry-remote.js";
const good = JSON.stringify({
    format_version: 1, sequence: 2, issued_at: "2026-06-01T12:00:00Z",
    packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "blake3:aa" } } },
    signature: { algo: "ed25519", key_id: "ed25519:k", sig: "BASE64" },
});
describe("parseIndex", () => {
    test("parses a well-formed index", () => {
        const r = parseIndex(good);
        expect("error" in r).toBe(false);
        if (!("error" in r)) {
            expect(r.sequence).toBe(2);
            expect(r.packages.leaf["1.0.0"].url).toBe("https://x/l.json");
        }
    });
    test.each([
        ["not json", "{"],
        ["bad format_version", JSON.stringify({ format_version: 99, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
        ["negative sequence", JSON.stringify({ format_version: 1, sequence: -1, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
        ["unparseable issued_at", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "nope", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
        ["missing signature", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: {} })],
        ["non-string url", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: { a: { "1.0.0": { url: 5, package_hash: "h" } } }, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
    ])("rejects %s (no throw)", (_label, json) => {
        expect("error" in parseIndex(json)).toBe(true);
    });
});
function mk(seq, issuedAtMs) {
    const kp = generateKeypair();
    const content = { format_version: 1, sequence: seq, issued_at: new Date(issuedAtMs).toISOString(),
        packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "blake3:aa" } } } };
    const doc = { ...content, signature: signIndex(content, kp.privatePem) };
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    return { kp, doc, trust };
}
const remoteOf = (keyId) => ({ url: "https://x/index.json", key_id: keyId });
const NOW = Date.parse("2026-06-01T12:00:00Z");
const meta0 = { url: "https://x/index.json", sequence_high_water: 0, index_content_hash: "", fetched_at: "" };
describe("verifyIndex (three gates)", () => {
    test("all gates pass", () => { const { kp, doc, trust } = mk(1, NOW); expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {}).ok).toBe(true); });
    test("untrusted signer refused", () => { const { doc, kp } = mk(1, NOW); expect(verifyIndex(doc, remoteOf(kp.keyId), new Map(), meta0, NOW, {}).ok).toBe(false); });
    test("trusted-but-not-pinned key refused (mandatory pin)", () => {
        const { doc, trust } = mk(1, NOW);
        const r = verifyIndex(doc, remoteOf("ed25519:someoneelse"), trust, meta0, NOW, {});
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toContain("pinned");
    });
    test("rollback refused", () => {
        const { kp, doc, trust } = mk(2, NOW);
        const r = verifyIndex(doc, remoteOf(kp.keyId), trust, { ...meta0, sequence_high_water: 5 }, NOW, {});
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toContain("rollback");
    });
    test("equal sequence accepted", () => { const { kp, doc, trust } = mk(5, NOW); expect(verifyIndex(doc, remoteOf(kp.keyId), trust, { ...meta0, sequence_high_water: 5 }, NOW, {}).ok).toBe(true); });
    test("stale (past) refused", () => {
        const { kp, doc, trust } = mk(1, NOW - 40 * 24 * 3600 * 1000);
        const r = verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {});
        expect(r.ok).toBe(false);
        if (!r.ok)
            expect(r.reason).toContain("stale");
    });
    test("future beyond skew refused — always, incl. offline", () => {
        const { kp, doc, trust } = mk(1, NOW + 10 * 60 * 1000);
        expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {}).ok).toBe(false);
        expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, { offline: true }).ok).toBe(false);
    });
    test("offline skips past-staleness but keeps sig + anti-rollback", () => {
        const { kp, doc, trust } = mk(1, NOW - 40 * 24 * 3600 * 1000);
        expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, { offline: true }).ok).toBe(true);
    });
});
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";
import { readCache, writeCache } from "./registry-remote.js";
describe("cache I/O", () => {
    let savedHome, savedUP;
    beforeEach(() => {
        savedHome = process.env.HOME;
        savedUP = process.env.USERPROFILE;
        const h = mkdtempSync(pjoin(tmpdir(), "ace-cache-"));
        process.env.HOME = h;
        process.env.USERPROFILE = h;
    });
    afterEach(() => {
        if (savedHome !== undefined)
            process.env.HOME = savedHome;
        else
            delete process.env.HOME;
        if (savedUP !== undefined)
            process.env.USERPROFILE = savedUP;
        else
            delete process.env.USERPROFILE;
    });
    test("write then read round-trips meta + body", () => {
        const body = '{"hello":"world"}';
        const meta = writeCache("https://x/index.json", body, { etag: '"e1"', last_modified: "lm", sequence_high_water: 3 });
        expect(meta.index_content_hash).toMatch(/^blake3:/);
        const got = readCache("https://x/index.json");
        expect(got).not.toBeNull();
        expect(got.body).toBe(body);
        expect(got.meta.etag).toBe('"e1"');
        expect(got.meta.sequence_high_water).toBe(3);
    });
    test("missing → null", () => { expect(readCache("https://nope")).toBeNull(); });
});
import { generateKeypair as gkp } from "./signing.js";
import { signIndex as sidx } from "./index-signature.js";
import { fetchRemoteIndex } from "./registry-remote.js";
function indexJson(kp, seq, issuedAtMs) {
    const content = { format_version: 1, sequence: seq, issued_at: new Date(issuedAtMs).toISOString(),
        packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "blake3:aa" } } } };
    return JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
}
describe("fetchRemoteIndex", () => {
    let savedFetch, savedHome, savedUP;
    beforeEach(() => {
        savedFetch = globalThis.fetch;
        savedHome = process.env.HOME;
        savedUP = process.env.USERPROFILE;
        const h = mkdtempSync(pjoin(tmpdir(), "ace-fetch-"));
        process.env.HOME = h;
        process.env.USERPROFILE = h;
    });
    afterEach(() => {
        globalThis.fetch = savedFetch;
        if (savedHome !== undefined)
            process.env.HOME = savedHome;
        else
            delete process.env.HOME;
        if (savedUP !== undefined)
            process.env.USERPROFILE = savedUP;
        else
            delete process.env.USERPROFILE;
    });
    test("200 verifies + returns entries + caches", async () => {
        const kp = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        globalThis.fetch = (async () => new Response(indexJson(kp, 1, now), { status: 200, headers: { ETag: '"e1"' } }));
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const r = await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, trust, { now });
        expect("entries" in r).toBe(true);
        if ("entries" in r)
            expect(r.entries.get("leaf").get("1.0.0").url).toBe("https://x/l.json");
    });
    test("304 uses cached body", async () => {
        const kp = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        globalThis.fetch = (async () => new Response(indexJson(kp, 2, now), { status: 200, headers: { ETag: '"e2"' } }));
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const remote = { url: "https://x/index.json", key_id: kp.keyId };
        await fetchRemoteIndex(remote, trust, { now });
        globalThis.fetch = (async () => new Response(null, { status: 304 }));
        expect("entries" in await fetchRemoteIndex(remote, trust, { now })).toBe(true);
    });
    test("network error → cache-fallback", async () => {
        const kp = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        globalThis.fetch = (async () => new Response(indexJson(kp, 1, now), { status: 200 }));
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const remote = { url: "https://x/index.json", key_id: kp.keyId };
        await fetchRemoteIndex(remote, trust, { now });
        globalThis.fetch = (async () => { throw new Error("net"); });
        expect("entries" in await fetchRemoteIndex(remote, trust, { now })).toBe(true);
    });
    test("network error + no cache → skipped", async () => {
        const kp = gkp();
        globalThis.fetch = (async () => { throw new Error("net"); });
        expect("skipped" in await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, new Map(), { now: Date.now() })).toBe(true);
    });
    test("rollback on 200 → error (hard refusal)", async () => {
        const kp = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const remote = { url: "https://x/index.json", key_id: kp.keyId };
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        globalThis.fetch = (async () => new Response(indexJson(kp, 5, now), { status: 200 }));
        await fetchRemoteIndex(remote, trust, { now });
        globalThis.fetch = (async () => new Response(indexJson(kp, 2, now), { status: 200 }));
        expect("error" in await fetchRemoteIndex(remote, trust, { now })).toBe(true);
    });
    test("future-dated cached body refused even offline (future-skew always enforced)", async () => {
        const { writeCache } = await import("./registry-remote.js");
        const kp = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const futureBody = indexJson(kp, 1, now + 10 * 60 * 1000); // 10 min future > 5 min skew
        writeCache("https://x/index.json", futureBody, { sequence_high_water: 1 });
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const r = await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, trust, { offline: true, now });
        expect("error" in r).toBe(true);
    });
});
import { loadRegistries } from "./registry-remote.js";
describe("loadRegistries merge precedence", () => {
    let savedFetch, savedHome, savedUP;
    beforeEach(() => {
        savedFetch = globalThis.fetch;
        savedHome = process.env.HOME;
        savedUP = process.env.USERPROFILE;
        const h = mkdtempSync(pjoin(tmpdir(), "ace-load-"));
        process.env.HOME = h;
        process.env.USERPROFILE = h;
    });
    afterEach(() => {
        globalThis.fetch = savedFetch;
        if (savedHome !== undefined)
            process.env.HOME = savedHome;
        else
            delete process.env.HOME;
        if (savedUP !== undefined)
            process.env.USERPROFILE = savedUP;
        else
            delete process.env.USERPROFILE;
    });
    test("remote entries appear; user overrides remote on conflict", async () => {
        const kp = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const content = { format_version: 1, sequence: 1, issued_at: new Date(now).toISOString(),
            packages: { leaf: { "1.0.0": { url: "https://REMOTE/l.json", package_hash: "blake3:rr" } } } };
        const body = JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
        globalThis.fetch = (async () => new Response(body, { status: 200 }));
        const { writeRegistryRemote, addRegistryEntry } = await import("./store.js");
        writeRegistryRemote({ url: "https://x/index.json", key_id: kp.keyId });
        addRegistryEntry("leaf", "1.0.0", { url: "https://LOCAL/l.json", package_hash: "blake3:ll" });
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const r = await loadRegistries({ trustStore: trust, now });
        expect(r.errors).toEqual([]);
        expect(r.registry.get("leaf").get("1.0.0").url).toBe("https://LOCAL/l.json");
    });
    test("a verify failure on a remote → errors (hard)", async () => {
        const kp = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const content = { format_version: 1, sequence: 1, issued_at: new Date(now).toISOString(), packages: {} };
        const body = JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
        globalThis.fetch = (async () => new Response(body, { status: 200 }));
        const { writeRegistryRemote } = await import("./store.js");
        writeRegistryRemote({ url: "https://x/index.json", key_id: "ed25519:WRONGPIN" });
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const r = await loadRegistries({ trustStore: trust, now });
        expect(r.errors.length).toBe(1);
    });
    test("two remotes: first-listed wins on conflict (remote[0] > remote[1])", async () => {
        const kp0 = gkp(), kp1 = gkp();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const mkBody = (kp, url) => {
            const content = { format_version: 1, sequence: 1, issued_at: new Date(now).toISOString(),
                packages: { leaf: { "1.0.0": { url, package_hash: "blake3:xx" } } } };
            return JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
        };
        const body0 = mkBody(kp0, "https://R0/l.json"), body1 = mkBody(kp1, "https://R1/l.json");
        globalThis.fetch = (async (u) => new Response(u === "https://r0/index.json" ? body0 : body1, { status: 200 }));
        const { writeRegistryRemote } = await import("./store.js");
        writeRegistryRemote({ url: "https://r0/index.json", key_id: kp0.keyId }); // listed first
        writeRegistryRemote({ url: "https://r1/index.json", key_id: kp1.keyId }); // listed second
        const trust = new Map([[kp0.keyId, { public_key: kp0.publicSpkiB64 }], [kp1.keyId, { public_key: kp1.publicSpkiB64 }]]);
        const r = await loadRegistries({ trustStore: trust, now });
        expect(r.errors).toEqual([]);
        expect(r.registry.get("leaf").get("1.0.0").url).toBe("https://R0/l.json");
    });
});
// ─── Task B: parseIndex v2 + marks + loadRegistries union-merge ─────────────
import { generateKeypair as gk2 } from "./signing.js";
import { signIndex as si2 } from "./index-signature.js";
function mkV2Index(kp, seq, issuedAtMs, extra = {}) {
    const content = {
        format_version: 2, sequence: seq, issued_at: new Date(issuedAtMs).toISOString(),
        packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "blake3:aa" } } },
        ...extra,
    };
    return JSON.stringify({ ...content, signature: si2(content, kp.privatePem) });
}
describe("parseIndex — v2 + marks (Task B)", () => {
    test("accepts a v2 index with no marks", () => {
        const kp = gk2();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const json = mkV2Index(kp, 1, now);
        const r = parseIndex(json);
        expect("error" in r).toBe(false);
        if (!("error" in r)) {
            expect(r.format_version).toBe(2);
        }
    });
    test("accepts a v2 index with valid revoked + quarantined maps", () => {
        const kp = gk2();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const revoked = { leaf: { "0.9.0": { at: "2026-05-01T00:00:00Z", reason: "CVE-xxx" } } };
        const quarantined = { leaf: { "0.8.0": { at: "2026-04-01T00:00:00Z" } } };
        const json = mkV2Index(kp, 2, now, { revoked, quarantined });
        const r = parseIndex(json);
        expect("error" in r).toBe(false);
        if (!("error" in r)) {
            expect(r.revoked["leaf"]["0.9.0"].reason).toBe("CVE-xxx");
            expect(r.quarantined["leaf"]["0.8.0"].at).toBe("2026-04-01T00:00:00Z");
        }
    });
    test("rejects a v1 index carrying a revoked map", () => {
        const revoked = { leaf: { "0.9.0": { at: "2026-05-01T00:00:00Z" } } };
        const json = JSON.stringify({
            format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z",
            packages: {}, revoked,
            signature: { algo: "ed25519", key_id: "ed25519:k", sig: "BASE64" },
        });
        const r = parseIndex(json);
        expect("error" in r).toBe(true);
        if ("error" in r)
            expect(r.error).toContain("format_version 2");
    });
    test("rejects a v1 index carrying a quarantined map", () => {
        const quarantined = { leaf: { "0.8.0": { at: "2026-04-01T00:00:00Z" } } };
        const json = JSON.stringify({
            format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z",
            packages: {}, quarantined,
            signature: { algo: "ed25519", key_id: "ed25519:k", sig: "BASE64" },
        });
        const r = parseIndex(json);
        expect("error" in r).toBe(true);
        if ("error" in r)
            expect(r.error).toContain("format_version 2");
    });
    test("rejects a malformed revoked map (entry missing at)", () => {
        const revoked = { leaf: { "0.9.0": { reason: "missing-at" } } };
        const json = JSON.stringify({
            format_version: 2, sequence: 1, issued_at: "2026-06-01T12:00:00Z",
            packages: {}, revoked,
            signature: { algo: "ed25519", key_id: "ed25519:k", sig: "BASE64" },
        });
        const r = parseIndex(json);
        expect("error" in r).toBe(true);
        if ("error" in r)
            expect(r.error).toContain("revoked");
    });
    test("rejects a malformed quarantined map (versions entry is not an object)", () => {
        const quarantined = { leaf: "bad" };
        const json = JSON.stringify({
            format_version: 2, sequence: 1, issued_at: "2026-06-01T12:00:00Z",
            packages: {}, quarantined,
            signature: { algo: "ed25519", key_id: "ed25519:k", sig: "BASE64" },
        });
        const r = parseIndex(json);
        expect("error" in r).toBe(true);
        if ("error" in r)
            expect(r.error).toContain("quarantined");
    });
});
import { loadRegistries as lr2 } from "./registry-remote.js";
import { mkdtempSync as mktmp2 } from "node:fs";
import { tmpdir as td2 } from "node:os";
import { join as pj2 } from "node:path";
describe("loadRegistries — union-merge marks (Task B)", () => {
    let savedFetch2, savedHome2, savedUP2;
    beforeEach(() => {
        savedFetch2 = globalThis.fetch;
        savedHome2 = process.env.HOME;
        savedUP2 = process.env.USERPROFILE;
        const h = mktmp2(pj2(td2(), "ace-marks-"));
        process.env.HOME = h;
        process.env.USERPROFILE = h;
    });
    afterEach(() => {
        globalThis.fetch = savedFetch2;
        if (savedHome2 !== undefined)
            process.env.HOME = savedHome2;
        else
            delete process.env.HOME;
        if (savedUP2 !== undefined)
            process.env.USERPROFILE = savedUP2;
        else
            delete process.env.USERPROFILE;
    });
    test("union-merges revoked marks from two remote sources", async () => {
        const kp0 = gk2(), kp1 = gk2();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const mkBody = (kp, revoked) => {
            const content = {
                format_version: 2, sequence: 1, issued_at: new Date(now).toISOString(),
                packages: {}, revoked,
            };
            return JSON.stringify({ ...content, signature: si2(content, kp.privatePem) });
        };
        const body0 = mkBody(kp0, { pkgA: { "1.0.0": { at: "2026-01-01T00:00:00Z", reason: "from-r0" } } });
        const body1 = mkBody(kp1, { pkgB: { "2.0.0": { at: "2026-02-01T00:00:00Z" } } });
        globalThis.fetch = (async (u) => new Response(u === "https://r0/index.json" ? body0 : body1, { status: 200 }));
        const { writeRegistryRemote: wrr2 } = await import("./store.js");
        wrr2({ url: "https://r0/index.json", key_id: kp0.keyId });
        wrr2({ url: "https://r1/index.json", key_id: kp1.keyId });
        const trust = new Map([[kp0.keyId, { public_key: kp0.publicSpkiB64 }], [kp1.keyId, { public_key: kp1.publicSpkiB64 }]]);
        const result = await lr2({ trustStore: trust, now });
        expect(result.errors).toEqual([]);
        expect(result.revoked["pkgA"]?.["1.0.0"]?.reason).toBe("from-r0");
        expect(result.revoked["pkgB"]?.["2.0.0"]?.at).toBe("2026-02-01T00:00:00Z");
        expect(Object.keys(result.quarantined)).toHaveLength(0);
    });
    test("loadRegistries exposes empty revoked/quarantined when no marks in any source", async () => {
        const kp = gk2();
        const now = Date.parse("2026-06-01T12:00:00Z");
        const content = { format_version: 1, sequence: 1, issued_at: new Date(now).toISOString(), packages: {} };
        const body = JSON.stringify({ ...content, signature: si2(content, kp.privatePem) });
        globalThis.fetch = (async () => new Response(body, { status: 200 }));
        const { writeRegistryRemote: wrr3 } = await import("./store.js");
        wrr3({ url: "https://x/index.json", key_id: kp.keyId });
        const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
        const result = await lr2({ trustStore: trust, now });
        expect(result.errors).toEqual([]);
        expect(Object.keys(result.revoked)).toHaveLength(0);
        expect(Object.keys(result.quarantined)).toHaveLength(0);
    });
});
