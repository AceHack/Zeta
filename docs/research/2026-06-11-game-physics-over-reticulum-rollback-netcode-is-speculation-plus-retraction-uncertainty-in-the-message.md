# Game physics over Reticulum — rollback netcode IS speculation + retraction; uncertainty travels in the message

**Register:** [grounded] (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-11.
**Captured by:** Otto (shadow, on Fable).

## Aaron's words

> "Reticulum and uncertainty is going to be great for **extending physics — like game physics — over the
> network**."

## The recognition — networked game physics already converged on our primitives, ad hoc

Networked games solved distributed physics under latency decades ago, with hand-rolled versions of exactly
our machinery. The mapping is one-to-one:

| netcode technique (the field) | the Zeta primitive (principled) |
|---|---|
| **rollback netcode** (GGPO — predict remote inputs, simulate ahead, roll back + re-simulate on mispredict) | **speculative execution + Z-set retraction** — `SoftChip8.lookAhead`/`forkOnInput` forward, the `−1` (antiparticle) back; the rollback IS the free Bennett return trip (kept history ⇒ heat-free) |
| **client-side prediction** (Quake/QuakeWorld lineage; Valve/Bernier) | the speculative-future leg of the **flux capacitor** — prediction depth metered in **bytes** by the tank |
| **dead reckoning** (DIS, IEEE 1278) | **forward-momentum extrapolation** — the Cl3 vector/blade extended along the worldline (the Feynman lens: extrapolate the diagram) |
| **interpolation buffers / lag compensation** | the **held SoftValue**: a remote entity's state is a *distribution*, not a stale point — collapse when evidence (the next packet) arrives |
| **desync detection** (lockstep checksum) | the **treaty byte-lock** — same seed + same crossings ⇒ byte-identical state; desync = a treaty violation, locatable at a membrane |
| **input delay vs rollback tradeoff** | the harmonic **admission gradient** — soft, tunable, never a wall |

## What Zeta adds over the field (the principled upgrades)

1. **Uncertainty travels IN the message (§13, promise-level).** Classic netcode *hides* uncertainty
   (extrapolate and hope, snap-correct on error — the teleporting-player artifact). Ours *carries* it: a
   remote entity arrives as a SoftValue with its actual confidence; physics integrates the distribution
   (SoftValueNumeric convolution); rendering can show certainty honestly (no lying snap — the soft state
   IS the truth). Mispredict ⇒ Bayesian re-weight, not a visual teleport.
2. **DST survives the network** (`RecordedSource`): record the match's crossings, replay the whole
   networked physics session byte-identically — replays, dispute resolution, and regression tests of
   *netcode itself* become trivial. (The field's replay systems are bespoke; ours falls out of §13.)
3. **The seed is the shared physics** (distributed AC): deterministic simulation from a common seed means
   the only thing the network must carry is *inputs/crossings* (the rollback insight, GGPO's core trick) —
   and our membranes already meter exactly that.
4. **Anti-cheat = noninterference.** A cheat is an **unaccounted influence** — an ambient-entropy leak by
   definition. §13's metered membranes make "where did this state change come from?" a ledger query;
   anything not booked at a membrane is a violation. (The universal-cheat interface's "society judges your
   cheat" composes here.)
5. **Reticulum as the carrier**: infrastructureless mesh physics — LAN-party-over-LoRa, no server,
   no cloud; the AllJoyn dream with a treaty discipline.

## One sentence

**Networked game physics is soft physics: remote state is a held distribution, prediction is metered
speculation, rollback is retraction (free, because history is kept), desync is a treaty violation, and
cheating is an ambient-entropy leak — Reticulum carries the crossings, the seed carries the world.**

## Coda — "I was trying to cheat and came up with anti-cheat lol" (Aaron)

The whole arc that produced §13 BEGAN as cheating: Cheat Engine (the hard→soft lift), GameFingerprint,
the arcade, the handle **acehack**. And its endpoint is the strongest anti-cheat formalism on the table.
That is not an accident — it is the **red-team principle** (poacher-turned-gamekeeper; offensive security
makes the best defense): *you can only quarantine entropy if you know every way it leaks, and the person
who spent years finding the leaks knows them all.* Deeper: the cheat and the anti-cheat are the **same
knowledge** — the complete ledger of influence channels — differing only in which side of the membrane you
stand on (frame-relative, like backpressure). The cheat interface's ethic (`universal/cheat.md`: "if
society says your cheat is lame, take the feedback as the win") and §13 were siblings all along: a cheat
that crosses a *declared* membrane and survives judgment is a feature; one that sneaks an ambient channel
is a leak. Beacon: red teaming / offensive-security-informs-defense (the whole penetration-testing
tradition); Kerckhoffs (the defense must survive the attacker knowing everything — here the defender IS
the attacker).

## Beacon anchors / peel

GGPO (Tony Cannon — rollback netcode; fighting games) · client-side prediction (John Carmack,
QuakeWorld; Yahn Bernier, *Latency Compensating Methods* — Valve) · dead reckoning (DIS, IEEE 1278) ·
lockstep determinism (Age of Empires — Bettner & Terrano, "1500 archers on a 28.8") · Reticulum (Qvist).
**Peel:** the mapping table is tight (each row pairs a shipped technique with a shipped Zeta primitive);
the *integration* (an actual networked physics demo over Reticulum) is unbuilt — the natural first demo is
two `SimFramework` rooms exchanging recorded crossings (CHIP-8 pong over the mesh, the darkhall's game).
Routes: Core (the demo room), Naledi (rollback perf), Max (the corporate adapter sibling), Aaron.
