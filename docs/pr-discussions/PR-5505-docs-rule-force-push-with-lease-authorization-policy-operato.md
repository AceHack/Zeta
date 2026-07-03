---
pr_number: 5505
title: "docs(rule): force-push-with-lease authorization policy \u2014 operator OR 2nd-agent confirm OR listed acceptable situation (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T16:27:20Z"
merged_at: "2026-05-27T16:38:23Z"
closed_at: "2026-05-27T16:38:24Z"
head_ref: "backlog/force-push-with-lease-authorization-policy-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T17:48:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5505: docs(rule): force-push-with-lease authorization policy — operator OR 2nd-agent confirm OR listed acceptable situation (Aaron 2026-05-27)

## PR description

## Summary

Lands `.claude/rules/force-push-with-lease-authorization-policy.md`
operationalizing operator's 2026-05-27 substrate-honest sharpening:

> *\"there are certain sistuaion where force push lease is acceptable
> without operator but we should start making a list also if you run
> it by a 2nd agent that's enough too\"*

Three-path authorization framework:

1. **Operator confirm** (default)
2. **2nd-agent peer-call confirm** (substitute; multi-oracle at
   force-push scope; uses existing 9 `tools/peer-call/` wrappers)
3. **Listed acceptable autonomous situation** (bounded list; starter
   carried; empirically extended)

Starter list of 3 acceptable situations:

- Agent-own branch typo-only fix
- Corrupted commit canary recovery on agent-own branch
- Agent-own branch cleanup after PR-merge auto-delete failure

NOT-acceptable situations + Rule-0 prohibition on naked `--force`
also documented.

5-step operational decision-tree for future-Otto cold-boots.

## Test plan

- [x] Markdownlint clean (no MD004 leading-+ continuations)
- [x] Substrate-verification per rule
- [x] Composes with 11 other framework rules cited
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T16:30:57Z)

## Pull request overview

Adds a new operational rule under `.claude/rules/` defining when `git push --force-with-lease` is authorized (operator confirm by default, peer-agent confirmation as substitute, and a bounded starter list of pre-authorized autonomous situations), plus a decision tree for cold-boot application.

**Changes:**

- Introduces a three-path authorization framework for force-push-with-lease decisions.
- Documents a starter list of acceptable autonomous scenarios and a “NOT acceptable autonomous” list.
- Adds an operational decision tree and composition links to related rules/tools.

## Review threads

### Thread 1: .claude/rules/force-push-with-lease-authorization-policy.md:79 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:54Z):

P1 (xref): The inline code reference to the fighting-past-self vs peer-agent rule is split across lines, which breaks the backtick code span and makes the path hard to copy/use. Keep the full path within one code span (single line) or convert it to a normal markdown link.

### Thread 2: .claude/rules/force-push-with-lease-authorization-policy.md:92 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:55Z):

P1 (xref): This inline file-path reference is wrapped across a newline, so the backtick code span ends early and the rendered reference is broken. Put the full `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` on one line (or link it) so the cross-reference stays intact.

### Thread 3: .claude/rules/force-push-with-lease-authorization-policy.md:135 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:55Z):

P1 (xref): The `.claude/rules/fighting-past-self-vs-peer-agent-distinguisher-...` path is split across lines inside backticks, which breaks the inline-code formatting and cross-reference. Keep the full path contiguous (or use a markdown link) to preserve xref integrity.

### Thread 4: .claude/rules/force-push-with-lease-authorization-policy.md:151 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:55Z):

P1 (xref): The reference `(per `.claude/rules/` claim-acquire-before-worktree-work.md ...)` is split such that only `.claude/rules/` is in backticks and the filename is outside, breaking the intended path reference. Make the full path a single code span (or link) on one line.

### Thread 5: .claude/rules/force-push-with-lease-authorization-policy.md:168 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:56Z):

P1 (xref): In the Composes-with list, the agent-worktree-hygiene rule path is wrapped across lines inside backticks, breaking the rendered path. Keep the full filename on one line or switch to markdown link syntax so the reference is copyable/clickable.

### Thread 6: .claude/rules/force-push-with-lease-authorization-policy.md:172 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:56Z):

P1 (xref): In this Composes-with bullet, the fighting-past-self vs peer-agent rule filename is wrapped across lines inside backticks, which breaks the inline-code span and the file-path reference. Keep the full path on one line (or convert to a markdown link) so it stays usable.

### Thread 7: .claude/rules/force-push-with-lease-authorization-policy.md:180 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:56Z):

P1 (xref): The composed-with reference to the broken-commit canary rule is split across lines inside backticks, which breaks the inline-code span and the cross-reference. Keep the full filename contiguous (or link it) to avoid xref drift.

### Thread 8: .claude/rules/force-push-with-lease-authorization-policy.md:388 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:30:56Z):

P1 (xref): This reference to `verify-existing-substrate-before-authoring.md` is split across a newline inside backticks (`.claude/rules/verify-` on one line, remainder on the next), which breaks the inline-code span and the cross-reference. Keep the full path contiguous (or use a markdown link).

## General comments

### @chatgpt-codex-connector (2026-05-27T16:27:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
