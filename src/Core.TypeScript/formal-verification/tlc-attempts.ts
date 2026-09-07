// TLC diagnostic ownership and retry policy. No JVM/model policy lives here.
import {
  closeSync, constants, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export interface AttemptDirectory {
  readonly directory: string;
  readonly workspace: string;
  readonly metadir: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly errorFile: string;
  readonly inputs: readonly SourceInputIdentity[];
}

export interface FileIdentity {
  readonly File: string;
  readonly Bytes: number;
  readonly Sha256: string;
}

export interface SourceOpenPolicy {
  readonly Flags: number;
  readonly NoFollowAvailable: boolean;
  readonly NonBlockingAvailable: boolean;
}

export interface SourceInputIdentity extends FileIdentity {
  readonly CopiedSha256: string;
  readonly OpenPolicy: SourceOpenPolicy;
}

/** Optional POSIX flags strengthen final-component admission. Their absence
 * keeps the stable writer-tree contract; it does not silently remove Windows. */
export function sourceOpenPolicy(available: { O_NOFOLLOW?: number; O_NONBLOCK?: number } = constants): SourceOpenPolicy {
  const noFollow = available.O_NOFOLLOW ?? 0;
  const nonBlocking = available.O_NONBLOCK ?? 0;
  return { Flags: constants.O_RDONLY | noFollow | nonBlocking,
    NoFollowAvailable: noFollow !== 0, NonBlockingAvailable: nonBlocking !== 0 };
}

/** Borrow one opened descriptor: type admission and bytes refer to that same
 * file even if its pathname is replaced. The caller owns descriptor closure. */
export function copyRegularSourceDescriptor(descriptor: number, destination: string, name: string): FileIdentity & { CopiedSha256: string } {
  if (!fstatSync(descriptor).isFile()) throw new Error("source input is not a regular file: " + name);
  const bytes = readFileSync(descriptor);
  const original = { File: name, Bytes: bytes.length, Sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase() };
  writeFileSync(destination, bytes, { flag: "wx" });
  const copied = identifyFile(destination, name);
  if (original.Sha256 !== copied.Sha256) throw new Error("captured source/copy bytes differ: " + name);
  return { ...original, CopiedSha256: copied.Sha256 };
}

export type DiagnosticResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly directory: string };

export function identifyFile(path: string, name: string = path): FileIdentity {
  const bytes = readFileSync(path);
  return { File: name, Bytes: bytes.length, Sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase() };
}

/** Both descriptors are owned even if opening the second one fails. Raw streams
 * bypass spawn's memory-buffer ceiling. Timeout applies only to this subprocess. */
export function captureProcess(
  executable: string, argv: readonly string[], cwd: string,
  stdout: string, stderr: string, timeout: number, killSignal?: NodeJS.Signals,
): SpawnSyncReturns<Buffer> {
  let output = -1;
  let errorOutput = -1;
  try {
    output = openSync(stdout, "wx");
    errorOutput = openSync(stderr, "wx");
    const result = spawnSync(executable, [...argv], {
      cwd, stdio: ["ignore", output, errorOutput], timeout,
      ...(killSignal === undefined ? {} : { killSignal }),
    });
    // Bun may omit status/signal on launch failure; receipts use explicit nulls.
    return { ...result, status: result.status ?? null, signal: result.signal ?? null };
  } finally {
    if (output >= 0) closeSync(output);
    if (errorOutput >= 0) closeSync(errorOutput);
  }
}

const generatedInput = (name: string): boolean => /_TTrace_|^MC.*\.tla$/.test(name);

/** Admit new unstaged sources too. Ignored non-generated inputs are an explicit
 * refusal, since silently omitting a local helper changes module resolution. */
export function sourceInputs(root: string, specsPath: string, required: readonly string[]): readonly string[] {
  const found = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--",
    "src/Core.TLA/specs/*.tla", "src/Core.TLA/specs/*.cfg"], { cwd: root, encoding: "utf8" });
  if (found.status !== 0) throw new Error("git source inventory refused: " + String(found.error ?? found.stderr));
  const paths = found.stdout.split("\n").filter((path) => path !== "");
  if (paths.some((path) => path !== "src/Core.TLA/specs/" + basename(path))) throw new Error("nested or quoted source path is unsupported");
  const names = paths.map((path) => basename(path)).filter((name) => !generatedInput(name));
  for (const name of required) if (!names.includes(name)) throw new Error("selected input absent from git-visible source closure: " + name);
  for (const name of readdirSync(specsPath)) {
    if (/\.(tla|cfg)$/.test(name) && !generatedInput(name) && !names.includes(name)) {
      throw new Error("ignored local source input would be omitted: " + name);
    }
  }
  return names;
}

/** Conservative startup evidence. A checker banner, progress or fatal signal
 * takes precedence even if the same output also quotes a startup marker. */
