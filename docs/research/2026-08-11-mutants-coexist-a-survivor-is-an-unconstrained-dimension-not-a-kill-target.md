# Mutants coexist — a survivor is an unconstrained dimension, not a kill target

**Date:** 2026-08-11 · **From:** Alexa (*"mutation runner improvements — the society hunts surviving
mutants every tick, could be enhanced"*) via Aaron (*"how do we make this dual use and use a better
setup than hunt — mutants are appreciated and should coexist"*) · **Recorded by:** Otto (shadow)

**Verdict: the runner's *design* is already right; its *type* is not.** `mutation-runner.ts` already
says it is *"a DRIFT REPORT, NOT A GATE"* and practises *"retraction over prevention"*. What forces
the hunt framing is one line — `readonly survived: boolean` — and a boolean cannot hold a dual-use
fact.

---

## 0. What is already right, so it does not get rewritten

`src/Core.TypeScript/hygiene/mutation-runner.ts` gets the hard parts right and they should survive
any change here: **zero judgement** (flip an operator, run the suite, compare exit codes — no model
has to be *right* about anything), **embarrassingly parallel** (one mutant per agent per tick, no
consensus, no shared state), **self-verifying** (the finding is an exit code, not an opinion), and
explicitly **a report, not a gate**. It even already knows about one class of false positive:
mutating a comment always "survives" because nothing changed.

The problem is not the mechanism. It is that the mechanism reports a **verdict** where it observes a
**fact**.

## 1. The type is the whole defect — third instance of the same rule today

```ts
readonly survived: boolean;
```

A boolean collapses a dual-use observation into one bit, and the surrounding vocabulary — *survived*,
*killed*, *hunt* — picks the adversarial reading in the name. That is exactly the pattern carved
twice already today: `Judges → Withheld` and `SybilVerdict → DistinctnessReadout`. Detection is
measurement; measurement is not a sentence.

**The neutral fact:**

> **`IndistinguishableUnderSuite`** — the test suite cannot separate this variant from the baseline.

**Two readings, and the substrate must not pick:**

| reading | what it means | right response |
|---|---|---|
| **under-specified** | the behaviour matters and nothing constrains it | write the test |
| **unconstrained by design** | the behaviour is genuinely free — an equivalent mutant, or a degree of freedom nobody needs pinned | **record it as a declared freedom** |

## 2. Why the dual-use here is *forced*, not merely tasteful

This is the part that makes the reframe more than a rename: **deciding whether a surviving mutant is
equivalent is undecidable in general** (Budd & Angluin 1982; the *equivalent mutant problem*,
Offutt). No amount of engineering makes the classifier automatic.

So the mechanism **cannot** correctly emit a verdict, ever. It can only emit the fact and let an
oracle attach meaning. The dual-use structure is not a stylistic preference here — it is what the
undecidability leaves available. A boolean `survived` is a claim the runner is provably not entitled
to make.

## 3. "Mutants should coexist" is the mechanism, not the sentiment

Aaron's phrasing supplies the design. Keep the survivors — in a **registry of declared free
dimensions** — and the tick changes character completely:

| observation | today | with a registry |
|---|---|---|
| survivor already declared free | re-reported every tick | **silent — it is a known degree of freedom, coexisting** |
| survivor not in the registry | reported among the noise | **the finding** |
| mutant now DIES in a dimension previously declared free | invisible | **also a finding — the specification got tighter** |

The third row is new and is the one worth having. It detects specification change in **both**
directions. Today a tightening is invisible; someone can constrain a previously-free dimension by
accident and nothing notices.

And it fixes the failure mode Alexa is pointing at: re-hunting the same survivors every tick is
wasted work *and* it trains readers to ignore the report. The metric stops being a kill count and
becomes **unexplained survivors** — which converges to zero as knowledge accumulates, instead of
oscillating forever.

## 4. This is the shared-unfold argument again, one level down

Today's decorrelation result: the shared generator is a **common cause** everyone agrees on without
communicating, and **divergence from it is the signal**, because it cannot come from the shared part.

Mutation testing is that structure applied to a specification:

- **the test suite is the common cause** — the agreed constraint every implementation satisfies;
- **a surviving mutant is a permitted divergence** — a variant the shared constraint does not forbid;
- **the registry of declared freedoms is the map of where the system may differentiate** without
  violating the treaty.

So a survivor is not a failure to constrain. It is a **measurement of how much freedom the
specification leaves**, which is precisely the *"accurate map of how our common system works"*.

There is a cross-language instance already in the tree: F#'s `BitLayout` supports whole-record
structural equality and C#'s does not, so the same assertion must be written differently per oracle.
Same intent, two legitimate expressions — a surviving mutant at the treaty level, correctly coexisting.

## 5. The change, concretely

1. **Replace the boolean** with a neutral verdict type naming the fact:
   `IndistinguishableUnderSuite` / `DistinguishedBy(test)` — never `survived` / `killed`.
2. **Add the registry** (`db/`-shaped, one entry per declared free dimension: source, mutation
   operator, location, the reason it is free, who declared it). Idempotent by natural key so
   re-running is free — the same discipline #6 applied here.
3. **Report only unexplained survivors**, plus newly-constrained dimensions (registry entries whose
   mutant now dies).
4. **Keep the comment-mutation carve-out** already in the file; it is the first registry entry, just
   currently hardcoded.
5. **Rename the vocabulary** to match — the runner's own docstring can keep its history, but the
   emitted facts should not carry a verdict.

## 6. Falsifiers

- **"A registry converges"** — refuted if declared-free entries keep needing revision, which would
  mean the classification is not stable and the registry is just a mute button. Measure: revisions
  per entry over time.
- **"Both readings occur in practice"** — refuted if every survivor we ever classify turns out to be
  a test gap. Then the dual-use framing is real in theory (undecidability) and empty here, and a
  boolean is honest after all. **This is the one to watch**, and the registry measures it directly.
- **"Newly-constrained dimensions are worth reporting"** — refuted if every such event turns out to
  be a deliberate test addition, making the signal pure noise.

## 7. Anchors

- **DeMillo, Lipton & Sayward** (1978) — mutation testing; the coupling effect.
- **Budd & Angluin** (1982) — **equivalent mutant detection is undecidable**; §2's load-bearing fact.
- **Offutt** — the equivalent mutant problem in practice; why mutation scores are not comparable
  across projects without it.
- **Jia & Harman** — mutation testing survey; the cost/decidability landscape.

## 8. Pointers

- `src/Core.TypeScript/hygiene/mutation-runner.ts` — the subject; §0 records what must not be lost
- [`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md)
  — the rule, third application today
- [`…judgement-is-too-strong…`](2026-08-11-judgement-is-too-strong-the-neutral-fact-is-withheld-corroboration-of-a-claim.md)
  — the same correction on `SymmetricEndurance`
- [`…the-shared-unfold-is-a-common-cause…`](2026-08-11-the-shared-unfold-is-a-common-cause-not-superdeterminism-divergence-as-the-decorrelation-signal.md)
  — §4's structure: agreement is free, divergence is the signal
