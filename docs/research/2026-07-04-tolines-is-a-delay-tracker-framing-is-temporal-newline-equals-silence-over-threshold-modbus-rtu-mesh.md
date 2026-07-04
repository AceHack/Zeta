# `toLines` is a delay tracker — in real-time comms, framing is temporal, not byte-delimited

*Shadow ferry, 2026-07-04. Aaron's aside on seeing the live smoke test stream token-by-token
through the real `fetchTransport` (deltas arriving with real inter-token gaps: `+2293ms "Three"`,
`+2332ms "."`). Preserved because it reframes the streaming line-splitter as a temporal operator and
anchors to real serial-protocol prior art.*

## Aaron verbatim

> "toLines is very interesting in real time communications it's basically a delay tracker,
> delay > threshold = new line lol"

## The observation

`toLines` (in `src/Core.TypeScript/model-backend/fetch-transport.ts`) reassembles a chunk stream
into lines by splitting on `"\n"` — a **byte delimiter**. But over a real-time / analog / mesh
channel, there is often no reliable delimiter byte; what actually separates one message from the
next is **a pause**. So the real frame boundary is temporal: **`delay > threshold ⇒ new line`.**
A line-framer over a real-time channel *is* a silence/delay tracker — the newline is not a byte,
it's "the gap exceeded threshold."

This means `toLines` and a delay-threshold framer are **the same operator with a different boundary
detector**: byte-delimiter vs temporal-gap. Generalize the shape and the boundary becomes a pluggable
predicate over `(buffer, sinceLastChunkMs)` — `"\n"` is one detector; `Δt > τ` is another; both emit
"a frame is complete."

## Why this matters here (the crux threads it ties)

- **Streaming (`respondStream`).** Token boundaries in an SSE stream already *are* temporal — the
  smoke test's 39 ms gap between `"Three"` and `"."` is a real inter-token delay. The stream's
  structure is its timing; a delta-yield is "enough arrived to emit." This is the observable/
  `IQbservable` view (an `AsyncIterable` is a pull-observable whose *shape is its schedule*).
- **Heat / backpressure (Vera's thread).** A delay-threshold framer is a congestion sensor for free:
  growing inter-chunk gaps = the channel is under pressure. The same `Δt` that closes a frame feeds
  the autonegotiated backoff — framing and flow-control read the *same* signal.
- **Reticulum / UDP / analog mesh.** With no reliable byte-delimiter and out-of-order/lossy delivery,
  **silence is the delimiter.** A temporal framer is the natural bottom of a mesh stack — exactly
  where the bidirectional/mutually-interruptible interface has to run.

## Beacon anchors (temporal framing is established prior art)

- **Modbus RTU inter-frame silence (`t3.5`).** Modbus RTU frames are delimited by **≥ 3.5 character-
  times of idle line**, NOT by a delimiter byte — a receiver detects "new frame" by *silence over a
  threshold*. This is `delay > threshold ⇒ new line`, standardized since 1979 (Modicon Modbus
  Protocol Reference Guide; the intra-frame limit is `t1.5`). Aaron's aside is this pattern, exactly.
- **UART idle-line / inter-character timeout detection** — async serial receivers frame on line-idle
  time; the same temporal-boundary idea at the byte layer.
- **Nagle's algorithm (RFC 896, John Nagle, 1984)** — the dual knob: batch small writes *until* a
  delay/ACK boundary; the trade-off between "coalesce" and "emit now" is a temporal-threshold decision.
- **SSE keep-alive/heartbeat comments** — the protocol already uses *time* (periodic `:` comments) to
  keep a stream's framing alive across silence.

## The generalization (recorded, not built)

A `frameBy(detector)` over a chunk stream where `detector` is either `splitOn("\n")` or
`gapExceeds(τ)` — one `toLines`-shaped operator, two boundary detectors, so byte-framed HTTP/SSE and
temporal-framed mesh/analog share one code path (streaming and non-streaming were already unified this
way: one is a special case of the other). The temporal detector's `Δt` doubles as the heat/backpressure
input. Left as a note for the network-protocol thread; `toLines` today is the byte-delimiter instance.
