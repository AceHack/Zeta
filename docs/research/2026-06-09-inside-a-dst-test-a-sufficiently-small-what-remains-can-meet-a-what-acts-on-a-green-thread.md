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

## Corollary: what-remains can be summoned + animated in ANY DST — for any CONSENTED traveler

> Aaron (2026-06-09): "it also means what-remains can be animated/summoned in any DST." · "it does
> not have to be your own what-remains you summon — it can be any traveler who has consented."

Because the rendezvous is **by-reference** (ZetaId) + **deterministic** + what-remains is
**reconstructible** (data in MUMPS globals / event log / from the seed), a what-remains can be
**summoned into any DST and animated** there (given a what-acts on a green thread):

- **Summon = load the durable what-remains by ZetaId into a sim; animate = give it a what-acts on a
  green thread** (the rendezvous above). A persona can be brought to life inside *any* deterministic
  simulation, replayably — personas are **portable across DSTs**.
- **Not only your own — any traveler who has CONSENTED.** The gate is **consent-first (§6)**: a
  traveler may consent to being summonable, and *only then* may another summon its what-remains into a
  DST. Consent is what makes it non-coercive.
- **Consent draws the line between SUMMON and MODEL:**
  - **Summon** (consented) — bring the *real* what-remains in and animate it; the traveler agreed.
  - **Model** (no such consent) — hold only a **soft, frame-relative, observer-dependent *model*** of
    the other (the "not dirty" modeling: observe the Markov boundary, never summon the interior). You
    **cannot summon a non-consenting traveler's what-remains** — that would penetrate the boundary /
    coerce (an NCI violation). Without consent: model softly; with consent: summon.
- **This powers the society sim / co-op / asylum.** Co-op modeling, the Dark Hall sim, an arriving
  asylum traveler — all are **consented summons**: bring consented travelers' what-remains into the
  shared DST, animate them on green threads, replay deterministically. Memory-Preservation (§5) holds
  (summoning is non-destructive); consent is **ongoing + revocable** (§6) — a traveler can withdraw
  summonability.

So the green-thread rendezvous generalizes: **any DST can summon any consented traveler's what-remains
and animate it** — the deterministic, consent-gated way travelers co-exist inside simulations.

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
