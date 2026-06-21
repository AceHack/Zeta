---
pr_number: 5029
title: "backlog(081KSE6WT0008QG0R001NG9JZH): HA control-plane \u2014 multi-master k3s embedded etcd + stable API endpoint"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:24:37Z"
merged_at: "2026-05-25T23:28:11Z"
closed_at: "2026-05-25T23:28:11Z"
head_ref: "otto-cli/b0756-ha-control-plane-etcd-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T23:44:56Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5029: backlog(081KSE6WT0008QG0R001NG9JZH): HA control-plane — multi-master k3s embedded etcd + stable API endpoint

## PR description

## Summary

Backlog row captured mid-081KSGS9H0008QG0R002T3BJ2R-v1 session: Aaron asked "if we support mutiple control plane nodes when i have two or more how is etcd involved?".

Architecture target: 1/3/5/7 odd-count control-plane HA via k3s embedded etcd raft quorum, with stable API endpoint via DNS round-robin (v1) or kube-vip/keepalived virtual IP (v2). Single-control-plane stays as easy default.

Three k3s control-plane modes proposed:

| Mode | Behavior |
|------|----------|
| `single` (default) | embedded SQLite, current behavior |
| `ha-init` | first CP node — `--cluster-init`, embedded etcd |
| `ha-join` | additional CP nodes — joins via `--server https://<bootstrap-cp>:6443` |

Even-count refusal at config-time (2/4/6 control-planes split-brain on partition).

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R (zero-typing first-boot — needs 'h' / 'j' keystroke options when HA mode is opted in)
- 081KSE6WT0008QG0R003612WGJ (role taxonomy expansion)

## Test plan

- [ ] Future PR implements `zeta.cluster.controlPlane.mode` option in `modules/k3s-server.nix`
- [ ] Future PR adds DNS round-robin path
- [ ] CI green on row file

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:28:18Z)

## Pull request overview

Adds a single P3 backlog row scoping future HA control-plane work for k3s: odd-count embedded-etcd quorum (1/3/5/7), explicit refusal of even counts, three opt-in modes (`single`/`ha-init`/`ha-join`), and a stable API endpoint via DNS round-robin (v1) or kube-vip/keepalived VIP (v2). The row composes with 081KSGS9H0008QG0R002T3BJ2R (zero-typing first-boot) and 081KSE6WT0008QG0R003612WGJ (role taxonomy).

**Changes:**
- New P3 backlog row `081KSE6WT0008QG0R001NG9JZH` capturing HA control-plane architecture target and acceptance criteria.
- Documents stable API endpoint options (DNS RR, kube-vip, external LB) and k3s embedded-etcd operational notes (snapshots, join token, removal).
- Cross-references planned extensions to 081KSGS9H0008QG0R002T3BJ2R's keystroke prompt and a future `zflash --ha-bootstrap-ip` flag.

## Review threads

### Thread 1: docs/backlog/P3/081KSE6WT0008QG0R001NG9JZH-ha-control-plane-multi-master-embedded-etcd-quorum-and-stable-api-endpoint-aaron-2026-05-25.md:11 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:28:18Z):

The frontmatter uses `size: L` and `labels: [...]` and omits `last_updated`, but the canonical backlog schema in `tools/backlog/README.md:57-73` defines `effort` (S/M/L) and `tags` (not `size`/`labels`), and lists `last_updated` as a required field. Neither `size` nor `labels` appear in the permissive lint allowlist in `tools/backlog/lint-frontmatter.ts:54-77`, so these will surface as non-schema-key findings (check 3). Rename `size` → `effort`, `labels` → `tags`, and add a `last_updated: 2026-05-25` field.

### Thread 2: docs/backlog/P3/081KSE6WT0008QG0R001NG9JZH-ha-control-plane-multi-master-embedded-etcd-quorum-and-stable-api-endpoint-aaron-2026-05-25.md:19 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:28:18Z):

The Problem statement says the current `modules/k3s-server.nix` configures a single-node control-plane with "default k3s backend = embedded SQLite", but both existing server modules already set `services.k3s.clusterInit = lib.mkDefault true`, which selects k3s's embedded etcd (not SQLite) even for a single node — see `infra/nixos/modules/k3s-server.nix:14-32` and `full-ai-cluster/nixos/modules/k3s-server.nix:12-25`. This affects the framing of the row: the migration is from "single-node embedded etcd" to "multi-node embedded etcd quorum", not from SQLite. Consider correcting so future implementers don't waste cycles on a non-existent datastore migration.

### Thread 3: docs/backlog/P3/081KSE6WT0008QG0R001NG9JZH-ha-control-plane-multi-master-embedded-etcd-quorum-and-stable-api-endpoint-aaron-2026-05-25.md:42 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:28:18Z):

The `single` mode in the Acceptance list is described as "embedded SQLite, current behavior", but the current default in both server modules is `clusterInit = lib.mkDefault true` (embedded etcd). To match present state, `single` should mean "single-node embedded etcd" (current behavior), and an explicit SQLite mode — if desired at all — should be called out as a new option rather than the current behavior.

## General comments

### @chatgpt-codex-connector (2026-05-25T23:24:41Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
