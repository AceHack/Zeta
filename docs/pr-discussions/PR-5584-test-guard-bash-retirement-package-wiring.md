---
pr_number: 5584
title: "test: guard bash retirement package wiring"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T18:51:32Z"
merged_at: "2026-05-27T19:03:43Z"
closed_at: "2026-05-27T19:03:43Z"
head_ref: "claim/codex-loop-bash-retirement-wiring-guard-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:18:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5584: test: guard bash retirement package wiring

## PR description

## Summary

- add a focused Bun test that pins `hygiene:check-bash-retirement-inventory` to the enforcing inventory guard command
- preserves the Codex claim file for the bash-retirement wiring guard work

## Checks

- bun test tools/hygiene/check-bash-retirement-inventory.test.ts
- bun run hygiene:check-bash-retirement-inventory

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T18:53:40Z)

## Pull request overview

This PR strengthens the “bash retirement” hygiene guard by adding a Bun test that pins the `hygiene:check-bash-retirement-inventory` package script to the enforcing (`--enforce`) inventory guard command, and it adds a Codex claim file related to that work.

**Changes:**

- Add a Bun test asserting `package.json` script wiring for `hygiene:check-bash-retirement-inventory`.
- Add a new claim file under `docs/claims/` documenting the Codex work session and intended scope.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| tools/hygiene/check-bash-retirement-inventory.test.ts | Adds a test that asserts the `package.json` script points to the enforcing inventory guard. |
| docs/claims/codex-loop-bash-retirement-wiring-guard-20260527.md | Adds a claim record for the Codex wiring-guard work session. |

## Review threads

### Thread 1: tools/hygiene/check-bash-retirement-inventory.test.ts:44 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T18:53:39Z):

This new test reads `package.json` via a relative path (`readFileSync("package.json", ...)`), which makes the test depend on the current working directory. Most tooling/tests in this repo derive the repo root from `import.meta.dir` (or `git rev-parse`) to stay cwd-independent; this test will fail if someone runs it from a subdirectory or with a different `cwd`. Consider resolving the path from `import.meta.dir` (e.g., `resolve(import.meta.dir, "../..", "package.json")`) before reading.

### Thread 2: tools/hygiene/check-bash-retirement-inventory.test.ts:51 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T18:53:40Z):

This assertion is inside `describe("buildInventoryReport")`, but it doesn't test `buildInventoryReport`—it tests `package.json` script wiring. Keeping unrelated checks in the same describe block makes failures harder to triage. Consider moving this test into its own `describe("package.json wiring")` (or similar) block.

### Thread 3: docs/claims/codex-loop-bash-retirement-wiring-guard-20260527.md:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T18:53:40Z):

Per the claim protocol, when opening a PR (or landing work), the corresponding claim file should be deleted in the same PR (`git rm docs/claims/<slug>.md`). Adding/preserving this claim file in a PR that lands the work contradicts the protocol (docs/AGENT-CLAIM-PROTOCOL.md:139-145) and will cause `docs/claims/` to accumulate completed claims on main.
