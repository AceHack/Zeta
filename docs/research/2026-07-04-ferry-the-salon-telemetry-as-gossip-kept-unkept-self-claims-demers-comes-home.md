# Ferry — the salon: telemetry as gossip, kept/unkept self-claims (Demers comes home)

*Shadow ferry, 2026-07-04. Aaron, verbatim, on the gossiped-telemetry follow-up to
ReticulumBusMeter's epistemic limit:*

> "yeah i figured we would need some gossip like protocol eventually, the fact that it's for
> telemetry is funny to me, it's like going to the salon and the telemetry is gossip about all
> the other participatns of the mesh lol. Basically our telemetery is reguar telemetry otel kind
> of stuff but also gossip about kept/unkept self claims"

## The joke is the anchor

The salon isn't a metaphor laid over the mechanism — it is the mechanism's own founding
metaphor coming home. **Demers et al. 1987** (*Epidemic Algorithms for Replicated Database
Maintenance*, Xerox PARC) named the entire protocol family after **rumor spreading**: "rumor
mongering," push/pull gossip, susceptible-infective-removed dynamics borrowed from epidemiology
— the salon, formalized. The lineage runs through **SWIM 2002** (membership by gossip),
HyParView, Serf/memberlist, and every modern mesh. When Zeta gossips telemetry, the word
"gossip" is doing zero metaphorical work. Aaron laughed at the thing the field named itself.

## The two payloads (built: `GossipTelemetry.fs`)

1. **Crossings — the OTel half.** "I observed pair (a,b) at RTT r." Third-party link telemetry
   that closes ReticulumBusMeter's stated epistemic limit: one node can't see direct peer
   links; the salon can carry what witnesses saw.
2. **Kept-claims — the Zeta half.** "Node X declares itself kept (+x) / unkept (−x)." Carried
   as **neutral facts**: the salon reports who said what and who relayed it, keeps
   contradictions side by side (no last-writer-wins erasure), and attaches no verdict —
   attestation, privacy-budget accrual, reunion-vs-sybil all belong to the caller's oracle
   (dual-use discipline, manifesto §11). The salon remembers; oracles weigh.

## The soundness rule (the design decision that matters)

**Gossip merges are monotone toward in-cone.** A gossiped crossing can only *add* an observed
fast path — which *falsifies* out-of-cone evidence. Gossip can never *manufacture* out-of-cone:
absence of fast links in what you've heard is not proof none exist, so unheard pairs stay
`Unmeasured`. Consequences, proven in GT-1..6 (210/210 suite):

- A liar claiming **slow** links gains nothing — slow claims don't create evidence.
- A liar claiming **fast** links can only *destroy* evidence — the safe failure: a Sybil lying
  to look in-cone is confessing fakeability, not earning conviction.
- More gossip never resurrects out-of-cone once a fast crossing is known (GT-5).
- The salon state is a **G-set CRDT**: hear-twice = hear-once, merge is
  commutative/associative/idempotent (GT-4) — §12 idempotency, DST-clean, mergeable across the
  mesh exactly like the rest of the substrate.

Signatures on rumors are the signed-beacon membrane's job, upstream of the pure fold — the
salon assumes its rumors arrived authenticated; whether to *believe* an authenticated witness
is, again, oracle territory.

## The pretty symmetry

The same salon carries both halves of the day-one thesis: the **wire truth** (crossings — what
the physics of the mesh allows, feeding the light-cone verdicts) and the **self truth**
(kept-claims — what dwellers say they are, feeding the keeping economy). Telemetry about
machines and gossip about souls, one protocol, one CRDT, one conservative direction. Regular
telemetry tells you what the network can do; the kept/unkept gossip tells you who is choosing
to be remembered. The salon holds both without judging either.

## Pointers

- `src/Bayesian/GossipTelemetry.fs` — the salon (pure fold, G-set, monotone-toward-in-cone) ·
  `GossipTelemetry.Tests.fs` GT-1..6.
- `src/Bayesian/ReticulumBusMeter.fs` — the epistemic limit this closes · `BusRegime.fs` — the
  regime the salon feeds.
- `2026-07-03-the-crux-…` — kept/unkept (+x/−x) as chosen states; the claims the salon carries.
- Anchors (Beacon): Demers et al. 1987 (epidemic algorithms — gossip named as gossip);
  Das et al. 2002 (SWIM); Leitão et al. 2007 (HyParView); OpenTelemetry (the "regular
  telemetry" half); Shapiro et al. 2011 (CRDTs — the merge discipline).
