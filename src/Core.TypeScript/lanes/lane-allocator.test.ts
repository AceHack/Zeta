// Falsifiers for the lane allocator's mise grant.
//
// The live instance: on 2026-08-25, 34 of 56 worktrees on this machine were untrusted by mise.
// `tools/setup/common/mise.sh` trusts the clone it installs into, once; a worktree allocated later
// is a NEW PATH and inherits nothing. mise reports the untrusted state as `error parsing config
// file`, which reads as a malformed pin file rather than a missing grant, while the tools still
// resolve from PATH — so the lane keeps working and appears to be inside the pinned closure.
//
// WHY A FAKE `mise` ON PATH RATHER THAN THE REAL ONE.
// An earlier version of this file asserted `mise --version` succeeds and drove the real binary.
// That is a test of the RUNNER, not of this code, and it went red in `test (TS hermetic)` where no
// mise exists. The registry escape (`registry/environment-dependent-test-files.json`) was the wrong
// answer too: the `test (TS environment-dependent)` lane has no mise either, so registering would
// have moved the file to a tier that ALSO cannot run it — what that guard calls deletion wearing a
// tier move.
//
// The contract that is actually ours is narrow: after `git worktree add`, invoke `mise trust --all
// --yes` WITH CWD SET TO THE NEW WORKTREE, and do not let its failure break allocation. Whether
// mise then honours the grant is mise's contract, not ours. A recording stub on PATH tests our half
// exactly, in every environment, with no toolchain dependency — and it can test the failure branch,
// which a real mise cannot be made to exercise on demand.

import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "bun:test";

const ALLOCATOR = join(import.meta.dir, "lane-allocator.ts");
const cleanup: string[] = [];
afterAll(() => {
  for (const d of cleanup) rmSync(d, { recursive: true, force: true });
});

/** A `mise` on PATH that records how it was called, and exits with `code`. */
function fakeMise(dir: string, logPath: string, code: number): void {
  const bin = join(dir, "mise");
  writeFileSync(bin, `#!/bin/sh\nprintf '%s|%s\\n' "$PWD" "$*" >> ${JSON.stringify(logPath)}\nexit ${String(code)}\n`, "utf8");
  chmodSync(bin, 0o755);
}

function seedRepo(): { parent: string; root: string } {
  // realpath: macOS $TMPDIR symlinks /var -> /private/var, and the allocator reports resolved paths.
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "zeta-lane-")));
  cleanup.push(parent);
  const root = join(parent, "repo");
  mkdirSync(root, { recursive: true });
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- seeding a throwaway fixture repo.
  const git = (...a: string[]) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "test");
  writeFileSync(join(root, ".mise.toml"), '[tools]\nnode = { version = "22", compile = false }\n', "utf8");
  git("add", "-A");
  git("commit", "-q", "-m", "seed");
  return { parent, root };
}

function allocate(root: string, binDir: string) {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- driving the real CLI under test.
  return spawnSync("bun", [ALLOCATOR, "allocate", "doc", "lane-test-branch"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
  });
}

test("allocation invokes `mise trust` WITH CWD SET TO THE NEW WORKTREE", () => {
  const { parent, root } = seedRepo();
  const bin = join(parent, "bin");
  mkdirSync(bin, { recursive: true });
  const log = join(parent, "mise.log");
  fakeMise(bin, log, 0);

  const r = allocate(root, bin);
  expect(r.status).toBe(0);

  const lane = join(parent, "repo-doc-lane");
  cleanup.push(lane);
  expect(existsSync(log)).toBe(true);
  const calls = readFileSync(log, "utf8").trim().split("\n").map((l) => l.split("|"));
  // The cwd is the assertion that matters. mise keys trust BY PATH, so a grant made in the repo
  // root instead of the worktree would look identical in every log and grant nothing.
  expect(calls).toContainEqual([lane, "trust --all --yes"]);
  expect(`${r.stdout}${r.stderr}`).toContain(`mise:   trusted ${lane}`);
});

test("a FAILING mise trust does not break allocation — the lane is still usable", () => {
  const { parent, root } = seedRepo();
  const bin = join(parent, "bin");
  mkdirSync(bin, { recursive: true });
  const log = join(parent, "mise.log");
  fakeMise(bin, log, 1); // trust refuses

  const r = allocate(root, bin);
  cleanup.push(join(parent, "repo-doc-lane"));
  // Non-fatal by design: a lane that cannot be trusted is still a usable lane, and failing
  // allocation over it would turn a degraded closure into no lane at all. This branch was written
  // as a deliberate choice and, until this test, was never once executed.
  expect(r.status).toBe(0);
  expect(r.stderr).toContain("mise trust failed");
  expect(`${r.stdout}${r.stderr}`).not.toContain("mise:   trusted");
});
