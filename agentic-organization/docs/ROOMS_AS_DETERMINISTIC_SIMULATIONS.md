---
title: Rooms as Deterministic Simulations
canonical_name: Agentic Organization
status: design
ideas: []
extends: [ORGANIZATION_RUNTIME_ARCHITECTURE.md]
composes_with:
  - ./OBSERVE_COMPOSER_AND_RUN_STATE.md
  - ./CLUSTER_NATIVE_HAT_SYSTEM.md
  - ./CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md
  - ./GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md
  - ./RUNTIME_TECH_AND_PACKAGE_STRATEGY.md
code_anchors:
  - ../packages/application/src/room.ts
  - ../packages/application/src/rmo.ts
  - ../packages/application/src/sandbox-tool.ts
supersedes: []
---

# Rooms as Deterministic Simulations

A **room** is an **ephemeral deterministic-simulation container** that hosts
hats and **injects either real or mock IO interfaces** at every seam. It is the
missing primitive that ties together six things the factory already has but had
not named together: the `test` seam (any verb on any noun under DST), the Dark
Hall chip-8 emulator (a room that exists in code today), the agentic-org port
inventory (every IO already injectable real-or-mock), RMO supply planning, the
Reticulum-addressable room mesh, and the bwrap-sandbox + credential-proxy
isolation boundary.

> A room is **"simple RISC-like micro-operations before execution"**: you bind
> the seams (real or mock), seat the hats, declare the budget, then step. Same
> inputs → same trace. Running a room **is** a deterministic tick.

> **Everything lives in a room — including the ephemeral `observe.ts` agents.
> One room per agent activation.** The room is the agent's isolation boundary: a
> bwrap sandbox plus a credential proxy bound to the agent's OAuth identity (§9).

This doc is the synthesis; it does not invent the parts. Prior art is cited
inline so each claim stands on a named anchor.

## 1. What a room is

