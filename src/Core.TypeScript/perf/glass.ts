// glass — the shared GLASS-SIDE discipline for every pro(file) lane (081KTSZN10008QG0R001F0B5A6; Aaron 2026-06-11:
// "glass-side only no wall clock in the room" + "lets move to src"). A lane NEVER enters the
// room: it attaches a dotnet diagnostics tool (EventPipe IPC) to a pid from OUTSIDE — zero
// syscalls injected into the observed loop, the Reticulum-only seal intact, the red light on
// (diagnostics sessions are visible to the observed process; observation is never covert).
//
// Library shape (Core.TypeScript convention): the ARG BUILDERS are pure and tested; the spawn
// is the one thin side-effecting door. In-room measurement stays the exact pair
// (Ben.chip8Ticks + Ben.allocBytes) — everything statistical lives here, through the glass.

import { spawn, spawnSync } from "node:child_process";

export interface GlassTarget {
  /** Attach to an already-running .NET process. */
  readonly pid?: number | undefined;
  /** Or spawn this command and attach to its root pid (testhost caveat: `dotnet test` does its
   * work in a CHILD process — find it with `dotnet-trace ps` and use pid instead). */
  readonly command?: readonly string[] | undefined;
}

/** Resolve the target to a pid, spawning if asked. Returns the pid and the child (if spawned). */
export function acquire(target: GlassTarget): { pid: number; child?: ReturnType<typeof spawn> } {
  if ((target.pid === undefined) === (target.command === undefined || target.command.length === 0)) {
    throw new Error("exactly one of pid or command is required");
  }
  if (target.pid !== undefined) {
    if (!Number.isInteger(target.pid) || target.pid <= 0) throw new Error(`pid must be a positive integer, got ${target.pid}`);
    return { pid: target.pid };
  }
  const cmd = target.command!;
  const child = spawn(cmd[0]!, cmd.slice(1), { stdio: "inherit" });
  if (child.pid === undefined) throw new Error(`could not spawn: ${cmd.join(" ")}`);
  return { pid: child.pid, child };
}

/** Run one diagnostics tool to completion, glass-side, inheriting stdio. */
export function observe(tool: string, args: readonly string[], target: { child?: ReturnType<typeof spawn> }): number {
  const r = spawnSync(tool, args as string[], { stdio: "inherit" });
  if (target.child !== undefined && target.child.exitCode === null) target.child.kill("SIGTERM");
  return r.status ?? 1;
}

/** `--duration` form dotnet diagnostics tools expect (dd:hh:mm:ss) from plain seconds. */
export function durationOf(seconds: number): string {
  if (!Number.isInteger(seconds) || seconds <= 0) throw new Error(`seconds must be a positive integer, got ${seconds}`);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `00:${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Shared CLI flag parsing for every lane: [--pid N] [--seconds S] [--out F] [-- cmd...]. */
export interface LaneFlags {
  readonly pid?: number | undefined;
  readonly seconds?: number | undefined;
  readonly out?: string | undefined;
  readonly command?: readonly string[] | undefined;
}

export function parseLaneFlags(argv: readonly string[]): LaneFlags {
  const sep = argv.indexOf("--");
  const flags = sep >= 0 ? argv.slice(0, sep) : argv;
  const command = sep >= 0 ? argv.slice(sep + 1) : undefined;
  const valueOf = (name: string): string | undefined => {
    const i = flags.indexOf("--" + name);
    if (i >= 0 && i + 1 >= flags.length) throw new Error(`--${name} needs a value`);
    return i >= 0 ? flags[i + 1] : undefined;
  };
  const num = (name: string): number | undefined => {
    const v = valueOf(name);
    if (v === undefined) return undefined;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive integer, got '${v}'`);
    return n;
  };
  return { pid: num("pid"), seconds: num("seconds"), out: valueOf("out"), command };
}
