#!/usr/bin/env bun
// check-bash-retirement-inventory.ts — verify the retained shell surface.
//
// The TypeScript/Bun migration is in bash-retirement mode: repo-owned scripts
// should not grow new shell-family entrypoints outside the explicit repo-wide
// retained-shell allowlist. Retained shell exists only where the script runs
// before Bun is available, bootstraps a host service environment, or belongs
// to a low-level installer surface that is still shell-native.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts
//   bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --enforce
//   bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --json

import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readSync } from "node:fs";
import { basename, join } from "node:path";

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

interface TrackedGitFile {
  readonly path: string;
  readonly executable: boolean;
}

interface AllowlistOrderViolation {
  readonly index: number;
  readonly previous: string;
  readonly current: string;
}

interface AllowlistIntegrity {
  readonly duplicateEntries: readonly string[];
  readonly orderViolations: readonly AllowlistOrderViolation[];
  readonly uncategorizedEntries: readonly string[];
  readonly staleCategoryEntries: readonly string[];
}

export type RetainedShellCategory = "git hooks" | "host-service wrappers" | "nixos installer" | "setup/bootstrap";

export interface RetainedShellCategorySummary {
  readonly category: RetainedShellCategory;
  readonly files: readonly string[];
}

export interface InventoryReport {
  readonly retained: readonly string[];
  readonly expectedRetained: readonly string[];
  readonly retainedCategories: readonly RetainedShellCategorySummary[];
  readonly allowlistIntegrity: AllowlistIntegrity;
  readonly drift: InventoryDrift;
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const SHEBANG_READ_BYTES = 512;
const SHELL_FILE_EXTENSIONS: readonly string[] = [".sh", ".bash", ".zsh", ".ksh", ".command"];
export const RETAINED_SHELL_SCOPE = "repo-wide setup/bootstrap/service-wrapper/lint-wrapper/installer allowlist";
export const TRACKED_SHELL_FILE_GLOBS: readonly string[] = SHELL_FILE_EXTENSIONS.map((extension) => `*${extension}`);
const SHELL_INTERPRETERS = new Set(["bash", "dash", "sh", "zsh", "ksh"]);
const ENV_OPTIONS_WITH_SEPARATE_OPERAND = new Set(["-a", "-P", "-u", "--argv0", "--chdir", "--path", "--unset"]);
const ENV_OPTIONS_WITH_INLINE_OPERAND: readonly string[] = ["--argv0=", "--chdir=", "--path=", "--unset="];
const INACTIVE_SHELL_INVENTORY_PREFIXES: readonly string[] = ["db/", "docs/recovered-orphan-branches-"];

export const EXPECTED_RETAINED_SHELL: readonly string[] = [
  ".gemini/service/install-lior-service.sh",
  ".gemini/service/lior-loop.sh",
  "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
  "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
  "githooks/pre-push",
  "scripts/hooks/commit-msg",
  "scripts/hooks/install-git-hooks.sh",
  "scripts/hooks/pre-push",
  "tools/installer/zeta-self-register.sh",
  "tools/setup/common/agda-cubical.sh",
  "tools/setup/common/curl-fetch.sh",
  "tools/setup/common/fd-limits.sh",
  "tools/setup/common/host-tier.sh",
  "tools/setup/common/install-rust-wasm32.sh",
  "tools/setup/common/install-zig.sh",
  "tools/setup/common/mise.sh",
  "tools/setup/common/profile-edit.sh",
  "tools/setup/common/shellenv.sh",
  "tools/setup/common/smoke-10-toolchains.sh",
  "tools/setup/common/smoke-13-toolchains.sh",
  "tools/setup/common/smoke-7-toolchains.sh",
  "tools/setup/common/tlaps.sh",
  "tools/setup/doctor.sh",
  "tools/setup/host-loop-bootstrap.sh",
  "tools/setup/hsm/dkek-ceremony-preflight.sh",
  "tools/setup/install.sh",
  "tools/setup/linux.sh",
  "tools/setup/macos.sh",
  "tools/setup/persona-keys/keyring.sh",
  "tools/setup/secret-clip.sh",
];

export const RETAINED_BASH_SCOPE = RETAINED_SHELL_SCOPE;
export const EXPECTED_RETAINED_BASH = EXPECTED_RETAINED_SHELL;

const RETAINED_SHELL_CATEGORY_ORDER: readonly RetainedShellCategory[] = [
  "setup/bootstrap",
  "git hooks",
  "host-service wrappers",
  "nixos installer",
];

export const RETAINED_SHELL_CATEGORY_BY_FILE: Readonly<Record<string, RetainedShellCategory>> = {
  ".gemini/service/install-lior-service.sh": "host-service wrappers",
  ".gemini/service/lior-loop.sh": "host-service wrappers",
  "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh": "nixos installer",
  "full-ai-cluster/usb-nixos-installer/zeta-install.sh": "nixos installer",
  // 081KWN0JKJV retained Git-hook shell edge: installs/refuses commit-message
  // wrapper leaks before TypeScript can own the Git hook invocation boundary.
  "githooks/pre-push": "git hooks",
  "scripts/hooks/commit-msg": "git hooks",
  "scripts/hooks/install-git-hooks.sh": "git hooks",
  // 081KZHGP46G uncompensatable floor on the sovereign lane (Lior's
  // ratification note): pre-push is a Git hook invocation boundary —
  // same retained-shell edge as commit-msg.
  "scripts/hooks/pre-push": "git hooks",
  // 081KSKBP80008QG0R000GPC0TB.2 post-boot self-registration: a first-boot systemd oneshot (invoked
  // by nixos/modules/zeta-self-register.nix) that probes /proc + runs gh/git at
  // the OS boot edge — retained shell "where the script runs at the OS edge".
  "tools/installer/zeta-self-register.sh": "nixos installer",
  // Cubical Agda proof lane (081KX1VE4G808QG0R003DCK3GV): pinned agda/cubical
  // clone + Agda user-library registration + verify typecheck. Same low-level
  // installer surface as tlaps.sh (invoked via the from-agda-cubical realizer).
  "tools/setup/common/agda-cubical.sh": "setup/bootstrap",
  "tools/setup/common/curl-fetch.sh": "setup/bootstrap",
  // NOTE (081M05X126V087G0R0014GR9KQ): `ensure-rust-components.sh` was allowlisted
  // here by #10991 as INTERIM scaffolding to unbreak a red main, never as an end
  // state. It is gone — rustfmt/clippy/wasm32 are declared on the rust entry in
  // `.mise.toml`, so the retirement discipline REMOVED a shell file instead of
  // permanently allowlisting one. Do not re-add the entry without re-adding a script.
  "tools/setup/common/fd-limits.sh": "setup/bootstrap",
  "tools/setup/common/host-tier.sh": "setup/bootstrap",
  "tools/setup/common/install-rust-wasm32.sh": "setup/bootstrap",
  "tools/setup/common/install-zig.sh": "setup/bootstrap",
  "tools/setup/common/mise.sh": "setup/bootstrap",
  "tools/setup/common/profile-edit.sh": "setup/bootstrap",
  "tools/setup/common/shellenv.sh": "setup/bootstrap",
  "tools/setup/common/smoke-10-toolchains.sh": "setup/bootstrap",
  "tools/setup/common/smoke-13-toolchains.sh": "setup/bootstrap",
  "tools/setup/common/smoke-7-toolchains.sh": "setup/bootstrap",
  "tools/setup/common/tlaps.sh": "setup/bootstrap",
  "tools/setup/doctor.sh": "setup/bootstrap",
  "tools/setup/host-loop-bootstrap.sh": "setup/bootstrap",
  // 081M0KCWPGV dual-HSM custody ceremony: a PREFLIGHT that must run before any
  // PKCS#11 tooling exists on the host -- it checks whether the ceremony can
  // safely proceed, so it cannot depend on the toolchain it is gating.
  "tools/setup/hsm/dkek-ceremony-preflight.sh": "setup/bootstrap",
  "tools/setup/install.sh": "setup/bootstrap",
  "tools/setup/linux.sh": "setup/bootstrap",
  "tools/setup/macos.sh": "setup/bootstrap",
  // Secret-edge scripts (Aaron 2026-06-21): capture a secret via masked TTY / secure dialog /
  // clipboard and write it to the OS keystore (Keychain). Retained shell at the security edge
  // (same rationale as keyring.sh) — secure input + `security`/`osascript` are OS-edge ops.
  //
  // NOTE (op-token-setup): that rationale did NOT survive being tested. `osascript` and
  // `security` are SPAWNED processes, not shell builtins, so nothing about the edge required a
  // shell — unlike `keyring.sh`, whose `read -s` and shred-on-exit trap are genuinely in-process
  // shell. The retention was habit wearing a security argument, and it was costing the property
  // it claimed to protect: the shell put the token on `security(1)`'s argv
  // (`docs/SHELL-DEPRECATION-SEQUENCE.md`, `argv-secret@83`). `tools/setup/op-token-setup.ts`
  // replaces it and the value now crosses on stdin. `secret-clip.sh` still carries the same argv
  // leak at line 93 and is NOT yet converted — it stays allowlisted, honestly, until it is.
  "tools/setup/secret-clip.sh": "setup/bootstrap",
  // keyring.sh is the intentionally-retained thin security EDGE: in-process seed
  // handling (`read -s`, umask-077, shred-on-exit) that must stay in shell; the
  // typed operational logic lives in keyset.ts ("bash only calls the edge").
  "tools/setup/persona-keys/keyring.sh": "setup/bootstrap",
};

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

/**
 * The repository root, from `git` rather than from a relative path guess.
 * Exported so sibling tools (e.g. `measure-shell-key-exposure.ts`) resolve the
 * allowlist's repo-relative paths against the same root this file uses.
 */
export function repoRootFromGit(cwd?: string): string {
  return runGit(["rev-parse", "--show-toplevel"], cwd).trim();
}

export function trackedNonLeanShellFilesFromGit(cwd?: string): readonly string[] {
  const repoRoot = repoRootFromGit(cwd);
  return trackedGitFiles(repoRoot)
    .filter(({ path }) => existsSync(join(repoRoot, path)))
    .filter(({ path }) => !isInactiveShellInventoryPath(path))
    .filter(({ path }) => !path.startsWith("tools/lean4/"))
    .filter(({ path, executable }) => isTrackedShellFamilyFile(repoRoot, path, executable))
    .map(({ path }) => path)
    .sort((a, b) => a.localeCompare(b));
}

export const trackedNonLeanBashFilesFromGit = trackedNonLeanShellFilesFromGit;

function trackedGitFiles(repoRoot: string): readonly TrackedGitFile[] {
  const raw = runGit(["ls-files", "-s", "-z"], repoRoot);
  return raw
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map(parseTrackedGitFile)
    .filter((entry): entry is TrackedGitFile => entry !== undefined);
}

function isInactiveShellInventoryPath(path: string): boolean {
  return INACTIVE_SHELL_INVENTORY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function parseTrackedGitFile(entry: string): TrackedGitFile | undefined {
  const pathStart = entry.indexOf("\t");
  if (pathStart === -1) return undefined;

  const [mode] = entry.slice(0, pathStart).split(/\s+/, 1);
  if (mode === undefined) return undefined;

  return {
    path: entry.slice(pathStart + 1),
    executable: mode === "100755",
  };
}

function isTrackedShellFamilyFile(repoRoot: string, file: string, executable: boolean): boolean {
  const lowerFile = file.toLowerCase();
  if (SHELL_FILE_EXTENSIONS.some((extension) => lowerFile.endsWith(extension))) return true;
  if (basename(file).includes(".") && !executable) return false;

  const firstLine = readFirstLine(join(repoRoot, file));
  return isShellFamilyShebang(firstLine);
}

function isShellFamilyShebang(firstLine: string): boolean {
  const interpreter = parseShebangInterpreter(firstLine);
  return interpreter !== undefined && SHELL_INTERPRETERS.has(interpreter);
}

function parseShebangInterpreter(firstLine: string): string | undefined {
  if (!firstLine.startsWith("#!")) return undefined;

  const fields = splitShebangFields(firstLine.slice(2).trim());
  const directInterpreter = fields[0];
  if (directInterpreter === undefined) return undefined;

  const directBasename = basename(directInterpreter);
  if (directBasename !== "env") return directBasename;

  const envCommand = parseEnvCommand(fields.slice(1));
  return envCommand === undefined ? undefined : basename(envCommand);
}

function parseEnvCommand(args: readonly string[]): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === "-S" || arg === "--split-string") {
      return parseEnvSplitString(args.slice(index + 1));
    }
    if (arg.startsWith("--split-string=")) {
      const splitArg = arg.slice("--split-string=".length);
      return parseEnvCommand(splitShebangFields(splitArg));
    }
    if (arg === "--") return args[index + 1];
    if (ENV_OPTIONS_WITH_SEPARATE_OPERAND.has(arg)) {
      index += 1;
      continue;
    }
    if (ENV_OPTIONS_WITH_INLINE_OPERAND.some((prefix) => arg.startsWith(prefix))) continue;
    if (arg.startsWith("-")) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg)) continue;
    return arg;
  }
  return undefined;
}

