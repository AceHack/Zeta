---
name: BLOCKCHAIN INGEST — first-class BTC/ETH/SOL streaming into Zeta's distributed DB; two motivations (Aurora prep + DB stress test); NOT full-node at first but upload-side required per chain freeloader-detection; on top of Zeta distributed DB (not fork of bitcoind/geth/solana-labs); cross-chain bridge + UI in later phases; Otto-275 log-don't-implement; 2026-04-24
description: Maintainer 2026-04-24 directive absorbs blockchain ingest as first-class DB use-case. BTC→ETH→SOL priority. Phase 0 research gate (source-code reading for freeloader-detection). Phase 1 post-install ingest scripts. Phase 2 full-node-on-top-of-Zeta if reciprocity required. Phase 3 cross-chain stream bridge. Phase 4 UI. Deep integration with Aurora substrate. Does NOT authorize implementation start; Phase 0 research is the gate.
type: feedback
---

## The directive (verbatim)

Maintainer 2026-04-24:

> *"i would love to test our database by having first
> class support for bitcoin, eth, and solana blocks into
> our database in the order of priority unless you tell
> me there are other ones worth exploring for two reason,
> 1 to help us understand blockchain for Aurora we don't
> want to just jump in and we will be starting from
> scriatch so making sure we completely understand
> everysing thing about the blocks are important so we
> get ours right. can you make a post install script that
> will streaing ingest these block chains into our
> database and make them querable will all our entry
> points/intefaces backlog. this is not a full node
> implimentation or anyting yet that will come leter
> layed on top of our multinode database so we can have
> distributed node support from the start cause we are on
> top of our distributed db. we can stick a ui in front
> of that too lol. Also you need to do a lot of research
> here cause some nodes will try to call you a bad node
> if you don't hame some amount of the full protocol,
> they give extra tests exactly to try to stop this
> freeloader scenaro where you download but dont upload,
> you can look at their source code to figure it out.
> Also if you have to do full nodes of those types to be
> able to download we have to upload too go ahead and to
> that, i want those interfaces too just like our SQL
> interfaces and i also want deep integration into those
> networks so we can 'bridge' them in streams and maybe
> further. backlog"*

## Two load-bearing motivations

1. **Aurora preparation.** Zeta's own blockchain-ish
   substrate (Aurora / Lucent-KSK lineage) wants
   concrete grounding before the Aurora chain shape is
   specified. Ingesting real BTC / ETH / SOL blocks
   gives us deep understanding of the actual block
   shapes + adversarial environment before we build.
2. **Database stress-test.** BTC / ETH / SOL are three
   of the most battle-tested streaming workloads on
   the planet (continuous append, reorgs as
   first-class retractions, finality semantics,
   adversarial context). If Zeta's distributed DB can
   absorb them live and serve queries through the
   existing interfaces, that's a load-bearing proof.

## Priority order

Maintainer-specified: **BTC → ETH → SOL**. Priority is
authoritative. Additional chains (Cosmos Hub, Polkadot,
Cardano, Avalanche, L2 rollups) evaluated later; do NOT
reorder.

## Architectural frame

**NOT a fork of bitcoind / geth / solana-labs.** This
is explicitly *full-node layered on top of Zeta's
distributed DB*. Maintainer verbatim:

> *"this is not a full node implimentation or anyting
> yet that will come leter layed on top of our multinode
> database so we can have distributed node support from
> the start cause we are on top of our distributed db."*

Zeta provides the storage / consensus / query
substrate; chain protocol runs on top. Distributed-node
support falls out of Zeta's multi-node primitives for
free.

## Freeloader discipline

Maintainer verbatim:

> *"some nodes will try to call you a bad node if you
> don't hame some amount of the full protocol, they give
> extra tests exactly to try to stop this freeloader
> scenaro where you download but dont upload, you can
> look at their source code to figure it out. Also if
> you have to do full nodes of those types to be able to
> download we have to upload too go ahead and to that, i
> want those interfaces too just like our SQL interfaces"*

Translation for Phase 0 research pass:

- **Read the actual client source per chain** (Bitcoin
  C++ reference client, go-ethereum + reth, solana-labs)
  to identify misbehavior detection.