export function jvmNeverStarted(stdout: string, stderr: string = ""): boolean {
  const output = stdout + "\n" + stderr;
  const startedOrFatal = /TLC2|TLC Version|Starting\.\.\.|Computing initial|Finished computing|Progress\(|distinct states|Model checking|Invariant .*violated|TLC bug|SIG[A-Z]+|fatal error|hs_err|OutOfMemoryError/i;
  const startup = /Error occurred during initialization of VM|Could not reserve enough space for (?:\S+ )?object heap|Unable to access jarfile|Could not create the Java Virtual Machine/i;
  return !startedOrFatal.test(output) && startup.test(output);
}

export interface AttemptOutcome {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly signal: string | null;
  readonly processError: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Retain each result, including failures preceding a startup recovery. */
export function runWithStartupRetry<T extends AttemptOutcome>(
  run: (attempt: number) => T,
  settle: (attempt: number) => void,
): readonly T[] {
  const results: T[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = run(attempt);
    results.push(result);
    if (result.ok || attempt === 3 || result.exitCode !== 1 || result.signal !== null || result.processError
      || !jvmNeverStarted(result.stdout, result.stderr)) break;
    settle(attempt);
  }
  return results;
}

/** Only admitted source basenames are copied. Symlink observation assumes a
 * stable writer-owned tree on platforms without no-follow. This is not hostile
 * ancestor isolation or an atomic snapshot of concurrently modified files. */
export function prepareAttempt(
  diagnosticsRoot: string,
  model: string,
  attempt: number,
  specsPath: string,
  sourceInventory: readonly string[] | (() => readonly string[]),
): DiagnosticResult<AttemptDirectory> {
  let directory = "";
  const inputs: SourceInputIdentity[] = [];
  try {
    mkdirSync(diagnosticsRoot, { recursive: true });
    directory = mkdtempSync(join(diagnosticsRoot, model.replace(/[^a-zA-Z0-9_-]/g, "_") + "-"));
    writeFileSync(join(directory, "attempt.json"), JSON.stringify({ Stage: "preparation", Model: model, Attempt: attempt, SourceOpenPolicy: sourceOpenPolicy() }) + "\n", { flag: "wx" });
    const workspace = join(directory, "workspace");
    const metadir = join(directory, "states");
    mkdirSync(workspace);
    mkdirSync(metadir);
    const sources = typeof sourceInventory === "function" ? sourceInventory() : sourceInventory;
    if (sources.length === 0 || new Set(sources).size !== sources.length) throw new Error("source inventory must be nonempty and unique");
    for (const name of [...sources].sort()) {
      if (basename(name) !== name || !/\.(tla|cfg)$/.test(name) || /_TTrace_|^MC.*\.tla$/.test(name)) {
        throw new Error("refusing non-source input: " + name);
      }
      const path = join(specsPath, name);
      const policy = sourceOpenPolicy();
      const descriptor = openSync(path, policy.Flags);
      try {
        // Static symlink observation also covers platforms without O_NOFOLLOW.
        // It never authorizes a second source-path open: consumption uses the fd.
        if (!lstatSync(path).isFile()) throw new Error("source path is not an observed regular file: " + name);
        inputs.push({ ...copyRegularSourceDescriptor(descriptor, join(workspace, name), name), OpenPolicy: policy });
      } finally { closeSync(descriptor); }
    }
    return { ok: true, value: {
      directory, workspace, metadir, inputs,
      stdout: join(directory, "stdout.log"), stderr: join(directory, "stderr.log"),
      errorFile: join(directory, "hs_err_pid%p.log"),
    } };
  } catch (error) {
    const detail = String(error);
    if (directory !== "") {
      try { writeFileSync(join(directory, "preparation-failure.json"), JSON.stringify({ Stage: "preparation", Error: detail, CopiedInputs: inputs }) + "\n", { flag: "wx" }); }
      catch { /* The caller still reports the original path and write failure. */ }
    }
    return { ok: false, error: detail, directory };
  }
}

/** Inventory ownership, not a disk quota: unexpected state bytes are never
 * silently capped or purged. Local failed directories may be large. */
export function inventory(directory: string): { Files: number; Bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = inventory(path);
      files += child.Files;
      bytes += child.Bytes;
    } else if (entry.isFile()) {
      files++;
      bytes += statSync(path).size;
    }
  }
  return { Files: files, Bytes: bytes };
}

export function writeDiagnostic(attempt: AttemptDirectory, name: string, value: unknown): void {
  if (!/^[a-z-]+\.json$/.test(name)) throw new Error("diagnostic filename is not an owned JSON basename");
  writeFileSync(join(attempt.directory, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}

/** Called only after all semantic verdict checks, including expected violations. */
export function finishAttempt(attempt: AttemptDirectory, expected: boolean): void {
  if (expected) rmSync(attempt.directory, { recursive: true });
}
