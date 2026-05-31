// no-python-files.test.ts — unit tests for the Phase 6 (B-0156)
// .py policy lint. We exercise main() against synthetic trees in a
// temporary directory so the test is independent of repo state.

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { main } from "./no-python-files";

function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "no-python-files-"));
  spawnSync("git", ["init", "-q", root], { encoding: "utf8" });
  return root;
}

function writeAllowlist(root: string, body: string): void {
  mkdirSync(join(root, "tools", "lint"), { recursive: true });
  writeFileSync(join(root, "tools", "lint", "no-python-files.allowlist"), body);
}

function captureStdout<T>(fn: () => T): { result: T; stdout: string; stderr: string } {
  const realOut = process.stdout.write.bind(process.stdout);
  const realErr = process.stderr.write.bind(process.stderr);
  let stdout = "";
  let stderr = "";
  process.stdout.write = ((s: string | Uint8Array) => {
    stdout += typeof s === "string" ? s : new TextDecoder().decode(s);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((s: string | Uint8Array) => {
    stderr += typeof s === "string" ? s : new TextDecoder().decode(s);
    return true;
  }) as typeof process.stderr.write;
  try {
    const result = fn();
    return { result, stdout, stderr };
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
  }
}

describe("no-python-files", () => {
  let originalCwd: string;
  let repoRoot: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    repoRoot = makeRepo();
    process.chdir(repoRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(repoRoot, { recursive: true, force: true });
  });

  test("returns 2 when allowlist is missing", () => {
    const { result } = captureStdout(() => main([]));
    expect(result).toBe(2);
  });

  test("returns 0 when no .py files exist", () => {
    writeAllowlist(repoRoot, "");
    writeFileSync(join(repoRoot, "hello.ts"), "// ts\n");
    const { result, stdout } = captureStdout(() => main([]));
    expect(result).toBe(0);
    expect(stdout).toContain("OK");
  });

  test("returns 1 when a flagged .py file exists", () => {
    writeAllowlist(repoRoot, "");
    writeFileSync(join(repoRoot, "rogue.py"), "print('hi')\n");
    const { result, stderr } = captureStdout(() => main([]));
    expect(result).toBe(1);
    expect(stderr).toContain("rogue.py");
    expect(stderr).toContain("FAIL");
  });

  test("returns 0 when the only .py file is allowlisted", () => {
    writeAllowlist(repoRoot, "tools/setup/common/legacy.py\n");
    mkdirSync(join(repoRoot, "tools", "setup", "common"), { recursive: true });
    writeFileSync(
      join(repoRoot, "tools", "setup", "common", "legacy.py"),
      "print('hi')\n",
    );
    const { result, stdout } = captureStdout(() => main([]));
    expect(result).toBe(0);
    expect(stdout).toContain("1 allowlisted");
  });

  test("ignores .py files under references/prior-art (hard-excluded prefix)", () => {
    writeAllowlist(repoRoot, "");
    mkdirSync(join(repoRoot, "references", "prior-art", "project"), {
      recursive: true,
    });
    writeFileSync(
      join(repoRoot, "references", "prior-art", "project", "main.py"),
      "x = 1\n",
    );
    const { result } = captureStdout(() => main([]));
    expect(result).toBe(0);
  });

  test("ignores .py files under .venv (hard-excluded segment)", () => {
    writeAllowlist(repoRoot, "");
    mkdirSync(join(repoRoot, ".venv", "lib"), { recursive: true });
    writeFileSync(join(repoRoot, ".venv", "lib", "thing.py"), "x = 1\n");
    const { result } = captureStdout(() => main([]));
    expect(result).toBe(0);
  });

  test("ignores .py files under __pycache__ (hard-excluded segment)", () => {
    writeAllowlist(repoRoot, "");
    mkdirSync(join(repoRoot, "src", "__pycache__"), { recursive: true });
    writeFileSync(join(repoRoot, "src", "__pycache__", "x.py"), "x = 1\n");
    const { result } = captureStdout(() => main([]));
    expect(result).toBe(0);
  });

  test("--list mode returns 0 even when files are flagged", () => {
    writeAllowlist(repoRoot, "");
    writeFileSync(join(repoRoot, "rogue.py"), "print('hi')\n");
    const { result, stdout } = captureStdout(() => main(["--list"]));
    expect(result).toBe(0);
    expect(stdout).toContain("Python files (flagged)");
    expect(stdout).toContain("rogue.py");
  });

  test("comment and blank lines in the allowlist are ignored", () => {
    writeAllowlist(
      repoRoot,
      "# leading comment\n\n  # indented comment\nrogue.py\n",
    );
    writeFileSync(join(repoRoot, "rogue.py"), "print('hi')\n");
    const { result } = captureStdout(() => main([]));
    expect(result).toBe(0);
  });
});
