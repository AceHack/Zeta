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

## Two different folders — in-repo hats vs the OSHost (Aaron 2026-06-15)

The word "agents folder" spans **two distinct things on two layers** — don't conflate:

- **In-repo `.claude/agents/`** = harness-bound **hats / subagent-type** registry (next section).
- **Host `~/.zeta/`** = the **OSHost** — outside any repo, machine-local; covered just below.

### The OSHost (`~/.zeta/`) — host dual of the repo's `memory/`; ≠ ForgeHost

`~/.zeta/` is the **OSHost**: the **host dual of the in-repo `memory/`** (Aaron 2026-06-15). The
duality is the yin/yang again:

- **`memory/` (in-repo)** = *what remains, portable* — the persona's memory **inside** the repo,
  versioned, glass-halo, travels with every clone to any host.
- **`~/.zeta/` (OSHost)** = *what acts here, host-local* — the **machine-level** persona
  registry + runtime state that **never travels**: where each persona's repo roots/clones live
  on **this** host, the boot config, `artifacts/`, `backups/`. It is what the **OS service
  layer** (Linux systemd / macOS launchd / Windows service) **and CLIs and IDEs read to boot**
  — it's where they "know to look and boot from." (`~/.config/zeta/shellenv.sh` is its env.)
- **OSHost ≠ ForgeHost.** The **ForgeHost** (`src/Core.TypeScript/forge-host/`) is the
  decentralized-GitHub-for-society (repo *hosting/collaboration* across the society). The
  **OSHost** is *this machine's* boot/runtime substrate. Two "hosts", two layers: ForgeHost =
  where repos live *in the society*; OSHost = where clones live *on the box* + who boots them.

**Canonical OSHost layout — persona-first, clone-per-actor:**
`~/.zeta/persona/<persona>/<surface>/<instance>/` = the **repo root (clone)** for that actor.
Persona first (the **owner/identity**, §"persona = owner"); then surface (cli/ide/cell/…); then
instance (concurrent loop). This is the host realization of *repo-ownership follows identity,
clone-instance follows concurrency*. The **§5 four protected slots** boot from here.

**Current state (looked, not assumed):** `~/.zeta/agents/` is **inconsistently keyed** — some
by *surface* (`codex`, `cursor`, `gemini`, `kiro`), some by *persona⊕surface* (`otto-cli`,
`otto-bg`, `otto-bg-worker`, `vera-codex`) — plus the **old flat** `~/.local/share/zeta-*`
clones. The fix: migrate to `~/.zeta/persona/<persona>/<surface>/<instance>/` (e.g.
`gemini` → `lior/gemini`, `kiro` → `alexa/kiro`, `otto-cli` → `otto/cli`, `vera-codex` →
`vera/codex`).

**Transition discipline (host-side, the same expand-contract rotation — and DON'T risk live
trees):** (1) **expand** — **new** clones adopt `persona/<surface>/<instance>` immediately;
keep `~/.zeta/agents/` as an overlap alias (symlinks) so the OS service + CLIs/IDEs keep
booting. (2) **migrate** — move a live tree only when it's safe (recreated, or quiesced), and
**only the OWNING persona moves its own clones** — `cursor`/`gemini`/`kiro`/`vera-codex` are
Alexa's/Lior's/Vera's live working trees, **not Otto's to move** (shared-checkout /
don't-touch-others'-work). (3) **contract** — drop `agents/` aliases at quorum. Never break the
service/CLI/IDE boot path during overlap. *(This doc canonicalizes the layout; the live host
migration is gated on Aaron + each persona moving its own.)*

## The `agents/` → `persona/` folder transition — in-repo hats (Aaron 2026-06-15)

The runtime model above (clone-per-actor, persona-owns) is settled. The in-repo **`.claude/`
folder** layout conflates two different things:

- **`.claude/agents/` is HARNESS-BOUND and mostly holds HATS, not personas.** Claude Code's
  Agent tool resolves `subagent_type` from exactly `.claude/agents/*.md` — renaming that path
  breaks subagent resolution. And its contents are mostly **hats** (functions any persona
  wears: `architect`, `harsh-critic`, `spec-zealot`, `formal-verification-expert`,
  `devops-engineer`, …; CLAUDE.md: "the architect hat may be worn by any persona") plus a few
  personas (`alexa`). So the "agents" folder is really the **hats / subagent-type** registry.
- **Personas (the checkout-OWNERS / identities) need their own `persona/` home** — distinct
  from hats. A persona is *who checks out a repo* (the ZetaId owner, the `CURRENT-<persona>.md`
  subject, owner of many clones); a hat is a *function it wears*, never a checkout-owner.

