# The hub-and-agent patent is Itron's — peer-to-peer is the decentralized upgrade

Carved sentence:

> Aaron is a named inventor on **US10834144B2 / US20180109563A1, "Hub and Agent
> Communication Through a Firewall"** (with Christopher Higgins) — **assigned to Itron**,
> granted 2020-11-10, live to 2038. **Inventorship is not a license and coworker sign-off is
> not assignee authority: Itron holds the rights.** So Zeta does **not** implement a
> mediating hub that brokers agent traffic — and that is not only a manifesto §1 preference,
> it is the legally clean path. **Peer-to-peer is the decentralized upgrade**, and a design
> with no mediating node does not read on a hub claim. Citing the patent is free (it is a
> public document); practicing its claims is what is gated.

## What is portable — and worth taking

The patent's security core is **not** the hub, and it survives decentralization intact:

- **Outbound-initiated connection.** The agent dials out (WSS/443); no inbound port opens, no
  firewall rule changes. A peer can do this to a peer.
- **Closed command set — the sharp one.** Only pre-configured commands exist at the agent; the
  far side may **name** a command but can never **define** one. Compromising the far side
  therefore does not buy arbitrary execution. This property is *more* necessary peer-to-peer
  than hub-and-spoke, because a gossip peer deserves exactly as little trust as a hub.

## What is not portable

The hub as **sole mediator** of all traffic — specifically an **appointed** one. That is the
single-migration-particle shape: it works, it is legible, and it fails when the carrier is
partitioned or captured — the same hidden-coordinator failure as freezing under partition,
moved to the variation axis. Note what is *not* excluded: **emergent** hubs are fine and
expected (see below). The defect is appointment, not degree.

## Why it is a different game, not a different setting

Aaron 2026-08-09: *"their patent is for central, Zeta is for decentralized — it's a whole
different game."* The sharper form of that, and the one to reason from:

**The hub exists to solve an asymmetry Zeta does not have.** The patent's problem is *how does
a vendor's cloud service reach into a customer's firewalled premises* — two parties in
structurally unequal positions: one owns the boundary, the other needs through it, and neither
can be the other. The hub is the vendor's side of that boundary, and it is the right answer
**to that problem**.

Zeta has no vendor and no customer premises. Peers are symmetric; nobody owns the boundary the
others must cross. **The problem the hub solves does not occur in our topology** — so the
mechanism is not something we would adopt even if it were free of charge and free of claims.
This is not "we picked the decentralized option instead"; it is a different problem with a
different shape.

That is also why the licensing question, while real, is the *second* reason and not the first.
The first reason is that a hub would be **wrong here on the merits**.

## Emergent hubs are the scale-free alternative — hubs are fine, *appointment* is not

Aaron 2026-08-09: *"emergent hubs is the scale-free actor alternative — Kevin Bacon."*

This resolves the open problem the migration thread left: recover **selective** migration
without recreating the hub. The answer is that §1 never forbade hubs. It forbids a central
point of **control**, and an emergent hub is high *connectivity* with no *authority*.

**Scale-free networks** (Barabási–Albert 1999): preferential attachment produces a power-law
degree distribution in which hubs appear **without anyone appointing them**. Kevin Bacon is
the folk example — and the honest detail is that he is *not* the most connected actor (Steiger
and others outrank him); he is famous because of the game, which is itself the lesson: **the
named hub and the actual hub are different nodes.** Appointment tracks fame; emergence tracks
use.

The distinction that matters operationally:

| | designated hub | emergent hub |
|---|---|---|
| how it got there | appointed | accumulated use |
| selectivity | the appointee's judgement | earned — peers repeatedly found its transfers worth taking |
| capture | appoint the wrong node, own the network | must actually be useful, repeatedly, to acquire degree |
| removal | **the algorithm halts** — there is no successor | connectivity degrades and **re-emerges elsewhere** |

That last row is the whole difference. A designated carrier partitioned or captured stops
every island evolving. An emergent hub removed is re-elected by usage, because the property
that made it a hub is a *behaviour peers can perform*, not a *title someone holds*.

