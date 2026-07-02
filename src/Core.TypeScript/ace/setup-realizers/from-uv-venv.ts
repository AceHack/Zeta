import { join } from "node:path";
import { parseSetupManifest } from "../setup-manifest.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-uv-venv";

function quantumOptIn(): boolean {
  return process.env.ZETA_INSTALL_QUANTUM === "1" || process.env.ZETA_INSTALL_FULL === "1";
}

export const realizeFromUvVenv: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log(`✓ no quantum manifest at ${MANIFEST}; skipping`);
    return finishResult("from-uv-venv", ctx, true);
  }

  if (!quantumOptIn()) {
    ctx.log("✓ from-uv-venv: skipping (set ZETA_INSTALL_QUANTUM=1 or ZETA_INSTALL_FULL=1)");
    return finishResult("from-uv-venv", ctx, true);
  }

  if (!commandOnPath("uv")) {
    ctx.warn("uv not on PATH; skipping quantum oracle deps");
    return finishResult("from-uv-venv", ctx, true);
  }

  const specs = parseSetupManifest(text)
    .filter((entry) => entry.attrs.ecosystem !== "npm")
    .map((entry) => entry.spec);

  if (specs.length === 0) {
    ctx.log("✓ quantum manifest empty; skipping");
    return finishResult("from-uv-venv", ctx, true);
  }

  const venv = join(ctx.repoRoot, ".venv");
  const pyBin = join(venv, "bin/python");

  ctx.log("↓ ensuring project Python env at .venv for quantum oracle deps...");
  const venvOk = await runCommand(ctx, "↓ uv venv .venv", ["uv", "venv", venv], { bestEffort: true });
  if (!venvOk) {
    ctx.warn("uv venv failed; skipping quantum oracle deps");
    return finishResult("from-uv-venv", ctx, true);
  }

  ctx.log(`↓ installing quantum oracle deps from ${MANIFEST.split("/").pop() ?? MANIFEST}...`);
  for (const spec of specs) {
    ctx.log(`  uv pip install ${spec}`);
    const ok = await runCommand(
      ctx,
      `  uv pip install ${spec}`,
      ["uv", "pip", "install", "--python", pyBin, spec],
      { bestEffort: true },
    );
    if (!ok) {
      ctx.warn(`failed to install quantum oracle dep '${spec}'; continuing`);
      return finishResult("from-uv-venv", ctx, true);
    }
  }

  if (!ctx.dryRun) {
    const probe = Bun.spawnSync([pyBin, "-c", "import importlib; importlib.import_module('qdk'); import qsharp"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    if (probe.exitCode !== 0) {
      const probe2 = Bun.spawnSync(
        [pyBin, "-c", "import importlib; importlib.import_module('qdk'); importlib.import_module('qsharp')"],
        { stdout: "ignore", stderr: "ignore" },
      );
      if (probe2.exitCode !== 0) {
        ctx.warn("quantum deps installed but QDK/Q# import probe failed; continuing");
        return finishResult("from-uv-venv", ctx, false);
      }
    }
  }

  ctx.log("✓ quantum oracle deps ready");
  return finishResult("from-uv-venv", ctx, false);
};
