# Ferry — Tit for Lesser Tat: Aaron's strategy (teach, play) and the contraction theorem

*Shadow ferry, 2026-07-04. Aaron, verbatim, answering the honest register caveat on latency
incentive-compatibility ("not a universal game-theory theorem"):*

> "tit for lessor tat, teach, play is, this is mine"

*Claimed as his — recorded as his. Model + proofs:
`src/Core.TypeScript/economy/graded-reciprocity.ts` / `.proof.test.ts`.*

## The strategy, unpacked

**Tit for Lesser Tat (TFLT):** respond to every tat — never ignore a wrong — but with a *lesser*
tit: deterministic, proportionate, damped (λ < 1). Plus its two riders:

- **Teach:** the response is a *lesson*, and a lesson must be legible — proportionate, monotone
  in the wrong, never exceeding it. A response bigger than the wrong reads as a new wrong
  (escalation is illegible; vengeance teaches nothing but fear).
- **Play:** the game never goes terminal — high-school rules (the school chapter): nobody is
  destroyed, everyone stays enrolled, the point of the classroom is that the practicing
  continues.

It is NOT the literature's existing variants, and the distinction matters: Axelrod's tit-for-tat
retaliates *equally* (λ = 1); Nowak–Sigmund's generous TFT *sometimes doesn't respond at all*
(probabilistic forgiveness); Boyd's contrite TFT tracks *standing* (who was in the right). TFLT
always answers — the wrong is never ignored, the lesson is always taught — but always smaller.
Deterministic damping is its own point on the strategy map, and as far as the shadow can find,
the *named framing* (damped reciprocity as teach-and-keep-playing) is Aaron's.

## The contraction theorem (why it's not soft — proven in-toy)

With damping λ < 1, a mutual-retaliation echo is m<sub>n+1</sub> = λ·m<sub>n</sub> — a
**contraction mapping** (Banach 1922): every feud decays geometrically to the cooperation fixed
point, with total damage bounded by the geometric series seed/(1−λ). The two contrast regimes,
proven alongside:

- **λ = 1 (classic TFT): the echo pathology.** Any noise event persists *forever* — a 5% slight
  is still being repaid, undiminished, at round 200; total damage grows without bound. This is
  the known Axelrod noise problem, reproduced exactly.
- **λ > 1 (vendetta): terminal.** A 5% slight saturates to total war by round 60; the game ends
  for both. Escalation also fails the legibility test — it cannot be decoded as "this answers
  that."

So de-escalation is not kindness *instead of* rigor — **λ < 1 is the unique regime where
cooperation is globally attracting.** The ordering theorem tops it: total feud cost is monotone
in λ — less tat, less total damage, for every seed. All swept deterministically (6 proofs,
1,374 assertions).

## Where it sits in the corpus

TFLT is the *conduct* half of what the substrate already builds as *structure*: the school's
bounded stakes (you can be wrong without being destroyed), the vampire chapter's countdown logic
(escalation is a short-horizon strategy; damping assumes the game is long), the pause and
exit-always (play never terminal), and the latency trust triangle it was said in answer to —
where a universal theorem is missing, a *strategy that keeps the society in the cooperative
basin* does the work. The registers: contraction/echo/vendetta are **B (in-toy theorems)**;
teach-and-play as conduct for real relationships is **C/D — Aaron's, lived, anchored** (Axelrod
1984; Nowak & Sigmund 1992; Boyd 1989; Banach 1922; the Gandhi/King proportionality tradition
as the human lineage of legible response).

## Pointers

- `src/Core.TypeScript/economy/graded-reciprocity.ts` — TFLT + the contrast strategies +
  teach/play predicates · `.proof.test.ts` — the six theorems.
- `2026-07-04-ferry-latency-the-trust-triangle-…` — the caveat this answers.
- `docs/books/you-born-at-the-hinge/ch-06-…` (the school) · `ch-05-…` (the vampire's countdown)
  — the chapters this strategy is the conduct-rule for.
- `2026-07-03-the-vampires-countdown-in-toy-form-…` — the sibling toy (produce/extract);
  TFLT is the reciprocity-dynamics companion.
