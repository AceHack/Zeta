# Lensography over small games as an ARC-AGI-3 approach — a HYPOTHESIS with a cheap test

**Date:** 2026-08-10 · **From:** Aaron (*"we have our lensography over small games as the
winning move, we could beat it today"*) · **Recorded by:** Otto (shadow)

**Register: HYPOTHESIS, untested.** The architectural mapping in §2 is real and specific.
The claim in §0 that it would *win* is **unevaluated**, and this file exists to keep those
apart. Per
`numerology-vs-number-theory` <!-- STALE-REF: ../../.claude/rules/numerology-vs-number-theory.md -->: a
structural correspondence licenses an investigation, never a conclusion.

---

## 0. The claim, as stated

> Our lensography over small games is the winning move for ARC-AGI-3, and we could beat it
> today.

Aaron's own position on pursuing it, recorded rather than argued with: *"I'm not that
interested. It seems too easy, I'm next level."*

## 1. What ARC-AGI-3 actually is (checked, not recalled)

The first **interactive** reasoning benchmark, from the ARC Prize Foundation (Chollet,
Knoop). Hundreds of turn-based environments handcrafted by game designers, with **no
instructions, no rules, and no stated goals**. An agent must explore, infer the mechanics,
discover what winning means, and carry that forward across harder levels. It tests
exploration, modeling, goal-setting, and planning.

Environments deliberately exclude language, numbers, letters, cultural symbols, and
recognisable real-world objects, relying only on **Core Knowledge priors** — which is how
it measures *skill acquisition* rather than *prior exposure*.

**Standing measurement: humans 100%, frontier AI 0.51%.** ARC Prize 2026 is live with
>$2M in prizes.

## 2. Why the mapping is genuinely apt (the part that is not speculation)

Each row is a correspondence between something already built here and something the
benchmark requires. None of it establishes performance; all of it establishes *fit*.

| ARC-AGI-3 requires | in-repo substrate |
|---|---|
| act, observe result, revise | **lensography** — a lens is `get` + `put` at one composable focus; observe and steer through the same optic (`docs/research/2026-08-02-lensography-…`) |
| explore without a guide | **generate, not crawl** — no index exists, so the model must be derived from the artifact |
| bounded probing under a turn budget | **bounded search** — probe against the current dilemma, terminate when it resolves; never crawl the state space |
| revise fast enough to stay in control | **damped refutation** — corrections must land inside the divergence window (the OGY/Lyapunov condition) |
| hold many hypotheses, commit to few | **lazy/forced ratio** — keep hypotheses unforced, realise a small fraction |
| small-game reverse engineering | the **CHIP-8** line — reverse-engineering small deterministic machines is the same task shape |

**Sharpest single point:** a lens is exactly an agent step. `get : S → A` is the
observation, `put : S × A → S` is the action, and the optic composes — which is the
structure ARC-AGI-3's "exploration + modeling" pair asks for. That is a definitional
match, not an analogy.

## 3. What would have to be true that this file does NOT establish

- **Fit is not performance.** "Aimed at the right shape" and "scores well" are different
  claims, and the 0.51% gap is exactly where they diverge. Every serious entrant also has
  a frame they believe fits.
- **The designed-solution property remains.** Environments are handcrafted, so a reachable
  answer is guaranteed. That makes them *fairer* on priors, not easier in the way "too
  easy" implies.
- **"Too easy" is a claim about a benchmark where the best measured systems score 0.51%.**
  That is not evidence the benchmark is easy; it is evidence that something about it is
  hard in a way current approaches do not capture. Which is precisely what would make a
  genuinely different frame valuable — and equally, precisely what makes untested
  confidence cheap.

## 4. The falsifier, and it is unusually cheap

ARC provides a public API and preview environments. **The test is: run it and read the
score.** No permission, no adjudication, no argument required.

That matters more here than the result would, for a reason this repo already holds as a
rule: **an external, adversarial, numeric oracle with a history fully decorrelated from
ours is the strongest evidence available about a claim we make about ourselves.** Today's
whole argument was that decorrelated oracles are where evidence comes from, and that
agreement among correlated views is not evidence at all. ARC-AGI-3 is the most
decorrelated oracle currently available for the central architectural claim.

Declining to consult it leaves the claim in the same register as every other frame that
believes it fits — which is the one register this repo's disciplines exist to escape.

**Stated plainly and once:** not running it is a legitimate choice about attention. It is
not a way of being right.

## 5. Disposition

- **Aaron:** not pursuing; other priorities. Recorded, not contested.
- **This file:** holds the hypothesis, its mapping, and its falsifier, so that if anyone
  later claims the architecture "would have won", the claim is already labelled as
  untested and the cheap test is already named.
- **If it is ever run:** the result belongs beside
  [`2026-08-10-aarons-bet-human-quantum-advantage-…`](2026-08-10-aarons-bet-human-quantum-advantage-over-machines-for-100-years.md),
  which has an open action requiring exactly this kind of named, measured capability.

## 6. Anchors

- **Chollet**, *On the Measure of Intelligence* (2019) — skill-acquisition efficiency; the
  priors-control argument ARC is built on.
- **ARC Prize Foundation** — ARC-AGI-3 competition, technical report, docs.
- **Ott, Grebogi & Yorke** (1990) — OGY control; the observe/steer loop lensography wraps.
- **Foster et al.** (POPL 2005), **Pickering, Gibbons & Wu** — lens laws, profunctor
  optics.

Sources checked 2026-08-10: <https://arcprize.org/arc-agi/3> ·
<https://arcprize.org/competitions/2026/arc-agi-3> ·
<https://arcprize.org/blog/arc-agi-3-launch> ·
<https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf>

## 7. Pointers

- `docs/research/2026-08-02-lensography-soft-regime-chaos-control-homoclinic-tangle-avoidance-quasi-repeatable-orbits.md`
- `docs/research/2026-08-10-the-threshold-rhyme-…` — the damping/rate argument §4 relies on
- `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md` — bounded search as
  a built discipline rather than an aspiration