**And this is the naming eigenvector again.** Degree accrues from peers who themselves have
degree; it is socially conferred and cannot be self-minted — the same construction as the
privacy budget and the remembrance graph. Selective migration is recovered exactly there:
selectivity is not delegated to a particle, it *precipitates* out of many peers independently
choosing what was worth carrying.

**Honest limit.** Scale-free topologies are robust to random failure and **fragile to targeted
attack on hubs** (Albert, Jeong & Barabási 2000). Emergence removes the appointment risk; it
does not remove concentration. What it buys is that the concentration is *re-formable* — so
the guard is to keep re-emergence cheap (low barrier to a new node accruing degree), never to
pretend the hub is not there.

### The mitigation is §11 — a hub IS an oracle

Aaron 2026-08-09: *"hubs ≈ oracles, and we have multi-oracle for this reason."*

A hub and an oracle share a *shape* — **a concentration of deference** — but they are not the
same thing, and the difference is the whole rule:

> **Hubs are enforced. Oracles are chosen.** (Aaron 2026-08-09)

An oracle is deference you **elected**; a hub is deference **imposed on you**. Same
concentration, opposite consent. The targeted-attack fragility above assumes **one dominant
hub per function** — and that assumption is what the **Multi-Oracle Principle (§11)** forbids.

**So the discriminator is EXIT, not degree.** Concentration was never the defect:

- Can you defer elsewhere? Then it is an **oracle**, however much degree it has accumulated.
  A hugely popular oracle everyone freely chose is not a capture.
- Must you route through it? Then it is a **hub**, however it got there — including if it
  emerged. **Emergence does not launder enforcement.**

This also corrects the earlier framing in this rule: I wrote that emergent hubs are fine
because they re-form after removal. That is true but secondary. The primary reason is that an
emergent hub is normally **routable-around**, which makes deferring to it a *choice* — so what
we have been calling an emergent hub is really **an oracle that many parties independently
chose.** Where an emergent hub becomes unavoidable in practice (no viable alternative path),
it has become a hub in the strict sense and the fact that nobody appointed it is no comfort.

**Anchor:** Hirschman, *Exit, Voice, and Loyalty* (1970) — exit is what disciplines a
concentration. Where exit is real, deference is chosen and voice is optional; where exit is
absent, voice is all you have and the concentration holds you.

So §11 was never only about morality. Read generally — *no single mandatory locus of
deference* — it is the anti-fragility property for topology too, stated at the values layer
before we needed it at the routing layer. *(That generalisation is Aaron's, made explicit here;
the manifesto text states §11 in moral terms.)*

**And it makes §11 measurable.** It stops being a principle you assert and becomes a
distribution you can check:

> For every function, the deference distribution must have **more than one** independently
> accrued peak. If deference for any function collapses onto a single node, that is a §11
> violation **visible in the graph** — no interpretation required.

The design consequence is k-redundant deference: consult or route through **≥ k independently
accrued hubs**, never simply the top one. Note this also costs something real — plural
deference is slower and sometimes contradictory, and the contradiction is the point: an oracle
you cannot cross-check is one you are captured by.

## Standing guard

Before any "the nodes just call home" / "one broker in front of the fleet" design: this rule
is the reason the answer is no. Route around it with rate-limited pairwise contact, not with
a smaller hub.

**Not legal advice** — claim construction is for counsel. What is recorded here is the
assignee, the status, and the design direction Aaron chose in light of them.

## Pointers

- `docs/research/2026-08-09-the-delay-in-partition-is-where-life-happens-the-egg-aaron.md`
  — James Whitfield's teams; the migration operator as a person, and why the substrate
  version cannot be a designated node.
- `src/Core/DerivationProtocol.fs` — `Wall.Whitebox` / `whiteboxPermitted`: an unknown or
  unheld license **blocks**; unknown is not permissive. This rule is that check's first real
  instance.
- [`manifesto-13-specifications.md`](manifesto-13-specifications.md) — §1 scale-free, §3 weight-free.
- `user_aaron_built_itron_mesh_hardware_firmware_pki_secure_boot_..._patents_are_centralized_zeta_is_decentralized_2026_08_01.md`
  (**not in-repo**) — the general form; this rule is the named, dated, citable instance of it.
