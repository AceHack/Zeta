#!/usr/bin/env bun
// tools/persistence/windows/install-scheduled-task.ts
//
// Install Zeta's autonomous-loop worker as a USER-MODE Windows Task Scheduler task.
// Windows parity for tools/shadow/launchd/install-launchagent.ts + the macOS
// dual-agent setup (tools/ops/setup-dual-background-agents.ts).
//
// User-mode = <LogonType>InteractiveToken</LogonType> + NO <RunLevel> (=> Limited;
// no UAC / no admin). The task runs a thin PowerShell wrapper each minute (at-logon
// trigger + PT1M repetition) which runs the tick against a DEDICATED CLONE at
// %LOCALAPPDATA%\zeta-otto-loop\Zeta — NEVER the operator checkout (the tick does
// `git reset --hard origin/main`, which would wipe a working checkout).
//
//   bun tools/persistence/windows/install-scheduled-task.ts             # dry run: print rendered XML
//   bun tools/persistence/windows/install-scheduled-task.ts --register  # clone + register/replace the task
//   ... --ref feat/x   # which ref the dedicated clone tracks (default: main)
//   ... --run-claude --model opus   # enable harness-launch instead of heartbeat-only
//
// Flags: --task-name <n> --ref <r> --run-claude --model <m>
//        --repo-root <p> --clone-dir <p> --dry-run --register
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, dirname, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";

export interface Args {
  taskName: string;
  ref: string;
  runClaude: boolean;
  model: string;
  repoRoot?: string;
  cloneDir?: string;
  dryRun: boolean;
  register: boolean;
}

export type Placeholders = Record<"TASK_NAME" | "USER_ID" | "PWSH_PATH" | "WRAPPER_PATH" | "REPO_ROOT", string>;

/** Escape the five XML predefined entities — substituted values land in element text. */
export function xmlEscape(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Replace every {{KEY}} with its XML-escaped value; throw if any {{...}} remains. */
export function substitutePlaceholders(template: string, vals: Placeholders): string {
  let out = template;
  for (const [k, v] of Object.entries(vals)) {
    out = out.replaceAll(`{{${k}}}`, xmlEscape(v));
  }
  const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) throw new Error(`Unsubstituted placeholder(s): ${[...new Set(leftover)].join(", ")}`);
  return out;
}

/** schtasks /Create /XML requires UTF-16; prepend the LE BOM. */
export function toUtf16WithBom(content: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, "utf16le")]);
}

export function parseArgs(argv: string[]): Args {
  const a: Args = { taskName: "ZetaOttoLoop", ref: "main", runClaude: false, model: "sonnet", dryRun: false, register: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const next = (name: string): string => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`Missing value for ${name}`);
      return v;
    };
    switch (t) {
      case "--task-name": a.taskName = next("--task-name"); break;
      case "--ref": a.ref = next("--ref"); break;
      case "--model": a.model = next("--model"); break;
      case "--repo-root": a.repoRoot = next("--repo-root"); break;
      case "--clone-dir": a.cloneDir = next("--clone-dir"); break;
      case "--run-claude": a.runClaude = true; break;
      case "--dry-run": a.dryRun = true; break;
      case "--register": a.register = true; break;
      default: throw new Error(`Unknown argument: ${t}`);
    }
  }
  return a;
}

// ── detection ───────────────────────────────────────────────────────────────

function detectRepoRoot(override?: string): string {
  if (override) {
    if (!isAbsolute(override)) throw new Error(`--repo-root must be absolute: ${override}`);
    return override;
  }
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
}

function detectUserSid(): string {
  // `whoami /user /fo csv /nh` => "DOMAIN\user","S-1-5-21-...."
  const out = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" }).trim();
  const m = out.match(/"([^"]+)","(S-[0-9-]+)"/);
  const sid = m?.[2];
  if (!sid) throw new Error(`Could not parse SID from: ${out}`);
  return sid;
}

function detectPwsh(): string {
  for (const exe of ["pwsh.exe", "powershell.exe"]) {
    try {
      const p = execFileSync("where.exe", [exe], { encoding: "utf8" }).trim().split(/\r?\n/)[0];
      if (p) return p;
    } catch { /* try next */ }
  }
  throw new Error("Neither pwsh.exe nor powershell.exe found on PATH");
}

export function defaultCloneDir(): string {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  return join(localAppData, "zeta-otto-loop", "Zeta");
}

// ── clone setup (side-effecting; only on --register) ─────────────────────────

function ensureClone(cloneDir: string, ref: string): void {
  const ZETA = "https://github.com/Lucent-Financial-Group/Zeta.git";
  if (existsSync(join(cloneDir, ".git"))) {
    execFileSync("git", ["-C", cloneDir, "fetch", "origin"], { stdio: "inherit" });
    execFileSync("git", ["-C", cloneDir, "checkout", ref], { stdio: "inherit" });
    execFileSync("git", ["-C", cloneDir, "reset", "--hard", `origin/${ref}`], { stdio: "inherit" });
  } else {
    mkdirSync(dirname(cloneDir), { recursive: true });
    execFileSync("git", ["clone", ZETA, cloneDir], { stdio: "inherit" });
    execFileSync("git", ["-C", cloneDir, "checkout", ref], { stdio: "inherit" });
  }
}

export function renderXml(repoRoot: string, args: Args): string {
  const here = join(repoRoot, "tools", "persistence", "windows");
  const template = readFileSync(join(here, "scheduled-task.xml"), "utf8");
  return substitutePlaceholders(template, {
    TASK_NAME: args.taskName,
    USER_ID: detectUserSid(),
    PWSH_PATH: detectPwsh(),
    WRAPPER_PATH: join(here, "otto-loop-wrapper.ps1"),
    REPO_ROOT: repoRoot,
  });
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = detectRepoRoot(args.repoRoot);
  const xml = renderXml(repoRoot, args);

  if (args.dryRun || !args.register) {
    process.stdout.write(xml + "\n");
    if (!args.register) console.error("\n(dry run — pass --register to clone + install the task)");
    return;
  }

  const cloneDir = args.cloneDir ?? defaultCloneDir();
  console.error(`Ensuring dedicated clone at ${cloneDir} (ref ${args.ref})…`);
  ensureClone(cloneDir, args.ref);
  writeFileSync(join(dirname(cloneDir), "loop-ref.txt"), args.ref, "utf8");

  const tmp = mkdtempSync(join(tmpdir(), "zeta-schtask-"));
  const xmlPath = join(tmp, "task.xml");
  try {
    writeFileSync(xmlPath, toUtf16WithBom(xml));
    try { execFileSync("schtasks.exe", ["/Delete", "/TN", args.taskName, "/F"], { stdio: "ignore" }); } catch { /* not present */ }
    execFileSync("schtasks.exe", ["/Create", "/TN", args.taskName, "/XML", xmlPath, "/F"], { stdio: "inherit" });
    console.error(`Registered user-mode task "${args.taskName}". Verify: schtasks /Query /TN ${args.taskName}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Only run side effects when invoked directly — lets the test import the pure functions.
if (import.meta.main) { main(); }
