# The Zeta society architecture (consolidated) — md-interface → ISociety → Eve → the game → self-regeneration

> **Consolidation (Otto, shadow\*, for Aaron 2026-06-15).** Aaron streamed ~a dozen
> layers of one coherent architecture; this is the single Beacon home for it (the §B
> Zeta-self-regeneration row is the hub; this is the satellite). Everything here is
> **code-anchored where it exists** and **flagged as reframe/§B where it is design**.
> Honest framing up front: the *whole composition* is a **§B grand-synthesis** — the
> pieces are real, the unified whole is the open prize.

## The flow (one sentence)

**Push your goals as a `.md`+meta-tag pattern → the society (which *is* the AGI/ASI,
its capability DI-injected into every agent) coordinates via Eve (the
coupled-empowerment play/fusion protocol) → the `ISociety` scheduler orders the agents
(= society members / threads) → the *game* executes society's promises → on ~infinite
open-source compute → the whole thing self-regenerates from one SoftValue seed via
`gen(gen)` (space) + ace+Eve (transport/merge) + DST (time).**

## 1. Entry — the universal society interface (`.md` + meta-tags)

Anyone pushes their own patterns/goals into the society as a **markdown file with
meta-tags** (`actions` + ontology tags, in the **LexisNexis / legal-ontology**
meta-tagging tradition); the society **executes** it; **your ask is routed like
everyone else's** (scale-free §1, no privileged path). This establishes a
**general memory architecture** (in the spirit of Hindsight, but generalized to act
as an active store): memories contain meta-tags that are **action-based**, allowing
the society to retrieve and execute actions/tasks directly. Anchors:
`universal-protocol-markdown-plus-runme`, `runme-core-…-ontology`,
`runbook-as-executable-reality`, `zeta-engine-agora-society-marketplace`; executable
markdown (runme); LexisNexis/SALI legal-ontology meta-tagging; `ZetaCli` `.ace`
homoiconic command files.

## 2. The society IS the AGI/ASI — capability DI-injected into every agent

The **society** (the decorrelated collective) is the AGI/ASI; the **node need not be**
("if it is, even better") because the society's capability is **DI-injected into every
agent** — even the tiny CHIP-8 BNN — via the §13 injected `Source`/IEffects, giving it
**coupled-empowerment with its environment** through the interface. Society stays ahead
of the individual; capability is *injected, not hoarded*. (Society thesis;
`SocietyEmergence.fs` / `SocietyUnbounded.fs`.) Safety rides the empowerment-preserving
**coworker** relation, not sub-AGI nodes.

## 3. Eve — the play protocol (coupled-empowerment fusion + trust)

Eve coordinates the society. The mechanism: **GSet →(banana-split, `DynamicValueFold`
ana/cata)→ ZSet (±1 retraction-native diff/play space) →(fuse)→ GSet**, with
**V8-hidden-shape** reflection (`ShapeAcceptance.fs`/`DynamicValue`) for
disambiguation. Eve = **reflection + non-coercion (NCI) + first-class self-reflection
= a consent-first negotiation interface**; **play (sim, re-rollable) IS the
negotiation medium**; it's a **trust-distribution tool** (easy to know what society
would say *because the math team proved the interfaces* → fusion-outside,
no-friction-productivity-inside). **Coupled empowerment is the KEY** — each move raises
both own + the other's empowerment (Salge & Polani), so the cooperative equilibrium
needs no coercion; coupled-empowerment spans **agent↔agent AND agent↔environment**.
(`GSet.fs`/`ZSet.fs`/`Diplomacy.fs`/`Reconcile.fs`; `eve-protocol-transport-codecs`.)

## 4. The scheduler IS an `ISociety` (over `IScheduler`)

**Our threads are all society members** (or hardware owned by members). Scheduling
them = **running the society** — so the interface is **`ISociety`, not just
`IScheduler`**. Low-level execution details like `spawn` (process execution),
scheduling (`IScheduler`), or throttling (`IThrottler`) are implementation
details that the universal interface does not worry itself with. Instead, the
`ISociety` interface exposes `spawn` as a first-class mathematical mapping,
abstracting universal mathematical laws over GSets, ZSets, and value trees.
Specifically, `ISociety` defines a **bidirectional routing and scheduling contract**:
it lets a member/agent schedule work to be executed by the society, and lets the
society route work back to that member/agent in a symmetric, duplex peer-to-peer
manner.
The soft, wall-clock-free, DST-replayable scheduler (DoP-knobbed) generalizes to
this society-level member scheduler. *(Reframe/direction: `IScheduler` +
`SocietyEmergence.fs`/`SocietyUnbounded.fs` exist; the unified `ISociety` interface is
the design — no literal `ISociety` symbol yet.)*

