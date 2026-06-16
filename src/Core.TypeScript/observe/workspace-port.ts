/**
 * src/Core.TypeScript/observe/workspace-port.ts — DI-injectable workspace I/O port.
 *
 * The executor needs to: read files, write files, run git commands, and spawn
 * processes. This module defines the INTERFACE for those operations so the
 * simulation harness can inject a fake (in-memory filesystem + fake git) while
 * production uses the real thing.
 *
 * This is the first step toward the roadmap's "NO GIT CLI" item — every
 * persistence action routes through this port. Today it wraps the raw calls;
 * tomorrow it routes through the git-native database layer.
 *
 * Design principles:
 * - Result-over-exception: every operation returns a typed outcome, never throws
 * - Minimal surface: only what the executor actually needs (not a full fs API)
 * - DST-compatible: the simulated impl is deterministic and replayable
 * - Same interface, same code path: production and simulation differ only in
 *   which WorkspacePort implementation is injected
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/kiro-executor.ts (the consumer)
 *   - src/Core.TypeScript/observe/simulate-tick.ts (injects the simulated impl)
 *   - docs/ROADMAP.md §"NO USE OF THE GIT CLI" (the direction this enables)
 */

// ─── Result types (never throw) ──────────────────────────────────────────────

export type IoResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

// ─── The port interface ──────────────────────────────────────────────────────

export interface WorkspacePort {
  /** Read a file's content. Returns the text or an error reason. */
  readFile(path: string): IoResult<string>;

  /** Write content to a file (creates parent dirs). Returns ok or error reason. */
  writeFile(path: string, content: string): IoResult<void>;

  /** Check if a path exists. Never fails (missing = false). */
  exists(path: string): boolean;

  /** List files in a directory (non-recursive). Returns filenames or error. */
  readDir(path: string): IoResult<readonly string[]>;

  /** Run a git command. Returns stdout or error. */
  git(args: readonly string[]): IoResult<string>;

  /** Run an arbitrary command. Returns stdout + exit code. */
  exec(command: string, args: readonly string[]): IoResult<{ stdout: string; exitCode: number }>;
}

// ─── Real implementation (production) ────────────────────────────────────────

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

export function realWorkspacePort(repoRoot: string): WorkspacePort {
  return {
    readFile(path: string): IoResult<string> {
      try {
        return { ok: true, value: readFileSync(join(repoRoot, path), "utf-8") };
      } catch (err) {
        return { ok: false, reason: `readFile(${path}): ${(err as Error).message}` };
      }
    },

    writeFile(path: string, content: string): IoResult<void> {
      try {
        const full = join(repoRoot, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, reason: `writeFile(${path}): ${(err as Error).message}` };
      }
    },

    exists(path: string): boolean {
      return existsSync(join(repoRoot, path));
    },

    readDir(path: string): IoResult<readonly string[]> {
      try {
        return { ok: true, value: readdirSync(join(repoRoot, path)) };
      } catch (err) {
        return { ok: false, reason: `readDir(${path}): ${(err as Error).message}` };
      }
    },

    git(args: readonly string[]): IoResult<string> {
      const result = spawnSync("git", ["-C", repoRoot, ...args], {
        encoding: "utf-8",
        timeout: 30_000,
      });
      if (result.status !== 0) {
        return { ok: false, reason: `git ${args[0]}: ${(result.stderr ?? "").trim() || `exit ${result.status}`}` };
      }
      return { ok: true, value: (result.stdout ?? "").trim() };
    },

    exec(command: string, args: readonly string[]): IoResult<{ stdout: string; exitCode: number }> {
      try {
        const result = spawnSync(command, args, {
          cwd: repoRoot,
          encoding: "utf-8",
          timeout: 60_000,
        });
        return { ok: true, value: { stdout: (result.stdout ?? "").trim(), exitCode: result.status ?? -1 } };
      } catch (err) {
        return { ok: false, reason: `exec(${command}): ${(err as Error).message}` };
      }
    },
  };
}

// ─── Simulated implementation (DST / in-memory) ──────────────────────────────

export interface SimulatedState {
  /** In-memory filesystem: path → content */
  readonly files: Map<string, string>;
  /** Git log: list of committed changes */
  readonly commits: Array<{ message: string; files: string[] }>;
  /** Current branch */
  branch: string;
  /** Pushed branches */
  readonly pushed: Set<string>;
}

export function emptySimulatedState(): SimulatedState {
  return {
    files: new Map(),
    commits: [],
    branch: "main",
    pushed: new Set(),
  };
}

/**
 * Create a simulated WorkspacePort with pre-seeded files.
 * All operations are in-memory. Git operations simulate branch/commit/push
 * at the metadata level (no real git repo).
 */
export function simulatedWorkspacePort(state: SimulatedState): WorkspacePort {
  return {
    readFile(path: string): IoResult<string> {
      const content = state.files.get(path);
      if (content === undefined) {
        return { ok: false, reason: `readFile(${path}): ENOENT` };
      }
      return { ok: true, value: content };
    },

    writeFile(path: string, content: string): IoResult<void> {
      state.files.set(path, content);
      return { ok: true, value: undefined };
    },

    exists(path: string): boolean {
      return state.files.has(path);
    },

    readDir(path: string): IoResult<readonly string[]> {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      const entries = new Set<string>();
      for (const key of state.files.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const firstSegment = rest.split("/")[0];
          if (firstSegment) entries.add(firstSegment);
        }
      }
      return { ok: true, value: [...entries].sort() };
    },

    git(args: readonly string[]): IoResult<string> {
      const cmd = args[0];
      switch (cmd) {
        case "rev-parse":
          if (args.includes("--abbrev-ref") && args.includes("HEAD")) {
            return { ok: true, value: state.branch };
          }
          return { ok: true, value: "simulated-sha" };

        case "checkout":
          if (args[1] === "-B" || args[1] === "-b") {
            state.branch = args[2] ?? "unknown";
            return { ok: true, value: `Switched to branch '${state.branch}'` };
          }
          state.branch = args[1] ?? "main";
          return { ok: true, value: `Switched to branch '${state.branch}'` };

        case "fetch":
          return { ok: true, value: "" };

        case "add":
          return { ok: true, value: "" };

        case "commit": {
          const msgIdx = args.indexOf("-m");
          const message = msgIdx >= 0 ? (args[msgIdx + 1] ?? "commit") : "commit";
          const changedFiles = [...state.files.keys()].slice(0, 3);
          state.commits.push({ message, files: changedFiles });
          return { ok: true, value: `[${state.branch} sim] ${message}` };
        }

        case "push":
          state.pushed.add(state.branch);
          return { ok: true, value: `Pushed to ${state.branch}` };

        case "branch":
          if (args.includes("--show-current")) {
            return { ok: true, value: state.branch };
          }
          return { ok: true, value: state.branch };

        case "log":
          return { ok: true, value: state.commits.map(c => c.message).join("\n") };

        case "status":
          return { ok: true, value: "" };

        case "diff":
          return { ok: true, value: "" };

        default:
          return { ok: true, value: "" };
      }
    },

    exec(command: string, args: readonly string[]): IoResult<{ stdout: string; exitCode: number }> {
      // Simulate common commands
      if (command === "bun" && args[0] === "test") {
        return { ok: true, value: { stdout: "0 fail\n1 pass", exitCode: 0 } };
      }
      return { ok: true, value: { stdout: "simulated", exitCode: 0 } };
    },
  };
}