function parseEnvSplitString(args: readonly string[]): string | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 1) return parseEnvCommand(splitShebangFields(args[0] ?? ""));
  return parseEnvCommand(args);
}

function splitShebangFields(input: string): readonly string[] {
  const fields: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        fields.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (escaped) current += "\\";
  if (current.length > 0) fields.push(current);
  return fields;
}

function readFirstLine(path: string): string {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const buffer = Buffer.alloc(SHEBANG_READ_BYTES);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/, 1)[0] ?? "";
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function inspectAllowlistIntegrity(expectedRetained: readonly string[]): AllowlistIntegrity {
  const counts = new Map<string, number>();
  const expectedSet = new Set(expectedRetained);
  const orderViolations: AllowlistOrderViolation[] = [];
  const uncategorizedEntries = new Set<string>();

  for (let index = 0; index < expectedRetained.length; index += 1) {
    const current = expectedRetained[index];
    if (current === undefined) continue;
    counts.set(current, (counts.get(current) ?? 0) + 1);
    if (RETAINED_SHELL_CATEGORY_BY_FILE[current] === undefined) uncategorizedEntries.add(current);

    const previous = expectedRetained[index - 1];
    if (previous !== undefined && previous.localeCompare(current) > 0) {
      orderViolations.push({ index, previous, current });
    }
  }

  const duplicateEntries = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([file]) => file)
    .sort((a, b) => a.localeCompare(b));

  const staleCategoryEntries = Object.keys(RETAINED_SHELL_CATEGORY_BY_FILE)
    .filter((file) => !expectedSet.has(file))
    .sort((a, b) => a.localeCompare(b));

  return {
    duplicateEntries,
    orderViolations,
    uncategorizedEntries: [...uncategorizedEntries].sort((a, b) => a.localeCompare(b)),
    staleCategoryEntries,
  };
}

