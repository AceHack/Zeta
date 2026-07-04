// from-git-hooks — ACE realizer: symlink tracked scripts/hooks/* into .git/hooks
// (081KWN0JKJV Option 3). Best-effort: skip when not a git work tree.
import { chmodSync, existsSync, mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { finishResult, type SetupRealizer } from "./shared.ts";

const HOOK_REL = "scripts/hooks/commit-msg";

export const realizeFromGitHooks: SetupRealizer = async (ctx) => {
  const hookSrc = join(ctx.repoRoot, HOOK_REL);
  if (!existsSync(hookSrc)) {
    ctx.warn(`from-git-hooks: missing ${HOOK_REL}`);
    return finishResult("from-git-hooks", ctx, true);
  }

  const inside = spawnSync("git", ["-C", ctx.repoRoot, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8",
  });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    ctx.log("✓ from-git-hooks: not a git work tree — skip");
    return finishResult("from-git-hooks", ctx, true);
  }

  const hooksPath = spawnSync("git", ["-C", ctx.repoRoot, "rev-parse", "--git-path", "hooks"], {
    encoding: "utf8",
  });
  if (hooksPath.status !== 0) {
    ctx.warn("from-git-hooks: cannot resolve git hooks path — skip");
    return finishResult("from-git-hooks", ctx, true);
  }
  let hooksDir = hooksPath.stdout.trim();
  if (!hooksDir.startsWith("/")) {
    hooksDir = join(ctx.repoRoot, hooksDir);
  }
  const dest = join(hooksDir, "commit-msg");

  if (ctx.dryRun) {
    ctx.log(`✓ from-git-hooks: would link ${dest} -> ${hookSrc}`);
    ctx.actions.push(`link ${dest}`);
    return finishResult("from-git-hooks", ctx, false);
  }

  mkdirSync(hooksDir, { recursive: true });
  chmodSync(hookSrc, 0o755);
  try {
    unlinkSync(dest);
  } catch {
    // absent is fine
  }
  symlinkSync(hookSrc, dest);
  ctx.log(`✓ from-git-hooks: linked ${dest} -> ${hookSrc}`);
  ctx.actions.push(`link ${dest}`);
  return finishResult("from-git-hooks", ctx, false);
};
