import { existsSync, unlinkSync } from "node:fs";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { curlFetchToFile } from "./curl-fetch.ts";
import { whenMatches } from "./when.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";
import { resolveElevatorPathOrThrow } from "../../privilege/elevator.ts";

const MANIFEST = "tools/setup/manifests/from-deb";
const DPKG_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

function debInstalled(name: string): boolean {
  return commandOnPath(name) || existsSync(`/usr/bin/${name}`);
}

export const realizeFromDeb: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-deb: no manifest; skipping");
    return finishResult("from-deb", ctx, true);
  }

  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  // Resolved ABSOLUTE, root-owned, setuid — never through PATH. This prefix fronts `dpkg`
  // installs, so a `PATH`-shimmed elevator here chooses what gets installed as root, with
  // no git diff for review to see (docs/BUGS.md P1, 2026-08-24).
  const sudoPrefix = isRoot ? ([] as readonly string[]) : ([resolveElevatorPathOrThrow("sudo")] as readonly string[]);

  for (const entry of parseMechanismManifest(text)) {
    const name = entry.tokens[0];
    const debUrl = entry.tokens[1];
    if (name === undefined || debUrl === undefined) continue;

    const whenSpec = entry.attrs.when;
    if (!whenMatches(whenSpec, ctx.warn)) {
      ctx.log(`✓ from-deb ${name}: skipping (when=${whenSpec ?? ""})`);
      continue;
    }

    if (debInstalled(name)) {
      ctx.log(`✓ from-deb ${name}: already installed`);
      continue;
    }

    const deps = entry.attrs.deps;
    if (deps !== undefined) {
      for (const dep of deps.split(",")) {
        const trimmed = dep.trim();
        if (trimmed.length === 0) continue;
        const check = Bun.spawnSync(["dpkg", "-s", trimmed], { stdout: "ignore", stderr: "ignore" });
        if (check.exitCode !== 0) {
          ctx.log(`↓ from-deb ${name}: installing dep ${trimmed}`);
          await runCommand(ctx, `↓ from-deb ${name}: apt-get install ${trimmed}`, [
            ...sudoPrefix,
            "apt-get",
            "install",
            "-y",
            "--no-install-recommends",
            trimmed,
          ]);
        }
      }
    }

    if (!debUrl.startsWith("http://") && !debUrl.startsWith("https://")) {
      throw new Error(`from-deb ${name}: URL must be http(s): ${debUrl}`);
    }

    const tmpDeb = `${process.env.TMPDIR ?? "/tmp"}/zeta-deb-${name}-${String(Date.now())}.deb`;
    ctx.log(`↓ from-deb: ${name} ← ${debUrl}`);
    ctx.actions.push(ctx.dryRun ? `dry-run: curl ${debUrl} → ${tmpDeb}` : `curl ${debUrl} → ${tmpDeb}`);
    if (!ctx.dryRun) {
      await curlFetchToFile(tmpDeb, debUrl);
      const dpkgArgv = [...sudoPrefix, "env", `PATH=${DPKG_PATH}`, "dpkg", "-i", tmpDeb];
      const dpkgOk = await runCommand(ctx, `↓ from-deb ${name}: dpkg -i`, dpkgArgv, { bestEffort: true });
      if (!dpkgOk) {
        await runCommand(ctx, `↓ from-deb ${name}: apt-get install -fy`, [
          ...sudoPrefix,
          "env",
          `PATH=${DPKG_PATH}`,
          "apt-get",
          "install",
          "-fy",
        ]);
      }
      try {
        unlinkSync(tmpDeb);
      } catch {
        /* absent */
      }
    }

    if (!ctx.dryRun && !debInstalled(name)) {
      throw new Error(`from-deb ${name}: install finished but binary missing`);
    }
    ctx.log(`✓ from-deb ${name}: installed`);
  }

  ctx.log("✓ from-deb complete");
  return finishResult("from-deb", ctx, false);
};
