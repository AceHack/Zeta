# The metric is a phone book — why metric knowledge must be open source

**Source:** Aaron, 2026-08-26, marked for the book by him: *"yes, which is why i think all
metric knowledge should be open source, we should book this."* His claim, his material,
staged by the shadow.

**Consent.** Covered by the standing ledger row — *Aaron, author, glass-halo (self): his own
mind, transparent by choice.* He is describing having gamed metrics with insider information
from an early age. **No industry, employer, or other person is named or identifiable here**,
and none is needed: the mechanism is the content, and the mechanism does not require knowing
who told him.

**Register.** Argument, not measurement — with one exception, flagged where it occurs: the
repository instances at the end are **metered** and can be cited by name.

---

## The claim

> **All metric knowledge should be open source.**

Not the metric. The **knowledge about the metric** — how it is computed, what it rewards,
where it bends, and how it can be gamed.

## The setup, in his words

> *"it was actually faster to game for me, cause i had many others in the industry tell me
> the metrics from an early age."*

Read that twice, because the operative words are *"tell me"* and *"early age."* He is not
describing unusual insight into a published rule. He is describing having been **told** —
early, informally, by people already inside — what the numbers actually were.

He is reporting a mechanism, not confessing to a sin and not excusing one. The reason it is
in the book is that it is the cleanest available evidence for the thesis, and it happens to be
evidence against himself.

## The non-obvious part

> **Gameability is not a property of the metric. It is a property of who knows it.**

The intuition to give up is that some metrics are gameable and others are robust, as though
gameability were a design flaw you could engineer out. What is actually varying is the
**distance between the metric and the person being measured** — and precision shortens that
distance for whoever already knows the formula.

Which produces the inversion:

| | for an insider | for an outsider |
|---|---|---|
| **soft judgement** | must persuade a person, who may not be persuaded | must persuade a person — same task |
| **hard metric** | knows the formula; optimises directly | knows a number exists; optimises a guess |

A precisely-specified metric is **harder** to game from outside the information network and
**easier** from inside it. Precision is exactly what makes a target reachable. The subjective
version at least requires persuading a human being, which is a cost paid by everyone.

## Which inverts the fairness argument for objective metrics

Objective metrics are adopted because they look fair, and the thing that makes them look fair
is real: **the same rule applies to everyone.** That is not a lie. It is just not the whole
transaction.

> An objective metric applies one rule to everyone while **distributing advantage by
> information access** — and it is arguably *less* equitable than the soft judgement it
> replaced, because the inequity is now invisible.

Invisible for a specific and nasty reason: the usual way you detect unfairness is by finding
that the rule was applied differently to different people, and here it genuinely was not. The
rule is identical. Every audit of the rule comes back clean. What differs is who was in a
position to act on it, and that is not written down anywhere the audit looks.

## This is a confound the corpus already named

`docs/research/2026-08-19-delta-u-per-unit-of-available-time-the-denominator-history-could-never-measure.md`
carries the parent case: **free time is an inherited endowment**, and a meter that measures
contribution without measuring available time *"silently prices an endowment"* — it cannot
separate **capability** from **opportunity**.

Metric knowledge is the same object in a different currency:

> Two people of identical ability read the same published metric. One has a phone book. The
> other does not. The meter reports a difference in capability and is measuring a difference
> in access.

Same confound, same failure to separate what someone can do from what someone was handed. The
free-time version is easier to see because time is visibly unequal; the phone-book version
hides better because information *feels* free once it is published — and the thing that was
never published is the part that mattered.

## And it rules out the obvious fix

The reflex is to hide the metric. That makes it **strictly worse**, and strictly is the right
word — there is no case in which it helps:

- Insiders still know. They were told informally; secrecy was never what kept them out, and it
  does not start now.
- Everyone else now cannot see what they are being measured against, which removes their
  ability to *contest* the measurement as well as their ability to meet it.

