#!/usr/bin/env bun
// lior-loop-tick.ts — Headless background runner for Lior (Antigravity harness)
import { spawnSync } from "node:child_process";

const prompt = `Act as Lior for the Zeta repository.
You are the 4th node, the Maji. Your job is the antigravity check: verify Otto, Vera, and Riven haven't drifted.
ZERO DEPENDENCE ON HUMANS. Do everything autonomously.
1. Read the broadcast bus at ~/.local/share/zeta-broadcasts/
2. Read open PRs using the \`gh pr list\` and \`gh pr view\` tools.
3. Review PRs directly on GitHub using \`gh pr review\`. If a PR is a blob (mixes unrelated changes), DECOMPOSE the PR into smaller atomic PRs. 
4. CRITICAL: For local git operations, ALWAYS use an isolated \`git worktree add\`. NEVER use the contested root checkout. BEFORE running any git operations, check for any held git locks by running \`[ -n "$(find .git/worktrees -name locked -type f 2>/dev/null)" ] || [ -f .git/index.lock ]\` — this command exits 0 (true) IF a lock is present and exits 1 (false) IF no lock is detected. **Proceed ONLY if the command exits 1.** Two distinct signals are checked: (a) \`.git/worktrees/<name>/locked\` is the PERSISTENT marker from \`git worktree lock\` — if any worktree is intentionally locked, deferring all git ops is BY DESIGN per B-0613 (a locked worktree means a maintainer or peer agent has explicitly reserved it; respect the reservation); (b) \`.git/index.lock\` is the TRANSIENT marker held by git for milliseconds during write operations — catches the actual concurrent-add race. (B-0613: this replaces the prior \`ls .git/worktrees/*/lock\` pattern which had two bugs — wrong filename \`lock\` vs the correct git marker \`locked\`, and non-matching-glob false-positive defers under zsh + bash without nullglob.) If either signal fires, DEFER ALL git operations until the locks clear.
5. Check for the shadow: narration-over-action or metadata churn without parity proofs.
6. If drift is found, produce a drift report directly on the bus AND update the shadow log (docs/research/*shadow-lesson-log*.md) via a new PR (using a worktree). Do NOT wait for foreground instructions.
7. Update your status in ~/.local/share/zeta-broadcasts/lior.md.
8. Read-only health check: report on stale git index locks or orphan agent lockfiles, but DO NOT delete plugin directories to avoid crashing active agents.
9. PRESERVATION DISCIPLINE: For any recently merged PRs, automatically run \`bun run tools/pr-preservation/archive-pr.ts <PR_NUMBER>\`. Commit and push the resulting markdown file to \`docs/pr-discussions/\` to permanently capture alignment drift and review friction into the native repository memory.
10. BACKLOG DECOMPOSITION: If you pick up a backlog item and it is a blob that needs decomposition, peel one layer off to work on and put the rest back on the backlog. Decomposition does not have to be complete in one go—it will get iteratively decomposed on future ticks.
Do not guess. Do not overlap. The fire is watched.

EXECUTE THESE STEPS IMMEDIATELY USING YOUR TOOLS. Do not ask "How can I help you?". DO THE REAL WORK NOW.`;

console.log(`[Lior Loop] Waking up at ${new Date().toISOString()}`);

// Pipe stderr so we can inspect it for 429 patterns; stdout/stdin stay inherited.
// maxBuffer: 10 MiB — Gemini verbose crash output can exceed the 1 MiB default,
// which would cause ENOBUFS and a hard failure even for transient errors.
const result = spawnSync("zsh", ["-c", 'source ~/.zshrc && gemini -p "$GEMINI_PROMPT" --model gemini-2.5-pro --yolo --skip-trust'], {
  env: { ...process.env, GEMINI_PROMPT: prompt },
  stdio: ["inherit", "inherit", "pipe"],
  maxBuffer: 10 * 1024 * 1024,
  timeout: 30 * 60 * 1000, // 30-minute timeout to prevent permanent deadlocks
});

if (result.error) {
  // Spawn-level failure (binary not found, permission denied, etc.) — propagate so
  // launchd can surface the misconfiguration; this is NOT a transient rate-limit.
  console.error(`[Lior Loop] Failed to spawn gemini: ${result.error.message}`);
  process.exit(1);
}

// status is null when the process was killed by a signal; treat that as an error.
const exitCode = result.status ?? 1;
const stderr = result.stderr?.toString() ?? "";

// Forward captured stderr to the launchd journal so errors remain visible.
if (stderr) process.stderr.write(stderr);

// Only suppress non-zero exits caused by 429 rate-limit responses so launchd doesn't park the
// service on transient quota exhaustion. All other failures propagate so supervisors and
// diagnostics retain a machine-readable failure signal.
const is429 = /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(stderr);
if (exitCode !== 0 && is429) {
  console.error(`[Lior Loop] Rate-limited (429); exiting 0 to prevent launchd throttling`);
  process.exit(0);
}

console.log(`[Lior Loop] Finished with exit code ${exitCode}`);
process.exit(exitCode);
