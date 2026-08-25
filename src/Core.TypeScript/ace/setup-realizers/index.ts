import { realizeFromAgdaCubical } from "./from-agda-cubical.ts";
import { realizeFromAutotoolsTarball } from "./from-autotools-tarball.ts";
import { realizeFromBunGlobal, repairCodexServiceTierConfig } from "./from-bun-global.ts";
import { realizeFromBunLink } from "./from-bun-link.ts";
import { realizeFromBunWorkspace } from "./from-bun-workspace.ts";
import { realizeFromDeb } from "./from-deb.ts";
import { realizeFromDotnetGlobal } from "./from-dotnet-global.ts";
import { realizeFromDotnetWorkload } from "./from-dotnet-workload.ts";
import { realizeFromElan } from "./from-elan.ts";
import { realizeFromGitHooks } from "./from-git-hooks.ts";
import { realizeFromInstaller } from "./from-installer.ts";
import { realizeFromOllama } from "./from-ollama.ts";
import { realizeFromOpamGit } from "./from-opam-git.ts";
import { realizeFromShim } from "./from-shim.ts";
import { realizeFromUrl } from "./from-url.ts";
import { realizeFromUvProject } from "./from-uv-project.ts";
import { realizeFromUvTool } from "./from-uv-tool.ts";
import { realizeFromUvVenv } from "./from-uv-venv.ts";
import type { SetupRealizer } from "./shared.ts";

export const SETUP_REALIZERS: Readonly<Record<string, SetupRealizer>> = {
  "from-agda-cubical": realizeFromAgdaCubical,
  "from-autotools-tarball": realizeFromAutotoolsTarball,
  "from-bun-global": realizeFromBunGlobal,
  "from-bun-link": realizeFromBunLink,
  "from-bun-workspace": realizeFromBunWorkspace,
  "from-deb": realizeFromDeb,
  "from-dotnet-global": realizeFromDotnetGlobal,
  "from-dotnet-workload": realizeFromDotnetWorkload,
  "from-elan": realizeFromElan,
  "from-git-hooks": realizeFromGitHooks,
  "from-installer": realizeFromInstaller,
  "from-ollama": realizeFromOllama,
  "from-opam-git": realizeFromOpamGit,
  "from-shim": realizeFromShim,
  "from-url": realizeFromUrl,
  "from-uv-project": realizeFromUvProject,
  "from-uv-tool": realizeFromUvTool,
  "from-uv-venv": realizeFromUvVenv,
};

/** Matches tools/setup/linux.sh install-graph order (pre-mise, after apt). */
export const PRE_MISE_REALIZER_IDS = [
  "from-deb",
  "from-shim",
  "from-autotools-tarball",
] as const;

/** Matches tools/setup/linux.sh install-graph order (post-mise.sh, after PATH shims). */
export const POST_MISE_REALIZER_IDS = [
  // 081KZKWB1FZ: FIRST in the post-mise order — mise has just provided bun, and
  // everything downstream may rely on the repo's own node_modules being present.
  // Without this, install.sh completed with no devDependencies at all and local
  // `lint (TS)` disagreed with CI (phantom TS2307s that read like real findings).
  "from-bun-workspace",
  "from-uv-tool",
  "from-uv-venv",
  // After the other uv mechanisms so `uv` is certainly present. Every project
  // here is opt-in, so on a default run this costs one manifest read.
  "from-uv-project",
  "from-elan",
  "from-dotnet-global",
  "from-dotnet-workload",
  "from-url",
  "from-opam-git",
  "from-agda-cubical",
  "from-bun-global",
  "from-bun-link",
  "from-installer",
  "from-ollama",
  "from-git-hooks",
] as const;

export const SETUP_REALIZER_INSTALL_ORDER = [
  ...PRE_MISE_REALIZER_IDS,
  ...POST_MISE_REALIZER_IDS,
] as const;

/** Mechanisms that warn and continue on failure (mirrors linux.sh opam-git || echo). */
export const BEST_EFFORT_REALIZER_IDS = new Set<string>([
  // Provisioning must not hard-fail over devDeps; the lint gate stays the place
  // that enforces lockfile freshness (this realizer deliberately omits
  // --frozen-lockfile — see from-bun-workspace.ts).
  "from-bun-workspace",
  "from-opam-git",
  "from-agda-cubical",
  "from-git-hooks",
]);

export function listSetupRealizerIds(): readonly string[] {
  return Object.keys(SETUP_REALIZERS).sort();
}

export function listSetupRealizerInstallOrder(): readonly string[] {
  return SETUP_REALIZER_INSTALL_ORDER.filter((id) => id in SETUP_REALIZERS);
}

export function listPreMiseRealizerIds(): readonly string[] {
  return PRE_MISE_REALIZER_IDS.filter((id) => id in SETUP_REALIZERS);
}

export function listPostMiseRealizerIds(): readonly string[] {
  return POST_MISE_REALIZER_IDS.filter((id) => id in SETUP_REALIZERS);
}

export function getSetupRealizer(id: string): SetupRealizer | undefined {
  return SETUP_REALIZERS[id];
}

export function hasSetupRealizer(id: string): boolean {
  return id in SETUP_REALIZERS;
}

export { createContext, defaultRepoRoot, type RealizeContext, type RealizeResult } from "./shared.ts";
export { repairCodexServiceTierConfig };
