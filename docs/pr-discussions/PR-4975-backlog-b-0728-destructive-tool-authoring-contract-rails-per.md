---
pr_number: 4975
title: "backlog(081KSE6WT0008QG0R0005XASX2): destructive-tool authoring contract (rails + permission-grants-invocation + runtime-acceptance gate)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T19:24:43Z"
merged_at: "2026-05-25T19:26:45Z"
closed_at: "2026-05-25T19:26:45Z"
head_ref: "backlog/b0728-destructive-tool-authoring-contract-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4975: backlog(081KSE6WT0008QG0R0005XASX2): destructive-tool authoring contract (rails + permission-grants-invocation + runtime-acceptance gate)

## PR description

## Summary

Codifies the pattern landed in PR #4974 (flash-usb.ts hardening) as a repo convention so future destructive tools follow the same shape. Three-part contract:

1. **Hard safety rails** — refuse known bad inputs early with class exit codes
2. **`.claude/settings.json` permission rule** grants INVOCATION, not absolution — path-scoped + reviewed alongside the target script in the same PR
3. **Runtime acceptance gate with per-run nonce** — runner types `accept-<verb> <target> <nonce>` to sign acceptance of responsibility; nonce makes pre-baked agent input infeasible

## Why now

Aaron 2026-05-25:
> *"this is a good flow now that addison and max are on the project i dont mind thinking about safety more"*
> *"i have 27 years of land-the-lesson-before-anyone-has-to-relearn-it. i can bake in over time"*

Solo-maintainer + single-trusted-agent: ceremony costs more than it pays back. Team + agents + new-to-CLI / new-to-K8s contributors: every safety rail is a contract everyone can audit.

## What's in the row

- Three-part contract explained
- TypeScript template for future destructive-tool authors
- Liability framing language for header / README / PR body
- Composition with framework's autonomy-first-class + NCI
- List of future destructive-tool candidates this contract would govern (wipe-cluster, restore-from-backup, rotate-master-keys, delete-pvc, drop-database, force-merge)
- Acceptance criteria for the codification work itself

## P2 because

Cheap to codify NOW; every destructive tool added after benefits. Becomes P1 if a destructive tool gets authored without following the contract.

Single file (+ index regen) — docs only; no code in this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T19:26:59Z)

## Pull request overview

Codifies a repository convention for authoring destructive CLI tools by documenting a three-part “destructive-tool authoring contract” (safety rails, path-scoped agent invocation permission, and a runtime acceptance gate with a per-run nonce) using `flash-usb.ts` as the canonical reference.

**Changes:**

- Adds a new P2 backlog row (081KSE6WT0008QG0R0005XASX2) documenting the destructive-tool contract, including a TypeScript skeleton/template.
- Regenerates `docs/BACKLOG.md` to include the new backlog entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSE6WT0008QG0R0005XASX2-destructive-tool-authoring-contract-rails-plus-permission-grants-invocation-plus-runtime-acceptance-gate-2026-05-25.md | New backlog row that defines the destructive-tool authoring contract and provides a template. |
| docs/BACKLOG.md | Index update to include 081KSE6WT0008QG0R0005XASX2 under P2. |

## Review threads

### Thread 1: docs/backlog/P2/081KSE6WT0008QG0R0005XASX2-destructive-tool-authoring-contract-rails-plus-permission-grants-invocation-plus-runtime-acceptance-gate-2026-05-25.md:52 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:26:59Z):

The exit-code contract here doesn’t match the “canonical reference” behavior in `full-ai-cluster/tools/flash-usb.ts`: that script uses exit 1 both for confirmation-gate aborts *and* for unexpected/unhandled errors in `main().catch(...)`. Either update this section to describe exit 1 as the generic “non-success after safety rails passed” class (abort or runtime failure), or change the reference implementation to use a distinct exit code for internal errors so the contract is accurate.

### Thread 2: docs/backlog/P2/081KSE6WT0008QG0R0005XASX2-destructive-tool-authoring-contract-rails-plus-permission-grants-invocation-plus-runtime-acceptance-gate-2026-05-25.md:141 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T19:26:59Z):

The TypeScript template includes imports (`execFileSync`, `spawn`) that aren’t used anywhere in the snippet. With this repo’s TS settings (`noUnusedLocals: true` in tsconfig), copy/pasting this skeleton into a real tool will fail typecheck/lint unless the author immediately edits imports. Consider removing unused imports from the template (or adding a clear placeholder use) so the template is “drop-in” for new scripts.
