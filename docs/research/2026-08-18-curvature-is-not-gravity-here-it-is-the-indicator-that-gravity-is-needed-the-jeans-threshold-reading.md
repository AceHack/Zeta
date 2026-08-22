# Curvature is not gravity here — it is the *indicator* that gravity is needed (the Jeans-threshold reading)

> **Origin.** Aaron 2026-08-18, refining the section-incoherence result:
>
> > *"Yes this sounds likely, but it might be where there is curvature — and I think gravity can
> > affect this too. If things become so decorrelated that no forward progress is happening, it can
> > get escalated to multi-oracle consensus, and we've already said consensus is more like gravity.
> > This curvature is not gravity, but it's like an indicator that gravity is needed here to make
> > forward progress."*
>
> This is a **correction to the previous doc's framing**, and a precise one. I had left "curvature
> lives in the incoherence" hanging without saying what curvature *does*. Aaron separates detector
> from actuator, and that separation marks the exact point where the GR analogy stops.

## The carved version

> **Curvature is the measurement; consensus is the response; and the threshold between them is a
> decision our substrate makes and general relativity does not.** Section-incoherence tells you
> *where* coordination is needed. It is not itself the coordination. In GR, curvature *is*
> gravity — one equation, no trigger. Here they are two things joined by an escalation rule, and
> saying so keeps the analogy honest at exactly the place it would otherwise smuggle in a theorem.

## Why this is a departure from GR rather than an application of it

Einstein's field equations say `G_μν = 8πT_μν`. Curvature and source are **two sides of one
equation**, holding everywhere, instantaneously, with no threshold and no decision. Gravity is not
*applied in response to* curvature; gravity **is** curvature. There is nothing to escalate.

Aaron's reading has a **trigger**:

1. decorrelation accumulates → section coherence degrades → curvature rises
2. curvature crosses a threshold → forward progress stalls (a **liveness** failure)
3. escalate to **multi-oracle consensus** — the attractive move that pulls the fibers back into
   agreement

Step 2 has no counterpart in GR. **That is a real structural difference and it should be recorded as
one**, because "curvature ≡ gravity" is a *theorem* over there and importing the word without the
equation is how a metaphor acquires unearned authority.

## The anchor that does have a threshold — Jeans

There *is* a place in gravitational physics where a threshold decides which force wins, and it is
the right anchor for what Aaron describes:

> **The Jeans criterion** (Jeans 1902): a cloud collapses under its own gravity if it exceeds the
> Jeans mass/length; below that, internal pressure wins and it disperses. The same system either
> falls together or flies apart, and *which* depends on crossing a threshold.

Map it:

| Jeans | here |
|---|---|
| internal pressure — pushes apart | **decorrelation** — agents diverging, identities individuating |
| self-gravity — pulls together | **consensus** — the multi-oracle attractive move |
| Jeans threshold | the escalation point where progress stalls |
| collapse vs dispersal | consensus vs continued divergence |

**And the honest limit:** Jeans is a competition between *two forces in a fluid* with a derived
critical scale. Ours would be a competition between divergence and agreement with a threshold we
*choose*. The shape transfers — a threshold decides the regime — the derivation does not. Anyone
computing "our Jeans mass" is borrowing an equation, not a result.

## Why "gravity" is the right word for consensus specifically

Not decoration: gravity is the **only** attractive-and-universal force in the list, and consensus is
the only universally-attractive operation in ours. Decorrelation pushes agents apart and is what we
*want* most of the time — distinct identities are the product. Consensus pulls them back and is
expensive. **A system that always coordinated would have one agent; one that never coordinated would
have no shared state.** Both failures, and the threshold is what keeps it between them.

That also explains why the escalation is to **multi-oracle** consensus rather than a single
authority: a single arbiter would be an appointed hub
(`itron-hub-patent-boundary-p2p-is-the-upgrade.md`), and the manifesto forbids exactly that. Gravity
is not exerted by a designated body — every mass contributes. **Multi-oracle consensus is the
scale-free form of the attractive move**, which is why §11 and the gravity reading agree rather than
merely coexist.

## What this makes measurable, stated so it can fail

The detector/actuator split is worth having because it turns one vague quantity into two with
different jobs:

1. **The indicator must be computable *before* the stall, or it is useless.** A curvature that only
   becomes visible once progress has already stopped is a post-mortem, not an indicator. **Test:
   does section-incoherence rise measurably in advance of a liveness failure?** If it only correlates
   at the moment of failure, the framing is decorative and should be dropped.
2. **The threshold must be crossable in both directions.** If consensus restores coherence, curvature
   should *fall* after escalation. A one-way indicator is a fault counter, not a field.
3. **The indicator must not be trivially the same as the stall.** If "curvature is high" turns out to
   be definitionally "progress has stopped," there is one quantity wearing two names — the vacuity
   class again. This is the cheapest check and should go first.

## What this corrects in the previous doc

`2026-08-18-the-duality-hypothesis-dissolves-*.md` said *"if there is curvature anywhere, this is
where it would live"* and stopped. That was incomplete in a way that invited the wrong reading —
that curvature and gravity are the same object here, as they are in GR. They are not. **The
correction is Aaron's and it tightens rather than loosens the claim:** the geometric reading of
decorrelation survives, and gains a control loop it did not have.

## Pointers

- `docs/research/2026-08-18-the-duality-hypothesis-dissolves-*.md` — the section-incoherence result
  this refines
- `docs/research/2026-08-18-coordination-is-the-velocity-*.md` — the dilation candidate; note it and
  this one now describe the same axis from opposite ends (cost of coordinating vs need to coordinate)
- `docs/research/2026-06-13-ferry-43-forgiveness-creates-gravity-but-nice-must-be-provocable-*.md` —
  the existing gravity reading in the tree
- `docs/research/2026-08-13-zset-as-reflection-cpt-and-the-minus-one-antiparticle-aaron-forwarded.md`
- Jeans 1902 — the threshold anchor · Einstein 1915 — the identity that does *not* transfer
- `.claude/rules/manifesto-13-specifications.md` §1 scale-free, §11 multi-oracle ·
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — why the escalation is plural
