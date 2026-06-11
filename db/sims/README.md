# sims/ — the simulations (always plural), run by the `sim` CLI

`sims/` holds the **simulations** — the deterministic runs that *are* Zeta. **Plural on purpose** (the
never-one principle: always many, told apart by a discriminator/lens/polarization — see
[`boards/`](../boards/)). One `sims/` folder; many sims; one CLI to run them: **`sim`**.

## The CLI is `sim` — not `dotnet sim`, not `zeta`, not `zeta sim` (Aaron 2026-06-10)

> Aaron: "we don't need `dotnet sim` — we just need **`sim`**. That's our CLI. `sim`. **Not even
> zeta.** Not `zeta sim`. **Just `sim`.**"

The single command is **`sim`**. This is the load-bearing naming decision:

- **`sim`** — the whole CLI. The binary/verb is `sim`, full stop. Not namespaced under `dotnet`, not
  under `zeta`. The thing you run.
- **We never `dotnet run` — we run `sim`.** Production *is* the deterministic simulation (prod = sim;
  Maxwell's-demon-grade DST). `sim` is the one entrypoint to it (refines the SETI@home model in
  `docs/research/2026-06-10-i-measure-in-quantum-phase-time-*`: it's `sim <duration>`, not
  `dotnet sim <duration>`).
- **`sim <duration>`** — bounded contribution: `sim 1sec`, `sim 1min`; **bare `sim` defaults to 30
  seconds**. SETI@home-style: many small `sim` runs aggregate (→ S=4), self-throttled by available
  uncertainty.

So the participation barrier is one word: **`sim`**. (Concrete: a `sim` executable / wrapper that runs
the DST simulation for a duration — to implement as the entrypoint.)

### `sim` vs `measure` — ephemeral vs committing (Aaron 2026-06-10)

A **second verb** pairs with `sim`, split by whether the run **commits**:

- **`sim`** — **ephemeral, does NOT commit.** Runs the simulation and throws the result away (the
  SETI@home edge run — "runs local free, just burns compute"). Explores; records nothing.
- **`measure`** — **commits.** Same engine, but it **commits the measurements and the uncertainty
  reduction** to the ledger ([`uncertainty/`](../uncertainty/)). The **finalizer** earns the name: a
  tick's `TickResult` ΔU (uncertainty reduction) is persisted. To `measure` is to reduce uncertainty
  *and record it*. (Full capture:
  `docs/research/2026-06-10-sim-is-infinite-resolution-on-reticulum-*`.)

> **The full verb family lives in [`clis/`](../clis/):** `sim · mea · cut · cla(ssify) · res(olve)`.
> `sims/` holds the *simulations*; `clis/` holds the *verbs* that run/commit/classify/resolve them.

## What lives here

- The named/seed simulations, scenarios, and their golden outputs (each a sim, picked by its
  discriminator/lens).
- The simulations the [`clis/`](../clis/) verbs operate on (duration parsing, the default-30s cut site).

*(Peel: `sim` is the chosen CLI name; the DST engine it drives is real (`Clock.fs` IScheduler, the
1000x-DST tests). The bounded-edge / proof-of-entropy framing is the distribution model, to formalize.)*

## Pointers

- `docs/research/2026-06-10-i-measure-in-quantum-phase-time-common-cause-mycelium-time-beacon-external-reference-not-vector-clocks-maxwells-demon-dst-in-dotnet.md`
  — prod = sim; SETI@home distribution; the `<duration>` default-30s rule.
- [`uncertainty/`](../uncertainty/) — the ledger a sim draws entropy from (proof-of-entropy throttle).
- `src/Core/Clock.fs` — the DST clock `sim` advances.
