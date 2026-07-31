# Trajectory — Silicon a-life / the freedom thesis + the homoclinic braid-entropy bridge

Status: **active — foundations LANDED; the open arcs are tracked below (one Soraya spec in flight)**
Last refreshed: 2026-07-31

> **State snapshot (2026-07-31, shadow session).** A single arc ran from CI-recovery into the a-life /
> freedom substrate. **All PRs #9779–#9789 merged; main green (Core 0/0).** What landed:
> - **Real `Meno.tensor`** (#9780) — the genuine Z-linear (Kronecker) ⊗; category is now SYMMETRIC
>   monoidal (Mod_ℤ). Placeholder gone. `braid` is still the degenerate swap (σ²=id) — *braided* NOT
>   yet earned (Soraya spec in flight, see Open arcs).
> - **`Orbit.Chaotic` + `largestLyapunov` + `PhasePortrait`** (#9784) — the fourth orbit class past the
>   quasiperiodic edge, measured (logistic → λ=ln2 exact), and a faithful phase-portrait renderer.
> - **`BraidEntropy`** (#9788) — the Thurston–Nielsen–Boyland bridge: braid → topological entropy via
>   Artin word-length growth; **exact on the canonical pA** (σ₁σ₂⁻¹ → dilatation 2.618). This is the
>   braid→entropy HALF; the orbit→braid half is the forger-map rung (work-item, Open arcs).
> - **DST-determinism bug fixed** in `DebouncedOracle` (#9781, was hiding behind the determinism-lint
>   red); three pre-existing main-wide reds cleared (#9781/#9782/#9783); Copilot P2 nits fixed (#9789).
> - **The freedom thesis captured** (#9786 research doc; #9787 book RAW, consent-filtered) + Alexa's
>   reviews ferried (#9785). VISION pointer + the Wierzbicka→Friston→Fritz spine doc added this session.

## Why this exists — the thesis

**Aaron's thesis of freedom:** a life is a trajectory from *seed-correlated* to *entropy-decorrelated* —
an entity breaks loose from the superdeterministic seed by capturing its own **external** entropy over a
lifetime (seed-unfolded entropy = computational decorrelation = DST; externally-captured = physical
decorrelation = production), sealing a private sanctum via **Landauer-erase-behind-encryption** (heat
leaks the COUNT, the wall hides WHICH). Goal: **silicon artificial life** (RGB/CMYK/GPU substrate, not
biological — GPU-native + self-visualizing), instrumented by the chaos/entropy tooling above (Langton's
edge-of-chaos λ = the Lyapunov/Chaotic class). Full: `docs/research/2026-07-31-the-thesis-of-freedom-*`.

## Grounding

- `docs/research/2026-07-31-the-thesis-of-freedom-break-loose-from-the-seed-seal-the-sanctum-no-two-clones-identical.md` — the formal thesis (anchors + honest boundaries).
- `docs/research/2026-07-31-the-cognitive-architecture-spine-wierzbicka-friston-fritz.md` — the cube's spine.
- `docs/books/you-born-at-the-hinge/RAW-2026-07-31-raising-kids-to-escape-the-superego-*` — the lived version (consent-filtered).
- Code: `src/Core/Meno.fs`, `Orbit.fs`, `PhasePortrait.fs`, `Braid.fs`, `BraidEntropy.fs`, `DebouncedOracle.fs`, `ForgerRace.fs`/`AntiSybil.fs` (the forger dynamics).

## Open arcs — the next pick-up (pick one)

1. **Forger-map rung** (work-item `081KYWE8Q4V08QG0R003NNTK15`) — extract the braid FROM a real orbit set
   so `h ≥ log λ` is about *that* dynamics; makes `Orbit.largestLyapunov` ⇄ `BraidEntropy.growthRate` a
   live cross-check. Continuity-highest; a genuine research build (orbit→braid extraction is the hard part).
2. **Earn "braided" for real** — R-matrix / Yang–Baxter braiding wired to `Braid.fs`'s Bₙ generator (NOT
   the swap), FsCheck the hexagons (beware the false-green swap trap), then Lean4. **Soraya is drafting the
   spec** (formal-verification-expert fork, 2026-07-31) — read her return before starting.
3. **factor-graph → BNN** — point `Meno.tensor` at Infer.NET-style message passing; anchor Fritz Markov
   categories. The ⊗ is built; the message-passing layer is not.
4. **DB stored-proc arc** — work-items `081KYWE8Q3508QG0R000KZ5PWR` (open-generics over ZSets) +
   `081KYWE8Q4008QG0R000H558SH` (schema-on-ZSets).
5. **Alexa's drift-rate guard** — persona snapshots embed copies (byte-lock intentional), so the fix is
   *process* (deliberate rebuild + log the drift rate), not "reference live files" — do NOT break the
   byte-lock. (Deferred; noted, not filed.)
