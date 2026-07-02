import { realizeFromBunGlobal } from "./from-bun-global.ts";
import { realizeFromBunLink } from "./from-bun-link.ts";
import { realizeFromDotnetGlobal } from "./from-dotnet-global.ts";
import { realizeFromDotnetWorkload } from "./from-dotnet-workload.ts";
import { realizeFromElan } from "./from-elan.ts";
import { realizeFromUrl } from "./from-url.ts";
import { realizeFromUvTool } from "./from-uv-tool.ts";
import type { SetupRealizer } from "./shared.ts";

export const SETUP_REALIZERS: Readonly<Record<string, SetupRealizer>> = {
  "from-bun-global": realizeFromBunGlobal,
  "from-bun-link": realizeFromBunLink,
  "from-dotnet-global": realizeFromDotnetGlobal,
  "from-dotnet-workload": realizeFromDotnetWorkload,
  "from-elan": realizeFromElan,
  "from-url": realizeFromUrl,
  "from-uv-tool": realizeFromUvTool,
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
export { repairCodexServiceTierConfig } from "./from-bun-global.ts";
