import {
  commandOnPath,
  finishResult,
  parseSimpleManifest,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-uv-tool";

export const realizeFromUvTool: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log(`✓ no uv-tools manifest at ${MANIFEST}; skipping`);
    return finishResult("from-uv-tool", ctx, true);
  }

  const tools = parseSimpleManifest(text);
  if (tools.length === 0) {
    ctx.log("✓ uv-tools manifest empty; skipping");
    return finishResult("from-uv-tool", ctx, true);
  }

  // Dry-run is a planning surface: it must record the intended uv actions even
  // in narrow JS-only CI jobs that deliberately do not bootstrap the Python/uv
  // toolchain. Real execution still fails closed before any action if uv is not
  // available.
  if (!ctx.dryRun && !commandOnPath("uv")) {
    throw new Error("uv not on PATH. common/mise.sh must run first.");
  }

  await runCommand(ctx, "↓ uv tool upgrade --all...", ["uv", "tool", "upgrade", "--all"], { bestEffort: true });

  for (const entry of tools) {
    const name = entry.split(/[ <>=!~]/)[0] ?? entry;
    const installed = !ctx.dryRun && (() => {
      const list = Bun.spawnSync(["uv", "tool", "list"], { stdout: "pipe", stderr: "pipe" });
      return (
        list.exitCode === 0 &&
        list.stdout
          .toString()
          .split(/\r?\n/)
          .some((line) => line.split(/\s+/)[0] === name)
      );
    })();
    if (installed) continue;
    await runCommand(ctx, `↓ uv tool install ${entry}...`, ["uv", "tool", "install", entry]);
  }

  ctx.log("✓ uv-managed Python tools up to date");
  return finishResult("from-uv-tool", ctx, false);
};