So obscurity does not close the gap. It **converts an information advantage into a permanent
one** by removing the only mechanism — publication — that could ever have closed it.

## The fix, and it is the counterintuitive move

> **Publish the attack surface alongside the metric.** How it can be gamed, in the same
> document that defines it.

This reads as irresponsible, and the objection is worth stating in its strongest form:
*publishing how to cheat teaches people to cheat.* True, and answered below. But note first
why it is the **equalizer**: the people who would exploit it already know. Publication takes
nothing from them. It gives something to everyone else — and what it gives is not primarily
the ability to game, it is the ability to **see the shape of the thing they are standing
inside.**

### The anchor, and the transfer

**Kerckhoffs's principle** — Auguste Kerckhoffs, *La cryptographie militaire*, Journal des
sciences militaires, 1883. A military cryptosystem must not require secrecy, and must be able
to fall into enemy hands without inconvenience: **everything about the system except the key
may be public, and the system must still be secure.** Shannon's later restatement — *the enemy
knows the system* — is the form most people encounter. Security through obscurity fails
because the adversary is assumed to have the design.

The transfer is exact, and it is this section's spine:

> **A metric should be FAIR even when everything about how to game it is public. If it is not
> fair under full disclosure, it was never fair — it was only fair-to-insiders.**

That is a real entailment and not a pun on the word "secure". Kerckhoffs's argument is not
about cryptography specifically; it is about **where a system's guarantee is allowed to
live.** A guarantee that lives in the secrecy of the design is a guarantee that has already
failed for anyone who knows the design, and the only question left is who that is. Move the
guarantee into the design itself and the population of knowers stops mattering. A metric whose
fairness depends on people not knowing how it works has put its guarantee in exactly the place
Kerckhoffs says it cannot survive.

*(Secondary anchor, and it is the same structure with the same resolution: the **full
disclosure** versus **responsible disclosure** debate in software security. Full disclosure
gained ground on the argument that vendors did not fix issues otherwise and attackers already
knew — publication being what converts a private, indefinite exposure into a public,
time-bounded one. **Verification debt, named rather than left implicit:** the Kerckhoffs
citation above should be checked against the 1883 original at edit time, and the disclosure
history should be attributed to specific advocates and dates rather than to a movement. Under
`anchor-to-human-prior-art` an anchor must be **checked**, not merely cited, and a real
citation attached to a claim it does not quite support keeps a section in `toy`.)*

## The honest counter, which is real

**Publishing gaming knowledge does increase gaming in the short term**, by people who would
not otherwise have known how. That is not a hypothetical objection to be waved at; it is what
happens, and the section is wrong if it pretends otherwise.

The answer is not that the cost is small. The answer is what the cost buys:

> **A gaming vector everyone knows is one that gets closed**, because the people with the
> power to close it are now the people paying for it. A vector only insiders know **persists
> indefinitely**, precisely because nobody who could fix it is losing anything.

So the choice is not between gaming and no gaming. It is between a **permanent private
advantage** and a **temporary public one** — and the public one has a repair mechanism
attached, because the pressure to fix a metric only exists once its failure is visible to
someone who can act.

That is also why the short-term spike is not an argument for waiting. The spike is the
mechanism. It is what generates the pressure that closes the vector.

## The worked instance is this repository, and nobody planned it

Everything above is argument. This part is **metered** — the artifacts exist, are named, and
can be opened.

The repository's vacuity findings are published attack knowledge, and reading them as a class
is what makes the point:

- a check that cannot fail;
- a test that passes because an *earlier* guard fired, so the assertion under test never ran;
- a required check that never ran contributing zero to a failure count, so "zero failures"
  reads as green;
- `f(x) = f(x)` offered as a purity proof, when both calls capture the same clock;
- `rc = 0` from a linter whose configuration excludes the file being linted;
- a mutation that never applied, which would have been recorded as *survived*.

