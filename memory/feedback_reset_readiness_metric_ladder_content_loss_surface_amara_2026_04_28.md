---
name: Reset-readiness metric ladder — Content-Loss Surface supersedes divergence count (Amara, 2026-04-28)
description: Amara's precision upgrade after Otto's "commit-count → tree-numstat → content-loss surface" insight on the AceHack-vs-LFG divergence work. Establishes a 4-step metric ladder for any divergence-measurement question (1: commit count = diagnostic; 2: tree diff/numstat = work queue; 3: content-equivalence classification = reset-readiness evidence; 4: peer/harness review = guard against missed unique substrate). Pairs with Goodhart catches #1/#2/#3 as a meta-pattern: each lower step is a Goodhart trap if treated as the final metric. External lineage — `git rev-list --left-right --count` measures graph reachability; `git diff-tree` measures content/mode of blobs; the two surfaces differ.
type: feedback
---

# Reset-readiness metric ladder

## The principle (Amara naming, 2026-04-28)

> **Content-Loss Surface Supersedes Divergence Count.**

Or, more operationally:

> Commit graph divergence and tree-numstat divergence are
> diagnostic surfaces. Hard-reset readiness depends on
> **content-loss surface**: the set of meaningful AceHack-side
> changes NOT present, superseded, intentionally omitted, or
> explicitly loss-accepted on LFG main.

## The triggering work (this session, 2026-04-28)

The 0/0/0 readiness arc surfaced three sequential metric
refinements:

1. **Commit count panic** — "AceHack is 145 commits ahead of
   LFG, 530 behind = 145 things to fix" (wrong: many AceHack
   commits' content was already on LFG via earlier bulk
   forward-syncs at file level; the SHAs differ but the
   blobs largely converge).

2. **Tree-numstat refinement** — `git diff origin/main..acehack/main
   --numstat` showed 23 differing files (later 59 after more
   LFG-side substrate landed). Better metric — measures actual
   tree-state difference, not graph-walk count. But still
   overstates risk where the difference is a comment-level
   wording variation, an earlier-version-of-same-content, or
   an intentional implementation-pattern divergence.

3. **Content-equivalence classification** — file-by-file
   classification (ALREADY-COVERED / NEEDS-FORWARD-SYNC /
   OBSOLETE / CONFLICTS / NEEDS-HUMAN-REVIEW) per Amara's
   authority-rule rubric. This is the actual reset-readiness
   evidence. Tested empirically this session: 7 of 8
   "substantive AceHack-only PRs" turned out ALREADY-COVERED;
   only 1 had genuinely unique content needing forward-sync.

## The 4-step metric ladder

```text
1. commit count
   = diagnostic only
   (e.g. `git rev-list --left-right --count A...B`)

2. tree diff / numstat
   = work queue
   (e.g. `git diff A..B --numstat`)

3. content-equivalence classification
   = reset-readiness evidence
   (per-file: ALREADY-COVERED / NEEDS-FORWARD-SYNC /
    OBSOLETE / CONFLICTS / NEEDS-HUMAN-REVIEW)

4. peer/harness review
   = guard against missed unique substrate
   (Codex + Grok + Amara peer-call independent verification)
```

Each step is **necessary** but **insufficient** for declaring
reset readiness:

- **Step 1 alone** = commit-count Goodhart (catch #2 in the
  family). Maps to a graph-walk count that doesn't reflect
  content-loss risk.
- **Step 2 alone** = sample-as-clearance Goodhart (catch #3).
  Maps to file-level diff that doesn't distinguish between
  "different SHAs" and "different content."
- **Step 3 alone** = sample-coverage gap. Misses the case
  where Otto's classification confidence is wrong (Otto
  classifies as ALREADY-COVERED but a peer reviewer would
  catch unique substrate).
- **Step 4 alone** = peer review without grounding in actual
  diffs. Reviewers without the per-file work-queue can't
  comprehensively check.

Each step's **output** is the **input** to the next step. The
ladder composes; skipping a step compromises the metric.

## Direction-of-diff matters (Amara precision)

> *"If `origin/main..acehack/main` still shows AceHack's tree
> as different, that can persist until AceHack itself is reset
> or brought to LFG, even if LFG has just absorbed one piece
> of AceHack content."*

