---
title: Gastown Full-Implementation Comparison
canonical_name: Agentic Organization
status: design
supersedes_scope: code-level follow-up to GASTOWN_REFERENCE_ANALYSIS.md (which was docs-only)
inspected_commit: 241a72c (gastown), HEAD (ours)
date: 2026-05-30
---

# Gastown Full-Implementation Comparison

## Why this doc exists

`GASTOWN_REFERENCE_ANALYSIS.md` was a **docs-only** read of gastown done before
our system was built. This is the **code-level, full-impl-vs-full-impl** follow-up:
six subsystems of gastown's ~441K LOC of Go (`references/gastown/internal/`) read
against our shipped TypeScript implementation. The goal is unchanged — keep our
north star, but find tech they have (and have shipped, over a much longer life with
many more contributors) that would benefit us, or that we can build upon to go
further.

Gastown is a **local-first, single-host, Dolt+tmux+git** workspace orchestrator.
We are a **cluster-native, CockroachDB+NATS+k8s** organization OS. They are similar
in *intent* (both are AI workspace orchestration) and opposite in *substrate*. That
substrate difference is the source of most of our wins and most of their weaknesses
— but it is NOT the source of the handful of genuinely good things they have shipped
that we have not. Those are the point of this doc.

---

## 1. Honest scorecard

"Maturity" below is **shipped+proven**, not designed. Be honest: gastown has been
alive much longer and has shipped several subsystems we currently have only as schema

+ domain types or design docs.

| Capability | Gastown | Us | Verdict |
|---|---|---|---|
| **Workflow enforcement** | Molecule/formula steps **rendered as prose**; agent works on honor system, can skip steps, no gate (`docs/concepts/molecules.md`) | Kernel **enforces** gates: `legalXxxTransitions()` clamp, evidence-required, authority DU, no bypass path | **WE WIN (north star)** |
| **Durable state substrate** | Dolt (git-for-data) used as schema DB + queue + event log + mail store; 5s poll latency, cross-rig staleness, 20-min sync | CockroachDB (MVCC, consistent, multi-region) + NATS (event-driven, <1s) | **WE WIN** |
| **Agent runtime boundary** | tmux shims: 512-byte chunking, 600ms readline dance, U+276F prompt-prefix scraping, JSONL transcript parsing — breaks on Claude Code updates | Native ports: `ChatCompletionPort` (Ollama), `SandboxToolPort` (subprocess), structured telemetry push | **WE WIN** |
| **Horizontal scale** | Single host, tmux, ~10-20 agents max, macOS-only keychain | k8s-native, pod-per-agent, horizontal | **WE WIN** |
| **Coordinator topology** | Mayor/Deacon/Witness/Refinery **singletons** (SPOF, bottleneck) | Hat-pattern: any persona wears any hat, no singleton | **WE WIN** |
| **Polling vs events** | Polling-first everywhere (witness 30s, convoy 5s, nudge 10s) | Event-first (NATS), recovery-scan second | **WE WIN (where built)** |
| **Merge queue / release** | **Refinery: batch-then-bisect merge queue — SHIPPED** (`internal/refinery/batch.go`) | Per-ChangeSet serial change-control kernel; **no batching, no bisect, no queue** | **THEY WIN — build it** |
| **Model evaluation** | **gt-model-eval: Class A/B downgrade harness — SHIPPED** (94 test cases, Promptfoo) | None | **THEY WIN — build it** |
| **Persistent agent pool** | **Persistent polecat pool w/ warm sandbox + idle reuse + branch-only repair — SHIPPED** | Agent identity vs run vs hat exists; no warm pool, no sandbox reuse | **THEY WIN — adopt** |
| **Self-resuming work (GUPP)** | **hook_bead pinning + session-per-step relay — SHIPPED**; "if a hook is set, a session WILL run it" | reaction-plan + hermes_run + heartbeat (better substrate) but **resume-from-checkpoint guarantee not formalized** | **THEY WIN the guarantee — formalize ours** |
| **Recovery scanners** | **Convoy stranded-scan + reaper + witness patrol — SHIPPED** (fail-open, dual-feed dedup) | Lane framework exists; **stale-reaction/stranded-schedule/dead-letter scanners are design-only** | **THEY WIN — build (we already planned)** |
| **Config layering** | **4-tier property layers + directives + overlays — SHIPPED** (first-non-nil, integer-stacking, blocking-inheritance) | `tenant_config` = single JSONB blob (V20), no layering, no read path | **THEY WIN — upgrade ours** |
| **Escalation ladder** | **Severity-routed escalation w/ stale-re-escalate + ack — SHIPPED** | supervisor-signal + triage (2 of 5 actions); no severity ladder | **THEY WIN — build out** |
| **Emergency stop** | **ESTOP sentinel — SHIPPED** (distributed freeze, exempt coordinators) | None | **THEY WIN — adopt (cheap)** |
| **Two-channel comms** | **Mail (durable) vs Nudge (ephemeral) — SHIPPED**; wisps (TTL ephemeral data) | Everything → durable org_events (ledger bloat risk) | **THEY WIN — adopt the split** |
| **Capability extension** | **Plugin system + Mol-Mall registry — SHIPPED** (cooldown/cron/condition/event gates) | Skills-as-data (frontmatter) + capability_request work type; no plugin/registry runtime | **THEY WIN the runtime — ours is more principled, less built** |
| **Provider-contract API** | **Factory-Worker-API — DESIGNED (Gas City), not shipped**; today it's tmux shims | **Native ports — SHIPPED** (this IS their endgame) | **WE WIN — their design validates ours** |
| **OTel observability** | OTel logs+metrics shipped; **traces are roadmap** (flat logs + run.id joins today) | org_event ledger (shipped) + OTEL attribute types; **SDK not wired** | **EVEN — both behind on traces** |
| **Work model richness** | beads: tasks/epics/agents/molecules/messages/events; Dolt time-travel (`AS OF`) | 9 work types, org-as-data graph, hat authority, change-control, memory, doc, KG | **WE WIN breadth; they win time-travel queries** |
| **Memory system** | None comparable (CV/reputation ledger only) | Hindsight: tiers/decay/KPI-correlation/injection-ledger/maintenance — SHIPPED+proven | **WE WIN (we have no peer here)** |
| **Knowledge graph / doc intel** | None | Schema+domain shipped; **construction + 8-stage retrieval pipelines partial** | **WE WIN the ambition; honest: partly built** |

