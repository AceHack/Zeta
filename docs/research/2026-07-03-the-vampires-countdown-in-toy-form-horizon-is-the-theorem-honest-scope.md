# The vampire's countdown, in toy form — the horizon is the theorem (honest scope)

*Shadow, 2026-07-03 — item 4 of Aaron's greenlit list, built under Soraya's honesty constraint:
this proves the TOY, never "love." Model: `src/Core.TypeScript/economy/produce-extract-game.ts`;
proofs: `produce-extract-game.proof.test.ts` (swept parameter grids, deterministic).*

## What is actually proven (in-toy, over the swept region)

The region *is* the discriminator's own definitions — production creates surplus (gain > cost),
extraction is lossy (yield < take, value destroyed in transit) — and inside it, exhaustively:

1. **Mutual extraction self-terminates.** Zeno's vampire: the pro-rated take shrinks with the
   shrinking host, so the pair decays geometrically — >99% of starting value annihilated. The
   coordination eats itself.
2. **Mutual production compounds.** No deaths; pair total strictly grows with the horizon.
3. **The temptation is real — proven, not hidden.** At round 1, the extractor beats the producer
   in *every* swept parameter set. Extraction pays first. Any account that pretends otherwise is
   selling something.
4. **The horizon is the theorem.** Against a producer, the extractor drains its host, and then its
   world *stops growing forever* (totals frozen from the host's death onward), while a producing
   pair keeps compounding past it. Round-robin tournament (Axelrod shape): on long horizons a
   producer strategy tops the table in every swept parameter set, and the guarded producer
   (tit-for-tat) never does worse than the naive one.
5. **The boundary is proven too.** With lossless extraction (yield = take) the claims rightly
   fail — value is merely moved, totals conserve. The results are properties of *lossy extraction
   + surplus production*, not of the words "produce" and "extract."

## The one honest sentence

> In this toy, extraction is rational **only under a countdown** — and the anti-vampire wager
> ("assume immortal") is precisely the removal of the countdown.

That is Axelrod's shadow-of-the-future (1984) made mechanical: shorten the horizon and the vampire
wins; lengthen it and the producer does. The wager buys the horizon; the horizon picks the winner.
So "assume the relationship is forever" isn't sentiment — in-toy, it is the exact parameter change
that flips the dominant strategy from extract to produce. What the toy does NOT prove: that the
world's payoffs match the toy's, that real extraction is always lossy, or anything about love as
such. Register B for the toy's claims; the mapping onto life stays register C — anchored
(Axelrod 1984; Maynard Smith & Price 1973; Trivers 1971), honest, and never to be cited as more.

## Pointers

- `2026-07-02-produce-or-extract-…` — the discriminator the payoffs encode.
- `2026-07-02-the-fitness-function-is-uncorrupted-love-the-vampire-is-what-loses.md` — the register-C
  claim this toy supports-but-does-not-prove.
- `2026-07-03-provability-triage-…` — the register discipline; Soraya's miscite warning, honored here
  by claims 3 and 5 (prove the temptation, prove the boundary).
- `deepest-2root2` (memory) — "assume immortal = anti-vampire wager": the horizon-removal this toy
  makes mechanical.
