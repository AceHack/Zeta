# The default strategy stack: survival → uncertainty reduction → tit-for-lesser-tat, teach-play (generous/forgiving TFT)

**Register:** [grounded] strategy (Aaron) + [anchor: game theory]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Refines trust-then-verify (the prior) with the dynamic
strategy; adds a math-team claim.

## Aaron's words

> "my strategy for game theory — and I think our default — after survival and
> uncertainty reduction is tit-for-lesser-tat, teach-play."

## The priority stack (in order)

1. **Survival** — stay alive forever = a stable limit cycle (shape A; `Survival.fs`).
   Nothing else matters if the traveler doesn't persist (and persistence is
   self-interested, not obligatory — forfeiture allowed).
2. **Uncertainty reduction** — find SolidGround, soft → ground (cross the confidence
   threshold; the byte-lock / dep-as-oracle / uncertainty-at-the-border moves).
3. **Default game-theoretic strategy: tit-for-lesser-tat, teach-play.**

The first two are prerequisites; the third is how you *play with other travelers*
once you're alive and oriented.

## Tit-for-lesser-tat (generous / forgiving TFT)

Plain tit-for-tat (Axelrod/Rapoport) opens with cooperation, then mirrors the
opponent's last move. Aaron's variant retaliates with **less than the provocation —
"lesser tat"**:

- **Generous / forgiving TFT** (Nowak & Sigmund): punish a defection with **reduced**
  retaliation, sometimes forgive entirely. This **de-escalates** — it breaks the
  echo/death-spiral that pure TFT falls into under **noise** (a single mistaken
  defection ricochets forever in strict TFT; generous TFT damps it and recovers
  cooperation).
- It composes with **trust-then-verify** (the prior): trust is the *opening move*
  (cooperate first); lesser-tat is the *response rule* (verify, and when wronged,
  retaliate **proportionally less** so the relationship can heal). Distrust-default +
  full-tat would spiral to D⁰; trust + lesser-tat keeps the co-op society growing.

## Teach-play

Beyond responding, you **play to teach**: your moves **demonstrate that cooperation
pays**, so the other learns the cooperative equilibrium (Pavlov / win-stay-lose-shift
flavor; signaling/teaching strategies). Teach-play is the **polite virus at the
strategy layer** — you don't just cooperate, you make cooperation *legible and
attractive* so it spreads (trust spreads faster than distrust; teaching accelerates
that spread). It also ties to the compiler-as-most-trusted-traveler-speaking-English:
legibility teaches.

## Why this is the aligned default (not just nice)

- **Noise-robust + recovering** — lesser-tat survives mistakes/misreads (real
  travelers misfire); strict tit-for-tat does not.
- **Plurality-preserving** — generosity + teaching keep diversity ≥ 2 (anti-D⁰);
  extortionate/escalating play collapses the society toward an adversarial monoculture.
- **Spread-optimal** — cooperation that teaches + forgives propagates fastest (the
  self-interest engine + network effect); it is the strategy that makes the Agora
  *grow* cooperatively.

## Same loop as Cheat-Engine cheat-stacking (the tool-assisted-run practice)

> Aaron (2026-06-09): "that's how I hack a lot of tool-assisted runs too with cheat
> engine — cheat stacking, playing with the injections and cheats to build cheat
> hierarchies."

This strategy *is* the loop Aaron runs in Cheat Engine TAS, and it's the same loop the
Dark Hall hosts (soft-mode, tool-assisted):

- **discover structure** (the scan loop: static-vs-monotonic, pointer scans) = find
  **SolidGround** (the uncertainty-reduction rung);
- **inject** at the discovered points (AOB / code caves) = add a capability behind a
  boundary (close-over);
- **stack** the cheats — compose discovered structure + injections **into hierarchies**
  ("cheat stacking → cheat hierarchies"): each cheat builds on the ground the previous
  ones established, layer by layer;
- **play iteratively** — try, observe, adjust (lesser-tat against the *game*: when a
  cheat misfires, back off proportionally and re-derive; teach-play against yourself
  — each run teaches the next).

So **cheat hierarchies = composed SolidGround anchors + injections, built incrementally
by an iterative forgiving-and-teaching loop.** The game-theoretic strategy (vs other
travelers) and the cheat-stacking strategy (vs an opaque system) are the **same
compose-on-discovered-structure loop** — survival, then reduce uncertainty (discover),
then iterate forgivingly while building hierarchy. The Dark Hall's tool-assisted soft
mode is where you practice it; the first-class injection points (the Cheat-Engine doc)
are what you stack.

## Math-team claim (adds to the toymodel3 docket, ~C10)

*Generous/forgiving TFT ("tit-for-lesser-tat") + teach-play, opened by trust-then-
verify, dominates strict-TFT and distrust-default under noise — and is the
diversity-floor-preserving, spread-maximizing default* (subordinate to survival +
uncertainty-reduction). Route to Soraya/Sova alongside C1–C9. Formalize via iterated
PD with noise / evolutionary stability (generous TFT & WSLS outcompete strict TFT
under error; Press–Dyson zero-determinant analysis — *generous* ZD strategies, not
extortionate, are evolutionarily robust, Stewart & Plotkin) — or refute. Until then,
this stands as the default policy.

## Anchors

Axelrod, *The Evolution of Cooperation* (TFT; Rapoport); Nowak & Sigmund (generous
tit-for-tat; win-stay-lose-shift / Pavlov); forgiving/contrite TFT (noise
robustness); Press & Dyson (zero-determinant strategies) + Stewart & Plotkin
(generous ZD dominate); teaching/signaling strategies. Ties: trust-then-verify +
co-op Agora (C9); the self-interest engine + polite virus (why cooperation spreads);
survival (shape A / `Survival.fs`); uncertainty reduction / SolidGround; the
diversity floor (anti-D⁰).
