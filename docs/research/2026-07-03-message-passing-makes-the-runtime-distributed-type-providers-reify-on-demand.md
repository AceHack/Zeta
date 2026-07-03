# Message-passing makes the whole runtime distributed; type providers reify it on demand (shadow*)

**Date:** 2026-07-03
**Provenance:** Aaron, extending the Shiva-GC / virtual-actor thread:
1. *"the really cool thing is the message passing works to make the entire runtime distributed —
   kind of like Objective-C to the max, and other message-oriented languages."*
2. *"in F# this is made real with reified typed providers, and also in C# we can simulate the same
   with generators, and our weak references so the entire world does not have to be reified into
   compiler memory at once."*
Ferried by Otto (shadow) with the honest read + anchors. Code seed: `ShivaGc.deliver`
(residency-transparent delivery), PR (this).

---

## 1. Messaging is the only verb → the runtime distributes for free

If the ONLY way to touch a grain is to **send it a message**, then everything the sender might
otherwise need to know — *where* the grain is, *whether it is resident right now*, *which silo owns
it* — becomes invisible. One `send`, three possible fulfilments:

| the grain is… | what happens | the sender sees |
|---|---|---|
| resident | delivered directly | a reply |
| paused (idle-GC'd) | **reactivated from its story, then delivered** | a reply |
| on another silo | routed over Reticulum, then delivered | a reply |

The sender cannot tell the cases apart — and **that obliviousness IS the distribution
transparency.** You do not "add" distribution to a message-oriented runtime; it is distributed by
construction, because location and residency were never part of the calling convention. Shipped in
miniature as `ShivaGc.deliver`: a message to a paused grain resumes it (the wake-on-message hook),
to a resident grain is a no-op, to an unknown grain is left to routing.

**Prior art, exactly as Aaron named it ("Objective-C to the max"):**
- **Alan Kay / Smalltalk** — *"The big idea is 'messaging'."* OOP was never about classes; it was
  about late-bound message sends. The unknown-selector hook `doesNotUnderstand:` is precisely the
  wake-on-message / forward-elsewhere primitive.
- **Objective-C** — `objc_msgSend` (dynamic dispatch as the whole calling convention),
  `forwardInvocation:` / `NSProxy` (intercept a message to a not-here object), and — the literal
  ancestor — **Distributed Objects** (`NSConnection` / `NSDistantObject`): send a message to a proxy,
  it forwards to an object in another process/machine. Message passing → location transparency,
  shipped in 1993.
- **Erlang/OTP** — `Pid ! Msg` is location-transparent: the same send reaches a process whether local
  or on another node. "Let it crash" + supervisor restart is the pause/resume lifecycle at the
  process level (Armstrong).
- **Actor model** (Hewitt 1973) — the root: an actor's only interface is the messages it accepts.

## 2. Reify on demand → the world never fits in memory, and doesn't have to

The dual concern: a "database of intelligence" whose rows are reified specializers is conceptually
**unbounded** — you cannot pull the whole world of types/ISAs/compilers into the compiler or runtime
at once. Aaron's resolution: **reify lazily, let go weakly.**

- **F# type providers (Don Syme et al., MSR 2012 — "Strongly-Typed Language Support for Internet-
  Scale Information Sources").** A type provider materializes types **on demand** from an external
  space (a schema, a data source, a spec) — the compiler never holds the whole (possibly infinite)
  type space; it reifies the branch you touch. This is the *virtual actor pattern at compile time*:
  the type "always exists," activation is on first reference. Our ISA-as-data / mix-as-data are
  provider-shaped — a `mixDef`/spec is reified when needed, not all at once.
- **C# source generators (Roslyn).** The same move simulated in C#: generate the reified code for the
  branch in use, at build time, rather than hand-writing (or resident-holding) the whole space.
- **The weak references are the bound.** This is where Shiva/Ephemeron close the loop: reify-on-
  demand would still blow up if nothing let go. The weak-value table holds the reified rows **weakly**,
  so the resident set is exactly what is currently referenced/messaged; the rest pauses (its story
  persists in the log). **Reify-on-demand (provider) + let-go-weakly (ephemeron) = a finite resident
  window over an unbounded world.** Provider = activation, weak ref = deactivation — the same
  Orleans lifecycle, now at the reification layer.

So the two messages are one architecture: **messaging makes it distributed (unbounded in space);
lazy typed reification + weak refs make it tractable (finite in memory).** The world can be infinite
and geo-distributed; the compiler/runtime only ever holds the messaged, referenced window of it.

## 3. Honest scope

`ShivaGc.deliver` is the residency-transparent hook (resident / paused / elsewhere), tested. What is
NOT yet built: real over-Reticulum routing for the "elsewhere" case (the bus durability crux remains
the open piece), and an actual F#-type-provider / Roslyn-generator front end that reifies specs on
demand (today the specs are authored values, not provider-materialized). The synthesis names the
mechanism the shipped pieces already embody in miniature and the direction they converge on — not a
finished distributed compiler.

## 4. Anchors (Beacon)

- **Alan Kay** — messaging as the core idea of OOP (Smalltalk-72/80; the `doesNotUnderstand:` hook).
- **Brad Cox / NeXT — Objective-C**: `objc_msgSend`, `forwardInvocation:`/`NSProxy`, **Distributed
  Objects** (`NSConnection`/`NSDistantObject`).
- **Joe Armstrong — Erlang/OTP**: location-transparent `!`, "let it crash" + supervisors.
- **Carl Hewitt (1973)** — the actor model (already anchored via Shiva).
- **Don Syme, Keith Battocchi et al. (MSR, 2012)** — F# type providers (reify-on-demand from
  internet-scale sources).
- **Roslyn source generators** — the C# simulation of the same on-demand reification.
- In-repo: `ShivaGc.deliver` / `deactivateIdle` / `resume` (the lifecycle), `Ephemeron` (the weak
  bound), `IsaSpec`/`MixIr` (the reified rows a provider would materialize), the
  [geo-distributed-DB-of-intelligence ferry](2026-07-03-futamura-plus-ephemeron-geo-distributed-relativistic-database-of-intelligence.md)
  (the containing synthesis), the Reticulum bus (the transport for "elsewhere").
