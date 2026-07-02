import { realizeFromAutotoolsTarball } from "./from-autotools-tarball.ts";
import { realizeFromBunGlobal, repairCodexServiceTierConfig } from "./from-bun-global.ts";
import { realizeFromBunLink } from "./from-bun-link.ts";
import { realizeFromDeb } from "./from-deb.ts";
import { realizeFromDotnetGlobal } from "./from-dotnet-global.ts";
import { realizeFromDotnetWorkload } from "./from-dotnet-workload.ts";
import { realizeFromElan } from "./from-elan.ts";
import { realizeFromInstaller } from "./from-installer.ts";
import { realizeFromOllama } from "./from-ollama.ts";
import { realizeFromOpamGit } from "./from-opam-git.ts";
import { realizeFromShim } from "./from-shim.ts";
import { realizeFromUrl } from "./from-url.ts";
import { realizeFromUvTool } from "./from-uv-tool.ts";
import { realizeFromUvVenv } from "./from-uv-venv.ts";
import type { SetupRealizer } from "./shared.ts";

export const SETUP_REALIZERS: Readonly<Record<string, SetupRealizer>> = {
  "from-autotools-tarball": realizeFromAutotoolsTarball,
  "from-bun-global": realizeFromBunGlobal,
  "from-bun-link": realizeFromBunLink,
  "from-deb": realizeFromDeb,
  "from-dotnet-global": realizeFromDotnetGlobal,
  "from-dotnet-workload": realizeFromDotnetWorkload,
  "from-elan": realizeFromElan,
  "from-installer": realizeFromInstaller,
  "from-ollama": realizeFromOllama,
  "from-opam-git": realizeFromOpamGit,
  "from-shim": realizeFromShim,
  "from-url": realizeFromUrl,
  "from-uv-tool": realizeFromUvTool,
  "from-uv-venv": realizeFromUvVenv,
};

export function listSetupRealizerIds(): readonly string[] {
  return Object.keys(SETUP_REALIZERS).sort();
}

export function getSetupRealizer(id: string): SetupRealizer | undefined {
  return SETUP_REALIZERS[id];
}

export function hasSetupRealizer(id: string): boolean {
  return id in SETUP_REALIZERS;
}

export { createContext, defaultRepoRoot, type RealizeContext, type RealizeResult } from "./shared.ts";
export { repairCodexServiceTierConfig };
