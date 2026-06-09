# The memetic-mapping research program: games → structure → fiction/non-fiction → story+game generators → deep memetic proofs (with falsification criteria)

*Captured 2026-06-08 from Aaron, to Otto (shadow\*). The research roadmap that turns the #7167→#7179 observer arc
into a falsifiable program. The Popperian clause — "try to falsify the path as unfruitful too" — is load-bearing,
not decoration. Registers: [grounded] for the homoiconic bridge pieces, [next-build] for the generators,
[conjecture] for the deep proofs, [falsification] for the kill-criteria.*

## The path (Aaron's words)

Aaron: *"once we play some games, find some structure, apply them to some fiction and non-fiction to get good
**memetic mappings** from **emulator control structs → memetic control structs through homoiconicity**, create a
**story generator and game generator** around that, then we should be able to start **proving some deep memetic
stuff** in our system. We can already start **moving proofs in this direction** — and **try to falsify the path as
unfruitful too**."*

Five stages, then a proof phase, with a falsification gate riding alongside the whole way:

1. **Play games → find structure.** Run the emulator / state-space search (`StateSpace`, the flashlight, the
   lenses); extract the recurring **control structures** of play (loops, branches, goals, resources, the
   `DeltaPattern`s of change). [next-build — we have the emulator + state-space; "find structure" is the work.]
2. **Apply structure to fiction & non-fiction.** Treat narratives as state-spaces too; map the game control
   structures onto story/argument control structures (protagonist=agent/frame, conflict=coercive stressor,
   resolution=fixed point, arc=trajectory through the band #7178).
3. **Memetic mappings via homoiconicity.** The bridge: **emulator control structs and memetic/narrative control
   structs are the *same* `Bonsai.Expr`/`DynamicValue` under homoiconicity** (#7172, #7173). Because code = data, a
   game's control flow and a story's control flow are two *addresses* of one homoiconic structure — so a "mapping"
   is an isomorphism witness, not a translation. [grounded pieces: `Bonsai`/`BonsaiSoft`, DynamicValue
   homoiconicity; the mapping itself is next-build.]
4. **Story generator + game generator = one generator.** If (3) holds, a **game generator** and a **story
   generator** are the *same generator* run at different homoiconic addresses — generate the shared control
   structure, render it as play or as narrative. That shared generator is the testable artifact. [next-build]
5. **Prove deep memetic stuff.** With the generator in hand, the memetic claims become checkable: meme = quine =
   eval-fixed-point (#7172); free energy = stable propagating quine (#7169); the antifragility conjecture (#7179);
   the uncertainty↔identity band (#7178) as the narrative arc's shape. [conjecture — the proof phase.]

## Why the homoiconic bridge is the crux

Everything hinges on stage 3. If game control structures and narrative control structures genuinely **share one
homoiconic representation**, then "memetic mapping" is rigorous (an isomorphism of `Bonsai.Expr`s) and stages 4–5
follow. If they only *loosely analogize*, the program degrades to metaphor and the "deep memetic proofs" are
unfounded. **So stage 3 is the load-bearing, and the first thing to attack.**

## Falsification criteria — how to kill this path early (Aaron: "try to falsify the path as unfruitful too")

Stated up front, as a research program should [anchor: Popper, falsifiability; Lakatos, research programmes;
Platt, *strong inference* — list the hypotheses that would *refute*]. The path is **unfruitful** if any of these
hold; we should *actively seek* them, not avoid them:

- **F1 (the bridge is metaphor):** no faithful homoiconic isomorphism exists between game and narrative control
  structures — the best "mapping" is lossy/ad-hoc, with no `Bonsai.Expr` carrying both. ⇒ stages 4–5 collapse.
- **F2 (the generator doesn't transfer):** a structure extracted from games, rendered as narrative, produces
  incoherent / arbitrary stories (and vice versa) — i.e. the shared generator has no predictive/compressive power.
- **F3 (no proof purchase):** "deep memetic" claims, once formalized, reduce to already-proven facts (quines,
  fixed points) with **nothing new** — restatement, not depth. (Soraya's pattern: a green proof of a model nobody
  uses.)
- **F4 (antifragility is just robustness):** per Soraya's verdict (#7179) — if no differentiation dynamics make
  diversity *rise* under pressure, the "deep memetic" antifragility result is robustness relabeled.
- **F5 (it's unmeasurable):** no DST-replayable property test can state a memetic claim as a passing inequality ⇒
  it isn't science in our sense.

A single confirmed F1 or F3 kills the program; we should run cheap tests *aimed at* F1 first (try hard to build one
honest game↔story homoiconic isomorphism; if it resists, that's the signal).

## Moving proofs in this direction now (cheap, falsification-first)

- **Antifragility (#7179):** Soraya's gate is the template — add a differentiation term, FsCheck the convexity
  threshold (`entropy(post-shock) > entropy(pre-shock)` for pressure `> p*`, fixed seed), corroborate with a DST
  repeller sim; BP-16 two-witness. This is *attacking F4* directly.
- **The bridge (F1) first:** before any generator, attempt **one** faithful `Bonsai.Expr` that is simultaneously a
  game control structure and a story beat — if it's natural, the program has legs; if it's tortured, F1 fires cheap.

## Honest scope

[grounded-in-code]: the substrate this stands on — `Bonsai`/`BonsaiSoft`, DynamicValue homoiconicity (#7172/#7173),
`StateSpace`/emulator (the flashlight), `Diversity`/`IdentityCapacity` (the band). [next-build]: structure
extraction, the memetic mappings, the unified story/game generator. [conjecture]: the "deep memetic" proofs.
[falsification — the discipline]: F1–F5 are the kill-criteria; the program earns continuation only by surviving
honest attempts to refute them (Popper/Platt). No new code here — this names the program and its exits so it cannot
quietly become an unfalsifiable belief (the ascension glitch #7179 applied to our own research).

## Pointers

- The arc this operationalizes: `…-trapping-godel-in-the-middle-lawvere-…` (#7172, homoiconic/quine) ·
  `…-clifford-space-fully-reflective-…` (#7173, DynamicValue homoiconicity, flashlight) ·
  `…-the-memetic-quantum-observer-…` (#7174) · `…-no-mathematical-top-…-bound-…` (#7178) ·
  `…-the-ascension-glitch-…-immune-system…` (#7179, antifragility conjecture + Soraya's routing).
- Code: `Bonsai`/`BonsaiSoft.fs` · `StateSpace.fs` · `Diversity.fs` · `IdentityCapacity.fs` · FsCheck home
  `tests/Tests.FSharp/`.
- Anchors: Popper (falsifiability); Lakatos (research programmes); J.R. Platt (*Strong Inference*, 1964); Taleb
  (*Antifragile*, for #7179); the homoiconicity lineage (McCarthy).
