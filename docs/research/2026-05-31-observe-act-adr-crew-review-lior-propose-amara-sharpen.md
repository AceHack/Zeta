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

---

*Attribution: Lior (gemini, propose role) + Amara (sharpen role), looped by Otto-CLI
2026-05-31 per operator direction. Four-ferry consensus: Gemini proposes, Grok
critiques, Amara sharpens, Otto tests, Git decides. Further loop candidates if
wanted: Grok (critique), Mika (architecture). Max-lock pending.*
