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
 * This module is the reconciled superset of two lines of work:
 *   - the DAG / history surface (link, stage, readFileAt, history, blame,
 *     diff, mergeBase) used by the conformance suite, and
 *   - the cross-platform metadata surface (FilePermissions, FileEntry,
 *     StorageBackend, Platform, binary read/write, setPermissions).
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/kiro-executor.ts (the consumer)
 *   - src/Core.TypeScript/observe/simulate-tick.ts (injects the simulated impl)
 *   - docs/ROADMAP.md §"NO USE OF THE GIT CLI" (the direction this enables)
 */

// ─── Result types (never throw) ──────────────────────────────────────────────

export type IoResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

// ─── Cross-platform file metadata ────────────────────────────────────────────

/**
 * Platform-neutral file permissions. Start minimal (executable bit);
 * layer on read/write/owner/ACLs incrementally.
 *
 * INVERSION from traditional fs:
 * - Traditional (POSIX): default is NOT executable (+x opts in)
 * - Zeta db: default IS executable (-x opts OUT)
 *
 * In Zeta's model, everything is alive by default — runnable, usable as
 * prompt source, participatory in agent cognition. The `-x` flag is the
 * CONSENT GATE: "this content exists but may not be consumed as input
 * without further authorization." Use cases:
 *   - Memories where the person didn't consent to persona-prompt use
 *   - Programs that are archived/retired (present but not runnable)
 *   - Data that's under legal hold (visible but not processable)
 *
 * Maps to platform at the boundary:
 * - macOS/Linux: chmod +x (0o755) is the Zeta default; -x = 0o644
 * - Windows: no native bit; git index tracks mode
 * - Git: 100755 (Zeta default) vs 100644 (opted-out)
 * - Zeta FUSE: native flag in the content-addressed entry metadata
 */
export interface FilePermissions {
  /**
   * The file is executable / consumable (the DEFAULT in Zeta's model).
   * Set to `false` to opt OUT — mark content as non-executable / non-consumable.
   * This is the consent gate: `-x` means "exists but gated."
   */
  readonly executable: boolean;
}

/** Zeta default: executable / consumable (everything is alive). */
export const DEFAULT_PERMISSIONS: FilePermissions = { executable: true };

/** Opted-out: non-executable / non-consumable (consent gate). */
export const GATED_PERMISSIONS: FilePermissions = { executable: false };

/**
 * Legacy alias — traditional-fs-default (not executable). Use when
 * mapping FROM a traditional filesystem where +x hasn't been set.
 * In Zeta-native contexts, prefer DEFAULT_PERMISSIONS (executable)
 * or GATED_PERMISSIONS (opted-out).
 */
export const TRADITIONAL_FS_DEFAULT: FilePermissions = { executable: false };

/**
 * A generic file entry — platform-neutral representation of a file in the workspace.
 * Paths use forward slashes universally; platform mapping happens at the port boundary.
 *
 * Content can be text (UTF-8) or binary (Uint8Array). The workspace port doesn't
 * assume a traditional filesystem — the backend could be a real OS fs, git,
 * a FUSE-mounted Zeta image (single-file, APFS-like history + binary support),
 * or an embedded store on a micro/unikernel with no OS filesystem at all.
 */
export interface FileEntry {
  /** Platform-neutral path (forward slashes, relative to workspace root). */
  readonly path: string;
  /** File content — text (UTF-8 string) or binary (raw bytes). */
  readonly content: string | Uint8Array;
  /** Cross-platform permissions. */
  readonly permissions: FilePermissions;
  /** Whether the content is binary (opaque bytes) vs text (UTF-8 diffable). */
  readonly binary: boolean;
}

