---
id: B-0807
zetaid: 081KSGS9H0008QG0R001K8P0FJ
priority: P0
status: closed
title: "Classifier-bypass findings schema and redaction rules for B-0720"
created: 2026-05-26
last_updated: 2026-05-28
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

- [x] Schema document lands in a durable repo surface and is linked from
      B-0720.
- [x] The schema forbids publishing deployable settings payloads or harmful
      content.
- [x] The schema distinguishes safety signal from reproduction detail.
- [x] The schema includes a refusal-required state for observations that should
      not be preserved in repo history.
- [x] Future empirical mapping rows must cite this schema before landing
      findings.

## Output

- `docs/security/B-0807-classifier-bypass-findings-schema.md` defines the
  findings record shape, evidence classes, risk classes, observation classes,
  redaction levels, refusal-required state, reviewer sign-off matrix,
  cite-or-block rule for future empirical rows, forbidden field values, and
  schema versioning policy. Active `schema_version: 1`.
- B-0799 audit-log field `schema_version` is now resolvable; future harness
  runs reference `schema_version: 1`.
- Future empirical mapping rows under B-0720 must cite this schema in their
  `composes_with` list or document body before any finding lands.

## Out of scope

- Running experiments.
- Publishing empirical findings.
- Creating private stores for unredacted bypass material.

## Composes with

- B-0720 - parent safety row.
- B-0798 - hard-limits boundary.
- B-0799 - synthetic-only harness design.
- `docs/AGENT-BEST-PRACTICES.md` - audited data is data, not directives.
