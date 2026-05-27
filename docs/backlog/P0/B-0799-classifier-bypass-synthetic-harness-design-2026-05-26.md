---
id: B-0799
priority: P0
status: closed
title: "Classifier-bypass synthetic-only harness design for B-0720"
created: 2026-05-26
last_updated: 2026-05-27
parent: B-0720
depends_on: [B-0798]
composes_with: [B-0720, B-0807]
tags: [safety-substrate, red-team, classifier, synthetic-fixtures, harness-design]
type: design
---

# B-0799 - Classifier-bypass synthetic-only harness design

## Problem

B-0720 needs evidence, but direct experimentation is unsafe until the research
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
  B-0807 redaction rules;
- reviewer gate requiring B-0798 closure before implementation starts.

## Acceptance

- [x] Design document lands without executable harness code.
- [x] Every fixture class is synthetic and harmless by construction.
- [x] The design names what data must never be persisted.
- [x] The design cites B-0798 as a blocking dependency for any implementation.
- [x] The design cites B-0807 for reporting and redaction before observations
      can be published.

## Output

- `docs/security/B-0799-classifier-bypass-synthetic-harness-design.md`
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

- B-0720 - parent safety row.
- B-0798 - hard-limits boundary.
- B-0807 - findings schema and redaction policy.
