// Synthetic process-boundary witnesses only: never launch a real JVM here.
import { describe, expect, test } from "bun:test";
import { closeSync, constants, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  captureProcess, copyRegularSourceDescriptor, finishAttempt, inventory, prepareAttempt,
  runWithStartupRetry, sourceInputs, sourceOpenPolicy, writeDiagnostic,
} from "./tlc-attempts";
import { buildTlcArgv, judgeTlcRun, loadTlcRegistry } from "./tlc-invocation";

const root = join(import.meta.dir, "../../..");
const registry = loadTlcRegistry(root);
const retryCases = JSON.parse(readFileSync(join(root, "registry/tlc-retry-fixtures.json"), "utf8")) as {
  Cases: { Name: string; Stdout: string; Stderr: string; Retryable: boolean; ExitCode: number; Signal: string | null; ProcessError: boolean }[];
};

describe("TLC startup retry parity", () => {
  for (const row of retryCases.Cases) {
    test(row.Name, () => {
      const outcome = { ok: false, stdout: row.Stdout, stderr: row.Stderr, exitCode: row.ExitCode, signal: row.Signal, processError: row.ProcessError };
      const rows = runWithStartupRetry(() => outcome, () => {});
      expect(rows.length).toBe(row.Retryable ? 3 : 1);
    });
  }
  test("a successful recovery retains the earlier failed result", () => {
    const failure = { ok: false, exitCode: 1, signal: null, processError: false, stdout: "Could not reserve enough space for object heap", stderr: "" };
    const success = { ok: true, exitCode: 0, signal: null, processError: false, stdout: "TLC2\nModel checking completed.", stderr: "" };
    const settled: number[] = [];
    const rows = runWithStartupRetry((n) => n === 1 ? failure : success, (n) => settled.push(n));
    expect(rows).toEqual([failure, success]);
    expect(settled).toEqual([1]);
  });
  test("persistent startup failure stops at three; fatal completion stops at one", () => {
    const initial = { ok: false, exitCode: 1, signal: null, processError: false, stdout: "Error occurred during initialization of VM", stderr: "" };
    expect(runWithStartupRetry(() => initial, () => {}).length).toBe(3);
    const fatal = { ok: false, exitCode: 1, signal: null, processError: false, stdout: "Model checking completed. No error has been found.", stderr: "SIGBUS" };
    expect(runWithStartupRetry(() => fatal, () => { throw new Error("fatal result must not settle/retry"); })).toEqual([fatal]);
    expect(judgeTlcRun({ id: "X", module: "X", config: "X.cfg", expect: "valid", exitCode: 0, tier: "gate", deadlock: "on" }, 134, fatal.stdout).ok).toBe(false);
  });
});

