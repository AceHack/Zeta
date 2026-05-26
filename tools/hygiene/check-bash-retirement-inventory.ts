#!/usr/bin/env bun
// check-bash-retirement-inventory.ts — verify the retained shell surface.
//
// The TypeScript/Bun migration is in bash-retirement mode: repo-owned scripts
// should not grow new `.sh` entrypoints outside the explicit repo-wide
// retained-shell allowlist. Retained shell exists only where the script runs
// before Bun is available, bootstraps a host service environment, or belongs
// to a low-level installer/dev-cluster surface that is still shell-native.
//
// Usage:
//   bun tools/hygiene/check-bash-retirement-inventory.ts
//   bun tools/hygiene/check-bash-retirement-inventory.ts --enforce
//   bun tools/hygiene/check-bash-retirement-inventory.ts --json

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

type ExitCode = 0 | 1 | 2;
type Mode = "report" | "enforce" | "json";

interface ParseResult {
  readonly mode: Mode;
  readonly help: boolean;
  readonly error?: string;
}

interface InventoryDrift {
  readonly unexpected: readonly string[];
  readonly missingRetained: readonly string[];
}

export interface InventoryReport {
  readonly retained: readonly string[];
  readonly expectedRetained: readonly string[];
  readonly drift: InventoryDrift;
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
export const RETAINED_SHELL_SCOPE =
  "repo-wide setup/bootstrap/service-wrapper/installer/dev-cluster allowlist";

export const EXPECTED_RETAINED_SHELL: readonly string[] = [
  ".gemini/service/install-lior-service.sh",
  ".gemini/service/lior-loop.sh",
  "full-ai-cluster/dev-cluster/down.sh",
  "full-ai-cluster/dev-cluster/up.sh",
  "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
  "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
  "tools/kiro/kiro-loop-wrapper.sh",
  "tools/kiro/launchd/install.sh",
  "tools/setup/common/curl-fetch.sh",
  "tools/setup/common/dotnet-tools.sh",
  "tools/setup/common/elan.sh",
  "tools/setup/common/mise.sh",
  "tools/setup/common/profile-edit.sh",
  "tools/setup/common/python-tools.sh",
  "tools/setup/common/shellenv.sh",
  "tools/setup/common/sync-upstreams.sh",
  "tools/setup/common/verifiers.sh",
  "tools/setup/doctor.sh",
  "tools/setup/install.sh",
  "tools/setup/linux.sh",
  "tools/setup/macos.sh",
];

export const RETAINED_BASH_SCOPE = RETAINED_SHELL_SCOPE;
export const EXPECTED_RETAINED_BASH = EXPECTED_RETAINED_SHELL;

function parseArgs(argv: readonly string[]): ParseResult {
  let mode: Mode = "report";
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") return { mode, help: true };
    if (arg === "--enforce") {
      mode = "enforce";
      continue;
    }
    if (arg === "--json") {
      mode = "json";
      continue;
    }
    return { mode, help: false, error: `unknown arg: ${arg}` };
  }
  return { mode, help: false };
}

function runGit(args: readonly string[], cwd?: string): string {
  // git is repo-pinned via .mise.toml; args are an explicit string array.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.error) {
    throw new Error(`failed to start git ${args.join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    if (result.status === null) {
      const signal = result.signal ?? "unknown signal";
      throw new Error(stderr !== "" ? stderr : `git ${args.join(" ")} terminated by ${signal}`);
    }
    throw new Error(stderr !== "" ? stderr : `git ${args.join(" ")} exited ${String(result.status)}`);
  }
  return result.stdout;
}

export function trackedNonLeanShellFilesFromGit(): readonly string[] {
  const repoRoot = runGit(["rev-parse", "--show-toplevel"]).trim();
  const raw = runGit(["ls-files", "-z", "*.sh"], repoRoot);
  return raw
    .split("\0")
    .filter((file): file is string => file.length > 0)
    .filter((file) => existsSync(join(repoRoot, file)))
    .filter((file) => !file.startsWith("tools/lean4/"))
    .sort((a, b) => a.localeCompare(b));
}

export const trackedNonLeanBashFilesFromGit = trackedNonLeanShellFilesFromGit;

export function buildInventoryReport(
  retained: readonly string[],
  expectedRetained: readonly string[] = EXPECTED_RETAINED_SHELL,
): InventoryReport {
  const retainedSet = new Set(retained);
  const expectedSet = new Set(expectedRetained);
  return {
    retained: [...retained].sort((a, b) => a.localeCompare(b)),
    expectedRetained: [...expectedRetained].sort((a, b) => a.localeCompare(b)),
    drift: {
      unexpected: retained.filter((file) => !expectedSet.has(file)).sort((a, b) => a.localeCompare(b)),
      missingRetained: expectedRetained.filter((file) => !retainedSet.has(file)).sort((a, b) => a.localeCompare(b)),
    },
  };
}

export function hasDrift(report: InventoryReport): boolean {
  return report.drift.unexpected.length > 0 || report.drift.missingRetained.length > 0;
}

export function renderReport(report: InventoryReport): string {
  const lines: string[] = [];
  lines.push("# Bash Retirement Inventory");
  lines.push("");
  lines.push(`retained_non_lean_shell: ${String(report.retained.length)}`);
  lines.push(`expected_retained: ${String(report.expectedRetained.length)}`);
  lines.push(`unexpected: ${String(report.drift.unexpected.length)}`);
  lines.push(`missing_retained: ${String(report.drift.missingRetained.length)}`);
  lines.push("");
  if (!hasDrift(report)) {
    lines.push(`OK: retained non-Lean shell surface matches ${RETAINED_SHELL_SCOPE}.`);
    return `${lines.join("\n")}\n`;
  }
  if (report.drift.unexpected.length > 0) {
    lines.push("## Unexpected non-Lean shell files");
    lines.push("");
    for (const file of report.drift.unexpected) lines.push(`- ${file}`);
    lines.push("");
  }
  if (report.drift.missingRetained.length > 0) {
    lines.push(`## Missing retained ${RETAINED_SHELL_SCOPE} files`);
    lines.push("");
    for (const file of report.drift.missingRetained) lines.push(`- ${file}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function usage(): string {
  return [
    "Usage:",
    "  bun tools/hygiene/check-bash-retirement-inventory.ts",
    "  bun tools/hygiene/check-bash-retirement-inventory.ts --enforce",
    "  bun tools/hygiene/check-bash-retirement-inventory.ts --json",
    "",
    `Checks that non-Lean tracked .sh files match ${RETAINED_SHELL_SCOPE}.`,
  ].join("\n");
}

export function main(argv: readonly string[] = process.argv.slice(2)): ExitCode {
  const parsed = parseArgs(argv);
  if (parsed.error !== undefined) {
    process.stderr.write(`error: ${parsed.error}\n\n${usage()}\n`);
    return 2;
  }
  if (parsed.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  let report: InventoryReport;
  try {
    report = buildInventoryReport(trackedNonLeanShellFilesFromGit());
  } catch (err) {
    process.stderr.write(`ERROR: ${(err as Error).message}\n`);
    return 2;
  }

  if (parsed.mode === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return hasDrift(report) ? 1 : 0;
  }

  const rendered = renderReport(report);
  if (hasDrift(report)) {
    process.stderr.write(rendered);
    return parsed.mode === "enforce" ? 1 : 0;
  }
  process.stdout.write(rendered);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
