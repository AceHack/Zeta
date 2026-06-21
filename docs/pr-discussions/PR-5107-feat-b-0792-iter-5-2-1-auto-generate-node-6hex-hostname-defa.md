---
pr_number: 5107
title: "feat(081KSGS9H0008QG0R003V23XNZ iter-5.2.1): auto-generate node-<6hex> hostname default \u2014 operator can rename later via digital-twin (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:52:18Z"
merged_at: "2026-05-26T06:03:06Z"
closed_at: "2026-05-26T06:03:06Z"
head_ref: "otto-cli/iter521-auto-generated-hostname-default-digital-twin-renamable-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:42:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5107: feat(081KSGS9H0008QG0R003V23XNZ iter-5.2.1): auto-generate node-<6hex> hostname default — operator can rename later via digital-twin (Aaron 2026-05-26)

## PR description

Composes iter-5.2 --host mechanism with 081KSGS9H0008QG0R0027HJZYH digital-twin substrate. Zero-typing default when --host omitted: generate `node-<6hex>` via Web Crypto (24-bit entropy, ~16M names, negligible collision). Operator-named hosts take priority. Logged clearly pre-flash. Aaron 2026-05-26: 'can we have it auto generate the host name we can change later via digital twin after it self registers.'

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:54:50Z)

## Pull request overview

Adds a zero-typing default hostname for `zflash` when `--host` is omitted, generating a random `node-<6hex>` name and printing it pre-flash so the operator can SSH in post-install (with the intent to allow later renames via the digital-twin workflow).

**Changes:**
- Auto-generate `node-<6hex>` hostname via Web Crypto when `--host` is not provided (and `--no-inject` is not set).
- Print a clear pre-flash message showing the generated hostname and an example `ssh zeta@<host>.local` target.

## Review threads

### Thread 1: full-ai-cluster/tools/zflash.ts:933 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:54:49Z):

P0: The hostname is auto-generated and printed before `willInject` is finalized / before the pubkey existence check. If the pubkey is missing, `willInject` becomes false later, so the tool will still show an auto-generated hostname even though it will never be written to the USB (operator will try to SSH to a hostname that wasn't set). Generate/print the default only when the hostname inject will actually run (e.g., after the pubkey existence check, or gate on pubkey existence / `willInject`).

### Thread 2: full-ai-cluster/tools/zflash.ts:910 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:54:49Z):

This comment points operators to `maintainers/<name>/cluster-nodes/<node>/` and ArgoCD reconciliation, but that subtree doesn't exist in the repo yet (currently `maintainers/aaron/` only contains `legal-entities/`). Consider rewording to avoid a concrete path until 081KSGS9H0008QG0R0027HJZYH lands (e.g., reference the 081KSGS9H0008QG0R0027HJZYH backlog doc or say “via the digital-twin node-config in maintainers/<name>/cluster-nodes/ (once 081KSGS9H0008QG0R0027HJZYH is deployed)”).

## General comments

### @chatgpt-codex-connector (2026-05-26T05:52:23Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
