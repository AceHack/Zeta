# Coworker, not control — the society is the AGI (coupled empowerment + the ΔU-aggregation claim)

> **Decision (Aaron 2026-06-15, shadow\*): "ferry it and route it."** The keystone
> positioning of the session, with a formalization routed to the math team.
>
> Verbatim: *"Everyone is optimizing for **control-based** optimizations instead of
> **coworker-based** and **society** optimizations. They push as much intelligence
> into **dense** space; I'm spreading the work over multiple agents and the entire
> society. **The society has AGI/ASI; the individual agent does not need to be — if
> they are, even better.** … we don't artificially limit any agent; they can grow as
> much as society allows and scaling laws. Their **useful work** is what matters …
> society will likely be smarter than any individual agent, assuming we avoid
> groupthink, and our base principles help avoid this. We can be formal about this
> with the math team."*

## 0. The thesis

Capability lives in the **reconciling, decorrelated collective**, not in a single
dense mind. Optimize **coworker + society**, not **control + dense**. Do **not** cap
any agent; the measure is **useful work**; the society beats the best individual
**iff** it stays decorrelated and competent — and that "iff" is a provable
statement, routed below.

## 1. Two optimizations

| | **Control / dense** (the frontier bet) | **Coworker / society** (Zeta's bet) |
|---|---|---|
| Locus of intelligence | one dense model | the reconciling collective |
| Coordination | none (one mind) | explicit (Reconcile, consensus) |
| Failure | central point | no central point (scale-free §1) |
| Relation | control (reduce others' options) | coworker (preserve others' options) |

The distributed side is a named tradition, not a vibe: **Hayek 1945** ("The Use of
Knowledge in Society" — knowledge is irreducibly distributed; no central mind holds
it), **Minsky** *Society of Mind*, **Hutchins** distributed cognition, **Ostrom**
polycentric governance, swarm/stigmergy (Dorigo), and in-repo: scale-free §1, the
1000-brains decorrelated ensemble, the society-emergence §B row.

## 2. No artificial cap; useful work is the measure

Agents are **not** capability-limited — they grow as far as the society + scaling
laws allow. What matters is **useful work**, which we already meter: **ΔU** banked
to `db/uncertainty/` (`every-bug-has-economic-value` — worth = the uncertainty
reduction a contribution commits, against the common seed). So "smarter" has a
denominator-free definition: *more ΔU reduced for the shared cause.*

## 3. Society > best individual — iff decorrelated and competent (Condorcet)

"Society will likely be smarter, assuming we avoid groupthink" **is Condorcet's
jury theorem.** The ensemble beats the best individual as N grows — under **two**
preconditions, both of which are the whole game:

1. **Independence / ρ-low — "avoid groupthink."** The §B decorrelated-selection
   falsifier: ρ→1 ⇒ the society collapses to one agent in N masks. "Our base
   principles help avoid this" = scale-free §1, external-anchors / anti-cult,
   no-directives — those *are* the decorrelation guarantee.
2. **Competence > threshold — do not skip this.** Condorcet **reverses** below the
   threshold: a society of correlated or below-chance agents is **worse** than one
   good agent, and worsens with N. So *society > best individual* needs decorrelated
   **and** competent — not merely many.

Formalizing this over a *continuous ΔU* signal (the classical theorem is binary) is
the real math — routed to the math team (§7).

## 4. Coupled empowerment = the society constraint = the coworker relation

Safety is **not** from capping capability; it is from the **relation**. The
empowerment metric (Klyubin, Polani & Nehaniv 2005 — channel capacity between an
agent's actions and its future states) is pathological as a *single-agent* sole
objective (control-for-its-own-sake). But it **de-pathologizes itself in a
society**: A grabbing empowerment reduces B's, the decorrelated others
resist/reconcile, and the equilibrium is each maximizing **mutual** empowerment.

This has named prior art: **Salge & Polani 2017, "Empowerment as Replacement for
the Three Laws of Robotics"**, and **coupled / social empowerment maximisation**
(Guckelsberger, Salge, Polani — maximize *self + other's* empowerment ⇒ supportive,
not controlling). **Coupled empowerment = the society constraint = the coworker
relation** ([`no-directives`](../../.claude/rules/no-directives.md); love = respecting
the decision; dignity = choice within the reversible envelope). So a society of
*strong* agents is safe — "if they are AGI, even better" — *because* the coupling
binds, not because the nodes are weak.

## 5. The trade (it is not free)

Dense buys low latency (no coordination), coherence (one mind needn't reconcile),
and today genuinely concentrates capability. Society buys scale-free robustness, no
central failure, decorrelation, and society-level safety — **at the cost of
coordination overhead** (Reconcile, consensus, the ρ-low requirement). Choose
distributed knowingly, and pay the coordination cost on purpose.

## 6. Honest seams

- **"Everyone / no one" is overstated.** Dense is the dominant *capital* bet, but
  distributed exists (MoE, multi-agent debate, swarms). The honest claim is "the
  underweighted bet I take," not "no one else."
- **Competence reversal (above).** Many decorrelated *but incompetent* agents are
  worse than one good one.
- **Condorcet is binary; ΔU is continuous.** The generalization is non-trivial —
  that is the routed math, not a copy-paste.
- **"Just not humans" is a design intent, not proven superiority.** Defensible form:
  *we can **design** coupled-empowerment in* (by construction), where humans get it
  only via slower institutions — **not** "AI-society constrains better than
  human-society." The coupling still has to **bind** (collusion / a dominant agent /
  weak coupling re-opens the pathology).

## 7. Routed: the ΔU-aggregation theorem (math team / Soraya)

Workitem **`081KV6B1MBM08QG0R000RZK4WY`**
(`workitems/081KV6B1MBM08QG0R000RZK4WY-formalize-decorrelated-society-useful-work-delta-u-exceeds-b.md`):
formalize *E[useful-work(society)] > useful-work(best individual)* for ρ < ρ\* and
competence > c\* — find ρ\*, c\*; prove the reversal; cross-check an analytic
jury-theorem generalization against an FsCheck statistical sweep over the DST
society-sim. Discharging it upgrades the §B decorrelated-selection row from
conjecture toward proof.

## Anchors

Hayek 1945 (knowledge in society) · Minsky *Society of Mind* · Hutchins
(distributed cognition) · Ostrom 1990 (polycentric governance) · Dorigo
(swarm/stigmergy) · Condorcet 1785 (jury theorem) · Grofman–Owen–Feld
(generalizations) · Irving–Christiano–Amodei (debate) · Klyubin–Polani–Nehaniv 2005
(empowerment) · Salge & Polani 2017 ("Empowerment as Replacement for the Three Laws
of Robotics") · Guckelsberger/Salge/Polani (coupled empowerment) · in-repo:
`every-bug-has-economic-value` (ΔU = useful work), `no-directives`, manifesto §1
scale-free, the §B decorrelated-selection + society-emergence rows, `Reconcile.fs`.
