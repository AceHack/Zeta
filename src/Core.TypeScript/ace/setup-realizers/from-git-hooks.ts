// from-git-hooks — ACE realizer: point this clone at the TRACKED scripts/hooks
// directory via core.hooksPath (081KWN0JKJV Option 3). Best-effort: skip when
// not a git work tree.
//
// Parity note (scripts/hooks/README.md "all three must stay equivalent"): this
// realizer previously symlinked scripts/hooks/commit-msg into
// `git rev-parse --git-path hooks`, exactly as install-git-hooks.sh did — and
// carried the same defect: the SOURCE is worktree-local while the DESTINATION
// is clone-global, so installing from a throwaway worktree left the owning
// clone with a dangling symlink and git silently skips a hook it cannot run.
//
// It also could not be left as-is once the shell installer moved to
// core.hooksPath: with that set, `--git-path hooks` returns `scripts/hooks`,
// so `dest` collapsed onto `hookSrc` and the unlink+symlink pair DELETED the
// tracked hook and replaced it with a self-referential symlink (measured:
// "Too many levels of symbolic links", git reports a typechange).
import { chmodSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { finishResult, type SetupRealizer } from "./shared.ts";

const HOOKS_REL = "scripts/hooks";
const HOOK_NAMES = ["commit-msg", "pre-push"] as const;

export const realizeFromGitHooks: SetupRealizer = async (ctx) => {
  const inside = spawnSync("git", ["-C", ctx.repoRoot, "rev-parse", "--is-inside-work-tree"], {
    encoding: "utf8",
  });
  if (inside.status !== 0 || inside.stdout.trim() !== "true") {
    ctx.log("✓ from-git-hooks: not a git work tree — skip");
    return finishResult("from-git-hooks", ctx, true);
  }

  // Refuse to clobber a foreign value rather than silently disabling hooks the
  // clone deliberately uses. Name the remedy — a refusal without one is a dead end.
  const existing = spawnSync("git", ["-C", ctx.repoRoot, "config", "--local", "--get", "core.hooksPath"], {
    encoding: "utf8",
  });
  const current = existing.status === 0 ? existing.stdout.trim() : "";
  if (current !== "" && current !== HOOKS_REL) {
    ctx.warn(
      `from-git-hooks: core.hooksPath is already '${current}' — refusing to overwrite. ` +
        `Remedy: adopt ours with 'git config --local core.hooksPath ${HOOKS_REL}', ` +
        `or add Zeta's hooks to '${current}'.`,
    );
    return finishResult("from-git-hooks", ctx, true);
  }

  if (ctx.dryRun) {
    ctx.log(`✓ from-git-hooks: would set core.hooksPath = ${HOOKS_REL}`);
    ctx.actions.push(`config core.hooksPath ${HOOKS_REL}`);
    return finishResult("from-git-hooks", ctx, false);
  }

  // Make the tracked hooks executable. Deliberately NO existsSync pre-check:
  // the answer would already be stale by the time chmod ran (check-then-use),
  // so the check would read as defensive and prevent nothing. One syscall, one
  // answer — a missing hook surfaces as ENOENT here.
  for (const hook of HOOK_NAMES) {
    try {
      chmodSync(join(ctx.repoRoot, HOOKS_REL, hook), 0o755);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      ctx.warn(`from-git-hooks: missing ${HOOKS_REL}/${hook} — skip`);
      return finishResult("from-git-hooks", ctx, true);
    }
  }

  // A RELATIVE value resolves against each worktree's own top level, and
  // --local lands in the shared .git/config, so one call arms every worktree.
  const set = spawnSync("git", ["-C", ctx.repoRoot, "config", "--local", "core.hooksPath", HOOKS_REL], {
    encoding: "utf8",
  });
  if (set.status !== 0) {
    ctx.warn(`from-git-hooks: could not set core.hooksPath — ${set.stderr.trim()}`);
    return finishResult("from-git-hooks", ctx, true);
  }

  ctx.log(`✓ from-git-hooks: core.hooksPath = ${HOOKS_REL} (tracked; resolves per-worktree)`);
  ctx.actions.push(`config core.hooksPath ${HOOKS_REL}`);
  return finishResult("from-git-hooks", ctx, false);
};
