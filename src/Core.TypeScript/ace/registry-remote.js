import { verifyIndexSignature } from "./index-signature.js";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadRegistry, readRegistriesConfig, registryCacheDir } from "./store.js";
function isEntry(e) {
    return !!e && typeof e === "object"
        && typeof e.url === "string"
        && typeof e.package_hash === "string";
}
function isSig(s) {
    return !!s && typeof s === "object"
        && s.algo === "ed25519"
        && typeof s.key_id === "string"
        && typeof s.sig === "string";
}
function validMarkMap(m) {
    if (typeof m !== "object" || m === null)
        return false;
    for (const name of Object.keys(m)) {
        const vs = m[name];
        if (typeof vs !== "object" || vs === null)
            return false;
        for (const v of Object.keys(vs)) {
            const e = vs[v];
            if (typeof e !== "object" || e === null)
                return false;
            const ee = e;
            if (typeof ee.at !== "string")
                return false;
            if (ee.reason !== undefined && typeof ee.reason !== "string")
                return false;
        }
    }
    return true;
}
export function parseIndex(json) {
    let raw;
    try {
        raw = JSON.parse(json);
    }
    catch {
        return { error: "index is not valid JSON" };
    }
    if (!raw || typeof raw !== "object")
        return { error: "index is not an object" };
    const o = raw;
    if (o.format_version !== 1 && o.format_version !== 2)
        return { error: "unsupported index format_version" };
    if (typeof o.sequence !== "number" || !Number.isInteger(o.sequence) || o.sequence < 0)
        return { error: "index sequence must be a non-negative integer" };
    if (typeof o.issued_at !== "string" || Number.isNaN(Date.parse(o.issued_at)))
        return { error: "index issued_at must be RFC3339" };
    if (!o.packages || typeof o.packages !== "object")
        return { error: "index packages must be an object" };
    const packages = {};
    for (const [name, versions] of Object.entries(o.packages)) {
        if (!versions || typeof versions !== "object")
            return { error: `index packages.${name} must be an object` };
        const vm = {};
        for (const [version, entry] of Object.entries(versions)) {
            if (!isEntry(entry))
                return { error: `index packages.${name}.${version} is malformed` };
            vm[version] = { url: entry.url, package_hash: entry.package_hash };
        }
        packages[name] = vm;
    }
    if (o.revoked !== undefined) {
        if (o.format_version !== 2)
            return { error: "index revoked map requires format_version 2" };
        if (!validMarkMap(o.revoked))
            return { error: "index revoked map is malformed" };
    }
    if (o.quarantined !== undefined) {
        if (o.format_version !== 2)
            return { error: "index quarantined map requires format_version 2" };
        if (!validMarkMap(o.quarantined))
            return { error: "index quarantined map is malformed" };
    }
    if (!isSig(o.signature))
        return { error: "index signature is malformed" };
    const doc = { format_version: o.format_version, sequence: o.sequence, issued_at: o.issued_at, packages, signature: o.signature };
    if (o.revoked !== undefined)
        doc.revoked = o.revoked;
    if (o.quarantined !== undefined)
        doc.quarantined = o.quarantined;
    return doc;
}
export const DEFAULT_MAX_STALENESS_DAYS = 30;
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
/** The three gates, in order: signature (mandatory pin) → anti-rollback → freshness (two-sided). */
export function verifyIndex(doc, remote, trustStore, cacheMeta, now, opts) {
    const { signature, ...content } = doc;
    if (signature.key_id !== remote.key_id)
        return { ok: false, reason: `index not signed by the registry's pinned key ${remote.key_id}` };
    const sv = verifyIndexSignature(content, signature, trustStore);
    if (!sv.ok)
        return { ok: false, reason: `index signature ${sv.reason}` };
    if (doc.sequence < cacheMeta.sequence_high_water)
        return { ok: false, reason: `index rollback: sequence ${doc.sequence} < seen ${cacheMeta.sequence_high_water}` };
    const issued = Date.parse(doc.issued_at);
    if (issued - now > MAX_FUTURE_SKEW_MS)
        return { ok: false, reason: `index issued_at is in the future beyond skew` };
    if (!opts.offline) {
        const maxStaleMs = (remote.max_staleness_days ?? DEFAULT_MAX_STALENESS_DAYS) * 24 * 3600 * 1000;
        if (now - issued > maxStaleMs)
            return { ok: false, reason: `index is stale (issued_at older than max-staleness)` };
    }
    return { ok: true };
}
function metaPath(url) {
    return join(registryCacheDir(), createHash("sha256").update(url).digest("hex") + ".json");
}
function blobPath(contentHash) {
    return join(registryCacheDir(), "blobs", contentHash.replace("sha256:", "").replace("blake3:", "") + ".json");
}
import { ContentHash256 } from "../blake3/blake3.js";
function indexContentHash(body) {
    return "blake3:" + ContentHash256.ofBytes(new TextEncoder().encode(body)).toHex();
}
export function readCache(url) {
    try {
        const meta = JSON.parse(readFileSync(metaPath(url), "utf8"));
        if (typeof meta.index_content_hash !== "string")
            return null;
        if (typeof meta.sequence_high_water !== "number" || !Number.isFinite(meta.sequence_high_water))
            return null;
        const body = readFileSync(blobPath(meta.index_content_hash), "utf8");
        return { meta, body };
    }
    catch {
        return null;
    }
}
export function writeCache(url, body, fields) {
    const ch = indexContentHash(body);
    mkdirSync(join(registryCacheDir(), "blobs"), { recursive: true });
    writeFileSync(blobPath(ch), body);
    const meta = {
        url, sequence_high_water: fields.sequence_high_water, index_content_hash: ch,
        fetched_at: new Date().toISOString(),
        ...(fields.etag !== undefined ? { etag: fields.etag } : {}),
        ...(fields.last_modified !== undefined ? { last_modified: fields.last_modified } : {}),
    };
    writeFileSync(metaPath(url), JSON.stringify(meta, null, 2));
    return meta;
}
function toRegistryFragment(doc) {
    const m = new Map();
    for (const [name, versions] of Object.entries(doc.packages)) {
        const vm = new Map();
        for (const [version, entry] of Object.entries(versions))
            vm.set(version, entry);
        m.set(name, vm);
    }
    return m;
}
export async function fetchRemoteIndex(remote, trustStore, opts = {}) {
    const now = opts.now ?? Date.now();
    const cached = readCache(remote.url);
    const cacheMeta = cached?.meta ?? { url: remote.url, sequence_high_water: 0, index_content_hash: "", fetched_at: "" };
    // Validate a CACHED body through the three gates; never writes (the fresh-200 path writes its own cache).
    const useCachedBody = (body) => {
        const parsed = parseIndex(body);
        if ("error" in parsed)
            return { error: `${remote.url}: ${parsed.error}` };
        const v = verifyIndex(parsed, remote, trustStore, cacheMeta, now, { offline: opts.offline === true });
        if (!v.ok)
            return { error: `${remote.url}: ${v.reason}` };
        const marks = {};
        if (parsed.revoked !== undefined)
            marks.revoked = parsed.revoked;
        if (parsed.quarantined !== undefined)
            marks.quarantined = parsed.quarantined;
        return { entries: toRegistryFragment(parsed), marks };
    };
    if (opts.offline) {
        if (!cached)
            return { skipped: `${remote.url}: offline + no cache` };
        return useCachedBody(cached.body);
    }
    let res;
    try {
        const headers = {};
        if (cacheMeta.etag)
            headers["If-None-Match"] = cacheMeta.etag;
        if (cacheMeta.last_modified)
            headers["If-Modified-Since"] = cacheMeta.last_modified;
        res = await fetch(remote.url, { headers });
    }
    catch {
        if (cached)
            return useCachedBody(cached.body);
        return { skipped: `${remote.url}: unreachable + no cache` };
    }
    if (res.status === 304) {
        if (cached)
            return useCachedBody(cached.body);
        return { skipped: `${remote.url}: 304 but no cache` };
    }
    if (res.status !== 200) {
        if (cached)
            return useCachedBody(cached.body);
        return { skipped: `${remote.url}: HTTP ${res.status} + no cache` };
    }
    const body = await res.text();
    const parsed = parseIndex(body);
    if ("error" in parsed)
        return { error: `${remote.url}: ${parsed.error}` };
    const v = verifyIndex(parsed, remote, trustStore, cacheMeta, now, { offline: false });
    if (!v.ok)
        return { error: `${remote.url}: ${v.reason}` };
    const etag = res.headers.get("ETag") ?? undefined;
    const last_modified = res.headers.get("Last-Modified") ?? undefined;
    writeCache(remote.url, body, {
        sequence_high_water: Math.max(parsed.sequence, cacheMeta.sequence_high_water),
        ...(etag !== undefined ? { etag } : {}),
        ...(last_modified !== undefined ? { last_modified } : {}),
    });
    const freshMarks = {};
    if (parsed.revoked !== undefined)
        freshMarks.revoked = parsed.revoked;
    if (parsed.quarantined !== undefined)
        freshMarks.quarantined = parsed.quarantined;
    return { entries: toRegistryFragment(parsed), marks: freshMarks };
}
/** Merge: remotes (reverse listed order) ∪ bundled ∪ user → user > bundled > remote[0] > … */
export async function loadRegistries(opts) {
    const warnings = [];
    const errors = [];
    const remotes = readRegistriesConfig().remotes;
    const fragments = [];
    const markFragments = [];
    for (const remote of remotes) {
        const r = await fetchRemoteIndex(remote, opts.trustStore, { offline: opts.offline === true, ...(opts.now !== undefined ? { now: opts.now } : {}) });
        if ("error" in r)
            errors.push(r.error);
        else if ("skipped" in r)
            warnings.push(r.skipped);
        else {
            fragments.push(r.entries);
            markFragments.push(r.marks);
        }
    }
    const registry = new Map();
    const merge = (frag) => {
        for (const [name, versions] of frag) {
            const vm = registry.get(name) ?? new Map();
            for (const [v, e] of versions)
                vm.set(v, e);
            registry.set(name, vm);
        }
    };
    for (let i = fragments.length - 1; i >= 0; i--)
        merge(fragments[i]);
    merge(loadRegistry());
    const mergedRevoked = Object.create(null);
    const mergedQuarantined = Object.create(null);
    const unionMerge = (target, src) => {
        if (!src)
            return;
        for (const name of Object.keys(src)) {
            const vs = src[name];
            if (!target[name])
                target[name] = Object.create(null);
            for (const v of Object.keys(vs)) {
                target[name][v] = vs[v];
            }
        }
    };
    for (const mf of markFragments) {
        unionMerge(mergedRevoked, mf.revoked);
        unionMerge(mergedQuarantined, mf.quarantined);
    }
    return { registry, revoked: mergedRevoked, quarantined: mergedQuarantined, warnings, errors };
}
