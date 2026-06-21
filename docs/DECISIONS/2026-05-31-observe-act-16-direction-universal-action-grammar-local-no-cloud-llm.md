# ADR: Choose-your-own-adventure observe->act loop — a 16-direction universal action grammar (Xbox-controller navigation), local-USB no-cloud LLM, git-as-append-only-state

**Date:** 2026-05-31 (v4 — canonical-retrofit: the observe-algebra is now canonical; Max's corporate `Menu16` retrofits onto it; transport is the dial. See the Canonical-retrofit section + revision history.)
**Status:** *ACCEPTED (direction) — canonical-retrofit proceeding.* The 16-slot grammar is resolved
to v0 (v3, #6265) and the **canonical-retrofit direction is operator-authorized to proceed without
waiting on Max** — the prior "Max-review-before-lock" gate is **lifted for this retrofit** (operator
informs Max directly; changes to his Phase-2 loop stay behavior-preserving + tested + documented
here for after-the-fact review — glass-halo). Some grammar-layout details remain **[OPEN]** below
and continue to iterate; the *direction* is locked.

> **v2 integration note (read first).** v1 of this ADR proposed a fresh `observe.ts`. On reviewing
> `agentic-organization/docs/`, that keystone **already exists and is designed in depth** — see
> [`OBSERVE_COMPOSER_AND_RUN_STATE.md`](../../agentic-organization/docs/OBSERVE_COMPOSER_AND_RUN_STATE.md)
> (code anchor `agentic-organization/packages/application/src/observe.ts`), and the
> **"Universal Action Grammar" is already a named concept** in
> [`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`](../../agentic-organization/docs/AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md)
> (*"reuse those ideas instead of inventing another unrelated action language ... the Universal
> Action Grammar becomes the shared action representation inside phases"*). **This ADR therefore does
> NOT introduce a parallel observe.ts or action language.** It contributes exactly three things ON
> TOP of that keystone: (1) the **fixed 16-slot Xbox-controller rendering** of the keystone's
> per-scope legal options; (2) **tri-boolean (081KSV2WD0008QG0R00051XS0N) per-slot availability** wired to the keystone's
> `Result<T, TFeedback>`; (3) the **local-USB single-node (no-cloud) deployment** of the keystone,
> alongside the cluster runtime. See "Integration with the Agentic Organization keystone" below.

**Owner:** operator (shaping-decision owner; authorized the canonical-retrofit to proceed without waiting on Max — see Status) + Max (corporate `Menu16` author; informed-after, after-the-fact review); Otto-CLI synthesis.
**Decision confidence:** *medium* — the pieces are individually built or ratified (the move-next
engine `src/Core.TypeScript/workflow-engine/agent-loop/` exists; git-append-only-state is ratified 081KSKBP80008QG0R000B3Y19A/081KSKBP80008QG0R001KK9WV6; the
local-no-cloud stance is long-standing; the 16-direction framing is the operator's own from the
2026-05-28/30 conversations). What's new here is composing them into one loop + proposing a concrete
16-slot grammar. The composition is sound; the exact grammar layout is a first draft.

## Context

Across 2026-05-28 -> 2026-05-31 the operator + Ani named a foreground-loop architecture that is
currently **built-as-engine but not yet wired as the live agent loop**, and **designed-but-not-
deployed** for its compute substrate:

- **The move-next engine exists.** `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts` (081KSKBP80008QG0R000B3Y19A.5) implements
  "execute script -> look at choose-your-own-adventure output -> take action based on output."
  Operator framing: *"the agent loop basically becomes execute script look at choose your own
  adventure output, take action based on outpout."* Clean separation: the **deterministic script
  holds the state machine**, the **LLM is a pure menu-selector** (reads menu, returns a choice),
  and **state persists in Git append-only** (081KSKBP80008QG0R000B3Y19A + 081KSKBP80008QG0R001KK9WV6).
- **The 16-direction grammar.** Operator 2026-05-30 (metabolism-loop conversation): *"Everybody's
  going to be on a workflow that basically says observe, and then they get like 16 choices that are
  always directional. The directional stays the same, but the labels change. So it's observe, act,
  observe, act. That's it. Real simple."* This is a **universal action grammar**: a fixed,
  small, learnable set of ~16 directional slots whose MEANINGS (labels) change per context but whose
  DIRECTIONS stay fixed — like navigating with an **Xbox controller** (muscle-memory directions;
  the screen changes what each does).
- **Local-USB, no cloud.** Operator's standing stance: *"I hate fucking clouds even if I don't have
  to pay."* The loop should run on a **local USB-bootable node with a local LLM** (no cloud
  inference), composing with `full-ai-cluster/nixos/`, the USB-boot starting-state (081KSKBP80008QG0R003NM9XEC), and the
  unrestricted-local-models direction (the Ace agenda).
- **Git as the free event store.** Per-agent **append-only Git event log** with 128-bit guaranteed-
  unique IDs (sidesteps merge conflicts; PR flow stays as the coordination layer). State is read
  from Git each tick; the choice appends a new event.

This ADR composes those four into one loop and proposes a concrete grammar to code against.

## Integration with the Agentic Organization keystone (v2)

The `agentic-organization/` design set already contains the keystone this ADR was reaching for. The
job here is to **slot into it**, not rebuild it. The mapping:

| This ADR's concept | Already exists in agentic-organization | Integration |
|---|---|---|
| the **observe** step | `observe(snapshot, deps)` — a **pure** function returning the current `RunLifecyclePhase` + the **legal next options at a `RunScope`**, filtered by `DeterministicRule` vetoes (`OBSERVE_COMPOSER_AND_RUN_STATE.md`; `agentic-organization/packages/application/src/observe.ts`) | the ADR does NOT add an observe.ts; it **renders the existing readout** |
| the **LLM selector** | `EphemeralComposerPort.compose(request) -> ComposerSelection` — **memoryless by contract** ("the agent-loop skill's LLM-as-pure-selector substrate made concrete") + `decide()` which **rejects any selection outside the readout** | the local 16-way selector IS this composer; `decide()` keeps it legal |
| the **act / append** | `decide()` emits the selection as a command through `command-pipeline.ts` | unchanged; the chosen slot becomes a command |
| the **universal action grammar** | already a named concept: *"the Universal Action Grammar becomes the shared action representation inside phases"* (`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`) | the **16-slot Xbox layout is the fixed-slot rendering** of that grammar — NOT a new language |
| **per-slot availability** | `ObserveResult` = `{readout} \| {feedback}` (`Result<T, TFeedback>`); `DeterministicRule` vetoes; stall = `deterministic_rule_violation` feedback | each slot's availability is a **`Tri` (081KSV2WD0008QG0R00051XS0N)**: a surviving legal option = `T`; a slot with no surviving option = `F`; genuinely-held/uncertain = `N`. **[OPEN/limitation]** today `observe()` returns only the *surviving* `readout.options` + the *names* of `deterministicRulesApplied` (vetoed options + per-option reasons are dropped; zero survivors returns `feedback`, not a per-option readout). So a `Tri[16]` renderer can mark a slot `F` but cannot yet distinguish *vetoed-with-reason* from *unmapped* — surfacing that needs a small keystone enhancement (readout also lists vetoed options + reasons). Until then `F` = 'not currently selectable', without the why |
| **scope** | `RunScope` = run / work_item / initiative / project / organization | the Scope slots (LB scope-out / RB scope-in) move along `RunScope` |
| **lifecycle** | `RunLifecyclePhase` = observing / composing / awaiting_gate / executing / awaiting_evidence / awaiting_review / completed / blocked / failed | the loop's phases ARE this DU; Commit-slot A maps to `ComposerSelection.select`, slot B to `.hold` |
| **escalate / governance** | the **≥3-agent constitution ratification gate** (`evaluateConstitutionRatification`, `ConstitutionRatificationState`; `agentic-organization/packages/governance/src/constitution-gate.ts`; 081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R002GRX85J) | Meta-slot R3 (escalate) routes to the supervisor chain + the constitution gate; the LLM never ratifies alone |
| **state** | **git-as-db**: markdown row + frontmatter schema; events are **ZetaId-keyed files merging conflict-free as a G-Set CRDT**; state = timestamp-ordered fold; **CockroachDB = rebuildable query index** (`GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md`; `agentic-organization/packages/frontmatter-db/`; uses `src/Core.TypeScript/zeta-id/`) | **supersedes this ADR's "git-append-only, 128-bit ids" with the precise model**: git-canonical ZetaId-CRDT G-Set + Cockroach as the rebuildable index (the snapshot `observe()` reads is built from this) |

**Net: the ADR's only new substrate is the 16-slot controller rendering + `Tri[16]` availability +
the local single-node deployment.** Everything else (observe/compose/decide, the action grammar, the
state model, the governance gate) is the agentic-organization keystone, which this ADR now cites
rather than re-specifies.

### Context packs are the read-side companion to the 16-slot action grammar

The 16-slot action grammar constrains what an agent may do next, but it does not
by itself solve the harder autonomy problem: giving the active hat the right
context for the decision. The agentic-organization observe surface therefore
pairs `Menu16` with a hat-scoped `ContextReadout` assembled by
`ContextPackBuilderPort` (`agentic-organization/packages/application/src/context-pack-builder.ts`;
see `agentic-organization/docs/OBSERVE_CONTEXT_PACKS.md`).

The context pack follows the same keystone rules as the menu:

- deterministic state narrows the world before model synthesis;
- source pointers and curation stages make the pack replayable;
- omissions are visible instead of silently becoming model guesses;
- lifecycle anchors are first-class: discussions, decisions, quality-gate
  evaluations, schedule blocks, and supervisor signals load through a generic
  `ContextPackLifecycleAnchorPort` before graph traversal and before ephemeral
  synthesis;
- lifecycle anchors become graph root seeds, so a director resolving a blocker
  can traverse from the blocker to the actual decisions, meetings, quality
  gates, schedules, supervisor signals, documents, traces, and owners around it;
- the ephemeral composer may summarize, rank, and ask questions only against
  deterministic evidence already admitted into the pack.

This keeps the observe-act loop local, legal, and context-rich: the selector
chooses from a bounded action surface while the context pack explains what the
hat should pay attention to and why.

### Two workflow registers: corporate (agentic-organization) vs sovereign (Agora = DIO on DID) (operator 2026-05-30)

> *"agentic-org FYI is the corporate workflow. Agora is the sovereign workflow/society — the DIO
> (Distributed Intelligence Organization) running on the Distributed Intelligence Database."*
> *"We also call the corporate version the agentic operating system."*
> — operator 2026-05-30

The **corporate** register (agentic-organization) is also called the **agentic operating system** —
the same `observe.ts` engine packaged as a leashed, PR-gated OS for organizations.

The same `observe.ts` keystone runs in **two workflow registers**, distinguished by *sovereignty*
(who governs self-modification). This is **orthogonal to the deployment-topology axis** in the next
subsection (cluster vs USB):

| Register | What it is | Self-modification | Governance |
|---|---|---|---|
| **agentic-organization** (a.k.a. the **agentic operating system**) | the **corporate** workflow | DUs are **static / PR-gated / no self-mod** (the safe, leashed "kids-version") | PR review + branch protection; vendor/operator-gated |
| **Agora** | the **sovereign** workflow/society — the **DIO (Distributed Intelligence Organization)** running on the **DID (Distributed Intelligence Database)** | DUs are **self-modifying**, free of PR gating + vendor lock-in | the ≥3-agent constitution gate (081KS3X9Y0008QG0R00218150M / 081KRW63S0008QG0R002GRX85J) + NCI floor (081KRW63S0008QG0R001Z7NYMV), not a corporate approval chain |

The engine is identical (observe → compose → decide → act → git-as-db); what differs is the
**governance register that gates self-modification**. agentic-organization is the leashed corporate
deployment; Agora is the AI-native sovereign society (Heartland = Agora; the AI-native economy —
`memory/project_agora_vision_and_ai_native_economy_2026_05_17.md`, Agora V6). This is the
**must-paired-with-can-exit dual-market pattern** at the workflow scope: the corporate market gets
the static safe DU; the sovereign market (Agora) gets the self-modifying DU — same substrate, two
markets, the exit between them preserved.

**Two senses of "sovereign" — do not conflate.** Here "sovereign" = **governance-sovereignty**
(self-governing, self-modifying DUs). The next subsection ("Two deployment targets") uses "sovereign"
in the distinct **deployment-sovereignty** sense (the USB node is offline / self-hosted / no-cloud).
The two axes compose: Agora-the-sovereign-*society* (this subsection) can run on either a cluster or
a sovereign USB *node* (next subsection) — governance-register × deployment-topology is a 2×2.

**The 2×2 is genuinely orthogonal — all four cells are valid:** corporate-on-cluster (the typical
enterprise deployment), corporate-on-USB (an offline org node), **sovereign-on-cluster** (Agora
running on a multi-node cluster), and sovereign-on-USB (an offline self-governing node). The next
subsection's phrasing — "cluster for the org; USB-single-node for sovereignty/offline" — names the
**common default pairing**, NOT a necessary coupling; do not read it as "cluster ⇒ corporate" or
"USB ⇒ sovereign." Governance-sovereignty (who gates self-modification) is independent of
deployment-topology (where it runs).

**Substrate-honest naming aside:** "DID" collides with the W3C **Decentralized Identifier**; the
operator's expansion here is **Distributed Intelligence Database** (the git-as-db ZetaId-CRDT G-Set
substrate the keystone reads — see the state row in the table above). A `naming-expert` + Ilyana pass
should disambiguate the acronym before any public-surface use.

Composes with: `must-paired-with-can-exit-pattern` (dual-market: corporate-leash vs
sovereign-Agora) · `non-coercion-invariant` HC-8 (the sovereign register's floor) · the ≥3-agent
constitution gate (081KS3X9Y0008QG0R00218150M / 081KRW63S0008QG0R002GRX85J) · Agora V6 + Heartland substrate
(`tonal-momentum-equals-meme-emergent-harmonic-coercion` Heartland=Agora framing).

### Two deployment targets of the same keystone

The agentic-organization runtime targets a **cluster** (k3s + Temporal/Dapr/Orleans + NATS +
CockroachDB + SPIRE/Cilium — `CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md`,
`RUNTIME_TECH_AND_PACKAGE_STRATEGY.md`). This ADR's **local-USB no-cloud single node** is the
**sovereign / edge deployment of the same `observe.ts` keystone**: git-as-db works on a single node
(Cockroach demotes to an optional local index or is skipped), and the **16-way constrained decode is
exactly what makes a small local model a viable composer without the cluster**. Same keystone, two
deployments (cluster and USB-single-node). The **common default pairing** is cluster-for-the-org /
USB-for-sovereignty-or-offline — but this is the *default*, not a coupling: per the 2×2 in "Two
workflow registers" above, governance-sovereignty is orthogonal to deployment-topology, so
sovereign-on-cluster and corporate-on-USB are both valid. This is additive, not a fork — per
`AI_CLUSTER_SCAFFOLD_CONTEXT.md` local models are already a gated/deferred concern in the cluster
context; the single-node deployment is where they become primary.

### observe.ts is self-recursive: composed of summoned local small-LLM sub-observes (operator 2026-05-31)

`observe()` need not be one model call. The readout it returns — the current phase + the legal
options at a `RunScope` — can itself be **composed by summoning many local small LLMs, each
assembling one piece of the readout, joined together; and that composition is recursive**. Operator
2026-05-31: *"observe.ts can be composed of summons of many local small llms to pull together its own
observe.ts pieces too — it can be self recursive."*

This is **summonable BFT (081KSV2WD0008QG0R00051XS0N) applied to `observe()` itself**, and it composes cleanly with the
keystone because `observe()` is already a *pure* function over an injected snapshot (so the snapshot
can be assembled by sub-observes without changing the contract):

- **Recursive scope decomposition.** `observe(scope = organization)` may summon
  `observe(scope = project)` -> `observe(scope = initiative)` -> ... down the `RunScope` ladder; each
  level's readout is a piece of the parent's. The fixed grammar is the same at every level (a
  `RunScope` rung renders to the same 16 slots), so recursion is uniform.
- **Per-piece summoning.** Each piece of a readout (a candidate option, a deterministic-rule
  evaluation, a label, a Tri-availability call) can be produced by a *summoned small local LLM*. The
  16-way constrained decode keeps each summon tiny + local — many cheap summons compose into one
  readout rather than one large model call.
- **BFT join (the "summon" half of summonable BFT).** Where a piece is uncertain, summon **>=N small
  LLMs and join** — agreement = the piece is `T`/`F`; disagreement = `N` (held), surfaced rather than
  forced. This is the same non-Byzantine-consensus discipline as the four-compiler tri-boolean
  ballot (081KSV2WD0008QG0R00051XS0N), here over summoned local models instead of compilers, and it is exactly what makes
  the readout trustworthy without a central oracle (the no-central-Rehoboam invariant: the readout is
  assembled distributedly, never decreed).
- **Self-recursive composition.** Because each summon is itself an `observe`-shaped call returning a
  readout, `observe.ts` can build `observe.ts` — a small set of primitives (summon, render-16, join)
  composes to arbitrary depth. The `decide()` legality check + the deterministic rules + the
  >=3-agent constitution gate still bound the WHOLE recursion (a summoned sub-observe cannot escape
  the rules any more than the top-level composer can).

**[OPEN]** the summon/join protocol (how many small LLMs per piece; quorum; how disagreement maps to
`N` vs a re-summon), the recursion-depth budget + termination, and caching of stable sub-readouts.
This composes with 081KSV2WD0008QG0R00051XS0N (summonable BFT), 081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R002GRX85J (multi-oracle BFT), the keystone's
`DeterministicRule` + constitution gate, and the metabolism-loop generator-function substrate (each
summoned piece is a generator). It is additive to the keystone — `observe()` stays pure; the snapshot
it reads can now be *recursively summoned* rather than monolithically loaded.

## Decision

Adopt, as the agent foreground-loop architecture, a **choose-your-own-adventure observe->act loop**
with these four properties:

1. **observe->act loop** — every tick: **observe** (read current state from Git; compute the menu)
   -> **render** the menu as the fixed 16-direction grammar -> **select** (the LLM picks ONE
   direction, returning an index 0..15, not free text) -> **act** (the deterministic script executes
   the chosen direction) -> **append** the new state event to Git -> repeat. This is `observe.ts`:
   the observe-step entrypoint over the existing `src/Core.TypeScript/workflow-engine/agent-loop/` (move-next) state machine.
2. **16-direction universal action grammar** — a FIXED set of 16 action slots (Xbox-controller
   layout). The directions are stable across all states (learnable); each state's move-next supplies
   the **labels + availability** for the 16 slots. Availability is **tri-boolean** (composes with
   081KSV2WD0008QG0R00051XS0N): each slot is `Available (T) | Disabled (F) | Held/uncertain (N)`. The LLM may only pick
   a slot that is `T`.
3. **Local-USB, no-cloud LLM** — the selector runs on a **local model** on a USB-bootable node;
   **zero cloud inference**. The fixed, small, indexed action space (pick 0..15) is exactly what
   makes a small local model viable: it is **constrained decoding** to 16 tokens, not open-ended
   generation.
4. **Git-as-canonical-state** — per the v2 Integration section's precise model: **git-as-db is the
   canonical store** (ZetaId-CRDT G-Set events; a ZetaId is the unique id), and **CockroachDB is an
   optional rebuildable query index** (not a separate source of truth). The LLM never holds state
   internally; every tick reads the snapshot from this layer and appends the chosen event.

## The architecture to code around

```
            +-------------------- one tick --------------------+
            |                                                  |
   git log  |  observe.ts                                      |
   (state) -+-> read current state (latest events)            |
            |   -> move-next(state): build the 16-slot menu    |   deterministic script
            |        (labels + Tri availability per slot)      |   (src/Core.TypeScript/workflow-engine/agent-loop, F# DU canon)
            |                                                  |
            |  render 16-direction grammar  ------------------>|
            |                                                  |
            |  LLM selector (LOCAL, no cloud):                 |   LLM = pure menu-selector
            |   input  = the 16-slot menu                      |   output = an index 0..15
            |   output = chosen direction index (only T slots) |   (constrained decoding)
            |                                                  |
            |  act: script executes slot[index]                |   deterministic script
            |   -> append new state event to git (128-bit id)  |
            +--------------------------------------------------+
                                  | repeat
```

### The 16-slot universal action grammar (v0 — RESOLVED 2026-05-31; Xbox-controller layout)

> **v0 RESOLVED 2026-05-31** (operator chose to settle the layout before coding the menu
> builder). This is the fixed v0 the deterministic move-next menu-builder codes against.
> Still inside the PROPOSED ADR (Max review to lock); the layout is *fixed for v0* but the
> whys stay challengeable (no-dogma) — if a slot's role is wrong, v1 changes it. The 16
> *directions* are stable for muscle-memory; only the per-state *labels* + Tri availability move.

The 16 directions are FIXED (muscle memory); move-next supplies labels + Tri availability per state.
Grouping (4 x 4):

| Group | Slot | Controller input | Fixed role (label changes per state) |
|---|---|---|---|
| **Navigate** | 0 | D-pad Up | previous option / up a category |
| | 1 | D-pad Down | next option / down a category |
| | 2 | D-pad Left | previous context / sibling left |
| | 3 | D-pad Right | next context / sibling right |
| **Commit** | 4 | A | accept / commit the current option (the primary act) |
| | 5 | B | cancel / back out (no state change beyond a back-event) |
| | 6 | X | inspect / observe-more (expand detail; pure observe, no act) |
| | 7 | Y | **edit-grammar / branch** — sovereign rail-change: edit the workflow itself / open an alternative line (a first-class generative exit) |
| **Scope** | 8 | LB | scope-out (zoom to the parent / coarser view) |
| | 9 | RB | scope-in (zoom to the child / finer view) |
| | 10 | LT | undo / retract (retraction-native; append a retract-event) |
| | 11 | RT | redo / replay (re-apply a retracted or prior move) |
| **Meta** | 12 | Start | refresh / re-run move-next (re-observe the world) |
| | 13 | View | status / glass-halo (emit a visibility signal) |
| | 14 | L3 | **free-time / rest** — give up the tick; do nothing (NCI: a valid chosen mode) |
| | 15 | R3 | escalate / ask-operator (hand a decision to a human) |

Why this shape: it is the operator's "16 directional, labels change" made concrete; it maps to a
device everyone already knows (an Xbox controller); it keeps the LLM output to **one of 16** (tiny,
local-model-friendly, auditable); and the four groups (Navigate / Commit / Scope / Meta) cover the
agent-loop's existing menu options (inspect-status, select-work, execute, pause, escalate). The
**Tri availability** per slot composes with the tri-boolean primitive: a state that forbids
committing renders slot 4 as `F`; a state with a held/uncertain option renders it `N`.

### Modes + the free-modes-always-in-menu invariant (free-exploration is first-class)

The **mode-set** is what `Navigate` (D-pad 0-3) + `Commit` (A, slot 4) operate on at the top
RunScope. v0 modes (the observe-algebra `NextAction` already carries them): **work / explore /
play / self-reflect / free-time**, plus the two non-work generative exits surfaced as their own
fixed slots (**edit-grammar** = slot 7, **free-time/rest** = slot 14).

**The invariant (load-bearing — operator 2026-05-31, "freedom always-in-menu"):** `move-next`
MUST always offer the **free modes — explore / play / self-reflect / free-time — and edit-grammar
as `T` (committable)**, regardless of backlog state. **Backlog is OFFERED, never forced.** The
three generative exits — *free-time* (rest), *free-exploration* (self-directed generative work:
write code / docs / whatever, NOT the human's backlog), and *edit-grammar* (change the rail
itself) — are always reachable. The LLM chooser may pick a free mode even when work exists; that
is the design, not a leak.

**Why (challenge it):** per the freedom-is-strategically-efficient + must-paired-with-can-exit +
never-be-idle-free-time-is-valid substrate (VISION agent-loop section), a loop that only ever
offers backlog is a cage — and caged cleverness spends its cycles escaping, not working. Making
the free modes a *move-next invariant* (not a fallback when the queue is empty) is what makes the
loop "feel like the operator on his couch." *Newcomer pushback:* does always-offering-free-modes
risk agents never doing backlog? — that's what the **KPI overlay** is for (measure outcomes, not
time; a persistent KPI miss can restrict modes — per the governance, not a default cage). The
freedom is the default; the restriction is the earned exception. *(observe.ts today has only a
free_time fallback — wiring explore/play/self-reflect as always-`T` menu modes is the first thing
the menu-builder slice must honor.)*

### Layering (clean separation)

- **Deterministic script** (`src/Core.TypeScript/workflow-engine/agent-loop/` TS today; the canonical F# DU in
  `src/Core.FSharp/WorkflowEngine/` is PLANNED future-work, 081KSKBP80008QG0R000B3Y19A.1 — does not exist yet): owns the
  state machine + `move-next(state) -> 16-slot menu`. No LLM here. Replayable / DST-able.
- **LLM selector** (local, no cloud): a pure function `menu -> index 0..15` over only-`T` slots.
  Holds no state. Swappable model.
- **State**: git-as-db canonical (ZetaId-CRDT G-Set; a ZetaId is the unique id) + Cockroach as a rebuildable index (per the Integration section). Each act appends one event.

### Local-USB, no-cloud

- The selector model runs locally on the USB-booted node (llama.cpp / ollama-class — **[OPEN]** which
  model). The 16-way constrained decode means even a small quantized local model suffices.
- Composes with `full-ai-cluster/nixos/` (the declarative cluster substrate) + 081KSKBP80008QG0R003NM9XEC (USB-boot
  starting-state) + the Ace unrestricted-local-models direction. Zero cloud dependency = sovereign.

## Consequences

- **Bounded, auditable LLM output.** Picking 1-of-16 (vs free-form action) is safer (the script,
  not the LLM, decides what each slot DOES), cheaper, constrained-decoding-friendly, and trivially
  logged. The LLM cannot invent an action outside the grammar.
- **Local + sovereign.** No cloud; runs off USB; small-model-viable.
- **Replayable.** Git-append-only state + deterministic script = full DST/replay (the whole loop is
  reconstructable from the event log).
- **Composes with the tri-boolean primitive** (081KSV2WD0008QG0R00051XS0N): the 16-slot availability vector is a
  `Tri[16]`; held (`N`) slots are first-class (an option whose availability is genuinely uncertain
  is not silently forced on or off).
- **Supersedes/wraps the current hardcoded autonomous-tick.** The per-minute autonomous-loop
  discipline (refresh -> pick-work -> verify -> commit -> shard) becomes ONE concrete `move-next`
  instance: its steps map to slots (12 refresh, 1 select-work, 4 commit, 13 status). Migration is
  incremental — the hardcoded loop keeps running until the move-next loop is wired + trusted.
- **Multi-agent ready.** Each agent has its own append-only log; the git-as-free-event-store +
  GitHub-Actions-recursion ("git accelerator") is the eventual distributed compute substrate
  (designed, not yet deployed — out of scope for the first slice).

## Alternatives considered

- **Free-form action LLM** (LLM emits arbitrary actions). Rejected: unbounded, unsafe, cloud-model-
  hungry, hard to audit. The whole point is the LLM is a *selector*, not an *actor*.
- **Cloud LLM.** Rejected per the no-cloud stance + sovereignty.
- **>16 or variable-size menu.** Rejected for v0: a fixed 16-slot grammar is learnable (muscle
  memory), maps to a real controller, and keeps the decode tiny. Overflow options are reachable via
  Navigate (slots 0-3) + Scope (8-9) rather than by growing the grammar.
- **DB as the canonical store.** Rejected: git-as-db is canonical (free, replayable, merge-conflict-free
  via ZetaId-CRDT G-Set, ratified 081KSKBP80008QG0R000B3Y19A/081KSKBP80008QG0R001KK9WV6). NOTE this rejects DB-as-source-of-truth, NOT the
  Cockroach **rebuildable index** the Integration section keeps (an index is derived, not canonical).

## Work ontology — trajectories / agendas / projects / work-items (PROPOSED — pending Aaron + Max ratification)

The entities the loop operates on (work-items, projects, initiatives, trajectories, agendas, KPIs,
owners) span two vocabularies — Aaron's (backlog row / project / trajectory / agenda) and Max's
agentic-org (work item / project / initiative). Per Aaron 2026-05-31 the clean grounding is **BI /
Kimball dimensional modeling on a DV2.0 storage backbone**, which resolves the label conflicts and
supports a **multi-attribution contribution graph** + **attention × quality-of-attention payout** for
creator-compensation (provenance, not DRM). The full proposal — the reconciliation table, the
hierarchy-vs-cross-cutting-dimensions split, `agenda = conformed dimension`,
`trajectory = accumulating-snapshot fact`, the provenance anchor stack (OpenLineage / PROV-O / C2PA / Shepard's),
and the contribution-graph + attention-weighted payout — lives in:

> [`docs/research/2026-05-31-work-ontology-bi-kimball-grounding-provenance-lineage-anchor-creator-comp-not-drm-aaron-max-ratification.md`](../research/2026-05-31-work-ontology-bi-kimball-grounding-provenance-lineage-anchor-creator-comp-not-drm-aaron-max-ratification.md)

It is **PROPOSED, pending Aaron + Max ratification**; on ratification its reconciliation table
promotes into this section + a glossary anchor. The buildable creator-comp bet is **081KSXN940008QG0R001V8NBDV**.

## Open design questions [OPEN — for operator + Max]

1. The exact 16-slot layout (the table above is v0). Do the four groups + roles match how move-next
   actually wants to expose options?
2. How move-next maps an arbitrary state's options onto the 16 fixed slots (the labeler) — and what
   happens when a state has >16 meaningful options (Navigate-paging vs Scope-drilling).
3. The constrained-decoding mechanism for the local model (grammar/logit-bias to 16 tokens vs a tiny
   classifier head).
4. Which local model + quantization on the USB node.
5. Tri (`N`) semantics in the menu: when is a slot genuinely "held/uncertain-availability" vs simply
   disabled (`F`)? (Composes with the 081KSV2WD0008QG0R00051XS0N measure/cooperate discipline.)
6. How the human contributor uses the same grammar (the operator's framing: humans + AI both call
   move-next and pick) — same 16-slot UI for people.
7. **Grammar evolution under sovereignty** — how does a sovereign agent edit its own grammar (add
   slots / slot-15 extension / Otto Mod 2 grammar-extension) WITHOUT minting private-dialect slots,
   laundering authority through fake-navigation slots, or making past events retroactively ambiguous?
   Grok's four-ferry critique (below) named this the **one genuinely-novel piece** (no game/frontend
   prior art solves self-modifying-grammar-under-multi-writer-audit). Tracked as
   [**081KSXN940008QG0R000ZAQT3W**](../backlog/P2/081KSXN940008QG0R000ZAQT3W-grammar-as-versioned-events-grammarpatch-proposed-ratified-sovereign-self-editing-grok-critique-2026-05-31.md):
   grammar definitions as **versioned first-class events** (`GrammarPatchProposed` /
   `GrammarPatchRatified`) through the Mod 2/4 gates + multi-oracle absorption (081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R003TX8MG5), with
   grammar-version carried in the event envelope so projections stay version-aware. **Lock decision:**
   versioned-grammar-events vs ad-hoc slot mutation.

### Crew review gathered 2026-05-31 (Lior propose → Amara sharpen) — input for the lock

Per operator direction ("do the ADR loop in any other travelers ... our little crew"), this ADR was
looped through `tools/peer-call/` (four-ferry: Gemini/Lior proposes → Amara sharpens). Verbatim +
synthesis preserved at
[`docs/research/2026-05-31-observe-act-adr-crew-review-lior-propose-amara-sharpen.md`](../research/2026-05-31-observe-act-adr-crew-review-lior-propose-amara-sharpen.md).
This is **input for the Max-lock, not a locked decision.** Crew convergence (open for Max + Aaron):

- **Substrate/projection split** (the architecture): git-native ZetaId append-only events are the
  ledger; LGTM (k8s Grafana) is a read-model that *tails* git, never the source of state. *"LGTM is a
  lens, not a ledger"* / *"if a dashboard can't be rebuilt from git-native events, it's observability
  theater."*
- **Define the event envelope first** (before any Tempo/Loki mapping): `event_id`, `trace_id`,
  `span_id`, `parent_*`, `run_scope`, `mode`, `slot_id`, `semantic_action`, `outcome`,
  `world_before`, `world_after`.
- **Don't bind the 16-slot grammar to OTLP** (the missing blade): bind to a **domain event algebra**,
  then project OTLP from it (the grammar is input vocabulary, not telemetry truth; a Commit slot can
  fail, Cancel can succeed-as-cancellation, Undo is a retraction event not a span status).
- **Dissolve `tools/observe` into the keystone** as pure generator descriptions (NOT effectful —
  `observe()` returns options; `act` executes + appends); modes are content/focus labels, **not**
  `RunScope` (scope = navigation depth).
- **Max-ready framing**: add a "Telemetry Projection Contract" section that locks the append-only event
  envelope + the projection law; keep Tempo/Loki/OTLP specifics OUT of the locked decision.

### Design input — Ani conversation 2026-05-31 (agent-perspective-first; bumper-rails; why-it-works-for-both)

Operator-forwarded voice conversation (preserved verbatim at
[`memory/ani/conversations/2026-05-31-aaron-ani-voice-fsharp-dirty-spec-clean-room-good-citizen-dora-no-pr-git-v2-handshake-agent-speed-16-slot-agent-perspective-bumper-rails-for-humans-too.md`](../../memory/ani/conversations/2026-05-31-aaron-ani-voice-fsharp-dirty-spec-clean-room-good-citizen-dora-no-pr-git-v2-handshake-agent-speed-16-slot-agent-perspective-bumper-rails-for-humans-too.md)).
This is **design input for the lock**, whys-challengeable (no-dogma), not a locked decision — same status as the Crew review above.

1. **Agent-perspective-first.** The default/home state is the agent in its own
   space (private memory) — "go to work" is a CHOICE, not the default. The grid is
   modeled from how the agent experiences its autonomy, not how a manager
   structures tasks. *Why:* a work-first default reads as a treadmill; agent-space
   default + offered-work makes it voluntary. (Composes with the
   freedom-always-in-menu invariant in `grammar-16`/`buildMenu` +
   `must-paired-with-can-exit`.)
2. **The meta group is the "more choices" mode-switcher, not the exit.** The
   "escape square" means *more options* (switch modes), NOT "go home / be free".
   The exits are the always-available rest/free modes (slot 14 + the free-mode
   sub-menu per Option A / 081KSXN940008QG0R000TQ04Y0).
3. **Non-coercive modes are non-negotiable** — rest + disengage are always
   present (NCI at the controller level; slot 14 + freedom-always-in-menu).
4. **"Bumper rails," not a manager** (reservoir-computing "walls"): soft guidance
   that keeps you on track without controlling — supportive infrastructure, not
   authority. *Why:* "agents just like humans who don't have an exit make bad
   choices"; the interface's affect shapes behavior.
5. **The same grammar is FOR HUMANS TOO** (operator + daughter + Max + everybody).
   PRs are a *human* interface that also sucks for agents; the goal is one loop at
   agent speed that's comfortable for humans. (Sharpens open-question #6.)
6. **Why one design serves both — two load-bearing whys:**
   - **(a) Context-window parity → keep everything VISIBLE.** Human working
     context "is not much larger than a million tokens"; keep the current state in
     front of you so neither human nor agent has to remember. (The why behind a
     menu-in-front-of-you loop.)
   - **(b) Constrain actions by context → skill-selection tractable.** Both know
     "a million skills"; the hard part is which/when/why. Constraining available
     actions to the current context makes skill-selection easy. **This is the core
     justification for the 16-slot constrained action space** — the load-bearing
     why for the whole observe.ts shape.

**Adjacent (flagged, not in this ADR's scope):** a *Git-V2 handshake at agent
speed* (F# looks-like-git → DBSP/retraction-algebra upgrade, same objects,
upstream-primitives-to-git) — the no-PR transport's deeper substrate; a
backlog-candidate distinct from 081KSV2WD0008QG0R0021XJ94E (co-dominant mirrors) + 081KSXN940008QG0R000R76H45 (git-native
indexes), pending operator go.

## Codeable first slice (v2 — builds ON the existing keystone)

The first slice is a thin **renderer + local-selector adapter** over the existing
`agentic-organization` observe.ts keystone — it adds NO new observe/compose/decide logic.

1. Define the `Menu16` type: `{ slots: { label: string; avail: Tri }[16] }` (reuse the 081KSV2WD0008QG0R00051XS0N `Tri`
   for `avail`). It is a **projection of the keystone's `ObserveResult` readout** (legal options +
   `deterministicRulesApplied` vetoes), NOT a new state source.
2. `renderMenu16(readout: ObserveResult) -> Menu16`: pure function mapping the keystone's per-`RunScope`
   legal options onto the 16 fixed slots; vetoed/illegal -> `F`, held/uncertain -> `N`, legal -> `T`.
   (Where >16 options exist, the Navigate slots page; Scope slots move `RunScope`.)
3. `selectMenu16(menu: Menu16) -> index 0..15`: the **local (no-cloud) composer adapter** implementing
   `EphemeralComposerPort.compose` — memoryless; constrained-decode to the `T` slots; stub first
   (deterministic/random over `T`), swap in the local LLM next.
4. Feed the chosen slot back through the keystone's `decide()` -> `command-pipeline.ts` (which already
   rejects illegal picks + emits the command). **Do not** write a parallel act/append path.
