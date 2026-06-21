---
title: Refactor — observe.ts as the universal agent CLI + scoped dashboard (every action routed through it; ≤16-slot grammar IS the guardrail)
canonical_name: Agentic Organization
status: design / refactor-spec
implements_adr: ../../docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md
composes_with: OBSERVE_COMPOSER_AND_RUN_STATE.md, OBSERVE_CONTEXT_PACKS.md, OBSERVABILITY_LGTM_STACK_DESIGN.md, AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md, GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md
date: 2026-05-31
---

# Refactor — `observe.ts` becomes every agent's only surface (CLI + dashboard)

> **This document is the refactor spec for the ADR**
> [`2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md`](../../docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md).
> The ADR decides the architecture (observe→act, 16-direction grammar, local-no-cloud, git-as-state).
> This doc says **exactly how to bend the systems we already have into that shape** — file by file,
> seam by seam, each step proven in KIND per the handoff discipline.

## 0. The target in one paragraph

`observe.ts` stops being an internal function and becomes **the single CLI entrypoint every agent
runs** — its dashboard, its menu, and its only way to act. One call, one scope, two halves:

```ts
observe(scope, hatAssignment) -> {
  actions: Menu16   // the <=16 things THIS hat may do now (label + Tri availability + reason-if-F)
  metrics: ScopedReadout  // the numbers relevant to THIS hat's scope (deterministically computed)
}
```

Agents **no longer call MCP tools directly**. They run `observe`, read the menu + their dashboard,
pick an index `0..15`, and `observe.ts` **routes that slot to its implementation** — which may be an
MCP tool, a provider adapter, or a `command-pipeline` command. **An agent's capability == whatever
`observe.ts` renders as `T` for its hat.** A TPM hat has no "write code" slot on the controller —
not blocked at runtime, *not present*.

## 1. The two structural shifts (everything else is plumbing)

### Shift A — guardrails move from **act-time** to **render-time**

Today the C4 guardrail (`preflightHatAction(hat, action)` in
`packages/application/src/hat-guardrails.ts`) runs **after** an agent has chosen an action, rejecting
the illegal hat×action before the command runs. That stays — but it becomes **defense-in-depth**. The
primary enforcement moves **into the readout**: a forbidden action is **never rendered as a `T`
slot**, so a well-behaved agent never even proposes it, and a misbehaving one is rejected twice (the
slot is `F`, and the pipeline preflight still fires).

```
BEFORE:  agent picks action ─► command-pipeline ─► preflightHatAction(hat, action) ─► allow/deny
AFTER:   observe(scope, hat) ─► renders only the hat's legal slots as T ─► agent picks a T slot
         ─► command-pipeline ─► preflightHatAction STILL fires (belt-and-suspenders)
```

This is the ADR's "capability is what's rendered" made literal. It is the same structural-safety
property as the kernel's `decide()` (which already rejects any selection outside the readout) — we
are extending that rejection *upstream* to the render, and *sideways* to include hat-authority.

### Shift B — `observe()` becomes **hat-aware** and gains a **dashboard half**

Today `observe()` is hat-agnostic and metric-free: it takes a `RunSnapshot`
(`runId / scope / phase / hasGateApproval / hasEvidence`) and returns lifecycle `AvailableOption`s.
The refactor makes it take the **hat assignment** too, run the hat guardrails as deterministic rules,
and return a **scoped metric readout** alongside the options — both computed by **deterministic query
sub-agents** (Section 4), so the dashboard is reproducible and DST-able.

## 2. Current state → target (honest gap table)

| Capability | Exists today | Refactor |
|---|---|---|
| pure `observe()` over a snapshot → legal lifecycle options | ✅ `packages/application/src/observe.ts` (`observe`, `RunScope`, `RunLifecyclePhase`, `AvailableOption`, `ObserveResult`) | **keep** — it is the core; we wrap + extend it |
| `decide()` rejects any pick outside the readout | ✅ `decide()` in `observe.ts` (`EphemeralComposerPort`, `ComposerSelection`) | **keep** — unchanged legality floor |
| deterministic hat guardrail | ✅ `preflightHatAction` / `ActionClass` / `ToolBundle` (`hat-guardrails.ts`, C4) — but it runs at **act-time, separate from observe** | **wire into the readout as a `DeterministicRule`** so it gates *rendering*, not just acting |
| readout lists the rules that ran | ✅ `RunStateReadout.deterministicRulesApplied` (names only) | **extend** — also list **vetoed options + per-option reason** (required: a dark slot needs a why) |
| hat-aware observe | ❌ `observe()` takes no hat | **add** `hatAssignment` to the snapshot/deps |
| 16-slot rendering | ❌ | **add** `renderMenu16(readout) -> Menu16` (a pure projection — NOT a new state source) |
| scoped metrics / dashboard | ⚠️ metrics exist (`packages/metrics/`, `packages/observability/`) but are not returned by observe | **add** the dashboard half: deterministic query sub-agents → `ScopedReadout` |
| MCP routing | ⚠️ `dispatchMetricsTool(name, args)` exists (`packages/metrics/src/mcp-tools.ts`) — the pattern, used directly | **generalize** into the slot→dispatch router behind `observe.ts` (the agent never names the tool) |
| CLI entrypoint each agent runs | ❌ | **add** the `observe` binary (`apps/agent-cli/`) — the agent's only surface |
| git-as-db state read | ✅ `packages/frontmatter-db/` (ZetaId-CRDT G-Set + Cockroach index) | **keep** — the snapshot observe reads is built from this |
| telemetry read-path | ⚠️ schemas exist (`packages/observability/`); `TelemetryQueryPort` specced in `OBSERVABILITY_LGTM_STACK_DESIGN.md` | **consume** it in the query sub-agents (dashboard half) |

