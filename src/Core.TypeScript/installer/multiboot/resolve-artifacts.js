import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolveLatestFromSha256Sums } from "./sha256sums.ts";
export async function resolveLatestPins(plan, fetchText) {
  const pins = new Map;
  for (const item of plan.items) {
    if (item.source.kind !== "url-latest")
      continue;
    let body;
    try {
      body = await fetchText(item.source.checksumsUrl);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return {
        ok: !1,
        error: `fetch SHA256SUMS failed (${item.source.checksumsUrl}): ${reason}`
      };
    }
    const resolved = resolveLatestFromSha256Sums(body, item.source.selectGlob);
    if (!resolved.ok)
      return { ok: !1, error: `${item.name}: ${resolved.error}` };
    const baseUrl = item.source.checksumsUrl.replace(/[^/]+$/, "");
    pins.set(item.name, {
      name: item.name,
      filename: resolved.entry.filename,
      url: `${baseUrl}${resolved.entry.filename}`,
      sha256: resolved.entry.sha256
    });
  }
  return { ok: !0, pins };
}
export async function sha256FileHex(filePath) {
  const hash = createHash("sha256"), stream = createReadStream(filePath);
  for await (const chunk of stream)
    hash.update(chunk);
  return hash.digest("hex");
}
export async function verifySha256File(filePath, expectedHex) {
  if (!existsSync(filePath))
    return { ok: !1, error: `file not found: ${filePath}` };
  const actual = await sha256FileHex(filePath), expected = expectedHex.toLowerCase();
  if (actual !== expected)
    return {
      ok: !1,
      error: `sha256 mismatch for ${filePath}: expected ${expected}, got ${actual}`
    };
  return { ok: !0 };
}
export async function bindResolvedArtifacts(input) {
  const artifacts = [];
  for (const item of input.plan.items) {
    const localOverride = input.localByName.get(item.name);
    let localPath, expectedSha;
    if (localOverride !== void 0)
      localPath = localOverride;
    else if (input.requireLocal)
      return {
        ok: !1,
        error: `requireLocal: missing --local for "${item.name}"`
      };
    else if (item.source.kind === "flake-build")
      return {
        ok: !1,
        error: `grub-iso-local "${item.name}" requires --local ${item.name}=<path-to-iso> (nix build is external)`
      };
    else if (item.source.kind === "url") {
      localPath = `${input.cacheDir.replace(/\/+$/, "")}/${item.name}.bin`;
      expectedSha = item.source.sha256;
      if (!existsSync(localPath))
        try {
          await input.fetchToFile(item.source.url, localPath);
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          return { ok: !1, error: `fetch failed (${item.source.url}): ${reason}` };
        }
    } else {
      const pin = input.pins.get(item.name);
      if (pin === void 0)
        return { ok: !1, error: `no latest pin for "${item.name}" \u2014 resolve pins first` };
      localPath = `${input.cacheDir.replace(/\/+$/, "")}/${pin.filename}`;
      expectedSha = pin.sha256;
      if (!existsSync(localPath))
        try {
          await input.fetchToFile(pin.url, localPath);
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          return { ok: !1, error: `fetch failed (${pin.url}): ${reason}` };
        }
    }
    if (!existsSync(localPath))
      return { ok: !1, error: `artifact file missing: ${localPath}` };
    if (expectedSha !== void 0) {
      const verified = await verifySha256File(localPath, expectedSha);
      if (!verified.ok)
        return verified;
    }
    const sizeBytes = statSync(localPath).size;
    artifacts.push({
      name: item.name,
      imagePath: item.imagePath,
      localPath,
      sizeBytes
    });
  }
  return { ok: !0, artifacts };
}
