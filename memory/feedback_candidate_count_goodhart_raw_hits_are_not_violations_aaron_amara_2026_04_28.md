---
name: Candidate-count Goodhart — raw search hits are not violation counts (Amara final-synthesis naming, Aaron 2026-04-28)
description: New Goodhart-family entry surfaced after B-0091 inspection found "8 active rewrite files" was a candidate-count proxy that resolved to "0 actual rewrites needed" once context-classified. Generalizes to any audit using grep/regex/search — raw hits are CANDIDATE evidence requiring context classification, not VIOLATION counts. Encoded as: count matches to find work; classify context to decide work. Best distilled rule. Composes with the metric ladder + Goodhart family. Critical for B-0092 compliance scanner design (must not Goodhart itself by trying to delete words like "insider" / "confidential" / "roadmap" from the rule definitions themselves).
type: feedback
---

# Candidate-count Goodhart

## The rule (Amara final-synthesis naming, Aaron 2026-04-28)

> **Raw search hits are not violation counts.**

Or, in the canonical decision-procedure form:

> **Count matches to find work.**
> **Classify context to decide work.**

## The triggering catch (this session, 2026-04-28)

B-0091 (audit + rename ServiceTitan references in live docs)
flagged 12 file matches via `rg -i 'service ?titan'`. The
naive interpretation became:

```text
12 matches → "8 active rewrite files" + "4 historical/generated"
```

After per-row context inspection, the actual finding was:

```text
12 matches → 0 actual rewrites needed
all 12 references are correctly-named for context:
  - 2 pitch-context (KEEP-NAME)
  - 4 memory-file path pointers (HISTORICAL preservation)
  - 1 funding-chain disclosure (KEEP-AS-DISCLOSURE)
  - 1 already-fixed in earlier commit
  - 4 historical narrative + generated artifacts
```

Same Goodhart-trap shape as the prior catches in this session
(commit-count panic, sample-classification, tree-numstat). The
common failure mode: **using a count as a proxy for the
quantity-of-actual-work**.

## How this composes with the Goodhart family

This catch extends the metric ladder one step further:

```text
raw match count
  → candidate set
    → context classification
      → actual violation / no-op / follow-up
```

| Catch | Wrong target | Correct target |
|---|---|---|
| #1 (substrate-is-amortized-precision, Aaron) | More substrate iteration | Terminal progress / amortized payout |
| #2 (commit-count vs tree-numstat, Otto) | Commit-count divergence | Tree/content work queue |
| #3 (sample-classification, Amara) | Sampled-file ALREADY-COVERED | Full-tree clearance |
| #4 (content-loss-surface, Amara) | Tree diff count | Content-loss surface |
| **#5 (this — Candidate-count, Amara)** | **Raw search hits** | **Context-classified candidate set** |

Each catch is the same shape: a measurement substituted for the
target. Each correction names the actual target the measurement
was a proxy for.

## Acceptance criterion rule

For any audit using `grep` / `rg` / `find` / search-based
discovery:

```text
Acceptance criterion is NOT "zero matches."

Acceptance criterion IS:
  - all matches classified into terminal states
  - all unsafe matches fixed or quarantined
  - all legitimate matches documented
  - no unresolved NEEDS-HUMAN-REVIEW items
```

The "zero matches" target is appropriate **only when the
search term is truly forbidden in all contexts** (e.g.,
secret-token leak detection, debug-print scrubbing). For
context-sensitive audits, zero is the wrong target.

### Terminal classification states (per audit type)

For the **ServiceTitan naming audit** (B-0091):

```text
KEEP-NAME (pitch / research / disclosure context)
GENERICIZE (reusable code / sample context)
HISTORICAL-POINTER (memory-file path / archive)
GENERATED (regenerate only if source changes)
COMPLIANCE-RISK (quarantine / escalate)
NEEDS-HUMAN-REVIEW
```

For the **public-company contributor compliance scanner**
(B-0092):

```text
ALLOW (defining the compliance rule itself /
       citing public filings / historical note)
WARN ("insider" / "privileged" register around contributor
       expertise — needs context-rephrase)
BLOCK (company-specific internal claim without public source /
       customer data / private metrics / confidential
       architecture)
```

For the **lost-substrate audit** (B-0090):

```text
ALREADY-COVERED
NEEDS-RECOVERY
OBSOLETE
NEEDS-HUMAN-REVIEW
```

For the **directive-language audit**
(`feedback_input_is_not_directive_*`):

