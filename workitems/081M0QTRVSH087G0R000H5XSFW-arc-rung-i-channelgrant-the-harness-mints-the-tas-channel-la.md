---
id: 081M0QTRVSH087G0R000H5XSFW
type: task
state: backlog
priority: P2
slug: arc-rung-i-channelgrant-the-harness-mints-the-tas-channel-la
title: "ARC rung I - ChannelGrant: the harness mints the TAS channel label, the agent cannot; an unproxied crossing refuses the run"
created: 2026-08-23T17:30:24.945Z
depends_on: []
composes_with: []
---

# ARC rung I - ChannelGrant: the harness mints the TAS channel label, the agent cannot; an unproxied crossing refuses the run

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QTRVSH087G0R000H5XSFW-*.md` glob. -->

**Register: `proposed`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §12.3-§12.5.

Aaron 2026-08-23: _"direct memory manipulation and tool-assisted runs will be allowed, just properly
labeled and metered through proxies even if in memory, so **the AI playing the game is not the one who
labels the input/output and TAS channels — the one who's running the experiment does**."_

**Why allow rather than ban:** direct memory manipulation is influence entering the run, and §7
noninterference says influence may enter only through declared, metered channels. A TAS channel is the
discipline's canonical case, not an exception to it. A ban is unenforceable (the memory is in-process);
a meter is not.

**Separation of powers is the load-bearing part.** A subject that labels its own affordances can
under-report assistance, and no downstream statistic recovers from that. Same construction as
`TravelerRankLedger` (rankings held by others, never self-asserted).

**Not in tension with `pigeonhole-by-self-claim`:** the subject supplies its **identity claim**; the
experimenter supplies the **measurement conditions**. Which channels were open is metadata about the
apparatus, not self-description — letting the subject write it is letting the measured party calibrate
the instrument.

Do: a `ChannelGrant` capability token with an `internal` constructor, minted only by the harness,
required by every TAS-capable operation (`applyCheatTable`, `injectCode`, any non-VRAM read). Copy the
shape from `src/Core/WireWeight.fs` — its `internal` ctor makes the violation impossible to express
rather than discouraged.

**Refusal, not warning:** an unproxied crossing is an unmetered crossing and must **refuse the run**. A
warning on an unmetered crossing is the vacuity class — it looks like a control and constrains nothing.
The proxy counts **reads as well as writes**; Aaron names reads first and they are the easy half to
forget.

**Honest ceiling, stated up front so it is not discovered as a disappointment:** `WireWeight` itself
admits the strictly structural version needs an `.fsi` for `Zeta.Core`, which does not exist. On top of
that, (a) TypeScript has no `internal`, so the live `src/Core.TypeScript/chip8/cheat-engine.ts` side is
convention-enforced with a runtime refusal as the substitute, and (b) an in-process agent can touch
`frame.mem` without any surface at all — the grant makes the labeled path the only **typed** path, not
the only **reachable** one. Real enforcement needs process/WASM isolation and is a different item.

**What already exists and is NOT this:** `cheat-engine.ts` sets `frame.causalMask[address] = true` on
every byte it freezes or injects. That is a per-address provenance mask — a real proto-meter and the
right place to hang this — but it has no channel, no direction, no count and no issuer.
