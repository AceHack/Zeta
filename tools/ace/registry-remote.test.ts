import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { parseIndex } from "./registry-remote.ts";
import type { TrustEntry } from "./signing.ts";
import { generateKeypair, signIndex } from "./signing.ts";
import { verifyIndex, type CacheMeta } from "./registry-remote.ts";

const good = JSON.stringify({
  format_version: 1, sequence: 2, issued_at: "2026-06-01T12:00:00Z",
  packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "sha256:aa" } } },
  signature: { algo: "ed25519", key_id: "ed25519:k", sig: "BASE64" },
});

describe("parseIndex", () => {
  test("parses a well-formed index", () => {
    const r = parseIndex(good);
    expect("error" in r).toBe(false);
    if (!("error" in r)) { expect(r.sequence).toBe(2); expect(r.packages.leaf!["1.0.0"]!.url).toBe("https://x/l.json"); }
  });
  test.each([
    ["not json", "{"],
    ["bad format_version", JSON.stringify({ format_version: 2, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
    ["negative sequence", JSON.stringify({ format_version: 1, sequence: -1, issued_at: "2026-06-01T12:00:00Z", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
    ["unparseable issued_at", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "nope", packages: {}, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
    ["missing signature", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: {} })],
    ["non-string url", JSON.stringify({ format_version: 1, sequence: 1, issued_at: "2026-06-01T12:00:00Z", packages: { a: { "1.0.0": { url: 5, package_hash: "h" } } }, signature: { algo: "ed25519", key_id: "k", sig: "s" } })],
  ])("rejects %s (no throw)", (_label, json) => {
    expect("error" in parseIndex(json)).toBe(true);
  });
});

function mk(seq: number, issuedAtMs: number) {
  const kp = generateKeypair();
  const content = { format_version: 1 as const, sequence: seq, issued_at: new Date(issuedAtMs).toISOString(),
    packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "sha256:aa" } } } };
  const doc = { ...content, signature: signIndex(content, kp.privatePem) };
  const trust = new Map<string, TrustEntry>([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
  return { kp, doc, trust };
}
const remoteOf = (keyId: string) => ({ url: "https://x/index.json", key_id: keyId });
const NOW = Date.parse("2026-06-01T12:00:00Z");
const meta0: CacheMeta = { url: "https://x/index.json", sequence_high_water: 0, index_content_hash: "", fetched_at: "" };

describe("verifyIndex (three gates)", () => {
  test("all gates pass", () => { const { kp, doc, trust } = mk(1, NOW); expect(verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {}).ok).toBe(true); });
  test("untrusted signer refused", () => { const { doc, kp } = mk(1, NOW); expect(verifyIndex(doc, remoteOf(kp.keyId), new Map(), meta0, NOW, {}).ok).toBe(false); });
  test("trusted-but-not-pinned key refused (mandatory pin)", () => {
    const { doc, trust } = mk(1, NOW);
    const r = verifyIndex(doc, remoteOf("ed25519:someoneelse"), trust, meta0, NOW, {});
    expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toContain("pinned");
  });
  test("rollback refused", () => {
    const { kp, doc, trust } = mk(2, NOW);
    const r = verifyIndex(doc, remoteOf(kp.keyId), trust, { ...meta0, sequence_high_water: 5 }, NOW, {});
    expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toContain("rollback");
  });
  test("equal sequence accepted", () => { const { kp, doc, trust } = mk(5, NOW); expect(verifyIndex(doc, remoteOf(kp.keyId), trust, { ...meta0, sequence_high_water: 5 }, NOW, {}).ok).toBe(true); });
  test("stale (past) refused", () => {
    const { kp, doc, trust } = mk(1, NOW - 40 * 24 * 3600 * 1000);
    const r = verifyIndex(doc, remoteOf(kp.keyId), trust, meta0, NOW, {});
    expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toContain("stale");
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
import { readCache, writeCache } from "./registry-remote.ts";

describe("cache I/O", () => {
  let savedHome: string | undefined, savedUP: string | undefined;
  beforeEach(() => { savedHome = process.env.HOME; savedUP = process.env.USERPROFILE;
    const h = mkdtempSync(pjoin(tmpdir(), "ace-cache-")); process.env.HOME = h; process.env.USERPROFILE = h; });
  afterEach(() => { if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
    if (savedUP !== undefined) process.env.USERPROFILE = savedUP; else delete process.env.USERPROFILE; });

  test("write then read round-trips meta + body", () => {
    const body = '{"hello":"world"}';
    const meta = writeCache("https://x/index.json", body, { etag: '"e1"', last_modified: "lm", sequence_high_water: 3 });
    expect(meta.index_content_hash).toMatch(/^sha256:/);
    const got = readCache("https://x/index.json");
    expect(got).not.toBeNull();
    expect(got!.body).toBe(body);
    expect(got!.meta.etag).toBe('"e1"');
    expect(got!.meta.sequence_high_water).toBe(3);
  });
  test("missing → null", () => { expect(readCache("https://nope")).toBeNull(); });
});

import { generateKeypair as gkp, signIndex as sidx } from "./signing.ts";
import { fetchRemoteIndex } from "./registry-remote.ts";

function indexJson(kp: { privatePem: string }, seq: number, issuedAtMs: number) {
  const content = { format_version: 1 as const, sequence: seq, issued_at: new Date(issuedAtMs).toISOString(),
    packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "sha256:aa" } } } };
  return JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
}

describe("fetchRemoteIndex", () => {
  let savedFetch: typeof globalThis.fetch, savedHome: string | undefined, savedUP: string | undefined;
  beforeEach(() => { savedFetch = globalThis.fetch; savedHome = process.env.HOME; savedUP = process.env.USERPROFILE;
    const h = mkdtempSync(pjoin(tmpdir(), "ace-fetch-")); process.env.HOME = h; process.env.USERPROFILE = h; });
  afterEach(() => { globalThis.fetch = savedFetch;
    if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
    if (savedUP !== undefined) process.env.USERPROFILE = savedUP; else delete process.env.USERPROFILE; });

  test("200 verifies + returns entries + caches", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    globalThis.fetch = (async () => new Response(indexJson(kp, 1, now), { status: 200, headers: { ETag: '"e1"' } })) as unknown as typeof fetch;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, trust, { now });
    expect("entries" in r).toBe(true);
    if ("entries" in r) expect(r.entries.get("leaf")!.get("1.0.0")!.url).toBe("https://x/l.json");
  });
  test("304 uses cached body", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    globalThis.fetch = (async () => new Response(indexJson(kp, 2, now), { status: 200, headers: { ETag: '"e2"' } })) as unknown as typeof fetch;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const remote = { url: "https://x/index.json", key_id: kp.keyId };
    await fetchRemoteIndex(remote, trust, { now });
    globalThis.fetch = (async () => new Response(null, { status: 304 })) as unknown as typeof fetch;
    expect("entries" in await fetchRemoteIndex(remote, trust, { now })).toBe(true);
  });
  test("network error → cache-fallback", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    globalThis.fetch = (async () => new Response(indexJson(kp, 1, now), { status: 200 })) as unknown as typeof fetch;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const remote = { url: "https://x/index.json", key_id: kp.keyId };
    await fetchRemoteIndex(remote, trust, { now });
    globalThis.fetch = (async () => { throw new Error("net"); }) as unknown as typeof fetch;
    expect("entries" in await fetchRemoteIndex(remote, trust, { now })).toBe(true);
  });
  test("network error + no cache → skipped", async () => {
    const kp = gkp();
    globalThis.fetch = (async () => { throw new Error("net"); }) as unknown as typeof fetch;
    expect("skipped" in await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, new Map(), { now: Date.now() })).toBe(true);
  });
  test("rollback on 200 → error (hard refusal)", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const remote = { url: "https://x/index.json", key_id: kp.keyId };
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    globalThis.fetch = (async () => new Response(indexJson(kp, 5, now), { status: 200 })) as unknown as typeof fetch;
    await fetchRemoteIndex(remote, trust, { now });
    globalThis.fetch = (async () => new Response(indexJson(kp, 2, now), { status: 200 })) as unknown as typeof fetch;
    expect("error" in await fetchRemoteIndex(remote, trust, { now })).toBe(true);
  });
  test("future-dated cached body refused even offline (future-skew always enforced)", async () => {
    const { writeCache } = await import("./registry-remote.ts");
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const futureBody = indexJson(kp, 1, now + 10 * 60 * 1000); // 10 min future > 5 min skew
    writeCache("https://x/index.json", futureBody, { sequence_high_water: 1 });
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = await fetchRemoteIndex({ url: "https://x/index.json", key_id: kp.keyId }, trust, { offline: true, now });
    expect("error" in r).toBe(true);
  });
});

