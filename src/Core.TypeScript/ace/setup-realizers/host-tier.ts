import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { totalmem } from "node:os";

export type HostTier = "slim" | "standard" | "full";

const TIER_RANK: Readonly<Record<HostTier, number>> = {
  slim: 0,
  standard: 1,
  full: 2,
};

export interface HostTierContext {
  readonly tier: HostTier;
  readonly rank: number;
  readonly source: "declared" | "detected";
}

function parseDeclaredTier(raw: string | undefined): HostTier | null {
  if (!raw) return null;
  if (raw === "slim" || raw === "standard" || raw === "full") return raw;
  throw new Error(`unknown tier ${JSON.stringify(raw)} (slim|standard|full)`);
}

function detectHostTier(): HostTier {
  let memBytes = 0;
  if (process.platform === "darwin") {
    const out = spawnSync("sysctl", ["-n", "hw.memsize"], { encoding: "utf8" });
    memBytes = Number(out.stdout?.trim() ?? 0);
  } else if (process.platform === "linux") {
    try {
      const meminfo = readFileSync("/proc/meminfo", "utf8");
      const match = meminfo.match(/^MemTotal:\s+(\d+)/m);
      memBytes = match ? Number(match[1]) * 1024 : 0;
    } catch {
      memBytes = 0;
    }
  } else {
    memBytes = totalmem();
  }

  if (!memBytes) return "full";
  if (memBytes >= 16 * 1024 ** 3) return "full";
  if (memBytes >= 8 * 1024 ** 3) return "standard";
  return "slim";
}

export function resolveHostTier(env: NodeJS.ProcessEnv = process.env): HostTierContext {
  const declared = parseDeclaredTier(env.ZETA_HOST_TIER);
  if (declared) {
    return { tier: declared, rank: TIER_RANK[declared], source: "declared" };
  }
  const tier = detectHostTier();
  return { tier, rank: TIER_RANK[tier], source: "detected" };
}

export function tierAllows(required: HostTier, host: HostTierContext): boolean {
  return TIER_RANK[required] <= host.rank;
}

export function tierFromAttrs(attrs: Readonly<Record<string, string>>): HostTier {
  const raw = attrs.tier;
  if (!raw) return "slim";
  return parseDeclaredTier(raw) ?? "slim";
}
