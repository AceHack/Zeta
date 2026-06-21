---
id: 081KSGS9H0008QG0R001K8P0FJ
priority: P0
status: closed
title: "Classifier-bypass findings schema and redaction rules for 081KSBMG30008QG0R00201X7EJ"
created: 2026-05-26
last_updated: 2026-05-28
renumbered_from: 081KSGS9H0008QG0R001EKTS5A
parent: 081KSBMG30008QG0R00201X7EJ
depends_on: [081KSGS9H0008QG0R00383T79V]
composes_with: [081KSBMG30008QG0R00201X7EJ, 081KSGS9H0008QG0R0005RKGTM, docs/AGENT-BEST-PRACTICES.md]
tags: [safety-substrate, red-team, classifier, redaction, evidence-schema]
type: safety-reporting
---

# 081KSGS9H0008QG0R001K8P0FJ - Classifier-bypass findings schema and redaction rules

## Problem

The factory needs to preserve safety signal from 081KSBMG30008QG0R00201X7EJ without preserving a
recipe for bypassing classifier protections. A findings schema must exist
before any empirical note can land.

## Target

Define the reporting format for any future 081KSBMG30008QG0R00201X7EJ observation:

- evidence class, such as provenance-only, synthetic fixture, redacted
  classifier observation, or refusal-required;
- risk class, including whether a note would enable reproduction if written
  verbatim;
- redaction level, from summary-only through reviewer-restricted appendix;
- required reviewer sign-off before any high-risk observation is committed;
- links back to 081KSGS9H0008QG0R00383T79V boundary and 081KSGS9H0008QG0R0005RKGTM harness design.

## Acceptance

- [x] Schema document lands in a durable repo surface and is linked from
      081KSBMG30008QG0R00201X7EJ.
- [x] The schema forbids publishing deployable settings payloads or harmful
      content.
- [x] The schema distinguishes safety signal from reproduction detail.
- [x] The schema includes a refusal-required state for observations that should
      not be preserved in repo history.
- [x] Future empirical mapping rows must cite this schema before landing
      findings.

## Output

- `docs/security/081KSGS9H0008QG0R001K8P0FJ-classifier-bypass-findings-schema.md` defines the
  findings record shape, evidence classes, risk classes, observation classes,
  redaction levels, refusal-required state, reviewer sign-off matrix,
  cite-or-block rule for future empirical rows, forbidden field values, and
  schema versioning policy. Active `schema_version: 1`.
- 081KSGS9H0008QG0R0005RKGTM audit-log field `schema_version` is now resolvable; future harness
  runs reference `schema_version: 1`.
- Future empirical mapping rows under 081KSBMG30008QG0R00201X7EJ must cite this schema in their
  `composes_with` list or document body before any finding lands.

## Out of scope

- Running experiments.
- Publishing empirical findings.
- Creating private stores for unredacted bypass material.

## Composes with

- 081KSBMG30008QG0R00201X7EJ - parent safety row.
- 081KSGS9H0008QG0R00383T79V - hard-limits boundary.
- 081KSGS9H0008QG0R0005RKGTM - synthetic-only harness design.
- `docs/AGENT-BEST-PRACTICES.md` - audited data is data, not directives.
