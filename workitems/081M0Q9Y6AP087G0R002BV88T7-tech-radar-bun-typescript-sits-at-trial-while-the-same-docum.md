---
id: 081M0Q9Y6AP087G0R002BV88T7
type: task
state: backlog
priority: P2
slug: tech-radar-bun-typescript-sits-at-trial-while-the-same-docum
title: "Tech radar: bun + TypeScript sits at Trial while the same document names TypeScript an essential center primitive"
created: 2026-08-23T12:36:13.782Z
depends_on: []
composes_with: []
---

# Tech radar: bun + TypeScript sits at Trial while the same document names TypeScript an essential center primitive

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q9Y6AP087G0R002BV88T7-*.md` glob. -->

## The contradiction, inside one document

`docs/TECH-RADAR.md` names its **center** — "the irreducible substrate that builds
everything" — as three primitives, and one of them is:

> **TypeScript** — cross-platform DST (Rule-0); the DUs, the tools, the agent loops

And the Tools/infra table carries:

> `| bun + TypeScript (post-setup scripting default) | Trial | 43 | … Graduates to Adopt once
(1) a second in-tree `.ts` script lands, (2) no watchlist triggers fire for 5 rounds,
(3) tally.ts + at least one other tool are invoked on round-close. |`

A ring of **Trial** on an **essential center primitive** cannot both be true.

## The graduation conditions are long past (measured 2026-08-23)

1. _"a second in-tree `.ts` script"_ — the tree holds **1,187 tracked `*.test.ts` files**;
   `src/Core.TypeScript/hygiene/` alone holds **266** files.
2. _"no watchlist triggers for 5 rounds"_ — the three watchlist items (bun-on-Windows,
   `erasableSyntaxOnly`, `@types/bun` lag) need re-checking, and the third is still true:
   `@types/bun 1.3.12` vs the `bun = "1.3"` runtime pin, with bun 1.4.0 now upstream.
3. _"tally.ts + one other tool invoked on round-close"_ — `tally.ts` moved to
   `src/Core.TypeScript/invariant-substrates/tally.ts` (the radar cited the old
   `tools/…` path until this was corrected), and round-close itself is now hard to evidence:
   `docs/CURRENT-ROUND.md` still reads "Current Round — 36 (open)" while `docs/BACKLOG.md`
   carries round-43 and round-45 hand-offs.

## Why the ring was NOT changed in the drift-fix PR

Promoting the radar's own center is a judgement about what the project depends on, not a
correction of a stale fact. A drift-fix PR that also re-ranked a center primitive would be
doing two different things under one justification. The contradiction is recorded on the row;
the decision is routed here.

## Done when

Either the row graduates to **Adopt** with condition (2) re-measured, or the center section is
corrected — and whichever way it goes, the two statements agree.

## Composes with

- `081M0Q9Y6…` (the currency audit's `@types/bun` / bun-1.4 delta feeds condition 2)
- `docs/research/2026-08-23-toolchain-currency-audit-and-tech-radar-ring-drift.md`