## 3. The new `observe.ts` contract (additive, OCP-preserving)

```ts
// extend the snapshot — observe becomes hat-aware
type AgentObserveSnapshot = RunSnapshot & {
  hatAssignmentId: ZetaIdDecimal;
  hat: HatDefinition;            // carries allowedToolBundles (drives the guardrail rule)
};

// extend the readout — vetoed options gain a reason (required for dark slots + spans)
type VetoedOption = { option: AvailableOption; ruleName: string; reason: string };
type RunStateReadout = { /* ...as today... */;
  options: readonly AvailableOption[];          // survivors (T)
  vetoedOptions: readonly VetoedOption[];        // NEW — the F slots, with WHY
  deterministicRulesApplied: readonly string[];
};

// the hat guardrail becomes a DeterministicRule (Shift A) — pure, deterministic, replayable
const hatAuthorityRule = (hat: HatDefinition): DeterministicRule => ({
  name: "hat-authority",
  veto: (option) => {
    const cls = ACTION_CLASS_FOR_ACTION_TYPE[option.actionType]; // small map: actionType -> ActionClass
    if (cls === undefined) return undefined;                      // non-authority-gated move
    const r = preflightHatAction(hat, cls);                       // REUSE C4 verbatim
    return r.allowed ? undefined : r.reason;
  },
});

// the two-half return — the agent CLI's payload
type AgentObserveResult = {
  actions: Menu16;          // renderMenu16(readout)
  metrics: ScopedReadout;   // the deterministic query sub-agents (Section 4)
  context: ContextReadout;   // hat-scoped context pack: docs + graph + memory pointers
};
```

**The only behavior change to the core `observe()`**: collect vetoes *with their reasons* instead of
dropping them (today it only counts survivors). That is a small, backward-compatible change — every
existing caller still reads `readout.options`; new callers also read `readout.vetoedOptions`.

The context half is intentionally not in the core `observe()` kernel. It is a surface composition
step behind `ContextPackBuilderPort`: deterministic scope, required consults, graph traversal,
memory pointers, ephemeral synthesis, and gap review happen outside the kernel, then return a
pointer-rich `ContextReadout`. If the builder is absent, the surface returns an explicit degraded
context pack so the agent and UI can see that the missing context is a real operational weakness.

## 4. The dashboard half — deterministic query sub-agents

The metrics half is produced by **deterministic query sub-agents** (the ADR's self-recursive
observe-composition, but the *query* ones are deterministic joins, not LLM summons):

```ts
interface ScopedMetricAgent {
  scope: RunScope;                                  // which rung it serves
  compute(ctx: QueryContext): Promise<MetricBlock>; // pure-deterministic over its read-ports
}
interface QueryContext {
  cockroach: CockroachQueryIndex;       // the rebuildable index over git-as-db (frontmatter-db)
  telemetry: TelemetryQueryPort;        // PromQL/TraceQL/LogQL (OBSERVABILITY_LGTM_STACK_DESIGN.md)
  scope: RunScope; hatAssignmentId: ZetaIdDecimal;
}
```

- A **C-suite hat at `organization` scope** gets the org/initiative rollups (work-item funnel,
  conformance pass-rate, queue depths, cost-per-hat) — joined by org-scope query agents.
- An **engineer hat at `work_item` scope** gets that item's numbers (test runs, review state,
  reaction-plan attempts) — joined by work-item-scope query agents.
- The agents are **deterministic** (same index + same telemetry range → same `MetricBlock`), so the
  dashboard is replayable and the numbers are provable — only the final 1-of-16 *pick* is the LLM.
