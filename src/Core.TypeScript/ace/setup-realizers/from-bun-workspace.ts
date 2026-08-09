// from-bun-workspace — ACE realizer: install the REPO'S OWN package.json dependencies.
//
// WHY (081KZKWB1FZ, 2026-08-09). ACE managed 19 dependency classes but not the most
// obvious one: the repo's own npm devDependencies. `install.sh` never ran a root
// `bun install`, so a freshly-provisioned machine had every mise toolchain, every
// global CLI, and every dotnet/uv/opam tool — and no `node_modules`. CI's `lint (TS)`
// job installed them itself as a separate step, so CI and a dev laptop disagreed.
//
// The cost was misdiagnosis, not inconvenience: `tsc` reported `TS2307: Cannot find
// module '<devDep>'` locally while CI was green on the same commit, and TWO
// independent reviewers concluded "lint is red on main" from that phantom. A phantom
// error looks exactly like a finding, which is what makes this class expensive.
//
// Fixed HERE rather than as a shell line in install.sh because ACE is the package
// manager of package managers — dependency classes belong in ACE, dogfooded, not
// bolted onto a bootstrap script. This is the same shape as every other realizer:
// declared mechanism, idempotent apply, honest skip.
//
// IDEMPOTENT by construction: `bun install` is an upsert against the lockfile —
// re-running on a provisioned tree is a no-op refresh (discipline #6).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { commandOnPath, finishResult, runCommand, type SetupRealizer } from "./shared.ts";

/**
 * Deliberately NOT `--frozen-lockfile`.
 *
 * CI pins with `--frozen-lockfile` because a stale lockfile there is a genuine
 * failure. Here the same flag would turn any lockfile drift into a hard
 * `install.sh` failure for every consumer (dev laptops, CI runners, devcontainer
 * images — GOVERNANCE §24), which is a much larger blast radius than the problem
 * being solved. Provisioning stays best-effort; the LINT gate remains the place
 * that enforces lockfile freshness.
 */
export const realizeFromBunWorkspace: SetupRealizer = async (ctx) => {
  const manifestPath = join(ctx.repoRoot, "package.json");
  if (!existsSync(manifestPath)) {
    ctx.log("✓ from-bun-workspace: no package.json at repo root — skip");
    return finishResult("from-bun-workspace", ctx, true);
  }

  if (!commandOnPath("bun")) {
    // bun arrives via mise earlier in the same run; if it is absent the toolchain
    // step already failed and said so. Warn rather than fail — this realizer is
    // provisioning, not a gate.
    ctx.warn("from-bun-workspace: bun not on PATH — skip (mise toolchain step should provide it)");
    return finishResult("from-bun-workspace", ctx, true);
  }

  // bestEffort: provisioning must not hard-fail the entire install over devDeps.
  // runCommand owns the dry-run path, the log line and the action record.
  const ok = await runCommand(
    ctx,
    "↓ from-bun-workspace: installing repo devDependencies (bun install)...",
    ["bun", "install"],
    { bestEffort: true, cwd: ctx.repoRoot },
  );
  if (!ok) {
    ctx.warn(
      "from-bun-workspace: `bun install` failed — devDependencies may be absent, so a " +
        "local `lint (TS)` run will report phantom TS2307 'Cannot find module' errors " +
        "that do NOT exist in CI. Re-run `bun install` manually (081KZKWB1FZ).",
    );
    return finishResult("from-bun-workspace", ctx, true);
  }

  ctx.log("✓ from-bun-workspace: repo devDependencies installed");
  return finishResult("from-bun-workspace", ctx, false);
};
