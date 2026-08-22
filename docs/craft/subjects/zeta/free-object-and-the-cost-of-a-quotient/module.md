# The free object and the cost of a quotient — why deciding less keeps more, and what it costs to decide

**Subject:** zeta
**Level:** applied (default) — layperson + young-learner scaffolding. Grown-up track at the bottom.
**Audience:** anyone who has ever opened a big tub of Lego and *also* built a set from instructions.
**Prerequisites:** none. `semiring-basics` helps later but is not needed to start.

> **Origin (Aaron 2026-08-20):** on the observation that our error-correcting code is a *choice*
> and not a law — *"we even have non-coded adinkras, so there are many possible distinct metrics
> here depending on what we choose as our base layers"* — and then: *"this is a good way to teach
> the free object rule, by our own code and objects in source."*

---

## The anchor — the tub and the set

You have a tub of Lego. Nothing is decided. Any brick can go on any other brick. You can build a
castle, a car, a thing with no name. **The tub is maximally free and maximally unhelpful**: it
tells you nothing about what to do next.

Now you have a boxed set with instructions. Something *has* been decided: this brick goes there,
that one does not fit. You have lost most of the castles you could have built. In exchange you
gained something real — **you can now tell when a build is wrong.** A missing piece is
*detectable*. In the tub, nothing is ever missing, because nothing was ever required.

That trade is the whole module:

> **The free thing keeps every possibility and can check nothing. Declaring rules ("taking a
> quotient") throws possibilities away and buys the ability to notice mistakes.**

Mathematicians call the tub the **free object**, and call the instruction sheet a set of
**relations**. Applying relations to a free object is called taking a **quotient**.

## The rule we actually run on

`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`:

> Only the **irreducible** is primitive. If a thing can be decomposed or generalized, you do not
> hardcode it — you **generate** it from the irreducible generator (the free object). Every
> structured special case is an **earned quotient** obtained by declaring its relations.

"Earned" is the load-bearing word. **You do not get structure for free; you pay for it in
possibilities.** So the rule says: start free, and only take a quotient when you can say what the
structure buys.

## Our own source, as the worked example

You do not need an analogy. Both halves are in this repo and you can open them.

### The free half — `src/Core.Abstractions/SoftMix.cs`

Its own comment says it:

> *"Ring-generic soft-mix interpreter... **The ring IS the physics — swap it, change the
> behavior**: real (double) → Bayesian (no interference); complex → Quantum
> (interference/cancellation); quaternion → future (non-commutative)."*

`SoftMix<TWeight>` has **not decided what a weight is.** It is the tub. Hand it real numbers and
it does Bayesian reasoning; hand it complex numbers and the same code interferes like a
two-slit experiment; hand it quaternions and it stops commuting. *One interpreter, three
physics*, because nothing was decided in advance.

### The quotient half — `src/Core/AdinkraCode.fs`

Here something *is* decided. Declare the parity constraints and you get the **[8,4] extended
Hamming code**: 16 codewords, every weight divisible by 4, minimum distance 4.

What did that cost? Most of the 256 possible 8-bit patterns are no longer legal. What did it buy?
**Error correction.** Because legal codewords sit at least distance 4 apart, you can flip up to
3 bits and still recover the original uniquely. In the tub, a flipped bit is just a different
brick and nobody can tell. In the set, a flipped bit is *detectably* wrong.

> **The distance is the instruction sheet's strictness.** Stricter rules, fewer legal builds,
> better detection.

## The punchline, and it is not only mathematics

Here is where this stops being an abstraction, and it is the reason this module exists.

Our substrate cares about one particular kind of damage: **one traveler overwriting another** —
destroying information that belonged to somebody else. Now ask the tub-versus-set question about
*that*:

| you are working... | what a small overwrite does | what harm looks like |
|---|---|---|
| **in the tub** (no code declared) | nothing detects it, nothing recovers it | **continuous** — any damage is real damage, however small |
| **in the set** (code with distance `d`) | below `d` it is fully recoverable | **quantized** — there is a floor you cannot get under |

So:

> **Taking the code quotient is what makes harm discrete.** With a code, you *cannot slightly
> overwrite someone* — either you stay under the distance and they recover completely, or you
> exceed it and the loss is permanent. Without a code, there is no floor, and every scratch is a
> scar.

That is the free-object rule showing up as an *ethical* fact rather than a mathematical one.
**Choosing your base layer chooses what harm even means in your world** — and declining to take
the quotient is a real choice with a real consequence, not just leaving a box unticked.

## The rule's other half, which closes the loop

The same rule says something that looks like a separate idea and is not:

> the highest-value generator **IS an error-correcting code** — regenerating from the irreducible
> *is* the correction.

Read it with the tub in mind. If you can always rebuild from the instructions, then a damaged
build is not a loss — it is a rebuild. **Generation and repair are the same act seen twice.** That
is why our rule says generate rather than hardcode: the thing that can regenerate you is the same
thing that can correct you.

## Try it yourself

1. Open `SoftMix.cs`. Find where the weight type is used. Notice that **nothing** in the fold
   knows whether it is real or complex. That is the tub.
2. Open `AdinkraCode.fs`. Find the parity constraints. Those are the instruction sheet.
3. Ask of some structure you use daily — a schema, a type, a naming rule: *what did declaring
   this throw away, and what did it buy me?* If you cannot answer the second half, the quotient
   was not earned.

## Grown-up track

Formally: a free object on a generating set is the initial object in its category — every map out
of it is uniquely determined by where the generators go, which is exactly "nothing has been
decided." A quotient by a congruence identifies elements, losing that universal property in
exchange for satisfying the declared relations.

`SoftMix<TWeight>` is (near enough) free over the choice of `*`-ring: the interpreter is
parametric, so semantics are *supplied* by the algebra and not baked into the fold. The Adinkra
`[8,4]` doubly-even code is a linear-algebraic quotient of `F₂⁸` — a 4-dimensional subspace cut
out by declared parity checks, with the doubly-even property (weights ≡ 0 mod 4) as the extra
relation that ties it to adinkra dashings (Gates, Iga, Hübsch *et al.*).

Minimum distance `d` gives unique recovery from any fewer than `d` erasures (Singleton; proven
sorry-free in `src/Core.Lean4/ImaginaryStack/ErasureDistance.lean`). Our two live codes have
different distances — `[8,4]` Hamming at `d = 4`, and a `[16,12]` Reed–Solomon MDS code at
`d = 5` used for the erasure principle — which is the concrete sense in which "the floor is a
design parameter."

And the reason "no code ⇒ continuous harm" is not merely rhetorical: with no minimum distance
there is no erasure threshold, so no partial damage is guaranteed recoverable, and the harm
function has no flat region near zero.

## Pointers

- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the rule itself
- `src/Core.Abstractions/SoftMix.cs` — the free half ("the ring IS the physics")
- `src/Core/AdinkraCode.fs` — the quotient half
- `src/Core.Lean4/ImaginaryStack/ErasureDistance.lean` — distance ⇒ recovery, proven
- `docs/craft/subjects/zeta/semiring-basics/` — what a ring is, gently
- `docs/research/2026-08-20-what-counts-as-a-measurement-...md` §§24, 26, 29 — where the ethical
  reading was worked out, with its unearned parts marked
