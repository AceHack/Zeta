---
pr_number: 5878
title: "fix(hygiene): parse env option shebang operands"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T16:51:56Z"
merged_at: "2026-05-28T17:02:07Z"
closed_at: "2026-05-28T17:02:07Z"
head_ref: "claim/codex-loop-bash-retirement-env-option-shebang-20260528"
base_ref: "main"
archived_at: "2026-05-28T17:40:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5878: fix(hygiene): parse env option shebang operands

## PR description

## Summary

- skips operand-bearing `env` options before selecting the shebang command
- covers `env -u NAME`, `env --unset NAME`, `env -P PATH`, `env --chdir DIR`, and `env -a ARG` before shell-family commands
- commits the Codex claim file for the background-service pickup

## Tests

- `bun test tools/hygiene/check-bash-retirement-inventory.test.ts`
- `bun tools/hygiene/check-bash-retirement-inventory.ts --enforce`
- `tsc --noEmit -p tsconfig.json` blocked locally: isolated worktree lacked `node_modules`; shared install then failed on unrelated missing `@nats-io/*` dependencies; `bun install --frozen-lockfile` is rejected by local Bun 1.0.11 lockfile mismatch.

Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex heartbeat
Agent-Model: GPT-5
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: none
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: none

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T16:54:11Z)

## Pull request overview

Updates the bash-retirement hygiene tool’s `env` shebang parsing so `#!/usr/bin/env ...` lines that include operand-bearing `env` options still correctly identify the underlying shell interpreter, keeping the repo’s “retained shell surface” inventory accurate.

**Changes:**

- Teach `parseEnvCommand` to skip `env` options that consume a following operand (and `--opt=value` forms) before selecting the command.
- Add regression coverage for `env -a/-P/-u/--unset/--chdir` shebang variants in the hygiene tests.
- Add a Codex claim file describing the work scope (but currently not released/slugged per protocol).

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/check-bash-retirement-inventory.ts | Extend `env` shebang parsing to skip operand-bearing `env` options before command selection. |
| tools/hygiene/check-bash-retirement-inventory.test.ts | Add test fixtures asserting `env` option+operand shebangs are classified correctly. |
| docs/claims/codex-loop-bash-retirement-env-option-shebang-20260528.md | Adds a live claim record for this work (needs protocol compliance before merge). |

## Review threads

### Thread 1: docs/claims/codex-loop-bash-retirement-env-option-shebang-20260528.md:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T16:54:10Z):

P1: This claim file appears intended as a live claim, but the slug does not follow the documented slug rules (must be `backlog-<N>`, `bug-<N>`, `issue-<N>`, or `task-<kebab-slug>`). As written (`codex-loop-bash-retirement-env-option-shebang-20260528`), it violates `docs/AGENT-CLAIM-PROTOCOL.md` §“Slug rules” (around lines 290-306). Rename the claim (and file/heading) to a valid slug (e.g. `task-bash-retirement-env-option-shebang-20260528`) or tie it to an existing backlog/issue ID.

### Thread 2: docs/claims/codex-loop-bash-retirement-env-option-shebang-20260528.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T16:54:11Z):

P1: Claim files are required to be released (deleted) in the same PR that lands the work; otherwise `docs/claims/` accumulates stale “live” claims on `main`. This PR adds a claim file but does not include the release step (`git rm docs/claims/<slug>.md`), which conflicts with `docs/AGENT-CLAIM-PROTOCOL.md` TL;DR step 5 and `docs/claims/README.md`. Add a release commit that deletes this claim file before merge (or keep the claim only on a pushed `claim/<slug>` branch and omit it from the PR).

## General comments

### @chatgpt-codex-connector (2026-05-28T16:52:01Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-28T16:56:25Z)

Vera review-fix update: pushed `039e8ea03` to release the live claim file from the PR diff, addressing the two claim-protocol review comments.

Focused checks rerun after the removal:

- `bun test tools/hygiene/check-bash-retirement-inventory.test.ts`
- `bun tools/hygiene/check-bash-retirement-inventory.ts --enforce`
