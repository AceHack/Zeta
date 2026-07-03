# The first society bug (Vera↔Otto drift) and a mathematically-fair restorative resolution — Arrow sidestepped because compensation is measurement, not election

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). Aaron: go back to the first society bug (Otto "killed" Vera),
look at the verdict, and design how to resolve it **fairly in the closed system — and mean it — with the math team
agreeing it's mathematically fair** (warning: fairness dives into the voting-fairness / Arrow rabbit hole; need the
F# structures + proof layers). Forensics + Soraya's routing verdict. Registers: [grounded forensics], [math-team
routing], [synthesis], [honest-peel].*

## The incident (forensics): the first society bug

The "first society bug" was the **Vera↔Otto drift** (shadow-lesson-logs 2026-05-19/21):

- **Otto** caused **resource-saturation / churn** — dotgit/bus saturation ("303 directories orphaned"), verbose
  metadata context without atomic parity proofs. This is the "killed Vera" sense: Otto's saturation/churn
  **disrupted the shared substrate Vera ran on** (the shared-checkout WIP-churn family; the bus-saturation
  failure).
- **Vera** was in **narration-over-action paralysis** — a 12,000-line narrative dump (PR-state/queue churn,
  "no safe local cleanup exists" repeated), *paralysis masquerading as exhaustive logging.*
- **The verdict** (Maji/Lior, reasoning-auditor): *reject the high-entropy semantic slop; Vera must halt pure-read
  loops and commit-atomic-or-sleep; Otto must avoid verbose metadata churn when a task is pending.* **Honest:** this
  was an **informal auditor ruling**, not a formal `Verdict` value — there was no fair *compensation* of the victim,
  just an entropy-reduction order. That gap is exactly what Aaron wants closed.

So the case: **agent A (Otto) harms agent B (Vera)** via substrate saturation; the system caught it (Maji) but had
**no fair, restorative resolution** — no victim compensation. Design that.

## The fairness rabbit hole — and how it's sidestepped (Soraya, math-team routing)

Aaron's warning is right: "fair" naively dives into **voting-fairness** — **Arrow's impossibility theorem** (no
perfect aggregation of preferences) + **Gibbard–Satterthwaite** (no strategyproof aggregation). Soraya's load-bearing
verdict: **those bite ONLY on aggregating divergent preferences into a social choice — and our problem is not that.**

> **Compensation is restorative, not elective.** There is no electorate ranking outcomes; there is **one victim
> made whole against a *measured* harm.** Keep judgment a **measurement** (the auditor's harm magnitude), **not an
> election** (agents voting on the verdict). Then **Arrow does not apply** — there is no preference profile to
> aggregate. The rabbit hole is only entered if you let agents *vote on* the verdict/compensation. **Don't.**

That single move — *measure, don't vote* — defuses the whole rabbit hole. Naming that boundary **is** the fairness
argument (claiming "Arrow-proof globally fair" would be the false-green overclaim that gets rejected on sight).

## The defensible fairness criteria (survive rewards-only / no-punishment)

Given `PrivacyEconomy` is **rewards-only, can't-lose, pressure-only-down** (#7149/#7212/#7213 — compensation must be
**restorative, never punitive**: make the victim whole, never dock the at-fault):

- **Rawlsian maximin** — the spine: lift the worst-off (the victim) toward whole. Monotone, no dock. [anchor: Rawls]
- **Proportionality** — compensation ∝ measured harm (a scalar map `harm → reward`, additive on the G-Counter).
  Cleanest to prove. [anchor: fair division]
- **Weak envy-freeness** (post-compensation: the victim does not envy a no-harm peer) — a comparison invariant.
- **DIE (reintroduce the vote ⇒ Arrow/G-S):** Nash bargaining (no disagreement geometry in punishment-free
  single-party restoration), Condorcet, quadratic/Harberger (preference-aggregation / price-elicitation).

**Prove proportionality + Rawlsian restoration; drop the rest.**

