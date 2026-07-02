import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { whenMatches } from "./when.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-shim";

export const realizeFromShim: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-shim: no manifest; skipping");
    return finishResult("from-shim", ctx, true);
  }

  const shimDir = process.env.ZETA_SHIM_DIR ?? join(process.env.HOME ?? "", ".local/bin");

  for (const entry of parseMechanismManifest(text)) {
    const shimName = entry.tokens[0];
    const sourceBin = entry.tokens[1];
    if (shimName === undefined || sourceBin === undefined) continue;

    const whenSpec = entry.attrs.when;
    if (!whenMatches(whenSpec, ctx.warn)) {
      ctx.log(`✓ from-shim ${shimName}: skipping (when=${whenSpec ?? ""})`);
      continue;
    }

    if (commandOnPath(shimName)) {
      ctx.log(`✓ from-shim ${shimName}: already on PATH`);
      continue;
    }

    const sourcePath = Bun.which(sourceBin);
    if (sourcePath === null) {
      ctx.log(`✓ from-shim ${shimName}: source ${sourceBin} not present; skipping`);
      continue;
    }

    const linkPath = join(shimDir, shimName);
    ctx.log(`↻ from-shim: ${shimName} → ${sourceBin} (${shimDir})`);
    ctx.actions.push(ctx.dryRun ? `dry-run: ln -sf ${sourcePath} ${linkPath}` : `ln -sf ${sourcePath} ${linkPath}`);
    if (!ctx.dryRun) {
      mkdirSync(shimDir, { recursive: true });
      symlinkSync(sourcePath, linkPath);
    }
  }

  ctx.log("✓ from-shim complete");
  return finishResult("from-shim", ctx, false);
};
