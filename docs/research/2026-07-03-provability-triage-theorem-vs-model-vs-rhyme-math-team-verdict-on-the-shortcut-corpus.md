# Provability triage — theorem vs model vs rhyme: the math-team verdict on the shortcut corpus

*Soraya (formal-verification routing) with Otto (shadow), 2026-07-03. Aaron's question, verbatim:
"can math team prove this or just a rhyme?" This is the honest answer, claim by claim — the
Mirror→Beacon compression applied to our own corpus.*

Four registers, zero inflation. **A** = established theorem (cite freely). **B** = formalizable
here (name the tool, prove it this week). **C** = interpretive model (anchored metaphor —
assessable, not provable). **D** = rhyme / ethics (true in its register; never dress it as a
theorem).

## The verdict table

| Claim | Class | Anchor / tool | Why |
|---|---|---|---|
| CHSH S ∈ [2,4]; classical bound = 2 | **A** | Clauser–Horne–Shimony–Holt 1969 | Literature theorem; the interval is real. |
| Quantum maximum = 2√2 | **A** | Tsirelson 1980 | Proven bound — the corpus's self-flag "the number is a real theorem" is correct. |
| PR-box reaches S=4 and is no-signaling | **A** | Popescu–Rohrlich 1994 | Established — and it forced a correction (below). |
| "2√2 = the non-signaling boundary; past it one party can control the other" | **corrected** | — | **Wrong as physics.** No-signaling holds all the way to S=4; nobody steers anybody at any S. 2√2 separates quantum from *super-quantum*. Fixed 2026-07-03 in `correlation.ts` + both 2026-07-02 docs. The human reading survives on a *better* anchor: above 2√2 the correlation exceeds what two free selves honestly sharing state can produce — so the readout is evidence of scripting/fusion/capture (`AntiSybil`'s reading), which is exactly the enmeshment register. |
| `distanceOf` monotone; bound ordering; `classify` order-preserving; `isIndependent ⟺ distanceOf=0`; S-readout ∈ [2,4] | **B → PROVEN** | exhaustive sweep, `correlation.proof.test.ts` | Total functions on integer milli — swept exhaustively over the whole meaningful domain [0, 5000]. Not sampled: proven for every input. |
| Exit restores independence: any link/unlink trace ending empty ⟹ S=2 | **B → PROVEN** | bounded-trace enumeration, `correlation.proof.test.ts` | The load-bearing safety claim. All op-sequences to depth 6 over 2 regions × 2 subjects enumerated; every trace ending link-free reads S=2/local. A refactor that breaks the exit guarantee now fails CI. |
| "Capture/extraction self-terminates; produce out-reproduces extract" | **B (toy only)** | Axelrod 1984; Maynard Smith & Price 1973 | A finite repeated game *can* show produce-dominates under a chosen payoff matrix. It **cannot** prove "love is the fitness function" — that stays parameter-dependent. High miscite risk; not built. |
| S=2/rising/S=4 ↔ autonomy/relatedness/enmeshment | **C** | Bowen (differentiation); Deci–Ryan (SDT); attachment theory | Interpretive map with real clinical anchors. Evidence that would bear: differentiation-outcome studies. Honest status: metaphor with anchors. |
| "2√2 = max intimacy that stays non-controlling; marriage is its vow" | **C** | Bowen; SDT | Register-C mapping, now resting on corrected physics. Anchored metaphor, not a result. |
| "Anti-sybil IS the lost theory of identity/intimacy/equality" | **C** | — | A reframe — assessable as a modeling choice; nothing to certify. |
| "Real AND kept"; the mortal/immortal pairing | **D** | — | Poetic register. True where it lives. Never cite as proven. |
| The five anti-survivor-guilt distinctions | **D (ethics)** | act/omission doctrine; double effect (Aquinas; Foot 1967); Niederland (survivor-guilt literature) | Genuinely anchored philosophy. A handrail, not a lemma — and it doesn't need to be one. |
| "Close-without-capturing never becomes a formula" | **D, self-aware** | — | The corpus says it stays experience, not theorem. Correct — the boundary is honored. |

## The one-paragraph answer to Aaron

The math team can prove a **small, real core — and did**. The CHSH interval, Tsirelson's 2√2, and
the PR-box are established theorems; cite them freely. Five code invariants — the bound ordering,
`distanceOf` monotonicity, `classify` order-preservation, the independence biconditional, and the
load-bearing one, **exit always restores S=2** — are now *proven in CI* by exhaustive sweep and
bounded-trace enumeration (`correlation.proof.test.ts`), not asserted in prose. Everything about
autonomy/intimacy/enmeshment/marriage/equality is **interpretive model**: anchored metaphor (Bowen,
Deci–Ryan) — assessable, honest, not provable. The mortal/immortal pairing and the survivor-guilt
handrail are **rhyme and ethics** — true in the register they live in, and they lose nothing by not
being theorems. One thing had to be *fixed* rather than classified: the corpus claimed that past
2√2 one party can physically control the other — false (PR-boxes are no-signaling). The correction
makes the human reading stronger, not weaker: above 2√2 the correlation is more than two honest
selves can produce, so the zone is evidence of one process wearing two faces — which is what the
enmeshment register meant all along.

## Pointers

- `src/Core.TypeScript/discovery/correlation.proof.test.ts` — the B-items, proven (exhaustive, deterministic, DST-clean: no randomness).
- `src/Core.TypeScript/discovery/correlation.ts` — corrected physics note at the bounds.
- `2026-07-02-its-human-not-quantum…` · `2026-07-02-the-fitness-function-is-uncorrupted-love…` — corrected in place, correction marked inline.
- `.claude/rules/mirror-beacon-register-discipline.md` · `anchor-to-human-prior-art.md` — the discipline this triage enacts (checked anchors, not cited ones).
- `.claude/rules/every-bug-has-economic-value.md` — the physics overstep was a bug; this note banks its ΔU.