- They do **double duty**: their outputs also **feed slot labels + availability** (e.g. "release
  queue depth = 0" makes the *release* slot's label read "queue empty" and may render it `N`; a failing
  conformance SLI can disable a deploy slot). This is the "deterministic agents inside observe.ts that
  do the queries to help determine some of the outputs" the refactor calls for.

`ScopedReadout = { scope; blocks: MetricBlock[] }` — assembled by selecting the agents whose `scope`
matches (and, per the ADR's recursive decomposition, summoning finer-scope agents for drill-downs).

## 5. MCP-behind-the-slot — the action router

The agent's only tool is `observe`. A chosen slot is routed by `observe.ts` to its implementation:

```ts
type SlotImpl =
  | { kind: "command"; toCommand: (sel: ComposerSelection) => PipelineCommand } // → command-pipeline
  | { kind: "mcp"; tool: string; toArgs: (sel) => unknown }                     // → dispatch(tool,args)
  | { kind: "observe"; toScope: RunScope };                                     // → re-observe (drill)

async function act(index: number, menu: Menu16, ctx): Promise<ActResult> {
  const slot = menu.slots[index];
  if (slot.avail !== "T") return reject("slot not selectable", slot.reason); // Shift A, again
  switch (slot.impl.kind) {
    case "command": return runCommandPipeline(slot.impl.toCommand(selection)); // existing path
    case "mcp":     return dispatchTool(slot.impl.tool, slot.impl.toArgs(selection)); // generalizes dispatchMetricsTool
    case "observe": return { reobserve: slot.impl.toScope };
  }
}
```

- `dispatchTool` is the generalization of the existing `dispatchMetricsTool(name, args)` — the same
  descriptor+dispatch shape, now the **only** way an agent reaches an MCP tool. MCP is demoted from
  *the agent's surface* to *a slot implementation*.
- `command` slots flow through the **unchanged** `command-pipeline.ts` (authorize → idempotency →
  schedule-authority → handler → persist), where `preflightHatAction` still fires (Shift A
  defense-in-depth) and one `org_event` is appended.
- Every `act` is one span (`org.command` / `org.mcp.dispatch`) per the observability doc — so an
  agent navigating its own controller is fully traced.

## 6. The 16-slot projection (`renderMenu16`)

Pure function, per the ADR's first slice. Maps the (extended) readout onto the fixed 16 directions:
survivors → `T` (with label + `SlotImpl`), vetoed → `F` (with the **reason** from `vetoedOptions`),
held/uncertain → `N`. The fixed-direction roles are the ADR's v0 table (Navigate 0-3 / Commit 4-7 /
Scope 8-11 / Meta 12-15). The **Commit-A slot (4)** binds to the hat's *primary* `ActionClass` —
`code_author` → WriteCode, reviewer → ApproveReview, TPM → Prioritize — so the *same direction* means
the right thing per hat. `>16` options page via Navigate; scope moves via LB/RB → re-observe.

## 7. The CLI entrypoint (`apps/agent-cli/`)

A thin binary every agent process runs as its loop — **the agent's home screen**:

```
observe --hat <id> --scope <run|work_item|initiative|project|organization>
  → prints the ScopedReadout (dashboard) + the Menu16 (controller)
  → reads one index 0..15 (local LLM selector, or a human, or a test stub)
  → routes via act() → appends org_event → loops
```

The selector is the ADR's local-no-cloud composer (`EphemeralComposerPort.compose`, constrained-decode
to the `T` slots). Stub first (deterministic over `T`), local LLM next. Humans use the *same* binary —
the controller is substrate-inclusive (Xbox-grammar; ADR open-question 6).

## 8. Required keystone enhancements (each small + additive)

