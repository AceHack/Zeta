import { parseSetupManifest } from "../setup-manifest.ts";
import { tierAllows, tierFromAttrs, resolveHostTier } from "./host-tier.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-dotnet-global";

function listInstalledGlobalTools(): Set<string> {
  const proc = Bun.spawnSync(["dotnet", "tool", "list", "-g"], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) return new Set();
  const installed = new Set<string>();
  for (const line of proc.stdout.toString().split(/\r?\n/).slice(2)) {
    const tool = line.trim().split(/\s+/)[0]?.toLowerCase();
    if (tool) installed.add(tool);
  }
  return installed;
}

export const realizeFromDotnetGlobal: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ no dotnet-tools manifest; skipping");
    return finishResult("from-dotnet-global", ctx, true);
  }

  if (!commandOnPath("dotnet")) {
    throw new Error("dotnet not on PATH (mise should have put it there)");
  }

  const host = resolveHostTier();
  const entries = parseSetupManifest(text);
  const installed = ctx.dryRun ? new Set<string>() : listInstalledGlobalTools();

  for (const entry of entries) {
    const requiredTier = tierFromAttrs(entry.attrs);
    const tool = entry.spec;
    if (!tierAllows(requiredTier, host)) {
      ctx.log(
        `→ ${tool} skipped: requires tier=${requiredTier}, host is ${host.tier} (${host.source})`,
      );
      continue;
    }

    const toolLc = tool.toLowerCase();
    if (installed.has(toolLc)) {
      await runCommand(ctx, `✓ ${tool} already installed; updated if possible`, ["dotnet", "tool", "update", "-g", tool], {
        bestEffort: true,
      });
    } else {
      await runCommand(ctx, `↓ dotnet tool install -g ${tool}...`, ["dotnet", "tool", "install", "-g", tool]);
      ctx.log(`✓ ${tool} installed`);
    }
  }

  ctx.log("✓ dotnet global tools up to date");
  return finishResult("from-dotnet-global", ctx, false);
};
