// from-uv-project — LOCKED uv projects (`uv sync --frozen`), opt-in per project.
//
// WHY A NEW MECHANISM RATHER THAN `from-uv-venv`. That was the first thing
// checked, and `from-uv-venv` genuinely does not fit, on four independent
// grounds:
//
//   1. NO LOCKFILE. It runs `uv pip install <spec>` into the repo-root `.venv`,
//      so the transitive closure is re-resolved at install time and nothing is
//      hash-pinned. This lane's closure is 112 packages; re-resolving it per
//      machine is exactly the determinism §7 DST forbids trading away.
//   2. NO PER-PLATFORM INDEX. `uv pip install` has no `[tool.uv.sources]`
//      marker mechanism, so it cannot send linux to the PyTorch CPU index and
//      macOS to PyPI. Without that split, linux x86_64 pulls the 526.6 MB CUDA
//      wheel plus the whole `nvidia-*` closure instead of a 191.8 MB CPU build.
//   3. SHARED VENV. It installs into ONE repo-root `.venv` alongside the Q#
//      oracle deps, so a torch resolution failure would take the quantum lane
//      down with it — the coupling `src/Arc.Python`'s header says separate
//      projects exist to prevent.
//   4. HARDCODED OPT-IN AND PROBE. Its gate is `ZETA_INSTALL_QUANTUM` /
//      `ZETA_INSTALL_FULL` and its success probe imports `qdk`/`qsharp`.
//
// `from-uv-tool` is for `uv tool install` CLIs; torch/TransformerLens/nnsight
// are importable libraries, not commands. So neither existing uv class fits and
// a class beside them is the idiomatic move.
//
// WHAT THIS ADDS TO ACE. Before this, a *locked* uv project was the one Python
// shape ace could not express: `src/Core.Python` and `src/Arc.Python` are synced
// by ad-hoc `uv sync --project ...` steps inside workflows, which is precisely
// the un-dogfooded gap row 8 of the dogfooding trajectory is about. This
// mechanism is the declarative surface those two could migrate onto later; it
// deliberately does NOT claim them today, because adopting them here would add
// their sync cost to every `install.sh` run and that is a separate decision
// with a separate cost case.
//
// CLONE-AT-TAG. The manifest is plain text and the lockfile is committed with a
// sha256 per wheel, so a fresh clone at a tag resolves nothing and decides
// nothing — it downloads exactly the bytes the tag names. `ace` realizing it is
// the good path, and `uv sync --project <dir> --frozen` remains available to a
// human with no `ace` on PATH. Exit stays real.
//
// Manifest: tools/setup/manifests/from-uv-project
//   <repo-relative-project-dir>  opt-in=<ENV_VAR>  [tier=slim|standard|full]

import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseSetupManifest } from "../setup-manifest.ts";
import { resolveHostTier, tierAllows, type HostTier } from "./host-tier.ts";
import {
  commandOnPath,
  finishResult,
  readManifestFile,
  runCommand,
  type SetupRealizer,
} from "./shared.ts";

const MANIFEST = "tools/setup/manifests/from-uv-project";

/** A project with no declared opt-in would install on every host. Refuse it. */
export function optInSatisfied(
  optIn: string | undefined,
  env: NodeJS.ProcessEnv,
): { readonly ok: boolean; readonly reason: string } {
  if (optIn === undefined || optIn.length === 0) {
    return { ok: false, reason: "no opt-in= declared (a heavy lane must be opt-in)" };
  }
  if (env[optIn] === "1") return { ok: true, reason: `${optIn}=1` };
  return { ok: false, reason: `set ${optIn}=1 to install` };
}

export const realizeFromUvProject: SetupRealizer = async (ctx) => {
  const text = readManifestFile(ctx.repoRoot, MANIFEST);
  if (text === null) {
    ctx.log(`✓ no manifest at ${MANIFEST}; skipping`);
    return finishResult("from-uv-project", ctx, true);
  }

  const entries = parseSetupManifest(text);
  if (entries.length === 0) {
    ctx.log("✓ from-uv-project: manifest empty; skipping");
    return finishResult("from-uv-project", ctx, true);
  }

  const host = resolveHostTier();
  let realized = 0;

  for (const entry of entries) {
    const dir = entry.spec;
    const gate = optInSatisfied(entry.attrs["opt-in"], process.env);
    if (!gate.ok) {
      // LOUD skips, per tools/setup/common/host-tier.sh's stated discipline.
      ctx.log(`→ ${dir} skipped: ${gate.reason}`);
      continue;
    }

    const required = (entry.attrs.tier ?? "slim") as HostTier;
    if (!tierAllows(required, host)) {
      ctx.log(
        `→ ${dir} skipped: requires tier=${required}, host is ${host.tier} (${host.source})`,
      );
      continue;
    }

    const projectDir = join(ctx.repoRoot, dir);
    // A manifest row naming a project that does not exist is a wiring error,
    // not a no-op. Say so rather than passing silently.
    if (!existsSync(join(projectDir, "pyproject.toml"))) {
      ctx.warn(`${dir}: no pyproject.toml; manifest row is stale`);
      continue;
    }
    if (!existsSync(join(projectDir, "uv.lock"))) {
      ctx.warn(`${dir}: no uv.lock — this mechanism installs only from a committed lock`);
      continue;
    }
    if (!commandOnPath("uv")) {
      ctx.warn(`uv not on PATH; skipping ${dir}`);
      continue;
    }

    ctx.log(`↓ uv sync --frozen (${dir}) [${gate.reason}]`);
    // `--frozen` is the determinism contract: install what the committed lock
    // says and never re-resolve. Without it a stale lock would be silently
    // rewritten on a contributor's laptop and the pin would stop being a pin.
    const ok = await runCommand(
      ctx,
      `  uv sync --project ${dir} --frozen`,
      ["uv", "sync", "--project", projectDir, "--frozen"],
      { bestEffort: true },
    );
    if (!ok) {
      ctx.warn(`uv sync failed for ${dir}; continuing`);
      continue;
    }
    realized += 1;
  }

  if (realized === 0) {
    ctx.log("✓ from-uv-project: nothing opted in");
    return finishResult("from-uv-project", ctx, true);
  }
  ctx.log(`✓ from-uv-project: ${String(realized)} project(s) synced`);
  return finishResult("from-uv-project", ctx, false);
};
