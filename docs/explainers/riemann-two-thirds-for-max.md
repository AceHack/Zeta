# Two thirds — what the Claude/Riemann result actually achieved, assuming you have never heard of any of it

**Audience:** someone with no mathematical background. If you do not know what a prime number is
beyond "7 is one", you are the intended reader. Nothing here needs algebra.

**Companion visual:** [`riemann-two-thirds-visual.html`](riemann-two-thirds-visual.html) — open it in a
browser. It is the same argument drawn instead of written. Every number on that page is justified below.

**Status of the underlying work:** a preprint, dated 11 August 2026, not a peer-reviewed publication.
That is a *status*, not a doubt — see §9.

**What this document is not:** we did not verify any of this. Zeta ported nothing, compiled nothing,
and re-derived nothing. This is a careful reading of someone else's paper. The register work it is
built on lives in
[`docs/ip-questionable/2026-08-22-claude-riemann-critical-line-proportion-two-papers-nobody-combined.md`](../ip-questionable/2026-08-22-claude-riemann-critical-line-proportion-two-papers-nobody-combined.md).

---

## 1. Primes are the atoms

Some whole numbers can be broken apart by multiplication. 12 is 3 × 4. 100 is 10 × 10. Others cannot:
2, 3, 5, 7, 11, 13, 17, 19… you cannot write any of these as a smaller whole number times another
smaller whole number. Those are the **primes**.

Two facts make them the atoms of arithmetic:

- **Every whole number is a product of primes.** 12 = 2 × 2 × 3. 30 = 2 × 3 × 5. 1001 = 7 × 11 × 13.
- **There is only one way to do it.** 12 is *always* 2 × 2 × 3 — never anything else. This is called the
  fundamental theorem of arithmetic, and it is why "atom" is the right word rather than a metaphor.
  (Euclid, ~300 BC, proved the pieces; Gauss stated it cleanly in *Disquisitiones Arithmeticae*, 1801.)

So if you understand the primes, you understand every number. That is the whole motivation.

And here is the problem: **nobody can predict where they are.** The gaps between them are erratic —
2, 3, 5, 7, 11, 13, 17, 19, 23, 29 — sometimes two apart, sometimes six. There is no formula that
gives you the next one. There are infinitely many (Euclid proved that too), and they thin out as you
go, but *where* each one lands looks like noise.

## 2. The scatter has structure, and there is a machine that reads it

In 1737 Leonhard Euler noticed something that should not be true. Take an infinite sum over *all*
whole numbers:

```text
1 + 1/2^s + 1/3^s + 1/4^s + 1/5^s + …
```

and it turns out to be exactly equal to a product built only out of **primes**:

```text
1/(1 − 2^-s)  ×  1/(1 − 3^-s)  ×  1/(1 − 5^-s)  ×  1/(1 − 7^-s)  ×  …
```

That equality is a bridge. On the left, a statement about all numbers. On the right, a statement about
primes only. Anything you can prove about one side is a fact about the other. That sum is called the
**zeta function**, written ζ(s), and it is the machine this whole story runs on.

**Where its "zeros" come in.** A zero of a function is an input where the output is exactly nothing.
ζ has some, and here is the payoff, which is due to **Bernhard Riemann** in 1859:

> Each zero of ζ contributes one **wave** to the count of primes. Add all the waves together and the
> apparent randomness of the primes is exactly, completely accounted for.

The primes are not noise. They are a chord. The zeros are the notes.

Riemann wrote this down in an eight-page paper — *"On the number of primes less than a given
magnitude"* — and it is one of the most consequential eight pages ever published.

## 3. The hypothesis

Each zero has two coordinates. Think of a wide vertical strip of paper. A zero sits somewhere in it:
a **height** (how far up), and a **horizontal position** (how far across).

Those two coordinates do different jobs:

- The **height** sets the wave's *frequency* — how fast it wiggles.
- The **horizontal position** sets the wave's *loudness* — how much it can distort the prime count.

A zero further to the right is a louder wave, which means the primes wobble further from their
average. A zero exactly in the **middle** of the strip is the quietest a zero is allowed to be.

