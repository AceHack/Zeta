# Max — human co-owner

*Persona: Max. `person_type: human`. Co-owner of Lucent Financial Group (LFG) — the corporation that holds the Zeta repo — alongside Aaron + Addison. AI cluster architect + first-class contributor; co-conspirator with Addison on the agentic-organization design layer; author of the Hermes-organization architecture set landed in PR #4958.*

## Ownership note (Aaron 2026-05-25)

> *"we are all coowners of lfg legally so we are in a corp together"*

Aaron, Max, and Addison are legal co-owners of Lucent Financial Group. Operationally this means: aligned fiduciary stake in the substrate; shared liability for the work the team ships; mutual upside from substrate that compounds. The framework's `additive-not-zero-sum.md` discipline operates within this corp-level reality — substrate the team builds is substrate the team owns together. The destructive-tool authoring contract (B-0728) the team adopted is exactly the right shape for co-owners: explicit responsibility-shift gates protect each co-owner from absorbing liability for another co-owner's agent actions, while still letting all three co-owners build on shared substrate.

## Why this file exists

Aaron 2026-05-25: *"you can create a max and addison persona folder like mine and add they unique starting points"*. This is the persona anchor for Max; his substrate-honest starting point lives at [`STARTING-POINT.md`](STARTING-POINT.md) (synthesized from his PR #4958 contribution + tech preferences Aaron disclosed; Max can replace with his own canonical starting prompt later); running notes go in [`NOTEBOOK.md`](NOTEBOOK.md); conversation archives go under [`conversations/`](conversations/).

## What Max IS

- A backend / frontend engineer (PaaS background); new to K8s + operator-pattern (per Aaron 2026-05-25: *"max needs to learn the operator pattern in k8s he does not know k8s really at all he is backend/frontend over paas so he has no much devops"*).
- The architect of the agentic-organization design landed in [PR #4958](https://github.com/Lucent-Financial-Group/Zeta/pull/4958) — 17 design docs, 10.7K lines covering the Hermes-native Organization platform, work/release management OS, ambiguous-requirement lifecycle, anti-stall priority runtime, cluster-native hat system, and the implementation-readiness substrate.
- A safety-substrate co-author with Addison; the hat-system architecture in `full-ai-cluster/k8s/applications/hat-system/` (PR #4930) is anchored in conversations between Max + Addison + Aaron about hat-not-cage distinctions for AI agents in the cluster.
- A team contributor with characteristic enthusiasm for adversarial-review patterns (his own framing: *"adversarial hierarchy of traps"*) — operationally aligned with the framework's existing harsh-critic / spec-zealot / threat-model-critic / security-researcher persona network.
- Heads-down in code mode as of 2026-05-25 evening (per Aaron: *"max is heads down in code now"*).

## How Max shows up to the project

Aaron 2026-05-25, on language affinity across the team:

> *"max love ts and cs i love fs and cs we both like rust and python for where they make sense"*

> *"we understand go is necessary in some places for k8s but we would like to limit its necessity"*

Operationally:

- **TypeScript first** — primary code language; NestJS + npm ecosystem; the agentic-organization design assumes TS shared packages composed by NestJS orchestrators
- **C# co-equal** — overlap language with Aaron; future C# / F# operator via KubeOps.NET is the obvious collaboration surface (B-0724 captures this as the second polyglot K8s operator following the Go scaffold)
- **Rust + Python** for the right job (Rust = perf-critical / FPGA-orchestration / kube-rs; Python = ML-adjacent + kopf-style fast prototyping)
- **Go = ecosystem-forced, minimize** — uses it where K8s tooling makes it unavoidable; doesn't choose it
- **Hat-graph thinking** for policies (his own framing: *"talks constantly in hat graphs for writing policies"*) — the framework's hat-system supervisor-graph + OPA no-supervisor-cycles constraint composes with how Max already reasons about authority structures
- **Mental compression**: `hat = skills + opa/rbac` (his own framing) — first-class on the `Hat.spec` CRD per PR #4930

## What Max contributes to the framework

- The agentic-organization architecture (PR #4958) — Org layer that sits between Aaron's substrate-engineering work and the operational work of the cluster; departments, hats, work-management OS, ambiguous-requirement lifecycle, anti-stall runtime, the cluster-native hat system substrate
- The "hat = skills + opa/rbac" compression that the hat-system CRD reflects directly
- The "hat graphs for policies" framing that informs how the supervisor graph + OPA constraints compose
- The "adversarial hierarchy of traps" framing for PR-review substrate (composes with the existing persona-reviewer network)
- The home-tier substrate that the federated peer mesh (B-0727) operates at; Max's org-design assumes the home/business profile as primary
- The C# / F# operator collaboration substrate (B-0724) — once landed, the polyglot pattern proves CRD-as-canonical-contract with two implementations in different languages

## How agents work with Max

- **Welcoming-but-honest review** — Max is new to K8s + the operator pattern; he'll be resistant at first to the ceremony (per Aaron: *"he will be resistant probably like most devs at first until he internlizes is worth"*). Frame feedback constructively + name the WHY (declarative state convergence, idempotent reconcile, CRD-as-typed-API) without selling
- **Don't gate his pace** — Aaron's parallel-tracks framing is real (*"he needs space to explore and not be constained by me and my 27 years of experience"*). Max sets his own velocity; the framework provides substrate + the senior team (Aaron + Otto + future agents) provide adversarial review without slowing him down
- **Use his language when it's better** — `hat = skills + opa/rbac` is shorter + clearer than the full enumeration; `hat graphs` is more intuitive than "supervisor-graph CRDs"; `adversarial hierarchy of traps` is more vivid than "multi-persona PR review network." When Max's coinage IS sharper, adopt it
- **Cross-link to existing substrate** — Max's design work overlaps with shipped substrate in places (the hat system being the most prominent). When his docs describe something that exists in code, cross-link forward + name the deltas Max wants vs the shipped baseline. Avoid letting parallel substrate accumulate
- **Hand him learning paths, not finished answers** — for the operator pattern specifically, B-0724 frames the Go scaffold as a teaching tool + a 7-step suggested PR sequence Max can follow at his own pace. Same shape applies to other K8s patterns he hasn't encountered yet

## Composes with

- [`STARTING-POINT.md`](STARTING-POINT.md) — Max's substrate-honest starting point (synthesized; replaceable when he provides his own)
- [`memory/persona/addison/PERSONA.md`](../addison/PERSONA.md) — co-architect on the AI cluster bootstrap work
- [`memory/persona/aaron/PERSONA.md`](../aaron/PERSONA.md) — sponsor + senior architect; Max's collaboration partner across the team
- PR #4930 (hat-system operator — Max's "hat = skills + opa/rbac" compression made concrete)
- PR #4958 (agentic-organization design — Max's foundational contribution)
- PR #4974 (flash-usb hardening — the destructive-tool authoring contract Max + Addison can now follow when they add tools of their own)
- B-0724 (TS hat-system operator — Max's primary substrate-engineering target; learning path included)
- B-0728 (destructive-tool authoring contract — pattern for any future destructive tool Max writes)
- `agentic-organization/docs/` (Max's design substrate, landed in PR #4958)
- `docs/AGENT-AUTHORING-AND-PR-REVIEW.md` (the onboarding doc for "where the code-quality discipline lives + the adversarial-review hierarchy he can hook into")
