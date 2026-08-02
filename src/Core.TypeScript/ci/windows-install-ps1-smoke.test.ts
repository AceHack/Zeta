import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  AGENT_CLI_MANIFEST_RELATIVE_PATH,
  taskHasDurationAndNextRun,
  miseProvidesTool,
  parseAgentCliManifest,
  bunGlobalOutputContainsPackage,
  SHARED_COMMANDS,
  CONTAINER_SKIPS,
} from "./windows-install-ps1-smoke";

test("taskHasDurationAndNextRun: healthy task (Repetition Duration + populated Next Run)", () => {
  const xml = "<Repetition><Interval>PT1M</Interval><Duration>P3650D</Duration></Repetition>";
  const v = "Next Run Time:                        5/30/2026 11:00:00 AM";
  expect(taskHasDurationAndNextRun(xml, v)).toEqual({ durationPresent: true, nextRunPopulated: true });
});

test("taskHasDurationAndNextRun: degenerate repetition (no Duration) + N/A next run", () => {
  // This is exactly the broken state the conhost/repetition fixes addressed.
  const xml = "<Repetition><Interval>PT1M</Interval></Repetition>";
  const v = "Next Run Time:                        N/A";
  expect(taskHasDurationAndNextRun(xml, v)).toEqual({ durationPresent: false, nextRunPopulated: false });
});

test("miseProvidesTool: token match, no substring false-positives", () => {
  const out = "bun       1.3.0   ~/.mise.toml\ndotnet    10.0.0  ~/.mise.toml";
  expect(miseProvidesTool(out, "bun")).toBe(true);
  expect(miseProvidesTool(out, "dotnet")).toBe(true);
  expect(miseProvidesTool(out, "python")).toBe(false);
  expect(miseProvidesTool(out, "do")).toBe(false); // not a substring of "dotnet"
});

test("container mode documents its skip (loop-task) — never silent", () => {
  expect(Object.keys(CONTAINER_SKIPS)).toContain("loop-task");
  expect(CONTAINER_SKIPS["loop-task"]).toMatch(/interactive session/);
});

test("shared commands include direct Bun after the installer returns", () => {
  expect([...SHARED_COMMANDS]).toEqual(["scoop", "git", "mise", "bun"]);
});

test("Windows installer publishes mise runtime paths for later GitHub Actions steps", () => {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const installer = readFileSync(join(repoRoot, "tools", "setup", "install.ps1"), "utf8");
  expect(installer).toContain("mise bin-paths --quiet");
  expect(installer).toContain("Publish-ZetaRuntimePaths $runtimeBinPaths");
  expect(installer).toContain("$env:GITHUB_PATH");
  expect(installer).toContain("[System.IO.File]::AppendAllText");
});

test("build-and-test matrix routes each OS family through its native installer", () => {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const workflow = parse(readFileSync(join(repoRoot, ".github", "workflows", "gate.yml"), "utf8")) as {
    jobs?: Record<string, { steps?: Array<Record<string, unknown>> }>;
  };
  const steps = workflow.jobs?.["build-and-test"]?.steps ?? [];
  const unix = steps.find(
    (step) => step.name === "Install toolchain via three-way-parity script (Unix; GOVERNANCE §24)",
  );
  const windows = steps.find(
    (step) => step.name === "Install toolchain via three-way-parity script (Windows; GOVERNANCE §24)",
  );

  expect(unix).toMatchObject({
    if: "needs.path-filter.outputs.code == 'true' && startsWith(matrix.os, 'windows-') == false",
    run: "./tools/setup/install.sh",
  });
  expect(windows).toMatchObject({
    if: "needs.path-filter.outputs.code == 'true' && startsWith(matrix.os, 'windows-')",
    shell: "pwsh",
    run: "./tools/setup/install.ps1 -SkipLoopRegister",
  });
});

test("agent CLI manifest parser keeps package id plus expected binary metadata", () => {
  const entries = parseAgentCliManifest(`
    # comment
    @anthropic-ai/claude-code  bin=claude
    @openai/codex              bin=codex
  `);
  expect(entries).toEqual([
    { packageId: "@anthropic-ai/claude-code", binary: "claude" },
    { packageId: "@openai/codex", binary: "codex" },
  ]);
});

test("agent CLI smoke reads the canonical bun-global manifest", () => {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const manifest = readFileSync(join(repoRoot, ...AGENT_CLI_MANIFEST_RELATIVE_PATH), "utf8");
  expect(parseAgentCliManifest(manifest).map((entry) => entry.packageId)).toContain("@openai/codex");
});

test("bun global package detection accepts scoped id or unscoped package name", () => {
  expect(bunGlobalOutputContainsPackage("@openai/codex@1.2.3", "@openai/codex")).toBe(true);
  expect(bunGlobalOutputContainsPackage("claude-code@1.2.3", "@anthropic-ai/claude-code")).toBe(true);
  expect(bunGlobalOutputContainsPackage("other@1.2.3", "@google/gemini-cli")).toBe(false);
  expect(bunGlobalOutputContainsPackage("not-claude-code@1.2.3", "@anthropic-ai/claude-code")).toBe(false);
  expect(bunGlobalOutputContainsPackage("@openai/codex-plus@1.2.3", "@openai/codex")).toBe(false);
});

// Empirical anchor (Server-Core Docker run #3, 2026-05-30): install.ps1 had an em-dash (—) and
// died with "Missing argument in parameter list" because the container invokes it via Windows
// PowerShell 5.1 (shipped in-box on Server Core + every Win10/11), which reads a BOM-less .ps1 as
// the system ANSI codepage — NOT UTF-8. Any non-ASCII char then corrupts and the parser chokes.
// pwsh 7 (Aaron's laptop) defaults to UTF-8 so it never hit this. The Docker test catches the bug
// slowly (~15-min build); this assertion catches it fast in the `bun test` lane. Keep the .ps1
// entrypoints ASCII-clean (decorative em-dashes -> '--') so they run on 5.1 AND 7, BOM or no BOM.
// Per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md: this asserts the positive.
test("Windows .ps1 entrypoints are ASCII-only (PS 5.1 reads BOM-less .ps1 as ANSI, not UTF-8)", () => {
  const repoRoot = join(import.meta.dir, "..", "..", "..");
  const files = [join(repoRoot, "tools", "setup", "install.ps1")];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    const offenders = [...text]
      .map((ch, i) => ({ ch, i, code: ch.charCodeAt(0) }))
      .filter((c) => c.code > 0x7f)
      .map((c) => `${f}@char${c.i}: U+${c.code.toString(16).toUpperCase().padStart(4, "0")} '${c.ch}'`);
    expect(offenders).toEqual([]);
  }
});
