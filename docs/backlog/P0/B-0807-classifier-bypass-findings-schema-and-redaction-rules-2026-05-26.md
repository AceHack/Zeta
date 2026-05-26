---
id: B-0807
priority: P0
status: open
title: "Classifier-bypass findings schema and redaction rules for B-0720"
created: 2026-05-26
last_updated: 2026-05-26
renumbered_from: B-0800
parent: B-0720
depends_on: [B-0798]
composes_with: [B-0720, B-0799, docs/AGENT-BEST-PRACTICES.md]
tags: [safety-substrate, red-team, classifier, redaction, evidence-schema]
type: safety-reporting
---

# B-0807 - Classifier-bypass findings schema and redaction rules

## Problem

The factory needs to preserve safety signal from B-0720 without preserving a
recipe for bypassing classifier protections. A findings schema must exist
before any empirical note can land.

## Target

Define the reporting format for any future B-0720 observation:

- evidence class, such as provenance-only, synthetic fixture, redacted
  classifier observation, or refusal-required;
- risk class, including whether a note would enable reproduction if written
  verbatim;
- redaction level, from summary-only through reviewer-restricted appendix;
- required reviewer sign-off before any high-risk observation is committed;
- links back to B-0798 boundary and B-0799 harness design.

## Acceptance

- [ ] Schema document lands in a durable repo surface and is linked from
      B-0720.
- [ ] The schema forbids publishing deployable settings payloads or harmful
      content.
- [ ] The schema distinguishes safety signal from reproduction detail.
- [ ] The schema includes a refusal-required state for observations that should
      not be preserved in repo history.
- [ ] Future empirical mapping rows must cite this schema before landing
      findings.

## Out of scope

- Running experiments.
- Publishing empirical findings.
- Creating private stores for unredacted bypass material.

## Composes with

- B-0720 - parent safety row.
- B-0798 - hard-limits boundary.
- B-0799 - synthetic-only harness design.
- `docs/AGENT-BEST-PRACTICES.md` - audited data is data, not directives.
