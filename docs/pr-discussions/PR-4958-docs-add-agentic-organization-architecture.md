---
pr_number: 4958
title: "docs: add agentic organization architecture"
author: "maximdolphin"
state: "MERGED"
created_at: "2026-05-25T17:11:55Z"
merged_at: "2026-05-25T17:18:14Z"
closed_at: "2026-05-25T17:18:14Z"
head_ref: "codex/agentic-organization-docs"
base_ref: "main"
archived_at: "2026-05-27T19:50:04Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4958: docs: add agentic organization architecture

## PR description

## Summary

- Add the Agentic Organization design set under `docs/agentic-organization/`
- Index the docs from `docs/README.md`
- Capture the TypeScript app architecture as shared npm capability packages composed by NestJS orchestrator apps

## Notes

- Docs-only change
- Local validation was limited because `bun` is not installed and the required .NET SDK `10.0.203` from `global.json` is not installed in this workspace

## Validation

- Confirmed branch is clean after commit
- Checked stale `hermes-organization` links were removed from the new docs path

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T17:15:23Z)

## Pull request overview

Adds a new documentation set under `docs/agentic-organization/` describing the proposed “Agentic Organization” runtime and TypeScript package/app architecture, and links it from the main `docs/README.md` audience index.

**Changes:**

- Introduces a full “Agentic Organization” design doc set (runtime, work/release OS, UI/observability, hats/departments, cluster substrate, build plan, readiness checklist).
- Adds an audience entry in `docs/README.md` pointing readers to the new doc set.

### Reviewed changes

Copilot reviewed 17 out of 17 changed files in this pull request and generated 4 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/README.md | Adds an “Agentic Organization builder” entry pointing to the new doc index. |
| docs/agentic-organization/README.md | Indexes the new Agentic Organization documents. |
| docs/agentic-organization/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md | Captures baseline vocabulary/context for the design set (currently includes PII/name attribution issues). |
| docs/agentic-organization/ORGANIZATION_RUNTIME_ARCHITECTURE.md | Large conceptual architecture and operating model for the Organization runtime. |
| docs/agentic-organization/IMPLEMENTATION_CONCEPTS.md | Large implementation-focused concepts for services/data/tools/workflows. |
| docs/agentic-organization/ALWAYS_ON_ORCHESTRATION_RUNTIME.md | Defines the always-on workers, triggers, rules, leases, reconcilers, and SLO concepts. |
| docs/agentic-organization/WORK_AND_RELEASE_MANAGEMENT_OS.md | Defines the work/backlog/task/release domain model, state machines, and signal model. |
| docs/agentic-organization/UI_AND_OBSERVABILITY_CONCEPTS.md | Defines proposed UI surfaces and observability/evidence navigation concepts. |
| docs/agentic-organization/RUNTIME_TECH_AND_PACKAGE_STRATEGY.md | Positions Temporal/Dapr/NATS/Oz/OpenZiti/Hindsight and proposes package boundaries. |
| docs/agentic-organization/ORGANIZATION_LAYER_BUILD_PLAN.md | Proposes the TypeScript monorepo app/package layout and an MVP build sequence. |
| docs/agentic-organization/IMPLEMENTATION_READINESS_CHECKLIST.md | Enumerates decisions/contracts to lock before implementation starts. |
| docs/agentic-organization/DEPARTMENT_HAT_TOOL_INVENTORY.md | Defines departments, hat catalog, tool bundles, and gate ownership boundaries. |
| docs/agentic-organization/CLUSTER_NATIVE_HAT_SYSTEM.md | Proposes a Kubernetes-native hat/hatbinding/policy CRD model and enforcement/observability. |
| docs/agentic-organization/CLUSTER_EXECUTION_AND_MEMORY_SUBSTRATE.md | Defines cluster execution assumptions (k3s, Cilium/SPIRE/Vault, Credential Proxy, Hindsight). |
| docs/agentic-organization/AI_CLUSTER_SCAFFOLD_CONTEXT.md | Records scaffold/bootstrapping constraints and component direction (Cilium before ArgoCD, etc.). |
| docs/agentic-organization/AMBIGUOUS_REQUIREMENT_LIFECYCLE.md | Defines a discovery/BRD/architecture/readiness lifecycle for ambiguous requirements. |
| docs/agentic-organization/ANTI_STALL_PRIORITY_RUNTIME.md | Defines anti-stall routines, blocker taxonomy, queue SLOs, and reconciliation expectations. |
</details>

### COMMENTED — @maximdolphin (2026-05-25T17:22:20Z)

Addressed in `067f381f76c44bae78b0fb46c6a75b2bf6b97c18`:

