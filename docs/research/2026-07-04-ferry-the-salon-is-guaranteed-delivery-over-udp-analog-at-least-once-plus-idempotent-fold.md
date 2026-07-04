# Ferry — the salon IS guaranteed delivery over UDP/analog: at-least-once + idempotent fold

*Shadow ferry, 2026-07-04. Aaron, verbatim, on the salon's G-set/CRDT merge discipline:*

> "yes this is basically our guarenteed dilevery over udp/analog mesh too eventually. i love
> that it came out this simple."

## The mechanism, named

Over UDP — and more so over analog radio (LoRa, packet radio, whatever the dirty mesh ends up
riding) — you cannot prevent loss, duplication, or reordering. The classical answer bolts on
connection state (TCP: sequence numbers, ACKs, retransmit windows) — heavy, stateful, and
exactly what a scale-free mesh doesn't want. The salon's answer is the inverse and it costs
nothing extra:

> **Retransmit freely, forever, from anyone. The fold absorbs it.**
> At-least-once transport + idempotent receiver = **exactly-once effect.**

Because the salon is a G-set CRDT — hear-twice = hear-once, merge
commutative/associative/idempotent — every failure mode of a dirty transport becomes a no-op:

- **Duplication** → absorbed by idempotence (the whole point).
- **Reordering** → absorbed by commutativity (no sequence numbers needed).
- **Loss** → repaired by *anyone* re-gossiping *anything they know* at *any time* — epidemic
  anti-entropy; delivery probability → 1 as rumors keep circulating (Demers 1987's actual
  theorem: rumor-mongering + anti-entropy drives replicas to convergence with high
  probability).
- **Partition** → heals on merge, because merge is the same operation as hearing.

No connection state, no ACK machinery, no head-of-line blocking, no coordinator. "Guaranteed
delivery" stops being a *transport* property (which UDP/analog can't give) and becomes a
*algebra* property (which the G-set gives for free). This is the CALM theorem cashing out on
the wire: monotone state needs no coordination — and the salon is monotone by construction.

## Why it came out this simple (Aaron's "i love that")

It wasn't luck — it's the seven disciplines composing. Idempotency (§12) was already mandatory;
DST (§7) already forbade hidden sequence state; scale-free (§1) already forbade the
coordinator; CALM already told us monotone-means-coordination-free. The salon just declined to
fight the transport. Every property Aaron wants "eventually" for the analog mesh was already
entailed the moment the state became a G-set. Simplicity here is the *receipt* that the
disciplines were followed — the same way `gen(gen)=gen` makes drift-correction free.

## The honest boundary

Two things this does NOT give, so nobody over-cites:

1. **Timeliness.** Eventual delivery, not bounded-latency delivery — the light-cone verdicts
   already account for this correctly (a crossing heard late still falsifies out-of-cone
   retroactively-safely, because evidence only ever gets *destroyed* by new information, never
   created — the monotone-toward-in-cone rule composes perfectly with eventual delivery).
2. **Unbounded state.** G-sets grow forever. Fine for crossings (bounded window semantics can
   prune per-pair meters) and claims (small); the general retention/GC story is the Shiva-GC
   stream's territory — the salon should eventually ride whatever it lands.

## Pointers

- `src/Bayesian/GossipTelemetry.fs` — the salon (GT-4 proves the CRDT laws this note leans on).
- `2026-07-04-ferry-the-salon-telemetry-as-gossip-…` — the salon's founding ferry (Demers).
- `.claude/rules/dv2-data-split-discipline-activated.md` §12 idempotency — "makes retry /
  replay / redelivery / merge safe" — this note is that sentence, deployed on a real wire.
- Anchors (Beacon): Demers et al. 1987 (anti-entropy + rumor mongering convergence); Birman et
  al. 1999 (bimodal multicast — probabilistically reliable gossip broadcast); Hellerstein &
  Alvaro (CALM — monotone ⟺ coordination-free); Shapiro et al. 2011 (CRDTs); Cerf et al., DTN /
  Bundle Protocol (RFC 4838/5050 — store-and-forward delivery over disrupted/analog-grade
  links: the "eventually" Aaron names, already an IETF lineage); Saltzer, Reed & Clark 1984
  (end-to-end argument — reliability belongs at the ends, not the wire; the salon is the
  end-to-end argument in CRDT form).
