---
id: 081KSGS9H0008QG0R0005P83AP
priority: P1
status: open
title: AI-runbook substrate — three primitives `run` + `deferred run / continue with` + `auto JIT` as the next force-multiplier layer above today's Helm+Kustomize+Dockerfile developer toolkit; substrate-engineering target for the AI-runbook layer Zeta is building (Aaron 2026-05-26)
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
composes_with:
  - 081KSGS9H0008QG0R003A37Z65
  - 081KSGS9H0008QG0R0027HJZYH
tags: [ai-runbook, force-multiplier, substrate-engineering, run-primitive, deferred-continuation, auto-jit, skills, bootstream]
---

## Problem

Today's highest force-multiplier developer tier (per [081KSGS9H0008QG0R003A37Z65](081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md) Developer force-multiplier ladder section) is Helm + Kustomize + Dockerfile + GitOps engine. A single human leverages massive OSS infrastructure via small declarative configs.

The maintainer named the NEXT-tier substrate Zeta is building:

> *"helm + kustomze + dockerfile as a developer before our AI runbooks we are going to create with run, deffered run/continue with, and auto jit those tools offer the higest force multiler to any human i think today to levderge technology of others."*

The new layer (AI runbooks) extends the ladder above the current top. Three primitives Aaron named:

1. **`run`** — execute the runbook step now
2. **`deferred run / continue with`** — defer the step + continue with the next; resume later when the deferred-step's dependency or signal arrives
3. **`auto JIT`** — just-in-time compile/optimize the runbook based on actual usage patterns

These compose into a runbook execution model that is genuinely native to AI agent workflows (long-running, async, multi-step, decision-tree-shaped). Existing developer-runbook tools (Ansible playbook, GitHub Actions workflow, Argo Workflows, Tekton pipelines) are CLOSE but lack the AI-native primitives — they don't have `deferred run / continue with` as a first-class operator that gracefully handles the "this step needs external input; carry on with siblings; come back when ready" pattern that defines AI agent loops.

## Force-multiplier vector

