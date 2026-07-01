import { parseSetupManifest } from "../setup-manifest.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type RealizeContext,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-dotnet-workload";

function installedWorkloadCount(): number {
  const proc = Bun.spawnSync(["dotnet", "workload", "list"], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) return 0;
  let inTable = false;
  let count = 0;
  for (const line of proc.stdout.toString().split(/\r?\n/)) {
    if (/^-+$/.test(line.trim())) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (!line.trim()) {
        inTable = false;
        continue;
      }
      count++;
    }
  }
  return count;
}

async function installWorkload(ctx: RealizeContext, workload: string): Promise<void> {
  ctx.log(`↓ dotnet workload install ${workload}...`);
  if (ctx.dryRun) {
    ctx.actions.push(`dry-run: dotnet workload install ${workload}`);
    return;
  }
  const skipSign = Bun.spawn(["dotnet", "workload", "install", workload, "--skip-sign-check"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await skipSign.exited) === 0) return;
  await runCommand(ctx, `↓ dotnet workload install ${workload} (fallback)...`, [
    "dotnet",
    "workload",
    "install",
    workload,
  ]);
}

export const realizeFromDotnetWorkload: SetupRealizer = async (ctx) => {
  if (!commandOnPath("dotnet")) {
    throw new Error("dotnet not on PATH (mise should have put it there)");
  }

  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  const entries = text ? parseSetupManifest(text) : [];

  for (const entry of entries) {
    await installWorkload(ctx, entry.spec);
  }

  const manifestEntries = entries.length;
  const installedCount = ctx.dryRun ? 0 : installedWorkloadCount();
  if (manifestEntries > 0 || installedCount > 0) {
    await runCommand(ctx, "↻ dotnet workload update...", ["dotnet", "workload", "update"], {
      bestEffort: true,
    });
  } else {
    ctx.log("✓ no workloads installed and manifest empty — skipping workload update (no idle network call)");
  }

  ctx.log("✓ dotnet workloads in sync");
  return finishResult("from-dotnet-workload", ctx, false);
};
