#!/usr/bin/env bun
/**
 * src/Core.TypeScript/shadow/launchd/install-launchagent.ts
 *
 * Install (or reinstall) the Zeta shadow observer as a macOS LaunchAgent.
 *
 * Performs the placeholder substitution that the README previously documented
 * with a `sed` recipe. The `sed` form is unsafe when the substituted values
 * contain `&`, `|`, `\`, or newlines — a path like `/Users/foo & bar/Zeta`
 * would silently produce a broken plist. This script reads the template,
 * substitutes by string replace (no shell metacharacter risk), runs
 * `plutil -lint` on the result, and writes it to ~/Library/LaunchAgents/.
 *
 * USAGE
 *
 *   bun src/Core.TypeScript/shadow/launchd/install-launchagent.ts
 *
 *   # Optional flags:
 *   --bun-path <path>     override `which bun`
 *   --repo-root <path>    override `git rev-parse --show-toplevel`
 *   --dry-run             write to stdout instead of LaunchAgents dir
 *   --bootstrap           after writing, `launchctl bootstrap` the agent
 *
 * SAFETY
 *
 *   - Refuses to write if substitution would leave any `{{PLACEHOLDER}}`
 *     markers in the output (catches mis-spelled / new placeholders).
 *   - Verifies the output with `plutil -lint` before writing to the
 *     final location.
 *   - Backs up any existing LaunchAgent plist before overwriting.
 *
 * COMPOSES WITH
 *
 *   src/Core.TypeScript/shadow/launchd/com.zeta.shadow-observer.plist — the template
 *   src/Core.TypeScript/shadow/launchd/README.md — install procedure documentation
 */

import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync, mkdtempSync, rmdirSync, statSync, accessSync, unlinkSync, constants as fsConstants } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, isAbsolute, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createLaunchctlControl } from "../../service/service-control-port";

export interface Args {
  bunPath: string;
  repoRoot: string;
  dryRun: boolean;
  bootstrap: boolean;
}

/**
 * Tries `which bun` (or `git rev-parse --show-toplevel`) and returns
 * the trimmed stdout. If the command isn't on PATH or errors, returns
 * undefined so the caller can emit the documented actionable error
 * instead of a raw exception.
 */
export function tryDetect(cmd: string, args: string[]): string | undefined {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- which / git
    // are standard dev-environment dependencies invoked by name; same
    // convention as tools/github/poll-pr-gate.ts + src/Core.TypeScript/peer-call/.
    return execFileSync(cmd, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Enforce that a user-supplied path override is absolute. LaunchAgent
 * plists are persistent and must not depend on the installer's cwd —
 * `--repo-root .` would write relative paths into ProgramArguments,
 * WorkingDirectory, and log paths, all of which would fail under
 * launchd (which has no defined cwd unless explicit).
 */
export function requireAbsolute(name: string, value: string): string {
  if (!isAbsolute(value)) {
    console.error(`${name} must be an absolute path; got "${value}". Use \`${resolve(value)}\` if that's what you meant.`);
    process.exit(1);
  }
  return value;
}

export function parseArgs(argv: string[]): Args {
  let bunPath: string | undefined;
  let repoRoot: string | undefined;
  let dryRun = false;
  let bootstrap = false;
  let i = 0;
  function nextArg(name: string): string {
    const v = argv[++i];
    if (v === undefined) {
      console.error(`Missing value for ${name}`);
      process.exit(1);
    }
    if (v.startsWith("--")) {
      console.error(`Missing value for ${name} (next token "${v}" looks like a flag)`);
      process.exit(1);
    }
    return v;
  }
  for (; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--bun-path":
        bunPath = requireAbsolute("--bun-path", nextArg("--bun-path"));
        break;
      case "--repo-root":
        repoRoot = requireAbsolute("--repo-root", nextArg("--repo-root"));
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--bootstrap":
        bootstrap = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        // Unknown flag — refuse before performing any filesystem action.
        // Otherwise a typo like `--dryrun` or `--bootstap` would silently
        // proceed with default-installation behavior.
        console.error(`Unknown argument: ${a}. Run with --help to see supported flags.`);
        process.exit(1);
    }
  }
  if (!bunPath) {
    bunPath = tryDetect("which", ["bun"]);
    if (!bunPath) {
      console.error("Could not detect bun via `which bun`. Install bun or pass --bun-path <absolute-path>.");
      process.exit(1);
    }
  }
  if (!repoRoot) {
    repoRoot = tryDetect("git", ["rev-parse", "--show-toplevel"]);
    if (!repoRoot) {
      console.error("Could not detect repo root via `git rev-parse --show-toplevel` (not in a git checkout?). Pass --repo-root <absolute-path>.");
      process.exit(1);
    }
  }
  // Validate bunPath is an executable regular file. `existsSync` alone
  // would pass directories or non-executable files and produce a
  // LaunchAgent that can't start.
  try {
    const st = statSync(bunPath);
    if (!st.isFile()) {
      console.error(`--bun-path "${bunPath}" exists but is not a regular file. Pass an absolute path to the bun binary.`);
      process.exit(1);
    }
    accessSync(bunPath, fsConstants.X_OK);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`bun not found at "${bunPath}". Install bun or pass --bun-path.`);
    } else if (code === "EACCES") {
      console.error(`--bun-path "${bunPath}" is not executable by the current user. chmod +x or pass a different path.`);
    } else {
      console.error(`Could not stat --bun-path "${bunPath}" (${(e as Error).message})`);
    }
    process.exit(1);
  }
  // repoRoot should be an existing directory (the installer reads
  // `${repoRoot}/tools/shadow/launchd/com.zeta.shadow-observer.plist`).
  try {
    const st = statSync(repoRoot);
    if (!st.isDirectory()) {
      console.error(`--repo-root "${repoRoot}" exists but is not a directory.`);
      process.exit(1);
    }
  } catch {
    console.error(`repo root "${repoRoot}" does not exist or is unreadable. Pass --repo-root explicitly.`);
    process.exit(1);
  }
  return { bunPath, repoRoot, dryRun, bootstrap };
}

