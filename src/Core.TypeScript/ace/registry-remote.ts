// registry-remote.ts -- Ace slice 6: fetch + verify + anti-rollback + cache + merge of a
// signed remote registry index. Untrusted-input discipline throughout (never throw on bad
// input; return { error } / { skipped }). The package bytes the index points at are still
// hash-pinned + signature-gated downstream (unchanged) — index trust is additive.
import type { AceSignature, RevocationMap, TrustEntry } from "./signing.ts";
import type { IndexSignableContent } from "./index-signature.ts";
import { verifyIndexSignature } from "./index-signature.ts";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Registry, RegistryEntry, RemoteRegistryConfig } from "./store.ts";
import { loadRegistry, readRegistriesConfig, registryCacheDir } from "./store.ts";

export type IndexDoc = IndexSignableContent & { signature: AceSignature };

function isEntry(e: unknown): e is RegistryEntry {
  return !!e && typeof e === "object"
    && typeof (e as RegistryEntry).url === "string"
    && typeof (e as RegistryEntry).package_hash === "string";
}
function isSig(s: unknown): s is AceSignature {
  return !!s && typeof s === "object"
    && (s as AceSignature).algo === "ed25519"
    && typeof (s as AceSignature).key_id === "string"
    && typeof (s as AceSignature).sig === "string";
}

function validMarkMap(m: unknown): boolean {
  if (typeof m !== "object" || m === null) return false;
  for (const name of Object.keys(m as object)) {
    const vs = (m as Record<string, unknown>)[name];
    if (typeof vs !== "object" || vs === null) return false;
    for (const v of Object.keys(vs as object)) {
      const e = (vs as Record<string, unknown>)[v];
      if (typeof e !== "object" || e === null) return false;
      const ee = e as Record<string, unknown>;
      if (typeof ee.at !== "string") return false;
      if (ee.reason !== undefined && typeof ee.reason !== "string") return false;
    }
  }
  return true;
}

export function parseIndex(json: string): IndexDoc | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { error: "index is not valid JSON" }; }
  if (!raw || typeof raw !== "object") return { error: "index is not an object" };
  const o = raw as Record<string, unknown>;
  if (o.format_version !== 1 && o.format_version !== 2) return { error: "unsupported index format_version" };
  if (typeof o.sequence !== "number" || !Number.isInteger(o.sequence) || o.sequence < 0) return { error: "index sequence must be a non-negative integer" };
  if (typeof o.issued_at !== "string" || Number.isNaN(Date.parse(o.issued_at))) return { error: "index issued_at must be RFC3339" };
  if (!o.packages || typeof o.packages !== "object") return { error: "index packages must be an object" };
  const packages: Record<string, Record<string, RegistryEntry>> = {};
  for (const [name, versions] of Object.entries(o.packages as Record<string, unknown>)) {
    if (!versions || typeof versions !== "object") return { error: `index packages.${name} must be an object` };
    const vm: Record<string, RegistryEntry> = {};
    for (const [version, entry] of Object.entries(versions as Record<string, unknown>)) {
      if (!isEntry(entry)) return { error: `index packages.${name}.${version} is malformed` };
      vm[version] = { url: entry.url, package_hash: entry.package_hash };
    }
    packages[name] = vm;
  }
  if (o.revoked !== undefined) {
    if (o.format_version !== 2) return { error: "index revoked map requires format_version 2" };
    if (!validMarkMap(o.revoked)) return { error: "index revoked map is malformed" };
  }
  if (o.quarantined !== undefined) {
    if (o.format_version !== 2) return { error: "index quarantined map requires format_version 2" };
    if (!validMarkMap(o.quarantined)) return { error: "index quarantined map is malformed" };
  }
  if (!isSig(o.signature)) return { error: "index signature is malformed" };
  const doc: IndexDoc = { format_version: o.format_version as number, sequence: o.sequence, issued_at: o.issued_at, packages, signature: o.signature };
  if (o.revoked !== undefined) doc.revoked = o.revoked as RevocationMap;
  if (o.quarantined !== undefined) doc.quarantined = o.quarantined as RevocationMap;
  return doc;
}

export const DEFAULT_MAX_STALENESS_DAYS = 30;
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface CacheMeta {
  url: string; etag?: string; last_modified?: string;
  sequence_high_water: number; index_content_hash: string; fetched_at: string;
}
export interface VerifyOpts { offline?: boolean }