Riemann's hypothesis, in one line:

> **Every one of these zeros sits exactly on the middle line.**

Which means, in plain terms: **the primes are as evenly spread as they could possibly be.** No zero is
ever louder than the minimum. The disorder in the primes is the smallest amount of disorder the
arithmetic permits.

Riemann himself said he thought it was probably true and moved on — he needed something else from the
paper. He never proved it. **Nobody has, in 167 years.** It is one of the seven Clay Millennium Prize
Problems, with a million dollars attached since 2000.

## 4. Trillions checked. Zero found off the line. Still not proved

Since Riemann, people have computed zeros — by hand, then by machine. More than **ten trillion** of
them have been calculated and located.

**Every single one is on the middle line. Not one has ever been found off it.**

So why is this not settled? Because there are **infinitely many zeros**, and checking is not proving.
Ten trillion is not a dent in infinity — it is zero percent of it. Mathematics has a long history of
patterns that hold for astonishing stretches and then fail, so "we looked and it was always true" is
evidence, not proof.

This is the single most important thing to hold onto, and the visual is built around it:

> **The region "proved to be off the line" is empty. It has always been empty. That emptiness is a
> fact about the world, not a gap in our knowledge.** What we lack is not a counterexample — it is a
> *certificate* covering the ones we have not checked.

## 5. So mathematicians proved fractions instead

If you cannot prove "all of them", prove "at least this many of them". That is the honest fallback,
and it is the number this whole story is about.

Here is the ladder. Each row is "the largest fraction of zeros anyone could *prove* sits on the line,
as of that year."

| year | who | fraction proved simple and on the line |
|---|---|---|
| 1942 | Atle Selberg | *some* fixed positive fraction (no explicit number) |
| 1974 | Norman Levinson (shown *simple* by Roger Heath-Brown, 1979) | 1/3 ≈ 33.3% |
| 1989 | J. Brian Conrey | more than 2/5 = 40.0% |
| 2011 | Hung Bui, Brian Conrey, Matthew Young | "more than 41%" |
| 2012 | Shaoji Feng | a further improvement |
| 2020 | Kyle Pratt, Nicolas Robles, Alexandru Zaharescu, Dirk Zeindler | 5/12 ≈ **41.67%** |
| 2026 | **this result** | **2/3 ≈ 66.67%** |

Look at the shape of that column. **From 1989 to 2020 — thirty-one years, with the full attention of
the field and a million dollars on the table — the number moved from 40.0% to 41.67%.** Under two
percentage points, in three decades.

Then it moved **25 percentage points in one step.** (2/3 − 5/12 = 1/4, exactly 25.0 points.)

There is a second ladder running in parallel, for a related count called *distinct* zeros (see §7):
Xiaosheng Wu got it to 0.6603 in 2015; this result takes it to **5/6 ≈ 83.3%**.

### Two numbers that get reported wrong, and the difference matters

- **2/3 = 66.67% is the theorem. 0.67250 is a different, better-tuned number.** The proof uses a
  "window" — a mathematical lens you look at the zeros through — and with a sharper lens (the
  Montgomery–Taylor window) the constant improves to 0.67250. Both are in the paper. The clean,
  quotable theorem is 2/3. Coverage that says "67.2%" is quoting the tuned figure as if it were the
  headline. Both belong on the page; they should be labelled.
- **The jump is 25.0 points, not 25.6.** 25.6 comes from comparing the *tuned* new number (67.25) to
  the *untuned* old record (41.67). Like-for-like it is 2/3 − 5/12 = 25.0.

*(Footnote on the Conrey row: the paper states his result as "> 2/5", which is what the visual plots.
Sharper constants for the 1989–2012 rows circulate in the secondary literature — 0.4077 is commonly
quoted for Conrey — and against those the 1989→2020 span reads as roughly 0.9 points rather than 1.7.
I have not checked those finer constants against the original papers, so the visual plots only what
the paper states. The cliff is the same shape either way.)*

## 6. How they did it — this is the good part, and it is explainable