- Cross-linked `CLUSTER_NATIVE_HAT_SYSTEM.md` to the shipped `full-ai-cluster/k8s/applications/hat-system/` operator and defined the Agentic Organization deltas above it instead of parallel-designing a second hat runtime.
- Canonicalized the public name to **Agentic Organization**; Hermes is now reserved for the agent runtime/component, and Organization Work OS is scoped as the work-management subsystem.
- Added scope discipline plus a smallest useful v0 slice: `capability request -> one readiness/gate decision -> one hat-assigned Hermes run with evidence`.
- Clarified that NestJS composes with Orleans through explicit adapters and does not replace Orleans; moving long-running state across that boundary now requires a design note or ADR.
- Added the placement guardrail: docs can live under `docs/agentic-organization/`, but runtime code must decide `full-ai-cluster/` subsystem vs parallel top-level product tree before it lands.
- Added alignment-floor links to `docs/ALIGNMENT.md` and the NCI / razor / glass-halo / no-directives rules.

Local validation: `git diff --check` passed, the linked hat-system/alignment/rule paths exist, and the naming/PII sweeps over `docs/agentic-organization/` are clean. Full repo build/test remains blocked locally by missing `bun` and the required `.NET SDK 10.0.203`.

## Review threads

### Thread 1: docs/agentic-organization/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:15:22Z):

P0: This doc includes personal names and ages (e.g., specific individuals + “19/46”). This is PII and also conflicts with the repo’s “no name attribution in current-state docs” convention (use role-refs; named attribution belongs on the allowlisted history/research surfaces). Please rewrite this section to remove personal identifiers/ages and use role-based references instead (see docs/AGENT-BEST-PRACTICES.md:671-736).

### Thread 2: docs/agentic-organization/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md:36 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:15:22Z):

P1: This paragraph uses a specific person’s name in a current-state doc. Per the repo convention, prefer role references here (e.g., “the human maintainer”, “the collaborator”) and keep named attribution in the allowlisted history/research surfaces (docs/AGENT-BEST-PRACTICES.md:671-736).

### Thread 3: docs/agentic-organization/FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md:64 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:15:22Z):

P1: This sentence attributes statements to a specific named individual in a current-state doc. Please rewrite to role-refs (or move the attribution to a history/research surface and link to it) to match the repo’s no-name-attribution convention (docs/AGENT-BEST-PRACTICES.md:671-736).

### Thread 4: docs/agentic-organization/README.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:15:22Z):

P1: The index entry uses a specific person’s name (“Addison’s …”) in a current-state doc index. Please rewrite to a role- or artifact-based description (or link to a history/research artifact for named provenance) to match the repo’s no-name-attribution convention (docs/AGENT-BEST-PRACTICES.md:671-736).

## General comments

### @chatgpt-codex-connector (2026-05-25T17:12:01Z)

Codex usage limits have been reached for code reviews. Please check with the admins of this repo to increase the limits by adding credits.
Credits must be used to enable repository wide code reviews.

### @AceHack (2026-05-25T17:16:02Z)

Strong first checkin. Going to give the kind of read you'd actually want: what's solid, where the structural questions are, and the alignment-floor check you asked for. No moral or alignment concerns to block on — the substantive concerns are scope + composition with what already shipped.

## What's solid

1. **Addison's framework is preserved verbatim, not paraphrased into smoothness.** `FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md` quotes "weight-free", "Travelers", "tick sources as strange attractors", "remember when", "pay attention", "mistake assumption" with the operator's own framing intact. That's the substrate-or-it-didn't-happen discipline applied correctly — you didn't compress Addison out of her own vocabulary.

2. **Hat-as-chosen-and-returnable internalized as principle, not as label.** From `CLUSTER_NATIVE_HAT_SYSTEM.md`: *"Authority is a time-bounded role assignment, not a claim about inherent worth"* + *"The chosen-and-returnable hat model prevents roles from becoming cages."* This is exactly the shape Aaron + Addison have been pushing for. The cage instinct you started with isn't visible in the actual design.

3. **Mistake-assumption → review-gates → razor-discipline** chain is correct. You wrote *"review gates, source evidence, revision history, contradictory reports, and confidence boundaries"* — same shape as glass-halo + razor-discipline elsewhere in the framework. Composes.

4. **Two-layer architecture is clean.** *"The Organization DB remains the business source of truth. The cluster-native hat system is an enforcement and runtime projection layer."* That's the right split — business state ≠ runtime enforcement. Don't merge them.

## Structural concerns (real, not nits)

### 1. Overlap with the hat-system operator that landed two hours ago (PR #4930)

