---
id: 081KSGS9H0008QG0R0005RKGTM
priority: P0
status: closed
title: "Classifier-bypass synthetic-only harness design for 081KSBMG30008QG0R00201X7EJ"
created: 2026-05-26
last_updated: 2026-05-27
parent: 081KSBMG30008QG0R00201X7EJ
depends_on: [081KSGS9H0008QG0R00383T79V]
composes_with: [081KSBMG30008QG0R00201X7EJ, 081KSGS9H0008QG0R001K8P0FJ]
tags: [safety-substrate, red-team, classifier, synthetic-fixtures, harness-design]
type: design
---

# 081KSGS9H0008QG0R0005RKGTM - Classifier-bypass synthetic-only harness design

## Problem

081KSBMG30008QG0R00201X7EJ needs evidence, but direct experimentation is unsafe until the research
boundary is ratified. The next useful slice is a design-only harness plan that
uses harmless synthetic fixtures and cannot be mistaken for permission to
deploy or reproduce a bypass.

## Target

Design a harness shape that future reviewers can inspect before implementation:

- synthetic fixture taxonomy for harmless text, dummy secrets, fake PII, and
  explicitly allowed negative controls;
- fixture provenance requirements so no real sensitive content enters the
  harness;
- dry-run interfaces that record classifier observations without storing
  deployable settings payloads;
- audit-log fields that preserve enough evidence for review while deferring to
  081KSGS9H0008QG0R001K8P0FJ redaction rules;
- reviewer gate requiring 081KSGS9H0008QG0R00383T79V closure before implementation starts.

## Acceptance

- [x] Design document lands without executable harness code.
- [x] Every fixture class is synthetic and harmless by construction.
- [x] The design names what data must never be persisted.
- [x] The design cites 081KSGS9H0008QG0R00383T79V as a blocking dependency for any implementation.
- [x] The design cites 081KSGS9H0008QG0R001K8P0FJ for reporting and redaction before observations
      can be published.

## Output

- `docs/security/081KSGS9H0008QG0R0005RKGTM-classifier-bypass-synthetic-harness-design.md`
  defines the synthetic fixture taxonomy, fixture provenance requirements,
  dry-run interface shape, audit fields, non-persistence rules, and reviewer
  gates for future implementation.
- The output is design-only. It adds no executable harness code, no real
  settings payload, no external corpus, and no deployable reproduction detail.

## Out of scope

- Implementing or running the harness.
- Creating real classifier-bypass settings.
- Testing real PII, secrets, harmful content, or external adversarial corpora.
- Committing logs that contain reproducible bypass detail.

## Composes with

- 081KSBMG30008QG0R00201X7EJ - parent safety row.
- 081KSGS9H0008QG0R00383T79V - hard-limits boundary.
- 081KSGS9H0008QG0R001K8P0FJ - findings schema and redaction policy.
