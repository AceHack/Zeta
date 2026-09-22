// src/Core.TypeScript/cluster/node-tunables.ts
//
// The TypeScript twin of full-ai-cluster/nixos/modules/k8s-node-tunables.nix.
// Nix cannot import TypeScript and TypeScript cannot import Nix, so
// full-ai-cluster/k8s/node-tunables.json IS the coupling — this file only
// reads it and turns it into `sysctl -w` invocations.
//
// WHY THIS EXISTS
// ---------------
// The NixOS host applies these sysctls via `boot.kernel.sysctl`, which the
// Docker CI lanes in .github/workflows/k8s-argocd-health-test.yml (kind,
// k3d) never see: those lanes run a kind/k3d cluster INSIDE Docker on a
// GitHub-hosted `ubuntu-24.04` runner, and containers share the HOST
// kernel's sysctls — a stock Ubuntu image, not NixOS. Without this reader,
// CI can never reproduce the crash-loop class node-tunables.json exists for
// (vm.max_map_count too low for OpenSearch, fs.inotify.max_user_instances
// too low for ~150 pods' worth of config-reloaders and log tailers), and a
// production-only failure would first be discovered on real hardware.
//
// `--print` emits one `sudo sysctl -w key=value` line per declared entry
// (and nothing else, so it composes with `| bash` or a workflow `run:`
// block); `--apply` runs them directly via spawnSync, printing the applied
// value back so a workflow log shows what actually took.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveElevatorPathOrThrow } from "../privilege/elevator.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
export const NODE_TUNABLES_PATH = "full-ai-cluster/k8s/node-tunables.json";

/** One declared sysctl: the key, its required value, and why. */
export interface SysctlEntry {
  readonly key: string;
  readonly value: string | number;
  readonly hostDefault?: string | number;
  readonly requiredBy?: string;
  readonly citation?: string;
}

interface NodeTunablesFile {
  readonly sysctls?: readonly SysctlEntry[];
}

/** Read + validate the declared sysctls. Throws rather than defaulting to empty. */
export function readNodeTunables(repoRoot: string = REPO_ROOT): readonly SysctlEntry[] {
  const path = resolve(repoRoot, NODE_TUNABLES_PATH);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as NodeTunablesFile;
  const entries = parsed.sysctls;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`${NODE_TUNABLES_PATH}: no non-empty "sysctls" array`);
  }
  for (const entry of entries) {
    if (typeof entry.key !== "string" || entry.key.length === 0) {
      throw new Error(`${NODE_TUNABLES_PATH}: entry with no string "key": ${JSON.stringify(entry)}`);
    }
    if (typeof entry.value !== "string" && typeof entry.value !== "number") {
      throw new Error(`${NODE_TUNABLES_PATH}: "${entry.key}" has no string/number "value"`);
    }
  }
  return entries;
}

/** Render one entry as the exact `sudo sysctl -w key=value` line CI runs. */
export function sysctlCommand(entry: SysctlEntry): string {
  return `sudo sysctl -w ${entry.key}=${entry.value}`;
}

/** Every declared entry, rendered as `sysctl -w` command lines, in file order. */
export function sysctlCommands(entries: readonly SysctlEntry[]): readonly string[] {
  return entries.map(sysctlCommand);
}

/** Apply every declared sysctl on THIS machine via `sudo sysctl -w`, printing what took. */
function applyAll(entries: readonly SysctlEntry[]): number {
  // Resolved to an absolute, ownership-checked path, never spawned by bare name — a
  // `sudo` earlier on PATH would run silently and leave no git diff to review
  // (src/Core.TypeScript/privilege/elevator.ts; docs/BUGS.md P1 2026-08-24).
  const sudoPath = resolveElevatorPathOrThrow("sudo");
  let failures = 0;
  for (const entry of entries) {
    const result = spawnSync(sudoPath, ["sysctl", "-w", `${entry.key}=${entry.value}`], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      failures += 1;
      console.error(`FAILED: ${entry.key}=${entry.value}`);
      if (result.stderr) console.error(result.stderr.trim());
      continue;
    }
    process.stdout.write(result.stdout);
  }
  return failures;
}

export function main(argv: readonly string[]): number {
  const entries = readNodeTunables();
  if (argv.includes("--apply")) {
    console.log(`Applying ${entries.length} sysctl(s) from ${NODE_TUNABLES_PATH}:`);
    const failures = applyAll(entries);
    if (failures > 0) {
      console.error(`${failures} of ${entries.length} sysctl(s) failed to apply.`);
      return 1;
    }
    console.log(`All ${entries.length} sysctl(s) applied.`);
    return 0;
  }
  // Default: print the commands, one per line, nothing else — the form a
  // workflow `run:` step or a human can pipe straight into a shell.
  for (const line of sysctlCommands(entries)) {
    console.log(line);
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