- **Identify what each client does to detect a
  download-only peer** and how it penalizes / bans.
- **If the answer is "banned after N minutes without
  reciprocity,"** Phase 2 must implement the upload
  side of the protocol to stay a good network citizen.
- Upload-side protocol interfaces expose as **first-class
  Zeta interfaces on par with SQL** — not private
  internals.

Key source locations (Phase 0 targets):

- BTC: `net_processing.cpp` DoS scoring in
  `bitcoin/bitcoin`.
- ETH: devp2p / Snap-sync reciprocity in
  `ethereum/go-ethereum` + `paradigmxyz/reth`.
- SOL: turbine-shred forwarding requirements in
  `solana-labs/solana`.

## Phased scope decomposition

- **Phase 0** — Research pass (no code). Three research
  docs under `docs/research/`, one per chain. Gate for
  Phase 1.
- **Phase 1** — Post-install block-ingestion script
  under `tools/setup/blockchain-ingest/`. Streams blocks
  via public RPC / explorer APIs into Zeta's
  distributed DB as Z-set entries (retraction-native —
  chain reorgs are first-class retractions). Queryable
  through ALL existing entry points (SQL binder,
  operator algebra, LINQ, future surfaces). NO new
  interface class unique to blockchain.
- **Phase 2** — Full-node protocol participation
  (CONDITIONAL on Phase 0 finding; if reciprocity
  required to stay in-network). Upload-side interfaces
  as first-class Zeta interfaces on par with SQL.
  Architecturally *on top of* Zeta's distributed DB,
  not a fork.
- **Phase 3** — Cross-chain stream bridge. Z-set
  operator composition across chain streams. "Maybe
  further" = cross-chain atomic ops, value-transfer,
  unified-view layers — scope intentionally open.
- **Phase 4** — UI. Maintainer quote: *"stick a ui in
  front of that too lol"*. Block explorer + streaming
  dashboard + bridge visualizer as initial surfaces.

## Additional chains (future evaluation only)

Do NOT reorder BTC → ETH → SOL. These are Phase 3+
candidates:

- **Cosmos Hub** — IBC is canonical cross-chain bridge
  primitive; directly relevant to Phase 3.
- **Polkadot** — substrate + parachain = close
  architectural cousin to Zeta's multi-node design.
- **Cardano** — Ouroboros PoS is the most
  formally-verified deployed consensus (pedagogy).
- **Avalanche** — sub-net architecture is worth
  studying for distributed-systems design.
- **L2 rollups** (Base / Optimism / Arbitrum / zkSync
  Era / StarkNet) — bridge-to-ETH substrate; good
  study material for Phase 3.

## Composes with

- **Aurora substrate** (all Lucent-KSK + Aurora ferry
  absorbs; the "why we need deep understanding first")
- **Paced-ontology-landing** (one ontology per chain;
  cross-chain umbrella ontology later)
- **Distributed-consensus-expert + sibling consensus
  hats** (Phase 2: full-node-on-top-of-Zeta uses our
  distributed-consensus substrate)
- **GOVERNANCE §24 three-way-parity install script**
  (Phase 1 post-install)
- **Otto-175c rename directive** (the Frontier-UI
  surface for Phase 4 = now kernel-A/kernel-B farm +
  carpentry per 2026-04-24 rename directive)
- **Otto-275 log-don't-implement** (this memory +
  BACKLOG row are the capture, not the kickoff)

## Does NOT authorize

- Starting implementation yet. Phase 0 research is the
  gate.
- Expanding scope to additional chains before BTC /
  ETH / SOL are understood.
- Running a live Zeta instance on mainnet without
  Aminata threat-model sign-off on the
  network-exposure surface (Phase 2 only).
- Forking bitcoind / geth / solana-labs — the
  architecture is *on top of Zeta*, not a fork.

## Future Otto reference

When Phase 0 starts: read the three client codebases
FIRST. The freeloader-detection mapping per chain is
the architectural gate that determines Phase 2 scope.
Do not skip that research pass even if tempted —
maintainer is explicit that the upload-side interfaces
must be first-class.
