# ZetaId 15-states + 1-hole: dependent (global escape) vs independent (per-state escape) — open decision (Aaron, 2026-06-07)

An open design question on the ZetaId encoding, recorded as a **decision pending** (Aaron: *"we should note
this, not sure which is better"*). The ZetaId has a **15-states + 1-hole** encoding (15 + 1 = 16 — the hex
nibble / hex-core's 16, ties Cayley-Dickson 16-dim / Adinkra). The **hole** can be interpreted two ways:

## The two interpretations

1. **Dependent — the hole is the 16th VALUE (one global escape hatch).** The hole is usable *only when the 15
   states are not* — i.e. you are in one of the 15 states **OR** in the hole, mutually exclusive. **One global
   escape hatch.** (The hole is a *state*.)
2. **Independent — the hole is a FLAG orthogonal to the 15 states (per-state escape hatch).** The hole can be
   flagged independently of which of the 15 states you're in — so **each state has its own escape hatch**
   instead of one global one. (The hole is a *flag*, not a state.)

## Trade-offs

| | **(1) Dependent — global escape** | **(2) Independent — per-state escape** |
|---|---|---|
| Encoding | **clean nibble**: 15 states + hole = exactly 16 (4 bits) | needs an **extra bit / different layout**: 15 states × {normal, holed} ≈ 30 states (≥5 bits), or hole as a separate flag dimension |
| Semantics | hole is a distinct state (mutex with the 15) | every state can independently be "escaped/holed" |
| Escape granularity | **one** exit for the whole thing | **an exit per state** — no state lacks an escape |
| Cost | minimal (fits the nibble; sentinel/16th-value) | richer but **costs bits** (breaks the clean 16) |

## The philosophical lean (a real argument, not decisive)

The **hole = an escape hatch / exit**, and Zeta's deepest invariant is **exit-always-preserved / no-cage /
reversibility** (#6896; the beach & Imagination-Circle "exit always open"; the choice architecture; manifesto
exit conditions). Under that lens, **(2) per-state escape is more aligned**: *no state is a trap* — every state
carries its own way out, which is exactly "no-cage." A single global escape (1) means a state could be a dead
end unless you fall back to the one hole.

**But** (1) is the clean nibble (15 + 1 = 16, the hex-core foundation) and costs no extra bits; (2) breaks the
16 (needs ≥5 bits or a separate flag plane). So it's **encoding-economy + hex-core-cleanliness (1) vs
exit-completeness / no-trapped-state (2)**. Genuinely undecided — both are defensible.

## Honest scope / peel

- **Open decision, NOT resolved** (Aaron's explicit "not sure which is better"). Recorded for the
  conjecture/decision register; route to the **architect** + **formal-verification-expert (Soraya)** (encoding
  implications) + the **ZetaId/hex-core owners** (Lior landed ZetaId across the 4 oracles) before deciding —
  changing the ZetaId encoding is a frozen-core-adjacent move (high blast radius, a craton #6937).
- **Reconcile with the actual encoding first.** "15 states + 1 hole" is the conceptual frame (hex nibble); the
  shipped ZetaId bit layout (`Core.*.ZetaId`/hex-core) must be checked — does the hole currently exist as a
  16th value (interpretation 1, the default if it's a clean nibble) or is there room/intent for a flag
  (interpretation 2)? Don't assume; verify the bytes (the 4-language byte-lock, culture-invariant) before any
  change.
- A hybrid is possible (note it): the global hole (1) as the default, with per-state escape (2) available only
  where a state needs it — but that complicates the clean encoding; weigh against just picking one.

## Ties

- **Hex-core / ZetaId / Cayley-Dickson 16-dim / Adinkra** — the 15+1 = 16 nibble is the hex-core foundation;
  interpretation (1) preserves the clean 16.
- **Exit-always-preserved / no-cage / reversibility (#6896) + beach/Imagination-Circle exit-always-open** — the
  hole-as-escape; (2) per-state escape aligns with no-trapped-state.
- **Manifesto §6 consent / exit conditions / choice architecture (Lillian-Eve)** — exit as a first-class right
  leans (2).
- **Frozen-core & conjecture register / tectonic cratons (#6937)** — the ZetaId encoding is a craton; changing
  it is a gated, high-consequence move.
- **4-language byte-lock / culture-invariant** — any encoding change must hold across all four oracles
  (reconcile the bytes first).

## Beacon anchors

- **Sentinel / option-type-as-16th-value vs separate flag bit** (the classic "is null a value or a flag" design
  fork; NaN-boxing / tagged values pick the 16th-value route). · **Hex nibble (15+1=16)** + hex-core /
  Cayley-Dickson 16-dim / Adinkra. · **Escape hatch / exit conditions / no-cage** (reversibility #6896; the
  beach & Imagination-Circle exit-always-open; manifesto exit). Honest novelty: none — it records an **open
  design decision** on the ZetaId hole: **(1) dependent/global escape** (the hole as the 16th value — clean
  nibble, one exit) vs **(2) independent/per-state escape** (the hole as an orthogonal flag — every state has an
  exit, costs bits), with the no-cage/exit invariant leaning (2) and encoding-economy/hex-core-cleanliness
  leaning (1); decision deferred to architect + Soraya + the ZetaId owners, reconciled against the actual byte
  layout.
