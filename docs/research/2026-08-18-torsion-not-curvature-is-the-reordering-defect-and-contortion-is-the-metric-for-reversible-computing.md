# Torsion, not curvature, is the reordering defect — and contortion is the metric we have been looking for

> **Origin.** Aaron 2026-08-18, forwarding the torsion/contortion passage from the Weinstein
> interview: *"This is all good and they go deep. We might use this to help design one of our metrics
> for curvature for reversible computing physics."*
>
> **It does — and it also corrects me.** I have been saying the reordering defect is
> *curvature*-shaped. That was imprecise. **It is torsion.** The distinction is not pedantry; the two
> tensors measure different failures and only one of them is about order.

## The carved version

> **Curvature measures whether a frame returns after a closed loop. Torsion measures whether an
> infinitesimal parallelogram CLOSES AT ALL — whether doing A-then-B lands where B-then-A lands.
> That second thing is exactly the reordering question. So the out-of-order residue is TORSION, and
> the object that measures how far an execution's order sits from the canonical one is CONTORTION —
> an ad-valued 1-form, not a scalar.**

## What the passage actually supplies

Weinstein's three points, each usable:

1. **There are three real tensors in Riemannian geometry** — metric, torsion, curvature. *"Curvature is
   used by Einstein to do gravity. The torsion tensor is the weak sister that never makes it to the
   big dance."*
2. **Torsion is absent from GR for a specific reason**, not an oversight: Palatini — *"if you open
   yourself up to torsion, the Lagrangian doesn't select for it."* GR discards torsion because
   **GR does not care about order**; its content is the metric.
3. **Contortion is the difference between any connection and the Levi-Civita connection**, and it is
   an ad-valued 1-form. Torsion and contortion are inter-derivable — same information, two
   presentations.

## Why this is the right object for us, and curvature is not

The geometric meanings are distinct and the distinction is exactly our question:

| | measures | our reading |
|---|---|---|
| **curvature** | transport a frame around a **closed loop** — does it come back rotated? | holonomy: a belief carried around a cycle and returning changed |
| **torsion** | transport two vectors along each other — **does the parallelogram close?** | **A-then-B versus B-then-A: does reordering land in the same state?** |

**Our substrate's central question is order.** Out-of-order tolerance, commutative merge, retraction,
the whole `±1` apparatus — all of it is about whether composition depends on sequence. That is
parallelogram closure, which is torsion by definition. Curvature is a *different* defect that happens
to also be a defect.

**And the correction cuts the other way too, which is the interesting part.** Weinstein says torsion
is the weak sister because the Lagrangian does not select for it. **For us the ranking inverts: the
tensor GR discards is the one we need, and the one GR is built on is the incidental one.** That is a
reason to expect our geometry to look *unlike* GR rather than a failure to match it — and it is
consistent with Aaron's own correction that the physics here is reversible computing, not general
relativity.

## Contortion as the metric — the concrete proposal

This is the part that answers the ask directly.

**Levi-Civita is the unique torsion-free connection compatible with the metric** — the canonical
reference. Any other connection differs from it by an ad-valued 1-form: the contortion.

Map it:

- **Levi-Civita ≡ the canonical / phase-ordered fold** — the reference execution, order-independent
  by construction.
- **An arbitrary connection ≡ an actual execution order** — what really happened, with whatever
  arrival sequence the network delivered.
- **Contortion ≡ how far this execution sits from canonical.**

So contortion is a **measure of accumulated order-deviation**, it is *typed* rather than scalar (an
ad-valued 1-form: it takes a direction and returns a Lie-algebra element), and it is **zero exactly
when the execution was order-independent** — which is the flat, embarrassingly-parallel,
no-coordination-needed case identified earlier from the other direction.

That is a better-shaped metric than the scalar ΔU: it has a *direction*, so it can say not just *how
much* an execution deviated but *in which way*.

## Three metrics, not one — the irreducible decomposition

Weinstein flags that the 1-form valued in 2-forms *"breaks into a sum of three irreducible
representations under the Lorentz group,"* and that different proportions give torsion versus
contortion.

That decomposition is standard and worth having explicitly. In 4 dimensions torsion `T^a_{bc}`
(antisymmetric in `bc`) has **4 × 6 = 24 components**, splitting into:

| piece | components | shape |
|---|---|---|
| trace vector | 4 | a vector — a net directional bias |
| axial / pseudo-trace vector | 4 | a pseudo-vector — a chirality-like part |
| traceless tensor | 16 | the remainder |

`4 + 4 + 16 = 24`. **So an order-deviation measure built this way yields three independent
quantities, not one** — and they are independent under the symmetry group, meaning they can move
separately and a system could be deviating in one while clean in the others. Any implementation that
collapses them to a single scalar is throwing away two thirds of the signal, which is precisely the
mistake ΔU-as-one-number already makes.

## What would make this real, stated so each can fail

1. **Is there a canonical connection at all?** The whole construction rests on a torsion-free
   reference existing and being unique. In Riemannian geometry that is a theorem (the fundamental
   theorem of Riemannian geometry). **Here it is an assumption**, and it is the first thing to check:
   if there is no canonical fold order, there is no Levi-Civita analogue and contortion is undefined.
   **Cheapest check, and it can kill the whole proposal.**
2. **Do the three irreps actually separate in our data?** If all three always move together, the
   decomposition is real mathematics doing no work here, and one scalar was right after all.
3. **Does contortion vanish on genuinely commutative folds?** It must be **exactly** zero there, not
   small. A metric that reports nonzero deviation on an order-independent execution is measuring
   something else.
4. **Is it additive over composition?** For it to serve as a budget (the escalation threshold, the
   Landauer accounting), deviation over a sequence should relate predictably to deviation over its
   parts. If it is not, it is a diagnostic rather than a currency.

## What this corrects

Earlier docs today said *"what carries curvature is the defect — the associator measuring what
reordering costs"* and *"if there is curvature anywhere, this is where it would live."* **Read
strictly, those said curvature where they should have said torsion.** The substance survives — there
is a defect, it lives in the residue where reordering is not free, and it is geometric — but the
tensor was misnamed, and the misnaming mattered because it pointed at holonomy when the phenomenon is
closure.

Recorded rather than silently amended, same discipline as keeping a retraction.

## Pointers

- `docs/research/2026-08-18-the-duality-hypothesis-dissolves-*.md` — where I said curvature and meant torsion
- `docs/research/2026-08-18-not-GR-the-physics-is-reversible-computing-*.md` — Aaron's correction that
  the frame is reversible computing; this document is that correction applied to the tensor choice
- `docs/research/2026-08-18-coordination-is-the-velocity-*.md` — the coordination axis; contortion is
  its typed form
- `docs/research/ip-questionable/2026-08-18-geometric-unity-part-2-*.md` — the source passage
- Cartan (torsion, 1922) · the fundamental theorem of Riemannian geometry (Levi-Civita uniqueness) ·
  Palatini (why GR's Lagrangian does not select torsion)
