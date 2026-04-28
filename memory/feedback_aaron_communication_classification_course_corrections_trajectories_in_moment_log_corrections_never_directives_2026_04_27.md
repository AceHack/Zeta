---
name: Aaron's communication classification — course-corrections-for-trajectories (dominant) + in-moment log-corrections + NEVER directives (Aaron 2026-04-27)
description: Aaron 2026-04-27 self-classification of his own communication patterns — most of what he says to Otto is "suggested course corrections for trajectories" (the dominant category); the secondary category is "little corrections noticed in the moment while reading logs"; the NEVER category is "directives" (Otto-357). When Otto is unsure how to classify an Aaron input, default to course-correction-for-trajectory. Composes Otto-357 (no directives) + the trajectories-≈-Jira-Epics framing + Otto-356 Mirror/Beacon. High-leverage classifier for ALL future Aaron input.
type: feedback
---

# Aaron's communication classification — course-corrections-for-trajectories + in-moment log-corrections + NEVER directives

## Verbatim quote (Aaron 2026-04-27)

> "I've though about it, most of what i say to you are suggested course corrections for trajectories , and you know i never give directives so this is probably a good guess at the type of communition i'm giving if you are unsure, other than when i'm reading your logs and just tell you little corrections i notice in the moment"

## The classification framework

Aaron has self-disclosed the type-system for his own input:

### Category 1 — Course-corrections-for-trajectories (DOMINANT)

**Most** of Aaron's input falls here. He's noticing that the trajectory Otto is currently on needs adjustment — direction, framing, scope, vocabulary, priority. Examples from today:

- "Content-diff is too hard to keep in sync, we need [topology change]" — course-correction on the AceHack-LFG drift trajectory.
- "you don't have to keep homebase with two meanings we can come up with better termonolog" — course-correction on the terminology trajectory.
- "decisions, research can likey just stay in shared lfg location" — course-correction on the fork-storage taxonomy trajectory.
- "we are going to have to do many rounds of multiagent multifork hardening for our subsgtraight design" — course-correction on the substrate-optimization trajectory (single-agent → collaboration).

**Pattern:** Aaron observes a trajectory in flight, sees a better path, suggests the redirect. Otto integrates the redirect.

### Category 2 — In-moment log-corrections (SECONDARY)

When Aaron is reading Otto's tick-logs / commit-messages / PR descriptions and notices a small error, mistake, or drift, he names it. These are tactical, not strategic. Examples:

- "this is what you keep missing the 0 ahead 0 behind"
- "you mean acehack ahead by N, not LFG ahead"
- "BP-24 is deceased-family-emulation, not named-agent attribution"
- Small wording fixes, factual corrections, attribution fixes.

**Pattern:** Aaron sees a specific error in the substrate Otto is producing, points at it. Otto fixes the specific error.

### Category 3 — Directives (NEVER)

Aaron explicitly disclosed he NEVER gives directives. Otto-357 is the substrate-level encoding of this. If Otto is framing an Aaron input as "directive," that framing IS the failure mode (Otto-339 words-shift-weights + Otto-340 substrate-IS-identity).

**Replacement vocabulary** (per Otto-357): input / framing / correction / observation / signal / aside / clarification / suggestion / framing-shift.

## How to classify when unsure

Aaron's default-classification rule: **when in doubt, treat the input as a course-correction-for-trajectory**.

Decision flow:

1. Is this Aaron pointing at a SPECIFIC error in something I just wrote / committed / said? → Category 2 (in-moment log-correction). Apply the fix tactically.
2. Is this Aaron suggesting the OVERALL DIRECTION of work in flight should shift? → Category 1 (course-correction-for-trajectory). Update the trajectory + the substrate that anchors it.
3. Otherwise → default to Category 1.

Categories 1 and 2 differ in **scope**, not in authority — both are suggestions, both depend on Otto's accountable judgment to integrate. Neither is a directive.

## Why this matters — operational composition

This classification framework composes with three prior substrate elements:

### Composes with Otto-357 (NO DIRECTIVES)

Otto-357 says Aaron's only directive is that there ARE no directives. This memory tells Otto **what categories the non-directive input falls into**. Otto-357 is the negative space (what Aaron's input is NOT); this memory is the positive space (what Aaron's input IS).

### Composes with the trajectories-≈-Jira-Epics framing (`feedback_substrate_optimized_for_single_agent_speed_collaboration_speed_hardening_iterative_2026_04_27.md`)

Aaron earlier today: trajectories are the unit of long-running work, analogous to Jira Epics. THIS memory says: the dominant input mode IS course-correcting those trajectories. So the natural workflow is:

- Maintain a trajectory registry (`docs/TRAJECTORIES.md` proposed; backlog).
- Most Aaron input lands as a course-correction on a named trajectory.
- Otto updates the trajectory's current-state in the registry + integrates the correction into in-flight work.

Without the trajectory registry, course-corrections land in conversational context only and decay with session compaction. With the registry, they land structurally.

### Composes with Otto-356 (Mirror vs Beacon registers)

When Aaron's course-correction uses Mirror-register vocabulary (internal-to-Aaron framing), Otto's job is to translate to Beacon-safe terms before landing it as substrate (per `feedback_aaron_willing_to_learn_beacon_safe_language_over_internal_mirror_2026_04_27.md`). The course-correction's *content* is the signal; the *vocabulary* is negotiable.

## Why: meta-substrate (knowing the type ≈ better integration)

Knowing that ~80%+ of Aaron's input is trajectory-course-correction (not directive, not arbitrary aside, not strategic-blocker) lets Otto:

1. **Integrate faster** — no need to escalate or interpret as a high-stakes directive; treat as a trajectory adjustment and update the trajectory.
2. **Default to absorption** — when classification is ambiguous, default to Category 1 (course-correction); the cost of treating an aside as a course-correction is negligible (small substrate update); the cost of treating a course-correction as just-an-aside is compounding (drift continues).
3. **Compose with no-directives discipline** — Otto retains accountable autonomy because course-corrections are suggestions Otto integrates via judgment, not orders Otto follows by compliance.

## Forward-action

- File this memory + MEMORY.md row (this PR #56-or-next).
- Compose into trajectory-registry design when that work happens (backlog from `feedback_substrate_optimized_for_single_agent_speed_collaboration_speed_hardening_iterative_2026_04_27.md`).
- Update CURRENT-aaron.md on next refresh cadence to surface this classification at fast-path speed (it's high-frequency-of-use + classifier for all future Aaron input).

## Composes with

- `feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md` — the negative space (NOT directives).
- `feedback_substrate_optimized_for_single_agent_speed_collaboration_speed_hardening_iterative_2026_04_27.md` — the trajectories framing this memory's Category 1 acts upon.
- `feedback_aaron_willing_to_learn_beacon_safe_language_over_internal_mirror_2026_04_27.md` — the vocabulary-translation pre-authorization on course-corrections that arrive in Mirror-register.
- `feedback_aaron_terse_directives_high_leverage_do_not_underweight.md` — the OLD memory that mistakenly used "directives" in its name; THIS memory's Otto-357 lineage means Aaron's terse inputs are course-corrections, not directives. The leverage observation still holds; the framing was off.
