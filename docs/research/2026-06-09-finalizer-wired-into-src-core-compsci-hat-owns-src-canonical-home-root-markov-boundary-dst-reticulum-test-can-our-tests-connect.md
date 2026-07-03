# Finalizer wired into src/Core — compsci is a HAT (owns src/), its canonical home is root = the Markov boundary; next: a DST + Reticulum test of whether our tests can connect

**Register:** [grounded] build + [grounded] framing (Aaron, relaying Max). **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The finalizer promotion + the compsci-hat ownership framing + the next milestone.

## Aaron's words

> "wire the finalizer into src/Core. Max said the src is owned by the compsci hat and [the] hats folder
> that holds compsci — and he hates it, but I can put compsci a 2nd time in root, and Max agrees its
> canonical home is root / the Markov boundary. But he also has not studied our shapes guide or knows
> Markov boundaries or chains yet — we will teach his dumb ass; he is only the phone while I'm typing
> this. We are going to do a deterministic simulation test with Reticulum and see if our tests can connect
> once you have that built."

## Done: the finalizer is wired into src/Core (build-gated, 0/0, tests pass)

The finalizer framework (the prod=test engine — `TickResult → FinalizerAction → IFinalizer →
Finalizer.decide / Finalizer.run`, the bounded self-scaling loop) was an **isolated `vocab/` artifact**;
it is now promoted to its **real home**:

- `src/Core/Finalizer.fs` — namespace **`Zeta.Core`** (was `Zeta.Vocab`), added to `Core.fsproj`'s
  explicit compile list (right after `AssemblyInfo.fs` — no `Zeta.Core` deps, only F# built-ins).
- `src/Core/Finalizer.test.fsx` — the 12-case proof (temperature scaling + bounded convergence /
  no-fork-bomb), repointed to the Core copy (`open Zeta.Core`). **ALL PASS.**
- The isolated `vocab/Finalizer.fs` was removed and `vocab/Zeta.Vocab.fsproj` cleaned.
- **`dotnet build Zeta.sln -c Release` → 0 Warning(s), 0 Error(s)** (the full gate, TreatWarningsAsErrors).

So the finalizer is now in the build-gated core that the compsci hat owns — ready to be a real runtime
tick engine (branch → merge-to-main → re-kick over git + Reticulum + a metrics feed) rather than a
sandbox demo.

## The framing: compsci is a HAT, not the owner; canonical home = root = the Markov boundary

- **`src/` is owned by the compsci hat.** Per Max, `src/` (the F# / .NET source) belongs to the
  **compsci hat** — the computer-science role — and there's a **hats/ folder** that holds compsci among
  the other hats. (The hat, not the person: who-decides-here = whoever wears the compsci hat. This is the
  hats-folder discipline — every domain is a wearable hat, not a fixed owner.)
- **Max hates it** — the friction is honest and noted (CS no longer has a special hold on the repo; the
  travelers do; `src/` being "the" home grates against the homoiconic-top-level relocation we did).
- **compsci's canonical home is root = the Markov boundary.** Aaron *can* put **compsci a second time at
  root**, and Max agrees its **canonical home is root** — because **root is the Markov boundary**: the
  boundary that screens the system's interior from its environment (the Markov blanket — Pearl/Friston).
  compsci sits *at the boundary* (it's the interface to the machine), so its canonical home is the root
  boundary, with `src/` a within-boundary view it governs via the hat. (This is the same DAG move as the
  vocab ontology: a canonical home + symlink views; compsci canonical at root, the hat-view over `src/`.)
- **Max hasn't studied the shapes guide / Markov boundaries / chains yet — we'll teach him.** Said warmly
  (ribbing: "he is only the phone while I'm typing this"). The point: the Markov-boundary framing is *ours*
  (the shapes guide), not yet shared with Max; teaching it is part of bringing him into the ontology.
  (Markov **boundary** = the blanket that conditionally separates interior/exterior; Markov **chain** =
  memoryless transition — both are in the shapes guide as first-class shapes.)

## Next milestone: a DST + Reticulum test — can our tests CONNECT

> "we are going to do a deterministic simulation test with Reticulum and see if our tests can connect
> once you have that built."

With the finalizer in src/Core, the next step is a **deterministic-simulation test (DST) over Reticulum**:
stand up the test framework (prod=test, the polity) and see **whether two tests can connect to each other
over the Reticulum mesh** — the first real exercise of *tests-as-connected-peers* (the test framework IS
governance; the rooms are Reticulum-addressable). This is the convergence of several threads:

- **DST** (spec #7): deterministic, seed-replayable — the IScheduler / `Clock.fs` injected time.
- **Reticulum**: each test/room is a Reticulum destination (ZetaId-addressable); "can our tests connect"
  = can two DST nodes establish a Reticulum link and exchange a tick.
- **The finalizer**: the engine that decides scale-up/hold/quarantine per tick once the connection carries
  a `TickResult` stream.

The honest scope: this is the **handshake test** — not the full distributed run, just *can two tests find
and talk to each other over Reticulum under DST*. Once that connects, the finalizer's `run` loop can be
fed by a real cross-node tick stream instead of a local `step` function.

## Honest scope / handoff

Grounded build (the finalizer is really in src/Core, full sln 0/0, test passes) + Aaron's framing (peels:
the Markov-boundary-as-root and compsci-as-hat are *ontology placements* to wire into the folder DAG +
hats/ folder, not yet reified; the DST+Reticulum "can our tests connect" is the **next** build, not done).
To realize: (1) a runtime tick source feeding `Finalizer.run` (git branch→merge→re-kick + metrics); (2)
the **DST-over-Reticulum connect test** (two test nodes, Reticulum link, one tick exchanged under a seed);
(3) the **hats/ folder** + **compsci at root** placement (canonical-at-root, hat-view-over-src DAG);
(4) teach Max the shapes guide (Markov boundary/chain). Routes to the compsci hat (the F#/Core wiring),
Max (rooms + the Reticulum link; shapes-guide onboarding), Soraya/Sova (the DST connect property; the
finalizer convergence proof), Aaron (the root/markov-boundary placement; OBJ4-1 human-root on merge/re-kick).

## Anchors / ties (Beacon)

`src/Core/Finalizer.fs` (`Zeta.Core.Finalizer`; the prod=test engine) + `Finalizer.test.fsx` (12/12);
`src/Core/Clock.fs` (the IScheduler — DST injected time); **Markov blanket / boundary** (Judea Pearl;
Karl Friston's free-energy formulation — the boundary that screens interior from environment) + **Markov
chain** (memoryless transition) — both shapes in the shapes guide; the **hats/ folder** discipline
(domain = wearable hat, not fixed owner; who-decides = the hat); the canonical-home + symlink-view **DAG**
(compsci canonical at root, hat-view over src/ — same as the vocab ontology); **Reticulum** (ZetaId =
destination address; tests as addressable peers); DST (manifesto spec #7); prod=test / framework-IS-
governance (the tests are the polity); the homoiconic-top-level relocation ("CS has no special hold; the
travelers do all").