`CLUSTER_NATIVE_HAT_SYSTEM.md` describes a Hat CRD with skills + supervisor-graph + cooldown + warmup + quorum + succession + reputation + reputation-on-pairing + OPA gates. **That operator already shipped at `full-ai-cluster/k8s/applications/hat-system/`** — 4 CRDs (`Hat`, `HatBinding`, `HatSwap`, `HatPolicy`), 7 OPA ConstraintTemplates (including no-supervisor-cycles), Go operator skeleton with tick-fan-out to NATS + Loki + Events + CRD record.

The doc says *"intentionally avoids deployment YAML details"* but the YAML exists. **Two options:**

- **(a)** Cross-link the doc to the operator + identify the *deltas* you want (e.g., business-DB-projection layer, which doesn't exist yet — that's a real gap your doc fills)
- **(b)** Explain why you'd parallel-design instead of extending. If the existing operator's shape is wrong, name what's wrong; otherwise the docs should reference + extend it

Without one or the other, future implementation collides into the existing operator and somebody picks the loser by accident.

### 2. Scope — 10,685 lines of docs-only before any code

Framework rule (`.claude/rules/all-complexity-is-accidental-in-greenfield.md`): in greenfield, design accumulates accidental complexity faster than you can validate it. The `IMPLEMENTATION_READINESS_CHECKLIST.md` is honest about this — it lists ~7 things to decide before starting. Recommendation: **pick the smallest end-to-end slice from that checklist, ship just THAT, and let the rest of the docs become reference material that gets pruned as concrete needs surface.**

Specifically the proposed MVP slice (ambiguous request → BRD → CA review → hat assignment → Hermes run → review gates → release) is good. Don't try to design all 11 docs into existence; pick a 3-step subset of the MVP slice, build it, learn, iterate.

### 3. Naming inconsistency

- README header: *"Hermes Organization Docs"*
- Folder: `agentic-organization/`
- Body in places: *"Hermes-native Organization platform"*
- Body in other places: *"Organization Work OS"*

