# CHIP-8 time dilation already exists as "fast-forward through recurrence" — λ does not predict the skip, and a hole is what manufactures the orbit

**Date:** 2026-08-15 · **Agent:** shadow · **Registers:** `metered` (the measurements), `unmetered` (the
precondition argument for the existing CHIP-8 caller), *coincidence, unpromoted* (Task 2's mapping).

Aaron 2026-08-15:

> *"in CHIP-8 we have time dilation where if it detects periodic or quasi time-crystal it gets 'bored'
> and time shrinks or flies by, because it's just repeated zombie actions that require no intelligence.
> Actions requiring intelligence are what make time go slower."*

and, separately:

> *"I'm pretty sure this is similar to hitchhiker tree holes and the data structure that is not there —
> Strange Loop talk. We have those Strange Loop conference videos saved somewhere in this repo, and I
> think the holes they leave lead to orbits around existing structure."*

The first is **built**, under a name nobody was grepping for. The second is **half right in an
interesting way**, and the interesting half is not the half it was aimed at.

***

## 0. Corrections to the framing I was handed

Flagged explicitly, per the brief.

* **PR #10834 is still OPEN, not merged.** Its files — `src/Core/TangleNavigator.fs` and the
  `navigating-the-chaotic-regime` doc — are **not on `origin/main`**, so its finding that "nothing
  consumes `Orbit.classify`" cannot be re-verified against a merged baseline. It re-measures as still
  true at main. This work branches from `main` and deliberately does **not** build on
  `TangleNavigator.fs`, to avoid designing against an in-flight sibling.
* **"The hole is one function, `Orbit.Kind -> int64`" is the wrong shape**, and the measurement below is
  why. `Orbit.Kind` is not the input that determines a skip; `SchedulerZeta.Recurrence` is. See §2.
* **"The skip factor should relate to measured `Orbit.largestLyapunov` / `BraidEntropy.growthRate`"** —
  tested, and it **does not**. §3. That is the falsifier doing its job, and it is the main result.
* **The talk title is "Data Structures: The Code That Isn't There"** (Scott Vokes, Strange Loop 2012),
  not "the data structure that is not there." Near miss, verified against the stored deck capture.
* **Hitchhiker trees have buffers, not holes** — and this repo's own prior ferry draws that contrast
  explicitly. §5.

***

## 1. The mechanism exists, and it is not called dilation

Searching by behaviour rather than vocabulary (a variable step / a tick-skip / anything that decides how
far to advance) lands on one function:

> `SchedulerZeta.runToHorizon` — *"FAST-FORWARD through detected recurrence … Work is O(reachable),
> independent of how large `horizon` is — the scheduler stops re-simulating a config it has proven
> periodic."*

That is Aaron's sentence, in the source, since the Artin–Mazur scheduler-zeta work. It is not a
proposal: `tests/Tests.FSharp/SchedulerZeta.Tests.fs` runs **one billion CHIP-8 frames** of a period-4
ROM in O(reachable ≈ 5) work. Predictable ⇒ compressible ⇒ skippable, implemented and load-bearing.

Three things about it are worth stating precisely, because they are what the "one function" framing
missed:

1. **It is exact, not a factor.** For a recurrent orbit it does index arithmetic, so it is *lossless* and
   the skip is *unbounded*. A tuned `Kind -> int64` multiplier would be strictly worse: lossy where this
   is exact, and bounded where this is not.
2. **It already does the right thing in the chaotic regime — nothing.** An aperiodic orbit never repeats
   a key, so the fast-forward never fires and the run pays full price per tick. "Actions requiring
   intelligence are what make time go slower" is not a policy that had to be written; it is what
   recurrence-detection does when there is no recurrence.
3. **Nothing consumes `Orbit.classify` / `classifyDynamics`.** Re-verified at current `main`: the only
   hits outside `Orbit.fs` itself are its own tests and one docstring cross-reference in
   `PhasePortrait.fs`. So the *classifier* is genuinely unconsumed — but the *behaviour* the classifier
   was wanted for is not missing.

What was absent is the **measurement**, which is the falsifiable half. That is what this PR adds.

***

## 2. The dilation factor is derived — `horizon ÷ recurrence length`

`tests/Tests.FSharp/TimeDilation.Tests.fs` wraps `step` in a call counter and divides the simulated
horizon by the work actually performed. Nothing is hand-tuned; the factor is a quotient of two counted
quantities, read off the run. Horizon = 20 003 (deliberately not a multiple of any period in play — a
horizon that lands on a joint period makes a wrong fast-forward look right, which it did twice while
this was being written).

| orbit class | dynamics | λ (measured) | work | **achieved dilation** |
|---|---|---|---|---|
| `Fixed` | `x ↦ x` | 0.000000 | 1 | **20 003** |
| `Crystal 4` | `x ↦ (x + ¼) mod 1` | ≈3e-8 | 4 | **5 000.75** |
| `Quasiperiodic` | golden-ratio rotation | −0.000000 | 20 004 | **0.99995** |
| `Chaotic` | logistic, r = 4 | **0.693494** | 20 004 | **0.99995** |

All four are float maps so that one λ meter covers all of them; `x ↦ (x + ¼) mod 1` is exact in binary
floating point, so no tolerance is smuggled in. λ for the logistic map metered at 0.693494 against the
exact value ln 2 = 0.693147.

**The identity that holds exactly:** achieved dilation = `horizon / Recurrence.Reachable`, and
`Recurrence.Reachable` = `Transient + Period` is exactly the counted work. That is a derived factor with
a falsifier: it is checked against counted `step` invocations, not asserted. `SchedulerZeta.predict`
already returns it.

**Two honest costs, stated rather than rounded:**

* Off the periodic classes, dilation is **strictly below 1** — `runToHorizon` pays one wasted step plus
  O(horizon) memory to prove there is no cycle. "No speedup" would have been the flattering reading.
* `predict` is **unbounded on an aperiodic map** — it iterates until a projected state repeats, which
  for a float key means never in practice. Only `runToHorizon` is horizon-bounded and therefore safe to
  point at arbitrary dynamics. The tests call `predict` on recurrent cases only, on purpose.

***

## 3. The falsifier: λ does not predict the skip

The claim under test was that the skip factor should relate to the largest Lyapunov exponent. It does
not, and it fails in **both** directions, which is what makes it a refutation rather than a weak fit:

* **Same λ, different dilation.** `Fixed` and `Crystal 4` both meter at λ = 0 to within 1e-6 — the
  exponent cannot separate them — yet their dilation differs by exactly 4×, the ratio of their cycle
  lengths.
* **Different λ, same dilation.** `Quasiperiodic` and `Chaotic` are separated by λ ≈ ln 2, the largest
  gap in the set, and their dilation is **identical to the last bit** (same work, same quotient).

So λ neither discriminates within the dilatable pair nor within the non-dilatable pair. The quantity that
determines a lossless skip is **recurrence length**; λ is a **divergence rate** and is blind to it in
both directions.

This is not a claim that λ is useless here — it is a claim about *which* dilation it meters. λ is the
right meter for a **lossy** skip (how long until two states agree to within ε, which is what a
contracting system buys you); it is the wrong meter for the **lossless** one. That distinction is not
implemented and is not proposed here — a lossy skip is a policy with an error budget, and it belongs to
whoever owns that seam.

***

## 4. The correlated-set observable, carried from the start

PR #10834's closing note — escape tooling *"should carry the correlated-set observable from the start;
adding it after the fact means every earlier number was a best case"* — applies to dilation, and it paid
for itself immediately.

Probe: a two-part system where part A is a period-4 rotation and part B accumulates A's value with
coupling `c` (prime modulus, so B's return is not an artifact of the horizon). "Unilateral dilation" =
project B out of the key, exactly the move `chip8Key` makes when it drops Mem/Display.

| coupling | key | work | dilation | result | correct? |
|---|---|---|---|---|---|
| **0** (control) | part A only | 4 | 5 000.75 | (3, 0) | **yes** |
| **0** (control) | joint | 4 | 5 000.75 | (3, 0) | yes |
| 1 | part A only | 4 | **5 000.75** | (3, **3**) | **NO** |
| 1 | joint | 3 988 | **5.016** | (3, **93**) | yes |

Two findings, and the negative control is exact in both:

1. **The dilator's own view is blind to what dilation costs.** Measured from part A, the factor is
   byte-identical at both couplings. The ~997× collapse in real dilation is invisible from the side doing
   the skipping. This is the same shape as #10834 §4a's result about escape — the cost lands on the
   correlated set and does not appear in the escapee's meter.
2. **Unilateral dilation is silently wrong.** With a lossy key, `runToHorizon` returns a state that is
   stale in the projected-out component — no exception, no diagnostic. It is right about the part it
   watched and wrong about the part it did not.

### The precondition this exposes (a repair, not an accusation)

`runToHorizon`'s docstring stated *"Equal to the naive `stepⁿ start` for every `horizon` (the
guarantee)"* **unconditionally**. The guarantee is real but **conditional**: it requires `key` to be
injective on the reachable set — nothing projected out may carry state forward. The docstring now says
so, and names the test that measures the failure. No behaviour changed.

The existing CHIP-8 caller **satisfies** the precondition — its ROM writes no memory, touches no display,
and never ticks the timers — but it satisfies it by **argument, not by check**: the test compares
`chip8Key near` with `chip8Key far`, i.e. two *projections*, so it would pass whether or not the full
state were right. That is a sound caller with an unmetered justification, and it is labelled as such
rather than upgraded.

***

## 5. Task 2 — the structural-holes connection, triaged

### What is actually in the repo

Both talks are stored, and they are **two different talks by two different speakers**:

* `docs/research/ip-questionable/2026-06-07-david-greenberg-hitchhiker-trees-functional-fractal-bplus-verbatim-transcript-aaron-forwarded.md`
  — David Greenberg, *"Exotic Functional Data Structures: Hitchhiker Trees"*, Strange Loop ~2016.
  Verbatim transcript plus a framework-composition analysis. The lineage is BST → B-tree → B+ tree →
  fractal tree (Bε-tree, Bender/Farach-Colton/Kuszmaul) → Hitchhiker tree = **a path-copying fractal
  tree**.
* `docs/research/ip-questionable/2026-08-01-scott-vokes-data-structures-the-code-that-isnt-there-difference-lists-holes-rolling-hash-aaron-forwarded.md`
  (plus a 637-line spoken transcript alongside it) — Scott Vokes, **"Data Structures: The Code That
  Isn't There"**, Strange Loop **2012**. Ferried by Aaron 2026-08-01 with *"I found the holes data
  structure in this talk."* Gordon Bell's *"the cheapest, fastest, and most reliable components are
  those that aren't there"* is the title's source.

### The correction that matters for the triage

**Hitchhiker trees do not have holes.** They have **buffers**, and this repo's own Vokes ferry already
draws the contrast in a table — buffers hold *pending operations*, cost real storage, and must be
drained; a hole is *nothing*, an unbound variable, free, and "it isn't there — which is the point."
"Hitchhiker tree holes" fuses the two mechanisms the earlier ferry was at pains to separate. The holes
are the **difference lists** in the Vokes talk (an unbound logic-variable tail; append is *binding the
hole*, O(1), visible to every existing holder at once).

### Does a hole induce an orbit around existing structure?

Triaged against `numerology-vs-number-theory.md` — a shared shape is a **generator**, never a
**conclusion**, and the register is stored with the entry.

**The disqualification is clean, and it uses this repo's own definition of an orbit.** An orbit is
**recurrence**: `s = stepⁿ s` (`Orbit.period`). Buffered operations in a fractal/Hitchhiker tree
**strictly descend** — depth is a monotone potential and every op terminates at a leaf. There is no
recurrence, so there is no orbit. A difference-list hole does better: binding a hole creates a *new hole
of the same shape*, so the hole is invariant under append. But the *structure* never returns — it grows.
That is a **fixed point / coinductive invariant (shape A, `s = f(s)`)**, not a periodic orbit.

Under `Orbit`'s own taxonomy that lands the hole at `Fixed` — period 1, the stationary mode — which is
the class with *maximal* dilation in §2's table. So there is one honest bridge: **a hole carries zero
information per operation** (it is the same hole after every append), which is exactly "predictable ⇒
compressible ⇒ skippable." But "both are fixed points of their own step" is a shared *property*, not a
shared *mechanism*, and it fails the discrimination test — nearly every structure with an invariant has
it. **Verdict: (b) suggestive, unpromoted.**

**Named promotion condition:** exhibit a structure whose *holes recur with period n > 1* — a hole whose
binding returns the structure, after n bindings, to a state the recurrence detector would recognise as
`Crystal n`. Then holes would genuinely induce orbits and `runToHorizon` would skip them. Absent that,
"orbits around existing structure" stays a figure of speech, and it is recorded as one.

### But the sentence is literally true somewhere else — and I measured it today

This does **not** promote the tree mapping. It is an independent instance, and it is worth separating
carefully because it is tempting to read it as confirmation.

`runToHorizon`'s **key projection is a hole in Vokes's exact sense** — `chip8Key` deliberately does not
look at Mem or Display; an absence with a name, the Gordon Bell test applied to a state space. And what
the hole does is precisely what Aaron said: in §4's probe, projecting out part B turned a trajectory whose
true period is **3 988** into an apparent **period-4 orbit around the retained structure**. The hole
manufactured the orbit.

With the cautionary half attached, because it is the same measurement: **the orbit the hole induces is an
artifact**, and acting on it returned a wrong answer. So the sentence holds, and its truth is a hazard
rather than a feature — which is a more useful thing to have found than a confirmation would have been.

***

## 6. Registers

* `metered` — the four-class dilation table; the `horizon / Reachable` identity; the λ non-correlation in
  both directions; the coupled-system table with its exact zero-coupling control; the silent-wrongness of
  a lossy key. Eight tests, mutation-proved.
* `unmetered` — the argument that the existing CHIP-8 caller satisfies the new precondition (sound
  reasoning about the ROM; no check, and the existing test compares projections so it cannot establish
  it).
* *coincidence, unpromoted* — holes-induce-orbits as a claim about tree structures. Promotion condition
  named in §5.
* `toy` — none. No constant in this work was chosen by taste.

## 7. Beacon anchors

* **Artin & Mazur (1965)** — the dynamical zeta `SchedulerZeta` implements; recurrence as the object.
* **Benettin, Galgani, Giorgilli & Strelcyn (1980)** — the windowed λ estimator in `Orbit.largestLyapunov`.
* **Kaneko (1984)** — coupled map lattices; the diffusive-coupling shape of the correlated-set probe.
* **Gordon Bell** — *"the cheapest, fastest, and most reliable components are those that aren't there"*;
  the review question §5 applies to a state projection.
* **Ralph W. Gosper Jr.** — *"a data structure is just a stupid programming language"* (Vokes amends it
  to "tiny virtual machine").
* **David Greenberg** — Hitchhiker trees. **Bender, Farach-Colton & Kuszmaul** — cache-oblivious
  streaming B-trees (the Bε/fractal buffer). **Clark & Tärnlund**; **John Hughes (1986)** — difference
  lists / the O(1)-append trick. **Robinson (1965)** — unification.
* **Wilczek (2012)** — discrete time crystals, the `Crystal n` class's physics anchor.

## Pointers

* `src/Core/SchedulerZeta.fs` — `runToHorizon` (the mechanism), `predict` (the derived factor), and the
  precondition this work added to the docstring.
* `tests/Tests.FSharp/TimeDilation.Tests.fs` — the measurement.
* `tests/Tests.FSharp/SchedulerZeta.Tests.fs` — the billion-frame CHIP-8 fast-forward that was already
  there.
* `src/Core/Orbit.fs` — the four-class taxonomy; `classifyDynamics` is still unconsumed outside its own
  tests.
* `docs/research/ip-questionable/` — the two Strange Loop captures named in §5 (third-party material;
  folder README governs republication).
* `.claude/rules/numerology-vs-number-theory.md` — the register discipline §5 is filed under.
* `.claude/rules/toy-is-free-metered-must-be-earned.md` — the vocabulary in §6.