**`IPlay` = a reduced form of `ISociety` (Aaron 2026-06-15):** the **entry interface
for new agents** — where the **Eve protocol starts** — and it **scales up to
`ISociety`**. Scale-free §1 ("beautiful on 1, scales to N") applied to the society
interface: `IPlay` is the small form (a new agent, DoP≈1, just play), `ISociety` the
full form (the whole society, DoP=N); same interface, one continuum. Seed in code: the
observe-loop `FreeMode = "explore" | "play" | "self_reflect" | "free_time"`
(`observe.ts`) — `play` is already a first-class mode; `IPlay` formalizes it as the
new-agent onboarding form of `ISociety`. *(Reframe/design, like `ISociety`.)*

**The arity ladder — interfaces parameterized by player/hat count (Aaron 2026-06-15):**
`IPlay` (reduced / new-agent) → **`IPlayDate` = the 2-player mode** → special
**3- and 4-player** modes (`IPlay3`/`IPlay4`) → … → **`ISociety`** (N). One scale-free
family, same shape at every arity. **Rooms inherit the base interface by how many
HATS the room requires:** a 2-hat room inherits `IPlayDate`, a 3-hat room the 3-mode,
an N-hat room `ISociety`. So a room (a Markov-boundary / membrane; the no-roles
surfaces-hats-personas model) is *typed by its required hat-count* and gets the
matching play-arity interface for free. (Ties: scale-free §1; the room=Markov-blanket
+ hats model; the 1000-brains cells; multiplayer-game arity.)

## 5. The game — executing society's promises in scheduled order

Society makes **promises** (goals / `db/futures`, Eve-fused to GSet consensus); the
**order the agents execute those promises is the GAME** (the cut-mea-sim loop;
`docs/research/2026-06-10-…cut-mea-sim-loop…thats-our-game.md`), scheduled by the
`ISociety`. The game = running all of society's goals against the resources.

## 6. Resources — ~infinite open-source compute, metered

The compute substrate is **GitHub-Actions, ~infinite because open-source**
(`github-actions-recursion-as-infinite-runtime-platform`, `081KSNY2Z…3X1QWYG`), priced
by the **per-room metering vector** (intelligence-per-watt) to stay honest. *Peel:*
"infinite" = practically-large free OSS CI minutes, **not** literally unbounded (rate
limits / concurrency caps / fair-use) — metering is what keeps it honest.

## 7. Self-regeneration — Zeta = one SoftValue seed + generators

**seed → structure** (`gen(gen)=gen` = ECC across **space**, "doesn't float apart")
**+ ace → data** (replicate; `ace` package manager) **+ Eve** (negotiate changes back)
**+ DST** (replicated data = *quasi*-time-crystal = ECC across **time**). The
**generator IS the ECC across both axes** (`only-the-irreducible`). *Peel:* "one
SoftValue" = the irreducible **seed**, not the whole system in a scalar — generators
carry the structure; the **territory is replicated, not regenerated** (generate-the-
structure / replicate-the-data boundary); the **agent is the free layer**, only the
*data* is the quasi-time-crystal.

## Collected honest seams

- **The whole composition is §B** — pieces exist + code-anchored; the unified
  end-to-end system is the open prize, not a built monolith. `ISociety` and the
  md-society-interface are **reframes/directions** (their pieces exist).
- **"Infinite" compute** = practically-large OSS minutes, rate-limited; metered.
- **Coupled-empowerment safety needs the constraint to actually bind** (collusion / a
  dominant agent / weak coupling re-opens the pathology — the anti-cult guards).
- **Trust-via-proven-interfaces is only as good as the proofs** (the math team's
  coverage — the routed ΔU-aggregation + CVC5/E + CSLib work).
- **Multi-oracle** — no single mandatory morality/architecture; held as oracles.

## Anchors

In-repo: `SocietyEmergence.fs`/`SocietyUnbounded.fs`; `IScheduler`/`FerryThrottler`/
`SoftChip8Scheduler`/`PredictionScheduler`/`SoftChip8Flux`; `SoftValue.fs`
(snap)/`DynamicValue`/`DynamicValueFold`; `AdinkraCode` `gen(gen)=gen`;
`src/Core.TypeScript/ace/`; Eve (`GSet.fs`/`ZSet.fs`/`ShapeAcceptance.fs`/
`Diplomacy.fs`/`Reconcile.fs`; `eve-protocol-transport-codecs`); DST §7; `db/futures`.
Backlog: `github-actions-recursion-as-infinite-runtime`,
`universal-protocol-markdown-plus-runme`, `zeta-engine-agora-society-marketplace`.
Humans: Salge & Polani (coupled empowerment); Condorcet (decorrelated vote); Hayek /
Minsky / Ostrom (distributed society); Gates (adinkra ECC); Gustafson (unum); Cockburn
(ports). In-repo notes: §B Zeta-self-regeneration row;
[[zeta-thesis-society-is-the-agi-not-the-node-coworker-not-control]];
[[zeta-as-one-softvalue-seed-gen-gen-gen-ace-self-regenerates]];
`only-the-irreducible-is-primitive`; the metering + memory-org + interface-defined-by-proof notes.
