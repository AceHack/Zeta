const SHA256_RE = /^[0-9a-f]{64}$/i;
function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function parseKvField(raw, key) {
  const prefix = `${key}=`;
  if (!raw.startsWith(prefix))
    return null;
  const value = raw.slice(prefix.length);
  return value.length > 0 ? value : null;
}
export function parseImagesManifest(text) {
  const entries = [], seen = new Set, lines = text.split(/\r?\n/);
  for (let i = 0;i < lines.length; i++) {
    const lineNo = i + 1, trimmed = lines[i].trim();
    if (trimmed.length === 0 || trimmed.startsWith("#"))
      continue;
    const parts = trimmed.split(/\s+/), name = parts[0], kind = parts[1];
    if (!isNonEmpty(name) || !isNonEmpty(kind))
      return { ok: !1, error: `line ${lineNo}: expected <name> <kind> ...` };
    if (seen.has(name))
      return { ok: !1, error: `line ${lineNo}: duplicate name "${name}"` };
    seen.add(name);
    if (kind === "grub-iso-local") {
      const flakeAttr = parts[2];
      if (!isNonEmpty(flakeAttr))
        return { ok: !1, error: `line ${lineNo}: grub-iso-local requires <flake-attr>` };
      entries.push({ name, kind, flakeAttr });
      continue;
    }
    if (kind === "grub-iso" || kind === "flash-img") {
      const url = parts[2], sha256 = parts[3];
      if (!isNonEmpty(url) || !isNonEmpty(sha256))
        return { ok: !1, error: `line ${lineNo}: ${kind} requires <url> <sha256>` };
      if (!SHA256_RE.test(sha256))
        return { ok: !1, error: `line ${lineNo}: sha256 must be 64 hex chars` };
      entries.push({ name, kind, url, sha256: sha256.toLowerCase() });
      continue;
    }
    if (kind === "flash-img-latest") {
      const baseUrl = parts[2], selectRaw = parts[3], checksumsRaw = parts[4];
      if (!isNonEmpty(baseUrl) || !isNonEmpty(selectRaw) || !isNonEmpty(checksumsRaw))
        return {
          ok: !1,
          error: `line ${lineNo}: flash-img-latest requires <base-url> select=<glob> checksums=<file>`
        };
      const selectGlob = parseKvField(selectRaw, "select"), checksumsFile = parseKvField(checksumsRaw, "checksums");
      if (selectGlob === null || checksumsFile === null)
        return {
          ok: !1,
          error: `line ${lineNo}: flash-img-latest fields must be select=<glob> checksums=<file>`
        };
      if (!baseUrl.endsWith("/"))
        return { ok: !1, error: `line ${lineNo}: base-url must end with /` };
      entries.push({ name, kind, baseUrl, selectGlob, checksumsFile });
      continue;
    }
    return { ok: !1, error: `line ${lineNo}: unknown kind "${kind}"` };
  }
  if (entries.length === 0)
    return { ok: !1, error: "manifest has no entries" };
  return { ok: !0, entries };
}