function printHelp(): void {
  console.error(`
Install Zeta shadow observer as a macOS LaunchAgent.

Usage: bun src/Core.TypeScript/shadow/launchd/install-launchagent.ts [options]

Options:
  --bun-path <path>     Absolute path to bun (default: \`which bun\`)
  --repo-root <path>    Absolute path to Zeta checkout (default: \`git rev-parse --show-toplevel\`)
  --dry-run             Write to stdout instead of LaunchAgents dir
  --bootstrap           After writing, \`launchctl bootstrap\` the agent

After install, complete Step 2 (accessibility permission) from
src/Core.TypeScript/shadow/launchd/README.md before live mode is useful.
`);
}

/**
 * XML-text escape: substituted values go inside <string>…</string> nodes,
 * so any of `& < >` would either produce an invalid plist (`&` without a
 * matching `;`) or alter the parsed value. Apple's plutil rejects raw `&`
 * in text nodes outright. We escape before substitution.
 *
 * `'` and `"` aren't strictly required to be escaped inside element text,
 * but escaping them is conservative and matches XML 1.0 predefined-entity
 * recommendations.
 */
export function xmlEscape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function substitutePlaceholders(template: string, repoRoot: string, bunPath: string): string {
  // String replace is metacharacter-safe (unlike sed). No escaping needed
  // for shell — but the values are about to land in XML text nodes, so
  // they DO need XML-entity escaping (else `/Users/foo & bar/Zeta`
  // produces an invalid plist).
  // Placeholders use `{{NAME}}` (Mustache-style) so the template header
  // comment can document them without itself being substituted.
  const result = template
    .replaceAll("{{BUN_PATH}}", xmlEscape(bunPath))
    .replaceAll("{{REPO_ROOT}}", xmlEscape(repoRoot));
  // Sanity check: any remaining {{NAME}} markers indicate a new placeholder
  // the script doesn't know about. Refuse to write a partial substitution.
  const leftover = result.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) {
    console.error(`Unsubstituted placeholder(s) in template: ${[...new Set(leftover)].join(", ")}`);
    console.error("Update install-launchagent.ts to handle them.");
    process.exit(1);
  }
  return result;
}

export function plutilLint(content: string): void {
  // Write to a private mkdtemp directory so the temp filename isn't
  // predictable from PID. A pre-created symlink at a predictable path
  // (e.g., /tmp/zeta-shadow-launchagent-12345.plist) would have caused
  // writeFileSync to follow the symlink and clobber an unrelated file
  // that the attacker had write access to. mkdtempSync creates a 0700
  // directory with a random suffix that only this user can enter, so
  // no other user's symlink can target the file we're about to write.
  // We also clean up after ourselves on success and on the error path.
  const tmpDir = mkdtempSync(join(tmpdir(), "zeta-shadow-launchagent-"));
  const tmp = join(tmpDir, "candidate.plist");
  try {
    writeFileSync(tmp, content, "utf-8");
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- plutil
      // is a macOS-standard system binary present on all install targets.
      execFileSync("plutil", ["-lint", tmp], { stdio: "pipe" });
    } catch (e) {
      const err = e as { stdout?: Buffer; stderr?: Buffer };
      console.error("plutil -lint rejected the generated plist:");
      if (err.stdout) console.error(err.stdout.toString());
      if (err.stderr) console.error(err.stderr.toString());
      process.exit(1);
    }
  } finally {
    // Best-effort cleanup so we don't leak temp dirs across runs.
    try { unlinkSync(tmp); } catch { /* may not exist */ }
    try { rmdirSync(tmpDir); } catch { /* best-effort */ }
  }
}