function hasAllowlistIntegrityDrift(integrity: AllowlistIntegrity): boolean {
  return (
    integrity.duplicateEntries.length > 0 ||
    integrity.orderViolations.length > 0 ||
    integrity.uncategorizedEntries.length > 0 ||
    integrity.staleCategoryEntries.length > 0
  );
}

function buildRetainedCategorySummary(expectedRetained: readonly string[]): readonly RetainedShellCategorySummary[] {
  const byCategory = new Map<RetainedShellCategory, string[]>();
  for (const category of RETAINED_SHELL_CATEGORY_ORDER) byCategory.set(category, []);

  for (const file of expectedRetained) {
    const category = RETAINED_SHELL_CATEGORY_BY_FILE[file];
    if (category === undefined) continue;
    byCategory.get(category)?.push(file);
  }

  return RETAINED_SHELL_CATEGORY_ORDER.map((category) => ({
    category,
    files: [...(byCategory.get(category) ?? [])].sort((a, b) => a.localeCompare(b)),
  })).filter((summary) => summary.files.length > 0);
}

export function buildInventoryReport(
  retained: readonly string[],
  expectedRetained: readonly string[] = EXPECTED_RETAINED_SHELL,
): InventoryReport {
  const allowlistIntegrity = inspectAllowlistIntegrity(expectedRetained);
  const retainedCategories = buildRetainedCategorySummary(expectedRetained);
  if (hasAllowlistIntegrityDrift(allowlistIntegrity)) {
    return {
      retained: [...retained].sort((a, b) => a.localeCompare(b)),
      expectedRetained: [...expectedRetained],
      retainedCategories,
      allowlistIntegrity,
      drift: {
        unexpected: [],
        missingRetained: [],
      },
    };
  }

  const retainedSet = new Set(retained);
  const expectedSet = new Set(expectedRetained);
  return {
    retained: [...retained].sort((a, b) => a.localeCompare(b)),
    expectedRetained: [...expectedRetained],
    retainedCategories,
    allowlistIntegrity,
    drift: {
      unexpected: retained.filter((file) => !expectedSet.has(file)).sort((a, b) => a.localeCompare(b)),
      missingRetained: expectedRetained.filter((file) => !retainedSet.has(file)).sort((a, b) => a.localeCompare(b)),
    },
  };
}