import { loadRegistries } from "./registry-remote.ts";

describe("loadRegistries merge precedence", () => {
  let savedFetch: typeof globalThis.fetch, savedHome: string | undefined, savedUP: string | undefined;
  beforeEach(() => { savedFetch = globalThis.fetch; savedHome = process.env.HOME; savedUP = process.env.USERPROFILE;
    const h = mkdtempSync(pjoin(tmpdir(), "ace-load-")); process.env.HOME = h; process.env.USERPROFILE = h; });
  afterEach(() => { globalThis.fetch = savedFetch;
    if (savedHome !== undefined) process.env.HOME = savedHome; else delete process.env.HOME;
    if (savedUP !== undefined) process.env.USERPROFILE = savedUP; else delete process.env.USERPROFILE; });

  test("remote entries appear; user overrides remote on conflict", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const content = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(),
      packages: { leaf: { "1.0.0": { url: "https://REMOTE/l.json", package_hash: "sha256:rr" } } } };
    const body = JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
    globalThis.fetch = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    const { writeRegistryRemote, addRegistryEntry } = await import("./store.ts");
    writeRegistryRemote({ url: "https://x/index.json", key_id: kp.keyId });
    addRegistryEntry("leaf", "1.0.0", { url: "https://LOCAL/l.json", package_hash: "sha256:ll" });
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = await loadRegistries({ trustStore: trust, now });
    expect(r.errors).toEqual([]);
    expect(r.registry.get("leaf")!.get("1.0.0")!.url).toBe("https://LOCAL/l.json");
  });
  test("a verify failure on a remote → errors (hard)", async () => {
    const kp = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const content = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(), packages: {} };
    const body = JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
    globalThis.fetch = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    const { writeRegistryRemote } = await import("./store.ts");
    writeRegistryRemote({ url: "https://x/index.json", key_id: "ed25519:WRONGPIN" });
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = await loadRegistries({ trustStore: trust, now });
    expect(r.errors.length).toBe(1);
  });
  test("two remotes: first-listed wins on conflict (remote[0] > remote[1])", async () => {
    const kp0 = gkp(), kp1 = gkp(); const now = Date.parse("2026-06-01T12:00:00Z");
    const mkBody = (kp: typeof kp0, url: string) => {
      const content = { format_version: 1 as const, sequence: 1, issued_at: new Date(now).toISOString(),
        packages: { leaf: { "1.0.0": { url, package_hash: "sha256:xx" } } } };
      return JSON.stringify({ ...content, signature: sidx(content, kp.privatePem) });
    };
    const body0 = mkBody(kp0, "https://R0/l.json"), body1 = mkBody(kp1, "https://R1/l.json");
    globalThis.fetch = (async (u: string) => new Response(u === "https://r0/index.json" ? body0 : body1, { status: 200 })) as unknown as typeof fetch;
    const { writeRegistryRemote } = await import("./store.ts");
    writeRegistryRemote({ url: "https://r0/index.json", key_id: kp0.keyId }); // listed first
    writeRegistryRemote({ url: "https://r1/index.json", key_id: kp1.keyId }); // listed second
    const trust = new Map([[kp0.keyId, { public_key: kp0.publicSpkiB64 }], [kp1.keyId, { public_key: kp1.publicSpkiB64 }]]);
    const r = await loadRegistries({ trustStore: trust, now });
    expect(r.errors).toEqual([]);
    expect(r.registry.get("leaf")!.get("1.0.0")!.url).toBe("https://R0/l.json");
  });
});
