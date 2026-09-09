import { mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { parseMechanismManifest } from "../setup-manifest.ts";
import {
  curlFetchToFile,
  resolveRepoRelativeDest,
  sha256File,
  verifySha256File,
} from "./curl-fetch.ts";
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

/**
 * `rolling=<name>` declares that the bytes behind this URL are REPLACED IN
 * PLACE upstream -- a GitHub prerelease tag whose asset is re-uploaded, a
 * "latest" alias, a nightly. It changes NOTHING about enforcement: the digest
 * is still mandatory and a mismatch still fails closed. What it changes is the
 * DIAGNOSIS. Without it, "sha256 mismatch" reads as corruption or attack and
 * sends the reader hunting for a compromise that did not happen; with it, the
 * message names the actual event, prints both digests, and gives the one
 * command that re-measures and re-pins.
 *
 * The rule the message has to carry, because it is the whole point of the
 * regime: BUMPING THE DIGEST TO MAKE A RED TREE GREEN IS THE FAILURE MODE.
 * It swaps the verifier under every claim the verifier ever established, in a
 * one-line diff that looks like housekeeping.
 */
export function rollingRemedy(destRel: string, expected: string, actual: string, rolling: string): string {
  return (
    `from-url ${destRel}: upstream REBUILT this asset in place (rolling=${rolling}).\n` +
    `  pinned  sha256=${expected}\n` +
    `  fetched sha256=${actual}\n` +
    "  This is expected for a rolling upstream and is NOT corruption. It fails\n" +
    "  closed on purpose: the new bytes are a different verifier, so every claim\n" +
    "  the old one established has to be re-measured before the pin moves.\n" +
    `  Re-measure AND re-pin in one step:  bun tools/setup/repin-rolling.ts ${destRel}\n` +
    "  Do NOT hand-edit the sha256= in tools/setup/manifests/from-url. A digest\n" +
    "  bumped without a re-measure is the exact failure this regime exists to stop."
  );
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
  destRel: string,
  url: string,
  sha256: string,
  rolling: string | undefined,
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
    let fetched: string | null = null;
    try {
      await curlFetchToFile(part, url);
      // Verify BEFORE the rename: a digest mismatch must never leave bytes at
      // the destination, where the next run's existence check would adopt them.
      fetched = sha256File(part);
      verifySha256File(part, sha256);
      renameSync(part, dest);
      return;
    } catch (err) {
      try {
        unlinkSync(part);
      } catch {
        /* absent */
      }
      // A digest disagreement is UPSTREAM DISAGREEING WITH THE PIN, and retrying
      // it four times just fetches the same wrong bytes four times. Fail on the
      // first one, and say which event it was.
      if (fetched !== null && fetched !== sha256) {
        if (rolling !== undefined) throw new Error(rollingRemedy(destRel, sha256, fetched, rolling));
        throw err;
      }
      if (attempt >= maxAttempts) throw err;
      const sleepS = attempt * 30;
      log(`  attempt ${String(attempt)}/${String(maxAttempts)} failed; retrying in ${String(sleepS)}s`);
      await Bun.sleep(sleepS * 1000);
    }
  }
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

/** The file's digest, or null when it is simply not there. Never a throw for absence. */
function digestIfPresent(path: string): string | null {
  try {
    return sha256File(path);
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

function removeIfPresent(path: string): void {
  try {
    unlinkSync(path);
  } catch (err) {
    if (!isMissing(err)) throw err;
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

    const rolling = entry.attrs.rolling;

    // Present is not the same as correct, so this hashes rather than asking
    // whether the path exists: a partial, poisoned, or re-uploaded-upstream file
    // is exactly what a bare existence check waves through. Reading first and
    // interpreting ENOENT is also one syscall with one answer -- an existsSync
    // gate would already be stale by the time the unlink below ran.
    const onDisk = digestIfPresent(dest);
    if (onDisk === sha256) {
      ctx.log(`✓ ${destRel} already present (sha256 verified)`);
      continue;
    }
    if (onDisk !== null) {
      // A WRONG FILE ON DISK IS RECOVERABLE, so recover instead of wedging.
      // This used to throw, which made every already-provisioned machine -- dev
      // laptop, warm CI cache, devcontainer layer -- fail the WHOLE from-url
      // realizer (it is not best-effort, so install.sh aborts) the moment a pin
      // moved or a byte flipped, with no remedy printed and no way out but a
      // hand `rm`. The stale bytes are not evidence of anything; the PIN is.
      //
      // Fail-closed is untouched: the replacement is verified before it is put
      // in place, so this can only ever end with the pinned bytes or an error.
      ctx.warn(
        `${destRel}: on-disk sha256=${onDisk} disagrees with the pin ${sha256}` +
          " -- discarding those bytes and re-fetching from the pinned URL",
      );
      removeIfPresent(dest);
    }

    if (!url.startsWith("https://")) {
      throw new Error(`from-url requires HTTPS for ${destRel} (${url})`);
    }

    ctx.log(`↓ from-url: ${destRel} ← ${url}`);
    ctx.actions.push(ctx.dryRun ? `dry-run: curl ${url} → verify sha256 → ${dest}` : `curl ${url} → verify sha256 → ${dest}`);
    await downloadWithOuterRetry(dest, destRel, url, sha256, rolling, ctx.dryRun, ctx.log);
    ctx.log(`✓ ${destRel}`);
  }

  ctx.log("✓ from-url complete");
  return finishResult("from-url", ctx, false);
};
