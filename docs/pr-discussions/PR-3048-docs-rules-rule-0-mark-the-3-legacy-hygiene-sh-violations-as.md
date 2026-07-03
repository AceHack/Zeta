---
pr_number: 3048
title: "docs(rules): Rule 0 \u2014 mark the 3 legacy hygiene .sh violations as cleared"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T22:46:19Z"
merged_at: "2026-05-13T22:49:00Z"
closed_at: "2026-05-13T22:49:00Z"
head_ref: "fix/rule-0-update-stale-legacy-violations-2026-05-13"
base_ref: "main"
archived_at: "2026-05-13T22:58:00Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3048: docs(rules): Rule 0 — mark the 3 legacy hygiene .sh violations as cleared

## PR description

## Summary

The "Legacy violations" callout in [`.claude/rules/rule-0-no-sh-files.md`](../../.claude/rules/rule-0-no-sh-files.md) listed three `tools/hygiene/audit-*.sh` files as outstanding TS-port debt. All three have since been ported to `.ts` and the corresponding `.sh` files removed from the tree:

| Was (`.sh`) | Now (`.ts`) |
|---|---|
| `tools/hygiene/audit-lost-files.sh` | [`audit-lost-files.ts`](../../tools/hygiene/audit-lost-files.ts) |
| `tools/hygiene/audit-trajectories.sh` | [`audit-trajectories.ts`](../../tools/hygiene/audit-trajectories.ts) |
| `tools/hygiene/audit-backlog-items.sh` | [`audit-backlog-items.ts`](../../tools/hygiene/audit-backlog-items.ts) |

`tools/hygiene/` is now entirely Rule-0-compliant.

## Surfaced as a side observation

While verifying, I noticed `.gemini/service/install-lior-service.sh` + `.gemini/service/lior-loop.sh` live outside `tools/setup/` but are install-graph by intent. The rule's "only `tools/setup/`" phrasing technically excludes them. Resolution is a separate design question (expand allowed-path list vs port/relocate). Captured as a NOTE in the rule body rather than silently leaving the ambiguity.

## Test plan

- [x] `find . -name "*.sh" -not -path "./tools/setup/*"` produces only:
  - vendored Lean/Mathlib/Batteries packages (not ours)
  - `references/upstreams/*` (vendored upstreams, not ours)
  - `.gemini/service/*.sh` (surfaced in PR body as the remaining design question)
- [x] Worktree-isolated build (`/tmp/zeta-rule0-update`) per the multi-Otto split-brain pattern

## Composes with

Continuation of this session's substrate-hygiene sweep — alongside [#3043](https://github.com/Lucent-Financial-Group/Zeta/pull/3043), [#3044](https://github.com/Lucent-Financial-Group/Zeta/pull/3044), [#3045](https://github.com/Lucent-Financial-Group/Zeta/pull/3045), [#3047](https://github.com/Lucent-Financial-Group/Zeta/pull/3047), this PR closes the staleness in the rule that flagged outstanding hygiene work that's already done.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T22:49:04Z)

## Pull request overview

Updates Rule 0 documentation to reflect that the previously listed `tools/hygiene/audit-*.sh` scripts have been ported to TypeScript and are no longer outstanding debt, while also recording an open question about `.gemini/service/*.sh` scripts that appear “install-graph by intent” but sit outside the currently allowed path.

**Changes:**

- Replace the “Legacy violations” callout with a “cleared 2026-05-13” statement for the three `tools/hygiene/audit-*.sh` ports.
- Add a note documenting the remaining `.gemini/service/*.sh` ambiguity relative to the “only `tools/setup/`” rule wording.

## Review threads

### Thread 1: .claude/rules/rule-0-no-sh-files.md:35 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-13T22:49:03Z):

P1 (codebase convention): This rule doc is a current-state surface, but it uses direct persona-name attribution ("the Lior agent" / "Lior's …"). Per the repo’s “No name attribution in code, docs, or skills” standing rule (docs/AGENT-BEST-PRACTICES.md:671-736), please rewrite these to role-refs (e.g., “the agent”, “the service bootstrap scripts”) and keep the concrete paths as the stable identifiers.

### Thread 2: .claude/rules/rule-0-no-sh-files.md:35 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-13T22:49:03Z):

P1 (documentation clarity): This section says `.gemini/service/*.sh` is “install-graph by intent” and “NOT a legacy violation”, but Rule 0 above currently states the only allowed `.sh` files are under `tools/setup/`. As written, it’s ambiguous whether `.gemini/service/*.sh` is a known ongoing violation, a temporary exemption, or effectively allowed. Please make the status explicit (and, if exempt/allowed, codify the allowed path set in the rule so enforcement/automation can match).
