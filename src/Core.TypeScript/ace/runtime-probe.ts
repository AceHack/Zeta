// runtime-probe.ts — measure WHICH toolchains this host has. Three states, never two.
//
// Separated from `runtime-cost.ts` deliberately: (a) which runtimes EXIST here is an
// observation, (b) which of them we should USE is a judgment over declared costs. Fusing
// them is how a chooser ends up with a preference list baked into a probe.
//
// The third state is the point. `indeterminate` means THE CHECK DID NOT RUN — the spawn
// itself failed, or the platform gave us no way to look. Collapsing that into `absent`
// would report "this host has no .NET" when the truth is "I could not tell", and those
// license different actions: the first is reportable, the second is a broken probe.
//
// Vocabulary is borrowed, not coined: `federated-identity/ports.ts` already ships
// `RootEvidenceState = "present" | "absent" | "unreadable" | "unavailable" | "indeterminate"`.
//
// EFFECTS ARE INJECTED (discipline #7, noninterference). Nothing here touches a process
// directly, which is what lets the tests drive the real logic — including the failure
// paths — instead of asserting against a mock nothing was wired to.

import type { HostProfile, ProbeState } from "./runtime-cost.ts";

/** One probe: run `bin` with `args` and decide. */
export interface ToolchainProbe {
  readonly id: string;
  readonly bin: string;
  readonly args: readonly string[];
}

export const DEFAULT_PROBES: readonly ToolchainProbe[] = [
  { id: "bun", bin: "bun", args: ["--version"] },
  { id: "node", bin: "node", args: ["--version"] },
  { id: "dotnet", bin: "dotnet", args: ["--version"] },
  { id: "rust", bin: "rustc", args: ["--version"] },
  { id: "go", bin: "go", args: ["version"] },
  { id: "python", bin: "python3", args: ["--version"] },
  // No universal CLI implies a wasm runtime, so this probes the common standalone ones.
  { id: "wasm-runtime", bin: "wasmtime", args: ["--version"] },
];

/**
 * The single injected door. Implementations return `null` for "I could not run this at
 * all" — distinct from a non-zero exit, which is a real answer meaning "not installed".
 */
export interface ProbeEffects {
  readonly run: (bin: string, args: readonly string[]) => { code: number; stdout: string } | null;
}

export function probeOne(p: ToolchainProbe, fx: ProbeEffects): ProbeState {
  let r: { code: number; stdout: string } | null;
  try {
    r = fx.run(p.bin, p.args);
  } catch {
    // An exception is not evidence of absence. Say so.
    return "indeterminate";
  }
  if (r === null) return "indeterminate";
  return r.code === 0 ? "present" : "absent";
}

export function probeHost(
  probes: readonly ToolchainProbe[] = DEFAULT_PROBES,
  fx: ProbeEffects = spawnEffects(),
): HostProfile {
  const out: Record<string, ProbeState> = {};
  for (const p of probes) out[p.id] = probeOne(p, fx);
  return out;
}

/** Real effects. Kept at the bottom and tiny, so the testable surface stays pure. */
export function spawnEffects(): ProbeEffects {
  return {
    run: (bin, args) => {
      // Imported lazily so this module stays importable in environments with no child_process.
      const cp = require("node:child_process") as typeof import("node:child_process");
      try {
        const r = cp.spawnSync(bin, [...args], { encoding: "utf8" });
        // ENOENT => the binary is not there => a real `absent`, not a probe failure.
        if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") return { code: 127, stdout: "" };
        if (r.error) return null;
        if (r.status === null) return null;
        return { code: r.status, stdout: r.stdout ?? "" };
      } catch {
        return null;
      }
    },
  };
}
