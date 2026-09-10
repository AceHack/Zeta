import { readFileSync, unlinkSync } from "node:fs";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { curlFetchToFile, verifySha256File } from "./curl-fetch.ts";
import { resolvePin, unhashedInstallNotice, type Pin } from "./unhashed-pin.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-installer";

function currentOsToken(): string {
  if (process.platform === "darwin") return "mac";
  if (process.platform === "linux") return "linux";
  return "other";
}

function osFilterAllows(filter: string): boolean {
  if (filter === "all") return true;
  const current = currentOsToken();
  return `,${filter},`.includes(`,${current},`);
}

function shouldSkipNonInteractive(): boolean {
  return !process.stdin.isTTY && process.env.ZETA_INSTALL_FULL !== "1";
}

export const realizeFromInstaller: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-installer: no manifest; skipping");
    return finishResult("from-installer", ctx, true);
  }

  if (shouldSkipNonInteractive()) {
    ctx.log(
      "✓ from-installer: skipping dev-CLI installers (non-interactive; set ZETA_INSTALL_FULL=1 to exercise)",
    );
    return finishResult("from-installer", ctx, true);
  }

  const forceUpdate = process.env.ZETA_FORCE_UPDATE_TOOLS === "1";

  const entries = parseMechanismManifest(text);

  // THE PIN IS RESOLVED FOR EVERY ROW BEFORE ANY ROW IS INSTALLED, and a manifest defect throws
  // rather than warning. This mechanism is best-effort about the NETWORK and about vendor login
  // — it is not best-effort about what the manifest says, and treating a missing declaration the
  // way it treats a flaky download would make the declaration optional in practice.
  //
  // WHAT CHANGED HERE (081M25Z29W4087G0R002Y0Q1MG). This mechanism had no digest slot at all: six
  // vendor shell scripts were fetched over HTTPS and executed, with HTTPS as the only trust
  // anchor and nothing anywhere recording that fact. That is the WORST version of an unhashed
  // dependency — not one somebody accepted, one nobody had to. It is now the same declared class
  // as everywhere else: a row must carry a digest, or say why it has none.
  const pins = new Map<string, Pin>();
  for (const entry of entries) {
    const bin = entry.tokens[0];
    const url = entry.tokens[1];
    if (bin === undefined || url === undefined) continue;
    pins.set(bin, resolvePin("from-installer", bin, url, entry.attrs));
  }

  for (const entry of entries) {
    const bin = entry.tokens[0];
    const url = entry.tokens[1];
    if (bin === undefined) continue;
    if (url === undefined) {
      ctx.warn(`registry entry '${bin}' has no installer URL; skipping`);
      continue;
    }
    const pin = pins.get(bin)!;

    const interp = entry.attrs.interp ?? "bash";
    const osFilter = entry.attrs.os ?? "all";
    const installerArgs = entry.attrs.args !== undefined ? [entry.attrs.args] : [];

    if (!osFilterAllows(osFilter)) {
      ctx.log(`✓ ${bin}: skipping on ${currentOsToken()} (registry restricts to os=${osFilter})`);
      continue;
    }

    if (!forceUpdate && commandOnPath(bin)) {
      ctx.log(
        `✓ ${bin} already installed; skipping (self-updating; set ZETA_FORCE_UPDATE_TOOLS=1 to force re-run)`,
      );
      continue;
    }

    if (!url.startsWith("https://")) {
      ctx.warn(`refusing non-https installer URL for '${bin}' (${url}); skipping (HTTPS is the trust anchor)`);
      continue;
    }

    const updating = commandOnPath(bin);
    ctx.log(
      updating
        ? `↻ updating ${bin} via ${url} (ZETA_FORCE_UPDATE_TOOLS=1; download-then-exec, best-effort)...`
        : `↓ installing ${bin} via ${url} (download-then-exec, best-effort)...`,
    );

    const tmp = `${process.env.TMPDIR ?? "/tmp"}/zeta-installer-${bin}-${String(Date.now())}`;
    ctx.actions.push(ctx.dryRun ? `dry-run: curl ${url} → exec ${interp}` : `curl ${url} → exec ${interp}`);

    if (ctx.dryRun) continue;

    try {
      await curlFetchToFile(tmp, url);
      const stat = readFileSync(tmp);
      if (stat.length === 0) {
        ctx.warn(`installer for '${bin}' downloaded empty; refusing to exec; continuing (best-effort)`);
        continue;
      }

      const notice = unhashedInstallNotice(pin, bin, url);
      if (notice !== null) ctx.warn(notice);
      // A digest row REFUSES TO EXEC on a mismatch. verifySha256File throws, the catch below
      // turns it into a warn, and the script is never spawned — which is the whole point of
      // being able to declare a digest here at all.
      if (pin.kind === "digest") verifySha256File(tmp, pin.sha256);

      const proc = Bun.spawn([interp, tmp, ...installerArgs], {
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
      });
      const code = await proc.exited;
      if (code !== 0) {
        ctx.warn(
          `installer for '${bin}' failed; continuing (best-effort — auth/login is the operator's)`,
        );
      }
    } catch (err) {
      ctx.warn(`download failed for '${bin}' (${url}); continuing (best-effort): ${String(err)}`);
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
        /* absent */
      }
    }
  }

  ctx.log("✓ from-installer complete (login to each CLI separately — install is account-free)");
  return finishResult("from-installer", ctx, false);
};
