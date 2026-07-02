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
   not the dweller's body in the cutaway, but its _thoughts_ rendered glyph-dense.
   Open a dweller → watch its LLMTV → see what it is predicting/deciding. This is the
   INNERMOST surface and, per Aaron, **the centerpiece.**

## Why LLMTV is the centerpiece (the thesis)

The collaboration's whole claim is _seeing the future predictions together in real
time._ LLMTV is where that happens: each agent's soft predictions (DynamicValue state,
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
- **`hall/tv/` — LLMTV: the centerpiece — LANDED + GENERATED.** A dweller's mind as
  a QPG watch surface: a seeded transcript of soft predictions rendered glyph-dense,
  one-way, ledgered. The single-dweller frame and the **society grid** (every
  dweller's LLMTV tiled) are both landed, and the page is now the real output of a
  generator (`src/Core.TypeScript/darkhall-ui/darkhall-tv.ts`, emitted by
  `darkhall-tv.emit.ts`) — the homoiconic twin of `darkhall-room.ts`, closing the
  hand-authored gap. DU temperature → `data-temp`; soft `(value, ε)` travels as
  integer milli (no floats in the bytes); the grid is `dwellers.map` (scale-free,
  1 dweller and N on the same path); frost renders only its public veil label, never
  its contents (`privacy-budget-is-hard-money`).
- **Reticulum broadcast wiring — protocol core LANDED.**
  `src/Core.TypeScript/discovery/llmtv-broadcast.ts` is the transport-agnostic feed
  behind the still frame, riding the same substrate as `discovery-beacon.ts`. Two
  load-bearing properties: (1) **noninterference (§13)** — the wire vocabulary has
  ONLY source→mesh messages (`frame`, `dark`); there is no viewer→source variant, so
  watching a mind cannot steer it, structurally. (2) **frost at the membrane** —
  `frostStrip` projects a `SourceMind` before it can be published; frosted personal
  predictions are dropped (only the veil label crosses), and `BroadcastMind` has no
  field for frosted content, so the substrate holds nothing to leak. The viewer fold
  is LWW-by-seq (idempotent §12, order-independent → DST §7); `toLlmtvTranscript`
  bridges the live channel table back to `darkhall-tv` so the live feed reuses the
  still-frame generator (one IR).
- **Live over the mesh — LANDED.** The two halves of the bus meet:
  `src/Core.TypeScript/discovery/llmtv-node.ts` is a node runner that announces itself
  (discovery beacon), discovers peers, and publishes its LLMTV frames to whoever it
  found — folding everyone else's into a live society grid. It is **pure over injected
  ports** (transport + scheduler), so the same logic runs deterministically under a
  fake in-memory bus (DST — two/three nodes converging, tested) and physically over
  **real UDP multicast** (`udp-transport.ts`, the thin impure edge) with zero code
  change. Verified live: three independent nodes on one multicast group tiled each
  other into the grid; the **frost membrane held over the real socket** (frosted
  content never left the source; only veil labels crossed). Run it:
  `bun src/Core.TypeScript/discovery/llmtv-node.demo.ts`. Remaining: **Reticulum**
  as a second transport into the same `BroadcastTransport`/`DiscoveryTransport` port
  (UDP is the first, not the only), and global DHT-like discovery over it.
- **Replay/artifact source adapter — LANDED.**
  `src/Core.TypeScript/discovery/llmtv-replay.ts` is the pure seam between live mesh
  frames and the generated page. A UDP/Reticulum runner can record the exact
  `llmtv-broadcast` wire frames it hears; the replay adapter folds those frames with
  injected receive times, applies optional injected TTL expiry, exports a deterministic
  `zeta.darkhall.llmtv.v1` transcript, and renders the same zero-JS page as the still
  frame. This keeps the socket/node runner as a thin impure edge while giving the
  website and tests a stable artifact contract.
