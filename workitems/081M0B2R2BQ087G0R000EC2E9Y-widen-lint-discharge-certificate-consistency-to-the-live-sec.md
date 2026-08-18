---
id: 081M0B2R2BQ087G0R000EC2E9Y
type: task
state: backlog
priority: P2
slug: widen-lint-discharge-certificate-consistency-to-the-live-sec
title: "Widen lint-discharge-certificate-consistency to the live section-A phrasing (PROVEN / FULL PROVEN), which currently matches zero rows"
created: 2026-08-18T18:39:39.895Z
depends_on: []
composes_with: []
---

# Widen lint-discharge-certificate-consistency to the live section-A phrasing (PROVEN / FULL PROVEN), which currently matches zero rows

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0B2R2BQ087G0R000EC2E9Y-*.md` glob. -->

## The finding (Soraya, 2026-08-18)

`lint-discharge-certificate-consistency.ts` runs in `gate.yml` and its
`assertsDischarged` predicate matches the literal phrase `§A — DISCHARGED`.
That phrase now survives on exactly six lines of
`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`, and every one of them is inside a
`DEMOTED §A → §B` banner that the predicate deliberately excludes.

So the certificate half of the lint scanned **zero rows** and printed

    [discharge-consistency] OK 0 section-A DISCHARGED row(s) scanned; every cited certificate agrees.

A green over an empty set. "0 findings" and "0 measurements" are different facts
and the message conflated them — the same class of failure the Lean axiom audit
was fixed for on 2026-08-15 (`run-checked.ts`: a crash must report *no
measurement*, never *no findings*).

## What landed already

- The message now distinguishes the empty scan explicitly and names this row.
- A **section-A anchor check** was added in the same pass and does have live
  jurisdiction: every backticked artifact token in section A must resolve to a
  tracked file. It went red on `main` (`ReticulumTransport.fs`, a file that has
  never existed) and is green after that anchor was repaired. 49 anchors checked.

## What is left (this row)

Widen the row matcher to the phrasings live section-A rows actually use —
`✅ PROVEN`, `✅ FULL PROVEN`, `§A — CONFORMANCE CHECK` — so the certificate /
evidence half regains jurisdiction.

**Why it was not done in the same pass:** section A is a 43-row table whose rows
include nested sub-tables (the row-15 mutation roster, the pooling-constraint
table, the module table). A naive widening flags 23 "rows", most of which are
sub-table lines rather than claims. The widening needs the table triaged into
claim-rows vs sub-rows first; shipping it blind would have turned `gate` red on
`main` with mostly false positives, which is how a real check gets disabled.

## Acceptance

- Matcher covers live phrasing; the count printed is > 0.
- Every flagged row is a genuine claim row (no sub-table false positives).
- `gate` is green on `main` at merge, or the rows it legitimately flags are
  repaired/demoted in the same change.
