---
pr_number: 5211
title: "backlog(B-0812 P1 iter-5.4.1): self-registration commit+push to maintainers/<operator>/cluster-nodes"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:21:47Z"
merged_at: "2026-05-26T16:23:14Z"
closed_at: "2026-05-26T16:23:14Z"
head_ref: "otto-cli/b0812-iter-5-4-1-self-registration-commit-push-to-maintainers-cluster-nodes-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:23Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5211: backlog(B-0812 P1 iter-5.4.1): self-registration commit+push to maintainers/<operator>/cluster-nodes

## PR description

## Summary

Decomposes B-0794 sub-target 3 (cluster-self-registration) into iter-5.4.1 — the natural follow-on slice after **iter-5.4.0** (PR #5210, currently building) lands the gh-auth foothold.

## What iter-5.4.1 adds beyond iter-5.4.0

| Slice | What it does | Status |
|---|---|---|
| **iter-5.4.0** (PR #5210) | gh auth login at install time → `gh ssh-key list` → operator SSH pubkeys to authorized_keys | building |
| **iter-5.4.1** (THIS row) | Same gh-auth foothold + probe hardware → compose node.yaml → commit+push to `maintainers/<operator>/cluster-nodes/<hostname>/` → open registration PR | this row |
| **iter-5.4.2** (future row) | ArgoCD app watches the tree → reconciles K8s on PR-merge | not yet filed |

Each slice ships independently. iter-5.4.1 depends on iter-5.4.0 landing first.

## Substrate-inventory pass

Per `.claude/rules/verify-existing-substrate-before-authoring.md` (#5131):
- `grep -rlF "iter-5.4.1"` → unused; safe
- ID B-0812 next-free per `git ls-tree origin/main`
- All composes_with targets (B-0794, B-0789, B-0790, B-0782) verified on main

## Test plan

- [x] Substrate-inventory pass before authoring
- [x] BACKLOG.md regenerated
- [x] Frontmatter conforms to backlog row schema
- [x] No code changes; backlog row only

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T16:21:52Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
