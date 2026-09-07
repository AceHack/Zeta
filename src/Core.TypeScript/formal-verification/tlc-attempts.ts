// TLC diagnostic ownership and retry policy. No JVM/model policy lives here.
import {
  closeSync, constants, copyFileSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync,
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
  readonly inputs: readonly (FileIdentity & { readonly CopiedSha256: string })[];
}

export interface FileIdentity {
  readonly File: string;
  readonly Bytes: number;
  readonly Sha256: string;
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

/** Only admitted source basenames are copied. Generated trace files and symlinks
 * are refused rather than promoted into a model's source universe. */
export function prepareAttempt(
  diagnosticsRoot: string,
  model: string,
  attempt: number,
  specsPath: string,
  sourceInventory: readonly string[] | (() => readonly string[]),
): DiagnosticResult<AttemptDirectory> {
  let directory = "";
  const inputs: (FileIdentity & { readonly CopiedSha256: string })[] = [];
  try {
    mkdirSync(diagnosticsRoot, { recursive: true });
    directory = mkdtempSync(join(diagnosticsRoot, model.replace(/[^a-zA-Z0-9_-]/g, "_") + "-"));
    writeFileSync(join(directory, "attempt.json"), JSON.stringify({ Stage: "preparation", Model: model, Attempt: attempt }) + "\n", { flag: "wx" });
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
      if (!lstatSync(path).isFile()) throw new Error("source input is not a regular file: " + name);
      copyFileSync(path, join(workspace, name), constants.COPYFILE_EXCL);
      const original = identifyFile(path, name);
      const copied = identifyFile(join(workspace, name), name);
      if (original.Sha256 !== copied.Sha256) throw new Error("source changed while copied: " + name);
      inputs.push({ ...original, CopiedSha256: copied.Sha256 });
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
