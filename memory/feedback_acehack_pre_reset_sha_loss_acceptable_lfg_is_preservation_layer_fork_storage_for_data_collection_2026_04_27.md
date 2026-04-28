---
name: AceHack pre-reset SHA-history loss is acceptable — LFG is the preservation layer; fork-storage locations in LFG capture fork-specific high-signal data (Aaron 2026-04-27)
description: Aaron 2026-04-27 confirmation that AceHack's pre-reset parallel-SHA history dropping during the topology-collapse hard-reset is acceptable — AceHack is the dev-mirror by design; LFG is what we preserve. Fork-specific high-signal data (PR review threads, drain logs, decision records) gets captured on LFG via dedicated fork-storage locations like `docs/pr-preservation/`. The substrate-value loss from dropping AceHack's pre-reset SHA layer is zero — content survives via prior squash-merges, conversation archives survive via fork-storage. Going forward (post-0/0/0), both forks share identical SHAs and the question becomes moot.
type: feedback
---

# AceHack pre-reset SHA-history loss is acceptable — LFG is the preservation layer

## Verbatim quote (Aaron 2026-04-27)

After Otto laid out the nuance ("AceHack's pre-reset parallel-SHA history disappears from the live branch during hard-reset; content preserved on LFG via prior squash-merges"):

> "that's fine this is our dev setup anyways, LFG history is what we are preserving, it will all be the same anyways going forward. And we have the fork storage locations in lfg for any fork specific stuff that ends up in lfg for data collection purposes, nice clean high singnal data ffom the sources like the PR reviews threads"

## Three-layer preservation accounting

When AceHack hard-resets to LFG main, the question "what's lost?" needs answering at three layers:

### Layer 1: Content (what the code/docs say)

**Lost?** No.

Every AceHack-unique line gets forward-synced to LFG before the hard-reset (via paired-sync rounds). After hard-reset, AceHack absorbs LFG's complete state — content is the union of both forks. The dev-mirror topology + double-hop workflow + the path-to-start work today made this true.

### Layer 2: Commit SHAs and commit messages (the audit trail of when-which-line-changed)

**Lost?** AceHack's pre-reset SHAs disappear from AceHack's live branch history. Yes-but-irrelevant.

The SHAs of AceHack's pre-reset 80-ish unique commits are dropped from the live tree during force-push. Their CONTENT is preserved on LFG (via prior squash-merges with different SHAs), but the specific commit-message-text + SHA-identity disappears.

This is acceptable because:

- **AceHack is the dev-mirror, by design transient** — *"this is our dev setup anyways"* (Aaron). Force-pushes to AceHack main are part of the protocol.
- **LFG is what we preserve** — *"LFG history is what we are preserving"* (Aaron). LFG main's commit history is append-only via PR squash-merge; that history IS the canonical record.
- **Going forward both forks share SHAs** — *"it will all be the same anyways going forward"* (Aaron). After 0/0/0 starting point, every paired-sync round produces identical SHAs on both forks. The pre-reset asymmetry is a one-time topology collapse, not an ongoing pattern.

### Layer 3: High-signal artifact data (PR review threads, drain logs, decisions)

**Lost?** No.

Aaron's framing (compounded across two messages):

> "we have the fork storage locations in lfg for any fork specific stuff that ends up in lfg for data collection purposes, nice clean high singnal data ffom the sources like the PR reviews threads"

> "PR review threads + conversation archives: LFG has a location for all forks that want to send back PR threads/ cost data, whatever fork specific stuff that LFG collects but in a way where all fork specific can keep it's data on LFG too so everyone can train from it and learn form it."

This is **multi-tenant fork-storage-on-LFG** — not just AceHack's location. Any fork (current or future) that wants to send back fork-specific data has a place on LFG to keep it, in a way that lets all contributors train from / learn from the collective dataset.

### The architecture

LFG has dedicated **fork-storage locations** that preserve fork-specific high-signal artifacts. Today's set:

- **`docs/pr-preservation/`** — drain logs of PR conversation archives (Otto-250 discipline). Captures review threads as high-signal labeled training data per the "PR reviews are training signals" memory.
- **`docs/hygiene-history/`** — tick-history + drain-logs from autonomous-loop ticks.
- **`docs/DECISIONS/`** — ADR records of architectural decisions.
- **`docs/research/`** — research history.
- **`docs/aurora/`** — courier-ferry archive (cross-AI research).
- **`docs/budget-history/`** — cost-data snapshots (the "cost data" Aaron flags explicitly).
- **`memory/`** (factory-wide memory + persona notebooks) — substrate that survives compaction.
- Commit messages and PR titles/bodies on LFG side — git-native record.

