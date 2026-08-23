---
id: 081M0QQ7984087G0R001MBVB47
type: task
state: backlog
priority: P2
slug: roster-completeness-for-the-treaty-rule-discrimination-regis
title: "Roster-completeness for the treaty-rule-discrimination register: 36 of 48 golden-vector seeds carry no declaration"
created: 2026-08-23T16:28:23.172Z
depends_on: []
composes_with: []
---

# Roster-completeness for the treaty-rule-discrimination register: 36 of 48 golden-vector seeds carry no declaration

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QQ7984087G0R001MBVB47-*.md` glob. -->

## The finding

`src/Core.TypeScript/hygiene/lint-treaty-rule-discrimination.ts` (PR #10770) is the right
mechanism and it works: it caught the SoftValue tie hole *by construction* — the row was on
file as `kind: "declared"` with the reason "the seed's own description already says the ties
are '(absent here)'". What it does **not** do is notice a seed nobody ever declared.

Measured 2026-08-23 against `origin/main @ 30c0a881c`:

| | count |
|---|---|
| golden-vector seeds under `src/` (`golden*vector*.json`, `golden-seed*.json`) | **48** |
| seeds with a `TreatyDeclaration` in `treaty-rule-alternatives.ts` | **12** |
| seeds with **no declaration at all** | **36** |

A seed with no declaration is not audited as vacuous or non-vacuous — it is simply not looked
at. That is the same shape as the defect the register exists to catch, one level up: the
register pins the treaties it lists, and the prose around it reads as though it pins the class.

## Why the SoftValue instance is the argument for this

The SoftValue row was the register's *model* `declared` entry, and `declared` was honest —
the reader really was told. It still was not enough: the F# oracle was breaking `resolve` ties
in arrival order the whole time (`List.maxBy` over an association list), and no vector could
see it. Repaired 2026-08-23 by adding tie vectors whose insertion order disagrees with ordinal
order; the register row is now `excluded` and the arrival-order rule is a named alternative
that changes 5 of 17 vectors.

The lesson that generalises: **`declared` records that a rule is unpinned; it does not make
the rule unnecessary.** An unpinned rule that N oracles are supposed to share is a divergence
waiting to be found by something other than CI.

## Proposed check

`lint-treaty-roster-complete.ts`, run in the same floor job. Derive the seed set by globbing,
derive the declared set from `TREATY_DECLARATIONS`, and require every seed to be in one of two
buckets:

1. **declared** — has a `TreatyDeclaration`.
2. **byte-agreement-only** — an explicit entry saying the seed claims *no* rule beyond
   "N implementations produce identical bytes", with a reason. Job 1 is real and is not a
   defect; what is a defect is nobody having said which job a seed does.

A new seed then fails until it is placed in a bucket — same construction as
`audit-proof-lineage-binaries.ts`, which derives its allowed set from the byte-lock runner's
own roster rather than from a hand-written allowlist that drifts.

Deliberately **not** proposed: auto-generating alternatives. "Plausible alternative rule" is a
judgement about what a competent implementer might have chosen and cannot be enumerated
mechanically — `lint-treaty-rule-discrimination.ts` says so itself and is right. What is
mechanical is refusing a seed that nobody classified.

## Honest limit of the 36

The count is of seeds without a declaration, **not** of seeds with holes. Several of the 36
are plausibly pure byte-agreement (`splitmix64`, `crc32c`, `fastcdc`, the four
`wasm-dla/bytelock/testdata/golden-seed-*.json`) and will land in bucket 2 with no vector
work at all. The number to expect from this work-item is "36 classified", not "36 repaired".

## Pointers

- `src/Core.TypeScript/hygiene/lint-treaty-rule-discrimination.ts` — the working half
- `src/Core.TypeScript/hygiene/treaty-rule-alternatives.ts` — the register this extends
- `src/Core.TypeScript/soft-value/golden-vectors.json` — the instance that motivated it
- PR #10770 — the register's origin; PR #14266 (`5c9c60e3a`) — the F# tie-break fix
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — a vector set that constrains nothing
  is the `unmetered` state wearing `metered`'s clothes
