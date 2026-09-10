import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { curlFetchToFile, sha256FileMatches, verifySha256File } from "./curl-fetch.ts";
import { resolvePin, unhashedInstallNotice } from "./unhashed-pin.ts";
import { expandPath, whenMatches } from "./when.ts";
import { tierAllows, tierFromAttrs, resolveHostTier } from "./host-tier.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-autotools-tarball";
const EPROVER_SMOKE_QUERY = "fof(smoke, conjecture, (![X]: X = X)).";

function resolveBinary(name: string, prefix: string): string | null {
  const prefixed = join(prefix, "bin", name);
  if (existsSync(prefixed)) {
    try {
      const st = statSync(prefixed);
      if (st.isFile()) return prefixed;
    } catch {
      /* absent */
    }
  }
  return Bun.which(name);
}

async function folSmokeOk(name: string, bin: string, dryRun: boolean): Promise<boolean> {
  if (dryRun) return true;
  if (!existsSync(bin)) return false;
  if (name === "eprover") {
    const proc = Bun.spawn(["sh", "-c", `printf '%s\\n' '${EPROVER_SMOKE_QUERY}' | '${bin}' --auto --tstp-format`], {
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await proc.exited) === 0;
  }
  const proc = Bun.spawn([bin, "--version"], { stdout: "ignore", stderr: "ignore" });
  return (await proc.exited) === 0;
}

export function tarballCacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/**
 * What to do with the on-disk tarball, as a pure function of two facts.
 *
 * Extracted so the cache decision can be tested without a network, a runner,
 * or a filesystem: the interesting case (a present-but-wrong cache entry) is
 * exactly the one that is hardest to stage for real and most expensive to get
 * wrong, since the wrong answer feeds unverified bytes into `make install` for
 * a theorem prover.
 */
export type TarballDisposition = "use-cached" | "fetch" | "discard-and-fetch";

export function tarballDisposition(present: boolean, digestMatches: boolean): TarballDisposition {
  if (!present) return "fetch";
  return digestMatches ? "use-cached" : "discard-and-fetch";
}

function processorCount(): number {
  const out = spawnSync("getconf", ["_NPROCESSORS_ONLN"], { encoding: "utf8" });
  const n = Number(out.stdout?.trim() ?? 0);
  return n > 0 ? n : 2;
}

function findConfigureDir(buildDir: string): string | null {
  if (existsSync(join(buildDir, "configure"))) return buildDir;
  const entries = spawnSync("find", [buildDir, "-mindepth", "1", "-maxdepth", "1", "-type", "d"], {
    encoding: "utf8",
  });
  const nested = entries.stdout?.split("\n").find((line) => line.length > 0);
  if (nested !== undefined && existsSync(join(nested, "configure"))) return nested;
  return null;
}

export const realizeFromAutotoolsTarball: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-autotools-tarball: no manifest; skipping");
    return finishResult("from-autotools-tarball", ctx, true);
  }

  const cacheRoot =
    process.env.ZETA_AUTOMAKE_CACHE ?? join(process.env.HOME ?? "", ".cache/zeta/from-autotools-tarball");
  const defaultPrefix = process.env.ZETA_AUTOMAKE_PREFIX ?? join(process.env.HOME ?? "", ".local");

  // HOST TIERS (081KTWQZY7F). This mechanism SOURCE-BUILDS its entries — `configure`
  // + `make install` — which is the most expensive thing in the install graph per
  // byte downloaded, and the cost lands hardest exactly where it is least affordable:
  // measured 76s for eprover on the 1-vCPU ubuntu-slim runner, whose entire job is a
  // `dotnet build`. from-dotnet-global has honoured `tier=` since that workitem; this
  // is the same gate on the mechanism that pays the most for lacking it.
  const host = resolveHostTier();

  for (const entry of parseMechanismManifest(text)) {
    const binName = entry.tokens[0];
    const tarballUrl = entry.tokens[1];
    if (binName === undefined || tarballUrl === undefined) continue;

    const requiredTier = tierFromAttrs(entry.attrs);
    if (!tierAllows(requiredTier, host)) {
      ctx.log(
        `→ from-autotools-tarball ${binName} skipped: requires tier=${requiredTier}, host is ${host.tier} (${host.source})`,
      );
      continue;
    }

    const whenSpec = entry.attrs.when;
    if (!whenMatches(whenSpec, ctx.warn)) {
      ctx.log(`✓ from-autotools-tarball ${binName}: skipping (when=${whenSpec ?? ""})`);
      continue;
    }

    const prefix = expandPath(entry.attrs.prefix ?? defaultPrefix);
    mkdirSync(join(prefix, "bin"), { recursive: true });
    mkdirSync(cacheRoot, { recursive: true });

    const existing = resolveBinary(binName, prefix);
    if (existing !== null && (await folSmokeOk(binName, existing, ctx.dryRun))) {
      ctx.log(`✓ from-autotools-tarball ${binName}: functional at ${existing}`);
      continue;
    }

    // UNHASHED IS A DECLARED CLASS HERE TOO (081M25Z29W4087G0R002Y0Q1MG). The bare
    // `sha256= pin required` refusal stays exactly as it was for a row that declares NOTHING;
    // what is new is that a source tarball with no stable digest now has a spelling instead of
    // being unbuildable. One vocabulary, shared with from-url and from-elan.
    const pin = resolvePin("from-autotools-tarball", binName, tarballUrl, entry.attrs);

    if (!tarballUrl.startsWith("http://") && !tarballUrl.startsWith("https://")) {
      throw new Error(`from-autotools-tarball ${binName}: URL must be http(s): ${tarballUrl}`);
    }

    for (const tool of ["make", "gcc", "cc"] as const) {
      if (!commandOnPath(tool)) {
        throw new Error(`from-autotools-tarball ${binName}: requires ${tool} on PATH (build-essential)`);
      }
    }

    const cacheKey = tarballCacheKey(tarballUrl);
    const tarball = join(cacheRoot, `${cacheKey}.tgz`);
    const buildDir = join(cacheRoot, `${cacheKey}-build`);

    // A RESTORED CACHE ENTRY IS EVIDENCE ONLY IF IT IS CHECKED (2026-08-17).
    //
    // `existsSync(tarball)` used to be the whole test: a tarball already on
    // disk was fed to `tar` and then to `./configure && make install` with no
    // digest check, because the digest was verified once at download time and
    // the file was assumed untouched since. That assumption held while the
    // cache was one developer's `~/.cache`. It stops holding the moment CI
    // restores this directory from `actions/cache` — a truncated upload, an
    // evicted-and-partially-restored entry, or a poisoned cache would then walk
    // straight into the toolchain that produces our FOL proofs, and the build
    // would succeed. Verifying only the copy you just downloaded checks the
    // path that was never in doubt and skips the one that is.
    //
    // So the pin is checked on EVERY path into the build. A mismatch is not
    // fatal on its own — the cache is derived state and may legitimately be
    // corrupt — so the bad copy is discarded and refetched; a mismatch on the
    // freshly downloaded bytes still throws, because that is upstream
    // disagreeing with the pin and no retry can fix it.
    // An unhashed row has no pin to judge the cache against, so a present tarball is used as
    // found. That is a REAL loss and it is named rather than papered over: the paragraph above
    // exists because a restored CI cache is exactly the copy nobody verified, and for a declared
    // unhashed row nothing here can re-establish it. It is the cost the declaration buys.
    const present = existsSync(tarball);
    const cacheTrusted = ctx.dryRun || pin.kind !== "digest" || (present && sha256FileMatches(tarball, pin.sha256));
    const disposition = tarballDisposition(present, cacheTrusted);
    if (disposition === "discard-and-fetch") {
      ctx.warn(
        `from-autotools-tarball ${binName}: cached tarball failed its sha256 pin; discarding and refetching`,
      );
      rmSync(tarball, { force: true });
    }

    if (disposition !== "use-cached") {
      ctx.log(`↓ from-autotools-tarball: ${binName} ← ${tarballUrl}`);
      const part = `${tarball}.part`;
      ctx.actions.push(ctx.dryRun ? `dry-run: curl ${tarballUrl}` : `curl ${tarballUrl} → ${tarball}`);
      if (!ctx.dryRun) {
        await curlFetchToFile(part, tarballUrl);
        const notice = unhashedInstallNotice(pin, binName, tarballUrl);
        if (notice !== null) ctx.warn(notice);
        if (pin.kind === "digest") verifySha256File(part, pin.sha256);
        renameSync(part, tarball);
      }
    } else {
      ctx.log(`✓ from-autotools-tarball ${binName}: cached tarball present and matches sha256 pin`);
    }

    if (ctx.dryRun) continue;

    rmSync(buildDir, { recursive: true, force: true });
    mkdirSync(buildDir, { recursive: true });
    await runCommand(ctx, `↓ tar -xzf ${tarball}`, ["tar", "-C", buildDir, "-xzf", tarball]);

    const srcDir = findConfigureDir(buildDir);
    if (srcDir === null) {
      throw new Error(`from-autotools-tarball ${binName}: no configure script in tarball`);
    }

    ctx.log(`↓ from-autotools-tarball ${binName}: building into ${prefix}`);
    const jobs = String(processorCount());
    await runCommand(ctx, `./configure --prefix=${prefix}`, ["./configure", `--prefix=${prefix}`], {
      cwd: srcDir,
    });
    await runCommand(ctx, `make -j${jobs}`, ["make", `-j${jobs}`], { cwd: srcDir });
    await runCommand(ctx, "make install", ["make", "install"], { cwd: srcDir });

    const installed = resolveBinary(binName, prefix);
    if (installed === null || !(await folSmokeOk(binName, installed, ctx.dryRun))) {
      throw new Error(`from-autotools-tarball ${binName}: build finished but smoke test failed`);
    }
    ctx.log(`✓ from-autotools-tarball ${binName}: installed at ${installed}`);
  }

  ctx.log("✓ from-autotools-tarball complete");
  return finishResult("from-autotools-tarball", ctx, false);
};
