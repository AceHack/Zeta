---
pr_number: 5817
title: "fix(.mise.toml): bump uv 0.11.8 \u2192 0.11.16 \u2014 cascade-unblocks 21/25 PRs' CI lint"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T13:27:48Z"
merged_at: "2026-05-28T13:33:04Z"
closed_at: "2026-05-28T13:33:04Z"
head_ref: "otto-cli/fix-mise-uv-pin-0-11-8-to-0-11-16-cascade-unblock-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T14:13:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5817: fix(.mise.toml): bump uv 0.11.8 → 0.11.16 — cascade-unblocks 21/25 PRs' CI lint

## PR description

## Summary

Bumps the mise `uv` pin from `0.11.8` to `0.11.16` (current upstream stable, published 2026-05-21). Empirically root-causes the CI lint cascade affecting **21 of 25 open PRs** today.

## Empirical evidence

Every open PR's `lint (semgrep)` (the only required-failed check) plus ~10 non-required lint checks have been FAILING because the mise install step bails:

```
aqua:astral-sh/uv@0.11.8: HTTP status client error (404 Not Found)
  for url (https://api.github.com/repos/astral-sh/uv/releases/tags/0.11.8)
pipx:semgrep@1.161.0: Skipped due to failed dependency
```

The install exits 1 before any lint runs, so every lint job reports FAILURE. Repro: any of PR #5778, #5805, #5808, #5810, #5811, #5812 today; same shape on UNSTABLE PRs (#5781-#5797).

## Why 0.11.16

Per [`.claude/rules/dep-pin-search-first-authority.md`](.claude/rules/dep-pin-search-first-authority.md): the rule requires citing current upstream latest stable, not training-data defaults.

Authoritative cross-check:

- `gh api repos/astral-sh/uv/releases/latest` → `{"name":"0.11.16","published_at":"2026-05-21T22:11:32Z","tag_name":"0.11.16"}`
- [WebSearch 2026-05-28](https://github.com/astral-sh/uv/releases) → confirmed `0.11.16` is current stable

Bump is 8 patch releases (semver-disciplined; no breaking changes expected). uv is consumed in our toolchain only via `pipx:semgrep` (mise auto-routes `pipx:` through `uv tool install`).

## Root-cause hypothesis (whichever is actual, fix is same)

Either:

1. **Aqua release-cache pruned** `0.11.8` (released 2026-04-27, 7 weeks ago) between the original pin and today's CI run
2. **Anonymous GitHub API rate limit** on the CI runner converted into 404 from aqua's perspective

Bumping to current latest stable fixes both:

- (a) Fresh asset cache upstream
- (b) Most-recent release least likely to have been pruned

## Test plan

- [ ] CI green on this PR (must include `lint (semgrep)` passing)
- [ ] After merge, rebase + push any one currently-BLOCKED PR (e.g. #5778) and confirm its `lint (semgrep)` now passes
- [ ] Confirm the cascade clears across the remaining BLOCKED + UNSTABLE PRs

## Composes with

- [`.claude/rules/dep-pin-search-first-authority.md`](.claude/rules/dep-pin-search-first-authority.md) — empirical-anchor sibling to cascade #4 (NixOS 24.11 EOL) + cascade #5 (ISO grub path); same "Otto-defaults-to-plausible-but-unverified" root cause class at version-pin scope
- [`.claude/rules/blocked-green-ci-investigate-threads.md`](.claude/rules/blocked-green-ci-investigate-threads.md) — Pattern A (single-pin-bump unblocking many PRs at once)
- [`.claude/rules/refresh-before-decide.md`](.claude/rules/refresh-before-decide.md) — applied at per-version-pin scope, not just per-tick

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:30:51Z)

## Pull request overview

Bumps the root `.mise.toml` `uv` pin from `0.11.8` to `0.11.16` to unblock CI lint cascade failures across 21 of 25 open PRs. The `0.11.8` pin was returning `404 Not Found` from `aqua:astral-sh/uv@0.11.8`, causing `mise install` to exit 1 before any lint job (including the required `lint (semgrep)`) could run. `0.11.16` is the current upstream stable per `gh api repos/astral-sh/uv/releases/latest` and WebSearch (2026-05-21), satisfying `.claude/rules/dep-pin-search-first-authority.md`.

**Changes:**

- Bump `uv` from `0.11.8` to `0.11.16` in root `.mise.toml`
- Add inline comment documenting the empirical failure, the cited authoritative sources, and a release URL

## General comments

### @chatgpt-codex-connector (2026-05-28T13:27:53Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