export function hasDrift(report: InventoryReport): boolean {
  return (
    hasAllowlistIntegrityDrift(report.allowlistIntegrity) ||
    report.drift.unexpected.length > 0 ||
    report.drift.missingRetained.length > 0
  );
}

export function renderReport(report: InventoryReport): string {
  const lines: string[] = [];
  lines.push("# Bash Retirement Inventory");
  lines.push("");
  lines.push(`retained_non_lean_shell: ${String(report.retained.length)}`);
  lines.push(`expected_retained: ${String(report.expectedRetained.length)}`);
  lines.push(`retained_categories: ${String(report.retainedCategories.length)}`);
  lines.push(`allowlist_duplicates: ${String(report.allowlistIntegrity.duplicateEntries.length)}`);
  lines.push(`allowlist_order_violations: ${String(report.allowlistIntegrity.orderViolations.length)}`);
  lines.push(`allowlist_uncategorized: ${String(report.allowlistIntegrity.uncategorizedEntries.length)}`);
  lines.push(`allowlist_stale_category_entries: ${String(report.allowlistIntegrity.staleCategoryEntries.length)}`);
  lines.push(`unexpected: ${String(report.drift.unexpected.length)}`);
  lines.push(`missing_retained: ${String(report.drift.missingRetained.length)}`);
  lines.push("");
  lines.push("## Retained shell categories");
  lines.push("");
  for (const summary of report.retainedCategories) {
    lines.push(`- ${summary.category}: ${String(summary.files.length)}`);
  }
  lines.push("");
  if (!hasDrift(report)) {
    lines.push(`OK: retained non-Lean shell surface matches ${RETAINED_SHELL_SCOPE}.`);
    return `${lines.join("\n")}\n`;
  }
  if (hasAllowlistIntegrityDrift(report.allowlistIntegrity)) {
    lines.push("## Retained shell allowlist integrity errors");
    lines.push("");
    lines.push(
      "The retained shell allowlist must be unique, sorted, fully categorized, and free of stale category metadata before repo shell drift is classified.",
    );
    lines.push("");
    if (report.allowlistIntegrity.duplicateEntries.length > 0) {
      lines.push("### Duplicate entries");
      lines.push("");
      for (const file of report.allowlistIntegrity.duplicateEntries) lines.push(`- ${file}`);
      lines.push("");
    }
    if (report.allowlistIntegrity.orderViolations.length > 0) {
      lines.push("### Out-of-order entries");
      lines.push("");
      for (const violation of report.allowlistIntegrity.orderViolations) {
        lines.push(`- index ${String(violation.index)}: ${violation.previous} > ${violation.current}`);
      }
      lines.push("");
    }
    if (report.allowlistIntegrity.uncategorizedEntries.length > 0) {
      lines.push("### Missing category entries");
      lines.push("");
      for (const file of report.allowlistIntegrity.uncategorizedEntries) lines.push(`- ${file}`);
      lines.push("");
    }
    if (report.allowlistIntegrity.staleCategoryEntries.length > 0) {
      lines.push("### Stale category entries");
      lines.push("");
      for (const file of report.allowlistIntegrity.staleCategoryEntries) lines.push(`- ${file}`);
      lines.push("");
    }
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
    "  bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts",
    "  bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --enforce",
    "  bun src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --json",
    "",
    `Checks that non-Lean tracked shell-family files match ${RETAINED_SHELL_SCOPE}.`,
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
