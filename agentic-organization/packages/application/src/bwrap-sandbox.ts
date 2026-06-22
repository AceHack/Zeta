/**
 * bwrap (bubblewrap) sandbox — port of the production sandbox engine
 * (Merge1 §08). Process-level defence-in-depth inside the k3s/Cilium/SPIRE/OPA
 * stack. The sandbox creates a restricted process namespace:
 *   - read-only root filesystem (except the workspace mount)
 *   - no network access (except allowed egress via Cilium)
 *   - no access to host devices, IPC, or kernel modules
 *   - hard kill when the hat token expires or is revoked
 *
 * The engine is a seam (MP-2): real shells to `bwrap`; mock runs in-process for
 * DST (MP-1). Spawn failures are Result-shaped (MP-7), never thrown.
 */

import { spawn } from "node:child_process";

import type { EgressPolicy } from "./egress-policy.ts";

const DECODER = new TextDecoder();

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export type BwrapSpawnOptions = {
  readonly workspaceMount: string;
  readonly egress: EgressPolicy;
  readonly env: Record<string, string>;
  readonly revokeOnExpiry: boolean;
};

export type SandboxProcess = {
  readonly pid: number;
  readonly wait: () => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  readonly kill: () => Promise<void>;
};

export type SandboxError =
  | { readonly kind: "bwrap_not_found" }
  | { readonly kind: "mount_failed"; readonly path: string }
  | { readonly kind: "spawn_failed"; readonly reason: string };

export type SandboxSpawnResult =
  | { readonly outcome: "ok"; readonly value: SandboxProcess }
  | { readonly outcome: "feedback"; readonly error: SandboxError };

export interface BwrapSandbox {
  spawn(command: readonly string[], opts: BwrapSpawnOptions): Promise<SandboxSpawnResult>;
}

/**
 * Build the bwrap argument vector that wraps a command in a restricted
 * namespace. Exposed (pure) so the lock-down flags can be asserted in tests
 * without spawning a process.
 */
export function buildBwrapArgs(command: readonly string[], opts: BwrapSpawnOptions): readonly string[] {
  const args: string[] = [
    "--ro-bind",
    "/",
    "/",
    "--bind",
    opts.workspaceMount,
    opts.workspaceMount,
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--chdir",
    opts.workspaceMount,
  ];
  // Network is unshared unless egress is explicitly permitted.
  if (opts.egress.hosts.length > 0) {
    args.push("--share-net");
  }
  for (const [key, value] of Object.entries(opts.env)) {
    args.push("--setenv", key, value);
  }
  args.push("--", ...command);
  return args;
}

/** Real bwrap sandbox — spawns a restricted process via the `bwrap` binary. */
export function createBwrapSandbox(): BwrapSandbox {
  return {
    spawn(command: readonly string[], opts: BwrapSpawnOptions): Promise<SandboxSpawnResult> {
      return new Promise<SandboxSpawnResult>((resolve) => {
        const args = buildBwrapArgs(command, opts);
        const child = spawn("bwrap", args, { stdio: ["ignore", "pipe", "pipe"] });

        let settled = false;
        const stdoutChunks: Uint8Array[] = [];
        const stderrChunks: Uint8Array[] = [];
        child.stdout?.on("data", (c) => stdoutChunks.push(c));
        child.stderr?.on("data", (c) => stderrChunks.push(c));

        child.on("error", (err) => {
          if (settled) return;
          settled = true;
          const error: SandboxError =
            err.code === "ENOENT" ? { kind: "bwrap_not_found" } : { kind: "spawn_failed", reason: err.message };
          resolve({ outcome: "feedback", error });
        });

        child.on("spawn", () => {
          if (settled) return;
          settled = true;
          resolve({
            outcome: "ok",
            value: {
              pid: child.pid ?? -1,
              wait: () =>
                new Promise((res) => {
                  child.on("close", (code) => {
                    res({
                      exitCode: code ?? -1,
                      stdout: DECODER.decode(concatBytes(stdoutChunks)),
                      stderr: DECODER.decode(concatBytes(stderrChunks)),
                    });
                  });
                }),
              kill: () =>
                new Promise<void>((res) => {
                  child.kill("SIGKILL");
                  res();
                }),
            },
          });
        });
      });
    },
  };
}

export interface MockSandboxOptions {
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;
}

/** Mock sandbox — deterministic in-process execution (DST). */
export function createMockSandbox(options: MockSandboxOptions = {}): BwrapSandbox {
  const exitCode = options.exitCode ?? 0;
  const stdout = options.stdout ?? "mock output";
  const stderr = options.stderr ?? "";
  return {
    spawn(_command: readonly string[], _opts: BwrapSpawnOptions): Promise<SandboxSpawnResult> {
      return Promise.resolve({
        outcome: "ok",
        value: {
          pid: 1,
          wait: () => Promise.resolve({ exitCode, stdout, stderr }),
          kill: () => Promise.resolve(),
        },
      });
    },
  };
}
