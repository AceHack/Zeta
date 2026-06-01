import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export interface AceManifest {
  readonly format_version: number;
  readonly name: string;
  readonly version: string;
  readonly content_hash: string;
  readonly description?: string;
}

export interface InstalledPackage {
  readonly hash: string;
  readonly manifest: AceManifest;
}

export function defaultStorePath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return join(home, ".ace", "store");
}

/** Content hash of raw bytes, in the `sha256:<hex>` form Ace manifests use. */
export function contentHash(bytes: Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
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

  return packages.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

export interface AcePackage {
  readonly manifest: AceManifest;
  readonly files: Readonly<Record<string, string>>;
}

export type InstallResult = { ok: true; dir: string } | { ok: false; error: string };

/**
 * Verify-before-extract: recompute the content hash of `pkg.files` and refuse to
 * extract unless it matches `pkg.manifest.content_hash` (integrity). Extracts to
 * `<storePath>/<hash-with-':'-as-'-'>/` with a `manifest.json`. INTEGRITY ONLY —
 * authenticity (signatures) is a separate concern (slice 3).
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
  // `..\`) or absolute path (leading '/' or '\').
  //
  // NOTE (slice-3 hardening — on the map per the shield rule, NOT silenced):
  //   (a) PATH: Windows device names (CON/NUL/PRN/AUX/COM1…) and drive-relative paths
  //       (`C:foo`) are NOT rejected here. They cannot escape `<storePath>/<hash>/` —
  //       `path.join` embeds them as subpaths — but a malicious package could still target a
  //       Windows device sink.
  //   (b) CONTENT/SOURCE: the `install <url>` verb fetches package bytes over HTTP and writes
  //       them here (CodeQL js/http-to-file-access, accepted). The write is confined to
  //       `<storePath>/<hash>/` (path guard above) and the bytes are integrity-checked against
  //       the manifest hash — but the manifest ships WITH the download, so integrity alone does
  //       not defend against a malicious *source*. Authenticity (signature over a trusted key)
  //       is the defense, and is explicitly the authenticity/robustness slice (slice 3). The
  //       alert stays open until then rather than being suppressed.
  for (const rel of Object.keys(pkg.files)) {
    if (rel.includes("..") || rel.startsWith("/") || rel.startsWith("\\")) {
      return { ok: false, error: `unsafe file path in package: ${rel}` };
    }
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
