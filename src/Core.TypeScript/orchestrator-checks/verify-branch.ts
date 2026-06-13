#!/usr/bin/env bun
// verify-branch.ts -- harness pre-tool-use hook: blocks `git commit` when
// the current branch doesn't match an explicitly set ZETA_EXPECTED_BRANCH.
//
// Per docs/backlog/P1/B-0191-orchestrator-branch-verify-mechanization-design-aaron-2026-05-04.md
// (PR #1571). Wired into Claude Code via `.claude/settings.json` PreToolUse
// on Bash invocations matching `git commit`. Per-harness wiring documented
// in B-0191; the script itself is harness-agnostic.
//
// Exit codes:
//   0 -- branch matches expected (or no expectation set; script is no-op)
//   1 -- branch mismatch; commit should be blocked
//
// Composes with:
//   - memory/feedback_orchestrator_pre_commit_verify_branch_rule_aaron_2026_05_04.md
//     (the manual discipline this script mechanizes)
//   - memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md
//     (TS-over-bash + harness-hooks-suffice; no git hooks needed)
//   - memory/feedback_parallel_subagent_concurrency_lessons_cluster_aaron_2026_05_04.md
//     (the orchestrator-CWD-bleed-over hazard this catches)

import { spawnSync } from "node:child_process";

interface VerifyResult {
  readonly current: string;
  readonly expected: string;
  readonly match: boolean;
  readonly worktreeWarning: boolean;
}

// Worktree-suffix branch class (generic contributor pattern, not hard-coded
// to any specific name -- per the parallel-subagent-concurrency-cluster
// memory file's lesson on attributing tooling generically).
const WORKTREE_PATTERN =
  /^(research|fix\/memory-md-tier|feature|backlog|shard|memory-md|docs|feedback)\/.+-\d{4}-\d{2}-\d{2}$/;

export function verifyBranch(env: NodeJS.ProcessEnv = process.env): VerifyResult {
  const expected = env.ZETA_EXPECTED_BRANCH ?? "";
  const result = spawnSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git branch --show-current failed: ${result.stderr}`);
  }
  const current = result.stdout.trim();
  return {
    current,
    expected,
    match: !expected || current === expected,
    worktreeWarning: !expected && WORKTREE_PATTERN.test(current),
  };
}

function main(): number {
  const r = verifyBranch();
  if (!r.match) {
    console.error(`ERROR: Pre-commit branch mismatch.`);
    console.error(`  Expected: ${r.expected}`);
    console.error(`  Current:  ${r.current}`);
    console.error(
      `  Run \`git checkout ${r.expected}\` and verify, or unset ZETA_EXPECTED_BRANCH.`,
    );
    return 1;
  }
  if (r.worktreeWarning) {
    console.error(
      `INFO: committing on '${r.current}' -- worktree-suffix pattern. Verify this is intentional.`,
    );
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