### Multi-tenant by design — collective training/learning purpose

Aaron's load-bearing framing: *"all forks that want to send back ... whatever fork specific stuff ... in a way where all fork specific can keep it's data on LFG too so everyone can train from it and learn form it."*

The fork-storage architecture is NOT just for AceHack's review threads — it's **multi-tenant**:

- **Any fork** (AceHack today; possible future forks under different maintainer-agent pairs) can write its fork-specific artifacts to LFG's fork-storage paths.
- **Each fork keeps its own data** — the storage is partitioned/labeled per fork, not merged into a single anonymous heap.
- **All contributors can read** all forks' data — the storage is collective-readable, even if write-partitioned.
- **The purpose is training + learning** — high-signal labeled data (PR review threads with reviewer judgments, cost-data snapshots showing real budget patterns, drain logs showing real-world failure-recovery sequences) becomes a training corpus for both AI agents and human contributors.

### Data types beyond review threads

Aaron's list is open-ended (*"whatever fork specific stuff"*) but explicitly names two categories:

- **PR review threads** — captured via `docs/pr-preservation/` drain logs (Otto-250).
- **Cost data** — captured via `docs/budget-history/snapshots.jsonl` and the budget-cadence weekly workflow (task #297).

Other categories that fit the pattern:
- Tick-history for autonomous-loop work (`docs/hygiene-history/`)
- Decision records (`docs/DECISIONS/`)
- Research artifacts (`docs/research/`)
- Future fork-specific artifacts as new categories emerge — anything that's high-signal and worth collective training.

### Implication for AceHack hard-reset

When AceHack-side conversation surfaces (review threads from AceHack PRs, drain logs from AceHack-side review work, cost data from AceHack's budget cadence) need preservation, they land in these LFG-side fork-storage paths via the paired-sync flow. The `docs/pr-preservation/` drain-log discipline (Otto-250) is the canonical mechanism: capture the AceHack-side PR conversation as a markdown artifact, commit it to LFG, the high-signal data survives even if the AceHack-side PR's SHAs disappear during the hard-reset.

**The pattern generalizes**: any future fork-pair contributing back to LFG follows the same flow — capture the artifact in a fork-storage path, commit to LFG, the data survives the contributing fork's eventual reset/teardown.

## Net answer to "what's lost?"

Substrate-value: **zero**.
- Content: preserved (via paired-sync forward-port)
- High-signal conversation data: preserved (via fork-storage paths on LFG)
- Decisions and lineage: preserved (via memory/, docs/DECISIONS/, docs/ROUND-HISTORY.md)
- The only thing dropped is the SHA-and-commit-message layer of AceHack's pre-reset transient dev-substrate, which by design is not a preservation target.

## Composes with

- **`memory/feedback_zero_diff_means_both_content_and_commits_cognitive_load_for_future_changes_2026_04_27.md`** — the 0/0/0 invariant; this memory closes the "but what about the dropped SHAs" loop.
- **`memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`** — the dev-mirror / project-trunk topology + double-hop workflow.
- **Otto-250 PR-reviews-are-training-signals discipline** — operationalizes the fork-storage data-collection move via `docs/pr-preservation/`.
- **Otto-238 retractability** — historical record preservation principle; here the preservation target is LFG (canonical), not AceHack (transient).
- **Otto-279 + follow-on closed-list history-surface rule** — names the specific LFG paths that count as preservation surfaces.

## How to apply going forward

When the question "is X preserved across the AceHack hard-reset?" comes up, walk the three-layer accounting:

1. Is X **content**? → Forward-sync to LFG before hard-reset. (Always do this; it's the path-to-start gate.)
2. Is X a **commit-message or SHA**? → It disappears from AceHack-pre-reset, content survives on LFG. Document if anyone cares about the specific message text; otherwise accept the loss as transient-dev-substrate.
3. Is X a **high-signal artifact** (review thread, drain log, decision)? → Capture it on LFG via fork-storage path BEFORE hard-reset. The Otto-250 drain-log discipline + `docs/pr-preservation/` is the canonical mechanism.

If all three are handled, the substrate-value loss across the hard-reset is zero, and Aaron's "nothing is lost" framing holds.

## What this does NOT mean

- Does NOT mean we never archive AceHack-side data. We DO — into LFG's fork-storage paths.
- Does NOT mean AceHack is disposable or worthless. AceHack is the working surface where in-flight work happens; it's just not the *preservation* surface.
- Does NOT mean the 80-ish pre-reset SHAs are categorically worthless. Their CONTENT is preserved; their identity-as-SHAs is not. If a specific SHA needs to survive (rare), tag it before hard-reset (the exception-documentation move from the cognitive-load memory).