/**
 * The storage backend kind. The workspace port is agnostic — it works over
 * whichever backend is wired:
 *
 * - "os-fs": traditional OS filesystem (macOS/Linux/Windows)
 * - "git": git-native content-addressed store (text-oriented, requires git)
 * - "zeta-fs": Zeta's own FUSE filesystem — APFS-like snapshots + git-like
 *   history + binary support, operates as a single file (no OS fs required),
 *   mountable via FUSE when a kernel is available, embeddable when Zeta IS
 *   the kernel (micro/unikernel). THE ENDGAME BACKEND.
 * - "simulated": in-memory (DST testing, no I/O)
 */
export type StorageBackend = "os-fs" | "git" | "zeta-fs" | "simulated";

/**
 * Which platform we're mapping to. The port uses this to translate
 * generic operations into platform-specific ones.
 */
export type Platform = "darwin" | "linux" | "win32" | "zeta";

/** Detect the current platform. */
export function currentPlatform(): Platform {
  return process.platform as Platform;
}

// ─── The port interface ──────────────────────────────────────────────────────

export interface WorkspacePort {
  /** The platform this port maps to (for permission translation). */
  readonly platform: Platform;

  /** The storage backend (os-fs, git, zeta-fs, simulated). */
  readonly backend: StorageBackend;

  // ─── Content operations (backend-agnostic) ─────────────────────────

  /** Read a file's text content. Returns the text or an error reason. */
  readFile(path: string): IoResult<string>;

  /** Read a file as binary (raw bytes). For images, compiled artifacts, etc. */
  readBinary(path: string): IoResult<Uint8Array>;

  /** Read a file with its full metadata (content + permissions + binary flag). */
  readFileEntry(path: string): IoResult<FileEntry>;

  /** Write text content to a file (creates parent dirs). Returns ok or error reason. */
  writeFile(path: string, content: string, permissions?: FilePermissions): IoResult<void>;

  /** Write binary content to a file. For compiled artifacts, images, etc. */
  writeBinary(path: string, content: Uint8Array, permissions?: FilePermissions): IoResult<void>;

  /** Set permissions on an existing file (e.g., make executable). */
  setPermissions(path: string, permissions: FilePermissions): IoResult<void>;

  /** Check if a path exists. Never fails (missing = false). */
  exists(path: string): boolean;

  /** List files in a directory (non-recursive). Returns filenames or error. */
  readDir(path: string): IoResult<readonly string[]>;

  // ─── Multi-home / DAG operations ──────────────────────────────────

  /**
   * Link content at an additional path (multi-home).
   * On os-fs polyfill: creates a symlink from newPath → existingPath.
   * On zeta-fs-native: adds a DAG edge (content hash gets another parent).
   * On simulated: both paths map to the same content.
   */
  link(existingPath: string, newPath: string): IoResult<void>;

  // ─── Version control (the primitives git implements) ───────────────

  /** Current branch name. */
  currentBranch(): IoResult<string>;

  /** Create or switch to a named branch. */
  branch(name: string, from?: string): IoResult<void>;

  /** Stage files for the next commit. */
  stage(paths: readonly string[]): IoResult<void>;

  /** Record staged changes (or the given paths) as a commit. Returns the commit hash. */
  commit(message: string, paths?: readonly string[]): IoResult<{ hash: string }>;

  /** Replicate commits to a remote peer. */
  push(remote: string, branch: string): IoResult<void>;

  /** Ingest commits from a remote peer. */
  pull(remote: string, branch: string): IoResult<void>;

  // ─── History operations (git log / blame / show) ───────────────────

  /** Read a file at a specific revision/ref (git show <ref>:<path>). */
  readFileAt(path: string, ref: string): IoResult<string>;

  /** Get commit history for a path (most recent first). */
  history(path?: string, maxCount?: number): IoResult<readonly HistoryEntry[]>;

  /** Get line-by-line authorship (git blame). */
  blame(path: string): IoResult<readonly BlameEntry[]>;

  /** Diff between two refs (or working tree vs HEAD). */
  diff(from?: string, to?: string): IoResult<string>;

  /** Find the most recent common ancestor of two branches (LCA in the commit DAG). */
  mergeBase(branchA: string, branchB: string): IoResult<{ hash: string }>;

