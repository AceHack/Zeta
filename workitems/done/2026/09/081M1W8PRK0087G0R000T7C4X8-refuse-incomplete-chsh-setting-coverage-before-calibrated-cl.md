---
id: 081M1W8PRK0087G0R000T7C4X8
type: bug
state: done
priority: P1
slug: refuse-incomplete-chsh-setting-coverage-before-calibrated-cl
title: "Refuse incomplete CHSH setting coverage before calibrated classification"
created: 2026-09-06T21:06:35.744Z
completed: 2026-09-06T21:36:49.217Z
depends_on: []
composes_with: []
---

# Refuse incomplete CHSH setting coverage before calibrated classification

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1W8PRK0087G0R000T7C4X8-*.md` glob. -->

## Confirmed witness and scope

[Independent source review and native witnesses](../../../../docs/research/chsh-coverage/2026-09-06-audit.md)
show that an absent subtractive CHSH bucket produces score 3 from constant
local responses. Both calibrated component paths and the direct metrology
consumer classify it above bound. A single observation in the rare bucket also
passes with total-count/HAC calibration.

## Acceptance

- Preserve the original native witness and fresh-build source evidence.
- Keep raw descriptive CHSH scores; require coverage and valid probe values
  before calibrated inference in both APIs and the direct meter.
- Prevent abundant buckets from hiding a rare bucket behind total sample size.
- Retain balanced controls and test refinement relative to the old margin.
- State that coverage refusal is not a full statistical calibration theorem.

The component-count terminology follow-up is separately owned. This repair
must not claim that surviving components prove physical source distinctness.

## Completion

Implementation `a46143f6b` passes the full local repair gate (7,475 tests,
six existing skips; zero-warning Release build) and focused public-contract
checks. [Repair and API review](../../../../docs/research/chsh-coverage/2026-09-06-repair-review.md)
records the independent review, source and JSON migration, and scope limits.
The final integration and hosted merge checks are retained with the PR.