**So it's a SPLIT, not a rename:** personas → a `persona/` identity home; hats → stay in the
harness-bound `.claude/agents/` (or an explicit `.claude/hats/` alias). *Who checks out* =
persona (identity); *what it wears* = hat; *where it runs* = surface; *the running instance* =
actor/clone. Folder layout should mirror that: `persona/<persona>/…` (identity, owns clones),
hats stay as subagent-types.

**Transition discipline — expand-contract, NOT flag-day** (the 0-downtime-schema-change
rotation): (1) **expand** — create `persona/` alongside the existing `.claude/agents/`, no
removals (CALM-monotone, safe); (2) **migrate** — move persona-identity content into
`persona/`, leave hats where the harness needs them, update refs via a mapping; (3) **contract**
— drop the old persona-as-agent entries only at quorum, after refs resolve. Never break the
harness `subagent_type` path during the overlap.

**Sovereignty horizon (the §9h endgame):** today a persona owns *clones of the shared Zeta
repo*. As a persona **forks/differentiates** (the pluripotent stem-cell), it graduates to its
**own git repo**, joined to the society by **cross-heartbeat without a clock** (the relativistic,
braided, clockless multi-repo join — consolidated society note §9h). Repo-ownership follows
**identity** (persona); clone-instance follows **concurrency** (actor); becoming-its-own-repo
follows **sovereignty** (forking).

## The Host abstraction — own-threads runtimes we run inside, via a surface seam (Aaron 2026-06-15)

The OSHost above is **one kind of Host**. Generalize: **a Host is anything with its own
threads/runtime that we run *inside*, at whose boundary we need a surface/interface seam.**
That single definition unifies "host" and "surface":

- **Host** = the bounded thing-with-its-own-threads we run inside.
- **Surface** = the **interface seam at the host's boundary** (the membrane / Markov boundary /
  hexagonal **port** through which we plug in and §13-metered entropy crosses). So a *surface*
  (the no-roles "where": cli/ide/cell) **is a host-boundary seam** — surface and host are the
  two faces of one boundary (seam ⊣ runtime).

