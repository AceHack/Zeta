#!/usr/bin/env bun
// verify-branch-pretooluse.ts -- Claude Code PreToolUse hook wrapper
// for tools/orchestrator-checks/verify-branch.ts.
//
// Reads stdin JSON per the Claude Code hooks contract
// (https://code.claude.com/docs/en/hooks-guide). Filters to
// `git commit` commands only — other Bash invocations exit 0
// immediately with zero overhead.
//
// When ZETA_EXPECTED_BRANCH is unset, the hook is a no-op
// (exits 0 before reading stdin or spawning any child process).
//
// Wired via .claude/settings.json PreToolUse matcher:"Bash".
// See .claude/hooks/README.md for configuration.
//
// Per 081KQR4HQ0008QG0R002YNV361 (PR #1571 design + PR #1585 implementation).

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
  return trimmed.startsWith("git commit") || trimmed.startsWith("git -C") && trimmed.includes("commit");
}

function main(): number {
  if (!process.env.ZETA_EXPECTED_BRANCH) {
    return 0;
  }

  let input: HookInput = {};
  try {
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
  const result = spawnSync(
    "bun",
    [`${projectDir}/tools/orchestrator-checks/verify-branch.ts`],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status === 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    return 0;
  }

  const reason = (result.stderr || "verify-branch check failed").trim();
  emitDeny(reason);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
