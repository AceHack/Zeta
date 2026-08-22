# The pre-k8s layer is the recovery plane; surfaces are metered seams; the surface count is measurable, not chosen

Status: design. Every claim below carries a register label
(`shipped` / `partially shipped` / `planned` / `absent`) per
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md).
Unlabelled would read as `unmetered`, so nothing is left unlabelled.

**Scope, and what this doc deliberately does not touch.** Three other work
fronts are live and this one cites rather than enters them: the **k8s cluster
surface inventory**; **USB / zflash / hardware inventory and `tools/setup/`
installer mechanics** (`src/Core.TypeScript/zflash/`,
`full-ai-cluster/usb-nixos-installer/`); and **per-container HSM isolation and
its attack surface**. This doc is the **service decomposition and the tick-source
/ authority model** only. Where a conclusion here has a consequence for one of
those three, it is flagged as a handoff and left there.

---

## 0. The governing requirement, corrected twice

The brief began as "bootstrap the society before k8s exists." Two operator
corrections replaced it, and both narrow the design rather than widen it.

> *"the pre-k8s is for fixing k8s when it goes wrong on a node, and initial
> setup hiccups"* (Aaron)

So the layer is **not** transitional scaffolding and **not** thrown away when
the cluster arrives. It is the **recovery plane**, and its role is permanent
precisely because k8s fails. The governing constraint inverts:

> **Optimise for working when k8s is broken.** The recovery plane must have
> **no dependency on the thing it repairs**. A repair tool that needs the broken
> system to run is not a repair tool.

The right mental model is **out-of-band management** (serial console, IPMI/BMC,
a rescue path), not a bootstrap script: separate on purpose, permanently, and
valuable exactly because the primary plane is down.

This is already the repo's own recorded pattern, not a new idea. Backlog row
`081KSKBP80008QG0R003Z4C0D0` (**planned**, `status: open`, opened 2026-05-27)
names it *"control plane outside the control plane"* and cites the honest
precedents: kubelet runs outside k8s, the Cilium agent runs as a systemd service
outside the pod runtime, SRE oncall runs outside production, backup runs outside
what it backs up.

> *"just remember we have connected hive-mind-like entities, so they can exist
> inside and outside k8s at different access levels with different tick sources,
> and their own agent repo should help them optimize these different tick
> sources' authority to accomplish their goals"* (Aaron)

So an **entity is not a service**. One entity spans several tick sources at
several authorities simultaneously and straddles the k8s boundary permanently.
The 4-10 services are **surfaces an entity acts through**, never the entities
themselves.

And the vocabulary landed on **surface** — which, checked against the repo
before adopting, does not collide with the existing definition and is stronger
than a fresh coinage would have been.

---

## 1. What already exists (looked, not assumed)

