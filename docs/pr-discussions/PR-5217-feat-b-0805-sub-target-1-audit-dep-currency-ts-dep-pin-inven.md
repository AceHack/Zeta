---
pr_number: 5217
title: "feat(081KSGS9H0008QG0R002BC2ZR7 sub-target 1): audit-dep-currency.ts \u2014 dep-pin inventory tool"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:34:16Z"
merged_at: "2026-05-26T16:38:33Z"
closed_at: "2026-05-26T16:38:33Z"
head_ref: "otto-cli/b0805-sub1-audit-dep-currency-tool-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:19Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5217: feat(081KSGS9H0008QG0R002BC2ZR7 sub-target 1): audit-dep-currency.ts — dep-pin inventory tool

## PR description

## Summary

Ships **081KSGS9H0008QG0R002BC2ZR7 sub-target 1** — `tools/audit/audit-dep-currency.ts`. Scans + reports all dep pins across the repo. Empirical: 81 pins on current main (29 helm charts + 35 ArgoCD targetRevisions + nix inputs + image tags + mise runtimes).

## What it does NOW

- Walks `full-ai-cluster/flake.nix` for `<name>.url = "..."` nix inputs
- Walks `full-ai-cluster/k8s/applications/**/*.yaml` for ArgoCD `targetRevision` + `chart`
- Walks `full-ai-cluster/**/*.{yaml,yml,nix}` for `image: <repo>:<tag>` patterns
- Walks `.mise.toml` `[tools]` section for runtime pins
- Output: human-readable markdown table (default) OR `--json` (machine-readable)

## What it does NOT do yet (081KSGS9H0008QG0R002BC2ZR7 sub-targets 2+)

- WebSearch / upstream-API "current latest" comparison
- Weekly cadence GitHub Actions wiring
- PR-opening on drift detection

These ship as sibling B-NNNN rows when implementation begins.

## Composes with

- 081KSGS9H0008QG0R002BC2ZR7 capstone (this is sub-target 1 of 3+)
- `.claude/rules/dep-pin-search-first-authority.md` (the discipline this tool operationalizes at scale)

## Test plan

- [x] Typecheck clean
- [x] Empirical run on current main: 81 pins surfaced
- [x] Bounded regex alternation lengths (regex-safety per guidance)
- [x] spawnSync with explicit args[] (no shell injection risk)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T16:34:21Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
