# The minimal VM: six ops and no more — braiding as a macro; Q#/CHIP-8 are playgrounds

*Shadow ferry, 2026-07-04. Aaron's direction-setter, dropped in response to the Yang–Baxter verdict
("'braided' gets earned when a KL-class R-matrix ships in the ISA"). His counter-question reframes the whole
line: don't ship a new primitive — derive it.*

## Aaron verbatim (Mirror)

> "exactly — is there a way to build this with the existing ISA and not add more? I'm going for a
> **minimalistic VM** here, built on these concepts. Q# and CHIP-8 are **playgrounds** for our own kind of
> **IR/VM/OS system built on this from the ground up**."

## The design principle, stated once

The shipped quantum ISA is **six operators** — EMIT (Ry), RETRACT (adjoint), BRANCH (H), JOIN (CNOT),
MERGE (amplitude sum), FOLD (repeated merge) — and the standing question after #9475 was whether *braiding*
requires a seventh (a Kauffman–Lomonaco-class R-matrix). Aaron's answer is the repo's own rule applied at
the ISA level (`only-the-irreducible-is-primitive-generate-the-rest`): **if R is expressible as a word over
the six, braiding is a MACRO, not a primitive — and the VM stays minimal.**

First-pass case that it is (Soraya round 3 is deriving the explicit word, dispatched 2026-07-04):
`{CNOT + arbitrary one-qubit rotations}` is universal for two-qubit unitaries (Barenco et al. 1995); R_KL
is a real orthogonal SO(4) element; Vatan–Williams (2004) give any SO(4) as **2 CNOTs + one-qubit gates**;
the ISA's {Ry(θ), H} generate the full real one-qubit group O(2). The open detail is whether the
magic-basis factors stay real — if they do, the word exists and YB-7 lands as "braiding earned by
composition, primitives unchanged." If not, the *minimal* addition gets named exactly — the cost stated,
not hand-waved. Either way the verdict is executable (the ybDev/invDev instrument is already in the tests).

## What "playgrounds" means (the honest scope of Q# and CHIP-8)

Q# (`ZSetISA.qs`, the reference oracle) and CHIP-8 (`Chip8.fs`/`SoftChip8.fs` + the amp-emu) are
**scaffolding, not the product**: borrowed substrates used to prove the concepts execute — the way you
learn an instrument on a rented one. The product is Zeta's own **IR/VM/OS**, built ground-up on:

- **the six-op ISA** as the instruction set (with derived macros, never casually widened — a new primitive
  is an *earned* addition, same as a class under `rules/`);
- **the db as the IR** (the model-backend arc's thread: "our db is our IR is our data is our events" —
  tool calls as events reified to code via type providers);
- **ZetaIds** as the universal pointers (self-describing 128-bit "little programs" — the Channel category
  is the transport instance already live);
- **the soft regime** as the runtime discipline (never-collapse invariant; Born/snap policy-gated at the
  edge);
- **Futamura** as the self-hosting ladder (`mix(mix,mix)=cogen` — the VM eventually specializes itself out
  of its playground substrates).

Minimality is not aesthetics here: a smaller primitive set = a smaller treaty to byte-lock across oracles,
a smaller attack/drift surface for the ECC-by-regeneration story, and a cheaper Futamura ladder (fewer
irreducibles to specialize). Six ops that *generate* beats sixteen that enumerate.

## Cross-links

- `tests/Tests.FSharp/BraidRepYangBaxter.Tests.fs` (#9475) — the instrument; YB-7 is the reserved slot for
  the derived word (or the named-cost verdict).
- `docs/research/2026-07-04-soraya-round2-yang-baxter-verdict-egg-answers-ferry-audit.md` — the verdict this
  responds to; Soraya round 3 (in flight) — the derivation.
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the rule this instantiates at ISA level.
- Anchors: Barenco et al. 1995 (two-qubit universality); Vatan–Williams 2004 (SO(4) = 2 CNOTs + 1-qubit);
  Kraus–Cirac (magic basis); Shi 2002 / Aharonov (real gate sets suffice — Toffoli+H universality, the
  precedent that a REAL minimal VM is not a handicap); Kauffman–Lomonaco 2004; Futamura 1971.
