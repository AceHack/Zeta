#!/usr/bin/env bun
// check-md032-pretooluse.ts — Claude Code PreToolUse hook wrapper
// for tools/hygiene/check-md032-blanks-around-lists.ts.
//
// Reads stdin JSON per the Claude Code hooks contract
// (https://code.claude.com/docs/en/hooks-guide). Filters to
// `git commit` commands only — other Bash invocations exit 0
// immediately with zero overhead.
//
// When ZETA_MD032_PRECOMMIT is unset, the hook is a no-op
// (exits 0 before reading stdin or spawning any child process).
// The env-var gate is opt-in per the same pattern as
// `verify-branch-pretooluse.ts` (ZETA_EXPECTED_BRANCH) so the
// default commit experience is unchanged.
//
// Wired via .claude/settings.json PreToolUse matcher:"Bash".
// See .claude/hooks/README.md for configuration.
//
// Implements 081KRHWGX0008QG0R000JEBCWZ acceptance criterion #4: wire the MD032
// helper into the pre-commit harness hook.

import { spawnSync } from "node:child_process";

interface HookInput {
  readonly tool_name?: string;
  readonly tool_input?: { readonly command?: string };
}

interface HookOutput {
  readonly hookSpecificOutput: {
    readonly hookEventName: "PreToolUse";
    readonly permissionDecision: "allow" | "deny";
    readonly permissionDecisionReason?: string;
  };
}

function emitDeny(reason: string): never {
  const output: HookOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

function isGitCommitCommand(command: string): boolean {
  const trimmed = command.trimStart();
  return trimmed.startsWith("git commit") || (trimmed.startsWith("git -C") && trimmed.includes("commit"));
}

function main(): number {
  if (!process.env.ZETA_MD032_PRECOMMIT) {
    return 0;
  }

  let input: HookInput = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- mirror the verify-branch-pretooluse.ts pattern for synchronous stdin read.
    const stdin = require("fs").readFileSync(0, "utf8");
    input = JSON.parse(stdin) as HookInput;
  } catch {
    return 0;
  }

  const command = input.tool_input?.command ?? "";
  if (!isGitCommitCommand(command)) {
    return 0;
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- bun invoked as explicit args array; no shell, no user input.
  const result = spawnSync(
    "bun",
    [`${projectDir}/tools/hygiene/check-md032-blanks-around-lists.ts`, "--staged"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status === 0) {
    // No findings — the helper prints a one-line summary to stdout
    // that we propagate so the user can see the pre-check ran.
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }
    return 0;
  }

  // Helper found MD032 violations OR a git/index failure. Block the
  // commit and surface the helper's findings so the user can fix.
  const reason = (result.stderr || result.stdout || "MD032 pre-check failed").trim();
  emitDeny(`check-md032 pre-commit hook blocked the commit:\n${reason}`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
