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
import { closeSync, existsSync, openSync, readFileSync, readSync } from "node:fs";
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

/** One `curl … | sh`-shaped site: a remote fetch whose output is executed by an interpreter. */
export interface RemotePipeSite {
  readonly file: string;
  /** 1-based physical line where the logical line STARTS (a `| \` continuation keeps this honest). */
  readonly line: number;
  readonly snippet: string;
}

export interface InventoryReport {
  readonly retained: readonly string[];
  readonly expectedRetained: readonly string[];
  readonly retainedCategories: readonly RetainedShellCategorySummary[];
  readonly allowlistIntegrity: AllowlistIntegrity;
  readonly drift: InventoryDrift;
  readonly remotePipeSites: readonly RemotePipeSite[];
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
  "full-ai-cluster/nixos/modules/k3s-datastore-preflight.sh",
  "full-ai-cluster/nixos/modules/k3s-join-intent-preflight.sh",
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
  // A systemd `ExecStart` on a NixOS cluster node, ordered before k3s.service:
  // it refuses to let k3s start when a node provisioned to JOIN already holds a
  // datastore (k3s silently IGNORES every join argument in that state). The
  // retained-shell edge is the boot path itself -- the node's closure carries
  // no bun, and an ExecStart cannot wait for one. Kept as a tracked `.sh`
  // rather than an inline Nix string on purpose: an inline string would drop
  // off this inventory while still being bash, and it could not be EXECUTED by
  // `lint-k3s-datastore-preflight.test.ts`, which runs every branch of it in CI.
  "full-ai-cluster/nixos/modules/k3s-datastore-preflight.sh": "host-service wrappers",
  // The sibling's UNCOVERED case: `k3s-datastore-preflight` states its own
  // boundary ("On a genuinely from-scratch flash that is fine"), and a
  // from-scratch flash is exactly how a second machine is added. This one
  // compares the join intent on disk against what evaluation RESOLVED, so a
  // rebuild that lost `/etc/zeta` cannot come up as a silent second sovereign
  // cluster. Same retained-shell edge for the same reason: it runs on the boot
  // path, the node's closure carries no bun, and an ExecStart cannot wait for
  // one. Kept as a tracked `.sh` rather than an inline Nix string so it stays on
  // this inventory AND can be EXECUTED by
  // `lint-k3s-join-intent-preflight.test.ts`, which runs every branch in CI.
  "full-ai-cluster/nixos/modules/k3s-join-intent-preflight.sh": "host-service wrappers",
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

// ─────────────────────────────────────────────────────────────────────────────
// REMOTE FETCH PIPED INTO AN INTERPRETER  (081M24HZCYN087G0R002MT55TV)
//
// The inventory above governs WHICH shell files exist. This governs the one thing they must
// never CONTAIN, and it lives here rather than in a new entrypoint on purpose: it reuses this
// file's scope definition (tracked, non-archived, shell-family) instead of building a second
// inventory that could drift from it, and it runs inside the gate job this file already has.
//
// WHAT IT REFUSES, and why that shape and not "no network":
//
//     curl -fsSL https://example.com/install.sh | sh
//
// executes the bytes as its FIRST act. There is no committed digest, no version, and nothing
// in the repo that could notice the remote script changed — so no check performed afterwards
// would be a check at all. §13 noninterference: influence through an undeclared, unmetered
// channel. Fetching is fine; fetching-then-executing-unverified is not.
//
// THE REPLACEMENT IS NAMED IN THE REFUSAL, because a linter that only says "no" gets bypassed:
//   * a binary or installer  -> a pin file + src/Core.TypeScript/ace/install-pinned-artifact.ts
//                               (.github/ollama-pin.json, tools/setup/rustup-pin.json)
//   * a plain file           -> a row in tools/setup/manifests/from-url, sha256= mandatory
//
// WHY A LEXER AND NOT A GREP. Measured on the tree the day this was written: a naive line grep
// finds SEVEN sites, and SIX of them are prose — three comments in workflows *describing* the
// installer that was removed, an `echo "…curl … | bash"` in a human-facing error message, and
// two comments in linux.sh explaining why `curl mise.run | sh` is not used. A check that
// cannot tell a mention from a call would either be permanently red or be deleted. So comments
// and quoted strings are masked before matching, and only a command position after a `|`
// counts. The seventh was the real one:
//     tools/setup/common/install-rust-wasm32.sh:32
// which a one-line grep also misses on its own, because the `|` is followed by a backslash
// continuation and the interpreter is on the NEXT physical line. Both halves are
// regression-tested.
//
// KNOWN LIMITS, stated because an unstated blind spot reads as coverage:
//   * `eval`, a variable command name (`"$DL" | sh`), or a fetch inside a called script are
//     invisible here — the same process boundary measure-shell-key-exposure.ts stops at.
//   * `sh -c "$(curl …)"` is command substitution rather than a pipe and is NOT matched today.
//   * It reads committed TEXT, never a running machine.

const FETCH_COMMANDS: ReadonlySet<string> = new Set(["curl", "wget", "fetch", "invoke-webrequest", "iwr"]);
const PIPED_INTERPRETERS: ReadonlySet<string> = new Set([
  "sh",
  "bash",
  "zsh",
  "dash",
  "ksh",
  "python",
  "python3",
  "perl",
  "ruby",
  "node",
  "bun",
  "iex",
]);
/**
 * Words that may sit in front of the real command in a pipeline segment.
 *
 * A LEXER VOCABULARY, not an argv. Nothing here is spawned -- these are the tokens skipped
 * while looking for the command word in text read off disk, so `curl … | sudo bash` is
 * recognised as piping into bash rather than into sudo.
 */
// zeta-elevator-not-argv: parser vocabulary; these words are compared against file text, never spawned.
const COMMAND_PREFIXES: ReadonlySet<string> = new Set(["sudo", "env", "command", "exec", "nohup", "time"]);

/**
 * Blank out comments and quoted-string CONTENT, preserving length and every newline so that
 * line numbers computed afterwards are the file's real ones.
 *
 * `#` opens a comment only at a line start or after whitespace — which is both the shell rule
 * and the YAML rule, and is what keeps `$#` and `https://host/x#frag` from truncating a line.
 */
export function maskCommentsAndStrings(text: string): string {
  const out = text.split("");
  let quote: '"' | "'" | undefined;
  let inComment = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (ch === "\n") {
      inComment = false;
      // An unterminated quote must not swallow the rest of the file: a YAML block scalar is
      // full of apostrophes in prose, and one of them would otherwise mask every line after it.
      quote = undefined;
      continue;
    }
    if (inComment) {
      out[i] = " ";
      continue;
    }
    if (quote !== undefined) {
      if (ch === "\\" && quote === '"') {
        out[i] = " ";
        const next = text[i + 1];
        if (next !== undefined && next !== "\n") out[++i] = " ";
        continue;
      }
      out[i] = " ";
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out[i] = " ";
      continue;
    }
    if (ch === "#") {
      const prev = i === 0 ? "\n" : (text[i - 1] ?? "");
      if (prev === "\n" || prev === " " || prev === "\t" || prev === "\r") {
        inComment = true;
        out[i] = " ";
      }
      continue;
    }
  }
  return out.join("");
}

