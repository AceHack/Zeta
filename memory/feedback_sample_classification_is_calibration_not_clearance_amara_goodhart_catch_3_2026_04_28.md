---
name: Goodhart catch #3 — Sample classification is calibration, not clearance (Amara, 2026-04-28)
description: Third Goodhart catch in the 0/0/0 readiness work. Catch #1 framed substrate work as "drift away from 0/0/0" when it WAS amortized precision (Aaron correction). Catch #2 was commit-count vs tree-level-diff (Otto pivoted to numstat). Catch #3 (Amara, this turn): tree-level-diff sampled-file classification is NOT proof of tree clearance — sample is calibration, full diff is clearance. Triggered by 19/23 sampled-as-ALREADY-COVERED claim that missed gate.yml PR #80 cache work + codeql-config.yml B-0073 ignores once peers + deep probe checked the unsampled files.
type: feedback
---

# Goodhart catch #3 — Sample classification is calibration, not clearance

## The catch (Amara, 2026-04-28)

> **Sample classification is calibration, not clearance.
> Tree reset requires full diff clearance or explicit loss acceptance.**

## Goodhart family — three catches in one session

The 0/0/0 readiness work surfaced three sequential Goodhart
moments. Each is a wrong-metric → right-metric pivot.

### Catch #1 — Substrate work IS the work (Aaron, 2026-04-28)

**Wrong metric:** "Otto wrote memory files instead of reducing
tree-diff = drift away from 0/0/0."

**Right metric:** *"amortized precision leads to momentum."*
The substrate work IS the amortized-precision payoff. The
factory's terminal-progress signal is the rubric quality
(145→23→4 reduction), not pre-rubric line count.

External lineage:

- **Six Sigma** (Smith / Motorola, 1986) — process capability
  comes from upstream-precision investment, not downstream
  defect-counting.
- **Toyota Production System / Kanban** (Ohno, 1950s) —
  flow value is realized by upstream constraint-removal,
  not by counting cards-moved-per-day.

### Catch #2 — Commit count ≠ tree-level diff (Otto self-catch)

**Wrong metric:** "AceHack is 145 commits ahead = 145 things
to fix."

**Right metric:** Tree-level numstat diff = 23 differing files
= the actual content-loss surface.

Source: `git diff origin/main..acehack/main --numstat`. Many
of the 145 commits touch files that ALSO exist on LFG via
forward-syncs; the SHAs differ but the tree-state largely
converges.

External lineage:

- **Goodhart's Law** (Goodhart 1975, Strathern 1997 reframing):
  "When a measure becomes a target, it ceases to be a good
  measure." Commit count was a measure that became a target.

### Catch #3 — Sample-of-tree ≠ tree-clearance (Amara, this turn)

**Wrong metric:** "Sampled 23 of 59 differing files; 19/23
ALREADY-COVERED → tree is mostly cleared."

**Right metric:** **Full diff clearance** (every file
classified) **OR** explicit loss-acceptance per file.

The sample missed:

- gate.yml PR #80 (`2791c28`) cache + retry + ubuntu-bump work
  — substantial unique AceHack content that LFG lacks.
- codeql-config.yml B-0073 obj/bin ignores (Codex caught this).
- Likely more in the unsampled files (Grok flagged the
  threshold issue: "one line of unique substrate violates
  the mirror contract").

External lineage:

- **Sampling theory** (Cochran 1977, *Sampling Techniques*):
  representative samples estimate population parameters;
  they do not certify population properties. A sample-based
  estimate of "fraction ALREADY-COVERED" is calibration data,
  not clearance proof.
- **Statistical hypothesis testing** (Fisher, Neyman-Pearson):
  failing to reject a null on a sample doesn't prove the null;
  sample-based "looks clean" is consistent with hidden
  defects.
- **Quality-by-design** (FDA 2009) and **Six Sigma DMAIC** — for
  binary quality decisions, the standard is full-population
  inspection or explicit risk acceptance, not sample-based
  estimation.

## Why this matters for the factory

The 0/0/0 invariant is a **binary quality decision**: AceHack
main = LFG main, or it doesn't. There's no "approximately
0/0/0." The mirror contract demands binary clearance.

For binary decisions, sample-based estimation is calibration
(useful for shaping the work) but not certification (sufficient
to act on the destructive side of the decision).

## Operational discipline

When making a binary clearance claim about a population
(tree, queue, alert set, dependency graph):

1. **Sample-classify first** to calibrate effort + surface
   easy-find issues.
2. **Then exhaustive-classify or accept-loss** to move to
   the destructive side of the decision.
3. **Treat sample results as informative-not-determinative.**
   "We sampled 23/59 and 83% looked clean" is calibration;
   "Tree is cleared" requires the full 59 audited.

This applies to:

- Tree-diff readiness for hard-reset (this case).
- Queue-drain readiness for declaring a queue empty.
- Alert-clearance readiness for declaring CVE-free.
- Dependency-graph clearance for declaring no orphans.

## Connection to Class Validation Beads

This catch earns the **Class-Count Validity Drift** class one
reuse bead (1 → 2 beads). The sample-as-clearance failure mode
is the same shape as the count-as-validation failure mode —
both treat a *measure* as a *certification*.

Updated beads count for the meta-class:

| Class | Beads | Latest event |
|---|---|---|
| Class-Count Validity Drift | 2 | (1) caught my "substrate compounds" framing; (2) caught my sample-as-clearance framing for 0/0/0 readiness |

## Pairing with the authority rule

This catch is the **substrate of the authority rule**
(`memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`).
The rule says "default to preservation when sample-evidence
suggests safety; ask only at the loss boundary." This catch
provides the WHY: sample evidence isn't strong enough to
authorize destruction; it IS strong enough to authorize
preservation.

In other words:

- **Sample-clean** + **destructive-action** = WRONG (sample
  is calibration, not clearance).
- **Sample-clean** + **preservation-action** = OK (preservation
  is reversible; if the sample missed something, the missed
  thing survives the preservation step).

The asymmetry between calibration and clearance maps directly
to the asymmetry between preservation and destruction.

## Direct Amara framing

> *"Sample classification is calibration, not clearance.
> Tree reset requires full diff clearance or explicit loss acceptance."*

## Composes with

- `memory/feedback_class_count_validity_drift_amara_meta_class_2026_04_28.md`
  — same Goodhart family; bead +1 for sample-as-clearance
  variant.
- `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`
  — the rule this catch is the substrate of.
- `memory/feedback_speculation_leads_investigation_not_defines_root_cause_aaron_2026_04_28.md`
  — same family at the language level (speculation =
  calibration; evidence = clearance).
- `memory/feedback_prediction_bearing_class_reuse_amara_2026_04_28.md`
  — beads as accounting; this catch demonstrates beads-on-meta-class.