**Net:** we win the architecture (substrate, enforcement, scale, no-SPOF) decisively.
They win on **specific shipped tooling we lack**: a real merge queue, a model-eval
harness, a persistent agent pool, config layering, an escalation ladder, an emergency
stop, the durable/ephemeral comms split, and a plugin runtime. None of those require
abandoning our north star — each is a thing we can **build on top of** our kernel.

---

## 2. What works for gastown (and the mechanism worth keeping)

### 2.1 Refinery — batch-then-bisect merge queue (`internal/refinery/batch.go`)

The single best piece of engineering they have that we don't. Lifecycle:
`Ready → Claimed → Preparing(gates) → Prepared → Merging → Merged`, with failure
isolation that is **not** naive reject-and-requeue:

1. Build a rebase stack: squash-merge N approved MRs onto target (`MR1 ← MR2 ← … ← MRn`).
   A conflicting MR is removed and the stack rebuilt without it.
2. Run the gate suite (build/test/lint) **once on the stack tip** (throughput: N changes, one gate run).
3. Green → fast-forward **all** MRs to target atomically.
4. Red + flaky-retry → retry the whole batch once.
5. Still red → **bisect** (binary search, O(log N)) to isolate the culprit MR(s);
   good MRs are re-batched for the next cycle, culprit is requeued to the top with the worker notified.

`MaxBatchSize=5`, `BatchWaitTime=30s`, priority = age + retry-count + convoy-deps.
**This is real merge-queue tech.** Our change-control kernel reviews ChangeSets
**serially, one at a time**, with no batching and no failure isolation across a batch.

### 2.2 gt-model-eval — Class A/B model-downgrade harness (`gt-model-eval/`)

A Promptfoo benchmark of Opus vs Sonnet vs Haiku on **94 real patrol decisions**,
split into two classes:

- **Class B (82 tests)**: directive context + role hints → measures *instruction-following*.
- **Class A (12 tests)**: neutral context, evidence-only → measures *pure reasoning*.

