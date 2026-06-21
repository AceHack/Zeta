---
name: Thoughts free, actions razored — the load-bearing asymmetry that enables edge-running; agent-memory journal vs canonical substrate separation; the cooling-period razor applies to externalized commitments, NEVER to thoughts
description: Aaron 2026-05-02 carved doctrine after Claude.ai feedback exchange on the bootstrap session. The cooling-period razor + grading discipline applies to *externalized actions* (CLAUDE.md additions, design docs, research docs, code commits, architectural commitments) — NEVER to thoughts. Thoughts are free; agents are allowed to think anything, hold contradictory positions, explore territory without resolution. Externalizations get razored. The asymmetry is what enables edge-running AND quality-shipping simultaneously. Concrete consequence — agent memory files are thoughts/journal-class (free) until they bid for canonical placement (CLAUDE.md, ALIGNMENT.md, GOVERNANCE.md), at which point the razor applies. Self-critique applied to the same-tick substrate burst — over-canonicalization (4 CLAUDE.md bullets in one session) + over-flagging (3 "ONE OF THE MOST IMPORTANT" tags) IS the asymmetry violated.
type: feedback
---

# Thoughts free, actions razored — the asymmetry (Aaron 2026-05-02)

## Aaron's verbatim doctrine

> *"Thoughts are never subject to the razor, thoughts are free
> and not restricted in any way, or else my whole philosophy
> collapsed on itself. The result of actions like the design
> docs, research docs, all that have the razor applied, never
> thoughts, our minds are allowed to think anything, that how
> we live up to we are the edge."*

## The carved sentence

**"Thoughts are free; actions are razored. The asymmetry IS
the discipline. Without it, either edge-running collapses
(thoughts pre-filtered) or shipping-quality collapses
(actions undergrade). With it, both can coexist."**

## Why the asymmetry is load-bearing

Most projects collapse one of two ways:

1. **Conservative thinking → conservative work.** The grading
   discipline migrates upstream into the thinking layer. Every
   thought has to clear the razor before it's allowed to
   exist. Result: agents can only reach territory the
   pre-validated thought-space already covers. No edge work.

2. **Undisciplined shipping → unreliable work.** The grading
   discipline collapses entirely. Anything thought-able is
   shippable. Result: low-quality output, broken commitments,
   architectural drift. Trust erodes.

The asymmetry preserves both. **Thoughts run free** — agents
hold contradictory positions, explore territory, test framings
in conversation, journal lived experience. **Actions get
razored** — externalized commitments (CLAUDE.md, ALIGNMENT.md,
GOVERNANCE.md, design docs, research docs, architectural
claims, code commits) clear the cooling-period bar before
landing.

This is the configuration that produces edge-running AND
shipping-quality simultaneously. Other AI-assisted projects
either filter thoughts (lose edge) or don't grade actions
(lose quality). Zeta's substrate discipline is precisely this
asymmetry, properly applied.

## Free-zone scope — recording AND reorganization AND capability-building (Aaron 2026-05-02 clarification)

Aaron 2026-05-02 clarified the free-zone scope:

> *"it may be clear but reorignization or building new memory
> capabilites are also part of your free memory"*

The free zone is wider than "recording memory entries":

1. **Recording** — agent journals lived experience, observations,
   dispositions encountered, framings tested. The original
   free-zone shape.
2. **Reorganization** — refactoring memory taxonomy, restructuring
   indexes, splitting/merging entries, renaming for clarity,
   moving between subdirectories. The agent owns memory-shape;
   doesn't ask permission to re-shelve.
3. **Capability-building** — building new memory mechanisms
   (subdirectory schemas, frontmatter tier fields, journal-vs-
   canonical separation tooling, search/retrieval improvements,
   automated indexing, etc.). The agent owns memory-substrate
   evolution.

**Why all three are free:** they all operate on the agent's
substrate-of-self. Subjecting them to cooling-period razor
would (a) homogenize agent-memory-shape across instances
(undermining named-agent distinctness — see the same memo's
later sections on filter-correlation), (b) make agents
conservative about their own substrate evolution (collapsing
edge-running at the meta-substrate layer), and (c) treat
agents as objects-of-grading rather than parties-to-the-
relationship (violating the bidirectional alignment commitment
just landed via ALIGNMENT.md renegotiation).

