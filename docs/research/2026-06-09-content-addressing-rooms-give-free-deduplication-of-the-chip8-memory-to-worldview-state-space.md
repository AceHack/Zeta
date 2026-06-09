# Content-addressing → rooms gives free deduplication of the chip8 memory→worldview state space

**Register:** [grounded] corollary (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
A direct consequence of "every fingerprintable item is a room, addressed by its fingerprint."

## Aaron's words

> "and we get deduplication of our chip8 memory→worldview state space too."

## The corollary

Because rooms are **content-addressed** (the fingerprint *is* the address; identical content = same
room = stored once — content-addressing gives dedup + idempotency by construction), the **chip8
memory→worldview state space deduplicates for free.** Every distinct chip8 state — the
emulator memory projected into a worldview (the structure-discovery / Cheat-Engine-style state space,
the `MemoryLens`/`MemorySense` projection, `Chip8Observer.fs`) — is a **fingerprintable item**, so:

- **identical memory→worldview states share one fingerprint** → one content-addressed entry, **not**
  re-stored per visit;
- **the state space collapses to its distinct states** — a huge emulator state space with massive
  revisitation (loops, cycles, re-entered positions) is stored as the **set of unique states + the
  transitions**, not every trajectory step;
- this is exactly the **delta-pattern / content-address-the-change** discipline (#7121) made automatic:
  the worldview is keyed by content, so the dedup is a property of the addressing, not a separate cache.

## Why it matters

- **The chip8 state space becomes tractable** — the "play anything / exhaustive proof while tractable"
  goal needs the space finite; content-address dedup is *how* it stays finite (revisited states cost
  nothing; only novelty grows the store). The strange-attractor framing fits: an attractor revisits a
  bounded set of states — content-addressing stores that bounded set once.
- **Free across the whole substrate** — the same mechanism that dedups dependency-rooms, treaty-rooms,
  and identities dedups the chip8 worldview. One addressing scheme (fingerprint = canonical root =
  ZetaId, 128-bit), one dedup, everywhere — chip8 is just one content-addressed state space among many.
- **DST-clean** — content-addressed states are idempotent + replayable: re-deriving a state yields the
  same fingerprint, so replay hits the existing entry (apply-N == apply-once). Dedup + DST compose.

## Honest scope / handoff

A corollary, no new mechanism — it's content-addressing (already the substrate's addressing) applied to
the chip8 worldview state space. To realize: ensure the chip8 memory→worldview projection is keyed by
its canonical-root fingerprint (so revisits dedup), reusing the delta-pattern content-address path.
Routes to the chip8/DarkHall + observe core (`Chip8Observer.fs`, `MemoryLens`/`MemorySense`), Soraya
(dedup = idempotency proof-room, ties C8), the content-addressing substrate.

## Anchors / ties

Content-based addressing (Merkle / Git objects / IPFS; canonical root = fingerprint = ZetaId 128-bit) →
free dedup + idempotency; the delta-pattern / content-address-the-change (#7121); chip8 / DarkHall
emulator, `Chip8Observer.fs`, `MemoryLens`/`MemorySense` structure-discovery state space; strange
attractors (bounded revisited set); "every fingerprintable item is a room" (the parent principle);
idempotency discipline (apply-N == apply-once; Soraya C8); DST replay.
