import { mkdirSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { curlFetchToFile, resolveRepoRelativeDest, verifySha256File } from "./curl-fetch.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-url";

type Attrs = Readonly<Record<string, string>>;

const SHA256_HEX = /^[0-9a-f]{64}$/;

// A URL is a name, not a pin. GitHub release assets can be re-uploaded under
// an unchanged tag -- tlaplus v1.8.0 is a rolling prerelease that has served
// at least two different tla2tools.jar builds -- so the digest is the only
// thing that says which bytes arrived. Mandatory here as in from-elan and
// from-autotools-tarball. See 081M001E114087G0R001AZF4KD.
function requireSha256(destRel: string, attrs: Attrs): string {
  const sha256 = attrs.sha256;
  if (sha256 === undefined) {
    throw new Error(`from-url ${destRel}: sha256= pin required`);
  }
  const normalized = sha256.toLowerCase();
  if (!SHA256_HEX.test(normalized)) {
    throw new Error(`from-url ${destRel}: sha256= must be 64 hex chars`);
  }
  return normalized;
}

function checkRequires(requires: string | undefined, logWarn: (msg: string) => void): void {
  if (!requires) return;
  for (const req of requires.split(",")) {
    const trimmed = req.trim();
    if (trimmed.length === 0) continue;
    if (trimmed === "java") {
      if (!commandOnPath("java")) {
        throw new Error("from-url entry requires java on PATH");
      }
      continue;
    }
    logWarn(`unknown requires=${trimmed}; skipping check`);
  }
}

async function downloadWithOuterRetry(
  dest: string,
  url: string,
  sha256: string,
  dryRun: boolean,
  log: (msg: string) => void,
): Promise<void> {
  if (dryRun) {
    log(`dry-run: would download ${dest} ← ${url}`);
    return;
  }

  const part = `${dest}.part`;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await curlFetchToFile(part, url);
      // Verify BEFORE the rename: a digest mismatch must never leave bytes at
      // the destination, where the next run's existence check would adopt them.
      verifySha256File(part, sha256);
      renameSync(part, dest);
      return;
    } catch (err) {
      try {
        unlinkSync(part);
      } catch {
        /* absent */
      }
      if (attempt >= maxAttempts) throw err;
      const sleepS = attempt * 30;
      log(`  attempt ${String(attempt)}/${String(maxAttempts)} failed; retrying in ${String(sleepS)}s`);
      await Bun.sleep(sleepS * 1000);
    }
  }
}

export const realizeFromUrl: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-url: no manifest; skipping");
    return finishResult("from-url", ctx, true);
  }

  const entries = parseMechanismManifest(text);
  for (const entry of entries) {
    const destRel = entry.tokens[0];
    const url = entry.tokens[1];
    if (destRel === undefined || url === undefined) continue;

    const sha256 = requireSha256(destRel, entry.attrs);
    checkRequires(entry.attrs.requires, ctx.warn);

    const dest = resolveRepoRelativeDest(ctx.repoRoot, destRel);
    mkdirSync(dirname(dest), { recursive: true });

    if (existsSync(dest)) {
      // Present is not the same as correct. Re-verify rather than trust the
      // path: a partial, poisoned, or re-uploaded-upstream file is exactly
      // what a bare existence check waves through.
      verifySha256File(dest, sha256);
      ctx.log(`✓ ${destRel} already present (sha256 verified)`);
      continue;
    }

    if (!url.startsWith("https://")) {
      throw new Error(`from-url requires HTTPS for ${destRel} (${url})`);
    }

    ctx.log(`↓ from-url: ${destRel} ← ${url}`);
    ctx.actions.push(ctx.dryRun ? `dry-run: curl ${url} → verify sha256 → ${dest}` : `curl ${url} → verify sha256 → ${dest}`);
    await downloadWithOuterRetry(dest, url, sha256, ctx.dryRun, ctx.log);
    ctx.log(`✓ ${destRel}`);
  }

  ctx.log("✓ from-url complete");
  return finishResult("from-url", ctx, false);
};
