import { join } from "node:path";
import { commandOnPath, finishResult, readManifestFile, runCommand, type SetupRealizer } from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-agda-cubical";
const SCRIPT = join("tools", "setup", "common", "agda-cubical.sh");

/**
 * Cubical Agda proof lane (081KX1VE4G808QG0R003DCK3GV): pinned agda/cubical
 * clone + Agda user-library registration + `--cubical` verify typecheck.
 *
 * Thin adapter: the single implementation is tools/setup/common/agda-cubical.sh
 * (mirrors the tlaps.sh shape); this realizer is the ACE-tracked pointer to it.
 * The Agda BINARY comes from manifests/{brew,apt} — the script itself skips
 * gracefully when agda is absent (e.g. macOS slim-tier hosts), so this lane
 * never fails a minimal install.
 */
export const realizeFromAgdaCubical: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-agda-cubical: no manifest; skipping");
    return finishResult("from-agda-cubical", ctx, true);
  }

  if (!commandOnPath("agda")) {
    ctx.log("✓ from-agda-cubical: agda not on PATH (slim tier or system-package step pending); skipping");
    ctx.log("  agda is declared in tools/setup/manifests/{brew,apt} (brew: tier=standard)");
    return finishResult("from-agda-cubical", ctx, true);
  }

  await runCommand(ctx, "↓ from-agda-cubical: pinned cubical library clone + registration + verify...", [
    "bash",
    join(ctx.repoRoot, SCRIPT),
  ]);

  ctx.log("✓ from-agda-cubical complete");
  return finishResult("from-agda-cubical", ctx, false);
};