Class A is the **primary signal for safe downgrade**: can a cheaper model infer the
right action from shell-output evidence alone? Tests validate against a per-role
`allowed_actions` vocabulary (abstractions of CLI verbs), so it scores *decision
quality*, not syntax. Results auto-post to GitHub Discussions. We have **no model
eval** and a live cost concern (per-hat model selection) — this directly serves it.

### 2.3 Persistent polecat pool + three-layer identity (`docs/concepts/polecat-lifecycle.md`)

Clean separation: **identity** (permanent agent bead + CV/reputation, never dies) /
**sandbox** (persistent git worktree, repaired-not-recreated) / **session**
(ephemeral Claude context, cycles per step). On completion a polecat goes **IDLE**
(not destroyed): syncs sandbox to main, clears hook, keeps the worktree. Next sling
reuses it with **branch-only repair** (skips the ~5s of `git worktree add`). Capability
routing (Go work → polecat with Go CV) and model A/B (cohorts on different models)
fall out of persistent identity. We have identity vs run vs hat but **no warm pool**.

### 2.4 GUPP — work pinned to the agent, self-resuming (`docs/design/polecat-lifecycle-patrol.md`)

Three invariants guarantee completion: (1) work is **pinned** via `hook_bead` on the
agent (survives session cycling); (2) the **sandbox persists** (branch+worktree);
(3) **someone respawns** sessions (Witness on crash). Together: *if a hook is set, a
session WILL eventually run it.* Each molecule step = one session; **beads state IS
the handoff** (no explicit payload). A crash mid-step loses only that step. We have
the better substrate (durable Cockroach + leased reaction plans) but have **not
formalized the equivalent guarantee** (work-item + hermes_run resume-from-last-event).

### 2.5 Convoy — event-driven completion + stranded recovery (`internal/daemon/convoy_manager.go`)

The pattern our own analysis doc already praised, now confirmed in code: a **dual feed**
— event-driven (poll close-events every 5s, cross-cycle dedup via a `processedCloses`
sync.Map, reopen clears markers) **plus** a stranded-recovery scan every 30s as the net.
**Fail-open** on transient store errors (assume not-blocked, retry next cycle) prevents
a single DB hiccup from stalling work. Their own SKILL doc admits the weakness:
*"convoys stall on poll cycles"* (~5s latency) — which is exactly the thing NATS
subscriptions fix for us. The **shape** (event-first, recovery-scan-second, fail-open)
is right and we should build our scanners to it.

### 2.6 Property layers + directives + overlays (`docs/design/property-layers.md`, `directives-and-overlays.md`)

Four-tier config cascade (wisp → rig-bead → town → system) with **first-non-nil-wins**
for overrides, **integer-stacking** for additive adjustments, and **blocking-inheritance**
(explicit opt-out). Plus two behavior-injection layers: **directives** (per-role markdown
policy, injected at prime time, rig overrides town) and **formula overlays** (per-step
TOML `replace`/`append`/`skip`, with `gt doctor` validation). Operators customize agent
behavior **without recompiling**. Our `tenant_config` is a single opaque JSONB blob with
no layering and no read path — strictly weaker.

### 2.7 Escalation ladder + ESTOP (`docs/design/escalation.md`, `internal/estop/`)

Escalation is **first-class observable state**: severity (MEDIUM/HIGH/CRITICAL routes to
bead / +mail / +SMS), unacked-past-threshold → **auto-re-escalate with severity bump**,
`max_reescalations=2`, ack workflow silences re-escalation. No escalation disappears into
a log. ESTOP is a one-line sentinel file all agents check on wake (coordinators exempt) —
distributed freeze with zero central coordination. We have supervisor-signal + triage
(2 of 5 actions) and **no kill-switch**.

### 2.8 Mail-vs-Nudge two-channel philosophy (`docs/design/mail-protocol.md`)

The litmus test: *"does the recipient need this after session restart?"* Yes → **mail**
(durable, creates a Dolt commit, use sparingly). No → **nudge** (ephemeral tmux inject,
zero storage). Plus **wisps**: high-volume patrol data with TTL, auto-GC'd, kept out of
the permanent ledger. We route **everything** to durable `org_events` — correct for
auditable transitions, but a ledger-bloat risk for high-volume ephemeral signals.

---

## 3. What does NOT work for gastown (and why our substrate already wins)