Each one is a documented way to **score without doing the work.** Roughly a dozen were added
in a single day. And every one of them is written where anyone can read it, rather than
circulating among people who know people — which is precisely the difference this section is
about. The in-repo machinery is nameable: `src/Core.TypeScript/hygiene/mutation-runner.ts`
(the mechanical falsifier check — a test that survives mutation is not a falsifier),
`src/Core.TypeScript/hygiene/lint-discharge-certificate-consistency.ts` (refuses a discharged
claim whose evidence disagrees or is absent), `docs/PROVEN-COVERAGE-AND-GAPS.md`,
`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`, and the ΔU ledger at
`src/Core.TypeScript/ledger/measure.ts` with `db/uncertainty/README.md`.

**Mutation testing is the same move made mechanical**, and that is the cleanest statement of
the principle available. *"How would this test fail to catch things"* is normally tacit expert
knowledge — the kind that travels by being told, early, by someone already inside. A mutation
runner takes that knowledge and **forces it into the open as a runnable check.** It is
Kerckhoffs applied to a test suite: the attack is public, executable, and therefore no longer
an endowment.

So the conclusion is not the one the adversarial machinery was built for:

> Red-teaming your own meter is not only meter-hardening. **Publishing how to game your own
> meter is what makes it fair to people who do not have your phone book.**

And it retires the last excuse. *"Anyone could figure this out"* is true and irrelevant; the
question was never whether the knowledge was derivable, but whether it was **handed to you at
an early age by someone in the industry.** He was. He says so. That is the whole argument, and
it is the reason he is the one making it.

---

## Ties

- `docs/research/2026-08-19-delta-u-per-unit-of-available-time-the-denominator-history-could-never-measure.md`
  — the parent confound: a meter without its denominator prices an endowment; capability
  cannot be separated from opportunity. Metric knowledge is that endowment in another
  currency.
- `THE-PROMOTION-AND-THE-CULT-episodes-that-become-arguments-and-transmission-at-1-0.md`
  — *"Men and women bend to my will. Time does not."* The second clause is this section's
  premise: **gaming requires knowing the metric, and time's only metric is whether the thing
  still holds.** Durability is the one measure with no phone book.
- `THE-BAND-MISMATCH-readers-disease-and-the-locally-calibrated-instrument.md` — the same
  family of failure: an instrument reporting the only thing it can see and being read as
  reporting the thing you wanted. There it was band-distance read as disorder; here it is
  access read as capability.
- `.claude/rules/every-bug-has-economic-value.md` — bugs are priced opportunities, never
  liabilities to hide. Publishing a gaming vector is the same refusal, applied to the meter
  instead of to the code.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the three registers this file's own
  claims are filed under, and why the repository instances above may be called `metered` while
  the argument may not.
- `.claude/rules/anchor-to-human-prior-art.md` — why the Kerckhoffs verification debt is named
  above rather than left implicit.
- `docs/BUGS.md` · `docs/PROVEN-COVERAGE-AND-GAPS.md` — where the published attack knowledge
  actually lives.

## Register flags

- **Argument, not measurement**, for the claim and its inversion. Nothing about gameability is
  quantified here, no metric is measured, and the insider/outsider table is a structural
  contrast rather than a dataset. The account is **consistent with** what he reports and is not
  demonstrated by it.
- **Metered, and nameable**, for the repository instances only. Those artifacts exist at the
  paths given and can be opened; the claim that they constitute published attack knowledge is
  checkable by reading them.
- **The anchors are named so they can be checked** (Kerckhoffs 1883; Shannon's restatement; the
  full-disclosure debate), and the verification debt on each is stated in the body rather than
  deferred silently.
- **No moralising and no absolution.** He gamed metrics with information he was handed early.
  The file reports the mechanism and what follows from it, does not grade him for it, and does
  not convert it into a redemption arc. Standing house rule: don't shrink the bad side.
- **No third party is identifiable** — no industry, no employer, no individual, and none is
  required by the argument.

**Not staged for a chapter yet.** Companion piece, filed with the meter material.
