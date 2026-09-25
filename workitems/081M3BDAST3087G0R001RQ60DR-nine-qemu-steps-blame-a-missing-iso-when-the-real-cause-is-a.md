---
id: 081M3BDAST3087G0R001RQ60DR
type: task
state: backlog
priority: P2
slug: nine-qemu-steps-blame-a-missing-iso-when-the-real-cause-is-a
title: "Nine QEMU steps blame a missing ISO when the real cause is an earlier red NixOS test"
created: 2026-09-25T04:31:44.963Z
depends_on: []
composes_with: []
---

# Nine QEMU steps blame a missing ISO when the real cause is an earlier red NixOS test

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BDAST3087G0R001RQ60DR-*.md` glob. -->

## The condition

In `build-ai-cluster-iso.yml`, `Build installer ISO` has no `always()`, so one
red NixOS test skips it. Every QEMU step downstream then fails with its own
inline message:

```
::error::081KSGS9H0008QG0R003V23XNZ wifi ESP: No installer ISO under result/iso/
::error::UEFI keyfile phase-1: No installer ISO under result/iso/
::error::UEFI keyfile picker: No installer ISO under result/iso/
::error::081KSNY2Z0008QG0R0008PN7RQ scenario 3: No installer ISO under result/iso/
::error::081KSNY2Z0008QG0R0008PN7RQ scenario 4: No installer ISO under result/iso/
::error::WP11 k3s first-boot verify: No installer ISO under result/iso/
```

Every line is TRUE and every line points at the wrong thing. The cause is a
single red step three positions earlier; the reader sees nine failures naming a
missing file.

**Measured twice in one night.** Run 36091883865:
`NixOS test — a datastore that has SERVED is never auto-discarded`
(`k3s-datastore-bootstrap-sentinel`) timed out at 300 s, the ISO build was
skipped, and nine steps went red claiming the ISO was absent. Run 36073981145
produced a variant of the same misdirection.

## Why the obvious fix is wrong

Adding `always()` to `Build installer ISO` would make the build attempt run
after an unrelated failure, and the downstream lanes would then test an ISO
built from a tree whose own checks are red. **Do not test an ISO you did not
mean to build.** The skip is correct; only the message is not.

## What to change

Make the message name what it does NOT know — the same discipline as the rest
of 081M39CJP96087G0R001T4J2R3:

> `Build installer ISO` did not run because an earlier step in this job failed.
> This is NOT an ISO-production defect — read the first red step in this job.

**This is NOT a one-line change, which is why it is filed rather than done.**
There is no shared helper: the text lives in NINE separate inline `run:` blocks
(18 `::error::` sites in the file overall), each with its own scenario prefix.
Doing it properly means either a small shared step/composite action that every
lane calls to locate the ISO, or accepting a nine-site copy-paste — and the
first is the right shape, since the same nine blocks also duplicate the
`mapfile`/`readlink -f` ISO-discovery logic.

## Falsifier

Fail one pre-build NixOS test on purpose and read the downstream errors: none
of them may assert a missing ISO as the cause, and at least one must point the
reader at the first red step.
