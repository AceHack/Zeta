---
id: 081M23FA0DE087G0R00303PZ9A
type: bug
state: backlog
priority: P2
slug: the-constrainttemplate-compile-check-asserts-an-instantaneou
title: "the ConstraintTemplate compile check asserts an instantaneous condition on an eventually-consistent cluster"
created: 2026-09-09T16:16:38.830Z
depends_on: []
composes_with: []
---

# the ConstraintTemplate compile check asserts an instantaneous condition on an eventually-consistent cluster

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23FA0DE087G0R00303PZ9A-*.md` glob. -->


## What happened

The step added in 081M23B24P5087G0R002BJWEN1 asks Gatekeeper whether every
ConstraintTemplate compiled. It asserted that INSTANTANEOUSLY, immediately after
the proof's verdict, on a cluster that is eventually consistent.

Run `34373356539`: the verdict came at T+512 s while `hat-system` still had
`ServiceAccount/gatekeeper-crd-wait` OutOfSync and Gatekeeper's own
`constrainttemplates.templates.gatekeeper.sh` CRD had only just been created.
Zero ConstraintTemplates existed, and the step -- correctly, by its own rule --
refused.

Run `34370409538`, on the merge commit that introduced it, printed
`all 7 ConstraintTemplates compiled and created`. Same code, same tree, opposite
verdict: a **race**.

## Why the proof can finish first

`isApplicationSynced` admits `OutOfSync + Healthy`, which cannot tell an app whose
resources are **not applied yet** from one whose sync **failed** -- the same
blindness 081M23BCR90087G0R002GYP7TE closed for the failed case. The in-progress
case is still open, and it is what lets `hat-system` pass with zero policies
applied.

## Fixed, without weakening the check

The step now waits, bounded:

- up to **300 s** for any ConstraintTemplate to appear;
- then up to **180 s** for every template to reach `status.created: true`.

A bound that EXPIRES is still a failure, never a skip -- "gatekeeper compiled
nothing" is the finding this step exists for, and waiting must not become a way
of never saying it.

A non-empty `status.byPod[].errors` is decided IMMEDIATELY rather than waited on:
a template that failed to compile keeps its errors, so waiting could only delay a
verdict that is already final.

## Still open

The underlying reason the proof can declare victory while `hat-system` is
mid-sync: the `OutOfSync + Healthy` allowance. Narrowing it further is a change to
what the lane asserts and belongs with a maintainer, not inside a race fix.