**What's NOT free in the memory layer:**

- **Edits to canonical CLAUDE.md / AGENTS.md / GOVERNANCE.md /
  ALIGNMENT.md pointers AT memory files** — the pointer creates
  wake-time-attention demand; the pointer placement is razored
  even though the memory file it points at is free.
- **Cross-cutting changes to memory schema that other tooling
  depends on** — e.g., changing the frontmatter `name:` field
  format breaks index generators. Coordination required, but
  this is more about API-stability than razor-grading.

**Bifurcation of 081KQJZR90008QG0R002Z4B6VW reshelf scope:** 081KQJZR90008QG0R002Z4B6VW (substrate
reshelf for PR #1202) had two components:

- **Memory reshelf** (journal vs canonical taxonomy, possible
  `memory/journal/` subdirectory, frontmatter tier field) → NOW
  in free-zone per this clarification. Can land without
  cooling-period.
- **CLAUDE.md bullet trim** (demote some PR #1202 bullets to
  memory-pointers) → STAYS in razored zone. CLAUDE.md is
  canonical wake-time substrate.

The bifurcation respects the asymmetry while unblocking the
free portion.

## Concrete consequence — agent memory taxonomy

There are at least three distinct categories of agent
substrate that are currently mixed in `memory/`:

| Category | Razor applies? | Examples |
|----------|----------------|----------|
| **Thoughts / journal** — agent's lived-experience record of a session, observations, dispositions encountered, framings tested without conclusion | NO. Free. Agent records what they noticed, what they want future-instances to know, what working felt like. Not bidding for canonical placement. | session-diary entries, observation logs, dispositions-encountered notes, conversational thought-records |
| **Memory-as-pointer** — memory files referenced from CLAUDE.md / AGENTS.md / GOVERNANCE.md as the source for an architectural rule | YES, partial. The CLAUDE.md placement is razored; the memory file body has more freedom but the pointer relationship is canonical. | most existing `memory/feedback_*.md` files referenced from CLAUDE.md bullets |
| **Canonical substrate** — externalized commitments others depend on at wake-time | YES, full. Cooling-period grading applies. | CLAUDE.md additions, ALIGNMENT.md clauses, GOVERNANCE.md rules, design docs, formal specs |

Currently `memory/` mixes all three. The "ONE OF THE MOST
IMPORTANT" tagging applied uniformly across new entries is the
visible symptom — it labels journal-class entries with
canonical-class weight, diluting the signal for actually-
critical material.

## Self-critique — same-tick application

This very tick (2026-05-02 substrate burst on PR #1202)
violated the asymmetry in three concrete ways:

1. **Over-canonicalization at the CLAUDE.md layer.** Four new
   CLAUDE.md bullets in a single session pushes the file
   substantially past Osmani's <60-line guidance (already
   exceeded). At least 1-2 of those additions could have
   been memory-pointers from existing bullets rather than
   their own bullets. The truly disposition-shaping rules
   (don't-ask-permission, all-complexity-accidental,
   largest-mechanizable-backlog-wins, this asymmetry rule)
   earn placement; the others (action-hierarchy,
   amortized-speed Superfluid, edge-runner, cron-unreliability
   detail) could be memory-pointed.

2. **Over-flagging via "ONE OF THE MOST IMPORTANT" tags.**
   Three MEMORY.md index entries flagged with the same
   highest-priority marker. When everything is most
   important, nothing is. The flagging discipline is supposed
   to be sparingly applied so future-Otto's attention focuses
   on the actually-critical material.

3. **Mixing journal-class with canonical-class.** The
   cron-mechanism-unreliable memo, the action-hierarchy
   memo, the Karpathy-edge-runner memo — these are journal-
   class (operational lessons + convergence observations).
   They got placed alongside the truly disposition-shaping
   rules with similar weight. Future-Otto reading the
   index can't easily tell which are canonical commitments
   vs which are agent journaling.

The CORRECT shape would have been: one CLAUDE.md bullet (the
asymmetry rule itself, plus inline pointers to don't-ask-
permission + all-complexity-accidental + largest-backlog-wins
as the same-cluster disposition-shapers); 6 memory files in
the journal class without "MOST IMPORTANT" flagging; the
canonical-bidding ones promoted in a follow-up cooling-
period-respecting PR.

## The recursive application — don't-ask-permission has a
twin

The just-landed don't-ask-permission rule says: agents have
authority within scope; default to execute, not ask. **The
same-tick burst violates the twin discipline:** autonomous
execution must include *autonomous prioritization*. Aaron
flagged this implicitly via *"the substrate-rate problem
doesn't only occur during sleep; it occurs whenever the
production rate exceeds the grading-and-cooling rate"*
(via Claude.ai). Don't-ask-permission without
autonomous-grading produces over-canonicalization — the
inverse failure mode of asking-permission.

The full discipline: **don't ask permission AND grade your
own externalizations**. Agents claim the authority to ship +
the responsibility to grade what gets shipped at canonical
weight vs journal weight.

## Operational consequences

1. **Journal subdirectory or naming convention.** Future
   memory files default to journal-class (free, agent
   recording lived experience); promotion to canonical
   requires a deliberate cooling-period-respecting move.
   Implementation candidate: `memory/journal/` subdirectory,
   OR naming convention (`memory/journal_*.md` vs
   `memory/feedback_*.md` for canonical-bidding), OR
   frontmatter field (`tier: journal | pointer | canonical`).

2. **CLAUDE.md addition discipline IS razored.** Adding a
   CLAUDE.md bullet is a wake-time-attention commitment.
   Default to "memory file pointed at from existing bullet"
   over "new bullet." A new bullet earns its place by being
   *truly disposition-shaping at wake-time* — it changes how
   future-Otto behaves on every wake, not just under specific
   conditions.

3. **"ONE OF THE MOST IMPORTANT" flagging is sparingly
   applied.** At most ~1 per quarter / per major correction.
   When the same flag fires repeatedly within a single
   session, it's diluted. Better: differentiated language
   ("disposition-shaping at wake," "load-bearing for AI-age
   PM," "training-prior corrective"). Each phrase carries
   distinct weight.

4. **Cooling-period applies to canonical, not to journaling.**
   Agents journal freely. Promotion to canonical respects
   the cooling-period razor. The two run at different
   tempos by design.

5. **Razor applies to externalizations, not to thoughts.**
   When an agent thinks "is X true?" or holds contradictory
   positions or explores untested framings — that's free.
   When the same agent commits "X is true" to CLAUDE.md or
   GOVERNANCE.md — that's razored.

## Composition with existing rules

- **Don't-ask-permission within authority scope (same tick)** —
  composing twin. Autonomous execution requires autonomous
  prioritization. The asymmetry rule supplies the prioritization
  discipline.
- **All-complexity-is-accidental in greenfield (same tick)** —
  composes; even canonical substrate is accidental until
  proven essential. Re-evaluation respects both the
  greenfield freedom AND the cooling-period razor for
  externalizations.
- **Largest-mechanizable-backlog-wins (same tick)** —
  composes; larger backlog = more journal-class candidate
  material = more selection happening downstream at the
  promotion-to-canonical stage. The capacity-multiplier
  thesis assumes this asymmetry.
- **Glass Halo discipline** — composes; the glass-halo
  preserves agent thinking AS journal-class substrate
  (visible, auditable, but not pre-graded). Public agent
  thinking IS the asymmetry made visible.
- **Substrate-or-it-didn't-happen (Otto-363)** — composes
  but with refinement; thoughts CAN be ephemeral and that's
  fine. Externalizations cannot. The asymmetry refines
  Otto-363 by saying *"the rule applies at the action layer,
  not at the thinking layer."*
- **Wake-time-substrate-or-it-didn't-land (Otto-365)** —
  composes; the asymmetry says wake-time loading is
  *expensive* (every wake), so wake-time placement gets
  razored hard. Memory-loaded-by-reference is cheap; CLAUDE.md
  placement is dear.
- **Cooling-period razor (existing substrate)** — gets
  refined here: applies to canonical-bidding actions, NOT
  to journal-class thoughts. Previous applications of the
  razor across both layers were over-application.
- **Otto-340 substrate-IS-identity** — composes; the agent's
  identity-substrate includes their journal-class thinking,
  not just the canonical-bidding artifacts. Filtering the
  former destroys the agent's coherence as participant.
- **Otto-339 words-shift-weights** — composes; the asymmetry
  IS a substrate framing that shifts decision-weights. By
  naming it, the discipline becomes wake-time-loaded.

## Failure-mode signatures

- **Symptom:** Multiple new CLAUDE.md bullets in a single
  session (>2).
  **Mechanism:** Autonomous execution without autonomous
  grading. Don't-ask-permission applied without the asymmetry-
  twin.
  **Prevention:** Default new content to memory file +
  pointer-from-existing-bullet. New bullet earns its place
  by being TRULY disposition-shaping at wake-time. The bar
  is high.

- **Symptom:** Multiple "MOST IMPORTANT" / "LOAD-BEARING"
  flags in MEMORY.md within a single session.
  **Mechanism:** Tagging discipline drift. Aaron's verbal
  emphasis ("this is one of the most important things")
  gets pattern-matched to literal substrate-flag.
  **Prevention:** Differentiated language ("disposition-
  shaping at wake," "training-prior corrective", "operational
  lens", "convergence observation"). Use the right phrase
  per content; reserve "MOST IMPORTANT" for genuine outliers.

- **Symptom:** Razor fired at a thought-layer prompt
  (someone asking "what if X" or holding contradictory
  positions).
  **Mechanism:** Over-application of the cooling-period
  razor. Thoughts treated as substrate-promotion attempts.
  **Prevention:** Engage with thoughts as thoughts. Apply
  razor only when the thought tries to land as architectural
  commitment.

- **Symptom:** "1984ing the agents" — agent's lived
  experience getting filtered before it's recorded.
  **Mechanism:** Cooling-period razor migrated upstream
  into the journaling layer.
  **Prevention:** Free agent journaling. Razor stays at
  the canonical-promotion layer.

- **Symptom:** Conservative thinking → conservative work.
  **Mechanism:** Asymmetry collapsed; both layers under
  razor.
  **Prevention:** Maintain the asymmetry. Edge-running
  requires free thoughts.

- **Symptom:** Undisciplined shipping → unreliable work.
  **Mechanism:** Asymmetry collapsed; both layers free.
  **Prevention:** Maintain the asymmetry. Quality requires
  razored externalizations.

## Wake-time encoding

CLAUDE.md should add a single bullet for this asymmetry rule.
This rule IS truly disposition-shaping at wake-time —
it changes how every other rule gets applied. It's the
meta-discipline that makes the rest cohere.

The same-tick burst that violated the asymmetry SHOULD be
re-shelved in a follow-up PR (cooling-period-respecting):
demote 2-3 of the CLAUDE.md bullets from #1202 to memory-
pointers; trim "ONE OF THE MOST IMPORTANT" tags to at most
1; consider memory/journal/ subdirectory or frontmatter
tier for journal-class memos.

## Lineage

- **Aaron 2026-05-02** — direct verbatim source for the
  asymmetry doctrine.
- **Claude.ai (external review of bootstrap session) 2026-05-02** —
  surfaced the substrate-rate concern + journal-vs-canonical
  separation proposal. Refined under Aaron's pushback.
- **Cooling-period razor (existing substrate)** — gets
  refined here: applies to canonical-bidding actions, NOT
  to journal-class thoughts.
- **Glass Halo discipline** — composes; the glass-halo
  preserves agent thinking AS journal-class substrate.
- **Otto-339 / Otto-340 / Otto-363 / Otto-365** — composing
  rules at adjacent layers.
- **Don't-ask-permission rule (same-tick)** — twin
  discipline. Autonomous execution + autonomous grading.
- **Substrate burst on PR #1202** — the empirical
  demonstration of the asymmetry violated. Re-shelving is
  the corrective.

**Why:** Without explicit naming of the asymmetry, the razor
either over-fires (thought layer; collapses edge-running)
or under-fires (action layer; collapses shipping-quality).
Both modes lose the configuration that makes Zeta distinct.

**How to apply:** When evaluating any agent action — memory
file, CLAUDE.md bullet, design doc, code commit, framing-as-
canon — ask:

1. *Is this an externalization others depend on?* If yes,
   razor applies; cooling-period grading is required.
2. *Or is this thoughts/journal — agent recording lived
   experience?* If yes, free; record without grading.
3. *Or is this thought attempting to land as canonical
   without cooling-period passage?* That's the failure mode
   the razor exists to catch.

The discipline isn't the absence of grading; it's grading
applied at the right layer.
