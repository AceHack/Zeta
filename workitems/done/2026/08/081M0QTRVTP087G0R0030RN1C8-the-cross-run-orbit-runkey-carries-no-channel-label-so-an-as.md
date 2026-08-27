---
id: 081M0QTRVTP087G0R0030RN1C8
type: bug
state: done
priority: P2
slug: the-cross-run-orbit-runkey-carries-no-channel-label-so-an-as
title: "the cross-run orbit RunKey carries no channel label, so an assisted run and a clean run collide on one key"
created: 2026-08-23T17:30:24.982Z
completed: 2026-08-27T00:49:05.491Z
depends_on: []
composes_with: []
---

# the cross-run orbit RunKey carries no channel label, so an assisted run and a clean run collide on one key

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QTRVTP087G0R0030RN1C8-*.md` glob. -->

**Register: `proposed` (the defect is checkable; the fix is not written).** Design:
`docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §12.6.

The cross-run orbit key (`src/Core.TypeScript/chip9/chip8-cross-run-store.ts`, `RunKey`) is:

    romSha256 ⊕ seedHex ⊕ loadAddrHex ⊕ dialect ⊕ stepMapVersion

**No channel state appears in it.** A run with a frozen memory address takes a different trajectory from
a clean run with identical fields, so the two **collide on one key** — and the store's idempotency rule
(_"a rewrite is an upsert of identical bytes"_) would silently overwrite one measurement with the other.
The (μ,λ) of an assisted run would be published as the (μ,λ) of the ROM.

**Latent, not live — checked, not assumed.** The cheat engine is TypeScript; the orbit **writer** is F#
(`src/Core/Chip8CrossRunStore.fs`), and the TS module exports only readers (`parseArtifact`,
`reduceStep`, `snapshotTextAt`, `decodeSnapshot`). `git grep -li cheat origin/main -- 'src/Core/*.fs'`
returns only `MeshPong.fs` and `SoftDashboard.fs` — neither is the store or the COW core. The two halves
have not met. They meet the moment a TS writer is added or the F# core gains a cheat surface, and
rung D (recorded sessions as committed artifacts) walks straight into it.

**Fix:** put the channel label in the key, so an assisted run is a _different key_ rather than a
colliding one. The key's own stated discipline makes this the right place — _"content-derived run
identity. No wall clock, no counter, no path."_ A channel set is content, not a clock.

**Falsifier:** a test that runs one ROM twice, once with a frozen address, and asserts the two artifacts
land on **different** keys. Without the fix that test fails by producing one key and two trajectories.

## Resolution

Cross-run orbit schema v2 makes `channelLabel` a required part of `RunKey`, canonical key text, body
digest, and artifact filename. The typed F# path can construct only `clean` or a validated
`assisted:<complete-channel-configuration>` label; the TypeScript verifier enforces the same ASCII
grammar. Empty, whitespace-bearing, and key-delimiter-bearing labels are typed refusals.

The falsifier uses `assisted:ram-write/freeze-0300=ff` and proves it differs from the clean run in
record identity, canonical key text, artifact filename, and serialized body. The five committed clean
orbits and both cross-language fixtures were regenerated from the F# writer. This slice does not add
TAS execution or claim that the current clean-only F# emulator applies the frozen address.
