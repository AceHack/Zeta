/**
 * Resolve flash-img-latest pins + bind local artifact paths for assemble.
 *
 * Network I/O is injected (fetchText / fetchToFile) so unit tests stay hermetic.
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import type { MultibootPlan, LatestPin } from "./plan.ts";
import { resolveLatestFromSha256Sums } from "./sha256sums.ts";
import type { ResolvedArtifact } from "./assemble.ts";

export type FetchText = (url: string) => Promise<string>;
export type FetchToFile = (url: string, destPath: string) => Promise<void>;

/**
 * For each url-latest plan item, fetch SHA256SUMS and pick the highest version.
 */
export async function resolveLatestPins(
  plan: MultibootPlan,
  fetchText: FetchText,
): Promise<
  | { readonly ok: true; readonly pins: ReadonlyMap<string, LatestPin> }
  | { readonly ok: false; readonly error: string }
> {
  const pins = new Map<string, LatestPin>();
  for (const item of plan.items) {
    if (item.source.kind !== "url-latest") continue;
    let body: string;
    try {
      body = await fetchText(item.source.checksumsUrl);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `fetch SHA256SUMS failed (${item.source.checksumsUrl}): ${reason}`,
      };
    }
    const resolved = resolveLatestFromSha256Sums(body, item.source.selectGlob);
    if (!resolved.ok) {
      return { ok: false, error: `${item.name}: ${resolved.error}` };
    }
    const baseUrl = item.source.checksumsUrl.replace(/[^/]+$/, "");
    pins.set(item.name, {
      name: item.name,
      filename: resolved.entry.filename,
      url: `${baseUrl}${resolved.entry.filename}`,
      sha256: resolved.entry.sha256,
    });
  }
  return { ok: true, pins };
}

export async function sha256FileHex(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

export async function verifySha256File(
  filePath: string,
  expectedHex: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  if (!existsSync(filePath)) {
    return { ok: false, error: `file not found: ${filePath}` };
  }
  const actual = await sha256FileHex(filePath);
  const expected = expectedHex.toLowerCase();
  if (actual !== expected) {
    return {
      ok: false,
      error: `sha256 mismatch for ${filePath}: expected ${expected}, got ${actual}`,
    };
  }
  return { ok: true };
}

export type BindArtifactsInput = {
  readonly plan: MultibootPlan;
  /** Local overrides: manifest name → host path (skip download for that name). */
  readonly localByName: ReadonlyMap<string, string>;
  readonly cacheDir: string;
  readonly pins: ReadonlyMap<string, LatestPin>;
  readonly fetchToFile: FetchToFile;
  /** When true, every plan item must already be in localByName (no network). */
  readonly requireLocal: boolean;
};

/**
 * Ensure every plan item has a verified local file; download URL sources into cacheDir.
 * grub-iso-local always requires --local (nix-build is outside this module).
 */
export async function bindResolvedArtifacts(
  input: BindArtifactsInput,
): Promise<
  | { readonly ok: true; readonly artifacts: readonly ResolvedArtifact[] }
  | { readonly ok: false; readonly error: string }
> {
  const artifacts: ResolvedArtifact[] = [];

  for (const item of input.plan.items) {
    const localOverride = input.localByName.get(item.name);
    let localPath: string;
    let expectedSha: string | undefined;

    if (localOverride !== undefined) {
      localPath = localOverride;
    } else if (input.requireLocal) {
      return {
        ok: false,
        error: `requireLocal: missing --local for "${item.name}"`,
      };
    } else if (item.source.kind === "flake-build") {
      return {
        ok: false,
        error: `grub-iso-local "${item.name}" requires --local ${item.name}=<path-to-iso> (nix build is external)`,
      };
    } else if (item.source.kind === "url") {
      localPath = `${input.cacheDir.replace(/\/+$/, "")}/${item.name}.bin`;
      expectedSha = item.source.sha256;
      if (!existsSync(localPath)) {
        try {
          await input.fetchToFile(item.source.url, localPath);
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          return { ok: false, error: `fetch failed (${item.source.url}): ${reason}` };
        }
      }
    } else {
      // url-latest
      const pin = input.pins.get(item.name);
      if (pin === undefined) {
        return { ok: false, error: `no latest pin for "${item.name}" — resolve pins first` };
      }
      localPath = `${input.cacheDir.replace(/\/+$/, "")}/${pin.filename}`;
      expectedSha = pin.sha256;
      if (!existsSync(localPath)) {
        try {
          await input.fetchToFile(pin.url, localPath);
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          return { ok: false, error: `fetch failed (${pin.url}): ${reason}` };
        }
      }
    }

    if (!existsSync(localPath)) {
      return { ok: false, error: `artifact file missing: ${localPath}` };
    }

    if (expectedSha !== undefined) {
      const verified = await verifySha256File(localPath, expectedSha);
      if (!verified.ok) return verified;
    }

    const sizeBytes = statSync(localPath).size;
    artifacts.push({
      name: item.name,
      imagePath: item.imagePath,
      localPath,
      sizeBytes,
    });
  }

  return { ok: true, artifacts };
}
