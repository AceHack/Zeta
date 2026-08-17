---
id: 081M08S4DQC087G0R002SH0C88
type: task
state: backlog
priority: P2
slug: tick-boundary-trace-completeness-onreceipt-is-an-undeclared
title: "Tick-boundary trace completeness: onReceipt is an undeclared egress and no shipping room instantiates the four corners"
created: 2026-08-17T21:13:10.124Z
depends_on: []
composes_with: []
---

# Tick-boundary trace completeness: onReceipt is an undeclared egress and no shipping room instantiates the four corners

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M08S4DQC087G0R002SH0C88-*.md` glob. -->

Filed by the four-corner trace-completeness measurement (register row **R-1a**). The measurement
itself shipped with this row; what remains is the *closing*, which is deliberately separated because
a falsifier beats a fix and the fix here has a design question in it.

## What was measured

`src/Core/TickBoundaryProbe.fs` + `tests/Tests.FSharp/TickBoundaryProbe.Tests.fs`. Two findings.

**1. `ReceiptScheduler.wrapHandler` / `wrapHandlerK` take `onReceipt: (Receipt -> unit) option`** — a
`unit`-returning callback fired inside the tick loop. By its own type it cannot return its effect
through any declared channel (`'S`, the `Source`, the seed, `IntrCtx`, `Result`). The module docstring
calls this "The four-corner closure: … Feedback (backward): the `ComputeReceipt`", but the receipt does
not travel on a corner. **CONFIRMED** by TICK-3: two runs with every declared channel byte-identical
produce different outcomes; silencing the callback (`| Some cb -> cb receipt` → `| Some _ -> ()`)
collapses the divergence.

**2. No `src/` room instantiates `'S` as a `FourCornerOwnership`.** The shape is real code in four
languages with a byte-locked treaty and laws tests — and the only tick-boundary instantiation in the
tree is `tests/Tests.FSharp/FourCornerFusion.Tests.fs`. Available, not adopted.

## What closing this looks like (the design question, not yet decided)

`onReceipt` is not obviously a *defect* — telemetry export is a legitimate need and a receipt is
exactly the thing `ReceiptScheduler` exists to emit. Three candidate shapes, and the choice is a
metering decision:

1. **Delete the callback**; the receipt already lands in `Receipted<'S>.LastReceipt`, so a caller can
   read it from the returned state. Smallest, and loses streaming telemetry.
2. **Type the egress** — `Receipt -> 'W` accumulating into a declared writer corner rather than
   `-> unit`. This is the `T Out Feedback` corner the module's own docstring claims to already have,
   and would make the four-corner shape load-bearing instead of demonstrated-in-a-test.
3. **Leave it and meter it** — keep the callback, and make `TickBoundaryProbe` a standing check over
   the room roster so a *new* undeclared channel is caught at the boundary rather than found later.

Option 2 is the one that would let R-1a's premise be asserted rather than qualified. It is not taken
here because changing a shipped signature is a bigger move than the measurement warranted, and
because a `-> unit` sink that nothing reads back is invisible to the probe either way (blind spot #1),
so option 3 alone does not close it.

## Also open (separate, smaller)

`CelegansController.Controller.BeliefEstimator` is not a function of its declared arguments — the
`let mutable osc` at `src/Core/CelegansController.fs:243` crosses tick boundaries outside `'S`. TICK-5
exhibits it directly. Harm is still unproven because `CelegansChip8Room.wormRoom` never completes a
tick, and `Celegans*` has no other tests. Closing it means threading the oscillator through `'S` — but
the room does not run, so the honest order is: make the room run first, then thread the state.

## Update 2026-08-17 — the design question is answered; the metering decision is NOT

Work item `081M08WE9R3087G0R003PAK63F` shipped the `T Feedback In` corner at the tick boundary
(`SoftScheduler.CoOwnedCorner` / `HandlerF` / `driveF`, additive; `ReceiptScheduler.wrapHandlerF` as
the one adopted site). Design + research:
`docs/research/2026-08-17-t-feedback-in-the-co-owned-fourth-corner-at-the-tick-boundary.md`.

What that changes about **this** row: the note above says option 2 was not taken "because changing a
shipped signature is a bigger move than the measurement warranted." That reason is now gone —
`wrapHandlerF` is a new function beside the two `-> unit` ones, both of which are untouched and still
work. So option 2 is available and measured (FIN-1: the TICK-3 room rebuilt on the corner reports
`DeclaredOnly` while the reader still reads the receipts).

**The choice among 1 / 2 / 3 is still open and still Aaron's** — specifically whether the `-> unit`
overloads get *retired*. Nothing here retires them.

`CelegansController` is unchanged, for the reason this row already gives: the room does not tick, so
threading the oscillator would be an unfalsifiable change. Note also that the corner is the wrong home
for it — an oscillator is room-private state and belongs in `'S`.
