const SHA256_LINE_RE = /^([0-9a-f]{64})\s+(\S+)\s*$/i;
export function parseSha256Sums(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#"))
      continue;
    const match = trimmed.match(SHA256_LINE_RE);
    if (!match)
      continue;
    let filename = match[2];
    if (filename.startsWith("*"))
      filename = filename.slice(1);
    out.push({ sha256: match[1].toLowerCase(), filename });
  }
  return out;
}
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}
export function versionKeyFromFilename(filename) {
  const stem = filename.replace(/\.(img\.gz|iso|img)$/i, ""), trailing = stem.match(/_(\d+(?:-\d+)*)$/);
  if (trailing)
    return {
      numeric: trailing[1].split("-").map((n) => Number(n)),
      lexical: stem
    };
  return { numeric: [...stem.matchAll(/(\d+)/g)].map((m) => Number(m[1])), lexical: stem };
}
function compareVersionKeys(a, b) {
  const len = Math.max(a.numeric.length, b.numeric.length);
  for (let i = 0;i < len; i++) {
    const av = a.numeric[i] ?? 0, bv = b.numeric[i] ?? 0;
    if (av !== bv)
      return av - bv;
  }
  return a.lexical.localeCompare(b.lexical);
}
export function resolveLatestFromSha256Sums(checksumsText, selectGlob) {
  const entries = parseSha256Sums(checksumsText);
  if (entries.length === 0)
    return { ok: !1, error: "SHA256SUMS has no parseable entries" };
  const re = globToRegExp(selectGlob), matched = entries.filter((e) => re.test(e.filename));
  if (matched.length === 0)
    return {
      ok: !1,
      error: `no SHA256SUMS entry matches select=${selectGlob}`
    };
  let best = matched[0], bestKey = versionKeyFromFilename(best.filename);
  for (let i = 1;i < matched.length; i++) {
    const candidate = matched[i], key = versionKeyFromFilename(candidate.filename);
    if (compareVersionKeys(key, bestKey) > 0) {
      best = candidate;
      bestKey = key;
    }
  }
  return { ok: !0, entry: best };
}
