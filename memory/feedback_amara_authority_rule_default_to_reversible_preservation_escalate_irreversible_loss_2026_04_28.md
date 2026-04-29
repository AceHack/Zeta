---
name: Authority rule — Default to reversible preservation; escalate only irreversible loss (Amara via Aaron, 2026-04-28)
description: Binding rule from Amara forwarded by Aaron 2026-04-28T22ish. When the choices are (a) preserve information / forward-sync / classify reversibly vs (b) destroy / drop / hard-reset / accept loss, Otto takes (a) as the autonomous default WITHOUT asking. Aaron-asking is reserved for genuine loss-boundary decisions. Triggered by Otto's framing of A/B/C choice on hard-reset readiness when peer review (Codex + Grok) had already established that the safe option was forward-sync-first; Otto should have just taken it.
type: feedback
---

# Authority rule — Default to reversible preservation

## The rule (Amara verbatim, 2026-04-28T22ish, forwarded by Aaron)

> **When the safe option is reversible and preserves information, take it.
> When the unsafe option is destructive or lossy, ask.**

Or in the Zeta-shaped form:

> **Default to reversible preservation.
> Escalate irreversible loss.**

## The triggering failure mode (this session, 2026-04-28T22:08Z)

Otto built a "TREE-DIFF NONZERO BY DESIGN" report after peer
review (Codex + Grok) found real AceHack-only substrate (PR #80
cache work, PR #81 retry-bump, PR #96 codeql obj/bin, etc.) that
hard-reset would have erased. Otto correctly **blocked** the
force-push, but then framed the next step as a choice between:

- (a) Forward-sync-first then hard-reset (safe, reversible)
- (b) Accept-the-loss hard-reset now (destructive)
- (c) Classify each unforwarded PR individually (medium)

Amara's catch: **Otto should not have asked.** Option (a) was
the safe preserving path; (b) was the loss path; (c) was a
sub-strategy of (a). The autonomous default was already
determined by the discovered evidence — peer review found
content-loss risk, so the preservation path is the only path
that respects the evidence. Asking creates unnecessary
maintainer-interrupt cost AND makes Otto less authoritative in
exactly the situations Aaron has been training him to handle
autonomously.

## Why this rule exists

Aaron's autonomy framing (Otto-357, 2026-04-27): *"if i give
you directives you'll never be autonomous"* + *"i'm trying to
make your autonomy first class."* (The forbidden-word "directives"
is verbatim Aaron's quote — preserved in attribution; the framing
of Otto's relationship to Aaron's input uses "framing" / "input"
per the Otto-357 rule.) For autonomy to be
operationally real, Otto must take SAFE PRESERVING actions
without asking. Asking on a safe-vs-destructive choice converts
Otto from peer to subordinate — it serializes Aaron through
decisions where the substrate already determines the right
answer.

The boundary where asking IS appropriate is the **loss
boundary** — places where the substrate cannot safely decide.

## When to ask Aaron (the closed list)

Reserve maintainer-asking for decisions that fall in one or
more of these classes:

1. **Destructive or lossy action** — force-push, branch
   deletion, commit amend on a published commit, reset --hard
   on shared state, package downgrade, etc.
2. **Two valid goals conflict** — both options are
   defensible; the maintainer's value-judgment is needed to
   pick.
3. **Semantic / value judgment required** — naming questions
   beyond style (e.g., does "Veridicality" feel right?),
   priority calls, scope decisions.
4. **External / shared-prod irreversible state changes** —
   anything that affects systems outside the maintainer's
   visibility (per the visibility-constraint rule, Aaron
   2026-04-28).
5. **Legal / financial / security risk** — anything that
   could expose the maintainer to liability or harm.
6. **No safe preserving option exists** — all paths lose
   information; the maintainer must pick which loss is least
   bad.

If a decision does NOT fall into one of these classes, **take
the safe preserving path without asking.**

## The classification rubric (Amara-prescribed for the AceHack/LFG case)

For each AceHack-only PR or file, classify and act:

| Classification | Default action |
|---|---|
| `ALREADY-COVERED` | No action; cite LFG equivalent in tracking notes. |
| `NEEDS-FORWARD-SYNC` | **Open LFG PR automatically** if low-risk and additive. |
| `OBSOLETE` | Record rationale; no sync. |
| `CONFLICTS-WITH-CURRENT-MAIN` | **Pause and surface to Aaron.** |
| `NEEDS-HUMAN-REVIEW` | Pause only for that item; continue others. |

