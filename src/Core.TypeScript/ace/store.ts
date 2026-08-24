import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stringCompare } from "../collation/collation.ts";

export type AceDependency =
  | { readonly kind: "inline"; readonly name: string; readonly version: string; readonly url: string; readonly package_hash: string }
  | { readonly kind: "registry"; readonly name: string; readonly version: string };

export interface AceManifest {
  readonly format_version: number;
  readonly name: string;
  readonly version: string;
  readonly content_hash: string; // slice-2: sha256(files)
  readonly description?: string;
  readonly signature?: { readonly algo: string; readonly key_id: string; readonly sig: string };
  readonly dependencies?: ReadonlyArray<AceDependency>;
  /**
   * SELF-DECLARED capability list — what this package's own publisher says the code may touch.
   * A DECLARATION, not an authorization and not an enforcement: see capability-manifest.ts for
   * the full statement of what it does and does not mean. No signing change was needed to bind
   * it, because signing.ts covers the whole manifest minus `signature`; an entry added, edited,
   * or stripped after signing is `bad-signature`.
   */
  readonly capabilities?: ReadonlyArray<string>;
}

export interface InstalledPackage {
  readonly hash: string;
  readonly manifest: AceManifest;
}

export function defaultStorePath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "store");
}

import { ContentHash256 } from "../blake3/blake3.ts";

/** Content hash of raw bytes, in the `blake3:<hex>` form Ace manifests use. */
export function contentHash(bytes: Uint8Array): string {
  return "blake3:" + ContentHash256.ofBytes(bytes).toHex();
}

export function listInstalled(storePath: string): InstalledPackage[] {
  if (!existsSync(storePath)) {
    return [];
  }

  try {
    if (!statSync(storePath).isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  let entries: Dirent<string>[];
  try {
    entries = readdirSync(storePath, { withFileTypes: true });
  } catch {
    return [];
  }
  const packages: InstalledPackage[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(storePath, entry.name, "manifest.json");
    if (!existsSync(manifestPath)) continue;

    try {
      const raw = readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(raw) as AceManifest;
      if (
        typeof manifest.format_version !== "number" ||
        typeof manifest.name !== "string" ||
        typeof manifest.version !== "string" ||
        typeof manifest.content_hash !== "string"
      ) {
        continue;
      }
      packages.push({ hash: entry.name, manifest });
    } catch {
      continue;
    }
  }

  return packages.sort((a, b) => stringCompare(a.manifest.name, b.manifest.name));
}

export interface AcePackage {
  readonly manifest: AceManifest;
  readonly files: Readonly<Record<string, string>>;
}

export type InstallResult = { ok: true; dir: string } | { ok: false; error: string };

/** Returns the first unsafe file path in the package, or null if all paths are safe.
 *  Unsafe = contains '..', or is absolute (leading '/' or '\\'), or is a Windows drive
 *  path (drive-absolute like 'C:\...' or drive-relative like 'C:foo'). Shared by
 *  installPackage AND the slice-4 graph install preflight so the two never drift. */
export function validatePackagePaths(pkg: AcePackage): string | null {
  for (const rel of Object.keys(pkg.files)) {
    if (rel.includes("..") || rel.startsWith("/") || rel.startsWith("\\") || /^[A-Za-z]:/.test(rel)) return rel;
  }
  return null;
}

/**
 * Verify-before-extract: recompute the content hash of `pkg.files` and refuse to
 * extract unless it matches `pkg.manifest.content_hash` (integrity). Extracts to
 * `<storePath>/<hash-with-':'-as-'-'>/` with a `manifest.json`. INTEGRITY ONLY —
 * authenticity (signatures) is a separate concern handled in ace.ts + signing.ts.
 */
export function installPackage(storePath: string, pkg: AcePackage): InstallResult {
  const filesJson = JSON.stringify(pkg.files);
  const actual = contentHash(new TextEncoder().encode(filesJson));
  if (actual !== pkg.manifest.content_hash) {
    return { ok: false, error: `content hash mismatch: manifest says ${pkg.manifest.content_hash}, computed ${actual}` };
  }
  // Validate ALL file paths BEFORE creating any directory or writing any file, so a
  // traversal-blocked install refuses ATOMICALLY (extracts nothing) — the same guarantee a
  // hash mismatch gives. (Validating inside the write loop would leave a partial dir on disk
  // when a bad path is not the first entry.) Reject any '..' component (POSIX `../` or Windows
  // `..\`) or absolute path (leading '/' or '\') or Windows drive path ('C:\...' or 'C:foo').
  //
  // NOTE (slice-4 hardening):
  //   Windows drive paths (C:\Windows\... and C:foo) are now rejected here. On Windows,
  //   path.join(store, "C:\\x") discards the store prefix, enabling an escape from the store
  //   directory. The /^[A-Za-z]:/ regex catches both drive-absolute and drive-relative forms.
  //
  // NOTE (slice-3 hardening):
  //   (b) CONTENT/SOURCE: the `install <url>` verb fetches package bytes over HTTP and writes
  //       them here (CodeQL js/http-to-file-access, accepted). The write is confined to
  //       `<storePath>/<hash>/` (path guard above) and the bytes are integrity-checked against
  //       the manifest hash. Authenticity (signature over a trusted key) now EXISTS — `ace install`
  //       runs the Ed25519 signature gate (see `ace.ts` + `signing.ts`); a package installed via
  //       the signed+trusted path is authenticity-verified, and `--allow-no-signature` is required to
  //       install an unsigned one. The CodeQL js/http-to-file-access alert remains a true
  //       intended-flow observation (the http→file write is the package manager's function).
  const unsafe = validatePackagePaths(pkg);
  if (unsafe !== null) {
    return { ok: false, error: `unsafe file path in package: ${unsafe}` };
  }
  const dir = join(storePath, pkg.manifest.content_hash.replace(":", "-"));
  try {
    mkdirSync(dir, { recursive: true });
    for (const [rel, contents] of Object.entries(pkg.files)) {
      const dest = join(dir, rel);
      mkdirSync(join(dest, ".."), { recursive: true });
      writeFileSync(dest, contents);
    }
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(pkg.manifest, null, 2));
    return { ok: true, dir };
  } catch (e) {
    return { ok: false, error: `extract failed: ${(e as Error).message}` };
  }
}

// ---- Trust store (slice 3) ----

export interface TrustedKey { key_id: string; public_key: string; label?: string; added?: string; }
export interface LoadedTrustEntry { public_key: string; label?: string; source: "bundled" | "user"; }

/** ~/.ace/trusted-keys.json — operator-managed keyring (sibling of the store). */
export function trustStorePath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "trusted-keys.json");
}