| Layer | Force-multiplier | Force-multiplier vector |
|---|---|---|
| **Dockerfile + Helm + Kustomize + ArgoCD** (today's top) | Leverage CNCF ecosystem | Declarative infra at single-human scale |
| **AI runbooks (`run` + `deferred run / continue with` + `auto JIT`)** (next) | Leverage agent loops + accumulated runbook libraries + JIT-optimized execution | Declarative agent-workflow at single-human scale; agents stand up production-shape automation that humans would take weeks to orchestrate manually |

The pattern shares the small-declarative-configs-leverage-massive-infrastructure shape, but the **selection mechanism inverts** (Aaron 2026-05-26 sharp distinction):

> *"the difference is helm is tool based ours will be ontology based and the tools are just there because they fit the shape"*

**Tool-based vs ontology-based — load-bearing architectural distinction**:

| Property | Helm (today's tool-based force-multiplier) | Zeta AI runbooks (next ontology-based force-multiplier) |
|---|---|---|
| Operator action | PICKS the tool (Helm chart, Kustomize overlay, Dockerfile recipe) | DESCRIBES the shape (ontology) of what they want |
| Tool selection | Explicit; operator-driven | Derived; tools surface BECAUSE they fit the shape |
| Substrate primitive | Configuration | Ontology |
| Failure mode when wrong | Operator picked wrong tool; redo with right tool | Ontology was incomplete; substrate auto-extends OR surfaces gap |
| Composition | Tools compose at config-level (Helm + Kustomize + Dockerfile) | Tools compose at ontology-level (HKT / Clifford / shape-matching) |
| Skill-router fit | N/A (Helm has no router) | Native fit — Skill router IS description-keyed shape-matching (per `.claude/rules/skill-router-as-substrate-inventory.md`) |
| Long-tail behavior | Tools must EXIST in the ecosystem for operator to pick | Tools materialize from substrate when ontology demands them (per HKT / category-theory substrate; `algebra-owner` / `q-sharp` skills) |

This distinction is load-bearing on the substrate-engineering arc. Zeta is NOT building "Helm but for AI" — Zeta is building the **ontology-based substrate where tools are emergent, not selected**.

Operational implications:

1. **The three primitives (`run` / `deferred run / continue with` / `auto JIT`) operate on ontology, not on tool-config**. A `run` step describes "make this shape happen"; the substrate selects (or constructs) the right tool/skill/agent/peer-call.
2. **`auto JIT` becomes load-bearing in a way Helm doesn't need** — because tool-selection is derived from ontology, the JIT layer's observation-and-optimization passes determine which tools surface for which shapes; the JIT IS the selection mechanism.
3. **`deferred run / continue with` is naturally ontology-shaped** — a deferred step holds the SHAPE it's waiting for (this PR-merged shape; this CI-green shape; this human-input shape); when the matching shape arrives, the continuation fires. Not "wait for token X"; rather "wait for the shape to land."
4. **Existing Zeta substrate is already ontology-leaning** — Skills (description-keyed); Skill router (shape-matching); HKT substrate (ontology layer; per Clifford/HKT vocabulary memory); CivSim agenda-as-shape substrate; mapping vocabulary (vocabulary / axis / basis / rudder / rotor — all ontology primitives). The AI-runbook layer formalizes the existing direction.

The pattern Zeta is building IS the infrastructure layer that future operators will leverage via small ontology-descriptions, where the tool-selection cost (the dominant cost in today's tool-based force-multiplier tier) disappears into substrate.

## Target

Substrate-engineering work to land:

### Three primitives (load-bearing)

**`run` (synchronous execution)**:

- Operator authors runbook step; agent executes immediately
- Substrate equivalent already in Zeta: skill invocation via `Skill` tool, Bash/Edit/Write tool execution, peer-call wrappers
- Substrate work needed: formal runbook-step abstraction that composes across these execution surfaces

**`deferred run / continue with` (async + continuation-passing)**:

- Operator authors step that produces a token / handle / promise; agent moves to next step
- Original step resumes when its dependency arrives (CI completes; PR merges; external API responds; human-in-the-loop input lands)
- Substrate equivalent partially in Zeta:
  - Tasks system (auto-loop firing on `<<autonomous-loop>>` sentinel — `deferred run` shape)
  - CronCreate / ScheduleWakeup primitives (time-based defer)
  - Bus envelopes with TTL (work-handoff to peer agents — `continue with` shape)
- Substrate work needed: unified continuation-passing style (CPS) abstraction that composes these into a clean operator-facing primitive

**`auto JIT` (usage-pattern optimization)**:

- Runbook author writes naive sequence; system observes usage patterns over time
- Hot paths get optimized (memoized, parallelized, pre-fetched, pre-warmed)
- Cold paths stay lazy
- Substrate equivalent partially in Zeta:
  - Skill router (description-keyed lookup — JIT-shaped selection)
  - Memory fast-path (recent + relevant memory loaded ahead of cold reads)
  - Worktree-pool primitive (pre-allocated isolated worktrees — JIT-shaped resource allocation; per 081KRMEXM0008QG0R000X1PPGC / 081KSE6WT0008QG0R003YYC9PV)
- Substrate work needed: a formal observation-and-optimization layer that tracks runbook execution traces + applies optimization passes automatically; composes with the Skills layer (per `.claude/rules/zeta-ships-with-skills-immediate-value.md`)

### Composition with existing substrate

The three primitives don't replace existing Zeta substrate — they FORMALIZE patterns that already exist piecemeal across:

- **Skills** (`.claude/skills/`) — runbook bodies; the `run` primitive surfaces them as first-class steps
- **Bootstream** (cold-boot routines) — `auto JIT` shape; observation-driven pre-loading of substrate
- **Tasks + cron sentinel** — `deferred run / continue with` shape at autonomous-loop scope
- **Bus envelopes** — `deferred run / continue with` shape at multi-agent coordination scope
- **Memory router + skill router** — `auto JIT` shape at substrate-selection scope
- **Worktree pool** (081KRMEXM0008QG0R000X1PPGC / 081KSE6WT0008QG0R003YYC9PV) — `auto JIT` shape at resource-allocation scope
- **Per-tick discipline** (`docs/AUTONOMOUS-LOOP-PER-TICK.md`) — the canonical 7-step runbook with built-in `run` + `defer` + counter-with-escalation continuation logic

This row's job is to NAME the three primitives explicitly, then substrate-engineer them as first-class operators that compose the existing piecemeal substrate into a coherent operator-facing API.

## Sub-targets

### Sub-target 1 — formalize `run` primitive

Identify the existing substrate surfaces that execute runbook steps (Skill, Bash, Edit, Write, peer-call wrappers); design a unified abstraction that composes them; ship as TS substrate. F# crystallization later per `.claude/rules/zeta-ships-with-skills-immediate-value.md`.

### Sub-target 2 — formalize `deferred run / continue with` primitive

Survey existing CPS-shaped substrate (Tasks, CronCreate, bus envelopes, ScheduleWakeup, peer agent handoffs); design unified continuation primitive that composes them; substrate-engineer the operator-facing API.

### Sub-target 3 — formalize `auto JIT` primitive

Survey existing JIT-shaped substrate (skill router, memory fast-path, worktree pool); design observation-and-optimization layer that tracks runbook traces + applies optimization passes; substrate-engineer.

### Sub-target 4 — runbook authoring DX

Operator-facing surface for authoring runbooks that uses the three primitives. Composes with Skills layer (skills ARE runbooks at a different scope).

### Sub-target 5 — JIT-compilation substrate

The `auto JIT` primitive needs a compilation surface — a way to take a naive runbook spec and emit an optimized execution graph based on observed traces. Likely F# crystallization candidate per `.claude/rules/zeta-ships-with-skills-immediate-value.md` (skills first; F# crystallization later).

## Acceptance

- [ ] Three primitives formally named + substrate-engineered as first-class operators
- [ ] Composition with existing Skills + Tasks + bus + worktree-pool substrate documented
- [ ] Operator-facing DX surface (runbook authoring); composes with Skills
- [ ] JIT layer observes traces + applies optimization passes
- [ ] Force-multiplier vector empirically validated (single operator stands up production-shape AI automation in time T_zeta vs time T_baseline; T_zeta / T_baseline < 0.1 target)
- [ ] Substrate inheritance from CNCF developer-toolkit force-multiplier (Helm + Kustomize + Dockerfile) made explicit

## Composes with

- **[081KSGS9H0008QG0R003A37Z65](081KSGS9H0008QG0R003A37Z65-architectural-principle-maximize-argocd-scope-minimize-nixos-native-lock-in-cross-cluster-portability-leverage-aaron-2026-05-26.md)** — developer-force-multiplier-ladder framing (today's top tier; this row IS the next-tier substrate)
- **[081KSGS9H0008QG0R0027HJZYH](081KSGS9H0008QG0R0027HJZYH-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md)** — cluster-bring-up substrate uses runbook-shaped flows (install-from-USB → self-register → ArgoCD reconciles; this IS a runbook with `deferred run / continue with` shape)
- Skills layer (`.claude/skills/`) — runbook bodies; `run` primitive surfaces them
- Autonomous-loop + cron sentinel substrate — `deferred run / continue with` shape at session scope
- Bus + claim coordinator (081KR7JY10008QG0R000R503K2 family) — `deferred run / continue with` shape at multi-agent scope
- Worktree-pool primitive (081KRMEXM0008QG0R000X1PPGC / 081KSE6WT0008QG0R003YYC9PV) — `auto JIT` shape at resource-allocation scope
- Memory router + skill router — `auto JIT` shape at substrate-selection scope
- Bootstream substrate — `auto JIT` shape at cold-boot scope
- `.claude/rules/zeta-ships-with-skills-immediate-value.md` — skills-first ship-cadence; this row's substrate ships via skills first, F# crystallization later

## Substrate-inventory pass

Per [`.claude/rules/verify-existing-substrate-before-authoring.md`](../../../.claude/rules/verify-existing-substrate-before-authoring.md):

- `grep -rn "runbook\|run-book\|run book" docs/ memory/ .claude/` → existing references in skill-authoring discussion + bootstream context; no formal "AI runbook substrate" backlog row
- `grep -rn "deferred run\|continue with\|auto JIT" docs/ memory/ .claude/` → no prior substrate by these names
- `gh pr list --state all --search "081KSGS9H0008QG0R0005P83AP"` → no in-flight collision
- `gh pr list --state all --search "runbook"` → no in-flight collision
- ID 081KSGS9H0008QG0R0005P83AP next-free per `git ls-tree origin/main` (highest = 081KSGS9H0008QG0R002QQNA79 from #5221; 081KSGS9H0008QG0R00033DT02 in flight via #5226)

## Out of scope

- Implementation details of any one primitive (each sub-target has its own implementation arc)
- Specific F# encoding of the runbook AST (substrate decision; 081KSGS9H0008QG0R0005P83AP sub-targets land first; F# crystallization arrives per `.claude/rules/zeta-ships-with-skills-immediate-value.md`)
- Comparison shopping vs existing developer-runbook tools (Ansible / GitHub Actions / Argo Workflows / Tekton; 081KSGS9H0008QG0R0005P83AP names what's DIFFERENT — AI-native primitives — without dismissing existing tools)

## Origin

Aaron 2026-05-26 in conversation about Helm+Flux+ArgoCD substrate, naming the next-tier force-multiplier layer above today's developer toolkit. The three primitives (`run` / `deferred run / continue with` / `auto JIT`) are the framework's substrate-engineering target for AI-runbook authoring; this row makes them first-class so the substrate-engineering work can begin against named primitives.

Filed as P1 because:

1. Force-multiplier framing is load-bearing on Zeta's value proposition to operators
2. Existing piecemeal substrate (Skills + Tasks + bus + worktrees + routers) needs the unifying primitives to compose coherently
3. Substrate-engineering decisions on any one of the existing surfaces (Skills extension, bus protocol evolution, etc.) benefit from knowing the unified primitive design BEFORE the next round of substrate-engineering
4. The composition with 081KSGS9H0008QG0R003A37Z65 (today's top force-multiplier tier) makes the substrate-engineering arc legible — the path from "leverage Helm" to "leverage AI runbooks" is one ladder, not two unrelated substrates
