---
pr_number: 5087
title: "backlog(081KSE6WT0008QG0R000WVYAJ2): re-land cloud-native plugins fit Zeta's interface shape \u2014 negotiation high seat via vendor-swap"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T04:29:06Z"
merged_at: "2026-05-26T05:03:56Z"
closed_at: "2026-05-26T05:03:56Z"
head_ref: "otto-cli/reland-b0763-0421z"
base_ref: "main"
archived_at: "2026-05-27T19:44:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5087: backlog(081KSE6WT0008QG0R000WVYAJ2): re-land cloud-native plugins fit Zeta's interface shape — negotiation high seat via vendor-swap

## PR description

## Summary

Re-land of stale-DIRTY [PR #5049](https://github.com/Lucent-Financial-Group/Zeta/pull/5049) (Tier-3 disposition per [`.claude/rules/pr-triage-tiers.md`](.claude/rules/pr-triage-tiers.md)).

- Same 081KSE6WT0008QG0R000WVYAJ2 row file (byte-identical to PR #5049 head `3c49c4895`, 243 lines)
- `docs/BACKLOG.md` regenerated against current origin/main
- `bun tools/backlog/generate-index.ts --check` → ok
- Commit canary: parent=61, head=61

Follow-up: close #5049 with substrate-recoverable cross-link.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:32:30Z)

## Pull request overview

Re-lands backlog row **081KSE6WT0008QG0R000WVYAJ2** describing the “Zeta-owned interfaces → vendor-swappable plugins” strategy, and updates the generated backlog index accordingly.

**Changes:**

- Adds new per-row backlog file for **081KSE6WT0008QG0R000WVYAJ2** under `docs/backlog/P2/`.
- Regenerates `docs/BACKLOG.md` to include the new row link.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md | New backlog row capturing the plugin/interface “negotiation high seat” concept plus acceptance criteria. |
| docs/BACKLOG.md | Regenerated index entry adding 081KSE6WT0008QG0R000WVYAJ2 to the P2 list. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:43:00Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 4 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:51:23Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

## Review threads

### Thread 1: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:32:29Z):

`depends_on` / `composes_with` references include IDs that don’t appear to exist as backlog rows anywhere under `docs/backlog/**` (e.g., 081KSE6WT0008QG0R002CC6314, 081KSE6WT0008QG0R000SH6E0R, 081KSE6WT0008QG0R001RG4FXD, 081KSGS9H0008QG0R002T3BJ2R). This makes the dependency/composition graph non-resolvable and will break any future strict-lint of these fields. Either add the missing row files (with matching `id:`) or update these references to the correct existing backlog IDs.

### Thread 2: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:62 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:32:30Z):

The BlobStore adapter list includes both `R2` and `Cloudflare R2`, which reads like a duplicate vendor entry. Consider keeping just one (or renaming `R2` to a distinct provider if it was intended to mean something else) to avoid confusion in the canonical interface/adapters table.

### Thread 3: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:78 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:32:30Z):

Namespace guidance here conflicts with the earlier interface table: the table uses `Zeta.Storage.*` / `Zeta.Compute.*` / etc., but this section says interfaces live in `Zeta.Cloud.<Primitive>`. Aligning on one namespace scheme (and making the plugin namespace in Acceptance match it) will reduce ambiguity for future implementers.

### Thread 4: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:62 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:42:59Z):

P2: The BlobStore adapter list includes R2 twice ("R2" and "Cloudflare R2"), which reads like a duplication rather than two distinct targets. Consider de-duplicating to a single entry (or disambiguating if you meant two different backends).

### Thread 5: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:78 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:43:00Z):

P1: The row’s table lists interfaces under `Zeta.Storage.*`, `Zeta.Compute.*`, etc., but the paragraph below says the interfaces live in `Zeta.Cloud.<Primitive>` namespaces. This is an internal naming inconsistency that will make the intended API surface unclear; please align the namespace scheme in the table/prose (and the later `Zeta.Cloud.Plugins.<vendor>` mention) so readers know where these types are expected to live.

### Thread 6: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:87 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:43:00Z):

P1: `docs/cloud-plugin-authoring.md` is referenced as the location of the plugin authoring contract, but that file doesn’t exist in the repo (there is `docs/PLUGIN-AUTHOR.md`). Either point to an existing doc, or adjust the acceptance text to the intended path/name so the link isn’t dead in the meantime.

### Thread 7: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:112 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:43:00Z):

P1: The acceptance checklist calls out “PROVISIONING.md updated” but there is no `PROVISIONING.md` at repo root; the existing provisioning doc appears to be `full-ai-cluster/PROVISIONING.md`. Please use an explicit path here (and similarly for “README updated” if it’s meant to be `README.md` vs `full-ai-cluster/README.md`) so the deliverable is unambiguous.

### Thread 8: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:13 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:51:23Z):

P1: The `composes_with` frontmatter list is incomplete relative to the later “## Composes with” section (e.g., 081KSE6WT0008QG0R002CC6314/081KSE6WT0008QG0R000SH6E0R/081KSE6WT0008QG0R001RG4FXD/081KSGS9H0008QG0R002T3BJ2R are listed in the body but not in frontmatter). Please sync these so tooling/graph views based on frontmatter don’t drift from the narrative list.

### Thread 9: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:73 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:51:23Z):

P1: The doc claims these interfaces “live in `Zeta.Cloud.<Primitive>` namespaces,” but the table/examples use `Zeta.Storage.*`, `Zeta.Compute.*`, etc. This is internally inconsistent; please align on the intended namespace scheme (either update the statement or adjust the examples).

### Thread 10: docs/backlog/P2/081KSE6WT0008QG0R000WVYAJ2-cloud-native-plugins-fit-zeta-shape-not-vice-versa-negotiation-high-seat-vendor-swap-aaron-2026-05-25.md:59 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:51:23Z):

P2: In the table, `CosmosDB` is spelled without a space while the previous row uses `Cosmos DB`. Consider standardizing to the official product name (`Cosmos DB`) for consistency/readability.

## General comments

### @chatgpt-codex-connector (2026-05-26T04:29:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