/** src/Core.TypeScript/ace/trusted-keys.json — the in-repo bundled root anchor (ships empty). */
export function bundledTrustPath(): string {
  // node:url + import.meta.url is the standard-ESM portable idiom (works on Bun AND
  // Node >= 22.5); import.meta.dir is Bun-only and would be undefined under Node,
  // silently breaking the bundled-anchor path. Keep this portable per the skill's Node-floor claim.
  return join(dirname(fileURLToPath(import.meta.url)), "trusted-keys.json");
}

function readKeysFile(p: string): TrustedKey[] {
  if (!existsSync(p)) return [];
  try {
    const arr = JSON.parse(readFileSync(p, "utf8"));
    if (!Array.isArray(arr)) return [];
    return arr.filter((k) => k && typeof k.key_id === "string" && typeof k.public_key === "string");
  } catch {
    return [];
  }
}

function makeTrustEntry(k: TrustedKey, source: "bundled" | "user"): LoadedTrustEntry {
  const entry: LoadedTrustEntry = { public_key: k.public_key, source };
  if (k.label !== undefined) entry.label = k.label;
  return entry;
}

/** bundled ∪ user; user entries override bundled on key_id collision. */
export function loadTrustStore(
  bundledPath: string = bundledTrustPath(), userPath: string = trustStorePath(),
): Map<string, LoadedTrustEntry> {
  const m = new Map<string, LoadedTrustEntry>();
  for (const k of readKeysFile(bundledPath)) m.set(k.key_id, makeTrustEntry(k, "bundled"));
  for (const k of readKeysFile(userPath)) m.set(k.key_id, makeTrustEntry(k, "user"));
  return m;
}

/** Append to the user store (create if absent); dedup by key_id.
 * Tightens ~/.ace to 0o700 AND the trust file to 0o600 (both owner-only) on EVERY call — including the dedup early-return path — so a pre-existing permissive
 * file (e.g. from an old version or bad umask) is always corrected. chmod after write
 * because writeFileSync's mode option only applies on file creation, not on overwrite.
 */
