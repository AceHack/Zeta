import {
  commandOnPath,
  finishResult,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

export const realizeFromBunLink: SetupRealizer = async (ctx) => {
  if (!commandOnPath("mise")) {
    ctx.warn("mise not on PATH; skipping repo-bins (bun comes from mise)");
    return finishResult("from-bun-link", ctx, true);
  }

  ctx.log("↓ bun link (repo root) → exposes ace + zeta-shadow on PATH (best-effort)...");
  const linked = await runCommand(
    ctx,
    "mise exec -- bun link",
    ["mise", "exec", "--", "bun", "link"],
    { bestEffort: true, cwd: ctx.repoRoot },
  );
  if (!linked && !ctx.dryRun) {
    ctx.warn(
      "warn: 'bun link' failed; ace/zeta-shadow not globally linked (run 'bun link' in the repo root manually); continuing",
    );
    return finishResult("from-bun-link", ctx, true);
  }

  if (!ctx.dryRun) {
    const binProc = Bun.spawnSync(["mise", "exec", "--", "bun", "pm", "bin", "-g"], {
      cwd: ctx.repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    const bunGlobalBin = binProc.stdout.toString().trim();
    if (bunGlobalBin) {
      const pathParts = (process.env.PATH ?? "").split(":");
      if (!pathParts.includes(bunGlobalBin)) {
        process.env.PATH = `${bunGlobalBin}:${process.env.PATH ?? ""}`;
      }
      ctx.log(`✓ ace linked; bun global bin: ${bunGlobalBin} (shellenv adds it to PATH for new shells)`);
    } else {
      ctx.warn("warn: could not resolve bun global bin dir; 'ace' may need a new shell or manual PATH add");
    }
  }

  return finishResult("from-bun-link", ctx, false);
};
