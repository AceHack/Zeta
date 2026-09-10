// from-zip — a pinned per-platform release ZIP, extracted into a declared directory.
//
// THE GAP IT CLOSES. `from-url` puts ONE FILE at ONE PATH; it cannot unpack, and the tree
// already recorded that as a blocker in `tools/setup/manifests/windows`: "from-url can
// DOWNLOAD a file but never unpack or install one … (a) a Windows-side unzip-to-PATH
// mechanism (new mechanism -- needs sign-off)". A vendor that ships a self-contained
// toolchain publishes a per-platform ZIP and nothing else, so until now such a tool could
// only arrive by hand — which is how the CodeQL CLI came to sit at ~/.zeta/codeql-cli on
// exactly one machine, pinned by nothing and reproducible by nobody.
//
// WHAT IT DOES NOT DO, and the omissions are deliberate:
//
//   * IT DOES NOT ADOPT WHAT IT FINDS. A destination that exists but carries no receipt is
//     re-installed from the pin, not blessed. `install-pinned-smt.ts` and `from-url` both
//     make the same call for the same reason: present is not correct, and adopting an
//     unidentified tree is how "pinned" becomes a word rather than a property.
//   * IT DOES NOT DEFAULT TO INSTALLING. `opt-in=` is required per row and its absence is a
//     THROW, not a default — a mechanism whose artifacts are hundreds of megabytes cannot
//     have "install everywhere" as its failure mode.
//   * IT DOES NOT WRITE OUTSIDE `<dest>` AND THE SHIM DIR. No PATH edits, no profile edits.
//
// THE RECEIPT IS THE WHOLE IDEMPOTENCY STORY. Extraction destroys the artifact whose digest
// was verified, so `<dest>/.zeta-from-zip.json` records the URL and digest that produced the
// tree. A re-run re-installs when the receipt is absent, unreadable, or disagrees with the
// row — and that third case is the one that matters, because it is what makes a pin bump
// actually change the machine instead of merely changing the manifest.

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import { dirname, join } from "node:path";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { curlFetchToFile, sha256File } from "./curl-fetch.ts";
import { resolveHostTier, tierAllows, tierFromAttrs } from "./host-tier.ts";
import { resolvePin, unhashedInstallNotice, type Pin } from "./unhashed-pin.ts";
import { expandPath, whenMatches } from "./when.ts";
import { finishResult, readManifestFile, type SetupRealizer } from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-zip";

/** Written into `<dest>` so a later run can say which pin produced the tree it is looking at. */
export const RECEIPT_BASENAME = ".zeta-from-zip.json";

export interface Receipt {
  readonly url: string;
  readonly sha256: string;
}

/**
 * Whether the destination already holds exactly what this row asks for.
 *
 * Pure, and separated from the filesystem on purpose: the interesting case is a receipt that
 * DISAGREES, which is the one a live test cannot stage cheaply (it needs a second 400 MB
 * download) and the one whose wrong answer is worst — silently keeping a stale toolchain
 * while the manifest claims a newer pin.
 */
export function receiptSatisfies(
  receipt: Receipt | null,
  url: string,
  pin: Pin,
): boolean {
  if (receipt === null) return false;
  if (receipt.url !== url) return false;
  // An unhashed row cannot be identified by digest, so the URL is all there is to compare.
  // Saying so out loud beats a comparison against the literal "unpinned", which would look
  // like a digest check and be one only by accident.
  if (pin.kind !== "digest") return true;
  return receipt.sha256.toLowerCase() === pin.sha256;
}

export function readReceipt(destDir: string): Receipt | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(destDir, RECEIPT_BASENAME), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const url = record.url;
    const sha256 = record.sha256;
    if (typeof url !== "string" || typeof sha256 !== "string") return null;
    return { url, sha256 };
  } catch {
    // Absent, truncated, or not JSON. All three mean the same thing here — nothing on disk
    // identifies this tree — and all three take the same remedy, so they are not separated.
    return null;
  }
}

/**
 * A row with no `opt-in=` would install on every host that runs install.sh. Refuse it, the
 * way `from-uv-project` refuses an ungated project, and for the identical reason: the cost of
 * this mechanism's artifacts makes "on by default" the wrong direction to fail in.
 */
export function optInSatisfied(
  declared: string | undefined,
  env: NodeJS.ProcessEnv,
): { readonly ok: boolean; readonly reason: string } {
  const name = (declared ?? "").trim();
  if (name.length === 0) {
    return { ok: false, reason: "no opt-in= declared (a release-bundle row must be opt-in)" };
  }
  if (env[name] === "1") return { ok: true, reason: `${name}=1` };
  return { ok: false, reason: `${name} is not 1` };
}

