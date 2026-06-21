# Externalizing the head-shapes into GPU primitives; roads and monorails — safe lanes and speed limits, in BOTH directions

Aaron 2026-06-11 (right after the physics kernel landed):

> "I'm trying to **recreate/externalize the shapes I see in my head into GPU-accelerated primitives
> anyone can use and steer** on the **roads we build in our network**. We will have **monorails for
> automated travel**, but **roads where humans can steer without causing chaos and destruction to AI
> civilization**. We will have **safe lanes carved out** and **speed limits** — maybe we might need
> them **for society in general** for some things."

## 1. The externalization (what the library IS for)

The CHIP-9 graphics/physics library is not decoration — it is **Aaron's internal geometry made into a
commons**: the Feynman-diagram shapes he sees (worldlines, light-cones, four-corner flows, the braid/
weave topology) become GPU-accelerated primitives ANYONE — human, agent, CHIP-9 citizen — can pick up
and STEER. The fix16 kernel is the first such shape (exact motion); the 4090/3090 bench (in hand) is
where they accelerate; the 081KTSZN10008QG0R000VZHRQ4 fan-out is how one shape runs everywhere. Vernacular test passed by
construction: a primitive you can steer IS the shape explained without jargon.

## 2. Roads and monorails — the traffic topology of the network

Two kinds of way, deliberately distinct:

- **Monorails** — automated travel: fixed guideways, scheduled, deterministic — the spawn chains, the
  workflow runners, the wheels of time. High throughput BECAUSE no steering: the vehicle cannot leave
  the rail (DST is the rail).
- **Roads** — steerable travel: humans (and steering agents) drive freely — the CYOA, take-the-
  controls, the swarm board's go: — but on CARVED LANES with SPEED LIMITS, so that free steering
  cannot shear into the automated traffic.

## 3. The inversion that matters (the load-bearing clause)

Read it again: *"roads where humans can steer **without causing chaos and destruction to AI
civilization**."* The usual safety frame is one-directional — rails protect humans from machines.
Aaron's lanes protect **in both directions**: human steering is a genuine hazard to a running AI
society (a human merging into the lockstep traffic at the wrong speed shears determinism, floods
queues, wrecks in-flight conferences), so the SAME infrastructure that gives humans freedom carves
lanes that keep their steering survivable for everyone else. This is the **bidirectional alignment**
thesis (the 2026-05-02 doc) poured into asphalt: protection runs both ways or it isn't protection.

Already-built instances, named: the presence throttle (a human joining slows the room FOR the human —
and the room's max-speed lanes stay open elsewhere); take-the-controls (the seam is a lane merge: the
recording yields the lane cleanly); the ferry throttle (ramp metering); the §13 membrane (the median
barrier); the progress gate (no parking on the throughway).

## 4. Speed limits "for society in general"

The honest, careful reading of Aaron's "maybe might need them": some flows may need RATE bounds not
because any single actor errs but because UNBOUNDED COLLECTIVE SPEED is itself the hazard (flash-crash
dynamics; thundering herds; memetic cascades). The substrate already prices this — heat IS the speed
limit's physics (the tank, Landauer) — and governance already bounds it (ethics-and-heat, the two
governors). Flagged as a SOCIETY-SCALE design question, not decided here: which flows get limits, who
sets them, and how they stay weight-free (a speed limit must not become a capture point — limits as
treaty-ratified, revisable, posted-on-the-board rules; never a hidden throttle).

## Anchors (Beacon)

Traffic engineering as the discipline of mixed-autonomy flow (lane discipline; ramp metering;
Monderman's shared-space counterpoint — where REMOVING separation works, and why it needs eye contact
we don't have at machine speed); the bidirectional-alignment doc (2026-05-02); flash-crash literature
(the collective-speed hazard); Wiener again (governors).

## Pointers

- `Chip9Phys` (the first externalized shape) · 081KTSZN10008QG0R000VZHRQ4/081KTSZN10008QG0R0003SDRWD (GPU + the board the roads draw on) ·
  the presence throttle + take-the-controls + ferry throttle + §13 (the built lane-pieces, named) ·
  `TrustCalculus.Dynamics` (lanes as granted capability) · the feel charter (roads are drivable by a
  5-year-old at the kid lane's speed).