1. **`observe()` collects vetoes with reasons** (`vetoedOptions`) — was: survivors only. *(required —
   a dark slot needs a why; the ADR's `[OPEN]` Tri-reason gap.)*
2. **`observe()` becomes hat-aware** — snapshot carries `hat`; `hatAuthorityRule` runs as a
   `DeterministicRule` (reuses C4 `preflightHatAction` verbatim).
3. **`actionType → ActionClass` map** — the one new table joining lifecycle options to C4 authority.
4. **`renderMenu16` + `Menu16` + `Tri`** — the projection + the 081KSV2WD0008QG0R00051XS0N `Tri` for availability.
5. **`ScopedMetricAgent` + `QueryContext`** — the deterministic dashboard layer over the Cockroach
   index + `TelemetryQueryPort`.
6. **`SlotImpl` + `act()` router** — generalizes `dispatchMetricsTool`; the agent's only path to MCP.
7. **`apps/agent-cli/`** — the binary.

Nothing in the **kernel** changes: `decide()`, `command-pipeline.ts`, the change-control
constitution gate, git-as-db, and the existing `observe()` survivors-path all keep their contracts.

## 9. Refactor sequence (each step KIND-proven, per HANDOFF §7)

| Step | Deliverable | KIND proof |
|---|---|---|
| **R0** | `observe()` returns `vetoedOptions` (with reasons); `actionType→ActionClass` map | unit: a gated action appears in `vetoedOptions` with the C4 reason; existing survivor tests still green |
| **R1** | hat-aware observe — `hatAuthorityRule` as a `DeterministicRule` | proof: a TPM-hat snapshot renders WriteCode as vetoed; a code_author renders it surviving |
| **R2** | `renderMenu16` + `Menu16`/`Tri` projection | unit: readout → 16 slots; `F` slots carry the reason; Commit-A binds to the hat's primary ActionClass |
| **R3** | `act()` router (command + mcp + observe) generalizing `dispatchMetricsTool` | proof: a `command` slot lands an org_event via the unchanged pipeline; an `mcp` slot dispatches a tool |
| **R4** | deterministic `ScopedMetricAgent`s + `ScopedReadout` over Cockroach index | proof: org-scope vs work_item-scope return different, deterministic metric blocks |
| **R5** | wire `TelemetryQueryPort` into the query agents (needs OBS5 from the observability doc) | proof: a dashboard block reflects a live Mimir/Tempo number, scoped per hat |
| **R6** | `apps/agent-cli/` binary with the stub selector; behind a flag | proof: `observe --hat .. --scope ..` prints dashboard + menu, takes an index, loops, appends |
| **R7** | swap the local LLM selector in (ADR local-no-cloud) | proof: the local model picks a `T` slot; `decide()` + preflight reject any illegal pick |
| **R8** | migrate one real agent (e.g. a worker lane) to drive via the CLI; keep the hardcoded loop as default until trusted | proof: the lane runs a full tick through `observe`→`act`→org_event with the legacy path disabled |

Migration is **incremental and reversible** (ADR consequence): the hardcoded autonomous-tick keeps
running until each agent is moved behind the CLI and trusted.

## 10. What this does NOT do

- It does **not** rebuild `observe()`/`decide()`/`command-pipeline` — it wraps + extends them.
- It does **not** invent an action language — the 16-slot grammar is the *fixed-slot rendering* of the
  already-named Universal Action Grammar (`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`).
- It does **not** delete MCP — MCP becomes a `SlotImpl` behind `observe.ts` (operator confirmed:
  *observe.ts can route actions to MCP*).
- It does **not** weaken any guardrail — it makes guardrails *earlier* (render-time) and keeps the
  act-time preflight as defense-in-depth.
- It does **not** change the state model — git-as-db ZetaId-CRDT remains canonical; Cockroach stays a
  rebuildable index.

## 11. SOLID + testing discipline

- **OCP**: every addition (new ActionClass, new slot impl, new metric agent) extends a table/registry;
  existing rows are closed-for-modification.
- **DI / ports**: `TelemetryQueryPort`, `CockroachQueryIndex`, `EphemeralComposerPort`, `SlotImpl`
  dispatch — all injected; unit tests use in-memory fakes + a deterministic selector (no LLM, no
  network); cluster runs the real adapters.
- **Determinism**: dashboard + availability are deterministic; only the 1-of-16 pick is the model — so
  the whole loop is replayable/DST-able (the kernel property the ADR depends on).
- Each step ends with a `deploy/run-*.ts` KIND proof printing a passing JSON PROOF report on a
  rebuilt+redeployed image (HANDOFF §7).

## 12. Composes with

- **ADR** [`2026-05-31-observe-act-16-direction-...`](../../docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md) — the architecture this refactors toward (its first slice = R2–R3 here).
- `OBSERVE_COMPOSER_AND_RUN_STATE.md` — the keystone (`observe`/`decide`/the DUs) being extended.
- `OBSERVABILITY_LGTM_STACK_DESIGN.md` — the `TelemetryQueryPort` + 4 pillars the dashboard half reads (R5 depends on its OBS5); every `act` is a span there.
- `hat-guardrails.ts` (C4) — `preflightHatAction` reused verbatim as the render-time `hatAuthorityRule`.
- `packages/metrics/src/mcp-tools.ts` — `dispatchMetricsTool` is the seed the slot router generalizes.
- `GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md` / `packages/frontmatter-db/` — the canonical state the snapshot + Cockroach index are built from.
- 081KSV2WD0008QG0R00051XS0N (tri-boolean `Tri`) — per-slot availability; 081KS3X9Y0008QG0R00218150M/081KRW63S0008QG0R002GRX85J constitution gate — still bounds escalate (slot 15).