interface LogicalLine {
  readonly startLine: number;
  readonly text: string;
}

/**
 * Join backslash-continuations into one logical line, remembering the physical line it started
 * on. This is the half a one-line grep cannot have: the site this check was written for put
 * the pipe on line 32 and the `sh` on line 33.
 */
export function logicalLines(masked: string): readonly LogicalLine[] {
  const physical = masked.split("\n");
  const joined: LogicalLine[] = [];
  let buffer = "";
  let start = 1;
  for (let i = 0; i < physical.length; i++) {
    const raw = physical[i] ?? "";
    if (buffer === "") start = i + 1;
    const continues = raw.endsWith("\\");
    buffer += continues ? `${raw.slice(0, -1)} ` : raw;
    if (!continues) {
      joined.push({ startLine: start, text: buffer });
      buffer = "";
    }
  }
  if (buffer !== "") joined.push({ startLine: start, text: buffer });
  return joined;
}

/** The first real command word of a pipeline segment, lowercased; `sudo`/`env`/`VAR=` skipped. */
function leadingCommand(segment: string): string {
  for (const raw of segment.trim().split(/\s+/)) {
    // Surrounding punctuation is stripped so that recognition does not silently depend on the
    // masking pass having run. Without this, an unmasked `… | bash"` reads as the command
    // `bash"` and the check would report clean for the wrong reason -- a mutation of the
    // masker would then leave every prose test green, which is a falsifier that cannot fail.
    const word = raw.replace(/^[`'"(,;]+/, "").replace(/[`'"),;]+$/, "");
    if (word.length === 0) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) continue;
    const base = basename(word).toLowerCase();
    if (COMMAND_PREFIXES.has(base)) continue;
    return base;
  }
  return "";
}

/**
 * Sites where a remote fetch's output is piped into an interpreter.
 *
 * Pure: same text, same answer, no filesystem and no clock — which is what makes the fixture
 * carrying the exact pre-fix `install-rust-wasm32.sh` line a real regression test rather than
 * a snapshot of whatever the tree happens to contain.
 */
export function findRemotePipeToInterpreter(text: string): readonly { line: number; snippet: string }[] {
  const found: { line: number; snippet: string }[] = [];
  for (const { startLine, text: line } of logicalLines(maskCommentsAndStrings(text))) {
    if (!line.includes("|")) continue;
    // `||` is a control operator, never a pipe. Neutralised before splitting so that
    // `curl … || echo x` cannot be read as piping into `echo`.
    const segments = line.replace(/\|\|/g, "   ").split("|");
    const head = segments[0] ?? "";
    const fetches = head
      .trim()
      .split(/\s+/)
      .some((word) => FETCH_COMMANDS.has(basename(word).toLowerCase()));
    if (!fetches) continue;
    // A remote name must be present. `curl` reading a local file and piping it is not the
    // shape being refused, and requiring the scheme keeps that out of the count.
    if (!/https?:\/\//i.test(head)) continue;
    for (const segment of segments.slice(1)) {
      if (PIPED_INTERPRETERS.has(leadingCommand(segment))) {
        found.push({ line: startLine, snippet: line.replace(/\s+/g, " ").trim() });
        break;
      }
    }
  }
  return found;
}

/** Files whose CONTENT is scanned: the retained shell surface, plus every workflow. */
export function remotePipeScanFiles(repoRoot: string): readonly string[] {
  const shell = trackedNonLeanShellFilesFromGit(repoRoot);
  const workflows = trackedGitFiles(repoRoot)
    .map(({ path }) => path)
    // Workflow `run:` blocks are shell too, and they are where the last two instances of this
    // shape actually lived (#17200). Excluding them would have made this check green on a tree
    // that still carried the defect twice.
    .filter((path) => path.startsWith(".github/workflows/") && (path.endsWith(".yml") || path.endsWith(".yaml")))
    .filter((path) => !isInactiveShellInventoryPath(path));
  // ORDINAL, not localeCompare: this is a machine-read path list, and
  // `.claude/rules/culture-invariant-by-default.md` makes ordinal the default for keys. The
  // existing localeCompare sorts in this file predate that and are baselined; a new one would
  // add debt to a ratchet that exists to shrink.
  return [...new Set([...shell, ...workflows])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function scanRemotePipeSites(repoRoot: string = repoRootFromGit()): readonly RemotePipeSite[] {
  const sites: RemotePipeSite[] = [];
  for (const file of remotePipeScanFiles(repoRoot)) {
    let text: string;
    try {
      text = readFileSync(join(repoRoot, file), "utf8");
    } catch {
      // Tracked but unreadable (a broken symlink, a sparse checkout). Skipped rather than
      // asserted on: this check's subject is content that exists, not the checkout's shape.
      continue;
    }
    for (const hit of findRemotePipeToInterpreter(text)) {
      sites.push({ file, line: hit.line, snippet: hit.snippet });
    }
  }
  return sites;
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
  remotePipeSites: readonly RemotePipeSite[] = [],
): InventoryReport {
  const allowlistIntegrity = inspectAllowlistIntegrity(expectedRetained);
  const retainedCategories = buildRetainedCategorySummary(expectedRetained);
  // Carried through the allowlist-integrity early return as well: a duplicate row in the
  // allowlist must not hide a live `curl | sh`, or the loudest failure would mask the worst one.
  const sites = [...remotePipeSites];
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
      remotePipeSites: sites,
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
    remotePipeSites: sites,
  };
}

export function hasDrift(report: InventoryReport): boolean {
  return (
    hasAllowlistIntegrityDrift(report.allowlistIntegrity) ||
    report.drift.unexpected.length > 0 ||
    report.drift.missingRetained.length > 0 ||
    report.remotePipeSites.length > 0
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
  lines.push(`remote_pipe_to_interpreter: ${String(report.remotePipeSites.length)}`);
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
  if (report.remotePipeSites.length > 0) {
    lines.push("## Remote fetch piped into an interpreter");
    lines.push("");
    lines.push("A remote script handed straight to a shell executes BEFORE anything can check it, so no");
    lines.push("check performed afterwards is a check at all (manifesto §13, noninterference). Use the");
    lines.push("mechanism that already exists instead of adding a second one:");
    lines.push("");
    lines.push(
      "  binary / installer -> a pin file + `bun src/Core.TypeScript/ace/install-pinned-artifact.ts --pin <pin.json>`",
    );
    lines.push("                        models: .github/ollama-pin.json, tools/setup/rustup-pin.json");
    lines.push("  plain file         -> a row in tools/setup/manifests/from-url (sha256= is mandatory)");
    lines.push("");
    for (const site of report.remotePipeSites) {
      lines.push(`- ${site.file}:${String(site.line)}: ${site.snippet}`);
    }
    lines.push("");
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
    `Checks that non-Lean tracked shell-family files match ${RETAINED_SHELL_SCOPE},`,
    "and that no retained shell file or workflow pipes a remote fetch into an interpreter.",
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
    const repoRoot = repoRootFromGit();
    report = buildInventoryReport(
      trackedNonLeanShellFilesFromGit(repoRoot),
      EXPECTED_RETAINED_SHELL,
      scanRemotePipeSites(repoRoot),
    );
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
