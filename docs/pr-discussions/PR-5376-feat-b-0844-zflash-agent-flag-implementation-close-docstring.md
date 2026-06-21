---
pr_number: 5376
title: "feat(081KSGS9H0008QG0R001EZKNCB): zflash --agent flag implementation \u2014 close docstring-vs-implementation gap"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T01:57:19Z"
merged_at: "2026-05-27T02:00:10Z"
closed_at: "2026-05-27T02:00:10Z"
head_ref: "feat-b0844-impl-zflash-agent-flag-spawn-piped-auto-type-challenge-otto-cli-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5376: feat(081KSGS9H0008QG0R001EZKNCB): zflash --agent flag implementation — close docstring-vs-implementation gap

## PR description

## What

Implements 081KSGS9H0008QG0R001EZKNCB \`--agent\` flag per [PR #5374](https://github.com/Lucent-Financial-Group/Zeta/pull/5374) row spec. Empirical anchor: 2026-05-26 3rd USB re-flash session surfaced docstring-vs-implementation gap (operator: *"i got the fingerprint but it didn't format"*).

## Implementation

- New \`--agent\` flag in \`ALLOWED_FLAGS\` + help text
- When \`--agent\` passed: \`spawn\` with \`stdio: ["pipe", "pipe", "inherit"]\` instead of \`execFileSync({stdio: "inherit"})\`
- Pipe stdout: scan for \`yes <4hex>\` challenge → mirror to operator stdout
- Pipe stdin: auto-type \`yes <nonce>\n\` when challenge detected, close stdin
- Inherit stderr: Touch ID PAM prompt + errors visible
- Glass-halo: \`[agent-mode: auto-typing yes XXXX — operator visibility per glass-halo-bidirectional rule]\` printed BEFORE auto-type
- Default behavior unchanged (no \`--agent\` = current execFileSync path)

## Preserves all safety rails

- **Touch ID PAM gate** fires on operator's Mac for \`sudo dd\`; cannot be agent-bypassed
- **Nonce randomness** preserved (per-run random; agent reads from stdout)
- **Runtime acceptance** preserved (typing exact challenge IS acceptance)
- **All flash-usb sanity rails** still fire

## Verified

- \`bun full-ai-cluster/tools/zflash.ts --help\` shows \`--agent\` entry with full doc text
- TypeScript compiles cleanly
- Backward-compatible (default invocation unchanged)

## Test path post-merge

Re-run today's 3rd USB-test session with:

\`\`\`bash
bun full-ai-cluster/tools/zflash.ts --agent 2>&1 | tail -100
\`\`\`

Should show "Flash complete." + iter-4.2 inject + ejection with the auto-typed challenge visible in glass-halo log line.

## Composes with

- 081KSGS9H0008QG0R001EZKNCB (parent row — PR #5374)
- \`.claude/rules/substrate-or-it-didnt-happen.md\` (docstring promise now has backing substrate)
- \`.claude/rules/glass-halo-bidirectional.md\` (auto-type action is operator-visible)
- \`.claude/rules/non-coercion-invariant.md\` HC-8 (operator agency preserved via Touch ID PAM gate)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T01:57:24Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
