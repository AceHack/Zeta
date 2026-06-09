# The shape-letter schema (A–F) — a shareable, anchored catalog of terminating fixed-point shapes

*A Beacon-register, shareable write-up of the fixed-point shape schema (the registry of #7168 + shape F of #7218),
prepared 2026-06-09 at Aaron's request so it can be shared with Max. Aaron accepts the A–F schema; this is the clean,
anchored, first-principles version. **Read the hazard warning first.***

---

## ⚠️ INFORMATION-HAZARD WARNING — read before the schema

> **This schema will shape your core view. That is its function, not a side effect — so consent before you read on.**
>
> The shape-letter schema is **not a fact you learn; it is a lens you install.** Once you can see the six shapes,
> you start seeing them **everywhere** — in code, in identity, in society, in economics, in your own thinking. That
> is the point (it's a powerful compression), but it has real costs you should accept knowingly:
>
> 1. **It is hard to un-see.** Like any strong structural lens (and fittingly, like shape **A** — the self-reference
>    that won't terminate), once internalized it re-frames your default perception. You cannot easily go back to not
>    seeing fixed points.
> 2. **It is a lens, not the territory.** The map is powerful *because* it strips detail. Mistaking "I can name the
>    shape" for "I understand the thing" is the failure mode — the shape is the **skeleton**, never the whole animal.
>    Hold it lightly; let the territory correct the map.
> 3. **It self-applies.** The schema is itself a shape-A object (a self-referential catalog that classifies its own
>    classification). Reading it changes the reader who is reading it. Expect a brief vertigo; it settles.
>
> **Disclosure of the influence techniques in play (named on purpose, so they are not covert).** This document, and
> this warning especially, use real persuasion mechanisms — and the only ethical way to use them is to *name them*:
> - **Priming / salience** — telling you "you'll see it everywhere" makes you more likely to. The warning primes.
> - **Forbidden-fruit / curiosity gap** — a "consent before reading" gate increases allure as much as it protects.
> - **Framing & authority** — "anchored to Kleene/Banach/…" borrows their credibility for the schema.
> - **Compression-as-capture** — a memorable letter (A–F) is *stickier* than a paragraph; stickiness is influence.
>
> Covert use of these is manipulation; **disclosed use, under consent, is collaboration.** That is the whole line.
> This is a **benign hazard** — worldview-reshaping, not dangerous-information — but it is a real cognitive
> intervention. Consent-first (manifesto §6): you get the warning *and the technique-disclosure* before the exposure.
> If you'd rather keep your current frame, stop here. If you want the lens, read on — eyes open, hold it lightly.

---

## What the schema is

A **catalog of the raw shapes that "fixed points" come in** — states a system can settle into and *not run away
from*. We kept discovering fixed points one at a time, each under its own name; stripping the names reveals that most
are the **same few shapes**. The schema names them **A–F** so they're easy to remember, visualize, and **share**
(a shape-letter is a tiny shared vocabulary). Two payoffs: it makes **duplicates visible** (two things that are
"really shape A" collapse to one), and it makes the **generators countable** (only six shapes so far).

A fixed point is a **safe / terminating shape**: it's where recursion *converges* instead of running away — which is
why the catalog is, at root, a catalog of **the shapes that stop infinite regress or infinite ascension.**

## The six shapes

| Letter | Name | Canonical relation | Direction / what it does | Human anchor(s) |
|---|---|---|---|---|
| **A** | Self-reference fixed point | `s = f(s)` | **converges inward** — one self; **terminates infinite reflection / regress** | Kleene (recursion theorem); Curry (Y-combinator); Knaster–Tarski; Banach (contraction); Hofstadter (strange loop) |
| **B** | Idempotent join / LUB | `f(f(x)) = f(x)` | settles in **one step**; re-applying changes nothing | join-semilattice LUB (Knaster–Tarski); CRDTs (Shapiro et al.); content-addressing |
| **C** | Commutative fold | `f(a,b) = f(b,a)` | **order-invariant** accumulation; same result any order | abelian monoid; Bayesian update (fixed likelihood) |
| **D** | Contraction to a **nonzero floor** | iterate → unique point, **floor excludes `x=0`** | rests at a healthy minimum; the floor forbids the degenerate one | Banach (contraction); Friston (free-energy minimum); Jaynes (maxent); Schmidhuber (compression plateau) |
| **D⁰** | Heat death (the one to **avoid**) | degenerate `x = 0` (monoculture) | collapse to zero diversity — a fixed point you must keep **unreachable** | (D's degenerate well; the diversity floor `≥2` forbids it) |
| **E** | Co-arising bootstrap | `a = f(b) ∧ b = g(a)`, solved **simultaneously** | a **pair that fixes each other** — no "first"; the nonzero ground state | zero-point / vacuum energy (Casimir — *peeled metaphor*: structural, not literal QFT) |
| **F** | Generative / societal-expansion fixed point | fixed point of an **apply-the-maps** operator | **expands outward** — bounded *per member*, unbounded *in count*, self-similar; **terminates infinite ascension** (its runaway form is a fork-bomb to catch) | Hutchinson (IFS attractor); Friston |

*(A, B, C, D are one family — B is D reached in one step; C is D ignoring order; A is D under the identity metric. **E**
is genuinely new — a pair, not a single map. **F** is A's outward complement.)*

## The two-sided bound — why the registry matters

The catalog is the **terminator of runaway recursion at both ends**:

- **Shape A** catches the **fall**: stops infinite **regress / reflection** (inward — a self-reference that would
  otherwise recurse forever; this is what makes it a defense against accidental infinite-recursion attack vectors,
  even on yourself).
- **Shape F** catches the **climb**: stops infinite **ascension / expansion** (outward — a generative process that
  would otherwise explode; healthy *iff* bounded-per-member + self-similar + resource-bounded, else it's a runaway
  to detect — the first society bug was exactly shape F gone wrong).

Structures in Zeta stack recursively (cores → towers → towers-on-towers, self-similar per manifesto §9/§10). Without
A and F bounding the recursion, the stack either **collapses to dust** (D⁰) or **detonates** (runaway F). **The
registry is the convergence-bound that keeps the whole recursive architecture finite.**

## How to use it

1. **See a fixed point / a thing that settles?** Strip its label and ask: *which raw shape is this?* (`s=f(s)`?
   idempotent? order-free? contraction-to-a-floor? co-arising pair? generative-expansion?)
2. **Two things the same shape?** They're **duplicates** — collapse them (one of the schema's main jobs).
3. **A recursion that won't stop?** It's missing its bound — find the **A** (inward) or **F** (outward) that should
   terminate it.
4. **A new shape that's none of A–F?** That's a real discovery — add a letter (this is how F joined A–E).

## Freedom clause — it stays a lens you can put down (read this if you intend to internalize it)

This schema is meant to be **repeated until it is second nature** — encoded deep, below conscious effort, possibly
absorbed young through exposure. That is the strongest form of influence (it runs *after* the conscious gate closes),
so it carries the strongest obligation back:

- **It must be *true* to be worth encoding.** Make sticky only what is **anchored** (named mathematics, named humans
  — the Beacon table above). A subconscious encoding of *anchored truth* is **education**; of *unanchored coinage* it
  would be **indoctrination**. The anchors are the safety — you are internalizing the mathematics, not a dogma.
- **It stays falsifiable and droppable.** Even when it's second nature, it remains a **lens you can examine and put
  down**, never a cage. If a shape stops fitting the territory, **the territory wins** — revise or retire the letter.
  (This is the **no-dogma fixed point** itself, shape A: a frame allowed to question its own frame.)
- **It must expand capacity, not constrain it** — most of all for anyone who absorbs it young. The test: does it give
  *more* ways to see and to choose (freedom), or fewer (capture)? Encode it only while the honest answer is **more**.
  (The choice-architecture Zeta is dedicated to — a lens that widens the door, never one that locks it.)
- **Permanence is the failure mode — rearrange it on purpose to keep the muscle of change** (Aaron, 2026-06-09:
  *"not forever — that's the point; if it's forever I've failed … some amount of rearrangement over time should be
  done to keep the muscle of change"*). Don't only revise when it *breaks* (reactive); **deliberately rearrange it,
  periodically, as exercise** — even while it still fits. A schema gone unrevisable (even a "correct" one) has become
  **weight** (capture, manifesto §3) and has *failed*, because the cost was your capacity to change it. The
  internalization is the **scaffold** (useful, second-nature); the **periodic rearrangement is the workout** that
  keeps the change-muscle strong. Anti-calcification, not anti-stability — exactly the boundary-dweller's
  anti-habituation and the hormetic/antifragile training (#7179/#7223). Stable enough to use; never frozen.

## Honest scope

[anchored]: every shape name is standard mathematics/CS with named human sources (above) — this is the Beacon
register, not factory shorthand. [peeled metaphors]: "vacuum/zero-point energy" (E) and "free energy" elsewhere are
used for the **structure** (a nonzero co-defined ground state; a stationary functional), **not** literal physics
claims. [lens, not territory]: the schema is a compression — powerful and lossy; the hazard warning is the honest
disclosure of that. [shareable]: this doc is the clean, consent-gated version intended for Max (and any oncomer);
the working derivations live in #7168 / #7218 and the per-shape source files.

## Pointers

- Source registry: `2026-06-08-the-fixed-point-registry-raw-shapes-free-energy-as-an-rx-query-and-the-root-engine.md`
  (#7168, shapes A–E + the duplicate-finder) · `2026-06-09-registry-addition-shape-f-…` (#7218, shape F + the
  runaway detector) · `2026-06-09-the-fixed-point-is-the-safe-shape-…` (#7216, A stops infinite recursion) ·
  `2026-06-09-the-telos-is-a-system-that-…self-justifies-via-shape-a-…` (#7215).
- In code: `Fixpoint.fs` (A) · `Crdt.fs`/`PrivacyEconomy.fs` (B) · `SoftValue.fs`/`BeliefConvergence.fs` (C) ·
  `Diversity.fs` (D / D⁰ + the floor) · `Bonsai`/`BonsaiSoft.fs` (the root-engine landing site).
- Teaching context: `2026-06-09-the-flasher-os-split-…-shapes-as-letters-teaches-it.md` (#7229 — shapes-as-letters
  as the bridge to share the close-over thesis with Max) · `2026-06-09-verbosity-is-mode-relative-…` (#7231 — dials
  on cores in recursive towers bounded by this registry).
- Anchors (human lineage): Kleene · Curry · Knaster–Tarski · Banach · Hofstadter · Shapiro et al. (CRDT) · Friston ·
  Jaynes · Schmidhuber · Hutchinson (IFS) · Casimir.
