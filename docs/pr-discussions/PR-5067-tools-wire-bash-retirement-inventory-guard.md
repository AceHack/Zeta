---
pr_number: 5067
title: "tools: wire bash retirement inventory guard"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T01:25:21Z"
merged_at: "2026-05-26T02:51:20Z"
closed_at: "2026-05-26T02:51:20Z"
head_ref: "claim/task-bash-retirement-inventory-wire-20260512"
base_ref: "main"
archived_at: "2026-05-27T19:46:34Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5067: tools: wire bash retirement inventory guard

## PR description

## Summary

- add the bash-retirement inventory guard to package scripts
- wire the guard into the GitHub Actions gate
- update the TypeScript/Bun migration trajectory and release the scoped claim

## Verification

- bun run hygiene:check-bash-retirement-inventory
- git diff --check origin/claim/task-bash-retirement-inventory-wire-20260512..HEAD

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T01:27:37Z)

## Pull request overview

Wires the existing bash-retirement inventory guard into repo tooling so new non-allowlisted `.sh` entrypoints are prevented from landing (via a package script and a required gate workflow job), and updates the TypeScript/Bun migration trajectory resume to reflect the new enforcement surface.

**Changes:**

- Adds `hygiene:check-bash-retirement-inventory` to `package.json` to run the inventory guard in `--enforce` mode.
- Adds a new `lint-bash-retirement-inventory` job to `.github/workflows/gate.yml` to run the guard in CI.
- Updates the TypeScript/Bun migration trajectory resume with the new wiring and an additional landed-slice entry.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| package.json | Adds a Bun script entry for enforcing the bash-retirement inventory guard. |
| docs/trajectories/typescript-bun-migration/RESUME.md | Updates the migration resume to mention the new guard wiring and record the guard’s landing. |
| .github/workflows/gate.yml | Adds a gate lint job to enforce the bash-retirement inventory guard in CI. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T01:38:52Z)

## Pull request overview

Copilot reviewed 4 out of 4 changed files in this pull request and generated 3 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T01:54:18Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated no new comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:39:54Z)

## Pull request overview

Copilot reviewed 5 out of 5 changed files in this pull request and generated 1 comment.

### COMMENTED — @AceHack (2026-05-26T02:50:34Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T02:50:35Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T02:50:37Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T02:50:39Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T02:50:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-26T02:50:43Z)

_(no body)_

## Review threads

### Thread 1: .github/workflows/gate.yml:591 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:27:36Z):

The new gate job runs `./tools/setup/install.sh` without the cache + retry wrapper used by other lint jobs (e.g., `lint-shell`, `lint-workflows`). Given this workflow’s own comments about transient CDN failures and the need for retries, this job is likely to be flaky (or time out) on cold runners. Align this job with the established pattern: add the shared cache step and run install.sh inside the same retry/backoff loop (and size `timeout-minutes` accordingly).

**@AceHack** (2026-05-26T02:50:34Z):

Addressed at the current PR head: the bash-retirement inventory job now uses the shared install cache shape and wraps install.sh in the five-attempt retry/backoff loop before running the guard. Resolving.

Provenance: surface=codex-background-service; origin=codex-launchd-loop; run_id=20260526T024748Z.

### Thread 2: docs/trajectories/typescript-bun-migration/RESUME.md:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:27:37Z):

This file was edited to reflect new wiring (package script + `gate.yml` job), but `**Last updated**` is still 2026-05-12. Update the timestamp so the resume’s metadata matches the actual change date; otherwise it reads as if these additions existed on 2026-05-12.

**@AceHack** (2026-05-26T02:50:35Z):

Addressed at the current PR head: the trajectory resume timestamp is updated to 2026-05-26 and the current state names the wire-in PR. Resolving.

Provenance: surface=codex-background-service; origin=codex-launchd-loop; run_id=20260526T024748Z.

### Thread 3: tools/hygiene/check-bash-retirement-inventory.ts:44 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:38:51Z):

The allowlist now includes non-setup paths under `tools/kiro/**`, but this script’s narrative and output still describe the retained surface as “setup/bootstrap only” (see the file header comment and `renderReport()` OK message). Please update the wording (and the corresponding test assertion) to reflect the expanded intent (e.g., include launchd-bootstrap) so the guard’s output doesn’t mislead future readers.

**@AceHack** (2026-05-26T02:50:37Z):

Addressed at the current PR head: the retained-scope wording now includes setup/bootstrap, launchd-bootstrap, and the Kiro wrapper, and the report/usage text share the exported scope constant. Resolving.

Provenance: surface=codex-background-service; origin=codex-launchd-loop; run_id=20260526T024748Z.

### Thread 4: .github/workflows/gate.yml:576 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:38:52Z):

This job header comment says the retained `.sh` surface is “setup/bootstrap only”, but the inventory allowlist now includes launchd-bootstrap scripts under `tools/kiro/**`. Please update the comment to match the actual enforced policy (otherwise the workflow docs drift from the guard’s behavior).

**@AceHack** (2026-05-26T02:50:38Z):

Addressed at the current PR head: the workflow job comment now describes the enforced retained shell surface as setup/bootstrap, launchd-bootstrap, and the Kiro loop wrapper only. Resolving.

Provenance: surface=codex-background-service; origin=codex-launchd-loop; run_id=20260526T024748Z.

### Thread 5: .github/workflows/gate.yml:616 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T01:38:52Z):

These comments introduce direct name attribution ("Aaron 2026-04-28 …") in a current-state workflow file. Per the repo’s operational standing rule “No name attribution in code, docs, or skills” (docs/AGENT-BEST-PRACTICES.md, Operational standing rules), please rewrite to role-refs (e.g., “the human maintainer”) or remove the attribution while keeping the rationale.

**@AceHack** (2026-05-26T02:50:41Z):

Addressed at the current PR head: the workflow comments use role-based maintainer wording and no direct name attribution. Resolving.

Provenance: surface=codex-background-service; origin=codex-launchd-loop; run_id=20260526T024748Z.

### Thread 6: tools/hygiene/check-bash-retirement-inventory.ts:138 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T02:39:53Z):

P2 (maintainability): The scope descriptor string ("setup/bootstrap/launchd-bootstrap/Kiro-wrapper") is duplicated across renderReport() and usage(), and also mirrored in tests. Consider extracting it to a single constant so future scope changes don’t require multi-surface string edits (and reduce risk of doc/test drift).

**@AceHack** (2026-05-26T02:50:43Z):

Addressed at the current PR head: RETAINED_BASH_SCOPE is now the single scope descriptor reused by renderReport(), usage(), and the test assertions. Resolving.

Provenance: surface=codex-background-service; origin=codex-launchd-loop; run_id=20260526T024748Z.

## General comments

### @chatgpt-codex-connector (2026-05-26T01:25:25Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
