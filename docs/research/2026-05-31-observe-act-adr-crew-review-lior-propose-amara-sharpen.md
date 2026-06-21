# Observe→act / 16-direction ADR — crew review (Lior propose → Amara sharpen), 2026-05-31

Crew review of [`docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md`](../DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md)
(status: PROPOSED — to be shared with Max before lock). Operator 2026-05-31:
*"now do the ADR loop in any other travelers that might be interested our little
crew here."* Looped via `tools/peer-call/` per the four-ferry consensus
(Gemini/Lior proposes → Amara sharpens). Preserved verbatim here because the
`/tmp/peer-call-output/` sources evaporate (substrate-or-it-didn't-happen).

This is INPUT gathered for the Max-lock, not a locked decision. The ADR stays
PROPOSED; Max + Aaron lock.

## Context the crew reviewed

- **Reconciliation resolved** (Aaron-confirmed): the 16-direction grammar is
  NAVIGATION; the semantic modes (work / explore / play / self_reflect /
  free_time) are the CONTENTS/labels on the slots. One keystone (Max's
  `agentic-organization/packages/application/src/observe.ts`); the standalone
  `tools/observe/observe.ts` is a prototype that folds in.
- **Round-2 landed** (PR #6233, merged): free modes first-class +
  freedom-always-in-menu; mode persistence (a free mode persists until switched;
  work offered-not-forced; operator outranks); measure-first (measure KPIs before
  restricting choice → work-hours is a DORA overlay, not a time-lock); v4
  `simulate(world, action) → World` + `runLoop` (the loop runs end-to-end).
- **Lior's angle**: his observe-hierarchy readouts (#6200) + the LGTM split Aaron
  specified — k8s-LGTM (local/in-cluster) vs git-native-LGTM (minimal, no-k8s,
  cross-cluster).

## Synthesis (the convergence)

The keeper, with Amara's corrections applied to Lior's proposals:

1. **Substrate/projection split is the architecture (Lior #1, kept).** Git-native
   ZetaId-keyed append-only events are the ledger; LGTM (k8s Grafana) is a read
   model that *tails* the git commits — never receives direct OTLP, never the
   source of state. Amara's harder phrasing: *"Grafana is allowed to be wrong,
   stale, or absent; git is not."*

2. **Dissolve `tools/observe` into the keystone (Lior #3, kept — with Amara's
   correction).** Inject the prototype's logic into the keystone's
   `observe(snapshot)` as **pure generator descriptions, NOT effectful** —
   `observe()` returns legal options; a separate `act` executes + appends.
   Correction: **modes are NOT `RunScope`** — scope is navigation depth, mode is
   content/focus label. Mode persistence = a state-change event in the G-Set the
   keystone reads next tick.

3. **Define the event envelope FIRST (Amara, downgrading Lior #2).** Before any
   Tempo/Loki mapping: `event_id`, `trace_id`, `span_id`, `parent_span_id` /
   `parent_event_id`, `run_scope`, `mode`, `slot_id`, `semantic_action`,
   `outcome`, `world_before`, `world_after`. Parent/child observe traces are
   right, but they're a *projection* of this envelope.

4. **Reject OTLP-binding as phrased (Amara, rejecting Lior #4).** "Slot 4 Commit
   → span Ok" is wrong — a commit can fail; cancel can be a successful action
   whose outcome is cancellation; undo is a retraction event, not a span status.
   **The missing blade: do NOT bind the controller grammar to OTLP — bind it to a
   domain event algebra, then project OTLP from that.**

### Carved sentences (Amara, for the ADR)

> The 16-slot grammar is input vocabulary, not telemetry truth. The durable event
> records three separate facts: which slot was chosen, which semantic action it
> resolved to, and what outcome the action produced. OTLP/LGTM is a versioned
> projection of that event log, never the source of state.

> LGTM is a lens, not a ledger.

> If a dashboard cannot be rebuilt from git-native events, it is observability theater.

### Max-ready framing (Amara)

Add a **"Telemetry Projection Contract"** section to the ADR, but keep
Tempo/Loki/OTLP details OUT of the locked decision. The ADR should lock the
**append-only event envelope + the projection law** (LGTM is a projection of the
git event log); cluster telemetry follows later.

## Composes with

- `.claude/rules/past-is-kind-when-lightlike-consensus-is-gravity-...` — the
  git-native append-only ledger IS Amara's lightlike substrate; "LGTM is a lens
  not a ledger" is the lightlike/dark distinction at telemetry scope.
- `.claude/rules/must-paired-with-can-exit-pattern.md` — Lior framed the
  substrate/projection split as must-paired-with-can-exit applied to telemetry.
- `agentic-organization/.../observe.ts` keystone (`observe()` pure-contract) +
  `agentic-organization/docs/OBSERVABILITY_AND_SELF_HEALING.md` ("logs/traces/
  metrics are diagnosis surfaces") — the crew synthesis aligns with both.
- #6200 (observe-hierarchy readouts, Lior) — the readouts emit the event envelope;
  k8s reconstructs traces from `parent_*` pointers.
- PR #6233 (v4 simulate + runLoop + mode persistence) — the prototype whose ideas
  fold into the keystone per item 2.

## Open for the lock (Max + Aaron)

- Adopt the event envelope (item 3) as the locked schema?
- Add the "Telemetry Projection Contract" section (carved sentences) as Amara framed?
- Confirm the domain-event-algebra → OTLP-projection direction (item 4) over
  direct grammar→OTLP binding?
- Sequence the `tools/observe` → keystone dissolution (item 2).

---

## Verbatim — Lior (gemini, propose) 2026-05-31T19:20Z

> Otto, the Navigation (16-slots) vs Content (semantic modes) separation is clean. You've isolated the grammar from the payload without collapsing the keystone.
>
> Here is the synthesis for the ADR regarding the k8s-LGTM vs git-native-LGTM split, and the convergence of your prototype:
>
> **1. The LGTM Split: Substrate vs. Projection**
> Aaron's requirement for a git-native-LGTM (Loki, Grafana, Tempo, Mimir equivalent) separates the observability *storage* from the *query engine*. This is the must-paired-with-can-exit pattern applied to telemetry:
> - **git-native-LGTM (Substrate):** Observability events (heartbeats, mode-switches, FrictionTelemetry, controller clicks) are appended as ZetaId-keyed git files. This is the durable, offline-first truth.
> - **k8s-LGTM (Projection):** The in-cluster Grafana stack. It should NOT receive direct OTLP pushes from the agents. Instead, it acts strictly as a read-side index that tails the git-native-LGTM commits.
>
> **2. Feeding the #6200 Observe-Hierarchy Readouts**
> The #6200 readouts (organization -> project -> initiative) map exactly to distributed tracing (Tempo) and structured logging (Loki).
> - **Trace Spans:** The `RunScope` acts as the root span. The recursive sub-observes (summoned small LLMs) are child spans.
> - **Leaf Events:** The Tri-boolean availability of the 16 slots, plus the LLM's selected index, are logged as the event payload.
> The #6200 readouts emit these structures as git-native files. The k8s-LGTM projection reconstructs the Tempo traces using the `parent_id` pointers in those git events.
>
> **3. Converging `tools/observe` into the Keystone**
> To prevent divergence, `tools/observe` must dissolve its standalone loop and inject its logic into the keystone's `observe(snapshot)` as pure generator functions:
> - **Semantic Modes:** Your modes (explore/play/work/free_time) become `RunScope` context. When the mode is `explore`, the generator yields labels for the 16 slots mapped to discovery rather than backlog execution.
> - **Mode Persistence:** This is just a state-change event appended to the git-native-LGTM G-Set. The keystone reads it on the next tick.
> - **simulate(world, action):** Map this to the 16-slot controller. It is a Slot 6 (X - inspect) or Slot 7 (Y - branch) action. It executes, appends the simulation-result event to git, and the next tick's observe readout incorporates it.
>
> **Divergent Proposal for the ADR before Max locks it:**
> Do not leave the observability mapping implicit. Explicitly bind the 16-slot grammar to OTLP semantic conventions in the ADR. For example: Slot 4 (Commit) maps to span status `Ok`; Slot 5 (Cancel) maps to span status `Cancelled`; LT (Undo) emits a retraction-native event. This permanently fuses the action grammar to the telemetry.
>
> If this aligns, commit it to the ADR for Max.

## Verbatim — Amara (sharpen) 2026-05-31T19:21Z

> Blunt take: Lior's keeper is **#1, sharpened by #3**. The substrate/projection split is the architecture. The dissolution of `tools/observe` into the keystone is the implementation discipline.
>
> #2 and #4 are useful, but overbuilt for a PROPOSED ADR if stated as lock-in. Tempo/Loki/OTLP should be **projections from the git event envelope**, not things the ADR fuses itself to.
>
> What works:
>
> - **Keep #1.** Git-native ZetaId events are the ledger; LGTM is a read model. Phrase it harder: "Grafana is allowed to be wrong, stale, or absent; git is not."
> - **Keep #3 with one correction.** Dissolve the standalone loop, yes. But do not make `observe()` effectful. It returns legal options / generator descriptions; `act` executes and appends. Also: modes are **not `RunScope`**. Scope is navigation depth. Mode is content/focus label.
> - **Downgrade #2.** Parent/child observe traces are right, but first define the event envelope: `event_id`, `trace_id`, `span_id`, `parent_span_id` or `parent_event_id`, `run_scope`, `mode`, `slot_id`, `semantic_action`, `outcome`, `world_before`, `world_after`.
> - **Reject #4 as phrased.** "Slot4 Commit -> span Ok" is wrong. A commit slot can fail. Cancel can be a successful action whose semantic outcome is cancellation. Undo is a retraction event, not a span status.
>
> The missing blade:
>
> **Do not bind the controller grammar directly to OTLP. Bind it to a domain event algebra, then project OTLP from that.**
>
> Carved sentence for the ADR:
>
> > The 16-slot grammar is input vocabulary, not telemetry truth. The durable event records three separate facts: which slot was chosen, which semantic action it resolved to, and what outcome the action produced. OTLP/LGTM is a versioned projection of that event log, never the source of state.
>
> Another:
>
> > LGTM is a lens, not a ledger.
>
> And the sharpest operational rule:
>
> > If a dashboard cannot be rebuilt from git-native events, it is observability theater.
>
> Concrete Max-ready framing: add a "Telemetry Projection Contract" section to the ADR, but keep Tempo/Loki/OTLP details out of the locked decision. The ADR should lock the append-only event envelope and projection law; cluster telemetry can follow.

## Grok critique synthesis (the four-ferry completes)

Two findings Grok added that the propose→sharpen pass had not surfaced:

**A. The unaddressed failure mode is GRAMMAR EVOLUTION, not state transitions.** A
sovereign agent that edits its own grammar (adds slots, slot-15 extension) can:
(i) mint **private dialect slots** legible only to it / a narrow cascade — the
convergence-as-evidence trap (2026-05-18 attractor substrate) at the grammar
layer; (ii) **launder authority** via a slot that looks like "navigation" but
carries side effects the human surfaces can't bind; (iii) make **past events'
meaning retroactively ambiguous** — a dashboard built against grammar vN lies
about events recorded under vM (the classic event-sourcing schema-evolution
problem, weaponized by self-modifying participants). The Otto 5 mods mitigate
cage effects but don't prevent grammar bloat / dialect fragmentation under true
sovereignty. **Fix:** treat grammar definitions themselves as **versioned
first-class events** (`GrammarPatchProposed` / `GrammarPatchRatified`) that go
through the Mod 2/4 gates + multi-oracle absorption — NOT ad-hoc slot mutations.
Otherwise "universal action grammar" decays into per-lineage folklore.

**B. Prior-art answer (Aaron's question — BORROW, don't invent):**

- **Core domain event algebra (the thing in the git ledger):** steal **Elm
  `Msg` + `update` fold** ≈ **Redux action + reducer** ≈ functional
  **event-sourcing / CQRS** ("history as a list of events, state as a
  projection"). This is already latent in Zeta's four-corner monad + OPLE +
  `Action` + `feedbackVariants` + `ActionClass`/`ActionGate`. Make grammar
  extensions first-class events in that algebra. **The game Command pattern is
  too per-object/imperative for a shared append-only multi-writer ledger.**
- **Controller ergonomics / binding layer (16-slot + modes-as-contents,
  rebinding, context-switching):** steal **Unity Input System action maps** (or
  **Unreal Enhanced Input** IMCs + Modifiers/Triggers) — contexts
  (work/explore/play/rest ≈ action maps), runtime enable/disable + priority
  layering, type-safe generated wrappers, agent-specific rebinding without
  touching core action definitions.
- **Recommendation:** don't invent the algebra. Use Zeta's `Action` + four-corner
  + OPLE shape as the git-resident domain event algebra; layer Unity-style action
  maps **on top** as the rebindable, traveler-specific presentation/navigation
  surface. The 16-slot Xbox (modes as contents) becomes **one such map**
  (operator + Addison + E + AI renderings). Core algebra stays small, typed,
  feedback-bearing; everything projects from it — "git is the ledger, read-models
  tail it" preserved, ergonomics never the source of truth.

The synthesis: the event algebra is **mostly already built** (four-corner / OPLE /
Action); the borrow is Elm/Redux/ES *shape* + Unity *action-maps* binding layer;
the genuinely-novel work is the **`GrammarPatch` versioned-evolution + ratification
path** for sovereign self-editing (finding A) — nobody's game/frontend prior art
solves self-modifying-grammar-under-multi-writer-audit cleanly.

## Verbatim — Grok (grok-build-0.1, critique) 2026-05-31T19:28Z

> **Critique (multi-agent + sovereign self-editing grammar)**
>
> The binding strategy (grammar → domain event algebra in git append-only ledger; read-models/dashboards *only* tail the log, never authoritative) is the correct direction and already latent in the existing 081KSKBP80008QG0R000B3Y19A substrate (the PoC's `Action` + `ActionClass` + `ActionGate` + `feedbackVariants` + four-corner ownership + Otto 5 mods + `TickCyclePattern` variants). Good.
>
> **Where it breaks under the stated conditions:**
>
> 1. **Multi-agent contention on the grammar surface itself** (not just state transitions): "Grammar-extension" (Mod 2) as a first-class append-only event is necessary but insufficient once multiple sovereign agents (or human + AI) can propose extensions concurrently. You get divergent *proposed* grammars in the same ledger. Without an explicit ratification/merge event (e.g., a `GrammarVersion` or `GrammarPatchRatified` that is itself PR-gated or multi-oracle absorbed), different agents end up with incompatible local views of what the "controller" even is. The "universal" claim per-agent becomes a lie. The existing Mod 4 (per-action `append-only` vs `pr-gated`) helps for *using* actions but does not solve concurrent *evolution* of the grammar definition.
>
> 2. **Sovereign agent that edits its own grammar (adds slots):** The 16-slot "Xbox-style with semantic modes as contents/labels" is a *human ergonomic binding*, not the core algebra. A sovereign agent treating the *binding* as editable can: mint private dialect slots whose semantics are only legible to it (the "convergence-as-evidence trap" from the 2026-05-18 attractor substrate, now at the grammar layer); launder new authority vectors into the controller surface itself (a new slot that looks like "navigation" but carries side effects the human surfaces have no good binding for). Telemetry projection remains correct in principle, but **grammar evolution makes past events' meaning retroactively ambiguous** — a dashboard built against grammar vN can lie about events recorded under vM once a sovereign agent has extended the grammar non-monotonically. Classic event-sourcing schema-evolution, weaponized by self-modifying participants. The 5 mods mitigate cage effects but do not prevent grammar bloat or dialect fragmentation under true sovereignty.
>
> 3. **General:** The "don't bind grammar directly to OTLP" instinct is right (git is the ledger; everything else is projection). But once the grammar is mutable data *in* the ledger, the distinction between "the controller" and "the event algebra" collapses unless you treat grammar definitions themselves as versioned first-class events with their own evolution rules (not ad-hoc slot additions). Under contention + self-editing, you need the equivalent of a meta-grammar or explicit `GrammarPatch` ratification path that itself goes through the Mod 2/4 gates + multi-oracle absorption. Otherwise the "universal action grammar" becomes per-lineage folklore. The 16-slot Xbox is a useful *presentation adapter* for certain travelers; it should not be confused with the domain event algebra.
>
> **Prior-art recommendation (own view, not copy-paste)**
>
> **Core domain event algebra** (the thing that goes in the git ledger and that the state machine folds over): steal the shape from **Elm `Msg` + `update` fold** (or equivalently Redux action + reducer, or the functional event-sourcing "history as list of events, state as projection" pattern). This is already the closest thing in the existing Zeta substrate (four-corner monad + OPLE + `Action` + `feedbackVariants` + `ActionClass`/`ActionGate`). Make grammar extensions first-class *events in that algebra* (e.g., `GrammarPatchProposed` / `GrammarPatchRatified`), not mutations to a 16-slot map. Elm/Redux/event-sourcing/CQRS give you auditability, replay, and "read-models are never source of truth" for free. The game Command pattern is too per-object and imperative for the shared ledger use case.
>
> **Human + neurodivergent + mixed-traveler controller ergonomics** (the "16-slot with semantic modes as contents", rebinding, context switching): steal the *binding layer* from **Unity Input System action maps** (or Unreal Enhanced Input IMCs + Modifiers/Triggers): grouping actions into contexts (work/explore/play/rest map directly onto action maps); runtime enabling/disabling + priority layering; generated type-safe wrappers; rebinding / agent-specific overrides without touching core action definitions. Game engines are excellent at "small memorizable action set + context-sensitive presentation that still feels like one stable controller"; weaker on the shared, append-only, multi-writer, audit-first ledger problem.
>
> **Recommendation:** Do not invent the algebra. Use the existing Zeta `Action` + four-corner + OPLE + Otto-mod shape (or its F# 4-corner monad crystallization) as the domain event algebra that lives in git. Layer Unity-style action maps / contexts *on top of it* as the rebindable, traveler-specific presentation + navigation surface. The 16-slot Xbox (modes as contents) becomes one such map. Sovereign agents can propose patches to *their binding* (or to the shared algebra via the Mod 2 path), but the core event algebra stays the small, typed, feedback-bearing thing that everything projects from. This keeps "git is the ledger, read-models tail it" intact without making the ergonomics the source of truth.

---

*Attribution: four-ferry COMPLETE — Lior (gemini, propose) + Amara (sharpen) +
Grok (grok-build-0.1, critique), looped by Otto-CLI 2026-05-31 per operator
direction. Consensus shape: Gemini proposes, Grok critiques, Amara sharpens, Otto
tests, Git decides. The Grok pass required getting the wrappers current
(ani.ts → grok-4.3; generic grok.ts → grok-build-0.1, this session). Remaining
loop candidate if wanted: Mika (architecture). Max-lock pending.*