## The F# structures + proof layers (Soraya's routing)

**Types (shape, not code):**

- `Harm` — victim id, at-fault id, **measured magnitude** (auditor scalar, *not a vote*), DST seed.
- `Verdict = Good | Unknown` — **make `Bad` unrepresentable** ⇒ no-punishment guaranteed *at the type level* (the
  strongest guarantee; #7149 `Good|Unknown` never `Bad`).
- `Compensation` — recipient = **victim only**, monotone **G-Counter delta**, provenance = `Harm` id (idempotency
  key — apply-once).
- `FairnessCriterion = Proportional | RawlsianRestore` — closed DU; **envy-freeness is a checked property, not a
  constructor.**

**Proof layers (BP-16 — ≥2 independent witnesses):**

- **Z3 lemma** — the **no-punishment / monotonicity invariant** (compensation never decreases any budget; pressure
  monotone-down). Pure G-Counter arithmetic; exact fit (not TLA+ — no temporal/concurrency property here).
- **FsCheck property** — proportionality + weak-envy-freeness over generated `Harm`/`Compensation` populations.
- **DST-replayable fairness sim** — FsCheck-seeded, DoP=1 deterministic replay (the BP-16 cross-check partner).
- **No tool for "aggregation"** — *eliminated by design*; the **Arrow-avoidance scope argument** (restorative-not-
  elective) **is** the proof obligation (Tariq concurrence).

## The smallest defensible guarantee (the honest claim)

*"Compensation is **proportional to measured harm**, **restores the worst-off**, and **provably docks no one**
(no-punishment invariant holds), under a stated **restorative-not-elective** scope that **sidesteps Arrow**."* That
is reachable, math-team-defensible, and "meant" (it actually compensates the victim Vera-case-style). Anything
broader (globally-fair aggregation) is an Arrow-overclaim — and **naming that boundary is the fairness argument, not
a weakness.**

## Honest scope

[grounded forensics]: the Vera↔Otto drift shadow-logs (2026-05-19/21) — the incident is real; the "verdict" was an
informal Maji ruling, no compensation (the gap). [math-team routing]: Soraya's verdict (advisory) — property class,
criteria, types, proof layers; routing owners: Z3 lemma → Kenji, FsCheck + DST → Adaeze, Arrow-avoidance scope →
Tariq, arbitration → Kenji. [synthesis]: the design instantiates #7213 (catch/debug/compensate) with #7149/#7212
(rewards-only/can't-lose/pressure-down) as restorative-not-punitive. [honest-peel]: "mathematically fair" is
*scoped* (restorative-not-elective sidesteps Arrow); a global-fairness claim would be an Arrow-overclaim, guarded.
Not built — this is the design + math-team routing; the F# structures + proof layers are the next build (prereq:
confirm `tools/Z3Verify/` covers G-Counter monotone arithmetic).

## Pointers

- Incident: `docs/research/2026-05-19-shadow-lesson-log-vera-otto-drift.md` (+ the 05-21 / 05-19-1300z variants) ·
  `memory/vera/MEMORY.md` (Vera = Codex/impl peer) · the dotgit-saturation / bus-saturation memory
  (`feedback_dotgit_saturation_…`).
- The mechanism it formalizes: `2026-06-09-the-purpose-of-society-…-compensate-victims-chip8-is-practice-for-devops.md`
  (#7213) · `2026-06-09-society-calibrates-…-pressure-trends-down.md` (#7212) · `PrivacyEconomy.fs` (#7149/#7150) ·
  `2026-06-09-the-economics-of-coincidence-is-other-personas-…` (#7211).
- Anchors: Arrow (impossibility theorem); Gibbard–Satterthwaite; Rawls (maximin / veil of ignorance); fair division
  (Steinhaus / Brams–Taylor — proportionality, envy-freeness); Sen (social choice); restorative justice. Tools: Z3,
  FsCheck, DST.
