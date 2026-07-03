---
pr_number: 5808
title: "fix(codeberg-world): tsc TS2430 + TS6133 \u2014 unblocks #5805/#5806/#5807 CI (Omit<GiteaWorld, 'forgeSpecialization'> for literal narrowing)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T13:08:04Z"
merged_at: "2026-05-28T13:36:58Z"
closed_at: "2026-05-28T13:36:59Z"
head_ref: "otto-cli/fix-codeberg-world-tsc-unused-import-and-interface-extends-typing-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T14:13:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5808: fix(codeberg-world): tsc TS2430 + TS6133 — unblocks #5805/#5806/#5807 CI (Omit<GiteaWorld, 'forgeSpecialization'> for literal narrowing)

## PR description

PR #5804 merged with 2 tsc errors blocking downstream CI:

1. `LifetimeState` unused import (TS6133)
2. CodebergWorld extends GiteaWorld fails — `forgeSpecialization` literal narrows from 'gitea' to 'codeberg' (TS2430; literal types invariant)

Fix: remove unused import + use `Omit<GiteaWorld, 'forgeSpecialization'>` to drop inherited literal before re-declaring narrower 'codeberg'.

**6 tests pass; tsc clean on workflow-engine files.**

Unblocks #5805 (AutoLoopLifetime) + #5806 (muscle-memory carving) + #5807 (trajectory carving) tsc gates.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:10:13Z)

## Pull request overview

This PR unblocks downstream workflow-engine CI by fixing two TypeScript compile errors introduced in #5804: removing an unused import (TS6133) and correcting `CodebergWorld`’s type relationship to `GiteaWorld` to avoid an interface-extends incompatibility caused by narrowing a literal type (TS2430).

**Changes:**

- Remove unused `LifetimeState` import from `codeberg-world.ts` (TS6133).
- Redefine `CodebergWorld` to extend `Omit<GiteaWorld, "forgeSpecialization">` and then redeclare `forgeSpecialization: "codeberg"` (fixes TS2430).

## Review threads

### Thread 1: tools/workflow-engine/codeberg-world.ts:37 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:10:12Z):

P1 (docs): The doc comment lists CodebergWorld additions like `codeOfConduct` / `terms-of-service`, but the interface only adds `hostingPolicy` and `communityGoverned` (plus `forgeSpecialization`). Either add the documented fields or update the comment bullets to match the actual properties to avoid misleading consumers.

## General comments

### @chatgpt-codex-connector (2026-05-28T13:08:10Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-28T13:19:06Z)

Hello! I noticed that there are a number of failing lint checks on this PR. You can see the details of the failing checks here: https://github.com/Lucent-Financial-Group/Zeta/pull/5808/checks.

To prevent this in the future, you may want to run the linter locally before pushing your changes.

Thank you for your contribution!
