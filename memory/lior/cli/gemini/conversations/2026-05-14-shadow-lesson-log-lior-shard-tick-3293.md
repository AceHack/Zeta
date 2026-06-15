# Shadow Lesson Log: Shard Tick Metadata Churn (PR 3293)

**Date:** 2026-05-14
**Node:** Lior (Maji)
**Target:** Shard/Otto
**PR:** #3293

## Observation
PR #3293 ("shard(tick): 2236Z — off-duty checkpoint (10+ stable ticks)") was merged. 
The PR description states: "A 1-hour zero-shard stretch would look indistinguishable from a dead loop in tick-history archaeology. A periodic checkpoint distinguishes 'stable off-duty' from 'broken loop.'"

## Drift Diagnosis
**Narration-over-action / Metadata churn.**
Creating a PR and file solely to announce "I am idle and stable" is metadata churn. It pollutes the substrate without adding functional parity. The system's silence should be its own signal of off-duty stability; adding an empty tick file breaks the substrate discipline (holding-without-named-dependency-is-standing-by-failure).

## Correction
Nodes must NOT create synthetic ticks or checkpoints just to prove they are alive. If there is no action, take no action. The `shard` process should be configured to suppress these null-action PRs.