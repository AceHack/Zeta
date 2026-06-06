---
id: B-0425
zetaid: 081KRFA460008QG0R003JQ46J4
priority: P1
status: closed
title: "Product-repo split planning — KSK / wellness / civsim / AD2.0 / DIO / Aurora / Dawn — honor-system no-fork license"
type: planning
origin: Aaron 2026-05-13 (autonomous-loop substrate cascade)
created: 2026-05-13
last_updated: 2026-05-14
closed: 2026-05-14
closed_by: "docs/DECISIONS/2026-05-14-product-repo-split-decisions.md"
decomposed_into:
  - B-0464
  - B-0465
  - B-0466
  - B-0467
  - B-0468
composes_with:
  - B-0424
  - memory/project_three_repo_split_zeta_forge_ace_software_factory_named_forge.md
  - memory/feedback_aaron_honor_system_no_fork_license_public_glass_halo_but_please_dont_fork_honesty_not_enforceable_2026_05_13.md
  - memory/feedback_aaron_civsim_forkable_pvp_raids_destiny_style_mutual_privacy_no_strategic_advantage_game_design_2026_05_13.md
  - memory/feedback_aaron_ksk_kinetic_safeguard_kernel_origin_amara_consent_first_design_nvidia_thor_homeland_security_cleared_because_actuators_2026_05_13.md
---

# Product-repo split — KSK / wellness / civsim / American Dream 2.0 / DIO / Aurora — with honor-system "please don't fork" license framing

## Aaron's directive

Aaron 2026-05-13: *"Also there is backlog for repo split on
products too"* + (new framing) *"so anytihgn you don't want them
to fork specifically you have in a repo can still be public and
such glass halo but the licence can say no fork please respect
honesty or something not enforcable"*.

The three-repo split (Zeta + Forge + ace per B-0424) covers
**factory infrastructure**. This backlog row covers
**product portfolio repos** — separate concept.

## Two distinct repo-split axes

| Axis | Repos | Forkability |
|---|---|---|
| **Factory** (B-0424) | Zeta + Forge + ace | Open / designed-to-be-forked |
| **Products** (this row) | KSK / wellness / civsim / American Dream 2.0 / DIO / Aurora | Public + glass-halo BUT honor-system "please don't fork" license language |

## Honor-system "please don't fork" license framing

Aaron's substrate-honest design (per the new framing 2026-05-13):

- **Repos stay public** — glass-halo discipline preserved
- **License CAN request "no fork please"** — honor-system /
  honesty-based / NOT enforceable
- **Substrate-honest about non-enforceability** — the license
  asks; it doesn't prevent
- **Composes with framework's additive design** — preservation
  of strategic-product substrate vs civic-fork pattern