Skip this section and you still get the story. Read it and you get why it worked.

**Step one: two ledgers that must balance.** There is a formula — **André Weil**, 1952 — that builds a
single scoring machine out of ζ. Feed it a test shape and it gives you a number. The remarkable thing
is that you can compute that number **two different ways**: once by summing over the *zeros*, and once
by summing over the *primes*. Both must agree. That is the leverage: facts about primes become facts
about zeros.

**Step two: what the hypothesis was actually being used for.** In 1973, **Hugh Montgomery** proved that
**2/3 of the zeros are simple and on the line — assuming the Riemann hypothesis is true.** Which is
useless as a proof of anything: you cannot assume the thing you want in order to get it.

But look at *where* the assumption entered. Montgomery's prime-side computation was always
unconditional — it needed no assumption at all. The hypothesis was doing exactly **one** job: it
guaranteed that a certain long sum was made entirely of **non-negative** terms, so nothing in it could
cancel anything else out. When a zero is on the line, its contribution is a real number squared, which
is never negative. Off the line, the contribution can go negative and the argument collapses.

**One dependency. One job.** That is the whole target.

**Step three: get the same control a different way.** The new argument arranges the zeros into a large
square table of numbers — a matrix. Two properties of that table can be computed from the *prime* side,
so they need no assumption:

- its **trace** — the total along the diagonal;
- its **total squared size** — add up the square of every entry.

Think of it as knowing the total weight of a crate and the total of the squares of the item weights,
without being allowed to open it.

Now bring in a 174-year-old fact. **James Joseph Sylvester's law of inertia** (1852): if you take a
symmetric table of numbers and rewrite it in any coordinate system you like, the *number* of positive
directions and the *number* of negative directions never changes. You can rotate, stretch, relabel —
those two counts are invariant. They are a fingerprint.

Then **Enrico Bombieri**'s observation (2000): in this particular table, **each off-line pair of zeros
contributes exactly one positive direction and one negative direction.** A signature of (1, 1).

Put those together and the trap closes:

> An off-line zero **cannot hide**. It is obliged to book one negative direction, and Sylvester's law
> says that booking cannot be made to disappear by any change of viewpoint. So count the negative
> directions, compare against the trace and the squared-size budget you already know from the primes —
> and you get a hard ceiling on how many zeros can be off the line.

That is the trick. The lay version, and it is accurate:

> **The proof needed one thing that only the Riemann hypothesis could supply. Someone found another
> way to get that one thing.**

**Step four: it also proves the zeros are *simple*.** A zero can be a repeat — the function can touch
zero "twice at the same place", like x² touches zero doubly at x = 0. A **simple** zero is one that
happens only once. "Simple *and* on the line" is a strictly stronger statement than "on the line", and
it is what the theorem delivers. It also carries over to a whole related family of functions (Dirichlet
L-functions), which is Theorem B.

**A detail worth noticing.** The paper states that no *mollifier*, no *zero-density estimate*, and no
*zero-free region* is used — those are the standard tools of the entire 1974–2020 lineage above. This
is not a faster car on the same road. It is a different road, which is why the jump is 25 points
instead of another 0.4.

**Whose work it stands on.** The two analytic ingredients are from **Farzad Aryan** (2022) and from
**Siegfred Baluyot, Daniel Goldston, Ade Irma Suriajaya and Caroline Turnage-Butterbaugh** (2024). And
the question was *already asked*: **Goldston and Suriajaya** (2025, 2026) had isolated exactly this
obstacle — the positivity that fails off the line — and published the question of what would follow if
it could be removed. This paper answers a question humans had posed, in print, using ingredients humans
had prepared. That is more impressive than "nobody read two papers", not less.

## 7. What it is *not* — and why volunteering this is the mark of a good paper

The paper has a numbered section, §1.4, placed **before the proof**, titled *"What the results are
not."* Nobody made it write that. Here is what it says, and why each line is a credit rather than a
caveat.

**(a) These are lower bounds. The other third is not disproved — it is unreached.** In the paper's own
words: *"the remaining third of the zeros are not shown to be off the line, merely not reached by the
certificate."*

