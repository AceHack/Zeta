# From First Principles (podcast) — Claude on the Riemann hypothesis: reference record

**Filed:** 2026-08-16 · **Filed by:** Otto (shadow) · **At Aaron's instruction:** *"save this to
ip questionable."*

## Why this is a reference record and not a transcript

Aaron forwarded a long verbatim transcript of a third-party podcast episode (with a YouTube
auto-transcript). **The transcript body is deliberately NOT reproduced here.** It is
third-party copyrighted material, and this directory's purpose is to *quarantine and flag*
such material, not to launder it into the repo. What is recorded is the citation, the factual
claims relevant to us, and their register — which is what we would actually cite.

- **Source:** *From First Principles* podcast, episode 53. Hosts: Lester Narre (host) and
  Krishna Chowdery ("resident PhD").
- **URL:** https://www.youtube.com/watch?v=C-ECTnM7tUY
- **Segment:** "Has AI reached a mathematical singularity?" — Claude's reported progress on a
  bound related to the Riemann hypothesis, plus a second unrelated segment on scientists
  relocating from US institutions.

## Claims made by the episode — recorded as CLAIMED, not verified

**We have not independently verified any of the following.** They are third-party reporting
about an unreleased model, sourced from an announcement by the vendor. Register: **claimed**.

| claim | status here |
|---|---|
| An unreleased Claude model raised the proven lower bound on the proportion of non-trivial zeros on the critical line from ~41.7% to ~67.25% | **claimed** — not verified by us |
| The prior record was Levinson 1974 (~34%) → Conrey 1989 (~40%) → ~41.7% (2022) | **historically consistent** with the standard literature |
| The work was orchestrated across ~60 sub-agents, ~2400 shell commands, ~31M output tokens, 54 arXiv papers | **claimed** |
| It was prompted by a non-mathematician with encouragement ("believe in yourself") | **claimed** |
| The result was checked in Lean 4 and reviewed by a mathematician | **claimed** |
| The method reportedly **cannot** reach 100%, so it does not resolve RH | **claimed, and the important caveat** |
| The Riemann hypothesis remains **unsolved** | **true** |

**Our epistemic position:** this assistant's training data ends before these events, so nothing
above can be confirmed from prior knowledge. Anyone citing this must check primary sources —
the vendor's own writeup and any Lean artifact — before treating the numbers as fact.

## The mathematics that IS solid, and is worth taking

Independent of the AI claims, the episode's exposition tracks the standard history correctly,
and these anchors are legitimately citable:

- **Euler 1735** — the Basel problem, ζ(2) = π²/6; and the **Euler product formula**, a sum over
  integers ≡ a product over primes.
- **Gauss** — the prime-counting heuristic π(n) ~ n/log n.
- **Riemann 1859** — analytic continuation, the functional equation, the critical strip, and the
  hypothesis that the non-trivial zeros lie on Re(s) = ½.
- **Hadamard / de la Vallée Poussin 1896** — the prime number theorem.
- **Hardy 1914** — infinitely many zeros on the critical line.
- **Selberg 1942** — a *positive proportion* on the line (Fields Medal 1950).
- **Montgomery 1973 + Dyson** — pair correlation of zeros matching random-matrix statistics for
  heavy nuclei. **This is the anchor directly relevant to our code.**

## Why this matters to us at all

The Montgomery–Dyson thread is the lineage of **Berry–Keating** (H = xp), which we already have a
check for at `src/Core.TypeScript/oracle/berry-keating-spectral-check.ts` — correctly held at §B,
explicitly unproven. The companion doc filed with this one audits every "zeta" in the repo by
register and explains why the shared 1/12 is *weaker* support than it looks.

**Standing caution.** An "AI made progress on RH" story is exactly the kind of high-resonance
result the coincidence-index discipline warns about: it feels confirming of the whole
society-of-agents bet, which is a reason to check it harder, not to cite it faster. It is filed
here as an interesting third-party claim, and nothing in the repo may rest on it.

## Pointers

- `docs/research/2026-08-16-zeta-across-domains-the-finitizer-table-and-a-register-audit-of-our-own-zetas.md` — the companion audit
- [`numerology-vs-number-theory.md`](../../../.claude/rules/numerology-vs-number-theory.md) — "too many correlations is a warning, not a confirmation signal"
- [`anchor-to-human-prior-art.md`](../../../.claude/rules/anchor-to-human-prior-art.md) — anchors must be *checked*, not merely cited
- [`toy-is-free-metered-must-be-earned.md`](../../../.claude/rules/toy-is-free-metered-must-be-earned.md) — claimed ≠ metered