/** True when the row declares no opt-in at all, which is a MANIFEST DEFECT rather than a skip. */
function optInMissing(declared: string | undefined): boolean {
  return (declared ?? "").trim().length === 0;
}

/**
 * Extract `zip` into `into`, using whatever this host actually has.
 *
 * `unzip` first because it is what every macOS and every Ubuntu runner ships and it preserves
 * the executable bit, which a toolchain needs. `tar -xf` second because Windows 10+ and macOS
 * both carry bsdtar, which reads ZIP — that is the Windows path, since `unzip` is not a
 * Windows command. GNU tar cannot read ZIP, so on Linux the fallback will fail loudly rather
 * than silently produce an empty tree; that is the intended direction.
 */
export function extractZip(zip: string, into: string): void {
  const attempts: ReadonlyArray<{ readonly argv: readonly string[]; readonly note: string }> = [
    { argv: ["unzip", "-q", zip, "-d", into], note: "unzip" },
    { argv: ["tar", "-xf", zip, "-C", into], note: "tar (bsdtar reads zip)" },
  ];
  const failures: string[] = [];
  for (const attempt of attempts) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const run = spawnSync(attempt.argv[0]!, [...attempt.argv.slice(1)], { encoding: "utf8" });
    if (run.status === 0) return;
    // status === null means the extractor is not installed at all — a different fact from
    // "it ran and refused", and the message keeps them apart so the remedy is legible.
    failures.push(
      run.status === null
        ? `${attempt.note}: not available (${String(run.error?.message ?? "spawn failed")})`
        : `${attempt.note}: exit ${String(run.status)} ${(run.stderr ?? "").trim()}`,
    );
  }
  throw new Error(`could not extract ${zip}: ${failures.join("; ")}`);
}

