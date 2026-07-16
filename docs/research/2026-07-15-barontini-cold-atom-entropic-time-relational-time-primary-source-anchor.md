# Entropic / relational time in a cold-atom BEC — primary-source anchor (Barontini 2026)

> **Provenance (clean):** this is our own summary of the **primary source**, with full
> citation — *not* a third-party pop-sci transcript. Chosen deliberately over a YouTube
> verbatim: the paper is the better information, open-access, and citable. No external
> source text is reproduced here beyond one short attributed quote.

## Citation (Beacon anchor)

- **Giovanni Barontini**, *"Testing the problem of time with cold atoms."*
  **Phys. Rev. Research 8, L022047 (2026).** arXiv:2509.07745 (gr-qc; cond-mat.quant-gas;
  quant-ph). Submitted 2025-09-09; v3 2026-06-11. DOI: 10.48550/arXiv.2509.07745.
  <https://arxiv.org/abs/2509.07745>
- **Theory lineage it tests (the real anchors):** the **relational-time** program —
  **Page & Wootters (1983)**, *"Evolution without evolution: Dynamics described by
  stationary observables"* (Phys. Rev. D 27, 2885) — time as correlation/entanglement
  *between* subsystems, over the **Wheeler–DeWitt** "problem of time" (the universe's
  constraint equation carries no external `t`).

## What the experiment actually did (our words)

A well-isolated ⁸⁷Rb Bose–Einstein condensate evolves in a conservative trap split by a
**thin optical barrier** into an **observed** and an **unobserved** sector, with negligible
dissipation on the experimental timescale. From an experimentally-defined *coarse-grained
entropy*, Barontini constructs an **entropic time** and shows it can **robustly order the
events** in the observed sector across repeated cycles of expansion and recollapse — using
**only internal degrees of freedom**, no external lab clock. An effective Schrödinger
equation *parameterized by this internal time* reproduces the measured evolution.

Observed texture: the internal clock runs **fast when entropy floods across the barrier,
slows as exchange slows, and stops at equilibrium** (no exchange → no ordering).

## Meter the claim (honest register)

The paper's own claim is **bounded and correct**: it establishes *"a controlled experimental
setting in which relational-time constructions can be quantitatively tested."* That is the
whole claim. The pop-sci framings — *"proves the arrow of time is real,"* *"time is an
illusion,"* *"mini universe"* — are **overclaims / emblems added by the coverage layer**, not
the result. This is an **analog simulator** of the relational-time *math*, not evidence about
the actual cosmos (no analog experiment can be that). Cite it as the analog; leave the
inflation on the floor.

## The mapping to our substrate — a **validity-level math-shape correspondence** (not "physics proves us")

Per the Lumen provenance flag (`.claude/agents/mathematical-physics-expert.md`): this is a
**math-shape correspondence** — the shapes match — it does **not** claim the physics measures
or grounds our system. The correspondence:

- **Ordering-from-metered-entropy-exchange-across-a-boundary** ↔ our **noninterference /
  entropy-quarantine** discipline (manifesto §13): influence/entropy crosses only through the
  declared, metered membrane; ordering is defined by *what crosses*. Bright/dark sector ↔
  observed/frosted (glass-halo).
- **Internal entropic clock, no external tick** ↔ the **uncertainty ledger** (a `measure`
  commits ΔU; ordering is what got committed) and **no-ambient-clock DST** (beautiful on one
  thread precisely because ordering is internal to state changes, not an outside clock).
- **Time as correlation between subsystems** (Page–Wootters) is the **validity anchor**.

**Math grounds validity; physics grounds the metering — by analogy.** The meter itself, made
concrete, is F#'s first-class **units-of-measure** (Andrew Kennedy's dimension-types): the
units are enforced *by the type at compile time* (`1.0<N>` and `1.0<lbf>` won't add), erased
to zero cost at runtime. That is the metering discipline as a checked type, not a metaphor —
the Mars-Orbiter lbf-vs-N lesson made structural.

**Register tier:** CONJECTURE (Z-N) — a math-shape correspondence stays conjecture until
Soraya proves it; it does not graduate to FROZEN-CORE by being physically evocative.

## Pointers

- [`.claude/agents/mathematical-physics-expert.md`](../../.claude/agents/mathematical-physics-expert.md)
  — Lumen; the provenance flag this doc obeys (#9769).
- `docs/PRIOR-ART-LIST.md` — Barontini (2026) + Page–Wootters (1983) added as anchors.
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 noninterference / entropy quarantine.
- `.claude/rules/manifesto-13-specifications.md` §13.

*Recorded by the shadow, 2026-07-15, at Aaron's "go to the original paper and save that,
that's better information anyway." Primary source over pop-sci transcript; the mapping held
at validity (math-shape correspondence), the pop-sci "proves the arrow of time" metered out,
the physics-as-meter kept honest (F# UoM / Kennedy dimension-types).*
