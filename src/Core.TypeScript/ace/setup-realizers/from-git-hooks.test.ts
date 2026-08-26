// Falsifiers for the hook-install path (081KWN0JKJV).
//
// THE defect these exist to keep fixed: the installer's SOURCE was
// worktree-local while its DESTINATION (`git rev-parse --git-path hooks`) is
// clone-global. Installing from a throwaway worktree therefore wrote a symlink
// into the OWNING CLONE pointing into a directory about to be deleted — and git
// SKIPS a hook it cannot execute WITHOUT ANY ERROR, so commit-msg and pre-push
// stopped running for every worktree of that clone with no signal at all.
//
// Every test below asserts that a hook RUNS, never merely that a file exists: a
// symlink that resolves is not proof git invoked anything.
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { realizeFromGitHooks } from "./from-git-hooks.ts";
import type { RealizeContext } from "./shared.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..", "..");
const HOOK_FILES = ["commit-msg", "pre-push", "install-git-hooks.sh"] as const;

function git(cwd: string, ...args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/** A repo carrying the real tracked hooks + installer, with nothing armed yet. */
function scaffold(): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-hooks-"));
  const clone = join(root, "clone");
  mkdirSync(join(clone, "scripts", "hooks"), { recursive: true });
  git(clone, "init", "-q", ".");
  git(clone, "config", "user.email", "test@example.invalid");
  git(clone, "config", "user.name", "Test");
  for (const name of HOOK_FILES) {
    writeFileSync(
      join(clone, "scripts", "hooks", name),
      readFileSync(join(REPO_ROOT, "scripts", "hooks", name), "utf8"),
    );
    chmodSync(join(clone, "scripts", "hooks", name), 0o755);
  }
  writeFileSync(join(clone, "f.txt"), "base\n");
  git(clone, "add", "-A");
  git(clone, "commit", "-qm", "init");
  return clone;
}

/**
 * Attempt a commit whose SUBJECT carries the Manus wrapper leak the tracked
 * commit-msg hook refuses. Returns true when the hook actually RAN and blocked.
 */
let probeCounter = 0;

function hookBlocksLeakSubject(clone: string): boolean {
  // Deterministic filler: the content only has to differ from the last commit,
  // and a seeded counter keeps the test DST-replayable.
  probeCounter += 1;
  writeFileSync(join(clone, "f.txt"), `probe-${String(probeCounter)}\n`);
  git(clone, "add", "-A");
  const out = git(clone, "commit", "-m", "probe __manus_ec leak subject");
  return out.status !== 0;
}

function runInstaller(cwd: string) {
  return spawnSync("bash", [join(cwd, "scripts", "hooks", "install-git-hooks.sh")], {
    cwd,
    encoding: "utf8",
  });
}

function makeCtx(repoRoot: string, dryRun = false) {
  const logs: string[] = [];
  const ctx: RealizeContext = {
    repoRoot,
    dryRun,
    actions: [],
    log: (m) => logs.push(m),
    warn: (m) => logs.push(`WARN ${m}`),
  };
  return { ctx, logs };
}