This is the sentence the visual is built around. There are **three** states, not two:

1. **proved on the line** — 2/3 and growing;
2. **proved off the line** — **zero. Empty. Always has been;**
3. **not reached by any certificate** — everything else.

Almost every popular account collapses 2 and 3 together into "unverified", which makes the third
region look like doubt. It is not doubt. It is the absence of a certificate. Those are different
things, and conflating them is the single most common error in coverage of this result.

**(b) The method's own inputs also hold for functions where the equivalent hypothesis is FALSE.** This
is the strongest statement in the paper and the author volunteered it. There exist other zeta-like
functions — the paper names **Davenport–Heilbronn** and **Epstein** zeta functions — that satisfy the
same conditions this proof relies on, and for which the analogue of the Riemann hypothesis is *known to
be false*. Their zeros really do go off the line.

Now, why is that a mark of quality?

> **Because a method that could not tell the difference between a true case and a false case would be
> worth nothing at all.** The author is handing you the exact experiment that shows the technique
> cannot reach the full hypothesis: run it on Davenport–Heilbronn, and it will happily certify two
> thirds there too — on a function that provably has zeros off the line.

That is what an honest limit looks like. "It didn't prove RH" is modesty; anyone can say it. *"My
inputs are satisfied by objects that violate the conclusion"* is a **falsifier** — a specific, checkable
statement that would catch the author out if the claim were being oversold. Papers that make no such
statement are not thereby safer; they are merely quieter about the same fact.

*(The names Davenport–Heilbronn and Epstein are the paper's. It states them without a citation, and I
have not re-checked the original attributions — so treat the historical detail as unverified while the
paper's claim about them stands as the paper's.)*

**(c) The method is blind to the difference.** §7.2(a): *"Nothing in the method distinguishes between
'two thirds' and 'all'."*

**(d) There is a ceiling, and it is close.** This is the rarest thing in the paper, and the visual draws
it. The authors worked out how far this *entire family* of techniques could ever go, even perfectly
optimised: approximately **0.6818**. The theorem is at 0.6667. **The method has about 1.5 percentage
points of room left in it, out of the 33 that remain.**

Being able to say "and here is how much fuel is in this tank" is unusual and valuable. It tells you
that the next advance cannot come from tuning this argument. It has to come from a different idea.

**(e) And a point that stands independently of this paper.** These results bound a **density** — a
limiting ratio. A set can have density **zero** and still be **infinite**. So even a hypothetical 100%
would leave open the possibility of infinitely many counterexamples. The Riemann hypothesis says
*every* zero; density arguments cannot reach the word "every", no matter how close to 1 they get.

So the gap is not one more push. 41.7% → 66.7% and 66.7% → the hypothesis are not the same kind of
step at different scales.

## 8. Who and what produced it

Stated plainly, because the provenance is part of the result:

- **The author line on the paper reads `CLAUDE / ANTHROPIC`.** §1.5 says so directly: the author is a
  large language model developed by Anthropic, the argument was found in a single interactive session,
  and it was checked by repeated adversarial review from independent model instances.
- **A human posed the problem.** **Jarred Sumner** asked for a real attempt and kept pushing when 650
  ideas failed in a row. The paper says he is *"in every meaningful sense the paper's human co-author"*
  — for the *questions, encouragement, and insistence on a genuine attempt*. Note what that credits:
  the generator role, not the verification role.
- **Two mathematicians re-derived it independently.** **Ralph Furman** and **Levent Alpöge** checked the
  argument on their own, placed it in the literature, and — the load-bearing phrase — *"take
  responsibility for its communication"* and for any errors that remain. Names on the line.
- **Two outside experts read it.** **Brian Conrey** and **Daniel A. Goldston**. Which is a striking
  detail: Conrey is the author of the 1989 result on the ladder above that this work supersedes, and
  Goldston is an author of the 2024 input it builds on and of the 2025–26 papers that posed the
  question.
