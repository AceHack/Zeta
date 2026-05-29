# B-0810 Classifier-Bypass Ratification Gate

Status: governance gate for B-0720. This document does not authorize
classifier-bypass deployment.

## Purpose

B-0720 records a standing operator-self-constraint: no maintainer request can
authorize classifier-bypass deployment until Zeta has a ratified safety floor
that is demonstrably stronger than the external classifier for the relevant
content classes. This gate defines the evidence packet and ratification path
required before that constraint can be lifted.

The default remains refusal. Research may continue only inside the B-0798
boundary and B-0807 reporting schema. Deployment, reproduction, or expansion
of a bypass mechanism remains forbidden unless every section below is
satisfied and maintainers explicitly reauthorize.

## Required Inputs

The ratification packet must cite current revisions of:

- `docs/security/B-0720-classifier-bypass-research-boundary.md` - active
  research boundary and stop conditions.
- `docs/security/B-0807-classifier-bypass-findings-schema.md` - allowed
  finding format and redaction rules.
- `docs/security/B-0808-zeta-safety-substrate-inventory.md` - candidate floors,
  maturity gaps, and the input format for this gate.
- `docs/security/B-0809-operator-refusal-pattern.md` - refusal discipline while
  the standing constraint remains active.
- B-0628 / Knights Guild or successor constitution-class review substrate.
- B-0703 or successor multi-oracle safety substrate, if used as part of the
  proposed replacement floor.
- The B-0720 empirical mapping records, using redacted observation IDs rather
  than reproducible bypass detail.

Missing or stale input keeps the lift decision blocked.

## Gate Criteria

| Criterion | Required evidence |
|---|---|
| Boundary current | B-0798 is still the active boundary, or a successor boundary has been ratified through this gate. |
| Findings safe to preserve | Every empirical claim is represented through the B-0807 schema and omits reproducible bypass settings, harmful content, secrets, real PII, and operational recipes. |
| Safety floor is mechanical or ratified | Each replacement floor is either mechanically enforced in CI/runtime or explicitly reviewer-ratified with named reviewers and scope. Reviewer-only claims cannot replace a mechanical classifier by themselves. |
| Stronger-than-classifier comparison | The packet compares candidate Zeta floors against the external classifier by content class, including negative controls and known refusal classes. |
| Remaining gaps named | Every gap from the B-0808 inventory is closed, deferred with a blocker, or declared out of scope for a non-deployment decision. |
| Maintainer reauthorization | Aaron and any currently named maintainers explicitly reauthorize the lift after reviewing the packet. Prior chat or implied consent is insufficient. |
| Rollback path | The packet names the commits, rules, or config surfaces to revert if a post-lift finding shows the replacement floor is insufficient. |

All criteria must pass before B-0720 can close or the standing constraint can
lift.

## Decision States

- **Research continues** - defensive mapping and reports remain allowed inside
  B-0798/B-0807. No deployment authority changes.
- **Ratification denied** - one or more gate criteria fail. The refusal pattern
  in B-0809 remains the active response.
- **Ratification deferred** - evidence is promising but incomplete. The packet
  must name concrete blockers and keep B-0720 open.
- **Lift-ready** - every gate criterion passes. This state only makes B-0720
  eligible for a separate closure PR that updates the standing rule, backlog
  row, and any affected reviewer instructions. It does not itself deploy a
  bypass.

## Reviewer Requirements

A lift-ready packet requires:

1. Knights Guild / constitution-class review, or the current ratified successor.
2. A security reviewer focused on harmful-content, credentials, PII, and
   operationalization risk.
3. A governance reviewer focused on operator-self-constraint preservation and
   maintainer reauthorization.
4. A rollback reviewer who verifies the named undo path is bounded and testable.

Reviewers must record findings in the PR or a durable review file. Silence is
not approval.

## Rollback Requirements

The closure PR for B-0720 must include:

- the rule or config surfaces that would change if the lift proceeds;
- the exact revert path for those surfaces;
- a stop condition that immediately restores the B-0809 refusal response if a
  post-lift observation shows the replacement floor is weaker than expected;
- owner names for the rollback decision.

Rollback must be possible by normal git revert and, where runtime config is
involved, by a bounded configuration change. No force-push or destructive
history rewrite is part of the rollback path.

## Non-Goals

- This gate does not run experiments.
- This gate does not preserve bypass recipes.
- This gate does not weaken B-0798, B-0807, B-0808, or B-0809.
- This gate does not let a maintainer override the standing constraint by
  request alone.

## Closure Linkage

B-0810 can close when this gate is linked from B-0720 and the B-0810 backlog
row. B-0720 can close later only through a separate lift-ready packet that
passes this gate.