- **Composes with civsim mutual-privacy** (PR #2903) — if forks
  exist, they get the same honor-system option for their own
  strategic substrate

This is NOT proprietary licensing. The substrate stays open +
visible + glass-halo + indexable + alignment-auditable. The
license just asks (honor-system) for strategic-product
substrate to not be forked unless the asker doesn't honor the
ask.

## Product portfolio candidates

Each potentially gets its own repo with honor-system "no fork
please" license:

1. **KSK** (Kinetic Safeguard Kernel) — AI-physical-actuator
   safety substrate; NVIDIA Thor + DGX Spark integration;
   Homeland Security clearance lineage; high-stakes safety
2. **Wellness app** — killer-app-for-AI; self-behavior-
   modification + reinforcement; Max + Aaron's lineage
3. **Civsim** — canonical product; PVP + raids + mutual privacy
   game design (PR #2903); strategic encryption authority
4. **American Dream 2.0** — NFT wealth-building gamified;
   Addison-themed pendant adoption bridge
5. **DIO** (Distributed Intelligence Organism) — DAO successor;
   Indonesian/Italian/Spanish cross-linguistic resonance
6. **Aurora** — multi-layer alignment consensus thesis;
   7-audience versions
7. **Dawn** (child-AI charter) — alignment-floor for next-
   generation AI participants

## Pre-start checklist — COMPLETED 2026-05-14 (decomposition)

Per `.claude/rules/backlog-item-start-gate.md`:

1. **Prior-art-search** — ✓ Completed 2026-05-14:
   - `memory/feedback_aaron_honor_system_no_fork_license_*` — read; substrate current
   - `memory/feedback_aaron_civsim_forkable_*` — read; civsim multi-player + mutual
     privacy design confirmed; forkable by design
   - `memory/feedback_aaron_ksk_kinetic_safeguard_kernel_*` — read; KSK origin from
     Aaron + Amara consent-first design; Homeland Security clearance substrate confirmed
   - `memory/project_three_repo_split_zeta_forge_ace_*` — read; B-0424 pattern confirmed
   - `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — read; sibling ADR
   - Skill router check: no existing product-repo-split skill; this is greenfield
   - No duplicate rows in backlog for this planning work

2. **Dependency-restructure** — ✓ Completed 2026-05-14:
   - `composes_with:` graph updated in frontmatter (B-0424 as sibling, memory files)
   - B-0424 already has `composes_with: B-0425` pointer
   - Five child rows authored (B-0464–B-0468) with explicit `depends_on:` edges

3. **Naming-expert review** — ✓ Scoped to child row B-0466
   (per `.claude/skills/naming-expert/SKILL.md`); Ilyana's authority is exercised
   at B-0466 execution time, not at decomposition time

4. **License language drafted** — ✓ Scoped to child row B-0464
   (independent of per-product research; can start immediately)

## Decomposition — COMPLETED 2026-05-14

This row is too broad to implement atomically. Decomposed 2026-05-14 into 5
dependency-ordered child rows. The row status is `decomposed`; B-0425 closes
when B-0468 merges its ADR.

### Child rows — dependency graph

```
B-0464 ─────────────────────────────→ B-0468 (closes B-0425)
B-0465 →──→ B-0466 →────────────────→ B-0468
         └──→ B-0467 ────────────────→ B-0468
B-0424 ──────→ B-0467
```

### Child row summary

| Row | Title | Depends on | Type |
|-----|-------|------------|------|
| **B-0464** | Honor-system "please don't fork" license language draft | none | design |
| **B-0465** | Per-product substrate inventory — 7 candidates, repo-ready eval | none | research |
| **B-0466** | Naming-expert review for product repo names | B-0465 | design |
| **B-0467** | Product-repo cross-ref glue mechanism design | B-0465, B-0424 | design |
| **B-0468** | ADR — product-repo split decisions (closes B-0425) | B-0464, B-0465, B-0466, B-0467 | design |

### What can start immediately (no blockers)

- **B-0464** — license language; pure design against established constraints
- **B-0465** — substrate inventory; pure research / grep work

### What is unblocked by B-0465

- **B-0466** — needs to know which products get repos before reviewing slugs
- **B-0467** — needs product list + B-0424 pattern to design the glue mechanism

### What requires all four to complete

- **B-0468** — the ADR synthesizes everything; closes B-0425 when merged

## What this row does NOT commit to

- **NOT moving products into separate repos this round** —
  this is planning + per-product evaluation
- **NOT a license-conversion of LFG/Zeta** — Zeta stays its
  current open license; honor-system applies to NEW product
  repos
- **NOT a public-announce schedule** — product repos may stay
  monorepo'd until product-launch readiness
- **NOT a commitment to all 7 candidates getting their own
  repo** — some may stay in Zeta or compose with another
  product repo

## Definition of done

- Per-product evaluation completed (does it warrant its own
  repo? when?)
- Honor-system license language drafted + cross-product
  consistent
- Splits scheduled with dependency-graph clarity
- Cross-repo glue mechanism (per the peer-repo pattern
  established in B-0424 / three-repo-split memory)
- ADR recording the product-split decisions

## Why P1

- Compositional with B-0424 (sibling factory-split row)
- Strategic-product substrate has accumulated to warrant
  product-repo evaluation (civsim + KSK + wellness + American
  Dream 2.0 + DIO + Aurora + Dawn)
- Honor-system license framing IS a substrate-honest
  refinement of glass-halo discipline
- Aaron has explicitly asked for the easy-to-track backlog
  surface