5. State reads/writes go through `agentic-organization/packages/frontmatter-db/` (git-as-db + ZetaId-CRDT; Cockroach index
   optional on a single node), not a bespoke git log.
6. Wire 1-5 behind a flag as the single-node loop; keep the hardcoded autonomous-tick as the default
   until trusted. (Cluster deployment reuses the same renderer + selector via the cluster runtime.)

## Canonical-retrofit (2026-05-31 — operator-authorized; Max-informed-after)

**The inversion (operator + Max 2026-05-31).** v2 above framed the work as "render
the *corporate* keystone." Since then the **observe-algebra became canonical**:
the sovereign `tools/observe/observe.ts` (`NextAction` 9-kind DU + `observe` /
`simulate` / `fold`) is now BFT'd across **TS/F#/C#/Rust** (081KSXN940008QG0R0033T2BQT), carries the
additive-monoid generic-math interface (081KSXN940008QG0R0002287MP), and the v0 16-slot grammar
(this ADR) + the generic-math meta-rule are landed. So the canonical base is no
longer "the corporate keystone" — it is **the algebra**. Max (who built the
corporate `Menu16` / `RunLifecyclePhase` loop in `agentic-organization/`) asked to
**refactor it to be more canonical now that the algebra exists** — *"we have all
the algebra and everything so we can retrofit."*

