import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  commandOnPath,
  finishResult,
  parseSimpleManifest,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-bun-global";

/** Migrate deprecated Codex `service_tier="default"` → `"flex"` (shell realizer parity). */
export function repairCodexServiceTierConfig(homeDir: string, dryRun: boolean): boolean {
  const configPath = join(homeDir, ".codex", "config.toml");
  let text: string;
  try {
    text = readFileSync(configPath, "utf8");
  } catch {
    return false;
  }
  if (!/^\s*service_tier\s*=\s*"default"\s*($|#)/m.test(text)) return false;
  const migrated = text.replace(
    /^(\s*service_tier\s*=\s*)"default"(\s*($|#))/m,
    '$1"flex"$2',
  );
  if (migrated === text) return false;
  if (!dryRun) writeFileSync(configPath, migrated);
  return true;
}

export const realizeFromBunGlobal: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ no agent-clis manifest; skipping");
    return finishResult("from-bun-global", ctx, true);
  }

  if (!commandOnPath("mise")) {
    ctx.warn("mise not on PATH; skipping agent-clis (bun comes from mise)");
    return finishResult("from-bun-global", ctx, true);
  }

  for (const pkg of parseSimpleManifest(text)) {
    await runCommand(
      ctx,
      `↓ bun -g install ${pkg} (best-effort agent CLI)...`,
      ["mise", "exec", "--", "bun", "install", "--global", pkg],
      { bestEffort: true },
    );
  }

  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (home && repairCodexServiceTierConfig(home, ctx.dryRun)) {
    ctx.log(`✓ codex config: migrated deprecated service_tier="default" -> "flex"`);
    ctx.actions.push("repair-codex-service-tier");
  }

  ctx.log("✓ agent-clis step complete (login to each CLI separately — install is account-free)");
  return finishResult("from-bun-global", ctx, false);
};
