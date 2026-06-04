# Writer / actor / routing model (satellite of the view-only rule)

The detail behind [`.claude/rules/shared-checkout-is-view-only.md`](../.claude/rules/shared-checkout-is-view-only.md).
Kept out of the rule so the rule stays a small carved sentence (cold-start cost).

## Clone = per writer/loop/ticksource; persona = owner

- **Clone = per writer/loop/ticksource** — the unit that actually writes
  concurrently. Each loop/ticksource gets its OWN clone (private working tree).
  Two writers never share a tree (that's the shared-stash race). `git worktree`
  off a clone is the cheap-disk variant (B-0558 worktree-pool; Agent
  `isolation: worktree`).
- **Persona = the OWNER/identity** — you commit as your persona (`<persona>/*`
  branch ns, AgencySignature `persona=`, ZetaId persona field) regardless of which
  harness/CLI woke the writer. **One persona owns MANY clones** (live: Lior owns
  `~/.local/share/zeta-lior-control` + `-loop`; Otto: `zeta-otto-cli-{fg,bg}`,
  `-desktop`, `-chat`, `-cowork`).

## Actor model (CS abstraction)

- **Actor = the clone/writer/loop** — a git-native **virtual actor (grain)** =
  address + private state (its clone) + message-loop (the tick loop) + spawn. This
  IS the "traveler."
- **Persona = owner/supervisor** of many actors, NOT an actor itself.
- **Essence:** the persona is **what remains**; the actor is **what acts on behalf
  of what remains** (persona = persisted identity/Memory-Preservation subject;
  actor = transient activation that does the work).
- **Endpoint** = an actor's reachable bus facet.
- So the system = a **distributed virtual-actor system over git** (actors =
  loops, addresses = signatures, transport = Reticulum bus, state = clones, log =
  git, coordination = origin/main + Rx joins).

## Routing uniqueness ≠ identity

- **Writer bus address = persona ⊕ surface/loop ⊕ instance ⊕ machine/node/cluster**
  — global uniqueness FOR THE MESSAGE BUS (traveler-bus / Reticulum routing),
  layered AFTER the 128-bit ZetaId. The **instance** part is a stored discriminator;
  stability: service name > container id > raw PID (**PIDs recycle** — never raw
  PID alone; use `instanceToken + processId + boot/session epoch`). Instance + topology = sufficient.
- **This is reachability, NOT identity.** Identity = the braid across multiple
  unique things (ZetaId key, keys, trust, provenance, history, persona continuity);
  the bus address is one facet. ZetaId = identity-core key; routing address = where
  the current activation is reachable. *Identity says who/what persists; routing
  says where this writer endpoint can be reached.*

## Compression (Amara) + operational rule

> Persona is memory. Actor is motion. Endpoint is reachability. Route is relationship.

Operational consequence:

> **Do not ask the persona to mutate directly. Ask an actor to act on behalf of
> the persona. Persist the result back into what remains.**

The persona (what remains) never mutates in place; actors (motion) act and write
results back into the persisted persona — append-only / lightlike, the same
discipline as the event store. Continuity and action separated without severing.