export function addTrustedKey(entry: TrustedKey, userPath: string = trustStorePath()): { added: boolean } {
  const dir = dirname(userPath);
  // Tighten the ~/.ace DIR to 0o700 FIRST — before reading or writing the trust file — so a
  // pre-existing group/world-writable dir cannot let another local user swap trusted-keys.json
  // during the read/write window (TOCTOU). mkdirSync's mode only applies on create, so chmod the
  // (possibly pre-existing) dir explicitly right after. File mode is tightened after each write
  // (writeFileSync's mode only applies on create too).
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* best-effort; unusual FS */ }
  const tightenFile = (): void => {
    if (existsSync(userPath)) { try { chmodSync(userPath, 0o600); } catch { /* best-effort; unusual FS */ } }
  };
  const existing = readKeysFile(userPath);
  if (existing.some((k) => k.key_id === entry.key_id)) {
    tightenFile(); // dedup path: nothing to write, but correct a pre-existing permissive file
    return { added: false };
  }
  existing.push({ ...entry, added: entry.added ?? new Date().toISOString() });
  writeFileSync(userPath, JSON.stringify(existing, null, 2));
  chmodSync(userPath, 0o600);
  return { added: true };
}

export function listTrustedKeys(
  bundledPath: string = bundledTrustPath(), userPath: string = trustStorePath(),
): Array<{ key_id: string; label?: string; source: "bundled" | "user" }> {
  return [...loadTrustStore(bundledPath, userPath).entries()].map(([key_id, v]) => {
    const row: { key_id: string; label?: string; source: "bundled" | "user" } = { key_id, source: v.source };
    if (v.label !== undefined) row.label = v.label;
    return row;
  });
}

// ---- Registry (slice 5.1) ----

export interface RegistryEntry { readonly url: string; readonly package_hash: string; }
export type Registry = Map<string, Map<string, RegistryEntry>>; // name → version → entry

/** ~/.ace/registry.json — operator-managed (sibling of trusted-keys.json). */
export function registryPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "registry.json");
}

/** src/Core.TypeScript/ace/registry.json — bundled root anchor (ships `{}`). Portable ESM idiom (per bundledTrustPath). */
export function bundledRegistryPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "registry.json");
}

/** Parse a registry file into the on-disk object shape; {} on missing/malformed (non-fatal). */
function readRegistryFile(p: string): Record<string, Record<string, RegistryEntry>> {
  if (!existsSync(p)) return {};
  try {
    const obj = JSON.parse(readFileSync(p, "utf8"));
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return {};
    return obj as Record<string, Record<string, RegistryEntry>>;
  } catch { return {}; }
}

/** bundled ∪ user; user overrides bundled on (name, version). */
export function loadRegistry(bundledPath: string = bundledRegistryPath(), userPath: string = registryPath()): Registry {
  const m: Registry = new Map();
  const merge = (src: Record<string, Record<string, RegistryEntry>>): void => {
    for (const [name, versions] of Object.entries(src)) {
      if (typeof versions !== "object" || versions === null) continue;
      let vm = m.get(name);
      if (!vm) { vm = new Map(); m.set(name, vm); }
      for (const [version, entry] of Object.entries(versions)) {
        if (entry && typeof (entry as RegistryEntry).url === "string" && typeof (entry as RegistryEntry).package_hash === "string") {
          vm.set(version, { url: (entry as RegistryEntry).url, package_hash: (entry as RegistryEntry).package_hash });
        }
      }
    }
  };
  merge(readRegistryFile(bundledPath));
  merge(readRegistryFile(userPath));
  return m;
}

/** Add/overwrite a user-registry entry; dir 0o700, file 0o600 on EVERY call (incl. the identical
 * no-op path) — mirrors addTrustedKey. Re-adding the same name@version with a DIFFERING url or
 * package_hash overwrites the stale pin (returns updated:true); an identical re-add is an idempotent
 * no-op (added:false, updated:false). chmod after write (writeFileSync mode only applies on create). */