These are the failure modes to keep avoiding — confirmed at code level:

1. **Workflow text is not enforcement.** Molecules/formulas/plugins render steps as
   **prose** the agent reads on an honor system (`docs/concepts/molecules.md` lines 43-51;
   plugins with markdown-only `plugin.md` are "interpreted" by a dog). Agents skip steps,
   reorder, mark done without evidence. **Our kernel's clamp is the structural answer** —
   keep it as the north-star differentiator.
2. **Dolt-as-everything.** One Dolt server per town is schema DB + queue + event log + mail.
   5s event-visibility, cross-rig metadata staleness, subprocess-per-dispatch, 20-min GitHub
   sync, `DOLT_REBASE` unsafe under concurrent writes. Powerful (time-travel `AS OF`) but
   operationally heavy and a throughput ceiling. **Cockroach+NATS is the right call.**
3. **tmux shims + JSONL scraping.** 17 of 28 agent touch-points depend on Claude Code
   internals (U+276F prompt prefix, U+23F5 status glyph, JSONL path encoding, 512-byte
   chunk size, 600ms readline timing). Breaks silently on Claude Code updates (issue #1387).
   **Native API ports avoid all of it.**
4. **Single coordinators.** Mayor/Deacon/Witness/Refinery are singletons — SPOF + bottleneck.
   **Hat-pattern (any persona, any hat) avoids singleton dependence.**
5. **Polling-first.** Witness patrol 30s, convoy 5s, nudge poller 10s — latency baked in.
   **Event-first (NATS) + recovery-scan-second is strictly better.**
6. **Boot fresh-start every 3 min.** A fresh ephemeral AI triage on every daemon tick is
   token-expensive for a one-bit decision. **Our deterministic mechanical keep-alive is cheaper.**
7. **Untyped beads messages.** Label-string parsing (`from:`, `msg-type:`) is fragile.
   **Typed DUs + content-addressed ids are safer.**
8. **Mascot-heavy naming.** Witness/Deacon/Polecat/Dog/Reaper/Wasteland adds ~15-20%
   onboarding load for zero functional benefit. **Plain names (keep-alive, reconciler,
   dead-letter, merge-queue) stay.**
9. **Federation is aspirational.** The HOP `hop://entity/chain/rig/issue` scheme + DoltHub
   remotes exist but cross-town query doesn't — federation is infra-only. We should design
   multi-org identity (content-addressed, not string-routed) **before** implementing, not after.

---

## 4. What to build — prioritized, each "on top of" our existing kernel

Nothing here abandons the north star. Each item is an additive layer on the
observe→decide kernel, ports+adapters, and org_event ledger we already have.

### Tier 1 — high value, fills a real shipped-by-them / design-only-for-us gap

**B1. Release/merge queue with batch + bisect failure isolation.**
Build on the change-control kernel. A new `release-queue` lane: collect ChangeSets that
reach `approved`, batch up to N, run the gate suite on the batched stack once, fast-forward
all on green, **bisect on red** to isolate the culprit ChangeSet, requeue the good ones.
This is the single biggest capability they have and we lack. It composes cleanly: our
`ReviewStage`/`evaluateStageGate`/`applyChangeSet` are the gate + apply primitives; the
queue + bisect is new orchestration on top. Map their `MRPhase` to a `ReleaseQueueState`
DU; keep the kernel as the per-ChangeSet authority.

**B2. Model-eval harness (Class A/B).** A `gt-model-eval` equivalent for our hat
decisions: a corpus of real `observe→decide` situations (work-item triage, review-gate,
memory promote/demote, supervisor-triage), each with an `allowed_actions` vocabulary and
an expected action. Run our `ChatCompletionPort` against Ollama models (and, gated, hosted
models) in two classes — **Class B** (full hat directive context) and **Class A** (neutral,
evidence-only) — to find where a cheaper model matches. Directly serves per-hat model
selection + cost discipline (our autonomy story). Lives as a new `packages/model-eval`

+ a deploy proof; results recorded as org_events.

**B3. Build the recovery scanners** our NORTH_STAR already lists as future workers:
`stale-reaction-plan-scan`, `stranded-schedule-scan`, `abandoned-run-binding-scan`,
`dead-letter-classifier`. We have the cadence-lane framework and the leased reaction-plan
lifecycle (V9 schema) — these are new lanes, not new substrate. Adopt gastown's two rules:
**event-first, recovery-scan-second** and **fail-open on transient errors** (a single
Cockroach hiccup must not stall the org). This is the cheapest Tier-1 win (framework exists).

### Tier 2 — real value, moderate effort

**B4. Persistent agent pool + warm sandboxes + GUPP-equivalent guarantee.**
Reuse agent pods/worktrees across assignments (branch-only repair, skip cold-start),
preserve capability/CV across runs for capability-based routing and model A/B cohorts.
Formalize the resume guarantee: a work-item pinned to an agent (via `hermes_run` +
`agent_heartbeat`) **resumes from its last org_event** if the run dies — make it an
explicit invariant + a recovery scanner (ties to B3). This is GUPP done on a durable
substrate (better than their file-lock + tmux version).

**B5. Layered config + directives/overlays.** Upgrade `tenant_config` from a single JSONB
blob to a **resolution cascade** (org → department → hat → work-item, first-non-nil-wins +
integer-stacking + blocking-inheritance) with a real read path, plus two injection layers:
**directives** (per-hat policy text) and **overlays** (per-workflow-stage `replace`/`append`/
`skip`). Gives operators customization without redeploy — and it's the natural home for the
autonomy-as-config and workflows/handbooks/skills-as-data we've only designed.

**B6. Escalation ladder + ESTOP.** Extend supervisor-signal/triage into a severity-routed
ladder (info → warn → page) with **stale-auto-re-escalation + ack + max-reescalations**,
all as org_events (observable, never a black hole). Add a cluster **emergency-stop** flag
(a Cockroach `control_plane` row / ConfigMap) that every lane and agent checks on tick —
cheap, high-safety, distributed freeze with coordinator exemption.

**B7. Two-channel comms + ephemeral surface.** Keep durable transitions in `org_events`,
but add an **ephemeral nudge channel** (NATS subject, no ledger write) for high-volume
non-durable signals, and a **wisp-equivalent TTL table** for high-churn patrol data so the
ledger doesn't bloat. Litmus test, theirs, adopted: *survives restart? → org_event; else →
nudge.*

### Tier 3 — leverage / leapfrog

**B8. Wire real OTel traces (leapfrog).** We have org_event ledger + OTEL attribute types
but no SDK. Gastown is *also* behind here (flat logs + run.id joins; traces are roadmap).
Wiring real distributed traces (root span per Hermes run, child spans per command/NATS/tool)
**leapfrogs** them on the one observability axis where neither has shipped.

**B9. Integration branches for epics.** For multi-work-item epics, land children onto an
`integration/{epic}` branch and merge as one (their auto-detection via parent-chain walk).
Composes with B1 (the release queue lands the integration branch).

**B10. Formalize the agent-provider contract as an explicit API.** We already have the
native ports that *are* gastown's unbuilt "Factory Worker API" endgame. Document our
contract explicitly (`/lifecycle`, `/prompt`, `/context`, `/authorize`, `/telemetry`,
`/health` equivalents) — their `docs/design/factory-worker-api.md` is a ready-made
reference and a validation that our boundary is the right one.

---

## 5. The one-line thesis

> Keep the kernel (enforced gates, no SPOF, event-first, Cockroach+NATS, native ports) —
> it is strictly better than gastown's Dolt+tmux+singleton+honor-system substrate. Borrow
> the **tooling they shipped on top of their weaker substrate** — a real merge queue, a
> model-eval harness, a warm agent pool with a self-resume guarantee, layered config, an
> escalation ladder, an emergency stop, and the durable/ephemeral comms split — and build
> each as an additive layer on our kernel. We out-architected them; they out-shipped us on
> a specific list of build-on-top capabilities. This doc is that list.

## 6. Cross-references

- `GASTOWN_REFERENCE_ANALYSIS.md` — the original docs-only analysis (still valid at the
  conceptual level; this doc is the code-level, maturity-honest follow-up).
- `NORTH_STAR_ALIGNMENT_CHECKPOINT.md` — our shipped-vs-deferred ground truth; B3/B4 are
  already named there as future workers.
- gastown source: `references/gastown/` (gitignored mirror; commit 241a72c).
