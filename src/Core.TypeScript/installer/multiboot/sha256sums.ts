/**
 * SHA256SUMS helpers for flash-img-latest resolution.
 *
 * Pure: given checksums file text + select glob, pick the highest-version
 * matching artifact. No network.
 */

export type Sha256SumsEntry = {
  readonly sha256: string;
  readonly filename: string;
};

export type ResolveLatestResult =
  | { readonly ok: true; readonly entry: Sha256SumsEntry }
  | { readonly ok: false; readonly error: string };

const SHA256_LINE_RE = /^([0-9a-f]{64})\s+(\S+)\s*$/i;

/** Parse GNU-style `SHA256SUMS` (`<hex>  <filename>` or `<hex> *<filename>`). */
export function parseSha256Sums(text: string): readonly Sha256SumsEntry[] {
  const out: Sha256SumsEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const match = trimmed.match(SHA256_LINE_RE);
    if (!match) continue;
    let filename = match[2]!;
    if (filename.startsWith("*")) filename = filename.slice(1);
    out.push({ sha256: match[1]!.toLowerCase(), filename });
  }
  return out;
}

/**
 * Convert a simple glob (`mynode_amd64_*.img.gz`) to a RegExp.
 * Only `*` wildcards supported (manifest contract).
 */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * Extract comparable version tuples from filenames like
 * `mynode_amd64_0-3-34.img.gz` → [0, 3, 34] (trailing `_N-N-N` segment).
 * Falls back to all digit groups, then lexicographic stem.
 */
export function versionKeyFromFilename(filename: string): {
  readonly numeric: readonly number[];
  readonly lexical: string;
} {
  const stem = filename.replace(/\.(img\.gz|iso|img)$/i, "");
  const trailing = stem.match(/_(\d+(?:-\d+)*)$/);
  if (trailing) {
    return {
      numeric: trailing[1]!.split("-").map((n) => Number(n)),
      lexical: stem,
    };
  }
  const groups = [...stem.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
  return { numeric: groups, lexical: stem };
}

function compareVersionKeys(
  a: { readonly numeric: readonly number[]; readonly lexical: string },
  b: { readonly numeric: readonly number[]; readonly lexical: string },
): number {
  const len = Math.max(a.numeric.length, b.numeric.length);
  for (let i = 0; i < len; i++) {
    const av = a.numeric[i] ?? 0;
    const bv = b.numeric[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return a.lexical.localeCompare(b.lexical);
}

/**
 * From a SHA256SUMS body, pick the highest-version filename matching selectGlob.
 */
export function resolveLatestFromSha256Sums(
  checksumsText: string,
  selectGlob: string,
): ResolveLatestResult {
  const entries = parseSha256Sums(checksumsText);
  if (entries.length === 0) {
    return { ok: false, error: "SHA256SUMS has no parseable entries" };
  }
  const re = globToRegExp(selectGlob);
  const matched = entries.filter((e) => re.test(e.filename));
  if (matched.length === 0) {
    return {
      ok: false,
      error: `no SHA256SUMS entry matches select=${selectGlob}`,
    };
  }
  let best = matched[0]!;
  let bestKey = versionKeyFromFilename(best.filename);
  for (let i = 1; i < matched.length; i++) {
    const candidate = matched[i]!;
    const key = versionKeyFromFilename(candidate.filename);
    if (compareVersionKeys(key, bestKey) > 0) {
      best = candidate;
      bestKey = key;
    }
  }
  return { ok: true, entry: best };
}