export function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const templatePath = join(args.repoRoot, "src/Core.TypeScript/shadow/launchd/com.zeta.shadow-observer.plist");
  if (!existsSync(templatePath)) {
    console.error(`Template not found at ${templatePath}. Wrong --repo-root?`);
    process.exit(1);
  }
  const template = readFileSync(templatePath, "utf-8");
  const configured = substitutePlaceholders(template, args.repoRoot, args.bunPath);
  plutilLint(configured);

  if (args.dryRun) {
    process.stdout.write(configured);
    return;
  }

  const destDir = join(homedir(), "Library", "LaunchAgents");
  const destPath = join(destDir, "com.zeta.shadow-observer.plist");
  // recursive: true is idempotent; no existsSync check needed.
  mkdirSync(destDir, { recursive: true });

  // Availability-preserving install pattern (per Codex review on PR #3342):
  //   1. Read existing destPath into memory (skipped on ENOENT)
  //   2. Write the new content to a temp file alongside destPath
  //   3. Atomically rename(tmp, destPath) — POSIX guarantees this
  //      replaces destPath in a single syscall, so the canonical path
  //      is NEVER in a missing state. The previous rename-then-write
  //      pattern had a brief window where launchd would have seen
  //      no plist at the canonical path; this pattern eliminates it.
  //   4. Side-car the in-memory old content as a timestamped backup
  //      (best-effort; failure here doesn't affect the install)
  let oldContent: string | undefined;
  try {
    oldContent = readFileSync(destPath, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      // Read failed for some reason other than absence — treat as
      // "no backup available" and proceed; the goal is the install,
      // and if we can't read we probably can't back up anyway.
      console.error(`Could not read existing plist for backup (${(e as Error).message}); proceeding without backup`);
    }
  }
  const tmpDest = `${destPath}.tmp-${process.pid}`;
  writeFileSync(tmpDest, configured, "utf-8");
  try {
    renameSync(tmpDest, destPath);
  } catch (e) {
    // Promote failed — clean up temp file so we don't leak stale
    // candidates in ~/Library/LaunchAgents.
    try { unlinkSync(tmpDest); } catch { /* tmp may already be gone */ }
    throw e;
  }
  console.error(`Wrote ${destPath}`);
  if (oldContent !== undefined) {
    const backup = `${destPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    try {
      writeFileSync(backup, oldContent, "utf-8");
      console.error(`Backed up previous plist to ${backup}`);
    } catch (e) {
      // Backup-write failed — the install is still good. Log and move on.
      console.error(`Could not write backup at ${backup} (${(e as Error).message}); install OK without backup`);
    }
  }

  if (args.bootstrap) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- `id` is a
    // macOS-standard system binary; same convention as tools/github/poll-pr-gate.ts.
    // `launchctl` is NO LONGER in this suppression: it resolves through
    // ServiceControlPort to an allowlisted absolute path.
    const uid = execFileSync("id", ["-u"], { encoding: "utf-8" }).trim();
    const domain = `gui/${uid}`;
    const resolved = createLaunchctlControl();
    if (!resolved.ok) throw new Error(`launchctl unavailable: ${resolved.reason}`);
    // bootout first (idempotent by port contract — fine if not loaded)
    resolved.port.bootout(domain, destPath);
    const booted = resolved.port.bootstrap(domain, destPath);
    if (!booted.ok) throw new Error(booted.reason);
    console.error(`Bootstrapped com.zeta.shadow-observer in ${domain}`);
  } else {
    console.error("Next: complete Step 2 (accessibility permission) per README, then:");
    console.error(`  launchctl bootstrap gui/$(id -u) ${destPath}`);
  }
}

// Bun convention: only invoke main() when this file is the entry point.
// Lets tests / helpers `import { ... } from "./install-launchagent.ts"`
// without triggering filesystem or launchctl side effects.
if (import.meta.main) {
  main();
}
