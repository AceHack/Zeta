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

> **Two senses of "retraction", do not merge them.** The runner's *"retraction over prevention"*
> above is the Z-set / drift-and-heal sense — correct after the fact rather than block before it —
> and it is right. It is NOT the same as retracting a freedom, which this design refuses outright:
> a declared freedom is **superseded** when the world changes, never pulled back
> (`mutation-freedoms.ts`; Aaron 2026-08-11). Same word, two senses, and the collision is worth
> naming because the first is a virtue and the second would be a betrayal.

## 2. Why the dual-use here is *forced*, not merely tasteful

This is the part that makes the reframe more than a rename: **deciding whether a surviving mutant is
equivalent is undecidable in general** (Budd & Angluin 1982; the *equivalent mutant problem*,
Offutt). No amount of engineering makes the classifier automatic.

So the mechanism **cannot** correctly emit a verdict, ever. It can only emit the fact and let an
oracle attach meaning. The dual-use structure is not a stylistic preference here — it is what the
undecidability leaves available. A boolean `survived` is a claim the runner is provably not entitled
to make.

### 2a. The precedent: Microsoft shipped an undecidable classifier as a REQUIRED gate

Aaron 2026-08-11: *"this is the halting problem — Microsoft has best heuristics for this in their
driver signing program. Rodney's Razor, and our Zeta scheduler pruning future branches based on time
and space Big-O, is my answer."*

Checked, and the precedent is sharper than the analogy needed. Microsoft's **Static Driver Verifier**
runs **SLAM** — predicate abstraction plus **CEGAR** (counterexample-guided abstraction refinement),
Ball & Rajamani — over third-party C drivers. Three facts from their own SLAM2 paper:

1. **They never solved the undecidability.** The paper states plainly that "the underlying problem
   CEGAR is trying to solve is undecidable" and that CEGAR "has **no termination guarantee**."
2. **They bounded resources and reported honestly.** "If it runs out of time or memory then the last
   counterexample generated is provably a false alarm" — resource exhaustion is surfaced as an
   unresolved result, not dressed up as a verdict.
3. **They drove the false-alarm rate down, and that is what made it gate-able.** SLAM1 reported
   **25.7%** false alarms; SLAM2 got under **4%** for WDM drivers — and that reduction is what "made
   it possible for SDV 2.0 to be applied as an automatic and **required quality gate** for Windows 7
   device drivers."

> **The transferable rule: an undecidable classifier becomes shippable not when it becomes correct,
> but when its false-alarm rate crosses a threshold and running out of budget is reported as
> *unresolved* rather than as a verdict.**

**Aaron's answer is the termination half**, and it is the part SLAM leaves to engineering: Rodney's
Razor (essential vs accidental — do not search branches that cannot matter) and the scheduler's
pruning of future branches by time/space complexity. That is precisely the resource bound that makes
an unbounded search terminate with an honest "unresolved".

**And §3's registry is the false-alarm half.** SLAM went from 25.7% to <4% by better abstraction; we
get there by **memoising the classification** — every declared free dimension permanently removes a
recurring false alarm. Same metric, different lever, and it is measurable per tick.

One boundary this precedent also draws, and it is worth respecting: SDV became a **required gate only
after** the false-alarm rate fell under 4%. Our own drift-and-heal ADR says detectors report and never
gate. Those agree — the mutation runner should stay a report until unexplained survivors are rare,
and the registry is what would earn it the right to be anything more.

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

### 3a. A THIRD reading, found by running it: the code is redundant

*(Added 2026-08-11 from the first live finding on `grammar-16-render.ts`.)*

§1 offers two readings — **under-specified** (write the test) and **unconstrained by design**
(declare it free). The first real finding was neither, and the gap matters because both of the
anticipated responses would have been wrong:

> **redundant** — the mutated guard is *masked* by another guard that decides the same thing.

