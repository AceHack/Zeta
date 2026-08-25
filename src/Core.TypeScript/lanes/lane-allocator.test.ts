// Falsifier for the lane allocator's mise grant.
//
// The live instance: on 2026-08-25, 34 of 56 worktrees on this machine were untrusted by mise.
// `tools/setup/common/mise.sh` trusts the clone it installs into, once; a worktree allocated later
// is a new path and inherits nothing.
//
// The failure is quiet in the worst way. mise reports the untrusted state as `error parsing config
// file`, which reads as a malformed pin file rather than a missing grant, and the tools still
// resolve from whatever is on PATH — so the lane keeps working and appears to be inside the pinned
// closure. On this machine it happened to be: `bun` resolved to the mise install at the pinned
// 1.3.14 anyway. On a host whose PATH differs it would silently disagree with CI, which is the
// whole failure this closure exists to prevent.
//
// WHY THIS ASSERTS THE INVOCATION AND NOT THE RESULTING TRUST STATE.
// mise assumes trust when it detects CI (`mise trust --help`), so on a runner the untrusted state
// cannot be constructed and a before/after trust-state check would pass for free — green exactly
// where it does nothing. The obvious workaround, MISE_PARANOID=1, is worse: paranoid mode ignores
// the trust store entirely, so no grant satisfies it and the check can never pass. Both were built
// and measured before this was written. So the environment-independent property is asserted here,
// and the environment-dependent half was verified by hand on 2026-08-25: 34 untrusted worktrees
// repaired, re-measured at 56/56 trusted, with a discriminating control (a plain-version config is
// auto-trusted; one carrying a tool option is not — which is why the repo's own `.mise.toml`,
// holding `node.compile` / `python.compile` / `python.uv_venv_auto`, demands a grant).

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "bun:test";

const ALLOCATOR = join(import.meta.dir, "lane-allocator.ts");
const cleanup: string[] = [];
afterAll(() => {
  for (const d of cleanup) rmSync(d, { recursive: true, force: true });
});

test("mise is on PATH — it is an OS-closure primitive here, not an optional convenience", () => {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- same delegation as lane-allocator.ts: this test drives the real toolchain, which is the point of it.
  expect(spawnSync("mise", ["--version"], { encoding: "utf8" }).status).toBe(0);
});

test("allocating a lane grants mise trust at the new worktree path", () => {
  // realpath: on macOS $TMPDIR symlinks /var → /private/var, and mise keys trust by canonical path.
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "zeta-lane-")));
  cleanup.push(parent);
  const root = join(parent, "repo");
  mkdirSync(root, { recursive: true });

  // eslint-disable-next-line sonarjs/no-os-command-from-path -- same delegation as lane-allocator.ts: this test drives the real toolchain, which is the point of it.
  const git = (...args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "test");
  // A tool OPTION, not a plain version string — the shape that actually requires a grant.
  writeFileSync(join(root, ".mise.toml"), '[tools]\nnode = { version = "22", compile = false }\n', "utf8");
  git("add", "-A");
  git("commit", "-q", "-m", "seed");

  // eslint-disable-next-line sonarjs/no-os-command-from-path -- same delegation as lane-allocator.ts: this test drives the real toolchain, which is the point of it.
  const alloc = spawnSync("bun", [ALLOCATOR, "allocate", "doc", "lane-test-branch"], {
    cwd: root,
    encoding: "utf8",
  });
  expect(alloc.status).toBe(0);

  const lane = join(parent, "repo-doc-lane");
  cleanup.push(lane);
  // The allocator's OWN line, naming the lane path. Dropping the trust call from allocate() turns
  // this red in every environment — including CI, where mise itself would print nothing.
  expect(`${alloc.stdout}${alloc.stderr}`).toContain(`mise:   trusted ${lane}`);
});
