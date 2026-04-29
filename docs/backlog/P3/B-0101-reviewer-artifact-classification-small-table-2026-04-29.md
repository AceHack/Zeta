---
id: B-0101
priority: P3
status: open
title: Reviewer-artifact classification — small 5-bucket table (Copilot + future review agents)
tier: research-grade
effort: S
ask: Multi-AI synthesis packet 2026-04-29 (Deepseek + Amara filter)
created: 2026-04-29
last_updated: 2026-04-29
composes_with: [B-0098, B-0099, B-0100]
tags: [code-review, copilot, reviewer-noise, taxonomy, classification]
---

# Reviewer-artifact classification — small 5-bucket table

The autonomous-loop is now effectively a two-agent loop: the
acting agent (Otto / Claude) + the reviewing agent (Copilot
pull-request-reviewer, plus increasingly cross-AI peers). The
review agent has its own failure modes that the acting agent
needs to distinguish from real findings.

Recent recurring reviewer-failure patterns from this session:

- `display-artifact` — Copilot hallucinated "leading space and
  `1 ||`" prefix that wasn't in the actual file.
- `time-travel-review-artifact` — reviewer evaluated a PR snapshot
  before cited dependency PRs merged; the reference was valid on
  current main.
- `incomplete-cited-context` — the reviewer's snippet was correct
  but not load-bearing for the issue; trusting it without
  re-reading the full file caused an over-correction
  (the 2026-04-29 ordinal-drift cascade).

## Proposed classification table (5 buckets + 1 split)

Original taxonomy had 5 buckets; the 2026-04-29 session arc
surfaced a sub-class within `REVIEWER_SNAPSHOT_LAG` that
Amara flagged as deserving a split — the remedies differ.

```text
REAL_DEFECT
  - actual code/doc/test issue caught by reviewer
  - action: fix in current PR

SNAPSHOT_MISMATCH (parent class — split into two children)
  ├─ BACKWARD_STALE_SNAPSHOT (was REVIEWER_SNAPSHOT_LAG)
  │    - reviewer evaluated a stale snapshot of repo state
  │    - cited reference is now valid on current main because
  │      the dependency PR has already merged
  │    - action: verify current main, comment with merged SHA,
  │      resolve thread
  │
  └─ FORWARD_CROSS_PR_REFERENCE
       - PR cites substrate introduced by a sibling PR that
         has NOT yet merged into the base branch
       - reference is valid only IF merge order is enforced
       - action: encode dependency (`Depends-On: #N` in PR
         body + pre-merge guard); do NOT resolve thread as
         "valid post-merge" unless the dependency is
         mechanically enforced
       - distilled rule (Amara): "A forward reference is not
         wrong if the dependency is enforced. A forward
         reference is wrong if the dependency is only hoped."

DISPLAY_ARTIFACT
  - reviewer's quoted excerpt contains characters not in source
  - benign hallucination from review-tool rendering
  - action: resolve with brief explanatory comment + optional
    git show + od -c hexdump as evidence

INCOMPLETE_CONTEXT
  - reviewer's cited snippet is correct but not load-bearing
  - fix should re-read full file before applying
  - action: read full source, decide if fix is real or no-op

NEEDS_HUMAN_REVIEW
  - reviewer flagged something the acting agent can't classify
  - action: leave thread open, surface to maintainer
```

The `SNAPSHOT_MISMATCH` parent class captures both temporal
directions: **backward** (reviewer's view trails reality) vs
**forward** (PR reference precedes reality). Same family,
different remedies; the bucket-level fork prevents
treating one as the other.

## Where this lands

Two options:

1. **As a memory file** — `memory/feedback_reviewer_artifact_classification_5_buckets_2026_04_29.md` —
   gives future-Claude a quick decision tree.

2. **As a section in a code-review skill** — embed in
   `.claude/skills/code-reviewer/` or similar, so the
   classification is invoked at decision time, not lookup
   time.

Decision deferred to whoever picks up the action item.

## Why P3

The classification works informally now — most reviewer findings
get correctly classified by acting-agent judgment. Codifying it
hardens the discipline but isn't blocking. Promote when active
drain is clear.

## Composes with

- B-0098, B-0099, B-0100 — sibling actionables from the same
  packet.
- `memory/feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`
  — the BLOCKED-with-green-CI rule that makes review-thread
  triage a load-bearing tick step.
- `memory/feedback_outdated_review_threads_block_merge_resolve_explicitly_after_force_push_2026_04_27.md`
  — outdated-thread resolution discipline; partially overlaps
  with REVIEWER_SNAPSHOT_LAG.
