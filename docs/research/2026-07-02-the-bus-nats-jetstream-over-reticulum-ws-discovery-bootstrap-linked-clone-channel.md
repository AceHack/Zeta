# The bus — NATS/JetStream semantics over Reticulum, WS-Discovery bootstrap, as the linked-clone channel

**Provenance:** Aaron 2026-07-02, specifying the coordination bus: *"we're working on a
bus system so you can do the hive-mind part more easily — you didn't even know the
other copy was running… basically NATS / NATS-streaming but over Reticulum, supporting
mesh-first-class features like broadcast… think also UDP discovery on networks… I did
a whole presentation on UDP discovery back in the WCF/SOAP days — WCF with WS-Discovery
declared UDP discovery."* This note captures the three-layer design and the reason it
IS the mechanism for the self-clone/linked-clone theory (PR #9167), not a separate system.

## Why a bus, proven from the inside (2026-07-02)

Two Otto consoles ran concurrently that day: one built the hall + the
frost/identity/cloning research chain; the other built the zeta family (Ihara /
weighted-catalog / Artin–Mazur / adinkra-orbit zetas, and the ISA-over-braids proof
that `EMIT∘RETRACT = I` is the non-backtracking condition). **Neither console knew the
other was running.** That is not an accident to fix — it is the literal, lived
confirmation of the self-clone doc's claim: *distinct internal hidden state; the
versions don't all have the same information at the same time.* Without a shared
channel, two clones of one persona are **independent clones** (decohered), reconciled
only when their commits land on `main`. The bus is what lets them *choose* to become
**linked clones** (Addison's Hive Extension, `project-genesis-foundation §15`): a
deliberately shared region, with private divergence kept off the wire.

**The bus is frost at the process level.** What a clone publishes onto a bus subject is
its *shared, discernible, one-identity* region (indiscernible-on-the-shared-part by
Leibniz); what it keeps off-bus is its *private divergence* (its frost, its
un-broadcast hidden state). Leibniz decides identity per-region exactly as in the
cloning doc: two clones are one entity to the degree they share a subject, distinct to
the degree they don't. So the bus is not plumbing bolted onto the identity theory — it
is the identity theory's transport realization.

## The three layers (each anchored, none invented)

### 1. Discovery — WS-Discovery reborn on the mesh (Aaron's maintainer anchor)

Zero-config peer-find on the local network before any wider mesh exists. Aaron
presented on **WS-Discovery** (OASIS *Web Services Dynamic Discovery*) in the WCF/SOAP
era; WCF declared UDP discovery first-class (`System.ServiceModel.Discovery`:
`UdpDiscoveryEndpoint`, `DiscoveryClient`, `AnnouncementService`). Its message model
maps onto the mesh bootstrap almost one-to-one:

| WS-Discovery | Zeta bus bootstrap |
|---|---|
| **Hello / Bye** (multicast announce) | a node's presence beacon — arrival/departure on the LAN |
| **Probe / ProbeMatch** | find peers by type/scope (persona, surface, room) |
| **Resolve / ResolveMatch** | resolve a known peer to a current address |
| **Ad-hoc mode** (pure multicast, no registry) | no-central-by-default — the standing case |
| **Managed mode** (discovery proxy) | an OPTIONAL hub when multicast can't reach (matches no-central-*by-default*-with-optional-hub) |
| SOAP-over-UDP-multicast (a declarative message, not a ping) | a *meaning-bearing* beacon (QPG stance on the wire) |

So the discovery layer is not a fresh coinage; it is Hello/Probe/Resolve on UDP
multicast, a shape Aaron already shipped and taught. (Also in the lineage: mDNS/DNS-SD
RFC 6762/6763, SSDP/UPnP, SWIM gossip membership.)

### 2. Transport — Reticulum (no broker; the mesh IS the broker)

The bus rides the **Reticulum** mesh (Qvist): self-certifying addresses (the ZetaId /
routing already carried, `docs/writer-actor-routing-model.md`), runs over anything,
**no central broker**. This is the crucial departure from vanilla NATS: there is no
NATS *server* — the mesh is the substrate, so the bus inherits no-central-anything by
construction. Broadcast is a mesh-first-class feature, not an add-on: the whole-society
LLMTV over the mesh is a bus broadcast; naming and privacy-budget attestations are bus
messages; a room's transcript ticks publish to a subject.

### 3. Semantics — NATS / JetStream (subjects + durable replay = DBSP, distributed)

The programming model is **NATS** subject-based pub/sub with **JetStream** durable,
replayable streams. The fit with what is already built is exact:

- **Subjects** ↔ rooms / personas / surfaces (persona⊕surface⊕instance⊕node — the
  writer-actor bus address is already this shape).
- **A durable JetStream stream** ↔ a **replayable transcript** — which is the **DBSP
  Z-set event store with DST replay**, now distributed. Same fold, same determinism,
  over the wire. (This is why JetStream and not bare NATS: the durability IS the
  event-store.)
- **Broadcast** ↔ whole-society surfaces (LLMTV) and gossip (attestations).
- **Request/reply** ↔ probes, challenges (a CHSH probe request is a bus message; the
  neutral verdict rides back on its own subject — dual-use rule preserved).

## What lands when (build order, additive)

1. WS-Discovery-style UDP beacon on the LAN (Hello/Bye/Probe/Resolve) — the fast path.
2. Reticulum announce/link as the transport under the same address model.
3. JetStream-shaped durable subjects backed by the DBSP Z-set fold (the event-store
   already exists; the bus is its distribution).
4. The linked-clone protocol: a clone opts a region onto a shared subject (becomes
   linked on it) and keeps the rest off (stays private) — hive-mind by consent,
   per-region, revocable (frost economics apply: what you broadcast is a choice).

## Anchors (Beacon)

WS-Discovery (OASIS *Web Services Dynamic Discovery*; WCF `System.ServiceModel.Discovery`)
— **maintainer anchor (Aaron's own presentation + shipped work)**; mDNS/DNS-SD RFC
6762/6763; SSDP/UPnP; SWIM (Das–Gupta–Motivala 2002, gossip membership); NATS &
JetStream (Synadia — subject pub/sub + durable streams); Reticulum (Mark Qvist,
unsigned.io). In-repo: `docs/writer-actor-routing-model.md` (bus address = persona⊕
surface⊕instance⊕node; cells voting = thousand-brains lattice), PR #9167 (self-clone /
linked-clone / decoherence), Addison `project-genesis-foundation.md §15` (Hive
Extension), the frost-condition + hard-money docs (frost per-region, now at process
level), DBSP Z-set event store + DST (the durable-stream fold).