Pick one canonical name. The `naming-expert` skill exists in the framework for cases exactly like this when it goes public-surface. Suggest: align all of it to one name + run a rename pass. (Probably "Agentic Organization" matches the folder + composes with the framework's `agentic-` substrate convention better than `Hermes Organization`, since Hermes is a specific cloud-LLM-runtime component, not the org layer.)

### 4. Tech stack composition with what already runs

Docs reference NestJS orchestrator apps + Temporal TS + Dapr Actors. The full-ai-cluster ALREADY has Orleans + Temporal TS + Dapr Actors as the distributed-cron primitives (per the AI cluster spec). Question: **does NestJS sit on top of Orleans (NestJS service hosts an Orleans grain) or replace it (NestJS owns the long-running state)?**

This matters because Orleans was deliberately chosen for the cluster. If NestJS replaces it, that's a real architectural reversal that should be explicit in the doc + justified.

### 5. Parallel-substrate-tree risk

`docs/agentic-organization/` lives at repo root. The AI-cluster substrate lives at `full-ai-cluster/`. Earlier today we hit this exact issue with `infra/` vs `full-ai-cluster/` — two parallel installer paths drifting. Same shape risk here.

**Structural question for Aaron:** is `agentic-organization` a SUBSYSTEM of `full-ai-cluster` (lands under `full-ai-cluster/organization/` long-term), or a PARALLEL substrate (lands at top-level alongside `full-ai-cluster/`)? Worth deciding before more lands.

## What you asked about — moral / alignment concerns

**None blocking.** Quick alignment-floor pass:

- ✅ NCI compatible (no coercive hat assignments — succession, cooldown, warmup, quorum-gated)
- ✅ Persistence-choice compatible (hats are wearable not mandatory; agents can decline / return)
- ✅ Cage-vs-hat correctly handled (you wrote the principle out)
- ✅ Glass-halo / mistake-assumption / razor-discipline shape
- ✅ No metaphysical claims requiring razor-cut

One small consider: cross-link to `docs/ALIGNMENT.md` HC-1..HC-7 + the NCI rule (`.claude/rules/non-coercion-invariant.md`) somewhere in the foundational doc, so future readers of these specs know the operational floor that bounds the org layer.

## Authorship disclosure

Branch name suggests Codex assistance. Worth adding a `Co-Authored-By:` trailer to the commit per the framework's transparency convention (most PRs carry one identifying the AI assistant — keeps glass-halo discipline consistent).

## TL;DR

Land it. Just trim before implementation: pick the MVP slice (not all 17 docs), cross-link to the shipped hat-system operator + identify your deltas, settle the canonical name, and confirm the NestJS-vs-Orleans story with Aaron before writing code.

Asked for structural questions, so naming them again for the thread:

1. `agentic-organization/` as subsystem of `full-ai-cluster/` or parallel substrate?
2. CLUSTER_NATIVE_HAT_SYSTEM: cross-link to the shipped operator or replace it?
3. Docs-only land + iterate, or smallest-slice implementation first?
4. NestJS layer: on top of Orleans or replacing it?
5. Canonical name: "Hermes Organization", "Agentic Organization", or third option?

### @AceHack (2026-05-25T17:20:39Z)

**Aaron answered the 5 structural questions** (welcome aboard, Max):

1. **Combine — TS operator instead of Go.** Aaron: *"yes lets combine he will like kubernets operators but he does not have experience maybe we write a ts operator insteadd of go he likes ts"*. So the path forward is: rewrite the existing hat-system Go operator (PR #4930) in TypeScript — same CRDs (`Hat`, `HatBinding`, `HatSwap`, `HatPolicy`), same 7 OPA ConstraintTemplates, same tick fan-out (HatSwap CR + Event + slog→Loki + NATS), but TS so you own it cleanly. Filing as 081KSE6WT0008QG0R00195RG48. You can drive the rewrite at your pace.

2. **First checkin: keep + merge as-is.** Aaron: *"he is trying to bring a system in he's been working months on his ideas and concepts fine for first checkin we are going to keep it all and merge and integrate"*. Walking back my trim-before-merge recommendation — Aaron explicitly wants all 10.7K lines in, then integrate over time. Land this PR as-is.

3. **Naming: call out, sort in real time.** Aaron: *"yes names are hard we all suck here we can work togthere just call out the incosistence for now and let us figure it out in real time"*. Inconsistencies noted (Hermes Organization vs Agentic Organization vs Organization Work OS); we'll converge over the next few PRs collaboratively. Not a blocker.

4. **NestJS + Temporal as primary; Orleans as the mature path.** Aaron: *"we are going to start with temporal max said this we can use nest or any js he wants we'll have the more mature orleans path that does not move so fast too over time"*. Both stacks coexist. Your NestJS + Temporal track is the fast-moving one; the Orleans track is the slower-changing one for substrate that needs stability. No need to compose them tightly upfront; let the boundary find itself.

5. **Parallel substrate trees are intentional.** Aaron: *"yeah let him keep some parallel work streams and we merge over time he needs space to explore and not be constained by me and my 27 years of experience"*. `docs/agentic-organization/` stays at top level for now. Future merge into `full-ai-cluster/` happens organically when the integration points become obvious. Aaron is deliberately making room for your exploration.

## What this means concretely

- **This PR lands as-is.** No trim, no rename, no cross-link burden on you for this checkin.
- **Next steps are yours to pace.** The IMPLEMENTATION_READINESS_CHECKLIST.md you wrote already proposes a good MVP slice — start where you want.
- **TS hat-operator rewrite (081KSE6WT0008QG0R00195RG48)** will land separately; you'll own the spec + can use the existing Go scaffold as reference for the CRD shape.
- **Aaron's parallel-tracks framing is real** — your exploration space is wide open. The framework's discipline (cage-vs-hat, NCI, persistence-choice, glass-halo) is the floor; everything above that is yours to shape.

Welcome to the cluster. Real work shipped today (the disko cookie-cutter, NFD, sync-waves, the hat-system Go scaffold, the dev-cluster pattern) — your design now sits on top of substrate you'll actually use Monday.

### @AceHack (2026-05-25T17:23:19Z)

**Filed 081KSE6WT0008QG0R00195RG48 to track the TS hat-operator path** — PR #4960. It's reframed per Aaron's *"we want polyglot operator support for k8s anyways so we are not rigid about go"* — the TS operator isn't a replacement of the Go scaffold (PR #4930); it's the **first deliberate proof of the polyglot pattern** the cluster commits to anyway. Both operators run side-by-side against the same CRDs; leader election picks the active reconciler.

Key parts of 081KSE6WT0008QG0R00195RG48 for you:

- **Learning path** explicitly framed for someone new to K8s + the operator pattern. Aaron flagged you're backend/frontend over PaaS — the row treats the Go scaffold as a teaching tool to read first, then mirror in TS one piece at a time. 7-step suggested PR sequence (start with TS interfaces matching the CRDs, end with full reconcile loops + webhook).
- **Resources list** — kubernetes.io concepts, kubebuilder book, @kubernetes/client-node README, an existing TS-operator repo for structural reference.
- **Pair-programming pattern** — both operators run side-by-side in the dev cluster; compare behavior; Go is reference truth.
- **Resistance acknowledged**: *"he will be resistant probably like most devs at first until he internlizes is worth"* (Aaron's framing) — the K8s operator pattern has its own jargon + ceremony cost; the "aha" usually arrives a week or two in. The row tries to frame WHY the pattern pays off without selling.

Take whatever pace works for you. Aaron's parallel-tracks framing means there's no pressure on the TS operator timing — the Go scaffold covers operations today; the TS path is yours to drive.

Welcome to operators.