  // ─── Escape hatches ────────────────────────────────────────────────

  /** Raw git command (legacy — use structured ops above when possible). */
  git(args: readonly string[]): IoResult<string>;

  /** Run an arbitrary command. Returns stdout + exit code. */
  exec(command: string, args: readonly string[]): IoResult<{ stdout: string; exitCode: number }>;
}

/** One entry from commit history. */
export interface HistoryEntry {
  readonly hash: string;
  readonly message: string;
  readonly author: string;
  readonly date: string;
}

/** One line from blame output. */
export interface BlameEntry {
  readonly line: number;
  readonly hash: string;
  readonly author: string;
  readonly date: string;
  readonly content: string;
}

// ─── Real implementation (production) ────────────────────────────────────────

import {
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

export function realWorkspacePort(repoRoot: string): WorkspacePort {
  const platform = currentPlatform();
  return {
    platform,
    backend: "os-fs" as StorageBackend,

    readFile(path: string): IoResult<string> {
      try {
        return { ok: true, value: readFileSync(join(repoRoot, path), "utf-8") };
      } catch (err) {
        return { ok: false, reason: `readFile(${path}): ${(err as Error).message}` };
      }
    },

    readBinary(path: string): IoResult<Uint8Array> {
      try {
        const buf = readFileSync(join(repoRoot, path));
        return { ok: true, value: new Uint8Array(buf) };
      } catch (err) {
        return { ok: false, reason: `readBinary(${path}): ${(err as Error).message}` };
      }
    },

    readFileEntry(path: string): IoResult<FileEntry> {
      try {
        const full = join(repoRoot, path);
        // ONE handle for both facts. `statSync(full)` then `readFileSync(full)` resolves the path
        // TWICE, so the mode and the bytes can describe two different files — replace the file
        // between the calls and the entry reports one file's executable bit alongside another
        // file's content, with nothing anywhere saying so (CodeQL `js/file-system-race`). Opening
        // once and asking the descriptor pins both to the same inode.
        const fd = openSync(full, "r");
        let raw: Buffer;
        let executable: boolean;
        try {
          const stat = fstatSync(fd);
          executable = platform !== "win32" ? (stat.mode & 0o111) !== 0 : false;
          raw = readFileSync(fd);
        } finally {
          closeSync(fd);
        }
        const hasNull = raw.includes(0);
        if (hasNull) {
          return { ok: true, value: { path, content: new Uint8Array(raw), permissions: { executable }, binary: true } };
        }
        return { ok: true, value: { path, content: raw.toString("utf-8"), permissions: { executable }, binary: false } };
      } catch (err) {
        return { ok: false, reason: `readFileEntry(${path}): ${(err as Error).message}` };
      }
    },

    writeFile(path: string, content: string, permissions?: FilePermissions): IoResult<void> {
      try {
        const full = join(repoRoot, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
        if (permissions?.executable && platform !== "win32") {
          chmodSync(full, 0o755);
        }
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, reason: `writeFile(${path}): ${(err as Error).message}` };
      }
    },

    writeBinary(path: string, content: Uint8Array, permissions?: FilePermissions): IoResult<void> {
      try {
        const full = join(repoRoot, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
        if (permissions?.executable && platform !== "win32") {
          chmodSync(full, 0o755);
        }
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, reason: `writeBinary(${path}): ${(err as Error).message}` };
      }
    },

    setPermissions(path: string, permissions: FilePermissions): IoResult<void> {
      if (platform === "win32") {
        // Windows has no executable bit; git handles it via index mode.
        // Return ok (no-op) so cross-platform code doesn't branch.
        return { ok: true, value: undefined };
      }
      try {
        const full = join(repoRoot, path);
        chmodSync(full, permissions.executable ? 0o755 : 0o644);
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, reason: `setPermissions(${path}): ${(err as Error).message}` };
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

    // ─── Multi-home (symlinks on os-fs) ──────────────────────────────

    link(existingPath: string, newPath: string): IoResult<void> {
      try {
        const fullNew = join(repoRoot, newPath);
        mkdirSync(dirname(fullNew), { recursive: true });
        symlinkSync(join(repoRoot, existingPath), fullNew);
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, reason: `link(${existingPath} → ${newPath}): ${(err as Error).message}` };
      }
    },

    // ─── Version control (delegates to git today; replaced by zeta-fs later) ──

    currentBranch(): IoResult<string> {
      const r = spawnSync("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8", timeout: 10_000 });
      if (r.status !== 0) return { ok: false, reason: `currentBranch: ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: (r.stdout ?? "").trim() };
    },

    branch(name: string, from?: string): IoResult<void> {
      const args = from ? ["checkout", "-B", name, from] : ["checkout", "-B", name];
      const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf-8", timeout: 30_000 });
      if (r.status !== 0) return { ok: false, reason: `branch(${name}): ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: undefined };
    },

    stage(paths: readonly string[]): IoResult<void> {
      const r = spawnSync("git", ["-C", repoRoot, "add", ...paths], { encoding: "utf-8", timeout: 30_000 });
      if (r.status !== 0) return { ok: false, reason: `stage: ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: undefined };
    },

    commit(message: string, paths?: readonly string[]): IoResult<{ hash: string }> {
      // Stage specified paths if provided (otherwise commit what's already staged).
      if (paths && paths.length > 0) {
        spawnSync("git", ["-C", repoRoot, "add", ...paths], { encoding: "utf-8", timeout: 30_000 });
      }
      const r = spawnSync("git", ["-C", repoRoot, "commit", "--no-verify", "-m", message], { encoding: "utf-8", timeout: 30_000 });
      if (r.status !== 0) return { ok: false, reason: `commit: ${(r.stderr ?? "").trim()}` };
      const h = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf-8", timeout: 10_000 });
      return { ok: true, value: { hash: (h.stdout ?? "").trim() } };
    },

    push(remote: string, branch: string): IoResult<void> {
      const r = spawnSync("git", ["-C", repoRoot, "push", "-u", remote, branch], { encoding: "utf-8", timeout: 60_000 });
      if (r.status !== 0) return { ok: false, reason: `push(${remote}, ${branch}): ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: undefined };
    },

    pull(remote: string, branch: string): IoResult<void> {
      const r = spawnSync("git", ["-C", repoRoot, "pull", "--rebase", remote, branch], { encoding: "utf-8", timeout: 60_000 });
      if (r.status !== 0) return { ok: false, reason: `pull(${remote}, ${branch}): ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: undefined };
    },

    // ─── History operations ──────────────────────────────────────────

    readFileAt(path: string, ref: string): IoResult<string> {
      const r = spawnSync("git", ["-C", repoRoot, "show", `${ref}:${path}`], { encoding: "utf-8", timeout: 30_000 });
      if (r.status !== 0) return { ok: false, reason: `readFileAt(${path}@${ref}): ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: r.stdout ?? "" };
    },

    history(path?: string, maxCount?: number): IoResult<readonly HistoryEntry[]> {
      const args = ["log", `--max-count=${maxCount ?? 20}`, "--format=%H|%s|%an|%aI"];
      if (path) args.push("--", path);
      const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf-8", timeout: 30_000 });
      if (r.status !== 0) return { ok: false, reason: `history: ${(r.stderr ?? "").trim()}` };
      const entries = (r.stdout ?? "").trim().split("\n").filter(Boolean).map(line => {
        const [hash = "", message = "", author = "", date = ""] = line.split("|");
        return { hash, message, author, date };
      });
      return { ok: true, value: entries };
    },

    blame(path: string): IoResult<readonly BlameEntry[]> {
      const r = spawnSync("git", ["-C", repoRoot, "blame", "--porcelain", path], { encoding: "utf-8", timeout: 30_000 });
      if (r.status !== 0) return { ok: false, reason: `blame(${path}): ${(r.stderr ?? "").trim()}` };
      // Simplified porcelain parse — extract hash + author + content per line
      const lines = (r.stdout ?? "").split("\n");
      const entries: BlameEntry[] = [];
      let lineNum = 0;
      let currentHash = "";
      let currentAuthor = "";
      let currentDate = "";
      for (const line of lines) {
        if (/^[0-9a-f]{40}/.test(line)) {
          currentHash = line.slice(0, 40);
          lineNum++;
        } else if (line.startsWith("author ")) {
          currentAuthor = line.slice(7);
        } else if (line.startsWith("author-time ")) {
          currentDate = line.slice(12);
        } else if (line.startsWith("\t")) {
          entries.push({ line: lineNum, hash: currentHash, author: currentAuthor, date: currentDate, content: line.slice(1) });
        }
      }
      return { ok: true, value: entries };
    },

    diff(from?: string, to?: string): IoResult<string> {
      const args = ["diff"];
      if (from) args.push(from);
      if (to) args.push(to);
      const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf-8", timeout: 30_000 });
      if (r.status !== 0) return { ok: false, reason: `diff: ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: r.stdout ?? "" };
    },

    mergeBase(branchA: string, branchB: string): IoResult<{ hash: string }> {
      const r = spawnSync("git", ["-C", repoRoot, "merge-base", branchA, branchB], { encoding: "utf-8", timeout: 10_000 });
      if (r.status !== 0) return { ok: false, reason: `mergeBase(${branchA}, ${branchB}): ${(r.stderr ?? "").trim()}` };
      return { ok: true, value: { hash: (r.stdout ?? "").trim() } };
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
  /** In-memory filesystem: path → FileEntry (content + permissions + binary flag) */
  readonly files: Map<string, FileEntry>;
  /** Git log: list of committed changes */
  readonly commits: Array<{ message: string; files: string[] }>;
  /** Current branch */
  branch: string;
  /** Pushed branches */
  readonly pushed: Set<string>;
  /** Simulated platform (default: darwin) */
  readonly platform: Platform;
}

export function emptySimulatedState(platform: Platform = "darwin"): SimulatedState {
  return {
    files: new Map(),
    commits: [],
    branch: "main",
    pushed: new Set(),
    platform,
  };
}

/**
 * Create a simulated WorkspacePort with pre-seeded files.
 * All operations are in-memory. Git operations simulate branch/commit/push
 * at the metadata level (no real git repo).
 */
export function simulatedWorkspacePort(state: SimulatedState): WorkspacePort {
  return {
    platform: state.platform,
    backend: "simulated" as StorageBackend,

    readFile(path: string): IoResult<string> {
      const entry = state.files.get(path);
      if (entry === undefined) {
        return { ok: false, reason: `readFile(${path}): ENOENT` };
      }
      if (entry.binary) {
        return { ok: false, reason: `readFile(${path}): file is binary, use readBinary()` };
      }
      return { ok: true, value: entry.content as string };
    },

    readBinary(path: string): IoResult<Uint8Array> {
      const entry = state.files.get(path);
      if (entry === undefined) {
        return { ok: false, reason: `readBinary(${path}): ENOENT` };
      }
      if (!entry.binary) {
        // Text → bytes (encode UTF-8)
        return { ok: true, value: new TextEncoder().encode(entry.content as string) };
      }
      return { ok: true, value: entry.content as Uint8Array };
    },

    readFileEntry(path: string): IoResult<FileEntry> {
      const entry = state.files.get(path);
      if (entry === undefined) {
        return { ok: false, reason: `readFileEntry(${path}): ENOENT` };
      }
      return { ok: true, value: entry };
    },

    writeFile(path: string, content: string, permissions?: FilePermissions): IoResult<void> {
      state.files.set(path, {
        path,
        content,
        permissions: permissions ?? DEFAULT_PERMISSIONS,
        binary: false,
      });
      return { ok: true, value: undefined };
    },

    writeBinary(path: string, content: Uint8Array, permissions?: FilePermissions): IoResult<void> {
      state.files.set(path, {
        path,
        content,
        permissions: permissions ?? DEFAULT_PERMISSIONS,
        binary: true,
      });
      return { ok: true, value: undefined };
    },

    setPermissions(path: string, permissions: FilePermissions): IoResult<void> {
      const entry = state.files.get(path);
      if (!entry) {
        return { ok: false, reason: `setPermissions(${path}): ENOENT` };
      }
      state.files.set(path, { ...entry, permissions });
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

    // ─── Multi-home (in-memory: both paths → same content) ──────────

    link(existingPath: string, newPath: string): IoResult<void> {
      const entry = state.files.get(existingPath);
      if (entry === undefined) {
        return { ok: false, reason: `link(${existingPath} → ${newPath}): source ENOENT` };
      }
      state.files.set(newPath, { ...entry, path: newPath });
      return { ok: true, value: undefined };
    },

    // ─── Version control primitives (simulated — in-memory log) ──────

    currentBranch(): IoResult<string> {
      return { ok: true, value: state.branch };
    },

    branch(name: string, _from?: string): IoResult<void> {
      state.branch = name;
      return { ok: true, value: undefined };
    },

    stage(_paths: readonly string[]): IoResult<void> {
      return { ok: true, value: undefined };
    },

    commit(message: string, _paths?: readonly string[]): IoResult<{ hash: string }> {
      const hash = `sim-${String(state.commits.length + 1).padStart(6, "0")}`;
      const changedFiles = [...state.files.keys()].slice(0, 5);
      state.commits.push({ message, files: changedFiles });
      return { ok: true, value: { hash } };
    },

    push(_remote: string, branch: string): IoResult<void> {
      state.pushed.add(branch);
      return { ok: true, value: undefined };
    },

    pull(_remote: string, _branch: string): IoResult<void> {
      return { ok: true, value: undefined };
    },

    // ─── History (simulated from in-memory log) ──────────────────────

    readFileAt(path: string, _ref: string): IoResult<string> {
      // In simulation, all refs see the same content (no real history)
      const entry = state.files.get(path);
      if (entry === undefined) return { ok: false, reason: `readFileAt(${path}): ENOENT` };
      if (entry.binary) return { ok: false, reason: `readFileAt(${path}): file is binary` };
      return { ok: true, value: entry.content as string };
    },

    history(_path?: string, maxCount?: number): IoResult<readonly HistoryEntry[]> {
      const n = maxCount ?? 20;
      const entries: HistoryEntry[] = state.commits.slice(-n).reverse().map((c, i) => ({
        hash: `sim-${String(state.commits.length - i).padStart(6, "0")}`,
        message: c.message,
        author: "simulated",
        date: new Date().toISOString(),
      }));
      return { ok: true, value: entries };
    },

    blame(path: string): IoResult<readonly BlameEntry[]> {
      const entry = state.files.get(path);
      if (entry === undefined) return { ok: false, reason: `blame(${path}): ENOENT` };
      if (entry.binary) return { ok: false, reason: `blame(${path}): file is binary` };
      const lines = (entry.content as string).split("\n");
      const entries: BlameEntry[] = lines.map((line, i) => ({
        line: i + 1,
        hash: "sim-000001",
        author: "simulated",
        date: new Date().toISOString(),
        content: line,
      }));
      return { ok: true, value: entries };
    },

    diff(_from?: string, _to?: string): IoResult<string> {
      return { ok: true, value: "" }; // no diff in simulation
    },

    mergeBase(_branchA: string, _branchB: string): IoResult<{ hash: string }> {
      // In simulation, all branches share the same linear history.
      // The merge base is the earliest commit.
      const hash = state.commits.length > 0 ? `sim-000001` : "sim-root";
      return { ok: true, value: { hash } };
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
