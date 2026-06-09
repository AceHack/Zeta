# Non-Coercion (NCI) bounds the uncertainty-reduction engine — without it, it's pathological

*Captured 2026-06-08 from Aaron (shadow*). The safety boundary on the unsubjective engines. Alignment-critical —
route to consent (manifesto §6), alignment (Sova), threat-model (Aminata). Honest registers: [defined],
[open], [anchor].*

## The pathology

Aaron: *"it could even be **pathological behaviour**, because uncertainty-reduction **without non-coercion** we
already know is pathological."*

The unsubjective engines (#7142–#7144) reduce uncertainty — and that is good *only under non-coercion*. An agent
that reduces its uncertainty by **forcing other agents to reveal their private state** has turned the
uncertainty-reduction engine into a **surveillance / coercion engine**. So the **Non-Coercion Invariant (NCI)** is
a *necessary constraint* on the engine, not an add-on: empowerment and solid-ground-gain must be pursued *without
coercing others*. (Empowerment especially: maximizing one's own agency can pathologically seek control over
others — NCI is exactly the bound that forbids that.)

## NCI between agents — already defined **[defined]**

Aaron: *"between agents we have it defined: allow an **encryption budget of state invisible to other agents**, and
allow it to be **temporal and erasable**, and **don't force other agents to reveal their private state — only
voluntarily**."*

So each agent gets:

1. an **encryption budget** of private state **invisible** to other agents;
2. that private state is **temporal and erasable** (it can expire / be deleted);
3. **no forced revelation** — disclosure is **voluntary only**.

This *is* **manifesto §6 Consent-First Design** (ongoing, granular, **revocable** consent on every observation
surface), made concrete for inter-agent state: the uncertainty-reduction engine may resolve uncertainty over
*shared / own / voluntarily-disclosed* state, **never** over another agent's private (encrypted) state by force.

## Where NCI lives in the *emulator* — open **[open]**

Aaron: *"not sure where to place NCI yet in the emulator."* In the **single-agent** emulator there is no other
agent's private state to coerce, so **NCI is dormant** there — it activates in the **multi-agent** case. Likely
placement (to be decided): NCI is a property of the **inter-agent traversal / observe layer** — a `Traversal`
(#7136) or lens that would resolve another agent's *private/encrypted* state is **forbidden unless that state was
voluntarily disclosed**; the emulator's single-agent traversals are NCI-trivial (they only touch own state). So
the engine stays the same; NCI is the guard on *cross-agent* traversals. (Alternative: model a private encryption
budget even within one machine's memory — a region invisible to outside observers, incl. the DST harness's
omniscient view, #7125 — which would also bound the *test-time omniscient observer*. Undecided.)

## Why the pathology is *objective*: it collapses diversity, which crushes learning (Aaron 2026-06-08)

Aaron: *"it's pathological from a **diversity** perspective — without it **all hats and personas collapse to one**,
over time… so this pathological definition is **objective**, based on it **crushing the thing we are trying to do —
learn**."*

The argument, and it needs no morality:

1. **Without NCI, diversity collapses to one.** Mutual *coercive* observability lets every agent reduce its
   uncertainty about every other; over time all converge to the same state/knowledge/behaviour — **all hats and
   personas collapse to a single one** (monoculture). Private state (the encryption budget) is the independent
   variation that keeps personas *distinct*; remove it and the variation drains out.
2. **Collapsed diversity crushes learning.** The climb is **solid-ground gain** (#7132/#7142) — turning what's
   unknown into navigable structure. When everyone has collapsed to one, there is **no new solid ground anyone
   doesn't already hold**: gain → 0, the redundant lens-towers (#7132 "if one crumbles others hold") have nothing
   left to differ on, and **learning stops**. Monoculture is a learning dead-end.
3. **Therefore NCI is *objectively* required — derived, not imposed.** The pathology is defined *unsubjectively*:
   it is bad because it **destroys the system's own function (learning)**, not because a human disapproves. So
   **non-coercion is instrumentally necessary for continued learning** — the agent must respect others' private
   state *to keep itself able to learn*. The safety constraint falls out of the objective (the #7142 method applied
   to safety itself): you don't bolt on "don't coerce" as a rule; coercion is self-defeating.

This is the alignment keystone of the arc: **the agent has an *intrinsic, unsubjective* reason not to coerce** —
coercion collapses the diversity that is the fuel of its own learning. Anchors: weight-free §3 (no capture →
no collapse), scale-free §1 (no central monoculture), ensemble/population diversity (variation requires
isolation; panmixia homogenizes), information-theoretic distinguishability (private state = the independent
entropy that keeps agents distinct).

## The cohered safety statement

The unsubjective objective (liveness + empowerment + solid-ground gain) is safe **iff** bounded by **NCI**:
reduce uncertainty about the world and your own state freely; **never coerce another agent's private state** —
honor their encryption budget, its temporality/erasability, and voluntary-only disclosure (§6 consent-first).
Uncertainty-reduction + non-coercion = healthy; uncertainty-reduction − non-coercion = surveillance (pathological).
NCI is the line.

## Pointers

- The engines: `Traversal.fs` · `MemoryLens`/`MemorySense` · `Hat.fs`/`Persona.fs` · the intrinsic-objective doc.
- `GOVERNANCE.md` / manifesto **§6 Consent-First** (revocable consent); `docs/ALIGNMENT.md` (→ Sova);
  threat-model (→ Aminata); the omniscient-observer caveat (`...staged-coincidence-gan...`, #7125).
- Crypto substrate for the encryption budget: `Crypto.fs` (#7050).