| Property | Meaning |
| --- | --- |
| **Deterministic simulation** | Stepping a room with the same inputs replays the same trace (DST, manifesto §7). Test-loop == production-loop: they differ only in actor/scope, not in kind. |
| **Ephemeral** | A room is created for a task or a meeting, runs, and is collected. Identity (the persona/agent) persists; the room (the *activation*) does not — cf. the persona-vs-cell split in `docs/writer-actor-routing-model.md`. |
| **Injects real or mock IO** | Every IO boundary is a **seam**. Real seams do real I/O (git/bus/Ollama/NATS); the mock seam substitutes a deterministic double at the *same* boundary (Feathers' seam, made universal). |
| **Hosts hats** | A room seats N hats. RMO decides N (§4). The room is the working unit hats collaborate inside. |
| **Per-agent isolation** | One room per agent activation: a **bwrap sandbox** + a **credential proxy** bound to the agent's **OAuth identity**; `observe.ts` is the only path from "who + where" to "may run this tool" (§9). |
| **Content-addressed & mesh-reachable** | `roomId` == canonical-root fingerprint == ZetaId (128-bit) == Reticulum destination hash. A room is a first-class network endpoint (§5). |
| **Speaks a communication strategy** | Participants exchange meaning as structured **artifacts**, plain **English**, or **chip-8 assembly** (§6). |

### Prior art (rooms already exist, unnamed or partial)

- **The Dark Hall** (`src/Core/DarkHall.fs`) is already a room: a liminal,
  glows-on-entry, reached-by-reference (ZetaId/Reticulum), dormant-until-entered
  cell that hosts a **DST-replayable chip-8 emulator** — a pure
  `(program, budget) ⇒` stepper. That is a room-as-deterministic-simulation in
  code today. (`docs/research/2026-06-09-modeling-other-travelers-...-chip8-...`)
- **Rooms-as-travelers**: "anything that self-propagates is a traveler … a test,
  **a room**, a voice." (`docs/research/2026-06-09-what-the-tracks-are-...`)
- **Rooms are Reticulum-addressable**: room id = content-address = ZetaId = RNS
  destination; LLMTV is the holographic between-room interface.
  (`docs/research/2026-06-09-rooms-are-reticulum-addressable-via-the-llmtv-...`)

## 2. The action plane: an action is a deterministic simulation

Today the action plane runs through `tools/observe/observe.ts`: a `NextAction`
discriminated union plus a **pure** `simulate(world, action) → world` and a
`runLoop` that proves the loop replays (same world + same chooser ⇒ same trace).
The refactor this doc anchors:

> **An action is not an `observe.ts` menu pick — an action is a room run, i.e. a
> dotnet test / simulation.** "Dry-run == simulate" is already true; we make it
> the *only* mode. To act is to instantiate a room, bind its seams, step it, and
> commit the artifact.

This is the **`test` seam** made first-class (`docs/research/2026-06-07-test-seam-
deterministic-simulation-of-all-nouns-and-verbs`): `zeta test run cell`,
`zeta test bus message`, `zeta test git clone` all run *any verb on any noun*
under DST at the same boundary the real seams use. Concretely, in the
agentic-org runtime an "action" becomes a unit/simulation test run (the
`node --experimental-strip-types --test` loop here; `dotnet test` on the F#
side) whose saved artifact is **indistinguishable in kind from a production
observation** — tick + actor boundary + Δ + canonical-root + SoftValue
uncertainty (`docs/research/2026-06-09-unit-tests-have-all-dst-tools-...`).

Promotion from shadow (simulate-only) to primary (real effect) already exists as
a deterministic gate: `OBSERVE_ACT_PROMOTION_GATE.md` (≥100 ticks / ≥24h soak,
zero illegal selections, ≤5% divergence). Rooms inherit that gate unchanged —
a room runs all-mock until its evidence promotes it to bind real seams.

## 3. The universal interfaces (seams), and the room that bundles them

The agentic-org codebase already exposes the IO boundaries as injectable ports,
most with both a real adapter and a deterministic double. A room is the **bundle
of these seams under one `seamMode`** so a whole scenario flips real↔mock atomically.

| Seam | Port (file) | Real adapter | Mock / double |
| --- | --- | --- | --- |
| Clock | `Clock` — `packages/application/src/ports.ts:24` | system clock | frozen monotonic clock |
| Ids | `IdGenerator` — `ports.ts:28` | uuid/zetaid | sequential `${prefix}-001` |
| Telemetry | `TelemetryPort` — `packages/observability/src/telemetry-port.ts` | OTLP gRPC | `NoopTelemetry` / `RecordingTelemetry` |
| LLM | `ChatCompletionPort` — `model-backed-composer.ts` | Ollama (`apps/workers/.../ollama-chat-port.ts`, temp=0) | fallback composer |
| Change control | `ChangeControlPort` — `change-control-port.ts` | GitHub/Jira port | `createNullChangeControlPort` / `createFakeExternalPort` |
| Command state | `CommandStateStore` — `ports.ts` | Cockroach | `RecordingCommandStateStoreFactory` |
| Authorization | `CommandAuthorizationPort` / `HatAuthorityPort` — `packages/policy` | OPA/RBAC | allowing/denying fakes |
| Sandbox | `SandboxToolPort` — `sandbox-tool.ts` | **bwrap** (`apps/workers/.../subprocess-sandbox.ts` is the weaker subprocess engine) | `none`-engine |
| Credential proxy | `CredentialProxyPort` — `room.ts` (this slice) | Cockroach/SPIRE-backed scope-gated proxy | `mockCredentialProxy` (fixed grants) |
| Transport | NATS/JetStream + OpenZiti (adapters in `apps/workers`) | live bus | in-memory (to formalize) |

**Filled out** (this slice): `packages/application/src/room.ts` defines the
`Room` type — `roomId`, `seamMode: "real" | "mock"`, `clock`, `ids`,
`seams: RoomSeamBinding[]`, `hatIds`, `communicationStrategy`, `budget`,
`identity?: AgentIdentity`, `sandbox: SandboxSpec`, `credentialProxy:
CredentialProxyPort` — plus `createDeterministicRoom(...)`, the all-mock factory
(frozen clock + sequential ids + `none` sandbox + fixed-grant proxy). A
`createRealRoom(...)` factory binds the live adapters at the same seams; it is
the natural next slice.

> **Why a bundle, not per-call injection.** The factory already injects ports one
> by one (the `ctx` object in every test). The room raises that to a first-class
> noun: one object that says "this scenario is all-mock" or "this scenario binds
> the real LLM but a fake change-control port." The budget (`maxSteps`) is the
> RISC ceiling; the `seams[]` list is the auditable record of what was real.

### Missing seams to extract (named, so they're debts not surprises)

`TransportPort` (NATS is used directly in workers, no application-layer seam),
`EventStorePort` (unified write seam), `ConfigPort`, and `RoomContextPort` (the
room itself as a context the observe pipeline can read).

## 4. RMO plans rooms for *tasks* (not meetings)

RMO (Resource Management Office) already computes hat **supply** from the
prioritized workload: `computeRequiredHatSupply(workload) → Map<hatId, count>`
(`rmo.ts`). The extension:

> **RMO determines, per task, how many rooms and how many hats per room.**
> Rooms created during **meetings** are *automation* — a meeting is not a task,
> so RMO does not plan those. RMO plans rooms for **tasks** only.

This slice adds `planTaskRooms(input, ctx) → TaskRoomPlan` to `rmo.ts`: it takes
the required hat supply + a `maxHatsPerRoom` capacity knob and **deterministically
packs hat seats into ephemeral rooms** (sorted hatId order, capacity-bounded,
room ids from an injected sequence). `roomCount = ceil(totalSeats / cap)`.

Where it slots in the org cycle (`org-runtime.ts` `runOrgCycle`): a new phase
**3.5**, after the RMO supply vote (phase 3) and before hat binding (phase 4) —
supply targets → `planTaskRooms` → bindings carry their `roomId`. (A
`RoomAllocationDecided` `OrgEventKind` and `roomId` on `HatBinding` are the
follow-up wiring; `planTaskRooms` is pure data today, no new event kind.)

```
computeRequiredHatSupply(workload)            // phase 3: {hatId -> count}
  -> decideHatSupply (supervisor vote)
  -> planTaskRooms({requiredHatSupply, maxHatsPerRoom})   // phase 3.5 (NEW)
  -> beginBinding(... roomId)                  // phase 4: seat hats in rooms
```

## 5. Reticulum over rooms — cross-origin communication

A room's `roomId` is its content-address **and** its Reticulum (RNS) destination
hash — one addressing scheme, `fingerprint = roomId = ZetaId = RNS destination`,
so rooms are first-class mesh endpoints with no DNS/IP/registry. Routing a
message to a room **is** Reticulum routing to its destination hash; the address
is self-certifying. (`docs/research/2026-06-09-rooms-are-reticulum-addressable-...`)

- **Cross-origin = cross-room / cross-substrate.** Two rooms on different
  clusters reach each other by destination hash over the announce-based mesh
  (store-and-forward, intermittent-connectivity-tolerant). The bus address
  (`persona ⊕ surface ⊕ instance ⊕ topology`, `docs/writer-actor-routing-model.md`)
  routes the *current activation*; the ZetaId is the *identity*. Routing ≠ identity.
- **NATS vs Reticulum.** NATS/JetStream carries *events* (inbox/outbox, fanout)
  inside a cluster; Reticulum carries *identity-routed messages* across origins.
  Orthogonal — see `RUNTIME_TECH_AND_PACKAGE_STRATEGY.md`.
- **LLMTV** is the holographic *interface between* rooms (navigate/perceive);
  Reticulum is the *transport*. Address by Reticulum, navigate by LLMTV.
- **Real-time mesh.** Humans (ride-along/summon), tests (the rooms themselves),
  and LLMs (always-running agents) co-communicate over Reticulum-addressed rooms
  — prod=test message routing, human-inclusive (privacy-gated per manifesto §6).

## 6. Communication strategies over rooms

A room declares a `communicationStrategy` for how its participants — and rooms
talking to each other — exchange meaning:

- **`artifact`** — structured, content-addressed outputs (the DST test-tick
  artifact is the canonical one; diffable, replayable, mergeable).
- **`english`** — plain natural language (the default for human-in-the-room).
- **`chip8`** — chip-8 assembly: the rehearsal-arena / no-information-hazard
  voice, run by the DST-replayable emulator (`src/Core/DarkHall.fs`; the ARC-AGI
  chip-8 curriculum). **We can write rooms in chip-8 assembly** — a room whose
  program is a chip-8 ROM is a fully deterministic, content-addressed,
  budget-bounded micro-machine. This is the literal floor of "RISC-like
  micro-operations before execution."

The strategy is a property of the room, not the transport: the same
Reticulum-addressed room may speak artifacts to a sibling room and English to a
human riding along on LLMTV.

## 7. Rooms as RISC micro-operations

The universal execution model is already "everything is a fold over a stream of
one-at-a-time `seam verb noun` statements, executed one at a time" — one
statement = DoP=1 = the single cooperative loop that replays identically
(`docs/research/2026-06-07-everything-is-done-one-cli-or-interpreter-loop-step-...`).
A room is the staging area for those micro-ops: you assemble the ops + bind the
seams (real/mock) + set the budget **before execution**, then step. Each step is
idempotent ⇒ pausable, replayable, crash-safe. The chip-8 room is the limit case
where the micro-ops are literal opcodes.

## 8. Every agent lives in a room: bwrap sandbox + credential proxy + OAuth tools

The stronger claim behind §1's "per-agent isolation" row: **everything runs in a
room, including the ephemeral `observe.ts` agents — one room per agent
activation.** The room is the agent's isolation boundary and carries two security
seams that are the same real/mock flip as everything else.

- **Sandbox (bwrap).** Each room runs the agent process inside a bubblewrap
  sandbox: scoped filesystem view, explicit workspace mount, no raw host secrets,
  controlled process exec + network egress, and a **kill/revoke path when the hat
  token expires**. This is the §Bubblewrapped Sandbox Boundary
  (`CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`) made a first-class room property
  — defence-in-depth *inside* the k3s/Cilium/SPIRE/OPA stack, not a replacement.
  The `subprocess` engine already in code (`apps/workers/.../subprocess-sandbox.ts`:
  stripped env, isolated cwd, SIGKILL-on-timeout) is the weaker engine; `bwrap`
  is the production one; `none` is for pure simulation.
- **Credential proxy.** The agent authenticates with **its own OAuth identity**
  (the SPIRE/JWT hat token: agent id, hat-assignment id, **allowed-MCP-tools**,
  **credential-scopes**, expiry — `ORGANIZATION_RUNTIME_ARCHITECTURE.md` §Hat
  Authorization). It holds **no raw secrets**. To use a tool it goes through
  `observe.ts`, which **invokes the credential proxy**: the proxy validates the
  active hat assignment + scope (org/project/team/work-item) and returns only the
  tool grants that identity is allowed (`CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`
  §Credential Proxy).

How `observe.ts` mediates — the agent never names a tool or holds a key:

```
agent (in its room, authenticated as its OAuth identity)
  -> observe.ts renders only the slots the hat authority allows   (render-time veto: hatAuthorityRule, observe.ts)
  -> agent picks a slot
  -> observe.ts reads the slot's requiredSecretScopes
       -> credentialProxy.grantsFor(identity, hatIds)             (the proxy validates assignment + scope)
       -> issues a SCOPED credential (never a raw key)
  -> tool runs inside the bwrap sandbox; stdout captured as evidence (SandboxToolPort)
  -> act-time belt-and-suspenders: HatAuthorityPort.evaluateHatAuthority rejects any illegal pick
```

This closes the loop: the **room** is *where* the agent is (sandbox), the **OAuth
identity** is *who* it is, the **credential proxy** is *what it may touch*, and
**`observe.ts`** is the only surface that turns "who + where" into "may run this
tool." The MCP-behind-the-slot model (`REFACTOR_OBSERVE_AS_UNIVERSAL_AGENT_CLI_AND_DASHBOARD.md`)
is exactly this: the agent's only tool is `observe`; a chosen slot carries
`requiredSecretScopes` and routes to its implementation; a forbidden action is a
dark slot with a reason, not a runtime error.

`room.ts` lands the seam shapes: `AgentIdentity` (agentId + OAuth subject),
`SandboxSpec` (`engine: "bwrap" | "subprocess" | "none"`, workspace mount,
egress allowlist, `revokeOnExpiry`), `ToolGrant`, and `CredentialProxyPort`
(`grantsFor(identity, hatIds) → ToolGrant[]`). `mockCredentialProxy` grants one
scoped tool per seated hat, deterministically, so the **whole authorization path
replays under DST** — a deterministic room binds the mock sandbox + mock proxy;
a real room binds bwrap + the Cockroach/SPIRE-backed proxy.

**Reconciliation with §4.** RMO's "rooms per task / hats per room" is the
*planning* view — how many agent-rooms a task needs and which hats each agent
wears. §8 is the *execution* view of one such room: one agent, its identity, its
sandbox, its proxy. Same room, two lenses.

## 9. Build status

- `packages/application/src/room.ts` — `Room` interface + `createDeterministicRoom`,
  plus the `AgentIdentity` / `SandboxSpec` / `CredentialProxyPort` / `ToolGrant`
  seams and `mockCredentialProxy` (this slice).
- `packages/application/src/rmo.ts` — `planTaskRooms` per-task room planner (this slice).
- `packages/application/test/room-planning-rmo.test.ts` — DST + packing + sandbox/credential-proxy tests.
- Follow-ups: `createRealRoom` (bind live adapters: bwrap, Ollama, NATS,
  Cockroach/SPIRE credential proxy), `TransportPort`/`RoomContextPort` extraction,
  wire `CredentialProxyPort` into the `observe.ts` slot dispatch (resolve
  `requiredSecretScopes` → grants), `RoomAllocationDecided` event + `roomId` on
  `HatBinding`, LLMTV inter-room surface, the room↔RNS-destination binding in the
  F#/observe core.