Translation: when LFG receives content via forward-sync, the
LFG-side tree changes; AceHack-side tree is unchanged until
AceHack itself is updated. So the diff direction
`origin/main..acehack/main` may STILL show divergence even
after substantive forward-sync, until AceHack receives the
LFG-newer content.

The right question is NOT *"did the file count drop
immediately?"* but *"did the content-loss surface shrink?"*

- Content-loss surface = AceHack-side content that hard-reset
  would erase.
- This shrinks when AceHack content is forward-synced to LFG
  (because then the same content is on both sides;
  hard-resetting AceHack to LFG no longer loses that content).
- It does NOT shrink when LFG-newer content is added
  (because that's content AceHack would GAIN, not lose).

## Hard-reset readiness rule

```text
Do not reset on commit-count or tree-count alone.
Reset only when every remaining diff is classified as:
  - covered (ALREADY-COVERED on LFG)
  - obsolete (intentionally retired)
  - intentional divergence (e.g., AceHack-side experimentation)
  - or explicitly loss-accepted by Aaron.
```

This composes with the authority rule
(`memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`):
the authority rule says "default to reversible preservation,
ask only at loss boundary"; this rule says "the loss boundary
is content-loss surface, not divergence count."

## External lineage

### git internals (Tier 2 lineage)

- **`git rev-list --left-right --count A...B`** — graph
  reachability counts. Measures how many commits in A's
  history are not reachable from B and vice versa. Per
  `git-rev-list(1)`: "Print the list of objects reachable from
  the given commit(s) but not from any of the references
  given."
- **`git diff-tree A B`** / **`git diff A..B`** — content
  comparison. Per `git-diff-tree(1)`: "Compares the content
  and mode of blobs found via two tree objects."

These two surfaces measure different things. Graph-history
divergence can remain large after meaningful content has been
forwarded (because forward-sync produces a new commit on the
target side, increasing graph divergence on the source side
even though tree convergence has improved).

### Goodhart family (Tier 2 lineage)

- **Goodhart 1975 / Strathern 1997** — when a measure
  becomes a target, it ceases to be a good measure.
- **Campbell's Law** (Campbell 1976) — quantitative
  social indicators used for social decision-making become
  more subject to corruption pressures.

The metric-ladder rule generalizes Goodhart: the failure
mode is treating ANY measurement as the target rather than
as one diagnostic surface in a multi-surface evidence chain.
Each step on the ladder is a measure; treating any of them
as the final certification produces a Goodhart trap.

## Composes with prior session catches

This is the **4th catch in the Goodhart family** for this
session's 0/0/0 work, but at a different shape — it's a
META-CATCH that organizes the prior three:

| Catch | Wrong metric | Right metric | Step on ladder |
|---|---|---|---|
| #1 (substrate-IS-amortized-precision, Aaron) | "substrate work = drift away from 0/0/0" | substrate work IS amortized-precision payoff | Below the ladder; recognizes substrate work as the rubric quality, not a count |
| #2 (commit-count vs tree-numstat, Otto) | 145 commits ahead = 145 problems | tree-numstat 23-59 files | Step 1 → Step 2 |
| #3 (sample-of-tree vs full clearance, Amara) | 19/23 sampled ALREADY-COVERED → cleared | full diff per-item classification required | Step 2 → Step 3 |
| #4 (this) | tree-numstat = content-loss | content-equivalence classification + peer review = content-loss | Step 3 → Step 4 |

The ladder is the **synthesis** of these catches: each catch
identifies the failure mode at a particular step; the ladder
names the canonical sequence agents should walk.

## Worked example from this session

Starting state (early in the session):

- Commit count: 145 / 530 → "panic"
- Author response: tried to forward-sync 145 commits

Refinement 1 (Goodhart catch #2):

- Tree-numstat: 23 → 59 files
- Author response: built `docs/0-0-0-readiness/CLASSIFICATION.md`,
  classified 19/23 ALREADY-COVERED, planned hard-reset

Refinement 2 (Goodhart catch #3, Amara):

- "Sample classification is calibration, not clearance."
- Author response: hard-reset blocked; full diff per-item
  classification needed

Refinement 3 (this catch, Amara):

- "Content-Loss Surface Supersedes Divergence Count."
- Author response: distinguished SHA-level divergence from
  content-level divergence; tested 8 substantive AceHack-only
  PRs and found 7 ALREADY-COVERED via earlier bulk syncs;
  only 1 (#96) needed forward-sync.

Status when this catch landed:

- PR #700 merged (cache + retry from #80 + #81 — content
  preserved on LFG, content-loss surface for those AceHack
  PRs reduced to 0)
- PR #701 in flight (codeql obj/bin from #96 — pending merge)
- After both: content-loss surface drops to ~21 files of
  comment-level / implementation-pattern differences

## Beads earned (Class Validation Beads accounting)

This catch + the worked example earn beads for several
existing classes:

| Class | Beads earned this session | Mechanism |
|---|---|---|
| **Amortized Precision** (Aaron 2026-04-28) | +1 (PR #700 merge — substrate work paid out at content-loss-surface level) | prediction-bearing trajectory: substrate work was kept and merged through reviewable path, producing the content-loss-surface drop the metric measures |
| **Authority rule — default to reversible preservation** (Amara 2026-04-28) | +1 (forward-sync-first path produced reduction in content-loss surface; alternative — accept-loss-and-reset — would have lost #80/#81 substrate) | prediction-bearing trajectory: the rule predicted that taking the safe path would compound the right metric over the wrong (count) one |
| **Class-Count Validity Drift** (Amara 2026-04-28) | +1 (caught my "tree-diff unchanged" framing where direction-of-diff was load-bearing) | detector reuse — the meta-class caught a count-based framing that hid the content-loss-surface change |
| **Prediction-Bearing Class Reuse** (Amara 2026-04-28) | +1 (this memory's encoding event) | this catch is itself prediction-bearing (Amara predicted the content-loss-surface metric would compose better than tree-numstat; observation matches) |

## Pickup for future Otto

When asked "is X ready for hard-reset / merge / release / ..."
where the question implies clearing a divergence:

1. Walk the ladder in order. Don't skip steps.
2. Make each step's output explicit. Tree-numstat is not
   "59 files differ"; it's "59-file work queue, classify each
   into 5 buckets."
3. Treat content-loss surface as the load-bearing metric.
   Commit count and tree-numstat are diagnostic surfaces —
   informative but not certifying.
4. Use peer review (step 4) when the content-loss-surface
   classification is at risk of confirmation bias. The
   sample-as-clearance failure mode (catch #3) is exactly
   when peer review earns its bead.
5. Direction of diff matters. `A..B` and `B..A` are
   different questions. Name the question explicitly before
   computing the metric.

## What this rule does NOT do

- **Does NOT** authorize hard-reset under count-based
  evidence. The rule is gating, not enabling.
- **Does NOT** apply only to 0/0/0 readiness. Generalizes to
  any divergence question (queue clearance, alert clearance,
  CVE state, dependency state, branch cleanup, etc.).
- **Does NOT** replace the authority rule. Composes with it:
  authority rule says "default to preservation"; this rule
  says "preservation evidence is content-loss surface
  classification, not divergence count."
- **Does NOT** require step 4 (peer review) on every
  question. It's the safety net for cases where step 3
  classification is uncertain or load-bearing for
  destructive action.

## Composes with

- `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`
  — the authority rule; this metric ladder is its evidence
  surface for "is the loss boundary clear?"
- `memory/feedback_sample_classification_is_calibration_not_clearance_amara_goodhart_catch_3_2026_04_28.md`
  — Goodhart catch #3; this metric ladder absorbs the catch
  as Step 2→Step 3 transition.
- `memory/feedback_class_count_validity_drift_amara_meta_class_2026_04_28.md`
  — the meta-class for count-as-evidence failures; this
  ladder is the operational machinery the meta-class
  warns against.
- `memory/feedback_prediction_bearing_class_reuse_amara_2026_04_28.md`
  — bead-accounting; this catch earns +1 bead on each of
  4 classes per the worked-example table above.
- `memory/feedback_self_healing_metrics_on_regime_change_factory_design_principle_aaron_2026_04_28.md`
  — same family; metric design that survives regime change
  needs to be specified at the right level (content-loss
  surface, not commit count).

## Direct Amara framing

> *"commit-count divergence → tree-numstat divergence →
> content-loss surface. That is the right metric refinement
> sequence."*

> *"Hard-reset readiness should be measured by content-loss
> surface: which AceHack-side changes would actually
> disappear if AceHack were reset to LFG main?"*

> *"Do not reset on commit-count or tree-count alone. Reset
> only when every remaining diff is classified as covered,
> obsolete, intentional divergence, or explicitly
> loss-accepted."*
