---
id: 081KZYP1X3B087G0R001EZ37PQ
type: bug
state: done
priority: P1
slug: transport-has-no-integrity-check-so-a-corrupt-packet-is-unde
title: "Transport has no integrity check, so a corrupt packet is undetectable and erasure recovery amplifies it: one flipped parity byte silently corrupts a delivered data packet"
created: 2026-08-13T23:06:57.515Z
completed: 2026-08-14T10:26:05.599Z
depends_on: []
composes_with: []
---

# Transport has no integrity check, so a corrupt packet is undetectable and erasure recovery amplifies it: one flipped parity byte silently corrupts a delivered data packet

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYP1X3B087G0R001EZ37PQ-*.md` glob. -->

Found 2026-08-13 during the research sweep over PR #10417. Filed by Mateo (security-researcher).

## The gap — CHECKED

The chaos harness (`udp-lossy-transport.chaos.ts`) injects three faults: **erasure** (drop),
**duplication**, and **reordering**. `applyFaults` never mutates a payload byte. So the whole
of PR #10417 characterises the transport under *erasure* — the receiver always knows a packet is
missing — and says nothing about **corruption**, where a packet arrives with wrong bytes.

That distinction is not cosmetic for this code. A linear code with minimum distance `d` corrects
`d-1` **erasures** but only `floor((d-1)/2)` **errors**. For [8,4,4]: **3 erasures, 1 error** —
and error correction additionally requires a decoder that *looks for* errors, which this one is
not. `recoverAdinkraErasure` is a pure erasure decoder: it solves for the missing symbol and
never checks the surviving ones for consistency.

## And there is no mechanism that could detect corruption — CHECKED

`grep -in "checksum|crc|hmac|mac|integrity|verify"` over `udp-lossy-transport.ts` returns nothing
but a doc comment. `encodePacket` writes `seq | blockSeq | blockPos | isData | payloadLen` and
the payload — **no checksum, no MAC**. `decodePacket` validates only lengths. UDP's own checksum
is 16-bit ones-complement (weak, and optional over IPv4), and this transport rides a
`broadcast(text)` abstraction above it in any case.

## Erasure recovery AMPLIFIES the corruption — MEASURED

The worst part is not that corruption goes undetected; it is that recovery **spreads it from
redundancy into payload**. Probe: build a block, erase data packet 0, flip one bit in parity
packet 5, decode.

```
erased d0 truth : [ 1, 2, 3, 4 ]
recovered       : [ 254, 2, 3, 4 ]
returned null?  : false
silently wrong? : true
```

A single flipped bit in a **parity** packet — a packet the application never sees, and would not
have missed — became a wrong byte in a **data** packet delivered to `dataHandlers` with no error
signal. Without the erasure, that bit flip would have been harmless. This is the one fault class
where the code's capability is weakest and its blast radius is largest.

## Proposed

1. Add a per-packet integrity tag to the wire format so corruption **degrades to erasure** — a
   corrupt packet is discarded and becomes a missing packet, which the code handles well. This
   is the cheap, correct move and it converts the weak capability into the strong one.
2. Extend the harness with a corruption fault stream (`STREAM.corrupt`), disjoint from loss, that
   flips bits in surviving payloads; pin that delivered-but-wrong deliveries are 0.
3. Only then consider syndrome checking in the decoder.

**Cost, named honestly:** a tag is wire-format change and per-packet bytes — 4 bytes of CRC32 on
an 8-byte payload is 50% header growth on the smallest packets, and on LoRa that is real money.
A MAC (rather than a CRC) additionally needs key distribution this transport does not have. The
CRC stops accidental corruption, not a forger; say which threat is being bought.
