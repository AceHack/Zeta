# Windows parity slice 1 — user-mode background-service installer — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) or
> superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Register Zeta's autonomous-loop worker as a **user-mode Windows Task Scheduler
task** (parity with the macOS launchd LaunchAgent), reusing the existing
`.claude/bin/claude-loop-tick.ts` with one OS-conditional PATH fix.

**Architecture:** A TS installer (`bun`) renders a UTF-16 Task Scheduler XML from a
template + registers it via `schtasks /Create`. The task runs a thin PowerShell wrapper
each minute (at-logon trigger + `PT1M` repetition) that sets `ZETA_CLAUDE_LOOP_*` env and
invokes the shared tick. User-mode = `InteractiveToken` + omitted `<RunLevel>` (Limited;
no UAC/admin).

**Tech Stack:** TypeScript on Bun, PowerShell 5.1/7, Windows Task Scheduler (`schtasks.exe`).

**Spec:** `docs/plans/2026-05-30-windows-parity-preinstall-surface-design.md`

---

## Build-time corrections (AS-BUILT — supersedes the per-task locations below)

Three issues surfaced during execution (the tick's own "assume decomposition has mistakes"):

1. **Helper + test live in `tools/persistence/`, NOT `.claude/bin/`** — `.claude/bin/` is
   gitignored (`bin/`) so a new file there never commits, and `bun test` does not discover
   tests in dot-directories. The tick imports `../../tools/persistence/loop-subprocess-path`.
2. **The loop runs against a DEDICATED CLONE (`%LOCALAPPDATA%\zeta-otto-loop\Zeta`), never the
   operator checkout** — the tick does `git reset --hard origin/main`, which would wipe a
   working checkout. The wrapper sets `ZETA_CLAUDE_LOOP_WORKTREE` to the clone (NOT `$RepoRoot`
   as some task bodies below wrongly state). Installer gained `--ref` + clone-setup. macOS
   dual-agent parity. (Operator-approved 2026-05-30.)
3. **`posix.join`** (not host `join`) builds the macOS/Linux PATH so the helper is host-independent.

Authoritative "how it works": `tools/persistence/windows/README.md` + commits cb630e98b, 3c592e9de.

---

## File structure

| File | Responsibility |
|---|---|
| `.claude/bin/loop-subprocess-path.ts` (create) | Pure helper: OS-conditional subprocess PATH (the portability fix, extracted to be testable without triggering the tick's load-time side effects) |
| `.claude/bin/loop-subprocess-path.test.ts` (create) | Unit tests for the helper |
| `.claude/bin/claude-loop-tick.ts` (modify ~L55-64) | Use the helper instead of the hardcoded POSIX PATH |
| `tools/persistence/windows/scheduled-task.xml` (create) | Task Scheduler XML template (`.plist` analog) |
| `tools/persistence/windows/otto-loop-wrapper.ps1` (create) | Per-tick wrapper: PATH + env + `bun claude-loop-tick.ts` |
| `tools/persistence/windows/install-scheduled-task.ts` (create) | TS installer (mirror of `tools/shadow/launchd/install-launchagent.ts`) |
| `tools/persistence/windows/install-scheduled-task.test.ts` (create) | Unit tests for installer pure functions |
| `tools/persistence/windows/README.md` (create) | install / verify / uninstall |
| `docs/backlog/P2/B-NNNN-windows-pre-install-surface-parity-*.md` (create) | Backlog row closing the `install.sh:159` "Windows backlogged" loop |

---

## Task 1: OS-conditional subprocess PATH helper (the portability fix)

**Files:**

- Create: `.claude/bin/loop-subprocess-path.ts`
- Test: `.claude/bin/loop-subprocess-path.test.ts`
- Modify: `.claude/bin/claude-loop-tick.ts` (the `run()` env block, ~L55-64)

- [ ] **Step 1: Write the failing test**

```typescript
// .claude/bin/loop-subprocess-path.test.ts
import { test, expect } from "bun:test";
import { resolveSubprocessPath } from "./loop-subprocess-path.ts";

test("win32 inherits the existing PATH unchanged (no POSIX override)", () => {
  const existing = "C:\\Users\\x\\.bun\\bin;C:\\Windows\\system32";
  expect(resolveSubprocessPath("win32", "C:\\Users\\x", existing)).toBe(existing);
});

test("win32 with undefined PATH yields empty string (not 'undefined')", () => {
  expect(resolveSubprocessPath("win32", "C:\\Users\\x", undefined)).toBe("");
});

test("darwin prepends the POSIX tool dirs + ~/.local/bin", () => {
  const p = resolveSubprocessPath("darwin", "/Users/x", "/existing");
  expect(p).toBe("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/x/.local/bin");
});

test("linux uses the same POSIX list as darwin", () => {
  expect(resolveSubprocessPath("linux", "/home/x", "/existing"))
    .toBe("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/home/x/.local/bin");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test .claude/bin/loop-subprocess-path.test.ts`
Expected: FAIL — cannot find module `./loop-subprocess-path.ts`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// .claude/bin/loop-subprocess-path.ts
// Pure helper extracted from claude-loop-tick.ts so the OS-conditional PATH logic
// is unit-testable WITHOUT triggering the tick's load-time side effects (the tick
// runs acquireLock()/heartbeat() at module top-level, not behind import.meta.main).
//
// macOS/Linux: the launchd/systemd worker starts with a minimal PATH, so the tick
// must inject the standard tool dirs. Windows: the Task Scheduler task runs in the
// user session and inherits the full user PATH (bun/git/gh/dotnet already resolvable),
// so REPLACING PATH with a POSIX list would erase it and break every subprocess.
import { join } from "node:path";

export function resolveSubprocessPath(
  platform: NodeJS.Platform,
  home: string,
  existingPath: string | undefined,
): string {
  if (platform === "win32") {
    return existingPath ?? "";
  }
  return `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${join(home, ".local/bin")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test .claude/bin/loop-subprocess-path.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the helper into the tick**

In `.claude/bin/claude-loop-tick.ts`, add to the imports near the top (after the existing `node:*` imports):

```typescript
import { resolveSubprocessPath } from "./loop-subprocess-path.ts";
```

Replace the `env` block inside `run()` (currently):

```typescript
        env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${join(home, ".local/bin")}`,
        },
```

with:

```typescript
        env: {
            ...process.env,
            PATH: resolveSubprocessPath(process.platform, home, process.env.PATH),
        },
```

- [ ] **Step 6: Verify the tick still type-checks / runs a dry heartbeat**

Run (Windows): `$env:ZETA_CLAUDE_LOOP_LOG_DIR="$env:TEMP\zeta-tick-test"; $env:ZETA_CLAUDE_LOOP_STATE_DIR="$env:TEMP\zeta-tick-test\state"; $env:ZETA_CLAUDE_LOOP_WORKTREE=(git rev-parse --show-toplevel); bun .claude/bin/claude-loop-tick.ts`
Expected: exits 0; `$env:TEMP\zeta-tick-test\runner.log` contains a `heartbeat complete …` line. (git fetch may report a non-zero status if offline — that's logged, not fatal.)

- [ ] **Step 7: Commit**

```powershell
git add .claude/bin/loop-subprocess-path.ts .claude/bin/loop-subprocess-path.test.ts .claude/bin/claude-loop-tick.ts
git commit -m "fix(loop-tick): OS-conditional subprocess PATH (inherit on Windows, POSIX list on macOS/Linux)`n`nThe tick replaced process.env.PATH with a POSIX list, erasing PATH on Windows and breaking git/gh/bun/claude resolution. Extract resolveSubprocessPath() (testable) and inherit the user-session PATH on win32.`n`nCo-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Task Scheduler XML template

**Files:**

- Create: `tools/persistence/windows/scheduled-task.xml`

- [ ] **Step 1: Write the template**

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>Zeta / Lucent-Financial-Group</Author>
    <Description>Zeta autonomous-loop background worker (user-mode parity with the macOS launchd LaunchAgent). Runs .claude/bin/claude-loop-tick.ts each minute.</Description>
    <URI>\{{TASK_NAME}}</URI>
  </RegistrationInfo>
  <Principals>
    <Principal id="Author">
      <UserId>{{USER_ID}}</UserId>
      <LogonType>InteractiveToken</LogonType>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Count>3</Count>
      <Interval>PT1M</Interval>
    </RestartOnFailure>
  </Settings>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>{{USER_ID}}</UserId>
      <Repetition>
        <Interval>PT1M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </LogonTrigger>
  </Triggers>
  <Actions Context="Author">
    <Exec>
      <Command>{{PWSH_PATH}}</Command>
      <Arguments>-NoProfile -ExecutionPolicy Bypass -File "{{WRAPPER_PATH}}"</Arguments>
      <WorkingDirectory>{{REPO_ROOT}}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
```

Schema verified against this machine's exported `OneDrive Startup Task` (real user-mode,
Limited, logon-triggered task): `encoding="UTF-16"`, `InteractiveToken`, **no `<RunLevel>`**
(→ Limited), `MultipleInstancesPolicy=IgnoreNew`. `ExecutionTimeLimit=PT0S` = no limit.
`<Repetition>` without `<Duration>` + `StopAtDurationEnd=false` = indefinite.

> **Fallback if `schtasks /Create /XML` rejects the no-`Duration` repetition:** add
> `<Duration>P3650D</Duration>` (10y) inside `<Repetition>`. Verify in Task 4 Step 6.

- [ ] **Step 2: Commit**

```powershell
git add tools/persistence/windows/scheduled-task.xml
git commit -m "feat(persistence/windows): Task Scheduler XML template for user-mode loop`n`nCo-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Installer pure functions (TDD)

**Files:**

- Create: `tools/persistence/windows/install-scheduled-task.ts` (pure functions first)
- Test: `tools/persistence/windows/install-scheduled-task.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tools/persistence/windows/install-scheduled-task.test.ts
import { test, expect } from "bun:test";
import { xmlEscape, substitutePlaceholders, toUtf16WithBom, parseArgs } from "./install-scheduled-task.ts";

test("xmlEscape escapes the five XML entities", () => {
  expect(xmlEscape(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
});

test("substitutePlaceholders fills all and leaves none", () => {
  const tpl = "<U>{{USER_ID}}</U><W>{{WRAPPER_PATH}}</W>";
  const out = substitutePlaceholders(tpl, { USER_ID: "S-1-5-21", WRAPPER_PATH: "C:\\w & x.ps1", TASK_NAME: "T", PWSH_PATH: "p", REPO_ROOT: "r" });
  expect(out).toBe("<U>S-1-5-21</U><W>C:\\w &amp; x.ps1</W>");
});

test("substitutePlaceholders throws on an unknown leftover placeholder", () => {
  expect(() => substitutePlaceholders("{{NOT_A_KEY}}", { USER_ID: "", WRAPPER_PATH: "", TASK_NAME: "", PWSH_PATH: "", REPO_ROOT: "" }))
    .toThrow(/NOT_A_KEY/);
});

test("toUtf16WithBom prefixes BOM and encodes UTF-16LE", () => {
  const buf = toUtf16WithBom("AB");
  // BOM 0xFF 0xFE, then 'A'=0x41 0x00, 'B'=0x42 0x00
  expect([...buf]).toEqual([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
});

test("parseArgs defaults: heartbeat-first, no register, no dry-run", () => {
  const a = parseArgs([]);
  expect(a.runClaude).toBe(false);
  expect(a.register).toBe(false);
  expect(a.dryRun).toBe(false);
  expect(a.taskName).toBe("ZetaOttoLoop");
});

test("parseArgs reads flags", () => {
  const a = parseArgs(["--task-name", "Foo", "--run-claude", "--model", "opus", "--dry-run", "--register"]);
  expect(a.taskName).toBe("Foo");
  expect(a.runClaude).toBe(true);
  expect(a.model).toBe("opus");
  expect(a.dryRun).toBe(true);
  expect(a.register).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/persistence/windows/install-scheduled-task.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Write the pure functions**

```typescript
#!/usr/bin/env bun
// tools/persistence/windows/install-scheduled-task.ts
// Install Zeta's autonomous-loop worker as a USER-MODE Windows Task Scheduler task.
// Windows parity for tools/shadow/launchd/install-launchagent.ts.
//
//   bun tools/persistence/windows/install-scheduled-task.ts            # dry-run-safe: prints help if no --register/--dry-run
//   bun tools/persistence/windows/install-scheduled-task.ts --dry-run  # print rendered XML
//   bun tools/persistence/windows/install-scheduled-task.ts --register # register/replace the task
//
// Flags: --task-name <n> --run-claude --model <m> --bun-path <p> --repo-root <p> --dry-run --register
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, isAbsolute, resolve } from "node:path";
import { execFileSync } from "node:child_process";

export interface Args {
  taskName: string;
  runClaude: boolean;
  model: string;
  bunPath?: string;
  repoRoot?: string;
  dryRun: boolean;
  register: boolean;
}

export type Placeholders = Record<"TASK_NAME" | "USER_ID" | "PWSH_PATH" | "WRAPPER_PATH" | "REPO_ROOT", string>;

export function xmlEscape(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function substitutePlaceholders(template: string, vals: Placeholders): string {
  let out = template;
  for (const [k, v] of Object.entries(vals)) {
    out = out.replaceAll(`{{${k}}}`, xmlEscape(v));
  }
  const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) throw new Error(`Unsubstituted placeholder(s): ${[...new Set(leftover)].join(", ")}`);
  return out;
}

export function toUtf16WithBom(content: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, "utf16le")]);
}

export function parseArgs(argv: string[]): Args {
  const a: Args = { taskName: "ZetaOttoLoop", runClaude: false, model: "sonnet", dryRun: false, register: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const next = (name: string): string => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) { throw new Error(`Missing value for ${name}`); }
      return v;
    };
    switch (t) {
      case "--task-name": a.taskName = next("--task-name"); break;
      case "--model": a.model = next("--model"); break;
      case "--bun-path": a.bunPath = next("--bun-path"); break;
      case "--repo-root": a.repoRoot = next("--repo-root"); break;
      case "--run-claude": a.runClaude = true; break;
      case "--dry-run": a.dryRun = true; break;
      case "--register": a.register = true; break;
      case "--help": case "-h": a.dryRun = false; a.register = false; break;
      default: throw new Error(`Unknown argument: ${t}`);
    }
  }
  return a;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/persistence/windows/install-scheduled-task.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```powershell
git add tools/persistence/windows/install-scheduled-task.ts tools/persistence/windows/install-scheduled-task.test.ts
git commit -m "feat(persistence/windows): installer pure functions (xmlEscape, substitute, utf16, parseArgs) + tests`n`nCo-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Installer `main()` + schtasks registration

**Files:**

- Modify: `tools/persistence/windows/install-scheduled-task.ts` (append detection + main)

- [ ] **Step 1: Append detection helpers + main()**

```typescript
function detectRepoRoot(override?: string): string {
  if (override) { if (!isAbsolute(override)) throw new Error(`--repo-root must be absolute: ${override}`); return override; }
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
}

function detectBun(override?: string): string {
  // The installer runs UNDER bun, so process.execPath IS the bun binary.
  return override ?? process.execPath;
}

function detectUserSid(): string {
  // whoami /user /fo csv -> header + "DOMAIN\user","S-1-5-...". Take the SID field.
  const out = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" }).trim();
  const m = out.match(/"([^"]+)","(S-[0-9-]+)"/);
  if (!m) throw new Error(`Could not parse SID from whoami /user: ${out}`);
  return m[2];
}

function detectPwsh(): string {
  for (const exe of ["pwsh.exe", "powershell.exe"]) {
    try { return execFileSync("where.exe", [exe], { encoding: "utf8" }).trim().split(/\r?\n/)[0]; } catch { /* try next */ }
  }
  throw new Error("Neither pwsh.exe nor powershell.exe found on PATH");
}

export function renderXml(repoRoot: string, args: Args): string {
  const here = join(repoRoot, "tools/persistence/windows");
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
  void detectBun(args.bunPath); // validated/available; wrapper resolves bun itself at runtime
  const xml = renderXml(repoRoot, args);

  if (!args.register || args.dryRun) {
    process.stdout.write(xml + "\n");
    if (!args.register) console.error("\n(dry run — pass --register to install the task)");
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "zeta-schtask-"));
  const xmlPath = join(dir, "task.xml");
  try {
    writeFileSync(xmlPath, toUtf16WithBom(xml));
    try { execFileSync("schtasks.exe", ["/Delete", "/TN", args.taskName, "/F"], { stdio: "ignore" }); } catch { /* not present */ }
    execFileSync("schtasks.exe", ["/Create", "/TN", args.taskName, "/XML", xmlPath, "/F"], { stdio: "inherit" });
    console.error(`Registered user-mode task "${args.taskName}". Verify: schtasks /Query /TN ${args.taskName}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) { main(); }
```

- [ ] **Step 2: Re-run unit tests (no regressions)**

Run: `bun test tools/persistence/windows/install-scheduled-task.test.ts`
Expected: PASS (6 tests; importing the module must not trigger `main()` — guarded by `import.meta.main`).

- [ ] **Step 3: Dry-run renders valid substituted XML**

Run: `bun tools/persistence/windows/install-scheduled-task.ts --dry-run`
Expected: prints the XML with the real SID / pwsh path / wrapper path / repo root; **no `{{…}}` left**.

- [ ] **Step 4: Commit**

```powershell
git add tools/persistence/windows/install-scheduled-task.ts
git commit -m "feat(persistence/windows): installer main() + schtasks /Create registration`n`nCo-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: PowerShell wrapper

**Files:**

- Create: `tools/persistence/windows/otto-loop-wrapper.ps1`

- [ ] **Step 1: Write the wrapper**

```powershell
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Repo root: this script lives at <repo>/tools/persistence/windows/
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$LogDir   = Join-Path $env:LOCALAPPDATA 'zeta-otto-loop'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Optional: pick up PATH/tooling the install graph generated (slice 2). Best-effort.
$ShellEnv = Join-Path $env:USERPROFILE '.config\zeta\shellenv.ps1'
if (Test-Path $ShellEnv) { . $ShellEnv }

# Loop config — heartbeat-first (slice-1 default). Uncomment to enable harness-launch.
$env:ZETA_CLAUDE_LOOP_WORKTREE  = $RepoRoot
$env:ZETA_CLAUDE_LOOP_STATE_DIR = Join-Path $LogDir 'state'
$env:ZETA_CLAUDE_LOOP_LOG_DIR   = $LogDir
# $env:ZETA_CLAUDE_LOOP_RUN_CLAUDE = '1'
# $env:ZETA_CLAUDE_LOOP_MODEL      = 'sonnet'

Set-Location $RepoRoot
$bun = (Get-Command bun -ErrorAction SilentlyContinue).Source
if (-not $bun) {
    "$(Get-Date -Format o) ERROR bun not found on PATH" | Out-File -Append (Join-Path $LogDir 'wrapper.err')
    exit 1
}

& $bun '.claude/bin/claude-loop-tick.ts' *>> (Join-Path $LogDir 'wrapper.log')
exit $LASTEXITCODE
```

- [ ] **Step 2: Smoke-test the wrapper directly**

Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/persistence/windows/otto-loop-wrapper.ps1; echo "exit=$LASTEXITCODE"`
Expected: `exit=0`; `%LOCALAPPDATA%\zeta-otto-loop\runner.log` shows a `heartbeat complete …` line.

- [ ] **Step 3: Commit**

```powershell
git add tools/persistence/windows/otto-loop-wrapper.ps1
git commit -m "feat(persistence/windows): per-tick PowerShell wrapper (env + bun claude-loop-tick)`n`nCo-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: README

**Files:**

- Create: `tools/persistence/windows/README.md`

- [ ] **Step 1: Write the README** — cover: what it is (user-mode parity with launchd),
  install (`bun … --register`), verify (`schtasks /Query /TN ZetaOttoLoop /XML`,
  `Get-ScheduledTask -TaskName ZetaOttoLoop`), logs (`%LOCALAPPDATA%\zeta-otto-loop\`),
  enable harness-launch (uncomment `ZETA_CLAUDE_LOOP_RUN_CLAUDE` in wrapper), uninstall
  (`schtasks /Delete /TN ZetaOttoLoop /F`), and the launchd cross-reference. Include the
  parity table from the spec.

- [ ] **Step 2: Commit**

```powershell
git add tools/persistence/windows/README.md
git commit -m "docs(persistence/windows): install/verify/uninstall README`n`nCo-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: End-to-end registration test + backlog row

- [ ] **Step 1: Register the task for real (user-mode)**

Run: `bun tools/persistence/windows/install-scheduled-task.ts --register`
Expected: `SUCCESS: The scheduled task "ZetaOttoLoop" has successfully been created.`

- [ ] **Step 2: Verify user-mode + schema**

Run: `schtasks /Query /TN ZetaOttoLoop /V /FO LIST | Select-String "Run As User|Logon Mode|Schedule|Repeat"`
Also: `(Get-ScheduledTask -TaskName ZetaOttoLoop).Principal | Format-List RunLevel,LogonType`
Expected: `RunLevel : Limited`, `LogonType : InteractiveToken` (← user-mode, no admin). If `/Create` rejected the repetition, apply the `<Duration>P3650D</Duration>` fallback (Task 2) and re-run.

- [ ] **Step 3: Force a run + confirm the heartbeat**

Run: `schtasks /Run /TN ZetaOttoLoop; Start-Sleep 8; Get-Content "$env:LOCALAPPDATA\zeta-otto-loop\runner.log" -Tail 5`
Expected: a `heartbeat complete run_id=… fetch=… open_prs=… claude=wait …` line.

- [ ] **Step 4: File the backlog row** `docs/backlog/P2/B-NNNN-windows-pre-install-surface-parity-2026-05-30.md`
  (next free B-NNNN per `otto-channels-reference-card` ID-allocation: check `git ls-tree origin/main docs/backlog` + `gh pr list`). Status open; slice 1 done, slices 2/3 pending; link both `docs/plans/2026-05-30-windows-parity-*` docs. Regenerate index: `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts`.

- [ ] **Step 5: Final unit-test sweep + commit**

```powershell
bun test .claude/bin/loop-subprocess-path.test.ts tools/persistence/windows/install-scheduled-task.test.ts
git add docs/backlog/ docs/BACKLOG.md
git commit -m "docs(backlog): B-NNNN Windows pre-install-surface parity (slice 1 done)`n`nCo-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 6: Push + open PR** against `main` (`gh pr create --head feat/windows-parity-2026-05-30 --base main`), arm auto-merge after review.

---

## Self-review

- **Spec coverage:** schtasks XML (T2) ✓, wrapper (T5) ✓, TS installer mirror (T3+T4) ✓,
  PATH fix (T1) ✓, tests (T1,T3) ✓, README (T6) ✓, reuse-tick-via-env ✓ (wrapper sets
  `ZETA_CLAUDE_LOOP_*`), UTF-16 ✓ (`toUtf16WithBom`), LeastPrivilege-by-omission ✓ (XML),
  IgnoreNew ✓, flipped battery/network/idle defaults ✓, backlog row ✓ (T7), RUN_CLAUDE
  heartbeat-first ✓ (commented in wrapper).
- **Placeholders:** none — every code step has complete code; `B-NNNN` resolved at T7-S4 via the documented ID-allocation query.
- **Type consistency:** `Args` / `Placeholders` defined in T3 and reused in T4 (`renderXml`, `parseArgs`); `resolveSubprocessPath(platform, home, existingPath)` signature identical in T1 test + impl + tick call site.
