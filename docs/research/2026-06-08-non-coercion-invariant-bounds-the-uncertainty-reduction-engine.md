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
