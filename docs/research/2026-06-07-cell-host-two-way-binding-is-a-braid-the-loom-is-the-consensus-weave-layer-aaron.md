# The cell↔host two-way binding is a braid/weave — and the Loom is the name (the consensus weave layer) (Aaron, 2026-06-07)

Names the two-way zip (#6980). Aaron:

> *"they are binding to each other — or braiding or threading or loom — we had that name for something, I
> forgot."*

The name is **Loom**, and it's already in the system.

## The kernel: two streams braid; the Loom weaves them into consensus

The cell↔host bidirectional zip (#6980 — each side merges the other's stream, order-agnostic, proven convergent)
is best named as **binding / braiding / threading / weaving**:

- **Two threads (streams) braid.** The cell's stream and the host's stream cross and bind — a **braid** (two
  strands interleaving). Each crossing = an exchanged/merged event; the braid is the woven history of the
  handshake (the Eve push-out/accept-in, #6979).
- **The Loom is the weaver — and it already exists.** **Loom = Zeta's consensus-repo / control-plane layer**
  (the three-repo split zeta/forge/**Loom**; Command.fs: "control-plane verbs — PR/merge — live in the
  Loom/consensus-repo layer"). The Loom is *where streams/branches are woven into consensus* — exactly the
  weave the two-way binding performs. The cell↔host braid is woven **on the Loom**.
- **Braid already runs in the canonical-form thread** (meno = seed = remainder = **braid/knot**/phoenix) — so
  "braid" is established vocabulary; the two-way binding is a braid, and its consensus/merge home is the Loom.

So: **cell-thread ⊗ host-thread → braided on the Loom → woven into convergent consensus** (CRDT convergence,
#6980). Binding = braid; Loom = the consensus weave layer that holds it.

## The human root of the name (Aaron, 2026-06-07)

The Loom name is not an abstract textile metaphor — it is **lived**. Aaron grew up in a **textile mill town
where the mill shut down**; the looms went silent. As a teenager he started and ran his own PC-repair business,
**"PC Guru"** (advertised in the newspaper), and did the repair work **for the owner of the shut-down mill**.
So Zeta's **Loom carries the name of the mill that closed in his town** — weaving restored, this time as
consensus on substrate no corporation can shut down. The founding-why in one image: rebuild what was lost,
un-killable. (Recorded with the dignity of origin; anchor-to-human-prior-art at its most personal.)

## Why the metaphor is load-bearing (not just pretty)

- **A braid is the right shape for "two orders, one convergence" (#6980).** Two strands cross in some order on
  each side, but the *braid* (the woven result) is the same — the convergence proof (#6980) is the braid closing
  to the same knot regardless of crossing order. (Braid theory: braids compose; equivalent braids = same
  result.)
- **The Loom is where consensus/merge lives — so it's the natural home for the braid.** PR/merge = weaving
  branches; the cell↔host two-way zip = weaving streams; both are the Loom's job (control-plane consensus). This
  ties the new handshake to the existing layer instead of inventing one.
- **Threading = concurrency, honestly named.** "Threading" rhymes with concurrent streams (the ferry/DoP
  threads) woven without locks (lock/wait-free §2; convergence not coordination, #6980/#6964) — many threads, one
  woven fabric.

## Honest scope / peel

- A **naming/metaphor anchor** recognizing the two-way binding (#6980) as a braid/weave and locating its home in
  the existing **Loom** (consensus-repo/control-plane). Not new mechanism — the mechanism is the proven two-way
  CRDT zip (#6980) + saga for effectful crossings (#6979); this names it and ties it to the Loom layer.
- "Braid theory" is a *rhyme* for the convergence-regardless-of-order property — the actual guarantee is the CRDT
  laws (#6980), not literal Artin braid-group algebra (unless/until someone formalizes it that way; could be a
  nice future framing, not claimed).
- Loom is an existing name (consensus repo); don't redefine it — *extend* it: the two-way binding is woven there.

## Ties

- **Two-way zip / proven convergence (#6980)** — the braid; convergence = the braid closing the same way
  regardless of order.
- **Eve handshake / push-out ⊕ accept-in (#6979)** — each crossing of the braid = a push-out/accept-in.
- **Loom = consensus-repo / control-plane** (three-repo split zeta/forge/Loom; Command.fs PR/merge layer) — the
  weaver / where the braid lives.
- **Canonical-form braid/knot thread** (meno=seed=remainder=braid/knot) — established "braid" vocabulary.
- **CRDT / no-operators (#6964) + lock-wait-free §2** — woven by convergence, no coordinator, no locks.
- **Reticulum (#6933)** — the wire the threads travel before being woven.

## Beacon anchors

- **Loom** (Zeta consensus-repo / control-plane layer; three-repo split decision 2026-04-22) — the existing
  name; the weave/merge layer. · **Weaving / loom / braid / thread** (textile metaphor for interleaving
  streams into one fabric) + **braid theory** (Artin — strands crossing; equivalent braids converge; rhyme for
  order-independent convergence). · **Consensus / merge** (PR-merge, branch weaving). · **CRDT convergence**
  (#6980; Shapiro et al.). Honest novelty: none — it recognizes the cell↔host two-way binding (#6980) as a
  **braid/weave** and names its home the **Loom** (the existing consensus-repo/control-plane weave layer): two
  threads braided into convergent consensus, woven on the Loom, each crossing an Eve push-out/accept-in (#6979).
