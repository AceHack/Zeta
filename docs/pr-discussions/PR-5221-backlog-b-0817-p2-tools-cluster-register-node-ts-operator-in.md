---
pr_number: 5221
title: "backlog(B-0817 P2): tools/cluster/register-node.ts \u2014 operator-invocation companion to deregister (B-0814)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:51:11Z"
merged_at: "2026-05-26T16:53:32Z"
closed_at: "2026-05-26T16:53:32Z"
head_ref: "otto-cli/b0817-register-node-ts-operator-invocation-companion-to-deregister-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5221: backlog(B-0817 P2): tools/cluster/register-node.ts — operator-invocation companion to deregister (B-0814)

## PR description

Symmetric counterpart to PR #5216 deregister tool. Two modes (compose / --from-yaml pass-through). Mirrors deregister discipline. Filed P2 because derived-by-symmetry, not Aaron-explicitly-named.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:53:36Z)

## Pull request overview

Adds a new P2 backlog row (B-0817) describing a proposed `tools/cluster/register-node.ts` operator tool (manual register/re-register counterpart to `deregister-node.ts`), and wires it into the main backlog index.

**Changes:**
- Add backlog row **B-0817** documenting goals, sub-targets, and acceptance for a manual cluster node registration tool.
- Update `docs/BACKLOG.md` to include **B-0817** under P2.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/B-0817-tools-cluster-register-node-ts-operator-invocation-companion-symmetric-to-deregister-for-manual-re-register-after-wipe-aaron-2026-05-26.md | New backlog row defining the `register-node.ts` tool scope/modes/acceptance and cross-links to related iter-5.4 work. |
| docs/BACKLOG.md | Adds B-0817 to the P2 index list. |

## Review threads

### Thread 1: docs/backlog/P2/B-0817-tools-cluster-register-node-ts-operator-invocation-companion-symmetric-to-deregister-for-manual-re-register-after-wipe-aaron-2026-05-26.md:23 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:53:34Z):

The B-0814 link here is relative to the current P2 directory, but the B-0814 row lives under docs/backlog/P1/. As written, the link target won't resolve.

### Thread 2: docs/backlog/P2/B-0817-tools-cluster-register-node-ts-operator-invocation-companion-symmetric-to-deregister-for-manual-re-register-after-wipe-aaron-2026-05-26.md:59 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:53:35Z):

Sub-target 1 says the tool may "probe via ssh" for missing --ip/--mac, but the Out of scope section later explicitly says auto-probing via SSH is out of scope. This is internally inconsistent and will confuse implementers about expected behavior.

### Thread 3: docs/backlog/P2/B-0817-tools-cluster-register-node-ts-operator-invocation-companion-symmetric-to-deregister-for-manual-re-register-after-wipe-aaron-2026-05-26.md:59 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:53:35Z):

Pass-through mode is described as an alternative to other flags, but Sub-target 1 also marks --host and --roles as required. If --from-yaml is intended to be a true pass-through, either relax the requirement (derive host/roles from YAML) or explicitly require --host/--roles and validate they match the YAML.

### Thread 4: docs/backlog/P2/B-0817-tools-cluster-register-node-ts-operator-invocation-companion-symmetric-to-deregister-for-manual-re-register-after-wipe-aaron-2026-05-26.md:84 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:53:35Z):

The YAML sketch uses `metadata.maintainer`, but Kubernetes ObjectMeta does not allow arbitrary fields under `metadata`. If you want to persist maintainer info, place it under `spec.registration` and/or `metadata.annotations` (which also aligns with the permissive CRD schema in B-0813).

## General comments

### @chatgpt-codex-connector (2026-05-26T16:51:16Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
