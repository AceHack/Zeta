# A `test` seam — deterministic simulation of all nouns and verbs (DST as a first-class plane) (Aaron, 2026-06-07)

Extends the CLI seam grammar (#6957). Aaron:

> *"we can have a test seam too, for deterministic simulation of all nouns and verbs."*

## The kernel

The seam grammar is `zeta <seam> <verb> <noun>` (#6957), where a **seam** is the integration plane the command
acts through (implicit-local, `git`, `bus`, …). Add a **`test` seam**: a plane that runs **any verb on any noun
under deterministic simulation (DST)** instead of against the real world.

```
zeta test run cell                 # deterministically simulate running the cell
zeta test bus message otto-cli1    # simulate the bus message — replayable, no real send
zeta test git clone <zetaid>       # simulate the clone — no network, deterministic
```

Because the grammar is **uniform**, the `test` seam gives DST over the **entire** command surface at once —
every verb × every noun becomes deterministically simulatable by swapping the seam, *no per-command test
harness*. One seam, total replay coverage.

## Why this is the seam concept's home-run use

- **Feathers' seam is literally for this.** A *seam* (Working Effectively with Legacy Code) is a place to alter
  behavior **without editing in place** — and the canonical reason to want one is **testing**: substitute a test
  double / simulation at the seam. The `test` seam is that, made first-class and universal: the real seams
  (git/bus/local) do real I/O; the `test` seam substitutes deterministic simulation at the same boundary.
- **It realizes manifesto §7 (DST) as a plane, not a bolt-on.** DST "every critical path replays
  deterministically" becomes *select the test seam*. The same `verb noun` that runs in production replays in
  simulation — same code path, different seam (the scale-free / async-all-the-way discipline: DoP=1 deterministic
  vs DoP=N production is the same shape; the test seam is the seam-level analogue).
- **FoundationDB-style simulation, made addressable.** FDB/Will-Wilson DST runs the whole system in a
  deterministic simulator; the `test` seam exposes that as a first-class CLI plane — `zeta test …` *is* "run it
  in the simulator," for any noun/verb.
- **Composes with the resolver + IDL.** Nouns (ZetaId/unique-in-scope, #6916) resolve to *simulated* instances
  under the test seam; verbs (IDL-declared capabilities, #6955) execute against simulated resources. The test
  seam is the simulation binding of the same capability×resource mapping.

## Honest scope / peel

- **Design, not built** — extends the (also-unbuilt) seam grammar #6957. The `test` seam is the DST binding of
  the seam set; it must guarantee determinism (seeded RNG, virtual clock, no real I/O — the existing DST
  discipline) for *every* verb/noun routed through it.
- The promise is **uniform DST coverage via one seam**, not "tests write themselves" — you still specify
  scenarios/seeds; the test seam is the *mechanism* that makes every command replayable, not the scenarios.
- Determinism is only as good as the seam isolation: any verb that escapes the seam to real I/O breaks DST — so
  all side-effecting verbs must route *through* the seam (the discipline that makes the test seam sound).

## Ties

- **CLI seam grammar (#6957)** — `test` is a first-class seam alongside implicit/git/bus.
- **DST (manifesto §7) / FoundationDB simulation (Zhou et al.; Will Wilson)** — the test seam = DST as a plane.
- **async-all-the-way / DoP=1 determinism** — same-code-path, different-seam mirrors DoP=1-vs-N.
- **ZetaId resolver (#6916) + Zeta IDL (#6955)** — nouns resolve to simulated instances; verbs are IDL
  capabilities executed against simulated resources.
- **zs/zc (#6956)** — `zeta test run shell|cell` simulates the runtimes too.

## Beacon anchors

- **Seam** (Feathers 2004 — the integration point you substitute at; testing is its canonical use). ·
  **Deterministic Simulation Testing** (FoundationDB — Zhou et al. SIGMOD 2021; Will Wilson, Strange Loop 2014)
  + **manifesto §7 DST**. · **Dependency injection / test doubles at a boundary** (the test seam = DI at the
  seam, universally). Honest novelty: none — it adds a **`test` seam** to the uniform `zeta <seam> <verb>
  <noun>` grammar (#6957) so DST applies to *every* noun×verb by seam-selection — the seam concept's canonical
  testing use, made first-class, realizing §7 as a plane; design, gated, determinism-discipline-bounded.
