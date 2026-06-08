# A sandbox (a "box" / "sand") is a type of sim

**Aaron, 2026-06-07** (refining the sim ⊂ test taxonomy from #6990):

> "box or sand is also a type of sim"

A **sandbox** — a bounded, controlled environment with no uncontrolled external effects — is a
**kind of `sim`**, which (per #6958 / #6990) is the **omniscient, DST-mandatory form of `test`**.

## Why a sandbox IS a sim (the chain)

The defining property of a sim (#6990) is **omniscience**: the whole world is *inside* and *controlled*,
so behaviour is deterministic by construction, so DST is mandatory (the FoundationDB
whole-system-in-simulator insight). A sandbox is exactly that property realized as an *environment*:

- **Bounded** — nothing escapes; no real network, no real filesystem, no real clock (Bounded Mobility,
  manifesto §4).
- **Controlled inputs** — every effect the code-under-test can reach is supplied by the box, so the box
  *knows everything* the run can observe ⇒ omniscient.
- **Therefore deterministic / replayable** ⇒ DST-able by construction.

So: `sandbox ⊂ sim ⊂ test`. The sandbox is the *substrate* (the controlled world); "sim" is what you
*do* in it; "test" is the general seam, of which sim is the omniscient sub-mode. A test that runs
against the *real* boundary (real DB, real socket — partial knowledge, DST not guaranteed) is a test
but **not** a sandbox/sim.

## The naming texture ("box or sand")

- **"box"** = sandbox / jail / container — the isolation framing (cells push out, hosts accept in;
  the cell *is* a box). A Zeta **cell** running with no accepted push-downs and only controlled
  push-outs is a sandbox.
- **"sand"** = the malleable controlled medium you shape freely inside the box — same root as the
  "beach" register (sand you can build and un-build without consequence; the beach is where you dream
  the shape, the forge is where you prove it — [[beach]]). A sandbox is a *forge that throws away its
  world after the run*: omniscient, consequence-free, replayable.

## Where it already lives in the substrate

- **DarkHall** (#6986) — the CHIP-8-subset emulator is a sandbox: pure-functional, immutable,
  `Array.copy`-per-write, no I/O ⇒ a box with total omniscience ⇒ deterministic ⇒ a sim. The arcade
  cell *is* a sandbox.
- **ChaosEnv** / the DST harness — supplies controlled clock/scheduling/faults = the box that makes a
  test omniscient (turns a test into a sim).
- **`isolation: worktree`** (cheap per-writer git boxes) — a box at the repo-topology layer.

## Honest scope (peel)

Conceptual placement, not a new artifact: this just locates "sandbox" in the existing taxonomy
(`sandbox ⊂ sim ⊂ test`). The buildable implication is the standing one — a sim/sandbox is a `test`
run whose environment is fully supplied (no real boundary), which the DST harness already aims at; the
named next step is making "is this run omniscient (sandboxed) or boundary?" an explicit property of a
`test` node rather than a convention.

## Anchors (Beacon)

- **Sandboxing / OS isolation** — chroot/jails, seccomp, containers (OCI), capability-based security
  (the box = least-authority environment).
- **Deterministic simulation** — FoundationDB (Zhou et al., SIGMOD 2021); Will Wilson, *Testing
  Distributed Systems w/ Deterministic Simulation* (Strange Loop 2014) — the sandbox-is-the-whole-world
  insight.
- Internal: #6990 (sim ⊂ test), #6958 (sim = special form of test), #6986 (DarkHall sandbox cell),
  manifesto §4 Bounded Mobility, §7 DST; the cells-push-out/hosts-accept-in (Eve protocol) cell model.