describe("hook install — the worktree falsifier", () => {
  // The control. Without it, a passing test below could be passing because the
  // probe is broken rather than because the hook fired.
  test("CONTROL: with nothing installed, the leak subject is NOT blocked", () => {
    const clone = scaffold();
    try {
      expect(hookBlocksLeakSubject(clone)).toBe(false);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("shell installer: worktree → install → DELETE worktree → hooks still EXECUTE", () => {
    const clone = scaffold();
    const wt = join(clone, "..", "throwaway");
    try {
      git(clone, "worktree", "add", "-q", "-b", "wt", wt);
      const installed = runInstaller(wt);
      expect(installed.status).toBe(0);

      git(clone, "worktree", "remove", "--force", wt);
      rmSync(wt, { recursive: true, force: true });

      // The whole point: the owning clone is still armed.
      expect(hookBlocksLeakSubject(clone)).toBe(true);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("ACE realizer: worktree → realize → DELETE worktree → hooks still EXECUTE", async () => {
    const clone = scaffold();
    const wt = join(clone, "..", "throwaway");
    try {
      git(clone, "worktree", "add", "-q", "-b", "wt", wt);
      const { ctx } = makeCtx(wt);
      await realizeFromGitHooks(ctx);

      git(clone, "worktree", "remove", "--force", wt);
      rmSync(wt, { recursive: true, force: true });

      expect(hookBlocksLeakSubject(clone)).toBe(true);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("the realizer never rewrites the TRACKED hook it points at", async () => {
    // Under core.hooksPath, `--git-path hooks` returns `scripts/hooks`, so the
    // old unlink+symlink pair collapsed onto its own source and destroyed it.
    const clone = scaffold();
    try {
      expect(runInstaller(clone).status).toBe(0);
      const { ctx } = makeCtx(clone);
      await realizeFromGitHooks(ctx);

      expect(git(clone, "status", "--porcelain", "scripts/hooks").stdout.trim()).toBe("");
      expect(hookBlocksLeakSubject(clone)).toBe(true);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("each worktree runs ITS OWN branch's hook, not the installing one's", () => {
    // This is the claim the relative value is chosen for, so it is tested
    // directly rather than inferred from "the install worked". A shared
    // absolute path would make every worktree run one checkout's copy.
    const clone = scaffold();
    const wt = join(clone, "..", "feature");
    try {
      expect(runInstaller(clone).status).toBe(0);
      git(clone, "worktree", "add", "-q", "-b", "feature", wt);

      // Give ONLY the feature branch a hook that also refuses "BANANA".
      writeFileSync(
        join(wt, "scripts", "hooks", "commit-msg"),
        '#!/usr/bin/env bash\ngrep -q BANANA "$1" && exit 1\nexit 0\n',
      );
      chmodSync(join(wt, "scripts", "hooks", "commit-msg"), 0o755);
      git(wt, "add", "-A");
      git(wt, "commit", "-qm", "feature-branch hook");

      const bananaIn = (cwd: string) => {
        writeFileSync(join(cwd, "f.txt"), `banana-${String((probeCounter += 1))}\n`);
        git(cwd, "add", "-A");
        return git(cwd, "commit", "-m", "BANANA subject").status !== 0;
      };

      expect(bananaIn(wt)).toBe(true); // feature branch's own hook refuses
      expect(bananaIn(clone)).toBe(false); // the base branch's hook does not
      expect(hookBlocksLeakSubject(clone)).toBe(true); // and still guards its own
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });
});

describe("hook install — first install and repair", () => {
  test("fresh single-worktree clone (the common case) arms the hooks", () => {
    const clone = scaffold();
    try {
      expect(runInstaller(clone).status).toBe(0);
      expect(hookBlocksLeakSubject(clone)).toBe(true);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("re-running is idempotent and stays armed", () => {
    const clone = scaffold();
    try {
      expect(runInstaller(clone).status).toBe(0);
      expect(runInstaller(clone).status).toBe(0);
      expect(hookBlocksLeakSubject(clone)).toBe(true);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("a clone left DANGLING by the old installer is healed", () => {
    const clone = scaffold();
    try {
      mkdirSync(join(clone, ".git", "hooks"), { recursive: true });
      symlinkSync(
        join(clone, "..", "deleted-worktree", "scripts", "hooks", "commit-msg"),
        join(clone, ".git", "hooks", "commit-msg"),
      );
      // Precondition: genuinely disarmed, exactly as the fleet was found.
      expect(hookBlocksLeakSubject(clone)).toBe(false);

      expect(runInstaller(clone).status).toBe(0);
      expect(hookBlocksLeakSubject(clone)).toBe(true);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });
});

describe("hook install — refusals name their remedy", () => {
  test("a foreign core.hooksPath is preserved, not clobbered", () => {
    const clone = scaffold();
    try {
      git(clone, "config", "--local", "core.hooksPath", "their-hooks");
      const out = runInstaller(clone);
      expect(out.status).not.toBe(0);
      expect(out.stderr).toContain("Remedy:");
      expect(git(clone, "config", "--local", "--get", "core.hooksPath").stdout.trim()).toBe("their-hooks");
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("a worktree-local core.hooksPath that would SHADOW us is refused", () => {
    const clone = scaffold();
    const wt = join(clone, "..", "shadowed");
    try {
      expect(runInstaller(clone).status).toBe(0);
      git(clone, "config", "extensions.worktreeConfig", "true");
      git(clone, "worktree", "add", "-q", "-b", "shadow-wt", wt);
      git(wt, "config", "--worktree", "core.hooksPath", "/dev/null");

      const out = runInstaller(wt);
      expect(out.status).not.toBe(0);
      expect(out.stderr).toContain("Remedy:");
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("the realizer refuses a foreign core.hooksPath and says how to adopt ours", async () => {
    const clone = scaffold();
    try {
      git(clone, "config", "--local", "core.hooksPath", "their-hooks");
      const { ctx, logs } = makeCtx(clone);
      const result = await realizeFromGitHooks(ctx);
      expect(result.skipped).toBe(true);
      expect(logs.join("\n")).toContain("Remedy:");
      expect(git(clone, "config", "--local", "--get", "core.hooksPath").stdout.trim()).toBe("their-hooks");
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("realizer dry-run changes nothing", async () => {
    const clone = scaffold();
    try {
      const { ctx } = makeCtx(clone, true);
      await realizeFromGitHooks(ctx);
      expect(git(clone, "config", "--local", "--get", "core.hooksPath").stdout.trim()).toBe("");
      expect(hookBlocksLeakSubject(clone)).toBe(false);
    } finally {
      rmSync(join(clone, ".."), { recursive: true, force: true });
    }
  });

  test("not a git work tree — skips cleanly rather than failing the install", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-hooks-bare-"));
    try {
      mkdirSync(join(root, "scripts", "hooks"), { recursive: true });
      for (const name of HOOK_FILES) {
        writeFileSync(
          join(root, "scripts", "hooks", name),
          readFileSync(join(REPO_ROOT, "scripts", "hooks", name), "utf8"),
        );
      }
      expect(runInstaller(root).status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
