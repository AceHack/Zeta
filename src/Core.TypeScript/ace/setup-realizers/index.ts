import { realizeFromBunGlobal } from "./from-bun-global.ts";
import { realizeFromUvTool } from "./from-uv-tool.ts";
import type { SetupRealizer } from "./shared.ts";

export const SETUP_REALIZERS: Readonly<Record<string, SetupRealizer>> = {
  "from-uv-tool": realizeFromUvTool,
  "from-bun-global": realizeFromBunGlobal,
};

export function listSetupRealizerIds(): readonly string[] {
  return Object.keys(SETUP_REALIZERS).sort();
}

export function getSetupRealizer(id: string): SetupRealizer | undefined {
  return SETUP_REALIZERS[id];
}

export { createContext, defaultRepoRoot, type RealizeContext, type RealizeResult } from "./shared.ts";
export { repairCodexServiceTierConfig } from "./from-bun-global.ts";