/** The three gates, in order: signature (mandatory pin) → anti-rollback → freshness (two-sided). */
export function verifyIndex(
  doc: IndexDoc, remote: RemoteRegistryConfig, trustStore: Map<string, TrustEntry>,
  cacheMeta: CacheMeta, now: number, opts: VerifyOpts,
): { ok: true } | { ok: false; reason: string } {
  const { signature, ...content } = doc;
  if (signature.key_id !== remote.key_id) return { ok: false, reason: `index not signed by the registry's pinned key ${remote.key_id}` };
  const sv = verifyIndexSignature(content, signature, trustStore);
  if (!sv.ok) return { ok: false, reason: `index signature ${sv.reason}` };
  if (doc.sequence < cacheMeta.sequence_high_water) return { ok: false, reason: `index rollback: sequence ${doc.sequence} < seen ${cacheMeta.sequence_high_water}` };
  const issued = Date.parse(doc.issued_at);
  if (issued - now > MAX_FUTURE_SKEW_MS) return { ok: false, reason: `index issued_at is in the future beyond skew` };
  if (!opts.offline) {
    const maxStaleMs = (remote.max_staleness_days ?? DEFAULT_MAX_STALENESS_DAYS) * 24 * 3600 * 1000;
    if (now - issued > maxStaleMs) return { ok: false, reason: `index is stale (issued_at older than max-staleness)` };
  }
  return { ok: true };
}

function metaPath(url: string): string {
  return join(registryCacheDir(), createHash("sha256").update(url).digest("hex") + ".json");
}
function blobPath(contentHash: string): string {
  return join(registryCacheDir(), "blobs", contentHash.replace("sha256:", "").replace("blake3:", "") + ".json");
}
import { ContentHash256 } from "../blake3/blake3.ts";

function indexContentHash(body: string): string {
  return "blake3:" + ContentHash256.ofBytes(new TextEncoder().encode(body)).toHex();
}

export function readCache(url: string): { meta: CacheMeta; body: string } | null {
  try {
    const meta = JSON.parse(readFileSync(metaPath(url), "utf8")) as CacheMeta;
    if (typeof meta.index_content_hash !== "string") return null;
    if (typeof meta.sequence_high_water !== "number" || !Number.isFinite(meta.sequence_high_water)) return null;
    const body = readFileSync(blobPath(meta.index_content_hash), "utf8");
    return { meta, body };
  } catch { return null; }
}

export function writeCache(
  url: string, body: string,
  fields: { etag?: string; last_modified?: string; sequence_high_water: number },
): CacheMeta {
  const ch = indexContentHash(body);
  mkdirSync(join(registryCacheDir(), "blobs"), { recursive: true });
  writeFileSync(blobPath(ch), body);
  const meta: CacheMeta = {
    url, sequence_high_water: fields.sequence_high_water, index_content_hash: ch,
    fetched_at: new Date().toISOString(),
    ...(fields.etag !== undefined ? { etag: fields.etag } : {}),
    ...(fields.last_modified !== undefined ? { last_modified: fields.last_modified } : {}),
  };
  writeFileSync(metaPath(url), JSON.stringify(meta, null, 2));
  return meta;
}

export interface FetchOpts { offline?: boolean; now?: number }

function toRegistryFragment(doc: IndexDoc): Registry {
  const m: Registry = new Map();
  for (const [name, versions] of Object.entries(doc.packages)) {
    const vm = new Map<string, RegistryEntry>();
    for (const [version, entry] of Object.entries(versions)) vm.set(version, entry);
    m.set(name, vm);
  }
  return m;
}

