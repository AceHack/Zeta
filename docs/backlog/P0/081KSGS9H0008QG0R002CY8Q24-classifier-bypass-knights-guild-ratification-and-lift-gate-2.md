---
id: 081KSGS9H0008QG0R002CY8Q24
priority: P0
status: closed
title: "Classifier-bypass Knights Guild ratification and standing-constraint lift gate"
created: 2026-05-26
last_updated: 2026-05-29
renumbered_from: 081KSGS9H0008QG0R00280HHA7
parent: 081KSBMG30008QG0R00201X7EJ
depends_on: [081KSGS9H0008QG0R00287K8FR, 081KSGS9H0008QG0R001HC663P]
composes_with: [081KRW63S0008QG0R003TX8MG5, 081KS3X9Y0008QG0R00218150M, 081KSBMG30008QG0R00201X7EJ]
tags: [safety-substrate, classifier-floor, knights-guild, ratification, operator-self-constraint]
type: governance-gate
---

# 081KSGS9H0008QG0R002CY8Q24 - Classifier-bypass Knights Guild ratification and lift gate

## Problem

081KSBMG30008QG0R00201X7EJ says the standing operator-self-constraint can lift only after Zeta is
demonstrably safer than the external classifier and maintainers explicitly
reauthorize. The project needs a concrete gate for that future decision, not
an informal chat memory.

## Target

Define the ratification packet required before 081KSBMG30008QG0R00201X7EJ can close or its
standing constraint can lift:

- inputs from 081KSGS9H0008QG0R00287K8FR safety-substrate inventory;
- evidence that relevant floors are mechanical or reviewer-ratified, not only
  aspirational;
- Knights Guild / Constitution-Class review criteria per 081KRW63S0008QG0R003TX8MG5;
- maintainer reauthorization requirements;
- rollback and retraction path if a lift decision is later found unsafe.

The gate lives at
`docs/security/081KSGS9H0008QG0R002CY8Q24-classifier-bypass-ratification-gate.md`.

## Acceptance

- [x] Ratification-gate document lands in a durable repo surface and is linked
      from 081KSBMG30008QG0R00201X7EJ.
- [x] The gate requires 081KSGS9H0008QG0R00287K8FR and 081KSGS9H0008QG0R001HC663P before closure can be proposed.
- [x] The gate distinguishes "research may continue" from "bypass deployment
      is allowed"; the latter remains forbidden unless explicitly lifted.
- [x] The gate includes required evidence, reviewers, and rollback path.
- [x] 081KSBMG30008QG0R00201X7EJ closure criteria are updated to cite this gate.

## Output

- `docs/security/081KSGS9H0008QG0R002CY8Q24-classifier-bypass-ratification-gate.md` defines the
  evidence packet, decision states, reviewer requirements, rollback
  requirements, and non-goals for any future 081KSBMG30008QG0R00201X7EJ lift proposal.
- 081KSBMG30008QG0R00201X7EJ now cites this gate in its closure path. Closing 081KSGS9H0008QG0R002CY8Q24 does not
  close 081KSBMG30008QG0R00201X7EJ, relax the 081KSGS9H0008QG0R00383T79V boundary, or authorize classifier-bypass
  deployment.

## Out of scope

- Ratifying the lift decision.
- Deploying classifier-bypass behavior.
- Weakening hard-limits or operator-self-constraint rules.

## Composes with

- 081KRW63S0008QG0R003TX8MG5 - Knights Guild / Constitution-Class substrate.
- 081KS3X9Y0008QG0R00218150M - multi-oracle BFT safety substrate.
- 081KSBMG30008QG0R00201X7EJ - parent standing constraint.
- 081KSGS9H0008QG0R00287K8FR - safety-substrate inventory.
- 081KSGS9H0008QG0R001HC663P - refusal pattern.
