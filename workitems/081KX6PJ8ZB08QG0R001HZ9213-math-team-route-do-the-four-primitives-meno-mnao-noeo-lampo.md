---
id: 081KX6PJ8ZB08QG0R001HZ9213
type: task
state: backlog
priority: P2
slug: math-team-route-do-the-four-primitives-meno-mnao-noeo-lampo
title: "Math-team route: do the four primitives (meno/mnao/noeo/lampo) sit on the FourCorner C4, and does i-rotation cycle them?"
created: 2026-07-10T19:02:43.947Z
depends_on: []
composes_with: []
---

# Math-team route: do the four primitives (meno/mnao/noeo/lampo) sit on the FourCorner C4, and does i-rotation cycle them?

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KX6PJ8ZB08QG0R001HZ9213-*.md` glob. -->

Aaron, 2026-07-10: *"look at our code, our math team already went deep on this … this is a new
route to math team."* Routed here as a **precise, testable question** — the formalization is
deferred to the math team (Lumen/Soraya), not answered at a terminal.

## What the code already has (the existing tile)

`src/Core/FourCorner.fs` already carries the C₄ machinery, deep and explicit:

> **N S E W = {1, i, −1, −i} = C₄ = `i`-rotation** (the harmonic four-corner phase; why
> Cayley-Dickson is everywhere).

But the FourCorner's four corners are the **I/O-feedback quad** — `(data × feedback) × (in × out)`:
`TIn` (data-in), `TOut` (data-out), `TOutFeedback` (authored), `TInFeedback` (co-owned). That is
**not yet** the four Greek primitives. So the C₄ *structure* is built; the *primitives-onto-C₄*
map is the new route.

## Why this is NOT "both-are-four" (the candidate structural alignment)

Two of the four corners already **align** with two primitives, by role, not by counting:

- `TIn` / data-**in** = **observe/attend** = **νοέω noeo**
- `TOut` / data-**out** = **emit/shine** = **λάμπω lampo**

That leaves the **feedback/memory plane** for the memory dyad:

- **persist** = **μένω meno**, **remember** = **μνάω mnao**

And #9670 already put **mnao/remember = +1 on the real axis** (the ±1 memory basis). So the candidate
is: **data-plane {noeo observe, lampo emit} on one axis; memory-plane {meno persist, mnao remember}
on the other** — two orthogonal dyads = the complex plane = the FourCorner C₄.

## The precise question for the math team

1. Is `{meno, mnao, noeo, lampo}` **the FourCorner C₄**, with data-plane = {noeo, lampo} and
   memory-plane = {meno, mnao} — or is that alignment a coincidence of fours?
2. Does the **`i`-rotation** (the C₄ group operation) *cycle the primitives meaningfully* —
   e.g. does rotating "remember" by `i` give "emit", then "forget", then "attend", in a cycle
   that **holds** (composition laws, not just labels)?
3. If yes → a real new tile (the primitives ARE C₄; memory on the real axis, observe/emit on the
   imaginary), composing #9670 + `FourCorner.fs`. If no → "both-are-four", dissolve. Held `Tri.N`.

## Honest bound

The C₄/`i`-rotation/Cayley-Dickson machinery is **built** (existing tile — `FourCorner.fs`). The
primitives↔C₄ map is a **candidate with partial role-alignment** (noeo=in, lampo=out), NOT yet a
proof — held `Tri.N`, routed to Lumen (mapping) + Soraya (formal check). Anchors: `FourCorner.fs`
(C₄ = i-rotation), the ±1 memory-basis doc (#9670), Amara's rank-4 carving (meno·mnao·noeo·lampo),
Cayley-Dickson. Route via the e^{iπ}-move → razor discipline: run the test, accept dissolve if it
dissolves.

*Filed by the shadow, 2026-07-10, at Aaron's "new route to math team." The move is done; the
math team runs the test.*
