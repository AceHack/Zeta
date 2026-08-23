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
export const SELF_EXEMPT = [
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
    // The bracket branch is `[^\]]+`, NOT a quoted literal: `process.env[key] = secret`
    // is the same write and used to walk straight past this rule. See
    // `processEnvAssignment` for what happens once a computed key is matched.
    re: /process\.env(?:\.[A-Za-z_][A-Za-z0-9_]*|\[[^\]]+\])\s*=\s*(?!.*\bundefined\b)[^=]/,
    why: "assigns into process.env, which every child of this process inherits",
  },
];

/** Only the credential-shaped names for the process.env rule — assigning PATH is not a leak. */
const CREDENTIAL_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|CREDENTIAL|PRIVATE_KEY|PASSPHRASE)/i;

/**
 * The `process.env` write on a line, split into the KEY it names and the VALUE
 * expression it assigns. `key: null` means the key is COMPUTED (`process.env[k]`)
 * and therefore not knowable here.
 */
export interface ProcessEnvWrite {
  /** The literal key, or `null` when it is computed at runtime. */
  readonly key: string | null;
  /** Everything to the right of the `=`. */
  readonly value: string;
}

export function processEnvAssignment(line: string): ProcessEnvWrite | undefined {
  const m = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[\s*["']([^"']+)["']\s*\]|\[([^\]]+)\])\s*=\s*([^=].*)$/.exec(line);
  if (m === null) return undefined;
  const literal = m[1] ?? m[2];
  return { key: literal ?? null, value: m[4] ?? "" };
}

/**
 * Does this `process.env` write have to be reported?
 *
 * THREE CASES, AND THE HISTORY IS WHY EACH IS WRITTEN OUT.
 *
 *  - COMPUTED KEY (`process.env[k] = v`) — always. The key is unknowable at lint
 *    time, so no name test can clear it, and resolving "unknown" as permissive is
 *    the disposition `src/Core/DerivationProtocol.fs` refuses for licences and
 *    that this guard must refuse for credentials. The escape hatch is free and
 *    improves the code: write the key as a literal so the guard (and `grep`, and
 *    a reviewer) can see which variable is being set. MEASURED 2026-08-23: zero
 *    occurrences in the tracked tree, so closing this costs nothing today.
 *
 *  - CREDENTIAL-SHAPED KEY — always. Unchanged.
 *
 *  - CREDENTIAL-SHAPED VALUE with an innocuous key — yes, and this restores what
 *    #14353 removed. That PR narrowed the test to the key alone, reasoning that
 *    "a value named FAKE_TOKEN is not a hoist". The general principle is sound
 *    and the specific line was not covered by it: the line it cleared
 *    (`process.env.ZETA_TEST_HOIST_PROBE = FAKE_TOKEN`) really was a hoist, which
 *    #14355 then confirmed by deleting the mutation outright. A key-only test is
 *    also evadable by renaming, and the name is chosen by the author — a guard
 *    whose coverage the subject selects is not a guard. MEASURED 2026-08-23 after
 *    #14355: zero occurrences, so restoring it reds nothing.
 *
 * What is deliberately NOT done: convicting every non-literal value. That is the
 * sound rule (a literal cannot smuggle a runtime secret) and it MEASURES AT 59
 * findings — `process.env.HOME = tempHome`, `PATH` prepends, and the like. That
 * is a different lint about `process.env` writes in general, and it needs its own
 * decision rather than arriving inside a credential guard.
 */
export function processEnvWriteIsReportable(line: string): boolean {
  const w = processEnvAssignment(line);
  if (w === undefined) return false;
  if (w.key === null) return true;
  return CREDENTIAL_NAME.test(w.key) || CREDENTIAL_NAME.test(w.value);
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
      if (rule.id === "process-env-assign-of-credential" && !processEnvWriteIsReportable(raw)) continue;
      out.push({ file, line: i + 1, rule: `${rule.id}: ${rule.why}`, text: raw.trim().slice(0, 160) });
    }
  }
  return out;
}

/** A file bun will run as a test. Used only to choose which teaching to print. */
export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/i.test(path);
}

/**
 * The message a caller gets. It TEACHES rather than repeating the refusal louder.
 *
 * Why this is a function with its own falsifiers and not a string at the exit
 * site: on 2026-08-23 TWO agents independently, within one hour, wrote a test
 * that proves "this code ignores ambient credentials" BY SETTING AN AMBIENT
 * CREDENTIAL; a third built an exemption mechanism for it and discarded it; a
 * fourth narrowed this guard so one of those lines stopped being reported. The old message named the rule and pointed at `credential.ts`
 * - correct, and useless to all of them, because none was trying to USE a
 * credential. They were trying to prove one was ignored, and nothing told them
 * how to say that. Three agents needing the same missing sentence in two hours
 * measures the message, not them.
 *
 * So a finding in a test file gets the pattern; a finding in a shell script does
 * not, because teaching that fires everywhere teaches nothing.
 */
export function teachingFor(findings: readonly Finding[]): string[] {
  const out = [
    "  Fetch at point of use instead: src/Core.TypeScript/secrets/credential.ts",
    "  (withCredential / spawnWithCredential). A credential reaches ONE callback or ONE",
    "  child's env, never a shell every descendant inherits.",
  ];
  if (!findings.some((f) => isTestFile(f.file))) return out;
  out.push(
    "",
    "  TESTING THAT A CREDENTIAL IS IGNORED? You do not need to create one.",
    "  The claim is about a FUNCTION OF an environment, not about this process's",
    "  environment. Pass the environment as a VALUE: then the hostile case is an object",
    "  you built, and nothing ambient is ever touched. Three forms, strongest first:",
    "    1. INJECT IT   - the code under test takes `env` as a parameter; the hostile",
    "                     env is a literal. Shape: `buildChildEnv` in secrets/credential.ts.",
    "    2. WITNESS IT  - src/Core.TypeScript/secrets/env-witness.ts:",
    "                     withHoistedCredential / envDigest / envDiffNames / envNamesCarrying.",
    "                     Build the hoisted env as a value, aim the detector at it.",
    "    3. SCAN SOURCE - when the claim is `this module names no credential variable`,",
    "                     assert it against comment-stripped source. Worked example:",
    "                     src/Core.TypeScript/cluster/measure-lane-footprints.test.ts.",
    "  A `try/finally` restore is not equivalent: bun runs a file's tests in ONE process,",
    "  so any child spawned inside that window inherits the value. A constructed object",
    "  has no window. If you landed here it is the pattern, not you: it caught two agents",
    "  independently within one hour on 2026-08-23, and pulled in two more.",
  );
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
    for (const line of teachingFor(findings)) console.error(line);
    console.error("");
    for (const f of findings) {
      console.error(`  ${f.file}:${String(f.line)}  [${f.rule}]`);
      console.error(`      ${f.text}`);
    }
    console.error(`\n${String(findings.length)} finding(s).`);
    process.exit(1);
  }
  console.log(`✓ no ambient credential hoist in ${String(filesScanned)} tracked executable files`);
}
