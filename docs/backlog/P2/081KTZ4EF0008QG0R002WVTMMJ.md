---
id: 081KTZ4EF0008QG0R002WVTMMJ
title: DRW edge semantics — clip (COSMAC VIP correct) not wrap; a coordinated four-oracle golden change
priority: P2
status: done
tier: treaty-substrate
tags: [chip8, chip9, drw, four-oracles, golden-vectors, greenfield, treaty]
created: 2026-06-13
owner: open (needs all four toolchains verified in one pass — not an autonomous-tick change)
---

# 081KTZ4EF0008QG0R002WVTMMJ — DRW should CLIP at edges, not wrap (greenfield-correct, treaty-coordinated)

Aaron 2026-06-13: "do the right long-term thing — we are greenfield, we don't have to worry about
backward compatibility yet, just us." The right long-term DRW semantic is the original COSMAC VIP:
**wrap the sprite ORIGIN modulo the screen, then CLIP individual pixels at the right/bottom edge**
(do not wrap pixels around). Our `Chip8Cow.fs` (and the `Chip8.fs` oracle) currently wrap BOTH
origin and pixels — internally consistent and cross-checked, but quirks-test ROMs flag it, and it
is not the reference behavior.

## Why this is NOT a one-file fix (the reason it's filed, not done)

DRW is a **four-oracle treaty primitive**: F# locks `src/Core.TypeScript/chip9/golden-vectors.lines`
and C#/TS/Rust replay it byte-identically (`Chip9Treaty.Tests.fs` + each language's own
golden-vector test). Changing only F# would DESYNC the four oracles on edge-crossing draws — a
latent treaty divergence even though TODAY'S goldens (which draw near the top-left, no edge cross)
would not catch it. The treaty's whole point is byte-identical behavior; introducing a known,
golden-uncovered divergence violates it.

## The coordinated plan (do all of it in one verified pass)

1. F#: in `Chip8Cow.fs` and `Chip8.fs`, change the pixel index from
   `((ox+col) % W, (oy+row) % H)` to: wrap the ORIGIN (`ox = vx % W`, `oy = vy % H`, already done)
   then SKIP the pixel when `ox+col >= W || oy+row >= H` (clip).
2. C#/TS/Rust Chip9: make the identical change in each implementation.
3. Add an EDGE-CROSSING golden ROM (a sprite drawn at x=60 so it crosses the right edge) to
   `golden-vectors.lines` — this is the vector that LOCKS clip vs wrap; regenerate from F#.
4. Cross-verify: `Chip9Treaty.Tests.fs` (F#) + `dotnet test Tests.CSharp` + `cargo test` (Rust
   Chip9) + `bun test` (TS chip9) all green against the new goldens.
5. Note in the treaty doc that this is the COSMAC VIP reference behavior (Beacon anchor).

## Why now-ish

Greenfield window: there are no external consumers, so the golden break is free — but it must be a
single atomic change across all four oracles + goldens, verified, or it desyncs the treaty. Best
done when all four toolchains can be run and cross-checked together (a human-attended or
full-CI pass), not piecemeal.
