---
pr_number: 5455
title: "fix: require executable gcc path in Docker harness"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T13:43:50Z"
merged_at: "2026-05-27T13:47:27Z"
closed_at: "2026-05-27T13:47:28Z"
head_ref: "claim/codex-docker-cc-path-executable-check-20260527"
base_ref: "main"
archived_at: "2026-05-27T19:23:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5455: fix: require executable gcc path in Docker harness

## PR description

## Summary

- tighten the Docker NixOS install-sh harness gcc path guard from non-empty to executable
- keep the existing command -v lookup while failing earlier if PATH resolves a non-executable gcc path

## Checks

- git diff --check origin/main...HEAD
- codex loop health: ok, no lock before push

Co-Authored-By: Codex <noreply@openai.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T13:45:10Z)

## Pull request overview

This PR tightens the NixOS Docker install harness so the `gcc` path used to create `/usr/local/bin/cc` must resolve to an executable, preventing a broken compiler shim from being created.

**Changes:**

- Replaces the non-empty `gcc` path check with an executable check.
- Keeps the existing `command -v gcc` lookup and symlink behavior unchanged.

## General comments

### @chatgpt-codex-connector (2026-05-27T13:43:56Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
