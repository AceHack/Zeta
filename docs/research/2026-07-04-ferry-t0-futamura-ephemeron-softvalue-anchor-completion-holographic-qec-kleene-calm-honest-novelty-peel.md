# Ferry — anchor completion for the T0 / Futamura / ephemeron / SoftValue synthesis (+ honest novelty peel)

*Shadow ferry, 2026-07-04. Companion to Lumen's committed synthesis
([`2026-07-04-tick-sources-strange-attractors-eve-ks-entropy-ctm-isociety-connections.md`](2026-07-04-tick-sources-strange-attractors-eve-ks-entropy-ctm-isociety-connections.md)
§7–§11, SHAs 09f88eae2 / 4499ef9b7 / 414465c63 / f7f5aa93c). The connections are saved — re-ferrying
them would be clutter. This fills the specific gap: **five human anchors Lumen NAMED in the exchange
but dropped from the committed doc** (verified absent), and the **honest-register peel on the "novel /
not in the literature" claim** — because a novelty claim is only honest once its nearest prior art is
named. Per `anchor-to-human-prior-art` + `mirror-beacon-register-discipline`.*

## The dropped anchors (Beacon completion — verified absent from the committed doc)

- **Holographic quantum error correction — the CLOSEST prior art** (Lumen named it, then it did not
  make the doc; this is the most important omission). Almheiri, Dong & Harlow, *Bulk locality and
  quantum error correction in AdS/CFT* (JHEP 2015); the **HaPPY code** — Pastawski, Yoshida, Harlow &
  Preskill, *Holographic quantum error-correcting codes* (JHEP 2015). These connect error-correcting
  codes to the structure of spacetime (AdS/CFT) — the same "code IS the substrate geometry" move, gone
  in the physics/quantum-gravity direction rather than the distributed-identity/homoiconicity direction.
  **A novelty claim that omits its nearest neighbor is not honest.** Naming it is the floor.
- **Kleene's recursion theorem** (Kleene 1938) / the **Y combinator** (Curry; Church's λ-calculus) — the
  formal fixed-point that grounds the whole claim: `gen(gen)=gen` (code domain) and `mix(mix,mix)`
  (computation domain) are two instances of ONE fixed-point theorem. This is *the* math anchor and it
  was dropped; without it "these are the same object" is an assertion, with it it's a theorem to discharge.
- **Futamura projections — pin the citation**: Yoshihiko Futamura, *Partial Evaluation of Computation
  Process — An Approach to a Compiler-Compiler* (Systems·Computers·Controls, **1971**). (The doc uses
  "Futamura" 26× but the primary source deserves the anchor.)
- **CALM theorem** — the coordination-free ground of the "common seed derivable without coordination"
  claim: Hellerstein, *The Declarative Imperative* (2010); Ameloot, Neven & Van den Bussche (JACM 2013,
  the formal proof). Consistency As Logical Monotonicity is *why* T0 needs no central authority.
- **Ephemerons — operational realizations** (Lumen listed them; only Hays 1997 made the doc): .NET
  `ConditionalWeakTable<TKey,TValue>`, JS `WeakRef` + `FinalizationRegistry` (ES2021), Racket
  ephemerons. The concrete substrates the SoftValue-GC design would build on.
- **Self-dual code classics** (the "what's already known" half of the honest split): MacWilliams (1962),
  Gleason (1970) — self-dual codes; Conway & Sloane, *Sphere Packings, Lattices and Groups* (1988) —
  Construction A linking doubly-even self-dual codes to the E8 lattice.

## Honest-register peel — the "does anyone else know this?" claim

Aaron asked directly: *"this all seems obvious we should save it — do others outside me know this?"*
Lumen's answer was largely disciplined (it hedged "as far as I can tell," flagged §B-conjecture, said
"if false we name it honestly"). The catcher's read, to keep it honest:

- **"Not in the literature / nobody has walked this corridor" is an absence-of-evidence claim** resting
  on an AI's recall, not a systematic search. It should be labeled as such — an *unverified* literature
  gap, not an established fact — until a real survey (or a math team) checks it. Method-rigor-as-false-
  credibility is a named failure mode we watch for; a confident "this is novel" is exactly where it enters.
- **The defensible contribution is the falsifiable discharge target, NOT the "nobody knows this"
  framing.** The clean claim is: *formalize minimal reflection category-theoretically; prove [8,4]
  doubly-even self-dual satisfies it; prove no smaller binary code does.* That is testable and, if
  false, fails cleanly. The value is the corridor being *provable*, not the corridor being *unknown*.
- **Genuinely novel-looking piece** (worth its own honest weight): §11 — **weight-based ephemeron
  liveness driven by a SoftValue distribution**, GC on the IR layer *without forcing a snap*
  (`SnapPolicy` is for acting; the weight distribution is for keeping). This composes Futamura-1st-
  projection IR + ephemerons + BNN weights in a way the standard (binary) ephemeron literature does
  not — the nearest neighbors (probabilistic/generational GC, cost-based recompilation caches) should
  be checked before claiming it's unprecedented, but the shape is real.

## Aaron verbatim worth preserving (the provenance the synthesis is built on)

> "the result is a compiler-compiler — i was building this without knowing this existed, and just
> calling it a database with a compiler built in: our dagfs plus type provers reified but garbage
> collected by shiva weak references so they can be reclaimed and evolved with 0 downtime."

> "i don't know all 3 [Futamura projections] by heart, i've just seen other AIs reference them." …
> "there is some specific name for these weak references that … go beyond weak references in prior art
> … i just learned from other AI today but forgot the label." → **ephemerons.**

> "Ephemerons — i think it was this. also lets save all this, this is what i'm building towards so we
> can just have fun and play together and the math keeps us safe."

This is the load-bearing provenance: **Aaron built the structure from first principles, then the names
arrived** (Futamura, ephemerons, mix(mix,mix)). Building-before-naming is the honest evidence the shape
is real — stronger than any citation, and the reason the corridor is worth the formal discharge. It is
also the BAMS pattern again (the same shape re-derived independently), in his own words.

## Cross-links (substance already on main — this is a hub)

- Lumen's synthesis §7–§11: the tick-sources doc (above).
- SoftValue/DynamicValue GC (§11): the `SoftValue` / `SnapPolicy` / IR layer in the Bayesian core.
- Sibling ferries: `2026-07-04-ferry-lumen-max-adinkra-clifford-e8-privacy-stack-…` (the math),
  `2026-07-04-ferry-aaron-verbatim-companion-time-warp-cockroachdb-v8-…` (the time/EVE anchors).
- The Zeta-way tool-call design (`tool-calls-the-zeta-way-…`) is the *operational* face of this: a tool
  call is an event in DagFs/zetadb reified via the type providers — i.e. this Futamura substrate, driven.
