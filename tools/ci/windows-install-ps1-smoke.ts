#!/usr/bin/env bun
// tools/ci/windows-install-ps1-smoke.ts
//
// Asserts the outcomes of tools/setup/install.ps1 on a Windows machine. Shared by two surfaces:
//   --mode desktop   : full graph INCL. the ZetaOttoLoop scheduled task (the loop runs this on a
//                      real Win 10/11 desktop via otto-loop-wrapper.ps1)
//   --mode container : tool-install graph ONLY. A Windows container has no interactive session,
//                      so the user-mode scheduled task can't run there — that check is a PRINTED
//                      skip-with-reason, NEVER a silent green
//                      (per .claude/rules/automated-tests-are-the-shield-assert-dont-skip.md).
//
//   bun tools/ci/windows-install-ps1-smoke.ts --mode desktop
//   bun tools/ci/windows-install-ps1-smoke.ts --mode container
//
// Exit 0 = all checks passed; 1 = one or more FAILED; 2 = bad usage.
import { execFileSync } from "node:child_process";

export type Mode = "desktop" | "container";

/** Pure: does `schtasks /Query /XML` show a <Repetition><Duration> AND a populated Next Run? */
export function taskHasDurationAndNextRun(
  taskXml: string,
  verboseList: string,
): { durationPresent: boolean; nextRunPopulated: boolean } {
  const durationPresent = /<Duration>\s*P/.test(taskXml);
  const m = verboseList.match(/Next Run Time:\s*(.+)/);
  const nextRun = (m?.[1] ?? "").trim();
  const nextRunPopulated = nextRun.length > 0 && !/^N\/A$/i.test(nextRun);
  return { durationPresent, nextRunPopulated };
}

/** Pure: does `mise ls`-style output list the given tool (token match, not substring)? */
export function miseProvidesTool(miseListOutput: string, tool: string): boolean {
  return miseListOutput
    .split(/\r?\n/)
    .map((l) => l.trim())
    .some((l) => new RegExp(`(^|\\s)${tool}(\\s|@|$)`).test(l));
}

/** Pure: system-command checks that run in BOTH modes. */
export const SHARED_COMMANDS = ["scoop", "git", "mise"] as const;

/** Pure: checks skipped in container mode — each with the reason printed (not silently dropped). */
export const CONTAINER_SKIPS: Record<string, string> = {
  "loop-task":
    "a Windows container has no interactive session; the user-mode scheduled task can't run there (the desktop-smoke covers it)",
};

function have(cmd: string): boolean {
  try {
    execFileSync("where.exe", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf("--mode");
  const mode = (idx >= 0 ? argv[idx + 1] : undefined) as Mode | undefined;
  if (mode !== "desktop" && mode !== "container") {
    console.error("usage: windows-install-ps1-smoke.ts --mode desktop|container");
    process.exit(2);
  }

  const failures: string[] = [];
  const pass = (m: string): void => console.log(`  PASS  ${m}`);
  const fail = (m: string): void => {
    failures.push(m);
    console.error(`  FAIL  ${m}`);
  };

  for (const cmd of SHARED_COMMANDS) {
    if (have(cmd)) pass(`${cmd} on PATH`);
    else fail(`${cmd} not on PATH`);
  }

  try {
    const ls = execFileSync("mise", ["ls", "--installed"], { encoding: "utf8" });
    if (miseProvidesTool(ls, "bun")) pass("mise provides bun (.mise.toml)");
    else fail("mise does not list bun");
  } catch {
    fail("could not run `mise ls --installed`");
  }

  try {
    const g = execFileSync("mise", ["exec", "--", "bun", "pm", "ls", "-g"], { encoding: "utf8" });
    if (g.includes("claude-code")) pass("claude-code installed (bun --global)");
    else fail("claude-code not in bun global packages");
  } catch {
    fail("could not check bun global packages");
  }

  if (mode === "desktop") {
    try {
      const xml = execFileSync("schtasks", ["/Query", "/TN", "ZetaOttoLoop", "/XML"], { encoding: "utf8" });
      const v = execFileSync("schtasks", ["/Query", "/TN", "ZetaOttoLoop", "/V", "/FO", "LIST"], { encoding: "utf8" });
      const h = taskHasDurationAndNextRun(xml, v);
      if (h.durationPresent && h.nextRunPopulated) pass("ZetaOttoLoop healthy (Repetition Duration + Next Run populated)");
      else fail(`ZetaOttoLoop unhealthy (durationPresent=${h.durationPresent}, nextRunPopulated=${h.nextRunPopulated})`);
    } catch {
      fail("could not query the ZetaOttoLoop task");
    }
  } else {
    for (const [k, reason] of Object.entries(CONTAINER_SKIPS)) console.log(`  SKIP  ${k} — ${reason}`);
  }

  if (failures.length > 0) {
    console.error(`\nwindows-install-ps1-smoke (${mode}): ${failures.length} FAILED`);
    process.exit(1);
  }
  console.log(`\nwindows-install-ps1-smoke (${mode}): all checks passed`);
}

if (import.meta.main) main();
