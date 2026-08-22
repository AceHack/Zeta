---
id: 081M0BXRK34087G0R003KKAHQN
type: task
state: in-progress
priority: P2
slug: classify-erasure-by-injectivity-at-the-spine-log-eviction-an
title: "Classify erasure by injectivity at the spine, log, eviction and gift-of-erasure sites"
created: 2026-08-19T02:31:48.580Z
depends_on: []
composes_with: []
---

# Classify erasure by injectivity at the spine, log, eviction and gift-of-erasure sites

Replaces the placement claim refuted in
`docs/research/2026-08-18-an-unmetered-channel-is-a-maxwells-demon-retraction-is-free-compaction-is-where-we-pay-landauer.md`
§11, per §11g: _"Meter by injectivity, not by lifecycle stage. The declaration lives beside the
operation, the measurement is an exhaustive sweep, and the two must agree in BOTH directions.
Extend that existing machinery to the spine/log/eviction sites, which currently declare nothing;
do not build a second list."_

## What landed

`src/Core/ErasureClass.fs` extends the `WSetHeat` vocabulary down the compile order so the
representation-owning types can declare against it. Eleven representations declare, three law packs
measure, and nothing new was invented that `WSetHeat` did not already establish.

## What is deliberately NOT in this change

**No entropy charge.** `src/Core.TypeScript/algebra/entropy-tracker.ts` is untouched: this work CLASSIFIES, it does not
meter. Wiring a charge is a separate decision with its own review, and doing both at once would
have made a wrong classification expensive to unwind.

## Open, and named as open

- The medium-level rows (`DiskDeltaLog`, `DiskBackingStore`, `DiskAsyncBackingStore`) are
  `Unmeasured`: no sweep from inside the process can observe what a filesystem retains after an
  unlink. Closing them needs an instrument, not a test.
- `GiftOfErasure.forget` is `Unmeasured` with respect to the process heap, which is the row that
  matters most for a module whose purpose is unrecoverability. Closing it needs a representation
  the caller cannot retain.
- The Rust / C# / Q# oracles are unclassified. §11h already marked them unknown; they still are.