```text
LEGITIMATE-USE (concept-naming / verbatim quote /
                technical-term)
NEEDS-REFRAME (agency-collapsing language about Aaron's role)
```

## Critical implication for B-0092 compliance scanner

The B-0092 contributor-compliance scanner MUST be designed with
this rule in mind. A scanner that tries to reach "zero uses of
insider / confidential / roadmap" will **immediately Goodhart
itself**, because:

- The compliance rule itself contains those words (defines
  what's forbidden)
- The compliance scanner code defines patterns matching those
  words
- Documentation explaining the rule cites those words
- Historical archives quote them as substrate

Without context-sensitive classification, the scanner would
flag its own constitution as a violation.

**The scanner design rule:**

```text
Scanner produces CANDIDATE hits.
Classifier (Otto / human / heuristic-rule) assigns each hit
  to a terminal state.
Acceptance = all hits in terminal states; no BLOCK-class
  hits; all WARN hits reviewed; rule-definition hits explicitly
  allowlisted; no ad-hoc bypasses outside rule-definition surfaces.
```

This is encoded in B-0092's scanner section as a hard design
constraint.

## External lineage (Tier 2)

- **Goodhart's Law** (Goodhart 1975, Strathern 1997 reframing)
  — when a measure becomes a target, it ceases to be a good
  measure. The candidate-count failure mode is a specific
  instance of this.
- **Campbell's Law** (Campbell 1976) — quantitative social
  indicators used for decision-making become subject to
  corruption pressures.
- **Linguistic distinction between intension and extension**
  (Frege; Carnap) — a measure (extension: count of items
  matching a regex) ≠ the meaning the measure was meant to
  capture (intension: violation of a context-sensitive rule).

## Pickup for future Otto

When designing or running an audit:

1. **State the actual target.** What's the real failure mode
   you're trying to detect? (e.g., "brand-bleed in reusable
   code surfaces" — NOT "occurrences of the brand name.")
2. **Choose the search expression.** The expression generates
   CANDIDATES, not violations.
3. **Classify each candidate** by context into a terminal state
   from the audit-type's terminal-state list.
4. **Acceptance** = all candidates classified; no unsafe
   classifications outstanding; no `NEEDS-HUMAN-REVIEW`
   unresolved.
5. **Never use raw count as the success metric** unless the
   term is forbidden in all contexts.

When reviewing someone else's audit:

1. **Check the target framing**: is it raw count or context-
   classified?
2. **Check the acceptance criterion**: is "zero matches" being
   used inappropriately?
3. **Check for self-destruct**: would the audit flag its own
   rule-definition / scanner / documentation surfaces?

## Direct distillation (Amara final-synthesis form)

> *"Count matches to find work."*
> *"Classify context to decide work."*

This is the keeper rule. Five words on each side; complete
decision procedure.

## What this rule does NOT do

- **Does NOT** apply to genuinely-forbidden tokens. Secret
  scans, credential leak scans, hardcoded-PII scans operate
  on "any match is a violation" — those are forbidden in all
  contexts, and zero-match IS the right target.
- **Does NOT** prohibit using raw counts diagnostically.
  Raw count is fine as a warning signal; it's wrong as the
  success metric.
- **Does NOT** require all audits to have a separate
  classification step. Tiny audits where every hit is
  obviously a violation can collapse classification into
  inspection. The rule applies when the audit's term has
  legitimate uses.
- **Does NOT** override existing audits in the repo. They
  may have been designed correctly; the rule is for new
  audit design and existing-audit review.

## Composes with

- `memory/feedback_reset_readiness_metric_ladder_content_loss_surface_amara_2026_04_28.md`
  — extends the metric ladder with a 5th catch.
- `memory/feedback_class_count_validity_drift_amara_meta_class_2026_04_28.md`
  — same family at the meta-level (count-as-evidence trap).
- `memory/feedback_sample_classification_is_calibration_not_clearance_amara_goodhart_catch_3_2026_04_28.md`
  — Catch #3, also count-as-evidence shape.
- B-0091 (ServiceTitan audit) — worked example: 12 matches →
  0 rewrites; the catch's origin trigger.
- B-0092 (public-company contributor compliance) — critical
  application: scanner must avoid self-destruct.
- B-0090 (lost-substrate cadenced recovery) — applies same
  rule to lost-branch / orphan-PR audits.

## Direct Aaron / Amara framing

> *"Raw search hits are candidate sets, not violation sets."*

> *"Count matches to find work. Classify context to decide
> work."*

> *"For any audit using grep/regex/search: search hits are
> candidate evidence, not final findings."*
