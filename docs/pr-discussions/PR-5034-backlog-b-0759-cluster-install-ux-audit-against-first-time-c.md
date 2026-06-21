---
pr_number: 5034
title: "backlog(081KSE6WT0008QG0R003G0Y62D): cluster-install UX audit against first-time-CLI-user persona \u2014 'easier than Proxmox' bar + 3-node prod-ready inflection"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:36:04Z"
merged_at: "2026-05-25T23:48:30Z"
closed_at: "2026-05-25T23:48:30Z"
head_ref: "otto-cli/b0759-cluster-install-ux-audit-first-time-cli-persona-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T23:51:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5034: backlog(081KSE6WT0008QG0R003G0Y62D): cluster-install UX audit against first-time-CLI-user persona — 'easier than Proxmox' bar + 3-node prod-ready inflection

## PR description

Aaron 2026-05-25 named the cluster-install target persona: first-time command-line users; UX bar 'easier than Proxmox / unRAID for home clusters'; 3-node threshold = production-ready inflection (when 081KSE6WT0008QG0R001NG9JZH HA substrate + 081KSE6WT0008QG0R000CV98PV auto-discovery light up real cluster availability).

This row captures the audit work to apply the persona filter across every operator-facing cluster-install surface. Composes with the full 081KSE6WT0008QG0R003WZAQKV/081KSE6WT0008QG0R003BG8M6J/081KSE6WT0008QG0R0025170CV/081KSE6WT0008QG0R003WW3YJQ/081KSGS9H0008QG0R002T3BJ2R/081KSE6WT0008QG0R003612WGJ/081KSE6WT0008QG0R001NG9JZH/081KSE6WT0008QG0R000CV98PV/081KSE6WT0008QG0R00021PPX1 cluster substrate.

Also includes competitive framing table (vs Proxmox VE / unRAID / Talos / k3sup) and an empirical persona-bet test via external non-maintainer user.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:38:02Z)

## Pull request overview

Adds a new backlog row (081KSE6WT0008QG0R003G0Y62D) to capture a UX audit of the cluster-install experience against a “first-time CLI user” persona, and updates the generated backlog index to include the new row.

**Changes:**
- Added `docs/backlog/P2/081KSE6WT0008QG0R003G0Y62D-…md` defining the problem statement, target, acceptance criteria, and cross-references.
- Updated `docs/BACKLOG.md` to include 081KSE6WT0008QG0R003G0Y62D in the P2 section (and include 081KSE6WT0008QG0R000CV98PV in P3).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSE6WT0008QG0R003G0Y62D-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md | New P2 backlog row describing the cluster-install UX audit scope and acceptance criteria. |
| docs/BACKLOG.md | Regenerated/updated index entry to surface 081KSE6WT0008QG0R003G0Y62D (and 081KSE6WT0008QG0R000CV98PV) in the consolidated backlog list. |

## Review threads

### Thread 1: docs/backlog/P2/081KSE6WT0008QG0R003G0Y62D-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:01Z):

Backlog row frontmatter schema requires `last_updated` (updated on every content edit). Add `last_updated: 2026-05-25` (or today’s date) to match `tools/backlog/README.md`'s required fields.

### Thread 2: docs/backlog/P2/081KSE6WT0008QG0R003G0Y62D-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:01Z):

`size` is not a recognized backlog frontmatter key (the schema uses `effort: S|M|L`). Using a non-schema key will be flagged by `tools/backlog/lint-frontmatter.ts` check #3.

### Thread 3: docs/backlog/P2/081KSE6WT0008QG0R003G0Y62D-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:01Z):

`labels` is not a recognized backlog frontmatter key (schema uses `tags`). Consider renaming `labels:` to `tags:` to keep tooling/lints happy and stay consistent with other rows.

### Thread 4: docs/backlog/P2/081KSE6WT0008QG0R003G0Y62D-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:54 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:02Z):

This list item continuation line starts with `+`, which markdownlint interprets as a nested list marker (and Zeta’s docs conventions call this out as CI-blocking). Reword so the wrapped line doesn’t begin with `+` (e.g., fold it into the previous line or use “and”).