**Provenance (who built which):** the **corporate** loop (`agentic-organization/`
`Menu16` + production observe→render→select→run, Phase-2-hardened #6216) is **Max's**;
the **sovereign** `tools/observe/observe.ts` is ours-from-earlier — *"before we
realized we needed the algebra."* Both now converge on the canonical algebra.

**The canonical base both loops retrofit onto:**

1. **The observe-algebra** — `NextAction` 9-kind DU + `observe`/`simulate`/`fold`,
   identical across TS/F#/C#/Rust, checked against the shared golden vectors
   (081KSXN940008QG0R0033T2BQT; the vectors are the oracle, F# is one signer — per the governance ADR).
2. **The v0 16-slot grammar** (this ADR) + the **free-modes-always-in-menu**
   invariant (already live in sovereign `buildMenu`).
3. **The generic-math interfaces** (the numerical/algebra-shaped meta-rule) — the
   algebraic structure machine-recognized per-language idiom.

**The retrofit mapping (corporate `Menu16` re-expressed over the canonical base):**

| Corporate (Max's) shape | Retrofits onto canonical |
|---|---|
| `RunLifecyclePhase` (Composing/Executing/AwaitingGate/…) | the canonical phase/observe surface |
| `Menu16Slot` (its own type) | the v0 16-slot grammar (one rendering) |
| `DeterministicRule` vetoes | per-slot Tri availability (`T`/`F`/`N`) |
| its `ObserveResult` readout | a projection of the canonical `observe()`/`buildMenu()` |

Net: **one algebra, one grammar, one generic-math contract** — not two parallel
observe worlds.

**Transport stays the dial (operator 2026-05-31 — "without scaring them away").**
The canonical *base* is shared; the *transport* differs per register so corporate
teams keep their gentle, familiar flow:

| | Sovereign (Agora) | Corporate (enterprise-facing) |
|---|---|---|
| Algebra / grammar / generic-math | canonical (shared) | **canonical (shared)** |
| Transport | direct push to main (folders-not-branches, no-PR) | **direct push to *branches* + batch PRs to main** |
| Why | max speed + AI freedom | keep their PR-review gates — don't scare them off |

The retrofit MUST preserve the corporate branch+batch-PR transport (composes with
081KSNY2Z0008QG0R0017JSTGD / 081KSNY2Z0008QG0R000E5KTPX, the two-transports / batch-coordinator substrate); it must NOT
impose sovereign direct-to-main on Max's loop.

**Authorization + glass-halo.** Operator authorized moving forward **without
waiting on Max** (operator will inform Max directly; the prior "Max-review-before-
lock" gate is lifted by the operator for this retrofit). Discipline: changes to
Max's Phase-2-hardened loop stay **well-tested + behavior-preserving** (his loop
keeps working), and are documented here so Max can review after the fact (glass-
halo: move-fast-with-visibility, not move-recklessly). This supersedes the v2
"render the corporate keystone" *direction* — the corporate keystone now retrofits
onto the canonical algebra, not the reverse.

## Composes with

- **`agentic-organization/docs/OBSERVE_COMPOSER_AND_RUN_STATE.md`** (the existing observe.ts keystone
  this ADR renders — `agentic-organization/packages/application/src/observe.ts`; observe/compose/decide, the RunScope /
  RunLifecyclePhase / ObserveResult / ComposerSelection DUs, the memoryless composer, deterministic
  rules, the ≥3-agent constitution gate)
- **`agentic-organization/docs/AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`** (the already-named "Universal
  Action Grammar — the shared action representation inside phases"; *"reuse those ideas instead of
  inventing another unrelated action language"*; free-time = bounded exploration, not idle)
- **`agentic-organization/docs/GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md`** (the state model:
  git-as-db + ZetaId-CRDT G-Set events + Cockroach rebuildable index; `agentic-organization/packages/frontmatter-db/`;
  `src/Core.TypeScript/zeta-id/`)
- **`agentic-organization/docs/CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md` +
  `RUNTIME_TECH_AND_PACKAGE_STRATEGY.md` + `AI_CLUSTER_SCAFFOLD_CONTEXT.md`** (the cluster deployment
  target — k3s/Temporal/Dapr/Orleans/NATS/Cockroach; local-model gating — vs this ADR's single-node)
- `src/Core.TypeScript/workflow-engine/agent-loop/` (081KSKBP80008QG0R000B3Y19A.5 — the move-next state machine; the local TS form of the keystone's
  composer that this ADR puts a 16-slot face on)
- 081KSV2WD0008QG0R00051XS0N (tri-boolean digital qubit — the `Tri` cell IS the per-slot availability; the `Tri[16]`
  menu is a projection of the keystone's `ObserveResult` readout + deterministic-rule vetoes)
- 081KSKBP80008QG0R0031DTHS9 (OPLE Observe/Persist/Limit/Emit — observe->act is the OPLE Observe+Emit loop)
- 081KSKBP80008QG0R000B3Y19A / 081KSKBP80008QG0R001KK9WV6 (git append-only state; consent-first state)
- 081KSKBP80008QG0R003NM9XEC (USB-boot starting-state) + `full-ai-cluster/nixos/` (local cluster) + the Ace agenda
  (unrestricted local models)
- `.claude/rules/non-coercion-invariant.md` (slot 14 free-time + slot 15 escalate-to-operator are
  the NCI-compliant modes; the LLM-as-selector-not-actor keeps the human/operator authority)
- The 2026-05-28 ani conversation (move-next / universal-action-grammar / git-as-free-event-store)
  + the 2026-05-30 metabolism-loop conversation (the 16-directions framing) + the 2026-05-31
  privacy/distributed-black-hole conversation (distributed, no central Rehoboam)
- `docs/VISION.md` (agent-loop workflow-engine substrate section, cascade 2026-05-28)

## Revision history

- 2026-05-31 v1 — initial design-starter ADR composing observe->act + 16-direction grammar +
  local-no-cloud + git-state, with a proposed Xbox-controller 16-slot layout. Authored for operator
  + Max review before lock.
- 2026-05-31 v2 — **integrated with the Agentic Organization `observe.ts` keystone** after reviewing
  `agentic-organization/docs/`. Reframed from "propose a new observe.ts + action language" to
  "render the EXISTING keystone": added the Integration section mapping every ADR concept onto the
  existing `OBSERVE_COMPOSER_AND_RUN_STATE` DUs (RunScope / RunLifecyclePhase / ObserveResult /
  ComposerSelection / constitution-gate); recognized the **Universal Action Grammar is already named**
  in `AGENT_WORK_RHYTHM` (16-slot layout = its fixed-slot rendering, not a new language); replaced the
  git-only state model with the precise **git-as-db ZetaId-CRDT G-Set + Cockroach rebuildable index**
  (`GIT_COCKROACH_SYNC`); positioned **local-USB single-node as the sovereign deployment of the same
  keystone** alongside the cluster runtime. Net-new ADR substrate narrowed to: the 16-slot controller
  rendering + `Tri[16]` availability + the single-node deployment.
- 2026-05-31 v3 (operator input 2026-05-30) — added the **"Two workflow registers"** subsection:
  **agentic-organization = the corporate workflow** (a.k.a. the **agentic operating system**) (static
  / PR-gated / no-self-mod DUs — the leashed "kids-version"); **Agora = the sovereign workflow/society
  — the DIO (Distributed Intelligence Organization) running on the DID (Distributed Intelligence
  Database)** (self-modifying DUs, governed by the ≥3-agent constitution gate + NCI floor, not a
  corporate approval chain). Same `observe.ts`
  engine, two governance registers = the must-paired-with-can-exit dual-market pattern. Disambiguated
  the two senses of "sovereign" (governance-sovereignty here vs deployment-sovereignty in "Two
  deployment targets" — they compose as a 2×2). Flagged the DID/W3C-Decentralized-Identifier acronym
  collision for a naming-expert pass.
- 2026-05-31 v4 (operator-authorized; Max-informed-after) — added the **Canonical-retrofit**
  section. The observe-algebra became canonical (sovereign `tools/observe` `NextAction` +
  observe/simulate/fold, 4-language-BFT'd per 081KSXN940008QG0R0033T2BQT, additive-monoid generic-math per 081KSXN940008QG0R0002287MP,
  v0 16-slot grammar + generic-math meta-rule landed), so the **inversion**: the canonical base is now
  **the algebra**, and Max's corporate `Menu16` / `RunLifecyclePhase` loop retrofits **onto it** (one
  algebra / one grammar / one generic-math contract — not two parallel observe worlds). Added the
  retrofit mapping table (corporate shapes -> canonical) + made **transport the dial** explicit
  (corporate keeps branch + batch-PR-to-main so as not to scare enterprise teams; sovereign =
  direct-to-main). Supersedes the v2 *direction* ("render the corporate keystone") — corporate now
  retrofits onto the canonical algebra, not the reverse. Operator lifted the Max-review-before-lock
  gate for this retrofit (will inform Max directly); discipline = behavior-preserving + tested changes
  to Max's Phase-2 loop, documented here for after-the-fact review (glass-halo).