Concretely: `firstSessionPending && world.nodeSession` appeared at two sites and was re-conjoined at
a third, but `isFirstSessionPending` **already implies** the session exists. Flipping the first
conjunction changed a local value that the third site's surviving guard then discarded. So the
mutant was indistinguishable — and would have stayed indistinguishable under *any* test, because
nothing observable depended on it.

Both anticipated responses fail here, in opposite directions:

- **Write the test** — impossible. I wrote one first; it passed against the mutant. A test cannot
  hold a guard that decides nothing. (The green suite did not reveal this; re-running the runner did.)
- **Declare it free** — dishonest. Nothing about the *specification* is free. Filing it would have
  memoised a duplication as a permanent degree of freedom, which is precisely the "registry is just
  a mute button" failure §6 names as the falsifier to watch.

The correct response is a **third action: remove the redundancy**, which converts an unobservable
dimension into an observable one. After collapsing the three guards to one named condition, the
test that previously could not fail now fails when the guard is dropped — verified by re-running the
mutation, not by the suite going green.

This is worth having in the grammar because it is diagnostically *stronger* than either alternative:
an indistinguishable mutant that resists both readings is evidence about the **code**, not about the
tests or the spec. A guard no test can hold is usually a guard that is not doing anything.

**Consequence for the readout:** the three responses are not a partition of one axis. Under-specified
and free-by-design are readings of the *specification*; redundant is a reading of the *implementation*
— which is why no amount of test-writing or declaring reaches it.

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
4. **Keep the comment-mutation carve-out hardcoded — it is NOT a registry entry.**
   *(Corrected 2026-08-11 during implementation; this item originally called it "the first registry
   entry, just currently hardcoded", and that was wrong in a way worth naming.)*

   Mutating a comment yields a **semantically identical program**. That is a fact about the mutation
   *operator*, true in every declarer's model of the code, and no honest reading disagrees with it.
   A declared freedom is the opposite kind of thing: a per-declarer **judgement** that a real
   semantic difference does not matter.

   Filing the comment case in the ledger would demote a universal truth to an opinion someone could
   contest, and would force every declarer to re-declare it independently — noise, and a category
   error. Two distinct kinds:

   | | what it is | who can disagree |
   |---|---|---|
   | **equivalent by construction** (comment mutation) | a property of the *operator* | nobody — it is not a mutant |
   | **declared free** | a reading of the *specification* | any declarer, legitimately |

   Same fact-versus-verdict boundary the whole file is about, one level down: some things are facts
   about the mechanism, not readings of the spec, and the ledger is only for the second.
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
- **Ball & Rajamani**, SLAM / **Static Driver Verifier**; **SLAM2: Static Driver Verification with
  Under 4% False Alarms** (FMCAD 2010) — the industrial precedent in §2a: CEGAR + predicate
  abstraction, undecidable and non-terminating by admission, shipped as a required Windows 7 gate
  once false alarms fell from 25.7% to <4%.
  <https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/slam-slam2_fmcad2010_final.pdf>
- **Clarke, Grumberg, Jha, Lu & Veith** — counterexample-guided abstraction refinement (CEGAR), the
  technique SLAM applies.
- **Rodney's Razor** (in-tree persona/rule) + the Zeta scheduler's complexity-bounded branch pruning
  — Aaron's termination bound, the half SLAM leaves to engineering.

## 8. Pointers

- `src/Core.TypeScript/hygiene/mutation-runner.ts` — the subject; §0 records what must not be lost
- [`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md)
  — the rule, third application today
- [`…judgement-is-too-strong…`](2026-08-11-judgement-is-too-strong-the-neutral-fact-is-withheld-corroboration-of-a-claim.md)
  — the same correction on `SymmetricEndurance`
- [`…the-shared-unfold-is-a-common-cause…`](2026-08-11-the-shared-unfold-is-a-common-cause-not-superdeterminism-divergence-as-the-decorrelation-signal.md)
  — §4's structure: agreement is free, divergence is the signal
