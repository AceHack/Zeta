/**
 * src/Core.TypeScript/observe/world-infra.ts — infrastructure state readers for the observe loop.
 *
 * Extension to load-world.ts that adds cluster cell awareness and PR state.
 * These are the readers from the deleted move-next.ts, re-homed here as
 * optional infrastructure signals that the observe loop can consult.
 *
 * Not wired into the core World type yet (per Rodney's razor: new moves
 * like provision-cell and merge-pr enter through edit_grammar in a follow-up).
 * This file is the staging area for those readers until they're promoted.
 *
 * Usage:
 *   import { readCellState, readPRState } from "./world-infra";
 *   const cells = readCellState(repoRoot);
 *   const prs = readPRState();
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createLaunchctlControl } from "../service/service-control-port";

// --- Cell state ---

export interface CellDeclaration {
  readonly cellId: string;
  readonly harness: string;
  readonly agent: string;
  readonly interval: number;
  readonly forward: boolean;
}

export interface CellState {
  readonly declared: readonly CellDeclaration[];
  readonly running: readonly string[];
  readonly missing: readonly CellDeclaration[];
}

export function readCellState(repoRoot: string): CellState {
  const hostname = spawnSync("hostname", ["-s"], { encoding: "utf8", timeout: 2000 }).stdout?.trim() || "unknown";
  const manifestDir = join(repoRoot, "tools/setup/manifests");
  const hostSpecific = join(manifestDir, `cluster-cells.${hostname}`);
  const defaultManifest = join(manifestDir, "cluster-cells");
  const path = existsSync(hostSpecific) ? hostSpecific : defaultManifest;

  const declared: CellDeclaration[] = [];
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.trim().startsWith("#") || line.trim().length === 0) continue;
      const cellId = line.split(/\s+/)[0] || "";
      const harness = line.match(/harness=(\S+)/)?.[1] || "auto";
      const agent = line.match(/agent=(\S+)/)?.[1] || "";
      const interval = Number(line.match(/interval=(\S+)/)?.[1] || "60");
      const forward = line.match(/forward=(\S+)/)?.[1] !== "0";
      if (cellId && agent) declared.push({ cellId, harness, agent, interval, forward });
    }
  }

  const resolved = createLaunchctlControl();
  const labels = resolved.ok ? resolved.port.listLabels() : null;
  const running = (labels ?? [])
    .filter((l) => l.includes("com.lucent.zeta."))
    .map((l) => l.replace("com.lucent.zeta.", ""))
    .filter(Boolean);

  const missing = declared.filter((c) => !running.includes(c.agent));

  return { declared, running, missing };
}

// --- PR state ---

export interface PRInfo {
  readonly number: number;
  readonly title: string;
  readonly mergeState: string;
}

/**
 * Read open PR state. Delegates to ForgeHost when provided (host-agnostic path);
 * falls back to direct `gh` CLI invocation for backward compatibility.
 */
export function readPRState(): { open: readonly PRInfo[]; clean: readonly PRInfo[] } {
  // Synchronous path (legacy): direct gh CLI call
  // The ForgeHost interface is async, but readPRState is consumed synchronously
  // by the observe loop today. When the loop goes async, the forge path will
  // be the primary path. For now, always use the synchronous gh fallback.
  const result = spawnSync(
    "gh",
    ["pr", "list", "--state", "open", "--limit", "20", "--json", "number,title,mergeStateStatus"],
    { encoding: "utf8", timeout: 30000 },
  );

  if (result.status !== 0) {
    // gh failure (auth, rate-limit, not installed) — make it LOUD, never a silent
    // empty that reads as "no PRs". (Caller can't yet distinguish; at minimum the
    // quiet is now explainable in the log.)
    console.error(`[forge] gh pr list failed (status ${result.status ?? "signal"}): ${(result.stderr ?? "").trim()}`);
    return { open: [], clean: [] };
  }

  let prs: PRInfo[] = [];
  try {
    prs = (JSON.parse(result.stdout) as { number: number; title: string; mergeStateStatus: string }[]).map((p) => ({
      number: p.number,
      title: p.title,
      mergeState: (p.mergeStateStatus ?? "").toLowerCase(),
    }));
  } catch (err) {
    console.error(`[forge] gh pr list JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    open: prs,
    clean: prs.filter((p) => p.mergeState === "clean"),
  };
}

/**
 * Async variant of readPRState that delegates to a ForgeHost adapter.
 * Use this when the observe loop goes fully async (follow-up to the
 * synchronous legacy path above).
 *
 * Returns a DISCRIMINATED result: an API failure (auth, rate-limit, network)
 * must be distinguishable from a healthy-empty repo. Collapsing the two into
 * `{ open:[], clean:[] }` makes the loop read a forge outage as "no PR work" and
 * go quiet while PRs rot — "I failed to look" must never equal "there is no work".
 */
export async function readPRStateAsync(
  forge: import("../forge-host/forge-host").ForgeHost,
): Promise<{ ok: true; open: readonly PRInfo[]; clean: readonly PRInfo[] } | { ok: false; error: unknown }> {
  const result = await forge.listOpenPullRequests({ limit: 20 });
  if (!result.ok) return { ok: false, error: result.error };

  const prs: PRInfo[] = result.value.map((pr) => ({
    number: pr.number,
    title: pr.title,
    mergeState: (pr.mergeStateStatus ?? "").toLowerCase(),
  }));

  return {
    ok: true,
    open: prs,
    clean: prs.filter((p) => p.mergeState === "clean"),
  };
}

// --- Broadcast bus state ---

export interface BroadcastState {
  readonly [agent: string]: string; // first line of each agent's broadcast
}

export function readBroadcasts(): BroadcastState {
  const dir = join(process.env.HOME || "/Users/acehack", ".local/share/zeta-broadcasts");
  const state: Record<string, string> = {};
  if (!existsSync(dir)) return state;

  for (const peer of ["otto", "vera", "lior", "riven", "kiro", "alexa"]) {
    const path = join(dir, `${peer}.md`);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf8").trim();
      state[peer] = content.split("\n")[0] || "(empty)";
    }
  }
  return state;
}
