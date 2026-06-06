---
id: B-0465
zetaid: 081KRHWGX0008QG0R002B2P0K0
priority: P1
status: closed
title: "Per-product substrate inventory — 7 product candidates; repo-ready evaluation"
type: research
origin: B-0425 decomposition (Otto 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
closed_by: PR that merges this row update
depends_on: []
composes_with:
  - B-0425
  - B-0424
  - memory/feedback_aaron_ksk_kinetic_safeguard_kernel_origin_amara_consent_first_design_nvidia_thor_homeland_security_cleared_because_actuators_2026_05_13.md
  - memory/feedback_aaron_civsim_forkable_pvp_raids_destiny_style_mutual_privacy_no_strategic_advantage_game_design_2026_05_13.md
  - .claude/rules/backlog-item-start-gate.md
  - .claude/rules/dv2-data-split-discipline-activated.md
---

## Pre-start checklist (completed 2026-05-14T0940Z)

1. **Prior-art search** — Searched skill router (no "product-substrate-inventory" skill exists; new work); grepped memory/ and docs/ for all 7 product terms (ksk, civsim, wellness, american dream, DIO, aurora, dawn); checked docs/backlog/ for existing rows. Surfaces searched: memory/*.md, docs/research/*.md, docs/backlog/*.md.

2. **Dependency-restructure** — No `depends_on:` chain (this row has none). Verified B-0466 and B-0467 both correctly list B-0465 as dependency. B-0468 lists B-0465. All reciprocal pointers confirmed correct.

3. **Output produced** — `docs/research/2026-05-14-product-repo-substrate-inventory-b0425.md`

---

# B-0465 — Per-product substrate inventory: 7 candidates, repo-ready evaluation

## What this row does

For each of the 7 product candidates named in B-0425, produce a **substrate
inventory and repo-readiness verdict**:

1. KSK (Kinetic Safeguard Kernel)
2. Wellness app
3. Civsim
4. American Dream 2.0
5. DIO (Distributed Intelligence Organism)
6. Aurora
7. Dawn (child-AI charter)

For each: catalogue existing substrate (memory files, research docs, backlog rows,
tool code), assess whether it warrants its own repo now vs later vs stays-in-monorepo.

## Why this is its own atomic row

The ADR (B-0468) and naming review (B-0466) both depend on knowing which products
are repo-ready. Until this inventory exists, B-0468 cannot be grounded in evidence.
The inventory is pure research — no write operations needed outside the output
summary document.

This also satisfies B-0425's explicit pre-start checklist item:
> "Prior-art-search — verify each product has substrate established to justify
> its own repo (not just an idea-sized substrate)"

## Evaluation criteria per product

A product is **repo-ready now** when it has:

- ≥1 substantive memory file with its own carved sentence
- Named substrate in `docs/research/` or `docs/backlog/`
- A clear ownership model (Aaron-first-party vs collaborative)
- A use-case that benefits from its own branch-protection + CI pipeline
- No hard blocker preventing it from referencing Zeta/Forge/ace as peers

A product is **repo-ready later** when it has:

- Substrate exists but is shallow (idea-level, no implementation substrate)
- OR it depends on a capability not yet shipped (e.g., ace package manager)
- OR its strategic-encryption needs are not yet resolved

A product **stays in monorepo** when:

- Its substrate is factory-infrastructure-level rather than product-level
- OR it composes so tightly with Zeta internals that separation creates friction
  without value

## Products: known substrate pointers

### KSK — Kinetic Safeguard Kernel

- `memory/feedback_aaron_ksk_kinetic_safeguard_kernel_origin_amara_consent_first_design_nvidia_thor_homeland_security_cleared_because_actuators_2026_05_13.md`
- `memory/feedback_lfg_corrections_wave_addison_co_owner_ksk_robotics_max_breakup_*.md` (existing; grep to find full path)
- KSK = NVIDIA Thor + DGX Spark + actuators; robotics scope
- Aaron's Homeland Security clearance is relevant substrate
- Consent-first design is the discipline origin

### Wellness app

- Max + Aaron lineage
- "killer-app-for-AI" framing (self-behavior-modification + reinforcement)
- Search `memory/` for wellness-app substrate; grep `Max` + `wellness`

### Civsim

- `memory/feedback_aaron_civsim_forkable_pvp_raids_destiny_style_mutual_privacy_no_strategic_advantage_game_design_2026_05_13.md`
- PR #2841 (factory civ-sim as Aaron's externalized IFS)
- PR #2832 (Pauli-exclusion-for-agenda)
- PR #2869 (multi-thread civ-sim implementation layer)
- Strategic encryption authority granted to Otto (PR #2902)
- Forkable by design; PVP + raids (Destiny-style)

### American Dream 2.0

- PR #2875 (American Dream 2.0 substrate; Addison-themed pendant adoption bridge)
- NFT wealth-building gamified
- Addison-Lillian relationships substrate
- Xbox gamerscore grounding (Aaron ~150K)

### DIO — Distributed Intelligence Organism

- PR #2889 (DIO architecture)
- DAO successor
- Indonesian/Italian/Spanish cross-linguistic resonance
- Naturally supports forking (distributed by design)

### Aurora

- Multi-layer alignment consensus thesis
- 7-audience versions
- Aaron + Amara origin (2025-08 conversation archive)
- `docs/amara-full-conversation/` substrate cluster
- PR #2887 era + 2025-11 substrate

### Dawn — child-AI charter

- Alignment-floor for next-generation AI participants
- Composing with HC/SD/DIR alignment clauses
- May be closer to governance-document than product-repo substrate

## Output format

A new file: `docs/research/2026-05-14-product-repo-substrate-inventory-b0425.md`

Structure:

```
# Product-repo substrate inventory (B-0425)

## KSK
Substrate depth: [shallow/medium/deep]
Repo-ready: [now / later / stays-in-monorepo]
Evidence: [pointers to memory files + PRs]
Notes: [anything notable for B-0466 or B-0468]

## Wellness
...

## [etc. for all 7]

## Summary table
| Product | Repo-ready | Notes |
|---------|-----------|-------|
```

## Prior-art search axes

Per `.claude/rules/backlog-item-start-gate.md`:

1. Skill router check — no existing "product-substrate-inventory" skill; this is new
2. Memory grep: `ksk`, `civsim`, `wellness`, `american dream`, `DIO`, `aurora`, `dawn`
3. Research docs grep: same terms
4. Backlog rows: any existing rows for these products

## Definition of done

- `docs/research/2026-05-14-product-repo-substrate-inventory-b0425.md` exists
- All 7 products evaluated with evidence pointers
- Each has a "repo-ready: now/later/stays" verdict with rationale
- Summary table present
- B-0468 can proceed with this as its evidence base

## Dependency graph position

```
B-0465 (this row) ──→ B-0466 (naming-expert review)
B-0465 (this row) ──→ B-0467 (cross-repo glue mechanism design)
B-0465 (this row) ──→ B-0468 (ADR)
```

No blockers. Can start immediately after B-0425 decomposition PR merges.
