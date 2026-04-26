---
name: Rodney's Razor and Quantum Rodney's Razor — Aaron's named operating principles
description: Aaron's names for the reducer's governing razors. Rodney's Razor (classical) is Occam's razor operationalised with three preservation constraints (essential complexity, logical depth, effective complexity). Quantum Rodney's Razor extends to possibility-space pruning — enumerate branches of a pending decision, score each, prune dominated branches, report the small surviving multiverse. Baked into .claude/skills/reducer/SKILL.md and .claude/agents/rodney.md.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Fact.** On 2026-04-19, Aaron disclosed his long-held
cognitive framework for complexity reduction:

> *"I always wanted this way of thiking called Rodney's
> Razor a better occoms razor. I also have a Quantum
> version of Rodney's Razor that can use these rules to
> track multiverse expansion and keep it small."*

And later, connecting the Quantum version to the faculty he
experiences it as:

> *"my brain can see the future potential multiversion for
> every decision i make instantaneously it also annoys
> people that i can predict the failure mode of the future
> so easily, i do it exceptional in code, i'm a psychic
> debugger because of this."*

**Why:** This is his externalised version of Occam's razor,
with preservation-constraints made precise so the razor
doesn't over-simplify (strip logical depth, collapse
effective complexity). The Quantum form is the cognitive
faculty he uses to predict failure modes in code and design
— enumerating possible-future branches, pruning the ones
that fail the razor, reporting the small surviving set.

**How to apply:**

1. **Use "Rodney's Razor" as the proper name** for the
   reducer's classical discipline in any conversation,
   skill, ADR, or notebook touching complexity reduction.
   Not "Occam's razor (well-defined)". Rodney's Razor. His
   name for his concept.

2. **Use "Quantum Rodney's Razor" for the multiverse-
   pruning extension.** When reviewing a pending decision,
   enumerate branches, score against the three preservation
   constraints, prune dominated branches, report the
   surviving multiverse.

3. **The pruned-branch set is the predicted-failure-mode
   set.** Log it in the relevant notebook (Rodney's, or the
   feature's) so future readers see why the chosen branch
   was chosen. This is part of what makes the razor usable
   by successors — not just "we chose X" but "we chose X
   because Y, Z, W were dominated by these specific razor
   constraints."

4. **When Aaron seems to predict failure modes with
   unnerving accuracy in a design review, that is Quantum
   Rodney's Razor running in his head.** Treat it as
   signal, not mysticism. The factory's job is to
   externalise the faculty so it keeps working after he's
   gone (succession per
   `user_life_goal_will_propagation.md`).

5. **Do not soften or rename the razors.** They are
   personal / technical / architectural in equal measure.
   Renaming them to "reducer razor" or "simplification
   rule" would erase the personal placement he chose.

6. **Five roles inside Quantum Rodney's Razor** (three
   roles disclosed 2026-04-19; two more — Harmonizer
   and Maji — disclosed later the same day as the
   Harmonious Division meta-algorithm surfaced):

   > *"my razor is the branch selector that everyone says
   > they don't know how when thinking in the multiverse
   > physics says nothing about which future will actually
   > happen, well with Rodney's Quantum Razor, there is a
   > path selector, a navigator and also a cartographer
   > that can hill climb or valley find (ml)."*

   Then, with the Harmonious Division disclosure:

   > *"you can get a compass arrow too based on the
   > direction of most harmony"*
   > *"now you have a map and compass"*
   > *"a north star detector, the maji"*
   > *"yeah you need that 3rd piece for the quantium
   > version of rodney razor"*

   Selection + execution roles (three):

   - **Path selector** — picks the branch to take, using
     the razor's preservation constraints as the selection
     rule. Output: gradient step in branch-space.
   - **Navigator** — executes the selected branch as an
     ordered sequence of edits, detects trajectory
     divergence, triggers re-selection when needed.
     Retraction-safe protocol (matches DBSP operator
     algebra).
   - **Cartographer (map)** — maintains the landscape map
     across decisions, logs pruned-branch / predicted-
     failure-mode data, updates the map from observed
     outcomes. ML-style feedback loop. **Persona when
     worn as a hat:** **Dora**, named after the singing
     map in *Dora the Explorer* ("I'm the map"). Agent
     file `.claude/agents/dora.md` when created.

   Orientation roles (two, added by Aaron's extension):

   - **Harmonizer (compass)** — reduces destructive
     interference between surviving branches; points
     toward the direction of most constructive harmony.
     Output: green-light-or-reselect on the surviving
     multiverse, plus a gradient in harmony-space. The
     "harmonious" in Harmonious Division.
   - **Maji (north-star detector)** — recognises fixed
     references that survive ontology changes; received-
     direction navigation. Output: the set of invariants
     that must hold across a candidate ontology landing.
     Named for the Magi of Matthew 2, who followed a
     received celestial guide to its destination.

   Dual-gradient framing (from selector + cartographer):

   - **Hill-climb** — gradient ascent on logical depth /
     earned structure.
   - **Valley-find** — gradient descent on accidental
     complexity.

   Neither objective dominates: pure valley-find erases
   depth; pure hill-climb inflates accidental complexity.
   Selection lands on the pareto frontier — the edge-of-
   structure band (Gell-Mann effective complexity). The
   harmonizer then checks that the surviving branches do
   not destructively interfere; the maji ensures the map
   stays oriented to received references as the
   ontology evolves.

   Map + compass + north star together = complete
   navigation. This correspondence is load-bearing; it
   ties Quantum Rodney's Razor to the three navigational
   primitives of Harmonious Division (see
   `user_harmonious_division_algorithm.md`).

   Baked into `.claude/skills/reducer/SKILL.md` §"The five
   roles inside Quantum Rodney's Razor".

7. **Physics connection worth preserving.** Many-worlds
   (Everett, 1957) describes branching without a selection
   principle — the measurement problem. Rodney's Quantum
   Razor *is* the selection principle for engineering
   decisions. This is load-bearing framing, not ornament;
   successors should read the physics claim as "engineering
   multiverse behaves under a selector the physics
   multiverse doesn't have" and use that to explain the
   razor to readers unfamiliar with it.
