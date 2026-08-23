#!/usr/bin/env bun
/**
 * lint-no-ambient-credential-hoist.ts — refuse any tracked EXECUTABLE surface
 * that hoists a credential into a shell environment.
 *
 * WHAT IT GUARDS
 * ------------------------------------------------------------------------
 * `tools/setup/op-token-setup.sh` used to write `~/.config/zeta/secrets-env.sh`
 * holding `export OP_SERVICE_ACCOUNT_TOKEN="$(security find-generic-password …)"`,
 * and `tools/setup/common/shellenv.sh` wrote the line that sourced it into the
 * user profile. Result: an 852-byte 1Password service-account token in the
 * environment of every interactive shell and every process descended from one.
 *
 * An environment variable crosses `exec` regardless of the child's code
 * identity, so this is the one exposure in the custody stack that no signature,
 * ACL, IMA policy or TPM seal can gate — all four bind a secret to a CALLER, and
 * an inherited variable has already escaped that question. §13 noninterference
 * (Goguen & Meseguer 1982) violated for credentials.
 *
 * The replacement is `src/Core.TypeScript/secrets/credential.ts`: fetch at point
 * of use, hand to one callback or one child's env, never export.
 *
 * SCOPE — EXECUTABLE SURFACES ONLY
 * ------------------------------------------------------------------------
 * `docs/` is deliberately out of scope: research notes quote the defective line
 * verbatim (that is what a post-mortem is for) and documentation does not
 * execute. The guard covers the directories that do.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly text: string;
}

/** Directories whose contents execute. A hit here is a live channel. */
const EXECUTABLE_PREFIXES = [
  "tools/",
  "scripts/",
  "githooks/",
  "src/",
  ".github/",
  ".gemini/",
  "clis/",
  "bus/",
  "cluster/",
  "full-ai-cluster/",
] as const;

/**
 * Files that legitimately contain the patterns because they are ABOUT them:
 * this linter, its test, and the point-of-use helper's explanatory header.
 */
const SELF_EXEMPT = [
  "src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.ts",
  "src/Core.TypeScript/hygiene/lint-no-ambient-credential-hoist.test.ts",
  "src/Core.TypeScript/secrets/credential.ts",
  "src/Core.TypeScript/secrets/keychain-macos.ts",
] as const;

/** A keychain / secret-store fetch, in any of the forms this repo can reach. */
const FETCH = String.raw`(?:security\s+find-generic-password|security\s+find-internet-password|secret-clip\.sh\s+get|secret-tool\s+lookup|op\s+read|op\s+item\s+get)`;

const RULES: readonly { readonly id: string; readonly re: RegExp; readonly why: string }[] = [
  {
    id: "hoist-source",
    // `. ~/.config/zeta/secrets-env.sh` / `source …/secrets-env.sh` in any quoting.
    re: /(?:^|[;&|]|\bthen\b|\belse\b|\bdo\b|\becho\s)\s*(?:\.|source)\s+\\?["']?[^"'\n]*secrets-env\.sh/,
    why: "sources a credential-bearing env file into the shell (the ambient hoist)",
  },
  {
    id: "export-of-fetch",
    // `export NAME="$(security find-generic-password …)"`, incl. escaped heredoc forms.
    re: new RegExp(String.raw`\bexport\s+[A-Za-z_][A-Za-z0-9_]*\s*=.*` + FETCH),
    why: "exports a credential fetched from the OS keystore into the environment",
  },
  {
    id: "github-env-of-fetch",
    // `echo "TOKEN=$(security find-generic-password …)" >> $GITHUB_ENV`
    re: new RegExp(FETCH + String.raw`[\s\S]*?>>\s*"?\$\{?GITHUB_ENV`),
    why: "writes a credential fetch into $GITHUB_ENV, which every later step inherits",
  },
  {
    id: "process-env-assign-of-credential",
    // `process.env.OP_SERVICE_ACCOUNT_TOKEN = …` — the TypeScript form of the same thing.
    re: /process\.env(?:\.[A-Za-z_][A-Za-z0-9_]*|\[["'][^"']+["']\])\s*=\s*(?!.*\bundefined\b)[^=]/,
    why: "assigns into process.env, which every child of this process inherits",
  },
];

/** Only the credential-shaped names for the process.env rule — assigning PATH is not a leak. */
const CREDENTIAL_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|CREDENTIAL|PRIVATE_KEY|PASSPHRASE)/i;

