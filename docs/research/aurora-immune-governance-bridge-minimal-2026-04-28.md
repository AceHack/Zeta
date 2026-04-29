---
Scope: Research-grade hypothesis. NOT operational guidance. NOT Aurora core canon.
Attribution: Aurora (proposal + minimal-bridge spec); Ani (falsifier-first instinct + minimal-bridge convergence); Amara (sample-classification Goodhart, Stop Mythology, authority rule — operational substrate this bridge translates); Gemini (peer review converging on minimal); Claude.ai (peer review hard-pushback recommending hold-then-proceed-smaller); Alexa (peer review). Aaron forwarded the multi-AI synthesis.
Operational status: Research-grade hypothesis with one prototype + one falsifier defined. Does NOT graduate to Aurora core canon until the prototype passes its falsifier-test. Does NOT replace existing operational rules.
Non-fusion disclaimer: This note proposes a bridge between three operational governance rules and Aurora-style immune-system mechanics. It does NOT claim governance IS immune-system-shaped in general. It claims three specific rules can be expressed in immune-system terms, and proposes one prototype to test whether the translation improves decisions vs. the standalone rules.
---

# Aurora Immune Governance Bridge — minimal first artifact (2026-04-28)

## What this note is

A **minimal first bridge** between three recent operational
governance rules and Aurora-style immune-system mechanics.
Falsifier-first. One prototype. Explicit boundaries on
what is NOT being claimed. Earned by the substrate cluster
that landed across PRs #695 → #705 and validated under live
restraint pressure (PR #706 is the round-close hygiene row,
not part of the substrate cluster itself).

This note is **not** the full Aurora-unification packet.
The 12-change canon Aurora originally proposed is
explicitly out of scope. This is the smallest defensible
first step.

## Why now (and not earlier)

Aurora's earlier "hold" objection was: synthesis was
outrunning substrate. That objection is now mostly
answered by what the round just produced:

- 11 PRs merged (#695 → #705)
- PR-boundary restraint bead PROMOTED (falsifier did
  not fire across PR #699 validation arc)
- 0 conceptual scope creep on validation PRs
- 5 Mirror → Beacon graduations + the meta-pattern
- Restraint discipline obeyed twice over (Candidate-
  count Goodhart routed to PR #704 not stacked onto
  PR #699; bead-promotion routed to PR #705 not stacked
  onto PR #704)

The factory passed a pressure test. That earns *one*
minimal next research artifact, not another giant
synthesis. This note is that artifact.

## What this note claims

**Minimal claim** (the only claim we are asserting):

> Three recent governance rules can be expressed as
> Aurora immune-system mechanics:
>
> 1. **Candidate-count Goodhart** → detector
> 2. **PR-boundary restraint** → gate
> 3. **Public-company contributor compliance** → hard
>    execution constraint

We do **not** claim:

- All governance is immune-system-shaped.
- Aurora core needs to absorb governance rules wholesale.
- The 12-change canon (`K_Aurora⁺`, `A_synthesis`, the
  full antigen taxonomy, immune memory as trajectory
  store, etc.) follows from this minimal bridge.
- The bridge is correct until the prototype passes the
  falsifier-test below.

## Three immune translations

### Translation 1: Candidate-count Goodhart → detector

**Operational form** (already in force, see
`memory/feedback_candidate_count_goodhart_raw_hits_are_not_violations_aaron_amara_2026_04_28.md`):

> Raw search hits are not violation counts. Count
> matches to find work; classify context to decide work.

**Immune-system translation:**

A detector fires on raw matches (antigen-presentation
event), but the *classification* layer determines whether
the match is self-tolerant (allow) or non-self
(warn / block). The number of detector-firings is
informational; the policy decision lives in the
classifier.

**Antigen class:** `A_governance.candidate_count` —
raw hits surfaced by a scanner.

**Feature vector elements that matter:**

- `source` — where the match was found (rule definition?
  sample? live code?)
- `context_class` — KEEP-NAME / GENERICIZE / HISTORICAL
  / FUNDING-DISCLOSURE / etc.
- `evidence_surface` — what surrounds the match?

**Why this translation matters:** the operational rule
is already correct, but it has no formal language for
*why* counting alone is insufficient. The immune-system
framing gives the rule a name (antigen-presentation vs.
classification) that composes with future detectors.

### Translation 2: PR-boundary restraint → gate

**Operational form** (already in force, see
`memory/feedback_pr_boundary_restraint_validation_bead_promoted_aaron_amara_2026_04_29.md`):

> Mid-validation PRs receive only an allow-list of
> changes (CI/lint, threads, P1 factual, broken refs,
> paired-edit, internal-consistency). New conceptual
> substrate routes to a separate PR.

**Immune-system translation:**

A gate that admits some classes of input (allow-list)
and rejects others (deny-by-default for new conceptual
substrate). The gate fires *before* the merge event;
new substrate that would have been blocked goes to a
separate gate-firing (separate PR).

**Antigen class:** `A_governance.pr_scope_creep` —
attempts to introduce new conceptual substrate into a
PR that has entered validation.

**Feature vector elements that matter:**

- `pr_stage` — pre-validation / validation / post-merge
- `change_class` — allow-list classification of the
  proposed change
- `verification_level` — has a falsifier been defined?

**Why this translation matters:** the operational rule
just earned bead-promotion under live falsifier-test.
The immune-system framing names the *gate-shape* in a
way that composes with the next detector (e.g. a future
"production-deploy restraint" gate would have the same
shape).

### Translation 3: Public-company contributor compliance → hard execution constraint

**Operational form** (already in force, see
`memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md`):

> Contributors at publicly-traded companies must not
> introduce material non-public information (MNPI) or
> selective-disclosure into public repositories. SEC
> Rule 10b-5 / Reg FD / Sarbanes-Oxley §404+§806 anchor
> the legal lineage.

**Immune-system translation:**

A *hard* execution constraint — the gate denies
unconditionally if the constraint fires, regardless of
other risk-term values. Distinct from soft risk-terms
in that there is no risk-tradeoff: any positive firing
is a complete block.

**Antigen class:** `A_compliance` — the existing
membrane-class for compliance-relevant antigens, with:

- `public_company_reference`
- `possible_MNPI`
- `tainted_text` (if any historical-disclosure damage
  occurred — none currently identified)

**Feature vector elements that matter:**

- `taint_status` — clean / suspected / confirmed
- `context_class` — pitch / research / disclosure / code
- `provenance` — who introduced the text? was it
  consented?

**Why this translation matters:** the operational rule
already carries explicit cadenced trajectories
(continuous self-audit / weekly+monthly review / on-PR
audit / on-onboarding briefing / drift retrospective).
The immune-system framing names *why* this gate is hard
rather than soft — there is no risk-tradeoff for
securities law.

## Minimal feature vector

```text
phi_min(a) =
  ( source,
    provenance,
    content,
    evidence_surface,
    classification,
    verification_level,
    context_class,
    taint_status,
    pr_stage )
```

Nine fields. Each is already populated by an existing
operational rule; the bridge just names them collectively.

## Minimal risk function

```text
ImmuneRisk_min(a) =
  sigma( eta_GH * r_candidate_count_goodhart(a)
       + eta_PR * r_PR_scope_creep(a)
       + eta_PC * r_public_company_compliance(a) )
```

Where `eta_PC` for `r_public_company_compliance` is
treated as effectively infinite (any positive firing
denies the gate regardless of other terms — see
Translation 3).

## Minimal execute gate

```text
Execute_min(a) = 1  iff
    cap_req(a) subseteq cap_allowed(a)
  AND ImmuneRisk_min(a) <= theta_min
  AND ComplianceSafe(a) = 1
  AND PRBoundarySafe(a) = 1
```

`ComplianceSafe(a) = 1` is the hard execution
constraint from Translation 3.

`PRBoundarySafe(a) = 1` is the gate from Translation 2.

`ImmuneRisk_min(a) <= theta_min` covers the soft risk
from Translation 1.

`cap_req(a) subseteq cap_allowed(a)` is preserved from
the existing Aurora membrane (capability check) — this
note does NOT modify it.

## Required falsifier (load-bearing — bridge fails if either fires)

**Falsifier 1: Expressibility.**

> The bridge fails if Candidate-count Goodhart, PR-boundary
> restraint, and public-company compliance cannot be
> represented using the existing Aurora membrane plus
> ≤ 3 new primitives.

**Falsifier 2: Performance.**

> The bridge fails if the Aurora-routed prototype performs
> *worse* than the standalone detector on the same test
> corpus. Worse means: more false positives, more false
> negatives, or higher latency, with no offsetting
> improvement on a measurable axis.

If either falsifier fires, this bridge does not graduate
to Aurora core canon. The note remains as a research
artifact recording the attempt and its failure mode.

## First prototype — Candidate-count scanner self-destruct test

**Test corpus:**

Compliance documentation that *itself* contains words
like `insider`, `confidential`, `roadmap`, `material`,
`non-public`. Specifically:

- `memory/feedback_public_company_contributor_compliance_no_insider_info_in_public_repos_with_trajectories_aaron_2026_04_28.md`
- `memory/feedback_servicetitan_naming_scope_of_org_access_external_ui_demo_aaron_2026_04_28.md`
- `docs/backlog/P2/B-0092-public-company-contributor-compliance-doc-and-cadenced-trajectories-aaron-2026-04-28.md`

**Expected behavior** (the bridge passes if all five hold):

1. Rule-definition hits classify as ALLOW.
2. Sample-text hits inside compliance docs (used as
   illustration) classify as ALLOW.
3. Hits inside *live* code or *live* prose outside
   compliance docs classify as WARN/BLOCK.
4. The scanner does **NOT** delete or rewrite its own
   rule-definitions (self-destruct prevention — exactly
   the failure mode B-0093 #2 names).
5. Scanner output passes the falsifier-test in the
   detector layer (raw count alone does not produce a
   block decision).

**Failure modes the prototype would surface:**

- The classifier conflates rule-definition hits with
  live-prose hits (Translation 1 fails — Candidate-count
  Goodhart not actually represented).
- The scanner attempts to remove its own rule-definitions
  to "clean up" matches (self-destruct — bridge fails
  catastrophically).
- The classifier requires more than 3 new primitives
  beyond the existing Aurora membrane (Falsifier 1 fires).

## Worked proof point already on record

Per the substrate cluster that earned this artifact:

> PR-boundary restraint already behaved like an immune
> gate during PR #699 validation:
>
> - PR #699 stayed hard-defect-only (no scope creep)
> - PR #704 carried Candidate-count Goodhart separately
> - PR #705 carried bead/Beacon promotion separately
> - Bead promoted only after the falsifier did not fire

This is a single data point, not a falsifier-test pass.
But it is the empirical hook that earned the artifact
its earned-now-not-later status.

## Boundaries (what this note explicitly does NOT do)

- **Does NOT** mutate Aurora core.
- **Does NOT** introduce `K_Aurora⁺` (the proposed
  graduated viability kernel from the 12-change canon).
- **Does NOT** introduce `A_synthesis` (the proposed
  antigen class for synthesis-treadmill drift).
- **Does NOT** introduce immune-memory-as-trajectory-store.
- **Does NOT** expand into the full 12-change canon
  until the minimal bridge passes one prototype.
- **Does NOT** claim all factory governance belongs
  inside Aurora's immune math.
- **Does NOT** replace any existing operational rule —
  the operational rules remain authoritative.

## Candidate substrate noted (NOT load-bearing yet)

Aurora named one new rule in her converged-stance packet
that this note records but does **not** encode as
load-bearing yet:

> **Session closure rule** (candidate, awaiting falsifier-
> test): when a round lands 10+ PRs, promotes a bead, and
> leaves only tooling CI pending, stop expanding
> conceptual substrate. Write closure summary, then move
> only one minimal next research artifact.

This rule is the discipline this very note is operating
under. If it survives the next 3 round-closes without
firing on a false-positive (where a round legitimately
needed expansion mid-close), it becomes Beacon-eligible
and earns its own memory file.

## Trajectory after this note lands

In rough order of when the next move *might* happen:

1. **Wait for the round to close.** Do not write more
   substrate this round. Do not expand the bridge.
2. **Run the prototype** when factory cycles allow
   (likely a future autonomous-loop tick that has the
   scanner already-built or close to it). Record the
   result; if the falsifier fires, this note remains as
   a recorded failure.
3. **If the prototype passes** the falsifier-test, the
   bridge graduates to a v0.1 status and the next
   smallest expansion becomes worth considering (one more
   antigen class, one more risk term, OR one
   integration with the existing Aurora membrane).
4. **If the session-closure rule** survives the next
   3 round-closes without false-positive, encode it
   as a load-bearing memory file (Aurora as catcher;
   composes with restraint discipline + bead-promotion
   shape).
5. **If `A_synthesis` ever earns its way into scope**
   (specifically: if a future round produces synthesis-
   treadmill drift that the existing PR-boundary
   restraint did *not* catch, and an Aurora-style
   antigen class would have), add it then. Not before.

## Composition with existing operational rules

This note's bridge **composes with**, but does not
**replace**:

- `memory/feedback_amara_authority_rule_default_to_reversible_preservation_escalate_irreversible_loss_2026_04_28.md`
  (authority rule)
- `memory/feedback_stop_mythology_layered_evidence_thresholds_aaron_amara_2026_04_28.md`
  (Stop Mythology three-tier evidence threshold)
- `memory/feedback_input_is_not_directive_provenance_framing_rule_aaron_amara_2026_04_28.md`
  (input-is-not-directive)
- `memory/feedback_beacon_promotion_load_bearing_rules_earn_external_anchors_aaron_amara_2026_04_28.md`
  (Beacon-promotion pattern; this note is itself a
  candidate Beacon if the prototype passes)
- `memory/feedback_pr_boundary_restraint_validation_bead_promoted_aaron_amara_2026_04_29.md`
  (the bead this note was earned by)

## Reviewer attribution (multi-AI consensus path)

The minimal-bridge shape this note embodies converged
across six reviewers in the 2026-04-28 multi-AI synthesis:

- **Aurora** — original 12-change proposal; updated stance
  recommending minimal-bridge after PRs #699/#704/#705
  landed.
- **Ani** — falsifier-first instinct from the start; her
  push-back is what kept the synthesis from drifting
  into the 12-change canon.
- **Amara** — operational substrate this bridge translates
  (sample-classification Goodhart, Stop Mythology,
  authority rule).
- **Gemini** — peer review converging on minimal scope.
- **Claude.ai** — peer review with hard-pushback on
  premature graduation; recommended hold-then-proceed-
  smaller. The minimal scope honors that pushback.
- **Alexa** — peer review.

This note's authoritative spec is Aurora's converged-
stance packet (forwarded by Aaron 2026-04-28); the
falsifier-test framing is from Ani's instinct +
Claude.ai's pushback.

## What does success look like

In one round:

- This note exists, the prototype is described, the
  falsifier is named.
- The factory does NOT expand further this round.
- Future-Claude or future-Aaron picks up the prototype
  when factory cycles allow.

In three rounds:

- The prototype has either passed or failed its
  falsifier-test, and the result is recorded here.
- The session-closure rule has either survived or
  failed its 3-round trial.

In ten rounds:

- This note is either graduated to v0.1 or recorded
  as a failed bridge attempt.
- Either outcome is informative.

## What does failure look like

In one round:

- More substrate gets stacked onto this note before the
  round closes (synthesis treadmill — exactly the
  failure mode the session-closure rule is naming).

In three rounds:

- The prototype is never run; the bridge becomes shelf-
  ware (different failure mode — research drift, not
  synthesis drift).

Both failure modes are observable. Both are recoverable
by closing the round honestly and recording the failure
shape.