export async function fetchRemoteIndex(
  remote: RemoteRegistryConfig, trustStore: Map<string, TrustEntry>, opts: FetchOpts = {},
): Promise<{ entries: Registry; marks: { revoked?: RevocationMap; quarantined?: RevocationMap } } | { error: string } | { skipped: string }> {
  const now = opts.now ?? Date.now();
  const cached = readCache(remote.url);
  const cacheMeta: CacheMeta = cached?.meta ?? { url: remote.url, sequence_high_water: 0, index_content_hash: "", fetched_at: "" };

  // Validate a CACHED body through the three gates; never writes (the fresh-200 path writes its own cache).
  const useCachedBody = (body: string): { entries: Registry; marks: { revoked?: RevocationMap; quarantined?: RevocationMap } } | { error: string } => {
    const parsed = parseIndex(body);
    if ("error" in parsed) return { error: `${remote.url}: ${parsed.error}` };
    const v = verifyIndex(parsed, remote, trustStore, cacheMeta, now, { offline: opts.offline === true });
    if (!v.ok) return { error: `${remote.url}: ${v.reason}` };
    const marks: { revoked?: RevocationMap; quarantined?: RevocationMap } = {};
    if (parsed.revoked !== undefined) marks.revoked = parsed.revoked;
    if (parsed.quarantined !== undefined) marks.quarantined = parsed.quarantined;
    return { entries: toRegistryFragment(parsed), marks };
  };

  if (opts.offline) {
    if (!cached) return { skipped: `${remote.url}: offline + no cache` };
    return useCachedBody(cached.body);
  }

  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (cacheMeta.etag) headers["If-None-Match"] = cacheMeta.etag;
    if (cacheMeta.last_modified) headers["If-Modified-Since"] = cacheMeta.last_modified;
    res = await fetch(remote.url, { headers });
  } catch {
    if (cached) return useCachedBody(cached.body);
    return { skipped: `${remote.url}: unreachable + no cache` };
  }

  if (res.status === 304) {
    if (cached) return useCachedBody(cached.body);
    return { skipped: `${remote.url}: 304 but no cache` };
  }
  if (res.status !== 200) {
    if (cached) return useCachedBody(cached.body);
    return { skipped: `${remote.url}: HTTP ${res.status} + no cache` };
  }
  const body = await res.text();
  const parsed = parseIndex(body);
  if ("error" in parsed) return { error: `${remote.url}: ${parsed.error}` };
  const v = verifyIndex(parsed, remote, trustStore, cacheMeta, now, { offline: false });
  if (!v.ok) return { error: `${remote.url}: ${v.reason}` };
  const etag = res.headers.get("ETag") ?? undefined;
  const last_modified = res.headers.get("Last-Modified") ?? undefined;
  writeCache(remote.url, body, {
    sequence_high_water: Math.max(parsed.sequence, cacheMeta.sequence_high_water),
    ...(etag !== undefined ? { etag } : {}),
    ...(last_modified !== undefined ? { last_modified } : {}),
  });
  const freshMarks: { revoked?: RevocationMap; quarantined?: RevocationMap } = {};
  if (parsed.revoked !== undefined) freshMarks.revoked = parsed.revoked;
  if (parsed.quarantined !== undefined) freshMarks.quarantined = parsed.quarantined;
  return { entries: toRegistryFragment(parsed), marks: freshMarks };
}

export interface LoadRegistriesOpts { trustStore: Map<string, TrustEntry>; offline?: boolean; now?: number }

export interface LoadedRegistries {
  registry: Registry;
  revoked: RevocationMap;
  quarantined: RevocationMap;
  warnings: string[];
  errors: string[];
}

/** Merge: remotes (reverse listed order) ∪ bundled ∪ user → user > bundled > remote[0] > … */
export async function loadRegistries(
  opts: LoadRegistriesOpts,
): Promise<LoadedRegistries> {
  const warnings: string[] = []; const errors: string[] = [];
  const remotes = readRegistriesConfig().remotes;
  const fragments: Registry[] = [];
  const markFragments: { revoked?: RevocationMap; quarantined?: RevocationMap }[] = [];
  for (const remote of remotes) {
    const r = await fetchRemoteIndex(remote, opts.trustStore, { offline: opts.offline === true, ...(opts.now !== undefined ? { now: opts.now } : {}) });
    if ("error" in r) errors.push(r.error);
    else if ("skipped" in r) warnings.push(r.skipped);
    else { fragments.push(r.entries); markFragments.push(r.marks); }
  }
  const registry: Registry = new Map();
  const merge = (frag: Registry): void => {
    for (const [name, versions] of frag) {
      const vm = registry.get(name) ?? new Map<string, RegistryEntry>();
      for (const [v, e] of versions) vm.set(v, e);
      registry.set(name, vm);
    }
  };
  for (let i = fragments.length - 1; i >= 0; i--) merge(fragments[i]!);
  merge(loadRegistry());
  const mergedRevoked: RevocationMap = Object.create(null);
  const mergedQuarantined: RevocationMap = Object.create(null);
  const unionMerge = (target: RevocationMap, src: RevocationMap | undefined): void => {
    if (!src) return;
    for (const name of Object.keys(src)) {
      const vs = src[name]!;
      if (!target[name]) target[name] = Object.create(null);
      for (const v of Object.keys(vs)) { target[name]![v] = vs[v]!; }
    }
  };
  for (const mf of markFragments) { unionMerge(mergedRevoked, mf.revoked); unionMerge(mergedQuarantined, mf.quarantined); }
  return { registry, revoked: mergedRevoked, quarantined: mergedQuarantined, warnings, errors };
}
