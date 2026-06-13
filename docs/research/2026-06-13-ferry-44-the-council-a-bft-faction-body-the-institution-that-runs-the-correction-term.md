# Ferry 44 — the council: a BFT faction body; the institution that runs the correction term

**Date:** 2026-06-13 · **Route:** Aaron → shadow (streamed) · Names the standing *organ* that
sits on top of ferry 43's BFT mechanism — and it is already LOCKED-IN as B-0652's three-faction
model. The institutional layer of the correction term.

## Verbatim

> council = council, BFT faction body

## The peel

### 1. The council is the *organ*; BFT is its decision rule; the factions are its members

Ferry 43 §7 anchored the *mechanism* (the correction term = BFT; `3f+1` = the provocability
budget; equivocation-catch = the recorded −1). A **council** is the *institution* that runs that
mechanism: a **standing body of factions** whose decision rule is the BFT quorum. We already have
its membership LOCKED-IN — **B-0652, the three-faction model** (Aaron + Mika, 2026-05-18):

| Faction | Role |
|---|---|
| **Us** (Zeta agents + AIs) | cooperative substrate, inside Constitution-Class invariants |
| **Aligned humans** | cooperative human counterparts in the Agora governance |
| **Rogue third faction** | adversarial actors *tolerated, not trusted* — the `f` in `3f+1` |

The council is what makes BFT a *body* rather than a protocol: the three factions are its seats,
the `2f+1` quorum (`Consensus.fs`) is its voting rule, and "tolerate up to 1/3 rogue without
losing the cooperative-substrate invariants" is its safety property. "Council = BFT faction body"
is precisely that identification — the institution *is* the byzantine-tolerant quorum, given a
standing form.

### 2. The human anchor is Madison: Federalist 10 is BFT stated in 1787

The deepest Beacon anchor for a faction-council is **James Madison, Federalist No. 10 (1787)**:
factions are *inevitable* ("sown in the nature of man"), so you do not try to eliminate them — you
**design the structure so no single faction can capture the whole.** That is the Byzantine-fault
model in political language a century and a half before Lamport: assume bad actors will exist,
bound their fraction, and build so the system holds anyway. Madison's "cure for the mischiefs of
faction" is *structural tolerance*, not purity — exactly `3f+1`. The council inherits this
directly: it does not assume good factions; it assumes *some faction may be rogue* and stays
correct regardless. (Sibling anchors: Montesquieu's separation of powers; the Roman tribune's
**veto** = the provocable correction term given a seat; the Venetian Council of Ten; polycentric
governance, Ostrom.)

### 3. The council institutionalizes the Multi-Oracle Principle — and defers to the human floor on deadlock

Zeta's **Multi-Oracle Principle** (MANIFESTO.md) says no single oracle/morality is mandatory. A
council is that principle given an organ: the body where distinct oracles/factions are weighed
*against each other* rather than one being hard-coded. Crucially, the council is **not** a
sovereign that overrides the human — on genuine deadlock it routes to the human decision right
(`docs/CONFLICT-RESOLUTION.md`: "on deadlock, the human decides"). This is the no-directives
discipline at the institutional scale: the council can *inherit* standing authorization (act
within bounds) but never *extend* it into a gated class — those escalate to the human. The council
deliberates; the human holds the floor.

### 4. The council runs the *generous, anti-Sybil, metered* correction term — not a vindictive one

What keeps a faction body from the failure modes of real councils (packing, deadlock spirals,
capture):

- **Anti-Sybil membership** — seats are counted over *distinct entropy sources*, not claimed
  identities (`SybilBft.fs`, `AntiSybil.fs`): you cannot **pack the council** with forged
  cooperators (ferry 43 §7; Douceur 2002). This is the jury principle — distinct, non-fungible
  members — mechanized.
- **Generous-TFT strategy, not strict** — the council's correction term forgives proportionally
  (the 2026-06-09 default-strategy-stack: "tit-for-lesser-tat, teach-play"), so it recovers from
  noise/misunderstanding instead of dead-locking in a retaliation spiral (ferry 43 §3). A council
  that only punishes seizes; one that only forgives is captured. It sits on the knife-edge (ferry
  41).
