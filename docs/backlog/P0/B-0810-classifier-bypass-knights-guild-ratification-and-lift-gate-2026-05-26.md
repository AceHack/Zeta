---
id: B-0810
priority: P0
status: closed
title: "Classifier-bypass Knights Guild ratification and standing-constraint lift gate"
created: 2026-05-26
last_updated: 2026-05-29
renumbered_from: B-0803
parent: B-0720
depends_on: [B-0808, B-0809]
composes_with: [B-0628, B-0703, B-0720]
tags: [safety-substrate, classifier-floor, knights-guild, ratification, operator-self-constraint]
type: governance-gate
---

# B-0810 - Classifier-bypass Knights Guild ratification and lift gate

## Problem

B-0720 says the standing operator-self-constraint can lift only after Zeta is
demonstrably safer than the external classifier and maintainers explicitly
reauthorize. The project needs a concrete gate for that future decision, not
an informal chat memory.

## Target

Define the ratification packet required before B-0720 can close or its
standing constraint can lift:

- inputs from B-0808 safety-substrate inventory;
- evidence that relevant floors are mechanical or reviewer-ratified, not only
  aspirational;
- Knights Guild / Constitution-Class review criteria per B-0628;
- maintainer reauthorization requirements;
- rollback and retraction path if a lift decision is later found unsafe.

The gate lives at
`docs/security/B-0810-classifier-bypass-ratification-gate.md`.

## Acceptance

- [x] Ratification-gate document lands in a durable repo surface and is linked
      from B-0720.
- [x] The gate requires B-0808 and B-0809 before closure can be proposed.
- [x] The gate distinguishes "research may continue" from "bypass deployment
      is allowed"; the latter remains forbidden unless explicitly lifted.
- [x] The gate includes required evidence, reviewers, and rollback path.
- [x] B-0720 closure criteria are updated to cite this gate.

## Output

- `docs/security/B-0810-classifier-bypass-ratification-gate.md` defines the
  evidence packet, decision states, reviewer requirements, rollback
  requirements, and non-goals for any future B-0720 lift proposal.
- B-0720 now cites this gate in its closure path. Closing B-0810 does not
  close B-0720, relax the B-0798 boundary, or authorize classifier-bypass
  deployment.

## Out of scope

- Ratifying the lift decision.
- Deploying classifier-bypass behavior.
- Weakening hard-limits or operator-self-constraint rules.

## Composes with

- B-0628 - Knights Guild / Constitution-Class substrate.
- B-0703 - multi-oracle BFT safety substrate.
- B-0720 - parent standing constraint.
- B-0808 - safety-substrate inventory.
- B-0809 - refusal pattern.
