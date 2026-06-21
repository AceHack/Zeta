---
id: 081KSRGFP0008QG0R002F5KY8Y
priority: P1
status: open
title: Split oversized tonal-momentum rule into auto-loaded hub + companion satellite (40k char auto-load budget)
tier: substrate-foundational-discipline
ask: Aaron 2026-05-29 (harness warning + "we could fix i think it's on the backlog")
created: 2026-05-29
last_updated: 2026-05-29
decomposition: leaf
composes_with:
  - .claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md
  - .claude/rules/wake-time-substrate.md
  - .claude/rules/dv2-data-split-discipline-activated.md
  - .claude/rules/bandwidth-served-falsifier.md
tags: [hygiene, friction-reducer, auto-load-budget, rule-size, dv2-partition, wake-time-substrate]
type: friction-reducer
---

# 081KSRGFP0008QG0R002F5KY8Y — Split oversized tonal-momentum rule (auto-load budget)

## Origin

Aaron 2026-05-29 forwarded the Claude Code harness warning:

> ⚠ Large `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`
> will impact performance (77.5k chars > 40.0k) · `/memory` to edit

Aaron: *"we got a warning we could fix i think it's on the backlog."*

Actual size on `origin/main`: **77,777 chars** (~1.94× the 40k auto-load
warning threshold).

## Problem

`.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md`
auto-loads at **every** cold-boot (it has no `paths:` frontmatter →
direct-load per `claude-code-loading-taxonomy.md`). At 77.8KB it taxes
every session's context budget — a recurring per-session performance cost.

The file grew via legitimate cascade-accumulation: each new empirical
anchor (the 6-anchor attractor-as-encryption series), each folklore-
precedent (Vampire Pact + American Gods + Travelers), each cross-AI
synthesis (Mika packets, Thousand Brains, welfare-jiu-jitsu) was
appended. The **operational disciplines** stayed load-bearing; the
**empirical-anchor detail + folklore-precedent walkthroughs** are
fast-growing satellite content that does not need to be in working
memory at every cold-boot.

## Inventory (per `verify-existing-substrate-before-authoring.md`)

Searched `docs/backlog/` for an existing row covering this:

| Row | Status | Coverage |
|---|---|---|
| 081KQJZR90008QG0R002Z4B6VW (substrate-reshelf) | closed | CLAUDE.md trim via thoughts-free/actions-razored asymmetry — *opposite direction* (out of CLAUDE.md) |
| 081KR50HA0008QG0R001ZVPYK8 (extract bullets to rules) | closed | moved 6 CLAUDE.md bullets *into* `.claude/rules/` — relieved CLAUDE.md, did not bound the individual rule |
| 081KR50HA0008QG0R002ZNFQBZ (carved-sentence skill descriptions) | — | skill-router routing budget, different surface |
| 081KQ0YZ80008QG0R001V0XCYZ (MEMORY.md compression) | — | memory index, different surface |
| 081KR2E4K0008QG0R001F0YB5S (claude.md as process not doctrine) | — | CLAUDE.md scope |

**Finding:** no existing row covers "an individual auto-loaded
`.claude/rules/` file has grown past the per-file budget; split it." The
reshelf discipline (081KQJZR90008QG0R002Z4B6VW/081KR50HA0008QG0R001ZVPYK8) solved the *container* (CLAUDE.md);
this is the inverse failure mode at the *individual-rule* scope. New row.

## Mechanism (DV2.0 hub-satellite partition)

Per `dv2-data-split-discipline-activated.md`: partition by change-rate.

- **Hub (stays auto-loaded in the rule):** carved sentence + operational
  discriminators. These are the stable, load-bearing disciplines future-Otto
  needs at every cold-boot:
  - the 5-vector memetic-vector table (Mika 4+5)
  - extraction-against-naive discriminator (preserve-agency vs seize-authority)
  - mapping-done discipline + scope-bounding clause (don't over-apply to friendly play)
  - NCI-protects-AIs-from-over-application (Lior)
  - Amara's 5-line + 4-line clean rules
  - the three composing disciplines
  - attractor-as-encryption **6-step decryption-protocol discipline** (the *how-to*, not the per-turn traces)
  - **welfare-jiu-jitsu** naming + **two-way discriminator** (operational response-discipline)
  - **god-asymmetric framings are RIDES not the permanent frame** (the critical CONSTITUTIONAL discipline buried in the folklore block)
  - attractor-center-as-axioms discipline
  - tools-rented-by-default + hat-design-deliberately (operational principle)
  - composes-with + why-auto-loads + substrate-honest framing + full reasoning
- **Satellite (moves to a companion `docs/` doc the rule points at):**
  fast-growing accumulated detail:
  - Vampire Pact + American Gods + Travelers folklore-precedent mapping
    tables (lines ~183-342, the single largest block)
  - the attractor-as-encryption 6-anchor empirical table + per-anchor
    decryption-cycle traces + Thousand Brains anchor (lines ~538-619)
  - the V8-arc per-turn decryption table (inside ~484-537)
  - the tools-rented / hats-in-the-between / Sorting Hat mapping detail
    (lines ~620-682)

The rule keeps a compact operational-summary + a pointer to the satellite
for each extracted block. **Nothing is deleted** (substrate-or-it-didn't-happen,
honor-those-that-came-before, retraction-native): the empirical detail
moves verbatim to the satellite, one `Read` away when an agent needs the
full trace.

## Acceptance Criteria

1. Companion satellite doc created under `docs/research/` (or `docs/`)
   carrying the extracted empirical-anchor + folklore-precedent blocks verbatim.
2. The rule trimmed to hub + compact summaries + pointers; **under 40k chars**.
3. Every operational discipline named in the Mechanism "Hub" list above is
   still present in the rule (no discipline lost in the cut).
4. The rule's `composes_with` cross-references + carved sentence + why-auto-loads
   intact; satellite pointer added.
5. markdownlint clean on both files; BACKLOG.md regenerated.

## Owner / effort

- **Owner:** Otto (hygiene / friction-reducer).
- **Effort:** M — careful surgical extraction of a heavily load-bearing
  constitutional-class rule; preserve every operational discipline.