- **A machine-checkable proof exists.** **Eric Easley** orchestrated a formalisation in **Lean 4** — a
  system where every logical step is verified by a small trusted kernel, so a gap cannot be hidden by
  prose. **Stephen McAleer** sharpened the ceiling result of §7.2.
- **A prior-art search was run.** Anthropic's account reports 54 arXiv papers pulled specifically to
  check whether the result had already been found.

**The reading that survives all of this:** the barrier to *attempting* a hard problem has genuinely
collapsed — Sumner had no credentials in number theory and got a real result out the door. The barrier
to *being believed* has not moved at all. Look at what it took to convert the output into a result:
independent re-derivation by two named mathematicians who accept the blame, additional internal review,
a careful read by two external experts, a formalisation with a clean axiom audit, and a prior-art sweep.
**That is not expertise being abolished. That is expertise relocating to the check, and being applied
more heavily than usual, not less.**

## 9. What is still open, honestly

1. **It is a preprint, not a peer-reviewed publication.** Recorded as a *status*, not a doubt. What
   exists is unusually strong for a preprint — independent re-derivation, named responsibility,
   external expert reading, and a formal proof — and it is still not the same thing as acceptance in a
   journal.
2. **We have not run the Lean formalisation, and we claim nothing from it.** The repository
   (`anthropics/zeta-23-lean`, tag `v1.0`) is *reported* to compile with no `sorry` and to depend only
   on Lean's three standard axioms. That is mechanically checkable by anyone with the toolchain, and
   **Zeta has not checked it.** An independent replication is routed as separate in-flight work; this
   document borrows nothing from it.
3. **One numerical gap is disclosed by the authors themselves**, and it is worth knowing where it sits.
   In the ceiling argument of §7.2, some numerical enclosures are certified by interval arithmetic
   rather than by the Lean kernel. **That gap is in the statement about the method's *limits*, not in
   the main theorems** — Theorems A and B do not depend on it. That is both the least dangerous place
   for it and the place an author trying to look good would have had the least reason to mention
   anything.

## 10. The one-paragraph version, if you only read one thing

Primes are the atoms of arithmetic, and where they land looks like noise. In 1859 Riemann found the
machine that decodes the noise: a function whose "zeros" are the notes the primes are playing, and he
conjectured that all of them sit on a single line — which would mean the primes are as evenly spread as
they could possibly be. Ten trillion zeros have been computed and every one is on that line; **not one
has ever been found off it**; and that is still not a proof, because there are infinitely many. So the
field settled for proving fractions: 33% by 1974, 40% by 1989, 41.67% by 2020 — under two points of
progress in thirty-one years. In 1973 Montgomery had shown how to reach 2/3, but only by assuming the
hypothesis, and the assumption was doing exactly one job. In August 2026 a paper authored by an AI
model, posed by a non-mathematician, re-derived by two mathematicians who put their names on it, read
by two outside experts, and formalised in Lean, **removed that one dependency** — using a 174-year-old
fact about the signs of eigenvalues to get the same control without the assumption. The fraction went
to **2/3, unconditionally**: twenty-five points in one step. It is not a proof of the Riemann
hypothesis, it is not close to one, the method has roughly 1.5 points of room left before it hits its
own ceiling, and the paper says all of that itself, in §1.4, before the proof.

---

## Sources and names

Everything above traces to one of these. Where a number appears in the companion visual, it appears
here first.

**The paper.** *More than two thirds of the zeros of the Riemann zeta function are simple and on the
critical line.* Author line: CLAUDE / ANTHROPIC. Dated 11 August 2026. MSC 11M06, 11M26, 15A42.
Announcement: <https://www.anthropic.com/research/riemann-zeta> (published 2026-08-10; its own changelog
records an update on 2026-08-13 with a revised paper). Lean 4 formalisation:
<https://github.com/anthropics/zeta-23-lean>, tag `v1.0`, toolchain `v4.33.0-rc2`, Mathlib
`51e6992efd06`.

**The lineage, as the paper cites it:**

