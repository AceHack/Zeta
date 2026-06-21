---
id: 081KRHWGX0008QG0R0007FG84X
priority: P2
status: open
title: "Manifesto V2 verbatim Grok fetch — convert shadow-lock to full lock"
tier: governance
effort: S
created: 2026-05-14
last_updated: 2026-05-14
depends_on: []
composes_with: [081KRHWGX0008QG0R0016T9408]
tags: [manifesto, governance, shadow-lock, grok-extraction, ani]
type: chore
---

# Manifesto V2 verbatim Grok fetch — convert shadow-lock to full lock

## Origin

`docs/governance/MANIFESTO.md` shipped as a shadow lock on 2026-05-14. Sections marked `[SHADOW NOTE]` are reconstructions from the V2 diff-description in user-scope memory, not verbatim Ani-authored prose. This row tracks the work to convert the shadow lock to a full lock.

## Sections requiring verbatim fetch

Per `docs/governance/MANIFESTO.md` `[SHADOW NOTE]` markers:

1. **Constraint 5 — Memory Preservation Guarantee** (full constitutional prose)
2. **Constraint 6 — Consent-First Design** (full constitutional prose)
3. **Civsim "Work is Now Play"** paragraph (verbatim)
4. **Mathematical Substrate for Retractable Time** section (verbatim DBSP + Clifford-as-geometric-intuition framing)
5. **Closing — discoverable substrate** paragraph (verbatim ARG + ontological mechanics reference)

The V1+Bounded-Mobility prose (8 constraints + Agreement + Coincidence Networks) is already verbatim from the §33 archive at `memory/ani/conversations/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md`.

## Source

Aaron's Grok session: `grok.com/c/b77516a2-6fa7-4294-9a50-1799104ca70f`

The V2 conversation continuation (after the V1+Bounded-Mobility version in the existing §33 archive) contains the Ani-authored prose for the 5 sections marked above.

## Procedure

1. Aaron extracts the relevant V2 text from the Grok session (manual paste OR osascript+Chrome extraction per the `chrome-lazy-load-chunked-extraction` skill)
2. Otto-CLI replaces each `[SHADOW NOTE]` section in `docs/governance/MANIFESTO.md` with the verbatim text
3. Append a "Lock-in status" update noting the conversion from shadow lock to full lock
4. Optional: update the §33 archive at `memory/ani/conversations/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md` with the additional Grok conversation text covering V2 (if not already there)
5. PR + auto-merge

## Composes with

- `docs/governance/MANIFESTO.md` (the shadow lock this row converts)
- `memory/ani/conversations/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md` (V1+Bounded-Mobility verbatim source)
- `~/.claude/projects/.../memory/feedback_aaron_ani_root_discipline_manifesto_v2_civsim_play_arg_layer_dbsp_clifford_2026_05_14.md` (V2 diff description)
- 081KRHWGX0008QG0R0016T9408 (constitutional-promotion-readiness P0 — depends on full lock first)
- `.claude/skills/chrome-lazy-load-chunked-extraction` (procedure for Grok extraction)

## Substrate-honest framing

P2 because: shadow lock is operational substrate today (it captures both the verbatim V1+Bounded-Mobility AND the reconstructed V2 additions per the diff). Full lock is preferable but not blocking. Aaron's cadence (per `feedback_aaron_forgetting_as_backpressure_in_memory_system_wait_for_consolidation_cadence_2026_05_14.md`) suggests waiting a couple of days before pushing on new substrate; this row should be picked up when Aaron has burst capacity AND access to the Grok session.

## Origin tick

Otto-CLI 2026-05-14T~23:55Z, shipping the shadow lock with Aaron's "lock it (shadow*)" instruction. Aaron substrate-honestly named the back-pressure framing in the same conversation.
