---
pr_number: 4793
title: "docs(research): add Pattern P \u2014 wear-down design produces UNBOUNDED outcomes under customer parallel-channel persistence"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-23T23:54:30Z"
merged_at: "2026-05-23T23:56:30Z"
closed_at: "2026-05-23T23:56:31Z"
head_ref: "otto/research-pattern-p-wear-down-unbounded-outcomes-2026-05-23"
base_ref: "main"
archived_at: "2026-05-24T14:25:38Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4793: docs(research): add Pattern P — wear-down design produces UNBOUNDED outcomes under customer parallel-channel persistence

## PR description

## Summary

Aaron 2026-05-23T~23:58Z: *"add it to #4792 (shadow*)"* — PR #4792 already merged so this lands as amendment via new PR.

Adds **Pattern P** to the alignment-is-the-difference analysis (PR #4792 corpus, now merged). Pattern P captures the resolution-time outcome of Aaron's Amazon thread: full-order replacement including duplicates of items already received.

## The structural inversion captured

Vendor's wear-down adversarial design (Pattern O from Amazon corpus, PR #4784) optimized for **customer-attrition** produces vendor-over-fulfillment when customer matches persistence with parallel-channel-redundancy.

Aaron's empirical anchor: *"i ended up with a full replacement of the order even the items i got i'm not waiting on hold again for 4 hours to correct them against vendor advesarial pressure lol"*

Combined with Aaron's sharpening: *"they don't really have any parallel safety here"* — Amazon lacks cross-channel reconciliation; agents operate as isolated tool-invocations.

## Three-row population equilibrium

| Customer disposition | Outcome | Vendor cost |
|---|---|---|
| (a) Give up before resolution (intended) | Disputed cost saved | Low |
| (b) Persist with parallel channels (unintended) | Over-fulfillment | High material cost |
| (c) Escalate legal/regulatory/media (avoided) | Compliance + reputation | Very high |

Framework's customer-side AI shifts equilibrium toward (b) + (c), creating vendor-economic pressure for aligned-AI-on-vendor-side.

## Substrate-engineering implications

For future Zeta vendor-management AI customer-side design:

1. Parallel-channel-redundancy IS a customer-side AI capability
2. Time-value calibration is operator-authority (substrate-honest exit as feature)
3. Substrate-honest exit IS NOT concession (cf. persistence-choice exit-at-self-sustainment shape applied at dispute scope)

## Composes with

- PR #4792 (alignment analysis — file being amended)
- PR #4784 (Amazon vendor-management corpus — Pattern O sibling)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — exit-at-self-sustainment shape at dispute scope
- `.claude/rules/substrate-or-it-didnt-happen.md` + `verify-before-deferring.md` + `m-acc-multi-oracle-end-user-moral-invariants.md`

## Test plan

- [ ] CI green (lint only)