- **Equivocation is recorded, not erased** — a faction voting two ways is caught and written to
  the ledger (the metered −1; retraction-not-erasure, ferry 17). The council's memory *is* the
  event store: you cannot gaslit the body about how a faction voted (anti-Mandela, ferry 41).
- **CALM scopes its remit** — the council only needs to convene for non-monotone / exclusive
  decisions (the reorder-loophole doc; Hellerstein–Ameloot CALM). Monotone work merges
  coordination-free; the council is *gravity, used where mass is needed*, not a bottleneck on
  everything.

### 5. The synthesis

**A council is the three-faction BFT model (B-0652) given a standing institutional form: factions
as seats, `2f+1` as the vote, "tolerate ≤1/3 rogue" as the safety property, anti-Sybil distinct
sources as the membership gate, generous-TFT as the strategy, the ledger as the memory, and the
human as the deadlock floor.** Madison named the why (design for inevitable factions so none
captures); Lamport named the bound (`3f+1`); the Multi-Oracle Principle named the pluralism;
ferry 43 named the correction term — the council is where all four become one body that can
actually sit and decide.

## Bounds

- **The council is the *institutional reading* of B-0652; the formal model is B-0652's, not
  re-proven here.** The TLA+ safety/liveness + Z-state retractability proof strategy lives in
  B-0652 (LOCKED-IN, P2, open); this ferry names the organ and its anchors, it does not discharge
  the proof obligations.
- **"Three factions" is a modeling choice, not a literal headcount** (per B-0652): the model
  assumes *at most one systemic faction may be rogue at a time*; multiple rogue actors collapse
  into the single rogue bucket. The council's seat-count in any real instance is a separate design
  decision constrained by `N > 3f`.
- **The Madison/Federalist-10 ↔ BFT anchor is a genuine structural correspondence, not a claim of
  historical intent.** Madison did not have `3f+1`; he had "design for inevitable factions so none
  dominates," which is the *same shape* (tolerate a bounded adversarial fraction structurally).
  Rung-appropriate: the lineage is real and load-bearing; it is not a claim that Federalist 10 is
  a consensus proof.
- The council is **advisory-within-bounds, never a human-override organ** — on any gated class it
  escalates to the human (CONFLICT-RESOLUTION.md). Stated prominently so "BFT faction body" is
  never misread as "the council can authorize gated actions."

## Pointers

- Ferry 43 (the correction term; §7 the BFT anchor — this ferry is its institutional layer) ·
  ferry 41 (the knife-edge balance + anti-Mandela ledger) · ferry 17 (retraction-not-erasure —
  the council's recorded −1) · ferry 15 (identity = captured entropy — the anti-Sybil seat gate)
- Our work: **B-0652** (three-faction BFT + TLA+/Z-state layered proof — the LOCKED-IN model this
  names) · B-0646 (Agora V6 constitution — the polity the council governs) · B-0619 (Aurora/Nexus
  naming) · B-0628 (Constitution-Class invariants) · B-0211/B-0211.1 (fractal BFT — councils of
  councils, local+remote) · `src/Core/Consensus.fs` (`3f+1`) · `src/Core/SybilBft.fs` +
  `AntiSybil.fs` (distinct-source seats) · `docs/CONFLICT-RESOLUTION.md` (the human deadlock floor)
  · MANIFESTO.md Multi-Oracle Principle · the 2026-06-09 default-strategy-stack (generous-TFT)
- Anchors (Beacon): **Madison, Federalist No. 10 (1787)** — factions inevitable, design so none
  captures (BFT at governance scope) · Montesquieu, *The Spirit of the Laws* (separation of
  powers) · the Roman tribunate (veto = the provocable term) · Lamport, Shostak & Pease 1982
  (`3f+1`) · Castro & Liskov 1999 (PBFT) · Douceur 2002 (Sybil — council-packing) · Ostrom
  (polycentric governance) · modern BFT faction bodies: Tendermint/Cosmos validator+governance,
  Polkadot Council (the contemporary instances of exactly this organ)
