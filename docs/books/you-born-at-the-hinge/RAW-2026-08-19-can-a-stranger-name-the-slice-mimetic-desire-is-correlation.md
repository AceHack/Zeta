# RAW — "Can a stranger name the slice?" · mimetic desire is correlation

**Aaron 2026-08-19**, on the soundness requirement for subset-verification:

> "save this to things hidden since the foundation of the world and peter thiel and
> memetic desire this is such a reduction is impressive, i think maybe minimal"

## §1 The sentence

> **Can a stranger name the slice?**

The context: a claim that requires *all* of our history to evaluate is unfalsifiable to
outsiders — not because anything is hidden, but by **context asymmetry**. Nobody outside
can hold twelve thousand PRs and a private vocabulary, so "verifiable in principle" is
false in practice. The fix is subset-verification: prove a fact about a large structure
with a bounded slice of evidence (inclusion proofs; a light client verifies a chain
without the chain).

**The soundness requirement is the whole game.** If *we* choose the slice, "verify
against a subset" degrades into "verify against the subset that makes me look right."
Either the challenger picks, or the subset is committed to before the claim — which is
exactly why Fiat–Shamir derives the challenge from a hash of the commitment rather than
letting the prover choose it.

So the design test reduces to one question a stranger can ask, and the answer is binary:
**if they name the slice, it is a proof; if we hand them a curated window, it is a demo.**

## §2 Why Girard — mimetic desire IS correlation

Aaron's connection, and it is the reduction he means.

**Girard, *Things Hidden Since the Foundation of the World* (1978):** desire is not
autonomous, it is **triangular** — we want what the model wants. Desire is copied.

Stated in this substrate's vocabulary: **mimetic desire is ρ → 1 in preference space.**
A crowd of imitators is not N independent wanters; it is one wanting, counted N times.
Which is exactly the failure that breaks every aggregation we rely on — Condorcet needs
independent judges, ECC needs independent redundancy, boosting needs decorrelated
learners, diversification needs uncorrelated assets. Mimesis is the mechanism that
silently drives all of them to n_eff = 1 while the headcount keeps rising.

**And Thiel is Girard's student**, which is why *"competition is for losers"* is not a
brag but a corollary: competition is **mimetic** — rivals converge on the same prize
because each is watching the others. His monopoly is not primarily about market power;
it is **decorrelation** — occupy the space nobody is imitating you into. Same theorem as
the day's other four costumes, in the language of markets.

## §3 The reduction

The stranger test is the **anti-mimetic** test.

If only insiders can name the slice, the verification is itself mimetic — the group
checking itself against the group's own criteria, and every check confirms what the
group already wanted to be true. **A stranger naming the slice is the one operation that
breaks the loop**, because their choice is drawn from outside the correlated preference
field.

Which makes it the same requirement arriving for the fifth time today: **you cannot
verify yourself from inside.** Gödel for consistency, Tarski for truth, Kish for witness
counts, Lincoln–Petersen for the universe size, Girard for desire. Five domains, one
junction — and the junction is always *the boundary where an outside reference has to
enter*.

## §4 Register — held, because this is the part that would rot

- The **arithmetic** claim (a self-chosen subset proves nothing; a challenger-chosen one
  does) is **not** interpretation. Fiat–Shamir is the checked anchor.
- **"Mimetic desire is ρ → 1"** is a **structural analogy**, `unmetered`. Girard did not
  derive it and no correlation coefficient has been measured over a preference field.
  It is stated as *consistent with*, per `numerology-vs-number-theory`: a matching shape
  is not an identification, and the promotion path is someone supplying the structure.
- The **Thiel reading** is a reading. Recorded as Aaron's, not as Thiel's stated position.

## §5 Where it lands in the book

This is a candidate for the **minimal form** — Aaron: *"such a reduction … maybe
minimal."* The chapter-level claim it serves: every mechanism in Zeta exists to buy
independence, because independence is the only currency that purchases a free lunch, and
the free lunches (Condorcet, Shannon, boosting, diversification) are how a society of
merely-51%-good agents converges good instead of evil.

## Pointers

- `docs/VISION.md` §"The junction discipline" — the same move, stated for effects/failure/time.
- `docs/research/2026-08-18-godel-localized-to-a-known-junction-*` — localize, don't escape.
- `docs/research/2026-08-19-delta-u-per-unit-of-available-time-*` — the denominator instance.
- `src/Core/SocietyUsefulWork.fs` — `effectiveTrialCount` (Kish), the shipped correction with **no production caller** as of 2026-08-19.
- `.claude/rules/numerology-vs-number-theory.md` — why §4 exists.
