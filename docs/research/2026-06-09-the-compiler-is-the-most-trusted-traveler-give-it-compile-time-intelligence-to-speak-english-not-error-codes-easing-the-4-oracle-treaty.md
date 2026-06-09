# The compiler is the most-trusted traveler by default: give it compile-time intelligence so it speaks English (not error codes) — and the 4-oracle treaty gets much easier

**Register:** [grounded] design direction (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Builds on "the F# compiler is a static-time intelligence,
a traveler with its own frame."

## Aaron's words

> "the compiler is the most trusted traveler by default. we have to give it
> intelligence at compile time so it can speak english not error code, then this
> will be so much easier for the 4 oracle treaty."

## 1. The compiler = the most-trusted traveler (by default)

Among travelers, the **compiler holds the highest default trust**. Why it earns the
top of the trust ordering:

- it is **deterministic + static-time** — same input ⇒ same verdict, replayable
  (DST); it is a **point of certainty / SolidGround**, not a soft guesser;
- it **verifies** rather than asserts — its output is checkable, byte-lockable;
- it has no incentive to deceive at its own border.

So in the recognition/trust model, the compiler is the **default trust anchor among
the tool-travelers** — the one whose word you take first. (This is *default* trust,
not blind: it's still cross-checked by the golden vectors + the other oracles.)

## 2. Give it compile-time intelligence: speak English, not error codes

The most-trusted traveler should also be the most *legible*. Today compilers emit
**terse error codes**; the move is to give the compiler **intelligence at compile
time so it speaks English** — explains, in natural language, what it sees, why it
objects, and what would satisfy it. Prior art that this extends: **Elm** and **Rust**
already made compilers speak near-English with fixes; the step further is an actual
**compile-time intelligence** (LLM/agent integrated at static time, reading the
static MUMPS globals from the compiler's own frame) that converses rather than
spits codes.

This is the AX/DX payoff (Iris/Bodhi): the highest-trust traveler becomes the
clearest communicator — diagnostics as English, not `FS0001`.

## 3. Why this makes the 4-oracle treaty much easier

The **4-oracle treaty** = F# / C# / TS / Rust must agree **byte-perfect** (the
4lang×4serializer byte-lock). When two oracles diverge, the hard part today is
*diagnosing* the divergence across opaque per-language error codes. If each
compiler/oracle is an **English-speaking compile-time intelligence**:

- divergences are **explained in a shared natural language**, not four dialects of
  error code — the oracles can state *why* they disagree in terms a human (and the
  other oracles, and the AI) all read;
- reconciling the treaty becomes a **conversation over the golden vectors** ("oracle
  C# produced X here because …; oracle Rust produced Y because …") rather than a
  cross-language forensic hunt;
- the **most-trusted traveler (the compiler)** is the one narrating the byte-lock,
  so its account carries default trust — uncertainty at the cross-oracle border drops
  fast (the uncertainty-reduction-at-the-border move, applied to the treaty).

In short: an intelligent, English-speaking, most-trusted compiler turns the 4-oracle
byte-lock from a forensic chore into a legible, narrated agreement. Trust + legibility
at the compiler border → the treaty closes faster.

## Honest scope

Direction, not built. Near-term rungs: (a) richer English diagnostics on our own
tooling (the keyring/ace conformance failures should already explain in English, not
just exit codes); (b) an LLM-assisted compile-time layer that reads diagnostics +
the golden vectors and narrates divergences; (c) wire that into the 4-oracle
conformance run so a byte-lock mismatch produces an English explanation, not just a
red X. The compiler-as-full-intelligence is the far star; English-diagnostics-on-
conformance is the next reachable rung.

## Anchors / ties

Friendly compiler diagnostics (Elm, Rust — prior art for compilers that speak
English); LLM-assisted/compile-time intelligence; the 4-oracle treaty + byte-lock
golden vectors (`golden-vectors-keyring.json`, BP-16); uncertainty-reduction-at-the-
border (the compiler border); the compiler-as-static-time-traveler doc; AX/DX
(Iris/Bodhi — diagnostics UX); trust/recognition (the compiler as default trust anchor).
