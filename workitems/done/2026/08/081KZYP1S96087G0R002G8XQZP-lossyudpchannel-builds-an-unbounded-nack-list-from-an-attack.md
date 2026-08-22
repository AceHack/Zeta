---
id: 081KZYP1S96087G0R002G8XQZP
type: bug
state: done
priority: P1
slug: lossyudpchannel-builds-an-unbounded-nack-list-from-an-attack
title: "LossyUdpChannel builds an unbounded NACK list from an attacker-controlled 32-bit seq: one 70-byte packet broadcast 236 MB (3.4 million-fold amplification)"
created: 2026-08-13T23:06:53.606Z
completed: 2026-08-13T23:35:54.151Z
depends_on: []
composes_with: []
---

# LossyUdpChannel builds an unbounded NACK list from an attacker-controlled 32-bit seq: one 70-byte packet broadcast 236 MB (3.4 million-fold amplification)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYP1S96087G0R002G8XQZP-*.md` glob. -->

Found 2026-08-13 during the research sweep over PR #10417. **Not found by the chaos harness** —
the harness models a *channel*, and this is a *malformed-peer* fault. Filed by Mateo
(security-researcher); routed to `docs/BUGS.md` as a P0-security entry.

## The defect — CHECKED, MEASURED

`LossyUdpChannel.handleIncoming` derives the NACK list from a peer-supplied 32-bit sequence
number with no bound on the gap:

```ts
if (header.seq > this.expectedSeq) {
  const missing: number[] = [];
  for (let s = this.expectedSeq; s < header.seq; s++) missing.push(s);   // unbounded
  ...
  retractableBeliefId: missing.map((s) => `received:seq=${s}:zid=${this.myZid}`).join(","),
  ...
  this.transport.broadcast(nackEnv);                                      // and BROADCAST
```

`header.seq` is `readUInt32BE`, so a peer may claim any value up to 4,294,967,295. The loop is
synchronous and single-threaded; the resulting array, the `.map(...).join(",")` string, and the
`JSON.stringify` of all of it are each linear in the claimed gap.

## Measured (bounded probe at seq = 5e6, not 2^32-1, so the probe cannot OOM the dev machine)

| | |
|---|---|
| inbound packet | **70 bytes** |
| `missingSeqs` entries produced | **5,000,000** |
| outbound broadcast | **236,666,951 bytes (236 MB)** |
| amplification | **3,380,956x** |
| elapsed (blocking, single-threaded) | **929 ms** |

The relationship is linear in the claimed `seq`, and the field permits 859x the probed value.

## Why this is worse than a local crash

The oversized NACK is **broadcast**, not sent to the offending peer. So a single spoofed packet
is (a) a memory/CPU denial of service on the receiver and (b) a **broadcast amplification vector
against the entire mesh** — precisely the "broadcast storm on WiFi mesh" the module's own gossip
debounce exists to prevent, reachable here without gossip. There is no authentication on the
data path: `envelope.zid === this.myZid` is echo suppression, not identity.

## Not a tuning problem

`expectedSeq` also latches: `this.expectedSeq = Math.max(this.expectedSeq, header.seq + 1)`, so
one packet claiming a huge seq permanently desynchronises the receiver against honest peers.

## Proposed fix (decode-side, no wire change)

1. Cap the gap: emit at most `N` missing seqs (a block or two), never the full arithmetic range.
2. Reject `blockPos >= 8` and implausible `seq` jumps at decode rather than at use.
3. Unicast the NACK to the peer that revealed the gap instead of broadcasting it.

Item 1 alone removes the amplification. Cost: a NACK no longer enumerates every missing seq —
which is fine, because the AIMD consumer only uses `nack.length`.

---

## RESOLUTION 2026-08-13 (the shadow) — amplification fixed, residual re-filed

**Reproduced first, independently, before changing anything** (Bun 1.3.14, this machine — numbers
differ slightly from the filing because the probe packet is 74 B, not 70 B; same defect, same order):

```
seq=8        in=74B  out=527B        amp=7.1x        elapsed=0.7ms
seq=64       in=74B  out=2483B       amp=33.6x       elapsed=0.1ms
seq=65       in=74B  out=2518B       amp=34.0x       elapsed=0.0ms
seq=5000000  in=74B  out=246666953B  amp=3333337.2x  elapsed=537.2ms
```

### What was chosen, and why it is not the filed proposal

The item proposed **capping** the list (option 1). That was **not** taken. A truncated NACK is a
partial signal presented as a complete one — the receiver would be asserting "these 64 are what is
missing" when it means "here are 64 of an unknown number" — and this repository has a standing
defect class for exactly that. Chosen instead: **a gap wider than the bound is not loss the receiver
can speak to, so it reports a local `DesyncEvent` and sends nothing.** Gaps within the bound behave
**exactly as before**: full enumeration, no truncation anywhere in the wire format.

### The bound is derived, not chosen

`MAX_NACK_GAP = RECV_BLOCK_WINDOW * BLOCK_TOTAL = 8 * 8 = 64` — the receiver's own retention window
(the literal `8` in the block-eviction path, now a named constant so the derivation points at
something real). Beyond it the blocks are evicted: nothing is recoverable and no state backs a claim.
`LOSS_WINDOW = 64` reaches the same number independently — a single gap wider than the AIMD window
yields `lossRate > 1`, which is not a rate.

### Filed proposals NOT done, with reasons

- **(2) reject `blockPos >= 8` at decode** — verified harmless today by measurement
  (`addToBlock(block, 200, …)` returns `null`, no growth, no OOB write). Moved to
  `081KZYQJPNG087G0R002B9E9S1`, where it belongs with the block-buffer fix.
- **(3) unicast the NACK** — the transport interface exposes `broadcast` only; unicast is an
  interface change, not a security patch. Consequence stated in the module's Honest boundary: the
  in-window reply is still a **33.6x** reflector. Bounded, not eliminated.
- **The `expectedSeq` latch** (the "Not a tuning problem" section above) is **NOT fixed** →
  `081KZYQJSW5087G0R001YD83TV`, with the two candidate one-line mitigations and why both were
  rejected. Accepted cost, stated: a burst losing >64 consecutive packets now yields no congestion
  signal at all.

### Verification (local — these files do not run in CI, see #10429)

`bun test udp-lossy-transport.test.ts udp-lossy-transport.chaos.test.ts` → **37 pass, 0 fail**
(16 chaos + 21 unit; 16 unit pre-existing + 5 new). The four behaviour-pinning chaos tests
`UCH-13/14/15/16` all still pass — none flipped. New tests are `ULT-17` (fast-check property over
u32 `seq`/`blockSeq`/`blockPos`, seeded), `ULT-18` (the filed reproduction), `ULT-19` (both sides of
the boundary + the pinned 33.6x), `ULT-20` (in-window signal undegraded), `ULT-21` (§12 idempotency).

**They are falsifiers, checked mechanically:** with the guard mutated to `if (false && …)`, `ULT-19`
fails (1 broadcast where 0 is asserted) and `ULT-21` fails (46,666,952 bytes emitted). `ULT-17` also
carries an anti-vacuity assertion that at least one generated `seq` reached the NACK path.