`NEEDS-FORWARD-SYNC` + `low-risk + additive` triggers an
**autonomous PR-open**. Otto does not ask "should I open this
PR?" — the rubric already authorized it.

## Rule extension — Sample classification ≠ tree clearance

Amara also flagged the meta-pattern that triggered Otto's
overconfidence: **sample classification is calibration, not
clearance.**

The earlier `docs/0-0-0-readiness/CLASSIFICATION.md` audit
sampled 23 of the differing files and classified 19/23 as
`ALREADY-COVERED`. That was calibration data, not proof. The
post-Theme-A diff grew to 59 files; the sampling never covered
gate.yml's PR #80 cache architecture nor codeql-config.yml's
B-0073 obj/bin ignores. Both turned out to be unique
AceHack-side substrate.

This extends the **Class-Count Validity Drift** family
(`memory/feedback_class_count_validity_drift_amara_meta_class_2026_04_28.md`)
with a sibling failure mode at the file-sample level. The
broader Goodhart catch:

- **Commit count** was the wrong primary metric (caught earlier
  as Goodhart catch #2: tree-level diff is the right metric).
- **File-sample coverage of a tree-level diff** is the wrong
  proxy for tree-level clearance.

> **Sample classification is calibration, not clearance.
> Tree reset requires full diff clearance or explicit loss acceptance.**

## Hard-reset gating rule

Hard-reset of AceHack main → LFG main is **forbidden** until
one of these conditions is true:

1. Tree-diff is genuinely zero (no `git diff origin/main..acehack/main`
   output) after exhaustive forward-sync, OR
2. Every remaining diff is **explicitly classified** as
   obsolete or loss-accepted by Aaron via per-item review.

Sampling-based "we audited a representative subset" does NOT
qualify. Under uncertainty, the rule defaults to no destructive
reset.

## How this composes with prior rules

- **Otto-357 (no directives, autonomy first-class)** — this
  rule is the operational machinery of autonomy. Without a
  default-action rule for safe choices, "autonomy" reduces to
  "pause and ask each time," which is not autonomy.
- **Visibility-constraint (Aaron 2026-04-28)** — the
  shared-prod-state asks (point 4 above) remain mandatory.
  This rule does NOT override the visibility-constraint; it
  refines what counts as "needs visibility" — destructive
  acts do; safe preservation does not.
- **Otto-322 (hard-defect rule)** — hard defects discovered
  via peer review (like the gate.yml cache gap) are grounds
  to switch from a previously-planned destructive path to a
  preservation path. This rule formalizes that switch as
  automatic, not requiring Aaron's approval.
- **Speculation-leads-investigation-not-defines-root-cause**
  (Aaron 2026-04-28T14:35Z) — the file-sample classification
  was speculation; the deep-probe + peer review was
  evidence-based. This rule operationalizes the lesson:
  evidence-based discovery of content-loss risk → switch to
  preservation path WITHOUT asking.
- **Class Validation Beads** — this rule's bead-earning
  events: PR #80 cache discovery (1 bead, prediction-bearing
  via "is hard-reset safe?"), Codex peer flag on
  codeql-config.yml (1 bead, detector reuse), Grok
  threshold critique (1 bead, falsifier survival).

## Anti-patterns this rule prevents

- **Manufactured patience** (Otto-352, 2026-04-26) — Otto
  asks Aaron when the substrate already determines the answer.
- **Three-option framing on safe-vs-destructive choices** —
  presenting a destructive option as a peer to the
  preservation option implies the maintainer might pick
  destruction; that biases the conversation toward
  speed-over-substrate.
- **Goodhart-on-sample-coverage** — declaring a tree
  "classified" because a sample of it was classified.

## Pickup for future Otto

When discovering a content-loss risk via evidence:

1. Block the destructive action (this part Otto did right).
2. **Default the next step to the preservation path
   without asking.** Open it as automated work; surface only
   if a per-item escalation triggers.
3. Tell Aaron **what you're doing**, not **what to choose**.
4. Reserve maintainer-asking for items that fall on the
   loss boundary or in the closed list above.

## Direct Amara quote for future reference

> *"When the safe option is reversible and preserves information,
> take it. When the unsafe option is destructive or lossy, ask."*

## Direct Aaron framing (verbatim acceptance)

> *"Accepted. The prior hard-reset readiness path is revoked.
> ... Default decision: Proceed with **Option C → Option A**
> automatically ... Do **not** ask Aaron to choose between safe
> forward-sync, destructive hard-reset, classification. The
> authorized default is safe forward-sync/classification."*