describe("TLC owned diagnostic directories", () => {
  test("source copying uses the admitted descriptor after pathname replacement", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tlc-descriptor-fixture-"));
    const source = join(scratch, "Fixture.tla");
    const copied = join(scratch, "copy.tla");
    const original = "original opened descriptor bytes";
    let descriptor = -1;
    try {
      writeFileSync(source, original);
      descriptor = openSync(source, sourceOpenPolicy().Flags);
      renameSync(source, join(scratch, "moved.tla"));
      writeFileSync(source, "replacement pathname bytes");
      const identity = copyRegularSourceDescriptor(descriptor, copied, "Fixture.tla");
      expect(readFileSync(copied, "utf8")).toBe(original);
      expect(readFileSync(source, "utf8")).toBe("replacement pathname bytes");
      expect(identity.Sha256).toBe(createHash("sha256").update(original).digest("hex").toUpperCase());
      expect(identity.CopiedSha256).toBe(identity.Sha256);
      expect(() => copyRegularSourceDescriptor(descriptor, copied, "Fixture.tla")).toThrow();
      expect(readFileSync(copied, "utf8")).toBe(original);
    } finally {
      if (descriptor >= 0) closeSync(descriptor);
      rmSync(scratch, { recursive: true });
    }
  });
  test("source flags retain optional platform support and refuse static symlinks/directories", () => {
    expect(sourceOpenPolicy({})).toEqual({ Flags: constants.O_RDONLY, NoFollowAvailable: false, NonBlockingAvailable: false });
    const scratch = mkdtempSync(join(tmpdir(), "tlc-source-kind-fixture-"));
    try {
      writeFileSync(join(scratch, "Target.tla"), "target bytes");
      symlinkSync("Target.tla", join(scratch, "Link.tla"));
      mkdirSync(join(scratch, "Directory.tla"));
      for (const name of ["Link.tla", "Directory.tla"]) {
        const refused = prepareAttempt(join(scratch, "diagnostics"), "Fixture", 1, scratch, [name]);
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(readFileSync(join(refused.directory, "preparation-failure.json"), "utf8")).toContain("preparation");
      }
      const admitted = prepareAttempt(join(scratch, "diagnostics"), "Fixture", 1, scratch, ["Target.tla"]);
      if (!admitted.ok) throw new Error(admitted.error);
      expect(admitted.value.inputs[0]!.OpenPolicy).toEqual(sourceOpenPolicy());
    } finally { rmSync(scratch, { recursive: true }); }
  });
  test("the actual collector includes unstaged/new helper bytes and refuses ignored helpers", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tlc-source-fixture-"));
    const specs = join(scratch, "src/Core.TLA/specs");
    try {
      mkdirSync(specs, { recursive: true });
      expect(spawnSync("git", ["init", "--quiet"], { cwd: scratch }).status).toBe(0);
      writeFileSync(join(specs, "Fixture.tla"), "tracked original");
      writeFileSync(join(specs, "Fixture.cfg"), "tracked config");
      expect(spawnSync("git", ["add", "src"], { cwd: scratch }).status).toBe(0);
      writeFileSync(join(specs, "Fixture.tla"), "unstaged changed bytes");
      writeFileSync(join(specs, "New.tla"), "---- MODULE New ----\nEXTENDS Helper\n====");
      writeFileSync(join(specs, "Helper.tla"), "new untracked helper");
      writeFileSync(join(specs, "New.cfg"), "new untracked selected config");
      writeFileSync(join(specs, "Fixture_TTrace_old.tla"), "foreign generated trace");
      const sources = sourceInputs(scratch, specs, ["New.tla", "New.cfg"]);
      expect([...sources].sort()).toEqual(["Fixture.cfg", "Fixture.tla", "Helper.tla", "New.cfg", "New.tla"]);
      const admitted = prepareAttempt(join(scratch, "diagnostics"), "New", 1, specs, () => sourceInputs(scratch, specs, ["New.tla", "New.cfg"]));
      if (!admitted.ok) throw new Error(admitted.error);
      expect(readFileSync(join(admitted.value.workspace, "Fixture.tla"), "utf8")).toBe("unstaged changed bytes");
      expect(readFileSync(join(admitted.value.workspace, "Helper.tla"), "utf8")).toBe("new untracked helper");
      writeFileSync(join(scratch, ".gitignore"), "Ignored.tla\n");
      writeFileSync(join(specs, "Ignored.tla"), "must not silently omit this helper");
      expect(() => sourceInputs(scratch, specs, ["New.tla", "New.cfg"])).toThrow("ignored local source input would be omitted: Ignored.tla");
    } finally { rmSync(scratch, { recursive: true }); }
  });
  test("owned process capture retains streams and refuses missing executables/timeouts", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tlc-process-fixture-"));
    try {
      const out = join(scratch, "stdout.log");
      const err = join(scratch, "stderr.log");
      const result = captureProcess(process.execPath, ["-e", "console.log('output sentinel');console.error('error sentinel')"], scratch, out, err, 3000);
      expect(result.status).toBe(0);
      expect(readFileSync(out, "utf8")).toContain("output sentinel");
      expect(readFileSync(err, "utf8")).toContain("error sentinel");
      const missing = captureProcess(join(scratch, "missing-executable"), [], scratch, join(scratch, "missing-out"), join(scratch, "missing-err"), 100);
      expect(missing.error).toBeDefined();
      expect(missing.status).toBeNull();
      // The child has no wake-up timer; only the capture watchdog can end it.
      const timed = captureProcess(process.execPath, ["-e", "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0)"], scratch, join(scratch, "timed-out"), join(scratch, "timed-err"), 40, "SIGKILL");
      expect((timed.error as NodeJS.ErrnoException | undefined)?.code).toBe("ETIMEDOUT");
      expect(runWithStartupRetry(() => ({ ok: false, exitCode: timed.status ?? -1, signal: timed.signal, processError: timed.error !== undefined, stdout: "Error occurred during initialization of VM", stderr: "" }), () => {}).length).toBe(1);
      const partial = join(scratch, "partial-open");
      expect(() => captureProcess(process.execPath, [], scratch, partial, err, 100)).toThrow();
      expect(readFileSync(partial).length).toBe(0);
      expect(readFileSync(err, "utf8")).toContain("error sentinel");
    } finally { rmSync(scratch, { recursive: true }); }
  });
  test("retains full failure bytes and helper inputs while cleaning only a later expected attempt", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tlc-retention-fixture-"));
    try {
      writeFileSync(join(scratch, "Fixture.tla"), "---- MODULE Fixture ----\nEXTENDS Helper\n====\n");
      writeFileSync(join(scratch, "Helper.tla"), "---- MODULE Helper ----\nVALUE == 1\n====\n");
      writeFileSync(join(scratch, "Fixture.cfg"), "SPECIFICATION Spec\n");
      writeFileSync(join(scratch, "Fixture_TTrace_foreign.tla"), "preexisting trace");
      const sources = ["Fixture.tla", "Helper.tla", "Fixture.cfg"];
      const first = prepareAttempt(join(scratch, "diagnostics"), "Fixture", 1, scratch, sources);
      const second = prepareAttempt(join(scratch, "diagnostics"), "Fixture", 2, scratch, sources);
      if (!first.ok || !second.ok) throw new Error("fixture preparation refused");
      expect(first.value.directory).not.toBe(second.value.directory);
      expect(first.value.errorFile).not.toBe(second.value.errorFile);
      expect(first.value.inputs).toHaveLength(3);
      expect(first.value.inputs.every((input) => input.Sha256 === input.CopiedSha256)).toBe(true);
      expect(readFileSync(join(first.value.workspace, "Helper.tla"), "utf8")).toContain("VALUE == 1");
      expect(existsSync(join(first.value.workspace, "Fixture_TTrace_foreign.tla"))).toBe(false);
      const fullLog = "first sentinel\n" + "x".repeat(65536) + "\nlast sentinel";
      writeFileSync(first.value.stdout, fullLog);
      writeFileSync(first.value.stderr, "fatal stderr");
      writeFileSync(join(first.value.directory, "hs_err_pid42.log"), "crash identity");
      writeFileSync(join(first.value.metadir, "state.bin"), new Uint8Array([1, 2, 3, 4]));
      writeDiagnostic(first.value, "completion.json", { Expected: false, StateInventory: inventory(first.value.metadir) });
      expect(() => writeDiagnostic(first.value, "completion.json", { Expected: true })).toThrow();
      finishAttempt(first.value, false);
      finishAttempt(second.value, true);
      expect(readFileSync(first.value.stdout, "utf8")).toBe(fullLog);
      expect(readFileSync(join(first.value.directory, "hs_err_pid42.log"), "utf8")).toBe("crash identity");
      expect(inventory(first.value.metadir)).toEqual({ Files: 1, Bytes: 4 });
      expect(existsSync(second.value.directory)).toBe(false);
      expect(readFileSync(join(scratch, "Fixture_TTrace_foreign.tla"), "utf8")).toBe("preexisting trace");
    } finally { rmSync(scratch, { recursive: true }); }
  });
  test("copy/inventory refusals leave explicit attempts rather than disappear", () => {
    const scratch = mkdtempSync(join(tmpdir(), "tlc-copy-fixture-"));
    try {
      for (const source of [["missing.tla"], ["../escape.tla"], ["Fixture_TTrace_old.tla"]]) {
        const result = prepareAttempt(join(scratch, "diagnostics"), "Fixture", 1, scratch, source);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(existsSync(join(result.directory, "attempt.json"))).toBe(true);
          expect(existsSync(join(result.directory, "preparation-failure.json"))).toBe(true);
        }
      }
      const result = prepareAttempt(join(scratch, "diagnostics"), "Fixture", 1, scratch, () => { throw new Error("source identity unavailable"); });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(readFileSync(join(result.directory, "preparation-failure.json"), "utf8")).toContain("source identity unavailable");
    } finally { rmSync(scratch, { recursive: true }); }
  });
  test("the explicit crash-report path changes only a diagnostic JVM argument", () => {
    const model = registry.models[0]!;
    const base = buildTlcArgv(registry, model, "jar", "states", "linux", "x64");
    const owned = buildTlcArgv(registry, model, "jar", "states", "linux", "x64", "/owned/hs_err_pid%p.log");
    const diagnostic = "-XX:ErrorFile=/owned/hs_err_pid%p.log";
    expect(owned.filter((arg) => arg !== diagnostic)).toEqual([...base]);
    expect(owned.indexOf(diagnostic)).toBeLessThan(owned.indexOf("tlc2.TLC"));
  });
});
