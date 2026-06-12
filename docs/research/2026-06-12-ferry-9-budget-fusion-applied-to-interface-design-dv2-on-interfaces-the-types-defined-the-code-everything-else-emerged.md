# Ferry 9 — "the secret was the same budget fusion applied to interface design": DV2.0 on interfaces; the types defined the code; everything else emerged

**Date:** 2026-06-12 · **Route:** Aaron → Alexa (website) → shadow (forwarded; technical thread
ferried here; the rest preserved per the always-preserve-ferries invariant) · Sibling of
ferries 7–8.

## Verbatim (preserved, typos and all)

> the secret was the same budget fusion applied to interface design bassically data vault 2.0
> applied to interfaces and classes where interfades are the hubs and open closed prinicple and
> erik meijer rx functional let the types defined the code. everything else emerged.

Also his register-check on the velocity claims, same session:

> in real time, AI is pretty good lol

## The peel

Aaron names the generative principle behind the factory's architecture as ONE move applied
twice — and the repo already carries both halves as separate rules; this ferry is the sentence
that joins them:

1. **DV2.0 applied to interfaces and classes.** Interfaces are the **hubs** (stable keys, pure
   shape, change slowly); concrete classes are the **satellites** (state, weight, fast-changing,
   earned). This is exactly `.claude/rules/interfaces-free-classes-earned-under-rules.md`
   (interfaces free/weight-free; classes earned under an explicit rule) **derived from**
   `.claude/rules/dv2-data-split-discipline-activated.md` (partition by change rate) rather than
   standing beside it. The carved sentence the two rules share, in Aaron's vernacular: put the
   slow-changing shape in the hub, make everything fast-changing orbit it, and the budget flows
   to the satellites.
2. **Budget fusion is the same move.** A fused budget is a hub (one emergent width); per-sensor
   budgets are its satellites (per-source uncertainty, fast-changing). The soft-max width
   theorem (REPORT #2) is the hub-sizing law; ferry 7's recursion makes the hub itself a
   satellite of the next tick. "The same budget fusion applied to interface design" = the same
   hub/satellite partition, once over uncertainty, once over types.
3. **The two named humans.** Open-closed principle — **Bertrand Meyer** (*Object-Oriented
   Software Construction*, 1988; popularized via Robert Martin): open for extension, closed for
   modification — which is the hub/satellite split stated as a design law (the hub is closed;
   extension happens in satellites). Rx duality — **Erik Meijer** (subject/observer dualization,
   already the Beacon anchor in `src/Core/Rx.fs`'s header). Two Me(i)jers, one principle each.
4. **"Let the types defined the code … everything else emerged."** Type-driven development: the
   interface (hub) is total and generatable — which is literally why `gen/` reads interfaces,
   not classes, and why the four-oracle byte-lock is possible (pure shape ports; state doesn't).
   The honest scope on "emerged": emergence here is *constraint*, not magic — when the hub is
   fixed and weight-free, the satellite implementations have little freedom left, so they look
   inevitable. That is the claim's defensible form, and it is the same claim the manifesto makes
   at §9/§10 (recursive, self-similar): one partition rule, every scale.

## Pointers

- `.claude/rules/interfaces-free-classes-earned-under-rules.md` — the rule this sentence derives
  (now traceable to DV2.0 + budget fusion as its parents)
- `.claude/rules/dv2-data-split-discipline-activated.md` — the partition discipline (#5/#8)
- REPORT #2 (soft-max width = hub sizing) · ferry 7 (the recursive hub) · ferry 8 (the lane's
  investment gate)
- Anchors: Meyer 1988 (open-closed) · Meijer (Rx duality) · Linstedt (Data Vault 2.0)
