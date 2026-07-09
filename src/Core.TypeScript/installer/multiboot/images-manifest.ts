/**
 * Multiboot images.manifest parser — declarative payload list for the
 * GRUB2 multiboot USB (Aaron 2026-06-10).
 *
 * Pure: no network, no disk. Consumed by planMultibootUsb / build CLI.
 *
 * Format: whitespace-separated `<name> <kind> <fields...>`
 * `#` comments and blank lines ignored.
 */

export type MultibootImageKind =
  | "grub-iso-local"
  | "grub-iso"
  | "flash-img"
  | "flash-img-latest";

export type MultibootManifestEntry =
  | {
      readonly name: string;
      readonly kind: "grub-iso-local";
      readonly flakeAttr: string;
    }
  | {
      readonly name: string;
      readonly kind: "grub-iso";
      readonly url: string;
      readonly sha256: string;
    }
  | {
      readonly name: string;
      readonly kind: "flash-img";
      readonly url: string;
      readonly sha256: string;
    }
  | {
      readonly name: string;
      readonly kind: "flash-img-latest";
      readonly baseUrl: string;
      readonly selectGlob: string;
      readonly checksumsFile: string;
    };

export type MultibootManifestParseResult =
  | { readonly ok: true; readonly entries: readonly MultibootManifestEntry[] }
  | { readonly ok: false; readonly error: string };

const SHA256_RE = /^[0-9a-f]{64}$/i;

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseKvField(raw: string, key: string): string | null {
  const prefix = `${key}=`;
  if (!raw.startsWith(prefix)) return null;
  const value = raw.slice(prefix.length);
  return value.length > 0 ? value : null;
}

/**
 * Parse one images.manifest body into typed entries.
 * Fails closed on unknown kinds, missing fields, duplicate names, bad sha256.
 */
export function parseImagesManifest(text: string): MultibootManifestParseResult {
  const entries: MultibootManifestEntry[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(/\s+/);
    const name = parts[0];
    const kind = parts[1] as MultibootImageKind | undefined;
    if (!isNonEmpty(name) || !isNonEmpty(kind)) {
      return { ok: false, error: `line ${lineNo}: expected <name> <kind> ...` };
    }
    if (seen.has(name)) {
      return { ok: false, error: `line ${lineNo}: duplicate name "${name}"` };
    }
    seen.add(name);

    if (kind === "grub-iso-local") {
      const flakeAttr = parts[2];
      if (!isNonEmpty(flakeAttr)) {
        return { ok: false, error: `line ${lineNo}: grub-iso-local requires <flake-attr>` };
      }
      entries.push({ name, kind, flakeAttr });
      continue;
    }

    if (kind === "grub-iso" || kind === "flash-img") {
      const url = parts[2];
      const sha256 = parts[3];
      if (!isNonEmpty(url) || !isNonEmpty(sha256)) {
        return { ok: false, error: `line ${lineNo}: ${kind} requires <url> <sha256>` };
      }
      if (!SHA256_RE.test(sha256)) {
        return { ok: false, error: `line ${lineNo}: sha256 must be 64 hex chars` };
      }
      entries.push({ name, kind, url, sha256: sha256.toLowerCase() });
      continue;
    }

    if (kind === "flash-img-latest") {
      const baseUrl = parts[2];
      const selectRaw = parts[3];
      const checksumsRaw = parts[4];
      if (!isNonEmpty(baseUrl) || !isNonEmpty(selectRaw) || !isNonEmpty(checksumsRaw)) {
        return {
          ok: false,
          error: `line ${lineNo}: flash-img-latest requires <base-url> select=<glob> checksums=<file>`,
        };
      }
      const selectGlob = parseKvField(selectRaw, "select");
      const checksumsFile = parseKvField(checksumsRaw, "checksums");
      if (selectGlob === null || checksumsFile === null) {
        return {
          ok: false,
          error: `line ${lineNo}: flash-img-latest fields must be select=<glob> checksums=<file>`,
        };
      }
      if (!baseUrl.endsWith("/")) {
        return { ok: false, error: `line ${lineNo}: base-url must end with /` };
      }
      entries.push({ name, kind, baseUrl, selectGlob, checksumsFile });
      continue;
    }

    return { ok: false, error: `line ${lineNo}: unknown kind "${kind}"` };
  }

  if (entries.length === 0) {
    return { ok: false, error: "manifest has no entries" };
  }

  return { ok: true, entries };
}
