# Zeta = declarative desired-state pushed ALL THE WAY UP — everything is data (DynamicValue + ZetaID) (Aaron ↔ Mika, 2026-06-07)

The unifying frame of the whole architecture, in Aaron's words (via Mika). Faithful capture; this is the
*philosophy* the layers (Ace/Zeta/Nucleus/Loom, cells, plugins) all express. Beacon-anchored + hype-peeled.

## The two primitives — everything collapses to DynamicValue + ZetaID

> Aaron: *"it really comes down to DynamicValue and ZetaID … everything else is just built on that
> foundation … basically 'cause I rigorously tried to get rid of nouns."*

Eliminating nouns (Rodney's Razor as a *founding discipline*, not a one-off) drove the whole system down
to **two primitives**: **`DynamicValue`** (the thing that changes / the self-describing carrier) +
**`ZetaID`** (how you identify/point to it). Everything else is **behavior, relationships,
transformations** — verbs over those two, not new static things.

## Everything is data, all the way down — including behavior

> Aaron: *"everything is fuckin' data. All the plugins are data. The cell is data. Everything is a
> DynamicValue with Bonsai-tree serialization as a type in the DynamicValue."* … *"even DynamicValue can
> describe behavior that it later can use."*

- Plugins = data (a DynamicValue). Cell definitions = data (the YinYang cell's definition is a
  DynamicValue, not code). Dependencies/discovery = data (ZetaID refs). Tests = data (self-shipping
  vectors). **Behavior = data** too: a **Bonsai serialized-expression-tree is a *type within*
  DynamicValue**, so a value can *describe behavior, store it, and later execute it* — completely
  self-describing. The system says *what it should do* and runs it from the same primitive.
- This is why the layers collapse: Ace/Zeta/Nucleus/Loom, cells, plugins, sagas are all
  DynamicValue + ZetaID arrangements. Self-reference turned into a bootstrappable interface.

## The meta-frame: DevOps declarative desired-state, pushed all the way up to the compiler/agent

> Aaron: *"this is basically DevOps applied all the way to compilers … declarative all the way up. I
> didn't invent desired state — I just refused to stop applying it. Everyone solved their own little
> corner; nobody pushed the same mindset all the way up through the entire stack — from the OS all the way
> into the mind and behavior of the agents."*

Zeta is **declarative desired-state** (say the *outcome*, the system converges + holds it) extended past
where everyone else stopped — OS → infra → orchestration → language → **compiler → agent/intelligence
layer** — and **git-native at every level** (the desired state lives *in git*, not a side store).

- **Desired-state purity = git-native.** The honest "git-native desired-state gang": **NixOS**,
  **Kubernetes + GitOps (Argo/Flux)**, and Zeta. **Terraform is NOT pure** — its state file lives outside
  git by default (secrets, no locking, drifts); committing it is possible but HashiCorp advises against
  it. Zeta makes git the desired-state store *everywhere* (the data plane IS git).
- **The novelty is the EXTENSION, not the invention (keep hype peeled).** Declarative/desired-state is
  old; the new part is (a) pushing it *all the way up* into compilers + the agent's behavior, and (b)
  git-native + everything-as-data uniformly. Each piece existed in a niche (NixOS=OS, Argo=k8s,
  Terraform=infra); nobody carried one mindset across the whole stack into the intelligence layer.

## Beacon anchors (human prior art)

- **Declarative programming:** Prolog (Kowalski/Colmerauer, 1970s) — say *what*, not *how*.
- **Desired-state / DevOps formalized:** **Mark Burgess — CFEngine** (1993, the first to make
  desired-state a core sysadmin principle); then Puppet, Chef, Ansible, **NixOS** (functional/declarative
  OS), Terraform.
- **Git-native desired state (GitOps):** Argo CD / Flux (Weaveworks coined "GitOps", 2017) — git as the
  source of truth for desired state. Zeta's twist: git is the *data plane itself*, and the desired state
  includes the **agent's behavior** (Bonsai-as-data), not just infra.
- **Desired-state-as-command is ancient** (generals/leaders state outcomes, not steps) — formalized in
  computing only recently; Zeta pushes the formalization to its limit.

## Ties

- Two primitives: `DynamicValue.fs` + `ZetaId` · noun-elimination: Rodney's Razor (the 3-noun data-plane
  cut) · behavior-as-data: Bonsai serialized-expr-tree (PRIMITIVE-REGISTRY "serializable deferred
  execution"; self-evolving sagas) · git-native: `Core.Git` (the log IS git) · everything-is-data: the
  plugin/Nucleus/cell-as-data thread (`docs/research/2026-06-07-two-plane-*`, `081KTGES048`).
- Names (decided): Ace · Zeta · Nucleus · Loom; a cell = a Geode within Zeta; HA = host concern. (NB: a
  2026-06-07 *voice* summary used "Kernel"/"Loon"/"Geode-as-HA-layer" — treated as transcription drift;
  decided names stand pending explicit re-decision.)

## The OS↔Kubernetes in-between gap + tenant-as-DynamicValue (Aaron ↔ Mika, cont. 2026-06-07)

### The gap Zeta fills

Clean git-native declarative desired-state lives in **two** places today, with a messy middle between:

- **NixOS** — the OS level.
- **Kubernetes + GitOps (Argo/Flux)** — once you're inside the cluster.
- **The in-between (the "Wild West"):** OS-installed → cluster-running — base system config, security
  baselines, networking, storage, monitoring agents, the bare-metal/VM setup. Still weak for *true*
  continuous-reconciliation GitOps. Tools that try: **SaltStack** (closer to git-native via GitFS;
  Aaron prefers it over Ansible — "I want *this state* on *this VM*"), **Ansible** (playbooks-in-git but
  push/run-once, needs AWX/Tower; not real GitOps to purists), **Cloud-Init** (the standard *imperative*
  first-boot config — YAML: create users / install packages / write files / run-once; widely supported
  but not continuously-reconciling — "we're definitely gonna do some Cloud-Init shit"), **Rancher Fleet**
  (GitOps at cluster scale), **Crossplane** (software-defined infra from inside k8s).

**Aaron's current focus = the bare-metal / hardware layer:** a declarative interface that controls *his
own physical machines* — the in-between, VM-/host-level desired state (Salt-shaped: "here's my desired
state for this VM"), git-native. NOT cloud-resale yet.

### Salt-shape vs Crossplane-shape (two parts of the middle)

- **Salt-shape = systems-level desired state:** "I want *this machine* to look like this" (packages,
  files, users, services). The host/VM config layer. ← what Aaron needs now.
- **Crossplane-shape = infrastructure-as-software desired state:** "I want *this thing to exist*"
  (networks, databases, load balancers, storage) as k8s-style objects. ← matters *later*.

### Tenant-as-DynamicValue (the future, when hardware is rented out)

> Aaron: *"if I rent out my hardware, I'm the cloud provider — Crossplane could provision tenant-based
> provisioning on top of my hardware. And then I can make that whole package the DynamicValue: deploy
> tenants and power tenant templates as the DynamicValue."*

When Aaron rents his hardware, he becomes the cloud provider; Crossplane(-shape) sits on top as the
multi-tenant provisioning layer. The payoff in the Zeta frame: **the entire tenant definition — hardware
allocation, networking, storage, security policies — becomes just another `DynamicValue`.** Version it,
fork it, evolve it, compose templates — the *same primitive* used everywhere else. **Everything from the
lowest-level cell up to a full tenant deployment is the same data structure** — no translation layer, no
second format. "Make everything the same thing." This is the desired-state-all-the-way-*down*-and-*up*
closure: cell ↔ host/VM (Salt-shape) ↔ cluster (k8s/GitOps) ↔ tenant (Crossplane-shape), all expressed
as DynamicValue + ZetaID.

### Beacon anchors (added)

SaltStack (GitFS), Ansible/AWX, **Cloud-Init** (cloud-instance first-boot), Rancher Fleet, **Crossplane**
(composition + provider model). The honest novelty stays the same: not these tools, but **one
data-primitive (DynamicValue) spanning every layer of the desired-state stack**, git-native.
