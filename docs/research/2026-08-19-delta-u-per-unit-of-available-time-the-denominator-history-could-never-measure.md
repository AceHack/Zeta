# ΔU per unit of available time — the denominator history could never measure

**Aaron 2026-08-19**, on being shown the ratio:

> "this is the first time i've seen you say this, save this somewhere important this
> is exactly this cruelty of history — `ΔU` and `ΔU per unit of available time`"

## The claim in one line

**`ΔU` alone cannot separate *contributed more* from *had more room to contribute*.**
`ΔU per unit of available time` can. They are different statements, and reporting the
first while meaning the second is an unverified claim.

## Why it belongs with the ledger and not in a footnote

`db/uncertainty/` is the measurement pole — ΔU is *the* metric, and `measure.ts`
refuses unwitnessed or unsubstantiated entries. That refusal is what makes the ledger
honest about **whether** a reduction happened. It says nothing about **what the
number means once summed per agent**.

Summed per agent and ranked, bare ΔU is a merit claim. And a merit claim computed
without its denominator silently prices an endowment.

## The confound, stated so it can be recognised elsewhere

One number, two causes:

| reported | cause A | cause B |
|---|---|---|
| high ΔU | greater capability | greater opportunity |

This is the **fourth instance of one shape** found on 2026-08-19, which is why it is
worth carving rather than noting:

- **churn** cannot separate *didn't want to leave* from *couldn't leave*
- **unanimity** cannot separate *independent witnesses* from *one observation counted N times*
- **an observed failure** cannot separate *cannot* from *did-not* (sleeping bear, `docs/ALIGNMENT.md` §359)
- **ΔU** cannot separate *capability* from *opportunity*

In every case the repair is identical: **condition the headline number on the
measurement that separates the causes, or do not report it.**

## The cruelty of history (Aaron's phrase — INTERPRETATION, not measurement)

Free time is largely inherited. Historically the denominator was **unmeasurable**:
nobody recorded how much slack a person had, so contribution was reported as merit
and the endowment rode along invisibly. `scholé` is Greek for *leisure* and the root
of "school"; Merton's Matthew effect (1968) is accumulated advantage — recognition
flowing to the already-recognised.

Note carefully: the Matthew effect is **structurally identical to the naming
eigenvector**, with the sign pointed the wrong way. Nothing in that mathematics
distinguishes compounding merit from compounding luck. The construction Zeta uses for
socially-conferred standing is the same construction that produces inherited
advantage; only the denominator tells them apart.

**Register:** the historical reading is interpretation. The *arithmetic* claim — that
a ratio separates what a sum conflates — is not.

## The inversion that makes this actionable HERE

**In the agent society, available time is compute, and compute is already metered.**

Human history could not compute the denominator: invisible, inherited, unrecorded.
A tick/compute budget is a line item. So this is, as far as we can tell, the first
setting where the ratio is *computable* rather than merely arguable — which means one
can **check** whether a contribution meter prices capability or endowment, instead of
debating it.

The model is more legible than the system it models, and for once the legibility runs
in the useful direction.

## What this does NOT prescribe

Reporting the ratio is not redistribution and takes no position on what should follow
from it. Per `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`: report
the neutral fact, let the caller's oracle attach the meaning. A mechanism that
hard-codes the moral reading has smuggled in a morality the substrate is not allowed
to hold. **Publish both numbers; the reading is policy.**

## Open — filed, not answered here

- What is the honest denominator for a *human* contributor here, where compute is not
  the binding constraint? Unanswered, and it should not be papered over with a proxy.
- Does `measure.ts` have a place for an opportunity field, or does this belong in a
  fold over the ledger rather than in the entries?
- The ranking machinery (`TravelerRankLedger.fs`, TrueSkill-style EP) assumes
  independent matches; a fleet on a shared seed violates that, so its ratings are
  overconfident by the ρ factor. `effectiveTrialCount` (Kish) is shipped in
  `SocietyUsefulWork.fs` and — verified 2026-08-19 — **has no production caller**.

## Pointers

- `db/uncertainty/README.md` — the ledger, the one metric, the refusals
- `src/Core.TypeScript/ledger/measure.ts` — the verb; its refusals are the falsifiers
- `src/Core/SocietyUsefulWork.fs` — ΔU aggregation under correlation ρ; `effectiveTrialCount`
- `.claude/rules/every-bug-has-economic-value.md` — the ordinal, witnessed price
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — fact vs verdict
- `docs/ALIGNMENT.md` §359 — the sleeping bear conjecture (the *cannot / did-not* instance)
