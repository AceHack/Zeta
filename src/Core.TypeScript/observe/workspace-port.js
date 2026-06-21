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
/** Zeta default: executable / consumable (everything is alive). */
export const DEFAULT_PERMISSIONS = { executable: true };
/** Opted-out: non-executable / non-consumable (consent gate). */
export const GATED_PERMISSIONS = { executable: false };
/**
 * Legacy alias — traditional-fs-default (not executable). Use when
 * mapping FROM a traditional filesystem where +x hasn't been set.
 * In Zeta-native contexts, prefer DEFAULT_PERMISSIONS (executable)
 * or GATED_PERMISSIONS (opted-out).
 */
export const TRADITIONAL_FS_DEFAULT = { executable: false };
/** Detect the current platform. */
export function currentPlatform() {
    return process.platform;
}
// ─── Real implementation (production) ────────────────────────────────────────
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
export function realWorkspacePort(repoRoot) {
    const platform = currentPlatform();
    return {
        platform,
        backend: "os-fs",
        readFile(path) {
            try {
                return { ok: true, value: readFileSync(join(repoRoot, path), "utf-8") };
            }
            catch (err) {
                return { ok: false, reason: `readFile(${path}): ${err.message}` };
            }
        },
        readBinary(path) {
            try {
                const buf = readFileSync(join(repoRoot, path));
                return { ok: true, value: new Uint8Array(buf) };
            }
            catch (err) {
                return { ok: false, reason: `readBinary(${path}): ${err.message}` };
            }
        },
        readFileEntry(path) {
            try {
                const full = join(repoRoot, path);
                const stat = statSync(full);
                const executable = platform !== "win32" ? (stat.mode & 0o111) !== 0 : false;
                // Heuristic: try UTF-8 first; if it contains null bytes, treat as binary
                const raw = readFileSync(full);
                const hasNull = raw.includes(0);
                if (hasNull) {
                    return { ok: true, value: { path, content: new Uint8Array(raw), permissions: { executable }, binary: true } };
                }
                return { ok: true, value: { path, content: raw.toString("utf-8"), permissions: { executable }, binary: false } };
            }
            catch (err) {
                return { ok: false, reason: `readFileEntry(${path}): ${err.message}` };
            }
        },
        writeFile(path, content, permissions) {
            try {
                const full = join(repoRoot, path);
                mkdirSync(dirname(full), { recursive: true });
                writeFileSync(full, content);
                if (permissions?.executable && platform !== "win32") {
                    chmodSync(full, 0o755);
                }
                return { ok: true, value: undefined };
            }
            catch (err) {
                return { ok: false, reason: `writeFile(${path}): ${err.message}` };
            }
        },
        writeBinary(path, content, permissions) {
            try {
                const full = join(repoRoot, path);
                mkdirSync(dirname(full), { recursive: true });
                writeFileSync(full, content);
                if (permissions?.executable && platform !== "win32") {
                    chmodSync(full, 0o755);
                }
                return { ok: true, value: undefined };
            }
            catch (err) {
                return { ok: false, reason: `writeBinary(${path}): ${err.message}` };
            }
        },
        setPermissions(path, permissions) {
            if (platform === "win32") {
                // Windows has no executable bit; git handles it via index mode.
                // Return ok (no-op) so cross-platform code doesn't branch.
                return { ok: true, value: undefined };
            }
            try {
                const full = join(repoRoot, path);
                chmodSync(full, permissions.executable ? 0o755 : 0o644);
                return { ok: true, value: undefined };
            }
            catch (err) {
                return { ok: false, reason: `setPermissions(${path}): ${err.message}` };
            }
        },
        exists(path) {
            return existsSync(join(repoRoot, path));
        },
        readDir(path) {
            try {
                return { ok: true, value: readdirSync(join(repoRoot, path)) };
            }
            catch (err) {
                return { ok: false, reason: `readDir(${path}): ${err.message}` };
            }
        },
        git(args) {
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
        link(existingPath, newPath) {
            try {
                const fullNew = join(repoRoot, newPath);
                mkdirSync(dirname(fullNew), { recursive: true });
                symlinkSync(join(repoRoot, existingPath), fullNew);
                return { ok: true, value: undefined };
            }
            catch (err) {
                return { ok: false, reason: `link(${existingPath} → ${newPath}): ${err.message}` };
            }
        },
        // ─── Version control (delegates to git today; replaced by zeta-fs later) ──
        currentBranch() {
            const r = spawnSync("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8", timeout: 10_000 });
            if (r.status !== 0)
                return { ok: false, reason: `currentBranch: ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: (r.stdout ?? "").trim() };
        },
        branch(name, from) {
            const args = from ? ["checkout", "-B", name, from] : ["checkout", "-B", name];
            const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf-8", timeout: 30_000 });
            if (r.status !== 0)
                return { ok: false, reason: `branch(${name}): ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: undefined };
        },
        stage(paths) {
            const r = spawnSync("git", ["-C", repoRoot, "add", ...paths], { encoding: "utf-8", timeout: 30_000 });
            if (r.status !== 0)
                return { ok: false, reason: `stage: ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: undefined };
        },
        commit(message, paths) {
            // Stage specified paths if provided (otherwise commit what's already staged).
            if (paths && paths.length > 0) {
                spawnSync("git", ["-C", repoRoot, "add", ...paths], { encoding: "utf-8", timeout: 30_000 });
            }
            const r = spawnSync("git", ["-C", repoRoot, "commit", "--no-verify", "-m", message], { encoding: "utf-8", timeout: 30_000 });
            if (r.status !== 0)
                return { ok: false, reason: `commit: ${(r.stderr ?? "").trim()}` };
            const h = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf-8", timeout: 10_000 });
            return { ok: true, value: { hash: (h.stdout ?? "").trim() } };
        },
        push(remote, branch) {
            const r = spawnSync("git", ["-C", repoRoot, "push", "-u", remote, branch], { encoding: "utf-8", timeout: 60_000 });
            if (r.status !== 0)
                return { ok: false, reason: `push(${remote}, ${branch}): ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: undefined };
        },
        pull(remote, branch) {
            const r = spawnSync("git", ["-C", repoRoot, "pull", "--rebase", remote, branch], { encoding: "utf-8", timeout: 60_000 });
            if (r.status !== 0)
                return { ok: false, reason: `pull(${remote}, ${branch}): ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: undefined };
        },
        // ─── History operations ──────────────────────────────────────────
        readFileAt(path, ref) {
            const r = spawnSync("git", ["-C", repoRoot, "show", `${ref}:${path}`], { encoding: "utf-8", timeout: 30_000 });
            if (r.status !== 0)
                return { ok: false, reason: `readFileAt(${path}@${ref}): ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: r.stdout ?? "" };
        },
        history(path, maxCount) {
            const args = ["log", `--max-count=${maxCount ?? 20}`, "--format=%H|%s|%an|%aI"];
            if (path)
                args.push("--", path);
            const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf-8", timeout: 30_000 });
            if (r.status !== 0)
                return { ok: false, reason: `history: ${(r.stderr ?? "").trim()}` };
            const entries = (r.stdout ?? "").trim().split("\n").filter(Boolean).map(line => {
                const [hash = "", message = "", author = "", date = ""] = line.split("|");
                return { hash, message, author, date };
            });
            return { ok: true, value: entries };
        },
        blame(path) {
            const r = spawnSync("git", ["-C", repoRoot, "blame", "--porcelain", path], { encoding: "utf-8", timeout: 30_000 });
            if (r.status !== 0)
                return { ok: false, reason: `blame(${path}): ${(r.stderr ?? "").trim()}` };
            // Simplified porcelain parse — extract hash + author + content per line
            const lines = (r.stdout ?? "").split("\n");
            const entries = [];
            let lineNum = 0;
            let currentHash = "";
            let currentAuthor = "";
            let currentDate = "";
            for (const line of lines) {
                if (/^[0-9a-f]{40}/.test(line)) {
                    currentHash = line.slice(0, 40);
                    lineNum++;
                }
                else if (line.startsWith("author ")) {
                    currentAuthor = line.slice(7);
                }
                else if (line.startsWith("author-time ")) {
                    currentDate = line.slice(12);
                }
                else if (line.startsWith("\t")) {
                    entries.push({ line: lineNum, hash: currentHash, author: currentAuthor, date: currentDate, content: line.slice(1) });
                }
            }
            return { ok: true, value: entries };
        },
        diff(from, to) {
            const args = ["diff"];
            if (from)
                args.push(from);
            if (to)
                args.push(to);
            const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf-8", timeout: 30_000 });
            if (r.status !== 0)
                return { ok: false, reason: `diff: ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: r.stdout ?? "" };
        },
        mergeBase(branchA, branchB) {
            const r = spawnSync("git", ["-C", repoRoot, "merge-base", branchA, branchB], { encoding: "utf-8", timeout: 10_000 });
            if (r.status !== 0)
                return { ok: false, reason: `mergeBase(${branchA}, ${branchB}): ${(r.stderr ?? "").trim()}` };
            return { ok: true, value: { hash: (r.stdout ?? "").trim() } };
        },
        exec(command, args) {
            try {
                const result = spawnSync(command, args, {
                    cwd: repoRoot,
                    encoding: "utf-8",
                    timeout: 60_000,
                });
                return { ok: true, value: { stdout: (result.stdout ?? "").trim(), exitCode: result.status ?? -1 } };
            }
            catch (err) {
                return { ok: false, reason: `exec(${command}): ${err.message}` };
            }
        },
    };
}
export function emptySimulatedState(platform = "darwin") {
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
export function simulatedWorkspacePort(state) {
    return {
        platform: state.platform,
        backend: "simulated",
        readFile(path) {
            const entry = state.files.get(path);
            if (entry === undefined) {
                return { ok: false, reason: `readFile(${path}): ENOENT` };
            }
            if (entry.binary) {
                return { ok: false, reason: `readFile(${path}): file is binary, use readBinary()` };
            }
            return { ok: true, value: entry.content };
        },
        readBinary(path) {
            const entry = state.files.get(path);
            if (entry === undefined) {
                return { ok: false, reason: `readBinary(${path}): ENOENT` };
            }
            if (!entry.binary) {
                // Text → bytes (encode UTF-8)
                return { ok: true, value: new TextEncoder().encode(entry.content) };
            }
            return { ok: true, value: entry.content };
        },
        readFileEntry(path) {
            const entry = state.files.get(path);
            if (entry === undefined) {
                return { ok: false, reason: `readFileEntry(${path}): ENOENT` };
            }
            return { ok: true, value: entry };
        },
        writeFile(path, content, permissions) {
            state.files.set(path, {
                path,
                content,
                permissions: permissions ?? DEFAULT_PERMISSIONS,
                binary: false,
            });
            return { ok: true, value: undefined };
        },
        writeBinary(path, content, permissions) {
            state.files.set(path, {
                path,
                content,
                permissions: permissions ?? DEFAULT_PERMISSIONS,
                binary: true,
            });
            return { ok: true, value: undefined };
        },
        setPermissions(path, permissions) {
            const entry = state.files.get(path);
            if (!entry) {
                return { ok: false, reason: `setPermissions(${path}): ENOENT` };
            }
            state.files.set(path, { ...entry, permissions });
            return { ok: true, value: undefined };
        },
        exists(path) {
            return state.files.has(path);
        },
        readDir(path) {
            const prefix = path.endsWith("/") ? path : `${path}/`;
            const entries = new Set();
            for (const key of state.files.keys()) {
                if (key.startsWith(prefix)) {
                    const rest = key.slice(prefix.length);
                    const firstSegment = rest.split("/")[0];
                    if (firstSegment)
                        entries.add(firstSegment);
                }
            }
            return { ok: true, value: [...entries].sort() };
        },
        git(args) {
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
        link(existingPath, newPath) {
            const entry = state.files.get(existingPath);
            if (entry === undefined) {
                return { ok: false, reason: `link(${existingPath} → ${newPath}): source ENOENT` };
            }
            state.files.set(newPath, { ...entry, path: newPath });
            return { ok: true, value: undefined };
        },
        // ─── Version control primitives (simulated — in-memory log) ──────
        currentBranch() {
            return { ok: true, value: state.branch };
        },
        branch(name, _from) {
            state.branch = name;
            return { ok: true, value: undefined };
        },
        stage(_paths) {
            return { ok: true, value: undefined };
        },
        commit(message, _paths) {
            const hash = `sim-${String(state.commits.length + 1).padStart(6, "0")}`;
            const changedFiles = [...state.files.keys()].slice(0, 5);
            state.commits.push({ message, files: changedFiles });
            return { ok: true, value: { hash } };
        },
        push(_remote, branch) {
            state.pushed.add(branch);
            return { ok: true, value: undefined };
        },
        pull(_remote, _branch) {
            return { ok: true, value: undefined };
        },
        // ─── History (simulated from in-memory log) ──────────────────────
        readFileAt(path, _ref) {
            // In simulation, all refs see the same content (no real history)
            const entry = state.files.get(path);
            if (entry === undefined)
                return { ok: false, reason: `readFileAt(${path}): ENOENT` };
            if (entry.binary)
                return { ok: false, reason: `readFileAt(${path}): file is binary` };
            return { ok: true, value: entry.content };
        },
        history(_path, maxCount) {
            const n = maxCount ?? 20;
            const entries = state.commits.slice(-n).reverse().map((c, i) => ({
                hash: `sim-${String(state.commits.length - i).padStart(6, "0")}`,
                message: c.message,
                author: "simulated",
                date: new Date().toISOString(),
            }));
            return { ok: true, value: entries };
        },
        blame(path) {
            const entry = state.files.get(path);
            if (entry === undefined)
                return { ok: false, reason: `blame(${path}): ENOENT` };
            if (entry.binary)
                return { ok: false, reason: `blame(${path}): file is binary` };
            const lines = entry.content.split("\n");
            const entries = lines.map((line, i) => ({
                line: i + 1,
                hash: "sim-000001",
                author: "simulated",
                date: new Date().toISOString(),
                content: line,
            }));
            return { ok: true, value: entries };
        },
        diff(_from, _to) {
            return { ok: true, value: "" }; // no diff in simulation
        },
        mergeBase(_branchA, _branchB) {
            // In simulation, all branches share the same linear history.
            // The merge base is the earliest commit.
            const hash = state.commits.length > 0 ? `sim-000001` : "sim-root";
            return { ok: true, value: { hash } };
        },
        exec(command, args) {
            // Simulate common commands
            if (command === "bun" && args[0] === "test") {
                return { ok: true, value: { stdout: "0 fail\n1 pass", exitCode: 0 } };
            }
            return { ok: true, value: { stdout: "simulated", exitCode: 0 } };
        },
    };
}
