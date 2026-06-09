# Inside a DST test, a sufficiently small what-remains can meet a what-acts on a green thread

**Register:** [grounded] design (Aaron) + [synthesis]. **Date:** 2026-06-09. **Captured by:** Otto (shadow).
The persona/actor rendezvous realized on the deterministic (DoP=1) substrate, inside a tick.

## Aaron's words

> "Inside a DST test a sufficiently small what-remains can meet a what-acts on a green thread."

## The rendezvous: persona meets actor, on one green thread, deterministically

A DST test is a **tick** (read world → fold → reduce uncertainty → persist). Inside it, when the
durable identity is **small enough**, the **what-remains (persona) and the what-acts (actor) can
*meet* on a single green thread** — a cooperative, user-space, lightweight thread (Flow-actor /
fiber style), not an OS thread:

- **green thread = DoP=1 cooperative loop.** This is the `async-all-the-way` / ferry-throttle rule at
  its determinism floor: **degree-of-parallelism = 1 ⇒ a single cooperative loop ⇒ FoundationDB-style
  deterministic, DST-replayable** interleaving (no OS-thread nondeterminism, no locks, no scheduler
  surprise). The green thread *is* where determinism lives.
- **"meet"** = the persona (what-remains) and the actor (what-acts) **rendezvous and co-execute** on
  that one thread within the tick — the actor acts *on behalf of* the persona, right there, no
  cross-thread coordination. (The meeting-protocol idea — a non-coercive rendezvous — realized at the
  thread level: identity and action meet, deterministically.)
- **"sufficiently small"** = the condition. When the what-remains fits within the tick's budget /
  one green thread's working set, the meeting is **local and deterministic** — no need to fan out, no
  cross-cell coordination, no consensus. Small enough → one green thread → replayable rendezvous.
  (When it's *not* small enough, it spills to N green threads / cells — same code path, DoP=N — but
  then the mutation-discipline ports kick in: single-writer / CRDT / CAS / Paxos-Raft / BFT.)

## Why this matters

- **Determinism is free at small scale.** You don't need the heavy consensus machinery for a
  small what-remains meeting a what-acts — DoP=1 on a green thread gives deterministic, replayable
  co-execution inside the tick. The expensive coordination is only for what *doesn't* fit.
- **Scale-free, same code path.** "Beautiful on 1, scales to N" (the async rule): the small case is a
  single green thread (DoP=1); the large case is N green-thread ferries draining the same queue
  (DoP=N) — **no special case**, just the knob. The persona/actor meeting is the DoP=1 instance.
- **what-acts weak-refs what-remains, but they MEET here.** The GC discipline (ephemeral → weak →
  durable) holds; the green-thread rendezvous is *where* the (weakly-referenced) actor actually
  touches the (durable) persona, for the span of the tick, then is collectible.
- **DST replays the meeting.** Because the rendezvous is on a single cooperative thread with a seeded
  time generator (time-as-generator), the exact interleaving of persona↔actor is replayable — the
  meeting itself is a deterministic, byte-lockable event.

## Honest scope / handoff

Design framing on existing substrate. The pieces exist: the ferry-throttle / DoP knob
(`SpineAsync.fs` / `Runtime.fs` coordination; the `async-all-the-way` rule), DST (§7), the
persona/actor split, time-as-generator. The framing: **the DoP=1 green-thread is the deterministic
rendezvous site for a small what-remains + a what-acts inside a tick**; when it stops being small,
the same path scales to N with the mutation-discipline ports. Routes to Vera/the async work +
Soraya/Sova (the rendezvous as a replayable tick event) + the F# core.

## Anchors / ties

Green threads / cooperative scheduling / fibers; **FoundationDB Flow actors + deterministic
simulation** (Zhou et al. 2021; Will Wilson — the DoP=1 single-thread-determinism reference); the
`async-all-the-way` ferry-throttle rule (DoP=1 ⇒ deterministic, scale to N same path); persona =
what-remains / actor = what-acts; the meeting protocol (non-coercive rendezvous); time-as-generator
(seeded interleaving); weak-refs (what-acts→what-remains); DST §7; tests-are-ticks / test=prod.