/** The env KEY being assigned, not the rest of the line (a value named FAKE_TOKEN is not a hoist). */
function processEnvAssignedKey(line: string): string {
  const m = line.match(/process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[["']([^"']+)["']\])/);
  return m?.[1] ?? m?.[2] ?? "";
}

export function scanText(file: string, text: string): Finding[] {
  if ((SELF_EXEMPT as readonly string[]).includes(file)) return [];
  const out: Finding[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    // Strip a leading comment marker so a commented-out example is not a finding,
    // but do NOT strip trailing comments — a live command followed by `# note`
    // is still live.
    const lead = raw.replace(/^\s+/, "");
    if (lead.startsWith("#") || lead.startsWith("//") || lead.startsWith("*")) continue;
    for (const rule of RULES) {
      if (!rule.re.test(raw)) continue;
      if (rule.id === "process-env-assign-of-credential" && !CREDENTIAL_NAME.test(processEnvAssignedKey(raw))) continue;
      out.push({ file, line: i + 1, rule: `${rule.id}: ${rule.why}`, text: raw.trim().slice(0, 160) });
    }
  }
  return out;
}

export function isExecutableSurface(path: string): boolean {
  return EXECUTABLE_PREFIXES.some((p) => path.startsWith(p));
}

export function trackedFiles(repoRoot: string): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024 })
    .toString("utf8")
    .split("\0")
    .filter((p) => p !== "");
}

/**
 * File kinds that can actually put a variable into a shell environment: shell,
 * the CI YAML that becomes shell, and the JS/TS that can write `process.env`.
 * Extensionless files are included when they live in a hooks directory — the
 * git hooks are shell with no suffix, and an earlier survey's glob missed them.
 */
export function isScannableKind(path: string): boolean {
  if (/\.(sh|bash|zsh|fish|ts|tsx|js|mjs|cjs|yml|yaml|ps1|command)$/i.test(path)) return true;
  const base = path.slice(path.lastIndexOf("/") + 1);
  if (base.includes(".")) return false;
  return /(^|\/)(githooks|hooks)\//.test(path);
}

export interface ScanReport {
  readonly filesScanned: number;
  readonly findings: readonly Finding[];
}

/**
 * A lint that scans zero files and exits 0 is not a lint. This repo shipped one
 * (`lint:markdown` matched nothing and passed for months, #10712), so the file
 * count is part of the output and part of the exit condition — below the floor
 * the guard fails LOUD rather than reporting success it did not earn.
 */
export const MIN_FILES_EXPECTED = 200;

export function scanRepoDetailed(repoRoot: string): ScanReport {
  const findings: Finding[] = [];
  let filesScanned = 0;
  for (const rel of trackedFiles(repoRoot)) {
    if (!isExecutableSurface(rel)) continue;
    if (!isScannableKind(rel)) continue;
    let text: string;
    try {
      text = readFileSync(join(repoRoot, rel), "utf8");
    } catch {
      continue; // symlink, submodule, or unreadable — other lints own those
    }
    filesScanned++;
    findings.push(...scanText(rel, text));
  }
  return { filesScanned, findings };
}

export function scanRepo(repoRoot: string): Finding[] {
  return [...scanRepoDetailed(repoRoot).findings];
}

if (import.meta.main) {
  const repoRoot = resolve(import.meta.dir, "..", "..", "..");
  const { filesScanned, findings } = scanRepoDetailed(repoRoot);
  if (filesScanned < MIN_FILES_EXPECTED) {
    console.error(`✗ scanned only ${String(filesScanned)} files (floor ${String(MIN_FILES_EXPECTED)}).`);
    console.error("  A guard that matches nothing and exits 0 is not a guard. Fix the scope, not the floor.");
    process.exit(2);
  }
  if (findings.length > 0) {
    console.error("✗ ambient credential hoist detected — a credential must never enter a shell environment.");
    console.error("  Use src/Core.TypeScript/secrets/credential.ts (withCredential / spawnWithCredential) instead.\n");
    for (const f of findings) {
      console.error(`  ${f.file}:${String(f.line)}  [${f.rule}]`);
      console.error(`      ${f.text}`);
    }
    console.error(`\n${String(findings.length)} finding(s).`);
    process.exit(1);
  }
  console.log(`✓ no ambient credential hoist in ${String(filesScanned)} tracked executable files`);
}
