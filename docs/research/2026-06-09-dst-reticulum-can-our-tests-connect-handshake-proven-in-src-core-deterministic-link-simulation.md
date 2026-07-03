# DST + Reticulum: "can our tests connect?" — the handshake, proven in src/Core (deterministic in-process link simulation; finalizer in the loop)

**Register:** [grounded] build (Aaron's milestone). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
The follow-on to wiring the finalizer into src/Core — the DST+Reticulum connect test Aaron asked for.

## Aaron's words

> "now build the DST + Reticulum test, can our tests connect."

## Done: our tests connect, deterministically (10/10 pass)

The milestone from the finalizer-into-src/Core doc ("once you have that built … a DST + Reticulum test
of whether our tests can connect") is built and proven:

- `src/Core/ReticulumLink.fs` (`Zeta.Core.ReticulumLink`) — a **deterministic, in-process simulation of
  the network/ Reticulum overlay**:
  - `Destination` — a **ZetaId-shaped 128-bit self-certifying address** (stands in for the governed
    `Zeta.Core.FSharp.ZetaId` destination; Reticulum binds address↔key).
  - `announce` (discovery; **idempotent** — apply-N == apply-once) → `connect` (**Result**, Ok only if
    BOTH ends announced, else `LinkError.Unreachable`; no throw — result-over-exception) → `send`
    (stamps the `Scheduler.Now` and steps the DST clock) → `deliver` (ordered drain by destination).
  - Immutable, scheduler-driven, **DoP=1 deterministic** (no threads, no I/O).
- `src/Core/ReticulumConnect.test.fsx` — the **"can our tests connect?" handshake proof, 10/10 pass**:
  1. two announced test nodes **CONNECT**;
  2. **bidirectional exchange** — A→B `tick` delivered to B, B→A `ack` delivered to A;
  3. connect to an un-announced node → **`Error` (a Result, not a throw)** — the discovery precondition;
  4. **idempotent** announce (announce A twice == once);
  5. **DST replay** — same seed → identical `Versionstamp` trace **and** identical deliveries;
  6. different seed → different (seeded) trace, same logical connect+deliver;
  7. the **finalizer closes the loop** — a connected exchange is a bounded, merged, ΔU>0 tick, so
     `Finalizer.decide` says **ReKick** (advance). "The finalizer is part of the test" (rooms/README).
- `dotnet build Zeta.sln -c Release` → **0 Warning(s), 0 Error(s)** (the full gate; src/ change).

So: **yes — our tests connect**, the connect is DST-replayable from a seed, and the finalizer drives the
post-connect advance. This is the handshake the rooms layer needs: a room is a bounded DST tick, and two
rooms can now find each other (announce/discovery), connect (ZetaId-addressed), and exchange a tick
deterministically.

## Honest scope (the peel)

This is the **deterministic-simulation half** of "DST + Reticulum" — the link is simulated **in-process**
(one seeded loop, no threads, no real wire, no RNS daemon). That is exactly what DST is *for*: simulate
the network so the connect replays bit-identically from a seed. What is **not** yet built (the follow-up):

- the real **RNS daemon over the wire** (TCP/I2P/LoRa interfaces per network/README) — the link here is
  a deterministic stand-in for that transport;
- the governed **`Zeta.Core.FSharp.ZetaId`** minter for `Destination` (currently a ZetaId-shaped record,
  anchored in the doc-comment; the real address comes from the governed generator, never invented);
- **dns/** resolution (ZetaId → destination) feeding `announce`;
- delivery hazards a real overlay has (loss, reorder, partition) modelled as DST fault-injection.

Naming the line keeps it honest: the *logic* of connect/discovery/exchange is proven and replayable; the
*physical transport* is simulated, to be wired next.

## Routing / handoff

Routes to **Max** (rooms/ — two rooms connecting over this link is his layer; the 6×6 treaty room as the
first real two-node connect), the **network/Core team** (the real RNS daemon + interfaces behind the same
`ReticulumLink` shape; dns/ resolution into `announce`), **Soraya/Sova** (the connect+replay as a DST
property; fault-injection — loss/reorder/partition — as the next test rungs), **Aaron** (wiring the
governed ZetaId minter into `Destination`; OBJ4-1 human-root on the merge-to-main advance the finalizer
ReKick triggers).

## Anchors / ties (Beacon)

`src/Core/ReticulumLink.fs` + `ReticulumConnect.test.fsx` (the connect proof); `src/Core/Clock.fs`
(`Scheduler`/`Versionstamp` — the injected DST clock); `src/Core/Finalizer.fs` (the loop-close);
**Reticulum** (self-certifying key-bound destinations; announce/discovery; network/README overlay);
**ZetaId** = the 128-bit destination address; **FoundationDB** DST (Zhou et al., SIGMOD 2021; Will
Wilson, Strange Loop 2014 — one seeded loop, replayable); rooms/README (a room = a bounded DST tick =
a test = a treaty space; the finalizer is part of the test); the prior capture
`2026-06-09-finalizer-wired-into-src-core-…` (the milestone this delivers).
