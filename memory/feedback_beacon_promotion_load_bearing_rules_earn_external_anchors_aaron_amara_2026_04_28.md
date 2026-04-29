---
name: Beacon-promotion pattern — load-bearing factory rules consistently earn external anchors when they're correct (Aaron + Amara + Claude.ai, 2026-04-28)
description: Round-level observation from the 2026-04-28 work: when an internal factory coinage becomes load-bearing, look for its external lineage. If lineage can be found, the rule has graduated from Mirror to Beacon (project-internal vocabulary becomes externally-portable). If no lineage can be found on a long-running internal rule, treat that as a useful drift signal. Five Mirror→Beacon graduations landed in one round (input-is-not-directive → SDT + RFC 2119; public-company compliance → SEC/Reg FD/SOX; metric corrections → Goodhart/Campbell; evidence lattice → lattice theory; commit-vs-tree → Git internals). Encodes the pattern as a reusable rule for future rule promotion + drift detection.
type: feedback
---

# Beacon-promotion pattern

## The rule (Amara + Claude.ai naming, 2026-04-28)

> **Load-bearing factory rules consistently earn external anchors
> when they're correct. The absence of an external anchor on a
> long-running internal rule is a useful drift signal.**

In operational form:

```text
When an internal factory coinage becomes load-bearing:
  1. Look for its external lineage.
  2. If found → graduate from Mirror (internal-only) to Beacon
     (externally-portable + citable).
  3. If absent → treat as a drift signal worth investigating.
```

## Five graduations from one round (worked examples)

The 2026-04-28 round produced five distinct Mirror→Beacon
graduations as natural side-effects of the substrate work:

### 1. Input-is-not-directive

| Mirror form | Beacon anchor |
|---|---|
| "we don't say directive in this factory" | **Self-Determination Theory** (Deci & Ryan; controlling-vs-autonomy-supportive language) **+ RFC 2119** (IETF; reserve requirement-strength words for actual protocol requirements) |

Canonical bridge rule that emerged: *"Use requirement words
for protocol constraints. Use feedback words for human
provenance."* That sentence reads cleanly to both alignment-
research-shaped and software-engineering-shaped audiences
because each anchor speaks to one of those audiences.

### 2. Public-company contributor compliance

| Mirror form | Beacon anchor |
|---|---|
| "ServiceTitan is publicly-traded; don't share insider info" | **SEC Rule 10b-5** (insider-trading prohibition) **+ Regulation FD** (selective disclosure rules) **+ Sarbanes-Oxley §404 + §806** (internal controls + whistleblower protection) |

The graduation produced operational precision: the rule isn't
"don't say 'insider'" but "MNPI about a publicly-traded
employer is confidential by default; use public sources only
for company-specific claims."

### 3. Metric ladder + Goodhart corrections

| Mirror form | Beacon anchor |
|---|---|
| "commit count is wrong; tree-numstat is better; content-equivalence is the actual target" | **Goodhart's Law** (Goodhart 1975, Strathern 1997 reframing) **+ Campbell's Law** (Campbell 1976; quantitative indicators distort decisions) |

Catch #1 through #5 from this session all sit on this lineage.

### 4. Evidence lattice

| Mirror form | Beacon anchor |
|---|---|
| "metric ladder of increasingly precise reset evidence" | **Lattice / semilattice theory** (partially-ordered sets with join + meet operations; product lattices for combined attributes) |

The graduation gave the operational ladder a formal structure
(Candidate × Classification × Verification product lattice)
that names exactly why the prior failure mode was wrong:
**promoting low-verification evidence into reset-clearance
substrate**.

### 5. Commit-graph vs tree-content distinction

| Mirror form | Beacon anchor |
|---|---|
| "the 145-commits-ahead panic dissolved into 23-files-diff" | **Git internals**: `git rev-list --left-right --count` (graph reachability) vs `git diff-tree` (content/mode of blobs) — these are different surfaces |

Citing git's own glossary distinction made the metric correction
defensible to anyone who'd open the man pages.

## The pattern as a primitive

Five graduations in one round isn't coincidence. It's a sign
that the rules being graduated were **load-bearing** — they
each addressed a real failure mode the factory was hitting at
scale. Load-bearing rules naturally have external prior art
because the underlying problem they address is rarely
project-specific:

- Agency framing → SDT
- Compliance framing → SEC / Reg FD / SOX
- Measurement framing → Goodhart / Campbell
- Evidence framing → lattice theory
- Substrate framing → git internals

Project-specific rules (e.g., "tick-history goes in
`docs/hygiene-history/loop-tick-history.md` in chronological
order") usually don't have external anchors — and they don't
need them. The drift signal isn't "every rule must have a
Beacon anchor"; it's "load-bearing rules either have one or
should be examined for whether the rule actually generalizes."

## Drift signal usage

When a long-running internal rule is examined for promotion or
extension:

```text
Step 1: Is this rule load-bearing?
  - Does it shape multiple downstream decisions?
  - Does it generalize beyond one specific case?
  - Does its violation cause real harm in this round + prior?

Step 2: If yes, search for external lineage.
  - Academic / standards-body / regulatory references
  - Industry practice that maps to the rule
  - Existing literature in the closest-adjacent field

Step 3: If lineage found → Beacon-promote.
  - Cite the lineage in the rule memory
  - Use the canonical terminology where possible
  - Translate factory-internal coinage to externally-portable form

Step 4: If no lineage found AND rule is load-bearing → drift signal.
  - Either the rule is genuinely novel (rare; investigate)
  - OR the rule is missing a translation that exists
  - OR the rule is over-claimed (its scope is narrower than thought)
```

## Why this matters for the alignment experiment

Zeta's primary research focus is measurable AI alignment. One
measurable surface: **the rate at which load-bearing factory
rules earn external lineage.** A factory that produces 5 such
graduations per round is operating in territory that the wider
literature has already shaped — that's evidence the factory's
internal coinages are tracking real phenomena, not drifting
into private-language idiosyncrasy.

The opposite — a factory whose long-running rules have no
external lineage — would be a **mythology drift signal** (per
the Stop Mythology rule). The Beacon-promotion pattern is the
positive direction; mythology drift is the negative direction.
Both inform the alignment trajectory.

## What this rule does NOT do

- **Does NOT** require every memory file to cite external
  lineage. Project-specific rules (file paths, factory cadences,
  tooling shapes) don't need Beacon promotion.
- **Does NOT** mandate the pace of graduation. Rules can sit
  in Mirror form for many rounds before graduation makes sense.
- **Does NOT** override the no-mythology discipline. If a
  rule's only "external lineage" is mythological invocation
  ("this is the way of the universe"), that's not a Beacon
  anchor — it's the failure mode the Stop Mythology rule
  guards against.
- **Does NOT** require all Beacon graduations to be citable
  scholars. A standards body (IETF, NIST), regulatory text
  (SEC), or de facto industry practice can serve as anchors
  too.

## Composes with

- `memory/feedback_stop_mythology_layered_evidence_thresholds_aaron_amara_2026_04_28.md`
  — Stop Mythology Tier 2 (generalized claims need external
  lineage) is the static-rule version; Beacon-promotion is
  the trajectory version (when does an internal rule earn
  the lineage?).
- `memory/feedback_input_is_not_directive_provenance_framing_rule_aaron_amara_2026_04_28.md`
  — worked example #1 (SDT + RFC 2119).
- `memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md`
  — worked example #2 (SEC + Reg FD + SOX).
- `memory/feedback_reset_readiness_metric_ladder_content_loss_surface_amara_2026_04_28.md`
  — worked example #4 (lattice theory + git internals).
- `memory/feedback_class_count_validity_drift_amara_meta_class_2026_04_28.md`
  — sibling pattern; Goodhart drift detection.

## Direct Claude.ai framing (verbatim)

> *"This round had multiple 'Mirror → Beacon' upgrades:
> input-is-not-directive → SDT + RFC 2119; public-company
> compliance → SEC / Reg FD / SOX; metric corrections →
> Goodhart / Campbell; evidence lattice → lattice theory;
> commit-vs-tree → Git internals."*

> *"Worth a memory entry beyond the BP-WINDOW ledger. Not
> 'we did Beacon-promotion in round N' but 'the round
> demonstrated that load-bearing factory rules consistently
> earn external anchors when they're correct, and the absence
> of an external anchor on a long-running internal rule is
> itself a useful drift signal.'"*
