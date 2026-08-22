import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { curlFetchToFile, verifySha256File } from "./curl-fetch.ts";
import { expandPath, whenMatches } from "./when.ts";
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

function tarballCacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
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

  for (const entry of parseMechanismManifest(text)) {
    const binName = entry.tokens[0];
    const tarballUrl = entry.tokens[1];
    if (binName === undefined || tarballUrl === undefined) continue;

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

    const sha256 = entry.attrs.sha256;
    if (sha256 === undefined || sha256.length === 0) {
      throw new Error(`from-autotools-tarball ${binName}: sha256= pin required`);
    }

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

    if (!existsSync(tarball)) {
      ctx.log(`↓ from-autotools-tarball: ${binName} ← ${tarballUrl}`);
      const part = `${tarball}.part`;
      ctx.actions.push(ctx.dryRun ? `dry-run: curl ${tarballUrl}` : `curl ${tarballUrl} → ${tarball}`);
      if (!ctx.dryRun) {
        await curlFetchToFile(part, tarballUrl);
        verifySha256File(part, sha256);
        renameSync(part, tarball);
      }
    } else {
      ctx.log(`✓ from-autotools-tarball ${binName}: cached tarball present`);
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
