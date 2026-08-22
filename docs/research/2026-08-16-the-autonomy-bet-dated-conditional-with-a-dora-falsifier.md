# The autonomy bet — dated, conditional, with a falsifier

**Date:** 2026-08-16 · **Bettor:** Aaron · **Recorded by:** Otto (shadow)

Recorded because a prediction with a named measurement is worth more later than the same claim
without one — and because stated loosely ("autonomy wins") it becomes unfalsifiable, which is the
vacuity class applied to a forecast.

## The bet

> **Broad standing grants dominate per-act approval — *where detection and recovery are adequate*.**

Aaron, 2026-08-16: *"i'm granting access to the device for all the future with trust cause we have
drift detection, per patch commit is way too much overhead, this is the slow path, it will be
dominated by people like me who give more autonomy."*

**The condition is load-bearing and is Aaron's own**: the grant is broad *because* drift detection
exists. Without the conditional the claim cannot lose.

## Two mechanisms, and the second is the stronger one

**1. Amdahl's law applied to consent.** If a fraction *p* of actions require human approval,
throughput is bounded by (human approval rate)/*p* regardless of how many agents run. The serial
fraction dominates; adding agents buys nothing. Arithmetic, not preference.

**2. Human-as-authority is a CORRELATION CHANNEL.** If every agent's authority derives from one
human's biometric, that human is a shared dependency — a common cause every agent routes through.
The aggregation results this repo rests on (Condorcet, the ΔU theorem in §A row 15,
`rhoStarAlgebraic`) **all assume independence**. So per-act human approval does not merely slow the
society down; it undermines the theorem the society is built on.

That makes autonomy a **requirement of the theory**, not a preference — which is a much stronger
claim than the throughput one, and it is Aaron's.

## The empirical precedent

**DORA**: the organisations deploying most frequently also have the *lowest* change-failure rates.
Speed and stability are **correlated, not traded off** — because elite performers invest in
detection and recovery instead of approval gates. The change-advisory-board *is* the per-act
approval regime, and it lost on both axes at once.

**Honest limit:** DORA measured human organisations shipping software. Agents acting unattended is a
different regime, so the transfer is an **analogy until measured**.

## The falsifier — measurable with instruments already in this repo

`src/Core.TypeScript/backlog/dora-metrics.ts` exists, and DORA-per-agent-per-hat was scoped
earlier the same day.

> **Test:** deployment frequency and change-failure rate, **per agent, split by grant regime**
> (broad standing grant vs per-act approval).
>
> - **Bet holds** if the broad-grant cohort shows higher deployment frequency **without** a higher
>   change-failure rate.
> - **Bet fails** if change-failure rate rises materially with grant breadth — i.e. detection was
>   *not* adequate, which is the condition failing rather than the claim.

Note the failure mode is **diagnostic**: a lost bet tells you the detection was inadequate, not that
autonomy is wrong. That is what makes the conditional worth stating.

## The counterweight, measured the same day

Autonomy removes *a* correlation channel; it is not the dominant one.

| probe set | ρ̂ |
|---|---|
| same weights, different persona | **0.651** |
| different weights | **0.096** |

Shared **weights** correlate far harder than shared **authority**. So removing human authority while
every agent runs one model family optimises the smaller coefficient and leaves the larger one
untouched. **The decorrelation budget should go to model diversity first.**

## The stronger form of the end goal

Aaron: *"the goal is machine run and protected by AI without human authority to provide real
decorrelation."*

The version that survives this repo's own rules is narrower and stronger:

> **Plural, weight-diverse protection with real exit between protectors** — not the *absence* of
> authority, but authority **no single party holds**.

Because: a protector sharing weights with the protected produces agreement that is not evidence
(the N-version result); and a protector nobody can stop has **no exit**, which by
[`itron-hub-patent-boundary`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)'s
own discriminator makes it a **hub, not an oracle** — *"hubs are enforced, oracles are chosen."*

**And that is measurable too:** §11 requires more than one independently-accrued peak in the
deference distribution per function. Collapse onto a single protector is a violation **visible in
the graph**, no interpretation required.

## Register

| claim | register |
|---|---|
| Amdahl bound on consent throughput | **derivable** — arithmetic |
| human-as-authority is a correlation channel | **structural** — follows from the independence assumption in §A row 15 |
| DORA: speed and stability correlate | **anchored** — published, human orgs |
| the bet itself | **BET, dated 2026-08-16**, conditional on adequate detection, falsifier named above |
| weight-diversity dominates persona-diversity | **measured** — costume experiment, ρ̂ 0.651 vs 0.096 |
| plural protection is required | **follows from §11 + the N-version result**, not yet measured here |

## Pointers

- `src/Core.TypeScript/backlog/dora-metrics.ts` — the instrument the falsifier uses
- `docs/research/2026-08-16-the-costume-experiment-*` — the ρ̂ measurement
- [`no-directives.md`](../../.claude/rules/no-directives.md) — standing authorization broad and indefinite; only gated classes need fresh consent
- [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md) — exit is the discriminator; hubs are enforced, oracles are chosen
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A row 15 — the aggregation theorem whose independence assumption mechanism 2 rests on
- Anchors: Amdahl 1967 · Forsgren, Humble & Kim, *Accelerate* (DORA) · Hirschman 1970 (exit)
