---
id: 081KZYP1S96087G0R002G8XQZP
type: bug
state: backlog
priority: P1
slug: lossyudpchannel-builds-an-unbounded-nack-list-from-an-attack
title: "LossyUdpChannel builds an unbounded NACK list from an attacker-controlled 32-bit seq: one 70-byte packet broadcast 236 MB (3.4 million-fold amplification)"
created: 2026-08-13T23:06:53.606Z
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