export function addRegistryEntry(name: string, version: string, entry: RegistryEntry, userPath: string = registryPath()): { added: boolean; updated: boolean } {
  const dir = dirname(userPath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { chmodSync(dir, 0o700); } catch { /* best-effort */ }
  const tightenFile = (): void => { if (existsSync(userPath)) { try { chmodSync(userPath, 0o600); } catch { /* best-effort */ } } };
  // Null-prototype working copy: a user-controlled "__proto__"/"constructor" name or version
  // cannot trigger prototype pollution on the bracket assignments below (the registry file can
  // be operator-edited or shared, so its keys are untrusted).
  const raw = readRegistryFile(userPath);
  const obj = Object.create(null) as Record<string, Record<string, RegistryEntry>>;
  for (const [n, vs] of Object.entries(raw)) {
    if (typeof vs !== "object" || vs === null) continue;
    const inner = Object.create(null) as Record<string, RegistryEntry>;
    for (const [v, e] of Object.entries(vs)) inner[v] = e;
    obj[n] = inner;
  }
  const existing = obj[name]?.[version];
  // Identical re-add → idempotent no-op (preserves dedup). New OR differing url/hash → write.
  if (existing && existing.url === entry.url && existing.package_hash === entry.package_hash) {
    tightenFile();
    return { added: false, updated: false };
  }
  const updated = existing !== undefined; // same name@version, corrected url/hash → overwrite stale pin
  obj[name] = obj[name] ?? (Object.create(null) as Record<string, RegistryEntry>);
  obj[name][version] = { url: entry.url, package_hash: entry.package_hash };
  writeFileSync(userPath, JSON.stringify(obj, null, 2));
  chmodSync(userPath, 0o600);
  return { added: !updated, updated };
}

/** bundled ∪ user flattened to rows; user overrides bundled on (name, version); each row carries source. */
export function listRegistry(
  bundledPath: string = bundledRegistryPath(), userPath: string = registryPath(),
): Array<{ name: string; version: string; url: string; source: "bundled" | "user" }> {
  const idx = new Map<string, number>(); // "name@version" → row index (for override)
  const rows: Array<{ name: string; version: string; url: string; source: "bundled" | "user" }> = [];
  const add = (src: Record<string, Record<string, RegistryEntry>>, source: "bundled" | "user"): void => {
    for (const [name, versions] of Object.entries(src)) {
      if (typeof versions !== "object" || versions === null) continue;
      for (const [version, entry] of Object.entries(versions)) {
        if (!entry || typeof entry.url !== "string" || typeof entry.package_hash !== "string") continue;
        const key = `${name}@${version}`;
        const row = { name, version, url: entry.url, source };
        const prior = idx.get(key);
        if (prior !== undefined) rows[prior] = row; else { idx.set(key, rows.length); rows.push(row); }
      }
    }
  };
  add(readRegistryFile(bundledPath), "bundled");
  add(readRegistryFile(userPath), "user");
  return rows;
}

// ---- Remote registries (slice 6) ----
export interface RemoteRegistryConfig { readonly url: string; readonly key_id: string; readonly max_staleness_days?: number; }
export interface RegistriesConfig { readonly remotes: RemoteRegistryConfig[]; }

/** ~/.ace/registries.json — operator-managed ordered remote list (sibling of registry.json). */
export function registriesPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "registries.json");
}

/** ~/.ace/registry-cache/ — content-addressed cache of fetched indexes + per-registry meta. */
export function registryCacheDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "registry-cache");
}

/** Untrusted-input discipline: malformed → { remotes: [] }; drop entries missing url OR key_id. */
export function readRegistriesConfig(p: string = registriesPath()): RegistriesConfig {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(p, "utf8")); } catch { return { remotes: [] }; }
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { remotes?: unknown }).remotes)) return { remotes: [] };
  const remotes: RemoteRegistryConfig[] = [];
  for (const r of (raw as { remotes: unknown[] }).remotes) {
    if (!r || typeof r !== "object") continue;
    const url = (r as { url?: unknown }).url;
    const key_id = (r as { key_id?: unknown }).key_id;
    if (typeof url !== "string" || url === "" || typeof key_id !== "string" || !key_id.startsWith("ed25519:")) continue; // key_id REQUIRED + well-formed (Codex #6424 P1)
    const msd = (r as { max_staleness_days?: unknown }).max_staleness_days;
    remotes.push(typeof msd === "number" ? { url, key_id, max_staleness_days: msd } : { url, key_id });
  }
  return { remotes };
}

export function writeRegistryRemote(entry: RemoteRegistryConfig, p: string = registriesPath()): { added: boolean; updated: boolean } {
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  try { chmodSync(dirname(p), 0o700); } catch { /* best-effort */ }
  const cfg = readRegistriesConfig(p);
  const remotes = cfg.remotes.filter((r) => r.url !== entry.url);
  const updated = remotes.length !== cfg.remotes.length;
  remotes.push(entry);
  writeFileSync(p, JSON.stringify({ remotes }, null, 2));
  try { chmodSync(p, 0o600); } catch { /* best-effort */ }
  return { added: !updated, updated };
}

export function removeRegistryRemote(url: string, p: string = registriesPath()): { removed: boolean } {
  const cfg = readRegistriesConfig(p);
  const remotes = cfg.remotes.filter((r) => r.url !== url);
  if (remotes.length === cfg.remotes.length) return { removed: false };
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  writeFileSync(p, JSON.stringify({ remotes }, null, 2));
  try { chmodSync(p, 0o600); } catch { /* best-effort */ }
  return { removed: true };
}
