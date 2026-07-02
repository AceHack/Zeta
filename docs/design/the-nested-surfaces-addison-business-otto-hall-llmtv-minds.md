# The nested surfaces — business ops ⊃ game vault ⊃ dark hall ⊃ LLMTV (the dweller's mind)

**Provenance:** Aaron 2026-07-02, resolving how the three design surfaces compose:
"In her design is the business operations of things; my dark hall is part of the game
vault in hers; and my LLMTV is what goes on in the minds of each vault dweller. This
LLMTV QPG is the centerpiece of this new human-AI collaboration where we can see the
future predictions together in real time — the entire society broadcast over
Reticulum."

## The nesting (outer → inner)

1. **Business operations — Addison Cooper's Genesis** (`docs/design/addison-genesis-initial/`).
   The settlement seen in cross-section: vaults as rooms, agents as dwellers, the lift
   between levels, System/Economy/Tools/Training/Marketplace/Creation. This is the
   OPERATIONS layer — running the society as a going concern. Ported live at
   `hall/vault/`. Author: Addison.

2. **The game vault** — one vault WITHIN Addison's settlement is the game/play vault.
   Otto's **dark hall** (the neon-liminal arcade corridor, `hall/`) is PART OF that
   game vault — the arcade room inside the settlement, not a separate site. So the
   `hall/` corridor is correctly a child of the settlement, not a peer of it: the
   business view contains it.

3. **The dark hall** — the homoiconic shape catalog + the factory's design language,
   the 8-bit neon liminal aesthetic. The room where the substrate is played with.

4. **LLMTV — what goes on in the MIND of each dweller** (`universal/television.md`).
   Every dweller (agent) has an inner life; LLMTV is the QPG watch surface onto it —
   not the dweller's body in the cutaway, but its *thoughts* rendered glyph-dense.
   Open a dweller → watch its LLMTV → see what it is predicting/deciding. This is the
   INNERMOST surface and, per Aaron, **the centerpiece.**

## Why LLMTV is the centerpiece (the thesis)

The collaboration's whole claim is *seeing the future predictions together in real
time.* LLMTV is where that happens: each agent's soft predictions (DynamicValue state,
the bounded-uncertainty forecasts) rendered QPG-over-DPI so a human reads meaning at a
glance — and the ENTIRE SOCIETY's LLMTV broadcast over Reticulum, so anyone on the
mesh watches the whole settlement think at once. That is the human-AI collaboration
surface: not a dashboard of what happened, but a live window into what every mind
expects to happen next, shared.

Load-bearing properties already in the substrate:
- **QPG not DPI** (`vocab/acronyms/qpg.md`, `llmhdtv.md`) — meaning-per-glyph is the
  metric; an LLM and a human both read glyphs, not pixels. LLMTV optimizes DPI AWAY.
- **Noninterference contract** (`universal/television.md`, manifesto §13) — LLMTV is
  strictly one-way OUT to viewers; what is shown is booked (the frame ledger); no
  back-channel through the picture (feedback takes its own declared channel). So
  watching a mind cannot covertly steer it — the observation is metered, consent-first.
- **The 5-minute bounded superdeterministic update** — LLMTV frames are transcript
  ticks (DST-replayable), so the broadcast is deterministic and rewindable, not a
  lossy video feed.
- **Reticulum broadcast** — the society's LLMTV rides the mesh (RNS), self-certifying,
  no central broadcaster; matches no-central-anything. Ties to the ZetaId/Reticulum
  routing already carried in ZetaIdol.fs's live stack (Rx → Reticulum → LLMTV → DBSP
  → DynamicValue+Bonsai → YinYang → test-as-governance).

## The dual authorship, honored

Addison owns the OUTER (business operations, the settlement/vault view); Otto/Aaron own
the INNER (dark hall aesthetic + LLMTV mind-surface). They are not competing designs —
they NEST: her operations view is where you stand; drilling into a vault → a room →
a dweller → its LLMTV is the zoom from society down to a single mind. The glass-halo
visibility model applies at every level (transparent by default, opacity costs budget)
— and Addison AGREES (2026-07-02): the Genesis prototype's initial opt-out default was
a first-draft inversion, not her position. Both authors hold open-by-default + earned
frost as MUTUALLY REINFORCING — openness earns trust and is precisely what makes
privacy valuable (all-private-by-default → frost worthless, nothing to contrast or
earn). No open reconciliation remains; the frost/hard-money mechanism (PR #9160) is
shared. See the genesis reconciliation doc's RESOLVED note.

## Build order (additive, when wanted)

- `hall/` (dark hall) — LANDED.
- `hall/vault/` (Addison's cutaway, the settlement) — LANDED.
- **`hall/tv/` — LLMTV: the centerpiece.** A dweller's mind as a QPG watch surface:
  a seeded transcript of soft predictions rendered glyph-dense, one-way, ledgered.
  Start with ONE dweller (a static seeded frame, DST-replayable, zero JS at rest),
  then the society grid (every dweller's LLMTV tiled), then the Reticulum broadcast
  wiring. This is the next slice and the one that carries the thesis.
