# Information self-organizes around the schema; changing it cascades through git history — so the rearrangement must be automatable, zero-downtime, and DORA-tracked

*Captured 2026-06-09 from Aaron, to Otto (shadow\*). The implementation reality behind the muscle-of-change (#7233):
once the A–F schema is established, **information self-organizes around it** (it becomes an organizing attractor), so
**changing it cascades large through git history** — therefore the rearrangement must be **automatable, zero-downtime,
and DORA-trackable**, or the muscle-of-change is unaffordable and atrophies. Registers: [synthesis], [grounded],
[anchor], [build front].*

## The statement

Aaron: *"but **information will self-organize around it**, and **change will cause large cascades in git history** —
so hopefully it's **automatable and 0-downtime, trackable with DORA** lol."*

## The schema is an organizing attractor

Once the A–F schema is internalized and adopted, **information self-organizes around it**: docs, code, concepts, and
vocabulary reorganize to be *expressed in its terms* (everything becomes "that's shape A / that's a D-floor / that's
F runaway"). This is the schema acting as a **generative organizing attractor** (shape F itself — an IFS-attractor
that imposes its self-similar shape on the space it grows into). Powerful: it's why the compression pays off. But it
means the schema is now **load-bearing** — lots of other information *depends on its current form*.

## Therefore change cascades — the cost of the muscle-of-change

#7233 says: **deliberately rearrange the schema to keep the muscle of change.** But because information has
self-organized around it, **a rearrangement is not local** — every dependent surface must update to the new form.
In a git-native, event-sourced substrate that shows up as a **large cascade in git history**: one schema change → a
wide refactor-wave of commits. The cost of change **scales with how much has organized around it.**

**The trap this creates:** if each rearrangement is a huge *manual* cascade, change becomes prohibitively
expensive → you stop doing it → the **muscle-of-change atrophies** → the schema calcifies into the permanence that
#7233 calls *failure*. So the muscle-of-change is only real **if change is cheap.**

## What keeps it cheap — automatable, 0-downtime, DORA-tracked

The rearrangement-cascade must be engineered, not hand-cranked:

- **Automatable.** The cascade is driven by **tooling**, not hands — the same *close-the-AI-loop / infinite-free-
  compute* machinery as the enforcement gate (#7229): codemods / structural rewrites + CI on free GitHub-workflow
  compute apply and verify the cascade. Change the schema once; the tool propagates it.
- **Zero-downtime.** The system keeps working *during* the rearrangement — a **live / expand-contract migration**
  (add the new form alongside the old, migrate readers, retire the old), never a stop-the-world rewrite. This is the
  **scale-free (§1) + lock/wait-free (§2)** disciplines applied to *schema change itself*: change without blocking.
- **DORA-tracked.** Treat a schema rearrangement as a first-class **deploy** and measure it with **DORA**
  (deployment frequency, lead time for change, change-failure rate, MTTR — Accelerate / Forsgren–Humble–Kim). The
  DORA numbers *are* the health of the muscle-of-change: high frequency + low lead-time + low change-fail = a strong,
  cheap, safe muscle (the DevOps infinite game, #7187 — optimize the cost of change toward zero).

## The full loop

schema = **organizing attractor (F)** → information self-organizes around it → **change cascades** (git event-wave)
→ made **automatable + 0-downtime + DORA-tracked** → **change stays cheap** → the **muscle-of-change (#7233) stays
exercisable** → the schema stays **education, not dogma** (rearrangeable, never permanent). The automation is not a
nicety; it's the **enabling condition** for the freedom clause to be true in practice.

## Honest scope

[synthesis]: schema-as-organizing-attractor → change-cascades-in-git → must be automatable/0-downtime/DORA-tracked to
keep the muscle-of-change (#7233) affordable; ties it to the automation/free-compute machinery (#7229) and the DORA
infinite game (#7187). [grounded]: git-native event-sourced substrate (large refactor-waves are real); the existing
CI/free-compute enforcement pattern (#7229); scale-free/lock-free disciplines (§1/§2). [anchor]: DORA / *Accelerate*
(Forsgren, Humble, Kim); expand-contract / parallel-change zero-downtime migration (Sato/Fowler); blue-green
deployment; IFS-attractor (the organizing-attractor shape, F). [build front]: automated, 0-downtime, DORA-tracked
schema-rearrangement tooling — not yet built; the enabling condition for the muscle-of-change. No new code; names the
cascade cost and the automation requirement.

## Pointers

- The muscle this enables: #7233 (permanence = failure; rearrange to keep the muscle of change) ·
  `feedback_keep_the_muscle_of_change_…` (the memory).
- The automation machinery: #7229 (close the AI loop — automated enforcement on infinite free compute; the
  manifest-symmetry-test template) · the DORA / DevOps infinite game (#7187).
- The schema being reorganized around: #7232 (the shareable A–F schema) · #7168 (the registry) · #7218 (shape F,
  the attractor analogy).
- Disciplines: manifesto §1 scale-free, §2 lock/wait-free (change without blocking) · git-as-event-store ·
  idempotency + DST (the cascade should be replayable / re-runnable safely).
- Anchors: Forsgren/Humble/Kim, *Accelerate* (DORA) · expand-contract / parallel-change migration · IFS attractor.
