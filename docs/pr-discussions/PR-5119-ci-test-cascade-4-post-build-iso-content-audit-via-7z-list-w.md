---
pr_number: 5119
title: "ci(test-cascade-4): post-build ISO content audit via 7z list (would have caught Aaron's stale-ISO issue) (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T07:07:28Z"
merged_at: "2026-05-26T07:10:14Z"
closed_at: "2026-05-26T07:10:14Z"
head_ref: "otto-cli/ci-test-cascade-4-iso-content-audit-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:41:18Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5119: ci(test-cascade-4): post-build ISO content audit via 7z list (would have caught Aaron's stale-ISO issue) (Aaron 2026-05-26)

## PR description

Cascade #4 of 5 (per Aaron 2026-05-26 'start working on the CI stuff while we iterate'). Complements #1 (source-substrate preflight; merged via #5116) by catching the bug class where ISO build silently drops files present in source. New `tools/ci/audit-installer-iso-content.ts` (7z list of built ISO; asserts nix-store.squashfs + boot/{bzImage,initrd,grub/grub.cfg} present). Workflow step inserted between 'Build installer ISO' + 'Locate ISO' — failure skips upload, broken-ISO artifact never reaches operators. Composes with #5116 audit.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T07:10:17Z)

## Pull request overview

Adds a CI “post-build floor” that audits the *built* AI-cluster installer ISO contents (via `7z` listing) to catch cases where the ISO build silently omits expected files, complementing the existing source-substrate preflight audit.

**Changes:**

- Introduces `tools/ci/audit-installer-iso-content.ts` to list ISO contents with `7z` and assert required top-level paths are present.
- Inserts a new workflow step in `build-ai-cluster-iso.yml` between ISO build and ISO metadata capture to fail the job before artifact upload if the ISO content audit fails.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| tools/ci/audit-installer-iso-content.ts | New Bun/TS ISO content audit tool that shells out to `7z` and checks required paths. |
| .github/workflows/build-ai-cluster-iso.yml | Adds a post-build ISO content audit step prior to locating/uploading the ISO artifact. |

## Review threads

### Thread 1: tools/ci/audit-installer-iso-content.ts:159 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:10:15Z):

Exit-code contract is inconsistent: `auditIsoContent` returns a string when the ISO path doesn't exist, but `main()` treats any string result as a `return 2` ("7z listing failed"), even though the header comment says exit code 1 is for "ISO file not found / invocation error". Consider returning a structured error with a specific code (or special-casing the missing-file message) so missing ISO paths exit 1 and 7z failures exit 2 as documented.

### Thread 2: tools/ci/audit-installer-iso-content.ts:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:10:16Z):

The header comment says this audit asserts `nix-store.squashfs` is "present + non-empty", but the implementation only checks presence in the 7z listing. Either implement a size>0 assertion for that entry (parse `Size =` from `7z l -slt`) or update the comment so the tool’s guarantees match reality.

### Thread 3: tools/ci/audit-installer-iso-content.ts:112 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:10:16Z):

`spawnSync("7z", ...)` will typically trip eslint-plugin-sonarjs `no-os-command-from-path` in this repo (many other tools add an explicit eslint-disable with rationale when spawning PATH-resolved binaries). Add the standard suppression+rationale here to avoid CI lint failures, or refactor to satisfy the rule.

### Thread 4: tools/ci/audit-installer-iso-content.ts:113 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:10:16Z):

If `7z` is missing, `spawnSync` sets `r.error` and leaves `status` as null; current code returns an empty stderr string, producing an unhelpful failure message. Include `r.error?.message` (and/or `r.signal`) in the returned error so local runs clearly report that `7z` wasn’t found or couldn’t be executed.

### Thread 5: .github/workflows/build-ai-cluster-iso.yml:120 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:10:17Z):

This step assumes `iso_candidates[0]` exists under `set -u`; if `find` returns no matches (or multiple), the failure mode will be an unbound-variable error rather than a clear workflow error. Mirror the explicit 0/1+ candidate checks already implemented in the later "Locate ISO + capture metadata" step so this audit fails with a targeted message.

## General comments

### @chatgpt-codex-connector (2026-05-26T07:07:34Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
