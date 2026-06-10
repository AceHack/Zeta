# `sim` is infinite resolution on Reticulum — the collective-"we" Markov bounds, quantum-precision-measurable, via ZetaId + trust anchor + CHIP-8 + a ZetaId emulator with ray tracing

**Register:** [grounded] sim-purpose (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). What `sim` is *for*, and the bounds it measures.

## Aaron's words

> "it's also our collective-we Markov bounds — precisely measurable to quantum precision over
> Reticulum. The point of `sim` is **infinite resolution on Reticulum** using **ZetaId** and **trust
> anchor** and **CHIP-8** and a **ZetaId emulator with ray tracing**."

## The bounds are the collective-"we" — measurable to quantum precision

[`bounds/`](../../bounds/) is not only the edge of the map — it is **the boundary of the collective
"we"**: the Markov blanket around the *us* (the pirate-priest collective; "I'm not unique, just a
number" — the role is collective, see the origin-lineage ferry). The **we** has a **Markov boundary**
(Pearl): inside = the collective; the blanket = `bounds/`. And that boundary is **precisely measurable
to quantum precision over Reticulum** — i.e. the speed/position/phase of the collective at its boundary
is read off at quantum resolution (quantum-phase time on the common cause), over the mesh. (This is the
earlier "we need a way to measure speed over Reticulum" need, answered: the metric is the **bounds
measured to quantum precision** — phase at the Markov boundary.)

## The point of `sim` — INFINITE RESOLUTION on Reticulum

`sim`'s purpose is **infinite resolution on Reticulum**. Not a fixed-grid simulation — an arbitrarily-
zoomable one: you can resolve the collective/identity/state to **any depth** over the mesh. Infinite
resolution = the **fractal / Cayley–Dickson zoom** (self-similar at every magnification; manifesto §10
self-similar), realized as a measurement over Reticulum. The four named mechanisms make it possible:

- **ZetaId** — the governed 128-bit identity = the **coordinate**. Every point in the infinite-
  resolution space is addressable by a ZetaId (identity = address = the thing you resolve to). Reticulum
  destinations *are* ZetaIds, so the mesh is the coordinate space.
- **Trust anchor** — the **origin / fixed reference** the resolution is measured *from* (the GitHub +
  FIDO human-trust root; the keyring 4×4 critical-infra). Infinite zoom needs a fixed anchor to be
  meaningful (a Beacon external reference; you resolve *relative to* the trust anchor).
- **CHIP-8** — the **minimal deterministic VM** the sim runs on. CHIP-8 (Weisbecker, 1977) is the
  canonical tiny interpreted machine — ~35 opcodes, the "first emulator you write." It is the
  **smallest honest common-ground machine**: a deterministic instruction set simple enough to be
  bit-perfect across all four oracles, the floor of the [`hooks/`](../../hooks/) / common-ground hook.
  `sim` as a CHIP-8-class VM = DST-replayable by construction (tiny, total, seedable).
- **ZetaId emulator with ray tracing** — the VM **emulates a ZetaId** (renders identity/state from the
  seed) and does so by **ray tracing** — which is **Rx ray-tracing itself** (local superdeterminism;
  every ray fully determined from the seed; the certainty pole). Ray tracing gives **infinite
  resolution for free**: you cast a ray to *any* depth and it resolves deterministically (no fixed
  pixel grid — resolution is per-ray, hence infinite). So `sim` = a CHIP-8-class deterministic emulator
  that ray-traces ZetaId-addressed state over Reticulum, at whatever resolution you ask for.

## Synthesis — what `sim` is

`sim` = **a tiny deterministic emulator (CHIP-8-class) that ray-traces ZetaId-addressed state over
Reticulum at infinite resolution, anchored to a trust root, measuring the collective-"we" Markov bounds
to quantum precision.** The earlier captures fall into place: prod = sim (the emulator *is*
production); `sim <duration>` SETI@home bounded edge contributions; quantum-phase time on the common
cause = the clock the rays are cast in; [`bounds/`](../../bounds/) = the collective-we boundary the sim
measures; infinite resolution = the fractal/self-similar zoom (§10).

## `sim` vs `measure` — ephemeral vs committing (Aaron 2026-06-10)

> Aaron: "really, because of our test-framework **finalizer**, it should be called **`measure`** —
> maybe that's the difference. **`sim` is ephemeral, does not commit. `measure` does.** It commits the
> **measurements and the uncertainty reduction**."

The CLI is a **pair of verbs**, split by whether the run **commits**:

- **`sim`** — **ephemeral**. Runs the deterministic simulation (the CHIP-8-class ZetaId ray-tracer) for
  a duration and **throws the result away** — no commit. The SETI@home bounded edge contribution that
  "runs local free, just burns compute": it explores, it does not record. `sim <duration>` (bare = 30s).
- **`measure`** — **commits**. The same engine, but it **commits the measurements and the uncertainty
  reduction** to the ledger. This is the **finalizer**'s doing: a tick produces a `TickResult`
  (ΔU / temperature / bounded / merged); `measure` is the verb that **persists that ΔU** — the
  *uncertainty reduction* — and the measurements that produced it. (`ReKick` → merge-to-main is the
  commit; [`uncertainty/`](../../uncertainty/) is the ledger it commits to.)

So the difference is exactly **commit vs no-commit**, and it is the **finalizer** that earns the name
`measure`: to measure (in our sense) *is* to reduce uncertainty and **record** the reduction. `sim`
observes ephemerally; `measure` collapses-and-commits. (Quantum echo: ephemeral evolution vs a
**measurement** that commits the outcome — fitting that the committing verb is `measure`.) Idempotency:
`measure` commits an uncertainty-reduction keyed to its measurement, so re-measuring the same thing is
upsert-by-key, not double-counting (discipline #6).

## Honest scope / peels

[Beacon] CHIP-8 (Weisbecker 1977 — real, minimal VM; the literal candidate emulator floor) · ray
tracing = local superdeterminism / deterministic per-ray resolution (real technique; "Rx ray-tracing
itself" is our reflexive framing) · Markov blanket (Pearl — real; the collective-we boundary is the
framing) · ZetaId + GitHub/FIDO trust anchor (real, built) · Reticulum (real overlay). **Peels:**
"infinite resolution" = arbitrarily-deep deterministic zoom (per-ray / fractal), not literal infinity;
"quantum precision" = quantum-phase-time resolution at the boundary, to formalize (Soraya/Sova);
"collective-we Markov bounds" = the boundary metaphor made measurable, to formalize.

## Ties / routing

[`bounds/`](../../bounds/) (the collective-we Markov boundary) · [`sims/`](../../sims/) (the `sim` CLI)
· [`hooks/`](../../hooks/) (CHIP-8 = the common-ground emulator floor) · `src/Core/ReticulumLink.fs`
(ZetaId destinations over the mesh) · `src/Core/Clock.fs` (quantum-phase time the rays cast in) ·
the quantum-phase-time doc (prod=sim; SETI@home) · trust anchor = `tools/setup/persona-keys/` (GitHub +
FIDO root). **Routes to:** Soraya/Sova (quantum-precision boundary measurement; infinite-resolution
spec), Dejan/Core (the CHIP-8-class `sim` emulator entrypoint), Aaron (the sim purpose).