function removeIfPresent(path: string): void {
  try {
    unlinkSync(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw err;
  }
}

/**
 * Link `<shimDir>/<name>` at the installed binary, replacing whatever is there.
 *
 * Replacing rather than skipping-if-present is the point: after a pin bump the old link is
 * the stale thing, and a shim that keeps pointing at a tree this realizer just replaced would
 * make `codeql --version` disagree with the manifest.
 */
function linkShim(shimDir: string, name: string, target: string): void {
  mkdirSync(shimDir, { recursive: true });
  const link = join(shimDir, name);
  removeIfPresent(link);
  symlinkSync(target, link);
}

export const realizeFromZip: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-zip: no manifest; skipping");
    return finishResult("from-zip", ctx, true);
  }

  const entries = parseMechanismManifest(text);
  const host = resolveHostTier();
  const shimDir = process.env.ZETA_SHIM_DIR ?? join(process.env.HOME ?? "", ".local/bin");

  // EVERY ROW'S PIN AND OPT-IN ARE RESOLVED BEFORE ANY ROW INSTALLS. A manifest defect throws;
  // it is not downgraded to a warning the way a network failure would be. The distinction is
  // the same one `from-installer` draws: this mechanism may be best-effort about the world, it
  // is never best-effort about what the manifest says.
  // KEYED BY THE ROW ITSELF, never by a joined string. A composite string key needs a
  // separator that cannot occur in either half, and the usual answer to that — a raw NUL —
  // makes the file read as BINARY to every text audit in this repo
  // (`audit-no-raw-nul-in-source.ts`, which caught exactly that here). An object key needs no
  // separator and cannot collide.
  const pins = new Map<(typeof entries)[number], Pin>();
  for (const entry of entries) {
    const destRel = entry.tokens[0];
    const url = entry.tokens[1];
    if (destRel === undefined || url === undefined) continue;
    if (optInMissing(entry.attrs["opt-in"])) {
      throw new Error(
        `from-zip ${destRel} ← ${url}: opt-in=<ENV_VAR> is required. A release bundle is heavy` +
          " by construction, so an ungated row would download it on every host that runs" +
          " install.sh. If the artifact is small, use from-url plus a from-shim row instead.",
      );
    }
    pins.set(entry, resolvePin("from-zip", destRel, url, entry.attrs));
  }

  for (const entry of entries) {
    const destRel = entry.tokens[0];
    const url = entry.tokens[1];
    if (destRel === undefined || url === undefined) continue;
    const pin = pins.get(entry)!;
    const subject = `${destRel} ← ${url}`;

    const whenSpec = entry.attrs.when;
    if (!whenMatches(whenSpec, ctx.warn)) {
      ctx.log(`✓ from-zip ${destRel}: skipping (when=${whenSpec ?? ""})`);
      continue;
    }

    const required = tierFromAttrs(entry.attrs);
    if (!tierAllows(required, host)) {
      ctx.log(
        `✓ from-zip ${destRel}: skipping (tier=${required} > host ${host.tier} [${host.source}])`,
      );
      continue;
    }

    const gate = optInSatisfied(entry.attrs["opt-in"], process.env);
    if (!gate.ok) {
      ctx.log(`✓ from-zip ${destRel}: skipping (${gate.reason}; set ${String(entry.attrs["opt-in"])}=1)`);
      continue;
    }

    if (!url.startsWith("https://")) {
      throw new Error(`from-zip requires HTTPS for ${destRel} (${url})`);
    }

    const dest = expandPath(destRel).startsWith("/")
      ? expandPath(destRel)
      : join(ctx.repoRoot, destRel);
    const binRel = entry.attrs.bin;
    const receipt = readReceipt(dest);
    const binPresent = binRel === undefined || existsSync(join(dest, binRel));

    if (receiptSatisfies(receipt, url, pin) && binPresent) {
      ctx.log(`✓ ${destRel} already installed from this pin`);
      if (entry.attrs.shim !== undefined && binRel !== undefined && !ctx.dryRun) {
        linkShim(shimDir, entry.attrs.shim, join(dest, binRel));
      }
      continue;
    }

    ctx.log(`↓ from-zip: ${destRel} ← ${url}`);
    ctx.actions.push(
      ctx.dryRun
        ? `dry-run: curl ${url} → verify sha256 → unzip → ${dest}`
        : `curl ${url} → verify sha256 → unzip → ${dest}`,
    );
    if (ctx.dryRun) continue;

    const notice = unhashedInstallNotice(pin, subject, url);
    if (notice !== null) ctx.warn(notice);

    // THE STAGING DIRECTORY IS A SIBLING OF `dest`, NOT `$TMPDIR`, and that is a correctness
    // requirement rather than tidiness: the atomic swap below is a `rename`, and `rename` is
    // EXDEV across filesystems. `/tmp` is tmpfs on many Linux hosts while `~/.zeta` is not, so
    // staging under `$TMPDIR` would work on the author's laptop and fail on a runner.
    mkdirSync(dirname(dest), { recursive: true });
    const work = mkdtempSync(`${dest}.staging-`);
    try {
      const zip = join(work, "asset.zip");
      await curlFetchToFile(zip, url);

      // THE DIGEST IS CHECKED BEFORE A SINGLE BYTE IS EXTRACTED. A ZIP is an instruction set
      // for writing files, so verifying after unpacking would be verifying bytes that had
      // already been acted upon.
      if (pin.kind === "digest") {
        const actual = sha256File(zip);
        if (actual !== pin.sha256) {
          throw new Error(
            `sha256 mismatch for ${destRel}: expected ${pin.sha256}, got ${actual} (${url})`,
          );
        }
      }

      const staged = join(work, "unpacked");
      mkdirSync(staged, { recursive: true });
      extractZip(zip, staged);

      // TWO QUESTIONS, ONE SYSCALL, ON THE STAGED TREE. "Does the archive contain `bin=`?" and
      // "is it executable?" are answered by the same `chmod`: it fails with ENOENT exactly when
      // the archive does not contain that path. An `existsSync` gate ahead of it would have
      // asked the first question, opened a window, and then asked the second — the check-then-use
      // shape `lint-check-then-use-file-races.ts` refuses, and it would have prevented nothing.
      // The bit matters because `tar`'s ZIP reader does not always carry it across, and a
      // toolchain that cannot be executed is not installed.
      if (binRel !== undefined) {
        try {
          chmodSync(join(staged, binRel), 0o755);
        } catch (err) {
          if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
            throw new Error(`from-zip ${destRel}: bin=${binRel} is not inside ${url}`);
          }
          throw err;
        }
      }

      // Swap the whole tree in one rename so an interrupted run never leaves a half-extracted
      // toolchain behind a receipt that says it is complete. The receipt is written INSIDE the
      // staged tree, before the swap, for the same reason: tree and receipt land together or
      // neither does.
      writeFileSync(
        join(staged, RECEIPT_BASENAME),
        `${JSON.stringify({ url, sha256: pin.kind === "digest" ? pin.sha256 : pin.kind }, null, 2)}\n`,
      );
      rmSync(dest, { recursive: true, force: true });
      renameSync(staged, dest);

      if (entry.attrs.shim !== undefined && binRel !== undefined) {
        linkShim(shimDir, entry.attrs.shim, join(dest, binRel));
        ctx.log(`✓ ${entry.attrs.shim} → ${join(dest, binRel)} (${shimDir})`);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }

    ctx.log(`✓ ${destRel}`);
  }

  ctx.log("✓ from-zip complete");
  return finishResult("from-zip", ctx, false);
};