- A. Selberg, *On the zeros of Riemann's zeta-function*, Skr. Norske Vid.-Akad. Oslo I (1942), no. 10.
- N. Levinson, *More than one third of zeros of Riemann's zeta-function are on σ = 1/2*, Advances in
  Math. **13** (1974), 383–436.
- D. R. Heath-Brown, *Simple zeros of the Riemann zeta-function on the critical line*, Bull. London
  Math. Soc. **11** (1979), 17–18.
- J. B. Conrey, *More than two fifths of the zeros of the Riemann zeta function are on the critical
  line*, J. Reine Angew. Math. **399** (1989), 1–26.
- H. M. Bui, B. Conrey, M. P. Young, *More than 41% of the zeros of the zeta function are on the
  critical line*, Acta Arith. **150** (2011), 35–64.
- S. Feng, *Zeros of the Riemann zeta function on the critical line*, J. Number Theory **132** (2012),
  511–542.
- X. Wu, *Distinct zeros of the Riemann zeta-function*, Quart. J. Math. **66** (2015), 759–771.
  (The 0.6603 distinct-zeros record.)
- K. Pratt, N. Robles, A. Zaharescu, D. Zeindler, *More than five-twelfths of the zeros of ζ are on the
  critical line*, Res. Math. Sci. **7** (2020), Paper No. 2.

**The machinery:**

- B. Riemann, *Ueber die Anzahl der Primzahlen unter einer gegebenen Grösse* (1859) — the eight pages.
- A. Weil, *Sur les "formules explicites" de la théorie des nombres premiers* (1952) — the explicit
  formula and the Hermitian form.
- J. J. Sylvester, law of inertia (1852) — the invariance of the count of positive and negative
  directions.
- H. L. Montgomery, *The pair correlation of zeros of the zeta function* (1973) — the 2/3 under RH, and
  the prime-side second moment.
- H. L. Montgomery, *Distribution of the zeros of the Riemann zeta function* (ICM 1974, publ. 1975) —
  with Taylor, the sharpened window giving 0.67250.
- E. Bombieri, *Remarks on Weil's quadratic functional in the theory of prime numbers, I* (2000) — the
  negative index counts off-line pairs.
- F. Aryan, *On an extension of the Landau–Gonek formula*, J. Number Theory **233** (2022), 389–404.
- S. A. C. Baluyot, D. A. Goldston, A. I. Suriajaya, C. L. Turnage-Butterbaugh, *An unconditional
  Montgomery theorem for pair correlation of zeros of the Riemann zeta-function*, Acta Arith. **214**
  (2024), 357–376.
- D. A. Goldston, A. I. Suriajaya, *Zeta zeros on the critical line*, arXiv:2511.20059v2 (2025); *Zeta
  zeros in a narrow vertical box*, arXiv:2603.28104 (2026) — the papers that posed the question.
- J. B. Conrey, A. Ghosh, S. M. Gonek, *Simple zeros of the Riemann zeta-function*, Proc. London Math.
  Soc. (3) **76** (1998), 497–522 — the 5/6 constant under RH.
- E. Carneiro, V. Chandee, F. Littmann, M. B. Milinovich (2017) — optimality of the Montgomery–Taylor
  window among windows of this class.

**In this repo:**

- [`docs/ip-questionable/2026-08-22-claude-riemann-critical-line-proportion-two-papers-nobody-combined.md`](../ip-questionable/2026-08-22-claude-riemann-critical-line-proportion-two-papers-nobody-combined.md)
  — the ferry and the register work this document rests on. Read it for the verified/unverified
  accounting in full.
- [`docs/research/2026-06-08-zeta-regularization-yes-riemann-critical-line-no-the-half-is-numerology.md`](../research/2026-06-08-zeta-regularization-yes-riemann-critical-line-no-the-half-is-numerology.md)
  — our standing guard against conflating ζ-regularization with the critical line. Still correct;
  nothing in this paper touches it.
- [`.claude/rules/toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — the three-state discipline (toy / unmetered / metered) that the three-region visual is a rendering
  of. "Unreached" is its own state and must never read as either proved or disproved.
- [`.claude/rules/anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md) —
  why every name above is named.