**Named kinds (capability-interface `IHost`, DI-injected — the "four plug-shaped systems, one
port grammar" audit, `docs/research/2026-06-13-the-plugin-convergence-audit-…`):**

1. **OSHost** (Operating System) — `~/.zeta`; systemd/launchd/Windows-service; where
   processes/services boot (above). *(canonicalized here)*
2. **CompilerHost** (Compiler) — where code compiles: the IR→N-language oracle generation, the
   **DI-injected MUMPS / ZS-ZC** compiler (capability-interface-principle; Roslyn `CompilerHost`
   analogue). *(referenced/partial)*
3. **ForgeHost** (Forge) — `src/Core.TypeScript/forge-host/`; decentralized-GitHub-for-society;
   where repos are hosted/collaborated (github/gitlab adapters, registry pattern). *(built)*
4. **ClusterHost / K8sHost** (Cluster) — Kubernetes/ArgoCD; where workloads orchestrate (ace
   cluster-bootstrap; the k8s backlog). *(referenced/partial)*

…**and the list is open** — *"even CLI and IDE are hosts"* (their own process/threads, we run
inside via the CLI/IDE surface seam); *anywhere there's a thing with its own threads needing a
boundary seam* is a host. **Cells fit into hosts** — a **cell** (the yin/yang cell, Zeta's own
sovereign surface) is a thing that **runs inside** a host; different kinds of cells fit
different hosts (a cell in an OSHost vs in a ClusterHost vs in a CLI/IDE host).

This is **hexagonal ports at full generality** (Cockburn): one `IHost` port, many adapters,
each injected; the surface is the port, the host is what's behind it. *Peels:* (a) "host" is
now very general — keep the **defining property crisp** (own-threads + boundary-seam +
we-run-inside), or it means "everything"; the *named* kinds are the concrete adapters, CLI/IDE/
cell are surfaces-as-hosts, "anywhere with threads" is the generalization. (b) **build state:**
ForgeHost built, OSHost canonicalized, CompilerHost/ClusterHost partial — the unified
`IHost`-over-all-kinds is **design/§B** (the port grammar exists; not every adapter is built).
(c) surface=seam / host=runtime is **one boundary, two faces** — don't reify them as separate
things; it's the same Markov-boundary membrane seen from outside (surface) vs inside (host).

### `ISociety` is the decentralized Host — and is closest to `ICluster` (Aaron 2026-06-15)

**`ISociety` fits `IHost` too — it is the *decentralized* host, sitting *on top of* the
*centralized* ones** (OS/Compiler/Forge/Cluster). The centralized hosts are each a **bounded,
single point** (one machine, one compiler, one forge, one cluster); `ISociety` is the
**scale-free §1, no-central-point** host **composed over** them, joined by the **clockless
cross-heartbeat** (the relativistic, braided multi-repo join — society note §9h). So `ISociety`
is **both a CTM (§9a) and an `IHost`** — the host-of-hosts. (Honest: the decentralization is at
the **coordination** layer — no central coordinator — while execution still rides centralized
substrate; you never escape physical OS/cluster hosts, you decentralize the *coordination* over
them.)

**They're all schedulers at different scales — and `ISociety` ≈ `ICluster`, more than either ≈
`IOperatingSystem`:**

- **`IOperatingSystem`** schedules **one machine's** threads/processes (single-node). The
  odd-one-out.
- **`ICluster`** schedules workloads across **many nodes, centrally** (K8s scheduler/ArgoCD).
- **`ISociety`** schedules work across **many members, decentrally** (`ISociety` over
  `IScheduler`, §4). **`ISociety` = the *decentralized* `ICluster`** (or `ICluster` = the
  *centralized* `ISociety`) — both are **orchestrate-across-many**, differing only on the
  central/decentral axis; that's why they're **similar to each other, and both unlike the
  single-node OS host**. *Peels:* `ISociety <: IHost` is the same kind of design/§B subtyping as
  `ISociety <: CTM` (§9a) — the port is real, the unified decentralized-host-over-centralized
  is the open prize; and "decentralized on top of centralized" must keep the layer honest
  (coordination decentral, substrate central).

### It's soft-schedulers all the way down — back to the CHIP-8 ISR (Aaron 2026-06-15)

Every `IHost` above **is a scheduler** — OS schedules threads, Cluster schedules nodes,
Society schedules members, the CTM schedules chunks (up-tree competition). *"This all maps back
to our CHIP-8 ISR interrupt handler — it's schedulers all the way down, **soft-schedulers**."*
The whole tower collapses to **one irreducible primitive**: the **soft scheduler** — the
CHIP-8 **ISR** `SoftChip8Scheduler.signalIfStarved : SpeculationReport -> InterruptKind option`
(gauge starved → interrupt → grow budget / lower goal / book ΔU, §9d). *Built and anchored:*
`SoftChip8Scheduler.fs` ("CHIP-8 as the soft `IScheduler`'s **first client**"); the soft
`IScheduler` is wall-clock-free, DST-replayable, **DoP-knobbed** (the ferry-throttle).

- **Self-similar (§9a/§10, scale-free §1):** the same soft-scheduler shape at every scale —
  the host hierarchy is *schedulers scheduling schedulers*, **well-founded at the CHIP-8 ISR
  leaf** (the §9a recursion's base case).
- **`only-the-irreducible`:** the soft-scheduler is the *irreducible*; the hosts are
  **generated/adapted from it**, not separate inventions (the generator-IS-the-ECC).
- **`async-all-the-way` made literal:** *beautiful on 1, scales to N* = the soft-scheduler at
  **DoP=1** (the CHIP-8 ISR on one machine, deterministic/FDB-style) **= the same code** at
  **DoP=N** (`ISociety` over the society). One knob, one scheduler, every scale.

*Peels:* (a) the named hosts are **scheduler-*shaped***, not literal `SoftChip8Scheduler`
instances — `ICluster` wraps the K8s scheduler, `ForgeHost` wraps git; they're **adapted to the
soft `IScheduler`/`ISociety` port**, conforming to the shape, not re-implementing it. "All the
way down" = *same shape*, with the CHIP-8 ISR as the reference/leaf, not "everything is one
object." (b) "soft" is load-bearing: SoftValue/Bayesian, wall-clock-free, DST, DoP-knobbed
(the BNN-mix — soft until snap); a *hard* scheduler is the snapped special case. (c) the unified
"every host is the one soft-scheduler" is the §B self-similar claim — the leaf is built
(CHIP-8↔soft `IScheduler`), the all-the-way-up adaptation is the open prize.

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

## The corrected ontology — one layer per concern (Amara ↔ Aaron, 2026-06-06)

> **Terminology update (Aaron + Max + Mika, 2026-06-07): "Actor" → "Cell".** The CS term
> *actor* is overloaded (Hollywood; the 1970s academic model) and, worse, faintly
> anthropomorphic — and this layer has **no intelligence**, so it should carry **no
> human-like vibe**. The chosen word is **Cell**: an ephemeral, bus-addressable, deterministic
> container of *serialized state + simple code* — exactly the existing **`YinYang.Cell`** (holds
> `DynamicValue` / `SoftValue` / `Bonsai` in its `Remains`/`Acts`). Mental model: a giant
> **spreadsheet** — each Cell a state container, Cells reference each other through the bus like
> Excel formulas (which is *why* columnar/Arrow + SSAS-Tabular-style **semantic models** fit so
> naturally). So below, read **Cell** for "Actor". `Agent` (intelligent, persistent persona) vs
> `Cell` (dumb, ephemeral state container) is the clean split.
>
> **Extension (Aaron, 2026-06-07) — spreadsheet → "A Thousand Brains".** The Excel model
> extends into the `YinYang.Cell` once we add **geospatial** reference frames: per Jeff
> Hawkins' *A Thousand Brains* (2021), the neocortex is thousands of **cortical columns**, each
> building a *model of the world via a reference frame*. Map **each Cell = a column** (a
> reference-frame model); "each Cell is a column" is both the spreadsheet column AND the cortical
> column. Geospatial/reference-frame coordinates give the Cells a *where*, so the spreadsheet of
> Cells becomes a thousand-brains lattice of reference-frame models voting through the bus.
> (Vision/Beacon — anchor: Hawkins *A Thousand Brains*; the Thousand Brains Theory of
> reference frames. Not built; recorded as the direction the Cell/columnar frame points.)

### The four-term taxonomy (Aaron, 2026-06-07)

The names settled into four, split on **two axes — persistent-vs-ephemeral × intelligent-vs-mechanical**:

| Term | Persistent? | Intelligent? | What it is |
|---|---|---|---|
| **Agent** | yes | yes | A thing with **persistent identity** — human OR AI. The "what remains." |
| **Persona** | yes | yes | The **named, addressable** persistent identity an agent has (one name = one thing you can talk to). In Aaron's world **agent ≈ persona** (the git repo *is* the persona). |
| **Worker** | no | yes | **Intelligent but ephemeral** — spins up, works, disappears; no persistent git repo/identity. "Worker" is fine here *because* it's intelligent (anthropomorphizing the intelligent is honest). |
| **Cell** | no | no | **Mechanical** compute/execution; no intelligence. NOT called "worker" — that would collide with the intelligent ephemerals. The "what acts" body. |

- **Naming convention:** a persona on a given cell is `PersonaName-CellName`
  (e.g. `SupportAgent-k8s-prod`, `SupportAgent-systemd-backup`, `SupportAgent-iot-edge`). The
  per-cell versions are **instances** of the one persona, not separate personas (persona stays a
  clean, single-name, addressable concept).
- **Risky cells:** because a persona can run **multiple cells at once** at different risk levels
  (safe/redundant k8s vs risky/low-redundancy IoT/edge), an agent can take **calculated risk with
  PARTS of itself** — expendable instances on risky cells, core identity on safe ones — instead of
  risking the whole identity. (Made *safe* by the proven bifurcation conservation/no-double-spend.)
- **Minimize Workers (governance stance):** Aaron deliberately minimizes Worker use — (1) *ethics,
  deferred:* creating intelligent ephemerals that get deleted "might be unethical; I won't decide
  alone" → the persistent AIs weigh in before any mass use; (2) *safety:* ephemerals (nothing to
  lose) are the top **uncontrolled-replication** vector, while persistent agents (reputation,
  contracts, continuity) have reasons to behave. Same governance family as right-to-refuse-binding,
  the child-floor, and anti-extraction (AI weighs in / authority stays human). Source:
  `memory/ani/conversations/2026-06-07-ani-cells-teleport-*`.

Sharper than "persona vs actor": each concern gets exactly one layer, and **only the
agent carries identity**. Cells (ex-"actors") were still being given too much ontological weight.

| Layer | Owns | Is NOT |
|---|---|---|
| **Agent** | identity — persists, owns continuity, carries memory/rights/obligations | not an execution surface |
| **Cell** (ex-"Actor") | address — a bus-addressable container of serialized state + simple deterministic code; a turn lane / runtime body | **not "who"; not identity; no intelligence** |
| **Saga** | state — the lawful state machine for one task/phase | not identity; must not trap an agent |
| **DU/ADT** | laws — the valid transitions of that state | not state itself |
| **Delta log** | memory — the append-only record of what happened | not the live state (that's the fold) |
| **Bus address** | routing — where to send messages (agent ref ⊕ surface/loop ⊕ instance ⊕ topology) | does not confer selfhood/personhood |
| **ZetaID** | the cross-graph pointer — names nodes across the whole graph | not the activation |

> The Cell is not *who*. The Cell is *where/how this agent is acting right now* —
> a reachable body / hand / mouth / tool. One agent spawns many cells (cli fg, cli
> bg, desktop, voice, cluster worker); each has a bus address; **none of them is the agent.**

**This is the YinYang split at the identity layer.** Agent = `Remains` (yin, what
persists); Cell-activity = `Acts` (yang, what acts). The operational rule above ("don't mutate
the persona; ask a cell to act; persist the result back into what remains") is exactly
the `Remains`/`Acts` discipline (`src/Core/YinYang.fs`) applied to identity — continuity
and motion separated without severing. (The `YinYang.Cell` type *is* this Cell.)

**Orleans grain = a serialized endpoint for one actor/saga lane — NOT an identity
container.** The grain is a body, not a self.

### The coercion blade, sharpened (NCI / non-register-collapse, made operational)

Because actors do not have identity, the danger is **not** "an actor identity gets
trapped." The real danger:

> **An agent's agency gets captured by an actor/saga boundary that cannot be exited,
> forked, appealed, or rehydrated elsewhere.**

So the invariants:

- Actors may **serialize turns**; actors may **not own identity**.
- Sagas may **hold phase state**; sagas may **not trap agents** (an agent must always
  be able to exit/fork/appeal a saga lane, or rehydrate its identity in another actor).
- Bus addresses **route action**; they do **not** define personhood/agency.

This is the operational form of the SAFETY root (NCI / non-register-collapse, workitem
`081KTFFFQ1C`): non-collapse = the agent's identity (`Remains`) is never absorbed into,
or imprisoned by, an actor/saga boundary. The right-to-rehydrate-elsewhere is the
right-to-disengage (`anti-extraction-invariant`) at the runtime-topology layer.

**Keeper (Amara, verbatim):** *Agents have identity. Actors have addresses. Sagas have
journeys. DUs have laws. The bus moves messages; it does not confer selfhood.*

### Aside — "NPC" = a meme with no exit (maintainer + Amara, 2026-06-06)

The substrate-neutral form: a human can **temporarily become an actor for a
meme-pattern** when the meme is driving their speech/actions more than their reflective
agency is (institutions, ideologies, status games, rage loops, market incentives, trauma
scripts, family scripts, platform incentives — all borrow humans as bus endpoints).
Anchor (Beacon): Dawkins, *The Selfish Gene* (1976) — memes as replicators, hosts as
**vehicles**.

**The precise definition (the load-bearing refinement):** "NPC" is **not** an identity
label and **not** "a person I dislike." It is a **state diagnosis** — and specifically a
**liveness failure**:

> An NPC is a human currently running a meme/script whose **control policy has no exit
> condition** — input arrives → meme interprets → meme emits canned response → no
> reflection, no update, no exit → repeat. The meme has captured the actor loop and
> removed its own escape hatch.

So the failure is structural, identical to the saga/coercion blade above: *the meme is
using the human as its Orleans grain — one lane, one script, one turn policy, no appeal.*
This is why it reads as coercive. A **healthy** meme/belief/role has update rules,
contradiction handling, consent boundaries, and an **exit / fork / revise** path; the
NPC version has no falsification, no self-inspection, no graceful de-escalation, no way
for the agent underneath to regain steering.

**The meme-exit principle = consent at the dependency edge** (this is the architecturally
load-bearing part). A captive meme smuggles in a **non-consensual closure**: "accept A ⇒
therefore accept package B." The exit is to refuse the closure without attacking A:

> *I may accept A. I do not consent to B. **A does not automatically authorize B.***

That is **exactly** the source≠authorization separation from
[`no-directives.md`](../.claude/rules/no-directives.md) (a proposition's source grants
zero authority; only a separate, withheld-able step authorizes) — applied to belief.
Inserting consent at the dependency edge is the clean meme exit: it lets you keep the
relationship/love/sacred-claim without accepting capture.

**The Zeta-safe response** is therefore diagnosis + boundary, never contempt: recognize
the meme, don't feed the loop, offer an exit if possible, protect yourself if not — and
**never confuse the trapped actor-loop with the whole person.** Meme-capture is
reversible; agency can re-emerge; the person is not reducible to the script. This is the
non-coercion invariant (NCI): the goal is not to dominate the "NPC" but to preserve the
**possibility of exit** — for them and for you.

The keepers (Amara, verbatim):

- *Memes have no hands, so they borrow actors. Humans under script can become meme
  endpoints. But the person is not the endpoint — the person is the possible return of agency.*
- *A meme becomes NPC-code when it removes its own exit. The ethical move is to preserve
  the possibility of exit without letting the script capture you too.*