| Thing | Where | Register |
|---|---|---|
| `IServiceManager` port + launchd / systemd / Task Scheduler adapters, OS auto-detect | `src/Core.TypeScript/service/service-manager.ts`, `adapters/` | **shipped** |
| Unified per-tick entry point for all personas | `src/Core.TypeScript/service/loop-tick.ts` | **shipped** |
| Data-driven persona registry (adding a persona is a data change) | `src/Core.TypeScript/service/persona-registry.ts` | **shipped** |
| Cross-platform path layout (darwin / win32 / linux) | `src/Core.TypeScript/service/env-schema.ts` | **shipped** |
| Cell liveness classifier (pure, OS-independent) | `src/Core.TypeScript/service/loop-liveness.ts` `classify()` | **shipped** |
| Liveness *fact-gathering* | same file | **partially shipped** — launchd only until this PR; see 7 |
| 4-cell-per-node manifest, agent rotates by editing data | `tools/setup/manifests/cluster-cells` | **shipped** |
| Cell provisioner (clone-per-cell, one supervisor unit per cell) | `tools/setup/host-loop-bootstrap.sh` | **partially shipped** — macOS/launchd only, exits 0 elsewhere |
| Heartbeat lanes: write, park on `heartbeat/*`, flush to main via PR | `src/Core.TypeScript/agent-heartbeats/` | **shipped** |
| Credential reachability as a measured neutral fact | `src/Core.TypeScript/enforcement/credential-reachability.ts` | **shipped** |
| Key custody / rotation, key classes, phase-bounded grants | `src/Core.TypeScript/key-custody/key-custody.ts` | **shipped** |
| Factory health signals (detect half of detect-trigger-repair) | `src/Core.TypeScript/health/factory-health-monitor.ts` | **shipped** |
| Mechanical authorization check | `src/Core.TypeScript/authorization/` | **shipped** — but scoped to *pace*, not access; see 3 |
| OS-routing install graph, NixOS-aware | `tools/setup/install.sh`, `linux.sh` | **shipped** |
| Cluster substrate (k3s, Cilium, Vault, SPIRE, ArgoCD, Longhorn, ...) | `full-ai-cluster/` | **shipped** (other agent's territory) |
| Agents as OS services *outside* k8s for cluster repair | `docs/backlog/P2/081KSKBP8...` | **planned** |
| Out-of-band human escalation (Twilio) | `081KSGS9H0008QG0R002F04ECB` | **planned** |
| **Any notion of an access level / authority tier attached to a surface** | — | **absent** |

That last row is the finding. A repo-wide search for `access level` returns two
hits, neither of them this concept. `PersonaConfig` carries schedule interval,
harness, model, and git identity, and carries **no authority field at all**. The
routing address in `docs/writer-actor-routing-model.md` is
`persona (+) surface (+) instance (+) topology` and carries **no authority
component**. The authority model Aaron is describing is genuinely not in the
repo yet; everything else largely is.

---

## 2. "Each is just a different tick source with different access levels" — instantiated, not re-derived

The repo already decided the ontology. `docs/writer-actor-routing-model.md`
carries it, and the mapping holds cleanly:

| Aaron's word | Repo's term | What it owns |
|---|---|---|
| entity / hive-mind entity | **persona / agent** | identity, memory, continuity ("what remains") |
| surface | **surface** | the host-boundary **seam** (the hexagonal port) |
| (the running thing) | **actor / cell** | `persona (+) surface (+) instance` ("what acts") |
| tick source | *(new precision)* | the influence that **crosses at** a surface and drives an actor |

The load-bearing part is the repo's own definition of surface:

> a surface **is a host-boundary seam** -- the membrane / Markov boundary /
> hexagonal **port** through which we plug in and **section 13-metered entropy
> crosses**. Surface and host are two faces of one boundary.

That definition does the work. If a surface is by construction **the metered
port**, then *"different surfaces at different access levels"* is not an
access-control scheme bolted onto the topology. **It is what a surface already
is.** Authority differences belong at the port because the port is where the
metering happens. We are not designing a new mechanism; we are **naming the
authority each existing seam already gates**.

So a tick source is *not* an actor. It is the influence entering through the
port, which is exactly what discipline 7 (noninterference) says must arrive
through a **declared, metered channel**. That reframes the whole ask:

> **The 4-10 "services" enumerate SEAMS, not processes.**

### Where the existing model needs an extension (and where it must not get one)

One extension is required and one is forbidden, and they are easy to confuse.

**Required:** authority must be attached to the **actor** (`persona (+) surface
(+) instance`), not to the persona. An entity holds a *set* of
`(tick source, surface, authority)` triples simultaneously. Modelling an entity
as sitting *in* a tier is the error; it holds several at once, on both sides of
the k8s boundary, permanently.

**Forbidden:** authority must **not** become a component of the routing address.
The repo already refuses the neighbouring conflation --

> Routing uniqueness is **reachability, NOT identity.**

-- and the authority version is the same refusal one step further:

> **The address routes. The credential authorizes. They must be separately
> verifiable.**

If authority were derivable from the address, then *knowing where a thing runs*
would confer what it may do -- address-as-capability. That is precisely
`source (not =) authorization` from
[`no-directives.md`](../../.claude/rules/no-directives.md), and it is the same
shape as the functional half of
[`dual-use-detection-is-neutral-oracle-decides`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):
**recognising sameness is not assigning identity**, and here, **knowing location
is not granting authority**.

---

## 3. The authority tiers, and what each is grounded in

Derived from what the substrate **already gates**, not invented. Each tier is a
distinct, existing credential or gate; the grounding column is the falsifier
(remove the grounding and the tier stops existing).

| Tier | Name | May do | Credential / gate it is read off | Register |
|---|---|---|---|---|
| **A0** | **Observe** | read local + public state, classify, report | none beyond process-local read | **shipped** (`loop-liveness`, `factory-health-monitor`, `credential-reachability`) |
| **A1** | **Journal** | append to its **own** ref; never `main` | push scoped to `heartbeat/*` / persona refs | **shipped** (`agent-heartbeats/`) |
| **A2** | **Propose** | open PRs, arm auto-merge; **cannot merge** | forge credential; ruleset "CI Gate" required at push, no bypass actors | **shipped** (the gate is real and enforced) |
| **A3** | **Repair-node** | mutate *this node's* service/process state | privileged local session (`systemctl`, `nixos-rebuild`); **no kubeconfig** | **planned** (`081KSKBP8...` phase 1-2) |
| **A4** | **Repair-cluster** | mutate cluster state | a kubeconfig | **planned** |
| **A5** | **Custody** | hold / rotate / sign; key-**holding**, not key-**using** | `KeyClass` = deployment / node / bundle-ca; phase-bounded `Grant` | **partially shipped** (`key-custody.ts` shipped; per-container HSM isolation is another agent's front) |
| **A6** | **Human-gated** | force-push, non-reversible, budget increase, permanent WONT-DO, HARD LIMITS floor | fresh human authorization, per action | **shipped as a rule** (`no-directives.md`), **absent as a mechanism** |

Two things about A6 are worth stating out loud because they are results rather
than restatements.

1. **A6 has no daemon, by construction.** Every other tier can be held by a
   standing process. A6 cannot, because standing authority over the gated
   classes is exactly what `no-directives.md` withholds. The tier list has a
   **hole precisely where authority may not be delegated**, and that hole is the
   design's honesty check: if a service ever holds A6, the model has been
   violated, and you can see it as a service that exists where none should.
2. The shadow may **inherit** authority (act within standing authority), never
   **extend** it (reach into a gated class). Stated as a tier property: an actor
   may act at or below its held tier and may never self-promote. Promotion is
   always an inbound grant, never an outbound claim -- the same construction as
   the privacy budget and the naming eigenvector (**conferred by others, never
   self-minted**).

Note what is *not* a tier: **"pace"**. `src/Core.TypeScript/authorization/`
already resolves the operative maintainer instruction about pace, filtered by
authorization-source. That is a real and shipped mechanism, and it answers *how
hard to go*, not *what may be touched*. Keeping them separate matters -- folding
pace into the tier ladder would let a "go hard" observation read as an authority
increase, which is the exact escalation `no-directives.md` forbids.

---

## 4. Natural, or imposed? The honest answer

Asked to test whether a 4-10 split falls out of authority tiers or is being
imposed. It is **partly natural, and the natural part is measurable** -- which
is a better answer than either.

**The tiers are natural.** Each of A0-A6 is read off an existing gate. I did not
choose seven; seven is what is there. The evidence that they are not invented:
A2's gate is an enforced GitHub ruleset with no bypass actors, A5's classes are
already a shipped type, A6's list is verbatim from a rule, and A1's lane
mechanism is already shipped and already parks off `main`.

**The tier list is NOT the service list, and equating them would be the
imposition.** A tier is an authority; a service is a supervised process. One
service per tier gives seven services and lands inside 4-10 -- and would be
numerology: a count that matches, with no structure behind it.

**The structure that does decide the count is already measured in the repo.**
`credential-reachability.ts` was written to replace an inherited assumption with
a measurement, and what it measured on the live Mac Studio is the load-bearing
fact:

> the one real credential is **`reachable-without-authentication`** -- readable
> by any process running as that user, with no prompt.

The consequence is a theorem, not a preference:

> **Two tiers co-resident in the same OS user are the same tier.** A seam that
> is not an isolation boundary is not a seam; it is a drawing of one.

So the surface count is **measurable, not chosen**: it is the number of distinct
**(principal, credential-domain)** pairs on the node. Every additional "service"
sharing a principal with an existing one adds a process and adds **zero**
authority separation -- and, worse, manufactures the appearance of separation.
That is the vacuity class in deployment clothing: a boundary that cannot fail is
not a boundary.

Applying that to the tiers gives the decomposition:

| Surface | Tier | Principal / isolation | Register |
|---|---|---|---|
| `zeta-observe` | A0 | unprivileged, **no credentials at all** | **partially shipped** -- the capability exists; not yet a unit |
| `zeta-journal` | A1 | own-ref push credential only | **partially shipped** -- lanes shipped, not separated by principal |
| `zeta-propose` | A2 | forge credential (PR scope) | **partially shipped** -- runs today co-resident, so A1/A2 are currently **one** tier by measurement |
| `zeta-repair-node` | A3 | privileged local principal, **no kubeconfig** | **planned** |
| `zeta-repair-cluster` | A4 | kubeconfig-holding principal | **planned** |
| `zeta-custody` | A5 | key-holding principal (HSM-backed -- other agent's front) | **planned** |
| *(A6)* | A6 | **no surface exists, deliberately** | **n/a by construction** |

Six surfaces, inside 4-10 -- but the number is a *consequence*, and it will
change when the principals change. The honest admission: **today the real
measured count is smaller than six**, because A0/A1/A2 all run as the same user
with the same reachable credential. Drawing them as three surfaces before
splitting the principal would be exactly the manufactured separation this
section forbids. They are listed as targets, and the *measurement* is what
promotes each one from drawing to seam.

**This gives the model its falsifier, which is the point of labelling anything.**
An authority tier that nothing can measure is unfalsifiable. This one is
measurable with a function already shipped: run the reachability probe as each
surface's principal and compare **declared** authority against **reachable**
authority. Declared-vs-measured drift is the falsifier. That is what would earn
this design the `metered` label; **it does not have it yet**, and this doc claims
`design` accordingly.

---

## 5. The portability boundary, stated concretely

"Abstracted over any OS" is load-bearing here rather than aspirational, because
the recovery plane runs on whatever the node actually is **when it is broken** --
which is when you least control its state. The boundary is sharper than
"we support three OSes":

**Portable, and shipped.** *Process supervision.* `IServiceManager` with launchd
/ systemd / Task Scheduler adapters and OS auto-detect. Path layout is likewise
portable and shipped (`env-schema.ts` branches darwin / win32 / linux).

**Portable, and the actual mechanism.** *Anything phrased as a total function
over already-gathered facts.* `classify()` in `loop-liveness.ts` and
`classifyReachability()` in `credential-reachability.ts` are both pure, both
OS-blind, both testable without the machine. This is discipline 7 doing real
work: **quarantine the OS-dependence into a declared fact-gatherer and the
judgement stays portable by construction.** It is also why the fix in section 7
is small -- the portable half was already right.

**NOT portable, and correctly so.** *Package installation.* `linux.sh` does not
have a NixOS adapter; on NixOS it **skips apt entirely** because the package set
is declared in `common.nix`. That is the right call, not a gap: on NixOS,
installing is not an imperative action at all, so an "adapter" would be a lie
about the platform. The boundary is therefore:

> **"Any OS" holds for supervising and observing. It does not hold for
> installing, and it should not.**

**The consequence for the recovery plane is a hard rule, and it is the one that
bites.** The recovery plane must assume its dependencies are **already present**
and must never try to install them. An installer dependency is a network
dependency, and the recovery plane runs precisely when the network may be the
broken thing. So the recovery plane's binary set is whatever the OS already
guarantees plus one runtime (`bun`), and `bun`'s presence is a **real, named
dependency** of this design rather than an assumption -- on NixOS it belongs in
`common.nix` `environment.systemPackages`; that is a handoff to the cluster-
surface front, not something to solve here.

---

## 6. Independence: what the recovery plane may not depend on

The minimum capability set to diagnose and repair a node **without the cluster's
help**, which is the question that replaced the continuity question:

1. **Know the node's agent layer is alive, and how it is broken.** A0. No
   credentials. -- **partially shipped, and broken exactly where it matters; see 7.**
2. **Record the diagnosis durably without a remote.** A1, degrading to a local
   file when no remote is reachable. -- **partially shipped**: the lane mechanism
   exists; the local-first degradation does not.
3. **Restart / reinstall local supervision.** A3. -- **planned.**
4. **Escalate to a human out-of-band.** -- **planned** (`...002F04ECB`).

Note what is deliberately **not** in the minimum set: A2 (proposing needs the
forge), A4 (cluster repair needs the cluster), A5 (custody is not needed to
diagnose). A recovery plane that needs any of those to *start* has failed the
independence requirement.

**The dependency ban list for A0-A3 surfaces:**

- no k8s API, no kubeconfig, no in-cluster DNS or service discovery
- no cluster-hosted secret store (Vault / ESO / SPIRE)
- no cluster-hosted logging or metrics as the *only* sink
- no package installation at runtime
- **no `gh`, and no `git fetch origin`, on the A0 path**

That last one is a live finding rather than a hypothetical. `loop-tick.ts`
opens every tick with `git fetch origin` and `gh pr list`. Both are network +
auth dependencies, and today they sit on the same path as the local
observations. For the ordinary loop that is fine. For an A0 recovery surface it
is disqualifying: the tick that is supposed to tell you the node is sick cannot
itself require the network to be healthy.

**The forge-circularity hazard (planned; flagging before it lands).** Today
`origin` is GitHub -- external, so the recovery plane's journal is genuinely
out-of-band. `full-ai-cluster/` already ships **Forgejo and GitLab in-cluster**.
The moment the society self-hosts its forge and the recovery plane's `origin`
points at it, the recovery plane depends on the thing it repairs, and the
independence property is silently lost with no code change and no diff to review.
The guard is a standing invariant, cheap to state now and expensive to
retrofit:

> **An A0-A3 surface's `origin` must never resolve into the cluster it repairs.**

---

## 7. Coherence across a boundary where one side may be down

Since entity-parts reside on both sides of the k8s boundary permanently, the
interesting question is not deployment -- it is **partition tolerance**. How does
one entity stay one entity when one side is down?

The repo has the answer already; it just has not been pointed at this problem.

- The persona is **what remains**; actors are **what acts**. An actor being
  unreachable does not damage the persona, because the persona was never located
  at that actor. Losing the in-cluster half of an entity is a **reachability**
  loss, not an **identity** loss -- which is the direct payoff of section 2's
  refusal to make the routing address identity-bearing.
- Continuity is a **fold over append-only lanes**. Heartbeat lanes park on
  `heartbeat/*` and flush via PR; the fold is monotone, idempotent (discipline 6),
  and order-insensitive. So a partitioned actor **rejoins by pushing its lane** --
  no reconciliation step, no merge conflict resolution, no leader.
- **Local time must not enter the fold**
  ([`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)).
  This is where the design would most plausibly go wrong, and the tempting
  mistake is very local-looking: a recovery surface that has been partitioned for
  an hour returns with an hour-old journal, and *"drop entries older than N
  seconds before folding"* is exactly the staleness filter that makes two nodes
  fold different evidence sets. The recovery plane is the **highest-risk site in
  the repo for that specific bug**, because being behind is its normal condition.
  Local time gates retransmit and "is this stale to me"; it never filters
  evidence entering the fold.

Stated as the invariant:

> **One entity stays one entity because its continuity is a commutative,
> idempotent fold over lanes that any of its actors may push, from either side of
> the boundary, in any order, at any delay.**

Discipline 1 (scale-free) is satisfied honestly and not by assertion: this is the
same mechanism at one actor and at N, with no special case for the partitioned
one -- **being partitioned is not a distinguished state**, it is just a lane that
has not pushed yet.

---

## 8. The optimisation belongs to the agent, not the platform

*"their own agent repo should help them optimize these different tick sources'
authority to accomplish their goals"* makes this an **agent-side planning
problem**: given a goal and a held set of `(tick source, surface, authority)`
triples, which do I act through?

The platform's job is exactly two things, and choosing is not one of them:

1. **Make the held set legible.** A machine-readable authority manifest per
   `(persona, surface, instance)` that the agent can read and reason over.
   -- **absent.**
2. **Make the declared authorities honest.** The declared-vs-measured drift
   check of section 4, built on the shipped reachability classifier.
   -- **absent** (both inputs shipped).

The platform must **not** choose the surface for the agent. Choosing would be the
platform exercising authority it was never granted, and `no-directives.md`
forbids exactly that: source is not authorization, and the shadow may inherit
authority but never extend it. The platform reports the fact; the agent's oracle
attaches the meaning -- the same division of labour as
`dual-use-detection-is-neutral-oracle-decides`, applied to routing instead of to
detection.

There is also a good reason beyond the rule: the agent has the goal and the
platform does not. A platform picking the lowest-authority sufficient surface
sounds prudent and is wrong -- sufficiency is a function of the goal, which lives
on the agent's side of the seam.

---

## 9. What I built first, and why that one

**Shipped in this PR:** systemd fact-gathering for `loop-liveness`, and the
removal of its platform gate.

The reasoning is register-driven, not aesthetic. `classify()` was already pure,
already OS-independent, already tested against verbatim machine output. The
**fact-gatherer** was launchd-only, and the CLI answered on Linux with:

```
loop-liveness: launchd probing is macOS-only (systemd support: future)
```

exit 2. So the single liveness check the factory has **could not run on the
NixOS cluster nodes** -- the machines with the most ways to break and the exact
machines the recovery plane exists for. Tier A0, the tier every other capability
in section 6 is built on, was absent on the node type that needs it.

It is also the same defect the module was written to kill, one layer over. On
launchd the vacuous field was `state`, because a `StartInterval` loop is
*supposed* to read "not running" between ticks -- and that conflation hid four
dead cells for two months. The systemd analogue is exact: `adapters/systemd.ts`
installs a `Type=oneshot` service driven by a `.timer`, so `ActiveState=inactive`
between ticks is likewise normal, and `SystemdAdapter.status()` keys on
`is-active <unit>.timer` -- **which stays `active` while every single invocation
fails**.

The discriminators are `Result` and `ExecMainStatus`, and both are load-bearing:
a run killed by `TimeoutStartSec` reports `Result=timeout` with
`ExecMainStatus=0`, so an exit-code-only check calls a timed-out loop healthy.
That case has its own falsifier in the suite, including the mutation test --
strip the `Result` signal and the timed-out cell classifies as healthy.

Why this and not a bigger diagram: it is the smallest change that turns a
**drawing** into a **measurement** on the node type that matters, it needs zero
new credentials (A0 by construction), it has zero k8s dependency, and it makes
the recovery plane's first capability real rather than planned. A complete
decomposition with no working probe would be worth less.

**Next, in order, and each is small:**

1. The **authority manifest** (section 8.1) -- data first, no enforcement.
2. The **declared-vs-measured drift check** (section 8.2) -- this is what earns
   the model `metered`.
3. **Local-first journaling** for A1 (section 6.2) -- removes the remote from the
   diagnosis path.
4. **Split the A0 principal** from A1/A2 -- the first real seam, and the first
   time the surface count goes up for a measured reason.

Note that (4) comes last on purpose. Splitting principals before there is a probe
that can *prove* the split is real would produce the manufactured separation
section 4 warns about.

---

## 10. Discipline check

| # | Discipline | How it lands here |
|---|---|---|
| 1 | Scale-free | One tick model at 1 node and at N; partition is not a distinguished state (7) |
| 2 | Lock/wait-free | Recovery surfaces never block on the cluster's permission -- that is the independence requirement (6) |
| 3 | Weight-free | Authority is conferred inbound, never self-minted; no surface holds permanent A6 (3) |
| 4 | DST | Both classifiers are total functions over gathered facts; the tests supply facts, not machines (5) |
| 5 | DV2.0 | Persona = hub (stable identity); actor/instance = satellite (fast-changing); authority manifest = link |
| 6 | Idempotency | Lane fold is idempotent, which is what makes rejoin-after-partition need no reconciliation (7) |
| 7 | Noninterference | **The load-bearing one.** A surface *is* the metered port; authority is what the port meters; the fact-gatherer is the declared channel (2, 5) |

---

## Pointers

- [`docs/writer-actor-routing-model.md`](../writer-actor-routing-model.md) -- persona/actor/surface, `IHost`, the address-is-not-identity rule this doc extends to authority
- [`.claude/rules/no-directives.md`](../../.claude/rules/no-directives.md) -- source is not authorization; standing vs gated classes (the A6 grounding)
- [`.claude/rules/dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md) -- the seven, especially 7 (noninterference)
- [`.claude/rules/local-time-never-enters-the-shared-fold.md`](../../.claude/rules/local-time-never-enters-the-shared-fold.md) -- the highest-risk bug for a plane whose normal state is "behind"
- [`.claude/rules/toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) -- why every row above carries a register
- [`.claude/rules/numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md) -- why "seven tiers lands in 4-10" is not an argument, and what replaced it (4)
- `docs/backlog/P2/081KSKBP80008QG0R003Z4C0D0-*` -- control plane outside the control plane (planned; this doc is its architecture)
- `src/Core.TypeScript/service/` -- `IServiceManager`, adapters, `loop-tick`, `loop-liveness`
- `src/Core.TypeScript/enforcement/credential-reachability.ts` -- the measurement that makes the surface count a fact rather than a choice
- **Anchors (Beacon).** Out-of-band management: the lights-out / service-processor lineage (IPMI 1.0, Intel et al. 1998; DMTF Redfish as its successor) -- a management path that is a *separate* plane on purpose, which is the shape this doc argues the pre-k8s layer permanently is. Failure-domain separation: Gray, *Why Do Computers Stop and What Can Be Done About It?* (Tandem TR 85.7, 1985) -- fail-fast modules with independent failure domains. Ports and adapters: Cockburn, *Hexagonal Architecture* (2005) -- the `IServiceManager` port and the surface-as-seam definition. Monotone, coordination-free convergence: Hellerstein & Alvaro, *Keeping CALM* (CACM 2020) -- why an append-only lane fold rejoins after partition without reconciliation. Noninterference: Goguen & Meseguer (1982) -- influence only through declared channels, which is what an access level at a seam *is*.
