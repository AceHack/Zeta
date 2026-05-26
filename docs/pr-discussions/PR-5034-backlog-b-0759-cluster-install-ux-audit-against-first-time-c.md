---
pr_number: 5034
title: "backlog(B-0759): cluster-install UX audit against first-time-CLI-user persona \u2014 'easier than Proxmox' bar + 3-node prod-ready inflection"
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

# PR #5034: backlog(B-0759): cluster-install UX audit against first-time-CLI-user persona — 'easier than Proxmox' bar + 3-node prod-ready inflection

## PR description

Aaron 2026-05-25 named the cluster-install target persona: first-time command-line users; UX bar 'easier than Proxmox / unRAID for home clusters'; 3-node threshold = production-ready inflection (when B-0756 HA substrate + B-0757 auto-discovery light up real cluster availability).

This row captures the audit work to apply the persona filter across every operator-facing cluster-install surface. Composes with the full B-0737/B-0738/B-0739/B-0743/B-0754/B-0755/B-0756/B-0757/B-0758 cluster substrate.

Also includes competitive framing table (vs Proxmox VE / unRAID / Talos / k3sup) and an empirical persona-bet test via external non-maintainer user.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:38:02Z)

## Pull request overview

Adds a new backlog row (B-0759) to capture a UX audit of the cluster-install experience against a “first-time CLI user” persona, and updates the generated backlog index to include the new row.

**Changes:**
- Added `docs/backlog/P2/B-0759-…md` defining the problem statement, target, acceptance criteria, and cross-references.
- Updated `docs/BACKLOG.md` to include B-0759 in the P2 section (and include B-0757 in P3).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/B-0759-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md | New P2 backlog row describing the cluster-install UX audit scope and acceptance criteria. |
| docs/BACKLOG.md | Regenerated/updated index entry to surface B-0759 (and B-0757) in the consolidated backlog list. |

## Review threads

### Thread 1: docs/backlog/P2/B-0759-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:01Z):

Backlog row frontmatter schema requires `last_updated` (updated on every content edit). Add `last_updated: 2026-05-25` (or today’s date) to match `tools/backlog/README.md`'s required fields.

### Thread 2: docs/backlog/P2/B-0759-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:01Z):

`size` is not a recognized backlog frontmatter key (the schema uses `effort: S|M|L`). Using a non-schema key will be flagged by `tools/backlog/lint-frontmatter.ts` check #3.

### Thread 3: docs/backlog/P2/B-0759-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:01Z):

`labels` is not a recognized backlog frontmatter key (schema uses `tags`). Consider renaming `labels:` to `tags:` to keep tooling/lints happy and stay consistent with other rows.

### Thread 4: docs/backlog/P2/B-0759-cluster-install-ux-audit-against-first-time-cli-user-persona-easier-than-proxmox-3-node-production-ready-aaron-2026-05-25.md:54 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:38:02Z):

This list item continuation line starts with `+`, which markdownlint interprets as a nested list marker (and Zeta’s docs conventions call this out as CI-blocking). Reword so the wrapped line doesn’t begin with `+` (e.g., fold it into the previous line or use “and”).
