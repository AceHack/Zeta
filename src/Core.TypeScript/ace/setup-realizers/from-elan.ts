import { mkdtempSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMechanismManifest } from "../setup-manifest.ts";
import { curlFetchToFile, verifySha256File } from "./curl-fetch.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-elan";

async function runElanInitWithRetry(
  ctx: Parameters<SetupRealizer>[0],
  installerPath: string,
): Promise<void> {
  const maxAttempts = 4;
  let sleepS = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ok = await runCommand(
      ctx,
      attempt === 1 ? "↓ from-elan: running elan-init.sh..." : `  from-elan: installer retry ${String(attempt)}/${String(maxAttempts)}`,
      ["sh", installerPath, "-y", "--default-toolchain", "none"],
      { bestEffort: attempt < maxAttempts },
    );
    if (ok) return;
    if (attempt >= maxAttempts) {
      throw new Error(`from-elan: elan installer failed after ${String(maxAttempts)} attempts`);
    }
    ctx.warn(`  from-elan: installer attempt ${String(attempt)}/${String(maxAttempts)} failed; retrying in ${String(sleepS)}s`);
    if (!ctx.dryRun) await Bun.sleep(sleepS * 1000);
    sleepS *= 2;
  }
}

function sourceElanEnvIfPresent(ctx: Parameters<SetupRealizer>[0]): void {
  const envPath = join(process.env.HOME ?? "", ".elan", "env");
  try {
    const script = readFileSync(envPath, "utf8");
    for (const line of script.split(/\r?\n/)) {
      const match = /^export PATH="([^"]*)"/.exec(line.trim());
      if (match?.[1]) {
        process.env.PATH = `${match[1]}:${process.env.PATH ?? ""}`;
      }
    }
    ctx.actions.push(`sourced ${envPath}`);
  } catch {
    /* no elan env yet */
  }
}

export const realizeFromElan: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log("✓ from-elan: no manifest; skipping");
    return finishResult("from-elan", ctx, true);
  }

  const entries = parseMechanismManifest(text);
  const row = entries[0];
  if (row === undefined) {
    ctx.log("✓ from-elan: manifest empty; skipping");
    return finishResult("from-elan", ctx, true);
  }

  const name = row.tokens[0] ?? "elan";
  const elanInitUrl = row.tokens[1];
  const sha256 = row.attrs.sha256;
  if (elanInitUrl === undefined || sha256 === undefined) {
    throw new Error("from-elan: manifest row must include URL and sha256=");
  }

  if (!commandOnPath("elan")) {
    ctx.log(`↓ from-elan: installing ${name} (Lean 4 toolchain manager)...`);
    if (ctx.dryRun) {
      ctx.actions.push(`dry-run: curl ${elanInitUrl} → verify sha256 → sh elan-init.sh`);
    } else {
      const tmpDir = mkdtempSync(join(tmpdir(), "elan-init-"));
      const installer = join(tmpDir, "elan-init.sh");
      try {
        await curlFetchToFile(installer, elanInitUrl);
        verifySha256File(installer, sha256);
        await runElanInitWithRetry(ctx, installer);
      } finally {
        try {
          unlinkSync(installer);
        } catch {
          /* gone */
        }
      }
    }
  }

  if (!ctx.dryRun) sourceElanEnvIfPresent(ctx);

  if (commandOnPath("elan")) {
    await runCommand(ctx, "✓ from-elan: elan on PATH", ["elan", "--version"], { bestEffort: true });
    await runCommand(ctx, "  from-elan: elan self update", ["elan", "self", "update"], { bestEffort: true });
  } else if (!ctx.dryRun) {
    ctx.warn("warning: from-elan: install attempted but 'elan' is still not on PATH.");
    ctx.warn("  Add $HOME/.elan/bin to PATH and re-run.");
  }

  return finishResult("from-elan", ctx, false);
};
